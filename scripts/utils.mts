import * as readline from 'readline';
import * as fs from 'fs/promises';

export function askQuestion(question: string, rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (input) => {
            resolve(input.trim());
        });
    });
}

export function cleanInput(inputStr: string): string {
    return inputStr.trim().replace(/["`]/g, "'").replace(/\r\n/g, '\n');
}

export async function isValidPath(path: string) {
    try {
        await fs.access(path.trim());
        return true;
    } catch (error) {
        return false;
    }
}

export async function copyFilesToTargetDir(targetDir: string, man: string, css: string) {
    // Create the target directory if it doesn't exist
    await fs.mkdir(targetDir, { recursive: true });
    // Copy manifest.json and styles.css
    await fs.copyFile("./manifest.json", man);
    await fs.copyFile("./styles.css", css);
}