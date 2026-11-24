/* Zwei Lichter – „Über den See“ (neu in Version 8)
   Ein Boot, zwei Paddel: Aurelia paddelt links, Daniel rechts. Wer allein paddelt, dreht das Boot –
   im Gleichtakt gleitet es geradeaus. Durch die Bojen-Tore bis zum Steg am Leuchtturm. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CG, rgba, clamp, nm, OTH, emit, finish, act, hostNow, tone, buzz, label, rr, lerpA} = API;
const GATES = [[0, -45], [-20, -110], [18, -175], [-14, -250], [12, -320], [0, -385]];
const ROCKS = [[-16, -78, 5], [15, -92, 4], [2, -140, 5], [-30, -150, 6], [34, -205, 6], [0, -212, 4.5], [-34, -240, 5], [10, -282, 5], [-22, -300, 4], [30, -345, 6], [-14, -356, 4.5]];
const ISLE = {x: 0, z: -445, r: 26}, PIER = {x: 0, z: -412}, GW = 8, VMAX = 6.4, CDT = .5;
const fwd = h => ({x: -Math.sin(h), z: -Math.cos(h)});

function boatView(t) {
  const b = S.aux.b; if (!b) return null;
  if (LOC.bvT === t && LOC.bv) return LOC.bv;
  const ex = clamp(hostNow() - S.t, 0, .2), f = fwd(b.h), tx = b.x + f.x * b.v * ex, tz = b.z + f.z * b.v * ex, th = b.h + b.w * ex;
  const v = LOC.bv || (LOC.bv = {x: tx, z: tz, h: th});
  if (Math.hypot(tx - v.x, tz - v.z) > 14) { v.x = tx; v.z = tz; v.h = th; } else { v.x += (tx - v.x) * .3; v.z += (tz - v.z) * .3; v.h = lerpA(v.h, th, .3); }
  LOC.bvT = t; return v;
}

function build(T) {
  const K = window.ZL_KIT(API), R = window.ZL_REAL(API), scene = new T.Scene(), cam = new T.PerspectiveCamera(68, 1, .3, 3200);
  const sunDir = new T.Vector3(-.28, .17, -1).normalize();
  const sky = R.sky(T, {zen: 0x243c86, hor: 0xeb9c78, sun: sunDir, sunC: 0xffa868, cloud: .62, cloudC: 0xe89a9a, r: 2600}); scene.add(sky);
  scene.fog = new T.FogExp2(0xdc9478, .0019);
  scene.environment = K.env(T, 'see', 0x2a4490, 0xe8a080, 0x16324a, [[-10, 6, -36, 14, 10, 0xffd0a0]]);
  scene.add(new T.HemisphereLight(0xffd6bc, 0x1c3046, .6));
  const fill = new T.DirectionalLight(0x9fb4ff, .32); fill.position.set(.4, .7, 1); scene.add(fill);
  const sun = R.sun(T, scene, sunDir, 0xffb27a, 1.2, {size: 14, map: 1024});
  const water = R.water(T, sky, {deep: 0x0d3046, fog: .0021}); water.position.set(0, 0, -220); scene.add(water);
  // Berge am Horizont
  const ridge = (rad, h0, hv, col, seed) => {
    const n = 140, pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, h = h0 + hv * (.5 + .5 * Math.sin(a * 5 + seed)) * (.6 + .4 * Math.sin(a * 13 + seed * 2)) + hv * .22 * Math.sin(a * 31 + seed);
      pos.push(Math.cos(a) * rad, -2, Math.sin(a) * rad, Math.cos(a) * rad, Math.max(h, 6), Math.sin(a) * rad);
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({color: col, side: T.DoubleSide, fog: false})); m.frustumCulled = false; m.position.set(0, 0, -220); return m;
  };
  scene.add(ridge(1500, 120, 240, 0xa9788c, 1.3)); scene.add(ridge(1050, 50, 150, 0x7a5a7c, 4.1)); scene.add(ridge(760, 16, 70, 0x4c4266, 7.7));
  // Felsen
  ROCKS.forEach(([x, z, r], i) => { const m = R.rock(T, r, i + 2, {flat: .62}); m.position.set(x, -.4, z); m.rotation.y = i * 1.3; scene.add(m); });
  // Insel mit Leuchtturm, Haus, Bäumen und Steg
  const isle = R.rock(T, ISLE.r, 9, {flat: .2, mat: {color: 0xb8a888}}); isle.position.set(ISLE.x, -.6, ISLE.z); scene.add(isle);
  const stripe = R.paint(T, 64, 256, (g, w, h) => { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#c63a34' : '#f4eee6'; g.fillRect(0, i * h / 5, w, h / 5 + 1); } for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(60,40,30,.06)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 9); } });
  const lh = new T.Group(); lh.position.set(ISLE.x + 4, 3.4, ISLE.z - 6);
  const tower = new T.Mesh(new T.CylinderGeometry(2.3, 3.5, 24, 24), new T.MeshStandardMaterial({map: stripe, roughness: .75})); tower.position.y = 12; lh.add(tower);
  const gal = new T.Mesh(new T.CylinderGeometry(3.3, 3.3, .5, 24), new T.MeshStandardMaterial({color: 0x2c2c34, roughness: .6})); gal.position.y = 24.2; lh.add(gal);
  const lampM = new T.MeshBasicMaterial({color: 0xfff0c0}), lamp = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 2.8, 12), lampM); lamp.position.y = 25.9; lh.add(lamp);
  const roof = new T.Mesh(new T.ConeGeometry(2.4, 2.4, 12), new T.MeshStandardMaterial({color: 0x8a2c28, roughness: .6})); roof.position.y = 28.5; lh.add(roof);
  const lg = K.sprite(T, 0xffe0a0, 26, .55); lg.material.fog = false; lg.position.y = 25.9; lh.add(lg);
  const beam = new T.Group(); beam.position.y = 25.9;
  for (const s of [-1, 1]) { const c = new T.Mesh(new T.ConeGeometry(9, 150, 18, 1, true), new T.MeshBasicMaterial({color: 0xfff0c8, transparent: true, opacity: .06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false})); c.rotation.z = s * Math.PI / 2; c.position.x = s * 75; beam.add(c); }
  lh.add(beam); R.shadows(tower); scene.add(lh);
  const house = new T.Group(); house.position.set(ISLE.x - 9, 3.2, ISLE.z - 2);
  const hb = new T.Mesh(new T.BoxGeometry(6, 3.6, 5), R.pbr(T, 'stone', 3, 2, {color: 0xe6dccc})); hb.position.y = 1.8; house.add(hb);
  const hr = new T.Mesh(new T.ConeGeometry(4.8, 2.6, 4), new T.MeshStandardMaterial({color: 0x7a3028, roughness: .8})); hr.position.y = 4.9; hr.rotation.y = Math.PI / 4; house.add(hr);
  for (const x of [-1.4, 1.4]) { const w = new T.Mesh(new T.PlaneGeometry(.9, 1.1), new T.MeshBasicMaterial({color: 0xffc878})); w.position.set(x, 2, 2.52); house.add(w); }
  R.shadows(house); scene.add(house);
  const trees = R.forest(T, [[-16, -8], [-13, 6], [-19, 2], [12, 4], [15, -3], [18, -10], [9, -14], [-6, -16], [-12, -13]].map(([x, z], i) => ({x: ISLE.x + x, z: ISLE.z + z, s: .9 + (i % 3) * .2})), {seed: 5}); trees.position.y = 3; scene.add(trees);
  const pier = new T.Group(), plank = R.pbr(T, 'wood', 1, 4, {roughness: .8});
  const deck = new T.Mesh(new T.BoxGeometry(3.2, .22, 17), plank); deck.position.set(PIER.x, .75, PIER.z - 4.5); pier.add(deck);
  for (const z of [-8, -4, 0, 3.6]) for (const x of [-1.5, 1.5]) { const p = new T.Mesh(new T.CylinderGeometry(.16, .16, 2.6, 8), plank); p.position.set(PIER.x + x, .1, PIER.z + z - 4.5 + 4.4); pier.add(p); }
  const pl = new T.Mesh(new T.SphereGeometry(.28, 12, 10), new T.MeshBasicMaterial({color: 0xffd08a})); pl.position.set(PIER.x + 1.5, 2.2, PIER.z + 3.4); pier.add(pl);
  const pgl = K.sprite(T, 0xffc070, 7, .7); pgl.position.copy(pl.position); pier.add(pgl);
  const plight = new T.PointLight(0xffb060, 1.4, 22, 1.6); plight.position.copy(pl.position); pier.add(plight);
  R.shadows(deck); scene.add(pier);
  // Bojen-Tore
  const buoyM = new T.MeshStandardMaterial({color: 0xc23e2c, roughness: .45}), whiteM = new T.MeshStandardMaterial({color: 0xf2efe8, roughness: .5}), darkM = new T.MeshStandardMaterial({color: 0x2a2a30, roughness: .6});
  const buoys = GATES.map(([gx, gz], i) => [-1, 1].map(s => {
    const g = new T.Group();
    const b = new T.Mesh(new T.CylinderGeometry(.5, .72, 1.3, 14), buoyM); b.position.y = .35; g.add(b);
    const w = new T.Mesh(new T.CylinderGeometry(.56, .62, .32, 14), whiteM); w.position.y = .55; g.add(w);
    const p = new T.Mesh(new T.CylinderGeometry(.05, .05, 1.7, 6), darkM); p.position.y = 1.8; g.add(p);
    const lm = new T.MeshBasicMaterial({color: 0xffd28a}), l = new T.Mesh(new T.SphereGeometry(.22, 12, 10), lm); l.position.y = 2.75; g.add(l);
    const sp = K.sprite(T, 0xffd28a, 6, .8); sp.position.y = 2.75; g.add(sp);
    g.position.set(gx + s * GW, 0, gz); R.shadows(b, true, false); scene.add(g);
    return {g, lm, sp, ph: i * 2 + s};
  }));
  // Das Boot
  const boat = new T.Group(), woodM = R.pbr(T, 'wood', 3, 1, {roughness: .62, side: T.DoubleSide, envMapIntensity: .5});
  const hull = new T.Mesh(new T.SphereGeometry(1, 30, 14, 0, TAU, Math.PI / 2, Math.PI / 2), woodM); hull.scale.set(1, .64, 2.7); hull.position.y = .44; boat.add(hull);
  const rim = new T.Mesh(new T.TorusGeometry(1, .055, 8, 44), new T.MeshStandardMaterial({color: 0x3a2414, roughness: .5})); rim.scale.set(1, 2.7, 1); rim.rotation.x = Math.PI / 2; rim.position.y = .44; boat.add(rim);
  for (const z of [-.75, .85]) { const s = new T.Mesh(new T.BoxGeometry(1.75, .07, .34), woodM); s.position.set(0, .3, z); boat.add(s); }
  const figs = {a: K.princess(T), d: K.prince(T)};
  figs.a.scale.setScalar(.6); figs.a.position.set(-.3, -.02, -.8); figs.d.scale.setScalar(.6); figs.d.position.set(.3, -.02, .8); boat.add(figs.a, figs.d);
  const pads = {};
  for (const k of ['a', 'd']) {
    const sg = k === 'a' ? -1 : 1, pv = new T.Group(); pv.position.set(sg * .78, .82, k === 'a' ? -.8 : .8);
    const sh = new T.Mesh(new T.CylinderGeometry(.032, .032, 1.9, 8), new T.MeshStandardMaterial({color: 0xcaa878, roughness: .6})); sh.position.y = -.55; pv.add(sh);
    const bl = new T.Mesh(new T.BoxGeometry(.24, .56, .03), new T.MeshStandardMaterial({color: k === 'a' ? 0xf4a8b8 : 0x9cc7ff, roughness: .5})); bl.position.y = -1.6; pv.add(bl);
    boat.add(pv); pads[k] = pv;
  }
  const bowL = new T.Mesh(new T.SphereGeometry(.14, 10, 8), new T.MeshBasicMaterial({color: 0xffd08a})); bowL.position.set(0, .95, -2.5); boat.add(bowL);
  const bowP = new T.Mesh(new T.CylinderGeometry(.03, .03, .6, 6), darkM); bowP.position.set(0, .68, -2.5); boat.add(bowP);
  const bowLight = new T.PointLight(0xffc070, .9, 9, 1.5); bowLight.position.set(0, 1.1, -2.2); boat.add(bowLight);
  const bowG = K.sprite(T, 0xffc070, 2.4, .6); bowG.position.set(0, .95, -2.5); boat.add(bowG);
  R.shadows(boat); scene.add(boat);
  // treibende Blätter zeigen die Strömung
  const LN = 60, lpos = new Float32Array(LN * 3), lgeo = new T.BufferGeometry(); lgeo.setAttribute('position', new T.BufferAttribute(lpos, 3));
  const leaves = new T.Points(lgeo, new T.PointsMaterial({color: 0xffe2b0, size: .5, map: K.glowTex(T), transparent: true, opacity: .7, depthWrite: false})); leaves.frustumCulled = false; scene.add(leaves);
  const ldat = Array.from({length: LN}, (_, i) => ({x: -80 + (i * 37) % 160, z: -152 - (i * 13) % 78, v: .6 + (i % 5) * .12}));
  const upd = decorate(T, scene, R, K);
  return {scene, cam, sky, sun, water, boat, figs, pads, buoys, beam, lg, leaves, ldat, upd, rip: 0, camPos: null};
}

/* ---------- Umgebung: Ufer, Wälder, Schilf, Seerosen, Laternen, Boote, Tiere ---------- */
const shoreH = (d, z) => Math.min(Math.max(d, 0), 60) * .11 + Math.sin(z * .031) * 1.3 * Math.min(1, Math.max(d, 0) / 18) + Math.sin(z * .12 + d * .25) * .45 * Math.min(1, Math.max(d, 0) / 8) - .5;
const isleY = rho => 5.2 * Math.sqrt(Math.max(0, 1 - (rho / ISLE.r) ** 2)) - .7;
function decorate(T, scene, R, K) {
  const upd = [], r = R.rng(51), add = (geo, mat, x, y, z, par = scene) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
  const wood = R.pbr(T, 'wood', 1, 1, {roughness: .8}), roofM = new T.MeshStandardMaterial({color: 0x7a342a, roughness: .85, flatShading: true}), wallM = R.pbr(T, 'stone', 2, 1.2, {color: 0xeadfce}), winM = new T.MeshBasicMaterial({color: 0xffc070}), dark = new T.MeshStandardMaterial({color: 0x2a2428, roughness: .7});
  const cottage = (x, y, z, ry, sc = 1) => {
    const g = new T.Group(); add(new T.BoxGeometry(5, 3, 4), wallM, 0, 1.5, 0, g); const rf = add(new T.ConeGeometry(4.3, 2.4, 4), roofM, 0, 4.2, 0, g); rf.rotation.y = Math.PI / 4; rf.scale.z = .85;
    add(new T.BoxGeometry(.7, 1.6, .7), wallM, 1.3, 4.4, -.4, g); add(new T.PlaneGeometry(.9, 1.7), dark, 0, .85, 2.02, g);
    for (const wx of [-1.5, 1.5]) add(new T.PlaneGeometry(.8, .9), winM, wx, 1.8, 2.02, g);
    const gl = K.sprite(T, 0xffb060, 5, .5); gl.position.set(0, 1.8, 2.4); g.add(gl);
    g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(sc); R.shadows(g, false, true); scene.add(g); return g;
  };
  // Ufer links und rechts mit Wald, Schilf, Steinen, Wiesen und Häusern
  for (const s of [-1, 1]) {
    const geo = new T.PlaneGeometry(100, 700, 16, 90); geo.rotateX(-Math.PI / 2); const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setY(i, shoreH(s * pa.getX(i) + 50, pa.getZ(i) - 200));
    geo.computeVertexNormals(); const land = add(geo, R.pbr(T, 'ground', 16, 110, {color: 0xa8b878, roughness: 1}), s * 138, 0, -200); land.receiveShadow = true;
    const P = (d0, d1, n, f) => Array.from({length: n}, () => { const d = d0 + r() * (d1 - d0), z = 60 - r() * 620; return f(s * (88 + d), shoreH(d, z), z, d); });
    scene.add(R.forest(T, P(9, 80, 115, (x, y, z) => ({x, y: y - .2, z, s: .9 + r() * .9})), {seed: 21 + s, noShadow: true}));
    scene.add(R.bushes(T, P(5, 50, 50, (x, y, z) => ({x, y: y - .1, z, s: 1 + r() * 1.2})), {seed: 31 + s}));
    scene.add(R.plants(T, 'reed', P(-2, 3, 170, (x, y, z) => ({x, y: -.12, z, s: .8 + r() * .7})), {w: 1.4, h: 2.7, seed: 2 + s}));
    scene.add(R.plants(T, 'grass', P(3, 45, 180, (x, y, z) => ({x, y, z, s: 1.2 + r() * 1.4})), {w: 1.8, h: 1.2, seed: 5 + s, color: 0xd8e8b0}));
    scene.add(R.plants(T, 'flower', P(4, 30, 70, (x, y, z) => ({x, y, z, s: 1.1 + r()})), {w: 1.6, h: 1.2, seed: 7 + s}));
    scene.add(R.stones(T, P(-3, 9, 46, (x, y, z) => ({x, y: Math.max(y, -.3), z, s: .5 + r() * 1.9})), {seed: 11 + s, noShadow: true}));
    for (const z of s < 0 ? [-70, -300] : [-150, -385]) { const d = 17 + r() * 6; cottage(s * (88 + d), shoreH(d, z) - .1, z, -s * (1.2 + r() * .5), 1.1); }
  }
  // Windmühle am rechten Ufer
  { const d = 30, z = -232, g = new T.Group(); add(new T.CylinderGeometry(1.6, 2.6, 9, 10), wallM, 0, 4.5, 0, g); add(new T.ConeGeometry(2.1, 2.2, 10), roofM, 0, 10.1, 0, g);
    const hub = new T.Group(); hub.position.set(-1.9, 8.6, 0); for (let i = 0; i < 4; i++) { const b = add(new T.BoxGeometry(.12, 6.4, 1.1), wood, 0, 0, 0, hub); b.geometry.translate(0, 3.5, 0); b.rotation.x = i * Math.PI / 2; } g.add(hub);
    for (const wy of [3, 6]) add(new T.PlaneGeometry(.6, .8), winM, -2.2 + (wy - 3) * .12, wy, 0, g).rotation.y = -Math.PI / 2;
    g.position.set(88 + d, shoreH(d, z), z); scene.add(g); upd.push(t => { hub.rotation.x = t * .35; }); }
  // Startsteg und Ufer hinter dem Boot
  { const deck = add(new T.BoxGeometry(3.2, .22, 10), R.pbr(T, 'wood', 1, 3, {roughness: .8}), 0, .72, 10.5); deck.receiveShadow = true;
    for (const z of [6, 10, 14]) for (const x of [-1.5, 1.5]) add(new T.CylinderGeometry(.15, .15, 2.6, 8), wood, x, .2, z);
    const lp = add(new T.CylinderGeometry(.05, .06, 2.2, 6), dark, 1.4, 1.9, 6.2); void lp; add(new T.SphereGeometry(.2, 10, 8), winM, 1.4, 3.05, 6.2); const lg = K.sprite(T, 0xffb060, 5, .6); lg.position.set(1.4, 3.05, 6.2); scene.add(lg);
    const land = add(new T.PlaneGeometry(260, 80), R.pbr(T, 'ground', 40, 12, {color: 0xa8b878, roughness: 1}), 0, .35, 55); land.rotation.x = -Math.PI / 2;
    const Q = (n, f) => Array.from({length: n}, () => f(-110 + r() * 220, 17 + r() * 60));
    scene.add(R.forest(T, Q(46, (x, z) => ({x: Math.abs(x) < 9 && z < 34 ? x + 14 : x, y: .3, z: z + 4, s: 1 + r() * .8})), {seed: 41, noShadow: true}));
    scene.add(R.plants(T, 'reed', Q(70, x => ({x, y: -.1, z: 13.5 + r() * 2.5, s: .8 + r() * .7})), {w: 1.4, h: 2.7, seed: 4}));
    scene.add(R.plants(T, 'grass', Q(110, (x, z) => ({x, y: .35, z, s: 1 + r()})), {w: 1.8, h: 1.2, seed: 6, color: 0xd8e8b0}));
    scene.add(R.stones(T, Q(24, x => ({x, y: 0, z: 14 + r() * 4, s: .5 + r() * 1.3})), {seed: 14, noShadow: true}));
    cottage(-11, .35, 26, .3, 1.3); add(new T.BoxGeometry(.9, .9, .9), wood, 1, 1.28, 13.2); add(new T.CylinderGeometry(.42, .42, 1, 12), wood, -1, 1.33, 13.4); }
  // Seerosen in kleinen Feldern
  { const cl = [[-10, -70], [20, -100], [8, -150], [-36, -160], [28, -198], [-28, -232], [16, -290], [-28, -306], [36, -352], [-20, -362], [-60, -40], [60, -130], [-62, -260], [58, -300], [-8, -24], [44, -60]], pads = [], fl = [];
    cl.forEach(([cx, cz]) => { for (let i = 0; i < 11; i++) { const a = r() * 6.28, d = 2 + r() * 5.5, p = {x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, s: .6 + r() * .8}; pads.push(p); if (r() < .3) fl.push(p); } });
    const pg = new T.CircleGeometry(.5, 12, .25, 5.9); pg.rotateX(-Math.PI / 2); const pim = new T.InstancedMesh(pg, new T.MeshStandardMaterial({color: 0xffffff, roughness: .55, side: T.DoubleSide}), pads.length), D = new T.Object3D(), c = new T.Color();
    pads.forEach((p, i) => { D.position.set(p.x, .045, p.z); D.rotation.set(0, r() * 6.28, 0); D.scale.setScalar(p.s); D.updateMatrix(); pim.setMatrixAt(i, D.matrix); const v = r(); c.setRGB(.16 + v * .12, .38 + v * .2, .16 + v * .08); pim.setColorAt(i, c); });
    pim.instanceColor.needsUpdate = true; pim.frustumCulled = false; scene.add(pim);
    const fim = new T.InstancedMesh(new T.SphereGeometry(.17, 8, 6), new T.MeshStandardMaterial({color: 0xffd0e0, emissive: 0xf48aa3, emissiveIntensity: .35, roughness: .5}), fl.length);
    fl.forEach((p, i) => { D.position.set(p.x, .14, p.z); D.rotation.set(0, 0, 0); D.scale.set(1, .6, 1); D.updateMatrix(); fim.setMatrixAt(i, D.matrix); }); fim.frustumCulled = false; scene.add(fim); }
  // Schwimmende Lichter
  { const N = 20, pos = Array.from({length: N}, (_, i) => ({x: -62 + r() * 124, z: -25 - r() * 380, p: r() * 6})), D = new T.Object3D();
    const im = new T.InstancedMesh(new T.CylinderGeometry(.2, .16, .28, 8), new T.MeshBasicMaterial({color: 0xffd9a0}), N); im.frustumCulled = false; scene.add(im);
    const gp = new Float32Array(N * 3), gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(gp, 3));
    const glow = new T.Points(gg, new T.PointsMaterial({color: 0xffb060, size: 3.4, map: R.softTex(T), transparent: true, opacity: .75, depthWrite: false, blending: T.AdditiveBlending})); glow.frustumCulled = false; scene.add(glow);
    upd.push(t => { pos.forEach((p, i) => { const x = p.x + Math.sin(t * .1 + p.p) * 2.5, y = .13 + Math.sin(t * 1.2 + p.p) * .04, z = p.z + Math.cos(t * .08 + p.p) * 2.5; D.position.set(x, y, z); D.rotation.set(0, t * .2 + p.p, 0); D.updateMatrix(); im.setMatrixAt(i, D.matrix); gp[i * 3] = x; gp[i * 3 + 1] = y + .12; gp[i * 3 + 2] = z; }); im.instanceMatrix.needsUpdate = true; gg.attributes.position.needsUpdate = true; }); }
  // Segelboote in der Ferne
  { const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 5.6, 0, 0, .3, 3], 3)); sg.computeVertexNormals();
    const sailM = new T.MeshStandardMaterial({color: 0xfff0dc, side: T.DoubleSide, roughness: .9, emissive: 0x402818, emissiveIntensity: .5}), hullM = new T.MeshStandardMaterial({color: 0xf0e6da, roughness: .6});
    [[-58, -120, .6], [62, -245, -1.1], [-52, -335, 2.2], [66, -90, 1.9]].forEach(([x, z, ry], i) => {
      const g = new T.Group(), h = add(new T.SphereGeometry(1, 16, 8, 0, 6.2832, Math.PI / 2, Math.PI / 2), hullM, 0, .5, 0, g); h.scale.set(1.1, .7, 3.2); h.material.side = T.DoubleSide;
      add(new T.CylinderGeometry(.06, .08, 6.6, 6), dark, 0, 3.6, -.4, g); add(sg, sailM, 0, .9, -.3, g); const j = add(sg, sailM, 0, .9, -.5, g); j.scale.set(1, .75, -.7);
      const l = K.sprite(T, 0xffc070, 2.4, .7); l.position.set(0, 1.3, 2.6); g.add(l);
      g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); upd.push(t => { g.position.y = Math.sin(t * 1.1 + i) * .08; g.rotation.z = Math.sin(t * .8 + i * 2) * .04; });
    }); }
  // Entenfamilie beim Start
  { const bm = new T.MeshStandardMaterial({color: 0xcbb89a, roughness: .9}), hm = new T.MeshStandardMaterial({color: 0x3c6a4a, roughness: .8}), km = new T.MeshStandardMaterial({color: 0xe8a030, roughness: .6});
    const ducks = Array.from({length: 6}, (_, i) => { const g = new T.Group(), sc = i ? .6 : 1; add(new T.SphereGeometry(.3, 10, 8), bm, 0, .12, 0, g).scale.set(.85, .7, 1.4); add(new T.SphereGeometry(.14, 8, 6), i ? bm : hm, 0, .42, -.34, g); const k = add(new T.ConeGeometry(.05, .16, 6), km, 0, .4, -.5, g); k.rotation.x = -Math.PI / 2; g.scale.setScalar(sc); scene.add(g); return g; });
    upd.push(t => ducks.forEach((d, i) => { const a = t * .12 - i * .14; d.position.set(-16 + Math.cos(a) * 7, Math.sin(t * 2 + i) * .02, -24 + Math.sin(a) * 5); d.rotation.y = -a + Math.PI; })); }
  // Vögel und Nebelschwaden
  for (const b of [R.birds(T, 12, {x: ISLE.x + 4, z: ISLE.z - 6, r0: 16, r1: 30, h0: 27, h1: 14, color: 0x2a2630, fog: false, seed: 3}), R.birds(T, 8, {x: 10, z: -90, r0: 30, r1: 40, h0: 15, h1: 10, color: 0x2a2630, fog: false, seed: 8})]) { scene.add(b); upd.push(b.userData.upd); }
  const mist = R.mist(T, 18, {box: [-150, 1.2, -470, 150, 4.5, -110], color: 0xffd4b8, op: .1, size: 30, seed: 2}); scene.add(mist); upd.push(mist.userData.upd);
  // Steg am Leuchtturm: Fässer, Kisten, Laternen, Pfähle, ein festgemachtes Boot
  { add(new T.CylinderGeometry(.42, .42, 1, 12), wood, PIER.x - 1, 1.36, PIER.z - 9); add(new T.CylinderGeometry(.42, .42, 1, 12), wood, PIER.x - .9, 1.36, PIER.z - 10); add(new T.BoxGeometry(.9, .9, .9), wood, PIER.x + 1, 1.31, PIER.z - 10.5); add(new T.BoxGeometry(.6, .6, .6), wood, PIER.x + .9, 2.06, PIER.z - 10.4).rotation.y = .5;
    for (const z of [-3, -8.5]) { add(new T.CylinderGeometry(.05, .06, 1.7, 6), dark, PIER.x - 1.5, 1.7, PIER.z + z); add(new T.SphereGeometry(.2, 10, 8), winM, PIER.x - 1.5, 2.65, PIER.z + z); const g = K.sprite(T, 0xffb060, 5, .6); g.position.set(PIER.x - 1.5, 2.65, PIER.z + z); scene.add(g); }
    for (const [x, z] of [[-5, 2], [5.5, 1], [-6, -5], [6.5, -6]]) add(new T.CylinderGeometry(.2, .22, 2.4, 8), wood, PIER.x + x, .6, PIER.z + z);
    const tb = add(new T.SphereGeometry(1, 18, 8, 0, 6.2832, Math.PI / 2, Math.PI / 2), R.pbr(T, 'wood', 2, 1, {side: T.DoubleSide, color: 0xb89a80}), PIER.x + 3.4, .3, PIER.z - 4); tb.scale.set(.75, .5, 1.9); upd.push(t => { tb.position.y = .3 + Math.sin(t * 1.4) * .05; tb.rotation.z = Math.sin(t) * .05; }); }
  // Insel: Steine, Wiese, Blumen, Büsche, Zaun, Rauch aus dem Schornstein
  { const I = (n, r0, r1, f) => Array.from({length: n}, () => { const a = r() * 6.28, rho = r0 + r() * (r1 - r0); return f(ISLE.x + Math.cos(a) * rho, isleY(rho), ISLE.z + Math.sin(a) * rho); });
    scene.add(R.stones(T, I(34, 15, 25, (x, y, z) => ({x, y: y - .1, z, s: .4 + r() * 1.3})), {seed: 3}));
    scene.add(R.plants(T, 'grass', I(170, 3, 22, (x, y, z) => ({x, y, z, s: .7 + r() * .7})), {w: 1.3, h: .9, seed: 9, color: 0xd8e8b0}));
    scene.add(R.plants(T, 'flower', I(60, 3, 20, (x, y, z) => ({x, y, z, s: .7 + r() * .5})), {w: 1.2, h: .9, seed: 3}));
    scene.add(R.bushes(T, I(14, 8, 21, (x, y, z) => ({x, y: y - .1, z, s: .6 + r() * .7})), {seed: 5}));
    for (let i = 0; i < 9; i++) { const z = PIER.z - 9 - i * 1.6, rho = Math.abs(z - ISLE.z); for (const sx of [-1.9, 1.9]) add(new T.BoxGeometry(.1, .9, .1), wood, ISLE.x + sx, isleY(rho) + .45, z); }
    const smoke = Array.from({length: 6}, (_, i) => { const sp = new T.Sprite(new T.SpriteMaterial({map: R.softTex(T), color: 0xe8d8d0, transparent: true, opacity: .3, depthWrite: false})); scene.add(sp); return sp; });
    upd.push(t => smoke.forEach((sp, i) => { const k = (t * .12 + i / 6) % 1; sp.position.set(ISLE.x - 7.7 + k * 3, 8.4 + k * 9, ISLE.z - 2.4); const s = 1 + k * 3.5; sp.scale.set(s, s, 1); sp.material.opacity = .32 * (1 - k); })); }
  return upd;
}

const see = {
  id: 'see', n: 'Über den See', ic: '≈', t3: 150, t2: 240, ctrl: 'tap', three: true, noClamp: true, isNew: true,
  skinName: () => `${nm('a')}: linkes Paddel · ${nm('d')}: rechtes Paddel`,
  h: () => `Ihr sitzt im selben Boot: ${nm('a')} paddelt links, ${nm('d')} rechts. Wer allein paddelt, dreht das Boot zur anderen Seite. Paddelt ihr im Gleichtakt, gleitet es geradeaus und schneller. Fahrt durch alle sechs Bojen-Tore, vorbei an den Felsen, bis zum Steg am Leuchtturm.`,
  ctrlText: () => 'Tippe irgendwo auf den Bildschirm für einen Paddelschlag. Am besten zählt ihr laut mit: „und – jetzt!“',
  start: () => ({x: 0, y: 0}),
  countText: () => S.count >= GATES.length ? 'Zum Steg!' : `Tor ${S.count + 1}/${GATES.length}`,
  note: () => `${S.aux.sync || 0}× im Gleichtakt gepaddelt`,
  setup() { S.aux = {b: {x: 0, z: 0, h: 0, v: 0, w: 0}, gate: 0, last: {a: -9, d: -9}, sync: 0, cur: 0, curT: 0, hitT: -9}; S.total = GATES.length + 1; },
  move(dt, inp) {
    const now = performance.now();
    if ((inp.taps.length || inp.dirs.length) && now - (LOC.myT || 0) > CDT * 1000) { LOC.myT = now; act({k: 'row'}); }
  },
  action(k, d) {
    if (d.k !== 'row') return;
    const A = S.aux, b = A.b; if (S.t - A.last[k] < CDT - .08) return;
    const sg = k === 'a' ? -1 : 1, together = S.t - A.last[OTH(k)] < .27;
    A.last[k] = S.t; b.v = Math.min(VMAX, b.v + 1.9); b.w += sg * .5;
    emit({k: 'stroke', o: k});
    if (together) { b.v = Math.min(VMAX + .9, b.v + .65); b.w *= .4; A.sync++; emit({k: 'sync'}); }
  },
  fx(e) { if (e.k === 'stroke') { (LOC.st = LOC.st || {})[e.o] = performance.now(); (LOC.newRip = LOC.newRip || []).push(e.o); } if (e.k === 'sync') LOC.syncT = performance.now(); },
  update(dt) {
    const A = S.aux, b = A.b, f = fwd(b.h);
    b.v *= Math.exp(-.3 * dt); b.w *= Math.exp(-1.7 * dt); b.h += b.w * dt;
    b.x += f.x * b.v * dt; b.z += f.z * b.v * dt;
    A.cur = b.z < -150 && b.z > -232 ? 1 : 0;
    if (A.cur) { b.x += .75 * dt; if (!A.curT) { A.curT = 1; emit({k: 'toast', txt: 'Strömung! Sie treibt euch nach rechts – haltet dagegen.'}); } }
    for (const [rx, rz, r] of ROCKS.concat([[ISLE.x, ISLE.z, ISLE.r]])) {
      const dx = b.x - rx, dz = b.z - rz, d = Math.hypot(dx, dz) || 1, m = r + 1.4;
      if (d >= m) continue;
      b.x = rx + dx / d * m; b.z = rz + dz / d * m;
      if (b.v > 1.2 && S.t - A.hitT > 1) { A.hitT = S.t; emit({k: 'bump', x: 0, y: 0}); emit({k: 'toast', txt: 'Rumms – ein Felsen! Paddelt euch frei.'}); API.shake(.4); }
      b.v *= .4;
    }
    b.x = clamp(b.x, -78, 78); b.z = clamp(b.z, -470, 2.5);
    if (A.gate < GATES.length) {
      const g = GATES[A.gate];
      if (Math.hypot(b.x - g[0], b.z - g[1]) < GW - .8) {
        A.gate++; S.count = A.gate; emit({k: 'lit'});
        if (A.gate >= GATES.length) emit({k: 'toast', txt: 'Alle Tore geschafft – jetzt zum Steg am Leuchtturm!'});
      }
    } else if (Math.hypot(b.x - PIER.x, b.z - PIER.z) < 6.5) { S.count = S.total; emit({k: 'goal', x: 0, y: 0}); finish(2.8); }
  },
  render3d(t) {
    const T = window.THREE, K = window.ZL_KIT(API), R = window.ZL_REAL(API), sc = API.screen();
    if (!LOC.M) { LOC.M = build(T); LOC.__dispose = () => API.disposeTree(LOC.M.scene); }
    const M = LOC.M, A = S.aux, v = boatView(t); if (!v) return;
    const dt = Math.min(.05, Math.max(0, t - (M.lt || t))); M.lt = t;
    const f = fwd(v.h), now = performance.now();
    M.boat.position.set(v.x, Math.sin(t * 1.3) * .05, v.z);
    M.boat.rotation.set(Math.sin(t * 1.1) * .02 - A.b.v * .004, v.h, Math.sin(t * .9) * .03 + clamp(A.b.w * .14, -.14, .14));
    // Paddel
    for (const k of ['a', 'd']) {
      const sg = k === 'a' ? -1 : 1, p = ((now - ((LOC.st || {})[k] || -9999)) / 1000) / .45, pv = M.pads[k];
      if (p < 1) { pv.rotation.x = .8 * Math.cos(p * Math.PI); pv.rotation.z = sg * (.5 + .28 * Math.sin(p * Math.PI)); }
      else { const q = clamp((p - 1) * 1.4, 0, 1); pv.rotation.x = -.8 + q * 1.05; pv.rotation.z = sg * (.5 - .14 * Math.sin(q * Math.PI)); }
      M.figs[k].rotation.x = p < 1 ? .12 * Math.sin(p * Math.PI) : 0;
    }
    // Ringe im Wasser
    const U = M.water.userData.u;
    for (const k of (LOC.newRip || []).splice(0)) { const sg = k === 'a' ? -1 : 1, r = U.uRip.value[M.rip++ % 6]; r.set(v.x + Math.cos(v.h) * sg * 1.6 + f.x * (k === 'a' ? .6 : -1), v.z - Math.sin(v.h) * sg * 1.6 + f.z * (k === 'a' ? .6 : -1), t, 1); }
    // Bojen
    M.buoys.forEach((pair, i) => pair.forEach(b => {
      b.g.position.y = Math.sin(t * 1.4 + b.ph) * .08; b.g.rotation.z = Math.sin(t * 1.1 + b.ph) * .05;
      const st = i < A.gate ? 0 : i === A.gate ? 1 : 2, c = st === 0 ? 0x7be3a4 : st === 1 ? 0xffd28a : 0xff8a70;
      b.lm.color.set(c); b.sp.material.color.set(c); b.sp.material.opacity = st === 1 ? .75 + Math.sin(t * 5) * .2 : st === 0 ? .35 : .22; const s = st === 1 ? 8 + Math.sin(t * 5) : 4; b.sp.scale.set(s, s, 1);
    }));
    M.upd.forEach(f => f(t, dt));
    M.beam.rotation.y = t * .5; M.lg.material.opacity = .45 + Math.sin(t * 3) * .08;
    const lp = M.leaves.geometry.attributes.position;
    M.ldat.forEach((l, i) => { l.x += l.v * dt; if (l.x > 80) l.x = -80; lp.setXYZ(i, l.x, .06, l.z + Math.sin(t * .5 + i) * .6); }); lp.needsUpdate = true;
    // Kamera hinter dem Boot
    const want = new T.Vector3(v.x - f.x * 8.8, 4, v.z - f.z * 8.8);
    if (!M.camPos || M.camPos.distanceTo(want) > 30) M.camPos = want.clone(); M.camPos.lerp(want, Math.min(1, dt * 3.5));
    M.cam.position.copy(M.camPos); M.cam.lookAt(v.x + f.x * 7, 1, v.z + f.z * 7);
    M.cam.aspect = sc.cw / sc.ch; M.cam.fov = sc.cw < sc.ch ? 68 : 56; M.cam.updateProjectionMatrix();
    M.sky.position.copy(M.cam.position); M.sky.userData.u.tm.value = t; R.sunAt(M.sun, v.x, 0, v.z);
    API.render3D(M.scene, M.cam, {bloom: .7, th: .72});
    // Anzeige
    const wp = new T.Vector3();
    for (const k of ['a', 'd']) { M.figs[k].getWorldPosition(wp); wp.y += k === 'a' ? 2.15 : 1.7; const p = K.proj(M.cam, wp); if (p.ok) K.nameTag(nm(k), p.x, p.y, COL[k]); }
    const tg = A.gate < GATES.length ? {x: GATES[A.gate][0], z: GATES[A.gate][1], n: `Tor ${A.gate + 1}`} : {x: PIER.x, z: PIER.z, n: 'Steg'};
    const dx = tg.x - v.x, dz = tg.z - v.z, fc = dx * f.x + dz * f.z, rc = dx * Math.cos(v.h) - dz * Math.sin(v.h), ang = Math.atan2(rc, fc), dist = Math.hypot(dx, dz);
    ctx.save(); ctx.translate(sc.cw / 2, 112);
    ctx.fillStyle = 'rgba(12,9,26,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(243,201,143,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.rotate(ang); ctx.fillStyle = rgba(CG, 1); ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(11, 10); ctx.lineTo(0, 4); ctx.lineTo(-11, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    label(`${tg.n} · ${Math.round(dist)} m`, sc.cw / 2, 164, CG, 14, 700);
    const off = Math.abs(ang) > .5 ? (ang > 0 ? `Nach rechts drehen: nur ${nm('a')} paddelt` : `Nach links drehen: nur ${nm('d')} paddelt`) : '';
    if (off && S.phase === 'play' && !S.done) label(off, sc.cw / 2, 186, [255, 235, 215], 13, 600);
    if (A.cur) label('≈ Strömung nach rechts ≈', sc.cw / 2, 208, [190, 225, 255], 13, 700);
    const y = sc.ch - 78;
    ['a', 'd'].forEach((k, i) => {
      const x = sc.cw * (i ? .8 : .2), cd = clamp((hostNow() - A.last[k]) / CDT, 0, 1), mineK = k === API.me;
      ctx.fillStyle = 'rgba(12,9,26,.55)'; ctx.beginPath(); ctx.arc(x, y, 31, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(COL[k], cd >= 1 ? 1 : .35); ctx.lineWidth = mineK ? 4 : 2.5; ctx.beginPath(); ctx.arc(x, y, 31, -Math.PI / 2, -Math.PI / 2 + TAU * cd); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(i ? .5 : -.5); ctx.fillStyle = rgba(COL[k], 1); rr(-2, -18, 4, 24, 2); ctx.fill(); rr(-7, 4, 14, 16, 5); ctx.fill(); ctx.restore();
      label(mineK ? 'Du: tippen' : nm(k), x, y + 50, COL[k], 13, 700);
    });
    const sy = now - (LOC.syncT || -9999);
    if (sy < 900) { ctx.globalAlpha = 1 - sy / 900; label('Gleichtakt!', sc.cw / 2, y - 14 - sy * .03, CG, 22, 700); ctx.globalAlpha = 1; }
    label(`${(A.b.v * 3.6).toFixed(0)} km/h · ${A.sync}× Gleichtakt`, sc.cw / 2, y + 50, [235, 225, 240], 12, 600);
  }
};
return [see];
});
