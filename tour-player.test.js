import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer,readingDuration} from './tour-player.js';
import {CHAPTERS} from './tour-story.js';
test('complete guided loop reaches all eight chapters without input',()=>{
  const p=createPlayer(CHAPTERS),seen=new Set();p.play();
  for(let i=0;i<20000&&!p.snapshot().ended;i++){seen.add(p.snapshot().chapter);p.advance(100,readingDuration(p.current()));}
  assert.equal(seen.size,8);assert.equal(p.snapshot().ended,true);assert.equal(p.snapshot().playing,false);
});
test('pause freezes reading and resume continues same position',()=>{const p=createPlayer(CHAPTERS);p.play();p.advance(100);p.pause();p.advance(100);assert.equal(p.snapshot().elapsed,100);p.play();p.advance(100);assert.equal(p.snapshot().elapsed,200);});
test('large background gaps never skip content',()=>{const p=createPlayer(CHAPTERS);p.play();p.advance(60000);assert.equal(p.snapshot().elapsed,0);});
test('chapter selection pauses and starts its first caption',()=>{const p=createPlayer(CHAPTERS);p.play();p.advance(100);p.select(4);assert.deepEqual(p.snapshot(),{chapter:4,step:0,elapsed:0,playing:false,ended:false});});
test('restart resets all state',()=>{const p=createPlayer(CHAPTERS);p.select(7);p.play();p.advance(100);p.restart();assert.deepEqual(p.snapshot(),{chapter:0,step:0,elapsed:0,playing:false,ended:false});});
test('speech completion gates automatic transition',()=>{const p=createPlayer(CHAPTERS);p.play();p.advance(100,100,true);assert.equal(p.snapshot().step,0);p.advance(0,100,false);assert.equal(p.snapshot().step,1);});
test('language switch preserves reading proportion',()=>{const p=createPlayer(CHAPTERS);p.play();p.advance(100);p.pause();p.preserveReadingPosition(1000,2000);assert.equal(p.snapshot().elapsed,200);assert.equal(p.snapshot().playing,false);});
test('record-heavy excerpts receive adequate reading time in both languages',()=>{const s=CHAPTERS[4].steps[2];for(const lang of ['en','zh'])assert.ok(readingDuration(s,lang)>=23000);});
test('invalid navigation and durations do not mutate playback',()=>{const p=createPlayer(CHAPTERS);assert.throws(()=>p.select(99));p.play();p.advance(NaN);p.advance(-1);assert.equal(p.snapshot().elapsed,0);});
