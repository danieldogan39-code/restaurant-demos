/* Zwei Lichter – Die Reise · Engine v4
   Daniel ist Gastgeber und rechnet das Spiel, Aurelia verbindet sich per PeerJS.
   Jeder steuert seine Figur lokal; der Gastgeber prüft Regeln und verteilt den Zustand.
   Synchronisation: geglättete Uhr, Interpolation der Partnerfigur, schneller ungeordneter Kanal
   für Zustand/Positionen, zuverlässiger Kanal für Ereignisse und Aktionen. */
(() => {
'use strict';
const VERSION = '6.0';
const CFG = window.ZL_CONFIG;
const W = 600, H = 1000, R = 18, VMAX = 470, TAU = Math.PI * 2, HUDH = 64;
const $ = id => document.getElementById(id);
const CA = [244, 168, 184], CD = [156, 199, 255], CG = [243, 201, 143];
const COL = {a: CA, d: CD, g: CG, x: CG};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpA = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * k; };
const nm = k => CFG[k];
const OTH = k => k === 'a' ? 'd' : 'a';
const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const WORLDS = [
  {n: 'Sternennacht', th: 'nacht'}, {n: 'Tiefsee', th: 'meer'}, {n: 'Frühlingsgarten', th: 'garten'},
  {n: 'Spielhalle', th: 'arcade'}, {n: 'Abenteuer', th: 'schloss'}, {n: 'Laternenfest', th: 'laternen'}
];
/* Die 20 Level in Spielreihenfolge – [Kennung, Welt] */
const ORDER = [['funken', 0], ['schnuppen', 0], ['immer', 0], ['perlen', 1], ['echo', 1], ['korallen', 1],
  ['saeen', 2], ['schmetterlinge', 2], ['tor', 2], ['mauer', 3], ['kette', 3], ['strasse', 3], ['irrgarten', 3], ['lied', 3], ['memory', 3],
  ['zueinander', 4], ['rennen', 4], ['flammen', 5], ['wege', 5], ['herz', 5]];
const CTRL = {
  swipe: {n: 'Wischen', d: 'Finger irgendwo auflegen und ziehen'},
  stick: {n: 'Joystick', d: 'Daumen auflegen – dort erscheint ein Stick'},
  tap:   {n: 'Tippen', d: 'Finger dorthin halten, wo du hin willst'},
  tilt:  {n: 'Neigen', d: 'Handy kippen wie eine Wasserwaage'}
};
document.querySelectorAll('[data-n]').forEach(el => el.textContent = nm(el.dataset.n));

/* ---------- Einstellungen (pro Gerät) ---------- */
const SET = Object.assign({ctrl: 'swipe', mute: false, vib: true, fx: true}, (() => { try { return JSON.parse(localStorage.getItem('zl-set')) || {}; } catch (e) { return {}; } })());
if (!CTRL[SET.ctrl]) SET.ctrl = 'swipe';
const saveSet = () => { try { localStorage.setItem('zl-set', JSON.stringify(SET)); } catch (e) {} };

/* ---------- Zustand ---------- */
const S = {};      // geteilter Spielzustand – bleibt immer dasselbe Objekt
const LOC = {};    // lokale Daten des aktuellen Levels
let role = null, me = 'd', other = 'a', peer = null, conn = null, fconn = null, lastCode = '';
const mine = {x: W * .65, y: H * .9}, ghost = {x: W * .35, y: H * .9, e: null}, pend = {x: 0, y: 0};
let lastSid = -1, lastTp = 0, outEv = [], parts = [], readyKey = '', pickMemo = null;
let lastRecv = 0, lastPosRecv = 0, startLv = 0, netWarn = false, clockOff = null, lastQ = 0, hostSess = '', sseq = 0, pseq = 0, lastPQ = 0;
const SESS = Math.random().toString(36).slice(2, 8);
const clearObj = o => { for (const k of Object.keys(o)) delete o[k]; };
const curL = () => (S.ok && S.lv >= 0) ? LV[S.lv] : null;
const diff = () => S.diff || 1;

/* ---------- Canvas ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
const fog = document.createElement('canvas'), fctx = fog.getContext('2d');
let cw = 0, ch = 0, dpr = 1, sc = 1, ox = 0, oy = 0, amb = {}, quality = 1, shakeAmt = 0;

/* ---------- Hilfen für Level ---------- */
function place(n, minD, box, avoid = []) {
  let pts = [], md = minD;
  for (let tries = 0; tries < 8 && pts.length < n; tries++) {
    pts = [];
    for (let k = 0; k < 4000 && pts.length < n; k++) {
      const p = {x: rnd(box[0], box[2]), y: rnd(box[1], box[3])};
      if (pts.every(q => dist(p, q) >= md) && avoid.every(a => dist(p, a) >= a.r)) pts.push(p);
    }
    md *= .88;
  }
  return pts;
}
const START = [{x: W * .35, y: H * .9, r: 130}, {x: W * .65, y: H * .9, r: 130}];
function drift(o, dt, m = 60) {
  o.x += o.vx * dt; o.y += o.vy * dt;
  if (o.x < m || o.x > W - m) o.vx *= -1;
  if (o.y < 150 || o.y > H - m) o.vy *= -1;
  o.x = clamp(o.x, m, W - m); o.y = clamp(o.y, 150, H - m);
}
function stunStep(dt, hit) {
  for (const k of ['a', 'd']) {
    const p = S.p[k], q = S.p[OTH(k)];
    if (p.lit) {
      if (p.inv <= 0 && hit(p)) { p.lit = 0; p.out = 0; emit({k: 'fizz', x: p.x, y: p.y, o: k}); }
    } else {
      p.out += dt;
      if ((q.lit && dist(p, q) < 58) || p.out > 6) { p.lit = 1; p.inv = 2.2; emit({k: 'relight', x: p.x, y: p.y, o: k}); }
    }
  }
}
function finish(delay = 1.4, forced) {
  if (S.done) return;
  const L = LV[S.lv], sec = S.t - S.lt;
  const st = forced || (sec <= L.t3 ? 3 : sec <= L.t2 ? 2 : 1);
  S.done = 1; S.finT = S.t + delay; S.doneAt = S.t;
  S.stars[L.id] = Math.max(S.stars[L.id] || 0, st);
  S.lastStars = st; S.lastTime = sec; S.lastNote = L.note ? L.note() : '';
  emit({k: 'win', x: W / 2, y: H * .45});
}
function failRestart(msg) { emit({k: 'toast', txt: msg}); emit({k: 'wrong', x: W / 2, y: H / 2}); setupLevel(S.lv, true); }
function teleport(k, x, y) { const p = S.p[k]; p.x = x; p.y = y; p.tp = (p.tp || 0) + 1; }
function hostNow() {
  if (role === 'host' || !S.ok) return S.t || 0;
  if (S.pausedBy || S.away || clockOff == null) return S.t;
  const v = performance.now() / 1000 + clockOff;
  return clamp(v, S.t - .05, S.t + .35 + (S.rtt || 0) / 2000);
}
function act(d) {
  if (role === 'host') handleAct(me, d);
  else if (conn && conn.open) { try { conn.send({t: 'act', d}); } catch (e) {} }
}

/* ---------- Audio, Vibration, Toasts ---------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(f, dur = .6, vol = .07, type = 'sine', delay = 0) {
  if (!ac || SET.mute || document.hidden) return;
  try {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + .05);
  } catch (e) {}
}
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
const SHELL_NOTES = [392, 493.88, 587.33, 698.46, 783.99, 987.77];
const SONG_NOTES = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];
function buzz(ms) { if (!SET.vib) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
function toast(txt) {
  const box = $('toasts'), el = document.createElement('div');
  el.className = 'toast'; el.textContent = txt; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
}
function emit(e) { outEv.push(e); fx(e); }
function burst(x, y, c, n, sp = 140, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rnd(.25, 1) * sp;
    parts.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, d: rnd(.6, 1.3), c, s: rnd(.5, 1) * size});
  }
  if (parts.length > 400) parts.splice(0, parts.length - 400);
}
function fx(e) {
  const c = COL[e.o] || CG, mineEv = e.o === me;
  const L = curL(); if (L && L.fx) { try { L.fx(e); } catch (er) {} }
  if (['win', 'meet'].includes(e.k)) shakeAmt = Math.max(shakeAmt, .5); else if (['lost', 'caught', 'wrong'].includes(e.k) || (e.k === 'fizz' && mineEv)) shakeAmt = Math.max(shakeAmt, .35);
  switch (e.k) {
    case 'toast': toast(e.txt); break;
    case 'chime': case 'bubble': tone(NOTES[(Math.random() * 6) | 0] * (e.o === 'd' ? .5 : 1), .7); burst(e.x, e.y, e.k === 'bubble' ? [190, 235, 255] : c, 12); if (mineEv) buzz(12); break;
    case 'meteor': tone(NOTES[(Math.random() * 5 + 3) | 0], .9, .06); burst(e.x, e.y, c, 16, 180); if (mineEv) buzz(15); break;
    case 'gold': case 'catch': case 'pearl': case 'find': case 'match': case 'heart':
      tone(659.25, .8); tone(987.77, 1, .06, 'sine', .09); burst(e.x, e.y, CA, 14, 170); burst(e.x, e.y, CG, 14, 130); buzz(25); break;
    case 'ring': tone(e.o === 'd' ? 659.25 : 880, .5, .06); tone(e.o === 'd' ? 987.77 : 1318.5, .5, .03, 'sine', .06); if (mineEv) buzz(12); break;
    case 'tick': tone(e.o === 'd' ? 392 : 523.25, .25, .04, 'triangle'); break;
    case 'open': tone(e.o === 'd' ? 330 : 440, .35, .05, 'triangle'); burst(e.x, e.y, c, 8, 80); break;
    case 'gate': tone(294, .4, .05, 'triangle'); tone(440, .5, .04, 'triangle', .08); break;
    case 'note': tone(SHELL_NOTES[e.i] || 440, .7, .09); tone((SHELL_NOTES[e.i] || 440) * 2, .5, .02); burst(e.x, e.y, c, 14, 150); break;
    case 'nh': if (!mineEv) tone(SONG_NOTES[e.i] || 440, .5, .08, 'triangle'); break;
    case 'round': [523.25, 659.25, 783.99].forEach((f, i) => tone(f, .8, .05, 'sine', i * .09)); break;
    case 'wrong': tone(233, .5, .06, 'triangle'); tone(196, .7, .05, 'triangle', .15); buzz([30, 50, 30]); break;
    case 'pick': tone(e.o === 'd' ? 440 : 587.33, .35, .05); burst(e.x, e.y, c, 8, 90); break;
    case 'plant': tone(392, .4, .05, 'triangle'); burst(e.x, e.y, [170, 130, 90], 10, 90); break;
    case 'bloom': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 1, .045, 'sine', i * .07)); burst(e.x, e.y, CA, 16, 170); burst(e.x, e.y, [190, 240, 170], 12, 140); buzz(20); break;
    case 'fizz': case 'tangle': case 'caught': tone(220, .5, .05, 'triangle'); tone(165, .6, .04, 'triangle', .08); burst(e.x, e.y, [150, 145, 170], 10, 70, 2); if (mineEv) buzz([20, 40, 20]); break;
    case 'relight': tone(587.33, .5, .05); tone(880, .7, .05, 'sine', .08); burst(e.x, e.y, CG, 18, 150); break;
    case 'star': tone(NOTES[(e.i - 1) % 8] * (e.i > 8 ? 1.5 : 1), 1.1, .06); burst(e.x, e.y, c, 16, 150); if (mineEv) buzz(15); break;
    case 'flame': tone(698.46, .35, .04); burst(e.x, e.y, [255, 190, 110], 8, 80); break;
    case 'puff': tone(196, .35, .04, 'triangle'); burst(e.x, e.y, [140, 130, 150], 8, 60, 2); break;
    case 'lantern': tone(NOTES[(Math.random() * 8) | 0], 1, .06); burst(e.x, e.y, [255, 196, 120], 18, 160); if (mineEv) buzz(15); break;
    case 'pairlit': tone(NOTES[Math.min(7, e.i - 1)], 1.3, .06); tone(NOTES[Math.min(7, e.i - 1)] * 1.5, 1.3, .03); burst(e.x, e.y, CA, 16, 170); burst(W - e.x, e.y, CD, 16, 170); buzz(20); break;
    case 'pad': tone(e.o === 'd' ? 330 : 440, .18, .05, 'square'); break;
    case 'brick': tone(NOTES[(Math.random() * 8) | 0], .25, .045, 'square'); burst(e.x, e.y, COL[e.o] || CG, 10, 140, 2.5); break;
    case 'lost': tone(180, .6, .06, 'sawtooth'); buzz(40); break;
    case 'dot': tone(e.o === 'd' ? 660 : 880, .06, .02, 'square'); break;
    case 'power': [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, .5, .05, 'square', i * .06)); burst(e.x, e.y, CG, 20, 180); break;
    case 'poof': tone(300, .3, .05, 'triangle'); burst(e.x, e.y, [200, 200, 220], 14, 120); break;
    case 'flip': tone(e.o === 'd' ? 440 : 523.25, .12, .04, 'triangle'); break;
    case 'lap': [659.25, 880].forEach((f, i) => tone(f, .4, .05, 'square', i * .1)); if (mineEv) buzz(20); break;
    case 'meet': [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone(f, 1.5, .05, 'sine', i * .09)); burst(e.x, e.y, CA, 40, 260, 4); burst(e.x, e.y, CD, 40, 260, 4); buzz([30, 30, 60]); break;
    case 'win': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 1.4, .05, 'sine', i * .11)); burst(e.x, e.y, CG, 40, 320, 3.5); burst(e.x, e.y, CA, 30, 260); burst(e.x, e.y, CD, 30, 260); break;
  }
}

/* ---------- Zeichen-Hilfen (mit Zwischenspeicher für Leuchten) ---------- */
const glowCache = new Map();
function glowSprite(c) {
  const key = c[0] + ',' + c[1] + ',' + c[2];
  let s = glowCache.get(key);
  if (!s) {
    s = document.createElement('canvas'); s.width = s.height = 128;
    const g = s.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowCache.set(key, s);
  }
  return s;
}
function glow(x, y, r, c, a) {
  if (r <= 0 || a <= 0) return;
  const ga = ctx.globalAlpha, op = ctx.globalCompositeOperation; ctx.globalAlpha = ga * Math.min(1, a * .9); ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(c), x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
}
function dotW(x, y, r) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function label(txt, x, y, c, size = 15, weight = 600) {
  ctx.font = `${weight} ${size}px Karla, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgba(c, .95); ctx.fillText(txt, x, y);
}
function line2(a, b, al) {
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, rgba(COL[a.o] || CG, al)); g.addColorStop(1, rgba(COL[b.o] || CG, al));
  ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function heartPath(x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * .9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * .1, x - s * .75, y - s * 1.25, x, y - s * .45);
  ctx.bezierCurveTo(x + s * .75, y - s * 1.25, x + s * 1.5, y - s * .1, x, y + s * .9);
  ctx.closePath();
}
function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

/* ---------- Figuren ---------- */
function skinPrincess(x, y, face, t, mv) {
  const sw = mv ? Math.sin(t * 14) * 2.5 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(face < 0 ? -1 : 1, 1);
  ctx.fillStyle = '#4a2c24'; ctx.beginPath(); ctx.ellipse(-3, -8, 9, 15, .15, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -6, 0, 22); g.addColorStop(0, '#f7b9c7'); g.addColorStop(1, '#e48aa2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, -6); ctx.lineTo(15 + sw, 22); ctx.lineTo(-15 + sw, 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f3c98f'; ctx.fillRect(-6, 0, 12, 3);
  ctx.strokeStyle = '#f5d7c4'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-10, 6 - sw); ctx.moveTo(5, -3); ctx.lineTo(10, 6 + sw); ctx.stroke();
  ctx.fillStyle = '#f5d7c4'; ctx.beginPath(); ctx.arc(0, -14, 8.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a2c24'; ctx.beginPath(); ctx.arc(-1, -17, 8.5, Math.PI * .95, Math.PI * 2.05); ctx.fill();
  ctx.fillStyle = '#3a2420'; ctx.beginPath(); ctx.arc(3, -14, 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f3c98f'; ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-5, -28); ctx.lineTo(-2, -24); ctx.lineTo(0, -30); ctx.lineTo(2, -24); ctx.lineTo(5, -28); ctx.lineTo(6, -22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f48aa3'; ctx.beginPath(); ctx.arc(0, -27, 1.6, 0, TAU); ctx.fill();
  ctx.restore();
}
function skinPrince(x, y, face, t, mv) {
  const sw = mv ? Math.sin(t * 14) * 5 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(face < 0 ? -1 : 1, 1);
  ctx.fillStyle = '#3b5b9a'; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(-16 - Math.abs(sw), 8, -12, 18); ctx.lineTo(-2, 14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a2f4a'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3 - sw * .6, 21); ctx.moveTo(3, 8); ctx.lineTo(3 + sw * .6, 21); ctx.stroke();
  const g = ctx.createLinearGradient(0, -7, 0, 10); g.addColorStop(0, '#bcd8ff'); g.addColorStop(1, '#86afec');
  ctx.fillStyle = g; rr(-8, -7, 16, 17, 4); ctx.fill();
  ctx.fillStyle = '#f3c98f'; ctx.fillRect(-8, 3, 16, 3);
  ctx.strokeStyle = '#f0d0b8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(10, 5 - sw * .4); ctx.stroke();
  ctx.fillStyle = '#f0d0b8'; ctx.beginPath(); ctx.arc(0, -14, 8.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3d2a20'; ctx.beginPath(); ctx.arc(0, -16, 8.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(3, -14, 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f3c98f'; ctx.beginPath(); ctx.moveTo(-7, -21); ctx.lineTo(-7, -29); ctx.lineTo(-3.5, -25); ctx.lineTo(0, -30); ctx.lineTo(3.5, -25); ctx.lineTo(7, -29); ctx.lineTo(7, -21); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9cc7ff'; ctx.beginPath(); ctx.arc(0, -24, 1.6, 0, TAU); ctx.fill();
  ctx.restore();
}
function skinTurtle(x, y, ang, t, mv) {
  const fl = Math.sin(t * (mv ? 9 : 3)) * .45;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2);
  ctx.fillStyle = '#7cc596';
  for (const [sx, sy, s] of [[-1, -1, 1], [1, -1, -1], [-1, 1, -1], [1, 1, 1]]) {
    ctx.save(); ctx.translate(sx * 13, sy * 9); ctx.rotate(sx * (sy < 0 ? -.5 : .4) + s * fl);
    ctx.beginPath(); ctx.ellipse(sx * 6, sy * 2, 9, 4.5, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(0, -21, 7, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#20302a'; ctx.beginPath(); ctx.arc(-3, -24, 1.4, 0, TAU); ctx.arc(3, -24, 1.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f48aa3'; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(-6, -32); ctx.lineTo(-6, -25); ctx.closePath(); ctx.moveTo(0, -28); ctx.lineTo(6, -32); ctx.lineTo(6, -25); ctx.closePath(); ctx.fill();
  const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18); g.addColorStop(0, '#9fdcae'); g.addColorStop(1, '#3f8f63');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 15, 17, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(244,168,184,.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); } ctx.closePath(); ctx.stroke();
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 15); ctx.stroke(); }
  ctx.restore();
}
function skinOctopus(x, y, ang, t, mv) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#7ea9f2'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * .15 + i / 7 * Math.PI * .7, w = Math.sin(t * (mv ? 8 : 3) + i) * 4;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, 4 + Math.sin(a) * 4);
    ctx.quadraticCurveTo(Math.cos(a) * 16 + w, 12 + Math.sin(a) * 8, Math.cos(a) * 20 - w, 22 + Math.sin(a) * 6); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-4, -8, 2, 0, -3, 18); g.addColorStop(0, '#c4dcff'); g.addColorStop(1, '#6f9bea');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -4, 15, 16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -4, 4, 0, TAU); ctx.arc(5, -4, 4, 0, TAU); ctx.fill();
  const lx = Math.cos(ang) * 1.5, ly = Math.sin(ang) * 1.5;
  ctx.fillStyle = '#1d2540'; ctx.beginPath(); ctx.arc(-5 + lx, -4 + ly, 1.9, 0, TAU); ctx.arc(5 + lx, -4 + ly, 1.9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2d3f6e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 3, 4, .2, Math.PI - .2); ctx.stroke();
  ctx.fillStyle = 'rgba(244,168,184,.55)'; ctx.beginPath(); ctx.arc(-10, 2, 2.5, 0, TAU); ctx.arc(10, 2, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}
const PORES = [[-7, -9, 2.6, 2], [4, -12, 1.8, 1.5], [8, -3, 2.4, 2.8], [-9, 3, 1.9, 2.4], [1, 6, 2.8, 2.1], [-2, -1, 1.4, 1.4], [9, 8, 1.6, 1.9], [-6, 11, 2.2, 1.6]];
function skinSponge(x, y, ang, t, mv) {
  const w = Math.sin(t * (mv ? 12 : 2.5)), bob = mv ? Math.abs(w) * 1.5 : Math.sin(t * 2) * .6;
  ctx.save(); ctx.translate(x, y - bob);
  ctx.lineCap = 'round';
  // Beine mit Schuhen
  ctx.strokeStyle = '#5f86c9'; ctx.lineWidth = 4;
  for (const s of [-1, 1]) { const sw = mv ? w * 4 * s : 0; ctx.beginPath(); ctx.moveTo(s * 6, 13); ctx.lineTo(s * 6 + sw, 22 + bob); ctx.stroke();
    ctx.fillStyle = '#f3c98f'; ctx.beginPath(); ctx.ellipse(s * 6 + sw + s * 1.5, 24 + bob, 4.6, 2.8, 0, 0, TAU); ctx.fill(); }
  // Arme mit Händen
  for (const s of [-1, 1]) { const sw = mv ? -w * 5 * s : Math.sin(t * 1.6 + s) * 2; ctx.strokeStyle = '#6f97da'; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(s * 13, 0); ctx.quadraticCurveTo(s * 20, 2, s * 21, 9 + sw); ctx.stroke();
    ctx.fillStyle = '#e9f2ff'; ctx.beginPath(); ctx.arc(s * 21, 10.5 + sw, 3.4, 0, TAU); ctx.fill(); }
  // Körper: weicher, knubbeliger Schwamm
  const g = ctx.createRadialGradient(-5, -9, 2, 0, 0, 22); g.addColorStop(0, '#b4d2ff'); g.addColorStop(.55, '#7aa6ec'); g.addColorStop(1, '#466fbd');
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, r = 1 + .07 * Math.sin(a * 9) + .03 * Math.sin(a * 5 + 1); ctx.lineTo(Math.cos(a) * 14.5 * r, Math.sin(a) * 16 * r - 1); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,70,140,.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(32,62,135,.7)';
  for (const [px, py, rx, ry] of PORES) { ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, 0, TAU); ctx.fill(); }
  // kleines Büschel oben
  ctx.fillStyle = '#a9c9fb'; for (const [px, r] of [[-4, 3], [0, 3.8], [4, 3]]) { ctx.beginPath(); ctx.arc(px, -17 + Math.abs(px) * .3, r, 0, TAU); ctx.fill(); }
  // Gesicht
  const lx = Math.cos(ang) * 1.3, ly = Math.sin(ang) * 1.3, blink = Math.sin(t * 2.7) > .97 ? .25 : 1;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-5, -5, 3.6, 4 * blink, 0, 0, TAU); ctx.ellipse(5, -5, 3.6, 4 * blink, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1d2a4a'; ctx.beginPath(); ctx.arc(-5 + lx, -5 + ly, 1.8 * blink, 0, TAU); ctx.arc(5 + lx, -5 + ly, 1.8 * blink, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(244,168,184,.7)'; ctx.beginPath(); ctx.arc(-9, 1, 2.3, 0, TAU); ctx.arc(9, 1, 2.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2d3f6e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 1, 3.6, .25, Math.PI - .25); ctx.stroke();
  ctx.restore();
}
const SKINS = {princess: skinPrincess, prince: skinPrince, turtle: skinTurtle, octopus: skinOctopus, sponge: skinSponge};
const SKN = {a: {lx: 0, ly: 0, ang: -Math.PI / 2, face: 1, mv: 0}, d: {lx: 0, ly: 0, ang: -Math.PI / 2, face: -1, mv: 0}};

/* ---------- Eingabe ---------- */
const IN = {ptr: null, tp: new Map(), drag: {x: 0, y: 0}, acc: {x: 0, y: 0}, target: null, dirs: [], taps: [], heading: null,
  stick: null, stickDir: null, stickT: 0, prevJump: false, tilt: {x: 0, y: 0, on: false, cal: null, listening: false}};
const keys = new Set();
const KEYMAP = {arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd'};
const dirOf = (x, y) => (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : (y > 0 ? 'd' : 'u');
const DANG = {r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2};
function camY() { const L = curL(); return L && L.camY ? (L.camY() || 0) : 0; }
function camX() { const L = curL(); return L && L.camX ? (L.camX() || 0) : 0; }
function toWorld(cx, cy) { return {x: (cx - ox) / sc + camX(), y: (cy - oy) / sc + camY()}; }
const ownPointers = L => L && (L.ctrl === 'buttons');
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { keys.add(' '); if (curL() && curL().ctrl === 'hop' && !e.repeat) IN.dirs.push('u'); if (k === ' ') e.preventDefault(); return; }
  if (!KEYMAP[k]) return;
  e.preventDefault();
  keys.add(k);
  if (!e.repeat) IN.dirs.push(KEYMAP[k]);
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k === 'enter' ? ' ' : k); });
addEventListener('blur', () => { keys.clear(); IN.tp.clear(); IN.ptr = null; IN.stick = null; });
cv.addEventListener('pointerdown', e => {
  audio();
  if (SET.ctrl === 'tilt' && !IN.tilt.listening) enableTilt();
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  IN.tp.set(e.pointerId, {x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY});
  const L = curL();
  if (ownPointers(L)) return;
  if (IN.ptr) return;
  const w = toWorld(e.clientX, e.clientY);
  IN.ptr = {id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: 0, sent: false};
  IN.acc.x = IN.acc.y = 0;
  if (L && L.ctrl === 'tap') { IN.taps.push(w); return; }
  if (SET.ctrl === 'stick') IN.stick = {ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY};
  if (SET.ctrl === 'tap' && L && L.three) { const d = dirOf(e.clientX - cw / 2, e.clientY - ch * .55); if (d) IN.dirs.push(d); IN.heading = null; }
  else if (SET.ctrl === 'tap') {
    IN.target = w;
    const d = dirOf(w.x - mine.x, w.y - mine.y); if (d) IN.dirs.push(d);
    IN.heading = Math.atan2(w.y - mine.y, w.x - mine.x);
  }
});
cv.addEventListener('pointermove', e => {
  const T = IN.tp.get(e.pointerId); if (T) { T.x = e.clientX; T.y = e.clientY; }
  const P = IN.ptr; if (!P || e.pointerId !== P.id) return;
  const dx = e.clientX - P.x, dy = e.clientY - P.y; P.x = e.clientX; P.y = e.clientY; P.moved += Math.hypot(dx, dy);
  const L = curL(); if (L && L.ctrl === 'tap') return;
  if (SET.ctrl === 'swipe') {
    IN.drag.x += dx * 1.25 / sc; IN.drag.y += dy * 1.25 / sc;
    IN.acc.x += dx / sc; IN.acc.y += dy / sc;
    const hop = L && L.ctrl === 'hop';
    if (Math.hypot(IN.acc.x, IN.acc.y) > 26 && !(hop && P.sent)) {
      IN.dirs.push(dirOf(IN.acc.x, IN.acc.y)); IN.heading = Math.atan2(IN.acc.y, IN.acc.x);
      P.sent = true; IN.acc.x = IN.acc.y = 0;
    }
  } else if (SET.ctrl === 'stick' && IN.stick) { IN.stick.x = e.clientX; IN.stick.y = e.clientY; }
  else if (SET.ctrl === 'tap') { const w = toWorld(e.clientX, e.clientY); IN.target = w; IN.heading = Math.atan2(w.y - mine.y, w.x - mine.x); }
});
function endPtr(e) {
  IN.tp.delete(e.pointerId);
  const P = IN.ptr; if (!P || e.pointerId !== P.id) return;
  const L = curL();
  if (SET.ctrl === 'swipe' && P.moved < 12 && performance.now() - P.t0 < 300 && !(L && L.ctrl === 'tap')) IN.taps.push(toWorld(e.clientX, e.clientY));
  IN.ptr = null; IN.stick = null; IN.target = null; IN.acc.x = IN.acc.y = 0;
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
document.addEventListener('gesturestart', e => e.preventDefault());
async function enableTilt() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') { toast('Neigen wurde nicht erlaubt – nimm eine andere Steuerung.'); return; }
    }
  } catch (e) { return; }
  if (!IN.tilt.listening) { addEventListener('deviceorientation', onTilt); IN.tilt.listening = true; }
  IN.tilt.cal = null;
  setTimeout(() => { if (SET.ctrl === 'tilt' && !IN.tilt.on) toast('Kein Neigungssensor gefunden – Wischen oder Joystick nehmen.'); }, 1800);
}
function onTilt(e) {
  if (e.gamma == null || e.beta == null) return;
  if (!IN.tilt.cal) IN.tilt.cal = {g: e.gamma, b: e.beta};
  IN.tilt.x = clamp((e.gamma - IN.tilt.cal.g) / 20, -1.4, 1.4);
  IN.tilt.y = clamp((e.beta - IN.tilt.cal.b) / 20, -1.4, 1.4);
  IN.tilt.on = true;
}
function btnZones() {
  const by = ch - 92;
  return {l: {x: cw * .13, y: by, r: 40}, r: {x: cw * .35, y: by, r: 40}, j: {x: cw * .82, y: by - 6, r: 50}};
}
function readInput(dt) {
  const L = curL();
  let vx = 0, vy = 0, keyOn = false;
  if (keys.has('arrowleft') || keys.has('a')) vx--;
  if (keys.has('arrowright') || keys.has('d')) vx++;
  if (keys.has('arrowup') || keys.has('w')) vy--;
  if (keys.has('arrowdown') || keys.has('s')) vy++;
  if (vx || vy) { const m = Math.hypot(vx, vy); vx /= m; vy /= m; keyOn = true; }
  else if (SET.ctrl === 'stick' && IN.stick) {
    let sx = (IN.stick.x - IN.stick.ox) / 55, sy = (IN.stick.y - IN.stick.oy) / 55; const m = Math.hypot(sx, sy);
    if (m > 1) { sx /= m; sy /= m; } if (m < .15) sx = sy = 0; vx = sx; vy = sy;
  } else if (SET.ctrl === 'tilt' && IN.tilt.on) {
    let tx = IN.tilt.x, ty = IN.tilt.y; const m = Math.hypot(tx, ty);
    if (m < .12) tx = ty = 0; else if (m > 1) { tx /= m; ty /= m; } vx = tx; vy = ty;
  }
  if (!keyOn && (SET.ctrl === 'stick' || SET.ctrl === 'tilt')) {
    const m = Math.hypot(vx, vy), d = m > .6 ? dirOf(vx, vy) : null;
    IN.stickT -= dt;
    if (d && (d !== IN.stickDir || IN.stickT <= 0)) { IN.dirs.push(d); IN.stickT = .3; }
    IN.stickDir = d;
  }
  const inp = {vec: {x: vx, y: vy}, drag: {x: IN.drag.x, y: IN.drag.y}, target: IN.target, dirs: IN.dirs.splice(0), taps: IN.taps.splice(0), heading: IN.heading};
  IN.drag.x = IN.drag.y = 0; IN.heading = null;
  if (L && L.ctrl === 'buttons') {
    const Z = btnZones(); let bl = false, br = false, bj = false;
    for (const T of IN.tp.values()) { if (T.x > cw * .55) bj = true; else if (T.x < (Z.l.x + Z.r.x) / 2) bl = true; else br = true; }
    if (keys.has('arrowleft') || keys.has('a')) bl = true;
    if (keys.has('arrowright') || keys.has('d')) br = true;
    if (SET.ctrl === 'tilt' && IN.tilt.on) { if (IN.tilt.x < -.25) bl = true; if (IN.tilt.x > .25) br = true; }
    const held = bj || keys.has(' ') || keys.has('arrowup') || keys.has('w');
    inp.btn = {l: bl && !br, r: br && !bl, jump: held && !IN.prevJump, held};
    IN.prevJump = held; LOC._btn = inp.btn;
  }
  if (L && L.ctrl === 'drive') {
    let s = 0;
    if (keys.has('arrowleft') || keys.has('a')) s -= 1;
    if (keys.has('arrowright') || keys.has('d')) s += 1;
    if (!s) {
      if (SET.ctrl === 'tilt' && IN.tilt.on) s = clamp(IN.tilt.x * 1.4, -1, 1);
      else if (SET.ctrl === 'stick' && IN.stick) s = clamp((IN.stick.x - IN.stick.ox) / 55, -1, 1);
      else if (SET.ctrl === 'swipe' && IN.ptr) s = clamp((IN.ptr.x - IN.ptr.sx) / 70, -1, 1);
      else if (SET.ctrl === 'tap') { for (const T of IN.tp.values()) s += T.x < cw / 2 ? -1 : 1; s = clamp(s, -1, 1); }
    }
    inp.steer = s; inp.brake = keys.has('arrowdown') || keys.has('s');
  }
  if (L && L.ctrl === 'fly' && SET.ctrl === 'tap' && IN.ptr) inp.center = {x: clamp((IN.ptr.x - cw / 2) / (cw * .35), -1, 1), y: clamp((IN.ptr.y - ch / 2) / (ch * .28), -1, 1)};
  return inp;
}
function speedMul() {
  if (!S.ok || !S.p[me]) return 1;
  const p = S.p[me], L = curL();
  return (p.lit ? 1 : .45) * (L && L.speed ? L.speed(p) : 1);
}
function applyPend(vm, onlyX) {
  if (onlyX) pend.y = 0;
  const l = Math.hypot(pend.x, pend.y); if (l > 110) { pend.x *= 110 / l; pend.y *= 110 / l; }
  const L2 = Math.hypot(pend.x, pend.y); if (!L2) return {x: 0, y: 0};
  const k = Math.min(1, vm / L2), m = {x: pend.x * k, y: pend.y * k};
  pend.x -= m.x; pend.y -= m.y; return m;
}
function defaultMove(dt, inp) {
  const vm = VMAX * speedMul() * dt;
  pend.x += inp.drag.x; pend.y += inp.drag.y;
  const m = applyPend(vm); mine.x += m.x; mine.y += m.y;
  if (inp.vec.x || inp.vec.y) { mine.x += inp.vec.x * vm; mine.y += inp.vec.y * vm; }
  if (inp.target) { const dx = inp.target.x - mine.x, dy = inp.target.y - mine.y, l = Math.hypot(dx, dy); if (l > 2) { const s = Math.min(l, vm); mine.x += dx / l * s; mine.y += dy / l * s; } }
}
function inputX(inp, dt, vmax) {
  const vm = vmax * dt; let dx = 0;
  pend.x += inp.drag.x; dx += applyPend(vm, true).x;
  dx += inp.vec.x * vm;
  if (inp.target) { const d = inp.target.x - mine.x; dx += clamp(d, -vm, vm); }
  return dx;
}
function desiredDir(inp) {
  if (inp.dirs.length) return inp.dirs[inp.dirs.length - 1];
  if (Math.hypot(inp.vec.x, inp.vec.y) > .5) return dirOf(inp.vec.x, inp.vec.y);
  if (inp.target && dist(inp.target, mine) > 26) return dirOf(inp.target.x - mine.x, inp.target.y - mine.y);
  return null;
}
function desiredHeading(inp) {
  if (inp.heading != null) return inp.heading;
  if (Math.hypot(inp.vec.x, inp.vec.y) > .3) return Math.atan2(inp.vec.y, inp.vec.x);
  if (inp.target && dist(inp.target, mine) > 20) return Math.atan2(inp.target.y - mine.y, inp.target.x - mine.x);
  if (inp.dirs.length) return DANG[inp.dirs[inp.dirs.length - 1]];
  return null;
}
function collide(p, rects) {
  for (const r of rects) {
    const cx = clamp(p.x, r[0], r[0] + r[2]), cy = clamp(p.y, r[1], r[1] + r[3]);
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d >= R) continue;
    if (d > .001) { p.x = cx + dx / d * R; p.y = cy + dy / d * R; }
    else if (p.y - r[1] < r[1] + r[3] - p.y) p.y = r[1] - R; else p.y = r[1] + r[3] + R;
  }
}
function moveMine(dt, inp) {
  const L = curL();
  if (!L || S.phase !== 'play' || S.done || S.pausedBy || S.away) return;
  try { if (L.move) L.move(dt, inp); else defaultMove(dt, inp); } catch (e) { console.error(e); }
  if (L.force) { const f = L.force(mine, hostNow()); mine.x += f.x * dt; mine.y += f.y * dt; }
  if (!L.noClamp) { mine.x = clamp(mine.x, R, W - R); mine.y = clamp(mine.y, R + 10, H - R); }
  if (L.lock) mine.y = L.lock(me);
  if (L.walls) collide(mine, L.walls());
}

/* ---------- Partner-Interpolation ---------- */
const PB = [];
function pushPartner(x, y, e) {
  PB.push({t: performance.now(), x, y, e}); if (PB.length > 40) PB.shift();
}
function partnerAt(now) {
  const tgt = S.p[other];
  if (!PB.length) return {x: tgt.x, y: tgt.y, e: tgt.e};
  const delay = role === 'host' ? 55 : 75, rt = now - delay;
  let i = PB.length - 1;
  while (i > 0 && PB[i - 1].t > rt) i--;
  const b = PB[i], a = PB[i - 1];
  if (!a || rt >= b.t) {
    const p = PB[PB.length - 1], q = PB[PB.length - 2];
    if (q && rt > p.t && Math.hypot(p.x - q.x, p.y - q.y) < 250) {
      const k = Math.min(.06, (rt - p.t) / 1000) / Math.max(.001, (p.t - q.t) / 1000);
      return {x: p.x + (p.x - q.x) * k, y: p.y + (p.y - q.y) * k, e: p.e};
    }
    return {x: p.x, y: p.y, e: p.e};
  }
  if (Math.hypot(b.x - a.x, b.y - a.y) > 250) return {x: b.x, y: b.y, e: b.e};
  const k = clamp((rt - a.t) / Math.max(1, b.t - a.t), 0, 1);
  let e = b.e;
  if (a.e && b.e) { const L = curL(), ang = (L && L.eAngle) || []; e = b.e.map((v, j) => typeof v !== 'number' ? v : ang.includes(j) ? lerpA(a.e[j], v, k) : a.e[j] + (v - a.e[j]) * k); }
  return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, e};
}

/* ---------- 3D (three.js, wird erst bei Bedarf geladen) ---------- */
let threeP = null, gl = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
function need3D() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!threeP) threeP = loadScript('three.min.js?v=149').then(() => window.THREE).catch(() => { threeP = null; toast('3D konnte nicht geladen werden – Seite neu laden?'); });
  return threeP;
}
function renderer3D() {
  const T = window.THREE; if (!T) return null;
  if (!gl) {
    gl = new T.WebGLRenderer({canvas: $('gl'), antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance'});
    gl.setClearColor(0x000000, 1);
  }
  const pr = Math.min(1.75, window.devicePixelRatio || 1) * quality;
  if (gl._pr !== pr || gl._w !== cw || gl._h !== ch) { gl.setPixelRatio(pr); gl.setSize(cw, ch, false); gl._pr = pr; gl._w = cw; gl._h = ch; }
  return gl;
}
function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

/* ---------- Grafik-Pipeline: Leuchten (Bloom), Farbabstimmung, Vignette ---------- */
const FX = {ready: false, off2D: false, w: 0, h: 0};
function fxSetup() {
  const T = window.THREE; if (!T || FX.ready || !SET.fx) return;
  try {
    const R = renderer3D(); if (!R) return;
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
    const mk = (fs, u) => new T.ShaderMaterial({vertexShader: vs, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false});
    FX.qs = new T.Scene(); FX.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    FX.quad = new T.Mesh(new T.PlaneGeometry(2, 2)); FX.quad.frustumCulled = false; FX.qs.add(FX.quad);
    FX.bright = mk('uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + .3, l), 1.); }', {t: {value: null}, th: {value: .5}});
    FX.blur = mk('uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * .227; c += (texture2D(t, vUv + d * 1.385).rgb + texture2D(t, vUv - d * 1.385).rgb) * .316; c += (texture2D(t, vUv + d * 3.231).rgb + texture2D(t, vUv - d * 3.231).rgb) * .07; gl_FragColor = vec4(c, 1.); }', {t: {value: null}, d: {value: new T.Vector2()}});
    FX.comp = mk(`uniform sampler2D t; uniform sampler2D b1; uniform sampler2D b2; uniform float s; uniform float tm; uniform float vig; uniform vec3 tint; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 q0 = vUv - .5, ca = q0 * dot(q0, q0) * .018;
        vec3 c = vec3(texture2D(t, vUv + ca).r, texture2D(t, vUv).g, texture2D(t, vUv - ca).b);
        vec3 b = texture2D(b1, vUv).rgb * .9 + texture2D(b2, vUv).rgb * 1.3;
        c += b * s;
        c = c / (1. + max(c - .85, 0.) * .9);
        float l = dot(c, vec3(.299, .587, .114)); c = mix(vec3(l), c, 1.14);
        c = (c - .5) * 1.06 + .5; c *= tint;
        vec2 q = vUv - .5; c *= 1. - dot(q, q) * vig;
        c += (h(vUv * 917. + tm) - .5) * .018;
        gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
      }`, {t: {value: null}, b1: {value: null}, b2: {value: null}, s: {value: .9}, tm: {value: 0}, vig: {value: .7}, tint: {value: new T.Vector3(1, 1, 1)}});
    FX.over = new T.ShaderMaterial({vertexShader: vs, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }', uniforms: {t: {value: null}}, depthTest: false, depthWrite: false, transparent: true});
    FX.tex2D = new T.CanvasTexture(cv); FX.tex2D.minFilter = T.LinearFilter; FX.tex2D.magFilter = T.LinearFilter; FX.tex2D.generateMipmaps = false;
    FX.ready = true; fxSize();
  } catch (e) { console.error(e); FX.ready = false; }
}
function fxSize() {
  const T = window.THREE; if (!FX.ready || !gl) return;
  const v = new T.Vector2(); gl.getDrawingBufferSize(v);
  if (FX.w === v.x && FX.h === v.y) return;
  FX.w = v.x; FX.h = v.y;
  ['scene', 'a', 'b', 'c', 'd'].forEach(k => { if (FX[k]) FX[k].dispose(); });
  const rt = (w, h, o) => new T.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), Object.assign({minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false}, o));
  FX.scene = rt(v.x, v.y, {depthBuffer: true, samples: gl.capabilities.isWebGL2 ? 4 : 0});
  FX.a = rt(v.x / 4, v.y / 4); FX.b = rt(v.x / 4, v.y / 4); FX.c = rt(v.x / 8, v.y / 8); FX.d = rt(v.x / 8, v.y / 8);
}
function fxPass(mat, target) { FX.quad.material = mat; gl.setRenderTarget(target); gl.render(FX.qs, FX.cam); }
function fxBloom(src, strength, th, vig, tint) {
  FX.bright.uniforms.t.value = src; FX.bright.uniforms.th.value = th; fxPass(FX.bright, FX.a);
  const B = FX.blur.uniforms;
  B.t.value = FX.a.texture; B.d.value.set(1 / FX.a.width, 0); fxPass(FX.blur, FX.b);
  B.t.value = FX.b.texture; B.d.value.set(0, 1 / FX.a.height); fxPass(FX.blur, FX.a);
  B.t.value = FX.a.texture; B.d.value.set(1 / FX.c.width, 0); fxPass(FX.blur, FX.c);
  B.t.value = FX.c.texture; B.d.value.set(0, 1 / FX.c.height); fxPass(FX.blur, FX.d);
  B.t.value = FX.d.texture; B.d.value.set(2 / FX.c.width, 0); fxPass(FX.blur, FX.c);
  B.t.value = FX.c.texture; B.d.value.set(0, 2 / FX.c.height); fxPass(FX.blur, FX.d);
  const C = FX.comp.uniforms;
  C.t.value = src; C.b1.value = FX.a.texture; C.b2.value = FX.d.texture; C.s.value = strength; C.tm.value = (performance.now() / 1000) % 100; C.vig.value = vig; C.tint.value.set(...(tint || [1, 1, 1]));
  fxPass(FX.comp, null);
}
function render3D(scene, cam, opts = {}) {
  const R = renderer3D(); if (!R) return;
  if (SET.fx && FX.ready) {
    fxSize();
    R.setRenderTarget(FX.scene); R.render(scene, cam);
    fxBloom(FX.scene.texture, opts.bloom != null ? opts.bloom : 1.1, opts.th != null ? opts.th : .55, .8);
  } else { R.setRenderTarget(null); R.render(scene, cam); }
}
const fx2DActive = () => SET.fx && FX.ready && !FX.off2D;

/* ---------- Lebendige 3D-Kulissen hinter allen 2D-Leveln (eine Welt pro Thema) ---------- */
const TINT = {nacht: [.98, .97, 1.05], meer: [.94, 1.02, 1.07], garten: [.99, 1.04, .98], arcade: [1.04, .95, 1.07], schloss: [1.06, 1, .95], laternen: [1.08, 1, .92]};
const BG = {sc: {}, off: false};
const bgActive = () => fx2DActive() && !BG.off && !!window.THREE && !!window.ZL_KIT;
function bgTex(T, key, draw, size = 256) {
  BG.tx = BG.tx || {}; if (BG.tx[key]) return BG.tx[key];
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  return (BG.tx[key] = new T.CanvasTexture(c));
}
const cloudTex = T => bgTex(T, 'cloud', (g, n) => {
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * TAU, r = Math.random() * n * .28, x = n / 2 + Math.cos(a) * r, y = n / 2 + Math.sin(a) * r * .7, rad = n * (.08 + Math.random() * .16);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }
});
function driftPoints(T, n, box, o = {}) {
  const pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * box[0]; pos[i * 3 + 1] = (Math.random() - .5) * box[1]; pos[i * 3 + 2] = (Math.random() - .5) * box[2]; ph[i] = Math.random(); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('ph', new T.BufferAttribute(ph, 1));
  const m = new T.ShaderMaterial({
    uniforms: {tm: {value: 0}, vel: {value: new T.Vector3(...(o.vel || [0, 0, 0]))}, box: {value: new T.Vector3(...box)}, ctr: {value: new T.Vector3(...(o.ctr || [0, 0, 0]))},
      sz: {value: o.size || 3}, col: {value: new T.Color(o.color || 0xffffff)}, col2: {value: new T.Color(o.color2 || o.color || 0xffffff)}, sway: {value: o.sway || 0}, tw: {value: o.twinkle || 0}, op: {value: o.op || 1}},
    vertexShader: `attribute float ph; uniform float tm; uniform vec3 vel; uniform vec3 box; uniform vec3 ctr; uniform float sz; uniform float sway; uniform float tw; varying float vA; varying float vK;
      void main(){ vec3 p = mod(position + vel * tm * (.6 + ph * .8) + box * .5, box) - box * .5 + ctr;
        p.x += sin(tm * (.6 + ph) + ph * 40.) * sway; p.y += cos(tm * (.5 + ph * .7) + ph * 30.) * sway * .5;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        vA = mix(1., .35 + .65 * (.5 + .5 * sin(tm * (1.5 + ph * 3.) + ph * 60.)), tw); vK = ph;
        float edge = min(1., min(box.y * .5 - abs(p.y - ctr.y), box.x * .5 - abs(p.x - ctr.x)) / (box.y * .08)); vA *= clamp(edge, 0., 1.);
        gl_PointSize = sz * (.6 + ph * .8) * (300. / -mv.z); }`,
    fragmentShader: `uniform vec3 col; uniform vec3 col2; uniform float op; varying float vA; varying float vK;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); a = a * a * (1.5 - d); gl_FragColor = vec4(mix(col, col2, vK) * a * vA * op, a * vA * op); }`,
    transparent: true, depthWrite: false, blending: o.normal ? T.NormalBlending : T.AdditiveBlending});
  const p = new T.Points(g, m); p.frustumCulled = false; p.userData.drift = true; return p;
}
function bgSprite(T, map, color, sx, sy, op, add = true) {
  const s = new T.Sprite(new T.SpriteMaterial({map, color, transparent: true, opacity: op, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, fog: false}));
  s.scale.set(sx, sy, 1); return s;
}
function bgBuild(T, th) {
  const K = window.ZL_KIT(API), scene = new T.Scene(), cam = new T.PerspectiveCamera(60, 1, .5, 3000), U = {upd: []};
  const glowT = K.glowTex(T), cl = cloudTex(T);
  const stars = (n, size, op) => { const p = driftPoints(T, n, [1800, 1100, 600], {ctr: [0, 120, -700], size, twinkle: 1, op, color: 0xffffff, color2: 0xffe6c8}); scene.add(p); return p; };
  const moon = (x, y, z, r, c = 0xfff3dc) => { const m = new T.Mesh(new T.CircleGeometry(r, 48), new T.MeshBasicMaterial({color: c, fog: false})); m.position.set(x, y, z); scene.add(m); const g = bgSprite(T, glowT, 0xffe6c4, r * 9, r * 9, .55); g.position.set(x, y, z - 1); scene.add(g); };
  if (th === 'nacht') {
    scene.add(K.sky(T, 0x030312, 0x16103a, 0x2a1a46, 1500));
    stars(1400, 2.2, .9); stars(500, 3.6, .8);
    const neb = [[0x6a3cc0, -260, 160, 520], [0xc04a9a, 240, -40, 480], [0x3a5ad0, 40, 300, 600], [0x8a3cb0, -120, -220, 420], [0xd06aa0, 330, 260, 380]];
    neb.forEach(([c, x, y, s], i) => { const sp = bgSprite(T, cl, c, s * 1.6, s, .5); sp.position.set(x, y, -900); sp.userData.rot = (i % 2 ? 1 : -1) * .01; scene.add(sp); U.upd.push((t) => { sp.material.rotation = t * sp.userData.rot; }); });
    moon(330, 260, -880, 26);
    const sh = bgSprite(T, glowT, 0xffffff, 90, 2.5, 0); sh.position.z = -700; scene.add(sh);
    U.upd.push(t => { const k = (t % 7) / 1.1; if (k < 1) { sh.material.opacity = Math.sin(k * Math.PI) * .9; sh.position.set(-300 + k * 520 + (Math.floor(t / 7) % 3) * 90, 330 - k * 200, -700); sh.material.rotation = -.37; } else sh.material.opacity = 0; });
  } else if (th === 'meer') {
    scene.fog = new T.FogExp2(0x062f47, .0016);
    scene.add(K.sky(T, 0x2a9ac4, 0x08466a, 0x020c18, 1500));
    for (let i = 0; i < 10; i++) {
      const r = new T.Mesh(new T.PlaneGeometry(rnd(40, 90), 1400), new T.MeshBasicMaterial({color: 0xbff0ff, transparent: true, opacity: .05, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false}));
      r.position.set(rnd(-500, 500), 300, rnd(-900, -500)); r.rotation.z = rnd(-.35, .15); scene.add(r); const ph = rnd(0, 6);
      U.upd.push(t => { r.material.opacity = .035 + Math.sin(t * .6 + ph) * .025; });
    }
    scene.add(driftPoints(T, 700, [1400, 900, 700], {ctr: [0, 0, -500], vel: [4, -9, 0], size: 2.2, sway: 6, op: .7, color: 0xd8f4ff}));
    scene.add(driftPoints(T, 160, [1000, 900, 500], {ctr: [0, 0, -400], vel: [0, 30, 0], size: 4, sway: 8, op: .55, color: 0xe6fbff}));
    const fishG = new T.ConeGeometry(2.2, 9, 5); fishG.rotateX(-Math.PI / 2);
    for (let s = 0; s < 3; s++) {
      const n = 34, im = new T.InstancedMesh(fishG, new T.MeshBasicMaterial({color: [0x0f5a7a, 0x1a6a8a, 0x2a4a7a][s]}), n), o = new T.Object3D(), off = Array.from({length: n}, () => [rnd(-18, 18), rnd(-10, 10), rnd(-18, 18), rnd(0, 6)]);
      const cx = [-260, 220, 0][s], cy = [80, -60, 200][s], cz = [-650, -780, -900][s], R = rnd(70, 120), sp = rnd(.12, .2) * (s % 2 ? 1 : -1);
      scene.add(im);
      U.upd.push(t => { const a = t * sp; off.forEach((f, i) => { o.position.set(cx + Math.cos(a + f[3] * .05) * R + f[0], cy + f[1] + Math.sin(t * 2 + i) * 2, cz + Math.sin(a + f[3] * .05) * R * .5 + f[2]); o.rotation.set(0, -a + (sp > 0 ? Math.PI : 0), 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.instanceMatrix.needsUpdate = true; });
    }
    for (let i = 0; i < 6; i++) {
      const j = new T.Mesh(new T.SphereGeometry(14, 16, 8, 0, TAU, 0, Math.PI / 2), new T.MeshBasicMaterial({color: 0xd9a8ff, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false}));
      const gs = bgSprite(T, glowT, 0xc89cff, 90, 90, .35); j.add(gs); j.position.set(rnd(-450, 450), rnd(-250, 250), rnd(-800, -500)); scene.add(j); const ph = rnd(0, 6), y0 = j.position.y;
      U.upd.push(t => { const s = 1 + Math.sin(t * 2 + ph) * .12; j.scale.set(s, 1 / s, s); j.position.y = y0 + ((t * 6 + ph * 40) % 120) - 60; });
    }
  } else if (th === 'garten') {
    scene.fog = new T.FogExp2(0x0c1c1c, .0011);
    scene.add(K.sky(T, 0x050b18, 0x122a33, 0x0a160f, 1500));
    stars(600, 2, .6); moon(-140, 330, -900, 22, 0xfff6e8);
    const trunk = new T.MeshBasicMaterial({color: 0x07110c}), leaf = [0x0b1d14, 0x0e2418, 0x112a1a].map(c => new T.MeshBasicMaterial({color: c}));
    for (let i = 0; i < 46; i++) {
      const x = rnd(-900, 900), z = rnd(-1100, -350), s = rnd(.7, 1.6), g = new T.Group();
      const tr = new T.Mesh(new T.CylinderGeometry(4, 7, 60, 6), trunk); tr.position.y = 30; g.add(tr);
      for (let k = 0; k < 3; k++) { const b = new T.Mesh(new T.SphereGeometry(rnd(26, 40), 10, 8), leaf[(i + k) % 3]); b.position.set(rnd(-18, 18), 70 + k * 18, rnd(-10, 10)); g.add(b); }
      g.position.set(x, -260, z); g.scale.setScalar(s); scene.add(g);
    }
    const hill = new T.Mesh(new T.SphereGeometry(1400, 32, 12), new T.MeshBasicMaterial({color: 0x08140d})); hill.position.set(0, -1640, -900); scene.add(hill);
    scene.add(driftPoints(T, 220, [1400, 700, 700], {ctr: [0, -40, -500], vel: [3, 4, 0], size: 5, sway: 30, twinkle: 1, op: .95, color: 0xe6ff9a, color2: 0xfff2a0}));
    scene.add(driftPoints(T, 140, [1300, 900, 600], {ctr: [0, 0, -450], vel: [18, -22, 0], size: 4.5, sway: 25, op: .7, color: 0xffb8d0, color2: 0xfff0f5, normal: true}));
  } else if (th === 'arcade') {
    scene.add(K.sky(T, 0x05031a, 0x2a0a4a, 0x08021a, 1500));
    stars(700, 2.2, .8);
    const sun = new T.Mesh(new T.CircleGeometry(230, 64), new T.ShaderMaterial({uniforms: {tm: {value: 0}}, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float tm; varying vec2 vUv; void main(){ vec3 c = mix(vec3(1., .35, .62), vec3(1., .86, .45), vUv.y); float band = step(.5, fract(vUv.y * 14. - tm * .4)); float cut = vUv.y < .5 ? mix(band, 1., smoothstep(.1, .5, vUv.y)) : 1.; gl_FragColor = vec4(c * 1.15, cut); }'}));
    sun.position.set(0, 60, -1300); scene.add(sun); U.upd.push(t => { sun.material.uniforms.tm.value = t; });
    const sg = bgSprite(T, glowT, 0xff6fa8, 1100, 800, .45); sg.position.set(0, 60, -1310); scene.add(sg);
    const grid = new T.Mesh(new T.PlaneGeometry(6000, 3000), new T.ShaderMaterial({uniforms: {tm: {value: 0}}, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float tm; varying vec2 vUv; varying float vD; void main(){ vec2 g = vec2(vUv.x * 120., vUv.y * 60. + tm * 2.); vec2 f = abs(fract(g) - .5); float l = 1. - smoothstep(0., .06 + vD * .00004, min(f.x, f.y)); float fade = clamp(1. - vD / 1400., 0., 1.); gl_FragColor = vec4(vec3(.75, .4, 1.) * l * 1.4 * fade + vec3(.05, .01, .1) * fade, max(l * fade, .6 * fade)); }'}));
    grid.rotation.x = -Math.PI / 2; grid.position.set(0, -140, -1300); scene.add(grid); U.upd.push(t => { grid.material.uniforms.tm.value = t; });
    const mm = new T.MeshBasicMaterial({color: 0x0a0418}), lm = new T.LineBasicMaterial({color: 0xff4fb0, transparent: true, opacity: .7});
    for (let i = 0; i < 14; i++) {
      const h = rnd(90, 220), cg = new T.ConeGeometry(rnd(140, 240), h, 4 + (i % 3), 3), m = new T.Mesh(cg, mm);
      const x = (i - 6.5) * 170 + rnd(-40, 40); m.position.set(x, -140 + h / 2, -1150 - rnd(0, 80)); m.rotation.y = rnd(0, 1);
      m.add(new T.LineSegments(new T.EdgesGeometry(cg), lm)); scene.add(m);
    }
  } else if (th === 'schloss') {
    scene.fog = new T.Fog(0xe0907a, 600, 1700);
    scene.add(K.sky(T, 0x2a2a70, 0xd0708a, 0xffb27a, 1500));
    const sun = bgSprite(T, glowT, 0xffd8a0, 900, 900, .8); sun.position.set(200, -40, -1200); scene.add(sun);
    const sd = new T.Mesh(new T.CircleGeometry(60, 48), new T.MeshBasicMaterial({color: 0xfff0d0, fog: false})); sd.position.set(200, -40, -1190); scene.add(sd);
    const hills = new T.MeshBasicMaterial({color: 0x3a2050});
    for (const [x, r, z] of [[-500, 700, -1100], [400, 800, -1150], [0, 600, -900]]) { const h = new T.Mesh(new T.SphereGeometry(r, 32, 12), hills); h.position.set(x, -260 - r * .85, z); scene.add(h); }
    const cm = new T.MeshBasicMaterial({color: 0x2a1640}), castle = new T.Group();
    for (const [x, w, h, roof] of [[-60, 40, 160, 1], [0, 90, 110, 0], [60, 40, 190, 1], [-110, 30, 120, 1], [115, 34, 130, 1]]) {
      const b = new T.Mesh(new T.BoxGeometry(w, h, 40), cm); b.position.set(x, h / 2, 0); castle.add(b);
      if (roof) { const c = new T.Mesh(new T.ConeGeometry(w * .75, w * 1.4, 8), cm); c.position.set(x, h + w * .7, 0); castle.add(c); }
      const win = new T.Mesh(new T.PlaneGeometry(6, 10), new T.MeshBasicMaterial({color: 0xffd28a, fog: false})); win.position.set(x, h * .7, 21); castle.add(win);
    }
    castle.position.set(-320, -150, -1000); scene.add(castle);
    for (let i = 0; i < 22; i++) {
      const c = [0xffc8d8, 0xffd0a8, 0xd8b8ff, 0xffe8f0][i % 4], s = rnd(160, 360), sp = bgSprite(T, cl, c, s * 2, s * .7, rnd(.35, .7), false);
      sp.material.fog = true; sp.position.set(rnd(-1000, 1000), rnd(-60, 420), rnd(-1300, -500)); scene.add(sp); const v = rnd(4, 12);
      U.upd.push((t, dt) => { sp.position.x += v * dt; if (sp.position.x > 1200) sp.position.x = -1200; });
    }
    scene.add(driftPoints(T, 120, [1400, 800, 600], {ctr: [0, 0, -500], vel: [10, 6, 0], size: 3, sway: 20, op: .6, color: 0xfff0d8}));
  } else if (th === 'laternen') {
    scene.fog = new T.FogExp2(0x2a1428, .0009);
    scene.add(K.sky(T, 0x07050f, 0x241030, 0x4a2030, 1500));
    stars(400, 2, .5);
    const roof = new T.MeshBasicMaterial({color: 0x0e0814}), win = new T.MeshBasicMaterial({color: 0xffc070});
    for (let i = 0; i < 40; i++) {
      const w = rnd(60, 130), h = rnd(80, 260), x = -1100 + i * 58 + rnd(-20, 20), z = rnd(-900, -700), b = new T.Mesh(new T.BoxGeometry(w, h, 40), roof); b.position.set(x, -300 + h / 2, z); scene.add(b);
      const r = new T.Mesh(new T.ConeGeometry(w * .75, 40, 4), roof); r.rotation.y = Math.PI / 4; r.position.set(x, -300 + h + 20, z); scene.add(r);
      for (let k = 0; k < 4; k++) if (Math.random() < .55) { const wm = new T.Mesh(new T.PlaneGeometry(8, 11), win); wm.position.set(x + rnd(-w * .35, w * .35), -300 + rnd(20, h - 20), z + 21); scene.add(wm); }
    }
    const N = 90, lg = new T.CylinderGeometry(6, 4.5, 12, 10, 1, true), lm = new T.MeshBasicMaterial({color: 0xffa860, side: T.DoubleSide, transparent: true, opacity: .95});
    const im = new T.InstancedMesh(lg, lm, N), o = new T.Object3D(), L = Array.from({length: N}, () => ({x: rnd(-1100, 1100), y: rnd(-300, 700), z: rnd(-1000, -250), v: rnd(10, 22), p: rnd(0, 6)}));
    const cols = [new T.Color(0xffa860), new T.Color(0xff8a70), new T.Color(0xffc080), new T.Color(0xf4a8b8)];
    L.forEach((l, i) => im.setColorAt(i, cols[i % 4]));
    scene.add(im);
    const gp = new Float32Array(N * 3), gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(gp, 3));
    const glowP = new T.Points(gg, new T.PointsMaterial({color: 0xffb070, size: 60, map: glowT, transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending})); glowP.frustumCulled = false; scene.add(glowP);
    U.upd.push((t, dt) => { L.forEach((l, i) => { l.y += l.v * dt; if (l.y > 750) l.y = -320; const x = l.x + Math.sin(t * .4 + l.p) * 14; o.position.set(x, l.y, l.z); o.rotation.set(0, 0, Math.sin(t + l.p) * .08); o.updateMatrix(); im.setMatrixAt(i, o.matrix); gp[i * 3] = x; gp[i * 3 + 1] = l.y; gp[i * 3 + 2] = l.z; }); im.instanceMatrix.needsUpdate = true; gg.attributes.position.needsUpdate = true; });
    scene.add(driftPoints(T, 50, [1400, 900, 400], {ctr: [0, 0, -300], vel: [0, 8, 0], size: 26, sway: 20, op: .22, color: 0xffb070, color2: 0xf4a8b8}));
  }
  return {scene, cam, U};
}
function bgRender(th, t) {
  const T = window.THREE;
  let B = BG.sc[th];
  if (!B) { try { B = BG.sc[th] = bgBuild(T, th); } catch (e) { console.error(e); BG.off = true; return; } }
  const dt = Math.min(.05, BG.lt ? t - BG.lt : .016); BG.lt = t;
  const L = curL(), two = S.ok && S.lv >= 0 && L && !L.three;
  const px = two ? clamp(mine.x / W - .5, -.6, .6) : 0, py = two ? clamp(mine.y / H - .5, -.6, .6) : 0;
  BG.px = (BG.px || 0) + (px - (BG.px || 0)) * Math.min(1, dt * 2); BG.py = (BG.py || 0) + (py - (BG.py || 0)) * Math.min(1, dt * 2);
  const c = B.cam; c.aspect = cw / ch; c.fov = cw < ch ? 70 : 55; c.updateProjectionMatrix();
  c.position.set(BG.px * 40 + Math.sin(t * .07) * 12, -BG.py * 30 + Math.cos(t * .05) * 6, 0); c.lookAt(BG.px * 14, -BG.py * 10 + 20, -400);
  B.scene.traverse(o => { if (o.userData.drift) o.material.uniforms.tm.value = t; });
  B.U.upd.forEach(f => f(t, dt));
  gl.setRenderTarget(FX.scene); gl.clear(); gl.render(B.scene, c);
}


/* ---------- API für Level-Pakete ---------- */
const API = {
  S, LOC, ctx, W, H, R, TAU, VMAX, COL, CA, CD, CG, NOTES, SONG_NOTES, rgba, dist, rnd, clamp, nm, OTH, fmt, lerpA,
  place, START, drift, stunStep, emit, finish, failRestart, teleport, act, hostNow, tone, buzz, toast, diff,
  glow, dotW, label, line2, heartPath, rr, defaultMove, inputX, desiredDir, desiredHeading, speedMul, mine, ghost, pend,
  need3D, renderer3D, render3D, disposeTree, SKINS, shake: a => { shakeAmt = Math.max(shakeAmt, a); }, partner: () => partnerAt(performance.now()),
  screen: () => ({cw, ch, ox, oy, sc, dpr}),
  get me() { return me; }, get other() { return other; }, get role() { return role; }, get SET() { return SET; }
};
const ALL = {}; (window.ZL_PACKS || []).flatMap(f => f(API)).forEach(l => ALL[l.id] = l);
const LV = ORDER.filter(([id]) => ALL[id]).map(([id, w]) => Object.assign(ALL[id], {w}));
const IDX = {}; LV.forEach((l, i) => IDX[l.id] = i);

/* ---------- Spielablauf (rechnet beim Gastgeber) ---------- */
function mkP(k, L) {
  const s = L && L.start ? L.start(k) : {x: k === 'a' ? W * .35 : W * .65, y: H * .9};
  return {x: s.x, y: s.y, lit: 1, inv: 2, out: 0, carry: 0, tp: 0, e: null};
}
function newState() {
  clearObj(S);
  Object.assign(S, {ok: 1, v: VERSION, phase: 'card', card: 'welcome', lv: -1, t: 0, sid: 0, items: [], aux: {}, count: 0, total: 0, cur: 0,
    ready: {a: 0, d: 0}, done: 0, finT: 0, lt: 0, countT: 0, stars: {}, startLv: 0, quiz: null, pausedBy: null, away: null, rtt: 0, diff: 1,
    p: {a: mkP('a'), d: mkP('d')}});
}
function setupLevel(n, quick) {
  const L = LV[n];
  Object.assign(S, {phase: quick ? 'count' : 'intro', card: '', lv: n, items: [], aux: {}, count: 0, total: 0, cur: 0, ready: {a: 0, d: 0},
    done: 0, finT: 0, lt: S.t, countT: S.t + 3.2, quiz: null, pausedBy: null});
  S.sid++;
  const tpa = S.p.a.tp || 0, tpd = S.p.d.tp || 0;
  S.p.a = mkP('a', L); S.p.d = mkP('d', L); S.p.a.tp = tpa; S.p.d.tp = tpd;
  try { L.setup(); } catch (e) { console.error(e); }
  save(n);
}
function update(dt) {
  if (S.pausedBy || S.away) return;
  S.t += dt;
  for (const k of ['a', 'd']) if (S.p[k].inv > 0) S.p[k].inv = Math.max(0, S.p[k].inv - dt);
  const L = curL();
  if (S.phase === 'count' && S.t >= S.countT) { S.phase = 'play'; S.lt = S.t; }
  if (S.phase === 'play' && !S.done && L) { try { L.update(dt); } catch (e) { console.error(e); } }
  if (S.phase === 'play' && S.done && S.t >= S.finT) advance();
  if (S.phase === 'quiz' && S.quiz.reveal && S.t > S.quiz.revealT) {
    const Q = S.quiz;
    if (Q.i + 1 < Q.n) { Q.i++; Q.asker = OTH(Q.asker); Q.pick = {a: -1, d: -1}; Q.reveal = 0; }
    else setupLevel(Q.next);
  }
}
function advance() {
  const L = curL();
  S.done = 0; S.ready = {a: 0, d: 0};
  if (S.lv >= LV.length - 1) { S.phase = 'end'; save(0); }
  else { S.phase = 'card'; S.card = LV[S.lv + 1].w !== L.w ? 'world' : 'level'; }
}
const readyKeyNow = () => `${S.phase}:${S.card}:${S.lv}:${S.sid}`;
function checkReady(force) {
  if (!force && (!S.ready.a || !S.ready.d)) return;
  if (S.phase === 'intro') { S.phase = 'count'; S.countT = S.t + 3.2; S.ready = {a: 0, d: 0}; return; }
  if (S.phase !== 'card') return;
  if (S.card === 'welcome') setupLevel(S.startLv || 0);
  else if (S.card === 'world') startQuiz(LV[S.lv].w, S.lv + 1);
  else setupLevel(S.lv + 1);
}
function startQuiz(w, next) {
  S.phase = 'quiz';
  S.quiz = {base: w * 4, i: 0, n: 4, asker: w % 2 ? 'd' : 'a', pick: {a: -1, d: -1}, reveal: 0, revealT: 0, score: 0, next};
}
function checkQuiz() {
  const Q = S.quiz;
  if (!Q || Q.reveal || Q.pick.a < 0 || Q.pick.d < 0) return;
  Q.reveal = 1; Q.revealT = S.t + (Q.i === Q.n - 1 ? 4.5 : 3);
  if (Q.pick.a === Q.pick.d) { Q.score++; emit({k: 'gold', x: W / 2, y: H * .4}); } else emit({k: 'tick', x: W / 2, y: H * .4, o: 'x'});
}
function handleAct(k, d) {
  if (!d || !S.ok) return;
  if (d.k === 'pause') { S.pausedBy = d.v ? k : null; return; }
  if (d.k === 'restart') { if (S.lv >= 0 && ['play', 'count', 'intro'].includes(S.phase)) setupLevel(S.lv, true); return; }
  const L = curL();
  if (S.phase === 'play' && !S.done && L && L.action) { try { L.action(k, d); } catch (e) { console.error(e); } }
}
function save(lv) { try { localStorage.setItem('zl4-save', JSON.stringify({lv, id: LV[lv] ? LV[lv].id : '', stars: S.stars, diff: S.diff || 1})); } catch (e) {} }
function loadSave() { try { return JSON.parse(localStorage.getItem('zl4-save')) || null; } catch (e) { return null; } }

/* ---------- Master Control (nur Daniel) ---------- */
const MC = {
  startNow() {
    if (S.phase === 'intro') { S.phase = 'count'; S.countT = S.t + 1.6; S.ready = {a: 0, d: 0}; }
    else if (S.phase === 'count') { S.phase = 'play'; S.lt = S.t; }
    else if (S.phase === 'card') checkReady(true);
    else if (S.phase === 'quiz') { setupLevel(S.quiz.next); }
  },
  restart() { if (S.lv >= 0) setupLevel(S.lv, S.phase === 'play'); },
  skip() {
    if (S.lv < 0) return;
    if (S.phase === 'play' || S.phase === 'count' || S.phase === 'intro') {
      S.lastStars = 0; S.lastTime = S.t - S.lt; S.lastNote = 'übersprungen'; advance();
    } else if (S.phase === 'card') checkReady(true);
  },
  jump(i) { setupLevel(i); },
  pause() { S.pausedBy = S.pausedBy ? null : me; },
  setDiff(v) { S.diff = v; save(Math.max(0, S.lv)); },
  reset() { S.stars = {}; save(0); }
};

/* ---------- Netzwerk ---------- */
const PEERCFG = {debug: 0, config: {iceServers: [
  {urls: 'stun:stun.l.google.com:19302'}, {urls: 'stun:stun1.l.google.com:19302'},
  {urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp'}
]}};
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({length: 4}, () => ALPH[(Math.random() * ALPH.length) | 0]).join('');
const PID = c => 'zwei-lichter-reise-' + c;
const OVS = ['ovStart', 'ovHost', 'ovGuest'];
const show = id => OVS.forEach(o => $(o).hidden = o !== id);
const hideAll = () => OVS.forEach(o => $(o).hidden = true);
const rounder = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v;
let wakeLock = null;
async function wake() { try { if (navigator.wakeLock && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } } catch (e) {} }
document.addEventListener('visibilitychange', () => {
  const vis = document.visibilityState === 'visible';
  if (vis && loopOn) wake();
  if (role === 'guest' && conn && conn.open) { try { conn.send({t: 'vis', v: vis ? 1 : 0}); } catch (e) {} }
  if (vis) last = performance.now();
});
function noPeer() { if (window.Peer) return false; alert('Die Verbindungs-Bibliothek konnte nicht geladen werden. Bitte Seite neu laden.'); return true; }
const fastOpen = () => fconn && fconn.open ? fconn : (conn && conn.open ? conn : null);

function hostStart() {
  if (noPeer()) return;
  role = 'host'; me = 'd'; other = 'a';
  document.body.classList.add('host');
  show('ovHost');
  const sv = loadSave();
  if (sv && sv.id && IDX[sv.id] > 0) {
    startLv = IDX[sv.id];
    $('hCont').hidden = false;
    $('hResume').textContent = `Weiter: ${LV[startLv].n}`;
    const pick = lv => { startLv = lv; $('hResume').className = 'btn small ' + (lv ? 'sel' : 'ghost'); $('hFresh').className = 'btn small ' + (lv ? 'ghost' : 'sel'); if (S.ok && S.card === 'welcome') S.startLv = lv; };
    const keep = startLv;
    $('hResume').onclick = () => pick(keep); $('hFresh').onclick = () => pick(0);
  }
  let code = null;
  try { const r = JSON.parse(localStorage.getItem('zl-room')); if (r && Date.now() - r.ts < 12 * 3600e3) code = r.code; } catch (e) {}
  openRoom(code || genCode(), 0);
}
function openRoom(code, tries) {
  lastCode = code;
  try { localStorage.setItem('zl-room', JSON.stringify({code, ts: Date.now()})); } catch (e) {}
  $('hStatus').innerHTML = `<span class="dots">${tries ? 'Raum wird neu geöffnet' : 'Raum wird geöffnet'}</span>`; $('hStatus').className = 'status';
  try { peer && peer.destroy(); } catch (e) {}
  peer = new Peer(PID(code), PEERCFG);
  peer.on('open', () => {
    $('hCode').textContent = code;
    const link = location.origin + location.pathname + '?raum=' + code;
    $('hWa').href = 'https://wa.me/?text=' + encodeURIComponent(`${nm('a')}, komm spielen 💛 ${link}`);
    $('hShare').onclick = async () => { try { if (navigator.share) await navigator.share({title: 'Zwei Lichter', text: `${nm('a')}, komm spielen 💛`, url: link}); else copy(link); } catch (e) {} };
    $('hCopy').onclick = () => copy(link);
    $('hStatus').innerHTML = `<span class="dots">Warte auf ${nm('a')}</span>`;
  });
  peer.on('error', err => {
    if (err.type === 'unavailable-id') { if (tries < 4) setTimeout(() => openRoom(code, tries + 1), 2500); else openRoom(genCode(), 0); return; }
    if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type)) { $('hStatus').innerHTML = '<span class="dots">Verbindung zum Server wird wiederhergestellt</span>'; return; }
    if (err.type !== 'peer-unavailable') { $('hStatus').textContent = 'Fehler: ' + err.type; $('hStatus').className = 'status err'; }
  });
  peer.on('disconnected', () => setTimeout(() => { try { if (!peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) {} }, 1500));
  peer.on('connection', onHostConn);
}
function onHostData(c, d) {
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
  if (!d || !S.ok) return;
  lastPosRecv = performance.now();
  if (S.away === other && d.t !== 'vis') S.away = null;
  switch (d.t) {
    case 'pos':
      if (d.q && d.q <= lastPQ) return; if (d.q) lastPQ = d.q;
      if (d.sid === S.sid && (d.tp || 0) === (S.p[other].tp || 0)) { S.p[other].x = d.x; S.p[other].y = d.y; S.p[other].e = d.e || null; pushPartner(d.x, d.y, d.e); }
      break;
    case 'ready': if (d.key === readyKeyNow()) { S.ready[other] = 1; checkReady(); } break;
    case 'pick': if (S.quiz && d.key === quizKey() && S.quiz.pick[other] < 0 && !S.quiz.reveal) { S.quiz.pick[other] = d.v; checkQuiz(); } break;
    case 'act': handleAct(other, d.d); break;
    case 'pong': S.rtt = Math.round(performance.now() - d.ts); break;
    case 'vis': S.away = d.v ? null : other; break;
  }
}
function onHostConn(c) {
  c.on('open', () => {
    if (c.label === 'fast') { if (fconn && fconn !== c) { try { fconn.close(); } catch (e) {} } fconn = c; return; }
    if (conn && conn !== c) { try { conn.close(); } catch (e) {} }
    conn = c; lastPosRecv = performance.now(); lastPQ = 0;
    if (!S.ok) {
      newState(); S.startLv = startLv;
      const sv = loadSave(); if (sv && sv.stars && typeof sv.stars === 'object') S.stars = sv.stars; if (sv && sv.diff) S.diff = sv.diff;
    }
    S.away = null; lastFull = 0;
    hideAll(); startLoop(); sendState();
  });
  c.on('data', d => { if (c === conn || c === fconn) onHostData(c, d); });
  c.on('close', () => { if (c === conn) { conn = null; if (S.ok) S.away = other; } if (c === fconn) fconn = null; });
  c.on('error', () => {});
}
function copy(t) {
  const done = () => { $('hCopy').textContent = 'Kopiert ✓'; setTimeout(() => $('hCopy').textContent = 'Kopieren', 1800); };
  try { navigator.clipboard.writeText(t).then(done, () => prompt('Link kopieren:', t)); } catch (e) { prompt('Link kopieren:', t); }
}
let reconT = null, reconTries = 0;
function guestJoin() {
  if (noPeer()) return;
  const code = $('gCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { gStatus('Der Code hat 4 Zeichen.', true); return; }
  role = 'guest'; me = 'a'; other = 'd'; lastCode = code;
  try { localStorage.setItem('zl-gcode', code); } catch (e) {}
  gStatus('<span class="dots">Verbinde</span>');
  $('gJoin').disabled = true;
  makeGuestPeer(() => connectTo(code));
}
function makeGuestPeer(cb) {
  if (peer && !peer.destroyed && peer.open && !peer.disconnected) { cb(); return; }
  try { peer && peer.destroy(); } catch (e) {}
  peer = new Peer(PEERCFG);
  peer.on('open', cb);
  peer.on('error', err => {
    $('gJoin').disabled = false;
    const msg = err.type === 'peer-unavailable' ? `Raum nicht gefunden. Ist ${nm('d')} schon im Raum? Code prüfen.` : 'Verbindung klappt gerade nicht (' + err.type + ').';
    if (!S.ok) gStatus(msg, true); else $('lStatus').textContent = msg;
  });
  peer.on('disconnected', () => setTimeout(() => { try { if (!peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) {} }, 1500));
}
function gStatus(h, err) { $('gStatus').innerHTML = h; $('gStatus').className = 'status' + (err ? ' err' : ''); }
let staticStore = {sid: -1, vals: {}};
function onGuestData(c, d) {
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
  if (!d) return;
  if (d.t === 'ping') { try { c.send({t: 'pong', ts: d.ts}); } catch (e) {} return; }
  if (d.t === 'ev') { (d.ev || []).forEach(e => { try { fx(e); } catch (er) {} }); return; }
  if (d.t !== 's' || !d.s) return;
  if (d.s.v !== VERSION) { $('ovVersion').hidden = false; return; }
  if (d.h !== hostSess) { hostSess = d.h; lastQ = 0; }
  if (d.q <= lastQ) return;
  lastQ = d.q;
  lastRecv = performance.now();
  const L = LV[d.s.lv];
  if (L && L.staticAux && d.s.aux) {
    if (d.full) { staticStore = {sid: d.s.sid, vals: {}}; L.staticAux.forEach(k => staticStore.vals[k] = d.s.aux[k]); }
    else if (staticStore.sid === d.s.sid) L.staticAux.forEach(k => { if (d.s.aux[k] === undefined) d.s.aux[k] = staticStore.vals[k]; });
  }
  clearObj(S); Object.assign(S, d.s);
  const est = S.t + (S.rtt || 0) / 2000 - performance.now() / 1000;
  if (clockOff == null || Math.abs(est - clockOff) > .3) clockOff = est; else clockOff += (est - clockOff) * .08;
  if (readyKey && readyKey === readyKeyNow()) S.ready[me] = 1;
  if (pickMemo && S.quiz && pickMemo.key === quizKey() && S.quiz.pick[me] < 0) S.quiz.pick[me] = pickMemo.v;
  if (S.sid === lastSid) pushPartner(S.p[other].x, S.p[other].y, S.p[other].e);
}
function connectTo(code) {
  let c, f;
  try { c = peer.connect(PID(code), {reliable: true, serialization: 'json', label: 'main'}); } catch (e) { return; }
  if (!c) return;
  conn = c; lastQ = 0;
  const slow = setTimeout(() => { if (!c.open && !S.ok) gStatus('<span class="dots">Dauert etwas länger</span>'); }, 7000);
  c.on('open', () => {
    clearTimeout(slow); clearTimeout(reconT); reconTries = 0;
    lastRecv = performance.now();
    hideAll(); $('ovLost').hidden = true; startLoop(); $('gJoin').disabled = false;
    try { c.send({t: 'hello', v: VERSION}); } catch (e) {}
    try {
      f = peer.connect(PID(code), {reliable: false, serialization: 'json', label: 'fast'});
      if (f) { f.on('open', () => { fconn = f; }); f.on('data', d => onGuestData(f, d)); f.on('close', () => { if (fconn === f) fconn = null; }); f.on('error', () => {}); }
    } catch (e) {}
  });
  c.on('data', d => { if (c === conn) onGuestData(c, d); });
  c.on('close', () => { if (c === conn) lost(); });
  c.on('error', () => {});
}
function lost() {
  conn = null; fconn = null;
  if (role !== 'guest') return;
  $('ovLost').hidden = false;
  $('lText').textContent = `Die Verbindung zu ${nm('d')} ist weg. Ich versuche es automatisch weiter – oder tippe auf „Neu verbinden“.`;
  scheduleRecon();
}
function scheduleRecon() {
  clearTimeout(reconT);
  reconT = setTimeout(() => {
    if (conn && conn.open) return;
    reconTries++;
    $('lStatus').innerHTML = `<span class="dots">Versuch ${reconTries}</span>`;
    makeGuestPeer(() => connectTo(lastCode));
    scheduleRecon();
  }, reconTries ? 4000 : 1200);
}
$('lRe').onclick = () => { reconTries = 0; try { peer && peer.destroy(); } catch (e) {} peer = null; scheduleRecon(); };
$('vRe').onclick = () => location.reload();
$('bHost').onclick = () => { audio(); hostStart(); };
$('bGuest').onclick = () => {
  audio(); show('ovGuest');
  if (!$('gCode').value) { try { $('gCode').value = localStorage.getItem('zl-gcode') || ''; } catch (e) {} }
  setTimeout(() => $('gCode').focus(), 50);
};
$('gJoin').onclick = () => { audio(); guestJoin(); };
$('gCode').addEventListener('keydown', e => { if (e.key === 'Enter') { audio(); guestJoin(); } });
$('gCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
const qs = new URLSearchParams(location.search).get('raum');
if (qs) {
  $('gCode').value = qs.toUpperCase().slice(0, 4);
  $('gKick').textContent = 'Für dich';
  $('gTitle').textContent = `Hallo ${nm('a')} ✨`;
  $('gSub').textContent = `${nm('d')} wartet schon im Raum auf dich.`;
  show('ovGuest');
}
let lastFull = 0, lastFullSid = -1;
function sendState() {
  const ch1 = fastOpen();
  if (outEv.length && conn && conn.open) { try { conn.send({t: 'ev', ev: outEv}); } catch (e) {} }
  outEv = [];
  if (!ch1) return;
  const dc = ch1.dataChannel;
  if (dc && dc.bufferedAmount > 65536) return;
  const L = curL(), now = performance.now();
  let s = S, full = 1;
  if (L && L.staticAux && S.aux) {
    if (S.sid === lastFullSid && now - lastFull < 1500) {
      full = 0; const aux = Object.assign({}, S.aux); L.staticAux.forEach(k => delete aux[k]); s = Object.assign({}, S, {aux});
    } else { lastFull = now; lastFullSid = S.sid; }
  }
  try { ch1.send(JSON.stringify({t: 's', q: ++sseq, h: SESS, full, s}, rounder)); } catch (e) {}
}

/* ---------- Oberfläche: Karten, Quiz, Menü, Master Control ---------- */
let cardKey = '';
const quizKey = () => S.quiz ? `${S.quiz.base}:${S.quiz.i}` : '';
const starsHTML = n => `<div class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></div>`;
const legend = () => `<div class="legend"><span><i style="background:var(--a)"></i>${esc(nm('a'))}</span><span><i style="background:var(--d)"></i>${esc(nm('d'))}</span></div>`;
function ctrlText(L) {
  if (L.ctrlText) return L.ctrlText(SET.ctrl);
  const m = SET.ctrl;
  const base = {
    free: {swipe: 'Wische irgendwo, um dich zu bewegen.', stick: 'Daumen auflegen und ziehen – wie ein Joystick.', tap: 'Halte den Finger dorthin, wo du hin willst.', tilt: 'Neige dein Handy in die Richtung.'},
    paddle: {swipe: 'Wische nach links und rechts für deinen Schläger.', stick: 'Joystick nach links und rechts.', tap: 'Halte den Finger über die Stelle, wo der Schläger hin soll.', tilt: 'Kipp das Handy nach links und rechts.'},
    steer: {swipe: 'Du fährst von selbst – wische in die neue Richtung.', stick: 'Lenk mit dem Joystick.', tap: 'Tippe dorthin, wo du hinwillst.', tilt: 'Lenk durch Neigen.'},
    hop: {swipe: 'Kurz tippen = ein Feld vor. Wischen = in die Richtung hüpfen.', stick: 'Joystick kurz in eine Richtung drücken.', tap: 'Tippe neben dich, in die Richtung des Sprungs.', tilt: 'Kurz kippen = ein Hüpfer.'},
    grid: {swipe: 'Wische in die Richtung, in die du abbiegen willst.', stick: 'Joystick in die neue Richtung.', tap: 'Tippe in die Richtung, in die du willst.', tilt: 'Neige in die neue Richtung.'},
    drive: {swipe: 'Gas gibt das Auto selbst. Finger auflegen und nach links/rechts ziehen zum Lenken.', stick: 'Lenk mit dem Joystick.', tap: 'Linke oder rechte Bildschirmhälfte halten zum Lenken.', tilt: 'Lenk durch Kippen – wie ein Lenkrad.'},
    fly: {swipe: 'Du schwimmst von selbst. Wische, um nach oben, unten und zur Seite zu steuern.', stick: 'Steuer mit dem Joystick.', tap: 'Halte den Finger in die Richtung, in die du schwimmen willst.', tilt: 'Neige das Handy zum Steuern.'},
    buttons: {swipe: 'Unten links: ◀ ▶ laufen · unten rechts: springen.', stick: 'Unten links: ◀ ▶ laufen · unten rechts: springen.', tap: 'Unten links: ◀ ▶ laufen · unten rechts: springen.', tilt: 'Neigen zum Laufen · rechts unten tippen zum Springen.'}
  }[L.ctrl || 'free'];
  return (base && base[m]) || '';
}
const CTRL_ICON = L => L.ctrl === 'tap' ? 'tap' : L.ctrl === 'buttons' ? 'pad' : L.ctrl === 'drive' ? 'wheel' : SET.ctrl;
function buildCard() {
  const box = $('cardBox');
  if (S.phase === 'quiz') { buildQuiz(box); return; }
  let html = '';
  const L = curL();
  if (S.phase === 'end') {
    const tot = Object.values(S.stars).reduce((s, v) => s + (v || 0), 0);
    html = `<p class="kicker">Alle Welten geschafft</p><h2>${esc(CFG.finale.title)}</h2>
      <p class="msg">${esc(CFG.finale.text)}</p><p class="sign">${esc(CFG.finale.sign)}</p>
      <p class="time">Eure Sterne: <b>${tot} von ${LV.length * 3}</b></p>
      ${role === 'host' ? '<button class="btn" id="cBtn">Nochmal spielen</button><button class="btn ghost" id="cMC">Master Control</button>' : `<p class="hint">${esc(nm('d'))} kann jederzeit eine neue Runde starten.</p>`}`;
  } else if (S.phase === 'intro' && L) {
    const sk = L.skinName ? `<span class="chip">${esc(L.skinName())}</span>` : '';
    html = `<div class="chips"><span class="chip">Welt ${L.w + 1} · ${WORLDS[L.w].n}</span><span class="chip">Level ${S.lv + 1}/${LV.length}</span>${sk}</div>
      <h2>${esc(L.n)}</h2><p class="hint big">${esc(L.h(me))}</p>
      <div class="ctrl"><span class="cico">${ICON[CTRL_ICON(L)] || ''}</span><span>${esc(ctrlText(L))}</span>${['tap', 'buttons'].includes(L.ctrl) ? '' : '<button class="link" id="cCtrl">ändern</button>'}</div>
      <div class="who" id="cWho"></div>
      <button class="btn" id="cBtn">Bereit</button>`;
  } else if (S.card === 'welcome') {
    const resume = (S.startLv || 0) > 0;
    html = `<p class="kicker">Ihr seid verbunden 💛</p><h2>${resume ? 'Willkommen zurück' : 'Hallo ' + esc(nm('a'))}</h2>
      <p class="msg">${resume ? `Weiter geht's mit „${esc(LV[S.startLv].n)}“.` : esc(CFG.welcome)}</p>${legend()}
      <p class="hint">${LV.length} Level in ${WORLDS.length} Welten – mit wechselnden Figuren und Steuerungen. Vor jedem Level drückt ihr beide auf „Bereit“, dann zählt ein Countdown runter.</p>
      <div class="who" id="cWho"></div>
      <button class="btn" id="cBtn">Ich bin bereit</button>
      ${role === 'host' ? '<button class="btn ghost" id="cMC">Master Control</button>' : ''}`;
  } else if (L) {
    html = `<p class="kicker">${WORLDS[L.w].n} · ${esc(L.n)}</p>${starsHTML(S.lastStars || 0)}
      <p class="time">${S.lastNote ? esc(S.lastNote) : 'geschafft in ' + fmt(S.lastTime || 0)}</p>
      <p class="msg">${esc((CFG.lines || {})[L.id] || '')}</p>`;
    if (S.card === 'world') {
      const Wc = (CFG.worlds || [])[L.w] || {};
      if (Wc.msg) html += `<div class="q"><small>Welt ${L.w + 1} geschafft</small><p>${esc(Wc.msg)}</p></div>`;
      if (Wc.question) html += `<div class="q"><small>Kleine Frage an euch beide</small><p>${esc(Wc.question)}</p></div>`;
    }
    html += `<div class="who" id="cWho"></div><button class="btn" id="cBtn">Weiter</button>`;
    if (role === 'host' && (S.lastStars || 0) < 3) html += `<button class="btn ghost" id="cAgain">Nochmal für mehr Sterne</button>`;
  }
  box.innerHTML = html;
  const b = $('cBtn');
  if (b) b.onclick = () => {
    audio();
    if (S.phase === 'end') { if (role === 'host') setupLevel(0); return; }
    S.ready[me] = 1; readyKey = readyKeyNow();
    if (role === 'host') checkReady(); else if (conn && conn.open) conn.send({t: 'ready', key: readyKey});
  };
  const ag = $('cAgain'); if (ag) ag.onclick = () => setupLevel(S.lv);
  const mc = $('cMC'); if (mc) mc.onclick = openMC;
  const cc = $('cCtrl'); if (cc) cc.onclick = openMenu;
}
function buildQuiz(box) {
  const Q = S.quiz, pair = (CFG.quiz || [])[Q.base + Q.i] || ['Ja', 'Nein'], asker = Q.asker, iAsk = asker === me, my = Q.pick[me];
  let html = `<p class="kicker">Dies oder Das · ${Q.i + 1}/${Q.n}</p><h2>${iAsk ? 'Was nimmst du?' : `Was nimmt ${esc(nm(asker))}?`}</h2>
    <p class="sub">${iAsk ? `${esc(nm(OTH(asker)))} versucht, dich zu erraten.` : `Tipp, was ${esc(nm(asker))} wählen würde.`}</p>`;
  if (!Q.reveal) {
    html += `<div class="opts">${pair.map((o, i) => `<button class="opt${my === i ? ' sel' : ''}" data-v="${i}" ${my >= 0 ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
      <p class="ready">${my >= 0 ? `<span class="dots">Warte auf ${esc(nm(other))}</span>` : ''}</p>`;
  } else {
    const ans = Q.pick[asker], g = Q.pick[OTH(asker)], hit = ans === g;
    html += `<div class="reveal"><p>${esc(nm(asker))} nimmt <b>${esc(pair[ans])}</b></p><p>${esc(nm(OTH(asker)))} tippte <b>${esc(pair[g])}</b></p>
      <p class="res">${hit ? 'Volltreffer 💛' : 'Knapp daneben 😄'}</p></div>`;
    if (Q.i === Q.n - 1) html += `<p class="sub">Ihr kennt euch: <b class="gold">${Q.score} von ${Q.n}</b></p>`;
  }
  box.innerHTML = html;
  box.querySelectorAll('.opt').forEach(bt => bt.onclick = () => {
    audio();
    const v = +bt.dataset.v;
    if (S.quiz.pick[me] >= 0) return;
    S.quiz.pick[me] = v; pickMemo = {key: quizKey(), v};
    if (role === 'host') checkQuiz(); else if (conn && conn.open) conn.send({t: 'pick', v, key: pickMemo.key});
    cardKey = '';
  });
}
const whoHTML = () => ['a', 'd'].map(k => `<span class="pp ${k}${S.ready[k] ? ' on' : ''}"><i></i>${esc(nm(k))}<b>${S.ready[k] ? '✓' : '…'}</b></span>`).join('');
const ICON = {
  swipe: '<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16"/></svg>',
  stick: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="14" cy="10" r="3"/></svg>',
  tap: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/></svg>',
  tilt: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(-15 12 12)"/></svg>',
  pad: '<svg viewBox="0 0 24 24"><path d="M3 12l4-4v8zM11 12l4-4v8z"/><circle cx="19.5" cy="12" r="2.5"/></svg>',
  wheel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M3.5 10h17M12 14v7"/></svg>'
};
function openMenu() {
  $('ovMenu').hidden = false;
  const seg = $('mCtrl');
  seg.innerHTML = Object.entries(CTRL).map(([k, v]) => `<button class="segb${SET.ctrl === k ? ' sel' : ''}" data-k="${k}">${ICON[k]}<span>${v.n}</span></button>`).join('');
  seg.querySelectorAll('.segb').forEach(b => b.onclick = async () => {
    SET.ctrl = b.dataset.k; saveSet();
    if (SET.ctrl === 'tilt') await enableTilt();
    openMenu(); cardKey = '';
  });
  $('mCtrlD').textContent = CTRL[SET.ctrl].d + (SET.ctrl === 'tilt' ? ' – „Neu ausrichten“ setzt die aktuelle Haltung als Mitte.' : '') + ' Manche Level haben ihre eigene Steuerung.';
  $('mCal').hidden = SET.ctrl !== 'tilt';
  $('mSound').textContent = SET.mute ? 'Ton: aus' : 'Ton: an';
  $('mVib').textContent = SET.vib ? 'Vibration: an' : 'Vibration: aus';
  $('mFx').textContent = SET.fx ? 'Grafik: Hoch' : 'Grafik: Einfach';
  $('mPause').hidden = !(S.ok && S.phase === 'play');
  $('mRestart').hidden = !(S.ok && S.lv >= 0 && ['play', 'count', 'intro'].includes(S.phase));
  $('mMC').hidden = role !== 'host' || !S.ok;
  const rtt = S.rtt || 0, ok = conn && conn.open;
  $('mNet').textContent = !S.ok ? 'Noch nicht verbunden' : ok ? `Verbunden · ${rtt ? rtt + ' ms' : 'messe …'}${fconn && fconn.open ? ' · Schnellkanal aktiv' : ''}` : 'Getrennt – verbinde neu …';
}
$('menuBtn').onclick = () => { audio(); openMenu(); };
$('mClose').onclick = () => $('ovMenu').hidden = true;
$('ovMenu').addEventListener('click', e => { if (e.target.id === 'ovMenu') $('ovMenu').hidden = true; });
$('mSound').onclick = () => { SET.mute = !SET.mute; saveSet(); openMenu(); };
$('mVib').onclick = () => { SET.vib = !SET.vib; saveSet(); openMenu(); };
$('mFx').onclick = () => { SET.fx = !SET.fx; FX.off2D = false; saveSet(); if (SET.fx) need3D(); openMenu(); };
$('mCal').onclick = () => { IN.tilt.cal = null; toast('Neigung neu ausgerichtet'); };
$('mPause').onclick = () => { act({k: 'pause', v: 1}); $('ovMenu').hidden = true; };
$('mRestart').onclick = () => { if (confirm('Dieses Level für euch beide neu starten?')) { act({k: 'restart'}); $('ovMenu').hidden = true; } };
$('mMC').onclick = () => { $('ovMenu').hidden = true; openMC(); };
$('pRes').onclick = () => act({k: 'pause', v: 0});
let mcKey = '';
function openMC() { if (role !== 'host' || !S.ok) return; $('ovMC').hidden = false; mcKey = ''; buildMC(); }
function buildMC() {
  const L = curL();
  const phaseTxt = {intro: 'wartet auf „Bereit“', count: 'Countdown', play: 'läuft', card: 'Zwischenkarte', quiz: 'Dies oder Das', end: 'Ende'}[S.phase] || S.phase;
  const aState = !(conn && conn.open) ? 'nicht verbunden' : S.away === other ? 'gerade weg' : S.ready[other] ? 'bereit ✓' : 'verbunden';
  $('mcNow').innerHTML = `<div class="mcrow"><span>Level</span><b>${L ? `${S.lv + 1}. ${esc(L.n)}` : '–'}</b></div>
    <div class="mcrow"><span>Status</span><b>${phaseTxt}${S.pausedBy ? ' · pausiert' : ''}</b></div>
    <div class="mcrow"><span>${esc(nm('a'))}</span><b>${aState}</b></div>
    <div class="mcrow"><span>Verbindung</span><b>${S.rtt ? S.rtt + ' ms' : '–'}${fconn && fconn.open ? ' · schnell' : ''}</b></div>`;
  $('mcDiff').innerHTML = [[.75, 'Leicht'], [1, 'Normal'], [1.25, 'Schwer']].map(([v, n]) => `<button class="segb${(S.diff || 1) === v ? ' sel' : ''}" data-v="${v}"><span>${n}</span></button>`).join('');
  $('mcDiff').querySelectorAll('.segb').forEach(b => b.onclick = () => { MC.setDiff(+b.dataset.v); buildMC(); toast(`Schwierigkeit: ${b.textContent}`); });
  $('mcPause').textContent = S.pausedBy ? 'Weiter' : 'Pause';
  let html = '';
  WORLDS.forEach((w, wi) => {
    const lvls = LV.map((l, i) => [l, i]).filter(([l]) => l.w === wi);
    html += `<div class="mw"><h4>${wi + 1} · ${w.n}</h4><div class="ml">${lvls.map(([l, i]) => {
      const st = S.stars[l.id] || 0;
      return `<button class="mlv${S.lv === i ? ' cur' : ''}" data-i="${i}"><span class="mn">${i + 1}</span><span class="mt">${esc(l.n)}</span><span class="ms">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span></button>`;
    }).join('')}</div></div>`;
  });
  $('mapList').innerHTML = html;
  $('mapList').querySelectorAll('.mlv').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (S.phase === 'play' && !confirm(`Zu „${LV[i].n}“ springen? Das laufende Level wird abgebrochen.`)) return;
    $('ovMC').hidden = true; MC.jump(i);
  });
}
$('mcStart').onclick = () => { MC.startNow(); buildMC(); };
$('mcRestart').onclick = () => { MC.restart(); $('ovMC').hidden = true; };
$('mcSkip').onclick = () => { MC.skip(); buildMC(); };
$('mcPause').onclick = () => { MC.pause(); buildMC(); };
$('mcReset').onclick = () => { if (confirm('Alle gesammelten Sterne löschen?')) { MC.reset(); buildMC(); } };
$('mcClose').onclick = () => $('ovMC').hidden = true;
$('mcBtn').onclick = () => { audio(); openMC(); };
$('ovMC').addEventListener('click', e => { if (e.target.id === 'ovMC') $('ovMC').hidden = true; });

function syncUI(now) {
  if (!S.ok) return;
  $('hud').hidden = false;
  const L = curL();
  const inCard = ['card', 'end', 'quiz', 'intro'].includes(S.phase);
  $('ovCard').hidden = !inCard;
  $('ovCard').classList.toggle('bottom', S.phase === 'end' || S.phase === 'intro');
  if (inCard) {
    const key = S.phase === 'quiz' ? `q:${quizKey()}:${S.quiz.reveal}:${S.quiz.pick[me]}` : `${S.phase}:${S.card}:${S.lv}:${S.sid}:${SET.ctrl}`;
    if (key !== cardKey) { cardKey = key; buildCard(); }
    const b = $('cBtn'), wh = $('cWho');
    if (b && (S.phase === 'card' || S.phase === 'intro')) {
      b.disabled = !!S.ready[me];
      const t = S.ready[me] ? `Warte auf ${nm(other)}…` : S.phase === 'intro' ? 'Bereit' : S.card === 'welcome' ? 'Ich bin bereit' : S.card === 'world' ? 'Weiter zu „Dies oder Das“' : 'Weiter';
      if (b.textContent !== t) b.textContent = t;
    }
    if (wh) { const h = whoHTML(); if (wh.innerHTML !== h) wh.innerHTML = h; }
  } else cardKey = '';
  const playing = (S.phase === 'play' || S.phase === 'count') && L;
  const lvT = S.phase === 'quiz' ? 'Dies oder Das' : L && S.phase !== 'card' ? `${S.lv + 1}/${LV.length} · ${L.n}` : S.card === 'welcome' ? 'Willkommen' : L ? L.n : '';
  if ($('lvl').textContent !== lvT) $('lvl').textContent = lvT;
  const cT = playing ? `${L.ic} ${L.countText ? L.countText() : S.count + '/' + S.total}` : '';
  if ($('cnt').textContent !== cT) $('cnt').textContent = cT;
  $('cnt').style.display = cT ? '' : 'none';
  const el = playing && S.phase === 'play' ? (S.done ? S.doneAt : S.t) - S.lt : 0;
  const tT = playing && !L.noTimer ? fmt(el) : '';
  if ($('tmr').textContent !== tT) $('tmr').textContent = tT;
  $('tmr').style.display = tT ? '' : 'none';
  if (tT) $('tmr').className = el <= L.t3 ? 'gold' : el <= L.t2 ? '' : 'mute';
  const pr = playing && S.total ? clamp(S.count / S.total, 0, 1) : 0;
  $('prog').style.transform = `scaleX(${pr})`;
  $('progW').style.opacity = playing ? 1 : 0;
  const fresh = role === 'host' ? (conn && conn.open && now - lastPosRecv < 2500) : (conn && conn.open && now - lastRecv < 2500);
  $('net').className = 'dot ' + (!fresh ? 'bad' : (S.rtt || 0) > 300 ? 'mid' : 'good');
  const pz = S.pausedBy || S.away;
  $('ovPause').hidden = !pz || !$('ovLost').hidden;
  if (pz) {
    const t = S.pausedBy ? `${nm(S.pausedBy)} hat pausiert.` : role === 'host' ? `${nm(other)} ist gerade nicht verbunden. Sie kann einfach den Link neu öffnen – Code ${lastCode}. Das Spiel wartet.` : `${nm(S.away)} ist gerade weg. Das Spiel wartet.`;
    if ($('pText').textContent !== t) $('pText').textContent = t;
    $('pTitle').textContent = S.pausedBy ? 'Pause' : 'Kurz warten';
    $('pRes').hidden = !S.pausedBy;
  }
  if (!$('ovMC').hidden) { const k = `${S.phase}:${S.lv}:${S.sid}:${S.pausedBy}:${S.ready[other]}:${S.away}:${S.diff}:${Math.round((S.rtt || 0) / 20)}`; if (k !== mcKey) { mcKey = k; buildMC(); } }
}

/* ---------- Hintergründe ---------- */
function resize() {
  dpr = Math.max(.75, Math.min(2, window.devicePixelRatio || 1) * quality);
  cw = innerWidth; ch = innerHeight;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  fog.width = cv.width; fog.height = cv.height;
  sc = Math.min((cw - 12) / W, (ch - HUDH - 12) / H);
  ox = (cw - W * sc) / 2; oy = HUDH + (ch - HUDH - 12 - H * sc) / 2;
  const n = Math.round(cw * ch / 5200);
  amb = {stars: [], bub: [], flies: [], bokeh: [], blades: [], clouds: []};
  for (let i = 0; i < n; i++) amb.stars.push({x: Math.random() * cw, y: Math.random() * ch, r: Math.random() * 1.3 + .3, p: rnd(0, 6.28), s: rnd(.6, 1.8)});
  for (let i = 0; i < 40; i++) amb.bub.push({x: Math.random() * cw, y: Math.random() * ch, r: rnd(1, 4), s: rnd(15, 45), p: rnd(0, 6.28)});
  for (let i = 0; i < 34; i++) amb.flies.push({x: Math.random() * cw, y: Math.random() * ch, p: rnd(0, 6.28), s: rnd(.3, .8)});
  const warm = [[255, 190, 120], [255, 150, 120], [255, 214, 160], [240, 140, 170]];
  for (let i = 0; i < 26; i++) amb.bokeh.push({x: Math.random() * cw, y: Math.random() * ch, r: rnd(8, 34), s: rnd(4, 14), c: warm[i % 4], p: rnd(0, 6.28)});
  for (let x = 0; x < cw; x += 7) amb.blades.push({x, h: rnd(14, 46), p: rnd(0, 6.28)});
  for (let i = 0; i < 7; i++) amb.clouds.push({x: Math.random() * cw, y: rnd(.08, .5) * ch, w: rnd(80, 180), s: rnd(4, 12)});
  bgCache.clear();
}
const bgCache = new Map();
addEventListener('resize', resize); resize();
function theme() {
  if (!S.ok) return 'nacht';
  if (S.phase === 'quiz') { const L = LV[S.quiz.next]; return L.theme || WORLDS[L.w].th; }
  const L = LV[S.lv >= 0 ? S.lv : (S.startLv || 0)];
  return L.theme || WORLDS[L.w].th;
}
const PAL = {nacht: ['#0b0a1c', '#15112e', '#231a3d'], meer: ['#03182a', '#062f47', '#0b4558'], garten: ['#0c1a1a', '#16302a', '#2f3f30'],
  arcade: ['#07061a', '#120a2e', '#2a0f3e'], laternen: ['#120b1f', '#27122d', '#47202f'], schloss: ['#2b2056', '#8a4a7c', '#f0a080']};
function drawBg(th, t) {
  if (bgActive()) { ctx.clearRect(0, 0, cw, ch); return; }
  const pal = PAL[th] || PAL.nacht, key = th + ch;
  let bg = bgCache.get(key);
  if (!bg) { bg = ctx.createLinearGradient(0, 0, 0, ch); bg.addColorStop(0, pal[0]); bg.addColorStop(.6, pal[1]); bg.addColorStop(1, pal[2]); bgCache.set(key, bg); }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
  if (th === 'nacht' || th === 'arcade') {
    ctx.fillStyle = '#fff';
    for (const s of amb.stars) {
      if (th === 'arcade' && s.y > ch * .55) continue;
      ctx.globalAlpha = .35 + .45 * (.5 + .5 * Math.sin(t * s.s + s.p)); ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;
  }
  if (th === 'arcade') {
    const hz = ch * .58;
    const sun = ctx.createLinearGradient(0, hz - 160, 0, hz);
    sun.addColorStop(0, 'rgba(255,170,200,.55)'); sun.addColorStop(1, 'rgba(255,110,160,.15)');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cw / 2, hz, 120, Math.PI, 0); ctx.fill();
    ctx.fillStyle = PAL.arcade[1]; for (let i = 0; i < 6; i++) ctx.fillRect(cw / 2 - 130, hz - 14 - i * 18, 260, 3 + i * .6);
    ctx.strokeStyle = 'rgba(160,120,255,.35)'; ctx.lineWidth = 1;
    for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(cw / 2 + i * 22, hz); ctx.lineTo(cw / 2 + i * 150, ch); ctx.stroke(); }
    const off = (t * 40) % 40;
    for (let k = 0; k < 16; k++) { const y = hz + Math.pow((k * 40 + off) / 640, 2) * (ch - hz); if (y > ch) break; ctx.globalAlpha = .15 + .4 * (y - hz) / (ch - hz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (th === 'meer') {
    for (let i = 0; i < 6; i++) {
      const x = cw * (i + .5) / 6 + Math.sin(t * .3 + i) * 40;
      ctx.fillStyle = 'rgba(160,230,255,.05)'; ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 110, ch * .8); ctx.lineTo(x - 50, ch * .8); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(190,240,255,.28)'; ctx.lineWidth = 1;
    for (const b of amb.bub) { const y = ((b.y - t * b.s) % ch + ch) % ch, x = b.x + Math.sin(t + b.p) * 6; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.stroke(); }
  } else if (th === 'garten') {
    ctx.fillStyle = '#fff';
    for (const s of amb.stars) { if (s.y > ch * .5) continue; ctx.globalAlpha = .2 + .3 * (.5 + .5 * Math.sin(t * s.s + s.p)); ctx.fillRect(s.x, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
    for (const f of amb.flies) { const x = f.x + Math.sin(t * f.s + f.p) * 30, y = f.y + Math.cos(t * f.s * .7 + f.p) * 22; glow(x, y, 9, [220, 255, 150], .35 + .35 * Math.sin(t * 2 + f.p)); }
    ctx.fillStyle = 'rgba(8,18,14,.85)'; ctx.beginPath(); ctx.moveTo(0, ch);
    for (const b of amb.blades) { const sw = Math.sin(t * 1.2 + b.p) * 3; ctx.lineTo(b.x + sw, ch - b.h); ctx.lineTo(b.x + 3.5, ch); }
    ctx.lineTo(cw, ch); ctx.fill();
  } else if (th === 'laternen') {
    for (const b of amb.bokeh) { const y = ((b.y - t * b.s) % ch + ch) % ch, x = b.x + Math.sin(t * .2 + b.p) * 20; glow(x, y, b.r, b.c, .16); }
  } else if (th === 'schloss') {
    glow(cw * .7, ch * .62, ch * .35, [255, 210, 160], .45);
    ctx.fillStyle = 'rgba(255,240,250,.35)';
    for (const c of amb.clouds) { const x = ((c.x + t * c.s) % (cw + 200)) - 100; ctx.beginPath(); ctx.ellipse(x, c.y, c.w / 2, c.w / 7, 0, 0, TAU); ctx.fill(); }
  }
}


/* ---------- Kulissen pro Welt (im Spielfeld, hinter dem Level) ---------- */
const DECO = (() => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const o = {dust: [], weed: [], flowers: [], bulbs: [], roofs: []};
  for (let i = 0; i < 46; i++) o.dust.push({x: r() * W, y: r() * H, r: .6 + r() * 1.6, p: r() * 6.28});
  for (let i = 0; i < 11; i++) o.weed.push({x: 20 + i * 55 + r() * 20, h: 70 + r() * 110, p: r() * 6.28, c: r() < .5 ? [80, 190, 150] : [110, 170, 120]});
  for (let i = 0; i < 16; i++) o.flowers.push({x: 18 + i * 38 + r() * 14, y: 975 - r() * 22, c: [[255, 170, 200], [255, 220, 150], [200, 180, 255], [255, 255, 255]][i % 4], s: 4 + r() * 3});
  for (let i = 0; i < 21; i++) o.bulbs.push({x: i * 30, c: [[255, 196, 120], [244, 168, 184], [255, 230, 170], [156, 199, 255]][i % 4], p: r() * 6.28});
  for (let x = 0; x < W;) { const w = 50 + r() * 70; o.roofs.push({x, w, h: 50 + r() * 90, win: r()}); x += w + 4; }
  return o; })();
function worldDeco(th, t) {
  if (th === 'nacht') {
    glow(140, 260, 280, [120, 90, 210], .13); glow(480, 640, 320, [210, 110, 170], .1); glow(260, 930, 300, [90, 130, 230], .1);
    if (!bgActive()) { ctx.save(); ctx.beginPath(); ctx.arc(522, 92, 26, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.rect(480, 50, 90, 90); ctx.arc(534, 82, 24, 0, TAU, true); ctx.fillStyle = '#fff3d6'; ctx.fill(); ctx.restore();
    glow(515, 98, 70, [255, 236, 200], .22); }
    for (const d of DECO.dust) { ctx.globalAlpha = .25 + .35 * (.5 + .5 * Math.sin(t * 1.3 + d.p)); ctx.fillStyle = '#fff'; ctx.fillRect(d.x, d.y, d.r, d.r); }
    ctx.globalAlpha = 1;
  } else if (th === 'meer') {
    const g = ctx.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, 'rgba(190,240,255,.14)'); g.addColorStop(1, 'rgba(190,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 320);
    ctx.lineCap = 'round';
    for (const w of DECO.weed) {
      ctx.strokeStyle = rgba(w.c, .45); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(w.x, H);
      const sw = Math.sin(t * 1.2 + w.p) * 18; ctx.bezierCurveTo(w.x + sw, H - w.h * .4, w.x - sw, H - w.h * .7, w.x + sw * 1.3, H - w.h); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(214,190,140,.32)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 958 + Math.sin(x / 70) * 14); ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = 'rgba(190,160,110,.35)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 978 + Math.sin(x / 45 + 1) * 8); ctx.lineTo(W, H); ctx.fill();
    for (const [x, c] of [[40, [244, 140, 170]], [70, [255, 180, 110]], [555, [190, 150, 255]], [520, [244, 140, 170]]]) { glow(x, 965, 26, c, .35); ctx.fillStyle = rgba(c, .75); ctx.beginPath(); ctx.arc(x, 968, 9, 0, TAU); ctx.fill(); }
  } else if (th === 'garten') {
    glow(300, 120, 300, [255, 220, 170], .07);
    ctx.strokeStyle = 'rgba(90,70,60,.6)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const [x0, dir] of [[0, 1], [W, -1]]) {
      ctx.beginPath(); ctx.moveTo(x0, 30); ctx.quadraticCurveTo(x0 + dir * 90, 40, x0 + dir * 150, 95); ctx.stroke();
      for (let i = 0; i < 9; i++) { const k = i / 8, x = x0 + dir * (20 + k * 130) + Math.sin(t + i) * 2, y = 32 + k * k * 60 + (i % 2) * 8; ctx.fillStyle = i % 3 ? 'rgba(255,190,210,.85)' : 'rgba(255,240,245,.9)'; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(120,200,120,.5)'; ctx.lineWidth = 2.5;
    for (let x = 6; x < W; x += 9) { const h = 14 + (x * 7 % 13), sw = Math.sin(t * 1.5 + x) * 3; ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + sw, H - h); ctx.stroke(); }
    for (const f of DECO.flowers) { ctx.fillStyle = rgba(f.c, .9); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t * .3; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * f.s, f.y + Math.sin(a) * f.s, f.s * .7, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(f.x, f.y, f.s * .55, 0, TAU); ctx.fill(); }
  } else if (th === 'laternen') {
    for (const rf of DECO.roofs) {
      ctx.fillStyle = 'rgba(20,10,26,.85)'; ctx.fillRect(rf.x, H - rf.h, rf.w, rf.h);
      ctx.beginPath(); ctx.moveTo(rf.x - 4, H - rf.h); ctx.lineTo(rf.x + rf.w / 2, H - rf.h - 22); ctx.lineTo(rf.x + rf.w + 4, H - rf.h); ctx.fill();
      for (let y = H - rf.h + 14; y < H - 10; y += 22) for (let x = rf.x + 9; x < rf.x + rf.w - 10; x += 18) if ((x * 13 + y * 7 + rf.win * 100) % 5 < 2) { ctx.fillStyle = 'rgba(255,200,120,.55)'; ctx.fillRect(x, y, 8, 10); }
    }
    for (const row of [[0, 36, 70], [1, 58, 100]]) {
      const [ri, y0, sag] = row; ctx.strokeStyle = 'rgba(40,25,30,.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let x = 0; x <= W; x += 10) { const k = x / W, y = y0 + Math.sin(k * Math.PI) * sag; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      DECO.bulbs.forEach((b, i) => { if ((i + ri) % 2) return; const k = b.x / W, y = y0 + Math.sin(k * Math.PI) * sag + 6, a = .55 + .45 * Math.sin(t * 2.5 + b.p);
        glow(b.x, y, 20, b.c, .45 * a); ctx.fillStyle = rgba(b.c, .7 + .3 * a); ctx.beginPath(); ctx.ellipse(b.x, y, 3.5, 5, 0, 0, TAU); ctx.fill(); });
    }
  }
}
const TR = {a: [], d: []};
let vign = null, vignKey = '';
function vignette() {
  const key = cw + 'x' + ch;
  if (key !== vignKey) { vignKey = key; vign = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .35, cw / 2, ch / 2, Math.max(cw, ch) * .75); vign.addColorStop(0, 'rgba(0,0,0,0)'); vign.addColorStop(1, 'rgba(0,0,0,.38)'); }
  ctx.fillStyle = vign; ctx.fillRect(0, 0, cw, ch);
}

/* ---------- Spieler & Szene ---------- */
function player(k, x, y, p, t) {
  const c = COL[k], lit = p ? p.lit : 1, L = curL();
  const skin = L && L.skin && L.skin[k];
  if (skin) {
    const st = SKN[k], dx = x - st.lx, dy = y - st.ly, sp = Math.hypot(dx, dy);
    if (sp > .6) { st.ang = lerpA(st.ang, Math.atan2(dy, dx), .3); if (Math.abs(dx) > .4) st.face = dx > 0 ? 1 : -1; st.mv = 6; } else if (st.mv > 0) st.mv--;
    st.lx = x; st.ly = y;
    glow(x, y, 55, c, lit ? .17 : .08);
    ctx.globalAlpha = lit ? 1 : .55;
    const ss = L.skinScale || 1, an = L.skinAnchor || 0;
    ctx.save(); ctx.translate(x, y + an); ctx.scale(ss, ss);
    SKINS[skin](0, -an, skin === 'princess' || skin === 'prince' ? st.face : st.ang, t, st.mv > 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    const top = y - 40 * (L.skinScale || 1);
    if (k === me && L.markMe !== false) { ctx.fillStyle = rgba(c, .9); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - 5, top - 7); ctx.lineTo(x + 5, top - 7); ctx.fill(); }
    if (!L.hideNames) label(nm(k), x, y + (L.nameDY || 38), lit ? c : [150, 145, 170], 15);
    if (!lit) label(L.stun || 'erloschen', x, y - 52, [225, 220, 240], 13);
    return;
  }
  const fl = lit ? 1 + Math.sin(t * 7 + (k === 'a' ? 0 : 2)) * .05 + Math.sin(t * 13) * .03 : .6;
  const big = L && L.highlight ? L.highlight(k) : 1;
  const tr = TR[k], lt = tr[tr.length - 1];
  if (!lt || Math.hypot(lt.x - x, lt.y - y) > 4) { if (lt && Math.hypot(lt.x - x, lt.y - y) > 120) tr.length = 0; tr.push({x, y}); if (tr.length > 14) tr.shift(); }
  if (lit) tr.forEach((q, i) => glow(q.x, q.y, 6 + i * 1.3, c, .05 + i * .018));
  if (lit) {
    glow(x, y, 80 * fl * big, c, .36); glow(x, y, 34 * fl * big, c, .55);
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.drawImage(glowSprite(c), x - 95 * fl, y - 3.5, 190 * fl, 7); ctx.globalAlpha = .35; ctx.drawImage(glowSprite([255, 255, 255]), x - 50 * fl, y - 1.5, 100 * fl, 3); ctx.globalAlpha = 1; ctx.globalCompositeOperation = op;
  } else glow(x, y, 28, [120, 115, 140], .3);
  if (p && p.inv > 0 && lit && S.phase === 'play') { ctx.beginPath(); ctx.arc(x, y, R + 9, 0, TAU); ctx.strokeStyle = rgba(CG, .25 + .2 * Math.sin(t * 10)); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x, y, R * .62, 0, TAU);
  ctx.fillStyle = lit ? '#fffaf3' : '#5d5872'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = lit ? rgba(c, 1) : 'rgba(150,145,170,.7)'; ctx.stroke();
  if (lit) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * .8 + (k === 'a' ? 0 : 1)); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(17, 0); ctx.moveTo(0, -17); ctx.lineTo(0, 17); ctx.stroke(); ctx.restore(); }
  if (k === me) { ctx.beginPath(); ctx.arc(x, y, R + 5, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(c, .35); ctx.stroke(); }
  if (!(L && L.hideNames)) label(nm(k), x, y + R + 24, lit ? c : [150, 145, 170], 16);
  if (!lit) label((L && L.stun) || 'erloschen', x, y - R - 12, [225, 220, 240], 13);
  if (p && L && L.drawCarry && S.phase === 'play') { try { L.drawCarry(k, x, y, p, t); } catch (e) {} }
}
function drawFog(pos, vis, cy, cx) {
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, fog.width, fog.height);
  fctx.fillStyle = 'rgba(6,4,14,.92)'; fctx.fillRect(0, 0, fog.width, fog.height);
  fctx.globalCompositeOperation = 'destination-out';
  for (const k of ['a', 'd']) {
    const x = (ox + (pos[k].x - cx) * sc) * dpr, y = (oy + (pos[k].y - cy) * sc) * dpr, r = vis * sc * dpr;
    const g = fctx.createRadialGradient(x, y, r * .3, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = g; fctx.beginPath(); fctx.arc(x, y, r, 0, TAU); fctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fog, 0, 0);
}
function skyLanterns(t) {
  if (!LOC.sky) { LOC.sky = []; for (let i = 0; i < 18; i++) LOC.sky.push({x: rnd(30, W - 30), y: rnd(H, H + 900), s: rnd(35, 70), p: rnd(0, TAU), c: i % 2 ? CA : [255, 190, 120]}); }
  for (const l of LOC.sky) {
    l.y -= l.s * .016; if (l.y < -60) l.y = H + 60;
    const x = l.x + Math.sin(t * .6 + l.p) * 12;
    glow(x, l.y, 34, l.c, .35);
    ctx.fillStyle = rgba(l.c, .85); ctx.beginPath(); ctx.ellipse(x, l.y, 8, 11, 0, 0, TAU); ctx.fill();
  }
}
function drawButtons(L) {
  if (!L || L.ctrl !== 'buttons' || !['play', 'count'].includes(S.phase)) return;
  const Z = btnZones(), b = LOC._btn || {};
  const btn = (z, on, draw) => {
    ctx.fillStyle = on ? 'rgba(243,201,143,.35)' : 'rgba(255,255,255,.08)'; ctx.strokeStyle = on ? 'rgba(243,201,143,.9)' : 'rgba(255,255,255,.28)';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; draw(z);
  };
  btn(Z.l, b.l, z => { ctx.beginPath(); ctx.moveTo(z.x - 12, z.y); ctx.lineTo(z.x + 9, z.y - 13); ctx.lineTo(z.x + 9, z.y + 13); ctx.fill(); });
  btn(Z.r, b.r, z => { ctx.beginPath(); ctx.moveTo(z.x + 12, z.y); ctx.lineTo(z.x - 9, z.y - 13); ctx.lineTo(z.x - 9, z.y + 13); ctx.fill(); });
  btn(Z.j, b.held, z => { ctx.font = '700 15px Karla, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Springen', z.x, z.y); ctx.textBaseline = 'alphabetic'; });
}
function render(now) {
  const L = curL(), three = !!(L && L.three && S.ok && S.lv >= 0 && S.phase !== 'quiz');
  renderScene(now, L, three);
  const post = !three && fx2DActive();
  if (post) {
    try {
      if (FX.tw !== cv.width || FX.th !== cv.height) { FX.tex2D.dispose(); FX.tw = cv.width; FX.th = cv.height; }
      FX.tex2D.needsUpdate = true; fxSize();
      const th = theme();
      if (bgActive()) { bgRender(th, now / 1000); FX.over.uniforms.t.value = FX.tex2D; gl.autoClear = false; fxPass(FX.over, FX.scene); gl.autoClear = true; fxBloom(FX.scene.texture, .9, .55, .75, TINT[th]); }
      else fxBloom(FX.tex2D, .85, .5, .7, TINT[th]);
    } catch (e) { console.error(e); FX.off2D = true; }
  }
  $('gl').hidden = !(three || post);
  cv.classList.toggle('fxhide', post);
}
function renderScene(now, L, three) {
  const t = now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (three) {
    ctx.clearRect(0, 0, cw, ch);
    if (window.THREE) { try { L.render3d(t, partnerAt(now)); } catch (e) { console.error(e); } }
    else { need3D(); drawBg('nacht', t); label('3D-Welt wird geladen …', cw / 2, ch / 2, CG, 18, 700); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else {
    drawBg(theme(), t);
    if (!S.ok) return;
    const cy = camY(), cx = camX();
    const shx = shakeAmt > 0 ? (Math.random() - .5) * shakeAmt * 14 : 0, shy = shakeAmt > 0 ? (Math.random() - .5) * shakeAmt * 14 : 0;
    const world = () => ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox - cx * sc + shx), dpr * (oy - cy * sc + shy));
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    const arc = theme() === 'arcade';
    ctx.fillStyle = arc ? (bgActive() ? 'rgba(7,6,20,.55)' : 'rgba(7,6,20,.8)') : (bgActive() ? 'rgba(10,8,24,.16)' : 'rgba(255,255,255,.02)'); ctx.strokeStyle = arc ? 'rgba(160,120,255,.35)' : 'rgba(255,255,255,.07)'; ctx.lineWidth = 1.5;
    rr(0, 0, W, H, 28); ctx.fill(); ctx.stroke();
    ctx.save(); rr(0, 0, W, H, 28); ctx.clip();
    if (!(L && L.noDeco) && S.phase !== 'quiz') { try { worldDeco(theme(), t); } catch (e) {} }
    world();
    const pos = {}; pos[me] = {x: mine.x, y: mine.y}; pos[other] = {x: ghost.x, y: ghost.y};
    if (L && S.lv >= 0 && S.phase !== 'quiz') { try { L.draw(t, pos); } catch (e) { console.error(e); } }
    const A = pos.a, D = pos.d, near = clamp(1 - dist(A, D) / 170, 0, 1);
    if (near > 0 && S.p.a.lit && S.p.d.lit && !(L && L.noThread)) {
      const g = ctx.createLinearGradient(A.x, A.y, D.x, D.y);
      g.addColorStop(0, rgba(CA, .6 * near)); g.addColorStop(1, rgba(CD, .6 * near));
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo((A.x + D.x) / 2, (A.y + D.y) / 2 + Math.sin(t * 2) * 10, D.x, D.y); ctx.stroke();
    }
    if (L && L.fog && S.phase === 'play') { drawFog(pos, L.fog, cy, cx); world(); }
    if (!(L && L.hidePlayers)) { player(other, ghost.x, ghost.y, S.p[other], t); player(me, mine.x, mine.y, S.p[me], t); }
    if (L && L.drawTop) { try { L.drawTop(t, pos); } catch (e) {} }
    if (S.phase === 'end') skyLanterns(t);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) { const a = Math.max(0, p.life), r = p.s * (.5 + p.life * .5); ctx.globalAlpha = a * .35; ctx.fillStyle = rgba(p.c, 1); ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, TAU); ctx.fill(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * .7, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(p.c, 1); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (L && (L.camY || L.camX) && S.phase === 'play') {
      const gy = ghost.y - cy, gx = ghost.x - cx;
      if (gy < 10 || gy > H - 10 || gx < 0 || gx > W) {
        const sx = clamp(ox + gx * sc, ox + 30, ox + W * sc - 30), sy = clamp(oy + gy * sc, oy + 30, oy + H * sc - 30);
        ctx.fillStyle = rgba(COL[other], .95); ctx.beginPath(); ctx.arc(sx, sy, 7, 0, TAU); ctx.fill();
        ctx.font = '700 13px Karla, system-ui'; ctx.textAlign = 'center';
        const dm = Math.round(Math.hypot(ghost.x - mine.x, ghost.y - mine.y) / 30);
        ctx.fillText(`${nm(other)} · ${dm} m`, clamp(sx, ox + 60, ox + W * sc - 60), sy + (sy > ch / 2 ? -14 : 22));
      }
    }
  }
  if (!fx2DActive() && !three) vignette();
  drawButtons(L);
  if (SET.ctrl === 'stick' && IN.stick && S.phase === 'play' && !(L && L.ctrl === 'buttons')) {
    const s = IN.stick, dx = s.x - s.ox, dy = s.y - s.oy, m = Math.hypot(dx, dy), k = m > 55 ? 55 / m : 1;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.ox, s.oy, 55, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(COL[me], .55); ctx.beginPath(); ctx.arc(s.ox + dx * k, s.oy + dy * k, 24, 0, TAU); ctx.fill();
  }
  if (S.phase === 'count') {
    const left = S.countT - hostNow(), n = Math.max(1, Math.ceil(left));
    if (LOC.cd !== n) { LOC.cd = n; tone(n === 1 ? 660 : 440, .2, .06, 'triangle'); }
    const f = left - Math.floor(left);
    ctx.save(); ctx.translate(cw / 2, ch / 2); const s = 1 + f * .25;
    ctx.globalAlpha = .4 + .6 * f;
    ctx.font = `700 ${Math.round(120 * s)}px 'Cormorant Garamond', Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff7ec'; ctx.shadowColor = 'rgba(243,201,143,.8)'; ctx.shadowBlur = 30; ctx.fillText(String(n), 0, 0);
    ctx.restore();
    LOC.goT = now;
  } else if (S.phase === 'play' && LOC.goT && now - LOC.goT < 800) {
    if (!LOC.goS) { LOC.goS = 1; tone(880, .4, .07); }
    const k = (now - LOC.goT) / 800;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.font = `700 ${Math.round(90 + k * 40)}px 'Cormorant Garamond', Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff7ec'; ctx.shadowColor = 'rgba(244,168,184,.9)'; ctx.shadowBlur = 30;
    ctx.fillText('Los!', cw / 2, ch / 2); ctx.restore();
  }
  if (LOC.fadeT && now - LOC.fadeT < 380) { ctx.fillStyle = `rgba(6,5,16,${1 - (now - LOC.fadeT) / 380})`; ctx.fillRect(0, 0, cw, ch); }
}
function stepParts(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy = p.vy * .96 + 30 * dt; p.life -= dt / p.d; }
  parts = parts.filter(p => p.life > 0);
}

/* ---------- Hauptschleife ---------- */
let last = performance.now(), netT = 0, pingT = 0, loopOn = false, ftAvg = 16, qT = 0;
function startLoop() { wake(); if (loopOn) return; loopOn = true; last = performance.now(); requestAnimationFrame(frame); }
function frame(now) {
  const raw = now - last, dt = Math.min(.05, Math.max(0, raw / 1000)); last = now;
  if (raw < 200) { ftAvg = ftAvg * .95 + raw * .05; qT += dt; }
  shakeAmt = Math.max(0, shakeAmt - dt * 1.6);
  if (window.THREE && SET.fx && !FX.ready) fxSetup();
  if (qT > 3) { qT = 0;
    if (ftAvg > 27 && fx2DActive() && quality <= .8 && S.ok) { FX.off2D = true; toast('Grafik-Effekte reduziert, damit es flüssig bleibt'); }
    else if (ftAvg > 24 && quality > .6) { quality = Math.max(.6, quality - .2); resize(); } else if (ftAvg < 15 && quality < 1) { quality = Math.min(1, quality + .2); resize(); } }
  const inp = readInput(dt);
  if (S.ok) {
    if (S.sid !== lastSid) {
      if (LOC.__dispose) { try { LOC.__dispose(); } catch (e) {} }
      lastSid = S.sid; clearObj(LOC); TR.a.length = 0; TR.d.length = 0; LOC.fadeT = now; pend.x = pend.y = 0; parts = []; PB.length = 0;
      mine.x = S.p[me].x; mine.y = S.p[me].y; ghost.x = S.p[other].x; ghost.y = S.p[other].y; lastTp = S.p[me].tp || 0;
      for (const k of ['a', 'd']) { SKN[k].lx = S.p[k].x; SKN[k].ly = S.p[k].y; }
      const L = curL(); if (L && L.three) need3D();
    }
    if ((S.p[me].tp || 0) !== lastTp) {
      lastTp = S.p[me].tp || 0; mine.x = S.p[me].x; mine.y = S.p[me].y; pend.x = pend.y = 0;
      const L = curL(); if (L && L.onTeleport) { try { L.onTeleport(); } catch (e) {} }
    }
    moveMine(dt, inp);
    const L = curL(), ex = L && L.posExtra ? L.posExtra() : null;
    netT += dt;
    const rate = S.phase === 'play' || S.phase === 'count' ? .033 : .1;
    if (role === 'host') {
      S.p[me].x = mine.x; S.p[me].y = mine.y; S.p[me].e = ex;
      if (!conn || !conn.open) S.away = other; else if (now - lastPosRecv > 4500) S.away = other;
      update(dt);
      if (netT > rate) { netT = 0; sendState(); }
      pingT += dt;
      if (pingT > 1 && conn && conn.open) { pingT = 0; try { conn.send({t: 'ping', ts: performance.now()}); } catch (e) {} }
    } else {
      if (netT > .033) {
        netT = 0; const ch1 = fastOpen();
        if (ch1) { try { ch1.send({t: 'pos', q: ++pseq, x: Math.round(mine.x * 10) / 10, y: Math.round(mine.y * 10) / 10, e: ex, sid: S.sid, tp: lastTp}); } catch (e) {} }
      }
      const stale = now - lastRecv;
      if (stale > 2500 && conn && !netWarn) { netWarn = true; toast(`Verbindung zu ${nm('d')} wackelt …`); }
      if (stale < 1000) netWarn = false;
      if (stale > 10000 && conn) { try { conn.close(); } catch (e) {} lost(); }
    }
    const pp = partnerAt(now);
    ghost.x = pp.x; ghost.y = pp.y; ghost.e = pp.e;
  }
  stepParts(dt);
  try { render(now); } catch (e) { console.error(e); }
  syncUI(now);
  requestAnimationFrame(frame);
}
setTimeout(() => { if (SET.fx) need3D(); }, 600);
(function idle(now) { if (loopOn) return; try { render(now); } catch (e) {} requestAnimationFrame(idle); })(performance.now());
})();
