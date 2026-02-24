import cleanPlugin from '@shellicar/build-clean/esbuild';
import versionPlugin from '@shellicar/build-version/esbuild';
import * as esbuild from 'esbuild';
import { glob } from 'glob';

const watch = process.argv.some((x) => x === '--watch');
const minify = !watch;

const plugins = [cleanPlugin({ destructive: true }), versionPlugin({})];

const entryPoints = await glob('./src/entry/*.ts');
const inject = await glob('./inject/*.ts');

const ctx = await esbuild.context({
  bundle: true,
  entryPoints,
  inject,
  entryNames: 'entry/[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  external: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/claude-code', '@azure/functions-core'],
  metafile: true,
  keepNames: true,
  format: 'esm',
  minify,
  outdir: 'dist',
  platform: 'node',
  plugins,
  sourcemap: true,
  splitting: true,
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
