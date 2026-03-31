# Bug fixes to apply

## 1. `translate.ts` — `this` implicite dans les fonctions standalone

`canTranslate`, `translate` et `translation` utilisent `this.plugin` / `this.app` mais sont des fonctions standalone : `this` sera `undefined` à l'exécution.

Fix : passer `app` et éventuellement `plugin` en paramètre explicite.

```ts
// Remplace
function canTranslate(): boolean {
    return this.plugin.translator && this.plugin.translator.valid;
}

async function translate(text: string, from: string): Promise<unknown> {
    const plugin = this.app.plugins.plugins.translate;
    ...
}

export async function translation(selectedContent: string): Promise<void> {
    ...
    new TranslateModal(this.app, translation).open();
}

// Par
function canTranslate(app: App): boolean {
    const plugin = app.plugins.plugins.translate;
    return plugin?.translator?.valid ?? false;
}

async function translate(app: App, text: string, from: string): Promise<unknown> {
    const plugin = app.plugins.plugins.translate;
    if (!plugin) {
        new Notice('install obsidian-translate and select a translator');
        return;
    }
    if (!canTranslate(app)) {
        new Notice('translator not valid. check your settings', 4000);
        return;
    }
    ...
}

export async function translation(app: App, selectedContent: string): Promise<void> {
    ...
    const translated = await translate(app, selectedContent, 'en');
    ...
    new TranslateModal(app, translation).open();
}
```

Tous les call sites de `translation(selectedContent)` doivent devenir `translation(this.app, selectedContent)`.

---

## 2. `translate.ts` — `!canTranslate` au lieu de `!canTranslate()`

```ts
// Remplace
if (!canTranslate) {

// Par
if (!canTranslate(app)) {
```

---

## 3. `secondary_modals.ts` — `confirm` utilise `this.app`

Même problème que ci-dessus : fonction standalone avec `this` implicite.

```ts
// Remplace
export async function confirm(message: string, width?: number, height?: number): Promise<boolean> {
    return await openConfirmModal(this.app, message, width ?? undefined, height ?? undefined);
}

// Par
export async function confirm(app: App, message: string, width?: number, height?: number): Promise<boolean> {
    return await openConfirmModal(app, message, width ?? undefined, height ?? undefined);
}
```

Mettre à jour tous les call sites : `confirm('message', 250)` → `confirm(this.app, 'message', 250)`.

---

## 4. `modal_utils.ts` — `getInstalled` et `showHotkeysFor` utilisent `this`

```ts
// getInstalled — remplace
export function getInstalled(): string[] {
    return Object.keys(this.app.plugins.manifests);
}

// Par (passer app en paramètre)
export function getInstalled(app: App): string[] {
    return Object.keys(app.plugins.manifests);
}

// showHotkeysFor — remplace les occurrences de this.app.setting par modal.app.setting
await this.app.setting.open();
await this.app.setting.openTabById('hotkeys');
const tab = await this.app.setting.activeTab;

// Par
await modal.app.setting.open();
await modal.app.setting.openTabById('hotkeys');
const tab = modal.app.setting.activeTab;
```

---

## 5. `secondary_modals.ts` — listeners accumulés dans `ReadMeModal.onOpen`

Les `addEventListener('mousemove', ...)` et `addEventListener('contextmenu', ...)` sont ajoutés à chaque appel de `onOpen` (qui est rappelé après install/enable/disable).

```ts
// Déplace ces deux blocs du bas de onOpen() vers le constructeur :
this.modalEl.addEventListener('mousemove', (event) => {
    this.mousePosition = { x: event.clientX, y: event.clientY };
});

this.modalEl.addEventListener('contextmenu', (event) => { ... });
```

---

## 6. `secondary_modals.ts` — `SeeNoteModal` appelle `this.onClose()` au lieu de `this.close()`

```ts
// Remplace
this.onClose();

// Par
this.close();
```

---

## 7. `modal_utils.ts` — shadowing de `sortByName`

`sortByName` est exportée en haut du fichier ET redéfinie comme `const` locale dans `modeSort`.

```ts
// Dans modeSort, remplace
const sortByName = (a: string, b: string): number =>
    installed[a].name.localeCompare(installed[b].name);

// Par (nom différent pour éviter le shadowing)
const byName = (a: string, b: string): number =>
    installed[a].name.localeCompare(installed[b].name);
```

Et remplace toutes les occurrences de `sortByName` dans `modeSort` par `byName`.

---

## 8. `main.ts` — double `else if` redondant dans `installedUpdate`

```ts
// Remplace
} else if (
    installed[key].delayed ||
    installed[key].target === TargetPlatform.Mobile ||
    installed[key].target === TargetPlatform.Desktop
) {

// Par
} else {
```

La condition est identique à la négation du `if` précédent, donc toujours vraie à ce point.
