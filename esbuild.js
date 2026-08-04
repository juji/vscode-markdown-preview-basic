const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['extension.js'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  minify: true,
  plugins: [
    {
      name: 'log-rebuild',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) {
            console.error('[esbuild] build failed:', result.errors[0].text);
          } else {
            console.log(`[esbuild] rebuilt at ${new Date().toLocaleTimeString()}`);
          }
        });
      },
    },
  ],
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('watching for changes...');
  } else {
    await esbuild.build(options);
  }
}

run();
