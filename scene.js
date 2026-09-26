const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = (value, fallback = 0) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
const mix = (a, b, t) => a + (b - a) * t;
const point = p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const shortName = (name, limit) => {
  const letters = Array.from(name);
  return letters.length > limit ? `${letters.slice(0, limit - 1).join('')}…` : name;
};
const phases = {
  ready: { en: ['Ready', 'Talk first · Check posture and consent'], zh: ['准备', '先交流，确认床上姿势与进食意愿'] },
  position: { en: ['Position', 'Raise bed slowly · Adjust support'], zh: ['调姿', '慢慢抬高床头 · 整理靠枕与支撑'] },
  scoop: { en: ['Scoop', 'Small spoonful · Lift and steady'], zh: ['取食', '浅取一小勺 · 托起后停稳'] },
  approach: { en: ['Approach', 'Keep spoon level · Move slowly'], zh: ['靠近', '勺面水平 · 缓慢靠近嘴前'] },
  wait: { en: ['Wait', 'Pause outside · Wait for voluntary opening'], zh: ['等待', '停在嘴前 · 等待主动张口'] },
  accept: { en: ['Accept', 'Voluntary opening · Offer a small bite'], zh: ['接受', '顺应张口 · 小口接受'] },
  withdraw: { en: ['Withdraw', 'Withdraw slowly and level · Leave space'], zh: ['撤勺', '水平缓慢撤回 · 给长者留出空间'] },
  swallow: { en: ['Demonstrated wait', 'Not a swallowing assessment'], zh: ['示范等待', '非吞咽评估'] },
  rest: { en: ['Rest', 'Pause · Ask how the senior feels'], zh: ['休息', '放下节奏 · 重新询问感受'] },
};
// Factual animation names only; check scenes must not suggest the next action.
const motionPhases = {
  en: { ready: 'Idle', position: 'Bed movement', scoop: 'Scoop', approach: 'Approach', wait: 'Pause', accept: 'Accept', withdraw: 'Withdraw', swallow: 'Pause', rest: 'Rest' },
  zh: { ready: '静止', position: '床体移动', scoop: '取食', approach: '靠近', wait: '停顿', accept: '接受', withdraw: '撤勺', swallow: '停顿', rest: '休息' },
};
const movementLabel = 'Illustration movement';
const labels = {
  en: {
    title: name => `Amiya Care Practice · Meal practice with ${name}`,
    desc: name => `Amiya Care Practice animated scene. A care worker sits on a bedside stool on the left; ${name}, the simulated senior, rests in a care bed on the right with legs covered by a light quilt. Raise the bed head slowly and adjust pillows and support, then ask about willingness to eat. The spoon stays outside the mouth until posture is ready and when the senior turns away, closes their mouth or raises a hand. Drag the wrist or use arrow keys, Home and End to adjust spoon progress. Demonstrated wait is not a swallowing assessment.`,
    illustrationDesc: name => `Animated bedside scene with a care worker and ${name}, the simulated senior, in a care bed.`,
    room: 'Amiya Care Practice · Bedside meal',
    worker: 'Care worker (you)', senior: 'Simulated senior', you: 'You',
    seniorLabel: name => `${name} · Simulated senior`,
    bed: 'Animated scene',
    bedTitle: 'Animated scene · Care bed with near-side rail lowered',
    cart: 'Bedside meal cart', scoop: 'Scoop shallow · Hold steady',
    target: 'Pause before mouth', positionTarget: 'Posture first · Wait', blockTarget: 'Hand raised · Stop',
    turnTarget: 'Turned away · Stop', closedTarget: 'Mouth closed · Wait',
    drag: 'Spoon progress: drag the care worker’s wrist, or use arrow keys, Home and End',
    dragTitle: 'Drag wrist: scoop → lift → pause before mouth',
    positionStatus: 'Posture not ready; no entry into mouth', blockStatus: 'Hand blocking; stop before the hand',
    turnStatus: 'Senior turned away; leave space', closedStatus: 'Mouth closed; wait outside',
    progress: (value, status) => `Spoon progress ${value}%, ${status}`,
  },
  zh: {
    title: name => `Amiya Care Practice · ${name}进食练习`,
    desc: name => `Amiya Care Practice 动画场景，示意性床旁照护。左侧护工坐在床旁凳，右侧虚拟长者${name}靠在护理床上，双腿盖薄被。先慢慢抬高床头并整理靠枕与支撑，再询问进食意愿。姿势未就绪时银勺不会接触嘴部；转头、抿嘴或抬手时停在外侧。拖动手腕或使用方向键、Home、End 调整送勺进度。示范等待并非吞咽评估。`,
    illustrationDesc: name => `床旁动画场景，包含护工与护理床上的虚拟长者${name}。`,
    room: 'Amiya Care Practice · 床旁进食练习',
    worker: '实训护工（你）', senior: '虚拟长者', you: '你',
    seniorLabel: name => `${name} · 虚拟长者`,
    bed: '动画场景', bedTitle: '动画场景 · 示意性床旁照护 · 护理床近侧护栏已放低',
    cart: '床旁餐车', scoop: '浅取 · 托稳',
    target: '嘴前停留区', positionTarget: '先调整姿势 · 暂不入口', blockTarget: '抬手拒绝 · 留出空间',
    turnTarget: '转头回避 · 留出空间', closedTarget: '嘴巴闭合 · 等待',
    drag: '送勺进度：拖动护工手腕，或使用方向键、Home、End',
    dragTitle: '拖动手腕：取食 → 托起 → 嘴前停留',
    positionStatus: '姿势未就绪，暂不入口', blockStatus: '抬手阻挡，停在手前',
    turnStatus: '长者转头回避，留出空间', closedStatus: '嘴巴闭合，在外侧等待',
    progress: (value, status) => `送勺 ${value}%，${status}`,
  },
};
let serial = 0;

function cubic(a, b, c, d, t) {
  const u = 1 - t;
  return { x: u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
    y: u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1] };
}

// The tip, not the hand, follows this continuous, tangent-matched serving path.
// 0–.16: shallow scoop; .16–.36: lift; .36–1: approach and level out.
function spoonPoint(value, end = { x: 756, y: 262 }) {
  const p = clamp(value);
  if (p < .16) return cubic([600, 451], [606, 455], [616, 452], [616, 437], p / .16);
  if (p < .36) return cubic([616, 437], [616, 412], [636, 342], [649, 325], (p - .16) / .2);
  return cubic([649, 325], [662, 308], [end.x - 35, end.y], [end.x, end.y], (p - .36) / .64);
}

function rotatePoint(p, origin, degrees) {
  const angle = degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return { x: origin.x + (p.x - origin.x) * c - (p.y - origin.y) * s,
    y: origin.y + (p.x - origin.x) * s + (p.y - origin.y) * c };
}

// Adult anatomical rig in SVG units: head 78 high, neck–hip 165, covered legs 290.
// Head end is RIGHT, feet LEFT. Positive rotation reclines the torso to the right.
// Bed and pelvis share a fixed hinge; refusal only rotates the head, never the bed.
function elderPose(frame, breath = 0) {
  const p = frame.posture;
  const hip = { x: 770, y: 438 };
  const angle = mix(70, 18, p);
  const origin = { x: 778, y: 422 }, neck = { x: 778, y: 257 };
  const headAngle = mix(-16, -10, p) + frame.headTurn * 25;
  const headScale = .74 * (1 - frame.headTurn * .1);
  const bodyPoint = q => {
    const r = rotatePoint(q, origin, angle);
    return { x: r.x + hip.x - origin.x, y: r.y + hip.y - origin.y };
  };
  const headPoint = q => bodyPoint(rotatePoint({ x: neck.x + (q.x - 753) * headScale,
    y: neck.y + (q.y - 275) * .74 }, neck, headAngle));
  const bodyTransform = `translate(${hip.x - origin.x} ${hip.y - origin.y}) rotate(${angle} 778 422)`;
  const headTransform = `translate(778 257) rotate(${headAngle}) scale(${headScale} .74) translate(-753 -275)`;
  return { hip, angle, bodyPoint, headPoint, bodyTransform, headTransform,
    mouth: headPoint({ x: 708, y: 255 }), breath };
}

// Use the same constrained geometry for rendering and pointer projection.
function servingPose(frame, progress, elder, shoulder) {
  const blocked = frame.handBlock;
  // A recumbent person stays well outside the serving envelope. Never lengthen
  // the arm or chase a turned face. The target converges smoothly as the bed rises.
  const gap = 34 + blocked * 70 + frame.headTurn * 24 + (1 - frame.posture) * 24;
  const end = { x: Math.min(792, elder.mouth.x - gap), y: elder.mouth.y };
  const requested = spoonPoint(progress, end);
  const willing = frame.posture >= .85 && frame.phase !== 'position' && frame.accepted &&
    frame.headTurn < .15 && blocked < .1 && frame.mouth > .25;
  const contact = willing && ['accept', 'withdraw'].includes(frame.phase) ? clamp((progress - .9) / .1) : 0;
  const tip = { x: mix(requested.x, elder.mouth.x, contact), y: requested.y };
  const arm = solveArm(shoulder, { x: tip.x - 70, y: tip.y + 5 }, 96, 94, 1);
  // If IK clamps a target, carry the utensil with the wrist instead of breaking grip.
  return { arm, contact, end, tip: { x: arm.wrist.x + 70, y: arm.wrist.y - 5 } };
}

// Exact two-link IK. Clamp unreachable targets before solving, never scale bones.
function solveArm(shoulder, target, upper = 96, lower = 94, bend = 1) {
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
  const length = Math.hypot(dx, dy);
  const distance = Math.min(upper + lower - .01, Math.max(Math.abs(upper - lower) + .01, length));
  const ux = length > .0001 ? dx / length : 1, uy = length > .0001 ? dy / length : 0;
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { shoulder,
    elbow: { x: shoulder.x + along * ux - bend * height * uy, y: shoulder.y + along * uy + bend * height * ux },
    wrist: { x: shoulder.x + distance * ux, y: shoulder.y + distance * uy } };
}

function ribbon(a, b, ra, rb) {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
  const q = (p, r) => point({ x: p.x + nx * r, y: p.y + ny * r });
  return `M${q(a, ra)} L${q(b, rb)} Q${point({ x: b.x + (b.x - a.x) / length * rb, y: b.y + (b.y - a.y) / length * rb })} ${q(b, -rb)} L${q(a, -ra)} Q${point({ x: a.x - (b.x - a.x) / length * ra, y: a.y - (b.y - a.y) / length * ra })} ${q(a, ra)}Z`;
}

function room(id) {
  return `<defs>
    <linearGradient id="${id}-wall" x2="0" y2="1"><stop stop-color="#f6f3e9"/><stop offset="1" stop-color="#e2e9dd"/></linearGradient>
    <linearGradient id="${id}-glass" x2=".8" y2="1"><stop stop-color="#c5ddda"/><stop offset=".65" stop-color="#edf2df"/><stop offset="1" stop-color="#fff8db"/></linearGradient>
    <linearGradient id="${id}-floor" x2="0" y2="1"><stop stop-color="#ded6c5"/><stop offset="1" stop-color="#f1e9d9"/></linearGradient>
    <linearGradient id="${id}-wood" x2="0" y2="1"><stop stop-color="#f0dfbf"/><stop offset=".45" stop-color="#e9cfaa"/><stop offset="1" stop-color="#d9b98e"/></linearGradient>
    <linearGradient id="${id}-green" x1="0" x2="1"><stop stop-color="#376b63"/><stop offset=".45" stop-color="#609a89"/><stop offset="1" stop-color="#407a70"/></linearGradient>
    <linearGradient id="${id}-purple" x1="0" x2="1"><stop stop-color="#847086"/><stop offset=".5" stop-color="#b19baa"/><stop offset="1" stop-color="#8e788d"/></linearGradient>
    <linearGradient id="${id}-skin" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#f3d4b9"/><stop offset=".6" stop-color="#e9bd9e"/><stop offset="1" stop-color="#d3a185"/></linearGradient>
    <linearGradient id="${id}-hair" x2=".8" y2="1"><stop stop-color="#e6e1d7"/><stop offset=".48" stop-color="#bcb9b0"/><stop offset="1" stop-color="#898c85"/></linearGradient>
    <linearGradient id="${id}-silver" x2="0" y2="1"><stop stop-color="#6e8487"/><stop offset=".22" stop-color="#fff"/><stop offset=".48" stop-color="#dce6e7"/><stop offset=".7" stop-color="#97aaaf"/><stop offset="1" stop-color="#536b72"/></linearGradient>
    <radialGradient id="${id}-spoon"><stop stop-color="#829ca3"/><stop offset=".7" stop-color="#d7e4e5"/><stop offset="1" stop-color="#f9ffff"/></radialGradient>
    <linearGradient id="${id}-ceramic" x2="0" y2="1"><stop stop-color="#fffcf0"/><stop offset=".6" stop-color="#d9e2d5"/><stop offset="1" stop-color="#a5beb3"/></linearGradient>
    <linearGradient id="${id}-linen" x1="0" x2="1"><stop stop-color="#ddd8c9"/><stop offset=".4" stop-color="#fffbed"/><stop offset="1" stop-color="#e7e1d2"/></linearGradient>
    <linearGradient id="${id}-quilt" x2=".35" y2="1"><stop stop-color="#e4ece0"/><stop offset=".45" stop-color="#b9cec4"/><stop offset="1" stop-color="#88aba2"/></linearGradient>
    <linearGradient id="${id}-mattress" x2="0" y2="1"><stop stop-color="#fffdf2"/><stop offset=".65" stop-color="#e3e9df"/><stop offset="1" stop-color="#b7c9bf"/></linearGradient>
    <filter id="${id}-shadow" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="1100" height="680" fill="url(#${id}-wall)"/>
  <path d="M0 0H1100V27H0Z" fill="#fffdf5" opacity=".7"/>
  <rect x="70" y="66" width="253" height="305" rx="6" fill="#c0c9b9"/>
  <rect x="80" y="76" width="233" height="283" fill="url(#${id}-glass)"/>
  <path d="M81 246Q128 203 182 240T312 216V360H81Z" fill="#a3bb99" opacity=".38"/>
  <path d="M80 296Q161 249 218 287T313 266V360H80Z" fill="#93b397" opacity=".3"/>
  <path d="M194 76V359M81 212H312" stroke="#fffbee" stroke-width="8"/>
  <path d="M65 61Q83 133 60 273V376H42V61ZM327 61Q307 173 333 281V376H350V61Z" fill="#e5e2d3"/>
  <path d="M52 65Q68 189 51 352M338 66Q321 203 341 355" fill="none" stroke="#cdd2c2" stroke-width="3"/>
  <rect x="66" y="366" width="262" height="11" rx="3" fill="#d7d3bd"/>
  <path d="M0 443H1100V680H0Z" fill="url(#${id}-floor)"/>
  <path d="M0 442H1100" stroke="#bbc4b1" stroke-width="7"/>
  <path d="M85 448L243 680H565L286 448Z" fill="#fff7d6" opacity=".36"/>
  <path d="M0 524H1100M0 619H1100M157 448L85 680M376 448L401 680M846 448L990 680" fill="none" stroke="#b6a98e" opacity=".2"/>
    <g transform="translate(606 71)"><rect width="99" height="125" rx="3" fill="#b4a88e"/><rect x="6" y="6" width="87" height="113" fill="#fbf8eb"/>
    <path d="M33 101Q58 74 45 30M49 65Q27 62 28 45Q48 46 49 65M47 48Q67 48 72 28Q52 28 47 48M44 83Q60 90 74 72" fill="none" stroke="#8d9d7b" stroke-width="3"/>
  </g>
  <g transform="translate(897 332)"><rect width="152" height="110" rx="5" fill="#c8b99e"/><rect x="-6" y="-8" width="164" height="13" rx="3" fill="#e1d5bd"/>
    <path d="M76 9V103" stroke="#b1a18a"/><circle cx="64" cy="51" r="3" fill="#8d8975"/><circle cx="88" cy="51" r="3" fill="#8d8975"/>
    <path d="M21-48H58L52-10H27Z" fill="#ece9db"/><path d="M40-45V-110M40-68Q14-71 13-92Q34-92 40-68M40-87Q65-83 71-106Q49-111 40-87M40-106Q23-118 31-136Q48-128 40-106" fill="#819f77" stroke="#6e8f67" stroke-width="2"/>
    <rect x="91" y="-25" width="41" height="15" rx="2" fill="#b2c4b4"/><rect x="95" y="-32" width="35" height="7" rx="1" fill="#e5d4b1"/>
  </g>
  <g transform="translate(111 439)"><ellipse cy="39" rx="37" ry="8" fill="#838b74" opacity=".15"/><path d="M-27-19H27L22 34Q0 46-22 34Z" fill="#cab391"/>
    <path d="M0-14Q8-65-4-124M0-66L-28-99M1-52L33-89" fill="none" stroke="#75895f" stroke-width="4"/>
    <path d="M-3-109Q-33-112-24-144Q3-139-3-109M-21-93Q-50-82-54-112Q-28-120-21-93M7-72Q4-110 37-118Q47-86 7-72M8-39Q21-69 49-55Q40-28 8-39M-1-48Q-36-43-38-74Q-10-80-1-48" fill="#8ca478"/>
  </g>
  <text x="72" y="42" class="care-scene-room-label" data-part="room-label" data-label="room"/>`;
}

function chair(x) {
  return `<g transform="translate(${x} 0)" class="care-scene-chair">
    <ellipse cx="0" cy="568" rx="91" ry="13" fill="#65735f" opacity=".18"/>
    <path d="M-48 430L-61 563M47 430L65 563M-55 509H57" stroke="#8c9f97" stroke-width="8" stroke-linecap="round"/>
    <path d="M-65 428Q-64 415-49 415H66Q81 418 77 435L67 441H-53Z" fill="#99aa91" stroke="#7f937c" stroke-width="2"/>
  </g>`;
}

function bed(id) {
  return `<g class="care-scene-bed">
    <ellipse cx="748" cy="563" rx="302" ry="22" fill="#64796c" opacity=".16" filter="url(#${id}-shadow)"/>
    <path d="M482 489V544M987 415V529M527 469V525M1030 402V507M483 538L989 516" fill="none" stroke="#748e8b" stroke-width="10" stroke-linecap="round"/>
    <path d="M482 490V530M987 425V517M706 493L796 426M707 428L790 493" stroke="url(#${id}-silver)" stroke-width="7"/>
    <g fill="#526764" stroke="#405651" stroke-width="2"><circle cx="482" cy="554" r="13"/><circle cx="988" cy="540" r="13"/><circle cx="527" cy="535" r="10"/><circle cx="1030" cy="518" r="10"/></g>
    <g fill="#b9ccc1"><circle cx="482" cy="554" r="5"/><circle cx="988" cy="540" r="5"/><circle cx="527" cy="535" r="4"/><circle cx="1030" cy="518" r="4"/></g>
    <path d="M465 540H487M972 526H995" stroke="#a6b6ae" stroke-width="5" stroke-linecap="round"/>
    <path d="M443 451L495 404 1035 363 1054 405 997 475 450 511Z" fill="#809992" stroke="#637f79" stroke-width="2"/>
    <path d="M449 485L1000 449 997 477 450 511Z" fill="url(#${id}-silver)" stroke="#819992" stroke-width="2"/>
    <path d="M462 494L985 460M472 501L975 470" stroke="#f3f6ea" stroke-width="2"/>
    <path d="M441 449Q437 440 451 433L501 399 795 386 815 443 765 472 454 491Q443 491 443 480Z" fill="url(#${id}-mattress)" stroke="#a8beb3" stroke-width="2"/>
    <path d="M448 466L766 450 809 419M454 476L758 460" stroke="#f9fbf1" stroke-width="3" fill="none"/>
    <path d="M1018 412V301Q1018 285 1031 285H1058Q1071 285 1071 301V412Z" fill="url(#${id}-wood)" stroke="#a7977c" stroke-width="3"/>
    <path d="M1030 308H1058M1030 316H1058" stroke="#f8edd4" stroke-width="3" stroke-linecap="round"/>
    <path d="M785 415L1034 394 1039 409 800 467Z" fill="#a5bbb2" stroke="#8fa69e" stroke-width="2"/>
    <path d="M824 444L1025 411" stroke="#c5d5cc" stroke-width="2"/>
    <g data-part="bed-back">
      <path d="M724 161Q724 149 738 149H833Q847 149 847 164V438H724Z" fill="url(#${id}-silver)" stroke="#7d9690" stroke-width="2"/>
      <rect x="726" y="156" width="113" height="275" rx="15" fill="url(#${id}-mattress)" stroke="#bdcdc1" stroke-width="2"/>
      <path d="M733 174V412Q785 425 831 412M733 338H831" fill="none" stroke="#fffdf3" stroke-width="3"/>
      <path d="M841 183V411" stroke="#d5e0d6" stroke-width="4"/>
    </g>
    <circle cx="777" cy="448" r="8" fill="#749287" stroke="#d7e5d9" stroke-width="3"/>
  </g>`;
}

function bedding(id) {
  return `<g class="care-scene-bedding">
    <path data-part="blanket" fill="url(#${id}-quilt)" stroke="#8daea1" stroke-width="2"/>
    <path data-part="blanket-folds" fill="none" stroke="#789e93" stroke-width="2" opacity=".65"/>
    <path d="M462 471Q560 472 662 460M464 476Q560 477 664 465" fill="none" stroke="#eef4e8" stroke-width="2" opacity=".8"/>
    <g class="care-scene-lowered-rail">
      <path d="M693 491V520L951 502V473M707 490V513M748 487V510M788 484V507M829 481V504M870 478V501M912 475V498" fill="none" stroke="url(#${id}-silver)" stroke-width="5" stroke-linecap="round"/>
      <path d="M690 487L954 469" stroke="#91aba0" stroke-width="12" stroke-linecap="round"/><path d="M690 485L954 467" stroke="#dce6da" stroke-width="8" stroke-linecap="round"/>
      <circle cx="693" cy="520" r="5" fill="#69867c"/><circle cx="951" cy="502" r="5" fill="#69867c"/>
    </g>
    <path d="M443 492V443Q443 433 453 433H481Q491 433 491 443V489" fill="url(#${id}-wood)" stroke="#ac9b7e" stroke-width="2"/>
    <path d="M453 446H479" stroke="#faf0dc" stroke-width="3" stroke-linecap="round"/>
    <g class="care-scene-bed-label" transform="translate(831 552)"><title data-part="bed-title" data-label="bedTitle"/><rect x="-90" y="-13" width="180" height="26" rx="8"/><text text-anchor="middle" y="5" data-part="bed-label" data-label="bed"/></g>
  </g>`;
}

function armMarkup(id, name, elder = false) {
  return `<g data-arm="${name}" class="care-scene-arm">
    <path data-part="upper" fill="url(#${id}-${elder ? 'purple' : 'green'})" stroke="${elder ? '#7e697b' : '#376e63'}" stroke-width="1.5"/>
    <circle data-part="elbow-fill" r="15" fill="url(#${id}-${elder ? 'purple' : 'green'})"/>
    <path data-part="lower" fill="url(#${id}-${elder ? 'purple' : 'green'})" stroke="${elder ? '#7e697b' : '#376e63'}" stroke-width="1.4"/>
    <path data-part="forearm" fill="url(#${id}-skin)" stroke="#bd9279" stroke-width="1.1"/>
    <path data-part="cuff" fill="none" stroke="${elder ? '#c8b4be' : '#9abfaf'}" stroke-width="6"/>
    <path data-part="seam" fill="none" stroke="${elder ? '#dbccd1' : '#c2dcc7'}" stroke-width="1.3" opacity=".5"/>
  </g>`;
}

function trainee(id) {
  return `<g data-person="trainee" transform="translate(118 0)">
    ${chair(360)}
    <path d="M333 418Q355 408 402 424L437 451 435 529H407L397 470 356 465Q330 453 333 418Z" fill="#3b5054"/>
    <path d="M326 421Q357 420 383 454L390 541H359L344 481Q318 464 317 445Z" fill="#506368"/>
    <path d="M345 453L370 467 374 517M408 451L420 465 422 510" fill="none" stroke="#7a8988" stroke-width="2"/>
    <path d="M358 532H390V548H358ZM406 522H436V540H406Z" fill="#e6e5d8"/>
    <path d="M355 544Q372 538 392 546L414 555Q419 565 408 568H355Q348 562 355 544ZM405 536Q423 531 438 539L458 549Q464 558 453 560H405Q399 551 405 536Z" fill="#f2f0e5" stroke="#7c8b85" stroke-width="2"/>
    <path d="M355 563H411M406 555H456M379 548L388 552M375 552L384 556M425 539L435 544" stroke="#b8c6bc" stroke-width="2"/>
    <g data-part="body">
      <path d="M354 279Q381 264 407 278Q427 281 434 308L424 358 433 420Q382 447 321 425L330 354Q325 303 354 279Z" fill="url(#${id}-green)" stroke="#3c7266" stroke-width="2"/>
      <path d="M346 332Q341 369 346 411M401 321Q390 350 401 378M329 414Q376 432 423 410" fill="none" stroke="#9fc0a9" stroke-width="2" opacity=".5"/>
      <path d="M376 250L373 279Q386 295 402 278L400 247Z" fill="url(#${id}-skin)" stroke="#be947a"/>
      <path d="M366 278L387 302 410 279M387 302L388 317" fill="none" stroke="#c0dac8" stroke-width="4"/>
      <path d="M351 326H373V352H351Z" fill="#eeeede" stroke="#d0dac7"/><rect x="359" y="321" width="7" height="10" rx="2" fill="#b7a779"/>
      <path d="M355 336H369M355 341H365" stroke="#7b9b88" stroke-width="2"/>
      <path d="M350 378H376L374 399H353Z" fill="#578d7b" stroke="#87b19a"/>
    </g>
    <g data-part="head" transform="translate(389 277) scale(.8) translate(-389 -277)">
      <ellipse cx="351" cy="207" rx="24" ry="28" fill="#37453e"/>
      <path d="M351 213Q345 177 380 173Q417 170 425 204L417 239 360 246Z" fill="#3f4b41"/>
      <path d="M364 199Q388 183 410 203L416 222 427 232Q430 237 419 239L416 256Q406 271 386 266Q365 262 362 234Z" fill="url(#${id}-skin)" stroke="#bd947b" stroke-width="1.3"/>
      <ellipse cx="362" cy="232" rx="8" ry="12" fill="url(#${id}-skin)"/><path d="M359 229Q367 224 366 237" fill="none" stroke="#b78970" stroke-width="1.3"/>
      <path d="M354 226Q348 187 377 181Q407 173 420 201Q397 207 389 190Q382 212 367 213L368 229Z" fill="#3c4b41"/>
      <path d="M356 198Q368 180 387 185M352 211Q356 193 367 189" fill="none" stroke="#77816a" stroke-width="2" opacity=".7"/>
      <path d="M389 218Q397 213 404 217M413 219L418 221" fill="none" stroke="#59604f" stroke-width="2.2" stroke-linecap="round"/>
      <g data-part="eyes"><path d="M389 227Q397 221 404 227Q398 231 389 227ZM413 228Q417 225 420 229" fill="#fff7e8" stroke="#8b8065"/><g data-part="gaze" fill="#465449"><ellipse cx="400" cy="226" rx="2.2" ry="2.8"/><ellipse cx="418" cy="228" rx="1.5" ry="2"/></g></g>
      <path d="M410 229L409 240 414 241" fill="none" stroke="#bd8f73" stroke-width="1.3"/>
      <path data-part="mouth" d="M402 250Q409 254 416 249" fill="none" stroke="#aa6f62" stroke-width="1.8" stroke-linecap="round"/>
      <ellipse cx="388" cy="242" rx="8" ry="4" fill="#d58d77" opacity=".2"/>
    </g>
  </g>`;
}

function elder(id) {
  return `<g data-person="elder">
    <g data-part="body">
      <g data-part="pillow">
        <path d="M735 180Q779 164 829 180L836 258Q792 282 745 264Z" fill="#899c91" opacity=".18"/>
        <path d="M733 176Q778 164 827 178Q835 213 830 256Q789 274 744 258Q734 222 733 176Z" fill="url(#${id}-linen)" stroke="#c7ccba" stroke-width="2"/>
        <path d="M740 184Q780 174 820 185L823 249Q789 264 751 250ZM748 190L760 205M819 235L807 230M754 246L769 237" fill="none" stroke="#dedbc9" stroke-width="2"/>
        <path d="M796 267Q817 259 830 275L834 350Q815 360 800 343Z" fill="#e9e9d7" stroke="#c5cdbb" stroke-width="1.5"/>
        <path d="M821 277L824 343M807 279Q817 307 810 331" fill="none" stroke="#d2d8c4" stroke-width="2"/>
      </g>
      <path d="M750 277Q774 271 797 279Q818 285 821 317L823 367Q834 400 821 431Q778 452 732 427L732 370 729 323Q728 291 750 277Z" fill="url(#${id}-purple)" stroke="#827083" stroke-width="2"/>
      <path d="M784 301L778 419M808 324Q799 355 813 389M736 379L740 411" fill="none" stroke="#d0bbc7" stroke-width="2" opacity=".65"/>
      <path d="M729 392H751L750 415H732Z" fill="#9b8498" stroke="#c4aebe"/>
      <g fill="#e0d5d6"><circle cx="781" cy="325" r="2.3"/><circle cx="780" cy="348" r="2.3"/><circle cx="779" cy="371" r="2.3"/><circle cx="779" cy="394" r="2.3"/></g>
      <path d="M765 246L762 280Q775 293 790 280L788 244Z" fill="url(#${id}-skin)" stroke="#bd957c"/>
      <path d="M768 263Q777 268 786 261M767 270Q776 275 785 268" fill="none" stroke="#ba9077" stroke-width="1" opacity=".75"/>
      <ellipse data-part="throat" cx="769" cy="271" rx="4" ry="3" fill="#c7957b" opacity=".35"/>
      <path d="M753 281L767 291 790 283 796 364Q770 376 740 362L739 301Z" fill="url(#${id}-linen)" stroke="#c9c5b5" stroke-width="1.3"/>
      <path d="M743 296L740 355 782 362M751 300L758 354M770 299L779 355" fill="none" stroke="#d6d1c0" stroke-width="1.4"/>
      <path d="M733 357L782 365M733 360L783 368" stroke="#aebcb0" stroke-width="1"/>
      <g data-part="head">
        <ellipse cx="788" cy="221" rx="20" ry="28" fill="#a6a79e" stroke="#8f938b"/>
        <path d="M706 216Q700 182 727 171Q757 155 782 181Q800 197 788 235L770 262 720 259Z" fill="url(#${id}-hair)" stroke="#95988e" stroke-width="1.5"/>
        <path d="M716 204Q735 184 764 200Q781 213 777 240Q773 265 750 273Q726 277 711 259L708 246 699 242Q694 239 701 233L708 222Z" fill="url(#${id}-skin)" stroke="#bc937b" stroke-width="1.3"/>
        <ellipse cx="776" cy="236" rx="8" ry="13" fill="url(#${id}-skin)" stroke="#c59b80"/>
        <path d="M778 231Q771 227 773 240M770 246L773 248" fill="none" stroke="#b78c74" stroke-width="1.3"/>
        <path d="M705 216Q699 195 717 181Q743 163 767 178Q791 188 785 220L777 231 770 211Q750 211 742 190Q728 212 705 216Z" fill="url(#${id}-hair)"/>
        <g fill="none" stroke-linecap="round">
          <path d="M709 202Q718 181 738 179M716 207Q732 192 737 182M743 177Q753 197 773 201M753 177Q776 188 778 211M724 177Q742 166 758 175M781 222Q788 206 783 197" stroke="#eee8dd" stroke-width="2.5"/>
          <path d="M706 208Q718 205 728 194M749 187Q757 204 771 207M782 231L788 220M763 174Q780 181 785 194" stroke="#969b90" stroke-width="1.4"/>
          <path d="M721 210Q733 205 745 210M723 213Q733 210 741 213" stroke="#b38e79" stroke-width=".9" opacity=".7"/>
        </g>
        <g data-part="brows" fill="none" stroke="#7d7d6c" stroke-width="2.7" stroke-linecap="round"><path data-part="brow-near"/><path data-part="brow-far"/></g>
        <path data-part="frown" fill="none" stroke="#a77e6c" stroke-width="1"/>
        <g data-part="eyes"><path d="M716 231Q722 226 728 231Q722 234 716 231ZM740 231Q747 226 754 231Q747 235 740 231Z" fill="#f4eedf" stroke="#9b846c" stroke-width="1"/>
          <g data-part="gaze" fill="#5b6052"><ellipse cx="720" cy="231" rx="2.1" ry="2.5"/><ellipse cx="744" cy="231" rx="2.4" ry="2.7"/></g>
        </g>
        <g fill="#e5efde" fill-opacity=".15" stroke="#746c60" stroke-width="1.5"><rect x="709" y="221" width="24" height="18" rx="7"/><rect x="737" y="220" width="26" height="20" rx="7"/><path d="M733 227Q735 225 738 227M763 225L777 229" fill="none"/></g>
        <path d="M713 223L721 223M741 222L748 222" stroke="#fffaf0" stroke-width="1.3" opacity=".8"/>
        <path d="M713 234L707 243 715 245M718 246Q721 250 718 255M757 244L759 253M753 244L756 247M742 259Q738 269 727 267M725 271L739 274" fill="none" stroke="#b68e75" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M712 240L709 243M764 236L768 240M762 239L766 243" stroke="#ad8973" stroke-width="1"/>
        <ellipse cx="742" cy="249" rx="10" ry="5" fill="#d99e86" opacity=".19"/>
        <g data-part="jaw"><path data-part="mouth" fill="#82534c" stroke="#ac7467" stroke-width="1.3" stroke-linejoin="round"/>
          <path data-part="lower-lip" fill="none" stroke="#c38b79" stroke-width="1.3" stroke-linecap="round"/>
        </g>
        <circle cx="777" cy="250" r="3.1" fill="#dfc48b" stroke="#ad9870" stroke-width=".8"/>
      </g>
    </g>
  </g>`;
}

function table(id) {
  return `<g class="care-scene-table" transform="translate(240 163) scale(.72)">
    <ellipse cx="535" cy="553" rx="100" ry="13" fill="#6e745b" opacity=".12"/>
    <path d="M462 448V533M604 445V533M461 518H606" fill="none" stroke="url(#${id}-silver)" stroke-width="7"/>
    <path d="M456 495H610L617 510H449Z" fill="#c6d2c1" stroke="#9db4a4" stroke-width="2"/>
    <g fill="#60786e" stroke="#4c635c" stroke-width="2"><circle cx="462" cy="542" r="9"/><circle cx="604" cy="542" r="9"/></g>
    <g fill="#d1dccc"><circle cx="462" cy="542" r="3"/><circle cx="604" cy="542" r="3"/></g>
    <path d="M447 411V387Q447 379 455 379H470" fill="none" stroke="url(#${id}-silver)" stroke-width="5"/>
    <path d="M438 439L451 393Q454 386 466 386H600Q614 386 617 398L630 438Q631 449 621 452H446Q435 450 438 439Z" fill="url(#${id}-wood)" stroke="#b9ae8e" stroke-width="2"/>
    <path d="M439 440Q535 446 628 439V451H440Z" fill="#c1ad8d" stroke="#ad9e81"/>
    <path d="M450 434L459 401H605L617 434Z" fill="#c4d0ba"/>
    <path d="M460 429H607" stroke="#eaf0df" stroke-width="1.5" stroke-dasharray="3 3"/>
    <ellipse cx="500" cy="429" rx="48" ry="9" fill="#7a8c76" opacity=".2"/>
    <ellipse cx="500" cy="427" rx="41" ry="8" fill="#f2f1df" stroke="#c2cabb"/>
    <path d="M457 398Q460 432 500 434Q540 432 543 398Z" fill="url(#${id}-ceramic)" stroke="#9fb5a8" stroke-width="1.5"/>
    <path d="M466 408Q481 425 516 423" fill="none" stroke="#fdfbef" stroke-width="3" opacity=".7"/>
    <ellipse cx="500" cy="398" rx="43" ry="15" fill="#faf6e5" stroke="#b0c4b4" stroke-width="2"/>
    <ellipse cx="500" cy="399" rx="36" ry="10.5" fill="#dece99"/>
    <path d="M468 400Q478 390 490 397Q500 388 512 395Q527 390 535 400Q501 413 468 400Z" fill="#eaddb4"/>
    <g stroke="#fcf1d4" stroke-width="2.8" stroke-linecap="round"><path d="M479 399L483 398M490 394L494 395M504 399L508 398M517 395L521 396M491 403L495 404M515 403L519 402M528 400L530 399"/></g>
    <g fill="#9baf76"><ellipse cx="489" cy="398" rx="2" ry="1"/><ellipse cx="510" cy="395" rx="2" ry="1.2"/><ellipse cx="504" cy="405" rx="2" ry="1"/></g>
    <g transform="translate(569 399) scale(.78)"><ellipse cy="22" rx="24" ry="7" fill="#6e836d" opacity=".17"/>
      <path d="M-20-35L-17 18Q0 29 17 18L20-35Z" fill="#eef5e4" fill-opacity=".45" stroke="#9bb7aa" stroke-width="1.6"/>
      <path d="M-18-10L-15 17Q0 25 15 17L18-10Z" fill="#afd0c3" fill-opacity=".6"/><ellipse cy="-10" rx="18" ry="5" fill="#d5e8d7" stroke="#a6c6b4"/>
      <ellipse cy="-35" rx="20" ry="6" fill="#f2f8e7" fill-opacity=".65" stroke="#a4beb0" stroke-width="1.5"/>
      <path d="M-13-29L-11 12M11-28L10-16" stroke="#fffef0" stroke-width="3" stroke-linecap="round" opacity=".85"/>
    </g>
    <g transform="translate(566 429) scale(.65)"><path d="M-30-8L9-15 31 0-10 9Z" fill="#f9f4e6" stroke="#d1c9b4"/><path d="M-30-8V0L-10 17 31 8V0L-10 9Z" fill="#dfdeca" stroke="#c9c6af"/><path d="M-24-5L-9 7 23 0M-9 11L25 4" fill="none" stroke="#b9c5b4" stroke-width="1.5"/></g>
    <g transform="translate(603 416) scale(.65)"><path d="M-27-12L10-18 29-3-8 4Z" fill="#ddd6bb" stroke="#bdb99f"/><path d="M-27-12V2L-8 17 29 8V-3L-8 4Z" fill="#efead5" stroke="#c8c3a8"/>
      <path d="M-8-6Q-20-22-9-37Q-1-29 10-33Q18-22 8-11Z" fill="#fffdf0" stroke="#dbdccc"/><path d="M-8-29L-3-11" stroke="#e6e7d6"/>
      <path d="M-17-8L6-12" stroke="#aaa98e" stroke-width="3" stroke-linecap="round"/>
    </g>
    <text x="533" y="476" class="care-scene-cart-label" text-anchor="middle" data-part="cart-label" data-label="cart"/>
  </g>`;
}

/** Pure SVG scene, with a DOM speech bubble. The host owns the animation loop. */
export function mountScene(container) {
  if (!container || typeof container.appendChild !== 'function') throw new TypeError('mountScene(container) requires a DOM container.');
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const id = `care-meal-${++serial}`;
  const root = doc.createElement('div');
  root.className = 'care-scene';
  root.innerHTML = `<svg class="care-scene-svg" xmlns="${SVG_NS}" viewBox="0 0 1100 680" preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby="${id}-title ${id}-desc">
    <title id="${id}-title" data-part="scene-title" data-label="title"/>
    <desc id="${id}-desc" data-part="scene-desc" data-label="desc"/>
    ${room(id)}
    <g class="care-scene-name"><rect x="380" y="116" width="192" height="34" rx="17"/><circle cx="400" cy="133" r="3.5"/><text x="485" y="138" data-part="worker-label" data-label="worker"/></g>
    <g class="care-scene-name care-scene-name-elder" data-part="senior-badge"><title data-part="senior-title" data-label="seniorLabel"/><rect x="747" y="101" width="260" height="34" rx="17"/><circle cx="767" cy="118" r="3.5"/><text x="887" y="123" data-part="senior-label" data-label="seniorLabel"/></g>
    ${bed(id)}${trainee(id)}${elder(id)}${bedding(id)}${table(id)}
    <g data-part="support-arm">${armMarkup(id, 'support')}
      <g data-part="support-hand"><path d="M-12-7Q-3-11 5-9L16-5Q19-2 14 0L3-1 14 3Q17 7 11 8L-1 6Q-7 10-12 5Z" fill="url(#${id}-skin)" stroke="#ba9177" stroke-width="1.2"/><path d="M0 1L11 4M-2 5L7 7" stroke="#c1977e" fill="none"/></g>
    </g>
    <g data-part="elder-far-hand">${armMarkup(id, 'resting', true)}<g data-part="resting-hand"><path d="M-10-7Q0-11 14-5L24 1Q25 5 19 6L5 4 17 8Q19 12 13 12L-4 8-11 3Z" fill="url(#${id}-skin)" stroke="#b98e75"/><path d="M3-2L18 3M2 3L14 7" stroke="#bb947b" fill="none"/></g></g>
    ${armMarkup(id, 'feeding')}
    <g data-part="spoon">
      <ellipse data-part="spoon-shadow" cx="-15" cy="9" rx="20" ry="4" fill="#697763" opacity=".13"/>
      <path d="M-83 0Q-89 0-88-3Q-87-7-81-6L-30-3-22-5-20 0-31 1Z" fill="url(#${id}-silver)" stroke="#748c91" stroke-width=".9"/>
      <path d="M-83-4L-34-2" stroke="#faffff" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M-28-3Q-27-8-13-8Q1-8 0-2Q-1 6-13 6Q-24 6-28-3Z" fill="url(#${id}-silver)" stroke="#748b90" stroke-width=".9"/>
      <ellipse cx="-13" cy="-3" rx="12" ry="4.6" fill="url(#${id}-spoon)"/>
      <path d="M-23-4Q-13-9-3-4" stroke="#f9ffff" stroke-width="1" fill="none"/>
      <g data-part="food" transform="translate(-13 -4)"><path d="M-10 0Q-10-4-5-4Q-3-8 1-5Q6-7 8-3Q13-1 8 2Q0 5-10 0Z" fill="#efdfa9" stroke="#c9b77f" stroke-width=".7"/>
        <path d="M-6-2L-3-3M0-3L3-2M-2 0L1 1M5-1L7 0" stroke="#fff3d2" stroke-width="2.1" stroke-linecap="round"/><path d="M3-4L5-3M-7 0L-5 1" stroke="#91a76b" stroke-width="1.5" stroke-linecap="round"/>
      </g>
    </g>
    <g data-part="grip"><path d="M-12-8Q-5-13 3-10L14-6Q17-3 13 0L5-1 12 3Q15 6 11 9L0 10Q-8 8-12 4Z" fill="url(#${id}-skin)" stroke="#b99076" stroke-width="1.2"/>
      <path d="M-2-9Q7-14 12-9L15-5Q15-2 11-2L4-5M1 1L11 4M-1 5L9 7" fill="none" stroke="#bd9279" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M8-8L12-6" stroke="#f3d6bc" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g data-part="blocking-arm">${armMarkup(id, 'blocking', true)}
      <g data-part="block-hand"><path d="M-10 8L-12-2-20-12Q-24-18-20-20Q-17-22-10-14L-7-10-8-32Q-8-39-4-39Q0-39 0-33L2-16 2-39Q2-45 6-44Q10-44 10-38L10-15 13-34Q14-39 18-37Q21-36 19-30L17-11 20-23Q22-29 26-26Q29-24 26-17L21 1Q17 12 10 14L-1 15Z" fill="url(#${id}-skin)" stroke="#b58c74" stroke-width="1.2"/>
        <path d="M-6-5Q6-10 14-3M-2 0Q5 4 12 0M0-23L3-23M11-23L15-22M-3 7L4 10" fill="none" stroke="#bb947a" stroke-width="1"/>
      </g>
    </g>
    <g class="care-scene-guides" data-part="guides">
      <path class="care-scene-target" data-part="target-path"/>
      <path class="care-scene-bones" data-part="bones"/>
      <circle data-joint="shoulder" r="4"/><circle data-joint="elbow" r="4"/><circle data-joint="wrist" r="5"/>
      <g data-part="target-stop"><path d="M0-13V15M-5-13H5M-5 15H5" class="care-scene-stop"/><text x="-18" y="-24" text-anchor="end" data-part="target-label"/></g><text x="607" y="416" data-part="scoop-label" data-label="scoop"/>
    </g>
    <path class="care-scene-trail" data-part="trail"/>
    <g data-part="drag" class="care-scene-drag" role="slider" tabindex="0" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-disabled="false">
      <circle r="26" class="care-scene-hit"/><circle r="22" class="care-scene-drag-ring"/>
      <path d="M-31 4L-36 0-31-4M31-4L36 0 31 4" class="care-scene-drag-arrows"/><title data-part="drag-title" data-label="dragTitle"/>
    </g>
    <g class="care-scene-stage" transform="translate(550 604)"><rect x="-236" y="-23" width="472" height="43" rx="21.5"/><circle cx="-211" cy="-1" r="3"/><text data-part="phase-label" x="0" y="-6" text-anchor="middle"/><text data-part="phase-hint" x="0" y="11" text-anchor="middle"/></g>
  </svg>
  <div class="care-scene-feedback" role="status" aria-live="polite" aria-atomic="true" hidden><span class="care-scene-feedback-speaker" data-part="speech-speaker"></span><span class="care-scene-feedback-text" data-part="speech-text"></span></div>`;
  container.appendChild(root);
  const part = (name, parent = root) => parent.querySelector(`[data-part="${name}"]`);
  const svg = root.querySelector('svg');
  const nodes = Object.fromEntries(['spoon', 'spoon-shadow', 'food', 'grip', 'guides', 'bones', 'trail', 'drag', 'block-hand', 'resting-hand', 'phase-label', 'phase-hint', 'bed-back', 'blanket', 'blanket-folds', 'support-hand', 'target-path', 'target-stop', 'target-label', 'senior-badge'].map(name => [name, part(name)]));
  const people = Object.fromEntries(['trainee', 'elder'].map(role => {
    const node = root.querySelector(`[data-person="${role}"]`);
    return [role, Object.fromEntries(['body', 'head', 'eyes', 'gaze', 'mouth', 'lower-lip', 'jaw', 'throat', 'brow-near', 'brow-far', 'frown', 'pillow'].map(name => [name, part(name, node)]))];
  }));
  const arms = Object.fromEntries(['feeding', 'support', 'blocking', 'resting'].map(name => {
    const group = root.querySelector(`[data-arm="${name}"]`);
    return [name, Object.fromEntries(['upper', 'lower', 'elbow-fill', 'forearm', 'cuff', 'seam'].map(key => [key, part(key, group)]))];
  }));
  const joints = Object.fromEntries(['shoulder', 'elbow', 'wrist'].map(key => [key, root.querySelector(`[data-joint="${key}"]`)]));
  const feedback = root.querySelector('.care-scene-feedback');
  const feedbackName = root.querySelector('.care-scene-feedback-speaker');
  const feedbackText = root.querySelector('.care-scene-feedback-text');
  const labelNodes = [...root.querySelectorAll('[data-label]')];
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const now = () => win.performance.now();
  const startedAt = now();
  let phaseStarted = startedAt;
  let frame = normalize({ brow: .65, headTurn: .18, portion: 30, showGuides: true });
  let destroyed = false, interactive = true, activePointer = null, keyboardActive = false;
  let dragValue = 0, pointerOffset = { x: 0, y: 0 }, currentWrist = { x: 430, y: 405 };
  let history = [], lastTrailTime = -Infinity;
  let lastSpeech = null, lastSpeaker = null, lastPhase = null;
  let lastLocale = null, lastSeniorName = null, lastNoHints = null;
  const set = (node, key, value) => node.setAttribute(key, String(value));
  // Only shrink labels that exceed their SVG slot; retain readable natural spacing.
  function fitLabel(node, value, width) {
    if (node.textContent === value) return;
    node.textContent = value;
    node.removeAttribute('textLength');
    node.removeAttribute('lengthAdjust');
    if (node.getComputedTextLength?.() > width) {
      set(node, 'textLength', width);
      set(node, 'lengthAdjust', 'spacingAndGlyphs');
    }
  }

  function normalize(next) {
    return { locale: next.locale === 'zh' ? 'zh' : 'en',
      seniorName: typeof next.seniorName === 'string' && next.seniorName.trim() ? next.seniorName.trim() : 'Ms Zhou',
      progress: clamp(next.progress), posture: clamp(next.posture), phase: Object.hasOwn(phases, next.phase) ? next.phase : 'ready',
      headTurn: clamp(next.headTurn), brow: clamp(next.brow), mouth: clamp(next.mouth), handBlock: clamp(next.handBlock),
      accepted: Boolean(next.accepted), portion: clamp(Number.isFinite(next.portion) ? next.portion / 100 : 0) * 100,
      food: Boolean(next.food), speech: typeof next.speech === 'string' ? next.speech : '',
      speaker: ['elder', 'trainee'].includes(next.speaker) ? next.speaker : null,
      noHints: Boolean(next.noHints),
      showGuides: Boolean(next.showGuides), showTrails: Boolean(next.showTrails), selected: Boolean(next.selected) };
  }

  function paintArm(arm, pose, width = 19) {
    const { shoulder: s, elbow: e, wrist: w } = pose;
    const cuff = { x: mix(e.x, w.x, .63), y: mix(e.y, w.y, .63) };
    set(arm.upper, 'd', ribbon(s, e, width, width * .82));
    set(arm['elbow-fill'], 'cx', e.x); set(arm['elbow-fill'], 'cy', e.y); set(arm['elbow-fill'], 'r', width * .84);
    set(arm.lower, 'd', ribbon(e, cuff, width * .82, width * .66));
    set(arm.forearm, 'd', ribbon(cuff, w, width * .51, width * .39));
    const length = Math.hypot(w.x - e.x, w.y - e.y);
    const n = { x: -(w.y - e.y) / length * width * .67, y: (w.x - e.x) / length * width * .67 };
    set(arm.cuff, 'd', `M${point({ x: cuff.x + n.x, y: cuff.y + n.y })}L${point({ x: cuff.x - n.x, y: cuff.y - n.y })}`);
    set(arm.seam, 'd', `M${s.x - 3},${s.y + 9}Q${e.x - 8},${e.y + 6} ${e.x - 3},${e.y + 4}L${cuff.x - 3},${cuff.y + 3}`);
  }

  function blink(time, offset) {
    if (reducedMotion?.matches) return 1;
    const cycle = (time + offset) % 4.7;
    return cycle < .16 ? Math.max(.09, Math.abs(cycle - .08) / .08) : 1;
  }

  function render(timestamp) {
    if (destroyed) return;
    const text = labels[frame.locale];
    const phase = phases[frame.phase][frame.locale];
    const labelsChanged = lastLocale !== frame.locale || lastSeniorName !== frame.seniorName || lastNoHints !== frame.noHints;
    if (labelsChanged) {
      lastLocale = frame.locale; lastSeniorName = frame.seniorName; lastNoHints = frame.noHints;
      root.classList.toggle('care-scene-no-hints', frame.noHints);
      root.lang = frame.locale;
      root.dataset.locale = frame.locale;
      set(svg, 'lang', frame.locale);
      for (const node of labelNodes) {
        const key = node.dataset.label;
        const value = frame.noHints && key === 'desc' ? text.illustrationDesc
          : frame.noHints && key === 'dragTitle' ? movementLabel
          : frame.noHints && key === 'scoop' ? '' : text[key];
        // Keep the full name in accessible text; only the small SVG badge is shortened.
        const name = key === 'seniorLabel' && node.localName === 'text'
          ? shortName(frame.seniorName, frame.locale === 'en' ? 12 : 8) : frame.seniorName;
        const content = typeof value === 'function' ? value(name) : value;
        const width = { room: 550, worker: 146, seniorLabel: 216, bed: 160, cart: 150, scoop: 180 }[key];
        if (node.localName === 'text') fitLabel(node, content, width);
        else node.textContent = content;
      }
      set(nodes['senior-badge'], 'aria-label', text.seniorLabel(frame.seniorName));
      set(nodes.drag, 'aria-label', frame.noHints ? movementLabel : text.drag);
    }
    const time = (timestamp - startedAt) / 1000;
    const elapsed = Math.max(0, (timestamp - phaseStarted) / 1000);
    const ambient = reducedMotion?.matches ? 0 : 1;
    const progress = activePointer !== null || keyboardActive ? dragValue : frame.progress;
    const breath = Math.sin(time * 1.55) * .65 * ambient;
    const elder = elderPose(frame, breath);
    set(people.elder.body, 'transform', elder.bodyTransform);
    // The bed follows posture only: a refusal must not rock the bed mechanism.
    set(nodes['bed-back'], 'transform', elderPose({ ...frame, headTurn: 0, handBlock: 0 }).bodyTransform);
    // Pillow remains on the bed, not glued to the turning face.
    set(people.elder.pillow, 'transform', 'translate(0 0)');
    set(people.trainee.body, 'transform', `translate(0 ${breath * .45})`);
    set(people.trainee.head, 'transform', `translate(389 277) rotate(${Math.sin(time * .55) * .3 * ambient}) scale(.8) translate(-389 -277)`);
    set(people.elder.head, 'transform', elder.headTransform);
    // Breathing is subpixel; feeding shoulder and hand remain mechanically connected.
    const shoulder = { x: 538, y: 302 + breath * .45 };
    const serving = servingPose(frame, progress, elder, shoulder);
    const { tip, contact, arm: pose, end } = serving;
    paintArm(arms.feeding, pose);
    currentWrist = pose.wrist;
    set(nodes.spoon, 'transform', `translate(${point(tip)})`);
    set(nodes.grip, 'transform', `translate(${point(pose.wrist)})`);
    set(nodes['spoon-shadow'], 'opacity', progress < .16 ? .16 * (1 - progress / .16) : 0);
    const load = frame.portion / 100;
    const foodSize = load > 0 ? .32 + Math.sqrt(load) * .63 : 0;
    // food is host-owned: no hidden bite timer or automatic portion consumption.
    set(nodes.food, 'visibility', frame.food && load > 0 ? 'visible' : 'hidden');
    set(nodes.food, 'transform', `translate(-13 -4) scale(${foodSize} ${foodSize * (1 - contact * .7)})`);
    set(nodes.food, 'opacity', 1 - contact * .55);
    // A slow outward reach cues pillow adjustment without crossing the patient's body.
    const adjusting = frame.phase === 'position' ? Math.sin(Math.PI * frame.posture) * .7 : 0;
    // Free hand rests beside the bowl; in position phase it gestures to the bed.
    const supportTarget = { x: mix(566, 602, adjusting), y: mix(467, 369, adjusting) };
    const support = solveArm({ x: 469, y: 306 + breath * .45 }, supportTarget, 96, 94, 1);
    paintArm(arms.support, support, 16);
    set(nodes['support-hand'], 'transform', `translate(${point(support.wrist)}) rotate(${-adjusting * 25})`);
    const h = elder.hip;
    const waistFar = elder.bodyPoint({ x: 812, y: 386 });
    const waistNear = elder.bodyPoint({ x: 739, y: 386 });
    // A continuous waist-to-foot sheet: two long, shallow leg ridges, never a
    // vertical seated lap. The hip and feet do not migrate with the bed angle.
    set(nodes.blanket, 'd', `M${point(waistFar)}Q742 390 708 400Q654 392 605 416Q555 416 505 437Q482 434 460 452L451 479Q540 490 619 474Q700 477 765 468Q785 452 ${point(waistNear)}Z`);
    set(nodes['blanket-folds'], 'd', `M${point(waistFar)}Q790 412 ${point(waistNear)}M${waistNear.x - 4},${waistNear.y + 7}Q753 445 721 449M727 416Q659 409 606 433Q552 432 488 457M715 438Q662 449 622 449Q557 450 485 467M663 418Q653 432 661 442M598 435L581 443M517 445Q526 449 531 456M734 458Q750 461 760 456M554 477L575 468`);
    const blocking = frame.handBlock;
    const restingWrist = { x: 706, y: 449 };
    const blockWrist = { x: mix(restingWrist.x, elder.mouth.x - 38, blocking),
      y: mix(restingWrist.y, elder.mouth.y + 45, blocking) };
    const blockPose = solveArm(elder.bodyPoint({ x: 741, y: 300 }), blockWrist, 86, 82, -1);
    paintArm(arms.blocking, blockPose, 16);
    set(nodes['block-hand'], 'transform', `translate(${point(blockPose.wrist)}) rotate(${mix(-88, -7, blocking)}) scale(.66)`);
    const resting = solveArm(elder.bodyPoint({ x: 809, y: 299 }), { x: h.x - 20, y: h.y - 18 }, 86, 82, -1);
    paintArm(arms.resting, resting, 14);
    set(nodes['resting-hand'], 'transform', `translate(${point(resting.wrist)}) rotate(175) scale(.8)`);
    const frown = frame.brow;
    set(people.elder['brow-near'], 'd', `M713 ${220 - frown * 3}Q721 ${217 - frown} 728 ${219 + frown * 2}`);
    set(people.elder['brow-far'], 'd', `M740 ${219 + frown * 2}Q747 ${216 - frown} 755 ${219 - frown * 2}`);
    set(people.elder.frown, 'd', `M731 213L733 ${216 + frown * 3}M737 212L735 ${217 + frown * 2}`);
    set(people.elder.frown, 'opacity', frown * .85);
    const chewing = frame.posture >= .85 && frame.accepted && ['withdraw', 'swallow', 'rest'].includes(frame.phase);
    const chew = chewing && elapsed < 3.3 ? Math.sin(elapsed * 8) * .7 * ambient : 0;
    const opening = frame.mouth * clamp((frame.posture - .75) / .1) * (1 - clamp(frame.headTurn / .3)) * (1 - clamp(frame.handBlock / .25));
    const mouthHeight = opening * 8;
    const corner = 255 + frown * 1.8;
    set(people.elder.mouth, 'd', `M708 255Q714 ${253 - mouthHeight * .32} 722 ${corner}Q715 ${256 + mouthHeight} 708 255Z`);
    set(people.elder['lower-lip'], 'd', `M709 ${257 + mouthHeight * .5}Q715 ${259 + mouthHeight * .7} 721 ${corner + 1}`);
    set(people.elder.jaw, 'transform', `translate(0 ${chew})`);
    const swallow = frame.phase === 'swallow' && frame.posture >= .85 && frame.accepted && elapsed < 1.3 ? Math.sin(Math.PI * clamp(elapsed / 1.3)) * ambient : 0;
    set(people.elder.throat, 'transform', `translate(0 ${-swallow * 3}) scale(1 ${1 + swallow * .08})`);
    set(people.elder.throat, 'opacity', .25 + swallow * .18);
    set(people.elder.eyes, 'transform', `translate(0 231) scale(1 ${blink(time, 1.7)}) translate(0 -231)`);
    set(people.trainee.eyes, 'transform', `translate(0 227) scale(1 ${blink(time, 0)}) translate(0 -227)`);
    set(people.elder.gaze, 'transform', `translate(${frame.headTurn * 4 + (frame.accepted ? -1 : 0)} 0)`);
    set(people.trainee.gaze, 'transform', `translate(${progress * .65} ${mix(1.1, -.3, progress)})`);
    const talk = frame.speaker === 'trainee' && frame.speech ? Math.sin(time * 11) * .9 * ambient : 0;
    set(people.trainee.mouth, 'd', `M402 250Q409 ${253 + talk} 416 249`);
    nodes.guides.style.display = frame.showGuides && !frame.noHints ? '' : 'none';
    const pathPoints = Array.from({ length: 81 }, (_, i) => servingPose(frame, i / 80, elder, shoulder).tip);
    set(nodes['target-path'], 'd', pathPoints.map((p, i) => `${i ? 'L' : 'M'}${point(p)}`).join(' '));
    set(nodes['target-stop'], 'transform', `translate(${point(pathPoints.at(-1))})`);
    const targetLabel = frame.noHints ? '' : frame.posture < .85 || frame.phase === 'position' ? text.positionTarget : frame.handBlock > .1 ? text.blockTarget
      : frame.headTurn >= .15 ? text.turnTarget : frame.mouth <= .25 ? text.closedTarget : text.target;
    fitLabel(nodes['target-label'], targetLabel, 190);
    set(nodes['target-stop'], 'aria-label', targetLabel);
    set(nodes.bones, 'd', `M${point(pose.shoulder)}L${point(pose.elbow)}L${point(pose.wrist)}`);
    for (const key of Object.keys(joints)) { set(joints[key], 'cx', pose[key].x); set(joints[key], 'cy', pose[key].y); }
    if (!frame.showTrails || frame.noHints) history = [];
    else if (timestamp - lastTrailTime >= 32) {
      lastTrailTime = timestamp;
      const previous = history.at(-1);
      if (!previous || Math.hypot(previous.x - tip.x, previous.y - tip.y) > .8) history.push({ ...tip, time: timestamp });
    }
    history = history.filter(p => timestamp - p.time < 5000).slice(-120);
    nodes.trail.style.display = frame.showTrails && !frame.noHints ? '' : 'none';
    set(nodes.trail, 'd', history.map((p, i) => `${i ? 'L' : 'M'}${point(p)}`).join(' '));
    set(nodes.drag, 'transform', `translate(${point(pose.wrist)})`);
    set(nodes.drag, 'aria-valuenow', Math.round(progress * 100));
    const status = frame.posture < .85 || frame.phase === 'position' ? text.positionStatus : frame.handBlock > .1 ? text.blockStatus
      : frame.headTurn >= .15 ? text.turnStatus : frame.mouth <= .25 ? text.closedStatus : '';
    set(nodes.drag, 'aria-valuetext', frame.noHints ? movementLabel : text.progress(Math.round(progress * 100), `${phase.join(' / ')}${status ? `; ${status}` : ''}`));
    root.classList.toggle('care-scene-selected', frame.selected);
    root.classList.toggle('care-scene-dragging', activePointer !== null);
    root.dataset.phase = frame.phase;
    root.dataset.positioned = String(frame.posture >= .85);
    root.dataset.posture = String(frame.posture);
    root.dataset.contact = String(contact);
    if (lastPhase !== frame.phase || labelsChanged) {
      lastPhase = frame.phase;
      fitLabel(nodes['phase-label'], frame.noHints ? motionPhases[frame.locale][frame.phase] : phase[0], 400);
      set(nodes['phase-label'], 'y', frame.noHints ? 4 : -6);
      fitLabel(nodes['phase-hint'], frame.noHints ? '' : phase[1], 400);
    }
    if (lastSpeech !== frame.speech || lastSpeaker !== frame.speaker || labelsChanged) {
      lastSpeech = frame.speech; lastSpeaker = frame.speaker;
      feedback.hidden = frame.noHints || !frame.speech;
      feedbackText.textContent = frame.noHints ? '' : frame.speech;
      feedbackName.textContent = frame.speaker === 'elder' ? frame.seniorName : frame.speaker === 'trainee' ? text.you : '';
      feedbackName.title = feedbackName.textContent;
      feedbackName.hidden = !frame.speaker;
      feedback.dataset.speaker = frame.speaker || '';
    }
  }

  function update(next = {}) {
    if (destroyed) return;
    const incoming = normalize({ ...frame, ...(next || {}) });
    if (incoming.phase !== frame.phase) phaseStarted = now();
    frame = incoming;
    render(now());
  }

  function emit(type, value) {
    if (destroyed || !interactive) return;
    root.dispatchEvent(new win.CustomEvent(type, { bubbles: true, detail: { value: clamp(value) } }));
  }

  function localPoint(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    try {
      const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const local = p.matrixTransform(matrix.inverse());
      return Number.isFinite(local.x) && Number.isFinite(local.y) ? local : null;
    } catch { return null; }
  }

  function pointerValue(event) {
    const p = localPoint(event);
    if (!p) return null;
    const target = { x: p.x - pointerOffset.x, y: p.y - pointerOffset.y };
    const time = (now() - startedAt) / 1000;
    const breath = reducedMotion?.matches ? 0 : Math.sin(time * 1.55) * .65;
    const elder = elderPose(frame, breath);
    const shoulder = { x: 538, y: 302 + breath * .45 };
    let best = dragValue, distance = Infinity;
    // Project onto the authored tip path; the grab offset prevents an initial jump.
    for (let i = 0; i <= 400; i++) {
      const q = servingPose(frame, i / 400, elder, shoulder).arm.wrist;
      const d = (q.x - target.x) ** 2 + (q.y - target.y) ** 2;
      if (d < distance) { distance = d; best = i / 400; }
    }
    return best;
  }

  function onDown(event) {
    if (destroyed || !interactive || activePointer !== null || keyboardActive || event.isPrimary === false || event.button !== 0) return;
    const p = localPoint(event);
    if (!p) return;
    try { nodes.drag.setPointerCapture(event.pointerId); } catch { return; }
    event.preventDefault();
    nodes.drag.focus({ preventScroll: true });
    activePointer = event.pointerId;
    dragValue = frame.progress;
    pointerOffset = { x: p.x - currentWrist.x, y: p.y - currentWrist.y };
    render(now());
    emit('wristinput', dragValue);
  }

  function onMove(event) {
    if (destroyed || !interactive || activePointer === null || event.pointerId !== activePointer) return;
    const value = pointerValue(event);
    if (value === null) return;
    event.preventDefault(); dragValue = value; render(now()); emit('wristinput', value);
  }

  function releaseCapture(pointer) {
    if (pointer === null) return;
    try { if (nodes.drag.hasPointerCapture(pointer)) nodes.drag.releasePointerCapture(pointer); } catch { /* Detached document or an already released pointer. */ }
  }

  function onUp(event) {
    if (destroyed || !interactive || activePointer === null || event.pointerId !== activePointer) return;
    const value = pointerValue(event);
    if (value !== null) dragValue = value;
    const pointer = activePointer, finalValue = dragValue;
    activePointer = null; releaseCapture(pointer);
    frame.progress = finalValue; render(now());
    emit('wristinput', finalValue);
    emit('wristend', finalValue);
  }

  function cancelInteraction() {
    if (destroyed) return;
    const pointer = activePointer;
    activePointer = null; keyboardActive = false;
    dragValue = frame.progress;
    releaseCapture(pointer);
    render(now()); // Restore the latest host frame, silently, without resetting progress.
  }

  function onCancel(event) {
    if (activePointer !== null && event.pointerId === activePointer) cancelInteraction();
  }
  const keys = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'];
  function onKey(event) {
    if (destroyed || !interactive || activePointer !== null || event.altKey || event.ctrlKey || event.metaKey || !keys.includes(event.key)) return;
    event.preventDefault();
    if (!keyboardActive) dragValue = frame.progress;
    keyboardActive = true;
    const delta = (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? .1 : .025);
    dragValue = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : clamp(dragValue + delta);
    render(now()); emit('wristinput', dragValue);
  }
  function onKeyUp(event) {
    if (destroyed || !interactive || !keyboardActive || !keys.includes(event.key)) return;
    event.preventDefault(); keyboardActive = false;
    const value = dragValue;
    frame.progress = value; render(now()); emit('wristend', value);
  }
  function onBlur() { if (keyboardActive) cancelInteraction(); }
  const listeners = { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onCancel, lostpointercapture: onCancel, keydown: onKey, keyup: onKeyUp, blur: onBlur };
  for (const [type, listener] of Object.entries(listeners)) nodes.drag.addEventListener(type, listener);
  win.addEventListener('blur', cancelInteraction);
  render(startedAt);

  function setInteractive(value) {
    if (destroyed) return;
    interactive = Boolean(value);
    set(nodes.drag, 'aria-disabled', !interactive);
    set(nodes.drag, 'tabindex', interactive ? '0' : '-1');
    root.classList.toggle('care-scene-disabled', !interactive);
    if (!interactive) cancelInteraction();
  }
  function destroy() {
    if (destroyed) return;
    cancelInteraction(); destroyed = true;
    for (const [type, listener] of Object.entries(listeners)) nodes.drag.removeEventListener(type, listener);
    win.removeEventListener('blur', cancelInteraction);
    history = []; root.remove();
  }
  return { update, destroy, cancelInteraction, setInteractive };
}
