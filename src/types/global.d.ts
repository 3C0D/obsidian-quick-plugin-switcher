import 'obsidian';
import 'obsidian-typings';
import type { PluginManifest } from 'obsidian';
import type { CommFilters, Filters, SortBy, TargetPlatform } from './variables.ts';

declare global {
	interface WindowWithElectron {
		electron?: {
			remote: {
				dialog: {
					showOpenDialogSync(
						options: Record<string, unknown>
					): string[] | undefined;
					showSaveDialogSync(
						options: Record<string, unknown>
					): string | undefined;
				};
				shell: {
					openPath(path: string): Promise<string>;
				};
			};
		};
	}

	interface GitHubFileResponse {
		content: string;
		encoding: string;
	}

	interface StringString {
		[key: string]: string;
	}

	interface PluginGroupInfo {
		hidden: boolean;
		groupIndices: number[];
		groupWasEnabled: boolean;
	}

	interface PluginCommGroupInfo {
		hidden: boolean;
		groupIndices: number[];
	}

	interface PluginInstalled extends PluginManifest {
		enabled: boolean;
		switched: number;
		groupInfo: PluginGroupInfo;
		delayed: boolean;
		time: number;
		commandified?: boolean;
		toUpdate?: boolean;
		target?: TargetPlatform;
	}

	interface CommPlugin {
		name: string;
		id: string;
		description: string;
		author: string;
		repo: string;
	}

	interface PackageData {
		downloads: number;
		updated: number;
		[version: string]: number;
	}

	interface PackageInfoData {
		[packageName: string]: PackageData;
	}

	interface PluginCommInfo extends CommPlugin {
		groupCommInfo: PluginCommGroupInfo;
		downloads: number;
		updated: number;
		hasNote: boolean;
	}

	interface QPSSettings {
		lastFetchExe: number;
		savedVersion: string;
		installed: Record<string, PluginInstalled>;
		wasEnabled: string[];
		sortBy: keyof typeof SortBy;
		filters: keyof typeof Filters;
		selectedGroup: string;
		search: string;
		numberOfGroups: number;
		groups: Record<
			number,
			{
				name: string;
				delayed: boolean;
				time: number;
				applied: boolean;
				hidden: boolean;
			}
		>;
		showHotKeys: boolean;
		pluginStats: PackageInfoData;
		plugins: string[];
		commPlugins: CommPlugins;
		filtersComm: keyof typeof CommFilters;
		selectedGroupComm: string;
		numberOfGroupsComm: number;
		groupsComm: Record<number, { name: string; hidden: boolean }>;
		byAuthor: boolean;
		invertFiltersComm: boolean;
		commPluginsNotesFolder: string;
		keepDropDownValues: boolean;
	}

	interface TranslatorApi {
		valid: boolean;
		translate(text: string, from: string, to: string): Promise<unknown>;
	}

	interface TranslatePluginApi {
		translator?: TranslatorApi;
		current_language?: string;
		loadData(): Promise<{
			target_language_preference: 'last' | 'specific' | 'display';
			last_used_target_languages: string[];
			default_target_language: string;
		}>;
	}

	interface HotkeysTabLike {
		searchComponent: { inputEl: HTMLInputElement };
		updateHotkeyVisibility: () => void;
	}
}

declare module 'obsidian' {
	interface DataAdapter {
		getFullPath: (normalizedPath: string) => string;
	}
}

type CommPlugins = Record<string, PluginCommInfo>;

type KeyToSettingsMapType = {
	[key: string]: () => Promise<void> | void;
};
