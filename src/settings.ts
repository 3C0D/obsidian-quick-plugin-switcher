import { PluginSettingTab, Setting } from "obsidian";
import QuickPluginSwitcher from "./main";
import { confirm } from "./secondary_modals";
import { FolderSuggest } from "./suggester";

export default class QPSSettingTab extends PluginSettingTab {
	constructor(app: any, public plugin: QuickPluginSwitcher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const { plugin } = this;
		const { settings } = plugin;

		containerEl.empty();

		let saveSettingsTimeout: ReturnType<typeof setTimeout>;
		const { numberOfGroups, numberOfGroupsComm } = settings;
		new Setting(containerEl)
			.setName("Number of plugins groups")
			.setDesc("To treat plugins by groups")
			.addSlider((slider) => {
				slider
					.setLimits(1, 6, 1)
					.setValue(numberOfGroups)
					.setDynamicTooltip()
					.onChange(async (value) => {
						if (value < numberOfGroups) {
							clearTimeout(saveSettingsTimeout);
							saveSettingsTimeout = setTimeout(async () => {
								const confirmReset = await confirm(
									"reducing number of groups, higher groups info will be lost",
									350
								);
								if (confirmReset) {
									const { installed } = settings
									for (const key in installed) {
										let hasValueGreaterThanValue =
											false;
										for (const groupIndex of installed[key].groupInfo.groupIndices) {
											if (groupIndex > value) {
												hasValueGreaterThanValue =
													true;
												break;
											}
										}
										if (hasValueGreaterThanValue) {
											installed[key].groupInfo.groupIndices =
												[];
										}
									}

									settings.numberOfGroups = value;
									await plugin.saveSettings();
								} else {
									slider.setValue(numberOfGroups);
								}
							}, 700);
						} else {
							clearTimeout(saveSettingsTimeout);
							settings.numberOfGroups = value;
							await plugin.saveSettings();
						}
						settings.numberOfGroups = value;
						await plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Number of community plugins groups")
			.setDesc("To treat plugins by groups")
			.addSlider((slider) => {
				slider
					.setLimits(1, 6, 1)
					.setValue(numberOfGroupsComm)
					.setDynamicTooltip()
					.onChange(async (value) => {
						if (value < numberOfGroupsComm) {
							clearTimeout(saveSettingsTimeout);
							saveSettingsTimeout = setTimeout(async () => {
								const confirmReset = await confirm(
									"reducing number of groups, higher groups info will be lost",
									350
								);
								if (confirmReset) {
									const { commPlugins } =
										settings;
									for (const key in commPlugins) {
										let hasValueGreaterThanValue = false;
										let groupIndices = commPlugins[key].groupCommInfo.groupIndices;
										if (groupIndices) {
											for (const groupIndex of groupIndices) {
												if (groupIndex > value) {
													hasValueGreaterThanValue = true;
													break;
												}
											}
										}
										if (hasValueGreaterThanValue) {
											groupIndices = [];
										}
									};
									settings.numberOfGroupsComm = value;
									await plugin.saveSettings();
								} else {
									slider.setValue(numberOfGroupsComm);
								}
							}, 700);
						} else {
							clearTimeout(saveSettingsTimeout);
							settings.numberOfGroupsComm = value;
							await plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName("Show hotkeys line reminder")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showHotKeys)
					.onChange((value) => {
						this.plugin.settings.showHotKeys = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Keep dropdowns last value")
			.setDesc("If enabled, dropdowns will be kept in last value when opening the modal")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.keepDropDownValues)
					.onChange((value) => {
						this.plugin.settings.keepDropDownValues = value;
						this.plugin.saveSettings();
					});
			});

		const fragment = new DocumentFragment();
		fragment.createDiv({}, div => {
			div.innerHTML = `
						Enter a new folder path or search it. <br>If you provide a non existing folder path, it will be created when adding a new note.<br> If you delete the file in, you lose your notes`
		});

		new Setting(containerEl)
			.setName("Community plugins notes folder")
			.setDesc(fragment)
			.addText((component) => {
				component.setPlaceholder("search or type new folder");
				const inputEl = component.inputEl;
				new FolderSuggest(this.app, inputEl);
				component
					.setValue(this.plugin.settings.commPluginsNotesFolder)
				inputEl.onblur = async () => {
					this.plugin.settings.commPluginsNotesFolder = component.getValue();
					await this.plugin.saveSettings();
				}
			});
	}
}
