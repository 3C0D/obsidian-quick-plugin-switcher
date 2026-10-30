import {
  askQuestion,
  cleanInput,
  createReadlineInterface,
  gitExec,
  gitOutput,
  ensureGitSync
} from './utils.ts';

const rl = createReadlineInterface();

async function main(): Promise<void> {
  try {
    if (process.argv.includes('-b')) {
      console.log('Building...');
      gitExec('yarn build');
      console.log('Build successful.');
    }

    const input: string = await askQuestion('Enter commit message: ', rl);

    const cleanedInput = cleanInput(input);

    try {
      gitExec('git add -A');
      gitExec(`git commit -m "${cleanedInput}"`);
    } catch {
      console.log('Commit already exists or failed.');
      return;
    }

    // get current branch name
    const currentBranch = gitOutput('git rev-parse --abbrev-ref HEAD');

    // Ensure Git is synchronized before pushing
    await ensureGitSync();

    try {
      gitExec(`git push origin ${currentBranch}`);
      console.log('Commit and push successful.');
    } catch {
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

main()
  .catch(console.error)
  .finally(() => {
    console.log('Exiting...');
    process.exit();
  });
