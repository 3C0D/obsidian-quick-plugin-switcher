import { readFile, writeFile } from "fs/promises";
import dedent from "dedent";
import { askQuestion, createReadlineInterface, gitExec, ensureGitSync } from "./utils.js";

// Simple version increment functions to avoid semver compatibility issues
function incrementVersion(version: string, type: 'patch' | 'minor' | 'major'): string {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3) return '';

  switch (type) {
    case 'patch':
      parts[2]++;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
  }

  return parts.join('.');
}

function isValidVersion(version: string): boolean {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

const rl = createReadlineInterface();

async function getTargetVersion(currentVersion: string): Promise<string> {
  const updateType = await askQuestion(dedent`
        Current version: ${currentVersion}
        Kind of update:
            patch(1.0.1) -> type 1 or p
            minor(1.1.0) -> type 2 or min
            major(2.0.0) -> type 3 or maj
            or version number (e.g. 2.0.0)
        Enter choice: `, rl);

  switch (updateType.trim()) {
    case "p":
    case "1":
      return incrementVersion(currentVersion, "patch");
    case "min":
    case "2":
      return incrementVersion(currentVersion, "minor");
    case "maj":
    case "3":
      return incrementVersion(currentVersion, "major");
    default:
      const trimmed = updateType.trim();
      return isValidVersion(trimmed) ? trimmed : "";
  }
}

async function updateJsonFile(filename: string, updateFn: (json: any) => void): Promise<void> {
  try {
    const content = JSON.parse(await readFile(filename, "utf8"));
    updateFn(content);
    await writeFile(filename, JSON.stringify(content, null, "\t"));
  } catch (error) {
    console.error(`Error updating ${filename}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function updateManifestVersions(targetVersion: string): Promise<void> {
  try {
    const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
    const { minAppVersion } = manifest;

    await Promise.all([
      updateJsonFile("manifest.json", json => json.version = targetVersion),
      updateJsonFile("versions.json", json => json[targetVersion] = minAppVersion),
      updateJsonFile("package.json", json => json.version = targetVersion),
      // updateJsonFile("package-lock.json", json => json.version = targetVersion)
    ]);
  } catch (error) {
    console.error("Error updating manifest versions:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function updateVersion(): Promise<void> {
  try {
    const currentVersion = process.env.npm_package_version || "1.0.0";
    const targetVersion = await getTargetVersion(currentVersion);

    if (!targetVersion) {
      console.log("Invalid version");
      return;
    }

    try {
      // Update all files first
      await updateManifestVersions(targetVersion);
      console.log(`Files updated to version ${targetVersion}`);

      // Add files to git
      gitExec("git add manifest.json package.json versions.json");
      gitExec(`git commit -m "Updated to version ${targetVersion}"`);
      console.log("Changes committed");
    } catch (error) {
      console.error("Error during update or commit:", error instanceof Error ? error.message : String(error));
      console.log("Operation failed.");
      return;
    }

    try {
      // Ensure Git is synchronized before pushing
      await ensureGitSync();

      gitExec("git push");
      console.log(`Version successfully updated to ${targetVersion} and pushed.`);
    } catch (pushError) {
      console.error("Failed to push version update:", pushError instanceof Error ? pushError.message : String(pushError));
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  } finally {
    rl.close();
  }
}

updateVersion().catch(console.error).finally(() => {
  console.log("Exiting...");
  process.exit();
});