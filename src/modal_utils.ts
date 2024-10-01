import Plugin from "./main";
import { QPSModal } from "./main_modal";
import { Notice } from "obsidian";
import { confirm } from "./secondary_modals";
import { CPModal } from "./community-plugins_modal";
import { getHkeyCondition } from "./modal_components";
import { Filters } from "./types/variables";
import { getIndexFromSelectedGroup } from "./groups";
import { PluginCommInfo, PluginInstalled } from "./global";

/**
 * Reset most switched values.
 */
export const reset = async (modal: QPSModal) => {
	const { plugin } = modal;
	const confirmed = await confirm("Reset most switched values?", 250);
	if (confirmed) {
		plugin.reset = true; //if true, reset done in modal>addItems()
		plugin.getLength();
		await reOpenModal(modal);
		new Notice("Done", 2500);
	} else {
		new Notice("Operation cancelled", 2500);
	}
};

export const sortByName = (plugin: Plugin, listItems: string[]) => {
	const { settings } = plugin;
	const { installed } = settings;
	listItems.sort((a, b) => installed[a].name.localeCompare(installed[b].name));
};

export const sortSwitched = (plugin: Plugin, listItems: string[]) => {
	const { settings } = plugin;
	const { installed } = settings;
	listItems.sort((a, b) => installed[b].switched - installed[a].switched);
};

// export const getCommandCondition = async function (modal: QPSModal | CPModal, item: PluginInstalled | PluginCommInfo
// ): Promise<Record<string, Command> | undefined> {
// 	const pluginCommands = await modal.app.setting.openTabById(
// 		item.id
// 	)?.app?.commands.commands;
// 	return pluginCommands;
// };

export const togglePlugin = async (modal: QPSModal, pluginItem: PluginInstalled) => {
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
) {
	const shell = window.electron.remote.shell;
	const filePath = modal.app.vault.adapter.getFullPath(
		pluginItem.dir as string);
	try {
		await shell.openPath(filePath);
	} catch (err) {
		const plugins = modal.app.vault.adapter.getFullPath(
			".obsidian/plugins"
		);
		await shell.openPath(plugins);
	}
}

export const delayedReEnable = async (
	modal: QPSModal,
	id: string
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const { installed } = settings;
	await modal.app.plugins.disablePluginAndSave(id);
	await modal.app.plugins
		.enablePlugin(id)
	installed[id].enabled = true
};

export const conditionalEnable = async (
	modal: QPSModal,
	id: string
) => {
	const { installed } = modal.plugin.settings;
	if (installed[id].delayed && installed[id].time > 0) {
		await modal.app.plugins.enablePlugin(id);
		await modal.plugin.saveSettings();
	} else {
		installed[id].switched++; // besoin que là?
		await modal.app.plugins.enablePluginAndSave(id);
	}
};

export const selectValue = (input: HTMLInputElement | null) => {
	input?.setSelectionRange(0, input?.value.length);
};

export const modeSort = (modal: QPSModal, plugin: Plugin, listItems: string[]) => {
	const { settings } = plugin;
	const { installed, filters } = settings;
	const sortByName = (a: string, b: string) => installed[a].name.localeCompare(installed[b].name);
	// const sortBySwitched = (a: string, b: string) => installed[b].switched - installed[a].switched;

	if (plugin.reset) {
		listItems.forEach(id => installed[id].switched = 0);
		plugin.reset = false;
	}

	const sortFunctions = {
		[Filters.enabledFirst]: () => {
			const [enabled, disabled] = listItems.reduce((acc, id) => {
				acc[installed[id].enabled ? 0 : 1].push(id);
				return acc;
			}, [[], []] as [string[], string[]]);
			return [...enabled.sort(sortByName), ...disabled.sort(sortByName)];
		},
		[Filters.byGroup]: () => {
			const groupIndex = getIndexFromSelectedGroup(settings.selectedGroup);
			return groupIndex !== 0
				? listItems.filter(i => installed[i].groupInfo.groupIndices.includes(groupIndex)).sort(sortByName)
				: listItems.sort(sortByName);
		},
		[Filters.mostSwitched]: () => listItems.sort((a, b) => installed[b].switched - installed[a].switched || sortByName(a, b)),
		[Filters.hidden]: () => getHidden(modal, listItems),
		[Filters.all]: () => listItems.sort(sortByName),
	};

	return (sortFunctions[filters] || sortFunctions[Filters.all])();
};

export function createInput(el: HTMLElement | null, currentValue: string) {
	if (el) {
		const input = document.createElement("input");
		input.type = "text";
		input.value = currentValue;
		el.replaceWith(input);
		input.focus();
		selectValue(input);
		return input;
	} else {
		return undefined;
	}
}

export const pressDelay = (modal: CPModal | QPSModal) => {
	modal.pressed = true;
	setTimeout(() => {
		modal.pressed = false;
	}, 1);
};

export function getInstalled() {
	return Object.keys(this.app.plugins.manifests);
}

export function getHidden(modal: QPSModal | CPModal, listItems: string[]) {
	const { settings } = modal.plugin
	const { installed, commPlugins } = settings
	let hiddens: string[]
	if (modal instanceof QPSModal) {
		hiddens = listItems.filter((key) => installed[key].groupInfo.hidden === true);
	} else {
		hiddens = listItems.filter((key) => commPlugins[key].groupCommInfo.hidden === true);
	}
	return listItems.filter((item) => hiddens.includes(item));
}

export function getHasNote(modal: CPModal, listItems: string[]) {
	return listItems.filter((item) => modal.plugin.settings.commPlugins[item].hasNote);
}

export function isInstalled(id: string) {
	return getInstalled().includes(id);
}

export async function reOpenModal(modal: QPSModal | CPModal, searchInit = false) {
	await modal.plugin.saveSettings();
	modal.searchInit = searchInit;
	await modal.onOpen();
}

export async function openPluginSettings(
	evt: MouseEvent | TouchEvent | KeyboardEvent,
	modal: QPSModal | CPModal,
	pluginItem: PluginInstalled | PluginCommInfo
) {
	evt.preventDefault();
	const enabled = modal.plugin.settings.installed[pluginItem.id]?.enabled

	if (!enabled) {
		new Notice("Plugin disabled, no Settings to show", 3500);
		return;
	}

	const pluginSettings = modal.app.setting.openTabById(
		pluginItem.id
	);
	if (!pluginSettings) {
		new Notice("No Settings on this plugin", 2500);
		return;
	}
	modal.app.setting.open();
	await pluginSettings?.display();
}

export const showHotkeysFor = async function (
	evt: MouseEvent | TouchEvent | KeyboardEvent,
	modal: QPSModal | CPModal,
	pluginItem: PluginInstalled | PluginCommInfo
) {
	evt.preventDefault();
	const enabled = modal instanceof CPModal ? modal.plugin.settings.installed[pluginItem.id].enabled : (pluginItem as PluginInstalled).enabled

	if (!enabled) {
		new Notice("Plugin disabled, no HotKeys to show", 3500);
		return;
	}

	const condition = await getHkeyCondition(modal, pluginItem);
	if (!condition) {
		new Notice("No HotKeys on this plugin", 2500);
		return;
	}
	await this.app.setting.open();
	await this.app.setting.openTabById("hotkeys");
	const tab = await this.app.setting.activeTab;
	let name = pluginItem.name;
	if (modal instanceof CPModal) {
		name = modal.plugin.settings.installed[pluginItem.id].name
	}
	tab.searchComponent.inputEl.value = name + ":";
	tab.updateHotkeyVisibility();
	tab.searchComponent.inputEl.blur();
};


export function modifyGitHubLinks(content: string, pluginItem: PluginCommInfo): string {
	const baseUrl = `https://githubusercontent.com/${pluginItem.repo}/raw/HEAD/`;

	// add space before closing quote
	content = content.replace(/(?!href=\s*)(["'])(https?:\/\/[^"'\s]+)(["'])/g, (_, openChar, url, closeChar) => {
		return `${openChar}${url} ${closeChar}`; // Adds a space before the closing character
	});

	const normalizeUrl = (url: string): string => {
		if (url.startsWith("http")) return url;
		return url.startsWith(".")
			? `https://github.com/${pluginItem.repo}/raw/HEAD${url.substr(1)}`
			: `https://github.com/${pluginItem.repo}/raw/HEAD/${url}`;
	};

	const extractDimensions = (match: string) => {
		const getDimension = (type: string): number | null => {
			const patterns = [
				// style="width: 100px" or style="width: 100"
				new RegExp(`style=["'][^"']*${type}\\s*:\\s*(\\d+)(?:px|em|rem|%)?\\s*(!important)?["']`, 'i'),
				// width="100px", width='100' or width=100
				new RegExp(`${type}\\s*=\\s*["']?(\\d+)(?:px|em|rem|%)?["']?(?:\\s|>)`, 'i')
			];

			for (const pattern of patterns) {
				const newMatch = pattern.exec(match);
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

	// images
	content = content.replace(/<img[^>]*src=["']?(\.?\/?[^"'\s]+)["']?[^>]*>/gi, (match, url) => {
		const normalizedUrl = normalizeUrl(url.trim());
		const { width, height } = extractDimensions(match);

		const altMatch = match.match(/alt=["']([^"']*)["']/i);
		const alt = altMatch ? altMatch[1] : 'Image';

		if (width && height) return `![${alt}|${width}x${height}](${normalizedUrl})`;
		if (width) return `![${alt}|${width}](${normalizedUrl})`;
		if (height) return `![${alt}|${height}](${normalizedUrl})`;
		return `![${alt}](${normalizedUrl})`;
	});

	// [](url) ![](url)
	// Modifier les liens relatifs dans les markdown
	content = content.replace(/(!?)\[(.*?)\]\(((?!http)(?!#)(?!\/).*?)\)/g,
		(_, isImage, text, link) => `${isImage}[${text}](${baseUrl}${link})`
	);

    // github links
    content = content.replace(
        /https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)\.(png|jpe?g|gif|svg|webp)/gi,
        (_, user, repo, branch, path, ext) => 
            `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}.${ext}`
    );

	return content;
}


export function getElementFromMousePosition(
	modal: QPSModal | CPModal
) {
	if (modal.mousePosition) {
		const elementFromPoint = document.elementFromPoint(
			modal.mousePosition.x,
			modal.mousePosition.y
		);
		return elementFromPoint;
	}
	return null;
}

export function focusSearchInput(time: number) {
	setTimeout(() => {
		(document.querySelector(".qps-search-component input") as HTMLInputElement)?.focus();
	}, time);
}