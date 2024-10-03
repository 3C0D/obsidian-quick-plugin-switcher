import { CPModal } from "./community-plugins_modal";
import QuickPluginSwitcher from "./main";
import { QPSModal } from "./main_modal";

export function isEnabled(modal: QuickPluginSwitcher | CPModal | QPSModal, id: string): boolean {
	return modal.app.plugins.enabledPlugins.has(id);
}

export function removeItem<T>(arr: Array<T>, value: T): Array<T> {
	const index = arr.indexOf(value);
	if (index > -1) {
		arr.splice(index, 1);
	}
	return arr;
}

export function formatNumber(num: number, precision = 3) {
    const map = [
        { suffix: "T", threshold: 1e12 },
        { suffix: "B", threshold: 1e9 },
        { suffix: "M", threshold: 1e6 },
        { suffix: "K", threshold: 1e3 },
        { suffix: "", threshold: 1 }
    ];

    const found = map.find((x) => Math.abs(num) >= x.threshold);
    if (found) {
        const value = num / found.threshold;
        const formatted = (found.suffix === "" ? value : value.toFixed(precision)) + found.suffix;
        return formatted;
    }

    return num.toString();
}

export function calculateTimeElapsed(datePasted: Date): string {
	if (isNaN(datePasted.getTime())) {
		return "Invalid date";
	}
	const delta = Math.abs(new Date().getTime() - datePasted.getTime()) / 1000;

	const years = Math.floor(delta / (86400 * 365));
	if (years >= 2) {
		return `${years} years ago`;
	} else if (years === 1) {
		return "1 year ago";
	}

	const months = Math.floor(delta / (86400 * 30));
	if (months >= 2) {
		return `${months} months ago`;
	} else if (months === 1) {
		return "1 month ago";
	}

	const days = Math.floor(delta / 86400);
	if (days >= 2) {
		return `${days} days ago`;
	} else if (days === 1) {
		return "1 day ago";
	}

	const hours = Math.floor(delta / 3600) % 24;
	if (hours >= 2) {
		return `${hours} hours ago`;
	} else if (hours === 1) {
		return "1 hour ago";
	}

	const minutes = Math.floor(delta / 60) % 60;
	if (minutes >= 2) {
		return `${minutes} minutes ago`;
	} else if (minutes === 1) {
		return "1 minute ago";
	}

	return "seconds ago";
}

export function hasKeyStartingWith(obj: Record<string, string>, prefix: string): boolean {
	for (const key in obj) {
		if (key.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

export function getSelectedContent() {
	const selection = window.getSelection();
	return selection?.toString();
}

export function base64ToUint8Array(base64: string) {
	const binaryString = atob(base64);
	const length = binaryString.length;
	const bytes = new Uint8Array(length);
	let i = 0;
	for (const charCode of binaryString) {
		bytes[i++] = charCode.charCodeAt(0);
	}
	return bytes;
}
