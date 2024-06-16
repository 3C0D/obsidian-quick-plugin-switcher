import { Platform, Plugin } from 'obsidian';
import { around } from "monkey-around";
import { QPSModal } from "./main_modal";
import { isEnabled } from "./utils";
import QPSSettingTab from "./settings";
import { fetchData, updateNotes } from "./community-plugins_modal";
import { CommPlugin, PackageInfoData, QPSSettings } from "./global";
import { COMMPLUGINS, COMMPLUGINSTATS, CommFilters, DEFAULT_SETTINGS, Filters, TargetPlatform } from './types/variables';
import { Console } from './Console';
import { focusSearchInput } from './modal_utils';
import { addCommandToPlugin } from './modal_components';

export default class QuickPluginSwitcher extends Plugin {
	settings: QPSSettings;
	lengthAll = 0;
	lengthDisabled = 0;
	lengthEnabled = 0;
	reset = false;

	async onload() {
		await this.loadSettings();
		this.app.workspace.onLayoutReady(async () => {
			this.settings.savedVersion = this.manifest.version;
			const installed = this.settings.installed || {};
			const manifests = this.app.plugins.manifests || {};

			// plugin have been deleted from obsidian UI ?
			let stillInstalled: string[] = [];
			for (const pluginId in installed) {
				if (pluginId in manifests)
					stillInstalled.push(pluginId);
				else {
					delete installed[pluginId]
				}
			}

			//wrapper enable/disable&save
			const { wrapper1, wrapper2 } = this.wrapDisableEnablePluginAndSave(
				stillInstalled,
				async () => {
					await this.saveSettings();
				}
			);

			this.register(wrapper1);
			this.register(wrapper2);

			// plugin has been toggled from obsidian UI ? or if is delayed unabled
			for (const id of stillInstalled) {
				if (
					isEnabled(this, id) !== installed[id].enabled &&
					!installed[id].delayed
					&& !(installed[id].target === TargetPlatform.Mobile || installed[id].target === TargetPlatform.Desktop)//because if delayed isEnabled false
				) {
					installed[id].enabled = !installed[id].enabled;
				}
			}
			await this.saveSettings();

			for (const id of stillInstalled) {
				const isPlatformDep = installed[id].target === TargetPlatform.Mobile || installed[id].target === TargetPlatform.Desktop
				const platformOff =
					installed[id].target === TargetPlatform.Mobile && Platform.isDesktop
					|| installed[id].target === TargetPlatform.Desktop && Platform.isMobile
				//delay at start
				if (installed[id].commandified) {
					await addCommandToPlugin(this, installed[id])
				}
				if ((installed[id].delayed
					|| isPlatformDep)
					&& installed[id].enabled) {
					if (platformOff) {
						await this.app.plugins.disablePlugin(id)
					} else {
						if (installed[id].delayed) {
							const time = installed[id].time * 1000 || 0;
							setTimeout(
								async () =>
									await this.app.plugins.enablePlugin(id),
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
		});

		this.addSettingTab(new QPSSettingTab(this.app, this));

		this.addRibbonIcon(
			"toggle-right",
			"Quick Plugin Switcher",
			async (evt: MouseEvent) => {
				if (!this.settings.keepDropDownValues) {
					this.settings.filters = Filters.all
					this.settings.filtersComm = CommFilters.all
				}
				await this.installedUpdate();
				new QPSModal(this.app, this).open();
				focusSearchInput(10);
				await this.exeAfterDelay(this.pluginsCommInfo.bind(this))
				setTimeout(async () => {
					await updateNotes(this)
				}, 700);
			}
		);

		this.addCommand({
			id: "quick-plugin-switcher-modal",
			name: "open modal",
			callback: async () => {
				if (!this.settings.keepDropDownValues) {
					this.settings.filters = Filters.all
					this.settings.filtersComm = CommFilters.all
				}
				await this.installedUpdate();
				new QPSModal(this.app, this).open();
				focusSearchInput(10);
				await this.exeAfterDelay(this.pluginsCommInfo.bind(this));
				setTimeout(async () => {
					await updateNotes(this);
				}, 700);
			},
		});
	}

	wrapDisableEnablePluginAndSave(stillInstalled: string[], cb: () => {}) {
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
		let stillInstalled: string[] = [];

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
		Console.log("fetching'''''''''''''''''''''''''");
		let plugins: CommPlugin[], stats: PackageInfoData;
		try {
			plugins = await fetchData(COMMPLUGINS);
			stats = await fetchData(COMMPLUGINSTATS);
		} catch {
			return false;
		}
		if (plugins && stats) {
			const { commPlugins, pluginStats } = this.settings

			for (const plugin of plugins) {
				let updateStats;
				if (plugin.id in stats) {
					updateStats = {
						downloads: stats[plugin.id].downloads || 0,
						updated: stats[plugin.id].updated || 0
					}
				} else {
					updateStats = {
						downloads: 0,
						updated: 0
					}
				}

				if (plugin.id in commPlugins) {
					commPlugins[plugin.id] = { ...commPlugins[plugin.id], ...plugin, ...updateStats };
				} else {
					const complement = {
						groupCommInfo: {
							hidden: false,
							groupIndices: []
						},
						hasNote: false,
						...updateStats
					}
					commPlugins[plugin.id] = { ...plugin, ...complement };
				}
			}

			this.settings.pluginStats = { ...this.settings.pluginStats, ...stats };
			this.settings.plugins = plugins.map((plugin) => plugin.id);
			await this.saveSettings();
			Console.log("fetched");
			return true;
		}
		return false;
	}

	exeAfterDelay = async (
		func: () => Promise<boolean>
	) => {
		const currentTime: number = Date.now();
		// delay 2min
		if (currentTime - this.settings.lastFetchExe >= 120000) {
			const ret = await func();
			if (ret === true) {
				this.settings.lastFetchExe = currentTime;
				await this.saveSettings();
			} else {
				Console.log("community plugins udpate failed, check your connexion");
			}
		} else {
			Console.log(
				"fetched less than 2 min, community plugins not updated"
			);
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