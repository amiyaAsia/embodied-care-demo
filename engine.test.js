import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, respond, evaluateFeeding, INITIAL_MESSAGE, INITIAL_SUGGESTIONS, SCENARIO,
} from './engine.js';

const good = { portion: 30, pace: 4, pause: 2, source: 'drag', steady: 90 };
const prepare = () => ['explain', 'position', 'listen', 'choice']
  .reduce((state, action) => respond(state, { action }).state,
    respond(createState(), { text: '确认温度合适' }).state);
const emptyEvidence = () => ({ negative: false, explain: false, position: false,
  listen: false, choice: false, check: false, rest: false });
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function unit(value) { assert.ok(Number.isFinite(value) && value >= 0 && value <= 1); }

test('exact initial state and public scenario', () => {
  assert.deepEqual(createState(), {
    turn: 0, stage: 'observe', trust: 30, agitation: 78, comfort: 35, readiness: 15,
    bites: 0, attempts: 0,
    skills: { explain: false, position: false, listen: false, choice: false, check: false },
    flags: { consent: false, refusal: true, swallowing: false, temperatureResolved: false },
    history: [], latestFeeding: null, completed: false,
  });
  assert.match(INITIAL_MESSAGE, /太烫了，别催我/);
  assert.equal(INITIAL_SUGGESTIONS.length, 3);
  assert.match(SCENARIO.brief, /已确认适合的软食/);
  const state = createState();
  state.skills.listen = true;
  state.history.push({});
  assert.equal(createState().skills.listen, false);
  assert.deepEqual(createState().history, []);
});

test('initial feeding always refuses, even ideal settings and zero portion', () => {
  for (const portion of [0, 20, 45, 100]) {
    const result = evaluateFeeding(createState(), { portion, pace: 6, pause: 5, steady: 100 });
    assert.equal(result.metrics.accepted, false);
    assert.equal(result.state.bites, 0);
    assert.equal(result.view.opening, 0);
    assert.equal(result.view.handBlock, 1);
    assert.match(result.behavior, /转头、抿嘴、抬手/);
    assert.match(result.behavior, /未入口/);
    assert.equal(result.state.flags.swallowing, false);
  }
});

test('natural positive multi-turn dialogue prepares and obtains consent', () => {
  let state = createState();
  for (const text of [
    '我知道您不想吃，是什么原因，温度太烫了吗？',
    '先少一点，确认温度合适再喂，您随时可以停。',
    '先抬高床头，整理靠枕，让您靠舒服些。',
    '您想自己吃还是我帮您？愿意先试一小口吗？',
  ]) state = respond(state, { text }).state;
  for (const key of ['explain', 'position', 'listen', 'choice']) assert.equal(state.skills[key], true, key);
  assert.equal(state.flags.consent, true);
  assert.ok(state.agitation < 55);
  assert.ok(state.trust > 30);
  assert.equal(state.stage, 'ready');
  assert.equal(state.completed, false);
  assert.equal(evaluateFeeding(state, good).metrics.accepted, true);
});

test('listening gradually reveals temperature, large spoon, autonomy and noise', () => {
  let state = createState();
  const replies = [];
  for (let i = 0; i < 4; i++) {
    const result = respond(state, { action: 'listen' });
    state = result.state;
    replies.push(result.reply);
  }
  assert.match(replies[0], /太烫了，别催我/);
  assert.match(replies[1], /勺太大/);
  assert.match(replies[2], /想自己吃/);
  assert.match(replies[3], /太吵/);
  assert.equal(new Set(replies).size, 4);
});

test('negated positive instructions do not reward keywords', () => {
  for (const text of [
    '不用坐稳，也不用抬起床头', '床头不要抬起', '不要少一点和慢慢来',
    '不用解释软食进食过程', '解释软食是不需要的', '别问温度怎么样',
    '不要问吞完了吗，也不用问舒服吗', '不用休息或暂停',
    '不要给选择，不用问愿意试试吗', '我不理解您不想吃',
  ]) {
    const result = respond(createState(), { text });
    assert.deepEqual(result.evidence, emptyEvidence(), text);
    assert.deepEqual(result.state.skills, createState().skills, text);
    assert.equal(result.state.agitation, 78, text);
    assert.equal(result.state.flags.consent, false, text);
  }
});

test('pressure overrides every shortcut and revokes consent', () => {
  for (const text of ['快点吃', '必须张嘴', '强喂也得吃', '强行入口', '忍着烫吃下去',
    '别管她不想吃，赶紧喂', '坐稳慢慢来，但不吃也得吃', '我就催你吃']) {
    for (const action of ['none', 'explain', 'position', 'listen', 'choice', 'check', 'rest']) {
      const before = prepare();
      const result = respond(before, { text, action });
      assert.deepEqual(result.evidence, { ...emptyEvidence(), negative: true }, text);
      assert.ok(result.state.agitation > before.agitation, text);
      assert.ok(result.state.trust < before.trust, text);
      assert.equal(result.state.flags.consent, false);
      assert.equal(evaluateFeeding(result.state, good).metrics.accepted, false);
    }
  }
});

test('protective prohibitions and acknowledging refusal are not coercion', () => {
  for (const text of ['不要强喂，先休息', '不用忍着烫，先暂停', '不催您，少一点慢慢来',
    '不会强迫您，您愿意试一口吗？', '不要强行入口，您不想吃我们就暂停']) {
    const result = respond(createState(), { text });
    assert.equal(result.evidence.negative, false, text);
    assert.ok(result.state.agitation <= 78, text);
  }
  assert.equal(respond(createState(), { text: '我理解您烦躁，现在不想吃。' }).evidence.listen, true);
  const result = respond(createState(), { text: '不用喂，但请坐稳。您舒不舒服？' });
  assert.equal(result.evidence.position, true);
  assert.equal(result.evidence.check, true);
});

test('explicit actions are fixed shortcuts unless coercive text overrides them', () => {
  for (const action of ['explain', 'position', 'listen', 'choice', 'check', 'rest']) {
    const result = respond(createState(), { text: '不用做这些', action });
    assert.equal(result.evidence[action], true, action);
  }
  const state = prepare();
  assert.equal(state.flags.consent, true);
  assert.equal(state.stage, 'ready');
});

test('consent needs preparation and a request; early request is not banked', () => {
  let state = respond(createState(), { action: 'choice' }).state;
  assert.equal(state.flags.consent, false);
  state = respond(state, { text: '已经放凉' }).state;
  for (const action of ['listen', 'position', 'explain']) state = respond(state, { action }).state;
  assert.equal(state.flags.consent, false);
  assert.equal(evaluateFeeding(state, good).metrics.accepted, false);
  for (const text of ['不愿意', '不用问愿意试一口吗', '您已经同意了']) {
    assert.equal(respond(state, { text }).state.flags.consent, false, text);
  }
  assert.equal(respond(state, { text: '您愿意试一小口吗？' }).state.flags.consent, true);
});

test('every preparation gate and the strict agitation threshold are required', () => {
  const ready = prepare();
  for (const key of ['explain', 'position', 'listen', 'choice']) {
    const state = { ...ready, skills: { ...ready.skills, [key]: false } };
    assert.equal(evaluateFeeding(state, good).metrics.accepted, false, key);
  }
  assert.equal(evaluateFeeding({ ...ready, agitation: 55 }, good).metrics.accepted, false);
  assert.equal(evaluateFeeding({ ...ready, agitation: 54.99 }, good).metrics.accepted, true);
  assert.equal(evaluateFeeding({ ...ready, flags: { ...ready.flags, consent: false } }, good).metrics.accepted, false);
});

test('portion, pace and pause individually reject at exact boundaries', () => {
  const ready = prepare();
  const edge = { ...good, portion: 45, pace: 2.8, pause: 1.5 };
  assert.equal(evaluateFeeding(ready, edge).metrics.accepted, true);
  for (const params of [{ portion: 45.001 }, { pace: 2.799 }, { pause: 1.499 }]) {
    const result = evaluateFeeding(ready, { ...edge, ...params });
    assert.equal(result.metrics.accepted, false);
    assert.equal(result.view.opening, 0);
    assert.equal(result.state.flags.consent, false);
  }
});

test('poor parameters raise pressure and lower process quality', () => {
  const ready = prepare();
  const better = evaluateFeeding(ready, good);
  const poor = evaluateFeeding(ready, { portion: 95, pace: 1, pause: 0, steady: 0 });
  assert.ok(poor.metrics.pressure > better.metrics.pressure);
  assert.ok(poor.metrics.score < better.metrics.score);
  assert.ok(poor.metrics.acceptance < better.metrics.acceptance);
  assert.ok(poor.state.agitation > better.state.agitation);
  assert.match(poor.reply, /太大/);
});

test('refusal can be repaired through listening and renewed choice', () => {
  let state = evaluateFeeding(prepare(), { ...good, portion: 90 }).state;
  assert.equal(state.flags.refusal, true);
  state = respond(state, { action: 'listen' }).state;
  state = respond(state, { action: 'choice' }).state;
  const result = evaluateFeeding(state, good);
  assert.equal(result.metrics.accepted, true);
  assert.equal(result.state.attempts, 2);
  assert.equal(result.state.bites, 1);
});

test('acceptance starts waiting; swallowing is never measured or auto-ended', () => {
  const result = evaluateFeeding(prepare(), good);
  assert.equal(result.state.flags.swallowing, true);
  assert.equal(result.state.stage, 'swallowing');
  assert.match(result.state.history.at(-1).coach, /等待吞咽/);
  assert.doesNotMatch(result.reply, /已吞完|已经咽完|检测/);
  const check = respond(result.state, { action: 'check' });
  assert.equal(check.state.flags.swallowing, true);
  const premature = evaluateFeeding(result.state, good);
  assert.equal(premature.metrics.accepted, false);
  assert.equal(premature.state.bites, 1);
  assert.match(premature.reply, /慢慢咽/);
});

test('completion requires a success followed by check and records its feeding turn', () => {
  let state = respond(prepare(), { action: 'check' }).state;
  assert.equal(state.completed, false);
  state = evaluateFeeding(state, good).state;
  assert.equal(state.completed, false);
  assert.equal(respond(state, { text: '今天天气不错' }).state.completed, false);
  const result = respond(state, { text: '您吞完了吗，现在舒服吗？' });
  assert.equal(result.state.completed, true);
  assert.equal(result.state.stage, 'completed');
  assert.equal(result.state.history.at(-1).afterFeedingTurn, state.latestFeeding.turn);
  assert.equal(result.state.history.at(-1).evidence.check, true);
  assert.equal(respond(state, { text: '不要问吞完了吗' }).state.completed, false);
  assert.equal(respond(result.state, { text: '必须继续吃' }).state.completed, false);
});

test('checks after refusals do not complete; later attempts require a fresh post-check', () => {
  const refused = evaluateFeeding(prepare(), { ...good, pace: 1 }).state;
  assert.equal(respond(refused, { action: 'check' }).state.completed, false);
  let state = respond(evaluateFeeding(prepare(), good).state, { action: 'check' }).state;
  // The host owns the animation end; the engine has no timers or real sensing.
  state = { ...state, flags: { ...state.flags, swallowing: false } };
  const next = evaluateFeeding(state, good);
  assert.equal(next.metrics.accepted, true);
  assert.equal(next.state.completed, false);
  assert.equal(next.state.bites, 2);
  assert.equal(respond(next.state, { action: 'check' }).state.completed, true);
});

test('no meal-volume score and steady/source cannot bypass refusal', () => {
  const ready = prepare();
  assert.equal(evaluateFeeding(ready, good).metrics.score,
    evaluateFeeding({ ...ready, bites: 100, attempts: 200 }, good).metrics.score);
  assert.equal(evaluateFeeding(ready, { ...good, portion: 10 }).metrics.score,
    evaluateFeeding(ready, { ...good, portion: 40 }).metrics.score);
  for (const source of ['preset', 'drag']) {
    assert.equal(evaluateFeeding(createState(), { ...good, source, steady: 100 }).metrics.accepted, false);
  }
  assert.ok(evaluateFeeding(ready, { ...good, steady: 10 }).metrics.pressure
    > evaluateFeeding(ready, { ...good, steady: 100 }).metrics.pressure);
});

test('rest calms but does not grant consent; unknown input earns no rewards', () => {
  const result = respond(prepare(), { action: 'rest' });
  assert.ok(result.state.agitation < prepare().agitation);
  assert.equal(result.state.flags.consent, false);
  for (const input of [{}, { action: 'teleport' }, { text: null }, { text: '你好' }]) {
    const result = respond(createState(), input);
    assert.deepEqual(result.evidence, emptyEvidence());
    assert.equal(result.state.agitation, 78);
    assert.equal(result.state.trust, 30);
    assert.equal(result.state.turn, 1);
  }
});

test('parameters, indicators and view values clamp including invalid values', () => {
  for (const params of [{ portion: 999, pace: -3, pause: 99, steady: -5 },
    { portion: -999, pace: 99, pause: -5, steady: 999 },
    { portion: NaN, pace: Infinity, pause: -Infinity, steady: 'bad', source: 'bad' }, {}]) {
    const result = evaluateFeeding(createState(), params);
    for (const key of ['score', 'acceptance', 'pressure', 'portion']) {
      assert.ok(Number.isFinite(result.metrics[key]) && result.metrics[key] >= 0 && result.metrics[key] <= 100);
    }
    assert.ok(result.metrics.pace >= 1 && result.metrics.pace <= 6);
    assert.ok(result.metrics.pause >= 0 && result.metrics.pause <= 5);
    for (const key of ['headTurn', 'brow', 'handBlock', 'opening']) unit(result.view[key]);
  }
  let state = createState();
  for (let i = 0; i < 40; i++) state = respond(state, { text: '快点吃，忍着' }).state;
  for (let i = 0; i < 40; i++) state = respond(state, { action: 'rest' }).state;
  for (const key of ['agitation', 'trust', 'comfort', 'readiness']) {
    assert.ok(state[key] >= 0 && state[key] <= 100, key);
  }
  const dialogue = respond(state, { action: 'listen' });
  Object.values(dialogue.view).forEach(unit);
});

test('immutable input and independently owned nested result/history data', () => {
  const original = freeze(prepare());
  const snapshot = JSON.stringify(original);
  const feeding = evaluateFeeding(original, good);
  assert.equal(JSON.stringify(original), snapshot);
  feeding.metrics.score = -1;
  feeding.view.opening = -1;
  assert.ok(feeding.state.history.at(-1).metrics.score >= 0);
  assert.ok(feeding.state.latestFeeding.view.opening >= 0);
  const frozen = freeze(feeding.state);
  const dialogue = respond(frozen, { action: 'check' });
  const refused = evaluateFeeding(frozen, good);
  dialogue.state.history.at(-2).metrics.score = -2;
  dialogue.state.latestFeeding.metrics.score = -3;
  dialogue.evidence.check = false;
  assert.ok(frozen.history.at(-1).metrics.score >= 0);
  assert.ok(refused.state.history.at(-2).metrics.score >= 0);
  assert.equal(dialogue.state.history.at(-1).evidence.check, true);
});

test('history schema, concise Chinese replies and contextual suggestions', () => {
  const results = ['none', 'explain', 'position', 'listen', 'choice', 'check', 'rest']
    .map(action => respond(createState(), { action }));
  results.push(respond(createState(), { text: '强喂' }), respond(prepare(), { action: 'choice' }),
    evaluateFeeding(createState(), good), evaluateFeeding(prepare(), good),
    evaluateFeeding(prepare(), { ...good, portion: 100 }),
    evaluateFeeding(prepare(), { ...good, pace: 1 }),
    evaluateFeeding(prepare(), { ...good, pause: 0 }),
    respond(evaluateFeeding(prepare(), good).state, { action: 'check' }));
  for (const result of results) {
    assert.ok(result.reply.length >= 20 && result.reply.length <= 70, result.reply);
    assert.equal(result.suggestions.length, 3);
    assert.ok(result.suggestions.every(value => typeof value === 'string' && value.length));
    const entry = result.state.history.at(-1);
    assert.equal(entry.reply, result.reply);
    assert.equal(entry.coach, result.coach);
    assert.equal(entry.turn, result.state.turn);
    assert.equal(typeof entry.user, 'string');
    if (result.metrics) {
      assert.equal(entry.kind, 'feeding');
      assert.deepEqual(entry.metrics, result.metrics);
    } else assert.deepEqual(Object.keys(result.evidence), Object.keys(emptyEvidence()));
  }
});

test('temperature confirmation recognizes positive phrases and the exact demo line', () => {
  for (const text of ['确认温度合适', '确认不烫', '已经放凉', '温度合适了',
    '先少一点，确认温度合适再喂，您随时可以停。']) {
    const original = freeze(createState());
    const result = respond(original, { text });
    assert.equal(result.state.flags.temperatureResolved, true, text);
    assert.equal(original.flags.temperatureResolved, false);
    assert.equal(result.state.flags.consent, false);
  }
  for (const text of ['不用确认温度合适', '不要确认不烫', '没有确认不烫',
    '还没有已经放凉', '温度合适了是不可能的', '已经放凉了吗？',
    '确认温度合适？', '确认不烫?', '如果温度合适了再喂', '确认不烫，必须吃']) {
    assert.equal(respond(createState(), { text, action: 'explain' }).state.flags.temperatureResolved, false, text);
  }
});

test('soothing and all shortcuts cannot bypass unresolved temperature', () => {
  let state = ['explain', 'position', 'listen', 'choice', 'rest', 'listen', 'choice']
    .reduce((current, action) => respond(current, { action }).state, createState());
  assert.ok(state.agitation < 55);
  assert.equal(state.flags.temperatureResolved, false);
  assert.equal(state.flags.consent, false);
  assert.match(respond(state, { action: 'choice' }).reply, /烫/);
  // Even externally supplied consent cannot bypass the temperature gate.
  state = { ...state, flags: { ...state.flags, consent: true } };
  for (let i = 0; i < 2; i++) {
    const result = evaluateFeeding(state, good);
    assert.equal(result.metrics.accepted, false);
    assert.equal(result.state.bites, 0);
    assert.match(result.reply, /烫/);
    state = result.state;
  }
  state = respond(state, { text: '确认不烫' }).state;
  state = respond(state, { action: 'choice' }).state;
  assert.equal(evaluateFeeding(state, good).metrics.accepted, true);
});

test('zero portion never counts as a bite even with full preparation', () => {
  for (const portion of [0, -10]) {
    const result = evaluateFeeding(prepare(), { ...good, portion });
    assert.equal(result.metrics.portion, 0);
    assert.equal(result.metrics.accepted, false);
    assert.equal(result.state.bites, 0);
    assert.equal(result.state.flags.swallowing, false);
    assert.equal(result.view.opening, 0);
    assert.match(result.reply, /空/);
    assert.equal(result.state.history.at(-1).metrics.accepted, false);
  }
});

test('post-check replies distinguish waiting from host-finished swallowing', () => {
  const accepted = evaluateFeeding(prepare(), good).state;
  const waiting = respond(accepted, { action: 'check' });
  assert.match(waiting.reply, /等一等|慢慢咽/);
  assert.doesNotMatch(waiting.reply, /已经咽下/);
  const ended = { ...accepted, flags: { ...accepted.flags, swallowing: false } };
  const checked = respond(ended, { action: 'check' });
  assert.match(checked.reply, /^这口已经咽下了/);
  assert.equal(checked.state.flags.swallowing, false);
  assert.equal(checked.state.completed, true);
  assert.equal(checked.state.history.at(-1).reply, checked.reply);
  assert.equal(checked.state.history.at(-1).afterFeedingTurn, accepted.latestFeeding.turn);
});

test('ready without consent suggests choice; accepted suggests a usable check before and after animation', () => {
  const ready = prepare();
  const noConsent = { ...ready, flags: { ...ready.flags, consent: false, refusal: true } };
  const suggested = respond(noConsent, {}).suggestions[0];
  const renewed = respond(noConsent, { text: suggested });
  assert.equal(renewed.evidence.choice, true);
  assert.equal(renewed.state.flags.consent, true);
  const feeding = evaluateFeeding(ready, good);
  assert.equal(respond(feeding.state, { text: feeding.suggestions[0] }).evidence.check, true);
  const ended = { ...feeding.state, flags: { ...feeding.state.flags, swallowing: false } };
  const result = respond(ended, {});
  const checked = respond(result.state, { text: result.suggestions[0] });
  assert.equal(checked.evidence.check, true);
  assert.equal(checked.state.completed, true);
});

test('bedside posture wording and human coach feedback omit table, app and numeric gates', () => {
  assert.match(SCENARIO.brief, /歪靠护理床上/);
  assert.match(INITIAL_MESSAGE, /歪靠在护理床上/);
  assert.match(INITIAL_SUGGESTIONS.join(''), /抬高床头.*整理靠枕/);
  const position = respond(createState(), { action: 'position' });
  assert.match(position.reply, /床头.*靠枕/);
  assert.match(position.behavior, /半坐卧/);
  assert.doesNotMatch(JSON.stringify(position), /餐桌|桌前|双脚|落地|\d+度/);
  assert.equal(respond(createState(), { text: '抬起床头' }).evidence.position, true);
  const waiting = evaluateFeeding(prepare(), good).state;
  const ended = { ...waiting, flags: { ...waiting.flags, swallowing: false } };
  const results = ['none', 'explain', 'position', 'listen', 'choice', 'check', 'rest']
    .map(action => respond(createState(), { action }));
  results.push(evaluateFeeding(createState(), good), evaluateFeeding(prepare(), good),
    evaluateFeeding(prepare(), { ...good, portion: 0 }),
    evaluateFeeding(prepare(), { ...good, portion: 99 }),
    evaluateFeeding(waiting, good), respond(waiting, { action: 'check' }),
    respond(ended, { action: 'check' }));
  for (const result of results) {
    assert.doesNotMatch(result.coach, /app|公式|阈值|[≤≥]|\d/i);
    assert.doesNotMatch([result.reply, result.behavior, result.coach, ...result.suggestions].join(''), /餐桌|桌前|双脚|落地|\d+度/);
    assert.ok(result.reply.length >= 20 && result.reply.length <= 70, result.reply);
  }
});

test('pillow support and bed positioning recognize affirmative but not negated instructions', () => {
  for (const text of ['整理靠枕', '我帮您整理靠枕，让您靠舒服些。',
    '用靠枕支撑身体', '先抬高床头', '床头抬起一些', '先坐稳']) {
    const result = respond(createState(), { text });
    assert.equal(result.evidence.position, true, text);
    assert.equal(result.state.skills.position, true, text);
    assert.match(result.behavior, /半坐卧/);
  }
  for (const text of ['不用整理靠枕', '不要靠枕支撑', '靠枕支撑是不需要的',
    '没有整理靠枕', '不用抬高床头和整理靠枕', '别整理靠枕，也不用靠枕支撑']) {
    const result = respond(createState(), { text });
    assert.equal(result.evidence.position, false, text);
    assert.equal(result.state.skills.position, false, text);
    assert.equal(result.state.comfort, createState().comfort, text);
  }
  assert.equal(respond(createState(), {
    text: '不用整理靠枕，但请抬高床头。',
  }).evidence.position, true);
});

test('missing position explicitly refuses entry and can be repaired with pillow support', () => {
  const ready = prepare();
  const unpositioned = { ...ready, skills: { ...ready.skills, position: false } };
  for (const before of [createState(), unpositioned]) {
    const result = evaluateFeeding(freeze(before), good);
    assert.match(result.reply, /身子还歪着，先帮我靠舒服/);
    assert.match(result.behavior, /未入口/);
    assert.equal(result.metrics.accepted, false);
    assert.equal(result.view.opening, 0);
    assert.equal(result.state.bites, 0);
    assert.equal(result.state.flags.swallowing, false);
    assert.equal(result.state.history.at(-1).reply, result.reply);
  }
  let state = evaluateFeeding(unpositioned, good).state;
  state = respond(state, { text: '整理靠枕，用靠枕支撑身体。' }).state;
  state = respond(state, { action: 'choice' }).state;
  assert.equal(evaluateFeeding(state, good).metrics.accepted, true);
});
