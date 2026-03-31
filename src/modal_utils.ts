import type Plugin from './main.ts';
import { QPSModal } from './main_modal.ts';
import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { confirm } from './secondary_modals.ts';
import { CPModal } from './community-plugins_modal.ts';
import { getHkeyCondition } from './modal_components.ts';
import { Filters } from './types/variables.ts';
import { getIndexFromSelectedGroup } from './groups.ts';

/**
 * Reset most switched values.
 */
export const reset = async (modal: QPSModal): Promise<void> => {
	const { plugin } = modal;
	const confirmed = await confirm(modal.app, 'Reset most switched values?', 250);
	if (confirmed) {
		plugin.reset = true; //if true, reset done in modal>addItems()
		plugin.getLength();
		await reOpenModal(modal);
		new Notice('Done', 2500);
	} else {
		new Notice('Operation cancelled', 2500);
	}
};

/** Sorts installed plugins by name alphabetically. */
export const sortByName = (plugin: Plugin, listItems: string[]): string[] => {
	const { settings } = plugin;
	const { installed } = settings;
	return listItems.sort((a, b) =>
		installed[a].name.localeCompare(installed[b].name)
	);
};

/** Sorts installed plugins by most switched (toggle count) descending. */
export const sortSwitched = (plugin: Plugin, listItems: string[]): void => {
	const { settings } = plugin;
	const { installed } = settings;
	listItems.sort((a, b) => installed[b].switched - installed[a].switched);
};

export const togglePlugin = async (
	modal: QPSModal,
	pluginItem: PluginInstalled
): Promise<void> => {
	const { plugin } = modal;
	pluginItem.enabled = !pluginItem.enabled;
	pluginItem.enabled
		? await conditionalEnable(modal, pluginItem.id)
		: await modal.app.plugins.disablePluginAndSave(pluginItem.id);
	plugin.getLength();
	await reOpenModal(modal);
};

//desktop only
export async function openDirectoryInFileManager(
	modal: QPSModal,
	pluginItem: PluginInstalled
): Promise<void> {
	const shell = (window as unknown as WindowWithElectron).electron!.remote.shell;
	const filePath = modal.app.vault.adapter.getFullPath(pluginItem.dir as string);
	try {
		await shell.openPath(filePath);
	} catch {
		const plugins = modal.app.vault.adapter.getFullPath('.obsidian/plugins');
		await shell.openPath(plugins);
	}
}

/**
 * Disables then immediately re-enables a plugin without saving between the two steps,
 * used to apply a delayed start without persisting the disabled state.
 */
export const delayedReEnable = async (modal: QPSModal, id: string): Promise<void> => {
	const { plugin } = modal;
	const { settings } = plugin;
	const { installed } = settings;
	await modal.app.plugins.disablePluginAndSave(id);
	await modal.app.plugins.enablePlugin(id);
	installed[id].enabled = true;
};

/**
 * Enables a plugin, using enablePlugin (no save) if it has a delay configured,
 * so the delay logic in onload can handle it — otherwise uses enablePluginAndSave.
 */
export const conditionalEnable = async (modal: QPSModal, id: string): Promise<void> => {
	const { installed } = modal.plugin.settings;
	if (installed[id].delayed && installed[id].time > 0) {
		await modal.app.plugins.enablePlugin(id);
		await modal.plugin.saveSettings();
	} else {
		installed[id].switched++; // besoin que là?
		await modal.app.plugins.enablePluginAndSave(id);
	}
};

/** Selects all text in an input, used to make it easy to replace the current value. */
export const selectValue = (input: HTMLInputElement | null): void => {
	input?.setSelectionRange(0, input?.value.length);
};

/**
 * Sorts and filters the plugin list according to the active filter mode.
 * Also handles resetting switched counts when plugin.reset is true.
 */
export const modeSort = (
	modal: QPSModal,
	plugin: Plugin,
	listItems: string[]
): string[] => {
	const { settings } = plugin;
	const { installed, filters } = settings;

	if (plugin.reset) {
		listItems.forEach((id) => (installed[id].switched = 0));
		plugin.reset = false;
	}

	const sortFunctions: { [key: string]: () => string[] } = {
		[Filters.enabledFirst]: () => {
			const [enabled, disabled] = listItems.reduce(
				(acc, id) => {
					acc[installed[id].enabled ? 0 : 1].push(id);
					return acc;
				},
				[[], []] as [string[], string[]]
			);
			return [...sortByName(plugin, enabled), ...sortByName(plugin, disabled)];
		},
		[Filters.byGroup]: () => {
			const groupIndex = getIndexFromSelectedGroup(settings.selectedGroup);
			return groupIndex !== 0
				? sortByName(
						plugin,
						listItems.filter((i) =>
							installed[i].groupInfo.groupIndices.includes(groupIndex)
						)
					)
				: sortByName(plugin, listItems);
		},
		[Filters.mostSwitched]: () =>
			listItems.sort(
				(a, b) =>
					installed[b].switched -
						installed[a].switched ||
						// Stable tie-breaker for deterministic ordering.
						installed[a].name.localeCompare(installed[b].name)
			),
		[Filters.hidden]: () => getHidden(modal, listItems),
		[Filters.all]: () => sortByName(plugin, listItems)
	};

	return (sortFunctions[filters] || sortFunctions[Filters.all])();
};

/**
 * Replaces an element in-place with a focused text input pre-filled with currentValue.
 * Used for inline editing of group names and delay values.
 */
export function createInput(
	el: HTMLElement | null,
	currentValue: string
): HTMLInputElement | undefined {
	if (el) {
		const input = document.createElement('input');
		input.type = 'text';
		input.value = currentValue;
		el.replaceWith(input);
		input.focus();
		selectValue(input);
		return input;
	} else {
		return undefined;
	}
}

/**
 * Sets modal.pressed to true for 1ms — used to debounce accidental double triggers
 * on touch/click events where a keydown and click fire simultaneously.
 */
export const pressDelay = (modal: CPModal | QPSModal): void => {
	modal.pressed = true;
	setTimeout(() => {
		modal.pressed = false;
	}, 1);
};

/** Returns the list of installed plugin ids from Obsidian's manifest registry. */
export function getInstalled(app: App): string[] {
	return Object.keys(app.plugins.manifests);
}

/** Returns only items currently marked as hidden in the active modal context. */
export function getHidden(modal: QPSModal | CPModal, listItems: string[]): string[] {
	const { settings } = modal.plugin;
	const { installed, commPlugins } = settings;
	let hiddens: string[];
	if (modal instanceof QPSModal) {
		hiddens = listItems.filter((key) => installed[key].groupInfo.hidden === true);
	} else {
		hiddens = listItems.filter(
			(key) => commPlugins[key].groupCommInfo.hidden === true
		);
	}
	return listItems.filter((item) => hiddens.includes(item));
}

/** Filters community plugins that currently have a note attached. */
export function getHasNote(modal: CPModal, listItems: string[]): string[] {
	return listItems.filter((item) => modal.plugin.settings.commPlugins[item].hasNote);
}

/** Checks installation state against the live Obsidian manifest registry. */
export function isInstalled(app: App, id: string): boolean {
	return getInstalled(app).includes(id);
}

export async function reOpenModal(
	modal: QPSModal | CPModal,
	searchInit = false
): Promise<void> {
	// Persist first so re-rendered modal always reflects latest state.
	await modal.plugin.saveSettings();
	modal.searchInit = searchInit;
	await modal.onOpen();
}

export async function openPluginSettings(
	modal: QPSModal | CPModal,
	pluginItem: PluginInstalled | PluginCommInfo
): Promise<void> {
	const enabled = modal.plugin.settings.installed[pluginItem.id]?.enabled;

	if (!enabled) {
		new Notice('Plugin disabled, no Settings to show', 3500);
		return;
	}

	const pluginSettings = modal.app.setting.openTabById(pluginItem.id);
	if (!pluginSettings) {
		new Notice('No Settings on this plugin', 2500);
		return;
	}
	modal.app.setting.open();
	await pluginSettings?.display();
}

/**
 * Navigates to the hotkeys settings tab and pre-fills the search with the plugin name,
 * so the user lands directly on that plugin's hotkeys.
 */
export const showHotkeysFor = async function (
	modal: QPSModal | CPModal,
	pluginItem: PluginInstalled | PluginCommInfo
): Promise<void> {
	const enabled =
		modal instanceof CPModal
			? modal.plugin.settings.installed[pluginItem.id].enabled
			: (pluginItem as PluginInstalled).enabled;

	if (!enabled) {
		new Notice('Plugin disabled, no HotKeys to show', 3500);
		return;
	}

	const condition = await getHkeyCondition(modal, pluginItem);
	if (!condition) {
		new Notice('No HotKeys on this plugin', 2500);
		return;
	}
	await modal.app.setting.open();
	await modal.app.setting.openTabById('hotkeys');
	const tab = modal.app.setting.activeTab as HotkeysTabLike | null;
	// Defensive guard: setting tab activation is async and can fail silently.
	if (!tab) return;
	let name = pluginItem.name;
	if (modal instanceof CPModal) {
		name = modal.plugin.settings.installed[pluginItem.id].name;
	}
	tab.searchComponent.inputEl.value = name + ':';
	tab.updateHotkeyVisibility();
	tab.searchComponent.inputEl.blur();
};

/**
 * Rewrites relative URLs in a README's markdown/HTML content to absolute GitHub URLs,
 * so that images and links render correctly when displayed outside of GitHub.
 */
export function modifyGitHubLinks(content: string, pluginItem: PluginCommInfo): string {
	const baseUrl = `https://githubusercontent.com/${pluginItem.repo}/raw/HEAD/`;

	// absolute URLs need a space before closing quote to prevent Obsidian from swallowing the quote
	content = content.replace(
		/(?!href=\s*)(["'])(https?:\/\/[^"'\s]+)(["'])/g,
		(_, openChar, url, closeChar): string => {
			return `${openChar}${url} ${closeChar}`;
		}
	);

	// relative URLs need to be resolved against the raw GitHub base URL
	const normalizeUrl = (url: string): string => {
		if (url.startsWith('http')) return url;
		return url.startsWith('.')
			? `https://github.com/${pluginItem.repo}/raw/HEAD${url.substring(1)}`
			: `https://github.com/${pluginItem.repo}/raw/HEAD/${url}`;
	};

	const extractDimensions = (
		match: string
	): { width: number | null; height: number | null } => {
		const getDimension = (type: string): number | null => {
			const patterns = [
				// style="width: 100px" or style="width: 100"
				new RegExp(
					`style=["'][^"']*${type}\\s*:\\s*(\\d+)(?:px|em|rem|%)?\\s*(!important)?["']`,
					'i'
				),
				// width="100px", width='100' or width=100
				new RegExp(
					`${type}\\s*=\\s*["']?(\\d+)(?:px|em|rem|%)?["']?(?:\\s|>)`,
					'i'
				)
			];

			for (const pattern of patterns) {
				// pattern.exec is RegExp.exec, not a shell command — false positive for OS injection
				const newMatch = pattern.exec(match); // nosemgrep
				if (newMatch && newMatch[1]) {
					return parseInt(newMatch[1], 10);
				}
			}
			return null;
		};

		return {
			width: getDimension('width'),
			height: getDimension('height')
		};
	};

	// convert <img> tags to markdown syntax, preserving dimensions for Obsidian's image resizing
	content = content.replace(
		/<img[^>]*src=["']?(\.?\/?[^"'\s]+)["']?[^>]*>/gi,
		(match, url) => {
			const normalizedUrl = normalizeUrl(url.trim());
			const { width, height } = extractDimensions(match);

			const altMatch = match.match(/alt=["']([^"']*)["']/i);
			const alt = altMatch ? altMatch[1] : 'Image';

			if (width && height) return `![${alt}|${width}x${height}](${normalizedUrl})`;
			if (width) return `![${alt}|${width}](${normalizedUrl})`;
			if (height) return `![${alt}|${height}](${normalizedUrl})`;
			return `![${alt}](${normalizedUrl})`;
		}
	);

	// resolve relative markdown links (but not anchors # or absolute /)
	content = content.replace(
		/(!?)\[(.*?)\]\(((?!http)(?!#)(?!\/).*?)\)/g,
		(_, isImage, text, link) => `${isImage}[${text}](${baseUrl}${link})`
	);

	// rewrite github.com blob URLs to raw.githubusercontent.com so images actually load
	content = content.replace(
		/https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)\.(png|jpe?g|gif|svg|webp)/gi,
		(_, user, repo, branch, path, ext) =>
			`https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}.${ext}`
	);

	return content;
}

/** Returns the element currently under the stored mouse position in the modal. */
export function getElementFromMousePosition(modal: QPSModal | CPModal): Element | null {
	if (modal.mousePosition) {
		const elementFromPoint = document.elementFromPoint(
			modal.mousePosition.x,
			modal.mousePosition.y
		);
		return elementFromPoint;
	}
	return null;
}

/** Focuses the search input after a delay, needed because the DOM may not be ready yet. */
export function focusSearchInput(time: number): void {
	setTimeout(() => {
		(
			document.querySelector('.qps-search-component input') as HTMLInputElement
		)?.focus();
	}, time);
}
