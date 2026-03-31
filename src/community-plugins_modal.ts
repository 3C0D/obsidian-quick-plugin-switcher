import type { App, TFile } from 'obsidian';
import {
	DropdownComponent,
	Menu,
	Modal,
	Notice,
	Platform,
	type PluginManifest,
	normalizePath,
	prepareSimpleSearch,
	requestUrl,
	setIcon
} from 'obsidian';
import type QuickPluginSwitcher from './main.ts';
import {
	calculateTimeElapsed,
	formatNumber,
	getSelectedContent,
	isEnabled,
	removeItem
} from './utils.ts';
import {
	pressDelay,
	getInstalled,
	isInstalled,
	reOpenModal,
	getElementFromMousePosition,
	getHidden,
	focusSearchInput,
	getHasNote
} from './modal_utils.ts';
import {
	addSearch,
	checkbox,
	doSearchCPM,
	findMatchingItem,
	getFilters,
	handleClick,
	handleContextMenu,
	handleDblClick,
	handleTouchStart,
	notesButton,
	openGitHubRepo,
	searchCommDivButton,
	showStats,
	vertDotsButton
} from './modal_components.ts';
import { ReadMeModal, SeeNoteModal } from './secondary_modals.ts';
import { QPSModal, circleCSSModif, toggleVisibility } from './main_modal.ts';
import { CommFilters, GroupsComm } from './types/variables.ts';
import {
	setGroupTitle,
	byGroupDropdowns,
	getEmojiForGroup,
	getCirclesItem,
	installAllPluginsInGroup,
	getIndexFromSelectedGroup,
	rmvAllGroupsFromPlugin
} from './groups.ts';
import type { KeyToSettingsMapType } from './types/global.ts';
import { translation } from './translate.ts';

/** Main modal for the community plugins browser. Closes back to QPSModal on exit. */
export class CPModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	searchTyping = true;
	groups: HTMLElement;
	hotkeysDesc: HTMLElement;
	isDblClick = false;
	pressed = false;
	mousePosition: { x: number; y: number };
	searchInit = true;

	constructor(
		app: App,
		public plugin: QuickPluginSwitcher
	) {
		super(app);
		this.plugin = plugin;
	}

	// stored as arrow functions so they can be added/removed as event listeners
	getMousePosition = (event: MouseEvent): void => {
		this.mousePosition = { x: event.clientX, y: event.clientY };
	};
	getHandleKeyDown = async (event: KeyboardEvent): Promise<void> => {
		await handleKeyDown(event, this);
	};
	/** Guards all event handlers against firing during a double-click sequence. */
	private shouldIgnoreEvent(): boolean {
		return this.isDblClick;
	}

	getHandleContextMenu = async (evt: MouseEvent): Promise<void> => {
		if (this.shouldIgnoreEvent()) return;
		await handleContextMenu(evt, this);
	};
	getHandleDblClick = (evt: MouseEvent): void => {
		if (this.shouldIgnoreEvent()) return;
		handleDblClick(evt, this);
	};
	getHandleClick = (evt: MouseEvent): void => {
		if (this.shouldIgnoreEvent()) return;
		handleClick(evt, this);
	};
	getHandleTouch = (evt: TouchEvent): void => {
		if (this.shouldIgnoreEvent()) return;
		handleTouchStart(evt, this);
	};

	removeListeners(): void {
		this.modalEl.removeEventListener('mousemove', this.getMousePosition);
		document.removeEventListener('keydown', this.getHandleKeyDown);
		this.modalEl.removeEventListener('contextmenu', this.getHandleContextMenu);
		if (Platform.isDesktop) {
			this.modalEl.removeEventListener('dblclick', this.getHandleDblClick);
			this.modalEl.removeEventListener('click', this.getHandleClick);
		}
		if (Platform.isMobile) {
			this.modalEl.removeEventListener('touchstart', this.getHandleTouch);
		}
	}

	/** Creates the DOM structure and attaches all event listeners. */
	container(): void {
		const { contentEl } = this;
		this.modalEl.addClass('community-plugins-modal');
		this.header = contentEl.createEl('div', {
			cls: 'qps-community-header'
		});
		this.search = contentEl.createEl('div', {
			cls: 'qps-community-search'
		});
		this.groups = contentEl.createEl('div', {
			cls: ['qps-community-groups', 'qps-comm-group']
		});
		this.hotkeysDesc = contentEl.createEl('p', { cls: 'qps-hk-desc' });
		this.items = contentEl.createEl('div', { cls: 'qps-community-items' });

		this.modalEl.addEventListener('mousemove', this.getMousePosition);
		document.addEventListener('keydown', this.getHandleKeyDown);
		this.modalEl.addEventListener('contextmenu', this.getHandleContextMenu);
		if (Platform.isDesktop) {
			this.modalEl.addEventListener('dblclick', this.getHandleDblClick);
			this.modalEl.addEventListener('click', this.getHandleClick);
		}
		if (Platform.isMobile) {
			this.modalEl.addEventListener('touchstart', this.getHandleTouch);
		}
	}

	async onOpen(): Promise<void> {
		this.removeListeners();
		const { plugin, contentEl } = this;
		const { settings } = plugin;
		if (this.searchInit) settings.search = '';
		this.searchInit = true;
		contentEl.empty();
		this.container();
		setGroupTitle(this, GroupsComm, settings.numberOfGroupsComm);
		this.addHeader(this.header);
		await addSearch(this, this.search, 'Search community plugins');
		if (Platform.isDesktopApp) {
			searchCommDivButton(this, this.search);
		}
		this.addGroups(this, this.groups);
		if (settings.showHotKeys && !this.app.isMobile) this.setHotKeysdesc();
		await this.addItems(settings.search);
	}

	addHeader = (contentEl: HTMLElement): void => {
		const { plugin } = this;
		const { settings } = plugin;
		//dropdown filters
		new DropdownComponent(contentEl)
			.addOptions({
				all: `All(${Object.keys(settings.commPlugins).length})`,
				installed: `Installed(${getInstalled().length})`,
				notInstalled: Platform.isMobile
					? 'Not Installed'
					: `Not Installed(${
							Object.keys(settings.commPlugins).length -
							getInstalled().length
						})`,
				byGroup: `By Group`,
				hidden: `Hidden(${getHidden(this, Object.keys(settings.commPlugins)).length})`,
				hasNote: `With Note(${getHasNote(this, Object.keys(settings.commPlugins)).length})`
			})
			.setValue(settings.filtersComm as string)
			.onChange(async (value: keyof typeof CommFilters) => {
				settings.filtersComm = value;
				await plugin.saveSettings();
				await reOpenModal(this);
			});

		byGroupDropdowns(this, contentEl);
		getFilters(this, contentEl);
		checkbox(this, contentEl, 'Inv');
	};

	addGroups(modal: CPModal, contentEl: HTMLElement): void {
		const groups = Object.values(GroupsComm);

		for (let i = 1; i < groups.length; i++) {
			const groupKey = groups[i];

			contentEl.createEl(
				'span',
				{
					cls: 'qps-group-span-container'
				},
				(cont) => {
					cont.createEl(
						'span',
						{
							cls: 'qps-circle-title-group'
						},
						(el) => {
							circleCSSModif(this, el, i);
						}
					);

					const span = cont.createEl(
						'span',
						{
							cls: 'qps-groups-name',
							text: `${groupKey}`
						},
						(el) => {
							const { plugin } = modal;
							const { settings } = plugin;
							const hidden = settings.groupsComm[i]?.hidden;
							if (hidden) {
								el.style.textDecoration = 'line-through';
								el.style.opacity = '0.6';
							} else {
								el.style.textDecoration = 'none';
							}
						}
					);

					const groupNumberText = cont.createSpan({
						cls: 'shortcut-number',
						text: `${i}:`
					});
					span.insertBefore(groupNumberText, span.firstChild);
				}
			);
		}
		if (!this.app.isMobile) {
			contentEl.createSpan({
				text: `> (h)👁️ (🖱️x2)name`
			});
		} else {
			contentEl.createSpan({
				text: `(🖱️x2)name,icon:delay (🖱️...)context-menu`
			});
		}
	}

	setHotKeysdesc(): void {
		const numberOfGroups = this.plugin.settings.numberOfGroupsComm;
		this.hotkeysDesc.createSpan(
			{
				text: `(1-${numberOfGroups})➕ (0)❌ `
			},
			(el) => {
				el.createSpan({ text: '(g)' }, (el) => {
					const gitHubIcon = el.createSpan({ cls: 'git-hub-icon' });
					setIcon(gitHubIcon, 'github');
				});
				el.createSpan({
					text: ` (🖱️x2/ctrl)Readme `
				});
				el.createSpan({ text: '(n)📝 ' });
				el.createSpan({ text: '(s)📊 ' });
				el.createSpan({ text: '(t)translate' });
			}
		);
	}

	async addItems(value: string): Promise<void> {
		const { plugin } = this;
		const { settings } = plugin;
		const { commPlugins, pluginStats } = settings;
		let listItems = doSearchCPM(value, commPlugins);
		listItems = cpmModeSort(this, listItems);
		sortItemsBy(this, listItems);
		await this.drawItemsAsync(listItems, pluginStats, value);
	}

	/** Wraps search matches in <span class="highlighted"> for visual highlighting. */
	highlightSpan(value: string, text: string): string {
		if (value.trim() === '') return text;

		const search = prepareSimpleSearch(value)(text);
		const matches = search?.matches || [];
		if (!matches.length) return text;

		let result = '';
		let lastIndex = 0;

		matches.forEach(([start, end]) => {
			result += text.slice(lastIndex, start);
			result += `<span class="highlighted">${text.slice(start, end)}</span>`;
			lastIndex = end;
		});
		result += text.slice(lastIndex);

		return result;
	}

	/**
	 * Renders items in batches of 50 to avoid blocking the UI on large plugin lists.
	 */
	async drawItemsAsync(
		listItems: string[],
		pluginStats: PackageInfoData,
		value: string
	): Promise<void> {
		const batchSize = 50;
		let index = 0;

		const { plugin } = this;
		const { settings } = plugin;
		const { commPlugins, filtersComm } = settings;

		while (index < listItems.length) {
			const batch = listItems.slice(index, index + batchSize);
			const promises = batch.map(async (item) => {
				if (
					commPlugins[item].groupCommInfo?.hidden &&
					!commPlugins[item].groupCommInfo.groupIndices.length
				) {
					commPlugins[item].groupCommInfo.hidden = false;
				} //if removed from group
				if (filtersComm !== CommFilters.byGroup) {
					if (
						commPlugins[item].groupCommInfo?.hidden &&
						filtersComm === 'all'
					) {
						return;
					}
				}
				// blocks
				const itemContainer = this.items.createEl('div', {
					cls: 'qps-comm-block'
				});
				itemContainer.setAttribute('data-plugin-id', item);

				if (this.app.isMobile) {
					itemContainer.createEl(
						'div',
						{
							cls: 'button-container'
						},
						(el) => {
							vertDotsButton(el);
						}
					);
				}

				const notesButtonContainer = itemContainer.createEl(
					'div',
					{
						cls: 'button-container1'
					},
					(el) => {
						notesButton(el);
					}
				);
				// higher because only 1 button
				if (Platform.isDesktop) {
					notesButtonContainer.addClass('button-container1-desktop');
				}
				// color background
				if (commPlugins[item].hasNote) {
					notesButtonContainer.addClass('notes-button-background');
				}
				// highlight search results
				const name = this.highlightSpan(value, commPlugins[item].name);
				const author = `by ${this.highlightSpan(value, commPlugins[item].author)}`;
				const desc = this.highlightSpan(value, commPlugins[item].description);

				// community plugin name
				itemContainer.createDiv(
					{ cls: 'qps-community-item-name' },
					(el: HTMLElement) => {
						const tempDiv = document.createElement('div');
						tempDiv.innerHTML = name;
						while (tempDiv.firstChild) {
							el.appendChild(tempDiv.firstChild);
						}
						if (isInstalled(item)) {
							el.createSpan({ cls: 'installed-span', text: 'installed' });
						}
						if (isEnabled(this, item)) {
							const span = el.createSpan({ cls: 'enabled-span' });
							setIcon(span, 'power');
						}
					}
				);

				//author
				itemContainer.createDiv(
					{ cls: 'qps-community-item-author' },
					(el: HTMLElement) => {
						const tempDiv = document.createElement('div');
						tempDiv.innerHTML = author;
						while (tempDiv.firstChild) {
							el.appendChild(tempDiv.firstChild);
						}
					}
				);

				const pluginInfo = pluginStats[item];
				itemContainer.createDiv(
					{ cls: 'qps-community-item-downloads' },
					(el: HTMLElement) => {
						el.createSpan({ cls: 'downloads-span' }, (el) => {
							const preSpan = el.createSpan();
							const text = pluginInfo
								? formatNumber(pluginInfo.downloads, 1).toString()
								: '0';
							const span = el.createSpan({
								text: text,
								cls: 'downloads-text-span'
							});
							addGroupCircles(this, span, item);
							setIcon(preSpan, 'download-cloud');
						});
					}
				);

				const lastUpdated = pluginInfo ? new Date(pluginInfo.updated) : null;
				const timeSinceUpdate = lastUpdated
					? calculateTimeElapsed(lastUpdated)
					: '';
				// Updated
				itemContainer.createDiv({
					cls: 'qps-community-item-updated',
					text: lastUpdated
						? `Updated ${timeSinceUpdate}`
						: 'Updated: not available yet'
				});

				// desc
				itemContainer.createDiv(
					{ cls: 'qps-community-item-desc' },
					(el: HTMLElement) => {
						const tempDiv = document.createElement('div');
						tempDiv.innerHTML = desc;
						while (tempDiv.firstChild) {
							el.appendChild(tempDiv.firstChild);
						}
					}
				);

				return itemContainer;
			});

			await Promise.all(promises);
			index += batchSize;
		}
	}

	async onClose(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		this.removeListeners();
		await this.plugin.installedUpdate();
		new QPSModal(this.app, this.plugin).open();
		focusSearchInput(100);
	}
}

/** Generic fetch wrapper — returns parsed JSON or null on error. */
export async function fetchData(url: string, message?: string): Promise<unknown> {
	try {
		const response = await requestUrl(url);
		if (response.status !== 200) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return response.json;
	} catch (e) {
		if (message) {
			console.warn(message, e);
		} else {
			console.warn(`Error fetching data from ${url}:`, e);
		}
		return null;
	}
}

/** Tries README.md then README.org from the GitHub API. Returns the raw API response or null. */
export async function getReadMe(item: PluginCommInfo): Promise<unknown> {
	const repo = item.repo;
	const readmeFormats = ['README.md', 'README.org'];

	for (const format of readmeFormats) {
		const repoURL = `https://api.github.com/repos/${repo}/contents/${format}`;
		try {
			const response = await requestUrl(repoURL);
			if (response.status === 200) {
				return response.json;
			}
		} catch {
			// console.warn(`Error fetching ${format} for ${repo}:`, error);
		}
	}

	console.warn(`No README found for ${repo}`);
	return null;
}

export async function getManifest(
	modal: CPModal | QPSModal,
	id: string
): Promise<PluginManifest | null> {
	// todo check if last release is ok same manifest version
	const { commPlugins } = modal.plugin.settings;
	const repo = commPlugins[id]?.repo;
	const repoURL = `https://raw.githubusercontent.com/${repo}/HEAD/manifest.json`;

	return (await fetchData(
		repoURL,
		`Error fetching manifest for ${id}:`
	)) as PluginManifest | null;
}

export async function getReleaseVersion(
	modal: CPModal | QPSModal,
	id: string,
	manifest: PluginManifest
): Promise<boolean> {
	const { commPlugins } = modal.plugin.settings;
	const repo = commPlugins[id].repo;
	// manifest.version = "100.0.0" //debug

	const releaseUrl = `https://github.com/${repo}/releases/tag/${manifest.version}`;

	try {
		const response = await requestUrl(releaseUrl);
		if (response) return true;
		return false;
	} catch {
		return false;
	}
}

/** Sorts by the active sortBy setting, respecting the invertFiltersComm toggle. */
function sortItemsBy(modal: CPModal, listItems: string[]): string[] {
	const { settings } = modal.plugin;
	const { commPlugins } = settings;
	const { sortBy } = settings;

	const sortFunctions: { [key: string]: () => string[] } = {
		Downloads: () =>
			listItems.sort((a, b) => {
				return settings.invertFiltersComm
					? commPlugins[a].downloads - commPlugins[b].downloads
					: commPlugins[b].downloads - commPlugins[a].downloads;
			}),
		Updated: () =>
			listItems.sort((a, b) =>
				settings.invertFiltersComm
					? commPlugins[a].updated - commPlugins[b].updated
					: commPlugins[b].updated - commPlugins[a].updated
			),
		Alpha: () =>
			listItems.sort((a, b) =>
				settings.invertFiltersComm
					? commPlugins[b].name.localeCompare(commPlugins[a].name)
					: commPlugins[a].name.localeCompare(commPlugins[b].name)
			),
		Released: () =>
			listItems.sort((a, b) => {
				const indexA = settings.plugins.findIndex(
					(id: string) => id === commPlugins[a].id
				);
				const indexB = settings.plugins.findIndex(
					(id: string) => id === commPlugins[b].id
				);
				return settings.invertFiltersComm ? indexA - indexB : indexB - indexA;
			})
	};

	return (sortFunctions[sortBy] || sortFunctions['Downloads'])();
}

/** Applies the active filter mode (installed, notInstalled, byGroup, hidden, hasNote). */
function cpmModeSort(modal: CPModal, listItems: string[]): string[] {
	const { settings } = modal.plugin;
	const { filtersComm, commPlugins } = settings;

	const sortFunctions: { [key: string]: () => string[] } = {
		[CommFilters.installed]: () => {
			const installedPlugins = getInstalled();
			return listItems.filter((item) => installedPlugins.includes(item));
		},
		[CommFilters.notInstalled]: () => {
			const installedPlugins = getInstalled();
			return listItems.filter((item) => !installedPlugins.includes(item));
		},
		[CommFilters.hasNote]: () => {
			return listItems.filter((item) => commPlugins[item].hasNote);
		},
		[CommFilters.byGroup]: () => {
			const groupIndex = getIndexFromSelectedGroup(settings.selectedGroup);
			if (groupIndex !== 0) {
				return listItems.filter(
					(i) =>
						commPlugins[i].groupCommInfo?.groupIndices.indexOf(groupIndex) !==
						-1
				);
			}
			return listItems;
		},
		[CommFilters.hidden]: () => getHidden(modal, listItems),
		[CommFilters.all]: () => listItems
	};

	return (sortFunctions[filtersComm] || sortFunctions[CommFilters.all])();
}

const handleKeyDown = async (event: KeyboardEvent, modal: CPModal): Promise<void> => {
	const elementFromPoint = getElementFromMousePosition(modal);
	const targetBlock = elementFromPoint?.closest('.qps-comm-block') as HTMLElement;

	const targetGroupIcon = elementFromPoint?.closest(
		'.qps-circle-title-group'
	) as HTMLElement;
	const targetGroup = elementFromPoint?.closest('.qps-groups-name') as HTMLElement;

	if (targetBlock) {
		(
			document.querySelector('.qps-search-component input') as HTMLInputElement
		)?.blur(); // for a reason not working in a function. must be fast I guess
		modal.searchTyping = false;
		const matchingItem = findMatchingItem(modal, targetBlock);
		if (matchingItem) {
			event.preventDefault();
			await handleHotkeysCPM(modal, event, matchingItem as PluginCommInfo);
		}
	} else if ((targetGroupIcon || targetGroup) && event.key === 'h') {
		modal.searchTyping = false;
		await toggleVisibility(modal, targetGroupIcon, targetGroup);
	} else {
		modal.searchTyping = true;
	}
};

/**
 * Handles keyboard shortcuts over a community plugin block:
 * number keys add to group, 0/Del removes, g/n/s/t open github/note/stats/translate,
 * ctrl/meta opens the README modal.
 */
const handleHotkeysCPM = async (
	modal: CPModal,
	evt: KeyboardEvent,
	pluginItem: PluginCommInfo
): Promise<void> => {
	if (modal.pressed) {
		// with press delay...
		return;
	}
	pressDelay(modal);
	const { plugin } = modal;
	const { settings } = plugin;
	const { groupsComm, commPlugins } = settings;
	const numberOfGroups = settings.numberOfGroupsComm;

	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: async () => await openGitHubRepo(evt, modal, pluginItem),
		n: async () => await handleNote(evt, modal, pluginItem),
		s: async () => showStats(pluginItem),
		t: async () => {
			const selectedContent = getSelectedContent() ?? '';
			await translation(modal.app, selectedContent);
		}
	};

	const keyPressed = evt.key;
	let groupIndices = pluginItem.groupCommInfo.groupIndices;
	const key = parseInt(keyPressed);
	if (key > 0 && key <= numberOfGroups) {
		if (groupIndices.length === 6) return;
		const index = groupIndices.indexOf(key);
		if (index === -1) {
			groupIndices.push(key);
			if (groupsComm[key].hidden)
				commPlugins[pluginItem.id].groupCommInfo.hidden = true;
			await reOpenModal(modal);
		}
	} else if (keyPressed in KeyToSettingsMap) {
		KeyToSettingsMap[keyPressed]();
	} else if (evt.metaKey || evt.ctrlKey) {
		new ReadMeModal(plugin.app, modal, pluginItem).open();
	} else if (
		keyPressed === 'Delete' ||
		keyPressed === 'Backspace' ||
		keyPressed === '0'
	) {
		if (groupIndices.length === 1) {
			pluginItem.groupCommInfo.groupIndices = [];
			await plugin.saveSettings();
			await reOpenModal(modal);
		} else if (groupIndices.length > 1) {
			const menu = new Menu();
			menu.addItem((item) =>
				item.setTitle('Remove item group(s)').setDisabled(true).setDisabled(true)
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item.setTitle('All').onClick(async () => {
					await rmvAllGroupsFromPlugin(modal, pluginItem);
				})
			);
			for (const groupIndex of groupIndices) {
				const { emoji } = getEmojiForGroup(groupIndex);
				menu.addItem((item) =>
					item.setTitle(`${emoji} group ${groupIndex}`).onClick(async () => {
						groupIndices = removeItem(groupIndices, groupIndex);
						await plugin.saveSettings();
						await reOpenModal(modal);
					})
				);
			}
			menu.showAtPosition(modal.mousePosition);
		}
	}
};

const addGroupCircles = (modal: CPModal, el: HTMLElement, item: string): void => {
	const { settings } = modal.plugin;
	const { commPlugins } = settings;
	const indices = commPlugins[item].groupCommInfo.groupIndices;
	if (!indices.length) return;

	const insertElements = (parts: number[]): void => {
		const div = document.createElement('div');
		div.innerHTML = getCirclesItem(parts);
		Array.from(div.children).forEach((child) =>
			el.insertAdjacentElement('afterend', child)
		);
	};

	if (indices.length < 3) {
		insertElements(indices);
	} else if (indices.length < 5) {
		insertElements(indices.slice(0, 2));
		insertElements(indices.slice(2));
	} else {
		insertElements(indices.slice(0, 2));
		insertElements(indices.slice(2, 4));
		insertElements(indices.slice(4));
	}
};

export async function installFromList(modal: CPModal, enable = false): Promise<void> {
	const pluginList = await getPluginListFromFile();

	if (pluginList) {
		const plugins = Object.keys(modal.plugin.settings.commPlugins).filter((id) =>
			pluginList.includes(id)
		);
		await installAllPluginsInGroup(modal, plugins, enable);
	}
}

async function getPluginListFromFile(): Promise<string[] | null> {
	if (!Platform.isDesktop) {
		new Notice('File import only available in desktop version', 3000);
		return null;
	}

	const properties = ['openFile'];
	const filePaths = (
		window as unknown as WindowWithElectron
	).electron!.remote.dialog.showOpenDialogSync({
		title: 'Pick json list file of plugins to install',
		properties,
		filters: [{ name: 'JsonList', extensions: ['json'] }]
	}) as string[] | undefined;

	if (filePaths && filePaths.length) {
		try {
			// Use Node.js fs for reading files outside the vault
			const fs = window.require('fs');
			const contenu = fs.readFileSync(filePaths[0], 'utf-8');
			const pluginList = JSON.parse(contenu);
			if (Array.isArray(pluginList)) {
				return pluginList;
			} else {
				console.error('this file is not a JSON list.');
				new Notice('Error: The selected file is not a valid JSON list.', 3000);
			}
		} catch (erreur) {
			const errorMsg = erreur instanceof Error ? erreur.message : String(erreur);
			console.error('Error reading JSON file: ', errorMsg);
			new Notice('Error: Could not read the selected JSON file.', 3000);
		}
	}
	return null;
}

export async function getPluginsList(modal: CPModal, _save = false): Promise<void> {
	const installed = getInstalled();

	if (Platform.isDesktop) {
		// Desktop version: use file dialog
		const filePath = (
			window as unknown as WindowWithElectron
		).electron!.remote.dialog.showSaveDialogSync({
			title: 'Save installed plugins list as JSON',
			filters: [{ name: 'JSON Files', extensions: ['json'] }]
		}) as string | undefined;
		if (filePath && filePath.length) {
			try {
				const jsonContent = JSON.stringify(installed, null, 2);
				const fs = window.require('fs');
				fs.writeFileSync(filePath, jsonContent);
				new Notice(`${filePath} created`, 2500);
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.error('Error saving JSON file:', errorMsg);
			}
		}
	} else {
		// Portable version: save to vault
		try {
			const jsonContent = JSON.stringify(installed, null, 2);
			const fileName = `installed-plugins-${new Date().toISOString().split('T')[0]}.json`;
			await modal.app.vault.create(fileName, jsonContent);
			new Notice(`${fileName} created in vault root`, 2500);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error('Error saving JSON file:', errorMsg);
			new Notice('Error saving plugin list', 2500);
		}
	}
}

export async function installPluginFromOtherVault(
	modal: CPModal,
	enable = false
): Promise<void> {
	if (!Platform.isDesktop) {
		new Notice('Import from other vault only available in desktop version', 3000);
		return;
	}

	const dirPath = (
		window as unknown as WindowWithElectron
	).electron!.remote.dialog.showOpenDialogSync({
		title: 'Select your vault directory, you want plugins list from',
		properties: ['openDirectory']
	}) as string[] | undefined;
	if (dirPath && dirPath.length) {
		const vaultPath = dirPath[0];
		const fs = window.require('fs');
		const path = window.require('path');

		const obsidianPath = path.join(vaultPath, '.obsidian');
		// isVault?
		if (!fs.existsSync(obsidianPath)) {
			new Notice('Select a vault folder!', 2500);
			return;
		}

		// don't select actual vault!
		const selectedVaultName = path.basename(vaultPath);
		const currentVaultName = modal.app.vault.getName();

		if (selectedVaultName === currentVaultName) {
			new Notice('You have selected the current vault!', 2500);
			return;
		}

		const pluginsPath = path.join(obsidianPath, 'plugins');
		if (!fs.existsSync(pluginsPath)) {
			new Notice("This vault doesn't contain any installed plugin!", 2500);
			return;
		}

		const installedPlugins: string[] = [];
		try {
			const pluginFolders = fs.readdirSync(pluginsPath);

			for (const pluginFolder of pluginFolders) {
				const pluginFolderPath = path.join(pluginsPath, pluginFolder);
				const packageJsonPath = path.join(pluginFolderPath, 'package.json');
				const manifestJsonPath = path.join(pluginFolderPath, 'manifest.json');
				const mainJsPath = path.join(pluginFolderPath, 'main.js');

				if (fs.existsSync(packageJsonPath)) {
					// Le plugin a un package.json (dev plugin)
					continue;
				}

				if (fs.existsSync(manifestJsonPath) && fs.existsSync(mainJsPath)) {
					const manifestContent = fs.readFileSync(manifestJsonPath, 'utf-8');
					const manifestData = JSON.parse(manifestContent);
					const pluginId = manifestData.id;
					installedPlugins.push(pluginId);
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error('Error reading plugins directory:', errorMsg);
			new Notice('Error reading plugins directory', 2500);
			return;
		}

		if (!installedPlugins.length) {
			new Notice('Found no plugin to install', 2500);
			return;
		}

		const plugins = Object.keys(modal.plugin.settings.commPlugins).filter((id) => {
			return installedPlugins.includes(id);
		});
		await installAllPluginsInGroup(modal, plugins, enable);
	}
}

export async function updateNotes(plugin: QuickPluginSwitcher): Promise<void> {
	const name = 'Community plugins notes';
	const dir = plugin.settings.commPluginsNotesFolder;
	const path = normalizePath(dir ? `${dir}/${name}.md` : `${name}.md`);
	const note = this.app.vault.getAbstractFileByPath(path) as TFile;

	const { commPlugins } = plugin.settings;

	if (note) {
		// The note file exists, we update the hasNote values according to the content
		const content = await this.app.vault.read(note);
		const h1Titles: string[] = content
			.split('\n')
			.filter((line: string) => line.startsWith('# '))
			.map((line: string) => line.substring(2).trim());

		for (const plugin of Object.values(commPlugins)) {
			plugin.hasNote = h1Titles.includes(plugin.name);
		}
	} else {
		// The note file does not exist, we set all hasNote values to false
		for (const item of Object.values(commPlugins)) {
			item.hasNote = false;
		}
	}
}

/**
 * Opens or creates the shared notes file, finds or creates the plugin's H1 section,
 * then opens SeeNoteModal for editing.
 */
export async function handleNote(
	_e: KeyboardEvent | MouseEvent | TouchEvent,
	modal: CPModal,
	pluginItem: PluginCommInfo,
	_this?: ReadMeModal
): Promise<void> {
	const name = 'Community plugins notes';
	const dir = modal.plugin.settings.commPluginsNotesFolder;
	let note: TFile | null;
	if (dir && !modal.app.vault.getAbstractFileByPath(dir)) {
		await modal.app.vault.createFolder(dir);
	}
	const path = normalizePath(dir ? `${dir}/${name}.md` : `${name}.md`);
	note = modal.app.vault.getFileByPath(path);

	if (!note) {
		await modal.app.vault.create(path, '');
		note = modal.app.vault.getFileByPath(path);
	}
	let content = note ? await modal.app.vault.read(note) : '';
	const sectionHeader = '# ' + pluginItem.name;
	const sectionIndex = content.indexOf(sectionHeader);
	let sectionContent = '';

	if (sectionIndex !== -1) {
		const contentAfterSection = content.substring(sectionIndex);
		const nextSectionIndex = contentAfterSection.indexOf(
			'\n# ',
			sectionHeader.length
		);
		sectionContent =
			nextSectionIndex !== -1
				? contentAfterSection.substring(0, nextSectionIndex)
				: contentAfterSection;
		sectionContent = sectionContent.replace(sectionHeader + '\n\n', '');
	} else {
		if (content && !content.endsWith('\n')) {
			content = content + '\n';
		}
		const added = content
			? content + '\n' + sectionHeader + '\n\n'
			: sectionHeader + '\n\n';
		await modal.app.vault.modify(note as TFile, added);
		content = await modal.app.vault.read(note as TFile);
		sectionContent = '';
	}

	new SeeNoteModal(
		modal.app,
		modal,
		pluginItem,
		sectionContent,
		async (result) => {
			await cb(
				result,
				modal,
				pluginItem,
				sectionContent,
				note as TFile,
				content,
				_this
			);
		},
		_this
	).open();
}

/** Callback from SeeNoteModal — handles the 4 possible outcomes: null, empty, unchanged, updated. */
async function cb(
	result: string | null,
	modal: CPModal,
	pluginItem: PluginCommInfo,
	sectionContent: string,
	note: TFile,
	content: string,
	_this?: ReadMeModal
): Promise<void> {
	// Case 1: Result is null - Removes the section
	if (result === null) {
		const updatedContent = content.replace(sectionContent, '');
		await modal.app.vault.modify(note, updatedContent);
		return;
	}

	// Case 2: Result is empty - Removes the section and updates settings
	if (result.trim() === '') {
		const regexPattern = new RegExp(
			`# ${pluginItem.name}\n\n?${escapeRegExp(sectionContent)}\n?`,
			'g'
		);
		const updatedContent = content.replace(regexPattern, '');
		await modal.app.vault.modify(note, updatedContent);
		await updatePluginSettings(modal, pluginItem, false);
		reopenModals(modal, _this);
		return;
	}

	// Case 3: Content is unchanged - Does nothing
	if (sectionContent.trim() === result.trim()) {
		return;
	}

	// Case 4: Content is updated
	if (!sectionContent) {
		await modal.app.vault.append(note, result);
	} else {
		const updatedContent = content.replace(sectionContent, result);
		await modal.app.vault.modify(note, updatedContent);
	}

	await updatePluginSettings(modal, pluginItem, true);
	reopenModals(modal, _this);
}

async function updatePluginSettings(
	modal: CPModal,
	pluginItem: PluginCommInfo,
	hasNote: boolean
): Promise<void> {
	pluginItem.hasNote = hasNote;
	await modal.plugin.saveSettings();
}

/** Refreshes both the ReadMeModal (if open) and the CPModal after a note change. */
function reopenModals(modal: CPModal, _this?: ReadMeModal): void {
	if (_this) {
		_this.onOpen();
	}
	modal.searchInit = false;
	modal.onOpen();
}

/** Escapes special regex characters in a string for safe use in RegExp constructor. */
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
