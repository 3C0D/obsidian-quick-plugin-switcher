import type { CommandsCommandsRecord } from 'obsidian-typings';
import type { CPModal } from './community-plugins_modal.ts';
import type QuickPluginSwitcher from './main.ts';
import type { QPSModal } from './main_modal.ts';

export function isEnabled(
	modal: QuickPluginSwitcher | CPModal | QPSModal,
	id: string
): boolean {
	return modal.app.plugins.getPlugin(id) !== null;
}

export function removeItem<T>(arr: Array<T>, value: T): Array<T> {
	const index = arr.indexOf(value);
	if (index > -1) {
		arr.splice(index, 1);
	}
	return arr;
}

export function formatNumber(num: number, precision = 3): string {
	const map = [
		{ suffix: 'T', threshold: 1e12 },
		{ suffix: 'B', threshold: 1e9 },
		{ suffix: 'M', threshold: 1e6 },
		{ suffix: 'K', threshold: 1e3 },
		{ suffix: '', threshold: 1 }
	];

	const found = map.find((x) => Math.abs(num) >= x.threshold);
	if (found) {
		const value = num / found.threshold;
		const formatted =
			(found.suffix === '' ? value : value.toFixed(precision)) + found.suffix;
		return formatted;
	}

	return num.toString();
}

export function calculateTimeElapsed(datePasted: Date): string {
	if (isNaN(datePasted.getTime())) {
		return 'Invalid date';
	}
	const delta = Math.abs(new Date().getTime() - datePasted.getTime()) / 1000;
	const ranges = [
		{ label: 'year', seconds: 86400 * 365 },
		{ label: 'month', seconds: 86400 * 30 },
		{ label: 'day', seconds: 86400 },
		{ label: 'hour', seconds: 3600 },
		{ label: 'minute', seconds: 60 }
	];

	for (const range of ranges) {
		const value = Math.floor(delta / range.seconds);
		if (value >= 2) {
			return `${value} ${range.label}s ago`;
		}
		if (value === 1) {
			return `1 ${range.label} ago`;
		}
	}

	return 'seconds ago';
}

export function hasKeyStartingWith(obj: CommandsCommandsRecord, prefix: string): boolean {
	for (const key of Object.keys(obj)) {
		if (key.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

/** Returns the current text selection from the DOM window */
export function getSelectedContent(): string | undefined {
	const selection = window.getSelection();
	return selection?.toString();
}

/** Decodes a base64 string into a Uint8Array. */
export function base64ToUint8Array(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
