import path from 'path';
import { readFile } from 'fs/promises';
import { type Interface } from 'readline';
import {
  isValidPath,
  isInPluginsFolder,
  getVaultPath,
  updateEnvFile,
  ensureEnvFile,
  promptForVaultPath
} from './utils.ts';
import { config } from 'dotenv';

interface Manifest {
  id: string;
}

export type { Manifest };

export async function checkManifest(pluginDir: string): Promise<Manifest> {
  const manifestPath = path.join(pluginDir, 'manifest.json');

  // Check if manifest exists (for plugin-config itself, it might not exist)
  if (!(await isValidPath(manifestPath))) {
    console.log(
      '⚠️  No manifest.json found - this script is designed for Obsidian plugins'
    );
    console.log("   If you're building plugin-config itself, use 'tsc' instead");
    process.exit(0);
  }

  return JSON.parse(await readFile(manifestPath, 'utf-8'));
}

/**
 * Check that the environment is valid
 * - main.ts exists in src/
 * - manifest.json exists and is valid JSON
 */
export async function validateEnvironment(pluginDir: string): Promise<void> {
  const srcMainPath = path.join(pluginDir, 'src/main.ts');
  if (!(await isValidPath(srcMainPath))) {
    throw new Error('Invalid path for src/main.ts. main.ts must be in the src directory');
  }
}

/**
 * Get the build path based on the environment and user input
 *
 * @Param pluginDir The plugin directory
 * @Param manifest The manifest object
 * @Param _isProd Whether this is a production build (true for 'production' arg, false for 'watch'/'dev')
 * @Param rl The readline interface
 * @return The path to build the plugin to (either the vault plugins folder or the initial folder for in-place development)
 */
export async function getBuildPath(
  pluginDir: string,
  manifest: Manifest,
  isProd: boolean,
  rl: Interface
): Promise<string> {
  // In-place development: already inside a plugins folder
  if (isInPluginsFolder(pluginDir)) {
    console.log('ℹ️  Building in Obsidian plugins folder (in-place development)');
    return pluginDir;
  }

  // External development
  const useRealVault = process.argv.includes('-r') || process.argv.includes('real');

  // Production build without vault copy: build in place, no vault resolution needed
  if (isProd && !useRealVault) {
    return pluginDir;
  }

  const envKey = useRealVault ? 'REAL_VAULT' : 'TEST_VAULT';
  const envPath = path.join(pluginDir, '.env');

  await ensureEnvFile(envPath);
  config(); // reload after potential creation

  const vaultPath = process.env[envKey]?.trim();

  // Prompt if missing or still a placeholder
  if (!vaultPath || vaultPath.startsWith('/path/to/your/')) {
    const newPath = await promptForVaultPath(envKey, rl);
    await updateEnvFile(envKey, newPath, envPath);
    config();
    return getVaultPath(newPath, manifest.id);
  }

  return getVaultPath(vaultPath, manifest.id);
}
