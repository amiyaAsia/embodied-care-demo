import { mkdir, copyFile, rm } from 'node:fs/promises';
const target = new URL('./dist/', import.meta.url);
const assets = ['index.html', 'styles.css', 'practice.css', 'scene.css', 'app.js', 'practice-engine.js', 'learning-loop.js', 'scene.js'];
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const asset of assets) await copyFile(new URL(asset, import.meta.url), new URL(asset, target));
console.log(`Built ${assets.length} browser assets into dist/`);
