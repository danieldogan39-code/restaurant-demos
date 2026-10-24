/* Zwei Lichter – Die Reise · Engine v3
   Daniel ist Gastgeber und rechnet das Spiel, Aurelia verbindet sich per PeerJS.
   Jeder steuert sein eigenes Licht lokal; der Gastgeber prüft Regeln und verteilt den Zustand.
   Level kommen aus levels-*.js (window.ZL_PACKS), Texte aus config.js. */
(() => {
'use strict';
const VERSION = '3.0';
const CFG = window.ZL_CONFIG;
const W = 600, H = 1000, R = 18, VMAX = 470, TAU = Math.PI * 2, HUDH = 64;
const $ = id => document.getElementById(id);
const CA = [244, 168, 184], CD = [156, 199, 255], CG = [243, 201, 143];
const COL = {a: CA, d: CD, g: CG, x: CG};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nm = k => CFG[k];
const OTH = k => k === 'a' ? 'd' : 'a';
const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const WORLDS = [
  {n: 'Sternennacht', th: 'nacht'}, {n: 'Tiefsee', th: 'meer'}, {n: 'Frühlingsgarten', th: 'garten'},
  {n: 'Spielhalle', th: 'arcade'}, {n: 'Laternenfest', th: 'laternen'}
];
const CTRL = {
  swipe: {n: 'Wischen', d: 'Finger irgendwo auflegen und ziehen'},
  stick: {n: 'Joystick', d: 'Daumen auflegen – dort erscheint ein Stick'},
  tap:   {n: 'Tippen', d: 'Finger dorthin halten, wo dein Licht hin soll'},
  tilt:  {n: 'Neigen', d: 'Handy kippen wie eine Wasserwaage'}
};
document.querySelectorAll('[data-n]').forEach(el => el.textContent = nm(el.dataset.n));

/* ---------- Einstellungen (pro Gerät) ---------- */
const SET = Object.assign({ctrl: 'swipe', mute: false, vib: true}, (() => { try { return JSON.parse(localStorage.getItem('zl-set')) || {}; } catch (e) { return {}; } })());
if (!CTRL[SET.ctrl]) SET.ctrl = 'swipe';
const saveSet = () => { try { localStorage.setItem('zl-set', JSON.stringify(SET)); } catch (e) {} };

/* ---------- Zustand ---------- */
const S = {};      // geteilter Spielzustand – bleibt immer dasselbe Objekt
const LOC = {};    // lokale Daten des aktuellen Levels (nicht geteilt)
let role = null, me = 'd', other = 'a', peer = null, conn = null, lastCode = '';
const mine = {x: W * .65, y: H * .9}, ghost = {x: W * .35, y: H * .9}, pend = {x: 0, y: 0};
let lastSid = -1, lastTp = 0, outEv = [], parts = [], readyKey = '', pickMemo = null;
let lastRecv = 0, lastPosRecv = 0, startLv = 0, netWarn = false;
const clearObj = o => { for (const k of Object.keys(o)) delete o[k]; };
const curL = () => (S.ok && S.lv >= 0) ? LV[S.lv] : null;

/* ---------- Canvas ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
const fog = document.createElement('canvas'), fctx = fog.getContext('2d');
let cw = 0, ch = 0, dpr = 1, sc = 1, ox = 0, oy = 0, amb = {};

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
  if (S.pausedBy || S.away) return S.t;
  return S.t + clamp((performance.now() - lastRecv) / 1000, 0, .3) + (S.rtt || 0) / 2000;
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
  if (!ac || SET.mute) return;
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
  if (parts.length > 500) parts.splice(0, parts.length - 500);
}
function fx(e) {
  const c = COL[e.o] || CG, mineEv = e.o === me;
  switch (e.k) {
    case 'toast': toast(e.txt); break;
    case 'chime': case 'bubble': tone(NOTES[(Math.random() * 6) | 0] * (e.o === 'd' ? .5 : 1), .7); burst(e.x, e.y, e.k === 'bubble' ? [190, 235, 255] : c, 12); if (mineEv) buzz(12); break;
    case 'meteor': tone(NOTES[(Math.random() * 5 + 3) | 0], .9, .06); burst(e.x, e.y, c, 16, 180); if (mineEv) buzz(15); break;
    case 'gold': case 'catch': case 'pearl': case 'find': case 'match':
      tone(659.25, .8); tone(987.77, 1, .06, 'sine', .09); burst(e.x, e.y, CA, 14, 170); burst(e.x, e.y, CG, 14, 130); buzz(25); break;
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
    case 'win': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 1.4, .05, 'sine', i * .11)); burst(e.x, e.y, CG, 40, 320, 3.5); burst(e.x, e.y, CA, 30, 260); burst(e.x, e.y, CD, 30, 260); break;
  }
}

/* ---------- Zeichen-Hilfen ---------- */
function glow(x, y, r, c, a) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
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

/* ---------- Eingabe ---------- */
const IN = {ptr: null, drag: {x: 0, y: 0}, acc: {x: 0, y: 0}, target: null, dirs: [], taps: [], heading: null,
  stick: null, stickDir: null, stickT: 0, tilt: {x: 0, y: 0, on: false, cal: null, listening: false}};
const keys = new Set();
const KEYMAP = {arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd'};
const dirOf = (x, y) => (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : (y > 0 ? 'd' : 'u');
const DANG = {r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2};
function camY() { const L = curL(); return L && L.camY ? (L.camY() || 0) : 0; }
function toWorld(cx, cy) { return {x: (cx - ox) / sc, y: (cy - oy) / sc + camY()}; }
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { if (curL() && curL().ctrl === 'hop' && !e.repeat) IN.dirs.push('u'); return; }
  if (!KEYMAP[k]) return;
  e.preventDefault();
  keys.add(k);
  if (!e.repeat) IN.dirs.push(KEYMAP[k]);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
cv.addEventListener('pointerdown', e => {
  audio();
  if (SET.ctrl === 'tilt' && !IN.tilt.listening) enableTilt();
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  const L = curL(), w = toWorld(e.clientX, e.clientY);
  IN.ptr = {id: e.pointerId, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, sent: false};
  IN.acc.x = IN.acc.y = 0;
  if (L && L.ctrl === 'tap') { IN.taps.push(w); return; }
  if (SET.ctrl === 'stick') IN.stick = {ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY};
  if (SET.ctrl === 'tap') {
    IN.target = w;
    const d = dirOf(w.x - mine.x, w.y - mine.y); if (d) IN.dirs.push(d);
    IN.heading = Math.atan2(w.y - mine.y, w.x - mine.x);
  }
});
cv.addEventListener('pointermove', e => {
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
function readInput(dt) {
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

/* ---------- API für Level-Pakete ---------- */
const API = {
  S, LOC, ctx, W, H, R, TAU, VMAX, COL, CA, CD, CG, NOTES, SONG_NOTES, rgba, dist, rnd, clamp, nm, OTH, fmt,
  place, START, drift, stunStep, emit, finish, failRestart, teleport, act, hostNow, tone, buzz, toast,
  glow, dotW, label, line2, heartPath, rr, defaultMove, inputX, desiredDir, desiredHeading, speedMul, mine, ghost, pend,
  get me() { return me; }, get other() { return other; }, get role() { return role; }, get SET() { return SET; }
};
const LV = (window.ZL_PACKS || []).flatMap(f => f(API)).sort((a, b) => a.w - b.w);
const IDX = {}; LV.forEach((l, i) => IDX[l.id] = i);

/* ---------- Spielablauf (rechnet beim Gastgeber) ---------- */
function mkP(k, L) {
  const s = L && L.start ? L.start(k) : {x: k === 'a' ? W * .35 : W * .65, y: H * .9};
  return {x: s.x, y: s.y, lit: 1, inv: 2, out: 0, carry: 0, tp: 0};
}
function newState() {
  clearObj(S);
  Object.assign(S, {ok: 1, v: VERSION, phase: 'card', card: 'welcome', lv: -1, t: 0, sid: 0, items: [], aux: {}, count: 0, total: 0, cur: 0,
    ready: {a: 0, d: 0}, done: 0, finT: 0, lt: 0, countT: 0, stars: {}, startLv: 0, quiz: null, pausedBy: null, away: null, rtt: 0,
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
  if (S.phase === 'play' && S.done && S.t >= S.finT) {
    S.done = 0; S.ready = {a: 0, d: 0};
    if (S.lv >= LV.length - 1) { S.phase = 'end'; save(0); }
    else { S.phase = 'card'; S.card = LV[S.lv + 1].w !== L.w ? 'world' : 'level'; }
  }
  if (S.phase === 'quiz' && S.quiz.reveal && S.t > S.quiz.revealT) {
    const Q = S.quiz;
    if (Q.i + 1 < Q.n) { Q.i++; Q.asker = OTH(Q.asker); Q.pick = {a: -1, d: -1}; Q.reveal = 0; }
    else setupLevel(Q.next);
  }
}
const readyKeyNow = () => `${S.phase}:${S.card}:${S.lv}:${S.sid}`;
function checkReady() {
  if (!S.ready.a || !S.ready.d) return;
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
function save(lv) { try { localStorage.setItem('zl3-save', JSON.stringify({lv, id: LV[lv] ? LV[lv].id : '', stars: S.stars})); } catch (e) {} }
function loadSave() { try { return JSON.parse(localStorage.getItem('zl3-save')) || null; } catch (e) { return null; } }

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

function hostStart() {
  if (noPeer()) return;
  role = 'host'; me = 'd'; other = 'a';
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
function onHostConn(c) {
  c.on('open', () => {
    if (conn && conn !== c) { try { conn.close(); } catch (e) {} }
    conn = c; lastPosRecv = performance.now();
    if (!S.ok) { newState(); S.startLv = startLv; const sv = loadSave(); if (sv && sv.stars && typeof sv.stars === 'object') S.stars = sv.stars; }
    S.away = null;
    hideAll(); startLoop(); sendState();
  });
  c.on('data', d => {
    if (c !== conn) return;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || !S.ok) return;
    lastPosRecv = performance.now();
    if (S.away === other && d.t !== 'vis') S.away = null;
    switch (d.t) {
      case 'pos': if (d.sid === S.sid && (d.tp || 0) === (S.p[other].tp || 0)) { S.p[other].x = d.x; S.p[other].y = d.y; } break;
      case 'ready': if (d.key === readyKeyNow()) { S.ready[other] = 1; checkReady(); } break;
      case 'pick': if (S.quiz && d.key === quizKey() && S.quiz.pick[other] < 0 && !S.quiz.reveal) { S.quiz.pick[other] = d.v; checkQuiz(); } break;
      case 'act': handleAct(other, d.d); break;
      case 'pong': S.rtt = Math.round(performance.now() - d.ts); break;
      case 'vis': S.away = d.v ? null : other; break;
    }
  });
  c.on('close', () => { if (c === conn) { conn = null; if (S.ok) S.away = other; } });
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
function connectTo(code) {
  let c;
  try { c = peer.connect(PID(code), {reliable: true, serialization: 'json'}); } catch (e) { return; }
  if (!c) return;
  conn = c;
  const slow = setTimeout(() => { if (!c.open && !S.ok) gStatus('<span class="dots">Dauert etwas länger</span>'); }, 7000);
  c.on('open', () => {
    clearTimeout(slow); clearTimeout(reconT); reconTries = 0;
    lastRecv = performance.now();
    hideAll(); $('ovLost').hidden = true; startLoop(); $('gJoin').disabled = false;
    try { c.send({t: 'hello', v: VERSION}); } catch (e) {}
  });
  c.on('data', d => {
    if (c !== conn || !d) return;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (d.t === 'ping') { try { c.send({t: 'pong', ts: d.ts}); } catch (e) {} return; }
    if (d.t !== 's' || !d.s) return;
    if (d.s.v !== VERSION) { $('ovVersion').hidden = false; return; }
    lastRecv = performance.now();
    clearObj(S); Object.assign(S, d.s);
    if (readyKey && readyKey === readyKeyNow()) S.ready[me] = 1;
    if (pickMemo && S.quiz && pickMemo.key === quizKey() && S.quiz.pick[me] < 0) S.quiz.pick[me] = pickMemo.v;
    if (d.ev) d.ev.forEach(e => { try { fx(e); } catch (er) {} });
  });
  c.on('close', () => { if (c === conn) lost(); });
  c.on('error', () => {});
}
function lost() {
  conn = null;
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
function sendState() {
  if (!conn || !conn.open) { outEv = []; return; }
  const dc = conn.dataChannel;
  if (dc && dc.bufferedAmount > 65536) return;
  try { conn.send(JSON.stringify({t: 's', s: S, ev: outEv}, rounder)); outEv = []; } catch (e) {}
}

/* ---------- Oberfläche: Karten, Quiz, Menü, Karte ---------- */
let cardKey = '';
const quizKey = () => S.quiz ? `${S.quiz.base}:${S.quiz.i}` : '';
const starsHTML = n => `<div class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></div>`;
const legend = () => `<div class="legend"><span><i style="background:var(--a)"></i>${esc(nm('a'))}</span><span><i style="background:var(--d)"></i>${esc(nm('d'))}</span></div>`;
function ctrlText(L) {
  if (L.ctrlText) return L.ctrlText(SET.ctrl);
  const m = SET.ctrl;
  const base = {
    free: {swipe: 'Wische irgendwo, um dein Licht zu bewegen.', stick: 'Daumen auflegen und ziehen – wie ein Joystick.', tap: 'Halte den Finger dorthin, wo dein Licht hin soll.', tilt: 'Neige dein Handy in die Richtung.'},
    paddle: {swipe: 'Wische nach links und rechts für deinen Schläger.', stick: 'Joystick nach links und rechts.', tap: 'Halte den Finger über die Stelle, wo der Schläger hin soll.', tilt: 'Kipp das Handy nach links und rechts.'},
    steer: {swipe: 'Deine Kette fährt von selbst – wische in die neue Richtung.', stick: 'Lenk mit dem Joystick.', tap: 'Tippe dorthin, wo du hinwillst.', tilt: 'Lenk durch Neigen.'},
    jump: {swipe: 'Du springst von selbst – wische nach links und rechts.', stick: 'Joystick nach links und rechts.', tap: 'Halte den Finger links oder rechts von dir.', tilt: 'Kipp das Handy – hier macht Neigen besonders Spaß.'},
    hop: {swipe: 'Kurz tippen = ein Feld vor. Wischen = in die Richtung hüpfen.', stick: 'Joystick kurz in eine Richtung drücken.', tap: 'Tippe neben dein Licht, in die Richtung des Sprungs.', tilt: 'Kurz kippen = ein Hüpfer.'},
    grid: {swipe: 'Wische in die Richtung, in die du abbiegen willst.', stick: 'Joystick in die neue Richtung.', tap: 'Tippe in die Richtung, in die du willst.', tilt: 'Neige in die neue Richtung.'}
  }[L.ctrl || 'free'];
  return (base && base[m]) || '';
}
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
      ${role === 'host' ? '<button class="btn" id="cBtn">Nochmal spielen</button><button class="btn ghost" id="cMap">Reisekarte</button>' : `<p class="hint">${esc(nm('d'))} kann jederzeit eine neue Runde starten.</p>`}`;
  } else if (S.phase === 'intro' && L) {
    html = `<div class="chips"><span class="chip">Welt ${L.w + 1} · ${WORLDS[L.w].n}</span><span class="chip">Level ${S.lv + 1}/${LV.length}</span></div>
      <h2>${esc(L.n)}</h2><p class="hint big">${esc(L.h(me))}</p>
      <div class="ctrl"><span class="cico">${ICON[L.ctrl === 'tap' ? 'tap' : SET.ctrl] || ''}</span><span>${esc(ctrlText(L))}</span>${L.ctrl === 'tap' ? '' : '<button class="link" id="cCtrl">ändern</button>'}</div>
      <div class="who" id="cWho"></div>
      <button class="btn" id="cBtn">Bereit</button>`;
  } else if (S.card === 'welcome') {
    const resume = (S.startLv || 0) > 0;
    html = `<p class="kicker">Ihr seid verbunden 💛</p><h2>${resume ? 'Willkommen zurück' : 'Hallo ' + esc(nm('a'))}</h2>
      <p class="msg">${resume ? `Weiter geht's mit „${esc(LV[S.startLv].n)}“.` : esc(CFG.welcome)}</p>${legend()}
      <p class="hint">${LV.length} Level in ${WORLDS.length} Welten. Vor jedem Level drückt ihr beide auf „Bereit“ – dann zählt ein Countdown runter. Steuerung und Pause findest du oben rechts im Menü.</p>
      <div class="who" id="cWho"></div>
      <button class="btn" id="cBtn">Ich bin bereit</button>
      ${role === 'host' ? '<button class="btn ghost" id="cMap">Level auswählen</button>' : ''}`;
  } else if (L) {
    html = `<p class="kicker">${WORLDS[L.w].n} · ${esc(L.n)}</p>${starsHTML(S.lastStars || 1)}
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
    if (S.phase === 'end') { if (role === 'host') { setupLevel(0); } return; }
    S.ready[me] = 1; readyKey = readyKeyNow();
    if (role === 'host') checkReady(); else if (conn && conn.open) conn.send({t: 'ready', key: readyKey});
  };
  const ag = $('cAgain'); if (ag) ag.onclick = () => setupLevel(S.lv);
  const mp = $('cMap'); if (mp) mp.onclick = openMap;
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
function whoHTML() {
  return ['a', 'd'].map(k => `<span class="pp ${k}${S.ready[k] ? ' on' : ''}"><i></i>${esc(nm(k))}<b>${S.ready[k] ? '✓' : '…'}</b></span>`).join('');
}
/* Menü */
const ICON = {
  swipe: '<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16"/></svg>',
  stick: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="14" cy="10" r="3"/></svg>',
  tap: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/></svg>',
  tilt: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(-15 12 12)"/></svg>'
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
  $('mCtrlD').textContent = CTRL[SET.ctrl].d + (SET.ctrl === 'tilt' ? ' – „Neu ausrichten“ setzt die aktuelle Haltung als Mitte.' : '');
  $('mCal').hidden = SET.ctrl !== 'tilt';
  $('mSound').textContent = SET.mute ? 'Ton: aus' : 'Ton: an';
  $('mVib').textContent = SET.vib ? 'Vibration: an' : 'Vibration: aus';
  const playing = S.ok && S.lv >= 0 && ['play', 'count', 'intro'].includes(S.phase);
  $('mPause').hidden = !(S.ok && S.phase === 'play');
  $('mRestart').hidden = !playing;
  $('mMap').hidden = role !== 'host' || !S.ok;
  const rtt = S.rtt || 0, ok = conn && conn.open;
  $('mNet').textContent = !S.ok ? 'Noch nicht verbunden' : ok ? `Verbunden · ${rtt ? rtt + ' ms' : 'messe …'}` : 'Getrennt – verbinde neu …';
}
$('menuBtn').onclick = () => { audio(); openMenu(); };
$('mClose').onclick = () => $('ovMenu').hidden = true;
$('ovMenu').addEventListener('click', e => { if (e.target.id === 'ovMenu') $('ovMenu').hidden = true; });
$('mSound').onclick = () => { SET.mute = !SET.mute; saveSet(); openMenu(); };
$('mVib').onclick = () => { SET.vib = !SET.vib; saveSet(); openMenu(); };
$('mCal').onclick = () => { IN.tilt.cal = null; toast('Neigung neu ausgerichtet'); };
$('mPause').onclick = () => { act({k: 'pause', v: 1}); $('ovMenu').hidden = true; };
$('mRestart').onclick = () => { if (confirm('Dieses Level für euch beide neu starten?')) { act({k: 'restart'}); $('ovMenu').hidden = true; } };
$('mMap').onclick = () => { $('ovMenu').hidden = true; openMap(); };
$('pRes').onclick = () => act({k: 'pause', v: 0});
function openMap() {
  if (role !== 'host' || !S.ok) return;
  $('ovMap').hidden = false;
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
    $('ovMap').hidden = true; setupLevel(i);
  });
}
$('mapClose').onclick = () => $('ovMap').hidden = true;
$('ovMap').addEventListener('click', e => { if (e.target.id === 'ovMap') $('ovMap').hidden = true; });

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
  // Verbindung
  const fresh = role === 'host' ? (conn && conn.open && now - lastPosRecv < 2500) : (conn && conn.open && now - lastRecv < 2500);
  const q = !fresh ? 'bad' : (S.rtt || 0) > 350 ? 'mid' : 'good';
  $('net').className = 'dot ' + q;
  // Pause / Warten
  const pz = S.pausedBy || S.away;
  $('ovPause').hidden = !pz || !$('ovLost').hidden;
  if (pz) {
    const t = S.pausedBy ? `${nm(S.pausedBy)} hat pausiert.` : role === 'host' ? `${nm(other)} ist gerade nicht verbunden. Sie kann einfach den Link neu öffnen – Code ${lastCode}. Das Spiel wartet.` : `${nm(S.away)} ist gerade weg. Das Spiel wartet.`;
    if ($('pText').textContent !== t) $('pText').textContent = t;
    $('pTitle').textContent = S.pausedBy ? 'Pause' : 'Kurz warten';
    $('pRes').hidden = !S.pausedBy;
  }
}

/* ---------- Hintergründe ---------- */
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = innerWidth; ch = innerHeight;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  fog.width = cv.width; fog.height = cv.height;
  sc = Math.min((cw - 12) / W, (ch - HUDH - 12) / H);
  ox = (cw - W * sc) / 2; oy = HUDH + (ch - HUDH - 12 - H * sc) / 2;
  const n = Math.round(cw * ch / 5200);
  amb = {stars: [], bub: [], flies: [], bokeh: [], blades: []};
  for (let i = 0; i < n; i++) amb.stars.push({x: Math.random() * cw, y: Math.random() * ch, r: Math.random() * 1.3 + .3, p: rnd(0, 6.28), s: rnd(.6, 1.8)});
  for (let i = 0; i < 40; i++) amb.bub.push({x: Math.random() * cw, y: Math.random() * ch, r: rnd(1, 4), s: rnd(15, 45), p: rnd(0, 6.28)});
  for (let i = 0; i < 34; i++) amb.flies.push({x: Math.random() * cw, y: Math.random() * ch, p: rnd(0, 6.28), s: rnd(.3, .8)});
  const warm = [[255, 190, 120], [255, 150, 120], [255, 214, 160], [240, 140, 170]];
  for (let i = 0; i < 26; i++) amb.bokeh.push({x: Math.random() * cw, y: Math.random() * ch, r: rnd(8, 34), s: rnd(4, 14), c: warm[i % 4], p: rnd(0, 6.28)});
  for (let x = 0; x < cw; x += 7) amb.blades.push({x, h: rnd(14, 46), p: rnd(0, 6.28)});
}
addEventListener('resize', resize); resize();
function theme() {
  if (!S.ok) return 'nacht';
  if (S.phase === 'quiz') return WORLDS[LV[S.quiz.next].w].th;
  const L = LV[S.lv >= 0 ? S.lv : (S.startLv || 0)];
  return L.theme || WORLDS[L.w].th;
}
const PAL = {nacht: ['#0b0a1c', '#15112e', '#231a3d'], meer: ['#03182a', '#062f47', '#0b4558'], garten: ['#0c1a1a', '#16302a', '#2f3f30'],
  arcade: ['#07061a', '#120a2e', '#2a0f3e'], laternen: ['#120b1f', '#27122d', '#47202f']};
function drawBg(th, t) {
  const pal = PAL[th] || PAL.nacht;
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, pal[0]); bg.addColorStop(.6, pal[1]); bg.addColorStop(1, pal[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
  if (th === 'nacht' || th === 'arcade') {
    for (const s of amb.stars) {
      if (th === 'arcade' && s.y > ch * .55) continue;
      ctx.globalAlpha = .35 + .45 * (.5 + .5 * Math.sin(t * s.s + s.p)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
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
      const g = ctx.createLinearGradient(0, 0, 0, ch * .8);
      g.addColorStop(0, 'rgba(160,230,255,.10)'); g.addColorStop(1, 'rgba(160,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 110, ch * .8); ctx.lineTo(x - 50, ch * .8); ctx.fill();
    }
    for (const b of amb.bub) {
      const y = ((b.y - t * b.s) % ch + ch) % ch, x = b.x + Math.sin(t + b.p) * 6;
      ctx.strokeStyle = 'rgba(190,240,255,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.stroke();
    }
  } else if (th === 'garten') {
    for (const s of amb.stars) { if (s.y > ch * .5) continue; ctx.globalAlpha = .2 + .3 * (.5 + .5 * Math.sin(t * s.s + s.p)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * .8, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const f of amb.flies) {
      const x = f.x + Math.sin(t * f.s + f.p) * 30, y = f.y + Math.cos(t * f.s * .7 + f.p) * 22, a = .35 + .35 * Math.sin(t * 2 + f.p);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, `rgba(220,255,150,${a})`); g.addColorStop(1, 'rgba(220,255,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(8,18,14,.85)'; ctx.beginPath(); ctx.moveTo(0, ch);
    for (const b of amb.blades) { const sw = Math.sin(t * 1.2 + b.p) * 3; ctx.lineTo(b.x + sw, ch - b.h); ctx.lineTo(b.x + 3.5, ch); }
    ctx.lineTo(cw, ch); ctx.fill();
  } else if (th === 'laternen') {
    for (const b of amb.bokeh) {
      const y = ((b.y - t * b.s) % ch + ch) % ch, x = b.x + Math.sin(t * .2 + b.p) * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r); g.addColorStop(0, rgba(b.c, .16)); g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill();
    }
  }
}

/* ---------- Spieler & Szene ---------- */
function player(k, x, y, p, t) {
  const c = COL[k], lit = p ? p.lit : 1, L = curL();
  const fl = lit ? 1 + Math.sin(t * 7 + (k === 'a' ? 0 : 2)) * .05 + Math.sin(t * 13) * .03 : .6;
  const big = L && L.highlight ? L.highlight(k) : 1;
  if (lit) { glow(x, y, 80 * fl * big, c, .36); glow(x, y, 34 * fl * big, c, .55); } else glow(x, y, 28, [120, 115, 140], .3);
  if (p && p.inv > 0 && lit && S.phase === 'play') { ctx.beginPath(); ctx.arc(x, y, R + 9, 0, TAU); ctx.strokeStyle = rgba(CG, .25 + .2 * Math.sin(t * 10)); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x, y, R * .62, 0, TAU);
  ctx.fillStyle = lit ? '#fffaf3' : '#5d5872'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = lit ? rgba(c, 1) : 'rgba(150,145,170,.7)'; ctx.stroke();
  if (k === me) { ctx.beginPath(); ctx.arc(x, y, R + 5, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(c, .35); ctx.stroke(); }
  if (!(L && L.hideNames)) label(nm(k), x, y + R + 24, lit ? c : [150, 145, 170], 16);
  if (!lit) label((L && L.stun) || 'erloschen', x, y - R - 12, [225, 220, 240], 13);
  if (p && L && L.drawCarry && S.phase === 'play') { try { L.drawCarry(k, x, y, p, t); } catch (e) {} }
}
function drawFog(pos, vis, cam) {
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, fog.width, fog.height);
  fctx.fillStyle = 'rgba(6,4,14,.92)'; fctx.fillRect(0, 0, fog.width, fog.height);
  fctx.globalCompositeOperation = 'destination-out';
  for (const k of ['a', 'd']) {
    const x = (ox + pos[k].x * sc) * dpr, y = (oy + (pos[k].y - cam) * sc) * dpr, r = vis * sc * dpr;
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
function render(now) {
  const t = now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBg(theme(), t);
  if (!S.ok) return;
  const L = curL(), cam = camY();
  const world = () => ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * (oy - cam * sc));
  ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
  ctx.fillStyle = theme() === 'arcade' ? 'rgba(7,6,20,.8)' : 'rgba(255,255,255,.02)'; ctx.strokeStyle = theme() === 'arcade' ? 'rgba(160,120,255,.35)' : 'rgba(255,255,255,.07)'; ctx.lineWidth = 1.5;
  rr(0, 0, W, H, 28); ctx.fill(); ctx.stroke();
  ctx.save(); rr(0, 0, W, H, 28); ctx.clip();
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
  if (L && L.fog && S.phase === 'play') { drawFog(pos, L.fog, cam); world(); }
  if (!(L && L.hidePlayers)) { player(other, ghost.x, ghost.y, S.p[other], t); player(me, mine.x, mine.y, S.p[me], t); }
  if (S.phase === 'end') skyLanterns(t);
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = rgba(p.c, 1); ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.5 + p.life * .5), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Bildschirm-Ebene
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (L && L.camY && S.phase === 'play') {
    const gy = ghost.y - cam;
    if (gy < 10 || gy > H - 10) {
      const sx = ox + ghost.x * sc, sy = gy < 10 ? oy + 24 : oy + H * sc - 24, up = gy < 10;
      ctx.fillStyle = rgba(COL[other], .95); ctx.beginPath();
      ctx.moveTo(sx, sy + (up ? -12 : 12)); ctx.lineTo(sx - 10, sy + (up ? 4 : -4)); ctx.lineTo(sx + 10, sy + (up ? 4 : -4)); ctx.fill();
      ctx.font = '600 13px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillText(nm(other), sx, sy + (up ? 22 : -14));
    }
  }
  if (SET.ctrl === 'stick' && IN.stick && S.phase === 'play') {
    const s = IN.stick, dx = s.x - s.ox, dy = s.y - s.oy, m = Math.hypot(dx, dy), k = m > 55 ? 55 / m : 1;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.ox, s.oy, 55, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(COL[me], .55); ctx.beginPath(); ctx.arc(s.ox + dx * k, s.oy + dy * k, 24, 0, TAU); ctx.fill();
  }
  if (S.phase === 'count') {
    const left = S.countT - hostNow(), n = Math.max(1, Math.ceil(left));
    if (LOC.cd !== n) { LOC.cd = n; tone(n === 1 ? 660 : 440, .2, .06, 'triangle'); }
    const f = left - Math.floor(left);
    ctx.save(); ctx.translate(cw / 2, ch / 2); const s = 1 + (f) * .25;
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
let last = performance.now(), netT = 0, pingT = 0, loopOn = false;
function startLoop() { wake(); if (loopOn) return; loopOn = true; last = performance.now(); requestAnimationFrame(frame); }
function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
  const inp = readInput(dt);
  if (S.ok) {
    if (S.sid !== lastSid) {
      lastSid = S.sid; clearObj(LOC); LOC.fadeT = now; pend.x = pend.y = 0; parts = [];
      mine.x = S.p[me].x; mine.y = S.p[me].y; ghost.x = S.p[other].x; ghost.y = S.p[other].y; lastTp = S.p[me].tp || 0;
    }
    if ((S.p[me].tp || 0) !== lastTp) {
      lastTp = S.p[me].tp || 0; mine.x = S.p[me].x; mine.y = S.p[me].y; pend.x = pend.y = 0;
      const L = curL(); if (L && L.onTeleport) { try { L.onTeleport(); } catch (e) {} }
    }
    moveMine(dt, inp);
    netT += dt;
    if (role === 'host') {
      S.p[me].x = mine.x; S.p[me].y = mine.y;
      if (!conn || !conn.open) S.away = other; else if (now - lastPosRecv > 4500) S.away = other;
      update(dt);
      if (netT > .05) { netT = 0; sendState(); }
      pingT += dt;
      if (pingT > 2 && conn && conn.open) { pingT = 0; try { conn.send({t: 'ping', ts: performance.now()}); } catch (e) {} }
    } else {
      if (netT > .033) {
        netT = 0;
        if (conn && conn.open) { try { conn.send({t: 'pos', x: Math.round(mine.x * 10) / 10, y: Math.round(mine.y * 10) / 10, sid: S.sid, tp: lastTp}); } catch (e) {} }
      }
      const stale = now - lastRecv;
      if (stale > 2500 && conn && !netWarn) { netWarn = true; toast(`Verbindung zu ${nm('d')} wackelt …`); }
      if (stale < 1000) netWarn = false;
      if (stale > 10000 && conn) { try { conn.close(); } catch (e) {} lost(); }
    }
    const tgt = S.p[other], k = Math.min(1, dt * 14);
    if (dist(tgt, ghost) > 250) { ghost.x = tgt.x; ghost.y = tgt.y; } else { ghost.x += (tgt.x - ghost.x) * k; ghost.y += (tgt.y - ghost.y) * k; }
  }
  stepParts(dt);
  try { render(now); } catch (e) { console.error(e); }
  syncUI(now);
  requestAnimationFrame(frame);
}
(function idle(now) { if (loopOn) return; try { render(now); } catch (e) {} requestAnimationFrame(idle); })(performance.now());
})();
