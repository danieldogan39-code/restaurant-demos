/* Zwei Lichter – Level-Paket 4 (neu in Version 7)
   „Glühwürmchennetz“: der Lichtfaden zwischen euch ist euer Netz
   „Herzkugel“: eine schwere Kugel, die zu zweit doppelt so schnell rollt
   „Lichtteppich“: wo ihr beide wart, wird der Platz golden */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, W, H, R, TAU, COL, CA, CD, CG, rgba, dist, rnd, clamp, nm, OTH, emit, finish, teleport, glow, dotW, label, heartPath, rr, defaultMove, stunStep, hostNow, mine} = API;

const segT = (p, a, b) => { const abx = b.x - a.x, aby = b.y - a.y, l2 = abx * abx + aby * aby || 1; return clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1); };
const segD = (p, a, b) => { const t = segT(p, a, b); return Math.hypot(p.x - a.x - (b.x - a.x) * t, p.y - a.y - (b.y - a.y) * t); };

/* =====================================================================
   GLÜHWÜRMCHENNETZ
   ===================================================================== */
const NMAX = 340, FLY = [220, 255, 150];
function spawnFly() {
  const A = S.aux; let p, n = 0;
  do { p = {x: rnd(60, W - 60), y: rnd(190, H - 60)}; n++; } while (n < 50 && (dist(p, S.p.a) < 150 || dist(p, S.p.d) < 150 || segD(p, S.p.a, S.p.d) < 70));
  S.items.push({id: A.id++, x: p.x, y: p.y, vx: 0, vy: 0, wa: rnd(0, TAU), ph: +rnd(0, TAU).toFixed(2)});
  A.spawned++;
}
const netz = {
  id: 'netz', n: 'Glühwürmchennetz', ic: '✧', t3: 70, t2: 120, noThread: true, isNew: true,
  h: () => `Zwischen ${nm('a')} und ${nm('d')} spannt sich ein Lichtfaden – euer Netz. Zieht ihn gemeinsam durch die Glühwürmchen! Dunkle Motten zerreißen den Faden, und wenn ihr zu weit auseinander geht, reißt er auch.`,
  ctrlText: m => ({swipe: 'Wische, um dich zu bewegen. Der Faden zwischen euch fängt die Glühwürmchen.', stick: 'Joystick zum Bewegen – der Faden zwischen euch ist das Netz.', tap: 'Halte den Finger dorthin, wo du hin willst. Der Faden fängt.', tilt: 'Neige dein Handy. Der Faden zwischen euch fängt.'}[m]),
  start: k => ({x: k === 'a' ? W * .3 : W * .7, y: H * .82}),
  countText: () => `${S.count}/${S.total}`,
  setup() {
    S.items = []; S.aux = {id: 0, spawned: 0, broke: 0, on: 1, far: 0, moths: []};
    for (let i = 0; i < 9; i++) spawnFly();
    const nmo = API.diff() < 1 ? 1 : API.diff() > 1 ? 3 : 2;
    for (let i = 0; i < nmo; i++) { const a = rnd(0, TAU), v = rnd(60, 85) * API.diff(); S.aux.moths.push({x: rnd(120, W - 120), y: rnd(260, 620), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ph: +rnd(0, 6).toFixed(2)}); }
    S.total = 20;
  },
  update(dt) {
    const A = S.aux, a = S.p.a, d = S.p.d, len = dist(a, d);
    A.far = len > NMAX ? 1 : 0;
    A.on = S.t > A.broke && !A.far && a.lit && d.lit ? 1 : 0;
    for (const f of S.items) {
      f.wa += rnd(-2.4, 2.4) * dt;
      let ax = Math.cos(f.wa) * 70, ay = Math.sin(f.wa) * 70;
      for (const k of ['a', 'd']) { const p = S.p[k], dd = dist(p, f); if (dd < 95 && dd > 1) { const s = (95 - dd) / 95 * 520; ax += (f.x - p.x) / dd * s; ay += (f.y - p.y) / dd * s; } }
      if (f.x < 60) ax += 220; if (f.x > W - 60) ax -= 220; if (f.y < 190) ay += 220; if (f.y > H - 60) ay -= 220;
      f.vx = (f.vx + ax * dt) * (1 - 2 * dt); f.vy = (f.vy + ay * dt) * (1 - 2 * dt);
      const sp = Math.hypot(f.vx, f.vy), mx = 150; if (sp > mx) { f.vx *= mx / sp; f.vy *= mx / sp; }
      f.x = clamp(f.x + f.vx * dt, 24, W - 24); f.y = clamp(f.y + f.vy * dt, 160, H - 24);
    }
    for (const m of A.moths) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x < 50 || m.x > W - 50) { m.vx *= -1; m.x = clamp(m.x, 50, W - 50); }
      if (m.y < 190 || m.y > H - 60) { m.vy *= -1; m.y = clamp(m.y, 190, H - 60); }
      // Motten fliegen leicht auf den Faden zu
      if (A.on) { const tt = segT(m, a, d), cx = a.x + (d.x - a.x) * tt, cy = a.y + (d.y - a.y) * tt, dd = Math.hypot(cx - m.x, cy - m.y) || 1; m.vx += (cx - m.x) / dd * 14 * dt; m.vy += (cy - m.y) / dd * 14 * dt; }
      const sp = Math.hypot(m.vx, m.vy), lim = 95 * API.diff(); if (sp > lim) { m.vx *= lim / sp; m.vy *= lim / sp; }
      if (A.on && segD(m, a, d) < 22 && dist(m, a) > R && dist(m, d) > R) {
        A.broke = S.t + 2.2; A.on = 0; emit({k: 'snap', x: m.x, y: m.y});
        emit({k: 'toast', txt: 'Eine Motte hat den Faden zerrissen!'});
        m.vx *= -1; m.vy *= -1;
      }
    }
    if (A.on) {
      for (const f of S.items) {
        if (f.got || segD(f, a, d) >= 20) continue;
        f.got = 1; S.count++;
        emit({k: 'firefly', x: f.x, y: f.y, o: dist(f, a) < dist(f, d) ? 'a' : 'd'});
      }
    }
    if (S.items.some(f => f.got)) S.items = S.items.filter(f => !f.got);
    while (S.items.length < 8 && S.items.length + S.count < S.total + 6) spawnFly();
    if (S.count >= S.total) finish();
  },
  draw(t, pos) {
    const A = S.aux; if (!A.moths) return;
    const a = pos.a, d = pos.d, len = dist(a, d), now = hostNow(), broken = now < A.broke, far = len > NMAX;
    // Glas oben in der Mitte, füllt sich mit den gefangenen Lichtern
    jar(W / 2, 105, S.count, S.total, t);
    // Glühwürmchen
    for (const f of S.items) {
      const bl = .55 + .45 * Math.sin(t * 3.2 + f.ph), x = f.x + Math.sin(t * 2 + f.ph) * 3, y = f.y + Math.cos(t * 1.7 + f.ph) * 3;
      glow(x, y, 34, FLY, .35 + bl * .4);
      ctx.fillStyle = 'rgba(40,40,30,.9)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 1, 3.5, 2.4, .4, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba([255, 255, 200], .4 + bl * .6); ctx.beginPath(); ctx.arc(x + 2, y + 1, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(230,240,255,.4)'; const wf = Math.sin(t * 30 + f.ph) * 2;
      ctx.beginPath(); ctx.ellipse(x - 3, y - 4 - wf * .3, 4, 2 + Math.abs(wf) * .4, -.6, 0, TAU); ctx.ellipse(x + 1, y - 4 - wf * .3, 4, 2 + Math.abs(wf) * .4, .6, 0, TAU); ctx.fill();
    }
    // Faden
    const mx = (a.x + d.x) / 2, my = (a.y + d.y) / 2 + Math.sin(t * 2.2) * 8;
    if (broken) {
      const left = clamp((A.broke - now) / 2.2, 0, 1);
      for (const [p, q, c] of [[a, d, CA], [d, a, CD]]) {
        const ex = p.x + (q.x - p.x) * .22, ey = p.y + (q.y - p.y) * .22 + Math.sin(t * 9) * 6;
        ctx.strokeStyle = rgba(c, .5); ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        if (Math.random() < .3) API.spark(ex, ey, c, 1, 30, 1.6);
      }
      label(`Faden reißt … ${Math.ceil(left * 2.2)}`, mx, my - 18, [220, 210, 235], 14, 700);
    } else if (far) {
      ctx.strokeStyle = 'rgba(255,170,160,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 10]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y); ctx.stroke(); ctx.setLineDash([]);
      label('Zu weit auseinander!', mx, my - 14, [255, 190, 180], 15, 700);
    } else {
      const tension = clamp((len - 180) / (NMAX - 180), 0, 1), op = ctx.globalCompositeOperation;
      const g = ctx.createLinearGradient(a.x, a.y, d.x, d.y); g.addColorStop(0, rgba(CA, .95)); g.addColorStop(.5, rgba(CG, .95)); g.addColorStop(1, rgba(CD, .95));
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g; ctx.lineCap = 'round';
      ctx.lineWidth = 9 - tension * 4; ctx.globalAlpha = .25; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, d.x, d.y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 2.6 - tension; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, d.x, d.y); ctx.stroke();
      // zwei feine Netzfäden, die sich umeinander winden
      ctx.lineWidth = 1; ctx.globalAlpha = .55;
      for (const s of [1, -1]) {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const u = i / 24, iu = 1 - u, bx = iu * iu * a.x + 2 * iu * u * mx + u * u * d.x, by = iu * iu * a.y + 2 * iu * u * my + u * u * d.y, off = Math.sin(u * Math.PI * 6 + t * 3 * s) * 7 * Math.sin(u * Math.PI);
          const nx = -(d.y - a.y) / (len || 1), ny = (d.x - a.x) / (len || 1); i ? ctx.lineTo(bx + nx * off, by + ny * off) : ctx.moveTo(bx, by); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) { const u = (t * .45 + i / 6) % 1, iu = 1 - u, px = iu * iu * a.x + 2 * iu * u * mx + u * u * d.x, py = iu * iu * a.y + 2 * iu * u * my + u * u * d.y; glow(px, py, 14, CG, .8); dotW(px, py, 1.6); }
      ctx.globalCompositeOperation = op;
      API.light(mx, my, CG, 120 + len * .3, .55);
      if (tension > .85) label('Gleich reißt er …', mx, my - 16, [255, 210, 190], 13, 700);
    }
    // Motten
    for (const m of A.moths) {
      const f = Math.sin(t * 16 + m.ph), x = m.x, y = m.y + Math.sin(t * 3 + m.ph) * 4;
      glow(x, y, 42, [120, 90, 170], .25);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI / 2);
      ctx.fillStyle = 'rgba(52,40,70,.95)'; ctx.strokeStyle = 'rgba(190,170,230,.55)'; ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * (9 + f * 2), -2, 11 + f * 2, 8, s * .5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(s * 7, 8, 7, 5, -s * .4, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = 'rgba(80,66,100,1)'; ctx.beginPath(); ctx.ellipse(0, 1, 3.2, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,150,.9)'; ctx.beginPath(); ctx.arc(-2, -8, 1.3, 0, TAU); ctx.arc(2, -8, 1.3, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
};
function jar(x, y, n, tot, t) {
  const h = 70, w = 54;
  glow(x, y, 80, FLY, .12 + n / tot * .4);
  if (n) API.light(x, y, FLY, 140, .25 + n / tot * .5);
  ctx.fillStyle = 'rgba(200,230,255,.08)'; ctx.strokeStyle = 'rgba(210,235,255,.5)'; ctx.lineWidth = 2;
  rr(x - w / 2, y - h / 2, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(160,120,90,.9)'; rr(x - w / 2 + 4, y - h / 2 - 10, w - 8, 10, 3); ctx.fill();
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + 9 + r() * (w - 18), py = y + h / 2 - 9 - r() * (h - 18), b = .6 + .4 * Math.sin(t * 3 + i);
    glow(px + Math.sin(t + i) * 2, py, 9, FLY, .7 * b); dotW(px + Math.sin(t + i) * 2, py, 1.3);
  }
  ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(x - w / 2 + 6, y - h / 2 + 6, 5, h - 14, 3); ctx.fill();
  label(`${n}/${tot}`, x, y + h / 2 + 20, FLY, 14, 700);
}

/* =====================================================================
   HERZKUGEL
   ===================================================================== */
const BR = 36;
const KL = [
  {ball: {x: 300, y: 820}, goal: {x: 300, y: 200}, holes: [{x: 120, y: 520, r: 44}, {x: 480, y: 520, r: 44}], bump: [{x: 300, y: 520, r: 30}], walls: [], mov: []},
  {ball: {x: 140, y: 830}, goal: {x: 470, y: 185}, holes: [{x: 545, y: 760, r: 34}, {x: 330, y: 500, r: 36}, {x: 300, y: 205, r: 36}], bump: [], walls: [[0, 640, 380, 28], [220, 330, 380, 28]], mov: []},
  {ball: {x: 300, y: 860}, goal: {x: 300, y: 165}, holes: [{x: 150, y: 660, r: 44}, {x: 450, y: 660, r: 44}, {x: 300, y: 420, r: 46}], bump: [], walls: [], mov: [{y: 545, a: 130, b: 470, sp: .9, r: 28}, {y: 285, a: 150, b: 450, sp: 1.25, r: 28}]}
];
const movX = (m, t) => m.a + (m.b - m.a) * (.5 + .5 * Math.sin(t * m.sp));
function bumpers(lay, t) { return lay.bump.concat(lay.mov.map(m => ({x: movX(m, t), y: m.y, r: m.r, mv: 1}))); }
function kStart(lay) { return {a: {x: clamp(lay.ball.x - 75, 40, W - 40), y: clamp(lay.ball.y + 90, 0, H - 30)}, d: {x: clamp(lay.ball.x + 75, 40, W - 40), y: clamp(lay.ball.y + 90, 0, H - 30)}}; }
function kRound(i) {
  const lay = KL[i], A = S.aux;
  A.round = i; A.ball = {x: lay.ball.x, y: lay.ball.y, vx: 0, vy: 0, rot: 0}; A.fall = 0; A.fx = 0; A.fy = 0; A.win = 0; A.tch = {a: -9, d: -9};
}
function ballView() {
  const A = S.aux, b = A.ball; if (!b) return null;
  const ex = clamp(hostNow() - S.t, 0, .2);
  if (!LOC.bv) LOC.bv = {x: b.x, y: b.y};
  const tx = b.x + b.vx * ex, ty = b.y + b.vy * ex, v = LOC.bv;
  if (Math.hypot(tx - v.x, ty - v.y) > 90) { v.x = tx; v.y = ty; } else { v.x += (tx - v.x) * .45; v.y += (ty - v.y) * .45; }
  return v;
}
const kugel = {
  id: 'kugel', n: 'Herzkugel', ic: '◉', t3: 120, t2: 200, noThread: true, isNew: true,
  skin: {a: 'princess', d: 'prince'}, skinScale: 1.25, nameDY: 44,
  skinName: () => `${nm('a')}: Prinzessin · ${nm('d')}: Prinz`,
  h: () => `Prinzessin ${nm('a')} und Prinz ${nm('d')} rollen die schwere Herzkugel ins goldene Ziel. Allein bewegt sie sich nur langsam – schiebt ihr beide gleichzeitig, rollt sie doppelt so schnell. Drei Gärten, und nicht in die Löcher fallen lassen!`,
  start: k => kStart(KL[0])[k],
  countText: () => `Garten ${Math.min((S.aux.round || 0) + 1, 3)}/3`,
  setup() { S.aux = {}; kRound(0); S.total = 3; },
  walls: () => (KL[S.aux.round || 0] || KL[0]).walls,
  move(dt, inp) {
    defaultMove(dt, inp);
    const b = ballView(); if (!b) return;
    const dx = mine.x - b.x, dy = mine.y - b.y, d = Math.hypot(dx, dy), m = R + BR - 2;
    if (d < m && d > .01 && !S.aux.fall) { mine.x = b.x + dx / d * m; mine.y = b.y + dy / d * m; }
  },
  update(dt) {
    const A = S.aux, lay = KL[A.round], b = A.ball;
    if (A.win) { if (S.t > A.win) { if (A.round + 1 >= KL.length) { finish(); return; } kRound(A.round + 1); const st = kStart(KL[A.round]); teleport('a', st.a.x, st.a.y); teleport('d', st.d.x, st.d.y); } return; }
    if (A.fall) { if (S.t > A.fall) { b.x = lay.ball.x; b.y = lay.ball.y; b.vx = b.vy = 0; A.fall = 0; } return; }
    // Schieben
    const touch = {};
    for (const k of ['a', 'd']) { const p = S.p[k], dd = dist(p, b); if (dd < R + BR + 12 && dd > .01) { touch[k] = dd; A.tch[k] = S.t; } }
    const both = S.t - A.tch.a < .45 && S.t - A.tch.d < .45;
    A.both = both ? 1 : 0;
    for (const k of Object.keys(touch)) {
      const p = S.p[k], dd = touch[k], nx = (b.x - p.x) / dd, ny = (b.y - p.y) / dd, T = (both ? 330 : 165) * (API.diff() > 1 ? .9 : 1);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < T) { const dv = Math.min(T - vn, 1500 * dt); b.vx += nx * dv; b.vy += ny * dv; }
    }
    const fr = Math.exp(-2.4 * dt); b.vx *= fr; b.vy *= fr;
    // sanfter Sog ins Ziel
    const gd = dist(b, lay.goal);
    if (gd < 80 && gd > .5) { const k = (80 - gd) / 80; b.vx += (lay.goal.x - b.x) / gd * 1100 * k * dt; b.vy += (lay.goal.y - b.y) / gd * 1100 * k * dt; const dmp = Math.exp(-4 * k * dt); b.vx *= dmp; b.vy *= dmp; }
    const sp = Math.hypot(b.vx, b.vy); if (sp > 420) { b.vx *= 420 / sp; b.vy *= 420 / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.rot = (b.rot + sp * dt / BR * (b.vx >= 0 ? 1 : -1)) % TAU;
    // Rand
    if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * .6; } if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx) * .6; }
    if (b.y < BR + 60) { b.y = BR + 60; b.vy = Math.abs(b.vy) * .6; } if (b.y > H - BR) { b.y = H - BR; b.vy = -Math.abs(b.vy) * .6; }
    // Hecken
    for (const r of lay.walls) {
      const cx = clamp(b.x, r[0], r[0] + r[2]), cy = clamp(b.y, r[1], r[1] + r[3]), dx = b.x - cx, dy = b.y - cy, dd = Math.hypot(dx, dy);
      if (dd >= BR) continue;
      const nx = dd > .01 ? dx / dd : 0, ny = dd > .01 ? dy / dd : (b.y < r[1] + r[3] / 2 ? -1 : 1);
      b.x = cx + nx * BR; b.y = cy + ny * BR; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; }
    }
    // Sprungkissen
    for (const q of bumpers(lay, S.t)) {
      const dx = b.x - q.x, dy = b.y - q.y, dd = Math.hypot(dx, dy);
      if (dd >= BR + q.r || dd < .01) continue;
      const nx = dx / dd, ny = dy / dd; b.x = q.x + nx * (BR + q.r); b.y = q.y + ny * (BR + q.r);
      const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 2.1 * vn * nx; b.vy -= 2.1 * vn * ny; }
      b.vx += nx * 120; b.vy += ny * 120;
      if (!A.bT || S.t - A.bT > .25) { A.bT = S.t; emit({k: 'bump', x: q.x + nx * q.r, y: q.y + ny * q.r}); }
    }
    // Löcher
    for (const h of lay.holes) if (dist(b, h) < h.r - 6) {
      A.fall = S.t + 1.2; A.fx = h.x; A.fy = h.y; b.vx = b.vy = 0;
      emit({k: 'drop', x: h.x, y: h.y}); emit({k: 'toast', txt: 'Ins Loch gerollt – die Kugel kommt zurück an den Start.'});
      return;
    }
    // Ziel
    if (dist(b, lay.goal) < 26) {
      A.win = S.t + 1.6; S.count = A.round + 1; b.vx = b.vy = 0; b.x = lay.goal.x; b.y = lay.goal.y;
      emit({k: 'goal', x: lay.goal.x, y: lay.goal.y});
      if (A.round + 1 < KL.length) emit({k: 'toast', txt: `Garten ${A.round + 1} geschafft!`});
    }
  },
  draw(t, pos) {
    const A = S.aux; if (!A.ball) return;
    const lay = KL[A.round], tt = hostNow();
    // Rasen mit Mähstreifen
    ctx.fillStyle = 'rgba(44,86,56,.55)'; rr(0, 60, W, H - 60, 24); ctx.fill();
    ctx.fillStyle = 'rgba(160,230,150,.06)'; for (let y = 60; y < H; y += 80) ctx.fillRect(0, y, W, 40);
    ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 60; i++) { const x = (i * 97) % W, y = 80 + (i * 173) % (H - 100); ctx.fillRect(x, y, 2, 5); }
    // Ziel: goldener Ring mit kreisenden Funken
    const g = lay.goal, gp = 1 + Math.sin(t * 3) * .06;
    glow(g.x, g.y, 120, CG, .45); API.light(g.x, g.y, CG, 200, .7);
    ctx.strokeStyle = rgba(CG, .9); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.x, g.y, 44 * gp, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(CG, .4); ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(g.x, g.y, 62, t * .5, t * .5 + TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = rgba(CG, .15); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(g.x, g.y, 80, -t * .3, -t * .3 + TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = t * 1.4 + i * TAU / 8; glow(g.x + Math.cos(a) * 50, g.y + Math.sin(a) * 50, 10, i % 2 ? CA : CG, .8); }
    ctx.fillStyle = rgba(CA, .35); heartPath(g.x, g.y, 14); ctx.fill();
    label('Ziel', g.x, g.y - 70, CG, 15, 700);
    // Löcher
    for (const h of lay.holes) {
      const gr = ctx.createRadialGradient(h.x, h.y + 4, 2, h.x, h.y, h.r);
      gr.addColorStop(0, '#020106'); gr.addColorStop(.75, '#0c0814'); gr.addColorStop(1, 'rgba(20,14,30,.6)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(170,150,130,.8)'; ctx.lineWidth = 5; ctx.setLineDash([9, 5]); ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    // Hecken mit Rosen
    for (const r of lay.walls) {
      ctx.fillStyle = '#1f4a2c'; rr(r[0], r[1], r[2], r[3], 10); ctx.fill();
      ctx.fillStyle = 'rgba(120,190,110,.4)'; for (let x = r[0] + 8; x < r[0] + r[2] - 4; x += 13) { ctx.beginPath(); ctx.arc(x, r[1] + 8 + ((x * 7) % 9), 5, 0, TAU); ctx.fill(); }
      for (let x = r[0] + 20; x < r[0] + r[2] - 10; x += 46) { ctx.fillStyle = x % 3 ? '#f48aa3' : '#ffd0dc'; ctx.beginPath(); ctx.arc(x, r[1] + r[3] / 2, 5, 0, TAU); ctx.fill(); }
    }
    // Sprungkissen
    for (const q of bumpers(lay, tt)) {
      const sq = 1 + Math.sin(t * 6 + q.x) * .04;
      glow(q.x, q.y, q.r * 2.4, CA, .3);
      const gr = ctx.createRadialGradient(q.x - q.r * .3, q.y - q.r * .3, 2, q.x, q.y, q.r);
      gr.addColorStop(0, '#ffe6ee'); gr.addColorStop(.6, '#f49ab4'); gr.addColorStop(1, '#c05a7c');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r * sq, q.r / sq, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(CG, .9); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = rgba(CG, 1); ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? 4 : 10, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(q.x + Math.cos(a) * rr2, q.y + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill();
    }
    // Kugel
    const v = ballView(); if (!v) return;
    let bx = v.x, by = v.y, s = 1, al = 1;
    if (A.fall) { const k = clamp(1 - (A.fall - tt) / 1.2, 0, 1); bx = v.x + (A.fx - v.x) * Math.min(1, k * 3); by = v.y + (A.fy - v.y) * Math.min(1, k * 3); s = Math.max(.05, 1 - k * 1.2); al = 1 - k; }
    ctx.globalAlpha = al;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(bx + 6, by + BR * s * .85, BR * s * .95, BR * s * .35, 0, 0, TAU); ctx.fill();
    glow(bx, by, 90 * s, CA, .25); API.light(bx, by, [255, 170, 190], 200, .6);
    const gr = ctx.createRadialGradient(bx - BR * .35 * s, by - BR * .4 * s, 3, bx, by, BR * s);
    gr.addColorStop(0, '#fff1f4'); gr.addColorStop(.35, '#ffb3c6'); gr.addColorStop(.8, '#e0708f'); gr.addColorStop(1, '#a8476a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, BR * s, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(bx, by, BR * s, 0, TAU); ctx.clip(); ctx.translate(bx, by); ctx.rotate(A.ball.rot || 0);
    ctx.fillStyle = 'rgba(255,240,215,.85)'; heartPath(0, 2 * s, 13 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(243,201,143,.8)'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.ellipse(0, 0, BR * s, BR * s * .28, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgba(CG, .95); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx, by, BR * s, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(bx - BR * .38 * s, by - BR * .42 * s, BR * .2 * s, BR * .12 * s, -.6, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (!A.fall && !A.win) {
      ['a', 'd'].forEach((k, i) => {
        const on = dist(pos[k], v) < R + BR + 14;
        ctx.beginPath(); ctx.arc(bx - 9 + i * 18, by + BR + 16, 5, 0, TAU); ctx.fillStyle = on ? rgba(COL[k], 1) : 'rgba(255,255,255,.2)'; ctx.fill();
      });
      if (A.both) label('Zusammen – doppelt so schnell!', bx, by - BR - 18, CG, 13, 700);
    }
  }
};

/* =====================================================================
   LICHTTEPPICH
   ===================================================================== */
const GC = 12, GR = 17, CS = 50, GY0 = 140, NCELL = GC * GR;
const cellAt = p => { const c = Math.floor(p.x / CS), r = Math.floor((p.y - GY0) / CS); return c >= 0 && c < GC && r >= 0 && r < GR ? r * GC + c : -1; };
const BIT = {a: 1, d: 2};
const teppich = {
  id: 'teppich', n: 'Lichtteppich', ic: '▩', t3: 85, t2: 140, isNew: true, stun: 'verschattet', noMotes: true, noDeco: true,
  h: () => `Jeder malt den Platz in seiner Farbe an. Golden wird eine Fliese erst, wenn ${nm('a')} und ${nm('d')} beide darüber gelaufen sind. Macht den Platz golden – aber die Schattenwesen löschen das Licht wieder aus. Wer sie berührt, verschattet kurz.`,
  start: k => ({x: k === 'a' ? 175 : 425, y: 960}),
  countText: () => `${Math.round(S.aux.gold / NCELL * 100)} %`,
  note: () => `${Math.round(S.aux.gold / NCELL * 100)} % golden`,
  setup() {
    const need = Math.round(NCELL * (API.diff() < 1 ? .55 : API.diff() > 1 ? .72 : .64));
    const nw = API.diff() < 1 ? 1 : API.diff() > 1 ? 3 : 2;
    S.aux = {g: '0'.repeat(NCELL), gold: 0, need, gt: 0, wisps: Array.from({length: nw}, (_, i) => { const a = rnd(0, TAU); return {x: 150 + i * 150, y: 380 + (i % 2) * 200, vx: Math.cos(a) * 75, vy: Math.sin(a) * 75, lc: -1, ph: +rnd(0, 6).toFixed(2)}; })};
    S.total = need;
  },
  update(dt) {
    const A = S.aux, g = A.g.split('');
    let ch = false;
    for (const k of ['a', 'd']) {
      const p = S.p[k]; if (!p.lit) continue;
      const i = cellAt(p); if (i < 0) continue;
      const v = +g[i], nv = v | BIT[k];
      if (nv !== v) { g[i] = String(nv); ch = true; if (nv === 3) { A.gold++; if (S.t - A.gt > .07) { A.gt = S.t; emit({k: 'gild', i: A.gold}); } } }
    }
    for (const w of A.wisps) {
      w.x += w.vx * dt; w.y += w.vy * dt;
      if (w.x < 30 || w.x > W - 30) { w.vx *= -1; w.x = clamp(w.x, 30, W - 30); }
      if (w.y < GY0 + 20 || w.y > H - 30) { w.vy *= -1; w.y = clamp(w.y, GY0 + 20, H - 30); }
      if (Math.random() < dt * .5) { const a = Math.atan2(w.vy, w.vx) + rnd(-.8, .8), s = 75 * API.diff(); w.vx = Math.cos(a) * s; w.vy = Math.sin(a) * s; }
      const i = cellAt(w);
      if (i >= 0 && i !== w.lc) { w.lc = i; if (g[i] !== '0') { if (g[i] === '3') A.gold--; g[i] = '0'; ch = true; } }
    }
    if (ch) A.g = g.join('');
    stunStep(dt, p => A.wisps.some(w => dist(p, w) < R + 20));
    S.count = Math.min(A.gold, S.total);
    if (A.gold >= A.need) finish();
  },
  draw(t, pos) {
    const A = S.aux; if (!A.g) return;
    // Laternen an den Ecken als Lichtquellen
    for (const [x, y] of [[30, 110], [W - 30, 110]]) { glow(x, y, 50, [255, 190, 110], .5); ctx.fillStyle = '#ffcf8a'; ctx.beginPath(); ctx.ellipse(x, y, 9, 12, 0, 0, TAU); ctx.fill(); }
    const pc = Math.round(A.gold / NCELL * 100), need = Math.round(A.need / NCELL * 100);
    label(`${pc} % golden · Ziel ${need} %`, W / 2, 112, CG, 17, 700);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(W / 2 - 150, 122, 300, 6, 3); ctx.fill();
    ctx.fillStyle = rgba(CG, .95); rr(W / 2 - 150, 122, 300 * clamp(A.gold / A.need, 0, 1), 6, 3); ctx.fill();
    const op = ctx.globalCompositeOperation;
    for (let i = 0; i < NCELL; i++) {
      const c = i % GC, r = (i / GC) | 0, x = c * CS, y = GY0 + r * CS, v = A.g.charCodeAt(i) - 48;
      if (!v) { ctx.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.06)'; ctx.fillRect(x + 2, y + 2, CS - 4, CS - 4); continue; }
      if (v === 3) {
        const sh = .55 + .45 * Math.sin(t * 2.4 - (c + r) * .45);
        ctx.fillStyle = `rgba(243,201,143,${.55 + sh * .35})`; ctx.fillRect(x + 2, y + 2, CS - 4, CS - 4);
        ctx.fillStyle = `rgba(255,248,230,${.25 + sh * .35})`; ctx.fillRect(x + 8, y + 8, CS - 16, CS - 16);
      } else {
        ctx.fillStyle = rgba(v === 1 ? CA : CD, .42); ctx.fillRect(x + 2, y + 2, CS - 4, CS - 4);
        ctx.strokeStyle = rgba(v === 1 ? CA : CD, .7); ctx.lineWidth = 1.5; ctx.strokeRect(x + 5, y + 5, CS - 10, CS - 10);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < NCELL; i += 1) { if (A.g.charCodeAt(i) !== 51) continue; const c = i % GC, r = (i / GC) | 0; if ((c + r) % 2) continue; glow(c * CS + CS / 2, GY0 + r * CS + CS / 2, 46, CG, .12); }
    ctx.globalCompositeOperation = op;
    // Schattenwesen
    for (const w of A.wisps) {
      const x = w.x, y = w.y + Math.sin(t * 2.5 + w.ph) * 5;
      ctx.fillStyle = 'rgba(8,5,16,.55)';
      for (let k = 0; k < 7; k++) { const a = t * 1.3 + k * .9 + w.ph; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y + Math.sin(a * 1.3) * 7, 16 - k, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(10,6,20,.95)'; ctx.beginPath(); ctx.arc(x, y, 17, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(170,140,220,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(200,170,255,.95)'; ctx.beginPath(); ctx.ellipse(x - 6, y - 3, 3, 4, 0, 0, TAU); ctx.ellipse(x + 6, y - 3, 3, 4, 0, 0, TAU); ctx.fill();
    }
  }
};

return [netz, kugel, teppich];
});
