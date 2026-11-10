import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Generates sw.js with a precache list and a version derived from the build contents,
// so every deploy produces a new service worker and the app can detect the update.
function serviceWorker() {
  const walk = (dir, base = '') => readdirSync(dir).flatMap(f => {
    const p = join(dir, f), rel = base ? base + '/' + f : f;
    return statSync(p).isDirectory() ? walk(p, rel) : [rel];
  });
  return {
    name: 'line-slash-sw', apply: 'build', enforce: 'post',
    generateBundle(_, bundle) {
      const hash = createHash('sha1');
      const files = new Set(['./', 'index.html']);
      for (const [name, item] of Object.entries(bundle)) { files.add(name); hash.update(name); hash.update(item.type === 'chunk' ? item.code : item.source); }
      for (const f of walk('public')) { if (f.startsWith('.')) continue; files.add(f); hash.update(f); hash.update(readFileSync(join('public', f))); }
      const version = hash.digest('hex').slice(0, 12);
      const source = readFileSync('src/sw.template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify([...files].map(f => f === './' ? f : './' + f)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
    },
  };
}

export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  plugins: [serviceWorker()],
});
