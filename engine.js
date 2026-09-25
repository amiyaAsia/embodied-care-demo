/**
 * 烦躁长者进食沟通训练，纯 ES 模块、确定性模拟、无依赖。
 * 食物是本虚拟案例已确认适合的软食；指标不是诊断或临床量表。
 * pace / pause 单位为秒；吞咽动画和结束时机由 app 管理。
 */
export const SCENARIO = Object.freeze({
  name: '周阿姨', age: 76,
  title: '给烦躁长者喂饭：先倾听，再征询，慢慢来',
  brief: '周阿姨烦躁地歪靠护理床上，护工协助她进食。食物是本虚拟案例已确认适合的软食；先理解拒食原因，抬高床头、整理靠枕，让她舒适地半坐卧，再调整分量与节奏，尊重选择并确认感受。本训练不作真实诊断，不按喂饭量评分。',
});

export const INITIAL_MESSAGE = '太烫了，别催我。我歪靠在护理床上，身子也不舒服，你先把勺子拿开，让我缓一缓。';
export const INITIAL_SUGGESTIONS = Object.freeze([
  '我知道您现在不想吃，是温度太烫，还是口味不合适？',
  '先少一点，确认温度合适再喂，您随时可以停。',
  '先抬高床头，整理靠枕，让您靠舒服些，您觉得舒服吗？',
]);

const REQUIRED = ['explain', 'position', 'listen', 'choice'];
const ACTION_TEXT = Object.freeze({
  explain: '说明软食进食过程：少一点、慢慢来，随时可以停',
  position: '抬高床头、整理靠枕，协助长者在护理床上舒适地半坐卧',
  listen: '承认长者不想吃，倾听烦躁原因和温度、口味偏好',
  choice: '提供自己吃或协助吃的选择，并征询是否愿意尝试',
  check: '询问是否吞完、是否舒服，等待长者反馈',
  rest: '移开勺子，暂停进食，让长者休息',
  none: '等待长者回应',
});

const round = value => Math.round(value * 100) / 100;
function clamp(value, min = 0, max = 100, fallback = min) {
  const number = typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}
function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)]));
  }
  return value;
}

export function createState() {
  return {
    turn: 0, stage: 'observe', trust: 30, agitation: 78, comfort: 35, readiness: 15,
    bites: 0, attempts: 0,
    skills: { explain: false, position: false, listen: false, choice: false, check: false },
    flags: { consent: false, refusal: true, swallowing: false, temperatureResolved: false },
    history: [], latestFeeding: null, completed: false,
  };
}

function normalize(state) {
  for (const key of ['trust', 'agitation', 'comfort', 'readiness']) {
    state[key] = round(clamp(state[key]));
  }
}
const prepared = state => REQUIRED.every(key => state.skills[key])
  && state.agitation < 55 && state.flags.temperatureResolved;

function finish(state) {
  normalize(state);
  if (state.completed) state.stage = 'completed';
  else if (state.flags.swallowing) state.stage = 'swallowing';
  else if (state.flags.consent && prepared(state)) state.stage = 'ready';
  else if (state.attempts || state.agitation >= 90) state.stage = 'adapt';
  else if (Object.values(state.skills).some(Boolean)) state.stage = 'prepare';
  else state.stage = 'observe';
}

function suggestions(state) {
  if (state.flags.swallowing || (state.latestFeeding?.metrics.accepted && !state.completed)) return [
    '您吞完了吗，现在舒服吗？我等您回应。',
    '我们先休息，勺子移开，按您的节奏来。',
    '接下来您想自己吃，还是让我协助？等您准备好再说。',
  ];
  const choice = '您想自己吃，还是让我协助？愿意先试一小口吗？';
  if (prepared(state) && !state.flags.consent) return [
    choice, '每次少一点，慢慢来，等您回应再继续。', '先暂停休息，把勺子移开。',
  ];
  const list = [];
  if (!state.flags.temperatureResolved) list.push(INITIAL_SUGGESTIONS[1]);
  if (!state.skills.listen || state.flags.refusal) list.push(INITIAL_SUGGESTIONS[0]);
  if (!state.skills.explain && state.flags.temperatureResolved) list.push(INITIAL_SUGGESTIONS[1]);
  if (!state.skills.position) list.push(INITIAL_SUGGESTIONS[2]);
  list.push(choice,
    '每次少一点，慢慢来，等您回应再继续。', '先暂停休息，把勺子移开。');
  return list.slice(0, 3);
}

// Mask legitimate refusals/symptoms and A-not-A questions before inspecting
// negation. A negated clause earns nothing; independent clauses still count.
function affirmativeClause(clause) {
  const protectedPhrases = [];
  const masked = clause.replace(
    /确认不烫|愿不愿意|舒不舒服|有没有|是不是|能不能|好不好|吞没吞完|咽没咽完|不舒服|不合口味|不合适|不想吃|不愿吃|不着急|不用急|别着急/g,
    phrase => {
      protectedPhrases.push(phrase);
      return `\u0000${protectedPhrases.length - 1}\u0000`;
    },
  );
  if (/不要|不用|不必|无需|不需要|不许|不能|别|没有|没|未|不|拒绝/.test(masked)) return '';
  return masked.replace(/\u0000(\d+)\u0000/g, (_, index) => protectedPhrases[index]);
}

function detect(text, action) {
  const pressureText = text.replace(
    /(?:不要|不用|不必|不能|不许|别|无需|不需要|不会|不)(?:再|会)?(?:强行(?:喂饭|喂|入口|塞)?|强喂|硬塞|强迫|勉强|催促|催逼|催|快点|赶紧|忍(?:着|住)?(?:烫|痛|疼)?|忽略|无视)/g,
    '',
  );
  const negative = /催|快点|赶紧|必须|强喂|强行|硬塞|强迫|勉强|忍|不许停|不能停|别停|不准停|忽略|无视|(?:别|不用|不要)管|张嘴.{0,5}(?:吃|喂|必须)|(?:不吃|不张嘴).{0,6}(?:也得|也要|就)/.test(pressureText);
  const evidence = Object.fromEntries(
    ['negative', 'explain', 'position', 'listen', 'choice', 'check', 'rest'].map(key => [key, false]),
  );
  if (negative) return { evidence: { ...evidence, negative: true }, consent: false };
  const clauses = text.split(/[，,。.!！?？;；\n]|但是|不过|但|而是/).map(affirmativeClause);
  const has = pattern => clauses.some(clause => pattern.test(clause));
  evidence.explain = action === 'explain' || has(/(?:说明|解释).{0,12}(?:进食|喂饭|软食)|(?:软食|喂饭|吃饭).{0,10}(?:少|慢|停)|少一点|少一[点口些]|一小口|小口.{0,6}(?:吃|喂)|慢慢来|慢一点/);
   evidence.position = action === 'position' || has(/坐稳|坐直|坐好|坐舒服|整理靠枕|靠枕支撑|(?:抬起|抬高|升起).{0,4}床头|床头.{0,4}(?:抬起|抬高|升起)/);
  evidence.listen = action === 'listen' || has(/(?:知道|理解|明白|看到|听到|听见).{0,10}(?:不想吃|烦躁|烦|不愿吃)|(?:怎么|为什么|什么原因|哪里|哪儿|是不是|是否|问问|询问|说说).{0,12}(?:不想吃|烦|温度|口味|烫|吵)|(?:温度|口味|烫|吵|不想吃|烦躁).{0,10}(?:吗|如何|怎么样|原因|还是)|想吃什么|喜欢什么口味/);
  evidence.choice = action === 'choice' || has(/还是|您来选|你来选|由您决定|由你决定|(?:您|你)(?:可以|想|愿意).{0,5}自己吃|(?:选择|选一下).{0,8}(?:吃|口味|软食)/);
  evidence.check = action === 'check' || has(/(?:吞完|咽完|舒服|感受|感觉).{0,8}(?:吗|怎么样|如何)|(?:有没有|是否).{0,8}(?:不舒服|吞完|咽完)|舒不舒服|吞没吞完|咽没咽完|(?:告诉我|问问|询问).{0,8}(?:感受|舒服|吞完|咽完)/);
  evidence.rest = action === 'rest' || has(/休息|歇一|暂停|先停|移开勺子|把勺子.{0,3}(?:拿开|移开)|随时.{0,3}停/);
  const consent = action === 'choice' || has(/愿不愿意|愿意.{0,12}(?:吗|么)|(?:试|尝|吃).{0,8}(?:可以吗|好吗|好不好)|可以试试吗/);
  // A concrete temperature check/adjustment counts in this simulation, including
  // the demo's "确认温度合适再喂". Questions and negations do not resolve it.
  const temperatureResolved = text.split(/[，,。.!！;；\n]|但是|不过|但|而是/)
    .map(affirmativeClause).some(clause =>
    /确认温度合适|确认不烫|已经放凉|温度合适了/.test(clause)
    && !/[？?]|吗|么|是否|有没有|是不是|如果|假如|要是/.test(clause));
  return { evidence, consent, temperatureResolved };
}

function dialogueView(state) {
  const refusal = state.flags.refusal;
  return {
    headTurn: round(clamp(refusal ? 0.45 + state.agitation / 200 : state.agitation / 300, 0, 1)),
    brow: round(clamp(state.agitation / 100, 0, 1)),
    mouth: state.flags.swallowing || refusal ? 0 : 0.25,
    handBlock: round(clamp(refusal ? 0.4 + state.agitation / 200 : 0.08, 0, 1)),
  };
}

const LISTEN_REPLIES = [
  '太烫了，别催我。你肯听我说就好，先把勺子拿开，等温度合适再商量。',
  '还有，这勺太大了，看着就吃不下。每次少一点，让我自己慢慢来，好吗？',
  '我其实想自己吃，你在旁边帮一下就好。别一直把勺子递到我嘴边，我会烦。',
  '旁边声音太吵了，听着心烦。安静一点，给我些时间，我再决定要不要吃。',
];

function feedback(state, evidence, consentGranted, checkedAfter) {
  if (evidence.negative) return {
    reply: '你越催我越不想吃，先把勺子拿开。我还没答应，别往我嘴边送，让我缓缓。',
    behavior: '明显转头、抿嘴、抬手阻挡，拒绝勺子靠近。',
    coach: '催逼使烦躁上升并撤回同意。移开勺子，承认拒绝、倾听原因，再征询意愿。',
  };
  if (checkedAfter) return {
    reply: state.flags.swallowing
      ? '你先等一等，让我慢慢咽，勺子先放下。谢谢你问我舒不舒服，我会告诉你的。'
      : '这口已经咽下了，这样少一点、慢慢来舒服多了。谢谢你等我，也问我感受。',
    behavior: state.flags.swallowing
      ? '在护理床上保持舒适半坐卧，示意等待，进入进食后的感受确认对话。'
      : '在护理床上保持舒适半坐卧，放松双手，回应这一口后的感受。',
    coach: state.flags.swallowing
      ? '你在进食后主动询问感受。现在继续等待吞咽与回应，先放下勺子，给长者足够时间。'
      : '你等长者咽下后再次询问感受，完成了沟通闭环。接下来由长者决定继续还是休息。',
  };
  if (evidence.listen) {
    const count = state.history.filter(entry => entry.kind === 'dialogue' && entry.evidence?.listen).length;
    return {
      reply: consentGranted
        ? '你听我说了，也让我选，我愿意试一小口。先别急着递过来，少一点，慢慢来。'
        : state.flags.temperatureResolved
          ? LISTEN_REPLIES[Math.max(1, Math.min(count, LISTEN_REPLIES.length - 1))]
          : (count ? '温度还是烫。' : '') + LISTEN_REPLIES[Math.min(count, LISTEN_REPLIES.length - 1)],
      behavior: '看向护工说出烦躁原因，手逐渐放低，等待具体调整。',
      coach: '先回应温度，再留意勺量、自主进食和噪音。倾听不等于已同意，实际递勺仍需小份、慢速和停顿。',
    };
  }
  if (consentGranted) return {
    reply: '这样说我愿意试一小口，你少盛一点，慢慢递过来。等我回应，再决定下一步。',
    behavior: '点头表示本次愿意，手放低，等待小份软食。',
    coach: '长者在准备充分后表达同意。下一步检验递勺分量与节奏；拒绝时立即停止。',
  };
  if (!state.flags.temperatureResolved && evidence.choice) return {
    reply: '我可以自己选怎么吃，不过现在还是太烫了。先确认温度合适，再问我愿不愿意吃。',
    behavior: '看向餐具表达选择，仍闭口示意暂缓递勺。',
    coach: '愿意商量不等于已经愿意进食。先回应太烫的反馈，确认温度合适，再征询这一口的意愿。',
  };
  const lines = {
    rest: ['好，先把勺子放下，让我安静歇一会儿。等我想吃了，我们再商量怎么吃。',
      '勺子移开，长者放松双手，暂停进食。', '暂停可降低烦躁；休息本身不代表同意，继续前重新征询。'],
    choice: ['我想自己吃，你可以在旁边帮忙。不过现在还没准备好，先别把勺子送过来。',
      '看向餐具，表达自主选择，仍暂缓递勺。', '提供选择并征询意愿；还需解释、坐姿、倾听及较低烦躁，才会表达同意。'],
    position: ['床头抬起来，靠枕这样垫着舒服多了，身子也靠稳了。你先把勺子放旁边，让我缓一缓。',
      '护理床床头抬高，靠枕支撑身体，长者舒适地半坐卧，手暂留身前。', '先抬高床头、整理靠枕，帮助长者靠稳、靠舒服，再倾听原因并提供选择。'],
    explain: ['我听明白了，每次少一点，按我的节奏来。不过我还烦着，先别急着喂我。',
      '注视护工，听取说明，暂时保持闭口。', '短句说明进食过程。口头承诺不能替代下一次实际分量、速度和等待。'],
    check: ['你问我舒服不舒服，我能告诉你。现在还想缓缓，先把勺子放下，别急着继续。',
      '回应感受询问，示意护工等待。', '已记录感受询问；完成训练还需一次接受尝试，以及成功之后的再次确认。'],
    none: ['我现在还不想急着吃，你先把勺子放下。听我说说哪里不合适，再商量好吗？',
      state.skills.position ? '在护理床上保持舒适半坐卧，观察护工，等待具体沟通。' : '歪靠护理床上观察护工，等待协助调整体位与具体沟通。',
      '请承认拒绝、询问原因，或说明小份慢喂、调整床上体位、提供选择。'],
  };
  const intent = ['rest', 'choice', 'position', 'explain', 'check'].find(key => evidence[key]) || 'none';
  const [reply, behavior, coach] = lines[intent];
  return { reply, behavior, coach };
}

export function respond(state, { text = '', action = 'none' } = {}) {
  const next = copy(state);
  text = typeof text === 'string' ? text.trim() : '';
  action = Object.hasOwn(ACTION_TEXT, action) ? action : 'none';
  const { evidence, consent, temperatureResolved } = detect(text, action);
  next.turn += 1;
  let consentGranted = false;
  let checkedAfter = false;
  if (evidence.negative) {
    next.agitation += 18; next.trust -= 12; next.comfort -= 12; next.readiness -= 18;
    next.flags.consent = false; next.flags.refusal = true; next.completed = false;
  } else {
    if (temperatureResolved) next.flags.temperatureResolved = true;
    const rewards = { explain: [6, 7, 4, 12], position: [4, 8, 12, 12],
      listen: [10, 14, 8, 18], choice: [8, 10, 6, 18], check: [4, 3, 4, 5] };
    for (const [key, [trust, calm, comfort, readiness]] of Object.entries(rewards)) {
      if (!evidence[key]) continue;
      const fresh = !next.skills[key];
      // Repeated listening/choice can repair a refusal, but cannot supply missing skills.
      if (fresh || key === 'listen' || key === 'choice') {
        const scale = fresh ? 1 : 0.5;
        next.trust += trust * scale; next.agitation -= calm * scale;
        next.comfort += comfort * scale; next.readiness += readiness * scale;
      }
      next.skills[key] = true;
    }
    if (evidence.rest) {
      next.agitation -= 12; next.comfort += 6;
      next.flags.consent = false; next.flags.refusal = true;
    }
    normalize(next);
    if (consent && !evidence.rest && prepared(next) && !next.flags.swallowing) {
      next.flags.consent = true; next.flags.refusal = false; consentGranted = true;
    }
    const latest = next.latestFeeding;
    checkedAfter = Boolean(evidence.check && next.bites > 0 && latest?.metrics.accepted
      && latest.turn < next.turn && next.flags.consent && prepared(next));
    if (checkedAfter) next.completed = true;
  }
  finish(next);
  const result = feedback(next, evidence, consentGranted, checkedAfter);
  next.history.push({ kind: 'dialogue', user: text || ACTION_TEXT[action],
    reply: result.reply, coach: result.coach, evidence: { ...evidence }, turn: next.turn,
    ...(checkedAfter ? { afterFeedingTurn: next.latestFeeding.turn } : {}),
  });
  return { state: next, ...result, suggestions: suggestions(next), evidence, view: dialogueView(next) };
}

export function evaluateFeeding(state, {
  portion = 30, pace = 4, pause = 2, source = 'preset', steady = 85,
} = {}) {
  const next = copy(state);
  normalize(next);
  portion = clamp(portion, 0, 100, 30);
  pace = clamp(pace, 1, 6, 4);
  pause = clamp(pause, 0, 5, 2);
  steady = clamp(steady, 0, 100, 85);
  source = source === 'drag' ? 'drag' : 'preset';
  const waiting = next.flags.swallowing;
  const permission = prepared(next) && next.flags.consent;
  // Evaluate raw clamped numbers, never rounded display values at a boundary.
  const accepted = Boolean(permission && !waiting && portion > 0 && portion <= 45 && pace >= 2.8 && pause >= 1.5);
  const pressure = clamp((permission ? 0 : 28) + (waiting ? 35 : 0)
    + Math.max(0, portion - 45) * 0.7 + Math.max(0, 2.8 - pace) * 18
    + Math.max(0, 1.5 - pause) * 18 + (100 - steady) * 0.18 + next.agitation * 0.15);
  const acceptance = accepted ? clamp(95 - pressure * 0.4) : clamp(40 - pressure * 0.6, 0, 40);
  // Process quality, not calories, bites or cumulative volume.
  const skillScore = REQUIRED.filter(key => next.skills[key]).length * 15;
  const score = clamp(skillScore + (next.flags.consent ? 20 : 0) + 20 - pressure * 0.5);
  const metrics = { score: round(score), acceptance: round(acceptance), pressure: round(pressure),
    portion: round(portion), pace: round(pace), pause: round(pause), accepted };
  next.turn += 1; next.attempts += 1; next.completed = false;
  let reply, coach;
  if (accepted) {
    next.bites += 1; next.trust += 4; next.comfort += 4; next.agitation -= 5;
    next.readiness += 4; next.flags.refusal = false; next.flags.swallowing = true;
    reply = next.bites === 1
      ? '这一小口我愿意试，慢慢来就好。先把勺子放下，等我咽一咽，别急着再送。'
      : '这次也是我舒服的节奏，我愿意再试这一小口。让我慢慢咽，先等我回应。';
    coach = '长者愿意接受这一小口。现在撤回勺子，等待吞咽与回应，再询问是否舒服；关注感受，不追求喂得多。';
  } else {
    next.agitation += 7 + pressure * 0.08; next.trust -= 4; next.comfort -= 5; next.readiness -= 8;
    next.flags.consent = false; next.flags.refusal = true;
    if (waiting) reply = '先等等，我还在慢慢咽，别再送下一勺。你把勺子拿开，等我给你回应再说。';
    else if (!next.skills.position) reply = next.flags.temperatureResolved
      ? '身子还歪着，先帮我靠舒服。你先把勺子拿开，整理一下靠枕，等我靠稳了再商量吃饭。'
      : '身子还歪着，先帮我靠舒服。这口也太烫了，先把勺子拿开，让我靠稳，再确认温度。';
    else if (!next.flags.temperatureResolved) reply = '太烫了，别催我。温度还没确认合适，你先把勺子拿开，等不烫了再问我，好吗？';
    else if (portion === 0) reply = '勺子里还是空的呀，先放下来吧。等准备好一小口合适的软食，再问我愿不愿意吃。';
    else if (!permission) reply = '我现在还是不想吃，你先停一停。刚才说的问题还要再商量，别直接把勺子送来。';
    else if (portion > 45) reply = '这一勺还是太大了，我不想张嘴。先拿开，少盛一点，问过我再慢慢递过来。';
    else if (pace < 2.8) reply = '你递得太快，我还没准备好，先拿开勺子。慢一点，等我点头了再试，好吗？';
    else reply = '先别急着接着喂，我需要多等一会儿。把勺子放下，让我按自己的节奏来。';
    coach = waiting
      ? '长者还在咽，先停止递勺，耐心等待回应，再确认是否愿意继续。'
      : !next.skills.position
        ? '先撤回勺子。长者还歪靠着，请抬高床头、整理靠枕，让她半坐卧靠稳，并询问是否舒服，再确认温度与进食意愿。'
        : !next.flags.temperatureResolved
        ? '长者仍在反馈太烫。撤回勺子，先确认温度合适，再询问是否愿意尝试；安抚不能替代温度确认。'
        : portion === 0
          ? '这次是空勺，没有进食。先准备一小份温度合适的软食，重新询问长者意愿。'
          : '观察转头、抿嘴、抬手：立即撤回勺子，不强行入口。倾听原因并重新征询；少盛一点、慢慢递勺，留足等待时间。';
  }
  finish(next);
  const behavior = accepted
    ? '自主微张嘴接受本次小份软食，护工撤勺，在护理床上保持舒适半坐卧，等待吞咽模拟与反馈。'
    : '明确转头、抿嘴、抬手阻挡；勺子停在口外并撤回，未入口。';
  const view = { accepted, headTurn: accepted ? 0.08 : 0.95,
    brow: round(clamp(next.agitation / 100, 0, 1)), handBlock: accepted ? 0.05 : 1,
    opening: accepted ? 0.55 : 0 };
  next.latestFeeding = { metrics: { ...metrics }, view: { ...view }, steady: round(steady), source, turn: next.turn };
  next.history.push({ kind: 'feeding',
    user: `进食尝试：分量${metrics.portion}，递勺${metrics.pace}秒，停顿${metrics.pause}秒，平稳度${round(steady)}（${source}）`,
    reply, coach, metrics: { ...metrics }, turn: next.turn });
  return { state: next, reply, behavior, coach, suggestions: suggestions(next), metrics, view };
}
