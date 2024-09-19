import * as fs from 'fs/promises';
import path from 'path';
import * as readline from 'readline';

export function askQuestion(question: string, rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => rl.question(question, (input) => resolve(input.trim())));
}

export function cleanInput(inputStr: string): string {
    return inputStr.trim().replace(/["`]/g, "'").replace(/\r\n/g, '\n');
}

export async function isValidPath(path: string): Promise<boolean> {
    try {
        await fs.access(path.trim());
        return true;
    } catch {
        return false;
    }
}

export async function copyFilesToTargetDir(vaultDir: string, scss: boolean, manifestId: string, real = "0"): Promise<void> {
    if (real === "-1") return;

    const outdir = `${vaultDir}/.obsidian/plugins/${manifestId}`;
    const man = `${outdir}/manifest.json`;
    const css = `${outdir}/styles.css`;

    try {
        await fs.mkdir(outdir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }

    try {
        
        await fs.copyFile("./manifest.json", man);
        if (!scss) {
            await fs.copyFile("./styles.css", css);
        }
        console.info(`\nSaved plugin to ${outdir}\n`);
    } catch (error) {
        console.error(`Error saving plugin: ${error}`);
    }
}

export async function removeMainCss(outdir: string): Promise<void> {
    const mainCssPath = path.join(outdir, 'main.css');
    try {
        await fs.unlink(mainCssPath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Error removing main.css: ${error}`);
        }
    }
}

