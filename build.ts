import cleanPlugin from '@shellicar/build-clean/esbuild';
import versionPlugin from '@shellicar/build-version/esbuild';
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import { builtinModules } from 'node:module';
const watch = process.argv.some((x) => x === '--watch');
const minify = !watch;

const plugins = [
  cleanPlugin({ destructive: true }),
  versionPlugin({}),
];

const entryPoints = await glob('./src/main.ts');
const inject = await glob('./inject/*.ts');

const ctx = await esbuild.context({
  bundle: true,
  entryPoints,
  inject,
  chunkNames: 'chunks/[name]-[hash]',
  entryNames: '[name]',
  packages: 'external',
  keepNames: true,
  format: 'esm',
  minify,
  outdir: 'dist',
  platform: 'node',
  plugins,
  sourcemap: true,
  target: 'node22',
  treeShaking: true,
  tsconfig: 'tsconfig.json',
});

if (watch) {
  await ctx.watch();
  console.log('watching...');
} else {
  await ctx.rebuild();
  ctx.dispose();
}
