import type { App } from 'obsidian';
import { Notice, Modal } from 'obsidian';

function getTranslatePlugin(app: App): TranslatePluginApi | null {
	const plugin = app.plugins.plugins.translate;
	if (!plugin) return null;
	return plugin as unknown as TranslatePluginApi;
}

/** Checks if the obsidian-translate plugin is installed and has a valid translator configured. */
function canTranslate(app: App): boolean {
	const plugin = getTranslatePlugin(app);
	return plugin?.translator?.valid ?? false;
}

/**
 * Translates text using the obsidian-translate plugin.
 * Target language is determined by that plugin's own settings (last used, specific, or display language).
 */
async function translate(app: App, text: string, from: string): Promise<unknown> {
	let to = '';
	const plugin = getTranslatePlugin(app);
	if (!plugin) {
		new Notice('install obsidian-translate and select a translator');
		return;
	}
	if (!canTranslate(app)) {
		new Notice('translator not valid. check your settings', 4000);
		return;
	}
	const loaded_settings = await plugin.loadData();

	if (loaded_settings.target_language_preference === 'last') {
		to = loaded_settings.last_used_target_languages[0];
	} else if (loaded_settings.target_language_preference === 'specific') {
		to = loaded_settings.default_target_language;
	} else if (loaded_settings.target_language_preference === 'display') {
		to = plugin.current_language ?? loaded_settings.default_target_language;
	}

	const translator = plugin.translator;
	if (!translator) {
		new Notice('translator not valid. check your settings', 4000);
		return;
	}
	return translator.translate(text, from, to);
}

export async function translation(app: App, selectedContent: string): Promise<void> {
	if (!selectedContent) {
		new Notice('no content selected', 2000);
		return;
	}
	const translated = await translate(app, selectedContent, 'en');
	if (!translated) return;
	const translation = (translated as { translation?: string }).translation;
	if (!translation) {
		new Notice('translator not valid. check your settings', 4000);
		return;
	}
	new TranslateModal(app, translation).open();
}

/** Displays the translated text in a modal, split by line breaks. */
export class TranslateModal extends Modal {
	constructor(
		app: App,
		public message: string
	) {
		super(app);
		this.modalEl.addClass('translate-modal');
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		const lines = this.message.split('\n');
		lines.forEach((line) => contentEl.createEl('p').setText(line));
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
