# Guide de Compatibilité Obsidian Portable

Ce document synthétise les problèmes de compatibilité rencontrés lors du passage d'un plugin Obsidian de la version desktop à la version portable, ainsi que les solutions adoptées.

passer en mode ui mobile "this.app.emulateMobile(true)"

## Problème Principal

La version portable d'Obsidian fonctionne dans un environnement sandboxé qui ne permet pas l'accès direct aux modules Node.js natifs ni aux fichiers hors du vault. Les plugins qui utilisent ces modules génèrent des erreurs dans la console portable.

## Bibliothèques Problématiques

### 1. Module `fs` (File System)
**Fonctions problématiques :**
- `readFileSync()` - Lecture synchrone de fichiers
- `writeFileSync()` - Écriture synchrone de fichiers
- `existsSync()` - Vérification d'existence de fichiers
- `readdirSync()` - Lecture de répertoires

**⚠️ Important :** Ces fonctions ne fonctionnent PAS en portable, même via `window.require('fs')`.

**Solutions :**
```typescript
// ❌ Avant (Node.js - ne marche pas en portable)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
const content = readFileSync(filePath, "utf-8");

// ✅ Après (API Obsidian - fichiers DANS le vault)
const file = app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
    const content = await app.vault.read(file);
}

// ✅ Ou avec adapter (bas niveau, dans le vault uniquement)
const content = await app.vault.adapter.read(relativePath);
await app.vault.adapter.write(relativePath, content);

// ⚠️ Pour fichiers HORS du vault : desktop uniquement
if (Platform.isDesktop) {
    const fs = window.require('fs');
    const content = fs.readFileSync(absolutePath, "utf-8");
}
```

### 2. Module `path`
**Fonctions problématiques :**
- `path.join()` - Concaténation de chemins
- `path.basename()` - Extraction du nom de fichier

**Solutions :**
```typescript
// ❌ Avant (Node.js)
import * as path from "path";
const fullPath = path.join(dir, "file.json");
const fileName = path.basename(fullPath);

// ✅ Après (String manipulation)
const fullPath = dir + "/file.json";
const fileName = fullPath.split(/[/\\]/).pop() || "";
```

### 3. Module `readline`
**Problème :** Interface de ligne de commande Node.js non disponible en portable.

**Solution :** Supprimer ou remplacer par des interfaces Obsidian (modals, notices).

### 4. Import JSON avec Assertions
**Problème :**
```typescript
// ❌ Syntaxe non supportée par Node.js v24+
import manifest from "../manifest.json" assert { type: "json" };
```

**Solution :**
```typescript
// ✅ Import dynamique compatible
const manifestPath = new URL("../manifest.json", import.meta.url);
const manifest = await import(manifestPath.href, { with: { type: "json" } }).then(m => m.default);
```

## API Obsidian Recommandées

### Gestion des Fichiers DANS le Vault
```typescript
// Lire un fichier (avec cache)
const content = await app.vault.cachedRead(file);

// Lire un fichier (sans cache, pour modification)
const content = await app.vault.read(file);

// Créer un fichier
const file = await app.vault.create(path, content);

// Modifier un fichier
await app.vault.modify(file, newContent);

// Supprimer un fichier
await app.vault.delete(file); // ou .trash(file)

// Obtenir un fichier par son chemin
const file = app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
    // C'est un fichier
}
```

### Gestion des Fichiers avec Adapter (bas niveau)
**⚠️ Attention :** `vault.adapter` fonctionne sur desktop ET portable, mais **uniquement pour les fichiers dans le vault**. 

Pour accéder à des fichiers hors du vault (autres vaults, système de fichiers), il existe deux approches :

**Approche 1 : Utiliser `window.require('fs')` (recommandé pour desktop)**
```typescript
if (Platform.isDesktop) {
    const fs = window.require('fs');
    const path = window.require('path');
    
    const content = fs.readFileSync(absolutePath, "utf-8");
    fs.writeFileSync(absolutePath, content);
    const exists = fs.existsSync(absolutePath);
    const files = fs.readdirSync(dirPath);
}
```

**Approche 2 : Utiliser `vault.adapter` avec chemins absolus (peut fonctionner)**
```typescript
// Fonctionne parfois en desktop, mais pas garanti
if (Platform.isDesktop) {
    const fullPath = "/absolute/path/to/file";
    const content = await app.vault.adapter.read(fullPath);
}
```

**Pour les fichiers dans le vault :**
```typescript
// Chemin complet d'un fichier du vault
const fullPath = app.vault.adapter.getFullPath(relativePath);

// Lire un fichier (chemin relatif au vault)
const content = await app.vault.adapter.read(relativePath);

// Écrire un fichier (chemin relatif au vault)
await app.vault.adapter.write(relativePath, content);

// Vérifier l'existence (chemin relatif au vault)
const exists = await app.vault.adapter.exists(relativePath);

// Lister un répertoire (chemin relatif au vault)
const listing = await app.vault.adapter.list(dirPath);
console.log(listing.files, listing.folders);
```

### Détection d'Environnement
```typescript
import { Platform } from "obsidian";

if (Platform.isDesktop) {
    // Fonctionnalités desktop uniquement
    // Accès aux APIs Electron
} else {
    // Version portable/mobile
    // Utiliser uniquement les APIs Obsidian
}
```

## Stratégies de Compatibilité

### 1. Approche Conditionnelle
Maintenir les deux versions avec détection d'environnement :

```typescript
async function savePluginList(data: any[]) {
    if (Platform.isDesktop) {
        // Version desktop : dialogue de fichier système
        const filePath = window.electron.remote.dialog.showSaveDialogSync({
            title: "Save plugins list",
            filters: [{ name: "JSON Files", extensions: ["json"] }],
        });
        if (filePath) {
            await app.vault.adapter.write(filePath, JSON.stringify(data, null, 2));
        }
    } else {
        // Version portable : sauvegarde dans le vault
        const fileName = `plugins-${new Date().toISOString().split('T')[0]}.json`;
        await app.vault.create(fileName, JSON.stringify(data, null, 2));
    }
}
```

### 2. Approche Unifiée
Utiliser uniquement les APIs Obsidian pour une compatibilité totale :

```typescript
// Toujours compatible, fonctionne partout
async function saveToVault(fileName: string, content: string) {
    await app.vault.create(fileName, content);
    new Notice(`${fileName} created in vault`);
}
```

## Fonctionnalités Adaptées

### Import/Export de Fichiers
- **Desktop :** Dialogues système + accès fichiers externes
- **Portable :** Sauvegarde dans le vault + messages informatifs

### Accès aux Autres Vaults
- **Desktop :** Navigation système + lecture de répertoires externes
- **Portable :** Fonctionnalité désactivée avec message explicatif

### Vérification de Plugins de Développement
- **Avant :** Vérification synchrone avec `existsSync()`
- **Après :** Vérification asynchrone avec `app.vault.adapter.stat()` ou heuristiques

## Bonnes Pratiques

1. **Toujours utiliser `Platform.isDesktop`** pour les fonctionnalités spécifiques
2. **Préférer les APIs Obsidian** même en desktop quand possible
3. **Gérer les erreurs** avec try/catch pour les opérations asynchrones
4. **Informer l'utilisateur** quand une fonctionnalité n'est pas disponible
5. **Tester sur les deux environnements** avant publication

## Dépendances à Éviter

Dans `package.json`, éviter ces dépendances en production :
- `fs-extra` - Utiliser `app.vault.adapter` à la place
- `path` - Utiliser la manipulation de strings
- `readline` - Utiliser les modals Obsidian
- Tout module Node.js natif non disponible dans un environnement sandboxé

## Résumé des Corrections Appliquées

### 1. Import JSON (scripts/esbuild.config.mts)
**Problème :** Syntaxe `assert { type: "json" }` non supportée par Node.js v24+

**Solution appliquée :**
```typescript
// Import dynamique compatible
const manifestPath = new URL("../manifest.json", import.meta.url);
const manifest = await import(manifestPath.href, { with: { type: "json" } }).then(m => m.default);
```

### 2. Suppression des imports Node.js dans le code source
**Fichiers modifiés :** `src/modal_components.ts`, `src/community-plugins_modal.ts`

**Imports supprimés :**
- `import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs"`
- `import * as path from "path"`

### 3. Remplacement des fonctions Node.js

#### Pour les fichiers DANS le vault (compatible portable)
```typescript
// Utiliser les APIs Obsidian
const file = app.vault.getAbstractFileByPath(path);
const content = await app.vault.read(file);
await app.vault.create(path, content);
await app.vault.modify(file, newContent);
```

#### Pour les fichiers HORS du vault (desktop uniquement)
```typescript
// Utiliser window.require('fs') avec Platform.isDesktop
if (Platform.isDesktop) {
    const fs = window.require('fs');
    const path = window.require('path');
    
    const content = fs.readFileSync(absolutePath, "utf-8");
    fs.writeFileSync(absolutePath, content);
    const exists = fs.existsSync(absolutePath);
}
```

### 4. Vérifications synchrones dans les callbacks
**Problème :** `menu.addItem()` prend un callback synchrone, impossible d'utiliser `await`

**Solution :** Faire la vérification asynchrone AVANT le callback
```typescript
// Vérifier AVANT d'ajouter l'item au menu
let isDevPlugin = false;
if (Platform.isDesktop) {
    const fs = window.require('fs');
    const path = window.require('path');
    isDevPlugin = fs.existsSync(path.join(filePath, "package.json"));
}

// Puis utiliser le résultat dans le callback
menu.addItem((item) => {
    item.setDisabled(isDevPlugin);
});
```

## Conclusion

La compatibilité portable nécessite de repenser l'architecture du plugin pour utiliser les APIs Obsidian plutôt que les modules Node.js. Cette approche améliore non seulement la compatibilité mais aussi l'intégration avec l'écosystème Obsidian.

### Résumé des Bonnes Pratiques

1. **Fichiers dans le vault** : Utiliser `app.vault.*` (read, create, modify, delete)
2. **Fichiers hors du vault (desktop uniquement)** : Utiliser `window.require('fs')` avec `Platform.isDesktop`
3. **Bas niveau dans le vault** : Utiliser `app.vault.adapter.*` (read, write, exists, list)
4. **Toujours vérifier** : Utiliser `Platform.isDesktop` pour les fonctionnalités desktop uniquement
5. **Informer l'utilisateur** : Afficher des messages clairs quand une fonctionnalité n'est pas disponible en portable