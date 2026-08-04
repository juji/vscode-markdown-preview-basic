const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['extension.js'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  minify: true,
}).catch(() => process.exit(1));
