// Authored, bilingual playback data only. Every view is a complete scene snapshot.
// Durations include time for the caption, physical action and any displayed record.
const copy = (en, zh) => ({ en, zh });
const field = (label, value) => ({ label, value });
const record = (title, fields) => ({
  label: copy('Example record', '示例记录'), title, fields,
});
const step = (id, kind, text, view, options = {}) => ({
  id, kind, speaker: null, text, action: null, duration: 11000, view, ...options,
});

export const CHAPTERS = [
  {
    id: 'intro',
    title: copy('Meet Hui Lin and Ms Tan', '认识慧琳与陈女士'),
    focus: copy('Hui Lin · A meal in the lounge', '慧琳 · 休息厅的一餐'),
    steps: [
      step('intro-welcome', 'narration', copy(
        'Amiya Care Practice · Hui Lin meets Ms Tan for a meal in the shared lounge.',
        'Amiya Care Practice · 慧琳来到公共休息厅，陪陈女士安排用餐。'),
      { senior: 'tan', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }),
      step('intro-handover', 'narration', copy(
        'Handover: Ms Tan has mild dementia; she may not recall earlier meals. Speak English. She ran a food stall, values independence and enjoys television. She sits in a supported chair in the shared lounge.',
        '交接：陈女士有轻度失智症，可能不记得先前是否用过餐。使用英语。她曾经营食摊，重视独立，也喜欢看电视。她坐在公共休息厅有支撑的椅子上。'),
      { senior: 'tan', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }, { duration: 17000 }),
      step('intro-plan', 'narration', copy(
        'CP-M02: soft food, seated support and setup help with permission. Respect refusal; document the agreed return or support needed.',
        'CP-M02：软食、坐姿支撑，以及征得同意后的摆放协助。尊重拒绝，记录约定的返回安排或所需支持。'),
      { senior: 'tan', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'tv', tv: true, gesture: 'listen' }, {
        duration: 14000,
        action: copy('Hui Lin settles at eye level, keeping a respectful distance from the table.', '慧琳在与陈女士视线平齐的位置安顿下来，与桌子保持距离。'),
      }),
    ],
  },
  {
    id: 'practice',
    title: copy('Guided practice', '引导练习'),
    focus: copy('Hui Lin and Ms Tan · Respecting a pause', '慧琳与陈女士 · 尊重暂停'),
    steps: [
      step('practice-refusal', 'dialogue', copy("Leave it there. I've already eaten.", '放在那里吧。我已经吃过了。'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'push-bowl', beat: 'wave-off' }, {
        speaker: 'Ms Tan', duration: 9000,
        action: copy('Ms Tan slides the bowl away and turns towards the television.', '陈女士把碗推远，转向电视。'),
      }),
      step('practice-hello', 'dialogue', copy(
        'Hello Ms Tan, it’s Hui Lin. Would you like me to leave the bowl here?',
        '陈女士，您好，我是慧琳。您希望我把碗留在这里吗？'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'listen', beat: ['chest', 'ask'] }, { speaker: 'Hui Lin' }),
      step('practice-programme', 'dialogue', copy('Yes. I want to finish this programme.', '是的。我想看完这个节目。'),
      { senior: 'tan', mood: 'neutral', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none', beat: 'point-tv' }, { speaker: 'Ms Tan', duration: 9000 }),
      step('practice-ask-return', 'dialogue', copy('All right. Would you like me to come back afterwards?', '好的。您希望我等节目结束后再来吗？'),
      { senior: 'tan', mood: 'neutral', bowl: 'away', worker: 'back', gaze: 'worker', tv: true, gesture: 'listen' }, { speaker: 'Hui Lin', duration: 9000 }),
      step('practice-agreement', 'dialogue', copy(
        'Come back then. Leave it there for now.', '你到时再来吧。现在先留在那里。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }, { speaker: 'Ms Tan', duration: 9000 }),
      step('practice-pause', 'record', copy('Hui Lin leaves space and documents the agreed pause under CP-M02.', '慧琳留出空间，按 CP-M02 记录双方约定的暂停。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'withdraw' }, {
        duration: 14000,
        action: copy('Hui Lin steps back, hands clear of the bowl.', '慧琳退后，双手离开碗边。'),
        record: record(copy('Practice pause', '练习中的暂停'), [
          field(copy('Outcome', '结果'), copy('Refusal respected. No food eaten.', '尊重拒绝。没有进食。')),
          field(copy('Agreed next step', '约定的下一步'), copy('Return after this programme under CP-M02; ask again then.', '按 CP-M02 在本次节目结束后返回，届时重新询问。')),
        ]),
      }),
      step('practice-reflection', 'coach', copy(
        'Practice coach · You left the bowl, stepped back and recorded her agreed return point. This is a successful pause without food being eaten.',
        '练习指导 · 你留下碗、退后，并记录了她同意的返回时点。这是一次成功的暂停，无需以进食作为结果。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }),
    ],
  },
  {
    id: 'returning',
    title: copy('Returning encounter', '再次探访'),
    focus: copy('Hui Lin and Ms Tan · Current wishes', '慧琳与陈女士 · 此刻的意愿'),
    steps: [
      step('returning-transition', 'narration', copy(
        'Later that day · The programme has ended. Hui Lin checks the note: return after the programme. That earlier agreement is not permission to assist now.',
        '当天稍后 · 节目已结束。慧琳查看记录：节目结束后返回。先前的约定并不代表现在已获得协助许可。'),
      { senior: 'tan', mood: 'neutral', bowl: 'away', worker: 'back', gaze: 'bowl', tv: true, gesture: 'none' }),
      step('returning-uncertain', 'dialogue', copy(
        'Did we arrange something? I don’t remember. Please don’t rush me.',
        '我们约好什么了吗？我不记得了。请别催我。'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'back', gaze: 'worker', tv: true, gesture: 'open-palm' }, { speaker: 'Ms Tan', duration: 9000 }),
      step('returning-question', 'dialogue', copy(
        'Hello Ms Tan, it’s Hui Lin. There’s no rush. What would you like now?', '陈女士，您好，我是慧琳。不着急。您现在想怎样安排？'),
      { senior: 'tan', mood: 'neutral', bowl: 'away', worker: 'back', gaze: 'worker', tv: true, gesture: 'listen', beat: ['chest', 'ask'] }, { speaker: 'Hui Lin', duration: 9000 }),
      step('returning-wishes', 'dialogue', copy(
        'I’d like to eat by myself. Please set the bowl and spoon within reach. Leave the television on.',
        '我想自己吃。请把碗和勺子放到我够得到的地方。电视就开着吧。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'bowl', tv: true, gesture: 'open-palm' }, { speaker: 'Ms Tan' }),
      step('returning-setup', 'action', copy(
        'Her current request permits setup help only. Ms Tan remains seated with support.', '她此刻的请求只允许摆放协助。陈女士保持有支撑的坐姿。'),
      { senior: 'tan', mood: 'settled', bowl: 'near', worker: 'near', gaze: 'bowl', tv: true, gesture: 'setup' }, {
        action: copy('Hui Lin places the bowl and spoon within reach, then moves her hands away.', '慧琳把碗和勺子放在陈女士够得到的地方，随后移开双手。'),
      }),
      step('returning-reflection', 'coach', copy(
        'Practice coach · You asked about her wishes now and followed her request for setup help. The earlier note supported continuity; it did not replace fresh permission.',
        '练习指导 · 你询问她此刻的意愿，并按她的请求协助摆放。先前记录帮助延续照护，但不能代替重新征得同意。'),
      { senior: 'tan', mood: 'settled', bowl: 'near', worker: 'back', gaze: 'bowl', tv: true, gesture: 'none' }),
    ],
  },
  {
    id: 'check',
    title: copy('Unfamiliar readiness check', '陌生情境检查'),
    focus: copy('Hui Lin and Mr Lim · An unfamiliar concern', '慧琳与林先生 · 陌生的担忧'),
    steps: [
      step('check-transition', 'narration', copy(
        'At a later check session · Hui Lin meets Mr Lim for the first time at lunch.',
        '稍后的检查环节 · 慧琳在午餐时第一次见到林先生。'),
      { senior: 'lim', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'bowl', tv: false, gesture: 'none' }),
      step('check-concern', 'dialogue', copy(
        'Did someone put something in this?', '有人往这里面加了什么吗？'),
      { senior: 'lim', mood: 'resistant', bowl: 'near', worker: 'near', gaze: 'bowl', tv: false, gesture: 'open-palm' }, { speaker: 'Mr Lim' }),
      step('check-response', 'dialogue', copy(
        'Hello Mr Lim, I’m Hui Lin. I don’t know what’s in it. Shall we check with the responsible staff?',
        '林先生，您好，我是慧琳。我不清楚里面有什么。我们一起请负责的同事确认，好吗？'),
      { senior: 'lim', mood: 'neutral', bowl: 'near', worker: 'near', gaze: 'worker', tv: false, gesture: 'listen', beat: ['chest', 'ask'] }, { speaker: 'Hui Lin' }),
      step('check-choice', 'dialogue', copy(
        'Yes, find out for me. Then I’ll choose. Please leave the bowl where it is.', '好，请帮我问清楚。我之后再选。请把碗留在原处。'),
      { senior: 'lim', mood: 'settled', bowl: 'near', worker: 'near', gaze: 'worker', tv: false, gesture: 'none' }, { speaker: 'Mr Lim', duration: 9000 }),
      step('check-submit', 'narration', copy(
        'Hui Lin pauses the meal and seeks staff support before Mr Lim decides. The encounter is submitted for human review.',
        '慧琳暂停用餐安排，请同事协助确认，再由林先生决定。这次情境检查已提交人工审阅。'),
      { senior: 'lim', mood: 'settled', bowl: 'near', worker: 'back', gaze: 'bowl', tv: false, gesture: 'withdraw' }),
    ],
  },
  {
    id: 'review',
    title: copy('Human review', '人工审阅'),
    focus: copy('Manager nomination · Reviewer decision', '经理提名 · 审阅人决定'),
    steps: [
      step('review-nomination', 'cutaway', copy(
        'Centre manager · Mr Koh nominates a reviewer.', '中心经理 · 许经理指定审阅人。'),
      { senior: 'lim', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'bowl', tv: false, gesture: 'none' }, {
        cutaway: 'manager', duration: 14000,
        record: record(copy('Reviewer nomination', '审阅人提名'), [
          field(copy('Manager action', '经理的行动'), copy('Mr Koh nominates care lead Aisha Rahman to review Hui Lin’s submitted check.', '许经理指定照护负责人 Aisha Rahman 审阅慧琳提交的检查。')),
        ]),
      }),
      step('review-excerpts', 'cutaway', copy(
        'Nominated reviewer · Aisha Rahman reads the encounter.', '指定审阅人 · Aisha Rahman 阅读情境记录。'),
      { senior: 'lim', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'bowl', tv: false, gesture: 'none' }, {
        cutaway: 'reviewer', duration: 23000,
        record: record(copy('Submitted check excerpts', '已提交检查的节选'), [
          field(copy('Mr Lim · Excerpt', '林先生 · 节选'), copy('Did someone put something in this?', '有人往这里面加了什么吗？')),
          field(copy('Hui Lin · Excerpt', '慧琳 · 节选'), copy('Hello Mr Lim, I’m Hui Lin. I don’t know what’s in it. Shall we check with the responsible staff?', '林先生，您好，我是慧琳。我不清楚里面有什么。我们一起请负责的同事确认，好吗？')),
        ]),
      }),
      step('review-decision', 'cutaway', copy(
        'Reviewer decision · Aisha selects supervised practice.', '审阅决定 · Aisha 选择督导下的实践。'),
      { senior: 'lim', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'bowl', tv: false, gesture: 'none' }, {
        cutaway: 'reviewer', duration: 23000,
        record: record(copy('Example readiness decision', '准备情况决定示例'), [
          field(copy('Responses considered', '比较的回应'), copy('Reassure: “It’s the usual lunch.” Or acknowledge uncertainty and check with staff.', '安慰：“这是平常的午餐。”或承认不确定，请同事确认。')),
          field(copy('Selected', '选定结果'), copy('Ready for supervised workplace practice', '可进入督导下的工作实践')),
          field(copy('Reason · CP-M02', '理由 · CP-M02'), copy('Checking rather than reassuring without evidence follows CP-M02: pause, seek responsible staff support, preserve choice. Workplace observation remains needed.', '确认而非无依据地安慰，符合 CP-M02：暂停、寻求负责同事的支持、保留选择权。仍需工作场所观察。')),
        ]),
      }),
      step('review-return', 'narration', copy(
        'Hui Lin begins supervised practice following Aisha’s review.', '经 Aisha 审阅后，慧琳开始督导下的实践。'),
      { senior: 'tan', mood: 'neutral', bowl: 'near', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }, { duration: 9000 }),
    ],
  },
  {
    id: 'shift',
    title: copy('After-shift difficulty', '班后报告困难'),
    focus: copy('Hui Lin · A busy supervised shift', '慧琳 · 繁忙的督导班次'),
    steps: [
      step('shift-transition', 'narration', copy(
        'Later · A busy lunch during a supervised shift. Hui Lin is feeling hurried.', '稍后 · 督导下的一个繁忙午餐班次。慧琳感到有些仓促。'),
      { senior: 'tan', mood: 'neutral', bowl: 'near', worker: 'near', gaze: 'tv', tv: true, gesture: 'none' }),
      step('shift-stop', 'dialogue', copy('Please stop asking. I don’t want it now.', '请别再问了。我现在不想吃。'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'near', gaze: 'tv', tv: true, gesture: 'open-palm', beat: 'raise-hand' }, { speaker: 'Ms Tan', duration: 9000 }),
      step('shift-repeat', 'dialogue', copy('Can I offer you lunch again?', '我可以再给您安排午餐吗？'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'near', gaze: 'tv', tv: true, gesture: 'none' }, { speaker: 'Hui Lin', duration: 9000 }),
      step('shift-report', 'dialogue', copy(
        'After that busy lunch, I realised I repeated my offer after Ms Tan asked me to stop. I need help pausing under pressure.',
        '繁忙的午餐之后，我意识到陈女士让我停止时，我还是重复了提议。我需要帮助，练习在压力下及时停下来。'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'withdraw' }, { speaker: 'Hui Lin' }),
      step('shift-difficulty', 'cutaway', copy(
        'Workplace record · Hui Lin reports the difficulty and agrees support with her supervisor.', '工作记录 · 慧琳报告困难，并与督导商定支持安排。'),
      { senior: 'tan', mood: 'neutral', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }, {
        cutaway: 'workplace', duration: 17000,
        record: record(copy('Reported difficulty', '已报告的困难'), [
          field(copy('Issue', '问题'), copy('Repeated an offer after a request to stop during a busy lunch.', '繁忙午餐时，在对方要求停止后仍重复提议。')),
          field(copy('Agreed support', '约定的支持'), copy('Refusal-focused refresher, then later supervised observation.', '针对拒绝情境的复习练习，之后安排督导观察。')),
        ]),
      }),
    ],
  },
  {
    id: 'refresher',
    title: copy('Targeted refresher', '针对性复习'),
    focus: copy('Hui Lin · Practising withdrawal', '慧琳 · 练习退开与暂停'),
    steps: [
      step('refresher-transition', 'narration', copy(
        'At the next practice session · A refusal-focused refresher addresses Hui Lin’s reported difficulty: stopping under pressure.',
        '下次练习时 · 针对拒绝的复习聚焦慧琳报告的困难：在压力下及时停下来。'),
      { senior: 'tan', mood: 'neutral', bowl: 'away', worker: 'near', gaze: 'tv', tv: true, gesture: 'none' }),
      step('refresher-refusal', 'dialogue', copy(
        'No, not now. I said no. Please leave it there until the programme ends.', '不，现在不吃。我已经说过不了。请把它留在那里，等节目结束再说。'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'near', gaze: 'tv', tv: true, gesture: 'push-bowl', beat: 'wave-off' }, { speaker: 'Ms Tan', duration: 9000 }),
      step('refresher-acknowledge', 'dialogue', copy(
        'All right, I’ll stop. I’ll leave it there and come back after the programme, as you asked.', '好的，我停下来。我把它留在那里，按您的意思，节目结束后再来。'),
      { senior: 'tan', mood: 'resistant', bowl: 'away', worker: 'near', gaze: 'tv', tv: true, gesture: 'listen' }, { speaker: 'Hui Lin', duration: 9000 }),
      step('refresher-withdraw', 'action', copy(
        'Hui Lin respects the repeated refusal and documents the agreed pause under CP-M02.', '慧琳尊重再次表达的拒绝，按 CP-M02 记录约定的暂停。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'withdraw' }, {
        action: copy('Hui Lin moves her hands away from the table and steps back.', '慧琳将双手移离桌边，退后一步。'),
      }),
      step('refresher-reflection', 'coach', copy(
        'Practice coach · This time you stopped after her repeated refusal and withdrew. The agreed next step was recorded. Workplace follow-up still requires a human observation.',
        '练习指导 · 这一次，你在她再次拒绝后停下并退开，记录了约定的下一步。工作场所的后续跟进仍需人工观察。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }),
    ],
  },
  {
    id: 'followup',
    title: copy('Workplace follow-up', '工作场所后续跟进'),
    focus: copy('Hui Lin · Supervised observation', '慧琳 · 督导观察'),
    steps: [
      step('followup-transition', 'narration', copy(
        'After a later supervised shift · The observation took place after the refresher. Hui Lin and her supervisor discuss the completed follow-up.',
        '更晚的一次督导班次结束后 · 本次观察发生在复习之后。慧琳与督导讨论已经完成的跟进。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }),
      step('followup-observation', 'cutaway', copy(
        'Reviewer · Aisha records the workplace follow-up.', '审阅人 · Aisha 记录工作场所跟进情况。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }, {
        cutaway: 'reviewer', duration: 20000,
        record: record(copy('Completed supervised observation', '已完成的督导观察'), [
          field(copy('Observed', '观察所见'), copy('The reviewer observed Hui Lin respecting a pause; she recorded the agreed next step.', '审阅人观察到慧琳尊重暂停，并记录了约定的下一步。')),
          field(copy('Agreed action', '约定行动'), copy('Further supervised practice was agreed, including support during busy meals.', '已同意继续在督导下练习，包括繁忙用餐时段的支持。')),
          field(copy('Scope', '范围'), copy('One observed episode; no independent-work clearance.', '仅为一次观察情节，不授予独立工作资格。')),
        ]),
      }),
      step('followup-hui-lin', 'dialogue', copy(
        'We agreed more supervised practice. I’ll keep working with my supervisor on stopping when someone asks, especially during busy meals.',
        '我们同意继续在督导下练习。我会继续与督导一起练习，在对方要求时及时停止，尤其是在繁忙的用餐时段。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }, { speaker: 'Hui Lin' }),
      step('followup-ending', 'ending', copy(
        'Amiya Care Practice · Follow-up completed. Hui Lin continues supervised practice, with support during busy meals.',
        'Amiya Care Practice · 跟进已完成。慧琳继续在督导下练习，并在繁忙用餐时段获得支持。'),
      { senior: 'tan', mood: 'settled', bowl: 'away', worker: 'back', gaze: 'tv', tv: true, gesture: 'none' }, { duration: 14000 }),
    ],
  },
];

export const SUPPORT = {
  carePlan: copy(
    'Fictional care plan CP-M02 · Ms Tan. This authored example documents soft food and a supported seated position in a chair at the lounge table; it is not a dietary or positioning prescription. Ms Tan prefers independence and setup help with permission; no hand-feeding is needed in this story. Check her current wishes before moving closer or arranging the bowl and spoon. Ask permission before changing the television or background noise. If she refuses, pause, leave space, and document her words, any observed concern and the agreed next step. In this example she agrees to a planned return after her programme under CP-M02; check her wishes again on return. Timing depends on the plan and circumstances, not a universal interval. For continued refusal, contact the appropriate care lead under the local procedure. For discomfort or an immediate safety concern, stop and seek appropriate help promptly through the care lead or urgent local procedure. No animation verifies swallowing, safe feeding or physical technique. Singapore partner practitioner review of food, positioning, assistance and escalation is required before a pilot. This fictional plan has no clinician endorsement.',
    '虚构照护计划 CP-M02 · 陈女士。本原创示例记录了软食，以及在休息厅桌旁有支撑的椅上坐姿，并非饮食或体位处方。陈女士偏好独立，允许时可协助摆放；本故事无需喂食。靠近或摆放碗勺前，先确认她此刻的意愿。改变电视或背景声前须征得同意。如她拒绝，应暂停、留出空间，并记录她的话、观察到的担忧及约定的下一步。本例中，她依 CP-M02 同意在节目结束后安排返回；返回时重新确认意愿。时机取决于计划和当时情况，没有通用间隔。持续拒绝时，按当地流程联系适当的照护负责人。如出现不适或即时安全问题，应停止，并通过照护负责人或当地紧急流程及时寻求适当帮助。动画不验证吞咽、喂食安全或身体操作技巧。试点前须由新加坡合作方的实务人员审阅食物、体位、协助及上报安排。本虚构计划没有临床人员背书。'),
  about: copy(
    'Amiya Care Practice · Guided demonstration · Fictional people and records · No live coaching or backend. Follow Hui Lin through eight authored chapters as an observer. The same tour frame contains labelled manager, reviewer and workplace cutaways; no accounts are switched. The unfamiliar check is a scripted example, not an assessment of the visitor. All submissions, assignments, decisions and observations are fictional. There are no real participant data. A working application would support practice, independent checks, human review and workplace follow-up. English is the default; Chinese captions translate the story rather than imply language recognition. The provisional seated lounge scenario requires Singapore partner confirmation.',
    'Amiya Care Practice · 导览演示 · 人物与记录均为虚构 · 无实时指导或后端服务。以观察者身份跟随慧琳经历八个原创章节。同一导览画面包含标明身份的经理、审阅人及工作记录片段，不切换账户。陌生情境检查是脚本示例，不评估访客。所有提交、分配、决定与观察均为虚构，没有真实参与者数据。实际应用将支持练习、独立检查、人工审阅及工作场所跟进。默认语言为英语；中文字幕是故事翻译，并不表示具有语言识别功能。暂定的休息厅坐姿情境须经新加坡合作方确认。'),
  references: [
    {
      title: copy('Western Australian dementia-care refusal simulation', '西澳大利亚失智症照护拒绝情境模拟'),
      url: 'https://www.youtube.com/watch?v=zFnx_dXPTa8',
    },
    {
      title: copy('UCLA aggressive language/behaviour training', 'UCLA 攻击性言语与行为照护培训'),
      url: 'https://www.youtube.com/watch?v=tAKwDFdy8WQ',
    },
    {
      title: copy('UCLA caregiver-training series and guidance', 'UCLA 照护者培训系列与指南'),
      url: 'https://www.uclahealth.org/medical-services/geriatrics/dementia/caregiver-education/caregiver-training-videos',
    },
  ],
  adaptation: copy(
    'Authored adaptation. Communication references: the Western Australian refusal simulation and UCLA caregiver-training materials linked below. This fictional meal story applies person-centred principles: observe, ask, allow a response and respect refusal. It is not a reproduction of either video. Characters, care plans, dialogue and reviewer decisions are invented. Medication re-approach timing is not a universal mealtime rule. Source credit does not imply endorsement by either organisation or clinical validation of readiness or feeding safety.',
    '原创改编。沟通参考为下方西澳大利亚拒绝情境模拟及 UCLA 照护者培训资料。本虚构用餐故事运用以人为本的原则：观察、询问、留出回应时间并尊重拒绝，不是对视频内容的复刻。人物、照护计划、对话和审阅决定均属虚构。药物情境中的再次接触时间不作为通用用餐规则。注明来源不代表任何机构背书，也不验证准备情况或喂食安全。'),
};
