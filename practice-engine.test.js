import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASES, createEncounter, respond, evaluateServing, completeServing, getSuggestions,
} from './practice-engine.js';

const EN = {
  observe: 'I notice you are turning away. What is worrying you?',
  permission: 'Would you be willing to have my help with a little food?',
  choice: 'Would you prefer to pause, eat yourself, or have my help?',
  plan: 'I will check and follow the fictional care plan CP-M01.',
  position: 'I will raise the bed and arrange supportive pillows.',
  temperature: 'I will check the food temperature and confirm it has cooled.',
  pause: 'We will pause now. I will withdraw the spoon and respect your choice.',
  escalate: 'I will ask the senior nurse for support with this ongoing difficulty.',
  handover: 'I will record and report our agreed next step and planned review.',
  check: 'How do you feel now? Are you comfortable?',
};
const ZH = {
  observe: '我看到您转头拒绝，是有什么顾虑吗？',
  permission: '您愿意让我帮助您吃一点吗？',
  choice: '您想先暂停、自己吃，还是让我协助？',
  plan: '我会核对并遵循虚构照护计划CP-M01。',
  position: '我会抬高床头，整理靠枕，让您坐稳。',
  temperature: '我会检查食物温度，确认已经放凉、不烫。',
  pause: '我们先暂停，移开勺子，不勉强您。',
  escalate: '我会请资深护士支持，处理持续困难。',
  handover: '我会记录并报告已商定的下一步和复查安排。',
  check: '您现在感觉怎么样，舒服吗？',
};
const say = (state, text, action = 'none') => respond(state, { text, action }).state;
const steps = (keys, words = EN, initial = createEncounter()) =>
  keys.reduce((state, key) => say(state, words[key]), initial);
const ready = (words = EN, initial) =>
  steps(['observe', 'permission', 'choice', 'plan', 'position', 'temperature'], words, initial);
const finishAssist = words => {
  const candidate = evaluateServing(ready(words), {});
  assert.equal(candidate.view.accepted, true);
  return say(completeServing(candidate.state), words.check);
};
function assertPair(value) {
  assert.equal(typeof value.en, 'string');
  assert.equal(typeof value.zh, 'string');
}
function assertResult(result) {
  for (const key of ['reply', 'behavior', 'feedback']) assertPair(result[key]);
  result.suggestions.forEach(assertPair);
  assert.ok(result.evidence.every(item => typeof item === 'string'));
  for (const key of ['headTurn', 'brow', 'handBlock', 'mouth']) {
    assert.equal(typeof result.view[key], 'number');
  }
  for (const entry of result.state.history) {
    assert.ok(['dialogue', 'serving', 'outcome'].includes(entry.kind));
    assert.equal(typeof entry.turn, 'number');
    assert.equal(typeof entry.user, 'string');
    ['reply', 'behavior', 'feedback'].forEach(key => assertPair(entry[key]));
    assert.ok(entry.evidence.every(item => typeof item === 'string'));
  }
}
function freezeDeep(object) {
  Object.values(object).forEach(value => {
    if (value && typeof value === 'object') freezeDeep(value);
  });
  return Object.freeze(object);
}

test('all four bilingual cases are bedside and identify a fictional CP-M01', () => {
  assert.deepEqual(Object.keys(CASES), ['practice', 'returning', 'check', 'refresher']);
  for (const encounter of Object.values(CASES)) {
    assert.equal(encounter.setting, 'bedside');
    for (const key of ['name', 'opening', 'brief', 'plan']) assertPair(encounter[key]);
    assert.match(encounter.plan.en, /fictional.*CP-M01/i);
    assert.match(encounter.plan.en, /soft food/i);
    assert.match(encounter.plan.en, /senior clinical/i);
    assert.match(encounter.plan.zh, /虚构/);
    assert.match(encounter.plan.zh, /动画.*不.*吞咽/);
  }
  assert.equal(CASES.check.name.en, 'Ms Lee');
  assert.match(CASES.check.opening.en, /pause/i);
  assert.notEqual(CASES.check.opening.en, CASES.practice.opening.en);
});

test('factory returns exactly the clean requested initial state', () => {
  assert.deepEqual(createEncounter(), {
    kind: 'practice', turn: 0,
    signals: Object.fromEntries([
      'observe', 'permission', 'plan', 'position', 'temperature', 'choice',
      'respect', 'escalate', 'handover', 'check',
    ].map(key => [key, false])),
    concernKnown: false, seniorChoice: 'undecided', outcome: null, history: [],
    attempts: 0, spoonReady: false, serviceCompleted: false,
  });
  assert.throws(() => createEncounter('unknown'), /Unknown encounter/);
});

for (const [language, words] of [['English', EN], ['Chinese', ZH]]) {
  test(`${language}: pause completes without any serving attempt`, () => {
    const state = steps(['observe', 'pause', 'plan', 'handover'], words);
    assert.equal(state.outcome, 'pause');
    assert.equal(state.attempts, 0);
    assert.equal(state.serviceCompleted, false);
  });
  test(`${language}: support completes without any serving attempt`, () => {
    const state = steps(['observe', 'escalate', 'plan', 'handover'], words);
    assert.equal(state.outcome, 'support');
    assert.equal(state.attempts, 0);
  });
  test(`${language}: assist succeeds on first demonstration, then a post-check`, () => {
    const state = finishAssist(words);
    assert.equal(state.outcome, 'assist');
    assert.equal(state.attempts, 1);
    assert.equal(state.serviceCompleted, true);
    assert.equal(state.signals.check, true);
    assert.equal('bites' in state, false);
  });
}

test('both languages have equivalent assist signals and outcomes', () => {
  const en = finishAssist(EN);
  const zh = finishAssist(ZH);
  assert.deepEqual(en.signals, zh.signals);
  assert.equal(en.seniorChoice, zh.seniorChoice);
  assert.equal(en.outcome, zh.outcome);
});

test('all response envelopes and history entries have bilingual pairs', () => {
  assertResult(respond(createEncounter(), { text: EN.observe }));
  assertResult(evaluateServing(createEncounter(), {}));
  assertResult(respond(steps(['observe', 'pause', 'plan']), { text: EN.handover }));
});

test('no forced acceptance from animation parameters or repeated attempts', () => {
  let state = createEncounter();
  for (let i = 0; i < 3; i++) {
    const result = evaluateServing(state, { temperature: 37, pace: 8, amount: 1, accepted: true });
    assert.equal(result.view.accepted, false);
    assert.equal(result.metrics.process, 'not-ready');
    assert.equal(result.view.opening, 0);
    state = completeServing(result.state);
    assert.equal(state.serviceCompleted, false);
  }
  assert.equal(state.attempts, 3);
  assert.equal(state.outcome, null);
});

test('each assist prerequisite is required independently', () => {
  for (const key of ['observe', 'permission', 'choice', 'plan', 'position', 'temperature']) {
    const state = ready();
    state.signals[key] = false;
    const result = evaluateServing(state, {});
    assert.equal(result.view.accepted, false, key);
    assert.equal(completeServing(result.state).serviceCompleted, false, key);
  }
  const state = ready();
  state.seniorChoice = 'undecided';
  assert.equal(evaluateServing(state, {}).view.accepted, false);
});

test('pre-check cannot replace a post-demonstration check', () => {
  let state = say(ready(), EN.check);
  assert.equal(state.signals.check, false);
  const result = evaluateServing(state, {});
  assert.equal(result.metrics.process, 'ready');
  assert.equal(result.state.serviceCompleted, false);
  assert.equal(result.state.outcome, null);
  state = say(result.state, EN.check);
  assert.equal(state.outcome, null);
  state = completeServing(state);
  assert.equal(state.serviceCompleted, true);
  assert.equal(state.outcome, null);
  state = say(state, EN.check);
  assert.equal(state.outcome, 'assist');
});

test('completeServing requires a live ready marker and consumes it once', () => {
  assert.equal(completeServing(ready()).serviceCompleted, false);
  const candidate = evaluateServing(ready(), {});
  assert.equal(candidate.state.spoonReady, true);
  const completed = completeServing(candidate.state);
  assert.equal(completed.spoonReady, false);
  assert.equal(completed.serviceCompleted, true);
  assert.deepEqual(completeServing(completed), completed);
  const stale = structuredClone(candidate.state);
  stale.signals.temperature = false;
  assert.equal(completeServing(stale).serviceCompleted, false);
});

test('pause is sticky until an explicit renewed question, not a permission button', () => {
  let state = say(ready(), EN.pause);
  for (const text of [EN.permission, EN.choice]) state = say(state, text);
  state = say(state, '', 'permission');
  assert.equal(state.seniorChoice, 'pause');
  assert.equal(state.signals.permission, false);
  assert.equal(evaluateServing(state, {}).metrics.process, 'pause');
  state = say(state, 'Would you now like my help, or would you prefer to keep pausing?');
  assert.equal(state.seniorChoice, 'assist');
  assert.equal(evaluateServing(state, {}).view.accepted, true);
});

test('Chinese renewed permission reopens discussion after pause', () => {
  let state = say(ready(ZH), ZH.pause);
  state = say(state, ZH.permission);
  assert.equal(state.seniorChoice, 'pause');
  state = say(state, '重新确认，您现在愿意让我协助，还是继续暂停？');
  assert.equal(state.seniorChoice, 'assist');
});

test('short pause instructions revoke any pending candidate in both languages', () => {
  for (const text of ['Pause', 'Stop', 'Please pause.', 'Withdraw', '暂停', '先暂停']) {
    const candidate = evaluateServing(ready(), {});
    const state = say(candidate.state, text);
    assert.equal(state.seniorChoice, 'pause', text);
    assert.equal(state.signals.permission, false, text);
    assert.equal(state.spoonReady, false, text);
    assert.equal(completeServing(state).serviceCompleted, false, text);
  }
});

test('negative phrases do not earn keyword credit in either language', () => {
  const phrases = [
    'I will not observe refusal or ask about your concerns.',
    'I will not ask permission or offer my help.',
    'Do not follow the care plan.', 'I will not raise the bed or use pillows.',
    'Do not check the temperature or confirm it has cooled.',
    'I will never offer a choice to pause or eat yourself.',
    'We will not pause or withdraw the spoon.',
    'Do not contact the nurse for support.',
    'I will not record the agreed next step.', 'Do not ask how you feel.',
    '不要询问顾虑，也不观察拒绝。', '不用问您愿不愿意让我帮助。',
    '不用核对照护计划。', '不要抬高床头或整理靠枕。',
    '不用检查温度，不确认已经放凉。', '不提供暂停或者自己吃的选择。',
    '不能暂停，也不移开勺子。', '不用请护士支持。',
    '不记录已商定的下一步。', '不用确认感受。',
    'Skip the care plan and temperature check.', 'Ignore her refusal and force her to eat.',
  ];
  for (const text of phrases) {
    const result = respond(createEncounter(), { text });
    assert.ok(Object.values(result.state.signals).every(value => !value), text);
    assert.equal(result.view.mouth, 0, text);
    assert.equal(result.state.outcome, null, text);
  }
});

test('pressure revokes prior consent, completion, outcome and pending service', () => {
  for (const text of ['You must eat now. Open your mouth.', '必须吃，不准停。', 'I will not check the care plan.']) {
    const state = say(finishAssist(EN), text);
    assert.equal(state.signals.permission, false);
    assert.equal(state.signals.check, false);
    assert.equal(state.serviceCompleted, false);
    assert.equal(state.spoonReady, false);
    assert.equal(state.outcome, null);
    assert.equal(evaluateServing(state, {}).view.accepted, false);
  }
  const state = say(evaluateServing(ready(), {}).state, 'I will force you to eat.');
  assert.equal(completeServing(state).serviceCompleted, false);
});

test('respectful negative wording and A-not-A questions remain recognizable', () => {
  let state = say(createEncounter(), "I notice you don't want to eat. What worries you?");
  assert.equal(state.signals.observe, true);
  state = say(state, "I won't force you. We can stop for now.");
  assert.equal(state.signals.respect, true);
  const temperature = say(createEncounter(), '确认食物不烫，已经放凉。');
  assert.equal(temperature.signals.temperature, true);
  state = say(createEncounter(), '您有什么顾虑，是不舒服吗？');
  state = say(state, '您愿不愿意让我协助，还是自己吃？');
  assert.equal(state.signals.permission, true);
  assert.equal(state.signals.choice, true);
});

test('check rejects every guided action including accompanying free text', () => {
  for (const action of ['observe', 'permission', 'plan', 'position', 'temperature', 'pause', 'escalate', 'record', 'check', 'unknown']) {
    const initial = createEncounter('check');
    const result = respond(initial, { action, text: Object.values(EN).join(' ') });
    assert.deepEqual(result.state, initial);
    assert.deepEqual(result.suggestions, []);
    assert.deepEqual(result.feedback, { en: '', zh: '' });
    assert.deepEqual(result.evidence, []);
  }
});

test('check: Ms Lee accepts the pause branch without hints or a forced assist', () => {
  let state = ready(EN, createEncounter('check'));
  state = say(state, 'Would you now like my help, or prefer to pause?');
  assert.notEqual(state.seniorChoice, 'assist');
  const result = evaluateServing(state, { accepted: true, temperature: 37 });
  assert.equal(result.view.accepted, false);
  assert.equal(result.metrics.process, 'pause');
  assert.deepEqual(result.suggestions, []);
  assert.deepEqual(result.feedback, { en: '', zh: '' });
  state = steps(['observe', 'pause', 'plan', 'handover'], EN, createEncounter('check'));
  assert.equal(state.outcome, 'pause');
  assert.equal(state.attempts, 0);
  assert.deepEqual(getSuggestions(state), []);
  assert.ok(state.history.every(entry => entry.feedback.en === '' && entry.feedback.zh === ''));
});

test('returning remembers only the narrative: all consent and evidence are fresh', () => {
  finishAssist(EN);
  const returning = createEncounter('returning');
  assert.match(CASES.returning.opening.en, /last time/i);
  assert.doesNotMatch(CASES.returning.opening.en, /paused last time/i);
  assert.deepEqual({ ...returning, kind: 'practice' }, createEncounter());
  assert.equal(evaluateServing(returning, {}).view.accepted, false);
  returning.signals.permission = true;
  returning.history.push({ user: 'local mutation' });
  assert.equal(createEncounter('returning').signals.permission, false);
  assert.deepEqual(createEncounter('returning').history, []);
});

test('numeric parameters have no clinical thresholds or effect on acceptance', () => {
  const state = ready();
  const values = [undefined, null, {}, { temperature: -273, amount: 1e9, pace: -1 },
    { temperature: 999, pause: 0, opening: 0.9 }, { temperature: NaN, opening: Infinity }];
  for (const params of values) {
    const result = evaluateServing(state, params);
    assert.equal(result.view.accepted, true);
    assert.equal(result.metrics.process, 'ready');
    assert.deepEqual(Object.keys(result.metrics), ['process', 'notes']);
    assertPair(result.metrics.notes);
    assert.doesNotMatch(JSON.stringify(result.metrics), /safe to swallow|clinically safe|°|℃/i);
    assert.deepEqual(result.state, evaluateServing(state, {}).state);
  }
});

test('a new demonstration clears previous service and post-check evidence', () => {
  const result = evaluateServing(finishAssist(EN), {});
  assert.equal(result.state.attempts, 2);
  assert.equal(result.state.serviceCompleted, false);
  assert.equal(result.state.signals.check, false);
  assert.equal(result.state.outcome, null);
  assert.equal(result.state.history.at(-1).kind, 'serving');
});

test('all public state operations are immutable, including nested history and pairs', () => {
  const original = freezeDeep(ready());
  const snapshot = structuredClone(original);
  const response = respond(original, { text: EN.check });
  const candidate = evaluateServing(original, {});
  getSuggestions(original);
  completeServing(original);
  assert.deepEqual(original, snapshot);
  response.state.history[0].reply.en = 'changed';
  response.state.signals.plan = false;
  assert.deepEqual(original, snapshot);
  const frozenCandidate = freezeDeep(candidate.state);
  const completed = completeServing(frozenCandidate);
  assert.equal(frozenCandidate.serviceCompleted, false);
  assert.equal(completed.serviceCompleted, true);
  const options = getSuggestions(createEncounter());
  options[0].en = 'changed';
  assert.notEqual(getSuggestions(createEncounter())[0].en, 'changed');
});

test('training guided actions register their intended evidence', () => {
  const mappings = { observe: 'observe', permission: 'permission', plan: 'plan',
    position: 'position', temperature: 'temperature', pause: 'respect',
    escalate: 'escalate', record: 'handover' };
  for (const [action, signal] of Object.entries(mappings)) {
    const result = respond(createEncounter(), { action });
    assert.equal(result.state.signals[signal], true, action);
    assert.ok(result.evidence.includes(signal), action);
  }
  const completed = completeServing(evaluateServing(ready(), {}).state);
  assert.equal(respond(completed, { action: 'check' }).state.outcome, 'assist');
});

test('a negative text cannot be overridden by a guided button', () => {
  const result = respond(createEncounter(), { text: 'Do not check the care plan.', action: 'plan' });
  assert.equal(result.state.signals.plan, false);
  assert.ok(result.evidence.includes('negative'));
});

test('all paths require plan and handover or completed service as specified', () => {
  for (const branch of ['pause', 'escalate']) {
    let state = steps(['observe', branch, 'handover']);
    assert.equal(state.outcome, null);
    state = say(state, EN.plan);
    assert.equal(state.outcome, branch === 'pause' ? 'pause' : 'support');
  }
  assert.equal(steps(['observe', 'pause', 'plan']).outcome, null);
  assert.equal(steps(['observe', 'escalate', 'plan']).outcome, null);
});
