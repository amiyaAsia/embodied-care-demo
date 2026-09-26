import { createEncounter, CASES, respond, evaluateServing, completeServing, getSuggestions } from './practice-engine.js';
import { createLearningRecord, archiveEncounter, submitCheck, nominateReviewer, decideReadiness, reportDifficulty, completeFollowup, getStageAccess } from './learning-loop.js';
import { mountScene } from './scene.js';
const $ = id => document.getElementById(id);
const pair = (en, zh) => ({ en, zh });
let locale = 'en', record = createLearningRecord(), state = createEncounter(), stage = 'practice';
let busy = false, demo = false, backup = null, epoch = 0, animation = null, resolveAnimation = null, voice = false, speech = null, speechUntil = 0, dialogKind = null;
const snapshots = {}, extra = [];
const scene = mountScene($('sceneMount'));
let frame = { progress: 0, posture: 0, phase: 'ready', headTurn: .5, brow: .65, handBlock: .7, mouth: 0, accepted: false, portion: 30, food: false };
const names = { practice: pair('Guided practice', '引导练习'), returning: pair('Returning encounter', '再次照护'), check: pair('Unfamiliar check', '陌生情境检查'), review: pair('Human review', '人工审核'), followup: pair('After-shift follow-up', '班后跟进'), refresher: pair('Refresher practice', '复习练习') };
const evidenceNames = { observe: pair('Understood the concern', '理解顾虑'), permission: pair('Asked current permission', '征询当前许可'), plan: pair('Consulted care plan', '核对照护计划'), position: pair('Discussed supported position', '确认支撑姿势'), temperature: pair('Discussed food temperature', '确认食物温度'), choice: pair('Offered a choice', '提供选择'), respect: pair('Respected a pause', '尊重暂停'), escalate: pair('Sought appropriate support', '寻求适当支持'), handover: pair('Documented agreed next step', '记录商定下一步'), check: pair('Checked after assistance', '协助后确认感受') };
const endings = { pause: pair('Pause respected', '尊重暂停'), support: pair('Support arranged in the scenario', '情境内安排支持'), assist: pair('Chosen assistance completed', '完成自愿选择的协助') };
const phases = {ready:pair('Observe and agree', '观察与协商'),position:pair('Position illustration', '姿势调整示意'),scoop:pair('Scoop', '取食'),approach:pair('Approach', '递勺'),wait:pair('Wait for a response', '等待回应'),accept:pair('Voluntary assistance', '自愿接受协助'),withdraw:pair('Withdraw', '撤勺'),swallow:pair('Illustrated wait — not detection', '示意等待 — 并非检测'),rest:pair('Pause', '暂停')};
const t = value => typeof value === 'string' ? value : value?.[locale] || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = v => Math.max(0, Math.min(1, v));
const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
function element(tag, value, cls = '') { const n = document.createElement(tag); n.textContent = t(value); n.className = cls; return n; }
function toast(value) { $('toast').textContent = t(value); $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 4500); }
function translate(root = document) { root.querySelectorAll('[data-en]').forEach(n => n.textContent = n.dataset[locale]); }
function stopSpeech() { speech = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
function say(value, speaker = 'elder') {
  speech = { value, speaker }; speechUntil = performance.now() + 6500;
  if (voice && 'speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t(value)); u.lang = locale === 'en' ? 'en-SG' : 'zh-CN'; u.rate = .9; speechSynthesis.speak(u); }
}
function addExtra(value, role = 'coach') { extra.push({ turn: state.turn, value, role }); renderChat(); }
function bubble(role, value, behavior) {
  if (!t(value)) return;
  if (role === 'coach' || role === 'event') {
    const n = element('div', '', role === 'coach' ? 'coach-message' : 'event-message');
    if (role === 'coach') n.append(element('strong',pair('✦ Practice coach — not a readiness decision', '✦ 练习教练 — 不代表就绪审核')), element('p',value)); else n.textContent = t(value);
    $('chatFeed').append(n); return;
  }
  const n = element('div','',`message ${role}`), body=element('div','','msg-content');
  n.append(element('div',role==='user'?pair('You','你'):pair(CASES[state.kind].name.en.replace(/^Ms /,'').slice(0,1),CASES[state.kind].name.zh.slice(0,1)),'msg-avatar'));
  body.append(element('div',role==='user'?pair('Care worker · original input','护工 · 原始输入'):CASES[state.kind].name,'msg-meta'),element('div',value,'bubble'));
  if (t(behavior)) body.append(element('div',behavior,'behavior'));
  n.append(body); $('chatFeed').append(n);
}
function renderChat() {
  $('chatFeed').replaceChildren();
  bubble('event', names[state.kind]);
  bubble('elder', CASES[state.kind].opening);
  for (const h of state.history) {
    if (h.kind === 'outcome') continue;
    bubble('user', h.userPair || h.user);
    bubble('elder', h.reply, h.behavior);
    if (state.kind !== 'check') bubble('coach', h.feedback);
  }
  for (const e of extra) if (state.kind !== 'check' || e.role === 'event') bubble(e.role,e.value);
  $('chatFeed').scrollTop=$('chatFeed').scrollHeight;
}
function renderPath() {
  const access=getStageAccess(record); $('learningPath').replaceChildren();
  for(const [i,key] of Object.keys(names).entries()) { const b=element('button','',`path-step${stage===key?' active':''}`); b.append(element('span',`0${i+1}`),element('strong',names[key])); b.disabled=!access[key]||busy||demo; b.addEventListener('click',()=>navigate(key)); $('learningPath').append(b); }
}
function render() {
  translate(); document.documentElement.lang=locale==='en'?'en-SG':'zh-CN';
  $('langEn').setAttribute('aria-pressed',String(locale==='en')); $('langZh').setAttribute('aria-pressed',String(locale==='zh'));
  $('messageInput').placeholder=t(pair('Speak to the senior in English or Chinese…','可用英文或中文对长者说话…'));
  $('voiceButton').textContent=t(pair(`Read aloud: ${voice?'on':'off'}`,`朗读：${voice?'开':'关'}`));
  $('voiceButton').setAttribute('aria-pressed',String(voice));
  renderPath();
  const service=stage==='review'||stage==='followup'; $('encounterArea').hidden=service; $('serviceArea').hidden=!service;
  $('resetButton').disabled=service||busy||demo;
  $('loopNotice').textContent=t(pair('Practice evidence is not clearance to work alone. Only a nominated reviewer can record a decision. All reviewer and workplace actions below are local role-play; no person is contacted.', '练习证据不等于可独立上岗。只有指定审核者可记录决定。下方审核与工作场所操作均为本地角色演示，不会联系真人。'));
  if(service){renderService();return;}
  const check=state.kind==='check';
  $('caseName').textContent=t(CASES[state.kind].name); $('caseSummary').textContent=t(CASES[state.kind].brief);
  $('caseAvatar').textContent=locale==='en'?t(CASES[state.kind].name).split(' ').at(-1)[0]:t(CASES[state.kind].name)[0];
  $('turnCount').textContent=t(pair(`Turn ${state.turn}`,`第 ${state.turn} 轮`)); $('encounterMode').textContent=t(names[state.kind]);
  $('suggestionArea').hidden=check; $('checkNotice').hidden=!check; $('coachPanel').hidden=check; $('demoActions').hidden=check; $('positionButton').hidden=check;
  document.querySelector('.action-card').hidden=check;
  document.querySelector('.scene-toggles').querySelectorAll('label').forEach(n=>n.hidden=check);
  document.querySelector('.phase-strip').hidden=check;
  $('historyContext').hidden=state.kind!=='returning'&&state.kind!=='refresher';
  if(state.kind==='returning') { const previous=record.encounters.findLast(e=>e.kind==='practice'); $('historyContext').textContent=t(pair('Previous encounter: ','上次情境：'))+t(endings[previous?.outcome])+t(pair('. Ask again today; earlier permission does not carry over.', '。今天必须重新询问，不继承旧许可。')); }
  if(state.kind==='refresher') $('historyContext').textContent=t(pair('Refresher linked to after-shift difficulty: ','本次复习关联班后困难：'))+(record.difficulties.at(-1)?.text||'');
  $('suggestions').replaceChildren(); for(const p of getSuggestions(state)){const b=element('button',p);b.disabled=busy||demo;b.addEventListener('click',()=>send(t(p),'none',p));$('suggestions').append(b);}
  const last=state.history.findLast(h=>h.kind!=='outcome');
  $('coachTitle').textContent=t(pair('Understand her concern and agree on the next step.', '理解她的顾虑，商定下一步。'));
  $('behaviorText').textContent=t(last?.behavior||pair('Observable: head turned away, lips closed, hand raised.', '可观察行为：转头、闭口、抬手。'));
  $('coachText').textContent=t(last?.feedback||pair('Pausing, seeking support and chosen assistance are equally valid. No failed attempt is required.', '暂停、寻求支持和自愿协助同等有效。不需要先失败一次。'));
  $('skillChecks').replaceChildren(); for(const [k,v]of Object.entries(evidenceNames)) if(state.signals[k]) $('skillChecks').append(element('span',pair(`✓ ${v.en}`,`✓ ${v.zh}`),'skill-check done'));
  $('validEndings').replaceChildren();for(const [k,v]of Object.entries(endings)) $('validEndings').append(element('span',v,`ending${state.outcome===k?' selected':''}`));
  $('outcomeText').textContent=check?t(pair('Submit when you have agreed and documented the next step. No live result is shown.', '商定并记录下一步后提交，不显示即时结果。')):state.outcome?t(endings[state.outcome])+t(pair(' · Practice evidence recorded, not human clearance.', ' · 已记录练习证据，不代表人工准入。')):t(pair('Complete an agreed pathway. Feeding is not required.', '完成商定路径即可，不要求喂食。'));
  $('finishEncounter').textContent=t(check?pair('Submit independent check for review','提交独立检查供审核'):state.kind==='practice'?pair('Save encounter → return next time','保存情境 → 再次照护'):state.kind==='returning'?pair('Save encounter → unfamiliar check','保存情境 → 陌生检查'):pair('Save refresher → workplace follow-up','保存复习 → 工作场所跟进'));
  $('finishEncounter').disabled=busy||demo||(check?!state.history.length:!state.outcome);
  $('demoButton').textContent=t(demo?pair('■ Stop demonstration','■ 停止演示'):pair('▶ Good-practice example (pause is valid)','▶ 正确示例（暂停也可完成）'));
  $('poorButton').disabled=busy||demo;
  for(const id of ['sendButton','practiceButton','positionButton','portion','pace','pause','messageInput','recordButton']) $(id).disabled=busy||demo;
  $('restButton').textContent=t(demo?pair('Stop example','停止示例'):pair('Withdraw / stop','撤勺 / 停止'));
  $('modeChip').textContent=t(demo?pair('Labelled example · not your evidence','标注示例 · 非个人证据'):check?pair('Independent check · no hints','独立检查 · 无提示'):pair('Animated browser scene','浏览器动画场景'));
  $('portionValue').textContent=$('portion').value+'%';$('paceValue').textContent=$('pace').value+' s';$('pauseValue').textContent=$('pause').value+' s';
  scene.setInteractive(!busy&&!demo);renderChat();
}
function cancel(){epoch++;animation=null;if(resolveAnimation){resolveAnimation();resolveAnimation=null;}busy=false;scene.cancelInteraction();frame.progress=0;frame.food=false;frame.accepted=false;frame.mouth=0;frame.phase='ready';stopSpeech();}
function navigate(key){if(busy||demo)return;if(!getStageAccess(record)[key])return; if(!['review','followup'].includes(stage)) snapshots[state.kind]=structuredClone(state); stage=key;extra.length=0; if(!['review','followup'].includes(key)){state=snapshots[key]||createEncounter(key);frame.posture=state.signals.position?1:0;frame.headTurn=.5;frame.handBlock=.7;frame.brow=.6;}render();}
function restart(){cancel();state=createEncounter(state.kind);delete snapshots[state.kind];extra.length=0;frame.posture=0;render();}
function animateJob(job){animation={...job,start:performance.now()};return new Promise(r=>resolveAnimation=r);}
async function send(text, act='none', originalPair=null, internal=false){
  if(!text.trim()||busy||(demo&&!internal))return;
  const token=epoch;busy=true;say(originalPair||text,'trainee');render();await wait(350);if(token!==epoch)return;
  const r=respond(state,{text,action:act});
  if(r.evidence.includes('position')&&frame.posture<.99){await animateJob({kind:'position',from:frame.posture,duration:2.4});if(token!==epoch)return;}
  state=r.state;
  if(originalPair){const h=state.history.findLast(h=>h.kind==='dialogue');if(h)h.userPair=originalPair;}
  frame={...frame,...r.view,posture:state.signals.position?1:frame.posture,phase:'ready',progress:0,food:false,accepted:false};
  busy=false;say(r.reply);render();
}
async function serving(internal=false){
  if(busy||(demo&&!internal))return;
  const token=epoch,r=evaluateServing(state,{});busy=true;render();stopSpeech();
  await animateJob({kind:'serve',accepted:r.view.accepted,pace:+$('pace').value,pause:+$('pause').value,duration:2+(+$('pace').value)+(+$('pause').value)+3,view:r.view});
  if(token!==epoch)return;
  state=completeServing(r.state);const h=state.history.findLast(h=>h.kind==='serving');if(h)h.userPair=pair('Played agreed assistance animation','演示已商定的协助动画');
  frame={...frame,...r.view,phase:'ready',progress:0,food:false,mouth:0,accepted:false};busy=false;say(r.reply);render();
}
async function withdraw(){if(demo){cancel();restoreDemo();return;}const p=frame.progress;cancel();const token=epoch;busy=true;render();await animateJob({kind:'withdraw',from:p,duration:.7});if(token!==epoch)return;busy=false;if(state.kind==='check')await send('Withdraw spoon / 撤勺');else await send(t(pair('We will pause now. I will withdraw the spoon and respect your choice.','我们先暂停，移开勺子，尊重您的选择。')),'pause',pair('We will pause now. I will withdraw the spoon and respect your choice.','我们先暂停，移开勺子，尊重您的选择。'));}
function finishEncounter(){
  try{if(state.kind==='check'){record=submitCheck(record,state);snapshots.check=structuredClone(state);stage='review';}else{record=archiveEncounter(record,state);snapshots[state.kind]=structuredClone(state);const next=state.kind==='practice'?'returning':state.kind==='returning'?'check':'followup';stage=next;if(next!=='followup'){state=createEncounter(next);frame.posture=0;extra.length=0;}}render();}catch(e){toast(errorText(e));}
}
function errorText(e){return pair(`Please complete the required fields or previous step (${e.message}).`,`请完成必填信息或上一步（${e.message}）。`);}
async function example(poor=false){
  if(demo){cancel();restoreDemo();return;}if(busy)return;
  backup={state:structuredClone(state),stage,extra:structuredClone(extra),frame:{...frame}};cancel();state=createEncounter('practice');extra.length=0;demo=true;frame.posture=0;const token=epoch;render();
  addExtra(poor?pair('POOR RESPONSE REPLAY — not recommended, not counted as learner evidence.','错误回应回放 — 不建议这样做，不计个人证据。'):pair('GOOD-PRACTICE EXAMPLE — starts with observation and permission; pausing is a valid ending.','正确练习示例 — 从观察与征询开始，暂停是有效结局。'),'event');
  const lines=poor?[pair('Open your mouth. You must eat.','张嘴，您必须吃。')]:[
    pair('I notice you are turning away. What is worrying you?','我看到您转头拒绝，是有什么顾虑吗？'),
    pair('Would you be willing to have my help, or would you prefer to pause?','您愿意让我协助，还是希望先暂停？'),
    pair('We will pause now. I will withdraw the spoon and respect your choice.','我们先暂停，移开勺子，尊重您的选择。'),
    pair('I will check and follow the fictional care plan CP-M01.','我会核对并遵循虚构照护计划CP-M01。'),
    pair('I will record and report our agreed next step and planned review.','我会记录并报告已商定的下一步和复查安排。')];
  for(const p of lines){if(token!==epoch)return;await send(t(p),'none',p,true);await wait(850);}
  if(poor){await serving(true);if(token!==epoch)return;}
  openDialog('recap');$('dialogEyebrow').textContent=t(pair('Example recap — not personal evidence','示例复盘 — 非个人证据'));restoreDemo();
}
function restoreDemo(){if(!backup)return;state=backup.state;stage=backup.stage;extra.splice(0,extra.length,...backup.extra);frame=backup.frame;backup=null;demo=false;busy=false;stopSpeech();render();}

function field(parent,id,label,type='input',options=[]){const l=element('label',label,'form-field');const n=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');n.id=id;if(type==='select')for(const [v,txt]of options){const o=element('option',txt);o.value=v;n.append(o);}l.append(n);parent.append(l);return n;}
function button(parent,id,label,fn,cls='primary-button'){const b=element('button',label,cls);b.id=id;b.addEventListener('click',fn);parent.append(b);return b;}
function safe(fn){try{fn();render();}catch(e){toast(errorText(e));}}
function recordRows(parent,enc){
  const list=element('div','','evidence-table');
  for(const h of enc.history){if(h.kind==='outcome')continue;const row=element('div','','evidence-row');row.append(element('strong',pair(`Turn ${h.turn} · Original input`,`第${h.turn}轮 · 原始输入`)),element('p',h.userPair||h.user),element('p',h.reply),element('p',h.behavior));list.append(row);}parent.append(list);
}
function renderService(){
  const area=$('serviceArea');area.replaceChildren();const p=element('section','','service-panel panel');area.append(p);
  if(stage==='review'){
    p.append(element('h2',pair('Readiness review is a human decision.','是否就绪，由人工审核决定。')),element('p',pair('Review the frozen unfamiliar encounter, nominate a reviewer, then record a reasoned decision. The learner recap is not this review.','查看冻结的陌生情境记录，指定审核者并记录有理由的决定。学员复盘不是本审核。')),element('div',pair('Role-play only: no identity verification, reviewer notification or clinical sign-off occurs in this browser demo.','仅为角色演示：此浏览器 Demo 不验证身份，不通知审核者，不提供临床签核。'),'service-banner'));
    const roles=field(p,'reviewRole',pair('Current demonstration role','当前演示角色'),'select',[['learner',pair('Learner — read only','学员 — 只读')],['operator',pair('Centre operator — nominate reviewer','中心运营者 — 指定审核者')],['reviewer',pair('Nominated reviewer — decision','指定审核者 — 决定')]]);
    const actionArea=element('div');p.append(actionArea);
    const drawRole=()=>{actionArea.replaceChildren();if(roles.value==='operator'){
      const n=field(actionArea,'reviewerName',pair('Reviewer name (fictional demo entry)','审核者姓名（虚构演示）'));n.value=record.reviewer?.name||'';
      const r=field(actionArea,'reviewerTitle',pair('Role nominated by the centre','中心指定的职责'));r.value=record.reviewer?.role||'';
      button(actionArea,'nominateButton',pair('Nominate reviewer','指定审核者'),()=>safe(()=>{record=nominateReviewer(record,{name:n.value,role:r.value});}));
    }else if(roles.value==='reviewer'){
      if(!record.reviewer){actionArea.append(element('p',pair('The centre operator must nominate a reviewer first.','请先由中心运营者指定审核者。')));return;}
      actionArea.append(element('p',`${record.reviewer.name} · ${record.reviewer.role}`));
      const d=field(actionArea,'decisionSelect',pair('Reviewer decision','审核决定'),'select',[['more-practice',pair('More practice needed','需要更多练习')],['ready-supervised',pair('Ready for supervised workplace practice','可进入有人督导的工作场所练习')],['not-ready',pair('Not ready — further support required','尚未就绪 — 需进一步支持')]]);
      const r=field(actionArea,'decisionReason',pair('Evidence and reason (at least 8 characters)','证据与理由（至少8个字符）'),'textarea');
      button(actionArea,'decisionButton',pair('Record reviewer decision','记录审核决定'),()=>safe(()=>{record=decideReadiness(record,{decision:d.value,reason:r.value});}));
    }};roles.addEventListener('change',drawRole);drawRole();
    if(record.reviewer)p.append(element('p',pair(`Nominated: ${record.reviewer.name} · ${record.reviewer.role}`,`已指定：${record.reviewer.name} · ${record.reviewer.role}`)));
    if(record.decision){p.append(element('div',t(decisionLabel(record.decision.decision))+' — '+record.decision.reason,'review-decision'));button(p,'toShift',pair('Continue → after-shift difficulty','继续 → 班后困难'),()=>navigate('followup'));}
    p.append(element('h3',pair('Frozen unfamiliar encounter','冻结的陌生情境记录')));
    if(record.checkSubmission){const enc=record.checkSubmission.encounter;p.append(element('p',pair(`Submission ${record.checkSubmission.id} · ${record.checkSubmission.submittedAt}`,`提交 ${record.checkSubmission.id} · ${record.checkSubmission.submittedAt}`)));recordRows(p,enc);}
  }else{
    p.append(element('h2',pair('After the shift, keep the learning loop open.','班后继续完成学习闭环。')),element('p',pair('Log a fictional workplace difficulty. It creates a linked refresher and a planned follow-up owned by the nominated reviewer. Nothing is sent to a real workplace.','记录虚构的工作困难，触发关联复习及指定审核者负责的跟进计划。不会向真实工作场所发送任何信息。')));
    const topic=field(p,'difficultyTopic',pair('Difficulty area','困难类型'),'select',[['refusal',pair('Responding to refusal','回应拒绝')],['positioning',pair('Following the positioning plan','遵循姿势照护计划')],['handover',pair('Recording and handover','记录与交接')]]);
    const text=field(p,'difficultyText',pair('What happened? Use fictional details, not resident identifiers.','发生了什么？请用虚构信息，不填写住民身份。'),'textarea');
    button(p,'reportDifficulty',pair('Log difficulty → create refresher & follow-up','记录困难 → 生成复习与跟进'),()=>safe(()=>{record=reportDifficulty(record,{text:text.value,topic:topic.value});delete snapshots.refresher;}));
    if(record.difficulties.length){const d=record.difficulties.at(-1),f=record.followups.at(-1);p.append(element('div',pair(`Linked difficulty ${d.id}: ${d.text}\nFollow-up owner: ${f.assignedTo}. Status: ${f.status==='completed'?'recorded complete':'planned; not contacted'}.`,`关联困难 ${d.id}：${d.text}\n跟进负责人：${f.assignedTo}。状态：${f.status==='completed'?'已记录完成':'已计划，未联系真人'}。`),'service-banner'));
      if(record.refresherRequired)button(p,'launchRefresher',pair('Start linked refresher practice','开始关联复习'),()=>navigate('refresher'));
      const has=record.encounters.some(e=>e.kind==='refresher'&&e.difficultyId===d.id&&e.outcome);
      if(has&&f.status==='planned'){
        const role=field(p,'followupRole',pair('Record workplace follow-up as','以何角色记录工作场所跟进'),'select',[['learner',pair('Learner — view only','学员 — 只读')],['reviewer',pair('Nominated reviewer (demo role)','指定审核者（演示角色）')]]);
        const note=field(p,'followupNote',pair('Follow-up observation and agreed action','跟进观察与商定行动'),'textarea');
        const b=button(p,'completeFollowup',pair('Record follow-up completion','记录跟进完成'),()=>{if(role.value!=='reviewer')return toast(pair('Switch to the nominated reviewer role.','请切换到指定审核者角色。'));safe(()=>record=completeFollowup(record,{note:note.value}));});b.disabled=true;role.addEventListener('change',()=>b.disabled=role.value!=='reviewer');
      }
      if(f.status==='completed')p.append(element('div',pair(`Loop closed with a recorded reviewer follow-up: ${f.note}`,`已通过审核者跟进记录闭环：${f.note}`),'review-decision'));
    }
  }
  button(p,'exportLearning',pair('Download learning record (JSON)','下载学习记录（JSON）'),exportRecord,'outline-button');
}
function decisionLabel(d){return {'ready-supervised':pair('Ready for supervised practice','可进入督导练习'),'more-practice':pair('More practice needed','需要更多练习'),'not-ready':pair('Not ready','尚未就绪')}[d];}
function exportRecord(){const blob=new Blob([JSON.stringify({product:'Amiya Care Practice',locale,notice:'Local role-play only. No real reviewer verification or workplace notification.',record,current:state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='amiya-care-practice-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openDialog(kind){dialogKind=kind;const p=$('dialogContent');p.replaceChildren();$('dialogEyebrow').textContent=t(kind==='case'?pair('FICTIONAL CARE PLAN / CP-M01','虚构照护计划 / CP-M01'):pair('LEARNER RECAP — NOT HUMAN READINESS REVIEW','学员复盘 — 非人工就绪审核'));p.append(element('h2',kind==='case'?CASES[state.kind].name:pair('Your encounter evidence','本次情境证据')));
  if(kind==='case'){p.append(element('p',CASES[state.kind].plan),element('div',pair('Positioning and swallowing illustrations require review by the partner’s care practitioners before a pilot. A seated dining version should be selected only after the Singapore partner confirms relevance.','试点前，姿势和吞咽示意须经合作方照护专业人员审核；新加坡合作方确认适用性后，再决定是否采用坐姿用餐情境。'),'service-banner'));}
  else if(state.kind==='check'){p.append(element('p',pair('The independent check is held for human review. No answer key or live coaching is available here.','独立检查结果保留供人工审核，此处不提供答案或即时教学反馈。')));}
  else{p.append(element('p',state.outcome?endings[state.outcome]:pair('No agreed pathway recorded yet.','尚未记录完整商定路径。')));recordRows(p,state);}
  if(!$('detailDialog').open)$('detailDialog').showModal();
}
function animate(now){
  if(animation){const a=animation,x=(now-a.start)/1000;frame.food=false;frame.speech='';
    if(a.kind==='position'){frame.phase='position';frame.progress=0;frame.posture=a.from+(1-a.from)*ease(x/a.duration);frame.handBlock=.1;}
    else if(a.kind==='withdraw'){frame.phase='withdraw';frame.progress=a.from*(1-ease(x/a.duration));}
    else{const approach=1+a.pace,holding=approach+a.pause,withdraw=holding+1;frame.accepted=a.accepted;frame.posture=state.signals.position?1:frame.posture;
      if(x<1){frame.phase='scoop';frame.progress=.05*Math.sin(x*Math.PI);frame.food=true;}
      else if(x<approach){frame.phase='approach';frame.progress=.87*ease((x-1)/a.pace);frame.food=true;}
      else if(x<holding){frame.phase='wait';frame.progress=.87;frame.food=true;}
      else if(x<withdraw){const u=x-holding;frame.phase=a.accepted?'accept':'wait';frame.progress=a.accepted?.87+.13*ease(u):.87;frame.food=!a.accepted||u<.9;frame.mouth=a.accepted?.5*Math.sin(Math.PI*u*.8):0;}
      else{frame.phase=x<withdraw+1?'withdraw':'swallow';frame.progress=(a.accepted?1:.87)*(1-ease(x-withdraw));frame.food=!a.accepted;frame.mouth=0;}
      frame.headTurn=a.accepted?.04:.65*ease((x-1)/a.pace);frame.handBlock=a.accepted?.03:.8*ease((x-1)/a.pace);frame.brow=a.accepted?.2:.6;
    }
    $('motionProgress').style.width=clamp(x/a.duration)*100+'%';$('motionTime').textContent=Math.min(x,a.duration).toFixed(1)+' s';
    if(x>=a.duration){animation=null;frame.phase='ready';frame.progress=0;frame.food=false;if(resolveAnimation){const r=resolveAnimation;resolveAnimation=null;r();}}
  }
  frame.locale=locale;frame.noHints=state.kind==='check';frame.seniorName=t(CASES[state.kind].name);frame.showGuides=state.kind!=='check'&&$('guidesToggle').checked;frame.showTrails=state.kind!=='check'&&$('trailsToggle').checked;frame.portion=+$('portion').value;
  frame.speech=!animation&&speech&&now<speechUntil?t(speech.value):'';frame.speaker=speech?.speaker||null;
  scene.update(frame);$('phaseChip').textContent=state.kind==='check'?t(pair('Unfamiliar encounter','陌生情境')):t(phases[frame.phase]);$('phaseDescription').textContent=t(phases[frame.phase]);requestAnimationFrame(animate);
}
$('chatForm').addEventListener('submit',e=>{e.preventDefault();const v=$('messageInput').value;$('messageInput').value='';send(v);});
$('messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit();}});
for(const l of ['en','zh'])$(l==='en'?'langEn':'langZh').addEventListener('click',()=>{locale=l;stopSpeech();render();if($('detailDialog').open)openDialog(dialogKind);});
$('practiceButton').addEventListener('click',()=>serving());$('restButton').addEventListener('click',withdraw);$('positionButton').addEventListener('click',()=>send(t(pair('I will raise the bed and arrange supportive pillows.','我会抬高床头，整理靠枕，让您坐稳。')),'position',pair('I will raise the bed and arrange supportive pillows.','我会抬高床头，整理靠枕，让您坐稳。')));
$('recordButton').addEventListener('click',()=>toast(pair('Drag the highlighted wrist. This explores the animation only; it is not measured feeding performance.','拖动高亮手腕，仅探索动画，不测量喂食表现。')));
$('sceneMount').addEventListener('wristinput',e=>{if(busy||demo)return;frame.progress=e.detail.value;frame.phase=frame.progress>.8?'wait':'approach';frame.accepted=false;frame.food=true;frame.mouth=0;});
$('sceneMount').addEventListener('wristend',()=>{frame.progress=0;frame.food=false;frame.phase='ready';});
$('finishEncounter').addEventListener('click',finishEncounter);$('demoButton').addEventListener('click',()=>example());$('poorButton').addEventListener('click',()=>example(true));$('resetButton').addEventListener('click',restart);
for(const id of ['caseButton','caseNav'])$(id).addEventListener('click',()=>openDialog('case'));for(const id of ['reviewButton','reviewNav'])$(id).addEventListener('click',()=>openDialog('recap'));
$('trainingNav').addEventListener('click',()=>navigate('practice'));$('closeDialog').addEventListener('click',()=>{$('detailDialog').close();dialogKind=null;});
$('voiceButton').addEventListener('click',()=>{if(!('speechSynthesis'in window))return toast(pair('Text-to-speech is unavailable in this browser.','此浏览器不支持朗读。'));voice=!voice;if(!voice)stopSpeech();render();});
for(const id of ['portion','pace','pause'])$(id).addEventListener('input',()=>{$('portionValue').textContent=$('portion').value+'%';$('paceValue').textContent=$('pace').value+' s';$('pauseValue').textContent=$('pause').value+' s';});
window.addEventListener('pagehide',stopSpeech);render();requestAnimationFrame(animate);
