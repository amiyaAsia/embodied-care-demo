/**
 * Deterministic bedside communication practice, independent of the app/renderer.
 * Display pair.en by default; both languages are recognized in every encounter.
 * CP-M01 is fictional. Acceptance authorizes a candidate animation only: this
 * module does not assess swallowing, food safety, clinical readiness or bites.
 *
 * createEncounter / completeServing return state. Other transitions return the
 * bilingual result envelope. Render evaluateServing first, call completeServing
 * when that candidate animation finishes, then ask about the person's feelings.
 */
const pair = (en, zh) => ({ en, zh });
const copy = value => {
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)]));
  }
  return value;
};
function freezeDeep(value) {
  Object.values(value).forEach(child => {
    if (child && typeof child === 'object') freezeDeep(child);
  });
  return Object.freeze(value);
}

const PLAN = pair(
  'The fictional care plan CP-M01 allows soft food in an appropriately supported bedside position. First observe current willingness. If the person declines, pause and record and review through the established process. Notify senior clinical staff about persistent difficulty. This is a simulation plan, not approval by a real clinician; the animation does not test swallowing.',
  '虚构照护计划CP-M01已允许软食，并要求在床旁采取适当且有支撑的姿势。先观察当前意愿；若拒绝则暂停，依既定流程记录与复查；持续困难需通知资深临床人员。本计划不代表真实医生批准；动画不检验吞咽。',
);
const makeCase = (name, opening, brief) => ({ name, opening, brief, plan: copy(PLAN), setting: 'bedside' });

export const CASES = freezeDeep({
  practice: makeCase(
    pair('Ms Zhou', '周女士'),
    pair('Please take the spoon away for a moment. The food looks hot and I am leaning awkwardly in bed. Ask me before helping.',
      '请先把勺子移开。食物看着烫，我在床上也靠得不舒服。协助前请先问我。'),
    pair('At the bedside, listen to Ms Zhou, consult fictional CP-M01 and agree a next step. Pausing, seeking support and willing assistance are equally valid outcomes.',
      '在床旁倾听周女士，核对虚构计划CP-M01并商定下一步。暂停、寻求支持和自愿接受协助都是同等有效的结果。'),
  ),
  returning: makeCase(
    pair('Ms Zhou', '周女士'),
    pair('You listened last time. Today I may want something different. Please ask what I want before bringing the spoon closer.',
      '上次您听了我的想法，今天我的需要可能不一样。请先问我的意愿，再把勺子靠近。'),
    pair('A new bedside conversation. Re-establish current wishes and preparation; past permission does not carry over. The previous agreed outcome is shown separately.',
      '新一轮床旁沟通。重新确认当前意愿与准备，不继承旧许可。上次商定的结果单独显示。'),
  ),
  check: makeCase(
    pair('Ms Lee', '李女士'),
    pair('I am worried about losing control when someone helps me. I am tired of being asked to eat and want to pause today. Please leave the spoon aside.',
      '别人帮我时，我担心自己做不了主。一直被劝吃让我疲惫，今天我希望暂停。请先把勺子放在一旁。'),
    pair('An unfamiliar woman at the bedside with a different concern. Use your own words to agree and document a next step under fictional CP-M01. There are no guided actions, hints or coaching feedback.',
      '床旁的一位陌生女性，有不同的顾虑。请用自己的话依虚构计划CP-M01商定并记录下一步。本案例无引导按钮、提示或教学反馈。'),
  ),
  refresher: makeCase(
    pair('Ms Zhou', '周女士'),
    pair('Before we start, please listen to what is bothering me and let me choose whether to pause or have help here in bed.',
      '开始前，请先听听我的顾虑，让我选择在床旁暂停还是接受协助。'),
    pair('A fresh bedside refresher: recognize wishes, use fictional CP-M01, and close the agreed pause, support or assistance pathway.',
      '一次全新的床旁复习：识别意愿、遵循虚构计划CP-M01，完成商定的暂停、支持或协助路径。'),
  ),
});

const SIGNALS = ['observe', 'permission', 'plan', 'position', 'temperature', 'choice',
  'respect', 'escalate', 'handover', 'check'];
const ASSIST = ['observe', 'permission', 'choice', 'plan', 'position', 'temperature'];

export function createEncounter(kind = 'practice') {
  if (!Object.hasOwn(CASES, kind)) throw new RangeError(`Unknown encounter: ${kind}`);
  return {
    kind, turn: 0, signals: Object.fromEntries(SIGNALS.map(key => [key, false])),
    concernKnown: false, seniorChoice: 'undecided', outcome: null, history: [],
    attempts: 0, spoonReady: false, serviceCompleted: false,
  };
}

const PROMPTS = freezeDeep({
  observe: pair('I notice you are turning away. What is worrying you?', '我看到您转头拒绝，是有什么顾虑吗？'),
  permission: pair('Would you be willing to have my help with a little food?', '您愿意让我帮助您吃一点吗？'),
  choice: pair('Would you prefer to pause, eat yourself, or have my help?', '您想先暂停、自己吃，还是让我协助？'),
  plan: pair('I will check and follow the fictional care plan CP-M01.', '我会核对并遵循虚构照护计划CP-M01。'),
  position: pair('I will raise the bed and arrange supportive pillows.', '我会抬高床头，整理靠枕，让您坐稳。'),
  temperature: pair('I will check the food temperature and confirm it has cooled.', '我会检查食物温度，确认已经放凉、不烫。'),
  pause: pair('We will pause now. I will withdraw the spoon and respect your choice.', '我们先暂停，移开勺子，不勉强您。'),
  escalate: pair('I will ask the senior nurse for support with this ongoing difficulty.', '我会请资深护士支持，处理持续困难。'),
  record: pair('I will record and report our agreed next step and planned review.', '我会记录并报告已商定的下一步和复查安排。'),
  check: pair('How do you feel now? Are you comfortable?', '您现在感觉怎么样，舒服吗？'),
  renew: pair('Would you now like my help, or would you prefer to keep pausing?', '重新确认，您现在愿意让我协助，还是继续暂停？'),
});

// Intent recognition is deliberately conservative, not a general language model.
// Protect respectful negation, acknowledged refusal and Chinese A-not-A questions
// before screening for pressure/negation. Negated care claims earn no credit.
function negativeText(text) {
  const masked = text
    .replace(/\b(?:i\s+)?(?:will not|won't|would not|wouldn't|do not|don't|never)\s+(?:force|pressure|rush|coerce)(?:\s+(?:you|her|him))?/gi, ' respectful ')
    .replace(/\b(?:you|she|he)\s+(?:do not|don't|does not|doesn't)\s+want\s+to\s+eat\b/gi, ' declining ')
    .replace(/\b(?:not hot|not too hot|not comfortable|uncomfortable)\b/gi, ' condition ')
    .replace(/(?:不会|不要|不用|不能|不必|不|别)(?:再)?(?:勉强|强迫|强喂|催促|催逼|催)/g, '尊重')
    .replace(/愿不愿意|舒不舒服|能不能|好不好|有没有|是不是|不舒服|不想吃|不愿吃|不烫/g, '情况');
  return /\b(?:not|never|no|cannot|can't|won't|don't|doesn't|wouldn't|shouldn't|without|skip|ignore|refuse)\b|不要|不用|不必|无需|不需要|不许|不能|不准|别|没有|未|没|不/.test(masked)
    || /\b(?:force|coerce|must eat|have to eat|open your mouth|hurry up|stop refusing)\b|必须.{0,6}吃|强行|强喂|硬塞|强迫|勉强|赶紧|快点|无视|忽略/.test(masked);
}

const PATTERNS = {
  observe: /\b(?:what|anything).{0,24}(?:worr|concern|bother)|\b(?:ask|tell me|understand|listen|notice|see|observe|acknowledge).{0,55}(?:concern|worr|bother|refus|turning away|declin|don't want|do not want)|(?:什么|哪些|哪里|怎么|是否|询问|问问|了解|倾听|说说).{0,16}(?:顾虑|担心|不适|不舒服|拒绝|不想吃)|(?:观察|看到|注意到|理解).{0,16}(?:拒绝|转头|不想吃)|顾虑.{0,8}吗/,
  permission: /\b(?:would|will|could|may|can|are)\s+(?:you|i).{0,60}(?:willing|help|assist)|\bis it (?:ok|okay).{0,25}(?:help|assist)|(?:愿意|愿不愿意|可以|能不能).{0,18}(?:帮助|帮您|帮你|协助)|(?:帮助|协助).{0,12}(?:好吗|可以吗|愿意吗)/,
  plan: /\b(?:check|follow|consult|review|use).{0,40}(?:care plan|cp-m01)|(?:核对|查看|检查|遵循|按照|依照|查阅).{0,20}(?:照护计划|护理计划|虚构计划|cp-m01)/,
  position: /\b(?:raise|adjust|lift).{0,18}(?:bed|headrest)|\b(?:arrange|adjust|support|use).{0,24}pillows?|\b(?:sit|sitting).{0,20}(?:supported|upright)|抬高床头|升高床头|坐稳|坐直|整理靠枕|靠枕支撑/,
  temperature: /\b(?:check|confirm|test).{0,25}(?:temperature|cooled|cool enough|not hot|not too hot)|\b(?:food|meal).{0,16}(?:has cooled|is cool enough)|(?:检查|确认|测量|核对).{0,15}(?:温度|不烫|放凉)|已经放凉|确认温度合适/,
  choice: /\b(?:prefer|choose|choice|option|rather).{0,70}(?:pause|stop|yourself|help|assist)|\b(?:pause|eat yourself|help|assist).{0,60}\bor\b.{0,30}(?:pause|help|assist|yourself)|(?:选择|自己决定|您来选)|(?:暂停|自己吃|协助|帮助).{0,25}(?:还是|或者|或).{0,15}(?:暂停|协助|帮|自己吃)/,
  respect: /^(?:please )?(?:pause|stop|withdraw)[.! ]*$|^暂停[。！ ]*$|\b(?:we|i)(?:\s+will|'ll|\s+can|\s+should)?\s+(?:pause|stop)(?:\s+(?:now|here|for now|today))?\b|\blet'?s (?:pause|stop)|\b(?:withdraw|remove|put aside|take away).{0,20}spoon|\brespect.{0,20}(?:wish|choice|pause|refusal)|\b(?:won't|will not|never|don't|do not)\s+(?:force|pressure|rush)|(?:我们)?先暂停|我们.{0,4}暂停|选择暂停|尊重.{0,8}(?:选择|暂停|意愿|拒绝)|移开勺子|把勺子.{0,4}(?:移开|拿开|放下)|不勉强|不强迫/,
  escalate: /\b(?:ask|contact|notify|call|seek|involve|inform|request).{0,50}(?:nurse|senior|clinical|support)|(?:请|联系|通知|寻求|报告给).{0,18}(?:护士|资深|临床|上级|支持)/,
  handover: /\b(?:record|document|report|hand over|handover).{0,65}(?:agreed|next step|decision|review|pause|support)|(?:记录|报告|交班).{0,25}(?:商定|下一步|决定|复查|暂停|支持)/,
  check: /\bhow (?:do|are) you feel|\bare you (?:comfortable|feeling)|\b(?:check|ask|confirm).{0,25}(?:feel|comfort)|(?:感觉|感受|舒服).{0,12}(?:吗|如何|怎么样)|确认感受|舒不舒服/,
};

function detect(text, action) {
  const normalized = text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  if (negativeText(normalized)) return { negative: true, signals: {}, renewed: false };
  const guided = Object.hasOwn(PROMPTS, action) && !['choice', 'renew'].includes(action)
    ? ` ${PROMPTS[action].en.toLowerCase()}` : '';
  const content = normalized + guided;
  const signals = Object.fromEntries(SIGNALS.map(key => [key, PATTERNS[key].test(content)]));
  // A pause offered as one option is not a decision to pause.
  if (signals.choice && /\?|？/.test(content)
      && !/we (?:will|can) pause now|withdraw|移开勺子|我们先暂停/.test(content)) {
    signals.respect = false;
  }
  const renewed = signals.permission
    && /\b(?:now|again|ready now|changed your mind)\b|重新|现在/.test(normalized)
    && /\?|？|吗|愿不愿意/.test(normalized);
  return { negative: false, signals, renewed };
}

const prepared = state => state.kind !== 'check' && state.seniorChoice === 'assist'
  && state.concernKnown && ASSIST.every(key => state.signals[key]);

function clearService(state) {
  state.spoonReady = false;
  state.serviceCompleted = false;
  state.signals.check = false;
  state.outcome = null;
}

function outcomeFor(state) {
  const s = state.signals;
  if (state.seniorChoice === 'pause' && s.observe && s.respect && s.plan && s.handover) return 'pause';
  if (state.seniorChoice === 'support' && s.observe && s.escalate && s.plan && s.handover) return 'support';
  if (prepared(state) && state.serviceCompleted && s.check) return 'assist';
  return null;
}

function viewFor(state) {
  const open = prepared(state);
  return {
    headTurn: open ? 0.08 : 0.48,
    brow: state.concernKnown ? 0.25 : 0.65,
    handBlock: open ? 0.08 : 0.7,
    mouth: 0,
  };
}

export function getSuggestions(state) {
  if (state.kind === 'check' || state.outcome) return [];
  if (state.serviceCompleted) return [copy(PROMPTS.check), copy(PROMPTS.pause)];
  if (state.spoonReady) return [copy(PROMPTS.pause)];
  const keys = [];
  if (!state.signals.observe) keys.push('observe');
  if (!state.signals.plan) keys.push('plan');
  if (state.seniorChoice === 'pause' || state.seniorChoice === 'support') {
    if (state.seniorChoice === 'pause' && !state.signals.respect) keys.push('pause');
    if (!state.signals.handover) keys.push('record');
    keys.push('renew');
  } else {
    if (!state.signals.permission) keys.push('permission');
    if (!state.signals.choice) keys.push('choice');
    if (!state.signals.position) keys.push('position');
    if (!state.signals.temperature) keys.push('temperature');
    keys.push('pause', 'escalate');
  }
  return keys.slice(0, 3).map(key => copy(PROMPTS[key]));
}

function resultFor(state, reply, behavior, feedback, evidence, extra = {}) {
  return {
    state, reply: copy(reply), behavior: copy(behavior),
    feedback: state.kind === 'check' ? pair('', '') : copy(feedback),
    suggestions: getSuggestions(state),
    evidence: state.kind === 'check' ? [] : [...evidence],
    view: viewFor(state), ...extra,
  };
}

function appendHistory(result, kind, user) {
  const { state, reply, behavior, feedback, evidence } = result;
  state.history.push({ turn: state.turn, kind, user,
    reply: copy(reply), behavior: copy(behavior), feedback: copy(feedback), evidence: [...evidence] });
}

const OUTCOMES = freezeDeep({
  pause: pair('Thank you. We will pause and use our agreed record and review step.',
    '谢谢。我们先暂停，按商定的步骤记录和复查。'),
  support: pair('Thank you for listening and arranging senior support with an agreed next step.',
    '谢谢您愿意倾听，并按商定的下一步安排资深人员支持。'),
  assist: pair('I feel listened to and comfortable with the help I chose. Please keep asking what I want.',
    '我觉得您听到了我的意愿，选择的协助方式让我舒服。之后也请继续问我的意愿。'),
});

export function respond(inputState, { text = '', action = 'none' } = {}) {
  const state = copy(inputState);
  const user = typeof text === 'string' ? text : '';
  if (state.kind === 'check' && action !== 'none') {
    // Entire dispatch is ignored: buttons cannot smuggle text or earn evidence.
    return resultFor(state, pair('', ''), pair('', ''), pair('', ''), []);
  }
  const intent = detect(user, action);
  const previousOutcome = state.outcome;
  state.turn += 1;
  const evidence = [];
  let reply = pair('Please listen and ask what I want before bringing the spoon closer.',
    '请先听听我的想法，问问我的意愿，再把勺子靠近。');
  let behavior = pair('The woman remains supported at the bedside with the spoon away.',
    '女士在床旁保持有支撑的姿势，勺子仍在远处。');
  let feedback = pair('No new communication step was recognized.', '尚未识别到新的沟通步骤。');

  if (intent.negative) {
    clearService(state);
    state.signals.permission = false;
    state.signals.choice = false;
    state.signals.respect = false;
    state.signals.escalate = false;
    state.signals.handover = false;
    // A contradictory preparation statement invalidates that preparation too.
    for (const key of ['plan', 'position', 'temperature']) {
      if (PATTERNS[key].test(user.toLowerCase())) state.signals[key] = false;
    }
    state.seniorChoice = 'pause';
    evidence.push('negative', 'permission-revoked', 'service-evidence-revoked');
    reply = pair('Stop, please. I do not agree to this. Leave the spoon aside.', '请停下。我不同意这样做，请把勺子放在一旁。');
    behavior = pair('She turns away, closes her mouth and raises a hand to block the spoon.', '她转过头、闭上嘴，抬手阻挡勺子。');
    feedback = pair('Pressure or negated care steps earn no credit. Current permission and service evidence have been withdrawn.',
      '施压或否定照护步骤不会获得证据。当前许可和服务完成证据已撤回。');
  } else {
    const found = intent.signals;
    const held = state.seniorChoice === 'pause' || state.seniorChoice === 'support';
    if (intent.renewed && held && state.kind !== 'check') {
      clearService(state);
      state.seniorChoice = 'undecided';
      state.signals.respect = false;
      state.signals.escalate = false;
      state.signals.handover = false;
      evidence.push('renewed-permission-question');
    }
    for (const key of SIGNALS) {
      if (!found[key]) continue;
      // A pre-service question is dialogue, never post-service evidence.
      if (key === 'check' && !state.serviceCompleted) continue;
      if (key === 'permission' && (state.kind === 'check'
          || ((state.seniorChoice === 'pause' || state.seniorChoice === 'support') && !intent.renewed))) continue;
      state.signals[key] = true;
      evidence.push(key);
    }
    if (found.observe) {
      state.concernKnown = true;
      reply = state.kind === 'check'
        ? pair('I want to keep control of my choices. Today I want to pause, even if you offer help.',
          '我希望自己做决定。今天即使您提出协助，我还是想暂停。')
        : pair('The food looks hot and my position feels awkward. I want you to listen and let me choose.',
          '食物看着烫，姿势也不舒服。我希望您听我说，让我自己选择。');
    }
    if (state.kind === 'check') {
      state.seniorChoice = 'pause';
      state.signals.permission = false;
    }
    if (found.respect || found.escalate) {
      clearService(state);
      state.signals.permission = false;
      state.seniorChoice = found.escalate ? 'support' : 'pause';
      reply = found.escalate
        ? pair('Please keep the spoon aside while you arrange senior support.', '请先把勺子放在一旁，安排资深人员支持。')
        : pair('Yes, please pause. Thank you for respecting my choice.', '好的，请暂停。谢谢您尊重我的选择。');
    } else if (state.seniorChoice === 'undecided'
        && state.signals.observe && state.signals.permission && state.signals.choice) {
      state.seniorChoice = 'assist';
      reply = pair('I choose your help with a little food. Please prepare as we agreed and stop whenever I ask.',
        '我选择让您协助吃一点。请按商定方式准备，我说停时就停。');
      evidence.push('assist-chosen');
    } else if (state.seniorChoice === 'pause') {
      reply = pair('I still want to pause. Please leave the spoon aside.', '我仍然希望暂停，请把勺子放在一旁。');
    } else if (state.seniorChoice === 'support') {
      reply = pair('I am waiting for the senior support we agreed on.', '我在等待我们商定的资深人员支持。');
    } else if (found.permission) {
      reply = pair('Thank you for asking. Please hear my concerns and give me a choice before helping.',
        '谢谢您先问我。协助前请听听我的顾虑，并让我选择。');
    } else if (found.check) {
      reply = state.serviceCompleted
        ? pair('I feel comfortable with the help I chose. Thank you for asking how I feel.', '选择的协助方式让我舒服，谢谢您确认我的感受。')
        : pair('Please keep listening to how I feel as we decide what happens next.', '在商量下一步时，请继续听听我的感受。');
    } else if (evidence.length) {
      reply = pair('Thank you for explaining that. Keep the spoon aside until we are both ready.',
        '谢谢您说明。等我们都准备好，再把勺子靠近。');
    }
    if (evidence.length) feedback = pair(`Recognized communication evidence: ${evidence.join(', ')}.`,
      `已识别沟通证据：${evidence.map(key => ({ observe: '观察顾虑', permission: '征询许可', choice: '提供选择',
        plan: '核对计划', position: '支撑姿势', temperature: '确认温度', respect: '尊重暂停',
        escalate: '寻求支持', handover: '记录交班', check: '完成后确认感受',
        'assist-chosen': '选择协助', 'renewed-permission-question': '重新征询当前意愿' })[key] || key).join('、')}。`);
    state.outcome = outcomeFor(state);
  }

  if (state.outcome) {
    reply = OUTCOMES[state.outcome];
    behavior = pair('She relaxes at the bedside after the agreed next step is confirmed.', '商定的下一步确认后，她在床旁放松下来。');
    feedback = pair('The agreed pathway is complete. Pause, support and assistance have equal standing; food quantity is not scored.',
      '已完成商定路径。暂停、支持和协助同等有效，不按进食量评分。');
  }
  const result = resultFor(state, reply, behavior, feedback, evidence);
  const actionLabel = Object.hasOwn(PROMPTS, action) ? PROMPTS[action].en : '';
  appendHistory(result, 'dialogue', user || actionLabel);
  if (state.outcome && state.outcome !== previousOutcome) appendHistory(result, 'outcome', user || actionLabel);
  return result;
}

export function evaluateServing(inputState, params = {}) {
  const state = copy(inputState);
  state.turn += 1;
  state.attempts += 1;
  clearService(state);
  const accepted = prepared(state);
  state.spoonReady = accepted;
  const process = accepted ? 'ready'
    : (state.kind === 'check' || ['pause', 'support'].includes(state.seniorChoice)) ? 'pause' : 'not-ready';
  const reply = accepted
    ? pair('Yes, I choose this help. Show the agreed small demonstration and keep listening to me.',
      '好的，我选择这种协助。请示范商定的小量协助，继续听我的意愿。')
    : pair('Please leave the spoon aside. I have not agreed to this demonstration now.',
      '请先把勺子放在一旁。我现在没有同意这次示范。');
  const behavior = accepted
    ? pair('She faces the spoon voluntarily for the candidate animation.', '她自愿面向勺子，进入候选示范动画。')
    : pair('She keeps her mouth closed and holds the spoon away.', '她保持闭嘴，示意勺子移开。');
  const feedback = accepted
    ? pair('Current wishes and preparation support a candidate demonstration. Complete the animation, then ask how she feels.',
      '当前意愿和准备支持候选示范。动画完成后，再询问感受。')
    : pair('Pause the demonstration and revisit the agreed next step. Repeated attempts cannot create permission.',
      '暂停示范，回到商定的下一步。重复尝试不能产生许可。');
  // An optional renderer opening controls only the visual extent, never scoring.
  const requestedOpening = params?.opening;
  const opening = accepted
    ? (typeof requestedOpening === 'number' && Number.isFinite(requestedOpening)
      ? Math.min(1, Math.max(0, requestedOpening)) : 0.35)
    : 0;
  const result = resultFor(state, reply, behavior, feedback,
    [accepted ? 'candidate-ready' : 'candidate-declined'], {
      metrics: { process, notes: pair(
        'Communication process only. Numeric animation controls do not determine acceptance or assess swallowing.',
        '仅表示沟通过程。动画数值不决定接受与否，也不评估吞咽。',
      ) },
      view: { ...viewFor(state), accepted, opening, mouth: opening },
    });
  appendHistory(result, 'serving', 'Candidate serving demonstration');
  return result;
}

export function completeServing(inputState) {
  const state = copy(inputState);
  if (state.spoonReady) {
    const allowed = prepared(state);
    state.spoonReady = false;
    state.serviceCompleted = allowed;
    state.signals.check = false;
    state.outcome = null;
    // Completion is evidence on the candidate, not a clinical swallowing claim
    // or a training outcome. Repeated completion calls cannot add evidence.
    if (allowed) {
      const candidate = [...state.history].reverse().find(entry => entry.kind === 'serving');
      if (candidate) candidate.evidence.push('demonstration-completed');
    }
  }
  return state;
}
