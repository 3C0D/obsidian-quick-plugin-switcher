import esbuild from 'esbuild';
import path from 'path';

export function obsidianTypingsPlugin(pluginDir: string): esbuild.Plugin {
  return {
    name: 'obsidian-typings-implementations',
    setup(build: esbuild.PluginBuild): void {
      // Bare import: types only, erased at runtime
      build.onResolve({ filter: /^obsidian-typings$/ }, () => ({
        path: 'obsidian-typings',
        namespace: 'empty-module'
      }));
      build.onLoad({ filter: /.*/, namespace: 'empty-module' }, () => ({
        contents: '',
        loader: 'js'
      }));
      // Implementations: redirect to CJS file
      build.onResolve({ filter: /^obsidian-typings\/implementations$/ }, () => ({
        path: path.resolve(
          pluginDir,
          'node_modules/obsidian-typings/dist/cjs/implementations.cjs'
        )
      }));
    }
  };
}
