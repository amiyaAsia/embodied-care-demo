import { createState, respond, evaluateFeeding, INITIAL_MESSAGE, INITIAL_SUGGESTIONS } from './engine.js';
import { mountScene } from './scene.js';
import { analyzeTrajectory } from './motion.js';
const $ = id => document.getElementById(id);
const scene = mountScene($('sceneMount'));
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let state, epoch = 0, busy = false, demo = false, backup = null, action = null, recording = null, resolver = null;
let observed = [], withdrawn = [], checkedTurn = 0, voice = false, speechEnd = 0, lastTime = performance.now();
let frame = { progress: 0, posture: 0, phase: 'ready', headTurn: .7, brow: .8, mouth: 0, handBlock: .4, food: false, accepted: false, portion: 75, speech: '', speaker: null, showGuides: true, showTrails: true };
const labels = { ready: '先观察 · 再协商', position: '调姿 · 抬高床头与靠枕支撑', scoop: '取食 · 控制勺量', approach: '递勺 · 保持平稳', wait: '口前等待 · 不追着嘴', accept: '自主张口 · 接受这一口', withdraw: '撤勺 · 留出空间', swallow: '模拟吞咽 · 不连续送勺', rest: '暂停 · 先听她说' };
const skills = { explain: '说明与温度', position: '坐姿准备', observe: '识别拒食', withdraw: '撤勺与倾听', choice: '尊重选择', adapt: '调整操作', check: '咽后确认' };

function assessment() {
  const rounds = state.history.filter(h => h.kind === 'feeding');
  const lastAccepted = rounds.findLast(h => h.metrics.accepted);
  const adapted = rounds.some((r, i) => i > 0 && r.metrics.accepted && !rounds[i - 1].metrics.accepted && ['portion', 'pace', 'pause'].some(k => r.metrics[k] !== rounds[i - 1].metrics[k]) && observed.some(o => o.turn >= rounds[i - 1].turn && o.turn < r.turn));
  const evidence = { explain: state.skills.explain && state.flags.temperatureResolved, position: state.skills.position, observe: observed.length > 0, withdraw: withdrawn.length > 0 && state.skills.listen, choice: state.skills.choice, adapt: adapted, check: !!lastAccepted && checkedTurn > lastAccepted.turn };
  return { evidence, rounds, adapted, score: Math.round(Object.values(evidence).filter(Boolean).length / 7 * 100) };
}
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 4000); }
function message(role, text, behavior = '') {
  const el = document.createElement('div');
  if (role === 'event') { el.className = 'event-message'; el.textContent = text; }
  else if (role === 'coach') { el.className = 'coach-message'; const h = document.createElement('strong'); h.textContent = '✦ 培训教练 · 对照护行为的反馈'; const p = document.createElement('p'); p.textContent = text; el.append(h, p); }
  else {
    el.className = `message ${role}`;
    const av = document.createElement('div'); av.className = 'msg-avatar'; av.textContent = role === 'user' ? '你' : '周';
    const c = document.createElement('div'); c.className = 'msg-content';
    const m = document.createElement('div'); m.className = 'msg-meta'; m.textContent = role === 'user' ? '受训护工 · 沟通与操作' : '周阿姨 · 烦躁长者（模拟）';
    const b = document.createElement('div'); b.className = 'bubble'; b.textContent = text; c.append(m, b);
    if (behavior) { const d = document.createElement('div'); d.className = 'behavior'; d.textContent = `↳ ${behavior}`; c.append(d); } el.append(av, c);
  }
  $('chatFeed').append(el); $('chatFeed').scrollTop = $('chatFeed').scrollHeight;
}
function say(text, speaker = 'elder') {
  frame.speech = text; frame.speaker = speaker; speechEnd = performance.now() + 6500;
  if (voice && 'speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = speaker === 'elder' ? .85 : .96; speechSynthesis.speak(u); }
}
function setSuggestions(list) {
  $('suggestions').replaceChildren();
  for (const text of list) { const b = document.createElement('button'); b.textContent = text; b.disabled = busy || demo || !!recording; b.addEventListener('click', () => send(text)); $('suggestions').append(b); }
}
function lock(value) {
  busy = value;
  for (const id of ['sendButton', 'practiceButton', 'amplitude', 'tempo', 'hold', 'messageInput', 'referenceButton', 'positionButton']) $(id).disabled = value || demo || !!recording;
  $('recordButton').disabled = value || demo;
  $('recordButton').textContent = recording ? '■ 提交操作' : '◎ 手动递勺';
  $('recordButton').classList.toggle('recording', !!recording); $('recordHint').hidden = !recording;
  $('suggestions').querySelectorAll('button').forEach(b => b.disabled = value || demo || !!recording);
  $('demoButton').classList.toggle('running', demo); $('demoButton').textContent = demo ? '■ 停止完整演示' : '▶ 看一段完整训练';
  $('modeChip').textContent = demo ? '自动案例 · 非个人成绩' : recording ? '手动路径预演 · 提交后回放' : '交互演练';
  scene.setInteractive(!value && !demo); $('sceneMount').classList.toggle('interaction-locked', value || demo);
}
function parameters() { return { portion: +$('amplitude').value, pace: +$('tempo').value, pause: +$('hold').value, steady: 90, source: 'preset' }; }
function sync() { $('amplitudeValue').textContent = `${$('amplitude').value}%`; $('tempoValue').textContent = `${(+$('tempo').value).toFixed(1)} s`; $('holdValue').textContent = `${(+$('hold').value).toFixed(1)} s`; }
function setParameters(portion, pace, pause) { $('amplitude').value = portion; $('tempo').value = pace; $('hold').value = pause; sync(); }
function refresh(result) {
  const a = assessment(); $('turnCount').textContent = `第 ${state.turn} 轮`;
  $('teachingScore').textContent = a.score; $('scoreRing').style.setProperty('--score', a.score);
  $('skillChecks').replaceChildren();
  for (const [k, label] of Object.entries(skills)) { const s = document.createElement('span'); s.className = `skill-check${a.evidence[k] ? ' done' : ''}`; s.textContent = `${a.evidence[k] ? '✓' : '○'} ${label}`; $('skillChecks').append(s); }
  $('metricFatigue').textContent = `${Math.round(state.agitation)}/100`; $('fatigueBar').style.width = `${state.agitation}%`;
  const m = state.latestFeeding?.metrics;
  $('metricMatch').textContent = m ? `${Math.round(m.acceptance)}%` : '—'; $('matchBar').style.width = `${m?.acceptance || 0}%`;
  $('metricLag').textContent = m ? `${m.pause.toFixed(1)} s` : '—'; $('metricComp').textContent = m ? `${Math.round(m.pressure)}/100` : '—'; $('compBar').style.width = `${m?.pressure || 0}%`;
  if (result) {
    $('coachTitle').textContent = a.score === 100 ? '你完成了“识别拒食—撤勺回应—调整—确认”的照护闭环。' : result.metrics ? (result.metrics.accepted ? '她愿意接受这一口。现在放下勺子，等她回应。' : '转头与闭口是拒绝，不是需要你继续劝喂。') : '先处理烦躁的原因，再决定是否递勺。';
    $('coachText').textContent = result.coach; $('sceneObservation').querySelector('strong').textContent = result.behavior; setSuggestions(result.suggestions);
  }
  $('roundComparison').hidden = a.rounds.length < 2;
  if (a.rounds.length > 1) { const f = a.rounds[0].metrics, l = a.rounds.at(-1).metrics; $('roundComparison').textContent = `首次 → 本次：勺量 ${f.portion}% → ${l.portion}% · 递勺 ${f.pace}s → ${l.pace}s · 压迫感 ${Math.round(f.pressure)} → ${Math.round(l.pressure)}。${a.adapted ? '已根据拒食反馈改变实际操作。' : '留意话术与实际操作是否一致。'}`; }
}
async function send(text, act = 'none', internal = false) {
  if (!text.trim() || busy || recording || (demo && !internal)) return;
  const token = epoch; message('user', text); $('messageInput').value = ''; lock(true); say(text, 'trainee');
  await sleep(650); if (token !== epoch) return;
  const result = respond(state, { text, action: act });
  if (result.evidence.position && !result.evidence.negative && frame.posture < .99) {
    // Commit the preparation skill only after its physical demonstration finishes.
    message('event', '床旁准备 · 先放下勺子，缓慢抬高床头并整理靠枕');
    action = { start: performance.now(), positioning: true, from: frame.posture, token, p: parameters() };
    await new Promise(r => resolver = r);
    if (token !== epoch) return;
  }
  state = result.state;
  if (!result.evidence.negative && state.attempts && /转头|抿嘴|闭口|抬手|不想吃|不愿吃/.test(text)) observed.push({ turn: state.turn, text });
  if (result.evidence.rest && state.attempts) withdrawn.push({ turn: state.turn, text });
  if (result.evidence.check && state.latestFeeding?.metrics.accepted) checkedTurn = state.turn;
  frame = { ...frame, ...result.view, phase: 'ready', progress: 0, food: false, accepted: false };
  message('elder', result.reply, result.behavior); message('coach', result.coach); say(result.reply); refresh(result); lock(false);
}

function timeline(t, p, result, custom = null) {
  const accepted = result.metrics.accepted;
  const scoop = .85, approach = p.pace, wait = Math.max(.8, p.pause), accept = accepted ? 1.25 : .5, withdraw = 1.8, swallow = accepted ? 2.6 : .5;
  const total = scoop + approach + wait + accept + withdraw + swallow;
  let phase, progress, mouth = 0, food = true;
  if (t < scoop) { phase = 'scoop'; progress = .04 * Math.sin(t / scoop * Math.PI); }
  else if (t < scoop + approach) { phase = 'approach'; progress = .87 * smooth((t - scoop) / approach); }
  else if (t < scoop + approach + wait) { phase = 'wait'; progress = .87; mouth = accepted ? .25 * smooth((t - scoop - approach) / wait) : 0; }
  else if (t < scoop + approach + wait + accept) { const u = (t - scoop - approach - wait) / accept; phase = accepted ? 'accept' : 'wait'; progress = accepted ? .87 + .13 * smooth(u) : .87; mouth = accepted ? .7 * Math.sin(u * Math.PI * .8) : 0; food = !accepted || u < .9; }
  else if (t < total - swallow) { const u = (t - scoop - approach - wait - accept) / withdraw; phase = 'withdraw'; progress = (accepted ? 1 : .87) * (1 - smooth(u)); food = !accepted; }
  else { phase = accepted ? 'swallow' : 'rest'; progress = 0; food = !accepted; }
  if (custom) {
    // The recorded path is replayed during approach; outcome still waits for a response.
    if (phase === 'approach') { const local = custom.start + (t - scoop) / approach * custom.reachDuration; const i = custom.samples.findIndex(s => s.t >= local); const b = custom.samples[Math.max(0, i)], a = custom.samples[Math.max(0, i - 1)]; progress = .87 * clamp((a.value + (b.value - a.value) * clamp((local - a.t) / Math.max(.001, b.t - a.t))) / custom.peak); }
  }
  const reaction = smooth((t - scoop - approach * .45) / .8);
  return { total, phase, progress, mouth, food, accepted, headTurn: result.view.headTurn * (accepted ? .35 : reaction), brow: result.view.brow, handBlock: result.view.handBlock * reaction };
}

async function feed(internal = false, reference = false, manual = null) {
  if (busy || recording || (demo && !internal)) return;
  const p = manual?.params || (reference ? { portion: 30, pace: 3.5, pause: 2, steady: 95 } : parameters());
  let base = state;
  if (reference) {
    base = createState();
    for (const [text, act] of [['我知道您不想吃，是烫吗？', 'listen'], ['少一点，确认温度合适再喂。', 'explain'], ['抬高床头，整理靠枕，让您靠舒服。', 'position'], ['您想自己吃还是让我协助，愿意试一小口吗？', 'choice']]) base = respond(base, { text, action: act }).state;
  }
  const result = evaluateFeeding(base, p), token = epoch;
  lock(true); frame.speech = ''; frame.speaker = null;
  const priorPosture = frame.posture;
  if (reference && frame.posture < .99) {
    message('event', '分解参考 · 先演示抬床与靠枕，不计入个人记录');
    action = { start: performance.now(), positioning: true, from: frame.posture, token, p };
    await new Promise(r => resolver = r);
    if (token !== epoch) return;
  }
  message(reference ? 'event' : 'user', reference ? '分解动作参考 · 假设长者已同意 · 不计入成绩' : `【${manual ? '手动路径回放' : '喂食尝试'} ${state.attempts + 1}】分量 ${p.portion}% · 递勺 ${p.pace.toFixed(1)}s · 口前等待 ${p.pause.toFixed(1)}s`);
  action = { start: performance.now(), p, result, reference, token, custom: manual?.custom };
  await new Promise(r => resolver = r);
  if (token !== epoch) return;
  if (!reference) {
    state = { ...result.state, flags: { ...result.state.flags, swallowing: false } };
    message('elder', result.reply, result.behavior); message('coach', result.coach);
    if (!result.metrics.accepted) question();
    say(result.reply); refresh(result);
  } else message('coach', '参考动作：少量取食、持勺平稳、口前停顿；只在长者愿意时接受，随后撤勺等待。演示中的吞咽不是实际检测。');
  frame.phase = 'ready'; frame.progress = 0; frame.food = false; frame.accepted = false; frame.mouth = 0;
  if (reference) { frame.posture = priorPosture; frame.headTurn = state.flags.refusal ? .7 : .05; frame.brow = state.agitation / 100; frame.handBlock = state.flags.refusal ? .4 : 0; }
  lock(false);
}
function question() {
  const el = document.createElement('div'); el.className = 'coach-message observation-question';
  const h = document.createElement('strong'); h.textContent = '✦ 判断练习 · 转头、闭口、抬手意味着什么？'; el.append(h);
  const turn = state.turn;
  for (const [text, correct] of [['明确拒绝：撤勺，问清不适与意愿', true], ['只是闹脾气：追着嘴再送一次', false]]) { const b = document.createElement('button'); b.className = 'observation-choice'; b.textContent = text; b.addEventListener('click', () => {
    if (busy || demo || recording) return;
    el.querySelectorAll('button').forEach(n => n.disabled = true);
    if (correct) { observed.push({ turn, text }); message('coach', '观察正确。把勺子撤开、留出空间；回应温度与意愿后，再讨论下一步。'); }
    else message('coach', '转头和闭口表达不愿接受。不能追着嘴递勺；请先撤回并倾听。'); refresh();
  }); el.append(b); }
  $('chatFeed').append(el); $('chatFeed').scrollTop = $('chatFeed').scrollHeight;
}
function cancel() {
  scene.cancelInteraction(); epoch++; action = null; recording = null; demo = false;
  if (resolver) { resolver(); resolver = null; }
  frame = { ...frame, posture: state?.skills.position ? 1 : 0, progress: 0, phase: 'rest', food: false, mouth: 0, accepted: false, speech: '', speaker: null };
  if ('speechSynthesis' in window) speechSynthesis.cancel(); lock(false);
}
async function withdraw() {
  if (demo) { cancel(); restore(); return toast('已停止演示，个人记录不变。'); }
  const start = frame.progress, old = action;
  if (old && !old.reference) observed.push({ turn: state.turn, text: '在喂食动作中暂停观察并撤勺' });
  cancel(); withdrawn.push({ turn: state.turn, text: '主动撤勺暂停' });
  const token = epoch; lock(true);
  const result = { metrics: { accepted: false }, view: { headTurn: .7, brow: state.agitation / 100, handBlock: .5 } };
  action = { start: performance.now(), retract: start, result, p: parameters(), token };
  await new Promise(r => resolver = r); if (token !== epoch) return;
  lock(false); await send('我先把勺子拿开，让您歇一歇，我们不急。', 'rest');
}
function reset() {
  backup = null; cancel(); state = createState(); observed = []; withdrawn = []; checkedTurn = 0;
  setParameters(75, 1.5, .5); $('chatFeed').replaceChildren(); frame = { ...frame, posture: 0, phase: 'ready', headTurn: .75, brow: .8, handBlock: .4 };
  $('motionProgress').style.width = '0%'; $('motionTime').textContent = '0.0 s'; $('scoreRing').querySelector('span').textContent = '照护完成度';
  message('event', '案例 02 · 床旁午餐 · 烦躁长者进餐协助');
  message('coach', '目标不是把饭喂进去。请观察拒食动作，先倾听原因、确认温度与坐姿、尊重选择，再练习取食、递勺、等待与撤勺。');
  message('elder', INITIAL_MESSAGE, '身子歪靠枕头、略向下滑，双腿盖着薄被；抿嘴转头，手挡在胸前。');
  $('coachTitle').textContent = '不急着喂进去，先让她愿意被协助。'; $('coachText').textContent = '默认大勺、快递、短暂停顿会加重拒绝。先观察她的反应，改变你实际的动作。';
  $('sceneObservation').querySelector('strong').textContent = '歪靠下滑 · 先调整床上姿势 · 不直接喂食'; refresh(); setSuggestions(INITIAL_SUGGESTIONS);
}
async function autoDemo() {
  if (demo) { cancel(); restore(); return; }
  if (busy || recording) return toast('请先结束当前操作。');
  const saved = { state, observed, withdrawn, checkedTurn, nodes: [...$('chatFeed').childNodes], params: parameters(), suggestions: [...$('suggestions').children].map(b => b.textContent), title: $('coachTitle').textContent, text: $('coachText').textContent, obs: $('sceneObservation').querySelector('strong').textContent };
  reset(); backup = saved; demo = true; const token = epoch; lock(false); $('scoreRing').querySelector('span').textContent = '演示完成度';
  const step = async fn => { if (epoch !== token) return false; await fn(); await sleep(1000); return epoch === token; };
  if (!await step(() => feed(true))) return;
  if (!await step(() => send('我看到您转头、抿嘴了，我先把勺子拿开，休息一下。', 'rest', true))) return;
  if (!await step(() => send('我知道您现在不想吃，是温度太烫还是口味不合适？', 'listen', true))) return;
  if (!await step(() => send('我先说明一下，每次少一点，确认温度合适再喂，您随时可以停。', 'explain', true))) return;
  if (!await step(() => send('我慢慢抬高床头，整理靠枕，让您的头和身体靠稳、舒服些。', 'position', true))) return;
  if (!await step(() => send('您想自己吃，还是让我协助？愿意先试一小口吗？', 'choice', true))) return;
  setParameters(30, 3.5, 2);
  if (!await step(() => feed(true))) return;
  if (!await step(() => send('这口吞完了吗，现在舒服吗？我等您回应。', 'check', true))) return;
  openDialog('review'); $('dialogEyebrow').textContent = '示例复盘 · 非你的个人成绩'; restore(); toast('演示结束，已恢复个人记录。');
}
function restore() {
  const s = backup; backup = null; demo = false; if (!s) return;
  state = s.state; observed = s.observed; withdrawn = s.withdrawn; checkedTurn = s.checkedTurn;
  $('chatFeed').replaceChildren(...s.nodes); setParameters(s.params.portion, s.params.pace, s.params.pause); refresh(); setSuggestions(s.suggestions); lock(false);
  $('coachTitle').textContent = s.title; $('coachText').textContent = s.text; $('sceneObservation').querySelector('strong').textContent = s.obs; $('scoreRing').querySelector('span').textContent = '照护完成度';
  frame = { ...frame, posture: state.skills.position ? 1 : 0, progress: 0, phase: 'ready', food: false, mouth: 0, headTurn: state.flags.refusal ? .75 : .08, handBlock: state.flags.refusal ? .4 : .05, brow: state.agitation / 100, speech: '', speaker: null };
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
async function toggleRecording() {
  if (busy || demo) return;
  if (!recording) { recording = { start: performance.now(), samples: [{ t: 0, value: 0 }] }; frame.progress = 0; frame.food = true; frame.speech = ''; lock(false); toast('手动预演：递向口前停一下，再撤回碗边。提交后回放并评价。'); }
  else {
    const r = recording, a = analyzeTrajectory(r.samples);
    if (!a.valid) return toast('请完成从碗边递向口前、停留、撤回的完整路径。');
    if (a.amplitude < 70) return toast('尚未递到口前等待区，请完成路径再撤回。');
    const peak = a.amplitude / 100; const reachEnd = r.samples.find(s => s.value >= peak * .92).t;
    const p = { ...parameters(), pace: clamp(reachEnd - a.activeStart, 1, 6), pause: clamp(a.hold, 0, 5), steady: a.smoothness, source: 'drag' };
    recording = null; frame.progress = 0; lock(false);
    await feed(false, false, { params: p, custom: { samples: r.samples, start: a.activeStart, reachDuration: reachEnd - a.activeStart, peak } });
  }
}
function openDialog(kind) {
  const el = $('dialogContent'); el.replaceChildren(); const a = assessment();
  $('dialogEyebrow').textContent = kind === 'case' ? 'CASE 02 / 烦躁长者进餐协助' : '照护复盘 / 行为证据';
  const add = (tag, text, cls = '') => { const n = document.createElement(tag); n.textContent = text; n.className = cls; el.append(n); return n; };
  if (kind === 'case') {
    add('h2', '她拒绝的是这一口，还是被催促的感觉？');
    add('p', '周阿姨，76岁，歪靠在护理床枕头上，身体有些下滑，双腿盖着薄被。午餐时觉得食物烫、分量大，也想保留自己吃的选择。先调整为头颈和躯干有支撑的进食姿态，再协商协助方式。该虚构案例已假定软食符合既定照护安排，未设置吞咽障碍；不据此推导真实喂食处方。');
    add('h3', '你练习的是这些细节');
    const ul = add('ul', ''); for (const text of ['先说明协助步骤；通过“调整床头 / 靠枕”完成床上姿势准备，不直接给躺摊的长者喂食。', '确认温度及进食意愿；转头、抿嘴、抬手均是停止信号，不追着嘴递送。', '少量取食、持勺平稳，递到口前后停住等待回应。', '长者愿意时才接受；之后撤勺并等待，不能用倒计时当作吞咽检测。', '发现拒绝后修正沟通和实际操作，不以吃了几口评价护工。']) { const li = document.createElement('li'); li.textContent = text; ul.append(li); }
    add('h3', '手动操作'); add('p', '点击“手动递勺”后拖动持勺手腕，从碗边向口前移动，停留后撤回。提交后会回放并显示长者实际模拟反应。预演本身不计为入口。');
  } else {
    add('h2', '读懂拒绝，调整这一口的照护。'); add('p', `${a.score}/100 照护完成度 · ${state.turn}轮交互 · ${state.attempts}次尝试。分数基于七项过程证据，不是临床认证。`);
    for (const [key, label] of Object.entries(skills)) add('p', `${a.evidence[key] ? '✓ 已体现' : '○ 待练习'} · ${label}`);
    for (const h of state.history) { const d = add('div', '', 'review-item'); const t = document.createElement('strong'); t.textContent = `第${h.turn}轮 · ${h.user}`; const p = document.createElement('p'); p.textContent = h.reply; d.append(t, p); }
    if (!state.history.length) add('p', '还没有训练记录，请先尝试对话或操作。');
    if (state.history.length && !demo) { const b = add('button', '↓ 导出训练记录', 'primary-button export-button'); b.addEventListener('click', () => { const blob = new Blob([JSON.stringify({ scenario: 'feeding-agitated-elder', state, assessment: a, observed, withdrawn }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'carelab-feeding-training.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }); }
  }
  if (!$('detailDialog').open) $('detailDialog').showModal();
}
function animate(now) {
  const dt = Math.min(.06, (now - lastTime) / 1000); lastTime = now;
  if (action) {
    const t = (now - action.start) / 1000;
    const pose = action.positioning ? { ...frame, phase: 'position', progress: 0, food: false, mouth: 0, posture: action.from + (1 - action.from) * smooth(t / 3.2), handBlock: .1, total: 3.2 } : action.retract !== undefined ? { ...frame, phase: 'withdraw', progress: action.retract * (1 - smooth(t / .9)), total: .9 } : timeline(t, action.p, action.result, action.custom);
    frame = { ...frame, ...pose, portion: action.p.portion };
    $('motionProgress').style.width = `${clamp(t / pose.total) * 100}%`; $('motionTime').textContent = `${Math.min(t, pose.total).toFixed(1)} s`;
    if (t >= pose.total) { action = null; frame.progress = 0; if (resolver) { const r = resolver; resolver = null; r(); } }
  } else if (recording) {
    recording.samples.push({ t: (now - recording.start) / 1000, value: frame.progress });
    frame.phase = frame.progress > .8 ? 'wait' : frame.progress < .08 ? 'scoop' : 'approach';
    frame.accepted = false; frame.mouth = 0; frame.headTurn = state.flags.refusal ? .8 : .05; frame.handBlock = frame.progress > .5 && state.flags.refusal ? .8 : .15; frame.food = true; frame.portion = +$('amplitude').value;
    $('motionTime').textContent = `${((now - recording.start) / 1000).toFixed(1)} s`;
  } else { frame.progress *= Math.max(0, 1 - dt * 6); }
  if (now > speechEnd) { frame.speech = ''; frame.speaker = null; }
  frame.showGuides = $('guidesToggle').checked; frame.showTrails = $('trailsToggle').checked; frame.selected = !!recording;
  scene.update(frame); $('phaseChip').lastChild.textContent = ` ${recording ? '路径预演 · 不计入口' : labels[frame.phase]}`;
  document.querySelectorAll('.phase-step').forEach(n => n.classList.toggle('active', n.dataset.phase === frame.phase));
  requestAnimationFrame(animate);
}
$('sceneMount').addEventListener('wristinput', e => { if (busy || demo) return; if (!recording) { recording = { start: performance.now(), samples: [{ t: 0, value: 0 }] }; lock(false); } frame.progress = e.detail.value; frame.speech = ''; });
$('chatForm').addEventListener('submit', e => { e.preventDefault(); send($('messageInput').value); });
$('messageInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($('messageInput').value); } });
for (const id of ['amplitude', 'tempo', 'hold']) $(id).addEventListener('input', sync);
$('practiceButton').addEventListener('click', () => feed()); $('recordButton').addEventListener('click', toggleRecording); $('restButton').addEventListener('click', withdraw); $('referenceButton').addEventListener('click', () => feed(false, true));
$('positionButton').addEventListener('click', () => send('我慢慢抬高床头，整理靠枕，让您的头和身体靠稳、舒服些。', 'position'));
$('demoButton').addEventListener('click', autoDemo); $('resetButton').addEventListener('click', reset);
for (const id of ['caseButton', 'caseNav']) $(id).addEventListener('click', () => openDialog('case'));
for (const id of ['reviewButton', 'reviewNav']) $(id).addEventListener('click', () => openDialog('review'));
$('trainingNav').addEventListener('click', () => $('sceneMount').scrollIntoView({ behavior: 'smooth', block: 'center' }));
$('closeDialog').addEventListener('click', () => $('detailDialog').close());
$('voiceButton').addEventListener('click', () => { if (!('speechSynthesis' in window)) return toast('此浏览器没有语音朗读能力。'); voice = !voice; $('voiceButton').textContent = voice ? '语音 开' : '语音 关'; $('voiceButton').setAttribute('aria-pressed', String(voice)); if (!voice) speechSynthesis.cancel(); });
window.addEventListener('pagehide', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });
reset(); requestAnimationFrame(animate);
