// Fixed, language-independent shot timings in milliseconds. Each view is complete,
// including pressure values so seeking or rewinding cannot retain a wrong-path pose.
const copy = (en, zh) => ({ en, zh });
const view = (changes = {}) => ({
  senior: 'tan', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'tv',
  tv: true, gesture: 'none', push: 0, recoil: 0, workerLean: 0, ...changes,
});
const step = (id, kind, duration, text, scene, options = {}) => ({
  id, kind, speaker: null, text, action: null, duration, view: scene,
  cutaway: null, ...options,
});
const refusal = () => view({ mood: 'resistant', bowl: 'away', gesture: 'push-bowl', push: 0.3 });
const pause = () => view({ mood: 'settled', bowl: 'away' });

export const OVERVIEW = {
  id: 'overview',
  title: copy('Amiya Care Practice in about a minute', '约一分钟了解 Amiya Care Practice'),
  focus: copy('Hui Lin and Ms Tan · A meal in the lounge', '慧琳与陈女士 · 休息厅的一餐'),
  steps: [
    step('overview-title', 'narration', 6000, copy(
      'Ms Tan has mild dementia; she may not recall earlier meals.',
      '陈女士有轻度失智症，可能不记得先前是否用过餐。'), view()),
    step('overview-refusal', 'dialogue', 6000, copy(
      'Leave it there. I’ve already eaten.', '放在那里吧。我已经吃过了。'), refusal(), {
      speaker: 'Ms Tan', action: copy('Bowl slides away.', '碗被推远。'),
    }),
    step('overview-insist', 'dialogue', 5000, copy(
      'You need to eat now.', '您现在需要吃饭。'),
    view({ mood: 'resistant', bowl: 'away', worker: 'near', gesture: 'listen', push: 0.3, workerLean: 1 }), {
      speaker: 'Hui Lin', action: copy('Hui Lin leans closer.', '慧琳俯身靠近。'),
    }),
    step('overview-harder-refusal', 'dialogue', 5000, copy(
      'No. Stop!', '不。停下！'),
    view({ mood: 'resistant', bowl: 'away', worker: 'near', gesture: 'push-bowl', push: 1, recoil: 1, workerLean: 1 }), {
      speaker: 'Ms Tan', action: copy('Ms Tan recoils; bowl moves farther.', '陈女士缩身后退，把碗推得更远。'),
    }),
    step('overview-rewind', 'action', 2500, copy(
      'Rewind · Same moment', '倒回 · 同一时刻'), refusal(), {
      rewind: true, action: copy('Scene resets.', '场景重置。'),
    }),
    step('overview-hello', 'dialogue', 6000, copy(
      'Hello Ms Tan, I’m Hui Lin. Shall I leave it here?',
      '陈女士，您好，我是慧琳。要把碗留在这里吗？'),
    view({ mood: 'resistant', bowl: 'away', gesture: 'listen' }), { speaker: 'Hui Lin' }),
    step('overview-programme', 'dialogue', 5000, copy(
      'Yes. I want to finish this programme.', '是的。我想看完这个节目。'),
    view({ bowl: 'away' }), { speaker: 'Ms Tan' }),
    step('overview-ask-return', 'dialogue', 5000, copy(
      'Of course. Shall I come back afterwards?', '当然。等节目结束后我再来，好吗？'),
    view({ bowl: 'away', gesture: 'withdraw' }), {
      speaker: 'Hui Lin', action: copy('Hui Lin steps back.', '慧琳退后。'),
    }),
    step('overview-agreement', 'dialogue', 4000, copy(
      'Come back after this programme.', '等这个节目结束后再来吧。'), pause(), { speaker: 'Ms Tan' }),
    step('overview-coach', 'coach', 7000, copy(
      'You left the bowl, stepped back and recorded her agreed return. A respected refusal is success.',
      '你留下碗、退后，并记录了约定的返回时间。尊重拒绝就是成功。'), pause()),
    step('overview-review', 'cutaway', 10000, copy(
      'Nominated reviewer · Aisha Rahman', '指定审阅人 · Aisha Rahman'), pause(), {
      cutaway: 'reviewer',
      record: {
        label: copy('Example record', '示例记录'),
        title: copy('Human review', '人工审阅'),
        fields: [
          { label: copy('Excerpt', '节选'), value: copy('“Come back after this programme.”', '“等这个节目结束后再来吧。”') },
          { label: copy('Decision', '决定'), value: copy('Ready for supervised practice: respected refusal and recorded the agreed return under CP-M02.', '可进入督导下的实践：按 CP-M02 尊重拒绝，并记录约定的返回时间。') },
        ],
      },
    }),
    step('overview-busy-shift', 'dialogue', 6000, copy(
      'During busy lunch, I repeated my offer after she said stop. I needed to pause.',
      '午餐忙碌时，她叫停后我仍重复提议。我当时该停下来。'),
    view({ mood: 'resistant', bowl: 'away', worker: 'near', gesture: 'open-palm', workerLean: 0.5 }), { speaker: 'Hui Lin' }),
    step('overview-refresher', 'narration', 7000, copy(
      'Refresher: Hui Lin stops and steps back. Supervised follow-up is planned for the next busy meal.',
      '复习练习：慧琳停下并退后。下次繁忙用餐时将安排督导跟进。'),
    view({ mood: 'settled', bowl: 'away', gesture: 'withdraw' })),
    step('overview-ending', 'ending', 5000, copy(
      'Amiya Care Practice · Overview complete. See the full walkthrough.',
      'Amiya Care Practice · 概览结束。观看完整导览。'), pause()),
  ],
};

export const actualTotal = OVERVIEW.steps.reduce((total, shot) => total + shot.duration, 0);
