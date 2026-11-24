/* Zwei Lichter – Level-Paket 3: Abenteuer & 3D
   „Zueinander“ (Plattform), „Korallenflug“ (3D unter Wasser), „Nachtrennen“ (3D-Autorennen) */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, W, TAU, COL, CA, CD, CG, rgba, rnd, clamp, nm, emit, finish, act, hostNow, tone, buzz, glow, label, heartPath, rr, mine} = API;
const toast = t => API.toast(t);

/* =====================================================================
   ZUEINANDER – Prinzessin & Prinz laufen sich aus zwei Schlössern entgegen
   ===================================================================== */
const LW = 3000, FEET = 22, HW = 13;
const SOLIDS = [
  [0, 860, 420, 140], [520, 860, 260, 140], [880, 860, 300, 140], [1180, 860, 640, 140],
  [1820, 860, 360, 140], [2290, 860, 250, 140], [2760, 860, 240, 140],
  [250, 735, 110, 22], [110, 615, 100, 22], [640, 745, 110, 22], [1440, 745, 120, 22],
  [2420, 725, 110, 22], [2610, 640, 100, 22], [2840, 705, 100, 22],
  [-40, 0, 40, 1000], [LW, 0, 40, 1000]
];
const SPIKES = [[600, 842, 50, 18], [2350, 842, 50, 18]];
const G1 = [1180, 560, 30, 300], G2 = [1790, 560, 30, 300];
const L1 = {x: 1905}, L2 = {x: 1300};
const CPS = {a: [60, 560, 950, 1260], d: [2930, 2800, 2330, 1880]};
const mpX = t => 2560 + (Math.sin(t * 1.1) * .5 + .5) * 110;
const MPY = 842, MPW = 90;
const over = (x, y, r) => x + HW > r[0] && x - HW < r[0] + r[2] && y + FEET > r[1] && y - FEET < r[1] + r[3];
function solidsNow() {
  const out = SOLIDS.slice();
  if (!S.aux.g1) out.push(G1);
  if (!S.aux.g2) out.push(G2);
  return out;
}
function respawn(msg) {
  const P = LOC.pl, cps = CPS[API.me];
  mine.x = P.cp != null ? P.cp : cps[0]; mine.y = 860 - FEET; P.vx = P.vy = 0;
  buzz([20, 40, 20]); tone(196, .4, .05, 'triangle'); toast(msg); act({k: 'oops'});
}
const zueinander = {
  id: 'zueinander', noDeco: true, n: 'Zueinander', ic: '♥', t3: 75, t2: 130, ctrl: 'buttons', noClamp: true, noThread: true,
  skin: {a: 'princess', d: 'prince'}, nameDY: 48, skinScale: 1.4, skinAnchor: 22,
  skinName: () => `${nm('a')}: Prinzessin · ${nm('d')}: Prinz`,
  h: () => `Prinzessin ${nm('a')} startet in ihrem Schloss links, Prinz ${nm('d')} rechts. Zwei Tore trennen euch – jeder findet den Hebel, der das Tor des anderen öffnet. Sammelt Herzen und findet zueinander!`,
  start: k => k === 'a' ? {x: 60, y: 860 - FEET} : {x: 2930, y: 860 - FEET},
  camX: () => clamp(mine.x - W / 2, 0, LW - W),
  setup() {
    const hs = [[300, 690], [160, 570], [695, 700], [1000, 800], [2475, 680], [2660, 595], [2890, 660], [2235, 760]];
    S.items = hs.map(([x, y], i) => ({id: i, x, y, got: 0}));
    S.total = S.items.length;
    S.aux = {g1: 0, g2: 0};
  },
  move(dt, inp) {
    if (!LOC.pl) LOC.pl = {vx: 0, vy: 0, ground: false, coy: 0, buf: 0, cp: null, onMP: false, mpLast: 0};
    const P = LOC.pl, b = inp.btn || {}, t = hostNow();
    const dir = (b.r ? 1 : 0) - (b.l ? 1 : 0);
    P.vx += (dir * 290 - P.vx) * Math.min(1, dt * (P.ground ? 14 : 7));
    if (b.jump) P.buf = .14; else P.buf -= dt;
    P.coy = P.ground ? .1 : P.coy - dt;
    if (P.buf > 0 && P.coy > 0) { P.vy = -840; P.buf = 0; P.coy = 0; P.ground = false; tone(API.me === 'a' ? 784 : 587, .1, .035, 'square'); }
    if (!b.held && P.vy < -320) P.vy = -320;
    P.vy = Math.min(P.vy + 2150 * dt, 1200);
    const sol = solidsNow();
    if (P.onMP) mine.x += mpX(t) - P.mpLast;
    mine.x += P.vx * dt;
    for (const r of sol) if (over(mine.x, mine.y, r)) { mine.x = P.vx > 0 || mine.x < r[0] + r[2] / 2 ? r[0] - HW : r[0] + r[2] + HW; P.vx = 0; }
    const prevFeet = mine.y + FEET;
    mine.y += P.vy * dt; P.ground = false; P.onMP = false;
    for (const r of sol) if (over(mine.x, mine.y, r)) {
      if (P.vy > 0) { mine.y = r[1] - FEET; P.ground = true; } else mine.y = r[1] + r[3] + FEET;
      P.vy = 0;
    }
    const mx = mpX(t);
    if (P.vy >= 0 && prevFeet <= MPY + 6 && mine.y + FEET >= MPY && mine.x > mx - 8 && mine.x < mx + MPW + 8) { mine.y = MPY - FEET; P.vy = 0; P.ground = true; P.onMP = true; }
    P.mpLast = mx;
    const cps = CPS[API.me];
    for (const c of cps) if (API.me === 'a' ? mine.x >= c : mine.x <= c) P.cp = c;
    if (mine.y > 1060) respawn('Hoppla – runtergefallen!');
    else if (SPIKES.some(r => over(mine.x, mine.y, r))) respawn('Autsch, Dornen!');
  },
  onTeleport() { LOC.pl = null; },
  action(k, d) { if (d.k === 'oops') emit({k: 'fizz', x: S.p[k].x, y: S.p[k].y}); },
  update() {
    const A = S.aux, a = S.p.a, d = S.p.d;
    for (const it of S.items) {
      if (it.got) continue;
      for (const k of ['a', 'd']) if (Math.hypot(S.p[k].x - it.x, S.p[k].y - it.y) < 34) { it.got = 1; S.count++; emit({k: 'heart', x: it.x, y: it.y, o: k}); break; }
    }
    const onLever = (p, L) => Math.abs(p.x - L.x) < 28 && Math.abs(p.y - (860 - FEET)) < 12;
    if (!A.g1 && (onLever(a, L1) || onLever(d, L1))) { A.g1 = 1; emit({k: 'gate', x: G1[0], y: 700}); emit({k: 'toast', txt: `${nm('d')} hat das Tor für ${nm('a')} geöffnet!`}); }
    if (!A.g2 && (onLever(a, L2) || onLever(d, L2))) { A.g2 = 1; emit({k: 'gate', x: G2[0], y: 700}); emit({k: 'toast', txt: `${nm('a')} hat das Tor für ${nm('d')} geöffnet!`}); }
    if (Math.abs(a.x - d.x) < 52 && Math.abs(a.y - d.y) < 50) { emit({k: 'meet', x: (a.x + d.x) / 2, y: a.y - 20}); finish(2.4); }
  },
  draw(t) {
    const A = S.aux;
    // Schlösser an beiden Enden
    castle(60, 860, [244, 168, 184], `Schloss ${nm('a')}`);
    castle(2930, 860, [156, 199, 255], `Schloss ${nm('d')}`);
    // Hügel im Hintergrund
    ctx.fillStyle = 'rgba(80,40,90,.35)';
    for (let x = -100; x < LW + 200; x += 340) { ctx.beginPath(); ctx.ellipse(x, 900, 260, 180, 0, Math.PI, 0); ctx.fill(); }
    for (const r of SOLIDS) {
      if (r[0] < 0 || r[0] >= LW) continue;
      const big = r[3] > 40;
      ctx.fillStyle = big ? '#5a3b4e' : '#7a5a6a'; rr(r[0], r[1], r[2], r[3], big ? 4 : 8); ctx.fill();
      ctx.fillStyle = '#7fcf8c'; rr(r[0], r[1] - 3, r[2], big ? 12 : 9, 5); ctx.fill();
      if (big) { ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let x = r[0] + 14; x < r[0] + r[2] - 10; x += 38) ctx.fillRect(x, r[1] + 30 + (x % 3) * 18, 18, 9); }
    }
    for (const r of SPIKES) { ctx.fillStyle = '#d9d2e6'; ctx.beginPath(); for (let x = r[0]; x < r[0] + r[2]; x += 12.5) { ctx.moveTo(x, r[1] + r[3]); ctx.lineTo(x + 6.25, r[1]); ctx.lineTo(x + 12.5, r[1] + r[3]); } ctx.fill(); }
    const mx = mpX(hostNow());
    ctx.fillStyle = '#c9a36a'; rr(mx, MPY, MPW, 16, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(mx + 6, MPY + 4, MPW - 12, 3);
    gateDraw(G1, A.g1, t); gateDraw(G2, A.g2, t);
    lever(L1.x, A.g1, `Hebel: Tor für ${nm('a')}`, CD);
    lever(L2.x, A.g2, `Hebel: Tor für ${nm('d')}`, CA);
    for (const it of S.items) { if (it.got) continue; const s = 1 + Math.sin(t * 4 + it.id) * .1; glow(it.x, it.y, 30, CA, .5); ctx.fillStyle = '#f48aa3'; heartPath(it.x, it.y, 11 * s); ctx.fill(); }
    ctx.globalAlpha = .7; label('♥ Hier trefft ihr euch ♥', 1500, 700, CG, 15, 700); ctx.globalAlpha = 1;
  }
};
function castle(x, gy, c, txt) {
  ctx.fillStyle = rgba(c, .5);
  ctx.fillRect(x - 50, gy - 150, 100, 150);
  ctx.fillRect(x - 70, gy - 210, 34, 210); ctx.fillRect(x + 36, gy - 210, 34, 210);
  ctx.fillStyle = rgba(c, .8);
  for (const tx of [x - 53, x + 53]) { ctx.beginPath(); ctx.moveTo(tx - 22, gy - 210); ctx.lineTo(tx, gy - 260); ctx.lineTo(tx + 22, gy - 210); ctx.fill(); }
  ctx.fillStyle = 'rgba(40,20,40,.6)'; ctx.beginPath(); ctx.arc(x, gy - 40, 22, Math.PI, 0); ctx.lineTo(x + 22, gy); ctx.lineTo(x - 22, gy); ctx.fill();
  label(txt, x, gy - 270, c, 14, 700);
}
function gateDraw(r, open, t) {
  const lift = open ? 260 : 0;
  ctx.fillStyle = '#4a3346'; ctx.fillRect(r[0] - 10, r[1] - 30, r[2] + 20, 30);
  ctx.save(); ctx.beginPath(); ctx.rect(r[0] - 4, r[1], r[2] + 8, r[3]); ctx.clip();
  ctx.strokeStyle = '#a0907c'; ctx.lineWidth = 5;
  for (let x = r[0] + 3; x < r[0] + r[2]; x += 12) { ctx.beginPath(); ctx.moveTo(x, r[1] - lift); ctx.lineTo(x, r[1] + r[3] - lift); ctx.stroke(); }
  for (let y = r[1] + 20; y < r[1] + r[3]; y += 40) { ctx.beginPath(); ctx.moveTo(r[0], y - lift); ctx.lineTo(r[0] + r[2], y - lift); ctx.stroke(); }
  ctx.restore();
  if (!open) glow(r[0] + r[2] / 2, r[1] + r[3] / 2, 60, [255, 120, 140], .15 + Math.sin(t * 3) * .05);
}
function lever(x, on, txt, c) {
  ctx.fillStyle = '#6b5a4a'; ctx.fillRect(x - 16, 846, 32, 14);
  ctx.strokeStyle = on ? '#9be3a8' : '#f3c98f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, 848); ctx.lineTo(x + (on ? 18 : -18), 818); ctx.stroke();
  ctx.fillStyle = on ? '#9be3a8' : '#f3c98f'; ctx.beginPath(); ctx.arc(x + (on ? 18 : -18), 816, 6, 0, TAU); ctx.fill();
  glow(x, 840, 50, c, on ? .1 : .3);
  label(on ? 'offen ✓' : txt, x, 795, c, 13, 700);
}

/* =====================================================================
   KORALLENFLUG – 3D unter Wasser: Schildkröte & Schwamm
   ===================================================================== */
const KLEN = 820;
const pathC = d => ({x: Math.sin(d * .018) * 14 + Math.sin(d * .0071) * 9, y: Math.sin(d * .011) * 4});
const pathYaw = d => { const a = pathC(d), b = pathC(d + 2); return Math.atan2(-(b.x - a.x), 2); };
const KIT = () => window.ZL_KIT(API);
function causticTex(T) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'lighter'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 26;
    g.strokeStyle = `rgba(190,245,255,${.12 + Math.random() * .25})`; g.beginPath();
    for (let k = 0; k <= 7; k++) { const a = k / 7 * TAU, rr2 = r * (.7 + Math.random() * .5); k ? g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2) : g.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    g.stroke();
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
function buildReef(T) {
  const K = KIT(), scene = new T.Scene();
  scene.fog = new T.FogExp2(0x0b5574, .022);
  scene.add(K.sky(T, 0x1f86ad, 0x0a4a6a, 0x03182a, 120));
  scene.environment = K.env(T, 'sea2', 0x145a78, 0x0a3a54, 0x020c16, [[0, 50, 0, 30, 30, 0x4a8aa8]]);
  const cam = new T.PerspectiveCamera(62, 1, .1, 130);
  scene.add(new T.HemisphereLight(0xbff2ff, 0x0a2a3a, .95));
  const dl = new T.DirectionalLight(0xfff4e0, .65); dl.position.set(6, 30, 8); scene.add(dl);
  // Sandboden mit wandernden Lichtnetzen (Kaustik)
  const fg = new T.PlaneGeometry(120, KLEN + 220, 30, 120); fg.rotateX(-Math.PI / 2);
  const pa = fg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i) - KLEN / 2, x = pa.getX(i); pa.setZ(i, z); pa.setY(i, Math.sin(x * .3) * .6 + Math.cos(z * .2) * .5 + Math.random() * .35 + Math.max(0, Math.abs(x) - 26) * .25); pa.setX(i, x + pathC(-z).x); }
  fg.computeVertexNormals();
  const ctex = causticTex(T); ctex.repeat.set(10, 60);
  const sand = new T.MeshStandardMaterial({color: 0x8a7552, roughness: .95, emissive: 0x9fe8ff, emissiveMap: ctex, emissiveIntensity: .3, envMapIntensity: .25});
  const floor = new T.Mesh(fg, sand); floor.position.y = -13; scene.add(floor);
  // Korallen: Fächer, Kugeln, Röhren, leuchtende Anemonen
  const cols = [0xf48aa3, 0xf6a85c, 0xb88cf0, 0x5fd0c0, 0xffd27a, 0xff7a8a];
  const mats = cols.map(c => new T.MeshStandardMaterial({color: c, roughness: .7, emissive: c, emissiveIntensity: .22}));
  const geos = [new T.ConeGeometry(.9, 3.2, 7), new T.IcosahedronGeometry(1.1, 1), new T.CylinderGeometry(.25, .35, 4, 7), new T.TorusKnotGeometry(.7, .22, 40, 6), new T.DodecahedronGeometry(1.2, 0)];
  const tmp = new T.Object3D();
  geos.forEach((geo, gi) => mats.forEach((mat, mi) => {
    const n = 9, im = new T.InstancedMesh(geo, mat, n); let k = 0;
    for (let i = 0; i < n; i++) {
      const d = rnd(-20, KLEN + 40), side = Math.random() < .5 ? -1 : 1, c = pathC(d);
      tmp.position.set(c.x + side * rnd(11, 32), -11.6 + (gi === 1 || gi === 4 ? .2 : 1.4), -d); tmp.scale.setScalar(rnd(.7, 2));
      tmp.rotation.set(rnd(-.2, .2), rnd(0, TAU), rnd(-.2, .2)); tmp.updateMatrix(); im.setMatrixAt(k++, tmp.matrix);
    }
    scene.add(im); void mi;
  }));
  // Seetang, der sich wiegt
  const kelp = [], kg = new T.PlaneGeometry(.9, 9, 1, 8); kg.translate(0, 4.5, 0);
  const km = new T.MeshStandardMaterial({color: 0x3f9a62, roughness: .8, side: T.DoubleSide, emissive: 0x0d3a20, emissiveIntensity: .5});
  for (let i = 0; i < 90; i++) { const d = rnd(0, KLEN + 30), c = pathC(d), side = Math.random() < .5 ? -1 : 1, m = new T.Mesh(kg, km); m.position.set(c.x + side * rnd(10, 22), -12.5, -d); m.rotation.y = rnd(0, TAU); m.scale.set(1, rnd(.7, 1.6), 1); m.userData.ph = rnd(0, 6); scene.add(m); kelp.push(m); }
  // Leuchtanemonen
  for (let i = 0; i < 40; i++) { const d = rnd(0, KLEN), c = pathC(d), side = Math.random() < .5 ? -1 : 1, col = [0xff9ec4, 0x8ff0ff, 0xffd27a][i % 3], sp = K.sprite(T, col, 4, .7); sp.position.set(c.x + side * rnd(9, 20), -10.8, -d); scene.add(sp); }
  // Lichtstrahlen
  const rays = new T.Group();
  for (let i = 0; i < 12; i++) {
    const r = new T.Mesh(new T.PlaneGeometry(rnd(4, 9), 70), new T.MeshBasicMaterial({color: 0xcff6ff, transparent: true, opacity: .05, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false}));
    r.position.set(rnd(-28, 28), 16, -rnd(-10, 110)); r.rotation.z = rnd(-.3, .1); r.rotation.y = rnd(-.4, .4); r.userData.ph = rnd(0, 6); rays.add(r);
  }
  scene.add(rays);
  // Fischschwärme
  const fishG = new T.ConeGeometry(.22, .8, 5); fishG.rotateX(-Math.PI / 2);
  const schools = [];
  for (let s = 0; s < 14; s++) {
    const col = [0xffc36e, 0x8fe3ff, 0xff9ec4, 0xd2b6ff][s % 4], n = 26, im = new T.InstancedMesh(fishG, new T.MeshStandardMaterial({color: col, emissive: col, emissiveIntensity: .35, metalness: .4, roughness: .3}), n);
    const d0 = rnd(30, KLEN), side = Math.random() < .5 ? -1 : 1;
    schools.push({im, n, d0, side, r: rnd(3, 6), off: Array.from({length: n}, () => [rnd(-2.5, 2.5), rnd(-1.5, 1.5), rnd(-2.5, 2.5), rnd(0, 6)]), sp: rnd(.4, .8)});
    scene.add(im);
  }
  // Blasen
  const bn = 520, bp = new Float32Array(bn * 3);
  for (let i = 0; i < bn; i++) { const d = rnd(0, KLEN), c = pathC(d); bp[i * 3] = c.x + rnd(-18, 18); bp[i * 3 + 1] = rnd(-11, 12); bp[i * 3 + 2] = -d; }
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(bp, 3));
  const bubbles = new T.Points(bg, new T.PointsMaterial({color: 0xe6faff, size: .3, map: K.glowTex(T), transparent: true, opacity: .85, depthWrite: false, blending: T.AdditiveBlending}));
  scene.add(bubbles);
  // Ringe
  const rings = {}, torus = new T.TorusGeometry(3, .28, 12, 40);
  const rmat = {a: new T.MeshStandardMaterial({color: 0xf4a8b8, emissive: 0xf47aa0, emissiveIntensity: 1, metalness: .3, roughness: .3}),
    d: new T.MeshStandardMaterial({color: 0x9cc7ff, emissive: 0x6aa8ff, emissiveIntensity: 1, metalness: .3, roughness: .3}),
    g: new T.MeshStandardMaterial({color: 0xf3c98f, emissive: 0xf3b060, emissiveIntensity: 1, metalness: .6, roughness: .25})};
  for (const it of S.items) {
    const c = pathC(it.d), m = new T.Mesh(torus, rmat[it.o]);
    m.position.set(c.x + it.x, c.y + it.y, -it.d); m.rotation.y = pathYaw(it.d);
    m.add(K.sprite(T, it.o === 'a' ? 0xf4a8b8 : it.o === 'd' ? 0x9cc7ff : 0xf3c98f, 9, .5));
    scene.add(m); rings[it.id] = m;
  }
  // Quallen
  const jel = [], jm = new T.MeshStandardMaterial({color: 0xd9a8ff, transparent: true, opacity: .6, emissive: 0x9050d0, emissiveIntensity: .8, side: T.DoubleSide});
  const jg = new T.SphereGeometry(1.1, 20, 12, 0, TAU, 0, Math.PI / 2), tg = new T.CylinderGeometry(.03, .03, 2.2, 4); tg.translate(0, -1.1, 0);
  const tm = new T.MeshBasicMaterial({color: 0xf0d8ff, transparent: true, opacity: .55});
  for (const j of (S.aux.jel || [])) {
    const c = pathC(j.d), m = new T.Mesh(jg, jm); m.position.set(c.x + j.x, c.y + j.y, -j.d);
    m.userData.ten = [];
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, tt = new T.Mesh(tg, tm); tt.position.set(Math.cos(a) * .7, 0, Math.sin(a) * .7); m.add(tt); m.userData.ten.push(tt); }
    m.add(K.sprite(T, 0xd9a8ff, 6, .5)); scene.add(m); jel.push(m);
  }
  // Muschel mit Perle am Ziel
  const ce = pathC(KLEN + 12), shellG = new T.Group();
  const shm = new T.MeshStandardMaterial({color: 0xffd6e2, roughness: .35, metalness: .2, emissive: 0x6a3040, emissiveIntensity: .3, side: T.DoubleSide});
  const lower = new T.Mesh(new T.SphereGeometry(5, 28, 12, 0, Math.PI, 0, Math.PI / 2), shm); lower.rotation.x = Math.PI; shellG.add(lower);
  const upper = new T.Mesh(new T.SphereGeometry(5, 28, 12, 0, Math.PI, 0, Math.PI / 2), shm); upper.rotation.x = -.9; upper.position.z = 0; shellG.add(upper);
  const pearl = new T.Mesh(new T.SphereGeometry(2.1, 28, 20), new T.MeshStandardMaterial({color: 0xfff6ee, emissive: 0xffe6d0, emissiveIntensity: .9, roughness: .15, metalness: .3}));
  pearl.position.y = 1.2; pearl.add(K.sprite(T, 0xffd9e6, 22, .9)); shellG.add(pearl);
  shellG.position.set(ce.x, ce.y - 3, -KLEN - 14); shellG.rotation.y = Math.PI; scene.add(shellG);
  const turtle = K.turtle(T), octo = K.sponge(T); octo.scale.setScalar(1.15); scene.add(turtle); scene.add(octo);
  // Lichtschweife der beiden
  const trails = {};
  for (const k of ['a', 'd']) {
    const n = 40, pos = new Float32Array(n * 3), g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(g, new T.PointsMaterial({color: k === 'a' ? 0xf4a8b8 : 0x9cc7ff, size: .26, map: K.glowTex(T), transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending}));
    pts.frustumCulled = false; scene.add(pts); trails[k] = {pts, n, i: 0, init: false};
  }
  const cull = [];
  scene.children.forEach(o => { if (o.isSprite || (o.userData && o.userData.ph != null)) cull.push(o); });
  jel.forEach(j => cull.includes(j) || cull.push(j)); Object.values(rings).forEach(r => cull.includes(r) || cull.push(r));
  return {scene, cam, rings, jel, bubbles, turtle, octo, rays, kelp, schools, ctex, trails, pearl, upper, cull, camPos: null};
}
const korallen = {
  id: 'korallen', n: 'Korallenflug', ic: '◯', t3: 0, t2: 0, ctrl: 'fly', three: true, noTimer: true, noClamp: true, hidePlayers: true,
  staticAux: ['jel'],
  skinName: () => `${nm('a')}: Schildkröte · ${nm('d')}: Schwamm`,
  h: () => `Schildkröte ${nm('a')} und Schwamm ${nm('d')} schwimmen durchs Korallenriff. Schwimmt durch die Ringe eurer Farbe – goldene darf jeder nehmen. Quallen bremsen euch kurz aus. Am Ende wartet die große Perle.`,
  start: k => ({x: k === 'a' ? -2.5 : 2.5, y: 0}),
  note: () => `${S.count} von ${S.total} Ringen`,
  posExtra: () => [Math.round((LOC.sw ? LOC.sw.d : 0) * 100) / 100],
  setup() {
    S.items = []; let i = 0;
    for (let d = 45; d < KLEN - 30; d += 19) { S.items.push({id: i, d, x: +rnd(-6, 6).toFixed(1), y: +rnd(-3.5, 3.5).toFixed(1), o: i % 5 === 4 ? 'g' : i % 2 ? 'd' : 'a', got: 0}); i++; }
    const jel = []; for (let k = 0; k < 16; k++) jel.push({d: Math.round(rnd(70, KLEN - 50)), x: +rnd(-7, 7).toFixed(1), y: +rnd(-4, 4).toFixed(1)});
    S.aux = {jel, pd: {a: 0, d: 0}}; S.total = S.items.length;
  },
  move(dt, inp) {
    if (!LOC.sw) LOC.sw = {d: 0};
    const sw = LOC.sw, sp = (S.p[API.me].lit ? 15 : 7) * API.diff();
    sw.d = Math.min(KLEN, sw.d + sp * dt);
    let ix = inp.vec.x, iy = inp.vec.y; if (inp.center) { ix = inp.center.x; iy = inp.center.y; }
    mine.x += inp.drag.x / 28 + ix * 10 * dt; mine.y -= inp.drag.y / 28 + iy * 10 * dt;
    mine.x = clamp(mine.x, -9, 9); mine.y = clamp(mine.y, -5.5, 5.5);
  },
  update(dt) {
    const A = S.aux;
    for (const k of ['a', 'd']) {
      const p = S.p[k], d = (p.e && p.e[0]) || 0, pd = A.pd[k];
      for (const r of S.items) {
        if (r.got || !(pd < r.d && d >= r.d)) continue;
        if ((r.o === k || r.o === 'g') && Math.hypot(p.x - r.x, p.y - r.y) < 3.7) { r.got = k; S.count++; emit({k: 'ring', o: k}); }
      }
      if (p.lit && p.inv <= 0) {
        for (const j of A.jel) if (Math.abs(d - j.d) < 1.8 && Math.hypot(p.x - j.x, p.y - j.y) < 2.5) { p.lit = 0; p.out = 0; emit({k: 'fizz', x: 0, y: 0, o: k}); emit({k: 'toast', txt: `Qualle! ${nm(k)} ist kurz betäubt.`}); break; }
      } else if (!p.lit) { p.out += dt; if (p.out > 1.4) { p.lit = 1; p.inv = 1.5; } }
      A.pd[k] = d;
    }
    const da = (S.p.a.e && S.p.a.e[0]) || 0, dd = (S.p.d.e && S.p.d.e[0]) || 0;
    if (da >= KLEN - .5 && dd >= KLEN - .5) { const pct = S.count / S.total; emit({k: 'meet', x: 0, y: 0}); finish(1.8, pct >= .85 ? 3 : pct >= .6 ? 2 : 1); }
  },
  render3d(t, part) {
    const T = window.THREE, R3 = API.renderer3D(); if (!R3) return;
    if (!S.aux.jel) return;
    if (!LOC.k3) { LOC.k3 = buildReef(T); LOC.__dispose = () => API.disposeTree(LOC.k3.scene); }
    const K = LOC.k3, sc = API.screen(), KK = KIT(), dt = Math.min(.05, K.lt ? t - K.lt : .016); K.lt = t;
    K.cam.aspect = sc.cw / sc.ch; K.cam.fov = sc.cw < sc.ch ? 72 : 60; K.cam.updateProjectionMatrix();
    const myD = LOC.sw ? LOC.sw.d : 0, pD = part.e ? part.e[0] : 0;
    const P = (x, y, d) => { const c = pathC(d); return new T.Vector3(c.x + x, c.y + y, -d); };
    const meA = API.me === 'a', meM = meA ? K.turtle : K.octo, paM = meA ? K.octo : K.turtle;
    const prevMe = meM.position.clone();
    meM.position.copy(P(mine.x, mine.y, myD)); paM.position.copy(P(part.x, part.y, pD));
    const lean = clamp((meM.position.x - prevMe.x) / Math.max(dt, .001) * .03, -.4, .4), climb = clamp((meM.position.y - prevMe.y) / Math.max(dt, .001) * .04, -.35, .35);
    meM.rotation.y = pathYaw(myD); paM.rotation.y = pathYaw(pD);
    for (const M of [K.turtle, K.octo]) {
      const lit = (M === K.turtle ? S.p.a : S.p.d).lit;
      M.position.y += Math.sin(t * 2 + (M === K.turtle ? 0 : 1)) * .15;
      M.rotation.z = lit ? Math.sin(t * 1.5) * .08 : Math.sin(t * 20) * .2;
      M.rotation.x = 0;
    }
    meM.rotation.z += -lean; meM.rotation.x = climb;
    K.turtle.userData.fl.forEach(f => { f.pv.rotation.z = Math.sin(t * 6) * .5 * f.s; f.pv.rotation.y = f.x * .3; });
    KK.animSponge(K.octo, t, true);
    for (const it of S.items) { const m = K.rings[it.id]; if (!m) continue; m.visible = !it.got && !m.userData.far; m.rotation.z = t * .6 + it.id; const s = 1 + Math.sin(t * 3 + it.id) * .05; m.scale.setScalar(s); }
    K.jel.forEach((j, i) => { j.visible = !j.userData.far; if (!j.visible) return; const s = 1 + Math.sin(t * 3 + i) * .14; j.scale.set(s, 1 / s, s); j.position.y += Math.sin(t * 1.3 + i) * .01; j.userData.ten.forEach((tt, k) => { tt.rotation.x = Math.sin(t * 3 + k + i) * .25; }); });
    K.kelp.forEach(m => { m.visible = !m.userData.far; m.rotation.z = Math.sin(t * 1.2 + m.userData.ph) * .18; });
    K.ctex.offset.set((t * .02) % 1, (t * .035) % 1);
    K.rays.children.forEach(r => { r.material.opacity = .035 + Math.sin(t * .8 + r.userData.ph) * .02; });
    const mtx = new T.Object3D();
    for (const sc2 of K.schools) {
      if (Math.abs(sc2.d0 - myD) > 140) { sc2.im.visible = false; continue; }
      sc2.im.visible = true;
      const cd = sc2.d0 + Math.sin(t * .2 * sc2.sp) * 25, c = pathC(cd), cx = c.x + sc2.side * (8 + Math.sin(t * .5) * 2), cy = c.y + 2 + Math.sin(t * .7) * 1.5;
      const a = t * sc2.sp;
      sc2.off.forEach((o, i) => {
        const x = cx + Math.cos(a + o[3]) * sc2.r + o[0], z = -cd + Math.sin(a + o[3]) * sc2.r + o[2], y = cy + o[1] + Math.sin(t * 3 + i) * .2;
        mtx.position.set(x, y, z); mtx.rotation.set(0, -(a + o[3]) + Math.PI, Math.sin(t * 9 + i) * .2); mtx.updateMatrix(); sc2.im.setMatrixAt(i, mtx.matrix);
      });
      sc2.im.instanceMatrix.needsUpdate = true;
    }
    const bp = K.bubbles.geometry.attributes.position;
    for (let i = 0; i < bp.count; i++) { let y = bp.getY(i) + .035; if (y > 12) y = -11; bp.setY(i, y); bp.setX(i, bp.getX(i) + Math.sin(t * 2 + i) * .004); }
    bp.needsUpdate = true;
    for (const [M, k] of [[K.turtle, 'a'], [K.octo, 'd']]) {
      const tr = K.trails[k], pa2 = tr.pts.geometry.attributes.position;
      if (!tr.init) { for (let i = 0; i < tr.n; i++) pa2.setXYZ(i, M.position.x, M.position.y, M.position.z); tr.init = true; }
      tr.i = (tr.i + 1) % tr.n; pa2.setXYZ(tr.i, M.position.x + rnd(-.3, .3), M.position.y + rnd(-.3, .3), M.position.z + 1.6); pa2.needsUpdate = true;
    }
    K.rays.position.z = -myD; K.rays.position.x = pathC(myD).x;
    for (const o of K.cull) { const dz = -o.position.z - myD; o.userData.far = dz < -25 || dz > 95; if (o.isSprite) o.visible = !o.userData.far; }
    K.pearl.rotation.y = t * .5; K.upper.rotation.x = -.9 - Math.max(0, 1 - Math.abs(KLEN - myD) / 60) * .3;
    const tgt = meM.position.clone(), back = new T.Vector3(Math.sin(meM.rotation.y), 0, Math.cos(meM.rotation.y));
    const want = tgt.clone().addScaledVector(back, 9.5).add(new T.Vector3(0, 3.2, 0));
    if (!K.camPos) K.camPos = want.clone(); K.camPos.lerp(want, Math.min(1, dt * 6));
    K.cam.position.copy(K.camPos); K.cam.lookAt(tgt.clone().addScaledVector(back, -6).add(new T.Vector3(0, .4, 0)));
    API.render3D(K.scene, K.cam, {bloom: .95, th: .62});
    for (const [M, k] of [[meM, API.me], [paM, API.other]]) {
      const p = KK.proj(K.cam, M.position.clone().add(new T.Vector3(0, 1.9, 0)));
      if (p.ok) KK.nameTag(`${nm(k)} ${k === 'a' ? '🐢' : '🧽'}`, p.x, p.y, COL[k]);
    }
    const bw = sc.cw - 60, by = sc.ch - 34;
    ctx.fillStyle = 'rgba(10,8,24,.5)'; rr(30, by - 6, bw, 12, 6); ctx.fill();
    for (const [d, k] of [[myD, API.me], [pD, API.other]]) { ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(30 + bw * clamp(d / KLEN, 0, 1), by, 8, 0, TAU); ctx.fill(); }
    label('Perle', sc.cw - 30, by - 14, CG, 12, 700);
  }
};

return [zueinander, korallen];
});
