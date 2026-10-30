import { access, mkdir, copyFile, rm, writeFile, rename, readFile } from 'fs/promises';
import path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';

export function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin as NodeJS.ReadableStream,
    output: process.stdout as NodeJS.WritableStream
  });
}

export const askQuestion = async (
  question: string,
  rl: readline.Interface
): Promise<string> => {
  try {
    return await new Promise((resolve) =>
      rl.question(question, (input) => resolve(input.trim()))
    );
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};

/**
 * Ask a yes/no confirmation question with standardized logic
 * Accepts: y, yes, Y, YES, or empty (default to yes)
 * Rejects: n, no, N, NO
 * Invalid input defaults to no for safety
 */
export const askConfirmation = async (
  question: string,
  rl: readline.Interface
): Promise<boolean> => {
  const answer = await askQuestion(`${question} [Y/n]: `, rl);
  const response = answer.toLowerCase();

  // Accept: y, yes, Y, YES, or empty (default to yes)
  // Reject: n, no, N, NO
  const isYes = response === '' || response === 'y' || response === 'yes';
  const isNo = response === 'n' || response === 'no';

  if (isNo) {
    return false;
  } else if (isYes) {
    return true;
  } else {
    console.log('Please answer Y (yes) or n (no). Defaulting to no for safety.');
    return false;
  }
};

export const cleanInput = (inputStr: string): string => {
  if (!inputStr) return '';
  return inputStr.trim().replace(/["`]/g, "'").replace(/\r\n/g, '\n');
};

export const isValidPath = async (pathToCheck: string): Promise<boolean> => {
  if (!pathToCheck) return false;

  try {
    // Using async fs.access is preferred over synchronous existsSync
    // as it doesn't block the main thread/event loop
    await access(pathToCheck.trim());
    return true;
  } catch {
    return false;
  }
};

export async function copyFilesToTargetDir(buildPath: string): Promise<void> {
  const pluginDir = process.cwd();
  const manifestSrc = path.join(pluginDir, 'manifest.json');
  const manifestDest = path.join(buildPath, 'manifest.json');
  const cssDest = path.join(buildPath, 'styles.css');
  const folderToRemove = path.join(buildPath, '_.._');

  try {
    await mkdir(buildPath, { recursive: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error(
        `Error creating directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Copy manifest
  try {
    await copyFile(manifestSrc, manifestDest);
  } catch (error: unknown) {
    console.error(
      `Error copying manifest: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Copy CSS
  try {
    const srcStylesPath = path.join(pluginDir, 'src/styles.css');
    const rootStylesPath = path.join(pluginDir, 'styles.css');

    // First check if CSS exists in src/styles.css
    if (await isValidPath(srcStylesPath)) {
      await copyFile(srcStylesPath, cssDest);
    }
    // Otherwise, check if it exists in the root
    else if (await isValidPath(rootStylesPath)) {
      await copyFile(rootStylesPath, cssDest);
      if (await isValidPath(folderToRemove)) {
        await rm(folderToRemove, { recursive: true });
      }
    } else {
      return;
    }
  } catch (error: unknown) {
    console.error(
      `Error copying CSS: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Execute a shell command.
 * Uses shell spawning for cross-platform compatibility (Windows + Linux).
 * @param pipe - set to true to suppress stdout/stderr output
 */
export function gitExec(command: string, cwd?: string, pipe = false): void {
  try {
    execSync(command, {
      stdio: pipe ? 'pipe' : 'inherit',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      cwd
    });
  } catch (error: unknown) {
    console.error(
      `Error executing '${command}':`,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * Execute a shell command and return its stdout as a trimmed string.
 * Uses shell spawning for cross-platform compatibility (Windows + Linux).
 */
export function gitOutput(command: string, cwd?: string): string {
  const result = execSync(command, {
    encoding: 'utf8',
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    cwd
  });
  return result.trim();
}

/**
 * Ensure Git repository is synchronized with remote before pushing
 */
export async function ensureGitSync(): Promise<void> {
  try {
    console.log('🔄 Checking Git synchronization...');

    // Fetch latest changes from remote
    gitExec('git fetch origin');

    // Check if branch is behind remote
    const status = gitOutput('git status --porcelain -b');

    if (status.includes('behind')) {
      console.log('📥 Branch behind remote. Pulling changes...');
      gitExec('git pull');
      console.log('✅ Successfully pulled remote changes');
    } else {
      console.log('✅ Repository is synchronized with remote');
    }
  } catch (error: unknown) {
    console.error(
      `❌ Git sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * Rename main.css file generated by esbuild when compiling SCSS to styles.css
 * This ensures the compiled CSS is correctly recognized by Obsidian
 */
export async function renameMainCss(outdir: string): Promise<void> {
  const mainCssPath = path.join(outdir, 'main.css');
  const stylesCssPath = path.join(outdir, 'styles.css');
  try {
    if (await isValidPath(mainCssPath)) {
      await rename(mainCssPath, stylesCssPath);
    }
  } catch (error: unknown) {
    console.warn(
      `Warning: Could not rename main.css to styles.css: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/** Returns true if the current path is inside an Obsidian plugins folder */
export function isInPluginsFolder(currentPath: string): boolean {
  return currentPath.includes(path.join('.obsidian', 'plugins'));
}

/** Validates that a path points to an Obsidian vault with a plugins directory */
export async function validateVaultPath(vaultPath: string): Promise<boolean> {
  // Normalize path to handle both forward and backward slashes
  const normalizedPath = path.normalize(vaultPath);
  return (
    (await isValidPath(path.join(normalizedPath, '.obsidian'))) &&
    (await isValidPath(path.join(normalizedPath, '.obsidian', 'plugins')))
  );
}

/** Resolves the full plugin install path from a vault path */
export function getVaultPath(vaultPath: string, pluginId: string): string {
  const pluginsPath = path.join('.obsidian', 'plugins');
  return vaultPath.includes(pluginsPath)
    ? path.join(vaultPath, pluginId)
    : path.join(vaultPath, '.obsidian', 'plugins', pluginId);
}

/** Updates or adds an env key in the .env file */
export async function updateEnvFile(
  envKey: string,
  vaultPath: string,
  envPath: string
): Promise<void> {
  let envContent = '';
  try {
    envContent = await readFile(envPath, 'utf8');
  } catch {
    /* file doesn't exist yet */
  }
  const regex = new RegExp(`^${envKey}=.*$`, 'm');
  const newLine = `${envKey}=${vaultPath}`;
  envContent = regex.test(envContent)
    ? envContent.replace(regex, newLine)
    : envContent + (envContent.endsWith('\n') ? '' : '\n') + newLine + '\n';
  await writeFile(envPath, envContent);
  console.log(`✅ Updated ${envKey} in .env file`);
}

/**
 * Prompt the user for a vault path if it's missing or still a placeholder in the .env file.
 */
export async function promptForVaultPath(
  envKey: string,
  rl: readline.Interface
): Promise<string> {
  const vaultType = envKey === 'REAL_VAULT' ? 'real' : 'test';
  const usage =
    envKey === 'REAL_VAULT'
      ? 'for final plugin installation'
      : 'for development and testing';

  console.log(`❓ ${envKey} path is required ${usage}`);
  const vaultPath = await askQuestion(
    `📝 Enter your ${vaultType} vault path (or Ctrl+C to cancel): `,
    rl
  );

  if (!vaultPath) {
    console.log('❌ No path provided, exiting...');
    process.exit(1);
  }

  return vaultPath;
}

/** Creates a .env file with placeholder paths and API config if it doesn't exist */
export async function ensureEnvFile(envPath: string): Promise<void> {
  if (await isValidPath(envPath)) return;
  const template =
    [
      '# Environment variables for plugin development',
      '#',
      '# Vault paths',
      '# TEST_VAULT: path to your test/development vault (used with yarn dev)',
      '# REAL_VAULT: path to your production vault (used with yarn real)',
      'TEST_VAULT=/path/to/your/test/vault',
      'REAL_VAULT=/path/to/your/real/vault',
      '#',
      '# Obsidian Local REST API (for automatic reload after yarn real)',
      '# 1. Install the "Local REST API" plugin in Obsidian',
      '# 2. Enable "Enable Non-encrypted (HTTP) Server" in plugin settings',
      '# 3. Copy the API Key from plugin settings and paste it below',
      'OBSIDIAN_REST_API_KEY=your_api_key_here'
    ].join('\n') + '\n';
  await writeFile(envPath, template);
  console.log('📄 Created .env with placeholder paths and API configuration');
}
