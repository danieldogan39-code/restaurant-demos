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
   3D-Hilfen
   ===================================================================== */
let GT = null;
function glowTex(T) {
  if (GT) return GT;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  GT = new T.CanvasTexture(c); return GT;
}
function sprite(T, color, size, op = 1) {
  const s = new T.Sprite(new T.SpriteMaterial({map: glowTex(T), color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: op}));
  s.scale.set(size, size, 1); return s;
}
function proj(cam, v) { const p = v.clone().project(cam), s = API.screen(); return {x: (p.x * .5 + .5) * s.cw, y: (-p.y * .5 + .5) * s.ch, ok: p.z < 1 && p.z > -1}; }
function nameTag(txt, x, y, c) {
  ctx.font = '700 14px Karla, system-ui, sans-serif'; ctx.textAlign = 'center';
  const w = ctx.measureText(txt).width + 16;
  ctx.fillStyle = 'rgba(10,8,24,.6)'; rr(x - w / 2, y - 18, w, 24, 12); ctx.fill();
  ctx.fillStyle = rgba(c, 1); ctx.fillText(txt, x, y - 1);
}
function makeTurtle(T) {
  const g = new T.Group();
  const shell = new T.Mesh(new T.SphereGeometry(1, 22, 14), new T.MeshStandardMaterial({color: 0x4f9e6e, roughness: .5, metalness: .1}));
  shell.scale.set(1.25, .55, 1.5); g.add(shell);
  const plate = new T.Mesh(new T.SphereGeometry(.62, 6, 4), new T.MeshStandardMaterial({color: 0x6cbb85, roughness: .6, flatShading: true}));
  plate.scale.set(1.2, .5, 1.3); plate.position.y = .32; g.add(plate);
  const rim = new T.Mesh(new T.TorusGeometry(1, .07, 6, 30), new T.MeshStandardMaterial({color: 0xf4a8b8, emissive: 0x552030}));
  rim.rotation.x = Math.PI / 2; rim.scale.set(1.25, 1.5, 1); g.add(rim);
  const skin = new T.MeshStandardMaterial({color: 0x8fd0a0, roughness: .7});
  const head = new T.Mesh(new T.SphereGeometry(.45, 16, 12), skin); head.position.set(0, .1, -1.75); g.add(head);
  for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(.085, 8, 6), new T.MeshBasicMaterial({color: 0x111111})); e.position.set(s * .2, .25, -2.12); g.add(e); }
  const bowM = new T.MeshStandardMaterial({color: 0xf48aa3, emissive: 0x401020});
  for (const s of [-1, 1]) { const b = new T.Mesh(new T.ConeGeometry(.17, .38, 10), bowM); b.position.set(s * .22, .6, -1.65); b.rotation.z = s * Math.PI / 2; g.add(b); }
  g.userData.fl = [];
  for (const [x, z, s] of [[-1, -.7, 1], [1, -.7, -1], [-1, .9, -1], [1, .9, 1]]) {
    const pv = new T.Group(); pv.position.set(x * 1.05, -.05, z);
    const f = new T.Mesh(new T.BoxGeometry(1, .1, .45), skin); f.position.x = x * .45; pv.add(f); g.add(pv); g.userData.fl.push({pv, s, x});
  }
  g.add(Object.assign(sprite(T, 0xf4a8b8, 6, .35), {}));
  return g;
}
function makeOcto(T) {
  const g = new T.Group(), m = new T.MeshStandardMaterial({color: 0x7ea9f2, roughness: .45});
  const head = new T.Mesh(new T.SphereGeometry(1, 22, 16), m); head.scale.set(1, 1.15, 1); head.position.y = .5; g.add(head);
  for (const s of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(.27, 12, 10), new T.MeshBasicMaterial({color: 0xffffff})); e.position.set(s * .38, .62, -.8); g.add(e);
    const p = new T.Mesh(new T.SphereGeometry(.12, 8, 6), new T.MeshBasicMaterial({color: 0x1d2540})); p.position.set(s * .38, .62, -1.04); g.add(p);
    const c = new T.Mesh(new T.SphereGeometry(.13, 8, 6), new T.MeshBasicMaterial({color: 0xf4a8b8})); c.position.set(s * .62, .3, -.72); g.add(c);
  }
  g.userData.ten = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, pv = new T.Group(); pv.position.set(Math.cos(a) * .55, -.3, Math.sin(a) * .55);
    const c = new T.Mesh(new T.CylinderGeometry(.16, .05, 1.8, 6), m); c.position.y = -.9; pv.add(c);
    pv.rotation.set(Math.sin(a) * .7 + .55, 0, -Math.cos(a) * .7); g.add(pv); g.userData.ten.push({pv, a, i, bx: pv.rotation.x});
  }
  g.add(sprite(T, 0x9cc7ff, 6, .35));
  return g;
}

/* =====================================================================
   KORALLENFLUG – 3D unter Wasser: Schildkröte & Oktopus
   ===================================================================== */
const KLEN = 820;
const pathC = d => ({x: Math.sin(d * .018) * 14 + Math.sin(d * .0071) * 9, y: Math.sin(d * .011) * 4});
const pathYaw = d => { const a = pathC(d), b = pathC(d + 2); return Math.atan2(-(b.x - a.x), 2); };
function buildReef(T) {
  const scene = new T.Scene(); scene.background = new T.Color(0x0b4364); scene.fog = new T.Fog(0x0b4364, 10, 80);
  const cam = new T.PerspectiveCamera(62, 1, .1, 320);
  scene.add(new T.HemisphereLight(0xbfe9ff, 0x0d2a36, .8));
  const dl = new T.DirectionalLight(0xfff4e0, .5); dl.position.set(6, 30, 8); scene.add(dl);
  const fg = new T.PlaneGeometry(110, KLEN + 200, 22, 90); fg.rotateX(-Math.PI / 2);
  const pa = fg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i); pa.setZ(i, z - KLEN / 2); pa.setY(i, Math.sin(pa.getX(i) * .3) * .6 + Math.cos(z * .2) * .5 + Math.random() * .4); pa.setX(i, pa.getX(i) + pathC(-(z - KLEN / 2)).x); }
  fg.computeVertexNormals();
  scene.add(new T.Mesh(fg, new T.MeshLambertMaterial({color: 0x9c8660})));
  scene.children[scene.children.length - 1].position.y = -13;
  const cols = [0xf48aa3, 0xf6a85c, 0xb88cf0, 0x5fd0c0, 0xffd27a];
  const coneG = new T.ConeGeometry(.9, 3.2, 7), sphG = new T.SphereGeometry(1.1, 10, 8), cylG = new T.CylinderGeometry(.25, .35, 4, 6);
  const mats = cols.map(c => new T.MeshStandardMaterial({color: c, roughness: .8, emissive: c, emissiveIntensity: .12}));
  for (let i = 0; i < 170; i++) {
    const d = rnd(-20, KLEN + 40), side = Math.random() < .5 ? -1 : 1, c = pathC(d), kind = i % 3;
    const m = new T.Mesh(kind === 0 ? coneG : kind === 1 ? sphG : cylG, mats[i % mats.length]);
    m.position.set(c.x + side * rnd(12, 30), -11 + (kind === 1 ? .3 : 1.4), -d); m.scale.setScalar(rnd(.7, 1.8));
    m.rotation.set(rnd(-.2, .2), rnd(0, TAU), rnd(-.2, .2)); scene.add(m);
  }
  const rays = new T.Group();
  for (let i = 0; i < 9; i++) {
    const r = new T.Mesh(new T.PlaneGeometry(6, 60), new T.MeshBasicMaterial({color: 0xbfefff, transparent: true, opacity: .06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide}));
    r.position.set(rnd(-25, 25), 14, -rnd(0, 120)); r.rotation.z = rnd(-.25, .25); rays.add(r);
  }
  scene.add(rays);
  const bn = 380, bp = new Float32Array(bn * 3);
  for (let i = 0; i < bn; i++) { const d = rnd(0, KLEN), c = pathC(d); bp[i * 3] = c.x + rnd(-18, 18); bp[i * 3 + 1] = rnd(-11, 12); bp[i * 3 + 2] = -d; }
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(bp, 3));
  const bubbles = new T.Points(bg, new T.PointsMaterial({color: 0xdff6ff, size: .25, transparent: true, opacity: .7}));
  scene.add(bubbles);
  const rings = {}, torus = new T.TorusGeometry(3, .26, 8, 30);
  const rmat = {a: new T.MeshBasicMaterial({color: 0xf4a8b8}), d: new T.MeshBasicMaterial({color: 0x9cc7ff}), g: new T.MeshBasicMaterial({color: 0xf3c98f})};
  for (const it of S.items) {
    const c = pathC(it.d), m = new T.Mesh(torus, rmat[it.o]);
    m.position.set(c.x + it.x, c.y + it.y, -it.d); m.rotation.y = pathYaw(it.d);
    m.add(sprite(T, it.o === 'a' ? 0xf4a8b8 : it.o === 'd' ? 0x9cc7ff : 0xf3c98f, 8, .55));
    scene.add(m); rings[it.id] = m;
  }
  const jel = [], jm = new T.MeshStandardMaterial({color: 0xd9a8ff, transparent: true, opacity: .65, emissive: 0x7040a0, emissiveIntensity: .5});
  const jg = new T.SphereGeometry(1.1, 16, 10, 0, TAU, 0, Math.PI / 2);
  for (const j of (S.aux.jel || [])) {
    const c = pathC(j.d), m = new T.Mesh(jg, jm); m.position.set(c.x + j.x, c.y + j.y, -j.d);
    const tl = new T.Mesh(new T.CylinderGeometry(.6, .05, 1.8, 8, 1, true), new T.MeshBasicMaterial({color: 0xe6c8ff, transparent: true, opacity: .3, side: T.DoubleSide}));
    tl.position.y = -.9; m.add(tl); m.add(sprite(T, 0xd9a8ff, 5, .4)); scene.add(m); jel.push(m);
  }
  const pearl = new T.Mesh(new T.SphereGeometry(3.2, 24, 18), new T.MeshStandardMaterial({color: 0xfff6ee, emissive: 0xffe6d0, emissiveIntensity: .6, roughness: .2}));
  const ce = pathC(KLEN + 12); pearl.position.set(ce.x, ce.y, -KLEN - 12); pearl.add(sprite(T, 0xffd9e6, 24, .9)); scene.add(pearl);
  const turtle = makeTurtle(T), octo = makeOcto(T); scene.add(turtle); scene.add(octo);
  return {scene, cam, rings, jel, bubbles, turtle, octo, rays, camPos: null};
}
const korallen = {
  id: 'korallen', n: 'Korallenflug', ic: '◯', t3: 0, t2: 0, ctrl: 'fly', three: true, noTimer: true, noClamp: true, hidePlayers: true,
  staticAux: ['jel'],
  skinName: () => `${nm('a')}: Schildkröte · ${nm('d')}: Oktopus`,
  h: () => `Schildkröte ${nm('a')} und Oktopus ${nm('d')} schwimmen durchs Korallenriff. Schwimmt durch die Ringe eurer Farbe – goldene darf jeder nehmen. Quallen bremsen euch kurz aus. Am Ende wartet die große Perle.`,
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
    const K = LOC.k3, sc = API.screen();
    K.cam.aspect = sc.cw / sc.ch; K.cam.fov = sc.cw < sc.ch ? 70 : 58; K.cam.updateProjectionMatrix();
    const myD = LOC.sw ? LOC.sw.d : 0, pD = part.e ? part.e[0] : 0;
    const P = (x, y, d) => { const c = pathC(d); return new T.Vector3(c.x + x, c.y + y, -d); };
    const meA = API.me === 'a', meM = meA ? K.turtle : K.octo, paM = meA ? K.octo : K.turtle;
    meM.position.copy(P(mine.x, mine.y, myD)); paM.position.copy(P(part.x, part.y, pD));
    meM.rotation.y = pathYaw(myD); paM.rotation.y = pathYaw(pD);
    for (const M of [K.turtle, K.octo]) {
      const lit = (M === K.turtle ? S.p.a : S.p.d).lit;
      M.position.y += Math.sin(t * 2 + (M === K.turtle ? 0 : 1)) * .15;
      M.rotation.z = lit ? Math.sin(t * 1.5) * .08 : Math.sin(t * 20) * .2;
    }
    K.turtle.userData.fl.forEach(f => { f.pv.rotation.z = Math.sin(t * 6) * .5 * f.s; f.pv.rotation.y = f.x * .3; });
    K.octo.userData.ten.forEach(o => { o.pv.rotation.x = o.bx + Math.sin(t * 5 + o.i) * .25; });
    for (const it of S.items) { const m = K.rings[it.id]; if (!m) continue; m.visible = !it.got; m.rotation.z = t * .6 + it.id; }
    K.jel.forEach((j, i) => { const s = 1 + Math.sin(t * 3 + i) * .12; j.scale.set(s, 1 / s, s); });
    const bp = K.bubbles.geometry.attributes.position;
    for (let i = 0; i < bp.count; i++) { let y = bp.getY(i) + .03; if (y > 12) y = -11; bp.setY(i, y); }
    bp.needsUpdate = true;
    K.rays.position.z = -myD; K.rays.position.x = pathC(myD).x;
    const tgt = meM.position.clone(), back = new T.Vector3(Math.sin(meM.rotation.y), 0, Math.cos(meM.rotation.y));
    const want = tgt.clone().addScaledVector(back, 9.5).add(new T.Vector3(0, 3.2, 0));
    if (!K.camPos) K.camPos = want.clone(); K.camPos.lerp(want, .12);
    K.cam.position.copy(K.camPos); K.cam.lookAt(tgt.clone().addScaledVector(back, -6).add(new T.Vector3(0, .4, 0)));
    R3.render(K.scene, K.cam);
    for (const [M, k] of [[meM, API.me], [paM, API.other]]) {
      const p = proj(K.cam, M.position.clone().add(new T.Vector3(0, 1.8, 0)));
      if (p.ok) nameTag(`${nm(k)} ${k === 'a' ? '🐢' : '🐙'}`, p.x, p.y, COL[k]);
    }
    const bw = sc.cw - 60, by = sc.ch - 34;
    ctx.fillStyle = 'rgba(10,8,24,.5)'; rr(30, by - 6, bw, 12, 6); ctx.fill();
    for (const [d, k] of [[myD, API.me], [pD, API.other]]) { ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(30 + bw * clamp(d / KLEN, 0, 1), by, 8, 0, TAU); ctx.fill(); }
    label('Perle', sc.cw - 30, by - 14, CG, 12, 700);
  }
};

/* =====================================================================
   NACHTRENNEN – 3D: Aurelias SUV gegen Daniels Sportwagen
   ===================================================================== */
const TP = [[0, 0], [70, -8], [125, -45], [140, -110], [105, -165], [40, -180], [-15, -150], [-30, -100], [-85, -85], [-120, -35], [-95, 20], [-45, 25]];
const TW = 16, LAPS = 3, VMAXC = 40;
const TRACK = (() => {
  const pts = [], n = TP.length, per = 60;
  const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  for (let i = 0; i < n; i++) {
    const p0 = TP[(i - 1 + n) % n], p1 = TP[i], p2 = TP[(i + 1) % n], p3 = TP[(i + 2) % n];
    for (let k = 0; k < per; k++) { const t = k / per; pts.push({x: cr(p0[0], p1[0], p2[0], p3[0], t), z: cr(p0[1], p1[1], p2[1], p3[1], t)}); }
  }
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], r = pts[(i - 1 + pts.length) % pts.length]; p.s = s; s += Math.hypot(q.x - p.x, q.z - p.z); const tx = q.x - r.x, tz = q.z - r.z, l = Math.hypot(tx, tz); p.tx = tx / l; p.tz = tz / l; p.nx = p.tz; p.nz = -p.tx; });
  return {pts, len: s};
})();
const NPT = TRACK.pts.length;
function nearestT(x, z, hint) {
  let best = 0, bd = Infinity;
  const scan = (from, to) => { for (let k = from; k <= to; k++) { const i = ((k % NPT) + NPT) % NPT, p = TRACK.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } };
  if (hint != null) scan(hint - 50, hint + 50); else scan(0, NPT - 1);
  if (bd > 900) scan(0, NPT - 1);
  const p = TRACK.pts[best];
  return {i: best, lat: (x - p.x) * p.nx + (z - p.z) * p.nz, s: p.s};
}
const PADS = [.14, .4, .63, .86].map((f, i) => ({i: Math.floor(f * NPT), lat: [-3.5, 3, -2.5, 3.5][i]}));
function startPos(k) { const p = TRACK.pts[NPT - 10], o = k === 'a' ? -3.6 : 3.6; return {x: p.x + p.nx * o, y: p.z + p.nz * o}; }
function makeSUV(T) {
  const g = new T.Group(), paint = new T.MeshStandardMaterial({color: 0xf0a0b6, metalness: .25, roughness: .38, emissive: 0x5a2030, emissiveIntensity: .35});
  const dark = new T.MeshStandardMaterial({color: 0x1b1d2a, metalness: .3, roughness: .4}), glass = new T.MeshStandardMaterial({color: 0x223044, metalness: .6, roughness: .1});
  const body = new T.Mesh(new T.BoxGeometry(2.3, 1.15, 4.6), paint); body.position.y = 1.05; g.add(body);
  const cab = new T.Mesh(new T.BoxGeometry(2.1, .9, 2.9), glass); cab.position.set(0, 2.05, .25); g.add(cab);
  const roof = new T.Mesh(new T.BoxGeometry(2.15, .12, 2.7), paint); roof.position.set(0, 2.55, .3); g.add(roof);
  for (const s of [-1, 1]) { const rl = new T.Mesh(new T.BoxGeometry(.08, .1, 2.4), dark); rl.position.set(s * .9, 2.66, .3); g.add(rl); }
  const skirt = new T.Mesh(new T.BoxGeometry(2.35, .35, 4.65), dark); skirt.position.y = .55; g.add(skirt);
  addWheels(T, g, 1.2, .5, 1.45, .55);
  addLights(T, g, 1.05, 2.31, 1.0, .75);
  return g;
}
function makeSport(T) {
  const g = new T.Group(), paint = new T.MeshStandardMaterial({color: 0x9cc2ff, metalness: .3, roughness: .3, emissive: 0x1a3060, emissiveIntensity: .4});
  const dark = new T.MeshStandardMaterial({color: 0x15171f, metalness: .4, roughness: .4}), glass = new T.MeshStandardMaterial({color: 0x18202e, metalness: .7, roughness: .08});
  const body = new T.Mesh(new T.BoxGeometry(2.2, .6, 4.9), paint); body.position.y = .65; g.add(body);
  const nose = new T.Mesh(new T.BoxGeometry(2.1, .35, 1.2), paint); nose.position.set(0, .55, -2.3); nose.rotation.x = .12; g.add(nose);
  const cab = new T.Mesh(new T.BoxGeometry(1.7, .55, 1.9), glass); cab.position.set(0, 1.15, .35); cab.scale.set(1, 1, 1); g.add(cab);
  const wing = new T.Mesh(new T.BoxGeometry(2.1, .08, .45), dark); wing.position.set(0, 1.25, 2.3); g.add(wing);
  for (const s of [-1, 1]) { const st = new T.Mesh(new T.BoxGeometry(.08, .35, .2), dark); st.position.set(s * .8, 1.05, 2.3); g.add(st); }
  const stripe = new T.Mesh(new T.BoxGeometry(.35, .02, 4.9), new T.MeshStandardMaterial({color: 0xffffff, metalness: .3, roughness: .4})); stripe.position.set(0, .96, 0); g.add(stripe);
  addWheels(T, g, 1.15, .42, 1.55, .42);
  addLights(T, g, .65, 2.46, .85, .5);
  return g;
}
function addWheels(T, g, x, r, z, y) {
  const wm = new T.MeshStandardMaterial({color: 0x101014, roughness: .8}), rim = new T.MeshStandardMaterial({color: 0xd8d8e0, metalness: .9, roughness: .2});
  g.userData.wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new T.Group(); w.position.set(sx * x, y, sz * z);
    const t = new T.Mesh(new T.CylinderGeometry(r, r, .42, 16), wm); t.rotation.z = Math.PI / 2; w.add(t);
    const c = new T.Mesh(new T.CylinderGeometry(r * .55, r * .55, .44, 8), rim); c.rotation.z = Math.PI / 2; w.add(c);
    g.add(w); g.userData.wheels.push(w);
  }
}
function addLights(T, g, y, z, x, h) {
  const hl = new T.MeshBasicMaterial({color: 0xfff6dd}), tl = new T.MeshBasicMaterial({color: 0xff3355});
  for (const s of [-1, 1]) {
    const a = new T.Mesh(new T.BoxGeometry(.45, .18, .05), hl); a.position.set(s * x, y + .1, -z); g.add(a);
    const b = new T.Mesh(new T.BoxGeometry(.5, .16, .05), tl); b.position.set(s * x, y + .12, z); g.add(b);
    const gs = sprite(T, 0xfff2c8, 3, .8); gs.position.set(s * x, y + .1, -z - .2); g.add(gs);
    const rs = sprite(T, 0xff3355, 2.2, .7); rs.position.set(s * x, y + .12, z + .2); g.add(rs);
  }
  const beam = new T.Mesh(new T.PlaneGeometry(4, 14), new T.MeshBasicMaterial({color: 0xfff1c0, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false}));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, .05, -z - 7); g.add(beam);
}
function buildTrack(T) {
  const scene = new T.Scene(); scene.background = new T.Color(0x090a1c); scene.fog = new T.Fog(0x090a1c, 70, 300);
  const cam = new T.PerspectiveCamera(65, 1, .3, 900);
  scene.add(new T.HemisphereLight(0xb0bcff, 0x20222e, 1.15)); scene.add(new T.AmbientLight(0xffffff, .25));
  const moonL = new T.DirectionalLight(0xc8d4ff, .55); moonL.position.set(-80, 120, -60); scene.add(moonL);
  const ground = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshLambertMaterial({color: 0x0f2118})); ground.rotation.x = -Math.PI / 2; ground.position.set(10, -.02, -80); scene.add(ground);
  const P = TRACK.pts, nv = (NPT + 1) * 2;
  const mk = (w0, w1, y, colorFn) => {
    const pos = new Float32Array(nv * 3), col = colorFn ? new Float32Array(nv * 3) : null, idx = [];
    for (let i = 0; i <= NPT; i++) {
      const p = P[i % NPT];
      for (let s = 0; s < 2; s++) { const w = s ? w1 : w0, j = (i * 2 + s) * 3; pos[j] = p.x + p.nx * w; pos[j + 1] = y; pos[j + 2] = p.z + p.nz * w; if (col) { const c = colorFn(i); col[j] = c[0]; col[j + 1] = c[1]; col[j + 2] = c[2]; } }
      if (i < NPT) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); if (col) g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  scene.add(new T.Mesh(mk(-TW / 2, TW / 2, .01), new T.MeshLambertMaterial({color: 0x2a2838, side: T.DoubleSide})));
  const kerb = i => (Math.floor(i / 6) % 2 ? [.96, .66, .72] : [.61, .78, 1]);
  scene.add(new T.Mesh(mk(-TW / 2 - 1.1, -TW / 2, .03, kerb), new T.MeshBasicMaterial({vertexColors: true, side: T.DoubleSide})));
  scene.add(new T.Mesh(mk(TW / 2, TW / 2 + 1.1, .03, kerb), new T.MeshBasicMaterial({vertexColors: true, side: T.DoubleSide})));
  const dashG = new T.PlaneGeometry(.35, 3), dash = new T.InstancedMesh(dashG, new T.MeshBasicMaterial({color: 0xe8e4f0}), Math.floor(NPT / 12));
  const dm = new T.Object3D();
  for (let k = 0; k < dash.count; k++) { const p = P[k * 12]; dm.position.set(p.x, .04, p.z); dm.rotation.set(-Math.PI / 2, 0, Math.atan2(p.tx, p.tz)); dm.updateMatrix(); dash.setMatrixAt(k, dm.matrix); }
  scene.add(dash);
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 16; const cg = cc.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { cg.fillStyle = (x + y) % 2 ? '#111' : '#fff'; cg.fillRect(x * 4, y * 4, 4, 4); }
  const p0 = P[0], start = new T.Mesh(new T.PlaneGeometry(TW, 2.4), new T.MeshBasicMaterial({map: new T.CanvasTexture(cc)}));
  start.rotation.set(-Math.PI / 2, 0, Math.atan2(p0.tx, p0.tz) + Math.PI / 2); start.position.set(p0.x, .05, p0.z); scene.add(start);
  const ac = document.createElement('canvas'); ac.width = 64; ac.height = 128; const ag = ac.getContext('2d');
  ag.strokeStyle = '#ffd27a'; ag.lineWidth = 10; ag.lineCap = 'round';
  for (let k = 0; k < 3; k++) { ag.beginPath(); ag.moveTo(10, 40 + k * 32); ag.lineTo(32, 18 + k * 32); ag.lineTo(54, 40 + k * 32); ag.stroke(); }
  const atex = new T.CanvasTexture(ac);
  for (const pd of PADS) {
    const p = P[pd.i], m = new T.Mesh(new T.PlaneGeometry(3.4, 6), new T.MeshBasicMaterial({map: atex, transparent: true, blending: T.AdditiveBlending, depthWrite: false}));
    m.rotation.set(-Math.PI / 2, 0, Math.atan2(p.tx, p.tz) + Math.PI); m.position.set(p.x + p.nx * pd.lat, .06, p.z + p.nz * pd.lat); scene.add(m);
  }
  const poleG = new T.CylinderGeometry(.12, .16, 7, 6), lampN = Math.floor(NPT / 30) * 2;
  const poles = new T.InstancedMesh(poleG, new T.MeshLambertMaterial({color: 0x3a3a4a}), lampN);
  let li = 0;
  for (let k = 0; k < NPT; k += 30) for (const s of [-1, 1]) {
    const p = P[k], x = p.x + p.nx * s * (TW / 2 + 3), z = p.z + p.nz * s * (TW / 2 + 3);
    dm.position.set(x, 3.5, z); dm.rotation.set(0, 0, 0); dm.updateMatrix(); poles.setMatrixAt(li++, dm.matrix);
    const g = sprite(T, s < 0 ? 0xffc0d0 : 0xc0d8ff, 7, .85); g.position.set(x, 7.2, z); scene.add(g);
    const b = new T.Mesh(new T.SphereGeometry(.35, 8, 6), new T.MeshBasicMaterial({color: 0xfff4e0})); b.position.set(x, 7.1, z); scene.add(b);
  }
  scene.add(poles);
  const wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; const wg = wc.getContext('2d');
  wg.fillStyle = '#12142a'; wg.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 10) { if (Math.random() < .45) { wg.fillStyle = ['#ffd9a0', '#ffe9c0', '#bcd8ff', '#ffc0d6'][(x + y) % 4]; wg.fillRect(x, y, 6, 6); } }
  const wtex = new T.CanvasTexture(wc);
  const bmat = new T.MeshBasicMaterial({map: wtex});
  for (let k = 0; k < 90; k++) {
    let x, z, ok = false;
    for (let tries = 0; tries < 30 && !ok; tries++) { const a = rnd(0, TAU), r = rnd(170, 330); x = 10 + Math.cos(a) * r; z = -80 + Math.sin(a) * r; ok = Math.abs(nearestT(x, z).lat) > 40; }
    const h = rnd(14, 70), w = rnd(10, 22), b = new T.Mesh(new T.BoxGeometry(w, h, w), bmat); b.position.set(x, h / 2, z); scene.add(b);
  }
  const sn = 500, sp = new Float32Array(sn * 3);
  for (let i = 0; i < sn; i++) { const a = rnd(0, TAU), e = rnd(.15, 1.4), r = 600; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  scene.add(new T.Points(sg, new T.PointsMaterial({color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false})));
  const moon = sprite(T, 0xfff2d6, 120, .9); moon.position.set(-200, 260, -400); moon.material.fog = false; scene.add(moon);
  const suv = makeSUV(T), sport = makeSport(T); scene.add(suv); scene.add(sport);
  return {scene, cam, cars: {a: suv, d: sport}, camPos: null};
}
const rennen = {
  id: 'rennen', n: 'Nachtrennen', ic: '⚑', t3: 70, t2: 100, ctrl: 'drive', three: true, noClamp: true, hidePlayers: true, eAngle: [0],
  skinName: () => `${nm('a')}: SUV · ${nm('d')}: Sportwagen`,
  h: () => `${nm('a')} im rosé SUV gegen ${nm('d')} im blauen Sportwagen – drei Runden durch die Lichterstadt! Goldene Pfeile geben Turbo. Die Sterne gibt's, wenn ihr beide im Ziel seid.`,
  start: k => startPos(k),
  countText: () => `Runde ${Math.min(LAPS, ((LOC.car && LOC.car.lap) || 0) + 1)}/${LAPS}`,
  posExtra: () => { const c = LOC.car; return c ? [Math.round(c.h * 1000) / 1000, Math.round(c.prog * 1000) / 1000, Math.round(c.v * 10) / 10] : null; },
  note: () => { const f = S.aux.fin || {}; if (f.a == null || f.d == null) return ''; const w = f.a <= f.d ? 'a' : 'd'; return `${nm(w)} gewinnt mit ${Math.abs(f.a - f.d).toFixed(1)} s Vorsprung!`; },
  setup() { S.aux = {fin: {}}; S.total = LAPS * 2; },
  move(dt, inp) {
    if (!LOC.car) { const n = nearestT(mine.x, mine.y), p = TRACK.pts[n.i]; LOC.car = {h: Math.atan2(p.tx, p.tz), v: 0, lap: 0, mid: false, started: false, lastP: n.s / TRACK.len, idx: n.i, boost: 0, done: false, prog: 0, bump: 0}; }
    const c = LOC.car, n = nearestT(mine.x, mine.y, c.idx); c.idx = n.i;
    const off = Math.abs(n.lat) > TW / 2 + 1.5;
    c.boost = Math.max(0, c.boost - dt);
    for (const pd of PADS) if (Math.abs(n.i - pd.i) < 4 && Math.abs(n.lat - pd.lat) < 2.6 && c.boost <= 0) { c.boost = 1.4; tone(988, .25, .05, 'sawtooth'); buzz(15); }
    let tv = c.done ? 0 : VMAXC * API.diff() * (c.boost > 0 ? 1.35 : 1) * (off ? .45 : 1);
    if (inp.brake) tv = Math.min(tv, 12);
    c.v += clamp(tv - c.v, -45 * dt, (c.boost > 0 ? 40 : 20) * dt);
    c.h += inp.steer * 1.9 * dt * clamp(c.v / 14, .25, 1);
    mine.x += Math.sin(c.h) * c.v * dt; mine.y += Math.cos(c.h) * c.v * dt;
    if (Math.abs(n.lat) > TW / 2 + 12) { const p = TRACK.pts[n.i], k = (Math.abs(n.lat) - (TW / 2 + 12)) * Math.sign(n.lat); mine.x -= p.nx * k; mine.y -= p.nz * k; c.v *= .9; }
    const o = API.partner(), dx = mine.x - o.x, dz = mine.y - o.y, dd = Math.hypot(dx, dz);
    if (dd < 3.3 && dd > .01) { mine.x += dx / dd * (3.3 - dd) * .6; mine.y += dz / dd * (3.3 - dd) * .6; c.v *= .97; if (c.bump <= 0) { tone(140, .15, .05, 'square'); buzz(25); c.bump = .5; } }
    c.bump -= dt;
    const pr = n.s / TRACK.len;
    if (c.lastP > .8 && pr < .2) { if (!c.started) c.started = true; else if (c.mid) { c.lap++; c.mid = false; if (c.lap < LAPS) { toast(`Runde ${c.lap + 1}!`); tone(880, .3, .05, 'square'); } } }
    else if (c.lastP < .2 && pr > .8 && c.started) { /* rückwärts über die Linie */ }
    if (pr > .45 && pr < .6 && c.started) c.mid = true;
    if (!c.started && pr < .5) c.started = true;
    c.lastP = pr;
    if (c.lap >= LAPS && !c.done) { c.done = true; toast('Im Ziel! 🏁'); }
    c.prog = c.started ? Math.min(LAPS, c.lap + (c.lap >= LAPS ? 0 : pr)) : 0;
  },
  update() {
    const A = S.aux; let cnt = 0;
    for (const k of ['a', 'd']) {
      const e = S.p[k].e, pg = e ? e[1] : 0;
      cnt += Math.min(LAPS, Math.floor(pg + 1e-6));
      if (pg >= LAPS - 1e-6 && A.fin[k] == null) { A.fin[k] = Math.round((S.t - S.lt) * 10) / 10; emit({k: 'lap', o: k}); emit({k: 'toast', txt: `${nm(k)} ist im Ziel! (${A.fin[k]} s)`}); }
    }
    S.count = cnt;
    if (A.fin.a != null && A.fin.d != null) finish(2.2);
  },
  render3d(t, part) {
    const T = window.THREE, R3 = API.renderer3D(); if (!R3) return;
    if (!LOC.r3) { LOC.r3 = buildTrack(T); LOC.__dispose = () => API.disposeTree(LOC.r3.scene); }
    const K = LOC.r3, sc = API.screen();
    K.cam.aspect = sc.cw / sc.ch; K.cam.fov = sc.cw < sc.ch ? 72 : 60; K.cam.updateProjectionMatrix();
    const meK = API.me, oK = API.other, c = LOC.car;
    const myH = c ? c.h : (() => { const n = nearestT(mine.x, mine.y), p = TRACK.pts[n.i]; return Math.atan2(p.tx, p.tz); })();
    const oE = part.e || [myH, 0, 0];
    const place = (car, x, z, h, v) => { car.position.set(x, 0, z); car.rotation.y = h + Math.PI; car.userData.wheels.forEach(w => { w.children[0].rotation.x += v * .03; }); };
    place(K.cars[meK], mine.x, mine.y, myH, c ? c.v : 0);
    place(K.cars[oK], part.x, part.y, oE[0], oE[2] || 0);
    K.cars[meK].rotation.z = c ? -0 : 0;
    const f = new T.Vector3(Math.sin(myH), 0, Math.cos(myH)), base = new T.Vector3(mine.x, 0, mine.y);
    const want = base.clone().addScaledVector(f, -10.5).add(new T.Vector3(0, 4.6, 0));
    if (!K.camPos) K.camPos = want.clone(); K.camPos.lerp(want, .14);
    K.cam.position.copy(K.camPos); K.cam.lookAt(base.clone().addScaledVector(f, 7).add(new T.Vector3(0, 1.2, 0)));
    R3.render(K.scene, K.cam);
    const pp = proj(K.cam, new T.Vector3(part.x, 3.6, part.y));
    if (pp.ok) nameTag(oK === 'a' ? `${nm('a')}s SUV` : `${nm('d')}s Sportwagen`, pp.x, pp.y, COL[oK]);
    const mx = sc.cw - 104, my = 78, ms = .34;
    ctx.fillStyle = 'rgba(10,8,24,.55)'; rr(mx - 8, my - 8, 100, 92, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath();
    const toM = (x, z) => [mx + 42 + (x - 10) * ms, my + 40 + (z + 78) * ms];
    TRACK.pts.forEach((p, i) => { if (i % 6) return; const [a, b] = toM(p.x, p.z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); ctx.stroke();
    for (const [x, z, k] of [[part.x, part.y, oK], [mine.x, mine.y, meK]]) { const [a, b] = toM(x, z); ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(a, b, 4.5, 0, TAU); ctx.fill(); }
    if (S.phase === 'play' && c) {
      const myP = c.prog, oP = oE[1] || 0, first = myP >= oP;
      ctx.font = '700 22px Karla, system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = first ? '#f3c98f' : '#cfc8e0';
      ctx.fillText(first ? 'Platz 1' : 'Platz 2', 16, 94);
      ctx.font = '600 14px Karla, system-ui'; ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillText(`${Math.round(c.v * 4.2)} km/h${c.boost > 0 ? ' · TURBO' : ''}`, 16, 116);
    }
  }
};

return [zueinander, korallen, rennen];
});
