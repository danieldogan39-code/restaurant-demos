/* Zwei Lichter – „Spiegelsaal“ (neu in Version 8)
   Lichtstrahl-Rätsel mit Kamera hinter der Figur. Jeder darf nur die Spiegel seiner Farbe drehen.
   Drei Stufen: ein Kristall – zwei Kristalle – zwei Farben mit Steintor und Druckplatte.
   Die Layouts wurden mit einem Suchprogramm erzeugt und geprüft (jeweils genau eine Lösung). */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CA, CD, CG, rgba, clamp, nm, OTH, emit, finish, teleport, act, mine, lerpA, rr} = API;
const toast = t => API.toast(t);
const U = 50, N = 9, CS = 2, DX = [1, 0, -1, 0], DZ = [0, 1, 0, -1], REF = [[3, 2, 1, 0], [1, 0, 3, 2]];
const STAGES = [{"em":[{"c":7,"r":9,"dir":3,"col":"g"}],"cr":[{"c":7,"r":2,"col":"g"}],"pil":[[2,1],[5,2]],"mir":[{"c":7,"r":1,"o":"a","s":0},{"c":7,"r":3,"o":"d","s":1},{"c":3,"r":3,"o":"a","s":1},{"c":3,"r":1,"o":"d","s":1},{"c":2,"r":7,"o":"a","s":0}],"gate":null,"plate":null},
  {"em":[{"c":-1,"r":3,"dir":0,"col":"g"}],"cr":[{"c":4,"r":1,"col":"g"},{"c":1,"r":2,"col":"g"}],"pil":[[5,5],[3,7],[5,6]],"mir":[{"c":7,"r":3,"o":"a","s":0},{"c":4,"r":7,"o":"d","s":0},{"c":7,"r":1,"o":"a","s":0},{"c":2,"r":1,"o":"d","s":1},{"c":2,"r":6,"o":"a","s":0},{"c":2,"r":3,"o":"d","s":1},{"c":1,"r":6,"o":"a","s":0}],"gate":null,"plate":null},
  {"em":[{"c":-1,"r":5,"dir":0,"col":"a"},{"c":6,"r":-1,"dir":1,"col":"d"}],"cr":[{"c":4,"r":7,"col":"a"},{"c":1,"r":5,"col":"d"}],"pil":[[1,1],[2,1]],"mir":[{"c":1,"r":2,"o":"a","s":1},{"c":2,"r":7,"o":"d","s":0},{"c":6,"r":2,"o":"a","s":0},{"c":6,"r":4,"o":"d","s":0},{"c":1,"r":6,"o":"a","s":1},{"c":6,"r":7,"o":"d","s":0},{"c":1,"r":4,"o":"a","s":0},{"c":2,"r":5,"o":"d","s":1}],"gate":{"c":6,"r":6},"plate":{"c":7,"r":1}}];
const wx = c => (c - 4) * CS, wz = r => (r - 4) * CS;
const BCOL = {g: 0xffe2a8, a: 0xff8fb0, d: 0x7fb4ff}, BRGB = {g: CG, a: CA, d: CD};
const startOf = k => ({x: wx(k === 'a' ? 3 : 5), z: wz(8)});

/* Strahlen verfolgen: liefert Wegpunkte (in Zellen) und welche Kristalle leuchten */
function trace(st, states, gateOpen) {
  const lit = st.cr.map(() => false), segs = [];
  for (const e of st.em) {
    let c = e.c, r = e.r, d = e.dir; const pts = [[c, r]]; let end = 'wall';
    for (let n = 0; n < 80; n++) {
      c += DX[d]; r += DZ[d];
      if (c < 0 || r < 0 || c >= N || r >= N) { pts.push([c, r]); break; }
      if (st.pil.some(p => p[0] === c && p[1] === r) || (st.gate && st.gate.c === c && st.gate.r === r && !gateOpen)) { pts.push([c, r]); end = 'block'; break; }
      const ci = st.cr.findIndex(q => q.c === c && q.r === r);
      if (ci >= 0 && (st.cr[ci].col === 'g' || st.cr[ci].col === e.col)) lit[ci] = true;
      const mi = st.mir.findIndex(m => m.c === c && m.r === r);
      if (mi >= 0) { d = REF[states[mi]][d]; pts.push([c, r]); }
    }
    segs.push({pts, col: e.col, end});
  }
  return {lit, segs};
}
function solids(st) {
  const out = [], add = (c, r, h = .78) => out.push([wx(c) - h, wz(r) - h, wx(c) + h, wz(r) + h]);
  st.pil.forEach(p => add(p[0], p[1])); st.mir.forEach(m => add(m.c, m.r)); st.cr.forEach(q => add(q.c, q.r, .55)); if (st.gate) add(st.gate.c, st.gate.r);
  return out;
}

function buildHall(T) {
  const K = window.ZL_KIT(API), R = window.ZL_REAL(API), scene = new T.Scene(), cam = new T.PerspectiveCamera(66, 1, .2, 120);
  scene.background = new T.Color(0x120e16); scene.fog = new T.Fog(0x2a1e24, 26, 60);
  scene.environment = K.env(T, 'spiegel', 0x40304a, 0xb07858, 0x2a2026, [[-30, 12, 0, 16, 30, 0xffd0a0], [30, 12, 0, 16, 30, 0xff9a80], [0, 30, 0, 20, 20, 0x8a7a9a]]);
  scene.add(new T.HemisphereLight(0xffe2c8, 0x3a2e40, .52));
  const sun = R.sun(T, scene, new T.Vector3(-.75, .62, .22), 0xffc48c, 1.05, {size: 13, map: 1024});
  const add = (geo, mat, x, y, z, cast = true) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
  const fl = add(new T.PlaneGeometry(44, 44), R.pbr(T, 'marble', 22, 22, {roughness: .2, metalness: .05, envMapIntensity: .75}), 0, 0, 0, false); fl.rotation.x = -Math.PI / 2;
  const WH = 8.5, stone = R.pbr(T, 'stone', 8, 3.6, {color: 0xe2d2c2, roughness: .9});
  // Wände zeigen nur nach innen: steht die Kamera dahinter, schaut man einfach hindurch
  for (const [x, z, ry] of [[0, -9.3, 0], [0, 9.3, Math.PI], [-9.3, 0, Math.PI / 2], [9.3, 0, -Math.PI / 2]]) { const w = add(new T.PlaneGeometry(18.6, WH), stone, x, WH / 2, z, false); w.rotation.y = ry; }
  const ce = add(new T.PlaneGeometry(19.2, 19.2), R.pbr(T, 'wood', 5, 5, {color: 0x5a4a44, roughness: .95}), 0, WH, 0, false); ce.rotation.x = Math.PI / 2;
  for (const z of [-6.4, -3.2, 0, 3.2, 6.4]) add(new T.BoxGeometry(19.2, .4, .45), R.pbr(T, 'wood', 6, .3, {color: 0x6a5244}), 0, WH - .2, z, false);
  // hohe Bogenfenster mit Abendlicht, dazwischen Säulen
  const winT = R.paint(T, 96, 288, (g, w, h) => { g.fillStyle = '#1a1418'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe9c2'); gr.addColorStop(.6, '#ffb878'); gr.addColorStop(1, '#f08a70');
    g.fillStyle = gr; g.beginPath(); g.moveTo(8, h - 6); g.lineTo(8, 62); g.arc(w / 2, 62, w / 2 - 8, Math.PI, 0); g.lineTo(w - 8, h - 6); g.closePath(); g.fill();
    g.strokeStyle = '#2a2026'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 6); for (const y of [110, 170, 230]) { g.moveTo(8, y); g.lineTo(w - 8, y); } g.stroke(); });
  const shaftT = R.paint(T, 32, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,214,160,.55)'); gr.addColorStop(1, 'rgba(255,214,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const colM = R.pbr(T, 'marble', 1, 3, {color: 0xf0e6da, roughness: .35, envMapIntensity: .6});
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = -6.6 + i * 4.4;
    const w = add(new T.PlaneGeometry(1.7, 5.1), new T.MeshBasicMaterial({map: winT, color: s < 0 ? 0xffffff : 0xb8a0b0}), s * 9.28, 4.2, z, false); w.rotation.y = -s * Math.PI / 2;
    if (s < 0) { const sh = add(new T.PlaneGeometry(1.7, 10), new T.MeshBasicMaterial({map: shaftT, transparent: true, opacity: .28, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false}), -5.4, 3.3, z + .9, false); sh.rotation.set(0, 0, -.9); sh.receiveShadow = false; }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(new T.CylinderGeometry(.3, .36, WH, 14), colM, sx * 8.95, WH / 2, sz * 8.95); }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = -6.6 + i * 4.4, w = add(new T.PlaneGeometry(1.7, 5.1), new T.MeshBasicMaterial({map: winT, color: 0x9a8496}), x, 4.2, s * 9.28, false); w.rotation.y = s > 0 ? Math.PI : 0; }
  // Figuren
  const figs = {a: K.princess(T), d: K.prince(T)}, blobs = {};
  for (const k of ['a', 'd']) { figs[k].scale.setScalar(.8); R.shadows(figs[k], true, false); scene.add(figs[k]); blobs[k] = K.blob(T, 1.5); scene.add(blobs[k]); }
  // Strahlen
  const mkPool = (n, th, op) => Array.from({length: n}, () => { const m = new T.Mesh(new T.BoxGeometry(1, th, th), new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false})); m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
  const core = mkPool(26, .07, 1), halo = mkPool(26, .26, .22);
  const sparks = Array.from({length: 14}, () => { const s = K.sprite(T, 0xffffff, 1.1, .9); s.visible = false; scene.add(s); return s; });
  return {scene, cam, sun, figs, blobs, core, halo, sparks, ray: new T.Raycaster(), stageIdx: -1, grp: null, head: {a: 0, d: 0}};
}
function buildStage(T, M, si) {
  const K = window.ZL_KIT(API), R = window.ZL_REAL(API), st = STAGES[si], g = new T.Group(), me = API.me;
  const add = (geo, mat, x, y, z, par = g) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; par.add(m); return m; };
  const marble = R.pbr(T, 'marble', 1, 2, {color: 0xe8ddd0, roughness: .35, envMapIntensity: .6}), gold = new T.MeshStandardMaterial({color: 0xdcae60, metalness: .9, roughness: .28, envMapIntensity: 1.2});
  const glass = new T.MeshStandardMaterial({color: 0xe4eeff, metalness: 1, roughness: .04, envMapIntensity: 1.6});
  st.pil.forEach(([c, r]) => { const x = wx(c), z = wz(r); add(new T.BoxGeometry(1.5, .3, 1.5), marble, x, .15, z); add(new T.CylinderGeometry(.5, .56, 2.6, 18), marble, x, 1.6, z); add(new T.BoxGeometry(1.4, .26, 1.4), marble, x, 3.03, z);
    add(new T.SphereGeometry(.36, 16, 12), gold, x, 3.5, z); });
  const mirrors = st.mir.map((m, i) => {
    const x = wx(m.c), z = wz(m.r), col = m.o === 'a' ? 0xf48aa3 : 0x7fb0ff;
    add(new T.CylinderGeometry(.62, .7, .16, 20), marble, x, .08, z);
    const ring = new T.Mesh(new T.RingGeometry(.78, .95, 32), new T.MeshBasicMaterial({color: col, transparent: true, opacity: .85, side: T.DoubleSide})); ring.rotation.x = -Math.PI / 2; ring.position.set(x, .03, z); g.add(ring);
    const pv = new T.Group(); pv.position.set(x, 0, z); g.add(pv);
    add(new T.BoxGeometry(1.56, 1.96, .1), gold, 0, 1.3, 0, pv); add(new T.CylinderGeometry(.07, .09, .32, 10), gold, 0, .26, 0, pv);
    for (const s of [-1, 1]) { const p = add(new T.PlaneGeometry(1.36, 1.76), glass, 0, 1.3, s * .053, pv); p.rotation.y = s > 0 ? 0 : Math.PI; p.castShadow = false; }
    const gem = add(new T.SphereGeometry(.15, 14, 10), new T.MeshStandardMaterial({color: col, emissive: col, emissiveIntensity: .9, roughness: .2}), 0, 2.44, 0, pv); gem.castShadow = false;
    const hit = add(new T.BoxGeometry(1.6, 2.5, 1.6), new T.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}), x, 1.25, z); hit.castShadow = false; hit.receiveShadow = false; hit.userData.i = i;
    const ang = m.s ? -Math.PI / 4 : Math.PI / 4; pv.rotation.y = ang;
    return {pv, ring, hit, ang, own: m.o === me, x, z};
  });
  const emit3 = st.em.map(e => {
    const x = clamp(wx(e.c), -9.22, 9.22), z = clamp(wz(e.r), -9.22, 9.22);
    const t = add(new T.TorusGeometry(.46, .09, 10, 24), gold, x, 1.25, z); t.rotation.y = e.dir % 2 ? 0 : Math.PI / 2;
    const b = add(new T.SphereGeometry(.3, 16, 12), new T.MeshBasicMaterial({color: BCOL[e.col]}), x, 1.25, z); b.castShadow = false;
    const sp = K.sprite(T, BCOL[e.col], 2.6, .7); sp.position.set(x, 1.25, z); g.add(sp); return {sp};
  });
  const crystals = st.cr.map(q => {
    const x = wx(q.c), z = wz(q.r);
    add(new T.CylinderGeometry(.36, .46, .7, 16), marble, x, .35, z);
    const m = new T.MeshStandardMaterial({color: BCOL[q.col], emissive: BCOL[q.col], emissiveIntensity: .12, roughness: .08, metalness: .25, transparent: true, opacity: .9, envMapIntensity: 1.4, flatShading: true});
    const c = add(new T.OctahedronGeometry(.44, 0), m, x, 1.3, z); c.scale.y = 1.5;
    const sp = K.sprite(T, BCOL[q.col], 3.4, 0); sp.position.set(x, 1.3, z); g.add(sp);
    const pl = new T.PointLight(BCOL[q.col], 0, 8, 1.5); pl.position.set(x, 1.7, z); g.add(pl);
    return {c, m, sp, pl, lit: 0};
  });
  let gate = null, plate = null;
  if (st.gate) {
    const x = wx(st.gate.c), z = wz(st.gate.r);
    add(new T.BoxGeometry(1.7, .14, 1.7), R.pbr(T, 'stone', 1, 1, {color: 0x8a8088}), x, .07, z);
    const slab = add(new T.BoxGeometry(1.5, 2.3, 1.5), R.pbr(T, 'stone', 1, 1.4, {color: 0xb8aca8, roughness: .9}), x, 1.15, z);
    gate = {slab, y: 1.15};
    const px = wx(st.plate.c), pz = wz(st.plate.r);
    const pm = new T.MeshStandardMaterial({color: 0xdcae60, metalness: .85, roughness: .3, emissive: 0xffb040, emissiveIntensity: .25});
    const disc = add(new T.CylinderGeometry(.82, .86, .1, 28), pm, px, .05, pz); disc.castShadow = false;
    const psp = K.sprite(T, 0xffc060, 2.4, .35); psp.position.set(px, .4, pz); g.add(psp);
    plate = {disc, pm, psp};
  }
  M.scene.add(g);
  return {g, mirrors, emit3, crystals, gate, plate, st};
}

const spiegel = {
  id: 'spiegel', n: 'Spiegelsaal', ic: '◇', t3: 240, t2: 420, ctrl: 'fps', three: true, noClamp: true, isNew: true, eAngle: [0],
  skinName: () => `${nm('a')}: rosé Spiegel · ${nm('d')}: blaue Spiegel`,
  h: k => `Im Spiegelsaal des Schlosses: Lenkt den Lichtstrahl über die Spiegel auf die Kristalle. Jeder Spiegel hat zwei Stellungen – aber du darfst nur die Spiegel mit dem ${k === 'a' ? 'rosa' : 'blauen'} Ring drehen, ${nm(OTH(k))} die anderen. Drei Säle, jeder kniffliger als der davor. Die kleine Karte oben rechts zeigt den Strahl.`,
  ctrlText: () => 'Linker Daumen: laufen. Rechter Daumen: Kamera drehen. Stell dich an einen deiner Spiegel und tippe ihn an (oder den goldenen Knopf).',
  start: k => { const s = startOf(k); return {x: s.x * U, y: s.z * U}; },
  countText: () => `Saal ${Math.min((S.aux.stage || 0) + 1, 3)}/3`,
  note: () => `${S.aux.turns} Spiegel-Drehungen`,
  setup() { S.aux = {stage: 0, m: STAGES[0].mir.map(x => x.s), go: 0, hold: 0, win: 0, turns: 0}; S.total = 3; },
  posExtra: () => [Math.round((LOC.face || 0) * 100) / 100],
  move(dt, inp) {
    const R = window.ZL_REAL(API), st = R.fp(LOC, 0), f = inp.fps; if (!f) return;
    R.look(st, f, .5);
    const d = R.step(st, f, 4.2, dt), p = {x: mine.x / U + d.dx, z: mine.y / U + d.dz}, sd = STAGES[S.aux.stage] || STAGES[0];
    R.push(p, solids(sd), .4); p.x = clamp(p.x, -8.55, 8.55); p.z = clamp(p.z, -8.55, 8.55);
    if (Math.hypot(d.dx, d.dz) > .001) LOC.face = lerpA(LOC.face || 0, Math.atan2(-d.dx, -d.dz), Math.min(1, dt * 12));
    mine.x = p.x * U; mine.y = p.z * U;
    // nächster eigener Spiegel in Reichweite
    let best = -1, bd = 2.45;
    sd.mir.forEach((m, i) => { const dd = Math.hypot(wx(m.c) - p.x, wz(m.r) - p.z); if (dd < bd && m.o === API.me) { bd = dd; best = i; } });
    LOC.near = best; LOC.useLabel = best >= 0 && !S.aux.win ? 'Spiegel drehen' : null;
    let want = f.use ? best : -1;
    const M = LOC.M;
    if (M && M.stage && f.taps.length) {
      const s = API.screen(), T = window.THREE;
      for (const tp of f.taps) {
        M.ray.setFromCamera(new T.Vector2(tp.x / s.cw * 2 - 1, -(tp.y / s.ch) * 2 + 1), M.cam);
        const hit = M.ray.intersectObjects(M.stage.mirrors.map(m => m.hit), false)[0]; if (!hit) continue;
        const i = hit.object.userData.i, m = sd.mir[i];
        if (m.o !== API.me) toast(`Das ist ${nm(m.o)}s Spiegel – den darf nur ${nm(m.o)} drehen.`);
        else if (Math.hypot(wx(m.c) - p.x, wz(m.r) - p.z) > 2.6) toast('Geh näher an den Spiegel heran.');
        else want = i;
      }
    }
    if (want >= 0 && !S.aux.win && performance.now() - (LOC.turnT || 0) > 280) { LOC.turnT = performance.now(); act({k: 'turn', i: want}); }
  },
  action(k, d) {
    const A = S.aux, st = STAGES[A.stage]; if (d.k !== 'turn' || A.win || !st) return;
    const m = st.mir[d.i | 0]; if (!m || m.o !== k) return;
    if (Math.hypot(wx(m.c) - S.p[k].x / U, wz(m.r) - S.p[k].y / U) > 3.2) return;
    A.m[d.i | 0] ^= 1; A.turns++; emit({k: 'flip', o: k}); emit({k: 'click', o: k});
  },
  update(dt) {
    const A = S.aux, st = STAGES[A.stage]; if (!st) return;
    if (A.win) {
      if (S.t < A.win) return;
      if (A.stage + 1 >= STAGES.length) { finish(1.2); A.win = S.t + 99; return; }
      A.stage++; A.m = STAGES[A.stage].mir.map(x => x.s); A.go = 0; A.hold = 0; A.win = 0;
      for (const k of ['a', 'd']) { const s = startOf(k); teleport(k, s.x * U, s.z * U); }
      emit({k: 'toast', txt: A.stage === 1 ? 'Saal 2: Der Strahl muss durch beide Kristalle.' : 'Saal 3: Zwei Farben! Und das Steintor öffnet sich nur, solange jemand auf der goldenen Platte steht.'});
      return;
    }
    if (st.plate) { const px = wx(st.plate.c), pz = wz(st.plate.r), on = ['a', 'd'].some(k => Math.hypot(S.p[k].x / U - px, S.p[k].y / U - pz) < 1) ? 1 : 0; if (on !== A.go) { A.go = on; emit({k: 'gate', x: 0, y: 0}); } }
    const tr = trace(st, A.m, A.go);
    if (tr.lit.every(Boolean)) { A.hold += dt; if (A.hold > .8) { A.win = S.t + 2.8; S.count = A.stage + 1; emit({k: 'lit'}); emit({k: 'gold', x: 0, y: 0}); emit({k: 'toast', txt: A.stage + 1 < STAGES.length ? `Saal ${A.stage + 1} gelöst! Weiter in den nächsten …` : 'Alle drei Säle gelöst!'}); } }
    else A.hold = 0;
  },
  render3d(t, part) {
    const T = window.THREE, K = window.ZL_KIT(API), R = window.ZL_REAL(API), sc = API.screen();
    if (!LOC.M) { LOC.M = buildHall(T); LOC.__dispose = () => API.disposeTree(LOC.M.scene); }
    const M = LOC.M, A = S.aux, me = API.me, ot = API.other, st = STAGES[A.stage] || STAGES[0], fp = R.fp(LOC, 0);
    const dt = Math.min(.05, Math.max(0, t - (M.lt || t))); M.lt = t;
    if (M.stageIdx !== A.stage) { if (M.stage) { M.scene.remove(M.stage.g); API.disposeTree(M.stage.g); } M.stage = buildStage(T, M, Math.min(A.stage, STAGES.length - 1)); M.stageIdx = A.stage; }
    const G = M.stage, states = A.m.length === st.mir.length ? A.m : st.mir.map(x => x.s), tr = trace(st, states, A.go);
    // Spiegel
    G.mirrors.forEach((m, i) => { const want = states[i] ? -Math.PI / 4 : Math.PI / 4; m.ang += (want - m.ang) * Math.min(1, dt * 10); m.pv.rotation.y = m.ang; const near = LOC.near === i; m.ring.material.opacity = near ? .75 + Math.sin(t * 8) * .25 : m.own ? .8 : .45; m.ring.scale.setScalar(near ? 1.12 : 1); });
    // Strahlen
    let bi = 0, si = 0;
    for (const sg of tr.segs) {
      const col = BCOL[sg.col];
      for (let i = 1; i < sg.pts.length; i++) {
        let x0 = clamp(wx(sg.pts[i - 1][0]), -9.2, 9.2), z0 = clamp(wz(sg.pts[i - 1][1]), -9.2, 9.2), x1 = clamp(wx(sg.pts[i][0]), -9.3, 9.3), z1 = clamp(wz(sg.pts[i][1]), -9.3, 9.3);
        if (i === sg.pts.length - 1 && sg.end === 'block') { const l = Math.hypot(x1 - x0, z1 - z0) || 1; x1 -= (x1 - x0) / l * .62; z1 -= (z1 - z0) / l * .62; }
        const len = Math.hypot(x1 - x0, z1 - z0); if (len < .05 || bi >= M.core.length) continue;
        for (const pool of [M.core, M.halo]) { const b = pool[bi]; b.visible = true; b.position.set((x0 + x1) / 2, 1.25, (z0 + z1) / 2); b.scale.set(len, 1, 1); b.rotation.y = Math.abs(z1 - z0) > Math.abs(x1 - x0) ? Math.PI / 2 : 0; b.material.color.set(col); }
        M.halo[bi].material.opacity = .2 + Math.sin(t * 6 + bi) * .04; bi++;
        if (si < M.sparks.length) { const s = M.sparks[si++]; s.visible = true; s.position.set(x1, 1.25, z1); s.material.color.set(col); const q = .9 + Math.sin(t * 14 + si) * .25; s.scale.set(q, q, 1); }
      }
    }
    for (let i = bi; i < M.core.length; i++) { M.core[i].visible = false; M.halo[i].visible = false; }
    for (let i = si; i < M.sparks.length; i++) M.sparks[i].visible = false;
    // Kristalle, Tor, Platte
    G.crystals.forEach((c, i) => { c.lit += ((tr.lit[i] ? 1 : 0) - c.lit) * Math.min(1, dt * 6); c.c.rotation.y = t * (.5 + c.lit * 1.5); c.c.position.y = 1.3 + Math.sin(t * 2 + i) * .05; c.m.emissiveIntensity = .12 + c.lit * .9; c.sp.material.opacity = c.lit * .55; c.pl.intensity = c.lit * 1.1; });
    if (G.gate) { const want = A.go ? -1.05 : 1.15; G.gate.y += (want - G.gate.y) * Math.min(1, dt * 5); G.gate.slab.position.y = G.gate.y; G.plate.disc.position.y = A.go ? .02 : .05; G.plate.pm.emissiveIntensity = A.go ? 1 : .25 + Math.sin(t * 3) * .1; G.plate.psp.material.opacity = A.go ? .6 : .3; }
    G.emit3.forEach((e, i) => { const q = 2.4 + Math.sin(t * 5 + i) * .3; e.sp.scale.set(q, q, 1); });
    // Figuren
    const pos = {[me]: {x: mine.x / U, z: mine.y / U, h: LOC.face || 0}, [ot]: {x: part.x / U, z: part.y / U, h: part.e ? part.e[0] : 0}};
    for (const k of ['a', 'd']) {
      const f = M.figs[k], p = pos[k], pr = (M.prev || {})[k] || p, mv = Math.hypot(p.x - pr.x, p.z - pr.z) > .004;
      M.head[k] = lerpA(M.head[k], p.h, Math.min(1, dt * 14)); f.position.set(p.x, 0, p.z); f.rotation.y = M.head[k]; K.animFigure(f, t + (k === 'a' ? 0 : 1.3), mv);
      M.blobs[k].position.set(p.x, .02, p.z);
    }
    M.prev = pos;
    // Kamera hinter der eigenen Figur
    const mp = pos[me], dist = 6.2, h = 3.3 + fp.pitch * -3;
    const want = new T.Vector3(mp.x + Math.sin(fp.yaw) * dist, clamp(h, 1.6, 6.5), mp.z + Math.cos(fp.yaw) * dist);
    if (!M.camPos || M.camPos.distanceTo(want) > 9) M.camPos = want.clone(); M.camPos.lerp(want, Math.min(1, dt * 9));
    M.cam.position.copy(M.camPos); M.cam.lookAt(mp.x, 1.5, mp.z);
    M.cam.aspect = sc.cw / sc.ch; M.cam.fov = sc.cw < sc.ch ? 70 : 58; M.cam.updateProjectionMatrix(); M.cam.updateMatrixWorld();
    R.sunAt(M.sun, 0, 0, 0);
    API.render3D(M.scene, M.cam, {bloom: .85, th: .7});
    // Anzeige
    for (const k of [ot, me]) { const p = K.proj(M.cam, new T.Vector3(pos[k].x, 2.35, pos[k].z)); if (p.ok && p.y > 90) K.nameTag(nm(k), p.x, p.y, COL[k]); }
    if (S.phase !== 'play' && S.phase !== 'count') return;
    const need = st.cr.length, got = tr.lit.filter(Boolean).length;
    const txt = A.win ? 'Gelöst! ✨' : A.stage === 0 ? `Lenkt den Strahl auf den Kristall. Du drehst nur die Spiegel mit ${me === 'a' ? 'rosa' : 'blauem'} Ring.`
      : A.stage === 1 ? `Der Strahl muss durch beide Kristalle (${got}/${need}).`
      : `Rosé auf Rosé, Blau auf Blau (${got}/${need}). Das Steintor öffnet sich nur, solange jemand auf der goldenen Platte steht.`;
    const nh = R.note(txt, 64);
    // Karte von oben
    const cs = Math.min(13, (sc.cw * .32) / N), mw = N * cs, mx = sc.cw - mw - 12, my = 64 + nh + 10, P = (c, r) => [mx + (c + .5) * cs, my + (r + .5) * cs];
    ctx.fillStyle = 'rgba(12,9,26,.72)'; rr(mx - 6, my - 6, mw + 12, mw + 12, 10); ctx.fill(); ctx.strokeStyle = 'rgba(243,201,143,.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(mx + cs, my + cs, mw - 2 * cs, mw - 2 * cs);
    st.pil.forEach(([c, r]) => { const [x, y] = P(c, r); ctx.fillStyle = 'rgba(200,190,200,.75)'; ctx.fillRect(x - cs * .36, y - cs * .36, cs * .72, cs * .72); });
    if (st.gate) { let [x, y] = P(st.gate.c, st.gate.r); ctx.fillStyle = A.go ? 'rgba(243,201,143,.25)' : 'rgba(170,160,160,.9)'; ctx.fillRect(x - cs * .42, y - cs * .42, cs * .84, cs * .84); [x, y] = P(st.plate.c, st.plate.r); ctx.strokeStyle = rgba(CG, 1); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, cs * .36, 0, TAU); ctx.stroke(); if (A.go) { ctx.fillStyle = rgba(CG, .9); ctx.fill(); } }
    ctx.lineCap = 'round';
    for (const sg of tr.segs) { ctx.strokeStyle = rgba(BRGB[sg.col], .95); ctx.lineWidth = 2; ctx.beginPath(); sg.pts.forEach(([c, r], i) => { const [x, y] = P(clamp(c, -.4, N - .6), clamp(r, -.4, N - .6)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
    st.mir.forEach((m, i) => { const [x, y] = P(m.c, m.r), d = cs * .36, s = states[i] ? 1 : -1; ctx.strokeStyle = rgba(m.o === 'a' ? [255, 120, 160] : [110, 170, 255], 1); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x - d, y - d * s); ctx.lineTo(x + d, y + d * s); ctx.stroke(); });
    st.cr.forEach((q, i) => { const [x, y] = P(q.c, q.r), d = cs * .4; ctx.fillStyle = rgba(BRGB[q.col], tr.lit[i] ? 1 : .45); ctx.beginPath(); ctx.moveTo(x, y - d); ctx.lineTo(x + d * .7, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d * .7, y); ctx.closePath(); ctx.fill(); if (tr.lit[i]) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); } });
    st.em.forEach(e => { const [x, y] = P(clamp(e.c, -.4, N - .6), clamp(e.r, -.4, N - .6)); ctx.fillStyle = rgba(BRGB[e.col], 1); ctx.beginPath(); ctx.arc(x, y, cs * .3, 0, TAU); ctx.fill(); });
    for (const k of [ot, me]) { const x = mx + (pos[k].x / CS + 4.5) * cs, y = my + (pos[k].z / CS + 4.5) * cs; ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(x, y, cs * .3, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
    if (LOC.near < 0 && !A.win) { const om = st.mir.findIndex(m => m.o !== me && Math.hypot(wx(m.c) - mp.x, wz(m.r) - mp.z) < 2.2); if (om >= 0) API.label(`${nm(ot)}s Spiegel`, sc.cw / 2, sc.ch - 190, COL[ot], 14, 700); }
  }
};
return [spiegel];
});
