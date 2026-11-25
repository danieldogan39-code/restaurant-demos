/* Zwei Lichter – Korallenflug v2 (ab 8.2)
   Schildkröte und Schwamm schwimmen durch Riff, Tangwald, Höhle und am Wrack vorbei zur großen Perle.
   Neu: weiches Schwimmen mit Trägheit (Daumen ziehen, die Figur folgt), Zielhilfe, Schub-Knopf, Strömung,
   realistischere Unterwasserwelt – und jeder Ring legt ein Stück eines Bildes frei, das sich am Ende zusammensetzt. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CG, rgba, rnd, clamp, nm, emit, finish, hostNow, tone, buzz, rr, mine} = API;
const KIT = () => window.ZL_KIT(API), REAL = () => window.ZL_REAL(API), FOTO = window.ZL_FOTO;
const KLEN = 820, NR = 40, MX = 5, MY = 8;
const ownerOf = i => i % 5 === 4 ? 'g' : i % 2 ? 'd' : 'a';
/* Aurelias Ringe legen die linke Bildhälfte frei, Daniels die rechte, die goldenen den Streifen in der Mitte */
const TILE = (() => { const pool = {a: [], g: [], d: []}, out = []; for (let ty = 0; ty < MY; ty++) for (let tx = 0; tx < MX; tx++) pool[tx < 2 ? 'a' : tx > 2 ? 'd' : 'g'].push(ty * MX + tx);
  const ord = {a: FOTO.perm(16, 77), g: FOTO.perm(8, 78), d: FOTO.perm(16, 79)}, n = {a: 0, g: 0, d: 0}; for (let i = 0; i < NR; i++) { const o = ownerOf(i); out.push(pool[o][ord[o][n[o]++]]); } return out; })();
const pathC = d => ({x: Math.sin(d * .018) * 14 + Math.sin(d * .0071) * 9, y: Math.sin(d * .011) * 4});
const pathYaw = d => { const a = pathC(d), b = pathC(d + 2); return Math.atan2(-(b.x - a.x), 2); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const cave = d => sstep(468, 500, d) - sstep(618, 650, d);
const BX = d => 9 - 3.4 * cave(d), BY = d => 5.5 - 2.1 * cave(d);
const cur = d => 3.2 * Math.sin((d - 250) * TAU / 110) * (sstep(250, 275, d) - sstep(440, 462, d));
const jelY = (j, i, t) => j.y + Math.sin(t * .8 + i * 1.7) * 1.2;
/* Riffkanal: in der Mitte Sand, an beiden Seiten steigen die Korallenhänge bis auf Augenhöhe */
const floorH = (xl, d) => -11.5 + Math.sin(xl * .3) * .5 + Math.cos(d * .2) * .5 + Math.sin(xl * .11 + d * .07) * 1 + Math.min(15, Math.max(0, Math.abs(xl) - 8) * (.62 + .2 * Math.sin(d * .05 + Math.sign(xl))));

/* ---------- Steuerung: Daumen irgendwo auflegen und ziehen, rechts unten der Schub ---------- */
const sprintZone = (cw, ch) => ({x: cw - 70, y: ch - 128, r: 46});
function readPad(inp, dt) {
  const P = inp.pad, out = {dx: 0, dy: 0, sprint: false};
  if (!P) return out;
  const Z = sprintZone(P.cw, P.ch); let st = null;
  for (const T of P.tp) {
    if (!T.role) { T.role = Math.hypot(T.sx - Z.x, T.sy - Z.y) < Z.r + 12 ? 'sprint' : 'steer'; T.px = T.x; T.py = T.y; }
    if (T.role === 'sprint') out.sprint = true; else if (!st) st = T;
  }
  if (st) { const k = 26 / Math.min(P.cw, 520); out.dx = (st.x - st.px) * k; out.dy = -(st.y - st.py) * k; st.px = st.x; st.py = st.y; }
  else if (P.tilt) { out.dx = P.tilt.x * 13 * dt; out.dy = -P.tilt.y * 10 * dt; }
  const kx = (P.key('arrowright') || P.key('d') ? 1 : 0) - (P.key('arrowleft') || P.key('a') ? 1 : 0), ky = (P.key('arrowup') || P.key('w') ? 1 : 0) - (P.key('arrowdown') || P.key('s') ? 1 : 0);
  out.dx += kx * 14 * dt; out.dy += ky * 11 * dt; if (P.key(' ')) out.sprint = true;
  LOC.padUI = {st};
  return out;
}

/* ---------- Texturen ---------- */
function causticTex(T) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'lighter'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 26;
    g.strokeStyle = `rgba(190,245,255,${.12 + Math.random() * .25})`; g.beginPath();
    for (let k = 0; k <= 7; k++) { const a = k / 7 * TAU, r2 = r * (.7 + Math.random() * .5); k ? g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2) : g.moveTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); }
    g.stroke();
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
function buildReef(T) {
  const K = KIT(), R = REAL(), scene = new T.Scene(), r0 = R.rng(808), D = new T.Object3D(), col = new T.Color(), upd = [];
  scene.fog = new T.FogExp2(0x0b4f6c, .021);
  const skyM = K.sky(T, 0x2a8db2, 0x0d5878, 0x041a2a, 150); scene.add(skyM);
  scene.environment = K.env(T, 'sea3', 0x3aa0c4, 0x0e5876, 0x03141f, [[0, 50, 0, 30, 30, 0x9fd8ee]]);
  const cam = new T.PerspectiveCamera(62, 1, .1, 170);
  const hemi = new T.HemisphereLight(0xb4ecfa, 0x0c3040, .85); scene.add(hemi);
  const sun = new T.DirectionalLight(0xe8f8ff, .6); sun.position.set(6, 30, 8); scene.add(sun);
  const openD = () => { let d; do { d = -20 + r0() * (KLEN + 70); } while (d > 455 && d < 662); return d; };
  const spot = (lat0, lat1) => { const d = openD(), c = pathC(d), l = (r0() < .5 ? -1 : 1) * (lat0 + r0() * (lat1 - lat0)); return {x: c.x + l, y: floorH(l, d), z: -d, d, l}; };

  /* Sandboden mit Rippeln, darüber wandernde Lichtnetze */
  const fg = new T.PlaneGeometry(130, KLEN + 240, 36, 150); fg.rotateX(-Math.PI / 2);
  const pa = fg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const d = -(pa.getZ(i) - KLEN / 2), xl = pa.getX(i); pa.setZ(i, -d); pa.setY(i, floorH(xl, d)); pa.setX(i, xl + pathC(d).x); }
  fg.computeVertexNormals();
  const sc = R.canvas(256), sg = sc.getContext('2d'); sg.fillStyle = '#b9a67c'; sg.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 9) { sg.strokeStyle = `rgba(86,70,44,${.22 + r0() * .2})`; sg.lineWidth = 3 + r0() * 2; sg.beginPath(); for (let x = -8; x <= 264; x += 8) { const yy = y + Math.sin(x * .049 + y * .3) * 3.2; x < 0 ? sg.moveTo(x, yy) : sg.lineTo(x, yy); } sg.stroke(); }
  for (let i = 0; i < 2600; i++) { sg.fillStyle = r0() < .5 ? 'rgba(60,48,30,.25)' : 'rgba(240,228,196,.25)'; sg.fillRect(r0() * 256, r0() * 256, 1.5, 1.5); }
  const sandT = new T.CanvasTexture(sc), sandN = R.nmap(T, sc, 3); for (const t of [sandT, sandN]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(16, 130); }
  const floor = new T.Mesh(fg, new T.MeshStandardMaterial({map: sandT, normalMap: sandN, color: 0xa8b8a8, roughness: .95, envMapIntensity: .2})); scene.add(floor);
  const ctex = causticTex(T); ctex.repeat.set(9, 62);
  const caus = new T.Mesh(fg, new T.MeshBasicMaterial({map: ctex, transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false})); caus.position.y = .06; scene.add(caus);

  /* Korallen: Geweih, Röhren, Tische, Hirn, Fächer, Anemonen */
  const selfGlow = (m, k) => { m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * ' + k.toFixed(2) + ';\n#endif'); }; return m; };
  const PAL = [0xc8607a, 0xd98a4a, 0x8a6cc0, 0x4aa89a, 0xd8b060, 0xb85a68, 0x6a8ac8, 0xe0a0a8];
  const stag = []; for (let k = 0; k < 11; k++) { const len = .9 + r0() * 1.3, cg = new T.CylinderGeometry(.045, .12, len, 5); cg.translate(0, len / 2, 0); cg.rotateZ((r0() - .5) * 1.5); cg.rotateY(r0() * TAU); cg.translate((r0() - .5) * .5, 0, (r0() - .5) * .5); stag.push(cg); }
  const tubes = []; for (let k = 0; k < 6; k++) { const h = .8 + r0() * 1.4, cg = new T.CylinderGeometry(.2 + r0() * .1, .15, h, 8, 1, true); cg.translate(0, h / 2, 0); cg.rotateZ((r0() - .5) * .35); cg.translate((r0() - .5) * .9, 0, (r0() - .5) * .9); tubes.push(cg); }
  const tStalk = new T.CylinderGeometry(.16, .3, .9, 6); tStalk.translate(0, .45, 0); const tTop = new T.CylinderGeometry(1.25, .9, .16, 11); tTop.translate(0, .95, 0);
  const anem = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, cg = new T.ConeGeometry(.05, .7, 4); cg.translate(0, .35, 0); cg.rotateZ(.5 + (k % 2) * .3); cg.rotateY(a); anem.push(cg); }
  const brain = new T.IcosahedronGeometry(1, 2); { const bp = brain.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), n = 1 + .07 * Math.sin(x * 9) * Math.sin(y * 8 + z * 7); bp.setXYZ(i, x * n, Math.max(-.2, y * n * .7), z * n); } brain.computeVertexNormals(); }
  const kinds = [[R.merge(T, stag), 110, 1.2, false], [R.merge(T, tubes), 80, 1.1, true], [R.merge(T, [tStalk, tTop]), 60, 1.3, false], [brain, 90, 1.1, false], [R.merge(T, anem), 100, 1.2, false]];
  kinds.forEach(([geo, n, s0, dbl], gi) => {
    const im = new T.InstancedMesh(geo, selfGlow(new T.MeshStandardMaterial({color: 0xffffff, roughness: .82, flatShading: gi === 0 || gi === 4, side: dbl ? T.DoubleSide : T.FrontSide, envMapIntensity: .3}), .34), n);
    for (let i = 0; i < n; i++) { const p = spot(9.5, 27); D.position.set(p.x, p.y - .1, p.z); D.rotation.set((r0() - .5) * .2, r0() * TAU, (r0() - .5) * .2); D.scale.setScalar(s0 * (.7 + r0() * 1.3)); D.updateMatrix(); im.setMatrixAt(i, D.matrix); col.setHex(PAL[(r0() * PAL.length) | 0]).multiplyScalar(.75 + r0() * .3); im.setColorAt(i, col); }
    im.frustumCulled = false; im.instanceColor.needsUpdate = true; scene.add(im);
  });
  const fanT = R.paint(T, 128, 128, (g) => { g.lineCap = 'round'; const br = (x, y, a, l, w) => { if (l < 7) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a - .32 - r0() * .2, l * .76, w * .72); br(x2, y2, a + .32 + r0() * .2, l * .76, w * .72); }; g.strokeStyle = '#f2f2f2'; br(64, 128, -Math.PI / 2, 34, 6); });
  const fp1 = new T.PlaneGeometry(2.4, 2.4); fp1.translate(0, 1.2, 0); const fan = new T.InstancedMesh(fp1, selfGlow(new T.MeshStandardMaterial({map: fanT, alphaTest: .35, side: T.DoubleSide, roughness: .9}), .38), 110);
  for (let i = 0; i < 110; i++) { const p = spot(9.5, 26); D.position.set(p.x, p.y, p.z); D.rotation.set(0, r0() * TAU, 0); D.scale.setScalar(.8 + r0() * 1.3); D.updateMatrix(); fan.setMatrixAt(i, D.matrix); col.setHex([0xd0607a, 0xc890d8, 0xe0a050, 0xd87888][i % 4]); fan.setColorAt(i, col); }
  fan.frustumCulled = false; fan.instanceColor.needsUpdate = true; scene.add(fan);
  // Felsen, Kiesel, Seegras, Weichkorallen
  for (let i = 0; i < 14; i++) { const p = spot(15, 34), rk = R.rock(T, 2.5 + r0() * 3.5, i + 2, {flat: .6 + r0() * .3, mat: {color: 0x8aa0a0}}); rk.castShadow = rk.receiveShadow = false; rk.position.set(p.x, p.y + .4, p.z); rk.rotation.y = r0() * 6; scene.add(rk); }
  const mk = (n, a, b, s0, s1) => Array.from({length: n}, () => { const p = spot(a, b); p.s = s0 + r0() * (s1 - s0); return p; });
  scene.add(R.stones(T, mk(130, 9, 30, .25, .9), {noShadow: true, mat: {color: 0x90a4a4}}));
  scene.add(R.plants(T, 'grass', mk(380, 8, 30, 1, 2), {w: 1.3, h: 1.4, seed: 2, color: 0x7fc0a0}));
  scene.add(R.plants(T, 'fern', mk(170, 9.5, 28, .9, 1.8), {w: 1.4, h: 1.3, seed: 3, color: 0xf0a0b8}));
  scene.add(R.plants(T, 'fern', mk(110, 9.5, 28, .9, 1.6), {w: 1.3, h: 1.2, seed: 4, color: 0xf0c070}));

  /* Tangwald: alle Halme in einem Zeichenaufruf, das Wiegen rechnet die Grafikkarte */
  const kT = R.paint(T, 64, 256, (g) => { g.strokeStyle = '#5f8a4a'; g.lineWidth = 5; g.beginPath(); for (let y = 256; y >= 0; y -= 8) { const x = 32 + Math.sin(y * .05) * 7; y === 256 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); for (let y = 240; y > 14; y -= 15) { const x = 32 + Math.sin(y * .05) * 7, s = (y / 15) % 2 ? 1 : -1; g.fillStyle = `rgb(${70 + r0() * 30 | 0},${116 + r0() * 40 | 0},${58 + r0() * 20 | 0})`; g.beginPath(); g.ellipse(x + s * 13, y - 5, 13, 5.5, s * -.5, 0, TAU); g.fill(); } });
  const kg = new T.PlaneGeometry(1.5, 10, 1, 10); kg.translate(0, 5, 0); const kg2 = kg.clone(); kg2.rotateY(Math.PI / 2);
  const kU = {uT: {value: 0}}, kM = new T.MeshStandardMaterial({map: kT, alphaTest: .4, side: T.DoubleSide, roughness: .9, emissive: 0x0a2414});
  kM.onBeforeCompile = sh => { sh.uniforms.uT = kU.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float kph = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .23; transformed.x += sin(uT * 1.1 + kph + position.y * .32) * position.y * .075; transformed.z += cos(uT * .8 + kph * 1.3 + position.y * .27) * position.y * .05;`); };
  const KN = 300, kelp = new T.InstancedMesh(R.merge(T, [kg, kg2]), kM, KN);
  for (let i = 0; i < KN; i++) { const dense = i < 190, d = dense ? 245 + r0() * 215 : openD(), c = pathC(d), l = (r0() < .5 ? -1 : 1) * (dense ? 10 + r0() * 16 : 11 + r0() * 20); D.position.set(c.x + l, floorH(l, d) - .2, -d); D.rotation.set(0, r0() * TAU, 0); D.scale.set(1, .8 + r0() * 1.5, 1); D.updateMatrix(); kelp.setMatrixAt(i, D.matrix); }
  kelp.frustumCulled = false; scene.add(kelp);

  /* Höhle: Felsröhre mit leuchtenden Kristallen und Meeresleuchten */
  const C0 = 462, C1 = 656, CS = 2.5, SEG = 18, tp = [], tuv = [], ti = [], wall = (d, a) => { const c = pathC(d), k = cave(d), open = 1 + (1 - k) * 1.5, n = 1 + .16 * Math.sin(a * 3 + d * .21) + .1 * Math.sin(a * 5 - d * .13); return [c.x + Math.cos(a) * (BX(d) + 4.6) * n * open, c.y + Math.sin(a) * (BY(d) + 4.2) * n * open, -d]; };
  const rows = Math.round((C1 - C0) / CS);
  for (let i = 0; i <= rows; i++) for (let k = 0; k <= SEG; k++) { const d = C0 + i * CS, a = k / SEG * TAU; tp.push(...wall(d, a)); tuv.push(k / SEG * 5, d / 9); }
  for (let i = 0; i < rows; i++) for (let k = 0; k < SEG; k++) { const a = i * (SEG + 1) + k, b = a + SEG + 1; ti.push(a, a + 1, b, a + 1, b + 1, b); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(tp, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(tuv, 2)); tg.setIndex(ti); tg.computeVertexNormals();
  scene.add(new T.Mesh(tg, R.pbr(T, 'rock', 1, 1, {color: 0x7c8c90, side: T.DoubleSide, roughness: .95})));
  for (const [d, s] of [[466, 1], [470, -1], [654, 1], [650, -1], [478, 0], [644, 0]]) { const c = pathC(d), rk = R.rock(T, s ? 11 : 9, d, {flat: .9, mat: {color: 0x7c8c90}}); rk.castShadow = rk.receiveShadow = false; rk.position.set(c.x + s * 21, c.y + (s ? -4 : 17), -d); scene.add(rk); }
  const CR = 70, cry = new T.InstancedMesh(new T.OctahedronGeometry(.3, 0), new T.MeshStandardMaterial({color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .8, roughness: .3, flatShading: true}), CR), gl = [], glc = [];
  for (let i = 0; i < CR; i++) { const d = 486 + r0() * 150, a = r0() * TAU, w = wall(d, a), c = pathC(d); D.position.set(w[0] + (c.x - w[0]) * .06, w[1] + (c.y - w[1]) * .06, w[2]); D.rotation.set(r0() * 3, r0() * 3, r0() * 3); D.scale.set(.6 + r0(), 1.4 + r0() * 2.2, .6 + r0()); D.updateMatrix(); cry.setMatrixAt(i, D.matrix); col.setHex(i % 3 ? 0x58d8c8 : 0xe88ab8).multiplyScalar(.8); cry.setColorAt(i, col); }
  cry.frustumCulled = false; cry.instanceColor.needsUpdate = true; scene.add(cry);
  for (let i = 0; i < 420; i++) { const d = 476 + r0() * 170, a = r0() * TAU, w = wall(d, a), c = pathC(d); gl.push(w[0] + (c.x - w[0]) * .04, w[1] + (c.y - w[1]) * .04, w[2]); const v = .35 + r0() * .5; glc.push(.3 * v, v, .85 * v); }
  const glg = new T.BufferGeometry(); glg.setAttribute('position', new T.Float32BufferAttribute(gl, 3)); glg.setAttribute('color', new T.Float32BufferAttribute(glc, 3));
  const glow = new T.Points(glg, new T.PointsMaterial({size: .34, vertexColors: true, map: R.softTex(T), transparent: true, depthWrite: false, blending: T.AdditiveBlending})); glow.frustumCulled = false; scene.add(glow);
  upd.push(t => { glow.material.opacity = .65 + Math.sin(t * 1.7) * .2; });

  /* Wrack am Meeresgrund */
  { const d = 716, c = pathC(d), wr = new T.Group(), wood = R.pbr(T, 'wood', 3, 2, {color: 0x6a6a5c, side: T.DoubleSide, roughness: 1});
    const hull = new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, TAU, Math.PI * .5, Math.PI * .5), wood); hull.scale.set(4.2, 4, 15); wr.add(hull);
    for (let k = -5; k <= 5; k++) { const rib = new T.Mesh(new T.TorusGeometry(4.1 * Math.sqrt(1 - (k / 6.2) ** 2), .16, 5, 14, Math.PI), wood); rib.rotation.z = Math.PI; rib.position.z = k * 2.3; rib.scale.y = .98; wr.add(rib); }
    const deck = new T.Mesh(new T.PlaneGeometry(6.4, 20, 1, 1), wood); deck.rotation.x = -Math.PI / 2; deck.position.set(0, -.5, -3); wr.add(deck);
    const mast = new T.Mesh(new T.CylinderGeometry(.22, .3, 15, 8), wood); mast.position.set(0, 6.5, -2); mast.rotation.z = .22; wr.add(mast);
    const yard = new T.Mesh(new T.CylinderGeometry(.12, .12, 8, 6), wood); yard.position.set(1.9, 10.5, -2); yard.rotation.z = Math.PI / 2 + .22; wr.add(yard);
    const mast2 = new T.Mesh(new T.CylinderGeometry(.2, .26, 7, 8), wood); mast2.position.set(.8, 2, 7); mast2.rotation.x = 1.1; wr.add(mast2);
    const lant = K.sprite(T, 0xffd9a0, 3.2, .5); lant.position.set(0, 1.4, -11); wr.add(lant);
    wr.position.set(c.x + 17, floorH(17, d) + 2.4, -d); wr.rotation.set(.1, .5, .42); scene.add(wr); }

  /* Lichtstrahlen, Wasseroberfläche, Blasen, Schwebeteilchen, Strömung */
  const rays = new T.Group();
  for (let i = 0; i < 11; i++) { const r = new T.Mesh(new T.PlaneGeometry(4 + r0() * 5, 70), new T.MeshBasicMaterial({color: 0xcff2ff, transparent: true, opacity: .04, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false})); r.position.set(-28 + r0() * 56, 16, 10 - r0() * 120); r.rotation.z = -.3 + r0() * .4; r.rotation.y = -.4 + r0() * .8; r.userData.ph = r0() * 6; rays.add(r); }
  scene.add(rays);
  const stex = causticTex(T); stex.repeat.set(5, 5);
  const sgeo = new T.PlaneGeometry(220, 220, 12, 12), scol = []; for (let i = 0; i < sgeo.attributes.position.count; i++) { const v = 1 - sstep(.35, 1, Math.hypot(sgeo.attributes.position.getX(i), sgeo.attributes.position.getY(i)) / 110); scol.push(v, v, v); } sgeo.setAttribute('color', new T.Float32BufferAttribute(scol, 3));
  const surf = new T.Mesh(sgeo, new T.MeshBasicMaterial({map: stex, color: 0x9fd8ee, vertexColors: true, transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false})); surf.rotation.x = Math.PI / 2; surf.position.y = 19; scene.add(surf);
  const mkCloud = (n, size, color, op, box) => { const pos = new Float32Array(n * 3), dat = []; for (let i = 0; i < n; i++) dat.push([(r0() - .5) * box[0], (r0() - .5) * box[1], r0() * box[2], r0() * 6]); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); const m = new T.Points(g, new T.PointsMaterial({color, size, map: R.softTex(T), transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending})); m.frustumCulled = false; scene.add(m); return {m, dat, box, pos}; };
  const bub = mkCloud(260, .26, 0xe6faff, .7, [44, 26, 130]), dust = mkCloud(420, .09, 0xcfeee0, .55, [40, 22, 70]), flow = mkCloud(160, .16, 0xbfe8ff, .5, [36, 14, 80]);

  /* Fischschwärme, Rochen, ein Wal in der Ferne */
  const fb = new T.SphereGeometry(1, 8, 6); fb.scale(.1, .2, .42); const ft = new T.ConeGeometry(.17, .3, 4); ft.rotateX(-Math.PI / 2); ft.scale(.3, 1, 1); ft.translate(0, 0, .52);
  const fishG = R.merge(T, [fb, ft]), schools = [];
  for (let s = 0; s < 13; s++) {
    const c2 = [0xe8b468, 0x88c8e0, 0xe890a8, 0xb8a4e0, 0xd8d8c0][s % 5], n = 26, im = new T.InstancedMesh(fishG, new T.MeshStandardMaterial({color: c2, emissive: c2, emissiveIntensity: .28, metalness: .1, roughness: .5}), n);
    let d0; do { d0 = 30 + r0() * (KLEN - 30); } while (d0 > 455 && d0 < 662);
    schools.push({im, n, d0, side: r0() < .5 ? -1 : 1, r: 3 + r0() * 3, off: Array.from({length: n}, () => [(r0() - .5) * 5, (r0() - .5) * 3, (r0() - .5) * 5, r0() * 6]), sp: .4 + r0() * .4}); im.frustumCulled = false; scene.add(im);
  }
  const mantas = [];
  for (let i = 0; i < 3; i++) {
    const g = new T.Group(), mm = new T.MeshStandardMaterial({color: 0x22303c, roughness: .6, side: T.DoubleSide}), body = new T.Mesh(new T.SphereGeometry(1, 12, 8), mm); body.scale.set(.9, .28, 1.5); g.add(body);
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute([0, 0, -1.2, 0, 0, 1.1, 3.6, 0, .3], 3)); wg.computeVertexNormals();
    const wl = new T.Mesh(wg, mm), wr = new T.Mesh(wg, mm); wr.scale.x = -1; g.add(wl, wr);
    const tail = new T.Mesh(new T.CylinderGeometry(.03, .05, 3, 4), mm); tail.rotation.x = Math.PI / 2; tail.position.z = 2.6; g.add(tail);
    g.scale.setScalar(1.3 + i * .3); scene.add(g); mantas.push({g, wl, wr, d0: [150, 400, 720][i], ph: i * 2.1});
  }
  const whale = new T.Group(), whM = new T.MeshStandardMaterial({color: 0x1a2a36, roughness: .8});
  { const b = new T.Mesh(new T.CapsuleGeometry(3.6, 15, 6, 14), whM); b.rotation.x = Math.PI / 2; b.scale.set(1, 1, .85); whale.add(b);
    const fl = new T.Mesh(new T.SphereGeometry(1, 10, 6), whM); fl.scale.set(4.2, .3, 1.6); fl.position.z = 12.5; whale.add(fl);
    for (const s of [-1, 1]) { const f = new T.Mesh(new T.SphereGeometry(1, 8, 6), whM); f.scale.set(2.8, .25, 1.1); f.position.set(s * 4.4, -1.6, -3.5); f.rotation.z = s * .5; whale.add(f); } }
  scene.add(whale);

  /* Ringe, Quallen, Muschel mit Perle – und dahinter der Rahmen für euer Bild */
  const rings = {}, torus = new T.TorusGeometry(3, .22, 12, 44);
  const rmat = o => { const mine2 = o === API.me || o === 'g', c = o === 'a' ? 0xe890a8 : o === 'd' ? 0x7fb0f0 : 0xe8bc78; return new T.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: mine2 ? .5 : .2, metalness: .5, roughness: .3, transparent: !mine2, opacity: mine2 ? 1 : .32}); };
  const RM = {a: rmat('a'), d: rmat('d'), g: rmat('g')};
  for (const it of S.items) {
    const c = pathC(it.d), m = new T.Mesh(torus, RM[it.o]);
    m.position.set(c.x + it.x, c.y + it.y, -it.d); m.rotation.y = pathYaw(it.d);
    if (it.o === API.me || it.o === 'g') m.add(K.sprite(T, it.o === 'a' ? 0xf4a8b8 : it.o === 'd' ? 0x9cc7ff : 0xf3c98f, 7.5, .12));
    scene.add(m); rings[it.id] = m;
  }
  const jel = [], jm = new T.MeshStandardMaterial({color: 0xd0a0f0, transparent: true, opacity: .55, emissive: 0x8048c0, emissiveIntensity: .5, side: T.DoubleSide, roughness: .4});
  const jg = new T.SphereGeometry(1.1, 20, 12, 0, TAU, 0, Math.PI / 2), tg2 = new T.CylinderGeometry(.03, .02, 2.4, 4); tg2.translate(0, -1.2, 0);
  const tm = new T.MeshBasicMaterial({color: 0xe0c8f0, transparent: true, opacity: .45});
  for (const j of (S.aux.jel || [])) {
    const m = new T.Mesh(jg, jm); m.userData.ten = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, tt = new T.Mesh(tg2, tm); tt.position.set(Math.cos(a) * .7, 0, Math.sin(a) * .7); m.add(tt); m.userData.ten.push(tt); }
    m.add(K.sprite(T, 0xc890f0, 5, .28)); scene.add(m); jel.push(m);
  }
  const ce = pathC(KLEN + 12), shellG = new T.Group();
  const shm = new T.MeshStandardMaterial({color: 0xe8c4cc, roughness: .4, metalness: .25, side: T.DoubleSide});
  const lower = new T.Mesh(new T.SphereGeometry(5, 28, 12, 0, Math.PI, 0, Math.PI / 2), shm); lower.rotation.x = Math.PI; shellG.add(lower);
  const upper = new T.Mesh(new T.SphereGeometry(5, 28, 12, 0, Math.PI, 0, Math.PI / 2), shm); upper.rotation.x = -.9; shellG.add(upper);
  const pearl = new T.Mesh(new T.SphereGeometry(2.1, 28, 20), new T.MeshStandardMaterial({color: 0xf4ece4, emissive: 0xe8d8c8, emissiveIntensity: .3, roughness: .18, metalness: .3}));
  pearl.position.y = 1.2; pearl.add(K.sprite(T, 0xffd9e6, 16, .4)); shellG.add(pearl);
  shellG.position.set(ce.x, ce.y - 3, -KLEN - 14); shellG.rotation.y = Math.PI; scene.add(shellG);
  const mos = document.createElement('canvas'); mos.width = 360; mos.height = 480;
  const mosT = new T.CanvasTexture(mos); mosT.anisotropy = 4;
  const pic = new T.Group(), cf = pathC(KLEN + 22);
  const pm = new T.Mesh(new T.PlaneGeometry(12, 16), new T.MeshBasicMaterial({map: mosT, color: 0xc4c4c4})); pic.add(pm);
  const fr = new T.Mesh(new T.BoxGeometry(13.4, 17.4, .5), R.pbr(T, 'rock', 2, 2, {color: 0xa8a090})); fr.position.z = -.3; pic.add(fr);
  pic.position.set(cf.x, cf.y + 6.5, -KLEN - 23); scene.add(pic);
  for (const s of [-1, 1]) { const rk = R.rock(T, 5, 30 + s, {flat: .8, mat: {color: 0x8aa0a0}}); rk.castShadow = false; rk.position.set(cf.x + s * 9.5, cf.y - 4, -KLEN - 24); scene.add(rk); }

  /* die beiden Schwimmer mit Lichtschweif und eigenem Licht */
  const turtle = K.turtle(T), sponge = K.sponge(T); sponge.scale.setScalar(1.15); scene.add(turtle); scene.add(sponge);
  const trails = {}, lights = {};
  for (const k of ['a', 'd']) {
    const n = 36, pos = new Float32Array(n * 3), g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(g, new T.PointsMaterial({color: k === 'a' ? 0xf4a8b8 : 0x9cc7ff, size: .22, map: K.glowTex(T), transparent: true, opacity: .4, depthWrite: false, blending: T.AdditiveBlending}));
    pts.frustumCulled = false; scene.add(pts); trails[k] = {pts, n, i: 0, init: false};
    lights[k] = new T.PointLight(k === 'a' ? 0xffd0dc : 0xcfe2ff, k === API.me ? .8 : .45, 16, 1.5); scene.add(lights[k]);
  }
  return {scene, cam, skyM, hemi, sun, rings, jel, turtle, sponge, rays, surf, stex, ctex, caus, kU, schools, mantas, whale, bub, dust, flow, trails, lights, pearl, upper, upd, mos, mosT, mosKey: '', camPos: null, fill: 0, endT: 0};
}
/* Drei Streifen: links (Aurelia), Mitte (Gold), rechts (Daniel) – mit Lücke, bis sie sich am Ende verbinden */
function drawStrips(K, x, y, w, h, gap, edge) {
  const cw = (w - 2 * gap) / MX, parts = [[0, 2, COL.a], [2, 1, CG], [3, 2, COL.d]]; let px = x;
  for (const [c0, n, c] of parts) { const pw = cw * n; ctx.drawImage(K.mos, c0 * 72, 0, n * 72, 480, px, y, pw, h); if (edge > 0) { ctx.strokeStyle = rgba(c, edge); ctx.lineWidth = Math.max(1.5, w / 90); ctx.strokeRect(px, y, pw, h); } px += pw + gap; }
}
/* Das Mosaik: jeder gesammelte Ring legt eine Kachel des Bildes frei */
function drawMosaic(K, n) {
  const g = K.mos.getContext('2d'), F = FOTO.get('m2'), SV = FOTO.soft('m2'), tw = 360 / MX, th = 480 / MY;
  g.fillStyle = '#0a2230'; g.fillRect(0, 0, 360, 480);
  S.items.forEach((it, i) => {
    const tI = TILE[i], tx = tI % MX, ty = (tI / MX) | 0, on = it.got || i < n;
    if (on && SV) g.drawImage(SV, tx * F.w / MX, ty * F.h / MY, F.w / MX, F.h / MY, tx * tw, ty * th, tw, th);
    else { g.fillStyle = (tx + ty) % 2 ? '#0d2a3a' : '#0b2534'; g.fillRect(tx * tw, ty * th, tw, th); g.strokeStyle = 'rgba(160,220,240,.12)'; g.lineWidth = 1.5; g.strokeRect(tx * tw + 1, ty * th + 1, tw - 2, th - 2); }
  });
  K.mosT.needsUpdate = true;
}

const korallen = {
  id: 'korallen', n: 'Korallenflug', ic: '◯', t3: 0, t2: 0, ctrl: 'pad', padIcon: 'swipe', three: true, noTimer: true, noClamp: true, hidePlayers: true,
  staticAux: ['jel'],
  skinName: () => `${nm('a')}: Schildkröte · ${nm('d')}: Schwamm`,
  ctrlText: () => 'Du schwimmst von selbst. Daumen irgendwo auflegen und ziehen – deine Figur folgt weich. Rechts unten: Schub halten für einen Sprint.',
  h: () => `Schildkröte ${nm('a')} und Schwamm ${nm('d')} schwimmen durchs Riff, durch den Tangwald mit seiner Strömung, durch die Leuchthöhle und am Wrack vorbei. Jeder Ring ist ein Stück von einem Bild: ${nm('a')}s Ringe gehören zur linken Hälfte, ${nm('d')}s zur rechten, die goldenen zum Streifen dazwischen. Noch ist alles verschwommen – was es zeigt, seht ihr erst später, im Spiel „Unser Bild“. Je mehr ihr sammelt, desto mehr liegt dort schon bereit. Quallen betäuben kurz.`,
  start: k => ({x: k === 'a' ? -2.5 : 2.5, y: 0}),
  note: () => `${S.count} von ${S.total} Bildstücken gesammelt`,
  posExtra: () => [Math.round((LOC.sw ? LOC.sw.d : 0) * 100) / 100],
  onTeleport() { if (LOC.sw) { LOC.sw.tx = mine.x; LOC.sw.ty = mine.y; LOC.sw.vx = LOC.sw.vy = 0; } },
  setup() {
    S.items = []; const last = {};
    for (let i = 0; i < NR; i++) {
      const d = 45 + i * 19, o = ownerOf(i), kx = BX(d) - 2.8, ky = BY(d) - 1.7, pv = last[o === 'g' ? (i % 2 ? 'd' : 'a') : o];
      let x = rnd(-kx, kx), y = rnd(-ky, ky);
      if (pv) { x = clamp(x, pv.x - 8, pv.x + 8); y = clamp(y, pv.y - 4.5, pv.y + 4.5); }
      const it = {id: i, d, x: +x.toFixed(1), y: +y.toFixed(1), o, got: 0}; S.items.push(it);
      if (o === 'g') last.a = last.d = it; else last[o] = it;
    }
    const jel = [], gaps = []; for (let gI = 2; gI < NR - 1; gI++) if (cave(45 + (gI + .5) * 19) < .3) gaps.push(gI);
    for (let k = 0; k < 13 && gaps.length; k++) { const gI = gaps.splice((Math.random() * gaps.length) | 0, 1)[0], d = 45 + (gI + .5) * 19; jel.push({d, x: +rnd(-6.5, 6.5).toFixed(1), y: +rnd(-3.2, 3.2).toFixed(1)}); }
    S.aux = {jel, pd: {a: 0, d: 0}}; S.total = NR;
  },
  move(dt, inp) {
    const sw = LOC.sw || (LOC.sw = {d: 0, sp: 0, tx: mine.x, ty: mine.y, vx: 0, vy: 0, en: .45, streak: 0, seen: 0, sprint: false, T: 0});
    const I = readPad(inp, dt), p = S.p[API.me], stun = !p.lit; sw.T += dt;
    while (sw.seen < S.items.length && S.items[sw.seen].d < sw.d - 6) { const r = S.items[sw.seen++]; if (r.got === API.me) { sw.streak++; sw.en = Math.min(1, sw.en + .2); } else if (r.o === API.me) sw.streak = 0; }
    if (stun) sw.streak = 0;
    const was = sw.sprint; sw.sprint = !!I.sprint && !stun && sw.en > (was ? 0 : .08) && sw.d < KLEN - 1;
    if (sw.sprint && !was) { tone(330, .25, .04, 'sine'); buzz(10); }
    sw.en = sw.sprint ? Math.max(0, sw.en - .36 * dt) : Math.min(1, sw.en + .025 * dt);
    const o = API.partner(), od = o.e ? o.e[0] : sw.d, rub = clamp((od - sw.d - 8) / 40, 0, 1) * .12 - clamp((sw.d - od - 25) / 40, 0, 1) * .1;
    const want = (stun ? 5 : (12.5 + Math.min(sw.streak, 6) * .45) * (sw.sprint ? 1.5 : 1) * (1 + rub)) * API.diff();
    sw.sp += (want - sw.sp) * Math.min(1, dt * (want < sw.sp ? 5 : 2.5));
    sw.d = Math.min(KLEN, sw.d + sw.sp * dt);
    // Ziel der Figur: wandert mit dem Daumen, die Strömung schiebt mit, nahe Ringe ziehen sanft an
    const bx = BX(sw.d), by = BY(sw.d);
    sw.tx += I.dx + cur(sw.d) * dt; sw.ty += I.dy;
    for (const r of S.items) { if (r.d <= sw.d || r.got || (r.o !== API.me && r.o !== 'g')) continue; if (r.d - sw.d < 24 && Math.hypot(r.x - sw.tx, r.y - sw.ty) < 4.6) { sw.tx += clamp(r.x - sw.tx, -1, 1) * 1.6 * dt; sw.ty += clamp(r.y - sw.ty, -1, 1) * 1.6 * dt; } break; }
    sw.tx = clamp(sw.tx, -bx, bx); sw.ty = clamp(sw.ty, -by, by);
    // weiche Feder: die Figur folgt dem Ziel ohne Ruckeln und ohne Nachschwingen
    const k = stun ? 16 : 85, dm = stun ? 5 : 16.5;
    sw.vx += ((sw.tx - mine.x) * k - sw.vx * dm) * dt; sw.vy += ((sw.ty - mine.y) * k - sw.vy * dm) * dt;
    mine.x += sw.vx * dt; mine.y += sw.vy * dt;
    if (Math.abs(mine.x) > bx) { mine.x = clamp(mine.x, -bx, bx); sw.vx = 0; } if (Math.abs(mine.y) > by) { mine.y = clamp(mine.y, -by, by); sw.vy = 0; }
  },
  update(dt) {
    const A = S.aux;
    for (const k of ['a', 'd']) {
      const p = S.p[k], d = (p.e && p.e[0]) || 0, pd = A.pd[k];
      for (const r of S.items) {
        if (r.got || !(pd < r.d && d >= r.d)) continue;
        if ((r.o === k || r.o === 'g') && Math.hypot(p.x - r.x, p.y - r.y) < 3.5) { r.got = k; S.count++; emit({k: 'ring', o: k}); }
      }
      if (p.lit && p.inv <= 0) {
        for (let i = 0; i < A.jel.length; i++) { const j = A.jel[i]; if (Math.abs(d - j.d) < 1.8 && Math.hypot(p.x - j.x, p.y - jelY(j, i, S.t)) < 2.4) { p.lit = 0; p.out = 0; emit({k: 'fizz', x: 0, y: 0, o: k}); emit({k: 'toast', txt: `Qualle! ${nm(k)} ist kurz betäubt.`}); break; } }
      } else if (!p.lit) { p.out += dt; if (p.out > 1.3) { p.lit = 1; p.inv = 1.6; } }
      A.pd[k] = d;
    }
    const da = (S.p.a.e && S.p.a.e[0]) || 0, dd = (S.p.d.e && S.p.d.e[0]) || 0;
    if (da >= KLEN - .5 && dd >= KLEN - .5) { const pct = S.count / S.total; (S.memo = S.memo || {}).m2 = +pct.toFixed(2); emit({k: 'meet', x: 0, y: 0}); finish(8, pct >= .8 ? 3 : pct >= .55 ? 2 : 1); }
  },
  render3d(t, part) {
    const T = window.THREE, R3 = API.renderer3D(); if (!R3) return;
    if (!S.aux.jel || !S.items.length) return;
    if (!LOC.k3) { LOC.k3 = buildReef(T); LOC.__dispose = () => API.disposeTree(LOC.k3.scene); FOTO.get('m2'); }
    const K = LOC.k3, sc = API.screen(), KK = KIT(), dt = Math.min(.05, K.lt ? t - K.lt : .016); K.lt = t;
    const port = sc.cw < sc.ch, sw = LOC.sw, hn = hostNow();
    K.cam.aspect = sc.cw / sc.ch; K.cam.fov = port ? 74 : 60; K.cam.updateProjectionMatrix();
    const myD = sw ? sw.d : 0, pD = part.e ? part.e[0] : 0, ck = cave(myD);
    const P = (x, y, d) => { const c = pathC(d); return new T.Vector3(c.x + x, c.y + y, -d); };
    const meA = API.me === 'a', meM = meA ? K.turtle : K.sponge, paM = meA ? K.sponge : K.turtle;
    const pvP = paM.userData.pv || P(part.x, part.y, pD);
    meM.position.copy(P(mine.x, mine.y, myD)); paM.position.copy(P(part.x, part.y, pD));
    const pvx = (paM.position.x - pvP.x) / Math.max(dt, .001), pvy = (paM.position.y - pvP.y) / Math.max(dt, .001); paM.userData.pv = paM.position.clone();
    const pose = (M, yaw, vx, vy, lit, ph) => {
      M.rotation.y = yaw - clamp(vx * .035, -.45, .45); M.rotation.z = lit ? -clamp(vx * .05, -.5, .5) + Math.sin(t * 1.5 + ph) * .05 : Math.sin(t * 20) * .22;
      M.rotation.x = clamp(vy * .05, -.4, .4); M.position.y += Math.sin(t * 2 + ph) * .12;
    };
    pose(meM, pathYaw(myD), sw ? sw.vx : 0, sw ? sw.vy : 0, S.p[API.me].lit, 0);
    pose(paM, pathYaw(pD), clamp(pvx, -12, 12), clamp(pvy, -12, 12), S.p[API.other].lit, 1);
    const fast = sw && sw.sprint ? 11 : 6;
    K.turtle.userData.fl.forEach(f => { f.pv.rotation.z = Math.sin(t * (meA ? fast : 6)) * .5 * f.s; f.pv.rotation.y = f.x * .3; });
    KK.animSponge(K.sponge, t * (!meA && sw && sw.sprint ? 1.6 : 1), true);
    for (const k of ['a', 'd']) { const M = k === 'a' ? K.turtle : K.sponge; K.lights[k].position.copy(M.position).add(new T.Vector3(0, 1.6, 1)); }
    // Ringe, Quallen
    let next = null;
    for (const it of S.items) {
      const m = K.rings[it.id]; if (!m) continue; const dz = it.d - myD;
      m.visible = !it.got && dz > -12 && dz < 115; if (!m.visible) continue;
      m.rotation.z = t * .6 + it.id; m.scale.setScalar(1 + Math.sin(t * 3 + it.id) * .04);
      if (!next && dz > .5 && (it.o === API.me || it.o === 'g')) next = it;
    }
    K.jel.forEach((j, i) => { const jd = S.aux.jel[i]; if (!jd) { j.visible = false; return; } const dz = jd.d - myD; j.visible = dz > -12 && dz < 110; if (!j.visible) return; const c = pathC(jd.d); j.position.set(c.x + jd.x, c.y + jelY(jd, i, hn), -jd.d); const s = 1 + Math.sin(t * 3 + i) * .14; j.scale.set(s, 1 / s, s); j.userData.ten.forEach((tt, k) => { tt.rotation.x = Math.sin(t * 3 + k + i) * .25; }); });
    // Wasser, Licht und Leben
    K.kU.uT.value = t; K.ctex.offset.set((t * .02) % 1, (t * .035) % 1); K.stex.offset.set((t * .012) % 1, (t * .02) % 1);
    K.caus.material.opacity = .2 * (1 - ck); K.surf.material.opacity = .2 * (1 - ck); K.surf.position.set(pathC(myD).x, 19, -myD - 30);
    K.rays.children.forEach(r => { r.material.opacity = (.035 + Math.sin(t * .8 + r.userData.ph) * .018) * (1 - ck); });
    K.rays.position.z = -myD; K.rays.position.x = pathC(myD).x;
    K.scene.fog.color.setRGB(.043 - .03 * ck, .31 - .23 * ck, .424 - .3 * ck); K.scene.fog.density = .021 + .014 * ck;
    K.hemi.intensity = .85 - .6 * ck; K.sun.intensity = .6 * (1 - ck);
    const wrap = (Q, vy, vx, zAhead) => { const a = Q.m.geometry.attributes.position, c = pathC(myD + zAhead * .4); Q.dat.forEach((q, i) => { const z = ((q[2] - myD) % Q.box[2] + Q.box[2]) % Q.box[2] - Q.box[2] * .18, y = ((q[1] + t * vy * (.6 + (i % 5) * .2) + Q.box[1] / 2) % Q.box[1] + Q.box[1]) % Q.box[1] - Q.box[1] / 2, x = ((q[0] + t * vx + Q.box[0] / 2) % Q.box[0] + Q.box[0]) % Q.box[0] - Q.box[0] / 2; a.setXYZ(i, c.x + x + Math.sin(t + q[3]) * .15, c.y + y, -(myD + z)); }); a.needsUpdate = true; };
    wrap(K.bub, 2.2, 0, 60); wrap(K.dust, .12, .3, 30);
    const cu = cur(myD + 12); K.flow.m.visible = Math.abs(cu) > .15 || (myD > 235 && myD < 470); if (K.flow.m.visible) { K.flow.ph = (K.flow.ph || 0) + cur(myD) * dt * 2.2; wrap(K.flow, 0, 0, 40); const a = K.flow.m.geometry.attributes.position; for (let i = 0; i < a.count; i++) a.setX(i, pathC(myD).x + (((K.flow.dat[i][0] + K.flow.ph * (1 + (i % 3) * .3)) % 36 + 54) % 36 - 18)); K.flow.m.material.opacity = clamp(Math.abs(cu) * .25, .08, .55); }
    for (const s of K.schools) {
      if (Math.abs(s.d0 - myD) > 130) { s.im.visible = false; continue; } s.im.visible = true;
      const cd = s.d0 + Math.sin(t * .2 * s.sp) * 25, c = pathC(cd), cx = c.x + s.side * (8 + Math.sin(t * .5) * 2), cy = c.y + 2 + Math.sin(t * .7) * 1.5, a = t * s.sp, o3 = K.o3 || (K.o3 = new T.Object3D());
      s.off.forEach((o, i) => { o3.position.set(cx + Math.cos(a + o[3]) * s.r + o[0], cy + o[1] + Math.sin(t * 3 + i) * .2, -cd + Math.sin(a + o[3]) * s.r + o[2]); o3.rotation.set(0, -(a + o[3]) + Math.PI, Math.sin(t * 9 + i) * .2); o3.updateMatrix(); s.im.setMatrixAt(i, o3.matrix); });
      s.im.instanceMatrix.needsUpdate = true;
    }
    K.mantas.forEach(m => { const d = m.d0 + Math.sin(t * .11 + m.ph) * 70, c = pathC(d), x = c.x + Math.sin(t * .13 + m.ph) * 16; m.g.visible = Math.abs(d - myD) < 120; m.g.position.set(x, c.y + 11 + Math.sin(t * .3 + m.ph) * 2, -d); m.g.rotation.y = Math.cos(t * .11 + m.ph) > 0 ? 0 : Math.PI; const f = Math.sin(t * 1.6 + m.ph) * .45; m.wl.rotation.z = f; m.wr.rotation.z = -f; });
    { const d = 690 + ((t * 2.2) % 160), c = pathC(d); K.whale.visible = myD > 560; K.whale.position.set(c.x - 46, c.y + 9 + Math.sin(t * .4) * 1.5, -d); K.whale.rotation.x = Math.sin(t * .5) * .06; }
    for (const [M, k] of [[K.turtle, 'a'], [K.sponge, 'd']]) {
      const tr = K.trails[k], pa2 = tr.pts.geometry.attributes.position;
      if (!tr.init) { for (let i = 0; i < tr.n; i++) pa2.setXYZ(i, M.position.x, M.position.y, M.position.z); tr.init = true; }
      tr.i = (tr.i + 1) % tr.n; pa2.setXYZ(tr.i, M.position.x + rnd(-.3, .3), M.position.y + rnd(-.3, .3), M.position.z + 1.6); pa2.needsUpdate = true;
    }
    K.upd.forEach(f => f(t, dt));
    const endK = Math.max(0, 1 - Math.abs(KLEN - myD) / 60);
    K.pearl.rotation.y = t * .5; K.upper.rotation.x = -.9 - endK * .35;
    // Mosaik: neu zeichnen, wenn ein Ring dazukam; am Ziel füllen sich die Lücken
    const done = S.done || (myD >= KLEN - .5 && pD >= KLEN - .5);
    if (done) { K.endT += dt; K.fill = Math.min(NR, K.fill + dt * 16); }
    const key = S.items.map(i => i.got ? 1 : 0).join('') + (FOTO.get('m2').ready ? 'r' : '') + Math.floor(K.fill);
    if (key !== K.mosKey) { K.mosKey = key; drawMosaic(K, Math.floor(K.fill)); }
    // Kamera: leicht versetzt hinter der Figur, mit Blick voraus auf die nächsten Ringe
    const yaw = pathYaw(myD), back = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const want = P(mine.x * .7, mine.y * .62 + (port ? 2.9 : 2.3), myD).addScaledVector(back, port ? 11 : 9.2);
    if (!K.camPos) K.camPos = want.clone(); K.camPos.lerp(want, Math.min(1, dt * 7));
    K.cam.position.copy(K.camPos); K.cam.lookAt(P(mine.x * .82, mine.y * .78 + .4 + endK * 3, myD + 13));
    K.cam.rotation.z += -(sw ? clamp(sw.vx * .006, -.06, .06) : 0); K.skyM.position.copy(K.cam.position);
    paM.visible = !(pD < myD - 1.5 && paM.position.distanceTo(K.cam.position) < 7.5);
    API.render3D(K.scene, K.cam, {bloom: .62, th: .7});

    /* --- Anzeigen --- */
    for (const [M, k] of [[meM, API.me], [paM, API.other]]) {
      const p = KK.proj(K.cam, M.position.clone().add(new T.Vector3(0, 1.9, 0)));
      if (p.ok) KK.nameTag(`${nm(k)} ${k === 'a' ? '🐢' : '🧽'}`, p.x, p.y, COL[k]);
    }
    const play = S.phase === 'play' && !done;
    if (next && play) {
      const q = KK.proj(K.cam, P(next.x, next.y, next.d)), dz = next.d - myD, c = next.o === 'g' ? CG : COL[API.me];
      if (q.ok && dz < 60) {
        const s = clamp(160 / dz, 9, 34), hit = Math.hypot(next.x - mine.x, next.y - mine.y) < 3.2;
        ctx.strokeStyle = rgba(c, hit ? .95 : .55); ctx.lineWidth = hit ? 3 : 2; ctx.beginPath();
        for (let k2 = 0; k2 < 4; k2++) { const a = k2 * Math.PI / 2 + Math.PI / 4; ctx.moveTo(q.x + Math.cos(a - .35) * s, q.y + Math.sin(a - .35) * s); ctx.arc(q.x, q.y, s, a - .35, a + .35); }
        ctx.stroke();
        if (hit) { ctx.font = '700 12px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(c, .95); ctx.fillText('passt', q.x, q.y - s - 8); }
      }
    }
    // euer Bild als kleines Mosaik oben rechts
    const tw = Math.min(84, sc.cw * .2), thh = tw * 4 / 3, tx = sc.cw - tw - 14, ty = 70;
    if (['play', 'count'].includes(S.phase)) {
      const cu2 = sw ? cur(sw.d) : 0;
      if (play && Math.abs(cu2) > .8) { ctx.font = '700 14px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(190,232,255,.85)'; ctx.fillText(cu2 > 0 ? 'Strömung  ›››' : '‹‹‹  Strömung', sc.cw / 2, sc.ch * .2); }
      if (play && sw && sw.streak > 1) { ctx.font = '700 15px Karla, system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = rgba(CG, .95); ctx.fillText(`${sw.streak} in Folge`, 16, 96); }
      // Fortschritt
      const bw = sc.cw - 60, by = sc.ch - 30;
      ctx.fillStyle = 'rgba(10,8,24,.5)'; rr(30, by - 5, bw, 10, 5); ctx.fill();
      for (const [a, b, c] of [[245, 462, 'rgba(120,200,150,.35)'], [468, 650, 'rgba(150,140,200,.35)']]) { ctx.fillStyle = c; ctx.fillRect(30 + bw * a / KLEN, by - 5, bw * (b - a) / KLEN, 10); }
      for (const [d, k] of [[pD, API.other], [myD, API.me]]) { ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(30 + bw * clamp(d / KLEN, 0, 1), by, 7.5, 0, TAU); ctx.fill(); }
      ctx.font = '600 11px Karla, system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = rgba(CG, .9); ctx.fillText('Perle', sc.cw - 30, by - 12);
      // Bedienung: Daumenpunkt und Schub-Knopf
      if (play && sw) {
        const U = LOC.padUI || {}, Z = sprintZone(sc.cw, sc.ch);
        if (U.st) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(U.st.x, U.st.y, 26, 0, TAU); ctx.stroke(); ctx.fillStyle = rgba(COL[API.me], .35); ctx.fill(); }
        else if (sw.T < 9) { ctx.font = '600 13px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText('Daumen auflegen und ziehen', sc.cw * .42, sc.ch - 96); }
        ctx.fillStyle = sw.sprint ? 'rgba(243,201,143,.4)' : 'rgba(255,255,255,.09)'; ctx.strokeStyle = sw.en > .08 ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Z.x, Z.y, Z.r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = rgba(CG, .95); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(Z.x, Z.y, Z.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sw.en, .001, 1)); ctx.stroke();
        ctx.font = '700 14px Karla, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = sw.en > .08 ? '#fff' : 'rgba(255,255,255,.4)'; ctx.fillText('Schub', Z.x, Z.y); ctx.textBaseline = 'alphabetic';
      }
      if (!done) { FOTO.frame(ctx, tx, ty, tw, thh, 3); drawStrips(K, tx, ty, tw, thh, 3, .9); ctx.font = '600 11px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(`Bild ${S.count}/${NR}`, tx + tw / 2, ty + thh + 18); }
    }
    if (done && S.phase === 'play') {
      // die Hälften wachsen in die Mitte, rücken zusammen – und die Naht leuchtet auf wie die Linien im Herz
      const join = clamp((K.endT - 3) / 1.3, 0, 1), jk = join * join * (3 - 2 * join), lit = clamp((K.endT - 4.3) / .5, 0, 1) * (1 - clamp((K.endT - 5.6) / 1.2, 0, 1));
      const q = FOTO.big(ctx, {w: 360, h: 480}, sc, clamp((K.endT - .6) / 1.4, 0, 1), {x: tx, y: ty, w: tw, h: thh}, join < 1 ? `Links: von ${nm('a')} freigelegt · rechts: von ${nm('d')}\nDie goldene Mitte gehört euch beiden` : 'Zwei Hälften, ein Bild – noch verschwommen.\nScharf wird es später, in „Unser Bild“');
      drawStrips(K, q.x, q.y, q.w, q.h, (3 + q.w * .045) * (1 - jk), .9 * (1 - jk));
      if (lit > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const f of [2 / MX, 3 / MX]) { const gx = q.x + q.w * f, gr = ctx.createLinearGradient(gx - 9, 0, gx + 9, 0); gr.addColorStop(0, 'rgba(243,201,143,0)'); gr.addColorStop(.5, `rgba(243,201,143,${.55 * lit})`); gr.addColorStop(1, 'rgba(243,201,143,0)'); ctx.fillStyle = gr; ctx.fillRect(gx - 9, q.y, 18, q.h); } ctx.restore(); }
      if (join >= 1 && !K.joined) { K.joined = 1; tone(659.25, .9, .05); tone(987.77, 1.1, .04, 'sine', .12); buzz([20, 40, 30]); }
    }
  }
};
return [korallen];
});
