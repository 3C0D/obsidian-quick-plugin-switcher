import type { App } from 'obsidian';
import {
	DropdownComponent,
	Menu,
	Modal,
	Platform,
	ToggleComponent,
	setIcon
} from 'obsidian';
import { removeItem } from './utils.ts';
import type QuickPluginSwitcher from './main.ts';
import {
	mostSwitchedResetButton,
	itemToggleClass,
	itemTextComponent,
	openGitHubRepo,
	searchDivButtons,
	handleContextMenu,
	addSearch,
	handleDblClick,
	findMatchingItem,
	doSearchQPS,
	hideOnCLick,
	checkbox,
	vertDotsButton,
	handleClick,
	handleTouchStart
} from './modal_components.ts';
import {
	delayedReEnable,
	openDirectoryInFileManager,
	pressDelay,
	togglePlugin,
	reOpenModal,
	openPluginSettings,
	showHotkeysFor,
	getElementFromMousePosition,
	modeSort,
	getHidden
} from './modal_utils.ts';
import { DescriptionModal } from './secondary_modals.ts';
import { Filters, Groups, TargetPlatform } from './types/variables.ts';
import {
	setGroupTitle,
	byGroupDropdowns,
	getEmojiForGroup,
	getCirclesItem,
	rmvAllGroupsFromPlugin,
	groupIsEmpty,
	groupNbFromEmoticon,
	getPluginsInGroup,
	groupNbFromGrpName
} from './groups.ts';
import type { CPModal } from './community-plugins_modal.ts';
import type { KeyToSettingsMapType } from './types/global.ts';

/** Main modal for QPS — lists all installed plugins with toggle, group, and filter controls. */
export class QPSModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	groups: HTMLElement;
	hotkeysDesc: HTMLElement;
	searchTyping = true;
	isDblClick = false;
	mousePosition: { x: number; y: number };
	pressed = false;
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
		this.modalEl.addClass('qps-modal');
		this.header = contentEl.createEl('div', {
			cls: 'qps-header'
		});
		this.search = contentEl.createEl('div', { cls: 'qps-search' });
		this.groups = contentEl.createEl('div', { cls: 'qps-groups' });
		this.hotkeysDesc = contentEl.createEl('p', { cls: 'qps-hk-desc' });
		this.items = contentEl.createEl('div', { cls: 'qps-items' });

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
		setGroupTitle(this, Groups, settings.numberOfGroups);
		this.addHeader(this.header);
		await addSearch(this, this.search, 'Search plugins');
		checkbox(this, this.search, 'Author');
		searchDivButtons(this, this.search);
		this.addGroups(this.groups);
		if (settings.showHotKeys && !this.app.isMobile) this.setHotKeysdesc();
		await this.addItems(settings.search);
	}

	addHeader = (contentEl: HTMLElement): void => {
		const { plugin } = this;
		const { settings } = plugin;
		new DropdownComponent(contentEl)
			.addOptions({
				all: `All(${plugin.lengthAll})`,
				enabled: `Enabled(${plugin.lengthEnabled})`,
				disabled: `Disabled(${plugin.lengthDisabled})`,
				enabledFirst: `Enabled First(${plugin.lengthAll})`,
				mostSwitched: `Most Switched(${plugin.lengthAll})`,
				byGroup: `By Group`,
				hidden: `Hidden(${getHidden(this, Object.keys(settings.installed)).length})`
			})
			.setValue(settings.filters as string)
			.onChange(async (value) => {
				settings.filters = value;
				await reOpenModal(this);
			});

		mostSwitchedResetButton(this, contentEl);

		byGroupDropdowns(this, contentEl);
	};

	addGroups(contentEl: HTMLElement): void {
		const groups = Object.values(Groups);

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
							const { plugin } = this;
							const { settings } = plugin;
							const hidden = settings.groups[i]?.hidden;
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
		const numberOfGroups = this.plugin.settings.numberOfGroups;
		this.hotkeysDesc.createSpan(
			{
				text: `(1-${numberOfGroups})➕ (0)❌ (f)📁 `
			},
			(el) => {
				el.createSpan({ text: '(g)' }, (el) => {
					const gitHubIcon = el.createSpan({ cls: 'git-hub-icon' });
					setIcon(gitHubIcon, 'github');
				});
				el.createSpan({
					text: ` (ctrl)ℹ️ (s)⚙️ (h)⌨️ `
				});
				el.createSpan({
					cls: 'qps-hk-desc-last-part',
					text: `(🖱️x2)delay`
				});
			}
		);
	}

	async addItems(value: string): Promise<void> {
		const { plugin } = this;
		const { settings } = plugin;
		const { installed, filters } = settings;

		let listItems = doSearchQPS(this, value, installed);
		listItems = modeSort(this, plugin, listItems);

		const itemsToShow = listItems.filter((id) => {
			if (
				filters !== Filters.byGroup &&
				installed[id].groupInfo.hidden &&
				filters !== Filters.hidden
			) {
				return false;
			}
			if (filters === Filters.enabled && !installed[id].enabled) {
				return false;
			}
			if (filters === Filters.disabled && installed[id].enabled) {
				return false;
			}
			return true;
		});

		itemsToShow.forEach((id) => {
			const itemContainer = this.items.createEl('div', { cls: 'qps-item-line' });
			itemTogglePluginButton(this, installed[id], itemContainer);
			const input = itemTextComponent(installed[id], itemContainer);
			itemContainer.setAttribute('data-plugin-id', id);
			itemToggleClass(this, installed[id], itemContainer);
			addGroupCircles(input, installed[id]);

			if (this.app.isMobile) {
				itemContainer.createEl('div', { cls: 'button-container' }, (el) =>
					vertDotsButton(el)
				);
			}
		});
	}

	/** Sets the delay for a plugin and re-enables it so the delay takes effect immediately. */
	addDelay = async (id: string, input: HTMLInputElement): Promise<void> => {
		const { plugin } = this;
		const { settings } = plugin;
		const { installed } = settings;
		installed[id].delayed = true;
		installed[id].time = parseInt(input.value) || 0;

		if (installed[id].time === 0) {
			installed[id].delayed = false;
		}
		if (installed[id].delayed && installed[id].enabled) {
			await delayedReEnable(this, id);
		}
		await reOpenModal(this);
	};

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.removeListeners();
	}
}

/** Sets the colored circle background and shows the delay time if any. */
export function circleCSSModif(
	modal: QPSModal | CPModal,
	el: HTMLSpanElement,
	groupIndex: number
): void {
	const { color } = getEmojiForGroup(groupIndex);
	el.style.backgroundColor = color;
	if (modal instanceof QPSModal) {
		const { settings } = modal.plugin;
		el.textContent = (
			settings.groups[groupIndex]?.time ? settings.groups[groupIndex].time : ''
		).toString();
	}
}

/**
 * Renders the enable/disable toggle for a plugin item.
 * Disabled for QPS itself, desktop-only plugins on mobile, and platform-mismatched plugins.
 */
const itemTogglePluginButton = (
	modal: QPSModal,
	pluginItem: PluginInstalled,
	itemContainer: HTMLDivElement
): void => {
	const platformOff =
		(pluginItem.target === TargetPlatform.Mobile && Platform.isDesktop) ||
		(pluginItem.target === TargetPlatform.Desktop && Platform.isMobile);
	const desktopOnlyOff = (pluginItem.isDesktopOnly && Platform.isMobile) || platformOff;
	const disable =
		(pluginItem.id === 'quick-plugin-switcher' || desktopOnlyOff || platformOff) ??
		false;
	const enabled = desktopOnlyOff ? false : pluginItem.enabled;
	new ToggleComponent(itemContainer)
		.setValue(enabled)
		.setDisabled(disable)
		.onChange(async () => {
			await togglePlugin(modal, pluginItem); // searchInit = ? → in reOpenModal...
		});
};

/**
 * Renders colored group indicator circles next to the plugin name.
 * Up to 2 groups = 1 circle, 3-4 = 2 stacked circles, 5-6 = 3 stacked circles.
 */
const insertElements = (input: HTMLElement, tempDiv: HTMLDivElement): void => {
	Array.from(tempDiv.children).forEach((child) =>
		input.insertAdjacentElement('afterend', child)
	);
};

const addGroupCircles = (input: HTMLElement, item: PluginInstalled): void => {
	const indices = item.groupInfo.groupIndices;
	if (!indices.length) return;

	const makeDiv = (parts: number[]): HTMLDivElement => {
		const div = document.createElement('div');
		div.innerHTML = getCirclesItem(parts);
		return div;
	};

	if (indices.length < 3) {
		insertElements(input, makeDiv(indices));
	} else if (indices.length < 5) {
		insertElements(input, makeDiv(indices.slice(0, 2)));
		insertElements(input, makeDiv(indices.slice(2)));
	} else {
		insertElements(input, makeDiv(indices.slice(0, 2)));
		insertElements(input, makeDiv(indices.slice(2, 4)));
		insertElements(input, makeDiv(indices.slice(4)));
	}
};

async function handleKeyDown(event: KeyboardEvent, modal: QPSModal): Promise<void> {
	const elementFromPoint = getElementFromMousePosition(modal);
	const pluginItemBlock = elementFromPoint?.closest('.qps-item-line') as HTMLDivElement;

	const targetGroupIcon = elementFromPoint?.closest(
		'.qps-circle-title-group'
	) as HTMLElement;
	const targetGroup = elementFromPoint?.closest('.qps-groups-name') as HTMLElement;

	if (pluginItemBlock) {
		(
			document.querySelector('.qps-search-component input') as HTMLInputElement
		)?.blur(); // for a reason not working in a function
		modal.searchTyping = false; // useless after blur but it's a security
		const matchingItem = findMatchingItem(modal, pluginItemBlock);
		if (matchingItem) {
			await handleHotkeysQPS(modal, event, matchingItem as PluginInstalled);
		}
	} else if ((targetGroupIcon || targetGroup) && event.key === 'h') {
		(
			document.querySelector('.qps-search-component input') as HTMLInputElement
		)?.blur();
		modal.searchTyping = false;
		await toggleVisibility(modal, targetGroupIcon, targetGroup);
	} else {
		modal.searchTyping = true;
	}
}

/** Toggles visibility of a group via keyboard shortcut (h) or group icon/name target. */
export const toggleVisibility = async (
	modal: QPSModal | CPModal,
	targetGroupIcon: HTMLElement,
	targetGroup: HTMLElement
): Promise<void> => {
	let groupNumber: number;
	if (targetGroupIcon) {
		groupNumber = groupNbFromEmoticon(targetGroupIcon);
	} else {
		const groupName = targetGroup?.textContent;
		groupNumber = groupNbFromGrpName(groupName!);
	}
	const inGroup = getPluginsInGroup(modal, groupNumber);
	await hideOnCLick(modal, groupNumber, inGroup);
};

/**
 * Handles keyboard shortcuts over a plugin item:
 * number keys add to group, 0/Del removes, f/g/s/h open folder/github/settings/hotkeys,
 * ctrl/meta opens the description modal.
 */
const handleHotkeysQPS = async (
	modal: QPSModal,
	evt: KeyboardEvent,
	pluginItem: PluginInstalled
): Promise<void> => {
	const { plugin } = modal;
	const { settings } = plugin;
	const { groups, installed } = settings;
	const numberOfGroups = settings.numberOfGroups;

	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: async () => await openGitHubRepo(evt, modal, pluginItem),
		s: async () => await openPluginSettings(modal, pluginItem),
		h: async () => await showHotkeysFor(modal, pluginItem)
	};
	if (Platform.isDesktopApp)
		KeyToSettingsMap['f'] = async () =>
			await openDirectoryInFileManager(modal, pluginItem);

	const keyPressed = evt.key;
	if (!pluginItem.groupInfo) {
		pluginItem.groupInfo = {
			groupIndices: [],
			groupWasEnabled: false,
			hidden: false
		};
		await reOpenModal(modal);
	}
	if (modal.pressed) {
		return;
	}
	pressDelay(modal);

	if (modal.isDblClick) return;
	const groupIndices = pluginItem.groupInfo.groupIndices;
	const key = parseInt(keyPressed);
	if (
		key > 0 &&
		key <= numberOfGroups &&
		!(pluginItem.id === 'quick-plugin-switcher')
	) {
		if (groupIndices.length === 6) return;
		const index = groupIndices.indexOf(key);
		if (index === -1) {
			groupIndices?.push(key);
			if (groups[key].hidden) installed[pluginItem.id].groupInfo.hidden = true;
			await reOpenModal(modal);
		}
	} else if (keyPressed in KeyToSettingsMap) {
		KeyToSettingsMap[keyPressed]();
	} else if (evt.metaKey || evt.ctrlKey) {
		new DescriptionModal(plugin.app, plugin, pluginItem).open();
	} else if (
		(keyPressed === 'Delete' || keyPressed === 'Backspace' || keyPressed === '0') &&
		!(pluginItem.id === 'quick-plugin-switcher')
	) {
		if (!groupIndices.length) return;
		if (groupIndices.length === 1) {
			const groupIndex = groupIndices[0];
			pluginItem.groupInfo.groupIndices = [];
			if (groupIsEmpty(groupIndex, modal)) {
				settings.selectedGroup = 'SelectGroup';
			}
			await reOpenModal(modal);
		} else {
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
						pluginItem.groupInfo.groupIndices = removeItem(
							pluginItem.groupInfo.groupIndices,
							groupIndex
						);
						await reOpenModal(modal);
					})
				);
			}
			menu.showAtPosition(modal.mousePosition);
		}
	}
};
