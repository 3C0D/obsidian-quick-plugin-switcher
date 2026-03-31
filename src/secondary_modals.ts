import type { App } from 'obsidian';
import {
	ButtonComponent,
	Component,
	MarkdownRenderer,
	Menu,
	Modal,
	Notice,
	Platform,
	Scope,
	Setting
} from 'obsidian';
import type QuickPluginSwitcher from './main.ts';
import type { CPModal } from './community-plugins_modal.ts';
import { getManifest, getReadMe, handleNote } from './community-plugins_modal.ts';
import {
	isInstalled,
	modifyGitHubLinks,
	openPluginSettings,
	reOpenModal,
	showHotkeysFor
} from './modal_utils.ts';
import { base64ToUint8Array, getSelectedContent, isEnabled } from './utils.ts';
import { openGitHubRepo, getHkeyCondition } from './modal_components.ts';
import { translation } from './translate.ts';

/** Modal showing a short description of an installed plugin (name, version, author, description). */
export class DescriptionModal extends Modal {
	constructor(
		app: App,
		public plugin: QuickPluginSwitcher,
		public pluginItem: PluginInstalled
	) {
		super(app);
		this.plugin = plugin;
		this.pluginItem = pluginItem;
	}

	onOpen(): void {
		const { contentEl, pluginItem } = this;
		contentEl.empty();
		contentEl
			.createEl('p', {
				text: pluginItem.name + ' - v' + pluginItem.version
			})
			.createEl('p', {
				text:
					'author: ' +
					pluginItem.author +
					', url: ' +
					(pluginItem.authorUrl ? '' : 'null')
			})
			.createEl('a', {
				text: pluginItem.authorUrl,
				href: pluginItem.authorUrl
			});

		// fallback to manifest description if plugin not yet in commPlugins
		const desc =
			this.plugin.settings.commPlugins[pluginItem.id]?.description ??
			pluginItem.description;
		contentEl.createEl('p', { text: desc });
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

type ConfirmCallback = (confirmed: boolean) => void;

/** Generic confirmation modal with a checkmark/cross button pair. */
class ConfirmModal extends Modal {
	constructor(
		app: App,
		public message: string,
		public callback: ConfirmCallback,
		public width?: number,
		public height?: number
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		if (this.width) {
			this.modalEl.style.width = `${this.width}px`;
		}

		if (this.height) {
			this.modalEl.style.height = `${this.height}px`;
		}

		contentEl.createEl('p').setText(this.message);

		new Setting(this.contentEl)
			.addButton((b) => {
				b.setIcon('checkmark')
					.setCta()
					.onClick(() => {
						this.callback(true);
						this.close();
					});
			})
			.addExtraButton((b) =>
				b.setIcon('cross').onClick(() => {
					this.callback(false);
					this.close();
				})
			);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/** Wraps ConfirmModal in a Promise so callers can await the user's choice. */
async function openConfirmModal(
	app: App,
	message: string,
	width?: number,
	height?: number
): Promise<boolean> {
	return await new Promise((resolve) => {
		new ConfirmModal(
			app,
			message,
			(confirmed: boolean) => {
				resolve(confirmed);
			},
			width ?? undefined,
			height ?? undefined
		).open();
	});
}

/** Public entry point for confirm dialogs. */
export async function confirm(
	app: App,
	message: string,
	width?: number,
	height?: number
): Promise<boolean> {
	return await openConfirmModal(
		app,
		message,
		width ?? undefined,
		height ?? undefined
	);
}

/**
 * Modal that fetches and renders the README of a community plugin from GitHub.
 * Also provides action buttons (install/enable/disable/uninstall) and keyboard shortcuts.
 */
export class ReadMeModal extends Modal {
	comp: Component;
	mousePosition: { x: number; y: number };
	// custom scope to register shortcuts without conflicting with Obsidian's global ones
	scope: Scope = new Scope(this.app.scope);
	constructor(
		app: App,
		public modal: CPModal,
		public pluginItem: PluginCommInfo
	) {
		super(app);
		this.modal = modal;
		this.pluginItem = pluginItem;
		this.modalEl.addClass('read-me-modal');
		this.mousePosition = { x: 0, y: 0 };
		// Component needed to properly manage the lifecycle of MarkdownRenderer
		this.comp = new Component();
		this.comp.load();
		// Register once: onOpen can be called multiple times after install/enable/disable actions.
		this.modalEl.addEventListener('mousemove', (event) => {
			this.mousePosition = { x: event.clientX, y: event.clientY };
		});
		this.modalEl.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			const selectedContent = getSelectedContent();
			if (selectedContent) {
				const menu = new Menu();
				menu.addItem((item) =>
					item.setTitle('Copy (Ctrl+C)').onClick(async () => {
						await navigator.clipboard.writeText(selectedContent);
					})
				);
				menu.addItem((item) =>
					item.setTitle('translate (t)').onClick(async () => {
						await translation(this.app, selectedContent);
					})
				);

				menu.showAtPosition(this.mousePosition);
			}
		});
	}

	async onOpen(): Promise<void> {
		const { contentEl, pluginItem } = this;
		contentEl.empty();
		const id = pluginItem.id;

		contentEl
			.createEl('p', {
				text: pluginItem.name,
				cls: 'readme-title'
			})
			.createEl('p', {
				text: 'By: ' + pluginItem.author
			});

		const openRepo = contentEl.createDiv();
		new ButtonComponent(openRepo).setButtonText('GitHub Repo').onClick(async (e) => {
			await openGitHubRepo(e, this.modal, pluginItem);
		});

		const isQPS = id === 'quick-plugin-switcher';

		// not installed: show Install / installed: show enable, disable, uninstall...
		const divButtons = contentEl.createDiv({ cls: 'read-me-buttons' });
		if (!isInstalled(this.app, id)) {
			new ButtonComponent(divButtons)
				.setButtonText('Install')
				.setCta()
				.onClick(async () => {
					const manifest = await getManifest(this.modal, id);
					if (!manifest) {
						new Notice(`Manifest ${id} not found`, 2500);
						return;
					}
					const lastVersion = manifest.version;
					await this.app.plugins.installPlugin(
						pluginItem.repo,
						lastVersion ?? '',
						manifest
					);
					new Notice(`${pluginItem.name} installed`, 2500);
					await this.onOpen();
					// refresh the modal buttons to reflect the new state
					await reOpenModal(this.modal);
				});
		} else {
			// installed but disabled: only show Enable
			if (!isEnabled(this.modal, pluginItem.id)) {
				new ButtonComponent(divButtons)
					.setButtonText('Enable')
					.onClick(async () => {
						await this.modal.app.plugins.enablePluginAndSave(pluginItem.id);
						await this.onOpen();
						this.modal.plugin.installedUpdate();
						new Notice(`${pluginItem.name} enabled`, 2500);
						await reOpenModal(this.modal);
					});
			} else {
				// installed and enabled: show Options if it has a settings tab
				const pluginSettings = this.modal.app.setting.openTabById(pluginItem.id);
				if (pluginSettings) {
					new ButtonComponent(divButtons)
						.setButtonText('Options')
						.onClick(async () => {
							await openPluginSettings(this.modal, pluginItem);
						});
				}

				// show Hotkeys button only if the plugin has registered commands
				const condition = await getHkeyCondition(this.modal, pluginItem);
				if (condition) {
					new ButtonComponent(divButtons)
						.setButtonText('Hotkeys')
						.onClick(async () => {
							await showHotkeysFor(this.modal, pluginItem);
						});
				}
				new ButtonComponent(divButtons)
					.setButtonText('Disable')
					.setDisabled(isQPS)
					.onClick(async () => {
						await this.modal.app.plugins.disablePluginAndSave(pluginItem.id);
						await this.onOpen();
						new Notice(`${pluginItem.name} disabled`, 2500);
						await reOpenModal(this.modal);
					});
			}
			// Uninstall always available for installed plugins (except QPS itself)
			new ButtonComponent(divButtons)
				.setButtonText('Uninstall')
				.setDisabled(isQPS)
				.onClick(async () => {
					try {
						await this.modal.app.plugins.uninstallPlugin(pluginItem.id);
						await this.onOpen();
						new Notice(`${pluginItem.name} uninstalled`, 2500);
						await reOpenModal(this.modal);
					} catch (error: unknown) {
						const message =
							error instanceof Error ? error.message : String(error);
						new Notice(
							`Failed to uninstall ${pluginItem.name}: ${message}`,
							5000
						);
					}
				});
		}

		const shortcuts = contentEl.createDiv({
			cls: 'read-me-shortcuts'
		});

		const notesButtonContainer = shortcuts.createDiv({
			cls: 'notes-button-container'
		});

		new ButtonComponent(notesButtonContainer)
			.setButtonText('📝')
			.onClick(async (e) => {
				await handleNote(e, this.modal, pluginItem, this);
			});

		// color background
		if (pluginItem.hasNote) {
			notesButtonContainer.addClass('notes-button-background');
		}

		if (Platform.isDesktop) {
			shortcuts.createSpan({
				text: ' (t) translate  (n) add note  (g) gitHub repo'
			});
		}

		const div = contentEl.createDiv({ cls: 'qps-read-me' });

		const data = (await getReadMe(pluginItem)) as GitHubFileResponse | null;

		if (!data) {
			return;
		}
		const decoder = new TextDecoder('utf-8');
		// GitHub API returns file content as base64, decode to bytes then to UTF-8 string
		const content = decoder.decode(base64ToUint8Array(data.content));
		const updatedContent = modifyGitHubLinks(content, pluginItem);

		await MarkdownRenderer.render(this.app, updatedContent, div, '/', this.comp);

		this.scope.register([], 't', async () => {
			const selectedContent = getSelectedContent();
			if (!selectedContent) {
				new Notice('no selection', 4000);
				return;
			}
			await translation(this.app, selectedContent);
		});

		this.scope.register(
			[],
			'n',
			async (e) => await handleNote(e, this.modal, pluginItem)
		);
		this.scope.register(
			[],
			'g',
			async (e) => await openGitHubRepo(e, this.modal, pluginItem)
		);
		this.scope.register([], 'escape', async () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.comp.unload();
	}
}

/**
 * Modal to create or edit a markdown note attached to a community plugin.
 * H1 titles are forbidden since they are used as section separators in the shared notes file.
 */
export class SeeNoteModal extends Modal {
	constructor(
		app: App,
		public modal: CPModal,
		public pluginItem: PluginCommInfo,
		public sectionContent: string | null,
		public cb: (result: string | null) => Promise<void>,
		public _this?: ReadMeModal
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl: El } = this;
		El.createEl('h6', {
			text: "Don't include H1 titles. To delete a note delete all content. Saved on close.",
			cls: 'read-me-shortcuts '
		});
		El.createEl('h3', {
			text: this.pluginItem.name + ' by ' + this.pluginItem.author
		});
		new Setting(El).addTextArea((text) => {
			text.setValue(this.sectionContent ?? '');
			text.inputEl.rows = 40;
			text.inputEl.cols = 82;
			// save on blur rather than on a save button, to avoid losing content
			text.inputEl.onblur = async () => {
				this.sectionContent = text.getValue();
				const lines = this.sectionContent.split('\n');
				let stop = false;
				for (const line of lines) {
					// H1 would break the notes file structure, copy to clipboard as fallback
					if (line.startsWith('# ')) {
						new Notice(
							'H1 are not allowed, content was paste in clipboard',
							4000
						);
						navigator.clipboard.writeText(this.sectionContent);
						await this.cb(null);
						stop = true;
						break;
					}
				}
				this.close();
				if (stop) return;
				if (this.sectionContent && !this.sectionContent.endsWith('\n')) {
					this.sectionContent = this.sectionContent + '\n';
				}
				await this.cb(this.sectionContent);
			};
		});
	}
}
