/**
 * 康养护工示范训练：坐姿上肢前伸—停留—回收。
 * 确定性教学模拟，不是医疗处方；0–100 数值均为非临床归一化指标。
 * tempo 是一次前伸—停留—回收的节奏参数（秒），hold 为停留秒数。
 * metrics.lag / view.delay 使用秒，其余 metrics 除 tempo/hold 外使用 0–100。
 */
export const SCENARIO = Object.freeze({
  name: '周阿姨',
  age: 76,
  title: '坐姿上肢前伸：看示范、停一停、收回来',
  brief: '你是真人被训护工，老人具身模仿者跟随你的示范。结合解释、坐姿提示与感受询问，调整幅度和节奏。本场景仅作训练模拟，非医疗处方；数值不是临床量表。',
});

export const INITIAL_MESSAGE = '我先坐着看你做一遍，好吗？手要伸到哪里、什么时候收回来，我还不太明白。';
export const INITIAL_SUGGESTIONS = Object.freeze([
  '我先示范向前伸、停一下再收回来，您愿意试试吗？',
  '先坐稳，双脚落地，肩膀放松。',
  '我们慢一点，酸累就停，随时告诉我感受。',
]);

const ACTIONS = new Set(['explain', 'posture', 'slow', 'rest', 'check', 'encourage', 'none']);
const ACTION_TEXT = {
  explain: '解释前伸、停留、回收，并询问是否愿意尝试',
  posture: '提示坐稳、双脚落地和肩膀放松',
  slow: '放慢示范并缩小幅度',
  rest: '暂停动作，安排休息',
  check: '询问感受、酸累或疼痛',
  encourage: '温和鼓励，按自己的节奏尝试',
  none: '等待老人回应',
};

function clamp(value, min = 0, max = 100, fallback = min) {
  const number = typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}
const round = value => Math.round(value * 100) / 100;

// Copy the complete plain-data tree so callers may edit a result independently.
function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)]));
  }
  return value;
}

export function createState() {
  return {
    turn: 0, stage: 'observe', trust: 45, fatigue: 22, comprehension: 35, comfort: 58,
    skills: { explain: false, posture: false, pacing: false, check: false },
    history: [], completed: false, rounds: 0, bestScore: 0, latestMotion: null,
    flags: { consent: false, negative: false, needsRest: false, soreness: false, struggling: false },
  };
}

function finish(state) {
  for (const key of ['trust', 'fatigue', 'comprehension', 'comfort', 'bestScore']) {
    state[key] = round(clamp(state[key]));
  }
  state.flags.needsRest = state.fatigue >= 70 || state.comfort < 30 || state.flags.soreness;
  // Completion describes current readiness, not a permanent lock or past badge.
  state.completed = state.rounds >= 2 && state.skills.explain && state.skills.posture
    && state.skills.check && (state.latestMotion?.metrics.score ?? 0) >= 75 && state.fatigue < 75;
  if (state.completed) state.stage = 'completed';
  else if (state.flags.negative || state.flags.needsRest || state.flags.struggling) state.stage = 'adapt';
  else if (state.rounds > 0) state.stage = 'practice';
  else if (Object.values(state.skills).some(Boolean)) state.stage = 'prepare';
  else state.stage = 'observe';
}

function suggestions(state) {
  if (state.flags.needsRest || state.flags.negative) {
    return ['先把手臂放下休息，酸累就停。', '现在感觉怎么样，有没有疼？', '等您愿意，我们缩小幅度、慢一点。'];
  }
  const choices = [];
  if (!state.skills.explain) choices.push(INITIAL_SUGGESTIONS[0]);
  if (!state.skills.posture) choices.push(INITIAL_SUGGESTIONS[1]);
  if (!state.skills.check) choices.push('刚才手臂有什么感受，有没有酸或疼？');
  choices.push('看我慢慢示范，小幅前伸，停一下再收回来。',
    '按您舒服的速度来，跟不上就告诉我。', '我们先休息一下，再决定是否继续。');
  return choices.slice(0, 3);
}

function feedback(state, intent) {
  if (intent === 'negative') return {
    reply: '你一催，我就有点紧张，手臂也酸了。这个速度我跟不上，能先停一停吗？',
    behavior: '手臂回收，肩膀紧绷，身体略向后退，暂缓跟随。',
    coach: '催促和强迫降低了舒适与信任。先回应老人的困难，再询问是否愿意继续。',
  };
  if (intent === 'rest') return {
    reply: state.fatigue > 55
      ? '好，我先把手放下来歇歇，还是有点酸，等缓过来再看你示范。'
      : '歇一歇舒服些了。等会儿你慢慢做，我看清楚了再跟着试。',
    behavior: '双手落回腿上，肩膀逐渐放松，保持坐姿休息。',
    coach: '休息降低模拟疲劳；继续前重新询问感受，用实际示范检验调整是否合适。',
  };
  if (state.flags.needsRest) return {
    reply: '我听见了，不过手臂还酸着，想先放下来歇一会儿，再看你做。',
    behavior: '手臂放低，注视护工，暂不主动追加动作。',
    coach: '老人仍有酸累反馈，先暂停并询问感受；口头鼓励不能消除累积疲劳。',
  };
  const lines = {
    explain: ['这样说我明白些了，是向前伸、停一下再回来吧？你做一遍，我看着学。',
      '目光跟随护工双手，轻轻点头，等待完整示范。', '解释有助于理解；下一步用可看清的动作示范，而不是只重复口令。'],
    posture: ['脚放稳、肩膀松下来，坐着踏实多了。你慢慢示范，我再跟着伸手。',
      '双脚落地，坐稳骨盆，肩膀下沉，双手停在腿上。', '坐姿准备减少代偿，但动作幅度和速度仍需与老人能力相匹配。'],
    slow: ['慢一点我看得清，也不用急着追你的手了。先伸小一点，我试着跟上。',
      '放松肩部，注视示范，准备以较小幅度跟随。', '请把口头调整落实到下一次示范：幅度45–65、节奏3–6秒、停留0.6–2秒。'],
    check: [state.flags.struggling
      ? '刚才我想追上你的手，肩膀就抬起来了。能不能小一点、慢一点再做？'
      : '谢谢你问我，坐着还舒服。看到你怎么伸、怎么收，我心里就更有数。',
    '看向护工，描述刚才的感受，等待回应。', '询问感受后要回应反馈；用下一轮动作确认节奏与幅度是否合适。'],
    encourage: ['你让我按自己的速度来，我就没那么紧张了。再示范一次，我慢慢跟。',
      '与护工对视，肩膀稍放松，等待下一轮示范。', '温和鼓励支持信任，但不能替代解释、坐姿准备和感受确认。'],
    observation: ['你注意到了，我刚才确实有点跟不上。能把动作放慢、伸小一点，再让我试试吗？',
      '看向护工，放低手臂，等待针对刚才表现的调整。', '已回应练习中的跟随困难；接着询问感受，并在下一轮落实动作调整。'],
    none: ['我还在看你的手，接下来要怎么做呢？你说具体一点，再示范给我看看吧。',
      '保持坐姿，观察护工，等待明确提示。', '未识别到明确训练提示。请说明动作、调整坐姿或询问感受。'],
  };
  const [reply, behavior, coach] = lines[intent] || lines.none;
  return { reply, behavior, coach };
}

// Conservative clause-level rules: a negation governs the remainder of its
// clause, including coordinated instructions; punctuation/contrast resets it.
// Protect symptom descriptions and A-not-A questions, which are not refusals.
function affirmativeClause(clause) {
  const protectedPhrases = [];
  const masked = clause.replace(
    /有没有|会不会|能不能|好不好|疼不疼|痛不痛|酸不酸|累不累|舒不舒服|愿不愿意|不舒服|不适|跟不上|来不及|别着急|不用急|不着急/g,
    phrase => {
      protectedPhrases.push(phrase);
      return `\u0000${protectedPhrases.length - 1}\u0000`;
    },
  );
  const prefix = masked.split(/不要|不用|不必|无需|不需要|不许|不能|别|没有|没|未|不/)[0];
  return prefix.replace(/\u0000(\d+)\u0000/g, (_, index) => protectedPhrases[index]);
}

function evidenceFor(intents = {}) {
  // Current-turn evidence, never inferred from accumulated skills or feedback.
  return {
    negative: Boolean(intents.negative),
    explain: !intents.negative && Boolean(intents.explain),
    posture: !intents.negative && Boolean(intents.posture),
    pacing: !intents.negative && Boolean(intents.slow),
    check: !intents.negative && Boolean(intents.check),
    observation: !intents.negative && Boolean(intents.observation),
    rest: !intents.negative && Boolean(intents.rest),
  };
}

function detect(text, action, rounds) {
  // Protective prohibitions (不要忍痛 / 不要忽略感受) are not pressure.
  const pressureText = text.replace(
    /(?:不要|不用|不必|不能|不许|别|无需|不需要|不)(?:再)?(?:强迫|勉强|催快|催促|催|快点|加快|赶紧|忍(?:着|住)?(?:疼|痛)?|再高(?:一点)?|忽略|无视)/g, '',
  );
  const negative = /催快|快点|加快|赶紧|强迫|必须|不许停|不能停|别停|再高|忍|忽略|无视|(?:别|不用|不要)管/.test(pressureText);
  // Global negative priority also blocks explicit positive actions.
  if (negative) return { negative: true };

  const clauses = text.split(/[，,。.!！?？;；\n]|但是|不过|但|而是/).map(affirmativeClause);
  const has = pattern => clauses.some(clause => pattern.test(clause));
  const sensation = '(?:感受|感觉|疼|痛|酸|累|舒服|不适)';
  const inquiry = new RegExp(
    `${sensation}.{0,8}(?:怎么样|如何|怎样|吗|么|什么|哪里|哪儿)`
    + `|(?:有没有|是否|哪里|哪儿|怎么).{0,8}${sensation}`
    + '|疼不疼|痛不痛|酸不酸|累不累|舒不舒服'
    + `|(?:告诉我|说说|问问|询问|问一下).{0,10}${sensation}`,
  );
  const observation = rounds > 0 && clauses.some(clause =>
    /耸肩|前倾|跟不上|肩(?:膀)?.{0,4}抬|动作滞后|手(?:臂)?.{0,4}抖/.test(clause)
    && /看到|看见|注意到|发现|刚才|这次|您|你/.test(clause)
    && !/如果|假如|要是|可能|会不会|是否|有没有|吗|么|注意(?!到)|避免/.test(clause),
  );
  return {
    negative: false,
    consent: has(/愿意|同意|可以吗|好吗|好不好|能试试吗/),
    explain: action === 'explain' || has(/前伸|向前伸|伸.{0,8}(?:回来|收回)|收回来|回收手臂/),
    posture: action === 'posture' || has(/坐稳|双脚.{0,4}(?:落地|放稳|踩地)|肩(?:膀)?(?:要)?放松|放松肩/),
    slow: action === 'slow' || has(/慢一点|慢慢|放慢|跟我|缩小幅度|小幅|伸小一点/),
    rest: action === 'rest' || has(/休息|歇|暂停|酸.{0,5}停|累.{0,5}停|疼.{0,5}停|痛.{0,5}停/),
    check: action === 'check' || has(inquiry),
    observation,
    encourage: action === 'encourage' || has(/别着急|不用急|不着急|做得好|按.{0,5}速度/),
  };
}

export function respond(state, { text = '', action = 'none' } = {}) {
  const next = copy(state);
  text = typeof text === 'string' ? text.trim() : '';
  action = ACTIONS.has(action) ? action : 'none';
  const intents = detect(text, action, state.rounds);
  const evidence = evidenceFor(intents);
  next.turn += 1;
  next.flags.negative = intents.negative;
  let intent = 'none';
  if (intents.negative) {
    next.fatigue += 12;
    next.comfort -= 16;
    next.trust -= 10;
    next.flags.struggling = true;
    intent = 'negative';
  } else {
    if (intents.observation) intent = 'observation';
    // Skill rewards are one-time; repeating keywords cannot farm readiness.
    const rewards = [
      ['explain', 'explain', 6, 18, 3], ['posture', 'posture', 3, 5, 7],
      ['slow', 'pacing', 3, 7, 5], ['check', 'check', 5, 4, 5],
    ];
    for (const [name, skill, trust, comprehension, comfort] of rewards) {
      if (!intents[name]) continue;
      intent = name;
      if (!next.skills[skill]) {
        next.trust += trust;
        next.comprehension += comprehension;
        next.comfort += comfort;
      }
      next.skills[skill] = true;
    }
    if (intents.consent || action === 'explain') next.flags.consent = true;
    if (intents.encourage) {
      next.trust += 2;
      next.comfort += 1;
      if (intent === 'none') intent = 'encourage';
    }
    if (intents.rest) {
      next.fatigue -= 20;
      next.comfort += 9;
      next.flags.soreness = next.fatigue > 55;
      intent = 'rest';
    }
  }
  finish(next);
  const result = feedback(next, intent);
  next.history.push({ kind: 'dialogue', user: text || ACTION_TEXT[action],
    reply: result.reply, coach: result.coach, turn: next.turn });
  return { state: next, ...result, suggestions: suggestions(next), evidence };
}

export function evaluateMotion(state, {
  amplitude = 55, tempo = 4.5, hold = 1.2, smoothness = 75, source = 'preset',
} = {}) {
  const next = copy(state);
  amplitude = clamp(amplitude, 0, 100, 55);
  tempo = clamp(tempo, 1.5, 8, 4.5);
  hold = clamp(hold, 0, 4, 1.2);
  smoothness = clamp(smoothness, 0, 100, 75);
  source = source === 'drag' ? 'drag' : 'preset';

  // Reference reach capacity is 65%; fatigue progressively lowers usable reach.
  const capacity = 65 - Math.max(0, next.fatigue - 30) * 0.22;
  const overload = Math.max(0, amplitude - capacity);
  const tooFast = Math.max(0, 3 - tempo);
  const tooSlow = Math.max(0, tempo - 6);
  const tooSmall = Math.max(0, 45 - amplitude);
  const holdError = Math.max(0, 0.6 - hold) + Math.max(0, hold - 2);
  const roughness = 100 - smoothness;
  const compensation = clamp(4 + overload * 1.35 + tooFast * 12
    + (next.skills.posture ? 0 : 17) + roughness * 0.15 + next.fatigue * 0.13);
  const lag = 0.18 + tooFast * 0.55 + overload * 0.018 + roughness * 0.006
    + next.fatigue * 0.006 + (100 - next.comprehension) * 0.004;
  const matching = clamp(100 - overload * 1.25 - tooFast * 13 - roughness * 0.22
    - next.fatigue * 0.12 - (100 - next.comprehension) * 0.08);
  const score = clamp(100 - compensation * 0.3 - lag * 5 - roughness * 0.12
    - overload * 0.45 - tooFast * 8 - tooSlow * 3 - tooSmall * 1.1
    - holdError * 7 - next.fatigue * 0.14 - (100 - next.comprehension) * 0.08);
  const metrics = {
    score: round(score), matching: round(matching), compensation: round(compensation),
    lag: round(lag), amplitude: round(amplitude), tempo: round(tempo), hold: round(hold),
  };
  const view = {
    maxReach: round(clamp(Math.min(amplitude, capacity) / 100, 0, 1)),
    delay: metrics.lag,
    compensation: round(compensation / 100),
    tremor: round(clamp(roughness * 0.006 + next.fatigue * 0.003 + overload * 0.004, 0, 1)),
  };
  next.turn += 1;
  next.rounds += 1;
  next.fatigue += 5 + overload * 0.22 + tooFast * 4 + holdError * 2 + roughness * 0.04;
  next.comfort += score >= 75 ? 2 : -(4 + overload * 0.2 + tooFast * 3);
  next.comprehension += score >= 75 ? 5 : 1;
  next.trust += score >= 75 ? 2 : -2;
  next.bestScore = Math.max(next.bestScore, metrics.score);
  next.latestMotion = { metrics: { ...metrics }, view: { ...view }, smoothness, source };
  next.flags.negative = false;
  next.flags.struggling = score < 75;
  next.flags.soreness = next.fatigue >= 65 || overload > 20;
  finish(next);

  let reply;
  let coach;
  if (next.flags.needsRest) {
    reply = '我看懂你怎么做了，可手臂已经有点酸，越跟越吃力，想先放下来歇歇。';
    coach = '老人出现酸累反馈，先休息并确认感受，再决定下一轮；不要只追求动作分数。';
  } else if (overload > 5 || tooFast > 0) {
    reply = '我想跟上你的手，可有点来不及，肩膀也跟着抬起来了。能慢些、伸小一点吗？';
    coach = '示范超出当前跟随能力。缩小到45–65的幅度、放慢到3–6秒，并观察耸肩和前倾。';
  } else if (roughness > 40) {
    reply = '你的手一顿一顿，我有点拿不准什么时候跟。能连贯地再做一遍吗？';
    coach = '提高示范连贯性，清楚展示前伸、短暂停留和回收，减少忽快忽慢。';
  } else if (tooSmall > 0 || holdError > 0 || tooSlow > 0) {
    reply = '我看见你在伸手，可伸到哪里、停多久还不太确定，想再看一遍完整的。';
    coach = '调整示范范围与停留：幅度45–65、节奏3–6秒、停留0.6–2秒是本模拟的参考区间。';
  } else if (score < 75) {
    reply = '动作我看明白些了，不过跟起来还是有点吃力，想先坐稳，再慢慢试一次。';
    coach = '结合坐姿、理解程度和疲劳调整；先确认感受，再进行下一轮示范。';
  } else {
    reply = next.completed
      ? '这回我能跟着伸、停、再收回来了。你这样慢慢示范，我心里踏实多了。'
      : '看到你这样示范，我明白怎么伸、怎么收了。这个幅度和速度，我能慢慢跟上。';
    coach = next.completed
      ? '本次达到训练完成条件。可继续练习；每轮仍需留意疲劳与老人反馈。'
      : '本轮跟随较好。继续确认感受，完成准备环节，并用下一轮检验稳定性。';
  }
  const behavior = compensation >= 35
    ? '跟随前伸时耸肩、躯干略前倾，动作滞后，回收时有轻微抖动。'
    : '保持坐姿，小幅前伸后停留并回收；跟随有轻微延迟。';
  next.history.push({ kind: 'motion',
    user: `动作示范：幅度${metrics.amplitude}，节奏${metrics.tempo}秒，停留${metrics.hold}秒，平滑度${round(smoothness)}（${source}）`,
    reply, coach, metrics: { ...metrics }, turn: next.turn });
  return { state: next, reply, behavior, coach, suggestions: suggestions(next),
    metrics, view, evidence: evidenceFor() };
}
