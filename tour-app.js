import {CHAPTERS,SUPPORT} from './tour-story.js';
import {OVERVIEW,actualTotal} from './overview-story.js';
import {createPlayer,readingDuration} from './tour-player.js';
import {mountTourScene} from './tour-scene.js';
const $=id=>document.getElementById(id);
const overviewPlayer=createPlayer([OVERVIEW]),fullPlayer=createPlayer(CHAPTERS);
let section='overview',locale='en',fullTitle=true,autoplayEligible=true,readAloud=false,speechActive=false,speechToken=0,last=performance.now(),dialogKind=null,suspendedReason='';
const started={overview:false,full:false};
const scene=mountTourScene($('sceneHost')),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const player=()=>section==='overview'?overviewPlayer:fullPlayer;
const tr=(en,zh)=>locale==='en'?en:zh;
const text=p=>p?.[locale]||'';
const flat=CHAPTERS.flatMap((c,ci)=>c.steps.map((s,si)=>({...s,ci,si})));
const duration=s=>section==='overview'?s.duration:readingDuration(s,locale);
const fullDuration=()=>flat.reduce((n,s)=>n+readingDuration(s,locale),0);
const kinds={narration:['Narrator','旁白'],dialogue:['Conversation','对话'],action:['Physical action','身体动作'],coach:['Practice coach','练习指导'],record:['Agreed next step','商定的下一步'],cutaway:['Reviewer cutaway','审核者片段'],ending:['The next step','下一步']};
const who=s=>locale==='en'?s:({'Hui Lin':'慧琳','Ms Tan':'陈女士','Mr Lim':'林先生'}[s]||s);
function translate(root=document){root.querySelectorAll('[data-en]').forEach(n=>n.textContent=n.dataset[locale]);}
function node(tag,value,cls=''){const n=document.createElement(tag);n.textContent=value;n.className=cls;return n;}
function cancelSpeech(){speechToken++;speechActive=false;if('speechSynthesis'in window)speechSynthesis.cancel();}
function speak(){if(!readAloud||!player().snapshot().playing||!('speechSynthesis'in window))return;cancelSpeech();const s=player().current(),token=speechToken;const parts=[s.speaker?who(s.speaker):tr(...kinds[s.kind]),text(s.text)];if(s.action)parts.push(text(s.action));if(s.record)parts.push(text(s.record.title),...s.record.fields.flatMap(f=>[text(f.label),text(f.value)]));const u=new SpeechSynthesisUtterance(parts.join(' '));u.lang=locale==='en'?'en-SG':'zh-CN';u.rate=1;const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith(locale==='en'?'en':'zh'));if(v)u.voice=v;speechActive=true;u.onend=()=>{if(token===speechToken)speechActive=false;};u.onerror=()=>{if(token===speechToken){speechActive=false;readAloud=false;controls();}};speechSynthesis.speak(u);}
function controls(){const p=player(),s=p.snapshot();
 $('overviewTab').setAttribute('aria-pressed',String(section==='overview'));$('walkthroughTab').setAttribute('aria-pressed',String(section==='full'));
 $('english').setAttribute('aria-pressed',String(locale==='en'));$('chinese').setAttribute('aria-pressed',String(locale==='zh'));
 $('playButton').textContent=s.ended?tr('↻ Replay','↻ 重播'):s.playing?tr('Ⅱ Pause','Ⅱ 暂停'):started[section]?tr('▶ Continue','▶ 继续'):section==='overview'?tr('▶ Start overview','▶ 开始概览'):tr('▶ Start full walkthrough','▶ 开始完整导览');
 $('playButton').setAttribute('aria-pressed',String(s.playing));$('readButton').textContent=readAloud?tr('Read aloud: on','朗读：开'):tr('Read aloud: off','朗读：关');$('readButton').setAttribute('aria-pressed',String(readAloud));
 $('readingState').textContent=s.playing?'':s.ended?'':tr('Paused · continue when ready','已暂停 · 准备好后继续');
 $('playbackNotice').textContent=suspendedReason==='hidden'?tr('Paused while this tab was inactive. Continue when ready.','页面转入后台时已暂停，可按需继续。'):suspendedReason==='language'?tr('Language changed at the same point. Continue when ready.','已在同一位置切换语言，可按需继续。'):reduced.matches&&!started[section]?tr('Reduced motion is enabled. Press Start for captioned playback.','已开启减少动态。点击开始播放字幕分镜。'):s.ended&&section==='overview'?tr('Overview complete. The full walkthrough starts only when you choose it.','概览已结束。完整导览只会在您选择后开始。'):'';
 document.body.dataset.section=section;document.body.dataset.step=(section==='full'&&fullTitle)?'full-title':p.current().id;document.body.dataset.playing=String(s.playing);document.body.dataset.ended=String(s.ended);document.body.dataset.chapter=section==='full'?String(s.chapter+1):'';
}
function progress(){const p=player(),s=p.snapshot();let elapsed=0;const steps=section==='overview'?OVERVIEW.steps.map((s,si)=>({...s,ci:0,si})):flat;for(const x of steps){if(x.ci===s.chapter&&x.si===s.step){elapsed+=s.ended?duration(x):s.elapsed;break;}elapsed+=duration(x);}const total=section==='overview'?actualTotal:fullDuration();$('storyProgress').value=elapsed/total*100;$('storyProgress').setAttribute('aria-label',section==='overview'?tr('Overview progress','概览进度'):tr('Full walkthrough progress','完整导览进度'));$('stepCount').textContent=section==='overview'?`${Math.floor(elapsed/1000)} / ${Math.round(actualTotal/1000)} s`:tr(`${s.chapter+1} of 8`,`${s.chapter+1} / 8`);}
function render(immediate=false){const p=player(),s=p.snapshot(),shot=p.current(),overview=section==='overview',title=overview?shot.id==='overview-title':fullTitle,endShot=shot.kind==='ending';
 translate();document.documentElement.lang=locale==='en'?'en-SG':'zh-CN';scene.setLocale(locale);
 $('chapterIndex').textContent=overview?tr('SECTION 1 · THE 1-MINUTE OVERVIEW','第一部分 · 一分钟概览'):tr(`SECTION 2 · FULL WALKTHROUGH · ${s.chapter+1} OF 8`,`第二部分 · 完整导览 · ${s.chapter+1} / 8`);
 $('chapterTitle').textContent=overview?text(OVERVIEW.title):fullTitle?tr('The same story in detail: 8 chapters','同一故事的完整过程：八个章节'):text(CHAPTERS[s.chapter].title);
 $('storyFocus').textContent=overview?tr('One moment. Two responses. Learning that continues at work.','同一时刻，两种回应，延续到工作中的学习。'):fullTitle?tr('Returning encounters, judgement, human review and workplace support.','再次照护、判断、人工审核与工作场所支持。'):text(CHAPTERS[s.chapter].focus);
 $('chaptersButton').hidden=overview;
 const record=title?null:shot.record;
 $('sceneHost').hidden=title||!!record||endShot;
 $('titleStage').hidden=!(title||endShot);$('recordStage').hidden=!record;
 $('titleCardHeading').textContent=endShot?tr('Practice. Review. Support.','练习 · 审核 · 支持'):overview?text(OVERVIEW.title):tr('The same story in detail: 8 chapters','同一故事的完整过程：八个章节');
 $('titleCardSub').textContent=endShot?(overview?tr('Overview complete','概览结束'):tr('Further supervised practice agreed','继续督导下的实践')):overview?tr('Hui Lin × Ms Tan','慧琳 × 陈女士'):tr('The full care-learning journey','完整的照护学习旅程');
 $('captionPanel').dataset.kind=shot.kind;
 $('captionType').textContent=title?tr('Handover','交接信息'):shot.id==='overview-insist'||shot.id==='overview-harder-refusal'?tr('Illustrative replay · Insisting','对比回放 · 催促'):shot.rewind?tr('Rewind · Same moment','倒回 · 同一时刻'):shot.id.startsWith('overview-')&&['overview-hello','overview-programme','overview-ask-return','overview-agreement'].includes(shot.id)?tr('Illustrative replay · Asking','对比回放 · 询问'):shot.cutaway?({manager:tr('Centre manager · Cutaway','中心经理 · 幕后片段'),reviewer:tr('Nominated reviewer · Cutaway','指定审核者 · 幕后片段'),workplace:tr('After the shift · Record','班后 · 记录')}[shot.cutaway]):tr(...kinds[shot.kind]);
 $('speaker').hidden=!shot.speaker||title;$('speaker').textContent=shot.speaker?who(shot.speaker):'';
 $('caption').textContent=section==='full'&&fullTitle?tr('Follow Hui Lin through the complete care-practice story, including the unfamiliar check and later supervised follow-up.','跟随慧琳观看完整的照护学习故事，包括陌生情境检查与之后的督导跟进。'):text(shot.text);
 $('actionPanel').hidden=!shot.action||title;$('physicalAction').textContent=text(shot.action);
 if(record){$('recordLabel').textContent=tr('Example record','示例记录');$('recordTitle').textContent=text(record.title);$('recordFields').replaceChildren();for(const f of record.fields){const d=node('div','','record-field');d.append(node('dt',text(f.label)),node('dd',text(f.value)));$('recordFields').append(d);}}
 $('rewindOverlay').hidden=!shot.rewind;
 $('stageContext').textContent=title?tr('Amiya Care Practice','Amiya Care Practice'):endShot?tr('Continue learning with people','在人的支持下继续学习'):shot.cutaway?tr('A reasoned decision · A named next step','有理由的决定 · 明确的下一步'):tr(`Hui Lin and ${shot.view.senior==='tan'?'Ms Tan':'Mr Lim'} · Shared lounge`,`慧琳与${shot.view.senior==='tan'?'陈女士':'林先生'} · 公共休息厅`);
 const opening=overview&&s.step===0&&s.elapsed===0&&!s.playing&&OVERVIEW.opening;scene.setView(opening||shot.view,{immediate:immediate||!!shot.rewind,reducedMotion:reduced.matches});
 $('endingCard').hidden=!s.ended;document.body.classList.toggle('story-ended',s.ended);document.body.classList.toggle('overview-mode',overview);document.body.classList.toggle('title-shot',title);document.body.classList.toggle('rewind-shot',!!shot.rewind);
 $('endingHeading').textContent=overview?tr('Overview finished. See the same story in detail.','概览已结束，继续了解完整故事。'):tr('Workplace support continues.','工作场所的支持仍将继续。');$('endingSub').textContent=overview?tr('The longer walkthrough adds the returning encounter, unfamiliar check and supervised follow-up.','完整导览呈现再次照护、陌生检查与督导跟进的更多细节。'):tr('Hui Lin and her reviewer agree on further supervised practice.','慧琳与审核者同意继续督导下的练习。');
 $('fullWalkthroughButton').hidden=!overview;$('endingChapters').hidden=overview;$('replayButton').textContent=overview?tr('↻ Replay the overview','↻ 重播概览'):tr('↻ Replay the full walkthrough','↻ 重播完整导览');
 controls();progress();if(!immediate&&s.playing&&innerWidth<=820)document.querySelector('.tour-frame').scrollIntoView({block:'start',behavior:'instant'});
}
function pause(reason=''){autoplayEligible=false;player().pause();suspendedReason=reason;cancelSpeech();last=performance.now();controls();}
function play(){if(document.hidden||$('infoDialog').open)return;if(player().snapshot().ended){player().restart();if(section==='full')fullTitle=true;render(true);}if(section==='full'&&fullTitle){fullTitle=false;render(true);}started[section]=true;suspendedReason='';player().play();{const s=player().snapshot();if(section==='overview'&&s.step===0&&s.elapsed===0)scene.setView(player().current().view,{reducedMotion:reduced.matches});}last=performance.now();controls();speak();}
function restart(){pause();player().restart();started[section]=false;if(section==='full')fullTitle=true;render(true);}
function switchSection(next){if(section===next)return;pause();section=next;suspendedReason='';render(true);}
function selectChapter(i){pause();section='full';fullTitle=false;fullPlayer.select(i);render(true);$('infoDialog').close();dialogKind=null;$('playButton').focus({preventScroll:true});}
function showInfo(kind){pause();dialogKind=kind;const titles={chapters:tr('Choose a chapter','选择章节'),carePlan:tr('Fictional care plan · CP-M02','虚构照护计划 · CP-M02'),sources:tr('Sources & adaptation','参考与改编'),about:tr('About the proposed service','关于拟议服务')};$('dialogTitle').textContent=titles[kind];$('dialogBody').replaceChildren();
 if(kind==='chapters'){const list=node('div','','chapter-list');for(const [i,c]of CHAPTERS.entries()){const b=node('button','');b.append(node('span',String(i+1).padStart(2,'0')),node('strong',text(c.title)));b.setAttribute('aria-current',String(i===fullPlayer.snapshot().chapter));b.addEventListener('click',()=>selectChapter(i));list.append(b);}$('dialogBody').append(list);}
 else if(kind==='sources'){const list=node('ul','');for(const r of SUPPORT.references){const li=node('li',''),a=node('a',text(r.title));a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);}$('dialogBody').append(node('p',text(SUPPORT.adaptation)),list);}
 else $('dialogBody').append(node('p',text(kind==='carePlan'?SUPPORT.carePlan:SUPPORT.about)));
 if(!$('infoDialog').open)$('infoDialog').showModal();
}
function changeLanguage(next){if(next===locale)return;const old=duration(player().current());pause('language');locale=next;player().preserveReadingPosition(old,duration(player().current()));render(true);if(dialogKind)showInfo(dialogKind);}
function tick(now){const dt=now-last;last=now;if(player().snapshot().playing&&!document.hidden){if(dt>=0&&dt<=250)scene.tick(dt);const changed=player().advance(dt,duration(player().current()),speechActive);if(changed){cancelSpeech();render(false);if(player().snapshot().playing)speak();}progress();}requestAnimationFrame(tick);}
$('playButton').addEventListener('click',()=>player().snapshot().playing?pause():play());$('restartButton').addEventListener('click',restart);$('replayButton').addEventListener('click',()=>{restart();play();});
$('overviewTab').addEventListener('click',()=>switchSection('overview'));$('walkthroughTab').addEventListener('click',()=>switchSection('full'));$('fullWalkthroughButton').addEventListener('click',()=>switchSection('full'));
for(const [id,k]of [['chaptersButton','chapters'],['endingChapters','chapters'],['carePlanButton','carePlan'],['sourcesButton','sources'],['aboutButton','about']])$(id).addEventListener('click',()=>showInfo(k));
$('closeDialog').addEventListener('click',()=>{$('infoDialog').close();dialogKind=null;controls();});$('infoDialog').addEventListener('close',()=>{dialogKind=null;controls();});
$('english').addEventListener('click',()=>changeLanguage('en'));$('chinese').addEventListener('click',()=>changeLanguage('zh'));
$('readButton').addEventListener('click',()=>{if(!('speechSynthesis'in window))return;readAloud=!readAloud;if(!readAloud)cancelSpeech();else speak();controls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&player().snapshot().playing)pause('hidden');});window.addEventListener('pagehide',()=>pause('hidden'));reduced.addEventListener('change',()=>{pause();render(true);});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!$('infoDialog').open&&!/BUTTON|A|INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();player().snapshot().playing?pause():play();}});
render(true);requestAnimationFrame(tick);setTimeout(()=>{if(autoplayEligible&&!started.overview&&!reduced.matches&&!document.hidden&&!$('infoDialog').open)play();},1200);
