/* Zwei Lichter – Die Reise
   Online-Koop für zwei Handys. Daniel ist Gastgeber (rechnet das Spiel),
   Aurelia verbindet sich per PeerJS. Texte: config.js */
(() => {
'use strict';
const CFG = window.ZL_CONFIG;
const W = 600, H = 1000, R = 18, HUDH = 62, VMAX = 470, TAU = Math.PI * 2;
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
const WORLDS = [
  {n: 'Sternennacht', th: 'nacht'},
  {n: 'Tiefsee', th: 'meer'},
  {n: 'Frühlingsgarten', th: 'garten'},
  {n: 'Laternenfest', th: 'laternen'}
];
document.querySelectorAll('[data-n]').forEach(el => el.textContent = nm(el.dataset.n));

/* ============ Zustand ============ */
let role = null, me = 'd', other = 'a', peer = null, conn = null, S = null, lastCode = '';
const mine = {x: W * .65, y: H * .9}, ghost = {x: W * .35, y: H * .9}, pend = {x: 0, y: 0};
let lastSid = -1, outEv = [], parts = [], readyKey = '', pickMemo = null, local = {};

/* ============ Hilfen ============ */
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
const mkJelly = (y, dir) => ({x: rnd(90, W - 90), by: y, y, vx: dir * rnd(45, 70), ph: rnd(0, TAU), r: 26});
function jellyStep(js, dt) {
  for (const j of js) {
    j.x += j.vx * dt;
    if (j.x < 45 || j.x > W - 45) { j.vx *= -1; j.x = clamp(j.x, 45, W - 45); }
    j.y = j.by + Math.sin(S.t * .9 + j.ph) * 45;
  }
}
const jellyHit = js => p => js.some(j => dist(p, j) < j.r + R - 6);
function finish(delay = 1.4) {
  S.done = 1; S.finT = S.t + delay; S.doneAt = S.t;
  const sec = S.t - S.lt, L = LV[S.lv];
  S.stars[S.lv] = Math.max(S.stars[S.lv] || 0, sec <= L.t3 ? 3 : sec <= L.t2 ? 2 : 1);
  S.lastStars = sec <= L.t3 ? 3 : sec <= L.t2 ? 2 : 1;
  S.lastTime = sec;
  emit({k: 'win', x: W / 2, y: H * .45});
}
const FIELD = (y, t) => 85 * Math.sin(y / 115 + t * .7);

/* ============ Die zwölf Level ============ */
const LV = [
/* ---- Welt 1: Sternennacht ---- */
{ w: 0, n: 'Funkenregen', ic: '✦', t3: 45, t2: 80,
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
{ w: 0, n: 'Sternschnuppen', ic: '☄', t3: 50, t2: 85,
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
{ w: 0, n: 'Für immer', ic: '∞', t3: 55, t2: 95,
  h: () => 'Zündet die Sterne der Reihe nach an, bevor der Ring abläuft – sonst erlöschen zwei.',
  setup() {
    const n = 14, a = 245, cx = W / 2, cy = 480;
    S.items = [];
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU, s = Math.sin(t), c = Math.cos(t), den = 1 + s * s;
      S.items.push({id: i, x: cx + a * c / den, y: cy + a * s * c / den * 1.3, o: i % 2 ? 'd' : 'a', lit: 0});
    }
    S.total = n; S.cur = 0; S.aux = {tm: 5.5, max: 5.5, wait: S.t + 2.5};
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
{ w: 1, n: 'Perlenmuscheln', ic: '◍', t3: 60, t2: 105, stun: 'betäubt',
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
{ w: 1, n: 'Strömung', ic: '◌', t3: 60, t2: 100, stun: 'betäubt',
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
    if (!local.streaks) { local.streaks = []; for (let i = 0; i < 46; i++) local.streaks.push({x: rnd(0, W), y: rnd(140, H - 20)}); }
    ctx.lineCap = 'round';
    for (const s of local.streaks) {
      const v = FIELD(s.y, S.t);
      s.x += v * .016; if (s.x > W) s.x -= W; if (s.x < 0) s.x += W;
      ctx.strokeStyle = `rgba(160,230,255,${.06 + Math.abs(v) / 85 * .14})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - v * .35, s.y); ctx.stroke();
    }
    for (const it of S.items) if (!it.got) bubble(it.x, it.y + Math.sin(t * 2 + it.ph) * 3, 9);
    S.aux.jelly.forEach(j => jelly(j, t));
  }
},
{ w: 1, n: 'Echo der Muscheln', ic: '♪', t3: 95, t2: 160,
  h: () => 'Hört genau hin: Merkt euch die Reihenfolge. Jeder tippt die Muscheln seiner Farbe.',
  setup() {
    const cx = W / 2, cy = 470, r = 205;
    S.items = [0, 1, 2, 3, 4, 5].map(i => { const an = -Math.PI / 2 + i * TAU / 6; return {id: i, x: cx + Math.cos(an) * r, y: cy + Math.sin(an) * r, o: i % 2 ? 'd' : 'a'}; });
    const seq = []; for (let i = 0; i < 3; i++) seq.push(nextShell(seq));
    S.aux = {seq, round: 0, rounds: 4, mode: 'wait', msg: 'listen', tm: S.t + 3, step: 0, flash: -1, flashT: 0, ins: {a: -1, d: -1}};
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
{ w: 2, n: 'Säen & Gießen', ic: '✿', t3: 80, t2: 130,
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
{ w: 2, n: 'Schmetterlinge', ic: '❦', t3: 90, t2: 150,
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
{ w: 2, n: 'Das Gartentor', ic: '❀', t3: 75, t2: 130, stun: 'gestochen',
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
{ w: 3, n: 'Flammenstaffel', ic: '♨', t3: 80, t2: 135,
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
{ w: 3, n: 'Geheime Wege', ic: '◈', t3: 95, t2: 160, fog: 190,
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
      if (it.got || it.o === me) continue;
      const c = COL[it.o], pul = 1 + Math.sin(t * 4 + it.id) * .12;
      glow(it.x, it.y, 40 * pul, c, .5);
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = rgba(c, .95); ctx.fillRect(-8 * pul, -8 * pul, 16 * pul, 16 * pul); ctx.restore();
      label(nm(it.o), it.x, it.y - 22, c, 13);
    }
  }
},
{ w: 3, n: 'Unser Herz', ic: '♥', t3: 55, t2: 100,
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
function nextShell(seq) { let i; do { i = (Math.random() * 6) | 0; } while (seq.length && i === seq[seq.length - 1]); return i; }
function spawnBf() {
  let p, k = 0;
  do { p = {x: rnd(80, W - 80), y: rnd(200, H - 120)}; } while ((dist(p, S.p.a) < 260 || dist(p, S.p.d) < 260) && ++k < 60);
  const hues = [[246, 179, 201], [184, 214, 255], [255, 213, 154], [201, 184, 255]];
  S.items.push({id: S.aux.id++, x: p.x, y: p.y, vx: 0, vy: 0, wa: rnd(0, TAU), c: hues[S.aux.spawned % 4], got: 0});
  S.aux.spawned++;
}

/* ============ Spielablauf (Gastgeber) ============ */
function newState() {
  return {phase: 'card', card: 'welcome', lv: -1, t: 0, sid: 0, items: [], aux: {}, count: 0, total: 0, cur: 0,
    ready: {a: 0, d: 0}, bannerT: 0, done: 0, finT: 0, lt: 0, stars: [], startLv: 0, quiz: null,
    p: {a: mkP(W * .35), d: mkP(W * .65)}};
}
function mkP(x) { return {x, y: H * .9, lit: 1, inv: 2, out: 0, carry: 0}; }
function setupLevel(n) {
  Object.assign(S, {phase: 'play', lv: n, items: [], aux: {}, count: 0, total: 0, cur: 0, ready: {a: 0, d: 0},
    bannerT: S.t + 4.2, done: 0, finT: 0, lt: S.t, quiz: null});
  S.sid++;
  S.p.a = mkP(W * .35); S.p.d = mkP(W * .65);
  LV[n].setup();
  save(n);
}
function update(dt) {
  S.t += dt;
  for (const k of ['a', 'd']) if (S.p[k].inv > 0) S.p[k].inv = Math.max(0, S.p[k].inv - dt);
  if (S.phase === 'play' && !S.done) LV[S.lv].update(dt);
  if (S.phase === 'play' && S.done && S.t >= S.finT) {
    S.done = 0; S.ready = {a: 0, d: 0};
    if (S.lv >= LV.length - 1) { S.phase = 'end'; save(0); }
    else { S.phase = 'card'; S.card = LV[S.lv + 1].w !== LV[S.lv].w ? 'world' : 'level'; }
  }
  if (S.phase === 'quiz' && S.quiz.reveal && S.t > S.quiz.revealT) {
    const Q = S.quiz;
    if (Q.i + 1 < Q.n) { Q.i++; Q.asker = OTH(Q.asker); Q.pick = {a: -1, d: -1}; Q.reveal = 0; }
    else setupLevel(Q.next);
  }
}
function checkReady() {
  if (S.phase !== 'card' || !S.ready.a || !S.ready.d) return;
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
function restartLevel() { if (S && S.phase === 'play') setupLevel(S.lv); }
function save(lv) { try { localStorage.setItem('zl2-save', JSON.stringify({lv, stars: S.stars})); } catch (e) {} }
function loadSave() { try { return JSON.parse(localStorage.getItem('zl2-save')) || null; } catch (e) { return null; } }

/* ============ Audio & Effekte ============ */
let ac = null, muted = false;
try { muted = localStorage.getItem('zl-mute') === '1'; } catch (e) {}
function setMuteUI() { $('mute').textContent = '♪'; $('mute').style.opacity = muted ? .35 : 1; $('mute').style.textDecoration = muted ? 'line-through' : 'none'; }
setMuteUI();
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(f, dur = .6, vol = .07, type = 'sine', delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + .05);
}
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
const SHELL_NOTES = [392, 493.88, 587.33, 698.46, 783.99, 987.77];
$('mute').addEventListener('click', () => { muted = !muted; setMuteUI(); try { localStorage.setItem('zl-mute', muted ? '1' : '0'); } catch (e) {} });
addEventListener('pointerdown', audio, {passive: true});
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
function emit(e) { outEv.push(e); fx(e); }
function burst(x, y, c, n, sp = 140, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rnd(.25, 1) * sp;
    parts.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, d: rnd(.6, 1.3), c, s: rnd(.5, 1) * size});
  }
}
function fx(e) {
  const c = COL[e.o] || CG, mineEv = e.o === me;
  switch (e.k) {
    case 'chime': case 'bubble': tone(NOTES[(Math.random() * 6) | 0] * (e.o === 'd' ? .5 : 1), .7); burst(e.x, e.y, e.k === 'bubble' ? [190, 235, 255] : c, 12); if (mineEv) buzz(12); break;
    case 'meteor': tone(NOTES[(Math.random() * 5 + 3) | 0], .9, .06); burst(e.x, e.y, c, 16, 180); if (mineEv) buzz(15); break;
    case 'gold': case 'catch': case 'pearl': case 'find':
      tone(659.25, .8); tone(987.77, 1, .06, 'sine', .09); burst(e.x, e.y, CA, 14, 170); burst(e.x, e.y, CG, 14, 130); buzz(25); break;
    case 'tick': tone(e.o === 'd' ? 392 : 523.25, .25, .04, 'triangle'); break;
    case 'open': tone(e.o === 'd' ? 330 : 440, .35, .05, 'triangle'); burst(e.x, e.y, c, 8, 80); break;
    case 'gate': tone(294, .4, .05, 'triangle'); tone(440, .5, .04, 'triangle', .08); break;
    case 'note': tone(SHELL_NOTES[e.i] || 440, .7, .09); tone((SHELL_NOTES[e.i] || 440) * 2, .5, .02, 'sine'); burst(e.x, e.y, c, 14, 150); break;
    case 'round': [523.25, 659.25, 783.99].forEach((f, i) => tone(f, .8, .05, 'sine', i * .09)); break;
    case 'wrong': tone(233, .5, .06, 'triangle'); tone(196, .7, .05, 'triangle', .15); buzz([30, 50, 30]); break;
    case 'pick': tone(e.o === 'd' ? 440 : 587.33, .35, .05); burst(e.x, e.y, c, 8, 90); break;
    case 'plant': tone(392, .4, .05, 'triangle'); burst(e.x, e.y, [170, 130, 90], 10, 90); break;
    case 'bloom': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 1, .045, 'sine', i * .07)); burst(e.x, e.y, CA, 16, 170); burst(e.x, e.y, [190, 240, 170], 12, 140); buzz(20); break;
    case 'fizz': tone(220, .5, .05, 'triangle'); tone(165, .6, .04, 'triangle', .08); burst(e.x, e.y, [150, 145, 170], 10, 70, 2); if (mineEv) buzz([20, 40, 20]); break;
    case 'relight': tone(587.33, .5, .05); tone(880, .7, .05, 'sine', .08); burst(e.x, e.y, CG, 18, 150); break;
    case 'star': tone(NOTES[(e.i - 1) % 8] * (e.i > 8 ? 1.5 : 1), 1.1, .06); burst(e.x, e.y, c, 16, 150); if (mineEv) buzz(15); break;
    case 'flame': tone(698.46, .35, .04); burst(e.x, e.y, [255, 190, 110], 8, 80); break;
    case 'puff': tone(196, .35, .04, 'triangle'); burst(e.x, e.y, [140, 130, 150], 8, 60, 2); break;
    case 'lantern': tone(NOTES[(Math.random() * 8) | 0], 1, .06); burst(e.x, e.y, [255, 196, 120], 18, 160); if (mineEv) buzz(15); break;
    case 'pairlit': tone(NOTES[Math.min(7, e.i - 1)], 1.3, .06); tone(NOTES[Math.min(7, e.i - 1)] * 1.5, 1.3, .03); burst(e.x, e.y, CA, 16, 170); burst(W - e.x, e.y, CD, 16, 170); buzz(20); break;
    case 'win': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 1.4, .05, 'sine', i * .11)); burst(e.x, e.y, CG, 40, 320, 3.5); burst(e.x, e.y, CA, 30, 260); burst(e.x, e.y, CD, 30, 260); break;
  }
}

/* ============ Eingabe ============ */
const keys = new Set();
const KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'];
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (KEYS.includes(k)) { keys.add(k); e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let drag = null;
function speedMul() {
  if (!S || !S.p[me]) return 1;
  const p = S.p[me], L = S.phase === 'play' ? LV[S.lv] : null;
  return (p.lit ? 1 : .45) * (L && L.speed ? L.speed(p) : 1);
}
const cv = $('cv'), ctx = cv.getContext('2d');
cv.addEventListener('pointerdown', e => { drag = {id: e.pointerId, x: e.clientX, y: e.clientY}; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  pend.x += (e.clientX - drag.x) * 1.25 / sc; pend.y += (e.clientY - drag.y) * 1.25 / sc;
  const l = Math.hypot(pend.x, pend.y); if (l > 110) { pend.x *= 110 / l; pend.y *= 110 / l; }
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

function collide(p, rects) {
  for (const r of rects) {
    const cx = clamp(p.x, r[0], r[0] + r[2]), cy = clamp(p.y, r[1], r[1] + r[3]);
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d >= R) continue;
    if (d > .001) { p.x = cx + dx / d * R; p.y = cy + dy / d * R; }
    else if (p.y - r[1] < r[1] + r[3] - p.y) p.y = r[1] - R; else p.y = r[1] + r[3] + R;
  }
}
function moveMine(dt) {
  const vm = VMAX * speedMul() * dt;
  const l = Math.hypot(pend.x, pend.y);
  if (l > 0) { const k = Math.min(1, vm / l); mine.x += pend.x * k; mine.y += pend.y * k; pend.x -= pend.x * k; pend.y -= pend.y * k; }
  let kx = 0, ky = 0;
  if (keys.has('arrowleft') || keys.has('a')) kx--;
  if (keys.has('arrowright') || keys.has('d')) kx++;
  if (keys.has('arrowup') || keys.has('w')) ky--;
  if (keys.has('arrowdown') || keys.has('s')) ky++;
  if (kx || ky) { const m = Math.hypot(kx, ky), v = vm * .85; mine.x += kx / m * v; mine.y += ky / m * v; }
  const L = S.phase === 'play' ? LV[S.lv] : null;
  if (L && L.force && !S.done) { const f = L.force(mine, S.t); mine.x += f.x * dt; mine.y += f.y * dt; }
  mine.x = clamp(mine.x, R, W - R); mine.y = clamp(mine.y, R + 10, H - R);
  if (L && L.walls) collide(mine, L.walls());
}

/* ============ Netzwerk ============ */
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({length: 4}, () => ALPH[(Math.random() * ALPH.length) | 0]).join('');
const PID = c => 'zwei-lichter-reise-' + c;
const OVS = ['ovStart', 'ovHost', 'ovGuest', 'ovLost'];
const show = id => OVS.forEach(o => $(o).hidden = o !== id);
const hideAll = () => OVS.forEach(o => $(o).hidden = true);
const rounder = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v;
let wakeLock = null;
async function wake() { try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && loopOn) wake(); });
function noPeer() { if (window.Peer) return false; alert('Die Verbindungs-Bibliothek konnte nicht geladen werden. Bitte Seite neu laden.'); return true; }
let startLv = 0;

function hostStart() {
  if (noPeer()) return;
  role = 'host'; me = 'd'; other = 'a';
  show('ovHost');
  const sv = loadSave();
  if (sv && sv.lv > 0 && LV[sv.lv]) {
    startLv = sv.lv;
    $('hCont').hidden = false;
    $('hResume').textContent = `Weiter: ${LV[sv.lv].n}`;
    const pickStart = (lv) => { startLv = lv; $('hResume').className = 'btn ' + (lv ? 'sel' : 'ghost'); $('hFresh').className = 'btn ' + (lv ? 'ghost' : 'sel'); if (S && S.phase === 'card' && S.card === 'welcome') S.startLv = lv; };
    $('hResume').onclick = () => pickStart(sv.lv); $('hFresh').onclick = () => pickStart(0);
  }
  const code = genCode(); lastCode = code;
  $('hStatus').innerHTML = '<span class="dots">Raum wird geöffnet</span>'; $('hStatus').className = 'status';
  peer = new Peer(PID(code), {debug: 0});
  peer.on('open', () => {
    $('hCode').textContent = code;
    const link = location.origin + location.pathname + '?raum=' + code;
    $('hWa').href = 'https://wa.me/?text=' + encodeURIComponent(`${nm('a')}, komm spielen 💛 ${link}`);
    $('hShare').onclick = async () => { try { if (navigator.share) await navigator.share({title: 'Zwei Lichter', text: `${nm('a')}, komm spielen 💛`, url: link}); else copy(link); } catch (e) {} };
    $('hCopy').onclick = () => copy(link);
    $('hStatus').innerHTML = `<span class="dots">Warte auf ${nm('a')}</span>`;
    $('lText').textContent = `${nm('a')} kann einfach den Link nochmal öffnen oder den Code ${code} eingeben. Das Spiel wartet hier auf sie.`;
  });
  peer.on('error', err => {
    if (err.type === 'unavailable-id') { peer.destroy(); hostStart(); return; }
    if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type)) { $('hStatus').innerHTML = '<span class="dots">Verbindung zum Server wird wiederhergestellt</span>'; return; }
    $('hStatus').textContent = 'Fehler: ' + err.type; $('hStatus').className = 'status err';
  });
  peer.on('disconnected', () => { setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 1000); });
  peer.on('connection', c => {
    c.on('open', () => {
      if (conn && conn !== c) { try { conn.close(); } catch (e) {} }
      conn = c;
      if (!S) { S = newState(); S.startLv = startLv; const sv2 = loadSave(); if (sv2 && sv2.stars && startLv) S.stars = sv2.stars; }
      hideAll(); startLoop();
    });
    c.on('data', d => {
      if (c !== conn || !S || !d) return;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
      if (d.t === 'pos') { if (d.sid === S.sid) { S.p[other].x = d.x; S.p[other].y = d.y; } }
      else if (d.t === 'ready') { if (d.key === S.phase + ':' + S.card + ':' + S.lv) { S.ready[other] = 1; checkReady(); } }
      else if (d.t === 'pick') { if (S.quiz && d.key === quizKey() && S.quiz.pick[other] < 0 && !S.quiz.reveal) { S.quiz.pick[other] = d.v; checkQuiz(); } }
      else if (d.t === 'restart') restartLevel();
    });
    c.on('close', () => { if (c === conn) { conn = null; lost(); } });
    c.on('error', () => {});
  });
}
function copy(t) {
  const done = () => { $('hCopy').textContent = 'Kopiert ✓'; setTimeout(() => $('hCopy').textContent = 'Kopieren', 1800); };
  try { navigator.clipboard.writeText(t).then(done, () => prompt('Link kopieren:', t)); } catch (e) { prompt('Link kopieren:', t); }
}
function guestJoin() {
  if (noPeer()) return;
  const code = $('gCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { gStatus('Der Code hat 4 Zeichen.', true); return; }
  role = 'guest'; me = 'a'; other = 'd'; lastCode = code;
  gStatus('<span class="dots">Verbinde</span>');
  $('gJoin').disabled = true;
  if (!peer || peer.destroyed) {
    peer = new Peer({debug: 0});
    peer.on('open', () => connectTo(lastCode));
    peer.on('error', err => {
      $('gJoin').disabled = false; $('lRe').disabled = false;
      const msg = err.type === 'peer-unavailable' ? `Raum nicht gefunden. Ist ${nm('d')} schon im Raum? Code prüfen.` : 'Verbindung klappt gerade nicht (' + err.type + '). Nochmal versuchen.';
      gStatus(msg, true); $('lStatus').textContent = msg;
    });
    peer.on('disconnected', () => { setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 1000); });
  } else connectTo(code);
}
function gStatus(h, err) { $('gStatus').innerHTML = h; $('gStatus').className = 'status' + (err ? ' err' : ''); }
function connectTo(code) {
  const c = peer.connect(PID(code), {reliable: true, serialization: 'json'});
  conn = c;
  const slow = setTimeout(() => { if (!c.open) gStatus('<span class="dots">Dauert etwas länger</span>'); }, 7000);
  c.on('open', () => { clearTimeout(slow); hideAll(); startLoop(); $('gJoin').disabled = false; });
  c.on('data', d => {
    if (c !== conn || !d) return;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (d.t !== 's') return;
    S = d.s;
    if (readyKey && readyKey === S.phase + ':' + S.card + ':' + S.lv) S.ready[me] = 1;
    if (pickMemo && S.quiz && pickMemo.key === quizKey() && S.quiz.pick[me] < 0) S.quiz.pick[me] = pickMemo.v;
    if (d.ev) d.ev.forEach(fx);
  });
  c.on('close', () => { if (c === conn) { conn = null; lost(); } });
  c.on('error', () => {});
}
function lost() {
  $('ovLost').hidden = false;
  if (role === 'guest') { $('lText').textContent = `Die Verbindung zu ${nm('d')} ist kurz weg. Kein Problem – einfach neu verbinden.`; $('lRe').hidden = false; $('lRe').disabled = false; $('lStatus').textContent = ''; }
  else $('lRe').hidden = true;
}
$('lRe').onclick = () => {
  $('lRe').disabled = true; $('lStatus').innerHTML = '<span class="dots">Verbinde</span>';
  if (peer && !peer.destroyed && peer.open) connectTo(lastCode);
  else { try { peer && peer.destroy(); } catch (e) {} peer = null; $('gCode').value = lastCode; guestJoin(); }
  setTimeout(() => { if (!(conn && conn.open)) $('lRe').disabled = false; }, 6000);
};
$('bHost').onclick = () => { audio(); hostStart(); };
$('bGuest').onclick = () => { audio(); show('ovGuest'); setTimeout(() => $('gCode').focus(), 50); };
$('gJoin').onclick = () => { audio(); guestJoin(); };
$('gCode').addEventListener('keydown', e => { if (e.key === 'Enter') { audio(); guestJoin(); } });
$('gCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
$('rst').onclick = () => {
  if (!S || S.phase !== 'play') return;
  if (!confirm('Dieses Level für euch beide neu starten?')) return;
  if (role === 'host') restartLevel(); else if (conn && conn.open) conn.send({t: 'restart'});
};
const qs = new URLSearchParams(location.search).get('raum');
if (qs) {
  $('gCode').value = qs.toUpperCase().slice(0, 4);
  $('gKick').textContent = 'Für dich';
  $('gTitle').textContent = `Hallo ${nm('a')} ✨`;
  $('gSub').textContent = `${nm('d')} wartet schon im Raum auf dich.`;
  show('ovGuest');
}

/* ============ Karten, Quiz & HUD ============ */
let cardKey = '';
const quizKey = () => S.quiz ? `${S.quiz.base}:${S.quiz.i}` : '';
const starsHTML = n => `<div class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></div>`;
function buildCard() {
  const box = $('cardBox');
  const legend = `<div class="legend"><span><i style="background:var(--a)"></i>${nm('a')}</span><span><i style="background:var(--d)"></i>${nm('d')}</span></div>`;
  let html = '';
  if (S.phase === 'quiz') { buildQuiz(box); return; }
  if (S.phase === 'end') {
    const tot = S.stars.reduce((s, v) => s + (v || 0), 0);
    html = `<p class="kicker">Alle vier Welten geschafft</p><h2>${CFG.finale.title}</h2>
      <p class="msg">${CFG.finale.text}</p><p class="sign">${CFG.finale.sign}</p>
      <p class="time">Eure Sterne: <b style="color:var(--gold)">${tot} von ${LV.length * 3}</b></p>
      ${role === 'host' ? '<button class="btn" id="cBtn">Nochmal spielen</button>' : `<p class="hint">${nm('d')} kann jederzeit eine neue Runde starten.</p>`}`;
  } else if (S.card === 'welcome') {
    const resume = (S.startLv || 0) > 0;
    html = `<p class="kicker">Ihr seid verbunden 💛</p><h2>${resume ? 'Willkommen zurück' : 'Hallo ' + nm('a')}</h2>
      <p class="msg">${resume ? `Weiter geht's mit „${LV[S.startLv].n}“.` : CFG.welcome}</p>${legend}
      <p class="hint">Wisch irgendwo auf dem Bildschirm, um dein Licht zu bewegen. Am Computer gehen auch die Pfeiltasten. Je schneller ihr seid, desto mehr Sterne bekommt ihr.</p>
      <button class="btn" id="cBtn">Ich bin bereit</button><p class="ready" id="cReady"></p>`;
  } else {
    const L = LV[S.lv], w = L.w;
    html = `<p class="kicker">${WORLDS[w].n} · ${L.n}</p>${starsHTML(S.lastStars || 1)}<p class="time">geschafft in ${fmt(S.lastTime || 0)}</p>
      <p class="msg">${CFG.lines[S.lv] || ''}</p>`;
    if (S.card === 'world') {
      const Wc = CFG.worlds[w] || {};
      html += `<div class="q"><small>Welt ${w + 1} geschafft</small><p>${Wc.msg || ''}</p></div>`;
      if (Wc.question) html += `<div class="q"><small>Kleine Frage an euch beide</small><p>${Wc.question}</p></div>`;
    }
    html += `<button class="btn" id="cBtn">Weiter</button><p class="ready" id="cReady"></p>`;
  }
  box.innerHTML = html;
  const b = $('cBtn');
  if (b) b.onclick = () => {
    audio();
    if (S.phase === 'end') { if (role === 'host') { S.stars = []; setupLevel(0); } return; }
    S.ready[me] = 1; readyKey = S.phase + ':' + S.card + ':' + S.lv;
    if (role === 'host') checkReady(); else if (conn && conn.open) conn.send({t: 'ready', key: readyKey});
  };
}
function buildQuiz(box) {
  const Q = S.quiz, pair = CFG.quiz[Q.base + Q.i] || ['Ja', 'Nein'], asker = Q.asker, iAsk = asker === me, my = Q.pick[me];
  let html = `<p class="kicker">Dies oder Das · ${Q.i + 1}/${Q.n}</p><h2>${iAsk ? 'Was nimmst du?' : `Was nimmt ${nm(asker)}?`}</h2>
    <p class="sub">${iAsk ? `${nm(OTH(asker))} versucht, dich zu erraten.` : `Tipp, was ${nm(asker)} wählen würde.`}</p>`;
  if (!Q.reveal) {
    html += `<div class="opts">${pair.map((o, i) => `<button class="opt${my === i ? ' sel' : ''}" data-v="${i}" ${my >= 0 ? 'disabled' : ''}>${o}</button>`).join('')}</div>
      <p class="ready">${my >= 0 ? `<span class="dots">Warte auf ${nm(other)}</span>` : ''}</p>`;
  } else {
    const ans = Q.pick[asker], g = Q.pick[OTH(asker)], hit = ans === g;
    html += `<div class="reveal"><p>${nm(asker)} nimmt <b>${pair[ans]}</b></p><p>${nm(OTH(asker))} tippte <b>${pair[g]}</b></p>
      <p class="res">${hit ? 'Volltreffer 💛' : 'Knapp daneben 😄'}</p></div>`;
    if (Q.i === Q.n - 1) html += `<p class="sub">Ihr kennt euch: <b style="color:var(--gold)">${Q.score} von ${Q.n}</b></p>`;
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
function syncUI() {
  if (!S) return;
  $('hud').hidden = false;
  const inCard = S.phase === 'card' || S.phase === 'end' || S.phase === 'quiz';
  $('ovCard').hidden = !inCard;
  $('ovCard').classList.toggle('bottom', S.phase === 'end');
  if (inCard) {
    const key = S.phase === 'quiz' ? `q:${quizKey()}:${S.quiz.reveal}:${S.quiz.pick[me]}` : `${S.phase}:${S.card}:${S.lv}`;
    if (key !== cardKey) { cardKey = key; buildCard(); }
    const b = $('cBtn'), r = $('cReady');
    if (b && S.phase === 'card') {
      b.disabled = !!S.ready[me];
      const t = S.ready[me] ? `Warte auf ${nm(other)}…` : (S.card === 'welcome' ? 'Ich bin bereit' : S.card === 'world' ? 'Weiter zu „Dies oder Das“' : 'Weiter');
      if (b.textContent !== t) b.textContent = t;
    }
    if (r && S.phase === 'card') { const h = S.ready[other] ? `<b>${nm(other)}</b> ist bereit ✓` : `<span class="dots">${nm(other)} liest noch</span>`; if (r.innerHTML !== h) r.innerHTML = h; }
  } else cardKey = '';
  const L = S.lv >= 0 ? LV[S.lv] : null;
  const lvT = S.phase === 'quiz' ? 'Dies oder Das' : L ? `${S.lv + 1}/12 · ${L.n}` : 'Willkommen';
  if ($('lvl').textContent !== lvT) $('lvl').textContent = lvT;
  const playing = S.phase === 'play' && L;
  const cT = playing ? `${L.ic} ${S.count}/${S.total}` : '';
  if ($('cnt').textContent !== cT) $('cnt').textContent = cT;
  $('cnt').style.display = cT ? '' : 'none';
  const el = playing ? (S.done ? S.doneAt : S.t) - S.lt : 0;
  const tT = playing ? fmt(el) : '';
  if ($('tmr').textContent !== tT) $('tmr').textContent = tT;
  $('tmr').style.display = tT ? '' : 'none';
  $('tmr').style.color = playing ? (el <= L.t3 ? 'var(--gold)' : el <= L.t2 ? 'var(--ink)' : 'var(--mute)') : '';
  $('rst').style.display = playing ? '' : 'none';
  $('net').classList.toggle('off', !(conn && conn.open));
  const showB = playing && S.t < S.bannerT;
  $('banner').classList.toggle('show', !!showB);
  if (showB && $('bT').textContent !== L.n) {
    $('bK').textContent = `Welt ${L.w + 1} · ${WORLDS[L.w].n}`; $('bT').textContent = L.n; $('bP').textContent = L.h(me);
  }
  if (role === 'host' && conn && conn.open && !$('ovLost').hidden) $('ovLost').hidden = true;
}

/* ============ Zeichnen ============ */
let cw = 0, ch = 0, dpr = 1, sc = 1, ox = 0, oy = 0, amb = {};
const fog = document.createElement('canvas'), fctx = fog.getContext('2d');
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = innerWidth; ch = innerHeight;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  fog.width = cv.width; fog.height = cv.height;
  sc = Math.min((cw - 12) / W, (ch - HUDH - 10) / H);
  ox = (cw - W * sc) / 2; oy = HUDH + (ch - HUDH - 10 - H * sc) / 2;
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
  if (!S) return 'nacht';
  if (S.phase === 'quiz') return WORLDS[LV[S.quiz.next].w].th;
  const lv = S.lv >= 0 ? S.lv : (S.startLv || 0);
  return WORLDS[LV[lv].w].th;
}
function drawBg(th, t) {
  const pal = {nacht: ['#0b0a1c', '#15112e', '#231a3d'], meer: ['#03182a', '#062f47', '#0b4558'], garten: ['#0c1a1a', '#16302a', '#2f3f30'], laternen: ['#120b1f', '#27122d', '#47202f']}[th];
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, pal[0]); bg.addColorStop(.6, pal[1]); bg.addColorStop(1, pal[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
  if (th === 'nacht') {
    for (const s of amb.stars) { ctx.globalAlpha = .35 + .45 * (.5 + .5 * Math.sin(t * s.s + s.p)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
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
    ctx.fillStyle = 'rgba(8,18,14,.85)';
    ctx.beginPath(); ctx.moveTo(0, ch);
    for (const b of amb.blades) { const sw = Math.sin(t * 1.2 + b.p) * 3; ctx.lineTo(b.x + sw, ch - b.h); ctx.lineTo(b.x + 3.5, ch); }
    ctx.lineTo(cw, ch); ctx.fill();
  } else if (th === 'laternen') {
    for (const b of amb.bokeh) {
      const y = ((b.y - t * b.s) % ch + ch) % ch, x = b.x + Math.sin(t * .2 + b.p) * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r); g.addColorStop(0, rgba(b.c, .16)); g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function glow(x, y, r, c, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function dotW(x, y, r) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function label(txt, x, y, c, size = 15) {
  ctx.font = `600 ${size}px Karla, system-ui, sans-serif`; ctx.textAlign = 'center';
  ctx.fillStyle = rgba(c, .95); ctx.fillText(txt, x, y);
}
function line2(a, b, al) {
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, rgba(COL[a.o] || CG, al)); g.addColorStop(1, rgba(COL[b.o] || CG, al));
  ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
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
function player(k, x, y, p, t) {
  const c = COL[k], lit = p ? p.lit : 1;
  const fl = lit ? 1 + Math.sin(t * 7 + (k === 'a' ? 0 : 2)) * .05 + Math.sin(t * 13) * .03 : .6;
  if (lit) { glow(x, y, 80 * fl, c, .36); glow(x, y, 34 * fl, c, .55); } else glow(x, y, 28, [120, 115, 140], .3);
  if (p && p.inv > 0 && lit && S.phase === 'play') { ctx.beginPath(); ctx.arc(x, y, R + 9, 0, TAU); ctx.strokeStyle = rgba(CG, .25 + .2 * Math.sin(t * 10)); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x, y, R * .62, 0, TAU);
  ctx.fillStyle = lit ? '#fffaf3' : '#5d5872'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = lit ? rgba(c, 1) : 'rgba(150,145,170,.7)'; ctx.stroke();
  if (k === me) { ctx.beginPath(); ctx.arc(x, y, R + 5, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(c, .35); ctx.stroke(); }
  label(nm(k), x, y + R + 24, lit ? c : [150, 145, 170], 16);
  const L = S && S.phase === 'play' ? LV[S.lv] : null;
  if (!lit) label((L && L.stun) || 'erloschen', x, y - R - 12, [225, 220, 240], 13);
  if (p && p.carry && L) {
    if (L.n === 'Säen & Gießen') {
      if (k === 'a') { ctx.fillStyle = '#c99a6a'; [-6, 0, 6].forEach(o => { ctx.beginPath(); ctx.ellipse(x + o, y - R - 12, 3, 4.5, 0, 0, TAU); ctx.fill(); }); }
      else { ctx.fillStyle = 'rgba(150,210,255,.95)'; ctx.beginPath(); ctx.moveTo(x, y - R - 24); ctx.quadraticCurveTo(x + 9, y - R - 10, x, y - R - 6); ctx.quadraticCurveTo(x - 9, y - R - 10, x, y - R - 24); ctx.fill(); }
    } else if (L.n === 'Flammenstaffel') {
      flame(x, y - R - 14, .9, t);
      ctx.beginPath(); ctx.arc(x, y, R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.carry / S.aux.FL, 0, 1));
      ctx.strokeStyle = 'rgba(255,190,110,.9)'; ctx.lineWidth = 3; ctx.stroke();
    }
  }
}
function drawFog(pos, vis) {
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, fog.width, fog.height);
  fctx.fillStyle = 'rgba(6,4,14,.92)'; fctx.fillRect(0, 0, fog.width, fog.height);
  fctx.globalCompositeOperation = 'destination-out';
  for (const k of ['a', 'd']) {
    const x = (ox + pos[k].x * sc) * dpr, y = (oy + pos[k].y * sc) * dpr, r = vis * sc * dpr;
    const g = fctx.createRadialGradient(x, y, r * .3, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = g; fctx.beginPath(); fctx.arc(x, y, r, 0, TAU); fctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fog, 0, 0);
  ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
}
function render(t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBg(theme(), t);
  if (!S) return;
  ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
  ctx.fillStyle = 'rgba(255,255,255,.02)'; ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, W, H, 28) : ctx.rect(0, 0, W, H); ctx.fill(); ctx.stroke();
  const pos = {}; pos[me] = {x: mine.x, y: mine.y}; pos[other] = {x: ghost.x, y: ghost.y};
  const L = S.lv >= 0 && (S.phase === 'play' || S.phase === 'end' || S.phase === 'card') ? LV[S.lv] : null;
  if (L && S.items) { try { L.draw(t, pos); } catch (e) { console.error(e); } }
  const A = pos.a, D = pos.d, dd = dist(A, D), near = clamp(1 - dd / 170, 0, 1);
  if (near > 0 && S.p.a.lit && S.p.d.lit) {
    const g = ctx.createLinearGradient(A.x, A.y, D.x, D.y);
    g.addColorStop(0, rgba(CA, .6 * near)); g.addColorStop(1, rgba(CD, .6 * near));
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo((A.x + D.x) / 2, (A.y + D.y) / 2 + Math.sin(t * 2) * 10, D.x, D.y); ctx.stroke();
  }
  if (L && L.fog && S.phase === 'play') drawFog(pos, L.fog);
  player(other, ghost.x, ghost.y, S.p[other], t);
  player(me, mine.x, mine.y, S.p[me], t);
  if (S.phase === 'end') skyLanterns(t);
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = rgba(p.c, 1); ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.5 + p.life * .5), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function skyLanterns(t) {
  if (!local.sky) { local.sky = []; for (let i = 0; i < 18; i++) local.sky.push({x: rnd(30, W - 30), y: rnd(H, H + 900), s: rnd(35, 70), p: rnd(0, TAU), c: i % 2 ? CA : [255, 190, 120]}); }
  for (const l of local.sky) {
    l.y -= l.s * .016; if (l.y < -60) l.y = H + 60;
    const x = l.x + Math.sin(t * .6 + l.p) * 12;
    glow(x, l.y, 34, l.c, .35);
    ctx.fillStyle = rgba(l.c, .85); ctx.beginPath(); ctx.ellipse(x, l.y, 8, 11, 0, 0, TAU); ctx.fill();
  }
}
function stepParts(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy = p.vy * .96 + 30 * dt; p.life -= dt / p.d; }
  parts = parts.filter(p => p.life > 0);
}

/* ============ Schleife ============ */
let last = performance.now(), netT = 0, loopOn = false;
function startLoop() { wake(); if (loopOn) return; loopOn = true; last = performance.now(); requestAnimationFrame(frame); }
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (S) {
    if (S.sid !== lastSid) {
      lastSid = S.sid; local = {}; pend.x = pend.y = 0;
      mine.x = S.p[me].x; mine.y = S.p[me].y; ghost.x = S.p[other].x; ghost.y = S.p[other].y;
    }
    moveMine(dt);
    netT += dt;
    if (role === 'host') {
      S.p[me].x = mine.x; S.p[me].y = mine.y;
      update(dt);
      if (netT > .05) {
        netT = 0;
        if (conn && conn.open) { try { conn.send(JSON.stringify({t: 's', s: S, ev: outEv}, rounder)); } catch (e) {} }
        outEv = [];
      }
    } else if (netT > .033) {
      netT = 0;
      if (conn && conn.open) { try { conn.send({t: 'pos', x: Math.round(mine.x * 10) / 10, y: Math.round(mine.y * 10) / 10, sid: S.sid}); } catch (e) {} }
    }
    const tgt = S.p[other], k = Math.min(1, dt * 14);
    ghost.x += (tgt.x - ghost.x) * k; ghost.y += (tgt.y - ghost.y) * k;
    if (S.phase !== 'end' && local.sky) local.sky = null;
  }
  stepParts(dt);
  render(now / 1000);
  syncUI();
  requestAnimationFrame(frame);
}
(function idle(now) { if (loopOn) return; render(now / 1000); requestAnimationFrame(idle); })(performance.now());
})();
