const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
}).then(ctx => {
  if (watch) {
    ctx.watch().then(() => console.log('Watching for changes...'));
  } else {
    ctx.rebuild().then(() => {
      ctx.dispose();
      console.log('Build complete.');
    }).catch(err => { console.error(err); process.exit(1); });
  }
}).catch(err => { console.error(err); process.exit(1); });
