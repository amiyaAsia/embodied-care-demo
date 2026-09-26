import { mkdir, copyFile, rm } from 'node:fs/promises';
const target = new URL('./dist/', import.meta.url);
const assets = ['index.html', 'tour.css', 'tour-scene.css', 'tour-app.js', 'tour-player.js', 'tour-story.js', 'tour-scene.js'];
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const asset of assets) await copyFile(new URL(asset, import.meta.url), new URL(asset, target));
console.log(`Built ${assets.length} browser assets into dist/`);
