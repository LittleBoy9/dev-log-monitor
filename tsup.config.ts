import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    auto: 'src/auto/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
  esbuildOptions(options) {
    options.define = {
      'process.env.UI_HTML': JSON.stringify(
        readFileSync('src/ui/index.html', 'utf-8')
      ),
      'process.env.UI_CSS': JSON.stringify(
        readFileSync('src/ui/styles.css', 'utf-8')
      ),
      'process.env.UI_JS': JSON.stringify(
        readFileSync('src/ui/app.js', 'utf-8')
      ),
    };
  },
});
