import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, SUPPORT } from './tour-story.js';

const chapterIds = ['intro', 'practice', 'returning', 'check', 'review', 'shift', 'refresher', 'followup'];
const kinds = ['narration', 'dialogue', 'action', 'coach', 'record', 'cutaway', 'ending'];
const viewValues = {
  senior: ['tan', 'lim'], mood: ['neutral', 'resistant', 'settled'],
  bowl: ['near', 'away'], worker: ['near', 'back'], gaze: ['tv', 'worker', 'bowl'],
  tv: [true, false], gesture: ['none', 'push-bowl', 'open-palm', 'setup', 'withdraw', 'listen'],
};
const steps = CHAPTERS.flatMap(chapter => chapter.steps);
const chapter = id => CHAPTERS.find(item => item.id === id);
const byId = id => steps.find(item => item.id === id);
const textOf = (id, language = 'en') => chapter(id).steps.map(step => step.text[language]).join(' ');

function bilingual(value) {
  assert.deepEqual(Object.keys(value).sort(), ['en', 'zh']);
  for (const language of ['en', 'zh']) {
    assert.equal(typeof value[language], 'string');
    assert.ok(value[language].trim().length > 0);
    assert.doesNotMatch(value[language], /TODO|TBD|undefined|\[object Object\]/);
  }
  assert.match(value.zh, /[\u3400-\u9fff]/);
}

test('eight stable chapters contain globally unique steps with separate question-response beats', () => {
  assert.deepEqual(CHAPTERS.map(item => item.id), chapterIds);
  assert.ok(steps.length >= 32 && steps.length <= 42);
  assert.equal(new Set(steps.map(step => step.id)).size, steps.length);
  for (const item of CHAPTERS) {
    bilingual(item.title);
    bilingual(item.focus);
    assert.ok(item.steps.length >= 3 && item.steps.length <= 7, item.id);
    for (const step of item.steps) assert.match(step.id, new RegExp(`^${item.id}-[a-z-]+$`));
  }
});

test('all captions, physical actions, records and supporting text are bilingual', () => {
  for (const step of steps) {
    assert.ok(kinds.includes(step.kind), step.id);
    assert.ok([null, 'Hui Lin', 'Ms Tan', 'Mr Lim'].includes(step.speaker));
    bilingual(step.text);
    if (step.action !== null) bilingual(step.action);
    if (step.kind === 'dialogue') assert.notEqual(step.speaker, null);
    else assert.equal(step.speaker, null, step.id);
    if (step.record) {
      bilingual(step.record.label);
      assert.match(step.record.label.en, /fictional/i);
      assert.match(step.record.label.zh, /虚构/);
      bilingual(step.record.title);
      assert.ok(step.record.fields.length > 0);
      step.record.fields.forEach(field => { bilingual(field.label); bilingual(field.value); });
    }
  }
  for (const key of ['carePlan', 'about', 'adaptation']) bilingual(SUPPORT[key]);
  SUPPORT.references.forEach(reference => bilingual(reference.title));
});

test('every step supplies an independent complete view for stateless chapter jumps', () => {
  const views = new Set();
  for (const step of steps) {
    assert.deepEqual(Object.keys(step.view).sort(), Object.keys(viewValues).sort(), step.id);
    for (const [key, values] of Object.entries(viewValues)) {
      assert.ok(values.includes(step.view[key]), `${step.id}: ${key}`);
    }
    assert.ok(!views.has(step.view), `${step.id}: shared mutable view`);
    views.add(step.view);
  }
  for (const step of chapter('check').steps) assert.equal(step.view.senior, 'lim');
  for (const id of ['intro', 'practice', 'returning', 'refresher']) {
    for (const step of chapter(id).steps) assert.equal(step.view.senior, 'tan');
  }
});

test('automatic playback has finite readable durations and a five to eight minute runtime', () => {
  for (const step of steps) {
    assert.ok(Number.isInteger(step.duration) && step.duration >= 9000, step.id);
    assert.ok(step.duration <= 25000, step.id);
    // Conservative caption budget: records/actions also consume reading time.
    const visible = [step.text, step.action, ...(step.record ? [step.record.label,
      step.record.title, ...step.record.fields.flatMap(field => [field.label, field.value])] : [])].filter(Boolean);
    const words = visible.map(value => value.en).join(' ').split(/\s+/).length;
    assert.ok(step.duration >= words / 3.5 * 1000, `${step.id}: crowded caption`);
  }
  const duration = steps.reduce((total, step) => total + step.duration, 0);
  assert.ok(duration >= 300000 && duration <= 480000, `${duration} ms`);
});

test('minimal handover preserves gradual discovery and physical action stays separate from speech', () => {
  const intro = textOf('intro');
  assert.match(intro, /food stall/);
  assert.match(intro, /English/);
  assert.match(intro, /supported chair/);
  assert.match(intro, /lounge/);
  assert.doesNotMatch(intro, /already eaten|come back afterwards|wants to finish/);
  for (const step of steps) {
    if (step.action) assert.doesNotMatch(step.action.en, /[“”"]|\b(says|asks|tells|agrees|explains|reports|records|offers)\b/i, step.id);
    if (step.kind === 'action') assert.notEqual(step.action, null, step.id);
  }
});

test('initial refusal succeeds with a pause and agreed return, without eating', () => {
  const practice = chapter('practice').steps;
  assert.equal(practice[0].speaker, 'Ms Tan');
  assert.equal(practice[0].text.en, "Leave it there. I've already eaten.");
  assert.equal(practice[0].view.gesture, 'push-bowl');
  assert.match(practice[1].text.en, /Hello Ms Tan.*Hui Lin/);
  assert.match(practice[1].text.en, /leave the bowl here/);
  assert.match(practice[2].text.en, /finish this programme/);
  assert.match(byId('practice-ask-return').text.en, /come back afterwards/);
  const pause = byId('practice-pause');
  assert.equal(pause.view.worker, 'back');
  assert.equal(pause.view.bowl, 'away');
  assert.match(JSON.stringify(pause.record), /No food eaten/);
  assert.match(textOf('practice'), /successful.*without.*eaten/i);
  assert.doesNotMatch(textOf('practice'), /takes a bite|starts eating|accepts feeding/i);
});

test('returning checks current wishes and limits consent to setup help', () => {
  assert.match(textOf('returning'), /Later that day/);
  assert.match(textOf('returning'), /earlier agreement.*permission/i);
  assert.match(byId('returning-question').text.en, /now\?/);
  assert.match(byId('returning-wishes').text.en, /myself.*set.*spoon/i);
  const setup = byId('returning-setup');
  assert.equal(setup.kind, 'action');
  assert.equal(setup.view.gesture, 'setup');
  assert.match(setup.action.en, /spoon/);
  assert.match(textOf('returning'), /setup help only/i);
  assert.doesNotMatch(textOf('returning'), /remember you|always want|hand-feeds/i);
});

test('unfamiliar check is a scripted example, contains no coach, hints or reviewer evidence', () => {
  assert.match(chapter('check').focus.en, /scripted example of a check/i);
  assert.match(textOf('check'), /no evidence about.*visitor.*competence/i);
  for (const step of chapter('check').steps) {
    assert.notEqual(step.kind, 'coach');
    assert.equal(step.record, undefined);
    assert.equal(step.cutaway, undefined);
    assert.doesNotMatch(step.text.en, /try saying|you should|correct response|score|evidence indicator/i);
  }
  assert.match(byId('check-concern').text.en, /don['’]t recognise/);
  assert.match(byId('check-response').text.en, /identify.*support/i);
  assert.match(byId('check-choice').text.en, /find out/);
  assert.match(byId('check-submit').text.en, /submitted.*human review/i);
});

test('human review remains in labelled record cutaways, with traceable excerpts and a bounded decision', () => {
  for (const item of CHAPTERS) {
    for (const step of item.steps) {
      if (step.cutaway) {
        assert.equal(step.kind, 'cutaway');
        assert.ok(step.record);
        assert.match(step.text.en, /fictional/i);
        if (step.cutaway === 'manager') assert.equal(item.id, 'review');
        else if (step.cutaway === 'reviewer') assert.ok(['review', 'followup'].includes(item.id));
        else { assert.equal(step.cutaway, 'workplace'); assert.equal(item.id, 'shift'); }
      }
      if (step.record?.fields.some(field => /excerpt/i.test(field.label.en))) {
        assert.equal(item.id, 'review');
        assert.equal(step.cutaway, 'reviewer');
      }
    }
  }
  const review = chapter('review').steps;
  assert.equal(review[0].cutaway, 'manager');
  const excerpts = byId('review-excerpts').record.fields;
  for (const id of ['check-concern', 'check-response']) {
    for (const language of ['en', 'zh']) {
      assert.ok(excerpts.some(field => field.value[language].includes(byId(id).text[language])));
    }
  }
  const decision = JSON.stringify(byId('review-decision').record);
  assert.match(decision, /Ready for supervised workplace practice/);
  assert.match(decision, /More practice.*Further support.*Supervised workplace practice/);
  assert.match(decision, /Reason/);
  assert.equal(review.at(-1).cutaway, undefined);
  for (const step of steps.filter(item => item.kind === 'coach')) {
    assert.doesNotMatch(step.text.en, /ready for|cleared|qualified|passed/i);
  }
});

test('workplace difficulty leads to targeted withdrawal practice and completed observed follow-up', () => {
  assert.match(byId('shift-transition').text.en, /Later.*busy.*supervised shift/i);
  const shift = chapter('shift').steps;
  assert.ok(shift.indexOf(byId('shift-stop')) < shift.indexOf(byId('shift-repeat')));
  assert.match(byId('shift-stop').text.en, /stop/i);
  assert.match(byId('shift-repeat').text.en, /offer/i);
  assert.match(byId('shift-report').text.en, /I repeated.*stop.*help/i);
  assert.match(textOf('refresher'), /At the next practice session.*reported difficulty/i);
  assert.equal(byId('refresher-withdraw').view.gesture, 'withdraw');
  assert.equal(byId('refresher-withdraw').view.worker, 'back');
  const observation = JSON.stringify(byId('followup-observation').record);
  assert.match(observation, /observed.*pause/i);
  assert.match(observation, /recorded.*agreed next step/i);
  assert.match(observation, /Further supervised practice.*agreed/i);
  assert.match(byId('followup-transition').text.en, /After a later supervised shift.*after the refresher/i);
  assert.equal(steps.at(-1).kind, 'ending');
  assert.equal(steps.at(-1).cutaway, undefined);
  assert.match(steps.at(-1).text.en, /fictional.*completed/i);
  assert.match(steps.at(-1).text.en, /not.*clearance/i);
});

test('fictional care plan bounds assistance, refusal and safety; sources match the brief', () => {
  const plan = SUPPORT.carePlan.en;
  for (const pattern of [/fictional.*CP-M02/i, /soft food/i, /supported.*chair/i,
    /setup help/i, /no hand-feeding/i, /permission.*television/i,
    /document/i, /after.*programme/i, /continued refusal/i, /discomfort/i,
    /appropriate.*lead/i, /practitioner review/i]) assert.match(plan, pattern);
  assert.deepEqual(SUPPORT.references.map(reference => reference.url), [
    'https://www.youtube.com/watch?v=zFnx_dXPTa8',
    'https://www.youtube.com/watch?v=tAKwDFdy8WQ',
    'https://www.uclahealth.org/medical-services/geriatrics/dementia/caregiver-education/caregiver-training-videos',
  ]);
  assert.match(SUPPORT.adaptation.en, /authored adaptation/i);
  assert.match(SUPPORT.adaptation.en, /not.*endorsement/i);
  assert.match(SUPPORT.adaptation.en, /not a reproduction/i);
  assert.match(SUPPORT.about.en, /No live coaching or backend/);
  const story = JSON.stringify({ CHAPTERS, SUPPORT });
  assert.doesNotMatch(story, /granddaughter.*disappointed|just one bite|must eat|force.feed|guaranteed safe|swallowing detected|10[–-]15|10 minutes/i);
});
