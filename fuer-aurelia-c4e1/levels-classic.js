/* Zwei Lichter – Level-Paket 1: Sternennacht, Tiefsee, Frühlingsgarten, Laternenfest */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, W, H, R, TAU, COL, CA, CD, CG, rgba, dist, rnd, clamp, nm, OTH, place, START, drift, stunStep, emit, finish, glow, dotW, label, line2} = API;

const mkJelly = (y, dir) => ({x: rnd(90, W - 90), by: y, y, vx: dir * rnd(45, 70), ph: rnd(0, TAU), r: 26});
function jellyStep(js, dt) {
  for (const j of js) {
    j.x += j.vx * dt;
    if (j.x < 45 || j.x > W - 45) { j.vx *= -1; j.x = clamp(j.x, 45, W - 45); }
    j.y = j.by + Math.sin(S.t * .9 + j.ph) * 45;
  }
}
const jellyHit = js => p => js.some(j => dist(p, j) < j.r + R - 6);
const FIELD = (y, t) => 85 * Math.sin(y / 115 + t * .7);
function nextShell(seq) { let i; do { i = (Math.random() * 6) | 0; } while (seq.length && i === seq[seq.length - 1]); return i; }
function spawnBf() {
  let p, k = 0;
  do { p = {x: rnd(80, W - 80), y: rnd(200, H - 120)}; } while ((dist(p, S.p.a) < 260 || dist(p, S.p.d) < 260) && ++k < 60);
  const hues = [[246, 179, 201], [184, 214, 255], [255, 213, 154], [201, 184, 255]];
  S.items.push({id: S.aux.id++, x: p.x, y: p.y, vx: 0, vy: 0, wa: rnd(0, TAU), c: hues[S.aux.spawned % 4], got: 0});
  S.aux.spawned++;
}
function spark(x, y, c, t, ph) {
  const pul = 1 + Math.sin(t * 3 + ph) * .15;
  glow(x, y, 30 * pul, c, .45); dotW(x, y, 3.2 * pul);
  ctx.strokeStyle = rgba(c, .9); ctx.lineWidth = 1.4; ctx.beginPath();
  ctx.moveTo(x - 9 * pul, y); ctx.lineTo(x + 9 * pul, y); ctx.moveTo(x, y - 9 * pul); ctx.lineTo(x, y + 9 * pul); ctx.stroke();
}
function pairTarget(it, t, pos, r, star) {
  const pul = 1 + Math.sin(t * 4) * .1;
  glow(it.x, it.y, 60 * pul, CG, .4);
  ctx.save(); ctx.setLineDash([4, 7]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(243,201,143,.4)';
  ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, TAU); ctx.stroke(); ctx.restore();
  ['a', 'd'].forEach((k, i) => {
    const near = dist(pos[k], it) < r;
    ctx.beginPath(); ctx.arc(it.x - 10 + i * 20, it.y + r - 10, 4.5, 0, TAU);
    ctx.fillStyle = near ? rgba(COL[k], 1) : 'rgba(255,255,255,.18)'; ctx.fill();
  });
  ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(t * .6);
  ctx.fillStyle = rgba(CG, 1); ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? 6 * pul : 14 * pul, a = i * Math.PI / 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
  if (!star) label('zusammen', it.x, it.y - 30, CG, 13);
}
function bubble(x, y, r) {
  ctx.fillStyle = 'rgba(180,235,255,.12)'; ctx.strokeStyle = 'rgba(200,245,255,.75)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(x - r * .35, y - r * .35, r * .22, 0, TAU); ctx.fill();
}
function jelly(j, t) {
  glow(j.x, j.y, 50, [210, 150, 255], .22);
  ctx.strokeStyle = 'rgba(220,180,255,.55)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    const x0 = j.x - 14 + i * 7; ctx.beginPath(); ctx.moveTo(x0, j.y + 2);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x0 + Math.sin(t * 3 + k * .8 + i) * 3.5, j.y + 2 + k * 5);
    ctx.stroke();
  }
  const s = 1 + Math.sin(t * 2.4 + j.ph) * .06;
  ctx.beginPath(); ctx.ellipse(j.x, j.y, 22 * s, 17 / s, 0, Math.PI, 0); ctx.closePath();
  const g = ctx.createLinearGradient(j.x, j.y - 18, j.x, j.y);
  g.addColorStop(0, 'rgba(235,200,255,.85)'); g.addColorStop(1, 'rgba(190,130,240,.6)');
  ctx.fillStyle = g; ctx.fill();
}
function anemone(x, y, c, on, t) {
  glow(x, y, on ? 60 : 38, c, on ? .5 : .2);
  ctx.strokeStyle = rgba(c, on ? 1 : .7); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + Math.sin(t * 2 + i) * .15, l = on ? 22 : 15;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.fillStyle = rgba(c, 1); ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
}
function shell(x, y, open, t) {
  ctx.save(); ctx.translate(x, y);
  const body = (rot) => {
    ctx.save(); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.quadraticCurveTo(-26, -24, 0, -26); ctx.quadraticCurveTo(26, -24, 24, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -26, 0, 0); g.addColorStop(0, '#f6d7c8'); g.addColorStop(1, '#c99a94');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,80,.45)'; ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(i * 10, -23 + Math.abs(i) * 3); ctx.stroke(); }
    ctx.restore();
  };
  if (open) {
    ctx.save(); ctx.scale(1, -1); body(0); ctx.restore();
    ctx.save(); ctx.translate(0, -2); body(-.55); ctx.restore();
    glow(0, -6, 30, [255, 255, 255], .6 + Math.sin(t * 5) * .1);
    ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.arc(0, -6, 7, 0, TAU); ctx.fill();
  } else { ctx.save(); ctx.scale(1, -1); body(0); ctx.restore(); body(0); }
  ctx.restore();
}
function shellIcon(x, y, on) {
  ctx.save(); ctx.translate(x, y + 8);
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.quadraticCurveTo(-18, -18, 0, -20); ctx.quadraticCurveTo(18, -18, 16, 0); ctx.closePath();
  ctx.fillStyle = on ? 'rgba(255,250,240,.95)' : 'rgba(255,240,230,.45)'; ctx.fill();
  ctx.strokeStyle = 'rgba(80,60,70,.35)'; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(i * 7, -17 + Math.abs(i) * 2); ctx.stroke(); }
  ctx.restore();
}
function basket(x, y) {
  glow(x, y, 70, [230, 190, 130], .2);
  ctx.fillStyle = '#8a5a35'; ctx.beginPath(); ctx.ellipse(x, y + 4, 34, 18, 0, 0, Math.PI); ctx.lineTo(x - 34, y + 4); ctx.fill();
  ctx.fillStyle = '#a8713f'; ctx.beginPath(); ctx.ellipse(x, y + 4, 34, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5b3a20'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(x - 20 + (i % 5) * 10, y + 2 + ((i / 5) | 0) * 4, 2.6, 0, TAU); ctx.fill(); }
  label('Samen', x, y + 40, CA, 13);
}
function fountain(x, y, t) {
  glow(x, y, 70, [140, 200, 255], .25);
  ctx.fillStyle = '#5d6c7a'; ctx.beginPath(); ctx.ellipse(x, y + 8, 34, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(140,200,255,.85)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 27, 9, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(190,230,255,.8)'; ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + i * 12, y - 28 - Math.sin(t * 6 + i) * 3, x + i * 22, y + 2); ctx.stroke(); }
  label('Wasser', x, y + 40, CD, 13);
}
function bed(b, t, i) {
  ctx.fillStyle = '#3d2a1f'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, 30, 13, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(160,120,90,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (b.st === 0) { ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = rgba(CA, .4); ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, 38, 19, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  if (b.st >= 1) {
    ctx.strokeStyle = '#7bc77a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const h = b.st === 2 ? 30 : 12;
    ctx.beginPath(); ctx.moveTo(b.x, b.y + 4); ctx.quadraticCurveTo(b.x + Math.sin(t * 2 + i) * 4, b.y - h / 2, b.x, b.y - h); ctx.stroke();
    ctx.fillStyle = '#8fd48e'; ctx.beginPath(); ctx.ellipse(b.x - 6, b.y - h * .4, 6, 3, -.5, 0, TAU); ctx.ellipse(b.x + 6, b.y - h * .55, 6, 3, .5, 0, TAU); ctx.fill();
    if (b.st === 1) { ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = rgba(CD, .5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, 38, 19, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    if (b.st === 2) {
      const c = [[255, 170, 200], [190, 210, 255], [255, 220, 150], [230, 180, 255]][i % 4], y = b.y - h;
      glow(b.x, y, 36, c, .4);
      ctx.fillStyle = rgba(c, 1);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * .2; ctx.beginPath(); ctx.ellipse(b.x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, 4.5, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(b.x, y, 4.5, 0, TAU); ctx.fill();
    }
  }
}
function butterfly(b, t) {
  const f = Math.abs(Math.sin(t * 14 + b.id)) * .8 + .2, ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
  glow(b.x, b.y, 34, b.c, .3);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang * .3);
  ctx.fillStyle = rgba(b.c, .92);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(s * 9 * f, -4, 10 * f, 8, s * .4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 7 * f, 7, 7 * f, 5.5, -s * .4, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#3a2b3a'; ctx.beginPath(); ctx.ellipse(0, 1, 2, 9, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function hedge(x, y, w, h) {
  if (w <= 0) return;
  ctx.fillStyle = '#21462e'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 10) : ctx.rect(x, y, w, h); ctx.fill();
  ctx.fillStyle = 'rgba(120,190,110,.35)';
  for (let i = x + 8; i < x + w - 4; i += 13) { ctx.beginPath(); ctx.arc(i, y + 9 + ((i * 7) % 11), 5, 0, TAU); ctx.fill(); }
}
function gate(x, y, w, h, open) {
  if (open) { ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(243,201,143,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); ctx.restore(); return; }
  ctx.fillStyle = '#8a5f3c'; ctx.fillRect(x, y + 6, w, 5); ctx.fillRect(x, y + h - 11, w, 5);
  ctx.fillStyle = '#a87850'; for (let i = x + 4; i < x + w - 4; i += 14) ctx.fillRect(i, y, 8, h);
}
function stone(x, y, on) {
  glow(x, y, on ? 56 : 34, CG, on ? .5 : .18);
  ctx.fillStyle = on ? '#e8d3a6' : '#9b8f7c'; ctx.beginPath(); ctx.ellipse(x, y, 22, 16, .2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function bee(x, y, vx, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(vx < 0 ? -1 : 1, 1);
  ctx.fillStyle = 'rgba(230,240,255,.6)'; const f = Math.sin(t * 40) * 3;
  ctx.beginPath(); ctx.ellipse(-2, -9 - f * .3, 6, 8 + f, -.4, 0, TAU); ctx.ellipse(4, -9 - f * .3, 5, 7 + f, .4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b2118'; ctx.fillRect(-4, -7.5, 3, 15); ctx.fillRect(3, -7, 3, 14);
  ctx.beginPath(); ctx.arc(11, -1, 2, 0, TAU); ctx.fill();
  ctx.restore();
}
function arbor(x, y, t, both) {
  glow(x, y, 120, [255, 170, 200], both ? .45 : .2);
  ctx.strokeStyle = '#6a4a35'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 60, y + 50); ctx.lineTo(x - 60, y - 5); ctx.arc(x, y - 5, 60, Math.PI, 0); ctx.lineTo(x + 60, y + 50); ctx.stroke();
  for (let i = 0; i < 14; i++) {
    const a = Math.PI + i / 13 * Math.PI, rx = x + Math.cos(a) * 60, ry = y - 5 + Math.sin(a) * 60;
    ctx.fillStyle = i % 3 ? '#f48aa3' : '#ffd0dc'; ctx.beginPath(); ctx.arc(rx, ry, 6 + Math.sin(t * 2 + i) * .8, 0, TAU); ctx.fill();
  }
  label('Rosenbogen', x, y + 72, [255, 210, 220], 13);
}
function candle(x, y, t) {
  glow(x, y - 70, 110, [255, 190, 110], .35 + Math.sin(t * 9) * .03);
  const g = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
  g.addColorStop(0, '#e9e1d4'); g.addColorStop(.5, '#fffaf1'); g.addColorStop(1, '#ddd2c2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 18, y - 52, 36, 78, 6) : ctx.rect(x - 18, y - 52, 36, 78); ctx.fill();
  ctx.strokeStyle = '#d8b26a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 18, 10, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#e2bd73'; ctx.fillRect(x - 1.2, y - 25, 2.4, 14); ctx.fillRect(x - 5, y - 21, 10, 2.4);
  flame(x, y - 62, 1, t);
  label('Kerze', x, y + 44, CG, 13);
}
function flame(x, y, s, t) {
  const f = 1 + Math.sin(t * 17) * .08 + Math.sin(t * 29) * .05;
  glow(x, y, 26 * s, [255, 190, 100], .6);
  ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.moveTo(x, y - 14 * s * f); ctx.quadraticCurveTo(x + 7 * s, y, x, y + 6 * s); ctx.quadraticCurveTo(x - 7 * s, y, x, y - 14 * s * f); ctx.fill();
  ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 2.5 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
}
function lantern(x, y, lit, t, i) {
  const sw = Math.sin(t * 1.4 + i) * .06;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
  if (lit) glow(0, 0, 70, [255, 170, 90], .45 + Math.sin(t * 7 + i) * .05);
  ctx.strokeStyle = 'rgba(200,170,140,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -20); ctx.stroke();
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
  if (lit) { g.addColorStop(0, '#fff1c9'); g.addColorStop(1, '#f08a4b'); } else { g.addColorStop(0, '#5a4350'); g.addColorStop(1, '#3a2a36'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 17, 20, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = lit ? 'rgba(160,70,30,.5)' : 'rgba(255,220,200,.25)'; ctx.lineWidth = 1;
  for (const k of [-8, 0, 8]) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(k) ? 11 : 1, 20, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = lit ? '#b0552a' : '#2c2028'; ctx.fillRect(-9, -22, 18, 4); ctx.fillRect(-9, 18, 18, 4);
  ctx.restore();
}

const L = [
/* ---- Welt 1: Sternennacht ---- */
{ id: 'funken', w: 0, n: 'Funkenregen', ic: '✦', t3: 45, t2: 80,
  h: () => 'Sammle die Funken in deiner Farbe. Goldene gibt es nur zu zweit.',
  setup() {
    const pts = place(24, 72, [60, 160, 540, 800], START);
    S.items = pts.map((p, i) => ({id: i, x: p.x, y: p.y, o: i < 10 ? 'a' : i < 20 ? 'd' : 'g', vx: rnd(-16, 16), vy: rnd(-16, 16), got: 0}));
    S.total = S.items.length;
  },
  update(dt) {
    for (const it of S.items) {
      if (it.got) continue; drift(it, dt);
      if (it.o === 'g') {
        if (dist(S.p.a, it) < 66 && dist(S.p.d, it) < 66) { it.got = 1; S.count++; emit({k: 'gold', x: it.x, y: it.y}); }
      } else if (dist(S.p[it.o], it) < R + 22) { it.got = 1; S.count++; emit({k: 'chime', x: it.x, y: it.y, o: it.o}); }
    }
    if (S.count >= S.total) finish();
  },
  draw(t, pos) {
    S.items.forEach((it, i) => {
      if (it.got) return;
      if (it.o === 'g') pairTarget(it, t, pos, 66, 1); else spark(it.x, it.y, COL[it.o], t, i);
    });
  }
},
{ id: 'schnuppen', w: 0, n: 'Sternschnuppen', ic: '☄', t3: 50, t2: 85,
  h: () => 'Fang je acht Sternschnuppen in deiner Farbe – sie sind schnell!',
  setup() { S.aux = {got: {a: 0, d: 0}, need: 8, spawnT: S.t + 1.4, id: 0}; S.items = []; S.total = 16; },
  update(dt) {
    const A = S.aux;
    if (S.t > A.spawnT) {
      const opts = ['a', 'd'].filter(k => A.got[k] < A.need);
      if (opts.length) {
        const o = opts[(Math.random() * opts.length) | 0], left = Math.random() < .5;
        S.items.push({id: A.id++, o, x: left ? -40 : W + 40, y: rnd(150, 640), vx: (left ? 1 : -1) * rnd(210, 290), vy: rnd(60, 150), got: 0});
      }
      A.spawnT = S.t + rnd(.65, 1.15);
    }
    for (const m of S.items) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (!m.got && A.got[m.o] < A.need && dist(S.p[m.o], m) < R + 24) { m.got = 1; A.got[m.o]++; S.count++; emit({k: 'meteor', x: m.x, y: m.y, o: m.o}); }
    }
    S.items = S.items.filter(m => !m.got && m.x > -80 && m.x < W + 80 && m.y < H + 60);
    if (S.count >= S.total) finish();
  },
  draw(t) {
    for (const m of S.items) {
      const c = COL[m.o], tx = m.x - m.vx * .4, ty = m.y - m.vy * .4;
      const g = ctx.createLinearGradient(tx, ty, m.x, m.y);
      g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, .9));
      ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(m.x, m.y); ctx.stroke();
      glow(m.x, m.y, 30, c, .6);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x, m.y, 4.5, 0, TAU); ctx.fill();
    }
    const A = S.aux;
    ctx.font = '600 16px Karla, system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = rgba(CA, .9); ctx.fillText(`${nm('a')} ${A.got.a}/${A.need}`, W * .3, 120);
    ctx.fillStyle = rgba(CD, .9); ctx.fillText(`${nm('d')} ${A.got.d}/${A.need}`, W * .7, 120);
  }
},
{ id: 'immer', w: 0, n: 'Für immer', ic: '∞', t3: 55, t2: 95,
  h: () => 'Zündet die Sterne der Reihe nach an, bevor der Ring abläuft – sonst erlöschen zwei.',
  setup() {
    const n = 14, a = 245, cx = W / 2, cy = 480;
    S.items = [];
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU, s = Math.sin(t), c = Math.cos(t), den = 1 + s * s;
      S.items.push({id: i, x: cx + a * c / den, y: cy + a * s * c / den * 1.3, o: i % 2 ? 'd' : 'a', lit: 0});
    }
    S.total = n; S.cur = 0; S.aux = {tm: 5.5, max: 5.5, wait: S.t + .3};
  },
  update(dt) {
    if (S.t < S.aux.wait) return;
    const s = S.items[S.cur]; if (!s) return;
    S.aux.tm -= dt;
    if (dist(S.p[s.o], s) < R + 24) {
      s.lit = 1; S.cur++; S.count = S.cur; S.aux.tm = S.aux.max;
      emit({k: 'star', x: s.x, y: s.y, o: s.o, i: S.cur});
      if (S.cur >= S.items.length) finish(1.8);
    } else if (S.aux.tm <= 0) {
      const back = Math.min(2, S.cur);
      for (let i = 0; i < back; i++) { S.cur--; S.items[S.cur].lit = 0; }
      S.count = S.cur; S.aux.tm = S.aux.max;
      emit({k: 'fizz', x: s.x, y: s.y, o: 'x'});
    }
  },
  draw(t) {
    const st = S.items, all = S.cur >= st.length;
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
    ctx.beginPath(); st.forEach((s, i) => i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 1; i < S.cur; i++) line2(st[i - 1], st[i], .8);
    if (all) line2(st[st.length - 1], st[0], .8);
    st.forEach((s, i) => {
      const c = COL[s.o];
      if (s.lit) { glow(s.x, s.y, 32, c, .55); dotW(s.x, s.y, 4.5); }
      else if (i === S.cur) {
        const pul = 1 + Math.sin(t * 5) * .15;
        glow(s.x, s.y, 44 * pul, c, .45);
        if (S.t >= S.aux.wait) {
          ctx.beginPath(); ctx.arc(s.x, s.y, 27, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(S.aux.tm / S.aux.max, 0, 1));
          ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(c, .95); ctx.stroke();
        }
        ctx.fillStyle = rgba(c, 1); ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.fill();
        label(nm(s.o), s.x, s.y - 38, c);
      } else { glow(s.x, s.y, 16, COL[s.o], .25); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, TAU); ctx.fill(); }
    });
  }
},
/* ---- Welt 2: Tiefsee ---- */
{ id: 'perlen', w: 1, n: 'Perlenmuscheln', ic: '◍', t3: 60, t2: 105, stun: 'betäubt',
  h: () => 'Wer auf der Seeanemone steht, öffnet die Muschel – der andere holt die Perle. Quallen betäuben!',
  setup() {
    const sh = place(6, 150, [90, 200, 510, 740], START);
    const btns = [];
    S.items = sh.map((p, i) => {
      let b = null;
      for (let k = 0; k < 80 && !b; k++) {
        const an = rnd(0, TAU), r = rnd(160, 230), q = {x: p.x + Math.cos(an) * r, y: p.y + Math.sin(an) * r};
        if (q.x > 50 && q.x < W - 50 && q.y > 160 && q.y < H - 80 && sh.every(s => dist(s, q) > 95) && btns.every(o => dist(o, q) > 80)) b = q;
      }
      b = b || {x: clamp(p.x + 180, 50, W - 50), y: p.y};
      btns.push(b);
      return {id: i, x: p.x, y: p.y, bx: b.x, by: b.y, bo: i % 2 ? 'd' : 'a', open: 0, got: 0};
    });
    S.total = 6; S.aux = {jelly: [mkJelly(330, 1), mkJelly(620, -1)]};
  },
  update(dt) {
    jellyStep(S.aux.jelly, dt); stunStep(dt, jellyHit(S.aux.jelly));
    for (const it of S.items) {
      if (it.got) continue;
      const was = it.open;
      it.open = dist(S.p[it.bo], {x: it.bx, y: it.by}) < 46 ? 1 : 0;
      if (it.open && !was) emit({k: 'open', x: it.bx, y: it.by, o: it.bo});
      const c = S.p[OTH(it.bo)];
      if (it.open && c.lit && dist(c, it) < R + 30) { it.got = 1; S.count++; emit({k: 'pearl', x: it.x, y: it.y}); }
    }
    if (S.count >= S.total) finish();
  },
  draw(t, pos) {
    for (const it of S.items) {
      if (it.got) continue;
      const pressed = dist(pos[it.bo], {x: it.bx, y: it.by}) < 46 || it.open;
      ctx.save(); ctx.setLineDash([3, 9]); ctx.strokeStyle = rgba(COL[it.bo], .25); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(it.bx, it.by); ctx.lineTo(it.x, it.y); ctx.stroke(); ctx.restore();
      anemone(it.bx, it.by, COL[it.bo], pressed, t);
      shell(it.x, it.y, it.open, t);
    }
    S.aux.jelly.forEach(j => jelly(j, t));
  }
},
{ id: 'stroemung', w: 1, n: 'Strömung', ic: '◌', t3: 60, t2: 100, stun: 'betäubt',
  force: (p, t) => ({x: FIELD(p.y, t), y: 0}),
  h: () => 'Die Strömung zieht euch mit. Sammelt 20 Luftblasen – und weicht den Quallen aus.',
  setup() {
    const pts = place(20, 75, [50, 160, 550, 800], START);
    S.items = pts.map((p, i) => ({id: i, x: p.x, y: p.y, got: 0, ph: rnd(0, TAU)}));
    S.total = S.items.length;
    S.aux = {jelly: [mkJelly(280, 1), mkJelly(450, -1), mkJelly(620, 1), mkJelly(780, -1)]};
  },
  update(dt) {
    jellyStep(S.aux.jelly, dt); stunStep(dt, jellyHit(S.aux.jelly));
    for (const it of S.items) {
      if (it.got) continue;
      it.x += FIELD(it.y, S.t) * .45 * dt;
      if (it.x < -10) it.x = W + 10; if (it.x > W + 10) it.x = -10;
      it.y -= 10 * dt; if (it.y < 150) it.y = 820;
      for (const k of ['a', 'd']) {
        const p = S.p[k];
        if (p.lit && dist(p, it) < R + 20) { it.got = 1; S.count++; emit({k: 'bubble', x: it.x, y: it.y, o: k}); break; }
      }
    }
    if (S.count >= S.total) finish();
  },
  draw(t) {
    if (!LOC.streaks) { LOC.streaks = []; for (let i = 0; i < 46; i++) LOC.streaks.push({x: rnd(0, W), y: rnd(140, H - 20)}); }
    ctx.lineCap = 'round';
    for (const s of LOC.streaks) {
      const v = FIELD(s.y, S.t);
      s.x += v * .016; if (s.x > W) s.x -= W; if (s.x < 0) s.x += W;
      ctx.strokeStyle = `rgba(160,230,255,${.06 + Math.abs(v) / 85 * .14})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - v * .35, s.y); ctx.stroke();
    }
    for (const it of S.items) if (!it.got) bubble(it.x, it.y + Math.sin(t * 2 + it.ph) * 3, 9);
    S.aux.jelly.forEach(j => jelly(j, t));
  }
},
{ id: 'echo', w: 1, n: 'Echo der Muscheln', ic: '♪', t3: 95, t2: 160,
  h: () => 'Hört genau hin: Merkt euch die Reihenfolge. Jeder tippt die Muscheln seiner Farbe.',
  setup() {
    const cx = W / 2, cy = 470, r = 205;
    S.items = [0, 1, 2, 3, 4, 5].map(i => { const an = -Math.PI / 2 + i * TAU / 6; return {id: i, x: cx + Math.cos(an) * r, y: cy + Math.sin(an) * r, o: i % 2 ? 'd' : 'a'}; });
    const seq = []; for (let i = 0; i < 3; i++) seq.push(nextShell(seq));
    S.aux = {seq, round: 0, rounds: 4, mode: 'wait', msg: 'listen', tm: S.t + 1.2, step: 0, flash: -1, flashT: 0, ins: {a: -1, d: -1}};
    S.total = 4;
  },
  update() {
    const A = S.aux;
    if (A.flash >= 0 && S.t > A.flashT) A.flash = -1;
    const nearOwn = k => { const p = S.p[k]; const s = S.items.find(s => s.o === k && dist(p, s) < 44); return s ? s.id : -1; };
    if (A.mode === 'wait') { if (S.t > A.tm) { A.mode = 'show'; A.step = 0; A.tm = S.t + .2; } }
    else if (A.mode === 'show') {
      if (S.t > A.tm) {
        if (A.step < A.seq.length) {
          const i = A.seq[A.step], s = S.items[i];
          A.flash = i; A.flashT = S.t + .55; emit({k: 'note', i, x: s.x, y: s.y, o: s.o});
          A.step++; A.tm = S.t + .82;
        } else { A.mode = 'input'; A.msg = 'go'; A.step = 0; A.ins = {a: nearOwn('a'), d: nearOwn('d')}; }
      }
    } else if (A.mode === 'input') {
      for (const k of ['a', 'd']) {
        const j = nearOwn(k);
        if (j === A.ins[k]) continue;
        A.ins[k] = j;
        if (j < 0) continue;
        const s = S.items[j];
        if (j === A.seq[A.step]) {
          A.flash = j; A.flashT = S.t + .35; emit({k: 'note', i: j, x: s.x, y: s.y, o: s.o}); A.step++;
          if (A.step >= A.seq.length) {
            A.round++; S.count = A.round;
            if (A.round >= A.rounds) { A.mode = 'done'; A.msg = 'ok'; finish(1.6); }
            else { emit({k: 'round', x: W / 2, y: 470}); A.seq.push(nextShell(A.seq)); A.mode = 'wait'; A.msg = 'ok'; A.tm = S.t + 1.8; }
          }
        } else { emit({k: 'wrong', x: s.x, y: s.y}); A.mode = 'wait'; A.msg = 'err'; A.tm = S.t + 2; }
        break;
      }
    }
  },
  draw(t) {
    const A = S.aux;
    for (const s of S.items) {
      const c = COL[s.o], on = A.flash === s.id;
      glow(s.x, s.y, on ? 95 : 60, c, on ? .75 : .25);
      ctx.beginPath(); ctx.arc(s.x, s.y, 40, 0, TAU);
      ctx.fillStyle = rgba(c, on ? .6 : .16); ctx.fill();
      ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(c, on ? 1 : .9); ctx.stroke();
      shellIcon(s.x, s.y, on);
    }
    const txt = A.mode === 'show' ? 'Hört zu …' : A.mode === 'input' ? 'Jetzt ihr!' : A.msg === 'err' ? 'Nochmal – gleiche Melodie' : A.msg === 'ok' ? 'Richtig! Die Melodie wird länger' : 'Hört gut zu …';
    label(txt, W / 2, 465, [255, 255, 255], 20);
    const n = A.seq.length;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(W / 2 + (i - (n - 1) / 2) * 18, 500, 5, 0, TAU);
      ctx.fillStyle = A.mode === 'input' && i < A.step ? rgba(CG, 1) : 'rgba(255,255,255,.2)'; ctx.fill();
    }
    label(`Runde ${Math.min(A.round + 1, A.rounds)} von ${A.rounds}`, W / 2, 432, [200, 230, 240], 14);
  }
},
/* ---- Welt 3: Frühlingsgarten ---- */
{ id: 'saeen', w: 2, n: 'Säen & Gießen', ic: '✿', t3: 80, t2: 130,
  h: k => k === 'a' ? 'Du säst: Samen am Korb holen und in ein leeres Beet legen. Daniel gießt.' : 'Du gießt: Wasser am Brunnen holen und Beete mit Samen gießen. Aurelia sät.',
  setup() {
    S.aux = {basket: {x: 80, y: 895}, fountain: {x: 520, y: 895}};
    const pts = place(8, 125, [80, 180, 520, 750]);
    S.items = pts.map((p, i) => ({id: i, x: p.x, y: p.y, st: 0}));
    S.total = S.items.length;
  },
  update() {
    const a = S.p.a, d = S.p.d, A = S.aux;
    if (!a.carry && dist(a, A.basket) < 66) { a.carry = 1; emit({k: 'pick', x: a.x, y: a.y, o: 'a'}); }
    if (!d.carry && dist(d, A.fountain) < 66) { d.carry = 1; emit({k: 'pick', x: d.x, y: d.y, o: 'd'}); }
    for (const b of S.items) {
      if (a.carry && b.st === 0 && dist(a, b) < R + 32) { b.st = 1; a.carry = 0; emit({k: 'plant', x: b.x, y: b.y, o: 'a'}); }
      if (d.carry && b.st === 1 && dist(d, b) < R + 32) { b.st = 2; d.carry = 0; S.count++; emit({k: 'bloom', x: b.x, y: b.y}); }
    }
    if (S.count >= S.total) finish();
  },
  draw(t) {
    const A = S.aux;
    basket(A.basket.x, A.basket.y); fountain(A.fountain.x, A.fountain.y, t);
    S.items.forEach((b, i) => bed(b, t, i));
  }
},
{ id: 'schmetterlinge', w: 2, n: 'Schmetterlinge', ic: '❦', t3: 90, t2: 150,
  h: () => 'Schmetterlinge fliehen vor jedem von euch. Nur zu zweit kesselt ihr sie ein.',
  setup() { S.items = []; S.aux = {spawned: 0, id: 0}; S.total = 6; for (let i = 0; i < 3; i++) spawnBf(); },
  update(dt) {
    for (const b of S.items) {
      b.wa += rnd(-2, 2) * dt * 2;
      let ax = Math.cos(b.wa) * 90, ay = Math.sin(b.wa) * 90;
      for (const k of ['a', 'd']) {
        const p = S.p[k], dd = dist(p, b);
        if (dd < 170 && dd > 1) { const f = (170 - dd) / 170 * 1100; ax += (b.x - p.x) / dd * f; ay += (b.y - p.y) / dd * f; }
      }
      if (b.x < 70) ax += 260; if (b.x > W - 70) ax -= 260; if (b.y < 180) ay += 260; if (b.y > H - 70) ay -= 260;
      b.vx = (b.vx + ax * dt) * (1 - 1.8 * dt); b.vy = (b.vy + ay * dt) * (1 - 1.8 * dt);
      const sp = Math.hypot(b.vx, b.vy), mx = 235; if (sp > mx) { b.vx *= mx / sp; b.vy *= mx / sp; }
      b.x = clamp(b.x + b.vx * dt, 28, W - 28); b.y = clamp(b.y + b.vy * dt, 150, H - 28);
      if (dist(S.p.a, b) < 70 && dist(S.p.d, b) < 70) { b.got = 1; S.count++; emit({k: 'catch', x: b.x, y: b.y}); }
    }
    if (S.items.some(b => b.got)) {
      S.items = S.items.filter(b => !b.got);
      while (S.items.length < 3 && S.aux.spawned < 6) spawnBf();
    }
    if (S.count >= S.total) finish();
  },
  draw(t, pos) {
    for (const b of S.items) {
      ['a', 'd'].forEach((k, i) => {
        const near = dist(pos[k], b) < 70;
        ctx.beginPath(); ctx.arc(b.x - 9 + i * 18, b.y + 30, 4, 0, TAU);
        ctx.fillStyle = near ? rgba(COL[k], 1) : 'rgba(255,255,255,.14)'; ctx.fill();
      });
      butterfly(b, t);
    }
  }
},
{ id: 'tor', w: 2, n: 'Das Gartentor', ic: '❀', t3: 75, t2: 130, stun: 'gestochen',
  h: () => 'Trittsteine öffnen die Tore. Lasst euch gegenseitig durch – bis zum Rosenbogen. Bienen stechen!',
  setup() {
    S.aux = {
      rows: [{y: 760, gx: 60}, {y: 520, gx: 430}, {y: 280, gx: 245}], gw: 110, th: 34, open: [0, 0, 0],
      btn: [[{x: 480, y: 875}, {x: 480, y: 650}], [{x: 110, y: 650}, {x: 110, y: 410}], [{x: 500, y: 410}, {x: 500, y: 190}]],
      bees: [{x: 200, y: 640, vx: 115, a: 150, b: 450}, {x: 400, y: 380, vx: -135, a: 150, b: 470}],
      goal: {x: 300, y: 120}
    };
    S.total = 3;
  },
  walls() {
    const A = S.aux, out = [];
    A.rows.forEach((r, i) => {
      out.push([0, r.y, r.gx, A.th], [r.gx + A.gw, r.y, W - r.gx - A.gw, A.th]);
      if (!A.open[i]) out.push([r.gx, r.y, A.gw, A.th]);
    });
    return out;
  },
  update(dt) {
    const A = S.aux;
    A.btn.forEach((bs, i) => {
      const o = bs.some(b => dist(S.p.a, b) < 40 || dist(S.p.d, b) < 40) ? 1 : 0;
      if (o && !A.open[i]) emit({k: 'gate', x: A.rows[i].gx + A.gw / 2, y: A.rows[i].y});
      A.open[i] = o;
    });
    for (const b of A.bees) {
      b.x += b.vx * dt;
      if (b.x < b.a || b.x > b.b) { b.vx *= -1; b.x = clamp(b.x, b.a, b.b); }
      b.yy = b.y + Math.sin(S.t * 3 + b.a) * 14;
    }
    stunStep(dt, p => A.bees.some(b => Math.hypot(p.x - b.x, p.y - (b.yy || b.y)) < R + 14));
    S.count = A.rows.filter(r => S.p.a.y < r.y && S.p.d.y < r.y).length;
    if (dist(S.p.a, A.goal) < 75 && dist(S.p.d, A.goal) < 75) finish();
  },
  draw(t, pos) {
    const A = S.aux;
    arbor(A.goal.x, A.goal.y, t, dist(pos.a, A.goal) < 75 && dist(pos.d, A.goal) < 75);
    A.rows.forEach((r, i) => {
      hedge(0, r.y, r.gx, A.th); hedge(r.gx + A.gw, r.y, W - r.gx - A.gw, A.th);
      gate(r.gx, r.y, A.gw, A.th, A.open[i]);
      A.btn[i].forEach(b => {
        const on = dist(pos.a, b) < 40 || dist(pos.d, b) < 40;
        ctx.save(); ctx.setLineDash([2, 8]); ctx.strokeStyle = 'rgba(243,201,143,.18)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(r.gx + A.gw / 2, r.y + A.th / 2); ctx.stroke(); ctx.restore();
        stone(b.x, b.y, on);
      });
    });
    A.bees.forEach(b => bee(b.x, b.yy || b.y, b.vx, t));
  }
},
/* ---- Welt 4: Laternenfest ---- */
{ id: 'flammen', w: 4, n: 'Flammenstaffel', ic: '♨', t3: 80, t2: 135,
  speed: p => p.carry > 0 ? .62 : 1,
  h: () => 'Hol die Flamme an der Kerze – sie hält nur kurz. Brennende Laternen und dein Schatz geben neues Feuer.',
  setup() {
    S.aux = {candle: {x: 300, y: 905}, FL: 2.2};
    const pts = place(12, 125, [70, 160, 530, 760]);
    S.items = pts.map((p, i) => ({id: i, x: p.x, y: p.y, lit: 0}));
    S.total = S.items.length;
  },
  update(dt) {
    const A = S.aux;
    for (const k of ['a', 'd']) {
      const p = S.p[k], had = p.carry > 0;
      if (p.carry > 0) p.carry -= dt;
      if (had && p.carry <= 0) { p.carry = 0; emit({k: 'puff', x: p.x, y: p.y, o: k}); }
      if (dist(p, A.candle) < 62) { if (p.carry <= 0) emit({k: 'flame', x: p.x, y: p.y, o: k}); p.carry = A.FL; }
      for (const l of S.items) {
        if (dist(p, l) >= R + 28) continue;
        if (l.lit) { if (p.carry <= 0) emit({k: 'flame', x: p.x, y: p.y, o: k}); p.carry = A.FL; }
        else if (p.carry > 0) { l.lit = 1; S.count++; emit({k: 'lantern', x: l.x, y: l.y, o: k}); }
      }
    }
    const a = S.p.a, d = S.p.d;
    if (dist(a, d) < 54) {
      if (a.carry > 0 && d.carry <= 0) { d.carry = A.FL; emit({k: 'flame', x: d.x, y: d.y, o: 'd'}); }
      else if (d.carry > 0 && a.carry <= 0) { a.carry = A.FL; emit({k: 'flame', x: a.x, y: a.y, o: 'a'}); }
    }
    if (S.count >= S.total) finish();
  },
  draw(t) {
    candle(S.aux.candle.x, S.aux.candle.y, t);
    S.items.forEach((l, i) => lantern(l.x, l.y, l.lit, t, i));
  }
},
{ id: 'wege', w: 4, n: 'Geheime Wege', ic: '◈', t3: 95, t2: 160, fog: 190,
  h: k => `Ihr seht nur die Ziele des anderen. ${nm(OTH(k))} sieht deine, du siehst ${nm(OTH(k))}s – lotst euch per Stimme!`,
  setup() {
    const pts = place(10, 115, [60, 160, 540, 800], START);
    S.items = pts.map((p, i) => ({id: i, x: p.x, y: p.y, o: i < 5 ? 'a' : 'd', got: 0}));
    S.total = S.items.length;
  },
  update() {
    for (const it of S.items) {
      if (!it.got && dist(S.p[it.o], it) < R + 24) { it.got = 1; S.count++; emit({k: 'find', x: it.x, y: it.y, o: it.o}); }
    }
    if (S.count >= S.total) finish();
  },
  draw(t) {
    for (const it of S.items) {
      if (it.got || it.o === API.me) continue;
      const c = COL[it.o], pul = 1 + Math.sin(t * 4 + it.id) * .12;
      glow(it.x, it.y, 40 * pul, c, .5);
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = rgba(c, .95); ctx.fillRect(-8 * pul, -8 * pul, 16 * pul, 16 * pul); ctx.restore();
      label(nm(it.o), it.x, it.y - 22, c, 13);
    }
  }
},
{ id: 'herz', w: 4, n: 'Unser Herz', ic: '♥', t3: 55, t2: 100,
  h: () => 'Stellt euch gleichzeitig auf eure Sterne. Spitze und Mitte zündet ihr nur gemeinsam an.',
  setup() {
    S.items = [];
    for (let j = 0; j < 16; j++) {
      const t = j / 16 * TAU, hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      S.items.push({id: j, x: W / 2 + hx * 16, y: 300 + hy * 15.5, lit: 0, o: j === 0 || j === 8 ? 'g' : j < 8 ? 'd' : 'a'});
    }
    S.aux = {steps: [[8], [7, 9], [6, 10], [5, 11], [4, 12], [3, 13], [2, 14], [1, 15], [0]]};
    S.cur = 0; S.total = 9;
  },
  update() {
    const st = S.aux.steps[S.cur]; if (!st) return;
    let ok;
    if (st.length === 1) { const s = S.items[st[0]]; ok = dist(S.p.a, s) < 52 && dist(S.p.d, s) < 52; }
    else ok = dist(S.p.d, S.items[st[0]]) < R + 24 && dist(S.p.a, S.items[st[1]]) < R + 24;
    if (ok) {
      st.forEach(j => S.items[j].lit = 1);
      S.cur++; S.count = S.cur;
      const s = S.items[st[0]];
      emit({k: 'pairlit', x: s.x, y: s.y, i: S.cur});
      if (S.cur >= S.aux.steps.length) finish(2.8);
    }
  },
  draw(t, pos) {
    const st = S.items;
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
    ctx.beginPath(); st.forEach((s, i) => i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let j = 0; j < 16; j++) { const a = st[j], b = st[(j + 1) % 16]; if (a.lit && b.lit) line2(a, b, .85); }
    if (S.cur >= 9) glow(W / 2, 300, 330, CA, .14 + Math.sin(t * 1.5) * .04);
    const cur = S.aux.steps[S.cur] || [];
    st.forEach(s => {
      const c = COL[s.o];
      if (s.lit) { glow(s.x, s.y, 34, c, .6); dotW(s.x, s.y, 4.5); }
      else if (cur.includes(s.id)) {
        if (s.o === 'g') pairTarget(s, t, pos, 52, 0);
        else {
          const pul = 1 + Math.sin(t * 5) * .15;
          glow(s.x, s.y, 46 * pul, c, .5);
          ctx.beginPath(); ctx.arc(s.x, s.y, 24 * pul, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = rgba(c, .9); ctx.stroke();
          ctx.fillStyle = rgba(c, 1); ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.fill();
          label(nm(s.o), s.x, s.y - 34, c, 13);
        }
      } else { glow(s.x, s.y, 16, COL[s.o], .25); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, TAU); ctx.fill(); }
    });
  }
}
];

const byId = {}; L.forEach(l => byId[l.id] = l);
byId.saeen.drawCarry = (k, x, y, p) => {
  if (!p.carry) return;
  if (k === 'a') { ctx.fillStyle = '#c99a6a'; [-6, 0, 6].forEach(o => { ctx.beginPath(); ctx.ellipse(x + o, y - R - 12, 3, 4.5, 0, 0, TAU); ctx.fill(); }); }
  else { ctx.fillStyle = 'rgba(150,210,255,.95)'; ctx.beginPath(); ctx.moveTo(x, y - R - 24); ctx.quadraticCurveTo(x + 9, y - R - 10, x, y - R - 6); ctx.quadraticCurveTo(x - 9, y - R - 10, x, y - R - 24); ctx.fill(); }
};
byId.flammen.drawCarry = (k, x, y, p, t) => {
  if (!(p.carry > 0)) return;
  flame(x, y - R - 14, .9, t);
  ctx.beginPath(); ctx.arc(x, y, R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.carry / S.aux.FL, 0, 1));
  ctx.strokeStyle = 'rgba(255,190,110,.9)'; ctx.lineWidth = 3; ctx.stroke();
};
return L;
});
