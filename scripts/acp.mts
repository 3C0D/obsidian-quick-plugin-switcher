import { execSync } from 'child_process';
import { askQuestion, cleanInput, createReadlineInterface, gitExec } from './utils.mts';

const rl = createReadlineInterface();

async function main(): Promise<void> {
    try {
        if (process.argv.includes('-b')) {
            console.log('Building...');
            gitExec('npm run build');
            console.log('Build successful.');
        }

        const input: string = await askQuestion('Enter commit message: ', rl);

        const cleanedInput = cleanInput(input);

        try {
            gitExec('git add .');
            gitExec(`git commit -m "${cleanedInput}"`);
        } catch (commitError) {
            console.log('Commit already exists or failed.');
            return;
        }

        // get current branch name
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

        try {
            gitExec(`git push origin ${currentBranch}`);
            console.log('Commit and push successful.');
        } catch (pushError) {
            // new branch
            console.log(`New branch detected. Setting upstream for ${currentBranch}...`);
            gitExec(`git push --set-upstream origin ${currentBranch}`);
            console.log('Upstream branch set and push successful.');
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
    } finally {
        rl.close();
    }
}

main().catch(console.error).finally(() => {
    console.log('Exiting...');
    process.exit();
});