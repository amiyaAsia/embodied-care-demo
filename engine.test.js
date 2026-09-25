import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, respond, evaluateMotion, INITIAL_MESSAGE, INITIAL_SUGGESTIONS, SCENARIO,
} from './engine.js';

const adapted = { amplitude: 55, tempo: 4.5, hold: 1.2, smoothness: 90, source: 'drag' };
const poor = { amplitude: 95, tempo: 1.5, hold: 4, smoothness: 25, source: 'preset' };
const prepare = () => {
  let state = createState();
  for (const action of ['explain', 'posture', 'slow', 'check']) {
    state = respond(state, { action }).state;
  }
  return state;
};
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('initial state and public scenario are ready for a seated imitation demo', () => {
  const state = createState();
  assert.deepEqual([state.turn, state.stage, state.trust, state.fatigue,
    state.comprehension, state.comfort, state.rounds, state.bestScore, state.latestMotion],
  [0, 'observe', 45, 22, 35, 58, 0, 0, null]);
  assert.deepEqual(state.skills, { explain: false, posture: false, pacing: false, check: false });
  assert.equal(state.completed, false);
  assert.deepEqual(state.history, []);
  assert.equal(INITIAL_SUGGESTIONS.length, 3);
  assert.ok(INITIAL_MESSAGE.length >= 15);
  for (const key of ['name', 'age', 'title', 'brief']) assert.ok(SCENARIO[key]);
  state.skills.explain = true;
  state.flags.needsRest = true;
  assert.equal(createState().skills.explain, false);
  assert.equal(createState().flags.needsRest, false);
});

test('dialogue and motion do not mutate frozen inputs, including nested history', () => {
  const original = freeze(prepare());
  const snapshot = JSON.stringify(original);
  const first = evaluateMotion(original, adapted);
  const frozenMotion = freeze(first.state);
  const dialogue = respond(frozenMotion, { action: 'rest' });
  const next = evaluateMotion(frozenMotion, adapted);
  assert.equal(JSON.stringify(original), snapshot);
  assert.notEqual(dialogue.state.history, frozenMotion.history);
  assert.notEqual(next.state.latestMotion, frozenMotion.latestMotion);
  dialogue.state.history.at(-2).metrics.score = -1;
  assert.ok(frozenMotion.history.at(-1).metrics.score >= 0);
});

test('Chinese explanations, consent, posture, pacing and checks recognize intent', () => {
  let state = respond(createState(), { text: '我示范手臂向前伸，停一下再收回来，可以吗？' }).state;
  assert.equal(state.skills.explain, true);
  assert.equal(state.flags.consent, true);
  state = respond(state, { text: '坐稳，双脚落地，肩膀放松。' }).state;
  state = respond(state, { text: '慢一点跟我，缩小幅度。' }).state;
  state = respond(state, { text: '现在感受怎么样，有没有疼？' }).state;
  assert.deepEqual(state.skills, { explain: true, posture: true, pacing: true, check: true });
  assert.ok(state.comprehension > 35);
});

test('pressure increases fatigue and lowers comfort; negative intent takes priority', () => {
  const before = createState();
  for (const text of ['快点跟上', '必须做，强迫也得做', '再高一点', '忍着疼继续']) {
    const { state, reply } = respond(before, { text, action: 'encourage' });
    assert.ok(state.fatigue > before.fatigue, text);
    assert.ok(state.comfort < before.comfort, text);
    assert.ok(state.trust < before.trust, text);
    assert.deepEqual(state.skills, before.skills);
    assert.match(reply, /跟不上|酸|停|紧张/);
    assert.equal(state.stage, 'adapt');
  }
});

test('rest and stopping for soreness reduce fatigue without treating caution as pressure', () => {
  const tired = evaluateMotion(prepare(), poor).state;
  for (const input of [{ action: 'rest' }, { text: '手臂酸累就停，休息一下，不要忍痛。' }]) {
    const result = respond(tired, input);
    assert.ok(result.state.fatigue < tired.fatigue);
    assert.ok(result.state.comfort > tired.comfort);
    assert.equal(result.state.flags.negative, false);
    assert.match(result.reply, /休息|歇|放下/);
  }
});

test('unknown text and invalid actions do not award skills or numeric rewards', () => {
  const before = createState();
  for (const input of [{ text: '今天天气不错' }, { text: '' }, { action: 'teleport' }, {}]) {
    const { state } = respond(before, input);
    assert.deepEqual(state.skills, before.skills);
    for (const key of ['trust', 'fatigue', 'comfort', 'comprehension']) {
      assert.equal(state[key], before[key]);
    }
    assert.equal(state.turn, 1);
    assert.equal(state.rounds, 0);
  }
});

test('adapted motion beats excessive, fast and jerky demonstration', () => {
  const state = prepare();
  const good = evaluateMotion(state, adapted);
  const bad = evaluateMotion(state, poor);
  assert.ok(good.metrics.score >= 75);
  assert.ok(good.metrics.score > bad.metrics.score + 20);
  assert.ok(good.metrics.matching > bad.metrics.matching);
  assert.ok(good.metrics.compensation < bad.metrics.compensation);
  assert.ok(good.metrics.lag < bad.metrics.lag);
  assert.ok(good.view.tremor < bad.view.tremor);
  assert.ok(bad.state.fatigue > good.state.fatigue);
  assert.match(bad.reply, /跟不上|酸|肩|倾/);
  assert.equal(bad.state.stage, 'adapt');
});

test('posture preparation reduces compensation, rough movement reduces score', () => {
  const before = createState();
  const after = respond(before, { action: 'posture' }).state;
  assert.ok(evaluateMotion(after, adapted).metrics.compensation
    < evaluateMotion(before, adapted).metrics.compensation);
  assert.ok(evaluateMotion(after, { ...adapted, smoothness: 10 }).metrics.score
    < evaluateMotion(after, adapted).metrics.score);
});

test('all dialogue skills alone cannot complete training', () => {
  let state = prepare();
  for (let index = 0; index < 5; index++) state = respond(state, { action: 'encourage' }).state;
  assert.equal(state.completed, false);
  assert.equal(state.rounds, 0);
  assert.equal(state.stage, 'prepare');
});

test('full flow completes after two suitable motions, and allows continued practice', () => {
  let state = prepare();
  state = evaluateMotion(state, adapted).state;
  assert.equal(state.completed, false);
  assert.equal(state.stage, 'practice');
  state = evaluateMotion(state, adapted).state;
  assert.equal(state.completed, true);
  assert.equal(state.stage, 'completed');
  assert.equal(state.rounds, 2);
  assert.ok(state.latestMotion.metrics.score >= 75);
  const best = state.bestScore;
  state = evaluateMotion(state, poor).state;
  assert.equal(state.rounds, 3);
  assert.equal(state.completed, false);
  assert.equal(state.stage, 'adapt');
  assert.equal(state.bestScore, best);
});

test('completion requires each required skill, a current good score and low fatigue', () => {
  const ready = evaluateMotion(evaluateMotion(prepare(), adapted).state, adapted).state;
  for (const key of ['explain', 'posture', 'check']) {
    const state = { ...ready, skills: { ...ready.skills, [key]: false } };
    assert.equal(respond(state, { text: '嗯' }).state.completed, false);
  }
  assert.equal(respond({ ...ready, fatigue: 75 }, {}).state.completed, false);
  assert.equal(evaluateMotion(ready, poor).state.completed, false);
});

test('fatigue accumulates across practice and rest enables recovery', () => {
  let state = prepare();
  const initial = state.fatigue;
  for (let index = 0; index < 12; index++) state = evaluateMotion(state, adapted).state;
  assert.ok(state.fatigue > initial);
  const tiredScore = evaluateMotion(state, adapted).metrics.score;
  state = respond(state, { action: 'rest' }).state;
  assert.ok(evaluateMotion(state, adapted).metrics.score > tiredScore);
});

test('motion and state values clamp safely, including non-finite or absent parameters', () => {
  for (const motion of [
    { amplitude: 999, tempo: -3, hold: 99, smoothness: -5 },
    { amplitude: -100, tempo: 99, hold: -3, smoothness: 999 },
    { amplitude: NaN, tempo: Infinity, hold: -Infinity, smoothness: 'bad' },
    {},
  ]) {
    const result = evaluateMotion(createState(), motion);
    for (const key of ['score', 'matching', 'compensation', 'amplitude']) {
      assert.ok(result.metrics[key] >= 0 && result.metrics[key] <= 100, key);
    }
    assert.ok(result.metrics.tempo >= 1.5 && result.metrics.tempo <= 8);
    assert.ok(result.metrics.hold >= 0 && result.metrics.hold <= 4);
    for (const key of ['maxReach', 'compensation', 'tremor']) {
      assert.ok(result.view[key] >= 0 && result.view[key] <= 1, key);
    }
    assert.ok(Number.isFinite(result.view.delay) && result.view.delay >= 0);
  }
  let state = createState();
  for (let i = 0; i < 40; i++) state = respond(state, { text: '忍着，快点' }).state;
  for (let i = 0; i < 40; i++) state = respond(state, { action: 'rest' }).state;
  for (const key of ['trust', 'fatigue', 'comprehension', 'comfort', 'bestScore']) {
    assert.ok(state[key] >= 0 && state[key] <= 100, key);
  }
});

test('history shares one schema and each result supplies three contextual suggestions', () => {
  const dialogue = respond(createState(), { action: 'explain' });
  const motion = evaluateMotion(dialogue.state, adapted);
  assert.deepEqual(motion.state.history.map(({ kind, turn }) => [kind, turn]),
    [['dialogue', 1], ['motion', 2]]);
  for (const result of [dialogue, motion]) {
    assert.equal(result.suggestions.length, 3);
    assert.ok(result.suggestions.every(value => typeof value === 'string' && value.length > 0));
    assert.ok(result.reply.length >= 15 && result.reply.length <= 60);
    assert.equal(typeof result.behavior, 'string');
    assert.equal(typeof result.coach, 'string');
    const entry = result.state.history.at(-1);
    for (const key of ['user', 'reply', 'coach']) assert.equal(typeof entry[key], 'string');
    assert.equal(entry.reply, result.reply);
  }
  assert.deepEqual(motion.state.history.at(-1).metrics, motion.metrics);
});

const noEvidence = () => ({
  negative: false, explain: false, posture: false, pacing: false,
  check: false, observation: false, rest: false,
});

test('negated instructions do not earn positive skills or rest rewards', () => {
  const before = createState();
  for (const text of [
    '不用坐稳，也不用双脚落地', '不要肩膀放松', '双脚不用落地',
    '不需要向前伸，也不要收回来', '不用慢一点，也不用缩小幅度',
    '不要问感受怎么样，也别问疼不疼', '不用休息，也不必暂停',
    '不用坐稳和双脚落地以及肩膀放松',
  ]) {
    const result = respond(before, { text });
    assert.deepEqual(result.evidence, noEvidence(), text);
    assert.deepEqual(result.state.skills, before.skills, text);
    for (const key of ['trust', 'comprehension', 'comfort', 'fatigue']) {
      assert.equal(result.state[key], before[key], `${text}: ${key}`);
    }
  }
});

test('consent and explanation are separate; explanation needs actual motion content', () => {
  assert.equal(SCENARIO.name, '周阿姨');
  for (const text of ['好吗？', '您愿意试试吗？', '可以吗？', '我解释一下']) {
    const result = respond(createState(), { text });
    assert.equal(result.evidence.explain, false, text);
    assert.equal(result.state.skills.explain, false, text);
  }
  assert.equal(respond(createState(), { text: '好吗？' }).state.flags.consent, true);
  assert.equal(respond(createState(), { text: '不愿意' }).state.flags.consent, false);
  const result = respond(createState(), { text: '手臂向前伸，停一下，再收回来。' });
  assert.equal(result.evidence.explain, true);
  assert.equal(result.state.skills.explain, true);
});

test('explicit actions remain valid despite negated text, unless pressure takes priority', () => {
  for (const [action, key, text] of [
    ['explain', 'explain', '不用向前伸'], ['posture', 'posture', '不用坐稳'],
    ['slow', 'pacing', '不要慢一点'], ['check', 'check', '不用问感觉怎么样'],
    ['rest', 'rest', '不用休息'],
  ]) {
    const result = respond(createState(), { text, action });
    assert.equal(result.evidence[key], true, action);
    if (key !== 'rest') assert.equal(result.state.skills[key], true, action);
    else assert.ok(result.state.fatigue < 22);
  }
});

test('pressure and dismissal suppress all positive evidence even with explicit actions', () => {
  const before = evaluateMotion(createState(), poor).state;
  for (const text of [
    '跟不上也必须继续，别管感觉', '我看到你耸肩，快点跟上，感觉怎么样？',
    '别管前倾和手臂疼，继续做', '忽略感受，坐稳慢一点，向前伸再收回来',
  ]) {
    for (const action of ['none', 'explain', 'posture', 'slow', 'check', 'rest']) {
      const result = respond(before, { text, action });
      assert.deepEqual(result.evidence, { ...noEvidence(), negative: true }, text);
      assert.deepEqual(result.state.skills, before.skills, text);
      assert.ok(result.state.fatigue > before.fatigue, text);
    }
  }
});

test('check recognizes requests for sensations rather than mentions or unrelated questions', () => {
  for (const text of [
    '现在感受怎么样？', '有没有疼？', '手臂酸不酸？', '您累不累？',
    '疼吗？', '有没有不舒服？', '请告诉我现在的感受', '哪里疼？',
  ]) {
    assert.equal(respond(createState(), { text }).evidence.check, true, text);
  }
  for (const text of [
    '感觉不错', '我知道你手臂疼', '疼是一个字', '我感觉今天不错，你好吗？',
    '不用告诉我感受', '别问有没有疼', '有没有示范？', '如果疼就休息',
  ]) {
    const result = respond(createState(), { text });
    assert.equal(result.evidence.check, false, text);
    assert.equal(result.state.skills.check, false, text);
  }
});

test('observation requires prior practice and an actual stated observation, not a keyword', () => {
  const practiced = evaluateMotion(createState(), poor).state;
  for (const text of ['我看到您刚才耸肩了', '刚才身体前倾了', '您跟不上我的动作了', '我注意到您前倾了']) {
    assert.equal(respond(createState(), { text }).evidence.observation, false, text);
    const result = respond(practiced, { text });
    assert.equal(result.evidence.observation, true, text);
    assert.deepEqual(result.state.skills, practiced.skills, text);
  }
  for (const text of [
    '耸肩、前倾、跟不上', '如果跟不上就告诉我', '注意不要耸肩',
    '我没看到您耸肩', '刚才没有前倾', '您没有跟不上', '您会不会跟不上？',
    '我看到你耸肩，但忽略就好', '不用管跟不上',
  ]) {
    assert.equal(respond(practiced, { text }).evidence.observation, false, text);
  }
});

test('negation scope preserves independent affirmative clauses and protective prohibitions', () => {
  const result = respond(createState(), {
    text: '不用向前伸，但请坐稳，双脚落地。不要忍痛，酸累就停。现在感觉怎么样？',
  });
  assert.deepEqual(result.evidence, {
    ...noEvidence(), posture: true, check: true, rest: true,
  });
  for (const text of ['不要催快，慢一点', '不要强迫，先休息', '不要忽略感受，现在疼不疼？']) {
    assert.equal(respond(createState(), { text }).evidence.negative, false, text);
  }
  const practiced = evaluateMotion(createState(), poor).state;
  assert.equal(respond(practiced, {
    text: '我看到您刚才耸肩了，我们慢一点。',
  }).evidence.observation, true);
});

test('evidence is current-turn, independent plain data, and motion invents no dialogue evidence', () => {
  const original = freeze(prepare());
  const snapshot = JSON.stringify(original);
  const unknown = respond(original, { text: '嗯' });
  assert.deepEqual(unknown.evidence, noEvidence());
  const repeated = respond(original, { action: 'posture' });
  assert.equal(repeated.evidence.posture, true);
  const motion = evaluateMotion(original, adapted);
  assert.deepEqual(motion.evidence, noEvidence());
  unknown.evidence.check = true;
  assert.equal(motion.evidence.check, false);
  assert.equal(JSON.stringify(original), snapshot);
  assert.deepEqual(respond(original, {}).evidence, noEvidence());
});
