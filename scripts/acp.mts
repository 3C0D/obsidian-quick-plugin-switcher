import { execSync } from 'child_process';
import * as readline from 'readline';
import { askQuestion, cleanInput } from './utils.mts';

const rl = readline.createInterface({
    input: process.stdin as NodeJS.ReadableStream,
    output: process.stdout as NodeJS.WritableStream,
});

(async () => {
    try {
        if (process.argv.includes('-b')) {
            console.log('Building...');
            execSync('npm run build', { stdio: 'inherit' });
            console.log('Build successful.');
        }

        const input: string = await askQuestion('Enter commit message: ', rl);
        rl.close();

        const cleanedInput = cleanInput(input);

        try {
            execSync(`git add .`);
            execSync(`git commit -m "${cleanedInput}"`);
        } catch (commitError) {
            console.log('Commit already exists.');
        }

        // get current branch name
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

        try {
            execSync(`git push origin ${currentBranch}`);
            console.log('Commit and push successful.');
        } catch (pushError) {
            // if push fails, set upstream and try again
            console.log(`Setting upstream branch for ${currentBranch}...`);
            execSync(`git push --set-upstream origin ${currentBranch}`);
            console.log('Upstream branch set and push successful.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        console.log('Exiting...');
        process.exit();
    }
})();