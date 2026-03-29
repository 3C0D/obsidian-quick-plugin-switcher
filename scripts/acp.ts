import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  askQuestion,
  cleanInput,
  createReadlineInterface,
  gitExec,
  ensureGitSync
} from "./utils.js";

const rl = createReadlineInterface();

// Check if we're in the centralized config repo
function isInCentralizedRepo(): boolean {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) return false;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return packageJson.name === "obsidian-plugin-config";
}

async function main(): Promise<void> {
  try {
    if (process.argv.includes("-b")) {
      console.log("Building...");
      gitExec("yarn build");
      console.log("Build successful.");
    }

    // Only update exports if we're in the centralized repo and not explicitly disabled
    if (!process.argv.includes("-ne") && !process.argv.includes("--no-exports") && isInCentralizedRepo()) {
      console.log("Updating exports...");
      gitExec("yarn run update-exports");
      console.log("Exports updated.");
    }

    const input: string = await askQuestion("Enter commit message: ", rl);

    const cleanedInput = cleanInput(input);

    try {
      gitExec("git add -A");
      gitExec(`git commit -m "${cleanedInput}"`);
    } catch {
      console.log("Commit already exists or failed.");
      return;
    }

    // get current branch name
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();

    // Ensure Git is synchronized before pushing
    await ensureGitSync();

    try {
      gitExec(`git push origin ${currentBranch}`);
      console.log("Commit and push successful.");
    } catch {
      // new branch
      console.log(`New branch detected. Setting upstream for ${currentBranch}...`);
      gitExec(`git push --set-upstream origin ${currentBranch}`);
      console.log("Upstream branch set and push successful.");
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  } finally {
    rl.close();
  }
}

main().catch(console.error).finally(() => {
  console.log("Exiting...");
  process.exit();
});