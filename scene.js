const SVG_NS = 'http://www.w3.org/2000/svg';

const clamp = (value, fallback = 0) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const mix = (a, b, t) => a + (b - a) * t;
const point = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
let sceneSerial = 0;

// Local figure coordinates: positive X points toward the shared exercise space.
function armPose(progress, far = false) {
  const t = clamp(progress);
  const shoulder = { x: far ? 22 : -19, y: far ? -114 : -108 };
  const wrist = {
    x: mix(far ? 51 : 38, far ? 159 : 173, t),
    y: mix(far ? 29 : 39, far ? -91 : -79, t) - Math.sin(t * Math.PI) * 11,
  };
  const upper = far ? 91 : 110;
  const lower = far ? 103 : 118;
  const dx = wrist.x - shoulder.x;
  const dy = wrist.y - shoulder.y;
  const distance = Math.hypot(dx, dy);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const elbow = {
    x: shoulder.x + along * dx / distance - height * dy / distance,
    y: shoulder.y + along * dy / distance + height * dx / distance,
  };
  return { shoulder, elbow, wrist };
}

function room(id) {
  return `<defs>
    <linearGradient id="${id}-wall" x2="0" y2="1"><stop stop-color="#f3f7f1"/><stop offset="1" stop-color="#e4eee7"/></linearGradient>
    <linearGradient id="${id}-floor" x2="0" y2="1"><stop stop-color="#e1d9c9"/><stop offset="1" stop-color="#f3ecdf"/></linearGradient>
    <linearGradient id="${id}-glass" x2="0.8" y2="1"><stop stop-color="#cee6e2"/><stop offset="0.65" stop-color="#edf5e6"/><stop offset="1" stop-color="#fffdf0"/></linearGradient>
    <linearGradient id="${id}-green" x1="0" x2="1"><stop stop-color="#24675f"/><stop offset="0.5" stop-color="#459387"/><stop offset="1" stop-color="#317c73"/></linearGradient>
    <linearGradient id="${id}-purple" x1="0" x2="1"><stop stop-color="#726082"/><stop offset="0.55" stop-color="#a68bb4"/><stop offset="1" stop-color="#877196"/></linearGradient>
    <radialGradient id="${id}-skin"><stop stop-color="#f7d6bb"/><stop offset="1" stop-color="#dca78b"/></radialGradient>
    <linearGradient id="${id}-hair" x2="1" y2="1"><stop stop-color="#faf9f3"/><stop offset="0.5" stop-color="#d6d8d3"/><stop offset="1" stop-color="#a5afa9"/></linearGradient>
    <filter id="${id}-shadow" x="-40%" y="-100%" width="180%" height="300%"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <rect width="1100" height="680" fill="url(#${id}-wall)"/>
  <path d="M0 0H1100V35H0Z" fill="#fff" opacity=".45"/>
  <rect x="77" y="57" width="320" height="370" rx="5" fill="#bccdc3"/>
  <rect x="88" y="68" width="298" height="348" fill="url(#${id}-glass)"/>
  <path d="M90 275Q147 204 213 265T386 234V415H90Z" fill="#aac7ad" opacity=".35"/>
  <path d="M95 351Q175 299 235 343T382 315V415H95Z" fill="#8eb79e" opacity=".3"/>
  <path d="M237 68V416M88 239H386" stroke="#fffdf5" stroke-width="10"/>
  <path d="M72 53Q95 147 66 323V428H44V53ZM404 53Q382 197 415 323V428H435V53Z" fill="#e6e4d7"/>
  <path d="M54 59Q73 217 53 392M423 61Q402 214 426 398" fill="none" stroke="#d1d7ca" stroke-width="3"/>
  <rect y="427" width="1100" height="253" fill="url(#${id}-floor)"/>
  <path d="M0 422H1100" stroke="#c1cfc1" stroke-width="10"/>
  <path d="M110 435L454 680H827L374 435Z" fill="#fff9dd" opacity=".44"/>
  <path d="M0 521H1100M0 616H1100M168 434L39 680M408 434L384 680M678 434L777 680M918 434L1100 619" stroke="#bdaf98" stroke-width="1" opacity=".22"/>
  <rect x="504" y="97" width="135" height="143" rx="4" fill="#c2b59d"/>
  <rect x="511" y="104" width="121" height="129" fill="#fbf9ed"/>
  <path d="M543 210Q601 174 580 128M570 180Q544 169 545 146Q574 149 575 171M581 156Q609 143 607 122Q581 130 581 156M557 198Q577 210 599 191" fill="none" stroke="#829d80" stroke-width="4" stroke-linecap="round"/>
  <rect x="893" y="325" width="155" height="108" rx="8" fill="#c6b69d"/>
  <rect x="885" y="318" width="169" height="12" rx="4" fill="#e6dbc5"/>
  <path d="M970 339V415" stroke="#ac9f89" stroke-width="2"/>
  <circle cx="959" cy="372" r="3" fill="#8c8b78"/><circle cx="981" cy="372" r="3" fill="#8c8b78"/>
  <ellipse cx="968" cy="321" rx="33" ry="5" fill="#a6a58e" opacity=".35"/>
  <path d="M948 284H985L980 317H954Z" fill="#ecede2"/>
  <path d="M967 288V237M969 268Q942 271 939 246Q961 244 969 268M968 253Q992 257 999 232Q975 230 968 253M967 240Q950 228 957 208Q978 216 967 240" fill="#6d9f80" stroke="#648e70" stroke-width="2"/>
  <ellipse cx="99" cy="487" rx="46" ry="11" fill="#51695c" opacity=".13"/>
  <path d="M77 419H121L116 481Q99 491 82 481Z" fill="#d0bfa4"/>
  <path d="M98 424Q101 357 94 305M100 388L65 351M99 371L135 327M98 342L69 307" fill="none" stroke="#607f5c" stroke-width="5"/>
  <path d="M95 331Q65 317 78 279Q106 291 95 331M72 358Q35 357 41 323Q72 325 72 358M106 365Q110 322 148 316Q152 352 106 365M96 395Q112 361 142 368Q135 400 96 395M83 382Q49 386 44 361Q66 348 83 382" fill="#759a6e"/>
  <path d="M94 322Q91 282 110 263Q133 299 94 322" fill="#94b384"/>
  <ellipse cx="562" cy="554" rx="336" ry="45" fill="#faf5e9" opacity=".5"/>`;
}

function figure(id, elder) {
  const role = elder ? 'elder' : 'trainee';
  const cloth = `url(#${id}-${elder ? 'purple' : 'green'})`;
  const skin = `url(#${id}-skin)`;
  const arm = (far) => `<g data-arm="${far ? 'far' : 'near'}" ${far ? 'opacity=".88"' : ''}>
    <path data-part="sleeve-outline" fill="none" stroke="${elder ? '#73617e' : '#265f59'}" stroke-width="${far ? 31 : 36}" stroke-linecap="round" stroke-linejoin="round"/>
    <path data-part="sleeve" fill="none" stroke="${cloth}" stroke-width="${far ? 27 : 32}" stroke-linecap="round" stroke-linejoin="round"/>
    <path data-part="seam" fill="none" stroke="${elder ? '#c5b3cd' : '#7bb6a4'}" stroke-width="1.6" opacity=".65"/>
    <path data-part="forearm" fill="none" stroke="${skin}" stroke-width="${far ? 19 : 22}" stroke-linecap="round"/>
    <path data-part="cuff" fill="none" stroke="${elder ? '#c0accb' : '#80b8a9'}" stroke-width="${far ? 28 : 32}"/>
    <g data-part="hand"><path d="M-10-8Q0-12 13-7L23-4Q29 0 24 5L12 10Q1 13-10 7Z" fill="${skin}" stroke="#c39178" stroke-width="1"/>
      <path d="M-1-7Q6-18 11-12L13-6M13 1L24 0M12 5L22 4" fill="none" stroke="#c39279" stroke-width="1.2" stroke-linecap="round"/></g>
  </g>`;
  return `<g class="care-scene-person" data-person="${role}" transform="translate(${elder ? 804 : 298} 395) scale(${elder ? -1 : 1} 1)">
    <ellipse cx="4" cy="154" rx="106" ry="15" fill="#52655d" opacity=".18" filter="url(#${id}-shadow)"/>
    <g class="care-scene-chair">
      <path d="M-63-110L-59 130M-40 24L-62 149M57 32L76 147" fill="none" stroke="#8b9d91" stroke-width="9" stroke-linecap="round"/>
      <path d="M-57-115Q-63-135-43-138H13Q29-136 29-117L26-31Q24-20 11-19H-45Q-58-19-57-33Z" fill="#c1d0be" stroke="#a2b79e" stroke-width="3"/>
      <path d="M-49-111H18M-48-77H18M-49-44H18" stroke="#d6dfcc" stroke-width="3"/>
      <path d="M-61 22Q-68 9-49 6H52Q70 7 69 24L62 32H-48Z" fill="#98afa0"/>
      <path d="M-48 38L58 38" stroke="#819788" stroke-width="5"/>
    </g>
    <g class="care-scene-legs">
      <path d="M-9 11Q26 0 62 21Q77 33 69 64L57 126H29L32 67-18 53Z" fill="${elder ? '#545167' : '#384b52'}" stroke="#37424a" stroke-width="2"/>
      <path d="M-35 13Q-4 8 29 32Q38 43 34 69L18 135H-14L-5 71Q-45 70-48 44Z" fill="${elder ? '#686277' : '#465b63'}"/>
      <path d="M-24 41L12 53L1 113M45 45L51 60L43 111" fill="none" stroke="${elder ? '#8a8297' : '#6c7d80'}" stroke-width="2" opacity=".65"/>
      <path d="M29 120H57V137H27ZM-14 128H18V142H-15Z" fill="#d7d8ce"/>
      <path d="M27 133Q45 130 59 136L83 144Q88 151 78 155H27Q20 150 27 133Z" fill="${elder ? '#62586a' : '#e7e9df'}" stroke="#536161" stroke-width="2"/>
      <path d="M-15 138Q5 134 20 141L42 149Q46 157 34 160H-17Q-23 154-15 138Z" fill="${elder ? '#76697c' : '#f4f4ea'}" stroke="#536161" stroke-width="2"/>
      <path d="M-16 155H36M28 150H79" stroke="${elder ? '#b4aab8' : '#b4c0b8'}" stroke-width="3"/>
      <path d="M6 144L16 146M2 148L12 150M47 140L57 142" stroke="${elder ? '#c4b8c7' : '#97aaa1'}" stroke-width="2"/>
    </g>
    <g data-part="body">
      ${arm(true)}
      <path d="M-37-130Q-13-147 12-136Q40-132 45-105L42-47Q42-20 55 13Q17 37-48 18L-45-47-53-98Q-57-119-37-130Z" fill="${cloth}" stroke="${elder ? '#786285' : '#28695f'}" stroke-width="2"/>
      <path d="M-44 10Q4 20 45 7M24-105Q13-76 24-44M-30-63Q-18-52-21-25" fill="none" stroke="${elder ? '#c3adcc' : '#82b6a4'}" stroke-width="2" opacity=".45"/>
      <path d="M-18-153L-19-131Q-6-113 11-133L8-158Z" fill="${skin}"/>
      ${elder ? '<path d="M-26-135Q-5-114 19-134M-9-120L-4 9" fill="none" stroke="#c9b6cf" stroke-width="3"/><g fill="#d9c7da"><circle cx="-7" cy="-100" r="2.5"/><circle cx="-6" cy="-77" r="2.5"/><circle cx="-5" cy="-54" r="2.5"/></g><path d="M20-38H37L34-18H21Z" fill="#907a9f" stroke="#b39bc1"/>' : '<path d="M-28-137L-8-117 18-136M-8-117L-5-98" fill="none" stroke="#afdbcd" stroke-width="4"/><path d="M13-93H34V-66H13Z" fill="#e2eee2"/><path d="M16-84H31M16-78H27" stroke="#7daba0" stroke-width="2"/><rect x="19" y="-98" width="9" height="8" rx="2" fill="#cbb78b"/>'}
      <g data-part="head">
        ${elder ? `<path d="M-40-177Q-52-207-24-224Q-5-239 19-225Q43-218 40-190L28-160-29-159Z" fill="url(#${id}-hair)" stroke="#a5afa8" stroke-width="2"/>` : '<ellipse cx="-34" cy="-202" rx="21" ry="24" fill="#2d3937"/><path d="M-39-177Q-48-211-21-226Q6-239 27-216Q41-204 31-180Z" fill="#34433e"/>'}
        <path d="M-30-201Q-8-216 19-204L27-187L35-177Q36-174 29-172L26-151Q18-139 3-140Q-20-141-29-162Z" fill="${skin}" stroke="#c6947d" stroke-width="1.2"/>
        <ellipse cx="-30" cy="-176" rx="8" ry="12" fill="${skin}"/><path d="M-32-181Q-23-184-27-171" fill="none" stroke="#bd8a74" stroke-width="1.3"/>
        ${elder ? `<path d="M-36-179Q-40-194-30-209Q-17-226 6-219Q27-223 32-202Q18-206 13-214Q1-197-23-198L-25-179Z" fill="url(#${id}-hair)"/><path d="M-30-207Q-19-221-7-218M-23-203Q-4-216 5-214M15-214L26-205" fill="none" stroke="#f9f9f2" stroke-width="3" stroke-linecap="round"/>` : '<path d="M-37-180L-37-198Q-30-225-8-222Q21-225 31-202Q10-202 2-214Q-9-193-25-195L-26-177Z" fill="#34433e"/><path d="M-31-208Q-17-220-5-215" fill="none" stroke="#5d6b5e" stroke-width="3"/>'}
        <path d="M-12-187Q-6-191 0-187M14-188Q19-190 23-186" fill="none" stroke="${elder ? '#93877d' : '#4d5147'}" stroke-width="2" stroke-linecap="round"/>
        <path d="M-12-181Q-6-186 0-180M13-181Q18-185 23-180" fill="#fcf6e8" stroke="#806e5f" stroke-width="1"/>
        <ellipse cx="-4" cy="-181" rx="2" ry="2.8" fill="#3f4841"/><ellipse cx="19" cy="-181" rx="1.8" ry="2.6" fill="#3f4841"/>
        <path d="M12-179L10-167Q14-165 18-167" fill="none" stroke="#bd8c74" stroke-width="1.4" stroke-linecap="round"/>
        <path data-part="mouth" d="M5-156Q13-151 21-158" fill="none" stroke="#a26661" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="-10" cy="-166" rx="8" ry="4" fill="#de9e89" opacity=".28"/>
        ${elder ? '<path d="M-16-174L-11-172M23-174L26-172M-14-193L-4-195M1-164Q-2-155 2-151M23-164L24-158" fill="none" stroke="#bb9683" stroke-width="1" opacity=".7"/><circle cx="-30" cy="-163" r="3" fill="#e6ca86"/>' : ''}
      </g>
      ${arm(false)}
      <g data-part="guides" class="care-scene-guides">
        <path data-part="target" class="care-scene-target"/>
        <circle data-part="goal" r="16" class="care-scene-goal"/>
        <path data-part="bones" class="care-scene-bones"/>
        <circle data-joint="shoulder" r="5"/><circle data-joint="elbow" r="5"/><circle data-joint="wrist" r="6"/>
      </g>
      <path data-part="trail" class="care-scene-trail"/>
      ${elder ? '' : '<g data-part="drag" class="care-scene-drag" role="slider" tabindex="0" aria-label="拖动护工手腕，练习坐姿前伸和回收；也可使用方向键" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><circle r="29" class="care-scene-hit"/><circle r="22" class="care-scene-drag-ring"/><path d="M-8-30L0-35 8-30M-8 30L0 35 8 30" class="care-scene-drag-arrows"/><title>拖动手腕示范前伸 / 回收</title></g>'}
    </g>
    <g data-part="feet" class="care-scene-feet"><ellipse cx="10" cy="162" rx="34" ry="7"/><ellipse cx="53" cy="157" rx="31" ry="6"/></g>
  </g>`;
}

/** Mount an isolated, dependency-free scene. Load scene.css once in the host page. */
export function mountScene(container) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new TypeError('mountScene(container) requires a DOM container.');
  }
  const id = `care-scene-${++sceneSerial}`;
  const root = document.createElement('div');
  root.className = 'care-scene';
  root.innerHTML = `<svg class="care-scene-svg" xmlns="${SVG_NS}" viewBox="0 0 1100 680" preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby="${id}-title ${id}-desc">
    <title id="${id}-title">康养活动室 · 坐姿上肢动作训练</title>
    <desc id="${id}-desc">左侧年轻护工示范，右侧白发周阿姨模仿。拖动左侧护工的手腕，完成上肢前伸、停留和回收。</desc>
    ${room(id)}
    <g class="care-scene-name"><rect x="192" y="105" width="212" height="43" rx="21.5"/><circle cx="213" cy="126.5" r="4"/><text x="305" y="132">你 · 受训护工</text></g>
    <g class="care-scene-name care-scene-name-elder"><rect x="678" y="105" width="250" height="43" rx="21.5"/><circle cx="699" cy="126.5" r="4"/><text x="811" y="132">周阿姨 · 具身模仿者</text></g>
    ${figure(id, false)}${figure(id, true)}
    <g class="care-scene-drag-caption"><path d="M345 469L364 475"/><text x="372" y="481">拖动手腕练习</text></g>
  </svg>
  <div class="care-scene-feedback" role="status" aria-live="polite" aria-atomic="true" hidden><span class="care-scene-feedback-speaker"></span><span class="care-scene-feedback-text"></span></div>`;
  container.appendChild(root);
  const svg = root.querySelector('svg');
  const feedback = root.querySelector('.care-scene-feedback');
  const feedbackName = root.querySelector('.care-scene-feedback-speaker');
  const feedbackText = root.querySelector('.care-scene-feedback-text');
  const caption = root.querySelector('.care-scene-drag-caption');
  const part = (node, name) => node.querySelector(`[data-part="${name}"]`);
  const people = Object.fromEntries(['trainee', 'elder'].map(role => {
    const node = root.querySelector(`[data-person="${role}"]`);
    return [role, {
      node, body: part(node, 'body'), head: part(node, 'head'), mouth: part(node, 'mouth'),
      guides: part(node, 'guides'), target: part(node, 'target'), goal: part(node, 'goal'),
      bones: part(node, 'bones'), trail: part(node, 'trail'), feet: part(node, 'feet'),
      joints: Object.fromEntries(['shoulder', 'elbow', 'wrist'].map(key => [key, node.querySelector(`[data-joint="${key}"]`)])),
      arms: ['near', 'far'].map(side => {
        const group = node.querySelector(`[data-arm="${side}"]`);
        return Object.fromEntries(['sleeve-outline', 'sleeve', 'seam', 'forearm', 'cuff', 'hand'].map(key => [key, part(group, key)]));
      }),
      history: [],
    }];
  }));
  const drag = part(people.trainee.node, 'drag');
  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let frame = { trainee: 0, elder: 0, compensation: 0, tremor: 0, phase: 'ready', speech: '', speaker: null, showGuides: true, showTrails: false, selected: false };
  let destroyed = false;
  let activePointer = null;
  let lastTrailTime = -Infinity;
  let dragValue = 0;
  let lastSpeech = '';
  let interactive = true;
  let lastSpeaker = null;
  const startedAt = performance.now();

  for (const person of Object.values(people)) {
    const points = Array.from({ length: 25 }, (_, i) => armPose(i / 24).wrist);
    person.target.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'}${point(p)}`).join(' '));
    const goal = points[points.length - 1];
    person.goal.setAttribute('cx', goal.x);
    person.goal.setAttribute('cy', goal.y);
  }

  function paintArm(nodes, pose) {
    const { shoulder: s, elbow: e, wrist: w } = pose;
    const cuff = { x: mix(e.x, w.x, .57), y: mix(e.y, w.y, .57) };
    const d = `M${point(s)} Q${point(e)} ${point(e)} L${point(cuff)}`;
    nodes['sleeve-outline'].setAttribute('d', d);
    nodes.sleeve.setAttribute('d', d);
    nodes.seam.setAttribute('d', `M${s.x - 5},${s.y + 5} L${e.x - 4},${e.y + 3} L${cuff.x - 3},${cuff.y + 3}`);
    nodes.forearm.setAttribute('d', `M${point(cuff)} L${point(w)}`);
    const c2 = { x: mix(e.x, w.x, .61), y: mix(e.y, w.y, .61) };
    nodes.cuff.setAttribute('d', `M${point(cuff)} L${point(c2)}`);
    const angle = Math.atan2(w.y - e.y, w.x - e.x) * 180 / Math.PI;
    nodes.hand.setAttribute('transform', `translate(${point(w)}) rotate(${angle * .55})`);
  }

  function render(now) {
    const time = (now - startedAt) / 1000;
    const ambient = motionQuery?.matches ? 0 : 1;
    const sampleTrail = now - lastTrailTime >= 35;
    if (sampleTrail) lastTrailTime = now;
    root.classList.toggle('care-scene-selected', frame.selected);
    root.classList.toggle('care-scene-dragging', activePointer !== null);
    root.dataset.phase = frame.phase;
    for (const role of ['trainee', 'elder']) {
      const person = people[role];
      const isElder = role === 'elder';
      const progress = !isElder && activePointer !== null ? dragValue : frame[role];
      const compensation = isElder ? frame.compensation : 0;
      const breath = Math.sin(time * 1.6 + (isElder ? .6 : 0)) * .9 * ambient;
      person.body.setAttribute('transform', `translate(${compensation * 8},${-compensation * 7 + breath}) rotate(${compensation * 9} 0 10)`);
      person.head.setAttribute('transform', `rotate(${-compensation * 4 + Math.sin(time * .7) * .7 * ambient} -5 -147)`);
      const poses = [armPose(progress), armPose(progress, true)];
      for (let i = 0; i < poses.length; i++) {
        const p = poses[i];
        const tremor = isElder ? frame.tremor : 0;
        p.wrist.x += Math.sin(time * 37 + i * 1.7) * tremor * 3.1;
        p.wrist.y += Math.sin(time * 43 + i) * tremor * 2.8;
        p.elbow.y += Math.sin(time * 37 + i) * tremor * .6;
        paintArm(person.arms[i], p);
      }
      const near = poses[0];
      person.guides.style.display = frame.showGuides ? '' : 'none';
      person.feet.style.display = frame.showGuides ? '' : 'none';
      person.bones.setAttribute('d', `M${point(near.shoulder)} L${point(near.elbow)} L${point(near.wrist)}`);
      for (const key of ['shoulder', 'elbow', 'wrist']) {
        person.joints[key].setAttribute('cx', near[key].x);
        person.joints[key].setAttribute('cy', near[key].y);
      }
      if (frame.showTrails && sampleTrail) {
        const previous = person.history[person.history.length - 1];
        if (!previous || Math.hypot(previous.x - near.wrist.x, previous.y - near.wrist.y) > 1.3) {
          person.history.push({ ...near.wrist, time: now });
        }
      }
      person.history = frame.showTrails ? person.history.filter(p => now - p.time < 2200).slice(-64) : [];
      person.trail.style.display = frame.showTrails ? '' : 'none';
      person.trail.setAttribute('d', person.history.map((p, i) => `${i ? 'L' : 'M'}${point(p)}`).join(' '));
      const speaking = frame.speaker === role && Boolean(frame.speech);
      person.mouth.setAttribute('d', speaking && ambient ? `M5-156Q13 ${-151 + Math.sin(time * 12) * 1.5} 21-158` : 'M5-156Q13-151 21-158');
      if (!isElder) {
        drag.setAttribute('transform', `translate(${point(near.wrist)})`);
        drag.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
        drag.setAttribute('aria-valuetext', `前伸 ${Math.round(progress * 100)}%`);
      }
    }
    caption.style.display = frame.phase === 'ready' && activePointer === null && frame.trainee < .12 ? '' : 'none';
    if (lastSpeech !== frame.speech || lastSpeaker !== frame.speaker) {
      lastSpeech = frame.speech;
      lastSpeaker = frame.speaker;
      feedback.hidden = !frame.speech;
      feedbackText.textContent = frame.speech;
      feedbackName.textContent = frame.speaker === 'elder' ? '周阿姨' : frame.speaker === 'trainee' ? '你' : '';
      feedbackName.hidden = !frame.speaker;
      feedback.dataset.speaker = frame.speaker || '';
    }
  }

  function update(next = {}) {
    if (destroyed) return;
    frame = {
      trainee: clamp(next.trainee), elder: clamp(next.elder), compensation: clamp(next.compensation), tremor: clamp(next.tremor),
      phase: ['ready', 'reach', 'hold', 'return', 'rest'].includes(next.phase) ? next.phase : 'ready',
      speech: typeof next.speech === 'string' ? next.speech : '',
      speaker: ['elder', 'trainee'].includes(next.speaker) ? next.speaker : null,
      showGuides: Boolean(next.showGuides), showTrails: Boolean(next.showTrails), selected: Boolean(next.selected),
    };
    render(performance.now());
  }

  function emit(type, value) {
    root.dispatchEvent(new CustomEvent(type, { bubbles: true, detail: { value: clamp(value) } }));
  }

  function pointerValue(event) {
    // Invert the actual SVG screen matrix, including viewBox letterboxing and body breathing.
    const matrix = people.trainee.body.getScreenCTM();
    if (!matrix) return null;
    let local;
    try {
      const p = svg.createSVGPoint();
      p.x = event.clientX;
      p.y = event.clientY;
      local = p.matrixTransform(matrix.inverse());
    } catch {
      return null;
    }
    // Project onto the curved wrist trajectory, rather than assuming horizontal movement.
    let best = 0;
    let distance = Infinity;
    for (let i = 0; i <= 160; i++) {
      const p = armPose(i / 160).wrist;
      const d = (local.x - p.x) ** 2 + (local.y - p.y) ** 2;
      if (d < distance) { distance = d; best = i / 160; }
    }
    return best;
  }

  function onDown(event) {
    if (!interactive) return;
    if (activePointer !== null || (event.button !== undefined && event.button !== 0)) return;
    const value = pointerValue(event);
    if (value === null) return;
    event.preventDefault();
    drag.focus({ preventScroll: true });
    activePointer = event.pointerId;
    dragValue = value;
    drag.setPointerCapture(event.pointerId);
    render(performance.now());
    emit('wristinput', dragValue);
  }

  function onMove(event) {
    if (event.pointerId !== activePointer) return;
    const value = pointerValue(event);
    if (value === null) return;
    event.preventDefault();
    dragValue = value;
    render(performance.now());
    emit('wristinput', dragValue);
  }

  function finish(event, completed) {
    if (activePointer === null || event.pointerId !== activePointer) return;
    if (completed) {
      const value = pointerValue(event);
      if (value !== null) dragValue = value;
    }
    const pointer = activePointer;
    activePointer = null;
    frame.trainee = dragValue;
    if (drag.hasPointerCapture(pointer)) drag.releasePointerCapture(pointer);
    render(performance.now());
    emit('wristinput', dragValue);
    if (completed) emit('wristend', dragValue);
  }
  const onUp = event => finish(event, true);
  const onCancel = event => finish(event, false);

  function onKey(event) {
    if (!interactive) return;
    if (activePointer !== null) return;
    const delta = { ArrowRight: .025, ArrowUp: .025, ArrowLeft: -.025, ArrowDown: -.025 }[event.key];
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    frame.trainee = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : clamp(frame.trainee + delta);
    render(performance.now());
    emit('wristinput', frame.trainee);
  }
  function onKeyUp(event) {
    if (!interactive) return;
    if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      emit('wristend', frame.trainee);
    }
  }
  const listeners = { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onCancel, lostpointercapture: onCancel, keydown: onKey, keyup: onKeyUp };
  for (const [type, listener] of Object.entries(listeners)) drag.addEventListener(type, listener);
  render(startedAt);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const [type, listener] of Object.entries(listeners)) drag.removeEventListener(type, listener);
    if (activePointer !== null && drag.hasPointerCapture(activePointer)) drag.releasePointerCapture(activePointer);
    activePointer = null;
    for (const person of Object.values(people)) person.history.length = 0;
    root.remove();
  }
  function cancelInteraction() {
    const pointer = activePointer;
    activePointer = null;
    dragValue = 0;
    frame.trainee = 0;
    if (pointer !== null && drag.hasPointerCapture(pointer)) drag.releasePointerCapture(pointer);
    render(performance.now());
  }
  function setInteractive(value) {
    interactive = Boolean(value);
    drag.setAttribute('aria-disabled', String(!interactive));
    drag.setAttribute('tabindex', interactive ? '0' : '-1');
    if (!interactive) cancelInteraction();
  }
  return { update, destroy, cancelInteraction, setInteractive };
}
