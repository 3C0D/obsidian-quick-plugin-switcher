import { QPSModal } from "./main_modal";
import { ReadMeModal, confirm } from "./secondary_modals";
import {
	ButtonComponent,
	ExtraButtonComponent,
	Menu,
	Notice,
	Platform,
	SearchComponent,
	Setting,
	TextComponent,
	debounce,
	prepareSimpleSearch,
} from "obsidian";
import { DescriptionModal } from "./secondary_modals";
import {
	conditionalEnable,
	isInstalled,
	openDirectoryInFileManager,
	openPluginSettings,
	reOpenModal,
	reset,
	showHotkeysFor,
	getElementFromMousePosition,
	createInput,
	focusSearchInput,
	delayedReEnable,
} from "./modal_utils";
import { getSelectedContent, hasKeyStartingWith, isEnabled } from "./utils";
import {
	CPModal,
	getManifest,
	getPluginsList,
	getReleaseVersion,
	handleNote,
	installFromList,
	installPluginFromOtherVault,
} from "./community-plugins_modal";
import { Filters, Groups, SortBy, TargetPlatform } from "./types/variables";
import { getPluginsInGroup, editGroupName, groupMenu, addRemoveGroupMenuItems, addToGroupSubMenu, addRemoveItemGroupMenuItems, getIndexFromSelectedGroup, groupNbFromEmoticon, rmvAllGroupsFromPlugin, groupNbFromGrpName, addDelayToGroup } from "./groups";
import { PluginCommInfo, PluginInstalled } from "./types/global";
import * as path from "path";
import { existsSync } from "fs";
import QuickPluginSwitcher from "./main";
import slug from 'slug';
import { translation } from "./translate";

export const mostSwitchedResetButton = (
	modal: QPSModal,
	contentEl: HTMLElement
) => {
	const { settings } = modal.plugin;
	const { filters, installed } = settings
	if (
		filters === Filters.mostSwitched &&
		Object.keys(installed).some((id) =>
			installed[id].switched !== 0
		)
	) {
		new ExtraButtonComponent(contentEl)
			.setIcon("reset")
			.setTooltip("Reset mostSwitched values")
			.onClick(async () => {
				reset(modal);
				await reOpenModal(modal);
			});
	}
};

export async function addSearch(
	modal: CPModal | QPSModal,
	contentEl: HTMLElement,
	placeholder: string
) {
	const { plugin } = modal;
	const { settings } = plugin;

	new Setting(contentEl)
		.addSearch(async (search: SearchComponent) => {
			search
				.setValue(settings.search)
				.setPlaceholder(placeholder)
				.onChange(debounce(async (value: string) => {
					if (modal.searchTyping) {
						settings.search = value;
						modal.items.empty();
						modal.addItems(value);
					}
				}, 20));
		})
		.setClass("qps-search-component");
}

export function doSearchQPS(
	modal: QPSModal,
	value: string,
	plugins: Record<string, PluginInstalled>
): string[] {
	const { byAuthor } = modal.plugin.settings;
	const search = prepareSimpleSearch(value);

	return Object.keys(plugins).filter((id) => {
		if (value.trim() === "") return true
		const { name, author } = plugins[id];
		const list = byAuthor ? [name, author] : [name];
		let res = false
		for (const e of list) {
			if (search(e)?.matches.length) {
				res = true
			}
		}
		return res
	});
}

export function doSearchCPM(
	value: string,
	commPlugins: Record<string, PluginCommInfo>
) {
	const search = prepareSimpleSearch(value);
	return Object.keys(commPlugins).filter((id) => {
		if (value.trim() === "") return true
		const { name, author, description } = commPlugins[id];
		const list = [name, author, description]
		let res = false
		for (const e of list) {
			if (search(e)?.matches.length) {
				res = true
			}
		}
		return res
	});
}

export const getFilters = (
	modal: CPModal,
	contentEl: HTMLElement
) => {
	const { plugin } = modal;
	const { settings } = plugin;

	new ButtonComponent(contentEl)
		.setIcon("arrow-up-narrow-wide")
		.setClass("comm-button")
		.setTooltip(
			"change type of sorting"
		)
		.buttonEl.addEventListener("click", async (evt: MouseEvent) => {
			const menu = new Menu();
			for (const key in SortBy) {
				menu.addItem((item) =>
					item
						.setTitle(SortBy[key])
						.onClick(async () => {
							settings.sortBy = key
							await reOpenModal(modal);
						}).setChecked(key === settings.sortBy)
				)
			}
			menu.showAtMouseEvent(evt);
		})
}

export const Check4UpdatesButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	const button = new ButtonComponent(el)
		.setIcon("rocket")
		.setCta()

	const toUpdate = Object.values(modal.plugin.settings.installed).filter(item => item["toUpdate"])
	if (toUpdate.length) button.setClass("red")

	button.setClass("update-button")
		.setTooltip(
			"Search for updates"
		)
		.buttonEl.addEventListener("click", async (evt: MouseEvent) => {
			if (toUpdate.length) {
				const menu = new Menu();
				menu.addItem((item) =>
					item
						.setTitle("Update plugin(s)")
						.setIcon("book-copy")
						.onClick(async () => {
							await Promise.allSettled(toUpdate.map(async item => {
								item["toUpdate"] = false;
								await updatePlugin(modal, item, plugin.settings.commPlugins);
							}));
						})
				);
				menu.addItem((item) =>
					item
						.setTitle("Search for updates again")
						.setIcon("rocket")
						.onClick(async () => {
							searchUpdates(modal);
						})
				);
				menu.showAtMouseEvent(evt);
			} else {
				searchUpdates(modal);
			}
		});
};

export const checkbox = (
	modal: QPSModal | CPModal,
	contentEl: HTMLElement,
	text: string,
) => {
	const { plugin } = modal;
	const { settings } = plugin;

	if (modal instanceof QPSModal && settings.filters === Filters.byGroup) return
	const isQPS = modal instanceof QPSModal
	contentEl.createDiv({ text: text, cls: "qps-comm-invert" }, (el) => {
		el.createEl("input",
			{
				attr: {
					cls: "qps-invert-button",
					type: "checkbox",
					checked: isQPS ? settings.byAuthor : settings.invertFiltersComm,
				}
			}, (checkbox) => {
				checkbox
					.checked = isQPS ? settings.byAuthor : settings.invertFiltersComm,
					checkbox.onchange = () => {
						isQPS ? settings.byAuthor = checkbox.checked : settings.invertFiltersComm = checkbox.checked
						plugin.saveSettings()
						reOpenModal(modal)
					}
			})
	});
}

async function searchUpdates(modal: QPSModal) {
	const { installed } = modal.plugin.settings;
	let open = false
	let count = 0
	for (const item of Object.values(installed)) {
		// is dev ?
		if (!item.dir) continue
		const filePath = modal.app.vault.adapter.getFullPath(
			item.dir
		);
		if (!filePath) continue

		if (Platform.isDesktop) {
			const isDevPath = path.join(
				filePath,
				"package.json"
			);
			if (existsSync(isDevPath)) {
				continue;
			}
		}

		const manifest = await getManifest(modal, item.id);
		if (!manifest) continue
		const lastVersion = manifest.version
		if (!lastVersion || lastVersion <= item.version) {
			item["toUpdate"] = false
			if (lastVersion && lastVersion <= item.version) open = true
		} else {
			if (lastVersion > item.version) {
				count += 1
				open = true
				item["toUpdate"] = true
			}
		}
	}
	if (open) {
		new Notice(`${count} plugins to update`, 3000)
		await reOpenModal(modal)
	} else {
		new Notice("All plugins are up to date")
	}
}

export const vertDotsButton = (el: HTMLElement) => {
	new ButtonComponent(el)
		.setButtonText("\u2807")
		.setTooltip(
			"open context-menu"
		)
};

export const notesButton = (el: HTMLElement, modal: CPModal, pluginItem: PluginCommInfo) => {
	new ButtonComponent(el)
		.setTooltip("open plugin notes")
		.setButtonText("📝")
};

export const commButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	new ButtonComponent(el)
		.setIcon("download-cloud")
		.setCta()
		.setClass("comm-button")
		.setTooltip(
			"community plugins: you can tag plugins with groups, install by group..."
		)
		.buttonEl.addEventListener("click", async (evt: MouseEvent) => {
			await plugin.exeAfterDelay(plugin.pluginsCommInfo.bind(plugin));
			modal.close();
			new CPModal(modal.app, plugin).open();
			focusSearchInput(10);
		});
};

export const commOptionButton = (modal: CPModal, el: HTMLSpanElement) => {
	new ButtonComponent(el)
		.setIcon("list-end")
		.setCta()
		.setTooltip(
			"Install & enable plugins based on another Vault content or from a JSON list"
		)
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle("Install plugins based on another Vault")
					.setIcon("book-copy")
					.onClick(async () => {
						await installPluginFromOtherVault(modal);
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Install & enable plugins based on another Vault")
					.setIcon("book-copy")
					.onClick(async () => {
						await installPluginFromOtherVault(modal, true);
					})
			);
			menu.addSeparator();

			menu.addItem((item) =>
				item
					.setTitle("Save installed plugins list")
					.setIcon("pen-square")
					.onClick(async () => {
						await getPluginsList(modal, true);
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Install & enable plugins from json list")
					.setIcon("list")
					.onClick(async () => {
						await installFromList(modal, true);
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Install plugins from json list")
					.setIcon("list")
					.onClick(async () => {
						await installFromList(modal);
					})
			);

			menu.showAtMouseEvent(evt);
		});
};

export const powerButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const { installed } = settings
	new ButtonComponent(el)
		.setIcon("power")
		.setCta()
		.setTooltip(
			"toggle plugins: you can disable some plugins and enable them later"
		)
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			const menu = new Menu();
			if (
				plugin.lengthEnabled === 1 &&
				settings.wasEnabled.length === 0
			) {
				menu.addItem((item) => item.setTitle("No enabled plugins"));
			} else {
				menu.addItem((item) =>
					item
						.setTitle(
							settings.wasEnabled.length > 0
								? "Enable previous disabled plugins"
								: "Disable all plugins"
						)
						.setIcon(
							settings.wasEnabled.length > 0
								? "power"
								: "power-off"
						)
						.onClick(async () => {
							// disable all except this plugin
							if (plugin.lengthEnabled > 1) {
								for (const id in installed) {
									if (id === "quick-plugin-switcher")
										continue;
									if (installed[id].enabled)
										settings.wasEnabled.push(id);
									await (
										modal.app as any
									).plugins.disablePluginAndSave(id);
									installed[id].enabled = false;
								}
								plugin.getLength();
								await reOpenModal(modal);
								new Notice("All plugins disabled", 2500);
							} else if (settings.wasEnabled.length > 0) {
								for (const i of settings.wasEnabled) {
									//check plugin not deleted between
									const toUpdate =
										Object.keys(installed).find(
											(id) => id === i
										);
									if (toUpdate) {
										await conditionalEnable(
											modal,
											toUpdate
										);
										installed[toUpdate].enabled = true;
									}
								}
								plugin.getLength();
								await reOpenModal(modal);
								settings.wasEnabled = [];
								new Notice("All plugins re-enabled", 2500);
								await modal.plugin.saveSettings();
							}
						})
				);
				if (settings.wasEnabled.length > 0) {
					menu.addItem((item) =>
						item
							.setTitle("Skip re-enable")
							.setIcon("reset")
							.onClick(async () => {
								const confirmReset = await confirm(
									"reset to disable",
									300
								);
								if (confirmReset) {
									settings.wasEnabled = [];
									await modal.plugin.saveSettings();
									new Notice("Done", 2500);
								} else {
									new Notice("Operation cancelled", 2500);
								}
							})
					);
				}

				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Toggle enabled-plugins by group")
						.setDisabled(true)
				);

				Object.keys(Groups).forEach((groupKey) => {
					if (groupKey === "SelectGroup") return;
					const groupValue = Groups[groupKey as keyof typeof Groups];
					const groupIndex = getIndexFromSelectedGroup(groupKey);
					const inGroup = Object.keys(installed).filter((id) => {
						return (
							installed[id].groupInfo.groupIndices.indexOf(
								groupIndex
							) !== -1
						);
					});
					const previousWasEnabled = inGroup.filter(
						(id) => installed[id].groupInfo.groupWasEnabled === true
					);

					if (
						inGroup.length > 0 &&
						(inGroup.some((id) => installed[id].enabled === true) ||
							previousWasEnabled.length > 0)
					) {
						menu.addItem((item) =>
							item
								.setTitle(
									previousWasEnabled.length > 0
										? `Re-enable ${groupValue}`
										: groupValue
								)
								.setIcon(
									previousWasEnabled.length > 0
										? "power"
										: "power-off"
								)
								.onClick(async () => {
									if (previousWasEnabled.length === 0) {
										const toDisable = inGroup
											.filter((id) => installed[id].enabled === true)
											.map(async (id) => {
												installed[id].groupInfo.groupWasEnabled =
													true;
												await (
													modal.app as any
												).plugins.disablePluginAndSave(id);
												installed[id].enabled = false;
											});
										await Promise.all(toDisable);
										if (toDisable) {
											plugin.getLength();
											await reOpenModal(modal);
											new Notice(
												"All plugins disabled",
												2500
											);
										}
									} else {
										for (const id of previousWasEnabled) {
											await conditionalEnable(modal, id);
											installed[id].enabled = true;
											installed[id].switched++;
										}
										previousWasEnabled.map((id) => {
											installed[id].groupInfo.groupWasEnabled =
												false;
										});
										plugin.getLength();
										await reOpenModal(modal);
										new Notice(
											"All plugins re-enabled",
											2500
										);
									}
								})
						);
						if (previousWasEnabled.length > 0) {
							menu.addItem((item) =>
								item
									.setTitle("Skip re-enable")
									.setIcon("reset")
									.onClick(async () => {
										const confirmReset = await confirm(
											"skip re-enable ?",
											200
										);
										if (confirmReset) {
											previousWasEnabled.map((id) => {
												installed[id].groupInfo.groupWasEnabled =
													false;
											});
											await modal.plugin.saveSettings();
											new Notice("Done", 2500);
										} else {
											new Notice(
												"Operation cancelled",
												2500
											);
										}
									})
							);
						}
					}
				});
			}
			menu.showAtMouseEvent(evt);
		});
};

export const itemToggleClass = (
	modal: QPSModal,
	pluginItem: PluginInstalled,
	itemContainer: HTMLDivElement
) => {
	if (pluginItem.target === 0) {
		itemContainer.toggleClass("qps-is-desktop", true);
	}
	if (pluginItem.target === 1) {
		itemContainer.toggleClass("qps-is-mobile", true);
	}
	const { settings } = modal.plugin;
	if (pluginItem.id === "quick-plugin-switcher") {
		itemContainer.toggleClass("qps-quick-plugin-switcher", true);
	}
	if (pluginItem.isDesktopOnly === true) {
		itemContainer.addClass("qps-desktop-only");
	}
	if (pluginItem.hasOwnProperty("toUpdate") && pluginItem.toUpdate === true) {
		itemContainer.toggleClass("qps-update", true);
	}
	if (
		settings.filters === Filters.mostSwitched &&
		pluginItem.switched !== 0
	) {
		itemContainer.toggleClass("qps-most-switched", true);
	}
	if (pluginItem.delayed) {
		itemContainer.toggleClass("toggle-bullet-color", true);
		itemContainer.style.setProperty(
			"--bullet-content",
			`"${pluginItem.time}"`
		);
	}
};

export const itemTextComponent = (
	pluginItem: PluginInstalled,
	itemContainer: HTMLDivElement
) => {
	let customValue = pluginItem.name;
	if (pluginItem.isDesktopOnly) {
		customValue = "\u1D30" + customValue;
	}
	customValue = customValue + `|${pluginItem.version}`
	const text = new TextComponent(itemContainer).setValue(customValue)
	const input = text.inputEl;
	input.readOnly = true;
	return input;
};

const pluginFeatureSubmenu = async (
	evt: MouseEvent | TouchEvent,
	submenu: Menu,
	pluginItem: PluginInstalled,
	modal: QPSModal
) => {
	const { settings } = modal.plugin;
	const { installed } = settings;
	const id = pluginItem.id;
	submenu.addItem((item) =>
		item
			.setTitle("Short info (i)")
			.setIcon("text")
			.onClick(() => {
				new DescriptionModal(
					modal.plugin.app,
					modal.plugin,
					installed[id]
				).open();
			})
	);

	submenu.addItem((item) =>
		item
			.setTitle("Plugin github (g)")
			.setIcon("github")
			.onClick(async () => {
				await openGitHubRepo(evt, modal, installed[id]);
			})
	);

	const pluginSettings = modal.app.setting.openTabById(
		id
	);
	submenu.addItem((item) =>
		item
			.setTitle("Plugin settings (s)")
			.setIcon("settings")
			.setDisabled(!pluginSettings)
			.onClick(async () => {
				await openPluginSettings(evt, modal, pluginItem);
			})
	);

	// helped by hotkey-helper code, even if it is extremly simplified
	const condition = await getHkeyCondition(modal, pluginItem);
	submenu.addItem((item) =>
		item
			.setTitle("Modify hotkeys (h)")
			.setIcon("plus-circle")
			.setDisabled(!condition)
			.onClick(async () => {
				await showHotkeysFor(evt, modal, pluginItem);
			})
	);
};

export const getHkeyCondition = async function (
	modal: QPSModal | CPModal,
	item: PluginInstalled | PluginCommInfo
) {
	const pluginCommands = await modal.app.setting.openTabById(
		"command-palette"
	)?.app?.commands.commands;
	return hasKeyStartingWith(pluginCommands, item.id);
};

export const openGitHubRepo = async (e: MouseEvent | KeyboardEvent | TouchEvent, modal: QPSModal | CPModal, plugin: PluginInstalled | PluginCommInfo) => {
	let repo: string;
	if ("repo" in plugin) {
		repo = plugin.repo
	} else {
		const key = plugin.id;
		const { commPlugins } = modal.plugin.settings;
		const matchingPlugin = Object.values(commPlugins).find(
			(plugin) => plugin.id === key
		);
		repo = matchingPlugin?.repo ?? "";
	}
	const repoURL = `https://github.com/${repo}`;
	window.open(repoURL, "_blank"); // open
}

export const searchDivButtons = (
	modal: QPSModal,
	contentEl: HTMLElement
): void => {
	// toggle plugin options
	contentEl.createEl(
		"span",
		{
			cls: "qps-toggle-plugins",
		},
		(el) => {
			powerButton(modal, el);
			commButton(modal, el);
			Check4UpdatesButton(modal, el)
		}
	);
};

export function showStats(
	pluginItem: PluginCommInfo
) {
	const idSlug = slug(pluginItem.id);
	const URL = `https://www.moritzjung.dev/obsidian-stats/plugins/${idSlug}#plugin-download-chart`;
	window.open(URL, "_blank");
}


export const searchCommDivButton = (
	modal: CPModal,
	contentEl: HTMLElement
): void => {
	// toggle plugin options
	contentEl.createEl(
		"span",
		{
			cls: "qps-toggle-plugins",
		},
		(el) => {
			commOptionButton(modal, el);
		}
	);
};

export async function hideOnCLick(modal: QPSModal | CPModal, groupNumber: number, inGroup: string[]) {
	const { plugin } = modal
	const { settings } = plugin
	const { groups, groupsComm, installed, commPlugins } = settings

	if (modal instanceof QPSModal) {
		if (groups[groupNumber]) {
			if (!groups[groupNumber].hidden && !inGroup.length) { new Notice("empty group", 3000); return }
			groups[groupNumber].hidden = !groups[groupNumber].hidden
		}
		inGroup.forEach(id => {
			if (groups[groupNumber].hidden)
				installed[id].groupInfo.hidden = true
			else {
				let prevent = false;
				for (const i of installed[id].groupInfo.groupIndices) {
					if (groups[i].hidden) prevent = true
				}
				if (!prevent) installed[id].groupInfo.hidden = false
			}
		})
	} else {
		if (groupsComm[groupNumber]) {
			if (!groupsComm[groupNumber].hidden && !inGroup.length) { new Notice("empty group", 3000); return }
			groupsComm[groupNumber].hidden = !groupsComm[groupNumber]?.hidden;
		}
		inGroup.forEach((id) => {
			if (groupsComm[groupNumber].hidden)
				commPlugins[id].groupCommInfo.hidden = true
			else {
				let prevent = false;
				for (const i of commPlugins[id].groupCommInfo.groupIndices) {
					if (groupsComm[i].hidden) prevent = true
				}
				if (!prevent) {
					commPlugins[id].groupCommInfo.hidden = false
				}
			}
		})
	}
	await reOpenModal(modal)
}

export async function handleClick(evt: MouseEvent | TouchEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(modal)?.parentElement;
	if (elementFromPoint?.classList.contains("button-container")) {
		const matchingItem = findMatchingItem(
			modal,
			elementFromPoint.parentElement as HTMLElement
		);
		if (matchingItem) {
			if (modal instanceof QPSModal) {
				await contextMenuQPS(evt, modal, matchingItem as PluginInstalled);
			} else {
				contextMenuCPM(evt, modal, matchingItem as PluginCommInfo);
			}
		}
	} else if (elementFromPoint?.classList.contains("button-container1")) {
		const matchingItem = findMatchingItem(
			modal,
			elementFromPoint.parentElement as HTMLElement
		);
		if (matchingItem && modal instanceof CPModal) {
			handleNote(evt, modal, matchingItem as PluginCommInfo);
		}
	}
}

let touchCount = 0;
const touchDelay = 300;
let clickTimeout: NodeJS.Timeout
let element: HTMLElement
export function handleTouchStart(evt: TouchEvent, modal: QPSModal | CPModal) {
	touchCount++;
	if (touchCount === 1) {
		element = evt.target as HTMLElement
		clickTimeout = setTimeout(() => {
			handleClick(evt, modal)
			touchCount = 0
		}, touchDelay);
	}

	if (touchCount === 2) {
		handleDblClick(evt, modal, element)
		touchCount = 0;
		clearTimeout(clickTimeout);
	}
}



export function handleDblClick(evt: MouseEvent | TouchEvent, modal: QPSModal | CPModal, element?: HTMLElement) {

	const elementFromPoint = element ? element : getElementFromMousePosition(modal);

	const targetBlock = elementFromPoint?.closest(
		".qps-comm-block"
	) as HTMLElement;

	const targetGroup = elementFromPoint?.closest(
		".qps-groups-name"
	) as HTMLElement;

	const pluginItemBlock = elementFromPoint?.closest(
		".qps-item-line input"
	) as HTMLDivElement;

	const targetGroupIcon = elementFromPoint?.closest(
		".qps-circle-title-group"
	) as HTMLElement;

	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock);
		if (!matchingItem) return
		if (Platform.isMobile) {
			setTimeout(() => {
				new ReadMeModal(
					modal.plugin.app,
					modal as CPModal,
					matchingItem as PluginCommInfo
				).open();
			}, 250);
		} else {
			new ReadMeModal(
				modal.plugin.app,
				modal as CPModal,
				matchingItem as PluginCommInfo
			).open();
		}
	}

	if (pluginItemBlock) {
		const matchingItem = findMatchingItem(modal, pluginItemBlock.parentElement as HTMLElement);
		if (!matchingItem) return
		handleInputDblClick(modal as QPSModal, pluginItemBlock, matchingItem as PluginInstalled);
	}

	if (targetGroup) {
		const groupName = targetGroup?.textContent;
		const groupNumber = groupNbFromGrpName(groupName as string);
		editGroupName(modal, targetGroup, groupNumber);
	}

	if (targetGroupIcon && modal instanceof QPSModal) {
		const groupNumber = groupNbFromEmoticon(targetGroupIcon)
		const inGroup = getPluginsInGroup(modal, groupNumber);
		addDelayToGroup(modal as QPSModal, groupNumber, targetGroupIcon, inGroup);
	}
}

// create temp input in input to modify delayed entering time
const handleInputDblClick = async (
	modal: QPSModal,
	itemContainer: HTMLDivElement,
	pluginItem: PluginInstalled,
) => {
	if (pluginItem.id === "quick-plugin-switcher") return;
	const currentValue = pluginItem.time.toString();
	modal.isDblClick = true;
	if (!itemContainer) {
		return;
	}
	const input = createInput(itemContainer, currentValue);

	if (!pluginItem.delayed) {
		if (!input) return;
		const setDelay = () => {
			setTimeout(async () => {
				await modal.addDelay(pluginItem.id, input);
				modal.isDblClick = false;
			}, 100);
		}

		input.onkeydown = (event) => {
			if (event.key === "Enter") {
				setDelay();
			}
		};
		input.onblur = setDelay
	} else {
		pluginItem.delayed = false;
		modal.isDblClick = false;
		if (!(pluginItem.target === 0 || pluginItem.target === 1)) {
			await modal.app.plugins.enablePluginAndSave(pluginItem.id);
		}
		await reOpenModal(modal);
	}
};


export async function handleContextMenu(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(modal);
	let targetBlock;

	const targetGroup = elementFromPoint?.closest(".qps-groups-name") as HTMLElement;

	const groupName = targetGroup?.textContent;
	const groupNumber = groupNbFromGrpName(groupName as string);

	if (targetGroup) {
		await groupMenu(evt, modal, groupNumber, targetGroup);
		return
	}

	if (modal instanceof QPSModal) {
		targetBlock = elementFromPoint?.closest(
			".qps-item-line"
		) as HTMLElement;
	} else {
		targetBlock = elementFromPoint?.closest(
			".qps-comm-block"
		) as HTMLElement;
	}

	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock);
		if (matchingItem) {
			if (modal instanceof QPSModal) {
				if (!modal.app.isMobile) {
					await contextMenuQPS(evt, modal, matchingItem as PluginInstalled);
				}
			} else {
				contextMenuCPM(evt, modal, matchingItem as PluginCommInfo);
			}
		}
	}
}

export function contextMenuCPM(
	evt: MouseEvent | TouchEvent,
	modal: CPModal,
	matchingItem: PluginCommInfo
) {
	evt.preventDefault();
	const menu = new Menu();
	const id = matchingItem.id;
	const selectedContent = getSelectedContent();
	if (selectedContent) {
		menu.addItem((item) =>
			item.setTitle("Copy").onClick(async () => {
				await navigator.clipboard.writeText(selectedContent);
			})
		);
		menu.addItem((item) =>
			item.setTitle("Translate (t)").onClick(async () => {
				await translation(selectedContent);
			})
		);
		menu.addSeparator()
	}
	if (Platform.isMobile) {
		menu.addItem((item) => {
			item
				.setTitle("View stats")
				.setIcon("stats")
				.onClick(async () => {
					showStats(matchingItem);
				})
		})
		menu.addSeparator()
	}
	menu.addItem((item) => {
		item.setTitle("Install plugin")
			.setDisabled(isInstalled(id) || id === "quick-plugin-switcher")
			.setIcon("log-in")
			.onClick(async () => {
				const manifest = await getManifest(modal, id);
				if (!manifest) {
					new Notice(`Manifest ${id} not found`, 2500);
					return
				}
				const lastVersion = manifest.version;
				await this.app.plugins.installPlugin(matchingItem.repo, lastVersion, manifest);
				await reOpenModal(modal);
			});
	});

	menu.addItem((item) => {
		const isenabled = isEnabled(modal, id);
		item.setTitle(isenabled ? "Disable plugin" : "Enable plugin")
			.setDisabled(!isInstalled(id) || id === "quick-plugin-switcher")
			.setIcon(isenabled ? "poweroff" : "power")
			.onClick(async () => {
				isEnabled(modal, id)
					? await (modal.app as any).plugins.disablePluginAndSave(id)
					: await (modal.app as any).plugins.enablePluginAndSave(id);

				const msg = isenabled ? "disabled" : "enabled";
				new Notice(`${matchingItem.name} ${msg}`, 2500);
				reOpenModal(modal);
			});
	});
	menu.addItem((item) => {
		item.setTitle("Uninstall plugin")
			.setDisabled(!isInstalled(id) || id === "quick-plugin-switcher")
			.setIcon("log-out")
			.onClick(async () => {
				try {
					await this.app.plugins.uninstallPlugin(id);
					new Notice(`${matchingItem.name} uninstalled`, 2500);
					await reOpenModal(modal);
				} catch (error: any) {
					new Notice(`Failed to uninstall ${matchingItem.name}: ${error.message}`, 3500);
				}
			});
	});
	if (this.app.isMobile) {
		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle("Plugin github")
				.setIcon("github")
				.onClick(async (evt) => {
					await openGitHubRepo(evt, modal, matchingItem);
				})
		})

		menu.addItem((item) =>
			item
				.setTitle("open Readme (dbl touch)")
				.setIcon("sticky-note")
				.onClick(() => {
					new ReadMeModal(modal.app, modal, matchingItem).open();
				})
		);

		menu.addSeparator();
		addToGroupSubMenu(menu, matchingItem, modal, true);
		menu.addSeparator();
		addRemoveItemGroupMenuItems(modal, menu, matchingItem, true);
		menu.addItem((item) => {
			item
				.setTitle("Remove All groups")
				.setDisabled(
					matchingItem.groupCommInfo.groupIndices.length === 0
				)
				.onClick(async () => {
					await rmvAllGroupsFromPlugin(modal, matchingItem);
				});
		});
	}
	if (evt instanceof MouseEvent) {
		menu.showAtMouseEvent(evt);
	} else {
		menu.showAtPosition(modal.mousePosition);
	}
}

async function contextMenuQPS(
	evt: MouseEvent | TouchEvent,
	modal: QPSModal,
	matchingItem: PluginInstalled
) {
	const { plugin } = modal;
	const menu = new Menu();

	if (!this.app.isMobile) {
		menu.addItem((item) =>
			item
				.setTitle("Plugin folder (f)")
				.setIcon("folder-open")
				.onClick(async () => {
					await openDirectoryInFileManager(modal, matchingItem);
				})
		);
	}
	if (!this.app.isMobile) {
		menu.addItem(async (item) => {
			item.setTitle("Plugin features").setIcon("package-plus");
			const submenu = (item as any).setSubmenu() as Menu;
			await pluginFeatureSubmenu(evt, submenu, matchingItem, modal);
		});
	} else {
		await pluginFeatureSubmenu(evt, menu, matchingItem, modal);
	}

	menu.addSeparator();
	menu.addItem((item) => {
		if (Platform.isDesktop) {
			const text = matchingItem.target !== undefined
				? `run on ${TargetPlatform[matchingItem.target]}`
				: "run on Both";
			item.setTitle(text)
		}
		const submenu = Platform.isMobile ? menu : (item as any).setSubmenu() as Menu;
		// Get only the string keys
		Object.keys(TargetPlatform)
			.filter((key) => isNaN(Number(key)))
			.forEach((key) => {
				let text = key
				if (Platform.isMobile) {
					text = `run on ${key}`
				}
				submenu.addItem((sub) => {
					sub
						.setTitle(text)
						.onClick(async () => {
							const target = TargetPlatform[key as keyof typeof TargetPlatform];
							if (matchingItem.isDesktopOnly &&
								target === TargetPlatform.Mobile) {
								new Notice("Plugin is only for desktop", 2500);
								return
							}
							// set target
							matchingItem.target = target;
							if (matchingItem.commandified) {
								await removeCommandFromPlugin(modal, matchingItem);
								await addCommandToPlugin(modal, matchingItem);

							}
							if (matchingItem.enabled) {
								if ((target === TargetPlatform.Mobile && Platform.isDesktop ||
									target === TargetPlatform.Desktop && Platform.isMobile)) {
									await this.app.plugins.disablePluginAndSave(matchingItem.id);
								} else if ((target === TargetPlatform.Mobile && Platform.isMobile ||
									target === TargetPlatform.Desktop && Platform.isDesktop) && !matchingItem.delayed) {
									await delayedReEnable(modal, matchingItem.id);
								} else if (target === TargetPlatform.Both && !matchingItem.delayed) {
									await this.app.plugins.enablePluginAndSave(matchingItem.id)
								}
							}
							await reOpenModal(modal);
						});
				});
			});
	});

	if (isInstalled(matchingItem.id)) {
		menu.addSeparator();
		menu.addItem((item) => {
			let disabled = false
			disabled = matchingItem.id === "quick-plugin-switcher"

			const filePath = modal.app.vault.adapter.getFullPath(matchingItem.dir ?? "");
			if (!filePath) disabled = true
			if (Platform.isDesktop) {
				const isDevPath = path.join(
					filePath,
					"package.json"
				);
				if (existsSync(isDevPath)) {
					disabled = true;
				}
			}

			const { commPlugins } = plugin.settings
			item.setTitle("Update plugin!")
				.setDisabled(disabled)
				.setIcon("rocket")
				.onClick(async () => {
					await updatePlugin(modal, matchingItem, commPlugins);
				});
		});

		menu.addItem((item) => {
			item.setTitle("Uninstall plugin")
				.setDisabled(matchingItem.id === "quick-plugin-switcher")
				.setIcon("log-out")
				.onClick(async () => {
					try {
						await this.app.plugins.uninstallPlugin(matchingItem.id);
						new Notice(`${matchingItem.name} uninstalled`, 2500);
						await modal.plugin.installedUpdate();
						await reOpenModal(modal);
					} catch (error: any) {
						new Notice(`Failed to uninstall ${matchingItem.name}: ${error.message}`, 3500);
					}
				});
		});


		if (Platform.isDesktop) {
			const text = matchingItem.commandified ? "Remove command from plugin" : "Add command to plugin";
			const disabled = Platform.isDesktop && matchingItem.target === TargetPlatform.Mobile || Platform.isMobile && matchingItem.target === TargetPlatform.Desktop;
			menu.addItem((item) => {
				item.setTitle(text)
					.setIcon("arrow-right-left")
					.setDisabled(disabled)
					.onClick(async () => {
						if (matchingItem.commandified) {
							delete matchingItem.commandified;
							await removeCommandFromPlugin(modal, matchingItem);
							await plugin.saveSettings();
						} else {
							matchingItem.commandified = true;
							await addCommandToPlugin(modal, matchingItem);
						}
						await plugin.saveSettings();
					});
			});
		}
	}

	if (matchingItem.id !== "quick-plugin-switcher") {
		menu.addSeparator();
		if (!this.app.isMobile) {
			menu.addItem((item) => {
				item.setTitle("Add to group").setIcon("user");
				const submenu = (item as any).setSubmenu() as Menu;
				addToGroupSubMenu(submenu, matchingItem, modal);
			});
		} else {
			addToGroupSubMenu(menu, matchingItem, modal, true);
		}

		if (!this.app.isMobile) {
			menu.addItem((item) => {
				item.setTitle("Remove from group").setIcon("user-minus");
				const submenu = (item as any).setSubmenu() as Menu;
				submenu.addItem((subitem) => {
					subitem
						.setTitle("All groups")
						.setDisabled(
							matchingItem.groupInfo.groupIndices.length === 0
						)
						.onClick(async () => {
							// matchingItem.groupInfo.groupIndices;
							await rmvAllGroupsFromPlugin(modal, matchingItem);
						});
				});
				addRemoveItemGroupMenuItems(modal, submenu, matchingItem);
			});
		} else {
			menu.addSeparator();
			addRemoveItemGroupMenuItems(modal, menu, matchingItem, true);
			menu.addItem((item) => {
				item
					.setTitle("Remove All groups")
					.setDisabled(
						matchingItem.groupInfo.groupIndices.length === 0
					)
					.onClick(async () => {
						// matchingItem.groupInfo.groupIndices;
						await rmvAllGroupsFromPlugin(modal, matchingItem);
					});
			});
		}
	}
	if (evt instanceof MouseEvent) {
		menu.showAtMouseEvent(evt);
	} else {
		menu.showAtPosition(modal.mousePosition);
	}
}

export async function updatePlugin(modal: QPSModal, matchingItem: PluginInstalled, commPlugins: Record<string, PluginCommInfo>) {
	const { id, version } = matchingItem;
	if (!matchingItem.dir) {
		new Notice(`Not a published plugin`, 2500);
		return
	}
	const filePath = modal.app.vault.adapter.getFullPath(
		matchingItem.dir
	);
	if (!filePath) return

	if (Platform.isDesktop) {
		const isDevPath = path.join(
			filePath,
			"package.json"
		);

		if (existsSync(isDevPath)) {
			return;
		}
	}

	const manifest = await getManifest(modal, id);
	if (!manifest) return
	const hasRelease = await getReleaseVersion(modal, id, manifest)
	const lastVersion = manifest.version

	if (!(id in commPlugins)) {
		new Notice(`Not a published plugin`, 2500);
	}
	else if (!manifest) {
		new Notice(`No manifest in ${commPlugins[id].repo}`, 3500)
	}
	else if (!hasRelease) {
		new Notice(`can't update, version ${manifest.version} in repo has not been released!`)
	}
	else if (lastVersion <= version) {
		new Notice(`Already last version ${lastVersion}`, 2500)
	}
	else {
		try {
			await modal.app.plugins.installPlugin(commPlugins[id!].repo, lastVersion, manifest);
			new Notice(`version ${version} updated to ${lastVersion}`, 2500);
			matchingItem.version = lastVersion
			await modal.plugin.installedUpdate();
		} catch {
			console.error("install failed");
		}
	}
	matchingItem.toUpdate = false
	await reOpenModal(modal);
}

export const findMatchingItem = (
	modal: CPModal | QPSModal,
	targetBlock: HTMLElement
) => {
	const { installed, commPlugins } = modal.plugin.settings
	const pluginId = targetBlock.getAttribute('data-plugin-id');
	if (modal instanceof QPSModal) {
		const matchingItem = Object.keys(installed).find(
			(id) => installed[id].id === pluginId
		);
		return installed[matchingItem as string];
	} else { // CPModal
		const matchingItem = Object.keys(commPlugins).find(
			(id) => commPlugins[id].id === pluginId
		);
		return commPlugins[matchingItem as string];
	}
};

export const createClearGroupsMenuItem = (
	modal: QPSModal | CPModal,
	menu: Menu,
	groupNumber: number
) => {
	if (!modal.app.isMobile) {
		menu.addItem((item) => {
			item.setTitle("Clear group(s)").setIcon("user-minus");

			const submenu = (item as any).setSubmenu() as Menu;
			addRemoveGroupMenuItems(modal, submenu, groupNumber);
			submenu.addSeparator();
			clearAllGroups(submenu, modal);

		});
	} else {
		menu.addItem((item) => {
			item.setTitle("Clear group(s)").setIcon("user-minus");
		})
		addRemoveGroupMenuItems(modal, menu, groupNumber);
		clearAllGroups(menu, modal);
	}
};

export function clearAllGroups(submenu: Menu, modal: CPModal | QPSModal) {
	const { plugin } = modal;
	const { settings } = plugin
	const { installed, commPlugins, groups, groupsComm } = settings;
	submenu.addItem((subitem) => {
		subitem.setTitle("All groups").onClick(async () => {
			const confirmReset = await confirm(
				"Detach all groups from all plugins?",
				300
			);
			if (confirmReset) {
				if (modal instanceof QPSModal) {
					for (const id in installed) {
						installed[id].groupInfo.hidden = false;
						installed[id].groupInfo.groupIndices = [];
					}
					for (const group in groups) groups[group].hidden = false
					await reOpenModal(modal);
					new Notice(`All groups empty`, 2500);
				} else {
					for (const group in groupsComm) groupsComm[group].hidden = false
					for (const id in commPlugins) {
						commPlugins[id].groupCommInfo.hidden = false;
						commPlugins[id].groupCommInfo.groupIndices = [];
					}
					await reOpenModal(modal);
					new Notice(`All groups empty`, 2500);
				}
			} else {
				new Notice("Operation cancelled", 2500);
			}
		});
	});
}

export async function addCommandToPlugin(
	modal: QPSModal | QuickPluginSwitcher,
	pluginItem: PluginInstalled
) {
	const plugin = (modal instanceof QPSModal) ? modal.plugin : modal
	if (!pluginItem.commandified) return
	const disabled = Platform.isDesktop && pluginItem.target === TargetPlatform.Mobile || Platform.isMobile && pluginItem.target === TargetPlatform.Desktop;
	plugin.addCommand({
		id: pluginItem.id + "-switcher",
		name: "⇔ switch " + pluginItem.name.toLocaleLowerCase(),
		callback: async () => {
			const isLoaded = modal.app.plugins.getPlugin(pluginItem.id)
			if (disabled) {
				new Notice(`${pluginItem.name} not available on this platform`, 2500)
				return
			}
			if (isLoaded) {
				new Notice(`${pluginItem.name} disabled`, 2500)
				modal.app.plugins.disablePlugin(pluginItem.id);
			} else {
				new Notice(`${pluginItem.name} enabled`, 2500)
				modal.app.plugins.enablePlugin(pluginItem.id);
			}
		}
	})
}

// removeCommandFromPlugin
export async function removeCommandFromPlugin(
	modal: QPSModal,
	pluginItem: PluginInstalled
) {
	const QPSname = modal.plugin.manifest.id + ":"
	const pluginId = pluginItem.id + "-switcher"
	modal.app.commands.removeCommand(QPSname + pluginId)
}
