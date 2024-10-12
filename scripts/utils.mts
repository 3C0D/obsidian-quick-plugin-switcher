import * as fs from 'fs/promises';
import path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';

export function createReadlineInterface(): readline.Interface {
    return readline.createInterface({
        input: process.stdin as NodeJS.ReadableStream,
        output: process.stdout as NodeJS.WritableStream,
    });
}

export const askQuestion = async (question: string, rl: readline.Interface): Promise<string> => {
    try {
        return await new Promise(resolve => rl.question(question, input => resolve(input.trim())));
    } catch (error) {
        console.error('Error asking question:', error);
        throw error;
    }
};

export const cleanInput = (inputStr: string): string => {
    if (!inputStr) return '';
    return inputStr.trim().replace(/["`]/g, "'").replace(/\r\n/g, '\n');
};

export const isValidPath = async (pathToCheck: string): Promise<boolean> => {
    if (!pathToCheck) return false;
    
    try {
        await fs.access(pathToCheck.trim());
        return true;
    } catch {
        return false;
    }
};

export async function copyFilesToTargetDir(outDir: string, manifestId: string): Promise<void> {
    const manifestDest = path.join(outDir, 'manifest.json');

    try {
        await fs.mkdir(outDir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(`Error creating directory: ${error.message}`);
            return;
        }
    }

    try {
        await fs.copyFile('./manifest.json', manifestDest);
    } catch (error) {
        console.error(`Error copying manifest: ${error.message}`);
    }
}

export const removeMainCss = async (outdir: string): Promise<void> => {
    const mainCssPath = path.join(outdir, 'main.css');
    await fs.unlink(mainCssPath).catch(error => {
        if (error.code !== 'ENOENT') {
            console.error(`Error removing main.css: ${error}`);
        }
    });
};

export const copyFile = async (source: string, destination: string, message = ""): Promise<void> => {
    try {
        await fs.copyFile(source, destination);
        console.log(message || 'File was copied successfully.');
    } catch (err) {
        console.error('Error copying file:', err);
    }
};

export function gitExec(command: string): void {
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Error executing '${command}':`, error.message);
        throw error;
    }
}