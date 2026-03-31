import 'obsidian';
import { CommFilters, Filters, SortBy, TargetPlatform } from './variables.ts';
import { PluginManifest } from 'obsidian';
import 'obsidian-typings';

declare module 'obsidian' {
	// 	interface App {
	// 		// setting: Setting;
	// 		// commands: Commands;
	// 		// isMobile: boolean;
	// 	}

	// interface Commands {
	// 	executeCommandById: (commandId: string) => boolean;
	// 	removeCommand: (commandId: string) => void;
	// }

	// interface Setting extends Modal {
	// 	openTabById: (id: string) => Record<string, any>;
	// }

	interface DataAdapter {
		getFullPath: (normalizedPath: string) => string;
	}
}

interface StringString {
	[key: string]: string;
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

interface PluginGroupInfo {
	hidden: boolean;
	groupIndices: number[];
	groupWasEnabled: boolean;
}

interface PluginCommGroupInfo {
	hidden: boolean;
	groupIndices: number[];
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
	// commnunity plugins
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

export type CommPlugins = Record<string, PluginCommInfo>;

type KeyToSettingsMapType = {
	[key: string]: () => Promise<void> | void;
};

interface CommPlugin {
	name: string;
	id: string;
	description: string;
	author: string;
	repo: string;
}

// community plugins
export interface PluginCommInfo extends CommPlugin {
	groupCommInfo: PluginCommGroupInfo;
	downloads: number;
	updated: number;
	hasNote: boolean;
}

//releases
interface PackageInfoData {
	[packageName: string]: PackageData;
}

interface PackageData {
	downloads: number;
	updated: number;
	[version: string]: number;
}
