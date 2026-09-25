import { createState, respond, evaluateMotion, INITIAL_MESSAGE, INITIAL_SUGGESTIONS } from './engine.js';
import { mountScene } from './scene.js';
import { analyzeTrajectory } from './motion.js';

const $ = id => document.getElementById(id);
const scene = mountScene($('sceneMount'));
let state = createState();
let epoch = 0, busy = false, demo = false, motion = null, recording = null;
let frame = { trainee: 0, elder: 0, compensation: 0, tremor: 0, phase: 'ready', speech: '', speaker: null, showGuides: true, showTrails: true };
let speechUntil = 0, voice = false, lastFrame = performance.now(), liveSamples = [];
let observations = [], learnerCheckedAfterMotion = false;
let pendingMotionResolve = null;
let demoBackup = null;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const smooth = p => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };
const skillLabels = { explain: '说明动作', posture: '姿势准备', observe: '发现偏差', adapt: '调整示范', check: '确认感受' };

function assessment() {
  const rounds = state.history.filter(h => h.kind === 'motion');
  const adapted = rounds.some((r, i) => {
    if (!i) return false;
    const prior = rounds[i - 1];
    const changed = ['amplitude', 'tempo', 'hold'].some(k => Math.abs(r.metrics[k] - prior.metrics[k]) > .15);
    return changed && r.metrics.score - prior.metrics.score >= 8 && observations.some(o => o.turn >= prior.turn && o.turn < r.turn);
  });
  const skills = { explain: state.skills.explain, posture: state.skills.posture, observe: observations.length > 0, adapt: adapted, check: !!rounds.length && learnerCheckedAfterMotion > rounds.at(-1).turn };
  return { skills, score: Object.values(skills).filter(Boolean).length * 20, rounds, adapted };
}

function toast(text) {
  $('toast').textContent = text; $('toast').hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 3400);
}

function addMessage(role, text, behavior = '') {
  if (role === 'coach') {
    const node = document.createElement('div'); node.className = 'coach-message';
    const label = document.createElement('strong'); label.textContent = '✦ 培训教练 · 对护工的反馈';
    const p = document.createElement('p'); p.textContent = text;
    node.append(label, p); $('chatFeed').append(node);
  } else if (role === 'event') {
    const node = document.createElement('div'); node.className = 'event-message'; node.textContent = text; $('chatFeed').append(node);
  } else {
    const node = document.createElement('div'); node.className = `message ${role}`;
    const avatar = document.createElement('div'); avatar.className = 'msg-avatar'; avatar.textContent = role === 'user' ? '你' : '周';
    const content = document.createElement('div'); content.className = 'msg-content';
    const meta = document.createElement('div'); meta.className = 'msg-meta'; meta.textContent = role === 'user' ? '受训护工 · 你的教学' : '周阿姨 · 模拟反应';
    const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
    content.append(meta, bubble);
    if (behavior) { const b = document.createElement('div'); b.className = 'behavior'; b.textContent = `↳ ${behavior}`; content.append(b); }
    node.append(avatar, content); $('chatFeed').append(node);
  }
  $('chatFeed').scrollTop = $('chatFeed').scrollHeight;
}

function say(text, speaker = 'elder') {
  frame.speech = text; frame.speaker = speaker; speechUntil = performance.now() + 7000;
  if (voice && 'speechSynthesis' in window) {
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; utterance.rate = speaker === 'elder' ? .84 : .96;
    const voices = speechSynthesis.getVoices(); const chinese = voices.find(v => v.lang.startsWith('zh'));
    if (chinese) utterance.voice = chinese;
    speechSynthesis.speak(utterance);
  }
}

function setSuggestions(list) {
  $('suggestions').replaceChildren();
  for (const text of list) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
    b.disabled = busy || demo || !!recording;
    b.addEventListener('click', () => send(text)); $('suggestions').append(b);
  }
}

function setBusy(value) {
  busy = value;
  for (const id of ['sendButton', 'practiceButton', 'amplitude', 'tempo', 'hold', 'messageInput', 'referenceButton']) $(id).disabled = value || demo || !!recording;
  $('recordButton').disabled = value || demo;
  $('recordButton').textContent = recording ? '■ 提交动作' : '◎ 手动示范';
  $('recordButton').classList.toggle('recording', !!recording);
  $('recordHint').hidden = !recording;
  $('suggestions').querySelectorAll('button').forEach(b => b.disabled = value || demo || !!recording);
  $('demoButton').classList.toggle('running', demo);
  $('demoButton').textContent = demo ? '■ 停止自动训练' : '▶ 看一段完整训练';
  $('modeChip').textContent = demo ? '自动演示 · 教学闭环' : recording ? '记录手动示范' : '交互演练';
  $('sceneMount').classList.toggle('interaction-locked', value || demo);
  scene.setInteractive(!value && !demo);
}

function refresh(result) {
  const a = assessment();
  $('turnCount').textContent = `第 ${state.turn} 轮`;
  $('teachingScore').textContent = a.score; $('scoreRing').style.setProperty('--score', a.score);
  $('skillChecks').replaceChildren();
  for (const [key, label] of Object.entries(skillLabels)) {
    const el = document.createElement('span'); el.className = `skill-check${a.skills[key] ? ' done' : ''}`; el.textContent = `${a.skills[key] ? '✓' : '○'} ${label}`; $('skillChecks').append(el);
  }
  $('metricFatigue').innerHTML = `${Math.round(state.fatigue)}<span>/100</span>`;
  $('fatigueBar').style.width = `${state.fatigue}%`;
  const m = state.latestMotion?.metrics;
  if (m) {
    $('metricMatch').innerHTML = `${Math.round(m.matching)}<span>%</span>`;
    $('metricLag').innerHTML = `${m.lag.toFixed(2)}<span>s</span>`;
    $('metricComp').innerHTML = `${Math.round(m.compensation)}<span>/100</span>`;
    $('matchBar').style.width = `${m.matching}%`; $('compBar').style.width = `${m.compensation}%`;
  } else {
    for (const id of ['metricMatch', 'metricLag', 'metricComp']) $(id).textContent = '—';
    $('matchBar').style.width = $('compBar').style.width = '0%';
  }
  if (result) {
    $('coachText').textContent = result.coach;
    $('coachTitle').textContent = a.score === 100 ? '你完成了“发现问题—调整示范—验证反馈”的教学闭环。' : result.metrics ? (result.metrics.score < 75 ? '动作做出来了，但长者还没有跟上。' : '示范更容易跟随了。接下来，确认长者的感受。') : '把你的观察转化为下一次教学调整。';
    $('sceneObservation').querySelector('strong').textContent = result.behavior;
    setSuggestions(result.suggestions);
  }
  $('roundComparison').hidden = a.rounds.length < 2;
  if (a.rounds.length > 1) {
    const first = a.rounds[0].metrics, last = a.rounds.at(-1).metrics;
    $('roundComparison').textContent = `第 1 次 → 第 ${a.rounds.length} 次：匹配 ${Math.round(first.matching)}% → ${Math.round(last.matching)}% · 延迟 ${first.lag.toFixed(2)}s → ${last.lag.toFixed(2)}s · 代偿 ${Math.round(first.compensation)} → ${Math.round(last.compensation)}。${a.adapted ? '已记录到有效的示范调整。' : '还需根据长者反应修正示范。'}`;
  }
}

async function send(text, action = 'none', internal = false) {
  text = text.trim();
  if (!text || busy || recording || (demo && !internal)) return;
  const token = epoch;
  addMessage('user', text); $('messageInput').value = '';
  setBusy(true); say(text, 'trainee');
  const typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '周阿姨正在回应 <span>●</span> <span>●</span> <span>●</span>'; $('chatFeed').append(typing); $('chatFeed').scrollTop = $('chatFeed').scrollHeight;
  await wait(650); typing.remove(); if (token !== epoch) return;
  const result = respond(state, { text, action }); state = result.state;
  const observed = result.evidence.observation;
  if (observed) observations.push({ turn: state.turn, text });
  if (result.evidence.check && state.rounds > 0) learnerCheckedAfterMotion = state.turn;
  if (observed) result.coach = '你注意到了长者的动作偏差。请把这个观察落实到幅度或节奏，而不是让长者“再努力一点”。';
  if (action === 'slow' || /放慢|慢一点|缩小|小幅/.test(text)) {
    result.coach += ' 右侧参数仍由你调整，口头说“慢一点”不会自动改变示范。';
  }
  addMessage('elder', result.reply, result.behavior); addMessage('coach', result.coach);
  frame.phase = action === 'rest' ? 'rest' : 'ready';
  say(result.reply); refresh(result); setBusy(false);
}

function values() { return { amplitude: +$('amplitude').value, tempo: +$('tempo').value, hold: +$('hold').value, smoothness: 92, source: 'preset' }; }
function setValues(amplitude, tempo, hold) { $('amplitude').value = amplitude; $('tempo').value = tempo; $('hold').value = hold; syncSliders(); }
function syncSliders() { $('amplitudeValue').textContent = `${$('amplitude').value}%`; $('tempoValue').textContent = `${(+$('tempo').value).toFixed(1)} s`; $('holdValue').textContent = `${(+$('hold').value).toFixed(1)} s`; }

// tempo is total moving time, with an additional explicit hold segment.
function trajectory(t, params) {
  const half = params.tempo / 2;
  if (t < 0) return { value: 0, phase: 'ready' };
  if (t < half) return { value: smooth(t / half), phase: 'reach' };
  if (t < half + params.hold) return { value: 1, phase: 'hold' };
  if (t < params.tempo + params.hold) return { value: 1 - smooth((t - half - params.hold) / half), phase: 'return' };
  return { value: 0, phase: 'ready' };
}

async function practice(internal = false, reference = false) {
  if (busy || recording || (demo && !internal)) return;
  const p = reference ? { amplitude: 55, tempo: 4.5, hold: 1, smoothness: 96, source: 'preset' } : values();
  const result = evaluateMotion(state, p);
  const token = epoch;
  setBusy(true); frame.speech = ''; frame.speaker = null;
  if (!reference) addMessage('user', `【动作示范 ${state.rounds + 1}】前伸幅度 ${p.amplitude}% · 节奏 ${p.tempo}s · 停留 ${p.hold}s`);
  else { addMessage('event', '教学参考 · 不计入你的训练成绩'); toast('教学参考：分解动作、留出跟随时间；不会改变本轮成绩。'); }
  motion = { start: performance.now(), params: p, result, reference, token };
  await new Promise(resolve => pendingMotionResolve = resolve);
  if (token !== epoch) return;
  if (!reference) {
    state = result.state;
    addMessage('elder', result.reply, result.behavior);
    const coach = trainingFeedback(result);
    result.coach = coach;
    addMessage('coach', coach); say(result.reply); refresh(result);
    if (result.metrics.score < 75) addObservationQuestion();
  } else {
    frame.phase = 'ready'; frame.trainee = 0; frame.elder = 0;
    addMessage('coach', '参考示范强调：先让长者看清，再用较小幅度、完整停留与缓慢回收留出跟随时间。请你在下一轮自己调整参数，并观察反应。');
  }
  setBusy(false);
}

function trainingFeedback(result) {
  const a = assessment();
  let prefix = '';
  if (!state.skills.explain) prefix += '你直接开始了动作，尚未说明动作顺序。';
  if (!state.skills.posture) prefix += '还缺少坐姿与肩部准备。';
  if (a.adapted) prefix += '这次调整减少了长者的跟随困难，说明你在依据反馈教学。';
  return prefix + result.coach.replace(/幅度45–65、节奏3–6秒、停留0.6–2秒/g, '较小幅度、更从容的节奏和清楚的停留').replace(/缩小到45–65的幅度、放慢到3–6秒/g, '缩小示范范围、放慢节奏');
}

function addObservationQuestion() {
  const box = document.createElement('div'); box.className = 'observation-question coach-message';
  const title = document.createElement('strong'); title.textContent = '✦ 观察练习 · 你刚才看到了什么？'; box.append(title);
  for (const [text, correct] of [['长者耸肩 / 前倾，示范可能过大或过快', true], ['长者不够努力，应该催她跟上', false]]) {
    const b = document.createElement('button'); b.className = 'observation-choice'; b.textContent = text;
    b.addEventListener('click', () => {
      if (busy || demo || recording) return toast('请先完成当前演练。');
      box.querySelectorAll('button').forEach(el => el.disabled = true);
      if (correct) { observations.push({ turn: state.turn, text }); addMessage('coach', '观察正确。先调整你的示范，再验证长者是否更容易跟上；不要把模仿困难归因为“不努力”。'); }
      else addMessage('coach', '再观察手腕的时间差和肩部抬高：这提示示范和跟随能力不匹配，而不是态度问题。可以在对话里重新描述你的观察。');
      refresh();
    }); box.append(b);
  }
  $('chatFeed').append(box); $('chatFeed').scrollTop = $('chatFeed').scrollHeight;
}

function cancelActivity() {
  scene.cancelInteraction();
  epoch++; demo = false; motion = null; recording = null; liveSamples = [];
  if (pendingMotionResolve) { pendingMotionResolve(); pendingMotionResolve = null; }
  frame = { ...frame, trainee: 0, elder: 0, compensation: 0, tremor: 0, phase: 'rest', speech: '', speaker: null };
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('chatFeed').querySelectorAll('.typing').forEach(n => n.remove());
  setBusy(false); $('motionProgress').style.width = '0%';
}

function reset() {
  demoBackup = null;
  cancelActivity(); state = createState(); observations = []; learnerCheckedAfterMotion = false;
  frame.phase = 'ready'; $('chatFeed').replaceChildren(); setValues(80, 2, .5);
  $('motionTime').textContent = '0.0 s';
  $('scoreRing').querySelector('span').textContent = '教学完成度';
  addMessage('event', '案例 01 · 第一次坐姿前伸教学');
  addMessage('coach', '你的任务：教周阿姨理解并跟随动作。先示范、观察，再根据她的反馈调整。这里评价的是你的教学能力，不是长者做得多标准。');
  addMessage('elder', INITIAL_MESSAGE, '双手搭在腿上，注视护工，等待你的引导。');
  setSuggestions(INITIAL_SUGGESTIONS); refresh();
  $('coachTitle').textContent = '先观察，再示范；先理解，再纠正。';
  $('coachText').textContent = '先用一句话说明动作，再观察长者能否跟上。当前默认示范偏大偏快，试一次，看看周阿姨的反应。';
  $('sceneObservation').querySelector('strong').textContent = '关注肩部、躯干和动作节奏';
}

async function runDemo() {
  if (demo) { cancelActivity(); restoreDemo(); toast('自动演示已停止，个人训练记录保持不变。'); return; }
  if (busy || recording) return toast('请先完成或暂停当前动作。');
  const backup = { state, observations, learnerCheckedAfterMotion, nodes: Array.from($('chatFeed').childNodes), values: values(), suggestions: Array.from($('suggestions').children).map(n => n.textContent), title: $('coachTitle').textContent, coach: $('coachText').textContent, observation: $('sceneObservation').querySelector('strong').textContent };
  reset(); demoBackup = backup; demo = true; const token = epoch; setBusy(false);
  $('scoreRing').querySelector('span').textContent = '演示完成度';
  addMessage('event', '自动演示 · 以下均为示例，不计入你的个人成绩');
  const step = async fn => { if (token !== epoch) return false; await fn(); await wait(1200); return token === epoch; };
  if (!await step(() => send('周阿姨，我先示范向前伸、停一下、再收回来。您愿意看我做一遍吗？', 'explain', true))) return;
  if (!await step(() => send('先坐稳，双脚落地，肩膀放松。', 'posture', true))) return;
  if (!await step(() => practice(true))) return;
  if (!await step(() => send('我看到您有些耸肩，动作也没跟上，是我示范得太快了。我们先休息一下。', 'rest', true))) return;
  if (!await step(() => send('我把幅度缩小，再慢一点，先看我伸、停、收，您按自己的节奏跟。', 'slow', true))) return;
  setValues(55, 4.5, 1);
  if (!await step(() => practice(true))) return;
  if (!await step(() => send('这次手臂感觉怎么样，有没有酸或疼？', 'check', true))) return;
  openDialog('review');
  $('dialogEyebrow').textContent = 'DEMONSTRATION ONLY / 自动演示复盘 · 非个人成绩';
  restoreDemo();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  toast('完整示例已结束，已恢复你的个人训练记录。');
}

function restoreDemo() {
  const backup = demoBackup; demoBackup = null; demo = false;
  if (!backup) return;
  state = backup.state; observations = backup.observations; learnerCheckedAfterMotion = backup.learnerCheckedAfterMotion;
  $('chatFeed').replaceChildren(...backup.nodes); setValues(backup.values.amplitude, backup.values.tempo, backup.values.hold);
  refresh(); setSuggestions(backup.suggestions); setBusy(false);
  $('coachTitle').textContent = backup.title; $('coachText').textContent = backup.coach;
  $('sceneObservation').querySelector('strong').textContent = backup.observation;
  $('scoreRing').querySelector('span').textContent = '教学完成度';
  frame.speech = ''; frame.speaker = null; frame.phase = 'ready';
}

async function toggleRecording() {
  if (busy || demo) return;
  if (!recording) {
    recording = { start: performance.now(), samples: [{ t: 0, value: 0 }] };
    frame.trainee = frame.elder = 0; frame.phase = 'ready'; frame.speech = ''; liveSamples = [];
    setBusy(false); toast('拖动护工手腕示范。前伸、停一下，再拉回腿前，最后提交。');
  } else {
    const data = recording; const analysis = analyzeTrajectory(data.samples);
    if (!analysis.valid) return toast(analysis.reason);
    const result = evaluateMotion(state, { ...analysis, source: 'drag' });
    const token = epoch;
    recording = null; liveSamples = [];
    addMessage('user', `【手动动作示范】范围 ${Math.round(analysis.amplitude)}% · 运动 ${analysis.tempo.toFixed(1)}s · 停留 ${analysis.hold.toFixed(1)}s`);
    addMessage('event', '回放你的动作 · 本轮长者跟随与反馈使用同一模型');
    setBusy(true);
    motion = { start: performance.now(), params: { amplitude: analysis.amplitude, tempo: analysis.tempo, hold: analysis.hold }, result, token, custom: { samples: data.samples, start: analysis.activeStart, duration: analysis.activeEnd - analysis.activeStart } };
    await new Promise(resolve => pendingMotionResolve = resolve);
    if (token !== epoch) return;
    state = result.state; result.coach = trainingFeedback(result);
    addMessage('elder', result.reply, result.behavior); addMessage('coach', result.coach);
    say(result.reply); frame.phase = 'ready'; refresh(result); setBusy(false); if (result.metrics.score < 75) addObservationQuestion();
  }
}

function openDialog(kind) {
  const content = $('dialogContent'); content.replaceChildren();
  $('dialogEyebrow').textContent = kind === 'case' ? 'CASE 01 / TRAINER BRIEF' : 'LEARNER DEBRIEF / TRAINING EVIDENCE';
  const heading = document.createElement('h2'); heading.textContent = kind === 'case' ? '你的任务，是学会怎样教。' : '把观察，变成下一次更好的示范。'; content.append(heading);
  if (kind === 'case') {
    const p = document.createElement('p'); p.textContent = '虚构案例：76 岁的周阿姨在敬老院康养活动室进行已安排的坐姿上肢活动。她能听懂短句，但需要看到完整示范；动作跟随稍慢，示范过快或幅度过大会出现耸肩和躯干前倾。你负责教学引导，而非为她制定康复处方。'; content.append(p);
    const tags = document.createElement('div'); tags.className = 'brief-tags'; ['对象：受训护工', '任务：示范与调整', '反馈：动作 + 语言', '病例与动作均为模拟'].forEach(t => { const span = document.createElement('span'); span.textContent = t; tags.append(span); }); content.append(tags);
    const h = document.createElement('h3'); h.textContent = '练习五项教学能力'; content.append(h);
    const ul = document.createElement('ul'); ['用短句解释前伸—停留—回收，让长者知道接下来做什么。', '关注坐稳、双脚着地、肩部放松，而不是直接开始。', '从手腕延迟、耸肩、躯干前倾中识别跟随困难。', '调整自己的示范幅度和节奏，再观察差异。', '完成后主动询问感受；必要时休息，而不是催促。'].forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.append(li); }); content.append(ul);
    const h2 = document.createElement('h3'); h2.textContent = '怎样操作'; content.append(h2);
    const hint = document.createElement('p'); hint.textContent = '左侧输入教学话术。右侧调整幅度、节奏、停留并示范；也可以点击“手动示范”，拖动护工手腕录制轨迹。系统对照你的示范生成长者的延迟、代偿和口头反应。点击“看一段完整训练”可观看一次错误—修正—复核的完整示例。'; content.append(hint);
  } else {
    const a = assessment();
    const summary = document.createElement('div'); summary.className = 'review-score'; const num = document.createElement('b'); num.textContent = a.score; const p = document.createElement('span'); p.textContent = `教学完成度 / 100 · ${state.turn} 轮交互 · ${state.rounds} 次示范。此分数按五项教学行为记录，不是临床能力认证。`; summary.append(num, p); content.append(summary);
    const ul = document.createElement('ul'); for (const [key, label] of Object.entries(skillLabels)) { const li = document.createElement('li'); li.textContent = `${a.skills[key] ? '✓ 已体现' : '○ 待练习'} · ${label}`; ul.append(li); } content.append(ul);
    if (!state.history.length) { const p = document.createElement('p'); p.textContent = '还没有训练记录。先与长者交流，再完成一次动作示范。'; content.append(p); }
    for (const entry of state.history) {
      const div = document.createElement('div'); div.className = 'review-item'; const t = document.createElement('strong'); t.textContent = `第 ${entry.turn} 轮 · ${entry.kind === 'motion' ? '动作示范' : '教学对话'} — ${entry.user}`;
      const p = document.createElement('p'); p.textContent = entry.metrics ? `动作匹配 ${entry.metrics.matching}% / 延迟 ${entry.metrics.lag}s / 代偿 ${entry.metrics.compensation}；${entry.reply}` : entry.reply;
      div.append(t, p); content.append(div);
    }
    if (state.history.length && !demo) { const button = document.createElement('button'); button.className = 'primary-button export-button'; button.textContent = '↓ 导出本次训练记录'; button.addEventListener('click', exportReport); content.append(button); }
  }
  $('detailDialog').showModal();
}

function exportReport() {
  const blob = new Blob([JSON.stringify({ demo: 'CareLab simulated caregiver training', createdAt: new Date().toISOString(), assessment: assessment(), observations, state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `carelab-training-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function animate(now) {
  const dt = Math.min((now - lastFrame) / 1000, .06); lastFrame = now;
  if (motion) {
    const t = (now - motion.start) / 1000; const { params, result } = motion;
    const customTrajectory = elapsed => {
      if (elapsed < 0 || elapsed > motion.custom.duration) return { value: 0, phase: 'ready' };
      const target = elapsed + motion.custom.start;
      const samples = motion.custom.samples;
      const idx = samples.findIndex(s => s.t >= target);
      const b = samples[Math.max(0, idx)], a = samples[Math.max(0, idx - 1)];
      const raw = a.value + (b.value - a.value) * clamp((target - a.t) / Math.max(.001, b.t - a.t), 0, 1);
      return { value: raw / Math.max(.01, params.amplitude / 100), phase: raw > params.amplitude / 100 * .92 ? 'hold' : b.value >= a.value ? 'reach' : 'return' };
    };
    const own = motion.custom ? customTrajectory(t) : trajectory(t, params);
    const elder = motion.custom ? customTrajectory(t - result.view.delay) : trajectory(t - result.view.delay, params);
    frame.trainee = own.value * params.amplitude / 100;
    frame.elder = elder.value * result.view.maxReach;
    frame.compensation = result.view.compensation * elder.value;
    frame.tremor = result.view.tremor * elder.value;
    frame.phase = own.phase;
    const duration = (motion.custom ? motion.custom.duration : params.tempo + params.hold) + result.view.delay;
    $('motionProgress').style.width = `${Math.min(100, t / duration * 100)}%`;
    $('motionTime').textContent = `${Math.min(t, duration).toFixed(1)} s`;
    if (t >= duration + .4) {
      motion = null; frame.phase = 'ready'; frame.trainee = frame.elder = 0;
      if (pendingMotionResolve) { const resolve = pendingMotionResolve; pendingMotionResolve = null; resolve(); }
    }
  } else if (recording || liveSamples.length) {
    liveSamples.push({ t: now, value: frame.trainee }); liveSamples = liveSamples.filter(s => s.t > now - 2500);
    const delay = .55 + state.fatigue * .006 + (100 - state.comprehension) * .004;
    const sample = liveSamples.findLast(s => s.t <= now - delay * 1000);
    const target = sample ? Math.min(.65, sample.value) : 0;
    frame.elder += (target - frame.elder) * Math.min(1, dt * 7);
    frame.compensation = Math.max(0, frame.trainee - .65) * 2 + (state.skills.posture ? .03 : .17) * frame.elder;
    frame.tremor = frame.elder * .12;
    if (!recording && frame.trainee < .01 && frame.elder < .01) liveSamples = [];
  } else {
    frame.trainee *= Math.max(0, 1 - dt * 6); frame.elder *= Math.max(0, 1 - dt * 4); frame.compensation *= .94; frame.tremor *= .94;
  }
  if (recording) { recording.samples.push({ t: (now - recording.start) / 1000, value: frame.trainee }); $('motionTime').textContent = `${((now - recording.start) / 1000).toFixed(1)} s`; }
  if (now > speechUntil) { frame.speech = ''; frame.speaker = null; }
  frame.showGuides = $('guidesToggle').checked; frame.showTrails = $('trailsToggle').checked; frame.selected = !!recording;
  scene.update(frame);
  const labels = { ready: busy ? '长者正在回应' : '等待你的教学', reach: '前伸 · 观察跟随', hold: '停留 · 留出反应时间', return: '回收 · 留意代偿', rest: '休息 · 观察感受' };
  $('phaseChip').lastChild.textContent = ` ${recording ? '手动示范 · 正在记录' : labels[frame.phase]}`;
  document.querySelectorAll('.phase-step').forEach(el => el.classList.toggle('active', el.dataset.phase === frame.phase));
  requestAnimationFrame(animate);
}

$('sceneMount').addEventListener('wristinput', event => {
  if (busy || demo) return;
  if (!recording) { recording = { start: performance.now(), samples: [{ t: 0, value: 0 }] }; liveSamples = []; setBusy(false); }
  frame.trainee = event.detail.value; frame.phase = event.detail.value > .6 ? 'hold' : 'reach'; frame.speech = '';
});
$('sceneMount').addEventListener('wristend', event => { if (recording) frame.phase = event.detail.value < .1 ? 'ready' : 'hold'; });
$('chatForm').addEventListener('submit', event => { event.preventDefault(); send($('messageInput').value); });
$('messageInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send($('messageInput').value); } });
for (const id of ['amplitude', 'tempo', 'hold']) $(id).addEventListener('input', syncSliders);
$('practiceButton').addEventListener('click', () => practice());
$('referenceButton').addEventListener('click', () => practice(false, true));
$('recordButton').addEventListener('click', toggleRecording);
$('restButton').addEventListener('click', () => { const wasDemo = demo; cancelActivity(); if (wasDemo) { restoreDemo(); return toast('演示已暂停，个人训练记录不变。'); } addMessage('event', '动作暂停 · 未完成的示范不计分'); send('我们先把手放下来休息一下，舒服些再继续。', 'rest'); });
$('resetButton').addEventListener('click', reset);
$('demoButton').addEventListener('click', runDemo);
for (const id of ['caseButton', 'caseNav']) $(id).addEventListener('click', () => openDialog('case'));
for (const id of ['reviewButton', 'reviewNav']) $(id).addEventListener('click', () => openDialog('review'));
$('trainingNav').addEventListener('click', () => { $('detailDialog').close(); $('sceneMount').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
$('closeDialog').addEventListener('click', () => $('detailDialog').close());
$('detailDialog').addEventListener('click', event => { if (event.target === $('detailDialog')) { const r = $('detailDialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('detailDialog').close(); } });
$('voiceButton').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return toast('当前浏览器不支持语音朗读，请使用文字模式。');
  voice = !voice; $('voiceButton').textContent = voice ? '语音 开' : '语音 关'; $('voiceButton').setAttribute('aria-pressed', String(voice));
  if (!voice) speechSynthesis.cancel(); else toast('已开启浏览器语音；中文音色取决于本机可用声音。');
});
window.addEventListener('pagehide', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });
reset(); requestAnimationFrame(animate);
