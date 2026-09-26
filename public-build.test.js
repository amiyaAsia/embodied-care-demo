import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdir,readFile} from 'node:fs/promises';
test('controlled static build exposes only the seven guided-story assets',async()=>{
  execFileSync(process.execPath,['build.mjs'],{cwd:new URL('.',import.meta.url)});
  const files=await readdir(new URL('./dist/',import.meta.url));
  assert.deepEqual(files.sort(),['index.html','tour.css','tour-scene.css','tour-app.js','tour-player.js','tour-story.js','tour-scene.js'].sort());
  const html=await readFile(new URL('./dist/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/<textarea|<form|type="range"|roleSelect|messageInput|practice-engine/);
  assert.match(html,/tour-app.js/);assert.match(html,/Amiya Care Practice/);
});
