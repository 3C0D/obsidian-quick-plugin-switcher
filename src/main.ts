import { Platform, Plugin } from 'obsidian';
import { around } from "monkey-around";
import { QPSModal } from "./main_modal";
import { isEnabled } from "./utils";
import { QPSSettingTab } from "./settings";
import { fetchData, updateNotes } from "./community-plugins_modal";
import { PluginCommInfo, PluginInstalled, QPSSettings } from "./global";
import { COMMPLUGINS, COMMPLUGINSTATS, CommFilters, DEFAULT_SETTINGS, Filters, TargetPlatform } from './types/variables';
import { focusSearchInput } from './modal_utils';
import { addCommandToPlugin } from './modal_components';

// ajouter github raccourci dans readme

export default class QuickPluginSwitcher extends Plugin {
	settings: QPSSettings;
	lengthAll = 0;
	lengthDisabled = 0;
	lengthEnabled = 0;
	reset = false;

	async onload() {
		await this.loadSettings();
		this.app.workspace.onLayoutReady(this.initializePlugin.bind(this));
		this.addSettingTab(new QPSSettingTab(this.app, this));
		this.addCommands();
	}

	private async initializePlugin() {
        this.settings.savedVersion = this.manifest.version;
        await this.updateInstalledPlugins();
		await this.setupPluginWrappers();
        await this.syncEnabled();
        await this.handleDelayedPlugins();
    }

	async updateInstalledPlugins() {
		const installed = this.settings.installed || {};
		const manifests = this.app.plugins.manifests || {};

		for (const pluginId in installed) {
			if (!(pluginId in manifests)) {
				delete installed[pluginId];
			}
		}
	}

	async setupPluginWrappers() {
		const { wrapper1, wrapper2 } = this.wrapDisableEnablePluginAndSave(
			Object.keys(this.settings.installed),
			async () => await this.saveSettings());

		this.register(wrapper1);
		this.register(wrapper2);
	}

	async syncEnabled() {
		const installed = this.settings.installed;
		// plugin has been toggled from obsidian UI ? or if is delayed unabled
		for (const id in installed) {
			if (
				isEnabled(this, id) !== installed[id].enabled &&
				!installed[id].delayed
				&& !(installed[id].target === TargetPlatform.Mobile || installed[id].target === TargetPlatform.Desktop)//because if delayed isEnabled false
			) {
				installed[id].enabled = !installed[id].enabled;
			}
		}
		await this.saveSettings();
	}


	isPlatformMismatch(pluginItem: PluginInstalled) {
		return (pluginItem.target === TargetPlatform.Mobile && Platform.isDesktop) ||
			(pluginItem.target === TargetPlatform.Desktop && Platform.isMobile);
	}

	isPlatformDependent(pluginItem: PluginInstalled) {
		return pluginItem.target === TargetPlatform.Mobile || pluginItem.target === TargetPlatform.Desktop;
	}

	async handleDelayedPlugins() {
		const installed = this.settings.installed;

		for (const id in installed) {
			const pluginItem = installed[id]

			if (pluginItem.commandified) {
				await addCommandToPlugin(this, pluginItem)
			}

			// Handle delayed or platform-dependent plugins
			if ((pluginItem.delayed || this.isPlatformDependent(pluginItem)) && pluginItem.enabled) {
				if (this.isPlatformMismatch(pluginItem)) {
					await this.app.plugins.disablePlugin(id)
				} else {
					if (pluginItem.delayed) {
						const time = pluginItem.time * 1000 || 0;
						setTimeout(
							async () => await this.app.plugins.enablePlugin(id),
							time
						);
					} else {
						await this.app.plugins.enablePlugin(id)
					}
				}
			}

			//reset toUpdate
			installed[id].toUpdate = false
		}
	}


	addCommands() {
		this.addCommand({
			id: "quick-plugin-switcher-modal",
			name: "Open modal",
			callback: () => this.openQuickPluginSwitcherModal()
		});

		this.addRibbonIcon(
			"toggle-right",
			"Quick Plugin Switcher",
			(evt: MouseEvent) => this.openQuickPluginSwitcherModal()
		);
	}

	async openQuickPluginSwitcherModal() {
		if (!this.settings.keepDropDownValues) {
			this.settings.filters = Filters.all;
			this.settings.filtersComm = CommFilters.all;
		}
		await this.installedUpdate();
		new QPSModal(this.app, this).open();
		focusSearchInput(10);
		await this.exeAfterDelay(this.pluginsCommInfo.bind(this));
		setTimeout(() => updateNotes(this), 700);
	}

	wrapDisableEnablePluginAndSave(stillInstalled: string[], cb: () => Promise<void>) {
		const installed = this.settings.installed || {};
		const wrapper1 = around(this.app.plugins, {
			disablePluginAndSave(oldMethod) {
				return async function (pluginId: string) {
					if (stillInstalled.length) {
						const id = stillInstalled.find(
							(id) =>
								id === pluginId &&
								!isEnabled(this, pluginId)
						);
						if (
							id && (installed[id].delayed && installed[id].time > 0
								|| (installed[id].target === TargetPlatform.Mobile || installed[id].target === TargetPlatform.Desktop))
						) {
							installed[id].enabled = false;
							cb();
						}
					}
					return oldMethod.call(this, pluginId);
				};
			},
		});

		const wrapper2 = around(this.app.plugins, {
			enablePluginAndSave(oldMethod) {
				return async function (pluginId: string) {
					let altReturn = false;
					if (stillInstalled.length) {
						const id = stillInstalled.find(
							(id) =>
								id === pluginId &&
								isEnabled(this, id)
						);
						if (id && installed[id].delayed && installed[id].time > 0) {
							installed[id].enabled = true;
							altReturn = true;
							cb();
						}
					}
					if (altReturn)
						return this.app.plugins.enablePlugin.call(
							this,
							pluginId
						);
					return oldMethod.call(this, pluginId);
				};
			},
		});

		return { wrapper1, wrapper2 };
	}

	async installedUpdate() {
		const installed = this.settings.installed || {};
		const manifests = this.app.plugins.manifests || {};

		// plugin have been deleted from obsidian UI ?
		const stillInstalled: string[] = [];

		for (const id in installed) {
			if (id in manifests)
				stillInstalled.push(id);
			else {
				delete installed[id]
			}
		}

		for (const key in manifests) {
			// plugin has been toggled from obsidian UI ? or if is delayed unabled
			const inListId = stillInstalled.find(
				(id) => id === key
			);
			if (inListId) {
				if (isEnabled(this, key) !== installed[key].enabled) {
					if (
						!(installed[key].delayed || (installed[key].target === TargetPlatform.Mobile
							|| installed[key].target === TargetPlatform.Desktop))
					) {
						installed[key].enabled = !installed[key].enabled;
					} else if (
						(installed[key].delayed || (installed[key].target === TargetPlatform.Mobile || installed[key].target === TargetPlatform.Desktop))
					) {
						if (isEnabled(this, key)) {
							installed[key].enabled = true;
							await this.app.plugins.disablePluginAndSave(
								key
							);
							await this.app.plugins.enablePlugin(
								key
							);
						}
					}
				}
				installed[key] = {
					...installed[key], ...manifests[key]
				}
			} else {
				const complement = {
					enabled: isEnabled(this, key) || false,
					switched: 0,
					groupInfo: {
						hidden: false,
						groupIndices: [],
						groupWasEnabled: false,
					},
					delayed: false,
					time: 0,
				}

				installed[key] = {
					...manifests[key], ...complement,
				}
			}
		}
		this.getLength();
		await this.saveSettings();
	}

	getLength() {
		const installed = this.settings.installed;
		this.lengthAll = Object.keys(installed).length;
		this.lengthEnabled = 0;
		this.lengthDisabled = 0;

		for (const key in installed) {
			if (installed[key].enabled) {
				this.lengthEnabled++;
			} else {
				this.lengthDisabled++;
			}
		}
	}

	async pluginsCommInfo() {
		console.warn("Fetching community plugins info...");
		try {
			const [plugins, stats] = await Promise.all([
				fetchData(COMMPLUGINS),
				fetchData(COMMPLUGINSTATS)
			]);

			if (!plugins || !stats) {
				console.error("Failed to fetch plugin data or stats.");
				return false;
			}

			const { commPlugins } = this.settings;

			plugins.forEach((plugin: PluginCommInfo) => {
				const updateStats = stats[plugin.id] || { downloads: 0, updated: 0 };
				commPlugins[plugin.id] = {
					...commPlugins[plugin.id],
					...plugin,
					...updateStats,
					groupCommInfo: commPlugins[plugin.id]?.groupCommInfo || {
						hidden: false,
						groupIndices: []
					},
					hasNote: commPlugins[plugin.id]?.hasNote || false
				};
			});

			this.settings.pluginStats = { ...this.settings.pluginStats, ...stats };
			this.settings.plugins = plugins.map((plugin: PluginCommInfo) => plugin.id);
			await this.saveSettings();
			console.log("Community plugins info updated successfully.");
			return true;
		} catch (error) {
			console.error("Failed to process plugin data:", error);
			return false;
		}
	}

	exeAfterDelay = async (func: () => Promise<boolean>) => {
		const currentTime: number = Date.now();
		const timeSinceLastFetch = currentTime - this.settings.lastFetchExe;

		if (timeSinceLastFetch < 120000) {
			console.log("Skipping fetch: less than 2 minutes since last update");
			return;
		}

		const success = await func();
		if (success) {
			this.settings.lastFetchExe = currentTime;
			await this.saveSettings();
		} else {
			console.warn("Community plugins update failed, please check your connection");
		}
	};

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
	}


	async onExternalSettingsChange(): Promise<void> {
		await this.loadSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}