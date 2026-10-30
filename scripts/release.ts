import { writeFile, stat } from 'fs/promises';
import dedent from 'dedent';
import { join } from 'path';
import {
  askConfirmation,
  askQuestion,
  cleanInput,
  createReadlineInterface,
  gitExec,
  gitOutput,
  ensureGitSync
} from './utils.ts';

const rl = createReadlineInterface();

const body = join('.github', 'workflows', 'release-body.md');

async function checkOrCreateFile(filename: string): Promise<void> {
  try {
    await stat(filename);
  } catch {
    console.log(`Creating ${filename} because it doesn't exist. Avoid deleting it.`);
    await writeFile(filename, '');
  }
}

async function createReleaseNotesFile(tagMessage: string, tag: string): Promise<void> {
  await writeFile(body, tagMessage);
  console.log(`Release notes for tag ${tag} have been written to release-body.md`);
}

async function handleExistingTag(tag: string): Promise<boolean> {
  // Get the existing tag message to show to the user
  let existingMessage = '';
  try {
    existingMessage = gitOutput(`git tag -l -n999 ${tag}`);
  } catch {
    // If we can't get the message, continue anyway
  }

  let prompt = `Tag ${tag} already exists.`;
  if (existingMessage) {
    prompt += `\n\nExisting tag message:\n${existingMessage}\n`;
  }
  prompt += `\nDo you want to replace it?`;

  const confirmed = await askConfirmation(prompt, rl);

  if (!confirmed) {
    console.log('Operation aborted');
    return false;
  }

  gitExec(`git tag -d ${tag}`);
  gitExec(`git push origin :refs/tags/${tag}`);
  console.log(`Deleted existing tag ${tag} locally and remotely.`);
  return true;
}

async function createTag(): Promise<void> {
  const currentVersion = process.env.npm_package_version;
  const tag = `${currentVersion}`;

  await checkOrCreateFile(body);
  const exists = gitOutput('git ls-remote --tags origin').includes(`refs/tags/${tag}`);

  if (exists && !(await handleExistingTag(tag))) {
    rl.close();
    return;
  }
  await doCommit(currentVersion, tag);
}

async function doCommit(currentVersion: string | undefined, tag: string): Promise<void> {
  const raw = await askQuestion(
    `Enter the commit message for version ${currentVersion}: `,
    rl
  );
  rl.close();
  await doNextSteps(cleanInput(raw), tag);
}

async function doNextSteps(message: string, tag: string): Promise<void> {
  const messages = message.split('\\n');
  const toShow = message.replace(/\\n/g, '\n');
  await createReleaseNotesFile(toShow, tag);
  const tagMessage = messages.map((m) => `-m "${m}"`).join(' ');

  try {
    gitExec('git add -A');
    const status = gitOutput('git status --porcelain');
    if (status) {
      gitExec('git commit -m "update tag description"');

      // Ensure Git is synchronized before pushing
      await ensureGitSync();

      gitExec('git push');
    }
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
  try {
    gitExec(`git tag -a ${tag} ${tagMessage}`);
  } catch {
    gitExec(`git tag -d ${tag}`);
    gitExec(`git push origin :refs/tags/${tag}`);
    console.log('Fixed');
    gitExec(`git tag -a ${tag} ${tagMessage}`);
  }
  // Ensure Git is synchronized before pushing tag
  await ensureGitSync();

  gitExec(`git push origin ${tag}`);
  console.log(`Release ${tag} pushed to repo.`);
  console.log(dedent`
        with message:
            ${toShow}
    `);
}

createTag().catch(console.error);
