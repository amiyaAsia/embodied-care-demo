import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLearningRecord, archiveEncounter, submitCheck, nominateReviewer,
  decideReadiness, reportDifficulty, completeFollowup, getStageAccess,
} from './learning-loop.js';
import { createEncounter, respond } from './practice-engine.js';

const state = (kind, outcome = null) => ({
  kind, outcome, history: [{ user: 'An agreed next step', evidence: ['observe'] }],
});
const prerequisites = () => archiveEncounter(
  archiveEncounter(createLearningRecord(), state('practice', 'pause')),
  state('returning', 'support'),
);
const submitted = () => submitCheck(prerequisites(), state('check'));
const reviewed = () => decideReadiness(
  nominateReviewer(submitted(), { name: 'Reviewer Chen', role: 'Supervisor' }),
  { decision: 'more-practice', reason: 'Needs further supported practice.' },
);
const withDifficulty = () => reportDifficulty(reviewed(), {
  text: 'Need more practice responding to refusal.', topic: 'refusal',
});
const fails = (fn, code) => assert.throws(fn, { name: 'Error', message: code });
function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

test('factory has the exact initial shape and independent arrays', () => {
  const record = createLearningRecord();
  assert.deepEqual(record, {
    version: 1, encounters: [], checkSubmission: null, reviewer: null,
    decision: null, difficulties: [], followups: [], refresherRequired: false,
  });
  for (const key of ['encounters', 'difficulties', 'followups']) {
    record[key].push({});
    assert.deepEqual(createLearningRecord()[key], []);
  }
});

test('initial access opens only practice', () => {
  assert.deepEqual(getStageAccess(createLearningRecord()), {
    practice: true, returning: false, check: false, review: false,
    followup: false, refresher: false,
  });
});

test('archive preserves independent nested snapshots with consecutive IDs', () => {
  const input = state('practice', 'pause');
  const first = archiveEncounter(createLearningRecord(), input);
  assert.deepEqual(first.encounters[0], {
    id: 'enc-1', kind: 'practice', state: input, outcome: 'pause',
  });
  input.history[0].evidence.push('changed');
  input.outcome = null;
  assert.deepEqual(first.encounters[0].state.history[0].evidence, ['observe']);
  assert.equal(first.encounters[0].outcome, 'pause');
  const second = archiveEncounter(freezeDeep(first), state('returning', 'pause'));
  assert.equal(second.encounters[1].id, 'enc-2');
  second.encounters[0].state.history[0].user = 'changed';
  assert.equal(first.encounters[0].state.history[0].user, 'An agreed next step');
});

test('unfinished encounters and returning alone cannot unlock check', () => {
  let record = archiveEncounter(createLearningRecord(), state('practice'));
  record = archiveEncounter(record, state('returning', 'pause'));
  assert.equal(getStageAccess(record).returning, false);
  assert.equal(getStageAccess(record).check, false);
  record = archiveEncounter(record, state('practice', 'pause'));
  assert.equal(getStageAccess(record).check, true);
  record = archiveEncounter(record, state('practice'));
  assert.equal(getStageAccess(record).check, true);
});

test('real refusal/pause completion unlocks returning then check without serving', () => {
  let record = createLearningRecord();
  for (const kind of ['practice', 'returning']) {
    let encounter = createEncounter(kind);
    for (const text of [
      'I notice you are turning away. What is worrying you?',
      'We will pause now. I will withdraw the spoon and respect your choice.',
      'I will check and follow the fictional care plan CP-M01.',
      'I will record and report our agreed next step and planned review.',
    ]) encounter = respond(encounter, { text }).state;
    assert.equal(encounter.outcome, 'pause');
    assert.equal(encounter.attempts, 0);
    assert.equal(encounter.serviceCompleted, false);
    record = archiveEncounter(record, encounter);
    assert.equal(getStageAccess(record).returning, true);
    assert.equal(getStageAccess(record).check, kind === 'returning');
    assert.equal(record.decision, null);
  }
});

test('pause, support and assist have equal standing for access', () => {
  for (const outcome of ['pause', 'support', 'assist']) {
    const record = archiveEncounter(
      archiveEncounter(createLearningRecord(), state('practice', outcome)),
      state('returning', outcome),
    );
    assert.equal(getStageAccess(record).check, true);
    assert.equal(record.decision, null);
  }
});

test('submission validates kind, nonempty history and both completed prerequisites', () => {
  fails(() => submitCheck(prerequisites(), state('practice')), 'CHECK_REQUIRED');
  for (const history of [[], null, undefined, 'not an array']) {
    fails(() => submitCheck(prerequisites(), { kind: 'check', history }), 'HISTORY_REQUIRED');
  }
  fails(() => submitCheck(createLearningRecord(), state('check')), 'PRACTICE_REQUIRED');
  const practice = archiveEncounter(createLearningRecord(), state('practice', 'pause'));
  fails(() => submitCheck(practice, state('check')), 'RETURNING_REQUIRED');
  fails(() => submitCheck(archiveEncounter(practice, state('returning')), state('check')),
    'RETURNING_REQUIRED');
});

test('a check with history may be submitted without an outcome for human review', () => {
  const input = state('check');
  const before = Date.now();
  const record = submitCheck(prerequisites(), input);
  assert.equal(record.checkSubmission.id, 'check-1');
  assert.deepEqual(record.checkSubmission.encounter, input);
  const date = record.checkSubmission.submittedAt;
  assert.equal(new Date(date).toISOString(), date);
  assert.ok(Date.parse(date) >= before && Date.parse(date) <= Date.now());
  input.history[0].evidence.push('changed');
  assert.deepEqual(record.checkSubmission.encounter.history[0].evidence, ['observe']);
  assert.equal(getStageAccess(record).review, true);
  assert.equal(getStageAccess(record).followup, false);
  assert.equal(record.decision, null);
});

test('resubmission increments IDs, invalidates decisions and preserves prior records', () => {
  const previous = freezeDeep(reviewed());
  const next = submitCheck(previous, state('check', 'pause'));
  assert.equal(next.checkSubmission.id, 'check-2');
  assert.equal(next.decision, null);
  assert.equal(getStageAccess(next).followup, false);
  assert.equal(previous.decision.submissionId, 'check-1');
  assert.equal(submitCheck(next, state('check')).checkSubmission.id, 'check-3');
});

test('nomination requires both trimmed name and role', () => {
  for (const reviewer of [{}, { name: 'Chen' }, { name: ' ', role: 'Supervisor' },
    { name: 'Chen', role: ' ' }, { name: 123, role: 'Supervisor' }]) {
    fails(() => nominateReviewer(createLearningRecord(), reviewer), 'REVIEWER_REQUIRED');
  }
  const record = nominateReviewer(createLearningRecord(), { name: ' Chen ', role: ' Supervisor ' });
  assert.deepEqual(record.reviewer, { name: 'Chen', role: 'Supervisor' });
  assert.equal(record.decision, null);
});

test('readiness requires reviewer, submission, allowed decision and meaningful reason', () => {
  const params = { decision: 'ready-supervised', reason: 'Enough evidence for supervised practice.' };
  fails(() => decideReadiness(submitted(), params), 'REVIEWER_REQUIRED');
  const nominated = nominateReviewer(createLearningRecord(), { name: 'Chen', role: 'Supervisor' });
  fails(() => decideReadiness(nominated, params), 'CHECK_REQUIRED');
  const record = nominateReviewer(submitted(), nominated.reviewer);
  fails(() => decideReadiness(record, { ...params, decision: 'ready' }), 'INVALID_DECISION');
  for (const reason of [undefined, '', '       ', '1234567', ' 1234567 ', 12345678]) {
    fails(() => decideReadiness(record, { ...params, reason }), 'REASON_REQUIRED');
  }
});

test('all readiness decisions are explicit and capture reviewer and submission', () => {
  for (const decision of ['ready-supervised', 'more-practice', 'not-ready']) {
    const initial = nominateReviewer(submitted(), { name: 'Chen', role: 'Supervisor' });
    const record = decideReadiness(initial, { decision, reason: ' 12345678 ' });
    assert.deepEqual(record.decision, {
      decision, reason: '12345678', reviewer: { name: 'Chen', role: 'Supervisor' },
      submissionId: 'check-1',
    });
    record.reviewer.name = 'changed';
    assert.equal(record.decision.reviewer.name, 'Chen');
    const renamed = nominateReviewer(record, { name: 'New reviewer', role: 'Mentor' });
    assert.equal(renamed.decision.reviewer.name, 'Chen');
    assert.equal(getStageAccess(record).followup, true);
    assert.equal(initial.decision, null);
  }
});

test('difficulty reporting requires decision, eight trimmed characters and allowed topic', () => {
  const params = { text: '12345678', topic: 'refusal' };
  fails(() => reportDifficulty(submitted(), params), 'DECISION_REQUIRED');
  for (const text of [undefined, '', '1234567', ' 1234567 ', 12345678]) {
    fails(() => reportDifficulty(reviewed(), { ...params, text }), 'TEXT_REQUIRED');
  }
  fails(() => reportDifficulty(reviewed(), { ...params, topic: 'other' }), 'TOPIC_REQUIRED');
  for (const topic of ['refusal', 'positioning', 'handover']) {
    const record = reportDifficulty(reviewed(), { ...params, topic });
    assert.equal(record.difficulties[0].topic, topic);
  }
});

test('difficulty schedules a local planned follow-up for the deciding reviewer', () => {
  const initial = nominateReviewer(reviewed(), { name: 'Other nominee', role: 'Mentor' });
  const record = reportDifficulty(initial, { text: ' 12345678 ', topic: 'refusal' });
  assert.deepEqual(record.difficulties, [{ id: 'difficulty-1', text: '12345678', topic: 'refusal' }]);
  assert.deepEqual(record.followups, [{
    id: 'followup-1', difficultyId: 'difficulty-1', assignedTo: 'Reviewer Chen', status: 'planned',
  }]);
  assert.equal(record.refresherRequired, true);
  assert.equal(getStageAccess(record).refresher, true);
  assert.deepEqual(record.decision, initial.decision);
});

test('refresher archives require a difficulty and link only to the latest difficulty', () => {
  fails(() => archiveEncounter(createLearningRecord(), state('refresher', 'pause')), 'DIFFICULTY_REQUIRED');
  fails(() => archiveEncounter(createLearningRecord(), state('unknown')), 'ENCOUNTER_REQUIRED');
  const record = reportDifficulty(withDifficulty(), { text: 'Another difficulty with handover.', topic: 'handover' });
  const archived = archiveEncounter(record, { ...state('refresher', 'pause'), difficultyId: 'forged-id' });
  assert.equal(archived.encounters.at(-1).difficultyId, 'difficulty-2');
  assert.equal(archived.followups.at(-1).id, 'followup-2');
  assert.equal(archived.refresherRequired, true);
});

test('completion requires latest difficulty, linked outcome and a meaningful note', () => {
  const params = { note: 'Reviewed the completed refresher.' };
  fails(() => completeFollowup(reviewed(), params), 'DIFFICULTY_REQUIRED');
  fails(() => completeFollowup(withDifficulty(), params), 'REFRESHER_REQUIRED');
  const unfinished = archiveEncounter(withDifficulty(), state('refresher'));
  fails(() => completeFollowup(unfinished, params), 'REFRESHER_REQUIRED');
  const wrongKind = archiveEncounter(withDifficulty(), state('practice', 'pause'));
  fails(() => completeFollowup(wrongKind, params), 'REFRESHER_REQUIRED');
  const completed = archiveEncounter(withDifficulty(), state('refresher', 'pause'));
  for (const note of [undefined, '', ' 1234567 ', 12345678]) {
    fails(() => completeFollowup(completed, { note }), 'NOTE_REQUIRED');
  }
  const newerDifficulty = reportDifficulty(completed, { text: 'New positioning difficulty.', topic: 'positioning' });
  fails(() => completeFollowup(newerDifficulty, params), 'REFRESHER_REQUIRED');
});

test('completion closes only the latest planned follow-up and never changes readiness', () => {
  const first = archiveEncounter(withDifficulty(), state('refresher', 'pause'));
  const second = reportDifficulty(first, { text: 'New positioning difficulty.', topic: 'positioning' });
  const archived = archiveEncounter(second, state('refresher', 'support'));
  const record = completeFollowup(archived, { note: ' 12345678 ' });
  assert.equal(record.followups[0].status, 'planned');
  assert.equal(record.followups[1].status, 'completed');
  assert.equal(record.followups[1].note, '12345678');
  assert.equal(record.followups[1].refresherEncounterId, archived.encounters.at(-1).id);
  assert.equal(record.refresherRequired, false);
  assert.equal(getStageAccess(record).refresher, false);
  assert.deepEqual(record.decision, archived.decision);
  fails(() => completeFollowup(record, { note: 'Another completion note.' }), 'FOLLOWUP_REQUIRED');
  const next = reportDifficulty(record, { text: 'Another refusal difficulty.', topic: 'refusal' });
  assert.equal(next.refresherRequired, true);
});

test('every state transition accepts frozen inputs and returns isolated deep copies', () => {
  const transitions = [
    [prerequisites(), record => archiveEncounter(record, freezeDeep(state('check')))],
    [prerequisites(), record => submitCheck(record, freezeDeep(state('check')))],
    [reviewed(), record => nominateReviewer(record, { name: 'Other', role: 'Mentor' })],
    [reviewed(), record => decideReadiness(record, { decision: 'not-ready', reason: 'More practice is needed.' })],
    [reviewed(), record => reportDifficulty(record, { text: 'Difficulty respecting refusal.', topic: 'refusal' })],
    [archiveEncounter(withDifficulty(), state('refresher', 'pause')),
      record => completeFollowup(record, { note: 'Discussed the refresher together.' })],
  ];
  for (const [input, transition] of transitions) {
    const snapshot = structuredClone(input);
    const result = transition(freezeDeep(input));
    result.encounters[0].state.history[0].evidence.push('changed');
    if (result.checkSubmission) result.checkSubmission.encounter.history[0].user = 'changed';
    if (result.decision) result.decision.reviewer.name = 'changed';
    if (result.difficulties.length) result.difficulties[0].text = 'changed';
    if (result.followups.length) result.followups[0].assignedTo = 'changed';
    getStageAccess(input);
    assert.deepEqual(input, snapshot);
  }
});
