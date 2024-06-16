import 'obsidian'
import { CommFilters, Filters, SortBy, TargetPlatform } from './types/variables';
import { PluginManifest } from 'obsidian';

declare module "obsidian" {
    interface App {
        setting: Setting,
        plugins: Plugins,
        commands: Commands;
        isMobile: boolean;
    }

    interface Plugins {
        manifests: Record<string, PluginManifest>
        plugins: Record<string, Plugin>;
        installPlugin: (repo: string, version: string, manifest: PluginManifest) => Promise<void>;
        enabledPlugins: Set<string>;
        disablePlugin: (id: string) => Promise<void>;
        disablePluginAndSave: (id: string) => Promise<void>;
        enablePlugin: (id: string) => Promise<void>;
        enablePluginAndSave: (id: string) => Promise<void>;
        getPlugin: (id: string) => Plugin | null;
    }

    interface Commands {
        executeCommandById: (commandId: string) => boolean;
        removeCommand: (commandId: string) => void;
    }

    interface Setting extends Modal { openTabById: (id: string) => Record<string, any>; }

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
        { name: string; delayed: boolean; time: number; applied: boolean, hidden: boolean }
    >;
    showHotKeys: boolean;
    // commnunity plugins
    pluginStats: PackageInfoData;
    plugins: string[];
    commPlugins: Record<string, PluginCommInfo>;
    filtersComm: keyof typeof CommFilters;
    selectedGroupComm: string;
    numberOfGroupsComm: number;
    groupsComm: Record<number, { name: string, hidden: boolean }>;
    byAuthor: boolean;
    invertFiltersComm: boolean;
    commPluginsNotesFolder: string;
    keepDropDownValues: boolean;
}

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
interface PluginCommInfo extends CommPlugin {
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