/** Guided shared-lounge illustration. Load tour-scene.css alongside this module.
 * No timers, event handlers or animation loop: the host owns the playback clock.
 */
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 1800;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const smooth = t => t * t * (3 - 2 * t);
const point = p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
const between = (a, b, t) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const DEFAULT_VIEW = Object.freeze({ senior: 'tan', mood: 'neutral', bowl: 'near',
  worker: 'near', gaze: 'tv', tv: true, gesture: 'none' });
const VALUES = {
  senior: ['tan', 'lim'], mood: ['neutral', 'resistant', 'settled'],
  bowl: ['near', 'away'], worker: ['near', 'back'], gaze: ['tv', 'worker', 'bowl'],
  gesture: ['none', 'push-bowl', 'open-palm', 'setup', 'withdraw', 'listen'],
};
let serial = 0;

// Exact two-link IK, including a reachable wrist. Bone lengths never stretch.
function armIK(shoulder, requested, upper, lower, bend) {
  const dx = requested.x - shoulder.x, dy = requested.y - shoulder.y;
  const length = Math.hypot(dx, dy);
  const distance = clamp(length, Math.abs(upper - lower) + .01, upper + lower - .01);
  const ux = length > .001 ? dx / length : 1, uy = length > .001 ? dy / length : 0;
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { shoulder,
    elbow: { x: shoulder.x + ux * along - bend * uy * height,
      y: shoulder.y + uy * along + bend * ux * height },
    wrist: { x: shoulder.x + ux * distance, y: shoulder.y + uy * distance } };
}

// Tapered, rounded volumes instead of stroked stick limbs.
function limb(a, b, ra, rb) {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const q = (p, r) => point({ x: p.x - u.y * r, y: p.y + u.x * r });
  return `M${q(a, ra)}L${q(b, rb)}Q${point({ x: b.x + u.x * rb, y: b.y + u.y * rb })} ${q(b, -rb)}L${q(a, -ra)}Q${point({ x: a.x - u.x * ra, y: a.y - u.y * ra })} ${q(a, ra)}Z`;
}

function hand(name, id, senior = false) {
  return `<g data-part="${name}-hand" class="tour-scene__hand">
    <path d="M-4-7C3-10 10-10 16-7L28-5Q33-4 31-1L19 0L32 1Q36 3 32 5L19 5L29 7Q32 10 28 11L16 9L23 12Q25 15 21 15L9 11Q3 9-4 7Z" fill="url(#${id}-${senior ? 'elder' : 'skin'})"/>
    <path d="M1-6Q5-17 9-17Q13-16 10-10L9-4" fill="url(#${id}-${senior ? 'elder' : 'skin'})"/>
    <path d="M11-4L19-3M12 2L21 3M12 6L20 8M2-2Q6 1 6 5" class="tour-scene__skin-line"/>
    ${senior ? '<path d="M0 4L5 6M11-6L15-5" class="tour-scene__skin-line"/>' : ''}
  </g>`;
}

function arm(name, id, senior = false) {
  return `<g data-part="${name}" class="tour-scene__arm">
    <path data-part="${name}-upper" fill="url(#${id}-${senior ? 'elder' : 'skin'})"/>
    <path data-part="${name}-lower" fill="url(#${id}-${senior ? 'elder' : 'skin'})"/>
    <path data-part="${name}-sleeve" fill="url(#${id}-${senior ? 'cardigan' : 'scrubs'})"/>
    <path data-part="${name}-cuff" fill="none" stroke="${senior ? '#788f88' : '#32675d'}" stroke-width="2"/>
    ${hand(name, id, senior)}
  </g>`;
}

function definitions(id) {
  return `<defs>
    <linearGradient id="${id}-wall" x2="0" y2="1"><stop stop-color="#faf7ee"/><stop offset="1" stop-color="#e6ecdf"/></linearGradient>
    <linearGradient id="${id}-glass" x2=".8" y2="1"><stop stop-color="#bfd9d0"/><stop offset="1" stop-color="#f5f4d9"/></linearGradient>
    <linearGradient id="${id}-floor" x2="0" y2="1"><stop stop-color="#e7deca"/><stop offset="1" stop-color="#f2eadd"/></linearGradient>
    <linearGradient id="${id}-wood" x2=".3" y2="1"><stop stop-color="#e8d3af"/><stop offset="1" stop-color="#bd9e78"/></linearGradient>
    <linearGradient id="${id}-scrubs" x1="0" x2="1"><stop stop-color="#37766a"/><stop offset=".5" stop-color="#609887"/><stop offset="1" stop-color="#40796c"/></linearGradient>
    <linearGradient id="${id}-cardigan" x1="0" x2="1"><stop data-part="cloth-start" stop-color="#8b9f8a"/><stop data-part="cloth-middle" offset=".5" stop-color="#b4c0a3"/><stop data-part="cloth-end" offset="1" stop-color="#8d9f88"/></linearGradient>
    <linearGradient id="${id}-skin" x2=".8" y2="1"><stop stop-color="#f4d4b7"/><stop offset=".6" stop-color="#e7b895"/><stop offset="1" stop-color="#cf997d"/></linearGradient>
    <linearGradient id="${id}-elder" x2=".8" y2="1"><stop stop-color="#efd3b7"/><stop offset=".6" stop-color="#e1b89c"/><stop offset="1" stop-color="#c99c82"/></linearGradient>
    <linearGradient id="${id}-hair" x2=".6" y2="1"><stop stop-color="#e6e5da"/><stop offset=".5" stop-color="#bbc1b9"/><stop offset="1" stop-color="#8d9892"/></linearGradient>
    <linearGradient id="${id}-chair" x2="1" y2=".4"><stop stop-color="#6f8980"/><stop offset=".55" stop-color="#97aca0"/><stop offset="1" stop-color="#6b877d"/></linearGradient>
    <linearGradient id="${id}-bowl" x2="0" y2="1"><stop stop-color="#fffcf1"/><stop offset=".6" stop-color="#e3e8d8"/><stop offset="1" stop-color="#a6bdb0"/></linearGradient>
    <linearGradient id="${id}-metal" x2="0" y2="1"><stop stop-color="#6e8786"/><stop offset=".4" stop-color="#f6fcf6"/><stop offset=".7" stop-color="#bed0c9"/><stop offset="1" stop-color="#758f8d"/></linearGradient>
    <clipPath id="${id}-window"><rect x="73" y="61" width="216" height="258" rx="5"/></clipPath>
    <clipPath id="${id}-screen"><rect x="756" y="48" width="306" height="145" rx="7"/></clipPath>
  </defs>`;
}

function room(id) {
  return `<g aria-hidden="true">
    <rect width="1100" height="640" fill="url(#${id}-wall)"/>
    <path d="M0 21H1100" stroke="#fffdf6" stroke-width="10"/>
    <path d="M0 448H1100V640H0Z" fill="url(#${id}-floor)"/>
    <path d="M0 444H1100" stroke="#c8d1bd" stroke-width="8"/>
    <path d="M76 450L9 640H422L272 450Z" fill="#fff9e4" opacity=".55"/>
    <path d="M0 531H1100M0 615H1100M202 451L142 640M505 451L526 640M897 451L1018 640" fill="none" stroke="#c3b59b" stroke-width="1" opacity=".3"/>
    <rect x="63" y="51" width="236" height="278" rx="8" fill="#c7cdbb"/>
    <g clip-path="url(#${id}-window)"><rect x="73" y="61" width="216" height="258" fill="url(#${id}-glass)"/>
      <circle cx="244" cy="109" r="32" fill="#fcf6d6" opacity=".8"/>
      <path d="M65 258Q130 202 196 239T307 213V335H65Z" fill="#a9bea0"/>
      <path d="M59 288Q135 246 209 272T311 257V335H59Z" fill="#8eae92" opacity=".65"/>
      <path d="M181 59V323M70 187H296" stroke="#fffbed" stroke-width="8"/>
    </g>
    <path d="M49 48Q71 168 45 300V338H28V48ZM305 48Q285 160 308 289V338H327V48Z" fill="#ece9d9"/>
    <path d="M40 55Q58 163 38 320M315 55Q300 178 317 322" fill="none" stroke="#d6dac7" stroke-width="3"/>
    <rect x="60" y="326" width="242" height="10" rx="4" fill="#d4c7ad"/>
    <g transform="translate(463 89)"><rect width="108" height="126" rx="4" fill="#c1b49a"/><rect x="7" y="7" width="94" height="112" fill="#fcf9ed"/>
      <path d="M53 99Q44 70 56 26M50 75Q22 76 28 53Q49 51 50 75M52 59Q78 58 79 35Q56 37 52 59M48 92Q74 97 81 75Q60 70 48 92" fill="#a6b89b"/>
      <path d="M53 99Q44 70 56 26" fill="none" stroke="#6e927b" stroke-width="2"/>
    </g>
    <ellipse cx="598" cy="543" rx="325" ry="64" fill="#c5cbb6" opacity=".38"/>
    <ellipse cx="598" cy="543" rx="300" ry="51" fill="none" stroke="#f1efde" stroke-width="3"/>
    <g transform="translate(115 454)"><ellipse cy="19" rx="41" ry="10" fill="#a4ab91" opacity=".25"/>
      <path d="M-29-30H29L23 17Q0 29-23 17Z" fill="url(#${id}-wood)"/>
      <path d="M0-30Q14-86-4-155M3-77L-29-111M6-89L36-127" fill="none" stroke="#688567" stroke-width="4"/>
      <path d="M-3-141Q-39-145-26-175Q3-167-3-141M-22-106Q-55-103-52-135Q-25-138-22-106M8-100Q2-137 38-146Q45-118 8-100M5-58Q24-91 52-75Q43-48 5-58M0-68Q-33-61-36-94Q-8-99 0-68" fill="#799c78"/>
      <path d="M-2-142L-19-164M10-103L31-137M8-61L42-72" stroke="#9fba8e" stroke-width="2"/>
    </g>
    <g transform="translate(926 379)"><rect x="-39" y="-143" width="149" height="205" rx="8" fill="#cdbb9e"/>
      <rect x="-44" y="-150" width="159" height="12" rx="4" fill="#e5d5b9"/>
      <path d="M-28-126H96V-46H-28ZM-28-33H96V47H-28Z" fill="#dac8aa" stroke="#bdaa8c"/>
      <path d="M25-88H43M25 4H43" stroke="#7b8b7b" stroke-width="4" stroke-linecap="round"/>
      <path d="M-27 62L-31 74M97 62L101 74" stroke="#a58c6e" stroke-width="8"/>
      <rect x="59" y="-161" width="41" height="10" rx="2" fill="#78968b"/>
      <rect x="64" y="-169" width="33" height="8" rx="2" fill="#e9e5d1"/>
    </g>
    <rect x="745" y="37" width="328" height="168" rx="13" fill="#364e49"/>
    <rect x="756" y="48" width="306" height="145" rx="7" fill="#253d37"/>
    <g data-part="programme" clip-path="url(#${id}-screen)">
      <rect x="756" y="48" width="306" height="145" fill="#dce5d1"/>
      <path d="M766 59H842V106H766ZM850 59H926V106H850ZM975 59H1052V106H975Z" fill="#a7baa1"/>
      <path d="M773 65H835M856 65H918M982 65H1045" stroke="#cbd7bd" stroke-width="3"/>
      <path d="M942 56V79L929 93H968L955 79V56" fill="#7b9787"/>
      <path d="M765 116H1055V143H765Z" fill="#c7ab80"/>
      <path d="M765 115H1055" stroke="#f6edd7" stroke-width="5"/>
      <path d="M833 110Q847 119 861 110L858 100H837Z" fill="#648a79"/>
      <path d="M833 103H825M861 103H869" stroke="#648a79" stroke-width="3"/>
      <path d="M842 95Q839 88 844 82M852 95Q849 88 854 82" fill="none" stroke="#f9f7e9" stroke-width="2"/>
      <ellipse cx="983" cy="113" rx="24" ry="5" fill="#efe4bf"/>
      <path d="M970 110Q974 97 983 107Q990 92 999 109" fill="#6d9868"/>
      <rect x="786" y="91" width="12" height="20" rx="3" fill="#dbaa6c"/>
      <path d="M802 111V82M797 82H807" stroke="#779687" stroke-width="3"/>
      <rect x="756" y="145" width="306" height="48" fill="#314c43"/>
      <text data-part="programme-label" x="909" y="180" text-anchor="middle" textLength="286" lengthAdjust="spacingAndGlyphs" class="tour-scene__caption">Cooking programme</text>
    </g>
    <circle cx="909" cy="199" r="2" fill="#a8ba9c"/>
  </g>`;
}

function worker(id) {
  return `<g data-part="worker-base" aria-hidden="true">
    <ellipse cx="343" cy="583" rx="99" ry="14" fill="#53685b" opacity=".12"/>
    <path d="M303 444L287 571M376 444L396 571M296 516H388" fill="none" stroke="#a68b69" stroke-width="10" stroke-linecap="round"/>
    <rect x="284" y="427" width="113" height="25" rx="12" fill="#a8bca6" stroke="#879e89" stroke-width="2"/>
    <path d="M320 423Q317 447 327 465L352 489L350 559Q361 572 380 563L382 485Q381 467 361 443L354 424Z" fill="#385f58"/>
    <path d="M348 425Q351 445 373 456L408 472L395 563Q407 573 424 565L441 473Q444 455 425 446L391 424Z" fill="#476e64"/>
    <path d="M365 475L365 543M427 476L412 549" fill="none" stroke="#284f49" stroke-width="3" opacity=".55"/>
    <path d="M351 553Q365 561 380 553L385 568Q408 571 407 582Q388 591 349 581Z" fill="#e8e9db" stroke="#a3b3a5" stroke-width="2"/>
    <path d="M396 555Q411 563 425 556L432 570Q457 571 457 582Q430 593 393 582Z" fill="#f1f0e3" stroke="#a3b3a5" stroke-width="2"/>
    <path d="M353 579H401M398 580H451" stroke="#c0c9bb" stroke-width="3"/>
    <g data-part="worker-torso">
      <path d="M333 294Q311 302 310 331L307 426Q347 444 397 429L405 336Q408 306 371 294Z" fill="url(#${id}-scrubs)" stroke="#3e776a" stroke-width="1.5"/>
      <path d="M338 277L336 303L351 321L369 300L366 275Z" fill="url(#${id}-skin)"/>
      <path d="M329 301L348 323L333 337L322 307M375 301L351 323L366 335L386 309" fill="#79aa95" stroke="#447d6d" stroke-width="1.5"/>
      <path d="M351 324V418M318 407Q328 414 339 411M376 370H394L392 391Q383 395 375 390Z" fill="none" stroke="#32675d" stroke-width="2" opacity=".65"/>
      <rect x="319" y="350" width="20" height="12" rx="3" fill="#e4edda"/>
      <path d="M324 355H334M325 359H332" stroke="#80a291" stroke-width="2"/>
      <path d="M363 411Q378 417 391 412" fill="none" stroke="#8bb49b" stroke-width="2"/>
    </g>
    <g data-part="worker-head">
      <path d="M317 217Q303 209 304 229Q303 242 317 246" fill="#343c35"/>
      <path d="M322 273Q308 258 312 226Q312 192 346 187Q380 183 389 217L382 251Z" fill="#343e36"/>
      <ellipse cx="320" cy="246" rx="8" ry="12" fill="url(#${id}-skin)"/>
      <path d="M322 217Q350 203 375 216L381 239Q388 247 382 251L378 255Q378 278 355 286Q330 283 324 264Z" fill="url(#${id}-skin)"/>
      <path d="M317 234Q313 199 344 195Q373 188 384 220Q364 219 352 207Q340 228 322 232L324 251L319 245Z" fill="#3b443b"/>
      <path d="M325 210Q337 198 354 200M360 202Q375 207 377 215" fill="none" stroke="#596052" stroke-width="2"/>
      <path d="M341 238Q347 234 353 237M363 237Q369 233 375 237" fill="none" stroke="#59604d" stroke-width="2.2" stroke-linecap="round"/>
      <g data-part="worker-eyes"><ellipse cx="347" cy="245" rx="6" ry="3.5" fill="#fff8e8"/><ellipse cx="369" cy="244" rx="5.5" ry="3.4" fill="#fff8e8"/>
        <circle cx="350" cy="245" r="2.8" fill="#384b3d"/><circle cx="371" cy="244" r="2.7" fill="#384b3d"/>
        <path d="M341 244Q347 240 353 244M364 243Q369 240 375 243" class="tour-scene__face-line"/>
      </g>
      <path d="M359 245L358 256Q362 259 366 256M351 268Q360 272 369 266" class="tour-scene__face-line"/>
      <path d="M317 241Q323 239 322 249" class="tour-scene__skin-line"/>
      <ellipse cx="340" cy="260" rx="6" ry="3" fill="#d79780" opacity=".25"/>
    </g>
  </g>`;
}

function senior(id) {
  return `<g aria-hidden="true">
    <ellipse cx="767" cy="575" rx="104" ry="18" fill="#53685b" opacity=".14"/>
    <path d="M708 435L693 568M824 435L840 568" stroke="#997d5f" stroke-width="12" stroke-linecap="round"/>
    <path d="M704 265Q702 242 723 242H805Q827 242 831 267L841 432H712Z" fill="url(#${id}-wood)" stroke="#a58e6c" stroke-width="2"/>
    <path d="M716 271Q714 253 733 253H794Q813 253 815 272L826 423H723Z" fill="url(#${id}-chair)"/>
    <path d="M726 274Q765 263 805 275M728 284L735 408" fill="none" stroke="#b6c5b3" stroke-width="2" opacity=".6"/>
    <rect x="705" y="420" width="136" height="35" rx="17" fill="#829b8c" stroke="#6f8b7b" stroke-width="2"/>
    <path d="M737 421Q714 437 715 466L711 544Q724 555 742 547L750 472L776 438Z" fill="#7c8173"/>
    <path d="M768 426Q751 445 753 471L763 550Q779 558 793 546L786 473Q811 449 798 425Z" fill="#8e9180"/>
    <path d="M731 468L726 528M768 470L777 534" fill="none" stroke="#636e62" stroke-width="2.5"/>
    <path d="M711 538L742 542L742 558Q726 572 697 567Q687 564 696 553Z" fill="#6f7a6b" stroke="#536357" stroke-width="2"/>
    <path d="M764 542Q780 549 792 541L797 555Q819 560 812 570Q787 576 759 563Z" fill="#74806f" stroke="#536357" stroke-width="2"/>
    <path d="M697 563Q718 567 739 555M763 560Q788 570 809 566" fill="none" stroke="#a8ad98" stroke-width="2"/>
    <g data-part="senior-torso">
      <path d="M731 304Q709 315 715 350L721 427Q759 444 811 427L807 339Q806 311 782 304Z" fill="url(#${id}-cardigan)" stroke="#81947f" stroke-width="1.5"/>
      <path d="M746 282L742 311Q756 326 774 309L770 282Z" fill="url(#${id}-elder)"/>
      <path d="M741 309Q754 327 777 309L780 337H744Z" fill="#f1ecda"/>
      <path d="M738 310L753 332L748 429M782 309L765 332L771 432" fill="none" stroke="#718975" stroke-width="2.5"/>
      <path d="M730 382L728 407Q739 413 746 408M784 382L787 408Q795 411 801 406" fill="none" stroke="#7e927d" stroke-width="2"/>
      <g fill="#dce1ca"><circle cx="760" cy="350" r="2.5"/><circle cx="761" cy="373" r="2.5"/><circle cx="762" cy="396" r="2.5"/></g>
      <path d="M726 419Q738 425 745 422M777 425L802 421" stroke="#cad1b6" stroke-width="2" fill="none"/>
    </g>
    <path d="M700 364L707 443M839 365L837 443" stroke="#aa8f6c" stroke-width="10" stroke-linecap="round"/>
    <path d="M694 363L724 369M812 367L846 363" stroke="url(#${id}-wood)" stroke-width="17" stroke-linecap="round"/>
    <path d="M694 360L724 366M814 364L845 360" stroke="#eddbb9" stroke-width="3" stroke-linecap="round"/>
    <g data-part="senior-head">
      <path data-part="tan-hair-back" d="M723 249Q707 221 721 204Q714 191 734 184Q753 172 773 185Q795 190 795 218L788 266L771 278L729 266Z" fill="url(#${id}-hair)"/>
      <path data-part="lim-hair-back" d="M718 235Q713 209 728 192Q749 180 774 190Q795 199 793 235L781 256H731Z" fill="url(#${id}-hair)"/>
      <ellipse cx="722" cy="247" rx="8" ry="13" fill="url(#${id}-elder)"/>
      <ellipse cx="787" cy="247" rx="7" ry="12" fill="url(#${id}-elder)"/>
      <path d="M725 216Q754 200 782 216L783 252Q781 283 759 292Q735 286 728 267Z" fill="url(#${id}-elder)"/>
      <g data-part="tan-hair-front"><path d="M719 236Q712 213 728 196Q744 180 770 193Q791 198 790 231L782 240L778 218Q763 219 751 208Q741 224 725 226L725 244Z" fill="url(#${id}-hair)"/>
        <path d="M723 215Q727 197 744 195M733 211Q741 195 753 198M758 198Q777 198 783 216M758 207Q768 215 777 214" fill="none" stroke="#eff0e4" stroke-width="2.5"/>
      </g>
      <g data-part="lim-hair-front"><path d="M718 234L721 207Q730 190 756 190Q781 190 788 210L789 234L783 242L780 216Q756 205 729 216L726 241Z" fill="url(#${id}-hair)"/>
        <path d="M727 205L735 198M739 204L747 197M751 203L759 197M764 204L771 200M775 208L780 205" stroke="#e3e7de" stroke-width="2" stroke-linecap="round"/>
      </g>
      <path d="M741 226Q754 223 767 225M742 230Q754 227 766 230" class="tour-scene__age-line"/>
      <path data-part="senior-brow-left" class="tour-scene__brow"/>
      <path data-part="senior-brow-right" class="tour-scene__brow"/>
      <g data-part="senior-eyes"><path d="M735 246Q741 241 748 246Q742 251 735 246M760 246Q767 241 774 246Q767 251 760 246" fill="#faf3df"/>
        <g data-part="senior-pupils"><circle cx="742" cy="246" r="3" fill="#485548"/><circle cx="767" cy="246" r="3" fill="#485548"/>
          <circle cx="743" cy="245" r=".9" fill="#fffbed"/><circle cx="768" cy="245" r=".9" fill="#fffbed"/></g>
        <path d="M735 246Q741 241 748 246M760 246Q767 241 774 246" class="tour-scene__face-line"/>
      </g>
      <path d="M751 246L748 259Q753 262 758 259" class="tour-scene__face-line"/>
      <path d="M734 253Q740 257 747 254M762 254Q768 257 775 252M733 261Q734 269 741 271M769 263L767 268M750 283Q758 285 764 281" class="tour-scene__age-line"/>
      <path data-part="senior-mouth" class="tour-scene__mouth"/>
      <path d="M719 244Q724 242 724 251M787 242L786 250" class="tour-scene__skin-line"/>
      <ellipse cx="736" cy="262" rx="6" ry="3" fill="#ca927b" opacity=".19"/>
    </g>
  </g>`;
}

function table(id) {
  return `<g aria-hidden="true">
    <ellipse cx="566" cy="556" rx="135" ry="13" fill="#8c947a" opacity=".13"/>
    <path d="M464 423L453 547M676 423L690 547" stroke="#b1936d" stroke-width="14" stroke-linecap="round"/>
    <path d="M466 466H678" stroke="#c5ab82" stroke-width="8"/>
    <path d="M428 409Q428 395 449 395H680Q704 395 704 409V423Q704 433 682 434H450Q428 433 428 423Z" fill="url(#${id}-wood)" stroke="#bda07b" stroke-width="1.5"/>
    <path d="M428 407Q428 389 451 387H680Q704 389 704 407Q704 420 680 422H451Q428 420 428 407Z" fill="#eddec0"/>
    <path d="M450 396H681M447 413Q554 418 682 412" fill="none" stroke="#f8eed6" stroke-width="2" opacity=".85"/>
    <path d="M469 394L669 393L682 414L479 416Z" fill="#d2dcc2" opacity=".82"/>
    <path d="M479 397H659M482 401H663M485 405H668M488 409H671" stroke="#f1f1dc" stroke-width="1" opacity=".6"/>
    <g transform="translate(664 375)"><ellipse cy="12" rx="17" ry="5" fill="#a2b19b" opacity=".24"/>
      <path d="M-13-19H13L11 10Q0 16-11 10Z" fill="#e7f0df" stroke="#9aafa0" stroke-width="1.5"/>
      <path d="M-10-1H10L8 8Q0 12-8 8Z" fill="#c2d8cd"/>
      <ellipse cy="-19" rx="13" ry="4" fill="#f9f8e9" stroke="#afc1b0" stroke-width="1.5"/>
      <path d="M-7-13V4" stroke="#fffdf1" stroke-width="2"/>
    </g>
    <g data-part="bowl">
      <ellipse cy="23" rx="46" ry="8" fill="#779784" opacity=".16"/>
      <path d="M-44 0Q-40 27-16 30H16Q40 27 44 0Z" fill="url(#${id}-bowl)" stroke="#9ab2a0" stroke-width="1.5"/>
      <ellipse rx="44" ry="13" fill="#fffbee" stroke="#bac9b0" stroke-width="1.5"/>
      <ellipse cy="1" rx="36" ry="9" fill="#d6b46e"/>
      <path d="M-28 0Q-19-10-12-3Q-7-12 1-3Q10-11 17-2Q25-6 30 3Q7 9-28 0Z" fill="#f3e4b6"/>
      <g fill="#759568"><ellipse cx="-20" cy="2" rx="6" ry="2.5" transform="rotate(18 -20 2)"/><ellipse cx="15" cy="0" rx="7" ry="3"/><ellipse cx="5" cy="4" rx="5" ry="2"/></g>
      <g fill="#d69557"><rect x="-9" y="-4" width="7" height="4" rx="1"/><rect x="22" y="1" width="5" height="3" rx="1"/></g>
      <path d="M-31 15Q-21 25-8 25" fill="none" stroke="#fffdf1" stroke-width="3" stroke-linecap="round"/>
    </g>
  </g>`;
}

function sceneMarkup(id) {
  return `${definitions(id)}<title id="${id}-title" data-part="title"></title>
    <desc id="${id}-description" data-part="description"></desc>
    ${room(id)}${worker(id)}${senior(id)}${table(id)}
    <g aria-hidden="true">${arm('worker-rest', id)}${arm('senior-rest', id, true)}
      ${arm('senior-active', id, true)}${arm('worker-active', id)}
      <g data-part="spoon">
        <ellipse cx="1" cy="4" rx="36" ry="4" fill="#6e8d79" opacity=".15"/>
        <path d="M-30-2Q-36-1-32 2L16 1L16-2Z" fill="url(#${id}-metal)" stroke="#809b92" stroke-width="1"/>
        <ellipse cx="23" cy="-1" rx="13" ry="5" fill="url(#${id}-metal)" stroke="#809b92" stroke-width="1"/>
        <path d="M16-2Q24-5 31-1" fill="none" stroke="#f9fff3" stroke-width="1.3"/>
      </g>
    </g>`;
}

function normalize(view, previous) {
  const next = { ...previous };
  for (const [key, values] of Object.entries(VALUES)) {
    if (values.includes(view?.[key])) next[key] = view[key];
  }
  if (typeof view?.tv === 'boolean') next.tv = view.tv;
  return next;
}

function pose(view, spoon = 0) {
  return { lim: +(view.senior === 'lim'), resistant: +(view.mood === 'resistant'),
    settled: +(view.mood === 'settled'), away: +(view.bowl === 'away'),
    back: +(view.worker === 'back'), gaze: view.gaze === 'tv' ? 1 : view.gaze === 'worker' ? -1 : -.45,
    down: +(view.gaze === 'bowl'), tv: +view.tv,
    push: +(view.gesture === 'push-bowl'), open: +(view.gesture === 'open-palm'),
    setup: +(view.gesture === 'setup'), withdraw: +(view.gesture === 'withdraw'),
    listen: +(view.gesture === 'listen'), spoon };
}

function color(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(mix(v, b[i], t))).join(',')})`;
}

/**
 * @param {Element} container Host element; its existing children are preserved.
 * @returns {{setView: Function, tick: Function, setLocale: Function, destroy: Function}}
 * setView accepts a full view (partial updates are also supported).
 * options.immediate snaps; options.reducedMotion persists until explicitly changed.
 * The first setView always snaps. Other transitions take 1800ms of supplied ticks.
 * Setup leaves the spoon in reach through subsequent listening/idle views. An
 * immediate view, a different senior, or refusal resets this prop for replay.
 */
export function mountTourScene(container) {
  if (!container?.appendChild || !container.ownerDocument) {
    throw new TypeError('mountTourScene requires a DOM container.');
  }
  const id = `tour-lounge-${++serial}`;
  const svg = container.ownerDocument.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'tour-scene');
  svg.setAttribute('viewBox', '0 0 1100 640');
  svg.setAttribute('width', '1100');
  svg.setAttribute('height', '640');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-labelledby', `${id}-title`);
  svg.setAttribute('aria-describedby', `${id}-description`);
  // Build once. Subsequent frames mutate attributes on cached nodes only.
  svg.innerHTML = sceneMarkup(id);
  container.appendChild(svg);
  const parts = Object.fromEntries([...svg.querySelectorAll('[data-part]')]
    .map(node => [node.getAttribute('data-part'), node]));
  let view = { ...DEFAULT_VIEW }, frame = pose(view), start = { ...frame }, target = { ...frame };
  let elapsed = DURATION, clock = 0, initialized = false, reducedMotion = false, destroyed = false;
  let locale = 'en';
  const attr = (name, key, value) => parts[name].setAttribute(key, String(value));

  function accessibility() {
    const name = view.senior === 'lim' ? 'Mr Lim' : 'Ms Tan';
    const zhName = view.senior === 'lim' ? '林先生' : '陈女士';
    const en = `Shared lounge · Hui Lin and ${name}`;
    const zh = `共享客厅 · 慧琳与${zhName}`;
    const moodEn = { neutral: 'calm', resistant: 'frowning with mouth closed', settled: 'relaxed with mouth closed' }[view.mood];
    const moodZh = { neutral: '平静', resistant: '皱眉、闭口拒食', settled: '眉头放松、嘴巴闭合' }[view.mood];
    const gestureEn = { none: 'Both have space to choose what happens next.',
      'push-bowl': 'The senior pushes the bowl left, away from their body.',
      'open-palm': 'Hui Lin asks with an open palm at eye level.',
      setup: 'Hui Lin arranges the spoon on the table within reach for independent eating.',
      withdraw: 'Hui Lin withdraws her hand and gives space.',
      listen: 'Hui Lin sits at eye level and listens.' }[view.gesture];
    const gestureZh = { none: '留出自主选择的空间。', 'push-bowl': '长者将碗向左推离自己。',
      'open-palm': '慧琳平视长者，摊开手掌询问。', setup: '慧琳只把桌上的餐勺摆到可及处，支持自主进食。',
      withdraw: '慧琳收回手，留出空间。', listen: '慧琳坐在旁边平视倾听。' }[view.gesture];
    const enDesc = `A warm, window-lit shared lounge. Young care worker Hui Lin wears green and sits on a stool to the left. ${name} sits upright in an armchair to the right, ${moodEn}. A low table holds lunch and a separate spoon. ${gestureEn} The bowl is ${view.bowl === 'near' ? 'near the senior' : 'away, towards the centre'}. Hui Lin sits ${view.worker === 'back' ? 'further back' : 'nearby'}. The senior looks towards ${view.gaze === 'tv' ? 'the television' : view.gaze === 'worker' ? 'Hui Lin' : 'the bowl'}. ${view.tv ? 'The television shows an abstract cooking programme.' : 'The television is off.'} Fixed camera; no assisted feeding or spoon entering a mouth.`;
    const zhDesc = `温暖、窗边有植物的共享客厅。年轻女护工慧琳穿绿制服坐在左侧凳子上，${zhName}坐在右侧有靠背与扶手的椅子上，${moodZh}。中间的低餐桌摆着午餐和旁置的勺子。${gestureZh}碗${view.bowl === 'near' ? '靠近长者' : '已向左移到桌子中央'}，慧琳${view.worker === 'back' ? '稍向后退坐' : '坐在旁边'}。长者看向${view.gaze === 'tv' ? '电视' : view.gaze === 'worker' ? '慧琳' : '食物碗'}。${view.tv ? '电视播放抽象厨房烹饪节目。' : '电视已关闭。'}固定镜头，不喂食、不将勺子送入口中。`;
    parts.title.textContent = locale === 'zh' ? `${zh} / ${en}` : `${en} / ${zh}`;
    parts.description.textContent = locale === 'zh' ? `${zhDesc}\n${enDesc}` : `${enDesc}\n${zhDesc}`;
    parts['programme-label'].textContent = locale === 'zh' ? '烹饪节目' : 'Cooking programme';
    if (locale === 'zh') parts['programme-label'].removeAttribute('textLength');
    else attr('programme-label', 'textLength', 286);
    svg.setAttribute('lang', locale === 'zh' ? 'zh-Hans' : 'en');
  }

  function drawArm(name, shoulder, wrist, lengths, bend, handAngle, elder = false, relaxed = 0) {
    const rig = armIK(shoulder, wrist, ...lengths, bend);
    if (relaxed > 0) {
      // Blend joint angles, not elbow positions, when turning a palm upwards.
      // Both bones retain their length throughout the change of elbow branch.
      const other = armIK(shoulder, wrist, ...lengths, -bend);
      const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
      const blend = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * relaxed;
      const upper = blend(angle(shoulder, rig.elbow), angle(shoulder, other.elbow));
      const lower = blend(angle(rig.elbow, rig.wrist), angle(other.elbow, other.wrist));
      rig.elbow = { x: shoulder.x + Math.cos(upper) * lengths[0], y: shoulder.y + Math.sin(upper) * lengths[0] };
      rig.wrist = { x: rig.elbow.x + Math.cos(lower) * lengths[1], y: rig.elbow.y + Math.sin(lower) * lengths[1] };
    }
    const { elbow, wrist: actual } = rig;
    attr(name, 'data-wrist', point(actual));
    attr(name, 'data-elbow', point(elbow));
    attr(`${name}-upper`, 'd', limb(shoulder, elbow, elder ? 15 : 17, 11));
    attr(`${name}-lower`, 'd', limb(elbow, actual, 11, 6.5));
    const cuff = elder ? between(elbow, actual, .57) : between(shoulder, elbow, .63);
    attr(`${name}-sleeve`, 'd', elder
      ? `${limb(shoulder, elbow, 19, 14)}${limb(elbow, cuff, 14, 11)}`
      : limb(shoulder, cuff, 21, 17));
    const previous = elder ? elbow : shoulder;
    const distance = Math.hypot(cuff.x - previous.x, cuff.y - previous.y) || 1;
    const nx = -(cuff.y - previous.y) / distance, ny = (cuff.x - previous.x) / distance;
    const r = elder ? 10 : 16;
    attr(`${name}-cuff`, 'd', `M${point({ x: cuff.x + nx * r, y: cuff.y + ny * r })}L${point({ x: cuff.x - nx * r, y: cuff.y - ny * r })}`);
    attr(`${name}-hand`, 'transform', `translate(${point(actual)}) rotate(${handAngle.toFixed(2)})`);
  }

  function render() {
    const f = frame;
    const breath = reducedMotion ? 0 : Math.sin(clock * Math.PI * 2 / 4400) * .85;
    const elderBreath = reducedMotion ? 0 : Math.sin(clock * Math.PI * 2 / 4900 + .8) * .65;
    // All offsets are subject motion. The viewBox and room never move.
    const back = Math.max(f.back, f.withdraw * .55), dx = -43 * back;
    const lean = f.setup * 12 + f.listen * .7 - f.withdraw * .6;
    const upperBody = `translate(0 ${breath.toFixed(2)}) rotate(${lean.toFixed(2)} 350 425)`;
    const workerShoulder = (x, y) => {
      const radians = lean * Math.PI / 180;
      return { x: 350 + (x - 350) * Math.cos(radians) - (y - 425) * Math.sin(radians) + dx,
        y: 425 + (x - 350) * Math.sin(radians) + (y - 425) * Math.cos(radians) + breath };
    };
    attr('worker-base', 'transform', `translate(${dx.toFixed(2)} 0)`);
    attr('worker-torso', 'transform', upperBody);
    attr('worker-head', 'transform', `${upperBody} rotate(${(f.listen * 2.5 - f.setup * 9).toFixed(2)} 352 281)`);
    attr('senior-torso', 'transform', `translate(0 ${elderBreath.toFixed(2)})`);
    attr('senior-head', 'transform', `translate(${(f.gaze * 2.5).toFixed(2)} ${elderBreath.toFixed(2)}) rotate(${(f.gaze * 2 + f.down * 3).toFixed(2)} 755 284)`);
    for (const suffix of ['back', 'front']) {
      attr(`tan-hair-${suffix}`, 'opacity', 1 - f.lim);
      attr(`lim-hair-${suffix}`, 'opacity', f.lim);
    }
    attr('cloth-start', 'stop-color', color([139, 159, 138], [113, 143, 145], f.lim));
    attr('cloth-middle', 'stop-color', color([180, 192, 163], [158, 181, 179], f.lim));
    attr('cloth-end', 'stop-color', color([141, 159, 136], [111, 142, 143], f.lim));
    const anger = f.resistant;
    attr('senior-brow-left', 'd', `M735 ${238 - anger * 2}Q742 ${234 + anger} 748 ${237 + anger * 3}`);
    attr('senior-brow-right', 'd', `M761 ${237 + anger * 3}Q768 ${234 + anger} 775 ${238 - anger * 2}`);
    attr('senior-mouth', 'd', `M744 274Q754 ${272 - anger * 3 + f.settled * 5} 765 273`);
    attr('senior-pupils', 'transform', `translate(${(f.gaze * 2.6).toFixed(2)} ${(f.down * 1.7).toFixed(2)})`);
    const blink = (period, offset) => {
      if (reducedMotion) return 1;
      const t = (clock + offset) % period;
      return t < 155 ? 1 - .94 * Math.sin(Math.PI * t / 155) : 1;
    };
    const eyelids = (name, cy, openness) => attr(name, 'transform', `translate(0 ${cy}) scale(1 ${openness.toFixed(3)}) translate(0 ${-cy})`);
    eyelids('worker-eyes', 244, blink(4670, 1100));
    eyelids('senior-eyes', 246, blink(5380, 2900));
    attr('programme', 'opacity', f.tv);
    const bowlX = mix(632, 566, f.away);
    const spoonX = mix(531, 580, f.spoon);
    attr('bowl', 'transform', `translate(${bowlX.toFixed(2)} 388)`);
    attr('spoon', 'transform', `translate(${spoonX.toFixed(2)} 417) rotate(-8)`);

    const shoulder = workerShoulder(397, 330);
    let workerWrist = { x: 356 + dx, y: 428 };
    workerWrist = between(workerWrist, { x: 510 + dx, y: 355 }, f.open);
    workerWrist = between(workerWrist, { x: 493 + dx, y: 390 }, f.listen);
    workerWrist = between(workerWrist, { x: spoonX - 28, y: 410 }, f.setup);
    workerWrist = between(workerWrist, { x: 372 + dx, y: 413 }, f.withdraw);
    let angle = mix(22, -25, f.open);
    angle = mix(angle, -10, f.listen);
    angle = mix(angle, 0, f.setup);
    angle = mix(angle, 36, f.withdraw);
    drawArm('worker-active', shoulder, workerWrist, [96, 104], -1, angle, false, clamp(f.open + f.listen));
    drawArm('worker-rest', workerShoulder(323, 330), { x: 355 + dx, y: 419 }, [78, 76], 1, 18);
    let elderWrist = { x: 719, y: 407 };
    // Fingertips meet the bowl's right rim; pushing moves left, never towards a face.
    elderWrist = between(elderWrist, { x: bowlX + 71, y: 386 }, f.push);
    drawArm('senior-active', { x: 728, y: 330 + elderBreath }, elderWrist, [83, 84], -1, mix(169, 180, f.push), true);
    drawArm('senior-rest', { x: 798, y: 331 + elderBreath }, { x: 756, y: 420 }, [76, 77], -1, 170, true);
  }

  function setView(nextView, options = {}) {
    if (destroyed) return;
    const next = normalize(nextView, view);
    const first = !initialized;
    const motionChanged = typeof options.reducedMotion === 'boolean' && options.reducedMotion !== reducedMotion;
    if (typeof options.reducedMotion === 'boolean') reducedMotion = options.reducedMotion;
    const snap = first || !!options.immediate || reducedMotion;
    const resetSpoon = first || options.immediate || next.senior !== view.senior ||
      next.gesture === 'push-bowl' || next.bowl === 'away';
    const spoon = next.gesture === 'setup' ? 1 : resetSpoon ? 0 : target.spoon;
    const nextTarget = pose(next, spoon);
    const changed = Object.keys(nextTarget).some(key => nextTarget[key] !== target[key]);
    view = next;
    initialized = true;
    if (changed || snap || motionChanged) {
      start = { ...frame };
      target = nextTarget;
      elapsed = snap ? DURATION : 0;
      if (snap) frame = { ...target };
      render();
    }
    accessibility();
  }

  function tick(deltaMs) {
    if (destroyed || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    if (!reducedMotion) clock = (clock + deltaMs) % 1e9;
    if (elapsed < DURATION) {
      elapsed = Math.min(DURATION, elapsed + deltaMs);
      const t = smooth(elapsed / DURATION);
      frame = Object.fromEntries(Object.keys(target).map(key => [key, mix(start[key], target[key], t)]));
      // Establish contact first, then slide the object. Interruptions still start
      // from the last rendered pose; repeated identical views do not restart it.
      const progress = elapsed / DURATION;
      if (target.push > start.push) {
        frame.push = mix(start.push, target.push, smooth(clamp(progress / .3)));
        frame.away = mix(start.away, target.away, smooth(clamp((progress - .3) / .7)));
      }
      if (target.setup > start.setup) {
        frame.setup = mix(start.setup, target.setup, smooth(clamp(progress / .35)));
        frame.open = mix(start.open, target.open, smooth(clamp(progress / .35)));
        frame.listen = mix(start.listen, target.listen, smooth(clamp(progress / .35)));
        frame.withdraw = mix(start.withdraw, target.withdraw, smooth(clamp(progress / .35)));
        frame.spoon = mix(start.spoon, target.spoon, smooth(clamp((progress - .35) / .65)));
      }
    }
    render();
  }

  function setLocale(nextLocale) {
    if (destroyed) return;
    locale = String(nextLocale || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
    accessibility();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    svg.remove();
    for (const key of Object.keys(parts)) delete parts[key];
  }

  accessibility();
  render();
  return { setView, tick, setLocale, destroy };
}
