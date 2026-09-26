/**
 * In-memory learning-loop state for the local demo. Reviewer nomination and
 * planned follow-ups are local records, not authentication or sent messages.
 * Only an explicit reviewer decision can record readiness.
 */
const copy = value => structuredClone(value);
const hasOutcome = (record, kind) => record.encounters.some(
  encounter => encounter.kind === kind && Boolean(encounter.outcome),
);
const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};
function requiredText(value, minimum, code) {
  requireValue(typeof value === 'string' && value.trim().length >= minimum, code);
  return value.trim();
}

export function createLearningRecord() {
  return {
    version: 1, encounters: [], checkSubmission: null, reviewer: null,
    decision: null, difficulties: [], followups: [], refresherRequired: false,
  };
}

export function archiveEncounter(record, state) {
  requireValue(['practice', 'returning', 'check', 'refresher'].includes(state?.kind),
    'ENCOUNTER_REQUIRED');
  const difficulty = record.difficulties.at(-1);
  if (state.kind === 'refresher') requireValue(difficulty, 'DIFFICULTY_REQUIRED');
  const next = copy(record);
  const snapshot = copy(state);
  next.encounters.push({
    id: `enc-${next.encounters.length + 1}`, kind: snapshot.kind,
    state: snapshot, outcome: copy(snapshot.outcome),
    ...(snapshot.kind === 'refresher' ? { difficultyId: difficulty.id } : {}),
  });
  return next;
}

export function submitCheck(record, state) {
  requireValue(state?.kind === 'check', 'CHECK_REQUIRED');
  requireValue(Array.isArray(state.history) && state.history.length > 0, 'HISTORY_REQUIRED');
  requireValue(hasOutcome(record, 'practice'), 'PRACTICE_REQUIRED');
  requireValue(hasOutcome(record, 'returning'), 'RETURNING_REQUIRED');
  const next = copy(record);
  const number = record.checkSubmission
    ? Number(record.checkSubmission.id.slice('check-'.length)) + 1 : 1;
  next.checkSubmission = {
    id: `check-${number}`, encounter: copy(state), submittedAt: new Date().toISOString(),
  };
  next.decision = null;
  return next;
}

export function nominateReviewer(record, { name, role } = {}) {
  const reviewer = {
    name: requiredText(name, 1, 'REVIEWER_REQUIRED'),
    role: requiredText(role, 1, 'REVIEWER_REQUIRED'),
  };
  return { ...copy(record), reviewer };
}

export function decideReadiness(record, { decision, reason } = {}) {
  requireValue(record.reviewer, 'REVIEWER_REQUIRED');
  requireValue(record.checkSubmission, 'CHECK_REQUIRED');
  requireValue(['ready-supervised', 'more-practice', 'not-ready'].includes(decision),
    'INVALID_DECISION');
  const explanation = requiredText(reason, 8, 'REASON_REQUIRED');
  const next = copy(record);
  next.decision = {
    decision, reason: explanation, reviewer: copy(record.reviewer),
    submissionId: record.checkSubmission.id,
  };
  return next;
}

export function reportDifficulty(record, { text, topic } = {}) {
  requireValue(record.decision, 'DECISION_REQUIRED');
  const description = requiredText(text, 8, 'TEXT_REQUIRED');
  requireValue(['refusal', 'positioning', 'handover'].includes(topic), 'TOPIC_REQUIRED');
  const next = copy(record);
  const difficulty = { id: `difficulty-${next.difficulties.length + 1}`, text: description, topic };
  next.difficulties.push(difficulty);
  next.followups.push({
    id: `followup-${next.followups.length + 1}`, difficultyId: difficulty.id,
    assignedTo: record.decision.reviewer.name, status: 'planned',
  });
  next.refresherRequired = true;
  return next;
}

export function completeFollowup(record, { note } = {}) {
  const difficulty = record.difficulties.at(-1);
  requireValue(difficulty, 'DIFFICULTY_REQUIRED');
  const refresher = record.encounters.findLast(encounter => encounter.kind === 'refresher'
    && encounter.difficultyId === difficulty.id && Boolean(encounter.outcome));
  requireValue(refresher, 'REFRESHER_REQUIRED');
  const explanation = requiredText(note, 8, 'NOTE_REQUIRED');
  const index = record.followups.findLastIndex(followup => followup.difficultyId === difficulty.id
    && followup.status === 'planned');
  requireValue(index !== -1, 'FOLLOWUP_REQUIRED');
  const next = copy(record);
  next.followups[index] = {
    ...next.followups[index], status: 'completed', note: explanation,
    refresherEncounterId: refresher.id,
  };
  next.refresherRequired = false;
  return next;
}

export function getStageAccess(record) {
  const practice = hasOutcome(record, 'practice');
  return {
    practice: true, returning: practice, check: practice && hasOutcome(record, 'returning'),
    review: Boolean(record.checkSubmission), followup: Boolean(record.decision),
    refresher: record.refresherRequired,
  };
}
