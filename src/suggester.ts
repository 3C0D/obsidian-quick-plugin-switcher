import { TFolder, AbstractInputSuggest } from 'obsidian';

/** Autocomplete suggester for vault folder paths, used in the notes folder setting. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	textInputEl: HTMLInputElement;

	protected getSuggestions(query: string): TFolder[] | Promise<TFolder[]> {
		const result: TFolder[] = [];
		query = query.toLocaleLowerCase();
		for (const abstractFile of this.app.vault.getAllLoadedFiles()) {
			if (
				abstractFile instanceof TFolder &&
				abstractFile.path.toLocaleLowerCase().includes(query)
			) {
				result.push(abstractFile);
			}
		}
		return result;
	}

	renderSuggestion(value: TFolder, el: HTMLElement): void {
		el.createEl('span', { text: value.path });
	}

	selectSuggestion(value: TFolder): void {
		this.textInputEl.value = value.path;
		this.textInputEl.trigger('input');
		this.close();
	}
}
