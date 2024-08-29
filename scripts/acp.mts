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
        
        execSync('git add .');
        execSync(`git commit -m "${cleanedInput}"`);
        execSync('git push');
        console.log('Commit and push successful.');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        console.log('Exiting...');
        process.exit();
    }
})();

