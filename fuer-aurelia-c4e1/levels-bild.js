/* Zwei Lichter – „Unser Bild“ (ab 8.3)
   Das eigene Spiel für eure beiden Fotos. Jedes Bild liegt in zwei Hälften zerlegt da:
   Aurelia trägt die Teile der linken Hälfte an ihren Platz, Daniel die der rechten.
   Solange die Hälften getrennt sind, bleibt alles verschwommen. Erst wenn ihr sie – wie beim Herz –
   Stern für Stern gemeinsam zusammennäht, wird das Bild scharf. Zum Schluss verbinden sich beide Bilder. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, W, R, TAU, COL, CA, CD, CG, rgba, dist, rnd, clamp, nm, emit, finish, glow, dotW, label, heartPath} = API;
const FOTO = window.ZL_FOTO, KEYS = ['m2', 'm1'];
const PW = 420, PH = 560, CX = W / 2, PY = 98, NC = 4, NR = 4, TW = PW / NC, TH = PH / NR, GAP = 40, STEPS = 5, GS = .47;
const halfX = (right, gap) => right ? CX + gap * GAP / 2 : CX - PW / 2 - gap * GAP / 2;
const slot = (it, gap) => ({x: halfX(it.c > 1, gap) + ((it.c % 2) + .5) * TW, y: PY + (it.r + .5) * TH});
/* Nahtstellen: von unten nach oben je ein Sternenpaar links und rechts der Lücke, zuletzt die Mitte gemeinsam */
const stitch = (i, gap) => i < 4
  ? {a: {x: halfX(0, gap) + PW / 2 - 34, y: PY + (3.5 - i) * TH}, d: {x: halfX(1, gap) + 34, y: PY + (3.5 - i) * TH}}
  : {g: {x: CX, y: PY + PH / 2}};
function startRound(r) {
  const A = S.aux, key = KEYS[r], pre = clamp(Math.round(((S.memo || {})[key] || 0) * 3), 0, 3);
  S.items = [];
  for (const o of ['a', 'd']) {
    const cells = []; for (let rr = 0; rr < NR; rr++) for (let c = 0; c < 2; c++) cells.push([c + (o === 'd' ? 2 : 0), rr]);
    cells.sort(() => Math.random() - .5);
    cells.forEach(([c, rr], i) => {
      // was ihr unterwegs schon gesammelt habt, liegt bereits an seinem Platz
      const placed = i < pre;
      let x, y, k = 0; do { x = rnd(46, W - 46); y = rnd(752, 936); } while (++k < 60 && (S.items.some(q => q.st === 0 && Math.hypot(q.x - x, q.y - y) < 60) || Math.hypot(x - W * .35, y - 900) < 60 || Math.hypot(x - W * .65, y - 900) < 60));
      S.items.push({id: S.items.length, o, c, r: rr, x: Math.round(x), y: Math.round(y), rot: +rnd(-.3, .3).toFixed(2), st: placed ? 2 : 0});
      if (placed) S.count++;
    });
  }
  A.r = r; A.ph = 'sammeln'; A.cur = 0; A.gap = 1;
  A.gu = Array.from({length: r ? 3 : 2}, (_, i) => ({x: rnd(80, W - 80), y: 678 + i * 14, vx: (i % 2 ? -1 : 1) * (95 + i * 30 + r * 25) * API.diff()}));
}

const bild = {
  id: 'bild', n: 'Unser Bild', ic: '▣', t3: 150, t2: 230, isNew: true, fotos: ['m2', 'm1'], noDeco: true, amb: 1, get hidePlayers() { return !!S.done || S.aux.ph === 'zeigen'; },
  fx(e) { if (e.k === 'place') { API.tone(e.o === 'd' ? 659.25 : 880, .5, .05); API.tone(e.o === 'd' ? 987.77 : 1318.5, .5, .03, 'sine', .06); API.burst(e.x, e.y, COL[e.o], 10, 120, 2); if (e.o === API.me) API.buzz(14); } },
  skinName: () => `${nm('a')}: linke Hälfte · ${nm('d')}: rechte Hälfte`,
  h: () => `Zwei Bilder liegen in Stücken da – noch ganz verschwommen. ${nm('a')} trägt die rosa Teile in die linke Hälfte, ${nm('d')} die blauen in die rechte. Lauft einfach über ein Teil, um es aufzuheben, und bringt es zum leuchtenden Feld. Passt auf die Windstöße auf, sie reißen euch das Teil aus der Hand. Liegt alles, näht ihr die Hälften zusammen – wie beim Herz: gleichzeitig auf eure Sterne. Erst dann wird das Bild scharf.`,
  note: () => `Zwei Bilder, je zwei Hälften – verbunden in ${API.fmt(S.lastTime || (S.t - S.lt))}`,
  setup() { S.aux = {}; S.total = 2 * (16 + STEPS); S.count = 0; startRound(0); },
  update(dt) {
    const A = S.aux;
    if (A.ph === 'zeigen') { if (S.t > A.tRev && A.r === 0) { startRound(1); emit({k: 'toast', txt: 'Und jetzt das zweite Bild.'}); } return; }
    for (const g of A.gu) { g.x += g.vx * dt; if (g.x < 36 || g.x > W - 36) { g.vx *= -1; g.x = clamp(g.x, 36, W - 36); } }
    if (A.ph === 'sammeln') {
      for (const k of ['a', 'd']) {
        const p = S.p[k]; let car = S.items.find(it => it.o === k && it.st === 1);
        if (!car) { let best = null, bd = R + 24; for (const it of S.items) { if (it.o !== k || it.st !== 0) continue; const d = dist(p, it); if (d < bd) { bd = d; best = it; } } if (best) { best.st = 1; emit({k: 'dot', o: k}); } continue; }
        car.x = Math.round(p.x); car.y = Math.round(p.y);
        const s = slot(car, 1);
        if (dist(p, s) < 42) { car.st = 2; S.count++; emit({k: 'place', x: s.x, y: s.y, o: k}); continue; }
        if (p.inv <= 0) for (const g of A.gu) if (dist(p, g) < 36) {
          car.st = 0; car.x = Math.round(clamp(p.x + rnd(-150, 150), 52, W - 52)); car.y = Math.round(rnd(760, 930)); p.inv = 1.4;
          emit({k: 'fizz', x: p.x, y: p.y, o: k}); emit({k: 'toast', txt: `Ein Windstoß hat ${nm(k)}s Teil davongeweht.`}); break;
        }
      }
      if (S.items.every(it => it.st === 2)) { A.ph = 'naht'; A.cur = 0; emit({k: 'toast', txt: 'Alle Teile liegen. Jetzt näht ihr die Hälften zusammen – gleichzeitig auf eure Sterne.'}); }
    } else if (A.ph === 'naht') {
      const st = stitch(A.cur, A.gap), ok = st.g ? dist(S.p.a, st.g) < 54 && dist(S.p.d, st.g) < 54 : dist(S.p.a, st.a) < R + 26 && dist(S.p.d, st.d) < R + 26;
      if (!ok) return;
      const at = st.g || st.a; A.cur++; S.count++; A.gap = +(1 - A.cur / STEPS).toFixed(2);
      emit({k: 'pairlit', x: at.x, y: at.y, i: A.cur + (A.r ? 3 : 0)});
      if (A.cur >= STEPS) {
        A.ph = 'zeigen'; A.tRev = S.t + 4.6; emit({k: 'meet', x: CX, y: PY + PH / 2});
        if (A.r === 1) { emit({k: 'fireworks', dur: 7000}); finish(10.5); }
      }
    }
  },
  draw(t, pos) {
    const A = S.aux; if (A.r == null) return;
    const F = FOTO.get(KEYS[A.r]), soft = F.ready ? FOTO.soft(KEYS[A.r]) : null, sharp = F.ready ? FOTO.tone(KEYS[A.r]) : null, me = API.me;
    // ruhiger Hintergrund: ein dunkler Tisch, auf dem die Bilder liegen
    { const bg = ctx.createLinearGradient(0, 60, 0, 1000); bg.addColorStop(0, 'rgba(20,16,34,.82)'); bg.addColorStop(1, 'rgba(12,10,22,.9)'); ctx.fillStyle = bg; ctx.fillRect(0, 56, W, 944); }
    if (LOC.br !== A.r) { LOC.br = A.r; LOC.gap = 1; LOC.sharp = 0; }
    LOC.gap += (A.gap - LOC.gap) * .09; const gap = LOC.gap, joined = A.ph === 'zeigen';
    LOC.sharp = clamp(LOC.sharp + (joined ? .014 : -.05), 0, 1);
    const end = S.done ? clamp((t - (LOC.endT || (LOC.endT = t)) - 3.2) / 1.6, 0, 1) : 0, ee = end * end * (3 - 2 * end);
    const tile = (src, c, r, x, y, w, h) => { if (src) ctx.drawImage(src, c * F.w / NC, r * F.h / NR, F.w / NC, F.h / NR, x, y, w, h); };
    
    if (ee < 1) {
      ctx.save(); ctx.globalAlpha = 1 - ee;
      // die beiden Bildhälften mit ihren Feldern
      for (const right of [0, 1]) {
        const x0 = halfX(right, gap), c = COL[right ? 'd' : 'a'];
        ctx.fillStyle = 'rgba(12,9,26,.72)'; ctx.fillRect(x0, PY, PW / 2, PH);
        ctx.strokeStyle = rgba(c, .5 * gap + .12); ctx.lineWidth = 2; ctx.strokeRect(x0 - 1, PY - 1, PW / 2 + 2, PH + 2);
        ctx.strokeStyle = rgba(c, .16); ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
        for (let i = 1; i < NR; i++) { ctx.beginPath(); ctx.moveTo(x0, PY + i * TH); ctx.lineTo(x0 + PW / 2, PY + i * TH); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x0 + TW, PY); ctx.lineTo(x0 + TW, PY + PH); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const it of S.items) { if (it.st !== 2) continue; const s = slot(it, gap), x = s.x - TW / 2, y = s.y - TH / 2; tile(soft, it.c, it.r, x, y, TW + .6, TH + .6); if (LOC.sharp > 0 && sharp) { ctx.globalAlpha = LOC.sharp * (1 - ee); tile(sharp, it.c, it.r, x, y, TW + .6, TH + .6); ctx.globalAlpha = 1 - ee; } }
      // die Naht leuchtet auf, wenn die Hälften sich berühren
      if (joined && LOC.sharp < .85) { const a = Math.sin(LOC.sharp / .85 * Math.PI) * .6, gr = ctx.createLinearGradient(CX - 16, 0, CX + 16, 0); gr.addColorStop(0, 'rgba(243,201,143,0)'); gr.addColorStop(.5, `rgba(243,201,143,${a})`); gr.addColorStop(1, 'rgba(243,201,143,0)'); ctx.fillStyle = gr; ctx.fillRect(CX - 16, PY, 32, PH); }
      if (joined) { ctx.strokeStyle = rgba(CG, .7 * LOC.sharp); ctx.lineWidth = 3; ctx.strokeRect(CX - PW / 2 - 2, PY - 2, PW + 4, PH + 4); }
      ctx.restore();
    }
    if (!S.done) {
      // Zielfeld für das Teil, das ich gerade trage
      const car = S.items.find(it => it.o === me && it.st === 1);
      if (car) { const s = slot(car, gap), pul = .5 + .5 * Math.sin(t * 6); ctx.fillStyle = rgba(COL[me], .16 + .14 * pul); ctx.fillRect(s.x - TW / 2, s.y - TH / 2, TW, TH); ctx.strokeStyle = rgba(COL[me], .95); ctx.lineWidth = 3; ctx.strokeRect(s.x - TW / 2 + 1.5, s.y - TH / 2 + 1.5, TW - 3, TH - 3); glow(s.x, s.y, 60, COL[me], .25); }
      // Teile am Boden und in der Hand
      const pc = (it, x, y, sc, rot, hi) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const w = TW * sc, h = TH * sc; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8; ctx.fillStyle = '#1a1526'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.shadowBlur = 0; tile(soft, it.c, it.r, -w / 2, -h / 2, w, h); ctx.strokeStyle = rgba(COL[it.o], hi ? 1 : .8); ctx.lineWidth = hi ? 3 : 2; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.restore(); };
      for (const it of S.items) if (it.st === 0) { const mineIt = it.o === me && !car; if (mineIt) glow(it.x, it.y, 34 + Math.sin(t * 4 + it.id) * 4, COL[me], .22); pc(it, it.x, it.y, GS, it.rot, mineIt); }
      for (const it of S.items) if (it.st === 1) { const p = pos[it.o] || it; pc(it, p.x, p.y - 46, .4, Math.sin(t * 5) * .08, true); }
      // Windstöße
      for (const g of A.gu || []) { ctx.strokeStyle = 'rgba(200,220,255,.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const y = g.y - 10 + i * 10, o = Math.sin(t * 7 + i * 2 + g.y) * 6, d = Math.sign(g.vx); ctx.beginPath(); ctx.moveTo(g.x - d * 26 + o, y); ctx.quadraticCurveTo(g.x + o, y - 6, g.x + d * 22 + o, y); ctx.stroke(); } glow(g.x, g.y, 30, [200, 220, 255], .14); }
      // Nahtsterne
      if (A.ph === 'naht') {
        const st = stitch(A.cur, gap);
        if (st.g) { const pul = 1 + Math.sin(t * 4) * .1; glow(st.g.x, st.g.y, 66 * pul, CG, .4); ctx.fillStyle = rgba(CG, 1); heartPath(st.g.x, st.g.y, 15 * pul); ctx.fill(); label('zusammen', st.g.x, st.g.y - 34, CG, 13); ['a', 'd'].forEach((k, i) => { ctx.beginPath(); ctx.arc(st.g.x - 10 + i * 20, st.g.y + 38, 4.5, 0, TAU); ctx.fillStyle = dist(pos[k], st.g) < 54 ? rgba(COL[k], 1) : 'rgba(255,255,255,.2)'; ctx.fill(); }); }
        else for (const k of ['a', 'd']) { const s = st[k], on = dist(pos[k], s) < R + 26, pul = 1 + Math.sin(t * 4 + (k === 'a' ? 0 : 1)) * .12; glow(s.x, s.y, 44 * pul, COL[k], on ? .7 : .4); ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * .6); ctx.fillStyle = on ? '#fff' : rgba(COL[k], 1); ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? 6 * pul : 14 * pul, a = i * Math.PI / 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); if (k === me) label('dein Stern', s.x, s.y - 26, COL[k], 12); }
        // schon genähte Stiche
        ctx.strokeStyle = rgba(CG, .85); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; for (let i = 0; i < Math.min(A.cur, 4); i++) { const s = stitch(i, gap); ctx.beginPath(); ctx.moveTo(s.a.x + 14, s.a.y); ctx.lineTo(s.d.x - 14, s.d.y); ctx.stroke(); dotW(s.a.x + 14, s.a.y, 2.6); dotW(s.d.x - 14, s.d.y, 2.6); }
      }
      const todo = S.items.filter(it => it.o === me && it.st !== 2).length;
      label(A.ph === 'sammeln' ? (todo ? `Bild ${A.r + 1} von 2 · noch ${todo} Teile für deine Hälfte` : `Deine Hälfte liegt – ${nm(API.other)} braucht noch einen Moment`) : A.ph === 'naht' ? `Näht zusammen: gleichzeitig auf eure Sterne (${A.cur}/${STEPS})` : (A.r ? '' : 'Zwei Hälften, ein Bild'), CX, PY - 20, CG, 17, 600);
    }
    // Schluss: beide Bilder finden nebeneinander Platz und verbinden sich mit einem Herz
    if (S.done && ee > 0) {
      const B = FOTO.get('m1'), w = 300, h = w * 4 / 3, cy = PY + PH / 2 + 10, T1 = FOTO.tone('m2'), T2 = FOTO.tone('m1');
      for (const [o, sx, rot, dy] of [[T1, -1, -.07, -70], [T2, 1, .06, 70]]) { if (!o) continue; ctx.save(); ctx.globalAlpha = ee; ctx.translate(CX + sx * (128 + (1 - ee) * 170), cy + dy); ctx.rotate(rot * ee); FOTO.frame(ctx, -w / 2, -h / 2, w, h, 8); ctx.drawImage(o, -w / 2, -h / 2, w, h); ctx.restore(); }
      const hk = clamp((end - .7) / .3, 0, 1), pul = 1 + Math.sin(t * 3) * .07;
      if (hk > 0) { glow(CX, cy, 60 * pul, CA, .2 * hk); ctx.save(); ctx.globalAlpha = hk; ctx.fillStyle = '#f29cb4'; ctx.strokeStyle = '#fbf3e6'; ctx.lineWidth = 3; heartPath(CX, cy, 26 * pul * hk); ctx.fill(); ctx.stroke(); ctx.restore(); label('Zwei Bilder, zwei Hälften – ein Wir', CX, cy + h / 2 + 112, CG, 19, 700); }
    }
  }
};
return [bild];
});
