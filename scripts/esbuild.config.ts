import esbuild from 'esbuild';
import process from 'process';
import { config } from 'dotenv';
import path from 'path';
import { rm } from 'fs/promises';
import { type Interface } from 'readline';
import { obsidianTypingsPlugin } from './typingsPlugin.ts';
import { EXTERNAL_DEPS, BANNER } from './constants.ts';
import {
  type Manifest,
  checkManifest,
  validateEnvironment,
  getBuildPath
} from './env.ts';
import {
  copyFilesToTargetDir,
  createReadlineInterface,
  isValidPath,
  renameMainCss
} from './utils.ts';
import { reloadObsidian } from './reload.ts';

// Determine the plugin directory (where the script is called from)
const pluginDir = process.cwd();

// Create readline interface for prompts
const rl: Interface = createReadlineInterface();

const manifest: Manifest = await checkManifest(pluginDir);

config();

async function createBuildContext(
  buildPath: string,
  isProd: boolean,
  entryPoints: string[],
  hasSass: boolean
): Promise<esbuild.BuildContext> {
  const plugins = [
    // Add SASS plugin if SCSS files are detected
    ...(hasSass
      ? [
          await (async () => {
            try {
              // @ts-expect-error - esbuild-sass-plugin is installed during injection
              const { sassPlugin } = await import('esbuild-sass-plugin');
              return sassPlugin({
                syntax: 'scss',
                style: 'expanded'
              });
            } catch (error) {
              console.warn(
                '⚠️  esbuild-sass-plugin not found. Install it with: yarn add -D esbuild-sass-plugin'
              );
              throw error;
            }
          })(),
          {
            name: 'rename-main-css',
            setup(build: esbuild.PluginBuild): void {
              build.onEnd(async (result) => {
                if (result.errors.length === 0) {
                  await renameMainCss(buildPath);
                }
              });
            }
          }
        ]
      : []),
    {
      name: 'copy-to-plugins-folder',
      setup: (build: esbuild.PluginBuild): void => {
        build.onEnd(async () => {
          // if real or build
          if (isProd) {
            if (process.argv.includes('-r') || process.argv.includes('real')) {
              await copyFilesToTargetDir(buildPath);
              console.log(`Successfully installed in ${buildPath}`);
              await reloadObsidian();
            } else {
              const folderToRemove = path.join(buildPath, '_.._');
              if (await isValidPath(folderToRemove)) {
                await rm(folderToRemove, { recursive: true });
              }
              console.log('Build done in initial folder');
            }
          }
          // if watch (dev)
          else {
            await copyFilesToTargetDir(buildPath);
          }
        });
      }
    }
  ];

  return await esbuild.context({
    banner: { js: BANNER },
    minify: isProd,
    entryPoints,
    bundle: true,
    external: EXTERNAL_DEPS,
    format: 'cjs',
    target: 'esNext',
    platform: 'node',
    logLevel: 'info',
    sourcemap: isProd ? false : 'inline',
    treeShaking: true,
    outdir: buildPath,
    outbase: path.join(pluginDir, 'src'),
    plugins: [obsidianTypingsPlugin(pluginDir), ...plugins]
  });
}

async function main(): Promise<void> {
  try {
    await validateEnvironment(pluginDir);
    const isProd = process.argv[2] === 'production';
    const buildPath = await getBuildPath(pluginDir, manifest, isProd, rl);
    console.log(
      buildPath === pluginDir ? 'Building in initial folder' : `Building in ${buildPath}`
    );

    // Check for SCSS first, then CSS in src, then in root
    const srcStylesScssPath = path.join(pluginDir, 'src/styles.scss');
    const srcStylesPath = path.join(pluginDir, 'src/styles.css');
    const rootStylesPath = path.join(pluginDir, 'styles.css');

    const scssExists = await isValidPath(srcStylesScssPath);
    const stylePath = scssExists
      ? srcStylesScssPath
      : (await isValidPath(srcStylesPath))
        ? srcStylesPath
        : (await isValidPath(rootStylesPath))
          ? rootStylesPath
          : '';

    const mainTsPath = path.join(pluginDir, 'src/main.ts');
    const entryPoints = stylePath ? [mainTsPath, stylePath] : [mainTsPath];
    const context = await createBuildContext(buildPath, isProd, entryPoints, scssExists);

    if (isProd) {
      await context.rebuild();
      rl.close();
      process.exit(0);
    } else {
      await context.watch();
    }
  } catch (error) {
    console.error('Build failed:', error);
    rl.close();
    process.exit(1);
  }
}

main().catch(console.error);
