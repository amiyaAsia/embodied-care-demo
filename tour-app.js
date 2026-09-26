import { CHAPTERS, SUPPORT } from './tour-story.js';
import { createPlayer, readingDuration } from './tour-player.js';
import { mountTourScene } from './tour-scene.js';
const $ = id => document.getElementById(id);
const player = createPlayer(CHAPTERS), scene = mountTourScene($('sceneHost'));
// Desktop controls float at the bottom; on narrow screens they enter the story
// flow and stick above it, rather than covering record excerpts with an overlay.
document.querySelector('.tour-frame').before(document.querySelector('.player-controls'));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let locale = 'en', started = false, readAloud = false, speechActive = false, speechToken = 0, last = performance.now(), dialogKind = null, suspendedReason = '';
let autoplayEligible = true;
const flat = CHAPTERS.flatMap((c, ci) => c.steps.map((s, si) => ({ ...s, ci, si })));
const totalDuration = lang => flat.reduce((sum, s) => sum + readingDuration(s, lang), 0);
const tr = (en, zh) => locale === 'en' ? en : zh;
const text = pair => pair?.[locale] || '';
const name = speaker => locale === 'en' ? speaker : ({ 'Hui Lin':'慧琳', 'Ms Tan':'陈女士', 'Mr Lim':'林先生' }[speaker] || speaker);
const kinds = { narration:['Narrator','旁白'], dialogue:['Conversation','对话'], action:['Care in action','照护行动'], coach:['Reflection · Practice coach','反思 · 练习指导'], record:['Hui Lin’s fictional note','慧琳的虚构记录'], cutaway:['Behind the scenes · Fictional cutaway','幕后 · 虚构片段'], ending:['Back to Hui Lin’s story','回到慧琳的故事'] };
function translate(root=document){root.querySelectorAll('[data-en]').forEach(n=>n.textContent=n.dataset[locale]);}
function node(tag, value, cls=''){const n=document.createElement(tag);n.textContent=value;n.className=cls;return n;}
function cancelSpeech(){speechToken++;speechActive=false;if('speechSynthesis'in window)speechSynthesis.cancel();}
function speakCurrent(){
  if(!readAloud||!player.snapshot().playing||!('speechSynthesis'in window))return;
  cancelSpeech();const step=player.current(),token=speechToken;
  const pieces=[step.speaker?name(step.speaker):tr(...kinds[step.kind]),text(step.text)];
  if(step.action)pieces.push(tr('Physical action.','身体动作。'),text(step.action));
  if(step.record)pieces.push(text(step.record.title),...step.record.fields.flatMap(f=>[text(f.label),text(f.value)]));
  const u=new SpeechSynthesisUtterance(pieces.join(' '));u.lang=locale==='en'?'en-SG':'zh-CN';u.rate=.93;
  const v=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(locale==='en'?'en':'zh'));if(v)u.voice=v;
  speechActive=true;
  u.onend=()=>{if(token===speechToken)speechActive=false;};u.onerror=()=>{if(token===speechToken){speechActive=false;readAloud=false;updateControls();}};
  speechSynthesis.speak(u);
}
function updateControls(){
  const s=player.snapshot();
  $('playButton').textContent=s.ended?tr('↻ Replay the story','↻ 重播故事'):s.playing?tr('Ⅱ Pause','Ⅱ 暂停'):started?tr('▶ Continue story','▶ 继续故事'):tr('▶ Start guided demo','▶ 开始导览演示');
  $('playButton').setAttribute('aria-pressed',String(s.playing));
  $('readButton').textContent=readAloud?tr('Read aloud: on','朗读：开'):tr('Read aloud: off','朗读：关');$('readButton').setAttribute('aria-pressed',String(readAloud));
  $('english').setAttribute('aria-pressed',String(locale==='en'));$('chinese').setAttribute('aria-pressed',String(locale==='zh'));
  $('readingState').textContent=s.ended?'':s.playing?tr('The story continues automatically. Pause whenever you need.','故事会自动继续，您可随时暂停阅读。'):tr('Paused here. Continue when you are ready.','已停留在此，准备好后继续。');
  $('playbackNotice').textContent=s.ended?tr('End of the fictional story. No real clearance or notification has occurred.','虚构故事已结束，未产生真实工作准入或通知。'):suspendedReason==='hidden'?tr('Paused because this tab became inactive. Continue when you return.','页面转入后台，已自动暂停。返回后可继续。'):suspendedReason==='language'?tr('Language changed at the same reading position. Press Continue when ready.','已在相同阅读位置切换语言，准备好后点击继续。'):reduced.matches&&!started?tr('Reduced motion is enabled. Select Start guided demo for captioned playback with still scene changes.','已开启减少动态。点击开始可播放字幕与静态分镜。'):tr('Sound is off by default. Read aloud plays one caption at a time; it is not a conversation.','默认无声。朗读逐条播放字幕，不是语音对话。');
  document.body.dataset.playing=String(s.playing);document.body.dataset.chapter=String(s.chapter+1);document.body.dataset.step=player.current().id;document.body.dataset.ended=String(s.ended);
}
function progress(){
  const s=player.snapshot();let elapsed=0;for(const x of flat){if(x.ci===s.chapter&&x.si===s.step){elapsed+=s.ended?readingDuration(x,locale):s.elapsed;break;}elapsed+=readingDuration(x,locale);}
  $('storyProgress').value=elapsed/totalDuration(locale)*100;$('stepCount').textContent=tr(`${s.chapter+1} of 8`,`${s.chapter+1} / 8`);
}
function renderStep(immediate=false){
  const s=player.snapshot(),chapter=CHAPTERS[s.chapter],step=player.current();
  document.documentElement.lang=locale==='en'?'en-SG':'zh-CN';translate();scene.setLocale(locale);
  $('chapterIndex').textContent=tr(`CHAPTER ${s.chapter+1} OF 8`,`第 ${s.chapter+1} 章 / 共 8 章`);$('chapterTitle').textContent=text(chapter.title);$('storyFocus').textContent=text(chapter.focus);
  $('captionPanel').dataset.kind=step.kind;$('captionType').textContent=step.cutaway?({manager:tr('Behind the scenes · Centre manager','幕后 · 中心经理'),reviewer:tr('Behind the scenes · Nominated reviewer','幕后 · 指定审核者'),workplace:tr('After the shift · Fictional workplace record','班后 · 虚构工作记录')}[step.cutaway]):tr(...kinds[step.kind]);
  $('speaker').hidden=!step.speaker;$('speaker').textContent=step.speaker?name(step.speaker):'';$('caption').textContent=text(step.text);
  $('actionPanel').hidden=!step.action;$('physicalAction').textContent=text(step.action);
  $('sceneHost').hidden=!!step.record;$('recordStage').hidden=!step.record;
  if(step.record){$('recordLabel').textContent=step.cutaway?tr('Fictional example · Not a live account or approval','虚构示例 · 非实时账户或真实审批'):text(step.record.label);$('recordTitle').textContent=text(step.record.title);$('recordFields').replaceChildren();for(const f of step.record.fields){const d=node('div','','record-field');d.append(node('dt',text(f.label)),node('dd',text(f.value)));$('recordFields').append(d);}}
  $('stageContext').textContent=step.cutaway?tr('Observer cutaway · Returning to Hui Lin’s story next.','旁观视角的幕后片段 · 随后回到慧琳的故事。'):step.record?tr('Hui Lin records the agreed next step in this fictional encounter.','慧琳在本次虚构情境中记录约定的下一步。'):tr(`Hui Lin and ${step.view.senior==='tan'?'Ms Tan':'Mr Lim'} · Shared lounge${step.view.tv?' · Television on':''}`,`慧琳与${step.view.senior==='tan'?'陈女士':'林先生'} · 公共休息厅${step.view.tv?' · 电视开着':''}`);
  scene.setView(step.view,{immediate,reducedMotion:reduced.matches});
  $('endingCard').hidden=!s.ended;document.body.classList.toggle('story-ended',s.ended);updateControls();progress();
  if(!immediate&&s.playing&&window.innerWidth<=820){document.querySelector('.tour-frame').scrollIntoView({block:'start',behavior:'instant'});}
}
function pause(reason=''){autoplayEligible=false;player.pause();suspendedReason=reason;cancelSpeech();last=performance.now();updateControls();}
function play(){if(document.hidden||$('infoDialog').open)return;if(player.snapshot().ended){player.restart();renderStep(true);}started=true;suspendedReason='';player.play();last=performance.now();updateControls();if(readAloud)speakCurrent();}
function restart(){autoplayEligible=false;cancelSpeech();player.restart();started=false;suspendedReason='';renderStep(true);last=performance.now();}
function selectChapter(i){pause();player.select(i);renderStep(true);$('infoDialog').close();dialogKind=null;$('playButton').focus({preventScroll:true});}
function showInfo(kind){
  pause();dialogKind=kind;const titles={chapters:tr('Choose a chapter','选择章节'),carePlan:tr('Fictional care plan · CP-M02','虚构照护计划 · CP-M02'),sources:tr('Sources & authored adaptation','参考来源与原创改编'),about:tr('About the proposed service','关于拟议服务')};$('dialogTitle').textContent=titles[kind];$('dialogBody').replaceChildren();
  if(kind==='chapters'){const list=node('div','','chapter-list');for(const [i,c]of CHAPTERS.entries()){const b=node('button','');b.append(node('span',String(i+1).padStart(2,'0')),node('strong',text(c.title)));b.setAttribute('aria-current',String(i===player.snapshot().chapter));b.addEventListener('click',()=>selectChapter(i));list.append(b);}$('dialogBody').append(list,node('p',tr('Choosing a chapter pauses at its beginning. Select Continue to watch.','选择章节后会停在章节开头，点击继续即可观看。')));}
  else if(kind==='sources'){const list=node('ul','');for(const r of SUPPORT.references){const li=node('li','');const a=node('a',text(r.title));a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);}$('dialogBody').append(node('p',text(SUPPORT.adaptation)),list);}
  else {const value=text(kind==='carePlan'?SUPPORT.carePlan:SUPPORT.about);for(const paragraph of value.split(/\n\n/))$('dialogBody').append(node('p',paragraph));}
  if(!$('infoDialog').open)$('infoDialog').showModal();
}
function switchLanguage(next){if(next===locale)return;const old=readingDuration(player.current(),locale);pause('language');locale=next;player.preserveReadingPosition(old,readingDuration(player.current(),locale));renderStep(true);if(dialogKind)showInfo(dialogKind);}
function tick(now){const dt=now-last;last=now;if(player.snapshot().playing&&!document.hidden){if(dt>=0&&dt<=250)scene.tick(dt);const changed=player.advance(dt,readingDuration(player.current(),locale),speechActive);if(changed){cancelSpeech();renderStep(false);if(player.snapshot().playing)speakCurrent();}progress();}requestAnimationFrame(tick);}
$('playButton').addEventListener('click',()=>player.snapshot().playing?pause():play());$('restartButton').addEventListener('click',restart);$('replayButton').addEventListener('click',()=>{restart();play();});
$('chaptersButton').addEventListener('click',()=>showInfo('chapters'));$('endingChapters').addEventListener('click',()=>showInfo('chapters'));$('carePlanButton').addEventListener('click',()=>showInfo('carePlan'));$('sourcesButton').addEventListener('click',()=>showInfo('sources'));$('aboutButton').addEventListener('click',()=>showInfo('about'));
$('closeDialog').addEventListener('click',()=>{$('infoDialog').close();dialogKind=null;updateControls();});$('infoDialog').addEventListener('close',()=>{dialogKind=null;updateControls();});
$('english').addEventListener('click',()=>switchLanguage('en'));$('chinese').addEventListener('click',()=>switchLanguage('zh'));
$('readButton').addEventListener('click',()=>{if(!('speechSynthesis'in window)){$('playbackNotice').textContent=tr('Read aloud is unavailable. All story content is captioned.','无法使用朗读，全部故事内容均有字幕。');return;}readAloud=!readAloud;if(!readAloud)cancelSpeech();else if(player.snapshot().playing)speakCurrent();updateControls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&player.snapshot().playing)pause('hidden');});window.addEventListener('pagehide',()=>pause('hidden'));
reduced.addEventListener('change',()=>{pause();renderStep(true);});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!$('infoDialog').open&&!/BUTTON|A|INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();player.snapshot().playing?pause():play();}});
renderStep(true);requestAnimationFrame(tick);
// Muted autoplay only; explicit start remains available for reduced-motion or inactive tabs.
setTimeout(()=>{if(autoplayEligible&&!started&&!reduced.matches&&!document.hidden&&!$('infoDialog').open&&!suspendedReason)play();},1500);
