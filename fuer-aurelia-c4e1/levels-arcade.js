/* Zwei Lichter – Level-Paket 2: Spielhalle
   Sieben Level nach dem Vorbild bekannter Spielprinzipien – mit eigener Optik und eigenen Namen. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, W, H, R, TAU, COL, CA, CD, CG, SONG_NOTES, rgba, dist, rnd, clamp, nm, OTH, emit, finish, failRestart, teleport, act, hostNow, tone, buzz,
  glow, label, heartPath, rr, inputX, desiredDir, desiredHeading, speedMul, mine} = API;
const toast = t => API.toast(t);

/* ================= Herzmauer (Schläger & Ball) ================= */
const PADY = {a: 925, d: 120}, PW = 120;
function inHeart(u, v) { const x = u * 1.22, y = -v * 1.18 + .14, a = x * x + y * y - 1; return a * a * a - x * x * y * y * y <= 0; }
function serve(k) {
  const p = S.p[k], sp = 360 * API.diff(), an = rnd(-.5, .5);
  S.aux.balls.push({x: clamp(p.x, 40, W - 40), y: k === 'a' ? PADY.a - 30 : PADY.d + 30, vx: Math.sin(an) * sp, vy: (k === 'a' ? -1 : 1) * Math.cos(an) * sp, sp});
  emit({k: 'pad', o: k});
}
const mauer = {
  id: 'mauer', w: 3, n: 'Herzmauer', ic: '▦', t3: 95, t2: 160, ctrl: 'paddle', noThread: true,
  h: () => `Haltet den Lichtball im Spiel – ${nm('a')} unten, ${nm('d')} oben – und brecht die Herzmauer auf. Ihr habt fünf Bälle.`,
  start: k => ({x: W / 2, y: PADY[k]}), lock: k => PADY[k],
  setup() {
    const cols = 10, rows = 10, bw = 54, bh = 24, x0 = (W - cols * bw) / 2, y0 = 335;
    S.items = []; let id = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!inHeart((c + .5) / cols * 2 - 1, (r + .5) / rows * 2 - 1)) continue;
      const gold = r === 3 && (c === 2 || c === 7);
      S.items.push({id: id++, x: x0 + c * bw + 2, y: y0 + r * bh + 2, w: bw - 4, h: bh - 4, o: gold ? 'g' : r < rows / 2 ? 'a' : 'd', hp: gold ? 2 : 1, dead: 0});
    }
    S.total = S.items.length;
    S.aux = {lives: 5, balls: [], serveT: S.t + .9, serveTo: 'a', second: 0};
  },
  update(dt) {
    const A = S.aux;
    if (!A.balls.length && S.t > A.serveT) serve(A.serveTo);
    if (!A.second && A.balls.length === 1 && S.count >= S.total * .5) { A.second = 1; serve(A.serveTo === 'a' ? 'd' : 'a'); }
    for (const b of A.balls) {
      const n = Math.max(1, Math.ceil(b.sp * dt / 7)), h = dt / n;
      for (let s = 0; s < n; s++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx); }
        if (b.x > W - 10) { b.x = W - 10; b.vx = -Math.abs(b.vx); }
        for (const k of ['a', 'd']) {
          const py = PADY[k], px = S.p[k].x, down = k === 'a';
          if ((down ? b.vy > 0 : b.vy < 0) && Math.abs(b.y - py) < 15 && Math.abs(b.x - px) < PW / 2 + 18) {
            const off = clamp((b.x - px) / (PW / 2), -1, 1);
            b.sp = Math.min(b.sp * 1.025, 560 * API.diff());
            b.vx = Math.sin(off) * b.sp; b.vy = (down ? -1 : 1) * Math.cos(off) * b.sp;
            b.y = down ? py - 15 : py + 15;
            emit({k: 'pad', o: k});
          }
        }
        for (const br of S.items) {
          if (br.dead) continue;
          const cx = clamp(b.x, br.x, br.x + br.w), cy = clamp(b.y, br.y, br.y + br.h), dx = b.x - cx, dy = b.y - cy;
          if (dx * dx + dy * dy >= 81) continue;
          if (dx === 0 && dy === 0) b.vy = -b.vy;
          else if (Math.abs(dx) > Math.abs(dy)) b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
          else b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
          br.hp--;
          if (br.hp <= 0) { br.dead = 1; S.count++; emit({k: 'brick', x: br.x + br.w / 2, y: br.y + br.h / 2, o: br.o}); }
          else emit({k: 'pad', o: 'x'});
          break;
        }
      }
      if (b.y > H + 10 || b.y < -10) b.gone = 1;
    }
    const gone = A.balls.filter(b => b.gone);
    if (gone.length) {
      A.balls = A.balls.filter(b => !b.gone);
      for (const b of gone) { A.lives--; emit({k: 'lost'}); A.serveTo = b.y > H / 2 ? 'a' : 'd'; }
      if (A.lives <= 0) { failRestart('Alle Bälle verloren – nochmal von vorn!'); return; }
      if (!A.balls.length) { A.serveT = S.t + 1.2; emit({k: 'toast', txt: `Noch ${A.lives} ${A.lives === 1 ? 'Ball' : 'Bälle'}`}); }
    }
    if (S.count >= S.total) finish();
  },
  draw(t, pos) {
    const A = S.aux; if (!A.balls) return;
    for (const br of S.items) {
      if (br.dead) continue;
      const c = COL[br.o];
      const g = ctx.createLinearGradient(0, br.y, 0, br.y + br.h);
      g.addColorStop(0, rgba(c, br.hp > 1 ? 1 : .95)); g.addColorStop(1, rgba(c, .55));
      ctx.fillStyle = g; rr(br.x, br.y, br.w, br.h, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
      if (br.hp > 1) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(br.x + br.w / 2, br.y + br.h / 2, 3, 0, TAU); ctx.fill(); }
    }
    for (const k of ['a', 'd']) {
      const x = clamp(pos[k].x, PW / 2, W - PW / 2), y = PADY[k], c = COL[k];
      glow(x, y, 90, c, .25);
      ctx.fillStyle = rgba(c, .9); rr(x - PW / 2, y - 7, PW, 14, 7); ctx.fill();
    }
    const ex = hostNow() - S.t;
    for (const b of A.balls) {
      const x = b.x + b.vx * ex, y = b.y + b.vy * ex;
      const tx = x - b.vx * .06, ty = y - b.vy * .06;
      const g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.7)');
      ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      glow(x, y, 30, CG, .6); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 5; i++) { ctx.globalAlpha = i < A.lives ? 1 : .2; ctx.fillStyle = rgba(CA, 1); heartPath(W / 2 - 48 + i * 24, 978, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
};

/* ================= Lichterkette (lenken) ================= */
function spawnPearl(k) {
  const A = S.aux; let p, n = 0;
  do { p = {x: rnd(50, W - 50), y: rnd(150, H - 50)}; n++; }
  while (n < 60 && (dist(p, S.p.a) < 120 || dist(p, S.p.d) < 120 || ['a', 'd'].some(q => A.trail[q].some(t => t && Math.hypot(t[0] - p.x, t[1] - p.y) < 30))));
  S.items.push({id: A.fid++, x: p.x, y: p.y, o: k, got: 0});
}
const kette = {
  id: 'kette', w: 3, n: 'Lichterkette', ic: '∿', t3: 85, t2: 140, ctrl: 'steer', noClamp: true, noThread: true,
  h: () => 'Eure Lichter fahren von selbst und ziehen eine Kette hinter sich her. Sammelt je zehn Perlen in eurer Farbe – und verheddert euch nicht.',
  start: k => ({x: k === 'a' ? W * .35 : W * .65, y: 880}),
  setup() {
    S.aux = {trail: {a: [], d: []}, len: {a: 8, d: 8}, need: 10, got: {a: 0, d: 0}, last: {a: null, d: null}, fid: 0};
    S.items = []; for (const k of ['a', 'd']) { spawnPearl(k); spawnPearl(k); }
    S.total = 20;
  },
  move(dt, inp) {
    if (LOC.hd == null) { LOC.hd = -Math.PI / 2; LOC.want = null; }
    const w = desiredHeading(inp); if (w != null) LOC.want = w;
    if (LOC.want != null) {
      let d = LOC.want - LOC.hd; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      LOC.hd += clamp(d, -9 * dt, 9 * dt);
    }
    const sp = 235 * speedMul();
    mine.x += Math.cos(LOC.hd) * sp * dt; mine.y += Math.sin(LOC.hd) * sp * dt;
    if (mine.x < 0) mine.x += W; if (mine.x > W) mine.x -= W;
    if (mine.y < 110) mine.y = H - 8; if (mine.y > H - 4) mine.y = 114;
  },
  update() {
    const A = S.aux;
    for (const k of ['a', 'd']) {
      const p = S.p[k], l = A.last[k];
      if (!l || Math.hypot(p.x - l[0], p.y - l[1]) >= 12) {
        if (l && Math.hypot(p.x - l[0], p.y - l[1]) > 120) A.trail[k].unshift(0);
        A.trail[k].unshift([Math.round(p.x), Math.round(p.y)]); A.last[k] = [p.x, p.y];
        if (A.trail[k].length > A.len[k]) A.trail[k].length = A.len[k];
      }
    }
    for (const k of ['a', 'd']) {
      const p = S.p[k]; if (p.inv > 0) continue;
      const own = A.trail[k], oth = A.trail[OTH(k)];
      let hit = false;
      for (let i = 6; i < own.length && !hit; i++) { const q = own[i]; if (q && Math.hypot(p.x - q[0], p.y - q[1]) < 12) hit = true; }
      for (let i = 0; i < oth.length && !hit; i++) { const q = oth[i]; if (q && Math.hypot(p.x - q[0], p.y - q[1]) < 13) hit = true; }
      if (hit) { A.len[k] = Math.max(6, Math.floor(A.len[k] * .55)); own.length = Math.min(own.length, A.len[k]); p.inv = 1.6; emit({k: 'tangle', x: p.x, y: p.y, o: k}); }
    }
    for (const f of S.items) {
      if (f.got || A.got[f.o] >= A.need) continue;
      if (dist(S.p[f.o], f) < R + 16) { f.got = 1; A.got[f.o]++; A.len[f.o] += 4; emit({k: 'chime', x: f.x, y: f.y, o: f.o}); }
    }
    S.items = S.items.filter(f => !f.got);
    for (const k of ['a', 'd']) while (S.items.filter(f => f.o === k).length < Math.min(2, A.need - A.got[k])) spawnPearl(k);
    S.count = Math.min(A.got.a, A.need) + Math.min(A.got.d, A.need);
    if (S.count >= S.total) finish();
  },
  draw(t, pos) {
    const A = S.aux; if (!A.trail) return;
    for (const k of ['a', 'd']) {
      const c = COL[k], tr = A.trail[k];
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(c, .25); ctx.lineWidth = 14; drawTrail(pos[k], tr);
      ctx.strokeStyle = rgba(c, .8); ctx.lineWidth = 4; drawTrail(pos[k], tr);
      tr.forEach((q, i) => { if (q && i % 2 === 0) { ctx.fillStyle = i % 4 ? rgba(CG, .95) : '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, TAU); ctx.fill(); } });
    }
    for (const f of S.items) {
      const c = COL[f.o], pul = 1 + Math.sin(t * 4 + f.id) * .12;
      glow(f.x, f.y, 34 * pul, c, .55);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, 7 * pul, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(c, 1); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, 13 * pul, 0, TAU); ctx.stroke();
    }
    label(`${nm('a')} ${A.got.a}/${A.need}`, W * .28, 92, CA, 16);
    label(`${nm('d')} ${A.got.d}/${A.need}`, W * .72, 92, CD, 16);
  }
};
function drawTrail(head, tr) {
  ctx.beginPath(); let px = head.x, py = head.y; ctx.moveTo(px, py);
  for (const q of tr) {
    if (!q) { ctx.stroke(); ctx.beginPath(); px = null; continue; }
    if (px === null || Math.hypot(q[0] - px, q[1] - py) > 120) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    px = q[0]; py = q[1];
  }
  ctx.stroke();
}

/* ================= Wolkensprung (springen) ================= */
const platX = (pl, t) => pl.t === 1 ? clamp(pl.x + Math.sin(t * pl.sp + pl.ph) * pl.amp, 0, W - pl.w) : pl.x;
const wolken = {
  id: 'wolken', w: 3, n: 'Wolkensprung', ic: '☁', t3: 70, t2: 120, ctrl: 'jump', noClamp: true, noThread: true, theme: 'nacht',
  h: () => 'Hüpft von Wolke zu Wolke bis hinauf zum Mond. Goldene Wolken federn extra hoch. Wer runterfällt, landet beim anderen.',
  start: k => ({x: k === 'a' ? W * .35 : W * .65, y: 940}),
  countText: () => `${S.count} %`,
  setup() {
    const plats = [{id: 0, x: 0, y: 960, w: W, t: 0, amp: 0, ph: 0, sp: 0}];
    let y = 960, id = 1;
    while (y > -2900) {
      y -= rnd(100, 140);
      const w = Math.round(rnd(85, 125)), r = Math.random(), t = r < .2 ? 1 : r < .29 ? 2 : 0;
      plats.push({id: id++, x: Math.round(rnd(15, W - 15 - w)), y: Math.round(y), w, t, amp: t === 1 ? Math.round(rnd(60, 150)) : 0, ph: +rnd(0, TAU).toFixed(2), sp: +rnd(.7, 1.3).toFixed(2)});
    }
    const gy = Math.round(y - 130);
    plats.push({id: id++, x: W / 2 - 110, y: gy, w: 220, t: 3, amp: 0, ph: 0, sp: 0});
    S.aux = {plats, goalY: gy}; S.total = 100;
  },
  camY: () => LOC.cam || 0,
  move(dt, inp) {
    if (LOC.vy == null) { LOC.vy = 0; LOC.cam = 0; }
    const t = hostNow();
    mine.x += inputX(inp, dt, 400 * speedMul());
    if (mine.x < -R) mine.x += W + 2 * R; if (mine.x > W + R) mine.x -= W + 2 * R;
    const py = mine.y;
    LOC.vy = Math.min(LOC.vy + 1500 * dt, 1300); mine.y += LOC.vy * dt;
    if (LOC.vy > 0) {
      for (const pl of S.aux.plats) {
        const px = platX(pl, t);
        if (py + R <= pl.y + 3 && mine.y + R >= pl.y && mine.x > px - 8 && mine.x < px + pl.w + 8) {
          mine.y = pl.y - R;
          if (pl.t === 3) LOC.vy = 0;
          else { LOC.vy = pl.t === 2 ? -1450 : -930; tone(pl.t === 2 ? 987.77 : 523.25, .16, .03, 'triangle'); }
          break;
        }
      }
    }
    LOC.cam = Math.min(LOC.cam, mine.y - 560);
    if (mine.y > LOC.cam + H + 60) {
      const o = S.p[API.other];
      if (o.y < mine.y - 60) { mine.x = o.x; mine.y = o.y - 60; }
      else {
        const vis = S.aux.plats.filter(p => p.y < LOC.cam + H - 60 && p.y > LOC.cam + 250);
        const pl = vis.length ? vis.reduce((a, b) => a.y > b.y ? a : b) : S.aux.plats[0];
        mine.x = platX(pl, t) + pl.w / 2; mine.y = pl.y - R - 40;
      }
      LOC.vy = -700; LOC.cam = Math.min(LOC.cam, mine.y - 560);
      buzz([20, 30, 20]); act({k: 'fell'});
    }
  },
  action(k, d) { if (d.k === 'fell') emit({k: 'fizz', x: S.p[k].x, y: S.p[k].y}); },
  update() {
    const A = S.aux, lo = Math.max(S.p.a.y, S.p.d.y);
    S.count = clamp(Math.round((960 - lo) / (960 - A.goalY) * 100), 0, 100);
    if (S.p.a.y < A.goalY && S.p.d.y < A.goalY) finish();
  },
  draw(t) {
    const A = S.aux; if (!A.plats) return;
    const cam = LOC.cam || 0, tt = hostNow();
    for (const pl of A.plats) {
      if (pl.y < cam - 80 || pl.y > cam + H + 40) continue;
      const x = platX(pl, tt);
      if (pl.t === 3) {
        glow(x + pl.w / 2, pl.y - 120, 150, CG, .35);
        ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(x + pl.w / 2, pl.y - 120, 60, 0, TAU); ctx.fill();
        ctx.fillStyle = PAL_NIGHT; ctx.beginPath(); ctx.arc(x + pl.w / 2 + 26, pl.y - 136, 54, 0, TAU); ctx.fill();
        label('Mond', x + pl.w / 2, pl.y + 30, CG, 15);
      }
      if (pl.id === 0) { ctx.fillStyle = 'rgba(80,70,120,.45)'; ctx.fillRect(0, pl.y, W, 60); continue; }
      cloudShape(x, pl.y, pl.w, pl.t === 2 ? [255, 214, 140] : pl.t === 1 ? [200, 220, 255] : pl.t === 3 ? [255, 240, 210] : [240, 236, 250]);
    }
    const lo = Math.max(S.p.a.y, S.p.d.y), top = A.goalY;
    for (let h = 500; h < 960 - top; h += 500) { const y = 960 - h; if (y < cam - 20 || y > cam + H) continue; ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]); label(`${h} m`, 40, y - 6, [200, 200, 230], 11); }
    void lo;
  }
};
const PAL_NIGHT = '#131029';
function cloudShape(x, y, w, c) {
  glow(x + w / 2, y + 4, w * .7, c, .2);
  ctx.fillStyle = rgba(c, .95);
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + 8, w / 2, 11, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * .32, y + 2, w * .16, 0, TAU); ctx.arc(x + w * .58, y - 1, w * .2, 0, TAU); ctx.fill();
}

/* ================= Hafenstraße (hüpfen) ================= */
const ROWS = ['safe', 'road', 'road', 'road', 'safe', 'water', 'water', 'water', 'safe', 'road', 'road', 'road', 'safe', 'water', 'goal'];
const rowY = i => 940 - i * 60;
const LANES = {
  1: {v: 120, len: 90, per: 260, off: 0}, 2: {v: -160, len: 110, per: 300, off: 80}, 3: {v: 100, len: 70, per: 200, off: 30},
  5: {v: 70, len: 170, per: 290, off: 0}, 6: {v: -95, len: 140, per: 270, off: 100}, 7: {v: 60, len: 190, per: 300, off: 50},
  9: {v: -200, len: 80, per: 280, off: 0}, 10: {v: 140, len: 120, per: 330, off: 60}, 11: {v: -110, len: 90, per: 240, off: 20},
  13: {v: 85, len: 150, per: 280, off: 40}
};
function objs(i, t) {
  const L = LANES[i], base = ((L.v * API.diff() * t + L.off) % L.per + L.per) % L.per, out = [];
  for (let x = base - L.per; x < W + L.per; x += L.per) out.push(x);
  return out;
}
const carHit = (i, x, t) => objs(i, t).some(o => x + 14 > o && x - 14 < o + LANES[i].len);
const onBoat = (i, x, t) => objs(i, t).some(o => x > o + 4 && x < o + LANES[i].len - 4);
function frogDie(msg) {
  const F = LOC.fr; F.row = F.safe; F.hop = null; F.inv = .7;
  mine.y = rowY(F.safe); mine.x = clamp(Math.round((mine.x - 30) / 60) * 60 + 30, 30, W - 30);
  buzz([30, 40, 30]); tone(196, .4, .05, 'triangle'); toast(msg); act({k: 'oops'});
}
const strasse = {
  id: 'strasse', w: 3, n: 'Hafenstraße', ic: '⇡', t3: 75, t2: 130, ctrl: 'hop', noThread: true,
  h: () => `${nm('a')} und ${nm('d')} hüpfen gemeinsam über Hafenstraßen und Kanäle bis zum Ziel. Auf dem Wasser nur auf die Boote! Wer erwischt wird, startet am letzten sicheren Streifen.`,
  start: k => ({x: k === 'a' ? 210 : 390, y: 940}),
  countText: () => `Reihe ${S.count}/14`,
  move(dt, inp) {
    if (!LOC.fr) LOC.fr = {row: 0, safe: 0, hop: null, inv: 0};
    const F = LOC.fr, t = hostNow();
    F.inv = Math.max(0, F.inv - dt);
    let d = inp.dirs.length ? inp.dirs[inp.dirs.length - 1] : null;
    if (!d && inp.taps.length && API.SET.ctrl === 'swipe') d = 'u';
    if (d && !F.hop) {
      let nr = F.row, nx = mine.x;
      if (d === 'u') nr++; else if (d === 'd') nr--; else if (d === 'l') nx -= 60; else nx += 60;
      nr = clamp(nr, 0, 14); nx = clamp(nx, 30, W - 30);
      if (nr !== F.row || nx !== mine.x) { F.hop = {fx: mine.x, fy: mine.y, tx: nx, ty: rowY(nr), k: 0}; F.row = nr; tone(d === 'u' ? 698 : 587, .07, .03, 'square'); }
    }
    if (F.hop) {
      const h = F.hop; h.k = Math.min(1, h.k + dt / .13);
      mine.x = h.fx + (h.tx - h.fx) * h.k; mine.y = h.fy + (h.ty - h.fy) * h.k - Math.sin(h.k * Math.PI) * 16;
      if (h.k >= 1) { F.hop = null; mine.y = h.ty; }
      return;
    }
    const type = ROWS[F.row];
    if (type === 'safe' || type === 'goal') { F.safe = F.row; return; }
    if (F.inv > 0) return;
    if (type === 'water') {
      if (onBoat(F.row, mine.x, t)) { mine.x += LANES[F.row].v * API.diff() * dt; if (mine.x < 12 || mine.x > W - 12) frogDie('Abgetrieben!'); }
      else frogDie('Platsch! Ins Wasser gefallen.');
    } else if (type === 'road' && carHit(F.row, mine.x, t)) frogDie('Autsch! Angefahren.');
  },
  onTeleport() { LOC.fr = null; },
  setup() { S.total = 14; S.aux = {}; },
  action(k, d) { if (d.k === 'oops') emit({k: 'fizz', x: S.p[k].x, y: S.p[k].y}); },
  update() {
    const row = p => clamp(Math.round((940 - p.y) / 60), 0, 14);
    S.count = Math.min(row(S.p.a), row(S.p.d));
    if (S.p.a.y <= 105 && S.p.d.y <= 105) finish();
  },
  draw(t) {
    const tt = hostNow();
    ROWS.forEach((ty, i) => {
      const y = rowY(i) - 30;
      if (ty === 'safe') { ctx.fillStyle = '#183326'; ctx.fillRect(0, y, W, 60); ctx.fillStyle = 'rgba(140,220,150,.18)'; for (let x = 10; x < W; x += 22) ctx.fillRect(x + (i * 7) % 11, y + 20 + (x * 3) % 20, 2, 6); }
      else if (ty === 'road') { ctx.fillStyle = '#1b1830'; ctx.fillRect(0, y, W, 60); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.setLineDash([18, 16]); ctx.beginPath(); ctx.moveTo(0, y + 60); ctx.lineTo(W, y + 60); ctx.stroke(); ctx.setLineDash([]); }
      else if (ty === 'water') { ctx.fillStyle = '#0b3150'; ctx.fillRect(0, y, W, 60); ctx.strokeStyle = 'rgba(140,210,255,.18)'; ctx.lineWidth = 1.5; for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y + 20 + k * 22 + Math.sin(x / 30 + t * 2 + i) * 3); ctx.stroke(); } }
      else { const g = ctx.createLinearGradient(0, y, 0, y + 60); g.addColorStop(0, 'rgba(243,201,143,.35)'); g.addColorStop(1, 'rgba(244,168,184,.15)'); ctx.fillStyle = g; ctx.fillRect(0, y, W, 60); label('♥ Ziel ♥', W / 2, y + 38, CG, 18, 700); }
      const L = LANES[i]; if (!L) return;
      for (const ox of objs(i, tt)) {
        if (ty === 'road') {
          const cc = [[255, 120, 170], [120, 220, 255], [255, 210, 110]][i % 3];
          ctx.fillStyle = rgba(cc, .9); rr(ox, y + 12, L.len, 36, 10); ctx.fill();
          ctx.fillStyle = 'rgba(20,16,40,.55)'; rr(ox + L.len * .25, y + 18, L.len * .4, 24, 6); ctx.fill();
          const fx = L.v > 0 ? ox + L.len : ox;
          glow(fx, y + 22, 30, [255, 250, 220], .45); glow(fx, y + 38, 30, [255, 250, 220], .45);
        } else {
          ctx.fillStyle = '#7a5434'; rr(ox, y + 10, L.len, 40, 14); ctx.fill();
          ctx.strokeStyle = 'rgba(255,220,170,.3)'; ctx.lineWidth = 2; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(ox + 8, y + 10 + k * 10); ctx.lineTo(ox + L.len - 8, y + 10 + k * 10); ctx.stroke(); }
          glow(ox + L.len / 2, y + 30, 20, [255, 200, 120], .4);
        }
      }
    });
  }
};

/* ================= Irrgarten (Raster) ================= */
const MAZE = [
  '#####################',
  '#o..#...#...#...#..o#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.#...#...#...#...#.#',
  '#.#######.#.#######.#',
  '#...#...........#...#',
  '#.#.#.#########.#.#.#',
  '#.#.#.#...#...#.#.#.#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.....#.#...#.#.....#',
  '#.#####.#.#.#.#####.#',
  '#.#...............#.#',
  '#.#.#.##.....##.#.#.#',
  '#.#.#.....G.....#.#.#',
  '#.#.###.......###.#.#',
  '#.....#.......#.....#',
  '#####.###.#.###.#####',
  '#...#...........#...#',
  '#.#.#####.#.#####.#.#',
  '#.#...#...#...#...#.#',
  '#.#.#.#.#####.#.#.#.#',
  '#...#.#.......#.#...#',
  '#.###.###.#.###.###.#',
  '#...#...#.#.#...#...#',
  '#.#.###.#.#.#.###.#.#',
  '#o.................o#',
  '#####################'];
const MC = 52, MX0 = 14, MY0 = 160, NC = 21, NR = 27;
const inRoom = (c, r) => r >= 11 && r <= 15 && c >= 7 && c <= 13;
const cen = (c, r) => ({x: MX0 + c * MC + MC / 2, y: MY0 + r * MC + MC / 2});
const mopen = (c, r) => r >= 0 && r < NR && c >= 0 && c < NC && MAZE[r][c] !== '#';
const cellOf = p => ({c: Math.round((p.x - MX0 - MC / 2) / MC), r: Math.round((p.y - MY0 - MC / 2) / MC)});
const DX = {l: -1, r: 1, u: 0, d: 0}, DY = {l: 0, r: 0, u: -1, d: 1}, OPP = {l: 'r', r: 'l', u: 'd', d: 'u'};
const mazeStart = k => cen(k === 'a' ? 8 : 12, 25);
const irrgarten = {
  id: 'irrgarten', w: 3, n: 'Irrgarten', ic: '•', t3: 170, t2: 260, ctrl: 'grid', noClamp: true, three: true, hidePlayers: true, hideNames: true,
  skinName: () => `Prinzessin ${nm('a')} · Prinz ${nm('d')}`,
  h: () => `Prinzessin ${nm('a')} und Prinz ${nm('d')} im großen verwunschenen Heckengarten bei Nacht: Sammelt gemeinsam alle Lichtpunkte. Vier Regenwolken streifen durch die Gänge – die Karte oben rechts zeigt, wo sie sind. Die vier leuchtenden Herzen in den Ecken lassen sie ein paar Sekunden vor euch fliehen. Teilt euch auf!`,
  start: k => mazeStart(k),
  setup() {
    let dots = '', total = 0;
    for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) { const ch = MAZE[r][c]; if (ch === '.' && !inRoom(c, r)) { dots += '1'; total++; } else if (ch === 'o') { dots += '2'; total++; } else dots += '0'; }
    const pen = cen(10, 13);
    S.aux = {dots, power: 0, pen, cl: [0, 1, 2, 3].map(i => ({id: i, x: pen.x, y: pen.y, dir: null, lc: '', wait: S.t + 2 + i * 2.5}))};
    S.total = total;
  },
  move(dt, inp) {
    if (!LOC.g) LOC.g = {dir: null, want: null};
    const g = LOC.g, w = desiredDir(inp); if (w) g.want = w;
    const sp = 205 * speedMul() * dt, {c, r} = cellOf(mine), cc = cen(c, r);
    if (g.want && g.dir && g.want === OPP[g.dir]) g.dir = g.want;
    if (Math.abs(mine.x - cc.x) + Math.abs(mine.y - cc.y) <= sp + .01) {
      if (g.want && mopen(c + DX[g.want], r + DY[g.want])) { mine.x = cc.x; mine.y = cc.y; g.dir = g.want; }
      else if (g.dir && !mopen(c + DX[g.dir], r + DY[g.dir])) { mine.x = cc.x; mine.y = cc.y; g.dir = null; }
    }
    if (g.dir) { mine.x += DX[g.dir] * sp; mine.y += DY[g.dir] * sp; }
  },
  onTeleport() { LOC.g = null; },
  update(dt) {
    const A = S.aux, pw = A.power > S.t;
    for (const k of ['a', 'd']) {
      const p = S.p[k], {c, r} = cellOf(p);
      if (c < 0 || r < 0 || c >= NC || r >= NR) continue;
      const i = r * NC + c, v = A.dots[i];
      if (v !== '1' && v !== '2') continue;
      const cc = cen(c, r);
      if (Math.abs(p.x - cc.x) > 20 || Math.abs(p.y - cc.y) > 20) continue;
      A.dots = A.dots.slice(0, i) + '0' + A.dots.slice(i + 1); S.count++;
      if (v === '2') { A.power = S.t + 8; emit({k: 'power', x: cc.x, y: cc.y}); emit({k: 'toast', txt: 'Liebesbrief! Die Wolken fliehen – jetzt könnt ihr sie verscheuchen.'}); }
      else emit({k: 'dot', o: k});
    }
    const spd = (pw ? 95 : 128 + 40 * S.count / S.total) * API.diff() * dt;
    for (const cl of A.cl) {
      if (S.t < cl.wait) continue;
      const {c, r} = cellOf(cl), cc = cen(c, r), key = c + ',' + r;
      if (!cl.dir || (key !== cl.lc && Math.abs(cl.x - cc.x) + Math.abs(cl.y - cc.y) <= spd + .01)) {
        cl.x = cc.x; cl.y = cc.y; cl.lc = key;
        let opts = ['u', 'd', 'l', 'r'].filter(d => mopen(c + DX[d], r + DY[d]) && d !== OPP[cl.dir]);
        if (!opts.length) opts = ['u', 'd', 'l', 'r'].filter(d => mopen(c + DX[d], r + DY[d]));
        const tgt = dist(S.p.a, cl) < dist(S.p.d, cl) ? S.p.a : S.p.d;
        let best = opts[0];
        if (Math.random() < .25) best = opts[(Math.random() * opts.length) | 0];
        else {
          let bs = Infinity;
          for (const d of opts) { const dd = Math.hypot(cc.x + DX[d] * MC - tgt.x, cc.y + DY[d] * MC - tgt.y), s = pw ? -dd : dd; if (s < bs) { bs = s; best = d; } }
        }
        cl.dir = best;
      }
      cl.x += DX[cl.dir] * spd; cl.y += DY[cl.dir] * spd;
      for (const k of ['a', 'd']) {
        const p = S.p[k];
        if (dist(p, cl) >= 34) continue;
        if (pw) { cl.x = A.pen.x; cl.y = A.pen.y; cl.dir = null; cl.lc = ''; cl.wait = S.t + 3; emit({k: 'poof', x: p.x, y: p.y}); break; }
        if (p.inv <= 0) { const s = mazeStart(k); emit({k: 'caught', x: p.x, y: p.y, o: k}); teleport(k, s.x, s.y); p.inv = 2.5; emit({k: 'toast', txt: `Eine Wolke hat ${nm(k)} erwischt – zurück zum Start.`}); }
      }
    }
    if (S.count >= S.total) finish();
  },
  draw(t) {
    const A = S.aux; if (!A.dots) return;
    const pw = A.power > hostNow();
    for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
      const x = MX0 + c * MC, y = MY0 + r * MC;
      if (MAZE[r][c] === '#') {
        ctx.fillStyle = '#1a1240'; ctx.fillRect(x, y, MC, MC);
        ctx.strokeStyle = 'rgba(150,120,255,.7)'; ctx.lineWidth = 2; ctx.beginPath();
        if (mopen(c, r - 1)) { ctx.moveTo(x, y + 2); ctx.lineTo(x + MC, y + 2); }
        if (mopen(c, r + 1)) { ctx.moveTo(x, y + MC - 2); ctx.lineTo(x + MC, y + MC - 2); }
        if (mopen(c - 1, r)) { ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + MC); }
        if (mopen(c + 1, r)) { ctx.moveTo(x + MC - 2, y); ctx.lineTo(x + MC - 2, y + MC); }
        ctx.stroke();
        continue;
      }
      const v = A.dots[r * NC + c], cx = x + MC / 2, cy = y + MC / 2;
      if (v === '1') { ctx.fillStyle = rgba(CG, .9); ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill(); }
      else if (v === '2') { const s = 1 + Math.sin(t * 6) * .15; glow(cx, cy, 30, CA, .6); letter(cx, cy, s); }
    }
    if (!LOC.cs) LOC.cs = {};
    for (const cl of A.cl) {
      const s = LOC.cs[cl.id] || (LOC.cs[cl.id] = {x: cl.x, y: cl.y});
      if (Math.hypot(cl.x - s.x, cl.y - s.y) > 60) { s.x = cl.x; s.y = cl.y; } else { s.x += (cl.x - s.x) * .35; s.y += (cl.y - s.y) * .35; }
      const waiting = hostNow() < cl.wait;
      ctx.globalAlpha = waiting ? .4 : 1;
      greyCloud(s.x + (pw ? Math.sin(t * 30 + cl.id) * 2 : 0), s.y, pw, t + cl.id);
      ctx.globalAlpha = 1;
    }
    if (pw) label('Liebesbrief-Zeit!', W / 2, 140, CA, 16, 700);
  }
};
/* ---- Irrgarten in 3D: großer, begehbarer Heckengarten bei Nacht ---- */
const MX = px => (px - MX0) / MC * 2 - NC, MZ = py => (py - MY0) / MC * 2 - NR;
const X3 = c => 2 * c - (NC - 1), Z3 = r => 2 * r - (NR - 1);
function canvasT(T, w, h, draw, rx, ry) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (rx) t.repeat.set(rx, ry); t.anisotropy = 4; return t; }
function xrayMat(T, mat, U) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uP = U.uP; sh.uniforms.uC = U.uC;
    sh.vertexShader = 'varying vec3 vZW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 zw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        zw = instanceMatrix * zw;
      #endif
      vZW = (modelMatrix * zw).xyz;`);
    sh.fragmentShader = 'uniform vec3 uP; uniform vec3 uC; varying vec3 vZW;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      vec3 seg = uP - uC; float tt = clamp(dot(vZW - uC, seg) / dot(seg, seg), 0.0, 1.0);
      float dd = length(vZW - (uC + seg * tt));
      if (tt < .9 && dd < 1.5) discard;`);
  };
  return mat;
}
function buildMaze(T) {
  const K = window.ZL_KIT(API), scene = new T.Scene(), U = {uP: {value: new T.Vector3()}, uC: {value: new T.Vector3()}};
  scene.fog = new T.FogExp2(0x0e0a24, .052);
  scene.add(K.sky(T, 0x02020c, 0x1c1240, 0x0b0718, 200));
  scene.environment = K.env(T, 'maze', 0x1a1640, 0x2a1d4a, 0x0a0812, [[30, 25, -40, 12, 12, 0xfff0d0], [-30, 8, 20, 30, 6, 0xffb0d0]]);
  const cam = new T.PerspectiveCamera(62, 1, .1, 300);
  const hemi = new T.HemisphereLight(0x8c84ff, 0x1a1030, .42); scene.add(hemi);
  scene.add(new T.AmbientLight(0xffffff, .08));
  const moonL = new T.DirectionalLight(0xbfc8ff, .45); moonL.position.set(-12, 30, -25); scene.add(moonL);
  // Himmel
  const sn = 700, sp = new Float32Array(sn * 3);
  for (let i = 0; i < sn; i++) { const a = rnd(0, TAU), e = rnd(.05, 1.5), r = 150; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  scene.add(new T.Points(sg, new T.PointsMaterial({color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false})));
  const moon = new T.Mesh(new T.CircleGeometry(9, 40), new T.MeshBasicMaterial({color: 0xfff4dc, fog: false})); moon.position.set(-30, 60, -120); moon.lookAt(0, 0, 0); scene.add(moon);
  const moonG = K.sprite(T, 0xffe6c0, 70, .5); moonG.material.fog = false; moonG.position.copy(moon.position); scene.add(moonG);
  // Boden: Pflasterweg im Labyrinth, Wiese außen
  const floorT = canvasT(T, 256, 256, (g, w, h) => {
    g.fillStyle = '#1a1626'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 52 + Math.random() * 22, ox = (y % 2) * 16; g.fillStyle = `rgb(${v},${v - 8},${v + 14})`; rr2(g, x * 32 + ox + 2, y * 32 + 2, 28, 28, 7); }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(80,150,95,${Math.random() * .35})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, NC, NR);
  const floor = new T.Mesh(new T.PlaneGeometry(NC * 2, NR * 2), new T.MeshStandardMaterial({map: floorT, roughness: .75, metalness: .1, envMapIntensity: .6}));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grassT = canvasT(T, 128, 128, (g, w, h) => { g.fillStyle = '#10261a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 70},${50 + Math.random() * 30},.6)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 4); } }, 60, 60);
  const lawn = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshStandardMaterial({map: grassT, roughness: 1})); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -.02; scene.add(lawn);
  // Hecken
  const leafT = canvasT(T, 256, 256, (g, w, h) => {
    g.fillStyle = '#16351f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = Math.random(); g.fillStyle = v < .4 ? `rgba(70,140,85,${.4 + Math.random() * .5})` : v < .8 ? 'rgba(25,70,40,.7)' : 'rgba(120,190,120,.45)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 1.5 + Math.random() * 2.5, Math.random() * 3, 0, TAU); g.fill(); }
  }, 1, 1);
  const WH = 2.5, walls = [];
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) if (MAZE[r][c] === '#') walls.push([c, r]);
  const hedgeM = xrayMat(T, new T.MeshStandardMaterial({map: leafT, roughness: .9, emissive: 0x081a0e, emissiveIntensity: .5}), U);
  const wim = new T.InstancedMesh(new T.BoxGeometry(2, WH, 2, 1, 2, 1), hedgeM, walls.length);
  const topM = xrayMat(T, new T.MeshStandardMaterial({map: leafT, roughness: .95, color: 0x8fbf8f}), U);
  const tim = new T.InstancedMesh(new T.SphereGeometry(1.15, 8, 4, 0, TAU, 0, Math.PI / 2), topM, walls.length);
  const o = new T.Object3D();
  walls.forEach(([c, r], i) => {
    const hh = 1 + ((c * 7 + r * 13) % 5) * .03;
    o.position.set(X3(c), WH * hh / 2, Z3(r)); o.scale.set(1, hh, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); wim.setMatrixAt(i, o.matrix);
    o.position.y = WH * hh - .05; o.scale.set(.95, .3, .95); o.updateMatrix(); tim.setMatrixAt(i, o.matrix);
  });
  scene.add(wim); scene.add(tim);
  // Rosen und Lichterketten an den Hecken
  const faces = [];
  walls.forEach(([c, r]) => { for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (mopen(c + dc, r + dr)) faces.push([c, r, dc, dr]); });
  const roseM = xrayMat(T, new T.MeshStandardMaterial({roughness: .6, emissive: 0x401020, emissiveIntensity: .4}), U);
  const roses = new T.InstancedMesh(new T.IcosahedronGeometry(.14, 0), roseM, faces.length * 2);
  const fairy = new T.InstancedMesh(new T.SphereGeometry(.05, 6, 4), xrayMat(T, new T.MeshBasicMaterial({color: 0xffffff}), U), faces.length);
  const rc = [new T.Color(0xff6f9a), new T.Color(0xffd0dc), new T.Color(0xd23a5c), new T.Color(0xfff2f5)], fc = [new T.Color(0xffd28c), new T.Color(0xffb0c8), new T.Color(0xfff0c0)];
  let ri = 0;
  faces.forEach(([c, r, dc, dr], i) => {
    for (let k = 0; k < 2; k++) {
      const along = rnd(-.8, .8), y = rnd(.5, WH - .3);
      o.position.set(X3(c) + dc * 1.02 + (dr ? along : 0), y, Z3(r) + dr * 1.02 + (dc ? along : 0)); o.scale.setScalar(rnd(.7, 1.3)); o.updateMatrix(); roses.setMatrixAt(ri, o.matrix); roses.setColorAt(ri, rc[(i + k) % 4]); ri++;
    }
    o.position.set(X3(c) + dc * 1.0 + (dr ? rnd(-.9, .9) : 0), WH + .05, Z3(r) + dr * 1.0 + (dc ? rnd(-.9, .9) : 0)); o.scale.setScalar(1); o.updateMatrix(); fairy.setMatrixAt(i, o.matrix); fairy.setColorAt(i, fc[i % 3]);
  });
  scene.add(roses); scene.add(fairy);
  // Laternen an Kreuzungen
  const lamps = [], postM = new T.MeshStandardMaterial({color: 0x2c2838, metalness: .7, roughness: .35}), glassM = new T.MeshBasicMaterial({color: 0xffe2b0});
  const junc = [];
  for (let r = 1; r < NR - 1; r++) for (let c = 1; c < NC - 1; c++) { if (!mopen(c, r) || inRoom(c, r)) continue; const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => mopen(c + dc, r + dr)).length; if (n >= 3) junc.push([c, r]); }
  junc.filter((_, i) => i % 2 === 0).forEach(([c, r]) => {
    const g = new T.Group(); g.position.set(X3(c) + .72, 0, Z3(r) + .72);
    const post = new T.Mesh(new T.CylinderGeometry(.05, .08, 2.1, 8), postM); post.position.y = 1.05; g.add(post);
    const lamp = new T.Mesh(new T.CylinderGeometry(.14, .1, .32, 6), glassM); lamp.position.y = 2.25; g.add(lamp);
    const cap = new T.Mesh(new T.ConeGeometry(.2, .18, 6), postM); cap.position.y = 2.5; g.add(cap);
    const gl = K.sprite(T, 0xffcf8a, 2.6, .85); gl.position.y = 2.25; g.add(gl);
    const pool = new T.Mesh(new T.CircleGeometry(1.5, 24), new T.MeshBasicMaterial({color: 0xffb870, transparent: true, opacity: .14, blending: T.AdditiveBlending, depthWrite: false})); pool.rotation.x = -Math.PI / 2; pool.position.set(-.5, .03, -.5); g.add(pool);
    scene.add(g); lamps.push({g, gl, ph: rnd(0, 6), x: g.position.x, z: g.position.z});
  });
  const lampLights = [0, 1].map(() => { const l = new T.PointLight(0xffc48a, 1.4, 7, 1.7); scene.add(l); return l; });
  // Brunnen in der Mitte (dort wohnen die Wolken)
  const stone = new T.MeshStandardMaterial({color: 0x8a86a0, roughness: .6, metalness: .1});
  const basin = new T.Mesh(new T.TorusGeometry(2.2, .28, 10, 40), stone); basin.rotation.x = Math.PI / 2; basin.position.y = .35; scene.add(basin);
  const water = new T.Mesh(new T.CircleGeometry(2.1, 40), new T.MeshStandardMaterial({color: 0x3a7fd0, emissive: 0x2a60c0, emissiveIntensity: .6, metalness: .3, roughness: .1, transparent: true, opacity: .85}));
  water.rotation.x = -Math.PI / 2; water.position.y = .4; scene.add(water);
  const col = new T.Mesh(new T.CylinderGeometry(.22, .32, 1.6, 12), stone); col.position.y = .8; scene.add(col);
  const bowl = new T.Mesh(new T.SphereGeometry(.7, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), stone); bowl.position.y = 1.7; scene.add(bowl);
  const fh = new T.Mesh(K.heartGeo(T, .5, .2), new T.MeshStandardMaterial({color: 0xffc0d4, emissive: 0xff7aa8, emissiveIntensity: 1})); fh.position.y = 2.3; scene.add(fh);
  const SPN = 90, spos = new Float32Array(SPN * 3), spray = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(spos, 3)), new T.PointsMaterial({color: 0xbfe0ff, size: .09, transparent: true, opacity: .8}));
  spray.userData.p = Array.from({length: SPN}, () => ({t: rnd(0, 1), a: rnd(0, TAU), v: rnd(.8, 1.2)})); scene.add(spray);
  // Lichtpunkte, Herzen mit Lichtsäulen
  const cells = [];
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) if (MAZE[r][c] === '.' && !inRoom(c, r)) cells.push(r * NC + c);
  const dim = new T.InstancedMesh(new T.SphereGeometry(.16, 8, 6), new T.MeshStandardMaterial({color: 0xffe2a8, emissive: 0xffc870, emissiveIntensity: 1.7}), cells.length);
  scene.add(dim);
  const hearts = {}, hgeo = K.heartGeo(T, .5, .2), hm = new T.MeshStandardMaterial({color: 0xff8fb4, emissive: 0xff5f96, emissiveIntensity: 1.2, metalness: .4, roughness: .25});
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) if (MAZE[r][c] === 'o') {
    const g = new T.Group(); g.position.set(X3(c), 0, Z3(r));
    const m = new T.Mesh(hgeo, hm); m.position.y = 1.1; g.add(m); const hs = K.sprite(T, 0xff9ec4, 3.5, .8); hs.position.y = 1.1; g.add(hs);
    const beam = new T.Mesh(new T.CylinderGeometry(.35, .6, 30, 16, 1, true), new T.MeshBasicMaterial({color: 0xff9ec4, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false}));
    beam.position.y = 15; g.add(beam); scene.add(g); hearts[r * NC + c] = {g, m};
  }
  // Glühwürmchen
  const FN = 180, fpos = new Float32Array(FN * 3), fdat = [];
  for (let i = 0; i < FN; i++) { const x = rnd(-NC, NC), z = rnd(-NR, NR); fdat.push({x, z, y: rnd(.4, 3.2), p: rnd(0, 6), s: rnd(.3, .9)}); }
  const flies = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(fpos, 3)), new T.PointsMaterial({color: 0xdfff9a, size: .16, map: K.glowTex(T), transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
  flies.frustumCulled = false; scene.add(flies);
  // Bodennebel
  const mist = [];
  for (let i = 0; i < 26; i++) { const m = K.sprite(T, 0x8a80c0, rnd(6, 10), .07); m.material.blending = T.NormalBlending; m.position.set(rnd(-NC, NC), .4, rnd(-NR, NR)); m.userData.v = rnd(-.3, .3); scene.add(m); mist.push(m); }
  // Funken beim Einsammeln
  const PN = 160, ppos = new Float32Array(PN * 3), pcol = new Float32Array(PN * 3);
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(ppos, 3)); pg.setAttribute('color', new T.BufferAttribute(pcol, 3));
  const sparks = new T.Points(pg, new T.PointsMaterial({size: .14, vertexColors: true, map: K.glowTex(T), transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
  sparks.frustumCulled = false; scene.add(sparks);
  // Figuren, Schatten, Licht
  const fig = {a: K.princess(T), d: K.prince(T)}, shadows = {}, lights = {};
  for (const k of ['a', 'd']) {
    scene.add(fig[k]); fig[k].scale.setScalar(1.05);
    shadows[k] = K.blob(T, 1.8); scene.add(shadows[k]);
    if (k === API.me) { lights[k] = new T.PointLight(k === 'a' ? 0xffd6e2 : 0xd6e6ff, 1.1, 9, 1.4); scene.add(lights[k]); }
  }
  // Regenwolken
  const clouds = [0, 1, 2, 3].map(() => {
    const c = K.cloud(T); c.scale.setScalar(1.05); c.userData.mat.transparent = true; scene.add(c);
    const RN = 40, rp = new Float32Array(RN * 6), rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    const rain = new T.LineSegments(rg, new T.LineBasicMaterial({color: 0x9fb8ff, transparent: true, opacity: .55})); rain.frustumCulled = false; scene.add(rain);
    const sh = K.blob(T, 2.4); scene.add(sh);
    return {c, rain, sh, drops: Array.from({length: RN}, () => ({x: rnd(-.6, .6), z: rnd(-.5, .5), y: rnd(0, 1)})), flash: 0};
  });
  return {scene, cam, U, dim, cells, hearts, fig, shadows, lights, clouds, hemi, lamps, lampLights, flies, fdat, mist, sparks, sp: Array.from({length: PN}, () => ({life: 0})), spi: 0,
    spray, fh, water, last: '', camPos: null, prev: {}, head: {a: 0, d: 0}};
}
function rr2(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
irrgarten.render3d = function (t, part) {
  const T = window.THREE; if (!T || !API.renderer3D()) return;
  const A = S.aux; if (!A.dots || A.dots.length !== NC * NR) return;
  if (!LOC.m3) { LOC.m3 = buildMaze(T); LOC.__dispose = () => API.disposeTree(LOC.m3.scene); }
  const M = LOC.m3, K = window.ZL_KIT(API), sc = API.screen(), dt = Math.min(.05, M.lt ? t - M.lt : .016); M.lt = t;
  const pw = A.power > hostNow();
  // Punkte + Funken beim Einsammeln
  const o = new T.Object3D();
  if (M.last !== A.dots) {
    for (let i = 0; i < A.dots.length && M.last; i++) if (M.last[i] !== '0' && A.dots[i] === '0') {
      const c = i % NC, r = (i / NC) | 0, col = M.last[i] === '2' ? [1, .5, .7] : [1, .85, .5];
      for (let k = 0; k < 16; k++) { const p = M.sp[M.spi]; M.spi = (M.spi + 1) % M.sp.length; Object.assign(p, {x: X3(c), y: .6, z: Z3(r), vx: rnd(-2.2, 2.2), vy: rnd(1.5, 4.5), vz: rnd(-2.2, 2.2), life: rnd(.5, .9), c: col}); }
    }
    for (const i in M.hearts) M.hearts[i].g.visible = A.dots[i] === '2';
    M.last = A.dots;
  }
  M.cells.forEach((i, k) => { const on = A.dots[i] === '1'; o.position.set(X3(i % NC), .6 + Math.sin(t * 2.4 + i) * .08, Z3((i / NC) | 0)); o.scale.setScalar(on ? 1 : 0); o.updateMatrix(); M.dim.setMatrixAt(k, o.matrix); });
  M.dim.instanceMatrix.needsUpdate = true;
  for (const i in M.hearts) { const h = M.hearts[i]; h.m.rotation.y = t * 2; h.m.position.y = 1.1 + Math.sin(t * 3 + +i) * .15; }
  const pa = M.sparks.geometry.attributes.position, pc = M.sparks.geometry.attributes.color;
  M.sp.forEach((p, i) => {
    if (p.life > 0) { p.life -= dt; p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    const a = Math.max(0, p.life) * 1.4; pa.setXYZ(i, p.x || 0, p.life > 0 ? p.y : -99, p.z || 0); pc.setXYZ(i, (p.c || [1, 1, 1])[0] * a, (p.c || [1, 1, 1])[1] * a, (p.c || [1, 1, 1])[2] * a);
  });
  pa.needsUpdate = true; pc.needsUpdate = true;
  // Figuren
  const meK = API.me, oK = API.other;
  const pos = {[meK]: {x: MX(mine.x), z: MZ(mine.y)}, [oK]: {x: MX(part.x), z: MZ(part.y)}};
  for (const k of ['a', 'd']) {
    const f = M.fig[k], p = pos[k], pr = M.prev[k] || p, vx = p.x - pr.x, vz = p.z - pr.z, mv = Math.hypot(vx, vz) > .004 && Math.hypot(vx, vz) < 1.5;
    if (mv) M.head[k] = API.lerpA(M.head[k], Math.atan2(-vx, -vz), Math.min(1, dt * 14));
    f.position.set(p.x, 0, p.z); f.rotation.y = M.head[k];
    K.animFigure(f, t + (k === 'a' ? 0 : 1.3), mv);
    const inv = S.p[k].inv > 0 && S.phase === 'play'; f.visible = !inv || Math.sin(t * 22) > -.3;
    M.shadows[k].position.set(p.x, .02, p.z);
    if (M.lights[k]) M.lights[k].position.set(p.x, 3.4, p.z + .6);
    M.prev[k] = p;
  }
  // Wolken mit Regen
  if (!LOC.cs) LOC.cs = {};
  A.cl.forEach((cl, i) => {
    const s = LOC.cs[cl.id] || (LOC.cs[cl.id] = {x: cl.x, y: cl.y, h: 0});
    if (Math.hypot(cl.x - s.x, cl.y - s.y) > 60) { s.x = cl.x; s.y = cl.y; } else { s.x += (cl.x - s.x) * Math.min(1, dt * 14); s.y += (cl.y - s.y) * Math.min(1, dt * 14); }
    const C = M.clouds[i]; if (!C) return;
    if (cl.dir) s.h = API.lerpA(s.h, Math.atan2(-DX[cl.dir], -DY[cl.dir]), Math.min(1, dt * 10));
    const cx = MX(s.x) + (pw ? Math.sin(t * 30 + i) * .06 : 0), cz = MZ(s.y), cy = 1.7 + Math.sin(t * 2.4 + i) * .15;
    C.c.position.set(cx, cy, cz); C.c.rotation.y = s.h; C.sh.position.set(cx, .03, cz);
    const waiting = hostNow() < cl.wait, m = C.c.userData.mat;
    if (!pw && Math.random() < dt * .12) C.flash = .25;
    C.flash = Math.max(0, C.flash - dt);
    m.color.set(pw ? 0xb8d4ff : 0x6f6a8a); m.emissive.set(pw ? 0x3050a0 : (C.flash > 0 ? 0xc8d0ff : 0x15122a)); m.emissiveIntensity = C.flash > 0 ? 1.4 : .5; m.opacity = waiting ? .45 : 1;
    const rp = C.rain.geometry.attributes.position;
    C.drops.forEach((d, j) => { d.y -= dt * 2.6; if (d.y < 0) d.y += 1; const y = d.y * (cy - .3); rp.setXYZ(j * 2, cx + d.x, y + .25, cz + d.z); rp.setXYZ(j * 2 + 1, cx + d.x, y, cz + d.z); });
    rp.needsUpdate = true; C.rain.visible = !pw && !waiting;
  });
  // Laternen: die drei nächsten werfen echtes Licht
  const me3 = pos[meK];
  M.lamps.forEach(l => { l.d = (l.x - me3.x) ** 2 + (l.z - me3.z) ** 2; l.gl.material.opacity = .7 + Math.sin(t * 9 + l.ph) * .08 + Math.sin(t * 23 + l.ph) * .05; });
  const near = M.lamps.slice().sort((a, b) => a.d - b.d);
  M.lampLights.forEach((L, i) => { const l = near[i]; if (l) { L.position.set(l.x, 2.2, l.z); L.intensity = 1.3 + Math.sin(t * 9 + l.ph) * .15; } });
  // Glühwürmchen, Nebel, Brunnen
  const fp = M.flies.geometry.attributes.position;
  M.fdat.forEach((f, i) => fp.setXYZ(i, f.x + Math.sin(t * f.s + f.p) * 1.2, f.y + Math.sin(t * f.s * 1.7 + f.p) * .4, f.z + Math.cos(t * f.s * .8 + f.p) * 1.2));
  fp.needsUpdate = true; M.flies.material.opacity = .7 + Math.sin(t * 3) * .2;
  M.mist.forEach(m => { m.position.x += m.userData.v * dt; if (m.position.x > NC + 4) m.position.x = -NC - 4; if (m.position.x < -NC - 4) m.position.x = NC + 4; });
  const sp = M.spray.geometry.attributes.position;
  M.spray.userData.p.forEach((p, i) => { p.t = (p.t + dt * .7 * p.v) % 1; const r = .2 + p.t * 1.1; sp.setXYZ(i, Math.cos(p.a) * r, 1.9 + p.t * 1.2 - p.t * p.t * 2.2, Math.sin(p.a) * r); });
  sp.needsUpdate = true; M.fh.rotation.y = t * 1.5;
  M.water.material.emissiveIntensity = .5 + Math.sin(t * 2) * .1;
  M.hemi.color.set(pw ? 0xffa8cc : 0x8c84ff); M.scene.fog.color.set(pw ? 0x2a0e2a : 0x0e0a24);
  // Kamera: tief hinter der eigenen Figur, Blick immer nach „oben“ – passend zur Steuerung
  const port = sc.cw < sc.ch;
  const want = new T.Vector3(me3.x, port ? 5.6 : 4.8, me3.z + (port ? 6.2 : 6.6));
  if (!M.camPos || M.camPos.distanceTo(want) > 12) M.camPos = want.clone(); M.camPos.lerp(want, Math.min(1, dt * 5));
  M.cam.position.copy(M.camPos); M.cam.lookAt(me3.x, .9, me3.z - 3.2);
  M.cam.aspect = sc.cw / sc.ch; M.cam.fov = port ? 66 : 56; M.cam.updateProjectionMatrix();
  M.U.uC.value.copy(M.cam.position); M.U.uP.value.set(me3.x, 1.1, me3.z);
  API.render3D(M.scene, M.cam, {bloom: 1.1, th: .55});
  // Namen und Richtungspfeil zum Partner
  for (const k of [oK, meK]) { const p = K.proj(M.cam, new T.Vector3(pos[k].x, 3.1, pos[k].z)); if (p.ok && p.x > 0 && p.x < sc.cw && p.y > 0 && p.y < sc.ch) K.nameTag(nm(k), p.x, p.y, COL[k]); }
  const op = K.proj(M.cam, new T.Vector3(pos[oK].x, 1, pos[oK].z));
  if (!(op.ok && op.x > 20 && op.x < sc.cw - 20 && op.y > 80 && op.y < sc.ch - 20)) {
    const ang = Math.atan2(pos[oK].z - me3.z, pos[oK].x - me3.x), ex = sc.cw / 2 + Math.cos(ang) * sc.cw * .4, ey = sc.ch * .55 + Math.sin(ang) * sc.ch * .36;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = rgba(COL[oK], .95); ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.font = '700 12px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(COL[oK], 1); ctx.fillText(nm(oK), ex, ey + 22);
  }
  // Karte
  const cs = Math.min(6.5, (sc.cw * .3) / NC), mw = NC * cs, mh = NR * cs, mx = sc.cw - mw - 12, my = 66;
  ctx.fillStyle = 'rgba(10,8,24,.6)'; rr(mx - 6, my - 6, mw + 12, mh + 12, 10); ctx.fill();
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const v = MAZE[r][c];
    if (v === '#') { ctx.fillStyle = 'rgba(90,170,115,.6)'; ctx.fillRect(mx + c * cs, my + r * cs, cs + .3, cs + .3); continue; }
    const d = A.dots[r * NC + c];
    if (d === '1') { ctx.fillStyle = 'rgba(255,215,150,.85)'; ctx.fillRect(mx + c * cs + cs / 2 - .9, my + r * cs + cs / 2 - .9, 1.8, 1.8); }
    else if (d === '2') { ctx.fillStyle = '#ff8fb4'; heartPath(mx + c * cs + cs / 2, my + r * cs + cs / 2, cs * .5); ctx.fill(); }
  }
  const toM = (x, z) => [mx + (x + NC) / 2 * cs, my + (z + NR) / 2 * cs];
  A.cl.forEach(cl => { const s = LOC.cs[cl.id]; if (!s) return; const [a, b] = toM(MX(s.x), MZ(s.y)); ctx.fillStyle = pw ? '#9cc4ff' : '#b9b4cc'; ctx.beginPath(); ctx.arc(a, b, cs * .55, 0, TAU); ctx.fill(); });
  for (const k of [oK, meK]) { const [a, b] = toM(pos[k].x, pos[k].z); ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(a, b, cs * .62, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
  if (pw) { ctx.textAlign = 'center'; ctx.font = '700 18px Karla, system-ui'; ctx.fillStyle = rgba(CA, 1); ctx.fillText(`Herz-Zeit! Die Wolken fliehen · ${Math.ceil(A.power - hostNow())}`, sc.cw / 2, sc.ch - 110); }
};
function letter(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#fff4ea'; rr(-12, -8, 24, 16, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(200,120,140,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(0, 2); ctx.lineTo(12, -8); ctx.stroke();
  ctx.fillStyle = '#f48aa3'; heartPath(0, 1, 4); ctx.fill();
  ctx.restore();
}
function greyCloud(x, y, scared, t) {
  const c = scared ? [170, 200, 255] : [150, 145, 175];
  glow(x, y, 40, c, .3);
  ctx.fillStyle = rgba(c, .95); ctx.beginPath();
  ctx.arc(x - 10, y + 3, 11, 0, TAU); ctx.arc(x + 10, y + 3, 11, 0, TAU); ctx.arc(x, y - 5, 14, 0, TAU); ctx.fill();
  ctx.fillStyle = scared ? '#2a3a66' : '#2a2340';
  const b = Math.sin(t * 3) > .95 ? .3 : 1;
  ctx.beginPath(); ctx.ellipse(x - 5, y - 1, 2.2, 3 * b, 0, 0, TAU); ctx.ellipse(x + 5, y - 1, 2.2, 3 * b, 0, 0, TAU); ctx.fill();
}

/* ================= Unser Lied (Rhythmus) ================= */
const SONG = [
  [0, 'a', 4], [1, 'a', 5], [2, 'a', 7], [3, 'a', 5], [4, 'a', 4], [5, 'a', 3], [6, 'a', 2],
  [8, 'a', 3], [9, 'a', 4], [10, 'a', 5], [11, 'a', 7], [12, 'a', 8], [13, 'a', 7], [14, 'a', 5],
  [16, 'd', 2], [17, 'd', 3], [18, 'd', 4], [19, 'd', 3], [20, 'd', 2], [21, 'd', 1], [22, 'd', 0],
  [24, 'd', 1], [25, 'd', 2], [26, 'd', 4], [27, 'd', 5], [28, 'd', 4], [29, 'd', 2], [30, 'd', 4],
  [32, 'a', 5], [33, 'd', 4], [34, 'a', 7], [35, 'd', 5], [36, 'a', 8], [37, 'd', 7], [38, 'a', 5],
  [40, 'd', 4], [41, 'a', 5], [42, 'd', 2], [43, 'a', 4], [44, 'd', 3], [45, 'a', 4], [46, 'd', 2],
  [48, 'a', 5], [48, 'd', 2], [50, 'a', 7], [50, 'd', 4], [52, 'a', 8], [52, 'd', 5], [54, 'a', 7], [54, 'd', 4],
  [56, 'a', 5], [56, 'd', 2], [57, 'a', 4], [57, 'd', 1], [58, 'a', 5], [58, 'd', 2], [60, 'a', 9], [60, 'd', 5]
].map(([b, o, p], id) => ({id, b, o, p, ln: (o === 'a' ? 0 : 2) + (p % 2)}));
const BEAT = .48, LEAD = 3, FALL = 2.2, HY = 860, LX = [75, 225, 375, 525], BASS = [130.81, 110, 87.31, 98];
const LAST = SONG[SONG.length - 1];
const nT = n => S.lt + LEAD + n.b * BEAT;
const lied = {
  id: 'lied', w: 3, n: 'Unser Lied', ic: '♪', t3: 0, t2: 0, ctrl: 'tap', noTimer: true, noThread: true, hideNames: true,
  h: () => `Spielt gemeinsam ein Lied: Erst ${nm('a')}, dann ${nm('d')}, dann abwechselnd und am Ende zusammen. Ihr braucht 60 % der Töne.`,
  ctrlText: () => 'Tippe links oder rechts auf den Bildschirm (oder ← →), wenn ein Ton deiner Farbe die Linie erreicht.',
  start: k => ({x: k === 'a' ? 150 : 450, y: 955}),
  note: () => `${Math.round(S.count / S.total * 100)} % der Töne getroffen`,
  setup() { S.aux = {hit: {}, ev: 0}; S.total = SONG.length; },
  move(dt, inp) {
    if (!LOC.hit) { LOC.hit = {}; LOC.fb = []; LOC.beat = -99; LOC.press = {}; }
    const t = hostNow(), base = API.me === 'a' ? 0 : 2, presses = [];
    for (const tp of inp.taps) presses.push(base + (tp.x < W / 2 ? 0 : 1));
    for (const d of inp.dirs) { if (d === 'l') presses.push(base); if (d === 'r') presses.push(base + 1); }
    for (const ln of presses) {
      LOC.press[ln] = performance.now();
      let best = null, bd = 1;
      for (const n of SONG) { if (n.ln !== ln || LOC.hit[n.id] || S.aux.hit[n.id] != null) continue; const d = Math.abs(t - nT(n)); if (d < bd) { bd = d; best = n; } }
      if (best && bd < .2) {
        const q = bd < .09 ? 2 : 1; LOC.hit[best.id] = q;
        tone(SONG_NOTES[best.p], .5, .09, 'triangle');
        LOC.fb.push({txt: q === 2 ? 'Perfekt!' : 'Gut', ln, t: performance.now()});
        act({k: 'hit', id: best.id, q});
      } else { tone(150, .12, .03, 'triangle'); LOC.fb.push({txt: 'Daneben', ln, t: performance.now(), miss: 1}); }
    }
    const bt = Math.floor((t - S.lt - LEAD) / BEAT + 1e-6);
    if (bt !== LOC.beat) {
      LOC.beat = bt;
      if (bt < 0 && bt >= -6) tone(1200, .04, .015, 'square');
      else if (bt >= 0 && bt <= LAST.b + 1 && bt % 2 === 0) tone(BASS[Math.floor(bt / 8) % 4], .5, .04);
    }
  },
  action(k, d) {
    if (d.k !== 'hit') return;
    const n = SONG[d.id];
    if (!n || n.o !== k || S.aux.hit[d.id] != null) return;
    S.aux.hit[d.id] = d.q; S.count++;
    emit({k: 'nh', i: n.p, o: k});
  },
  update() {
    const A = S.aux;
    for (const n of SONG) if (A.hit[n.id] == null && S.t > nT(n) + .6) A.hit[n.id] = 0;
    if (!A.ev && S.t > nT(LAST) + 1.6) {
      A.ev = 1;
      const pct = S.count / S.total;
      const need = API.diff() < 1 ? .5 : API.diff() > 1 ? .7 : .6;
      if (pct >= need) finish(1.2, pct >= .9 ? 3 : pct >= .75 ? 2 : 1);
      else failRestart(`${Math.round(pct * 100)} % getroffen – ihr braucht ${Math.round(need * 100)} %. Nochmal!`);
    }
  },
  draw(t) {
    const A = S.aux; if (!A.hit) return;
    const now = performance.now(), tt = hostNow(), base = API.me === 'a' ? 0 : 2;
    for (let ln = 0; ln < 4; ln++) {
      const c = ln < 2 ? CA : CD, own = ln === base || ln === base + 1, pr = LOC.press && LOC.press[ln] && now - LOC.press[ln] < 150;
      ctx.fillStyle = rgba(c, pr ? .22 : own ? .09 : .04); rr(LX[ln] - 62, 140, 124, 790, 18); ctx.fill();
      ctx.strokeStyle = rgba(c, own ? .5 : .2); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(LX[ln], HY, 28, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, HY); ctx.lineTo(W - 10, HY); ctx.stroke();
    for (const n of SONG) {
      if (S.phase !== 'play') break;
      const dt2 = nT(n) - tt; if (dt2 > FALL || dt2 < -.35) continue;
      const done = (A.hit[n.id] || 0) > 0 || (LOC.hit && LOC.hit[n.id]);
      if (done) continue;
      const missed = A.hit[n.id] === 0, y = HY - dt2 / FALL * (HY - 150), c = COL[n.o];
      ctx.globalAlpha = missed ? .25 : 1;
      glow(LX[n.ln], y, 34, c, .5);
      ctx.save(); ctx.translate(LX[n.ln], y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = rgba(c, 1); rr(-13, -13, 26, 26, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(-7, -7, 9, 9, 3); ctx.fill(); ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (LOC.fb) {
      LOC.fb = LOC.fb.filter(f => now - f.t < 650);
      for (const f of LOC.fb) { const k = (now - f.t) / 650; ctx.globalAlpha = 1 - k; label(f.txt, LX[f.ln], HY - 50 - k * 30, f.miss ? [200, 190, 210] : CG, 17, 700); }
      ctx.globalAlpha = 1;
    }
    const b = (tt - S.lt - LEAD) / BEAT;
    const sec = S.phase !== 'play' ? 'Gleich geht\'s los' : b < 0 ? 'Gleich geht\'s los …' : b < 16 ? `${nm('a')} spielt` : b < 32 ? `${nm('d')} antwortet` : b < 48 ? 'Abwechselnd' : 'Zusammen';
    label(sec, W / 2, 110, b >= 16 && b < 32 ? CD : b >= 48 || b < 0 ? CG : CA, 20, 700);
    label('← links tippen', LX[base], 915, COL[API.me], 13); label('rechts tippen →', LX[base + 1], 915, COL[API.me], 13);
  }
};

/* ================= Erinnerungen (Memory) ================= */
const SYMS = ['herz', 'stern', 'mond', 'sonne', 'blume', 'kerze', 'note', 'welle'];
const cardPos = i => ({x: 90 + (i % 4) * 140, y: 270 + Math.floor(i / 4) * 170});
const CWID = 118, CHEI = 150;
function cardAt(p) { for (let i = 0; i < 16; i++) { const c = cardPos(i); if (Math.abs(p.x - c.x) < CWID / 2 && Math.abs(p.y - c.y) < CHEI / 2) return i; } return -1; }
const memory = {
  id: 'memory', w: 3, n: 'Erinnerungen', ic: '❖', t3: 0, t2: 0, ctrl: 'tap', noTimer: true, noThread: true,
  h: () => 'Ihr seid abwechselnd dran und deckt je zwei Karten auf. Wer ein Paar findet, darf weitermachen. Merkt euch gegenseitig, wo was lag!',
  ctrlText: () => 'Tippe auf zwei Karten, wenn du dran bist.',
  start: k => ({x: k === 'a' ? W * .3 : W * .7, y: 935}),
  highlight: k => S.aux && S.aux.turn === k ? 1.5 : .7,
  note: () => `in ${S.aux.moves} Zügen`,
  countText: () => `${S.count}/8 · ${S.aux.moves || 0} Züge`,
  setup() {
    const deck = []; for (let i = 0; i < 8; i++) deck.push(i, i);
    for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    S.aux = {cards: deck, open: [], done: '0'.repeat(16), turn: 'a', moves: 0, back: 0}; S.total = 8;
  },
  move(dt, inp) {
    for (const tp of inp.taps) {
      const i = cardAt(tp); if (i < 0) continue;
      if (S.aux.turn !== API.me) { toast(`Gerade ist ${nm(S.aux.turn)} dran.`); continue; }
      act({k: 'flip', i});
    }
  },
  action(k, d) {
    const A = S.aux;
    if (d.k !== 'flip' || k !== A.turn || A.back || A.open.length >= 2) return;
    const i = d.i | 0;
    if (i < 0 || i > 15 || A.done[i] === '1' || A.open.includes(i)) return;
    A.open.push(i); emit({k: 'flip', o: k});
    if (A.open.length < 2) return;
    A.moves++;
    const [x, y] = A.open;
    if (A.cards[x] === A.cards[y]) {
      A.done = A.done.split('').map((v, j) => j === x || j === y ? '1' : v).join('');
      A.open = []; S.count++;
      const p = cardPos(y); emit({k: 'match', x: p.x, y: p.y});
      if (S.count >= S.total) finish(1.6, A.moves <= 12 ? 3 : A.moves <= 16 ? 2 : 1);
    } else A.back = S.t + 1.3;
  },
  update() {
    const A = S.aux;
    if (A.back && S.t > A.back) { A.back = 0; A.open = []; A.turn = OTH(A.turn); emit({k: 'tick', x: W / 2, y: H / 2, o: A.turn}); }
  },
  draw(t) {
    const A = S.aux; if (!A.cards) return;
    const now = performance.now();
    if (!LOC.st) { LOC.st = {}; LOC.at = {}; }
    for (let i = 0; i < 16; i++) {
      const up = A.done[i] === '1' || A.open.includes(i);
      if (LOC.st[i] === undefined) LOC.st[i] = up;
      if (LOC.st[i] !== up) { LOC.st[i] = up; LOC.at[i] = now; }
      const k = LOC.at[i] ? Math.min(1, (now - LOC.at[i]) / 260) : 1;
      const face = k < .5 ? !up : up, sx = Math.abs(Math.cos(k * Math.PI));
      const p = cardPos(i);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.max(.04, sx), 1);
      if (face) {
        const matched = A.done[i] === '1';
        if (matched) glow(0, 0, 90, CG, .25);
        ctx.fillStyle = matched ? '#fff6e8' : '#fffaf3'; rr(-CWID / 2, -CHEI / 2, CWID, CHEI, 14); ctx.fill();
        ctx.strokeStyle = matched ? rgba(CG, 1) : 'rgba(200,180,200,.8)'; ctx.lineWidth = 2; ctx.stroke();
        symbol(SYMS[A.cards[i]], t);
      } else {
        const g = ctx.createLinearGradient(0, -CHEI / 2, 0, CHEI / 2); g.addColorStop(0, '#3b2a6b'); g.addColorStop(1, '#241a46');
        ctx.fillStyle = g; rr(-CWID / 2, -CHEI / 2, CWID, CHEI, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(243,201,143,.45)'; ctx.lineWidth = 1.5; rr(-CWID / 2 + 6, -CHEI / 2 + 6, CWID - 12, CHEI - 12, 10); ctx.stroke();
        ctx.fillStyle = rgba(CA, .8); ctx.beginPath(); ctx.arc(-8, 0, 13, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(CD, .75); ctx.beginPath(); ctx.arc(8, 0, 13, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    const tc = COL[A.turn];
    label(A.turn === API.me ? 'Du bist dran' : `${nm(A.turn)} ist dran`, W / 2, 150, tc, 22, 700);
  }
};
function symbol(s, t) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s === 'herz') { ctx.fillStyle = '#f07a98'; heartPath(0, 2, 26); ctx.fill(); }
  else if (s === 'stern') { ctx.fillStyle = '#f2b94a'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 32, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
  else if (s === 'mond') { ctx.fillStyle = '#e9c45f'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.fillStyle = '#fffaf3'; ctx.beginPath(); ctx.arc(14, -10, 27, 0, TAU); ctx.fill(); }
  else if (s === 'sonne') { ctx.strokeStyle = '#f39a3d'; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * .3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); ctx.stroke(); } ctx.fillStyle = '#f7b84d'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); }
  else if (s === 'blume') { ctx.fillStyle = '#e98fc1'; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 15, Math.sin(a) * 15, 12, 8, a, 0, TAU); ctx.fill(); } ctx.fillStyle = '#f6c64c'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); }
  else if (s === 'kerze') { ctx.fillStyle = '#efe6d8'; rr(-11, -12, 22, 46, 4); ctx.fill(); ctx.strokeStyle = '#d4a85a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 8, 6, 0, TAU); ctx.stroke(); ctx.fillStyle = '#f5a742'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(8, -20, 0, -15); ctx.quadraticCurveTo(-8, -20, 0, -34); ctx.fill(); }
  else if (s === 'note') { ctx.fillStyle = '#7d6ad8'; ctx.beginPath(); ctx.ellipse(-8, 18, 11, 8, -.4, 0, TAU); ctx.fill(); ctx.fillRect(1, -30, 4, 48); ctx.beginPath(); ctx.moveTo(5, -30); ctx.quadraticCurveTo(22, -24, 18, -6); ctx.quadraticCurveTo(16, -18, 5, -18); ctx.fill(); }
  else if (s === 'welle') { ctx.strokeStyle = '#5aa6e8'; ctx.lineWidth = 4; for (let k = -1; k <= 1; k++) { ctx.beginPath(); for (let x = -32; x <= 32; x += 4) ctx.lineTo(x, k * 16 + Math.sin(x / 8 + t * 2) * 5); ctx.stroke(); } }
}

return [mauer, kette, wolken, strasse, irrgarten, lied, memory];
});
