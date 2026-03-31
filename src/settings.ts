import type { App, SliderComponent } from 'obsidian';
import { debounce, PluginSettingTab, Setting } from 'obsidian';
import type QuickPluginSwitcher from './main.ts';
import { confirm } from './secondary_modals.ts';
import { FolderSuggest } from './suggester.ts';

export class QPSSettingTab extends PluginSettingTab {
	plugin: QuickPluginSwitcher;
	private lastConfirmedValues: { [key: string]: number };

	constructor(app: App, plugin: QuickPluginSwitcher) {
		super(app, plugin);
		this.plugin = plugin;
		this.lastConfirmedValues = {
			numberOfGroups: this.plugin.settings.numberOfGroups,
			numberOfGroupsComm: this.plugin.settings.numberOfGroupsComm
		};
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.addGroupSlider('Number of plugins groups', 'numberOfGroups');
		this.addGroupSlider('Number of community plugins groups', 'numberOfGroupsComm');

		new Setting(containerEl)
			.setName('Show hotkeys line reminder')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showHotKeys).onChange((value) => {
					this.plugin.settings.showHotKeys = value;
					this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Keep dropdowns last value')
			.setDesc(
				'If enabled, dropdowns will be kept in last value when opening the modal'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.keepDropDownValues)
					.onChange((value) => {
						this.plugin.settings.keepDropDownValues = value;
						this.plugin.saveSettings();
					});
			});

		const fragment = new DocumentFragment();
		fragment.createDiv({}, (div) => {
			div.innerHTML = `
						Enter a new folder path or search it. <br>
						If you provide a non existing folder path, it will be created when adding a new note.<br> 
						If you delete the file in, you lose your notes`;
		});

		new Setting(containerEl)
			.setName('Community plugins notes folder')
			.setDesc(fragment)
			.addText((component) => {
				component.setPlaceholder('search or type new folder');
				const inputEl = component.inputEl;
				new FolderSuggest(this.app, inputEl);
				component.setValue(this.plugin.settings.commPluginsNotesFolder);
				inputEl.onblur = async () => {
					this.plugin.settings.commPluginsNotesFolder = component.getValue();
					await this.plugin.saveSettings();
				};
			});
	}

	private addGroupSlider(
		name: string,
		key: 'numberOfGroups' | 'numberOfGroupsComm'
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc('To treat plugins by groups')
			.addSlider((slider) => {
				slider
					.setLimits(1, 6, 1)
					.setValue(this.lastConfirmedValues[key])
					.setDynamicTooltip()
					.onChange((value) => {
						this.debouncedHandleChange(key, value, slider);
					});
			});
	}

	/**
	 * Debounced to avoid firing on every slider tick.
	 * Asks for confirmation when reducing group count, since higher group assignments will be lost.
	 */
	private debouncedHandleChange = debounce(
		async (
			key: 'numberOfGroups' | 'numberOfGroupsComm',
			value: number,
			slider: SliderComponent
		) => {
			if (value < this.lastConfirmedValues[key]) {
				const confirmReset = await confirm(
					'Reducing number of groups, higher groups info will be lost',
					350
				);
				if (confirmReset) {
					await this.handleGroupReduction(key, value);
					this.lastConfirmedValues[key] = value;
				} else {
					slider.setValue(this.lastConfirmedValues[key]);
				}
			} else {
				this.plugin.settings[key] = value;
				this.lastConfirmedValues[key] = value;
				await this.plugin.saveSettings();
			}
		},
		600,
		true
	);

	/** Strips group indices above the new value from all plugins to avoid orphaned group references. */
	private async handleGroupReduction(
		key: 'numberOfGroups' | 'numberOfGroupsComm',
		value: number
	): Promise<void> {
		const { settings } = this.plugin;
		const targetGroup =
			key === 'numberOfGroups' ? settings.installed : settings.commPlugins;

		// Use Object.keys() instead of for...in to avoid iterating over prototype properties
		for (const pluginKey of Object.keys(targetGroup)) {
			const plugin = targetGroup[pluginKey];
			const groupInfo =
				key === 'numberOfGroups'
					? (plugin as PluginInstalled).groupInfo
					: (plugin as PluginCommInfo).groupCommInfo;

			if (groupInfo && groupInfo.groupIndices) {
				groupInfo.groupIndices = groupInfo.groupIndices.filter(
					(groupIndex: number) => groupIndex <= value
				);
			}
		}

		settings[key] = value;
		await this.plugin.saveSettings();
	}
}
