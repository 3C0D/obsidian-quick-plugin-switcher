import {
  writeFile,
  stat
} from "fs/promises";
import { execSync } from "child_process";
import dedent from "dedent";
import {
  askConfirmation,
  createReadlineInterface,
  ensureGitSync
} from "./utils.js";

const rl = createReadlineInterface();

const body = ".github/workflows/release-body.md";

async function checkOrCreateFile(filename: string): Promise<void> {
  try {
    await stat(filename);
  } catch {
    console.log(`Creating ${filename} because it doesn't exist. Avoid deleting it.`);
    await writeFile(filename, "");
  }
}

async function createReleaseNotesFile(tagMessage: string, tag: string): Promise<void> {
  await writeFile(body, tagMessage);
  console.log(`Release notes for tag ${tag} have been written to release-body.md`);
}

async function handleExistingTag(tag: string): Promise<boolean> {
  const confirmed = await askConfirmation(`Tag ${tag} already exists. Do you want to replace it?`, rl);

  if (!confirmed) {
    console.log("Operation aborted");
    return false;
  }

  execSync(`git tag -d ${tag}`);
  execSync(`git push origin :refs/tags/${tag}`);
  console.log(`Deleted existing tag ${tag} locally and remotely.`);
  return true;
}

async function createTag(): Promise<void> {
  const currentVersion = process.env.npm_package_version;
  const tag = `${currentVersion}`;

  await checkOrCreateFile(body);
  const exists = execSync("git ls-remote --tags origin").toString().includes(`refs/tags/${tag}`);

  if (exists && !(await handleExistingTag(tag))) {
    rl.close();
    return;
  }
  await doCommit(currentVersion, tag);
}



async function doCommit(currentVersion: string | undefined, tag: string): Promise<void> {
  rl.question(`Enter the commit message for version ${currentVersion}: `, async (message) => {
    doNextSteps(message, tag);
    rl.close();
  });
}

async function doNextSteps(message: string, tag: string): Promise<void> {
  const messages = message.split("\\n");
  const toShow = message.replace(/\\n/g, "\n");
  await createReleaseNotesFile(toShow, tag);
  const tagMessage = messages.map(m => `-m "${m}"`).join(" ");

  try {
    execSync("git add -A");
    execSync("git commit -m \"update tag description\"");

    // Ensure Git is synchronized before pushing
    await ensureGitSync();

    execSync("git push");
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  try {
    execSync(`git tag -a ${tag} ${tagMessage}`);
  } catch {
    execSync(`git tag -d ${tag}`);
    execSync(`git push origin :refs/tags/${tag}`);
    console.log("Fixed");
    execSync(`git tag -a ${tag} ${tagMessage}`);
  }
  // Ensure Git is synchronized before pushing tag
  await ensureGitSync();

  execSync(`git push origin ${tag}`);
  console.log(`Release ${tag} pushed to repo.`);
  console.log(dedent`
        with message:
            ${toShow}
    `);
}

createTag().catch(console.error);