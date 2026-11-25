/* Zwei Lichter – Nachtrennen v3 (ab 8.2)
   Aurelias SUV gegen Daniels Sportwagen auf der Hochstraße einer Hafenstadt bei Nacht.
   Neu: Fahrphysik mit Haftung und Drift, eigene Steuerung (Lenkdaumen + Drift- und Bremsknopf),
   Asphalt mit Relief, Betonwände, Kurvenschilder, Tunnel durch den Hügel, echte Scheinwerfer. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CG, rgba, rnd, clamp, nm, emit, finish, act, tone, buzz, rr, mine} = API;
const toast = t => API.toast(t);
const KIT = () => window.ZL_KIT(API), REAL = () => window.ZL_REAL(API);

/* ---------- Strecke ---------- */
const TP = [[0, 0], [120, 0], [220, -20], [290, -80], [300, -170], [250, -240], [170, -262], [110, -222], [90, -150], [30, -118],
  [-40, -160], [-110, -222], [-190, -232], [-252, -170], [-252, -80], [-200, -20], [-110, 10]];
const RW = 22, WALL = RW / 2 + .5, LIM = WALL - 1.3, LAPS = 2, VMX = 52, GY = -6;
const elev = u => 3.2 * Math.sin(u * TAU * 2 + .5) + 1.8 * Math.sin(u * TAU * 5 + 1.3) + 6.5 * Math.exp(-(((u - .07) / .022) ** 2));
const TRACK = (() => {
  const pts = [], n = TP.length, per = 50;
  const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  for (let i = 0; i < n; i++) {
    const p0 = TP[(i - 1 + n) % n], p1 = TP[i], p2 = TP[(i + 1) % n], p3 = TP[(i + 2) % n];
    for (let k = 0; k < per; k++) { const t = k / per; pts.push({x: cr(p0[0], p1[0], p2[0], p3[0], t), z: cr(p0[1], p1[1], p2[1], p3[1], t)}); }
  }
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; p.s = s; s += Math.hypot(q.x - p.x, q.z - p.z); });
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], r = pts[(i - 1 + pts.length) % pts.length], tx = q.x - r.x, tz = q.z - r.z, l = Math.hypot(tx, tz);
    p.tx = tx / l; p.tz = tz / l; p.nx = p.tz; p.nz = -p.tx; p.u = p.s / s; p.y = elev(p.u) + 4;
  });
  // Krümmung: > 0 heißt Linkskurve (zur Seite n)
  pts.forEach((p, i) => { const a = pts[(i - 6 + pts.length) % pts.length], b = pts[(i + 6) % pts.length]; p.k = ((b.tx - a.tx) * p.nx + (b.tz - a.tz) * p.nz) / 21.6; });
  return {pts, len: s};
})();
const NPT = TRACK.pts.length, PTS = TRACK.pts;
function nearestT(x, z, hint) {
  let best = 0, bd = Infinity;
  const scan = (a, b) => { for (let k = a; k <= b; k++) { const i = ((k % NPT) + NPT) % NPT, p = PTS[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } };
  if (hint != null) scan(hint - 40, hint + 40); else scan(0, NPT - 1);
  if (bd > 1600) scan(0, NPT - 1);
  const p = PTS[best], q = PTS[(best + 1) % NPT];
  const along = (x - p.x) * p.tx + (z - p.z) * p.tz, seg = Math.hypot(q.x - p.x, q.z - p.z) || 1, f = clamp(along / seg, 0, 1);
  return {i: best, lat: (x - p.x) * p.nx + (z - p.z) * p.nz, s: p.s + along, y: p.y + (q.y - p.y) * f};
}
const PADS = [[.16, -5], [.27, 5], [.41, 0], [.52, -4], [.77, 5], [.9, -3]].map(([u, lat]) => ({i: Math.floor(u * NPT), lat}));
const HEARTS = [];
[[.11, 0], [.33, -1], [.47, 1], [.71, 0], [.86, -1]].forEach(([u, side], r) => { for (let k = 0; k < 5; k++) { const i = Math.floor(u * NPT) + k * 4, lat = (side * 2.6) + (k - 2) * 1.9 * (r % 2 ? 1 : -1) * .9; HEARTS.push({i: i % NPT, lat}); } });
const TUNNEL = [.56, .67], inTunnel = u => u > TUNNEL[0] && u < TUNNEL[1];
function startPos(k) { const p = PTS[NPT - 14], o = k === 'a' ? -4.2 : 4.2; return {x: p.x + p.nx * o, y: p.z + p.nz * o}; }
const flagsOf = c => (c.drift > DR1 ? (c.drift > DR2 ? 2 : 1) : 0) + (c.boost > 0 ? 4 : 0) + (c.braking ? 8 : 0) + (c.drift ? 16 : 0);
const DR1 = .7, DR2 = 1.7;

/* ---------- Steuerung: linker Daumen lenkt, rechts Drift und Bremse ---------- */
const zones = (cw, ch) => ({drift: {x: cw - 76, y: ch - 120, r: 50}, brake: {x: cw - 58, y: ch - 232, r: 34}});
function readPad(inp) {
  const P = inp.pad, out = {steer: 0, drift: false, brake: false};
  if (!P) return out;
  const Z = zones(P.cw, P.ch); let st = null;
  for (const T of P.tp) {
    if (!T.role) T.role = Math.hypot(T.sx - Z.brake.x, T.sy - Z.brake.y) < Z.brake.r + 10 ? 'brake' : T.sx > P.cw * .56 ? 'drift' : 'steer';
    if (T.role === 'brake') out.brake = true; else if (T.role === 'drift') out.drift = true; else st = T;
  }
  if (st) {
    const R0 = 60; let dx = st.x - st.sx;
    if (Math.abs(dx) > R0) { st.sx = st.x - Math.sign(dx) * R0; dx = Math.sign(dx) * R0; }
    const v = Math.abs(dx) < 4 ? 0 : dx / R0; out.steer = Math.sign(v) * Math.pow(Math.abs(v), 1.2);
  } else if (P.tilt) out.steer = clamp(P.tilt.x * 1.3, -1, 1);
  if (P.key('arrowleft') || P.key('a')) out.steer = -1;
  if (P.key('arrowright') || P.key('d')) out.steer = 1;
  if (P.key(' ') || P.key('arrowup') || P.key('w')) out.drift = true;
  if (P.key('arrowdown') || P.key('s')) out.brake = true;
  LOC.padUI = {st, Z};
  return out;
}

/* ---------- Autos ---------- */
function makeCar(T, kind) {
  const K = KIT(), g = new T.Group(), body = new T.Group(); g.add(body);
  const suv = kind === 'suv';
  const paint = new T.MeshPhysicalMaterial({color: suv ? 0xc97f95 : 0x3f6fc4, metalness: .55, roughness: .34, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: 1.1});
  const glass = new T.MeshStandardMaterial({color: 0x0b0f18, metalness: .9, roughness: .06, envMapIntensity: 1.3});
  const trim = new T.MeshStandardMaterial({color: 0x121318, metalness: .4, roughness: .55});
  const chrome = new T.MeshStandardMaterial({color: 0xd8dce6, metalness: 1, roughness: .2});
  const W = suv ? 2.3 : 2.2;
  const lower = suv
    ? [[-2.5, .45], [-2.55, 1.0], [-2.25, 1.32], [2.35, 1.4], [2.55, 1.15], [2.55, .45]]
    : [[-2.6, .32], [-2.65, .6], [-2.3, .78], [-1.0, .95], [1.6, 1.0], [2.5, .98], [2.6, .7], [2.6, .32]];
  const green = suv
    ? [[-1.3, 1.3], [-.85, 2.02], [1.7, 2.07], [2.3, 1.92], [2.35, 1.3]]
    : [[-1.05, .9], [-.25, 1.34], [.9, 1.36], [1.95, .98]];
  body.add(new T.Mesh(K.extrudeProfile(T, lower, W - .16, .08), paint));
  body.add(new T.Mesh(K.extrudeProfile(T, green, W - (suv ? .36 : .62), .05), glass));
  if (suv) {
    const roof = new T.Mesh(new T.BoxGeometry(W - .32, .1, 2.65), paint); roof.position.set(0, 2.1, .45); body.add(roof);
    for (const s of [-1, 1]) { const r = new T.Mesh(new T.BoxGeometry(.07, .08, 2.3), chrome); r.position.set(s * .85, 2.2, .45); body.add(r); }
    const skirt = new T.Mesh(new T.BoxGeometry(W + .04, .3, 4.9), trim); skirt.position.y = .55; body.add(skirt);
  } else {
    const wing = new T.Mesh(new T.BoxGeometry(W, .07, .5), trim); wing.position.set(0, 1.28, 2.35); body.add(wing);
    for (const s of [-1, 1]) { const st = new T.Mesh(new T.BoxGeometry(.07, .3, .18), trim); st.position.set(s * .75, 1.1, 2.35); body.add(st); }
    const stripe = new T.Mesh(new T.BoxGeometry(.32, .02, 4.6), new T.MeshStandardMaterial({color: 0xe8ecf4, metalness: .3, roughness: .35})); stripe.position.set(0, 1.01, .1); body.add(stripe);
    const lip = new T.Mesh(new T.BoxGeometry(W + .1, .08, .5), trim); lip.position.set(0, .32, -2.45); body.add(lip);
  }
  // Kühlergrill, Spiegel, Nummernschild
  const fy = suv ? 1.08 : .72, fz = suv ? 2.56 : 2.66, rz = suv ? 2.56 : 2.62;
  const grill = new T.Mesh(new T.BoxGeometry(W * .5, suv ? .34 : .16, .06), trim); grill.position.set(0, fy - (suv ? .28 : .2), -fz); body.add(grill);
  for (const s of [-1, 1]) { const mir = new T.Mesh(new T.BoxGeometry(.28, .14, .2), paint); mir.position.set(s * (W / 2 + .08), suv ? 1.5 : 1.02, suv ? -.9 : -.6); body.add(mir); }
  const plate = new T.Mesh(new T.BoxGeometry(.62, .16, .03), new T.MeshStandardMaterial({color: 0xe9e6dc, roughness: .6})); plate.position.set(0, fy - .12, rz + .05); body.add(plate);
  const hl = new T.MeshBasicMaterial({color: 0xc8bea4}), tl = new T.MeshBasicMaterial({color: 0x7a0c1e});
  for (const s of [-1, 1]) {
    const a = new T.Mesh(new T.BoxGeometry(.55, .16, .06), hl); a.position.set(s * (W / 2 - .38), fy, -fz); body.add(a);
    const b = new T.Mesh(new T.BoxGeometry(.6, .14, .06), tl); b.position.set(s * (W / 2 - .38), fy + .05, rz); body.add(b);
  }
  const bar = new T.Mesh(new T.BoxGeometry(W - .9, .035, .05), tl); bar.position.set(0, fy + .05, rz); body.add(bar);
  const bump = new T.Mesh(new T.BoxGeometry(W - .1, .26, .22), trim); bump.position.set(0, suv ? .58 : .42, rz - .02); body.add(bump);
  for (const s of [-1, 1]) { const ex = new T.Mesh(new T.CylinderGeometry(.07, .07, .2, 10), chrome); ex.rotation.x = Math.PI / 2; ex.position.set(s * (suv ? .7 : .45), suv ? .5 : .36, rz + .1); body.add(ex); }
  if (suv) {
    const gate = new T.Mesh(new T.BoxGeometry(W - .5, .5, .07), paint); gate.position.set(0, 1.52, rz - .22); gate.rotation.x = -.05; body.add(gate);
    const spo = new T.Mesh(new T.BoxGeometry(W - .5, .06, .34), trim); spo.position.set(0, 2.1, 2.28); body.add(spo);
    for (const s of [-1, 1]) { const tv = new T.Mesh(new T.BoxGeometry(.14, .5, .06), tl); tv.position.set(s * (W / 2 - .2), 1.5, rz - .12); body.add(tv); }
  }
  const wheels = [], r = suv ? .5 : .42, wx = W / 2 + .02, wz = suv ? 1.55 : 1.6;
  const tire = new T.MeshStandardMaterial({color: 0x0b0b0e, roughness: .9}), rim = new T.MeshStandardMaterial({color: 0xcfd3dc, metalness: .95, roughness: .22});
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new T.Group(); w.position.set(sx * wx, r, sz * wz);
    const spin = new T.Group(); w.add(spin);
    const t = new T.Mesh(new T.CylinderGeometry(r, r, .4, 22), tire); t.rotation.z = Math.PI / 2; spin.add(t);
    const c = new T.Mesh(new T.CylinderGeometry(r * .62, r * .62, .42, 10), rim); c.rotation.z = Math.PI / 2; spin.add(c);
    for (let k = 0; k < 5; k++) { const sp = new T.Mesh(new T.BoxGeometry(.43, r * 1.1, .07), rim); sp.rotation.x = k / 5 * Math.PI; spin.add(sp); }
    g.add(w); wheels.push({w, spin, front: sz < 0});
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Lichtkegel auf der Straße (für das Auto des anderen; das eigene bekommt echte Scheinwerfer)
  const beam = new T.Mesh(new T.PlaneGeometry(5, 16), new T.MeshBasicMaterial({color: 0xfff1c8, transparent: true, opacity: .07, blending: T.AdditiveBlending, depthWrite: false}));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, .07, -fz - 8); g.add(beam);
  const flames = [], tgl = [];
  for (const s of [-1, 1]) {
    const hg = K.sprite(T, 0xfff0cc, 1.2, .3); hg.position.set(s * (W / 2 - .38), fy, -fz - .25); g.add(hg);
    const tg = K.sprite(T, 0xff2a48, .9, .22); tg.position.set(s * (W / 2 - .38), fy + .05, rz + .2); g.add(tg); tgl.push(tg);
    const f = K.sprite(T, suv ? 0xffa0c0 : 0x8cc8ff, 1.8, 0); f.position.set(s * .5, .5, rz + .7); g.add(f); flames.push(f);
  }
  g.userData = {wheels, flames, body, beam, tl, tgl, fz, fy};
  return g;
}

/* ---------- Szene ---------- */
function buildScene(T) {
  const K = KIT(), R = REAL(), scene = new T.Scene(), r0 = R.rng(2026), upd = [];
  const moonDir = new T.Vector3(.5, .34, .8).normalize();
  scene.fog = new T.FogExp2(0x121a30, .0026);
  const sky = R.sky(T, {zen: 0x050816, hor: 0x1b2746, sun: moonDir, sunC: 0xaebbe6, stars: 1, cloud: .5, cloudC: 0x26304e, r: 1500}); scene.add(sky);
  scene.environment = K.env(T, 'race3', 0x070a18, 0x202c4c, 0x0b0d14, [[40, 16, -30, 30, 5, 0xffb070], [-40, 14, 30, 30, 5, 0x7090c0], [10, 50, 30, 16, 16, 0xaebbe6], [30, 6, 40, 16, 3, 0xffd9a0]]);
  const cam = new T.PerspectiveCamera(66, 1, .3, 2200);
  scene.add(new T.HemisphereLight(0x8094c8, 0x16161c, .62));
  const moon = R.sun(T, scene, moonDir, 0xb4c2f0, .7, {size: 26, map: 1024});
  // Wasser im Süden, Land mit Straßenraster im Norden
  const water = R.water(T, sky, {deep: 0x040a14, fog: .0016, size: 5000}); water.position.set(20, GY - .5, 0); scene.add(water);
  const G = 58, LX0 = -830, LZ0 = 34, LW = 1740, LD = 1160;
  const cityC = R.canvas(256), cg = cityC.getContext('2d'), emC = R.canvas(256), eg = emC.getContext('2d');
  cg.fillStyle = '#15161b'; cg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { cg.fillStyle = `rgba(${r0() < .5 ? 255 : 0},${r0() < .5 ? 255 : 0},${r0() < .5 ? 255 : 0},.035)`; cg.fillRect(r0() * 256, r0() * 256, 2, 2); }
  cg.fillStyle = '#1b2219'; R.rrect(cg, 26, 26, 204, 204, 6); cg.fill();
  cg.strokeStyle = '#3a3a40'; cg.lineWidth = 4; R.rrect(cg, 24, 24, 208, 208, 6); cg.stroke();
  cg.strokeStyle = 'rgba(220,210,180,.32)'; cg.lineWidth = 1.5; cg.setLineDash([10, 12]);
  for (const v of [0, 256]) { cg.beginPath(); cg.moveTo(v, 0); cg.lineTo(v, 256); cg.moveTo(0, v); cg.lineTo(256, v); cg.stroke(); }
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 256);
  for (const [x, y] of [[22, 22], [234, 22], [22, 234], [234, 234], [128, 20], [128, 236], [20, 128], [236, 128]]) { const gr = eg.createRadialGradient(x, y, 0, x, y, 20); gr.addColorStop(0, 'rgba(255,190,120,.75)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); eg.fillStyle = gr; eg.fillRect(x - 20, y - 20, 40, 40); }
  const mkT = c => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(LW / G, LD / G); t.anisotropy = 4; return t; };
  const land = new T.Mesh(new T.PlaneGeometry(LW, LD), new T.MeshStandardMaterial({map: mkT(cityC), emissiveMap: mkT(emC), emissive: 0xffffff, emissiveIntensity: .35, roughness: .95}));
  land.rotation.x = -Math.PI / 2; land.position.set(LX0 + LW / 2, GY, LZ0 - LD / 2); scene.add(land);
  const quay = new T.Mesh(new T.BoxGeometry(LW, 1.6, 1.2), R.pbr(T, 'stone', 300, 1, {color: 0x8a8f9a})); quay.position.set(LX0 + LW / 2, GY - .3, LZ0 + .4); scene.add(quay);

  /* --- Fahrbahn --- */
  const roadC = R.canvas(512, 1024), g = roadC.getContext('2d');
  g.fillStyle = '#2b2c31'; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 26000; i++) { const v = r0(); g.fillStyle = v < .5 ? 'rgba(0,0,0,.22)' : v < .85 ? 'rgba(130,132,140,.2)' : 'rgba(200,200,205,.2)'; g.fillRect(r0() * 512, r0() * 1024, 1 + r0() * 2, 1 + r0() * 2); }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${r0() < .5 ? 18 : 58},${r0() < .5 ? 18 : 58},64,.2)`; g.beginPath(); g.ellipse(r0() * 512, r0() * 1024, 30 + r0() * 90, 60 + r0() * 180, 0, 0, TAU); g.fill(); }
  for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(10,10,12,.3)'; g.lineWidth = 1 + r0(); let x = r0() * 512, y = r0() * 1024; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (r0() - .5) * 60; y += r0() * 70; g.lineTo(x, y); } g.stroke(); }
  for (const x of [140, 180, 330, 372]) { g.fillStyle = 'rgba(8,8,10,.16)'; g.fillRect(x, 0, 16, 1024); }
  const nrm = R.nmap(T, roadC, 2.2);
  g.fillStyle = 'rgba(176,176,170,.9)'; g.fillRect(20, 0, 9, 1024); g.fillRect(483, 0, 9, 1024);
  g.fillStyle = 'rgba(170,170,164,.82)'; for (const x of [172, 334]) for (const y of [60, 572]) g.fillRect(x, y, 7, 210);
  const road = new T.CanvasTexture(roadC); road.wrapS = road.wrapT = T.RepeatWrapping; road.anisotropy = 8;
  const nv = (NPT + 1) * 2;
  const ribbon = (w0, w1, y0, y1, uvScale, uw = 1) => {
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
    for (let i = 0; i <= NPT; i++) {
      const p = PTS[i % NPT], s = i === NPT ? TRACK.len : p.s;
      for (let k = 0; k < 2; k++) { const w = k ? w1 : w0, y = k ? y1 : y0, j = i * 2 + k; pos[j * 3] = p.x + p.nx * w; pos[j * 3 + 1] = p.y + y; pos[j * 3 + 2] = p.z + p.nz * w; uv[j * 2] = k * uw; uv[j * 2 + 1] = s / uvScale; }
      if (i < NPT) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  };
  const roadM = new T.Mesh(ribbon(-RW / 2, RW / 2, 0, 0, 42), new T.MeshStandardMaterial({map: road, normalMap: nrm, normalScale: new T.Vector2(.7, .7), roughness: .7, metalness: .05, envMapIntensity: .45}));
  roadM.receiveShadow = true; scene.add(roadM);
  // Betonwände links und rechts, Außenverkleidung der Hochstraße
  const conc = () => R.pbr(T, 'stone', 1, 1, {color: 0x9a9da6, roughness: .92, side: T.DoubleSide});
  const cm = conc(); cm.map.repeat.set(1, .12); cm.normalMap.repeat.set(1, .12);
  for (const s of [-1, 1]) {
    const inner = new T.Mesh(ribbon(s * WALL, s * (WALL + .1), 0, .85, 6), cm); inner.receiveShadow = true; scene.add(inner);
    scene.add(new T.Mesh(ribbon(s * (WALL + .1), s * (WALL + .5), .85, .85, 6), cm));
    scene.add(new T.Mesh(ribbon(s * (WALL + .5), s * (WALL + .5), .85, -1.5, 6), cm));
  }
  const kerb = R.paint(T, 16, 64, (c2) => { c2.fillStyle = '#b8b8b2'; c2.fillRect(0, 0, 16, 64); c2.fillStyle = '#a0323a'; c2.fillRect(0, 0, 16, 32); }); kerb.wrapS = kerb.wrapT = T.RepeatWrapping;
  for (const s of [-1, 1]) scene.add(new T.Mesh(ribbon(s * (RW / 2 - .1), s * WALL, .012, .03, 5), new T.MeshStandardMaterial({map: kerb, roughness: .8, side: T.DoubleSide})));
  // Pfeiler
  const D = new T.Object3D(), pilN = Math.ceil(NPT / 22), pil = new T.InstancedMesh(new T.CylinderGeometry(1.5, 1.8, 1, 10), R.pbr(T, 'stone', 2, 3, {color: 0x8a8d96}), pilN);
  for (let k = 0; k < pilN; k++) { const p = PTS[k * 22], h = p.y - 1.4 - GY + 1.5; D.position.set(p.x, GY - 1.5 + h / 2, p.z); D.scale.set(1, h, 1); D.rotation.set(0, 0, 0); D.updateMatrix(); pil.setMatrixAt(k, D.matrix); }
  pil.frustumCulled = false; scene.add(pil);
  // Leitpfosten mit Rückstrahlern (links rot, rechts weiß)
  const postN = Math.floor(NPT / 8), posts = new T.InstancedMesh(new T.BoxGeometry(.12, .5, .1), new T.MeshStandardMaterial({color: 0xe6e6e0, roughness: .7}), postN * 2);
  const refl = [0xff3030, 0xf4f6ff].map(c => new T.InstancedMesh(new T.BoxGeometry(.1, .14, .04), new T.MeshBasicMaterial({color: c}), postN));
  for (let k = 0; k < postN; k++) for (const s of [-1, 1]) {
    const p = PTS[k * 8], a = Math.atan2(p.tx, p.tz); D.scale.set(1, 1, 1); D.rotation.set(0, a, 0);
    D.position.set(p.x + p.nx * s * (WALL + .3), p.y + 1.1, p.z + p.nz * s * (WALL + .3)); D.updateMatrix(); posts.setMatrixAt(k * 2 + (s > 0 ? 1 : 0), D.matrix);
    D.position.set(p.x + p.nx * s * (WALL + .3) - p.tx * .07, p.y + 1.22, p.z + p.nz * s * (WALL + .3) - p.tz * .07); D.updateMatrix(); refl[s > 0 ? 0 : 1].setMatrixAt(k, D.matrix);
  }
  posts.frustumCulled = false; scene.add(posts); refl.forEach(m => { m.frustumCulled = false; scene.add(m); });
  // Kurvenschilder an der Außenseite enger Kurven
  const chevT = R.paint(T, 128, 64, (c2) => { c2.fillStyle = '#16161a'; c2.fillRect(0, 0, 128, 64); c2.fillStyle = '#f2c230'; R.rrect(c2, 3, 3, 122, 58, 5); c2.fill(); c2.strokeStyle = '#16161a'; c2.lineWidth = 12; c2.lineJoin = 'miter'; for (const x of [34, 70, 106]) { c2.beginPath(); c2.moveTo(x, 8); c2.lineTo(x - 22, 32); c2.lineTo(x, 56); c2.stroke(); } });
  const chevPts = []; for (let i = 0; i < NPT; i += 7) { const p = PTS[i]; if (Math.abs(p.k) > 1 / 95 && !inTunnel(p.u)) chevPts.push(p); }
  const chev = new T.InstancedMesh(new T.PlaneGeometry(2.6, 1.3), new T.MeshStandardMaterial({map: chevT, emissiveMap: chevT, emissive: 0xffffff, emissiveIntensity: .12, roughness: .5, side: T.DoubleSide}), Math.max(1, chevPts.length));
  chevPts.forEach((p, i) => { const s = p.k > 0 ? -1 : 1, a = Math.atan2(-p.tx, -p.tz); D.position.set(p.x + p.nx * s * (WALL + .32), p.y + 2.1, p.z + p.nz * s * (WALL + .32)); D.rotation.set(0, a, 0); D.scale.set(p.k > 0 ? 1 : -1, 1, 1); D.updateMatrix(); chev.setMatrixAt(i, D.matrix); });
  chev.count = chevPts.length; chev.frustumCulled = false; scene.add(chev);
  // Laternen
  const lampP = []; for (let i = 8, k = 0; i < NPT; i += 30, k++) { const p = PTS[i]; if (!inTunnel(p.u)) lampP.push({p, s: k % 2 ? 1 : -1}); }
  const poleM = new T.MeshStandardMaterial({color: 0x3a3d48, metalness: .7, roughness: .45});
  const poles = new T.InstancedMesh(new T.CylinderGeometry(.11, .17, 9, 8), poleM, lampP.length), arms = new T.InstancedMesh(new T.BoxGeometry(.12, .12, 3.4), poleM, lampP.length);
  const heads = new T.InstancedMesh(new T.BoxGeometry(.5, .14, 1.0), new T.MeshStandardMaterial({color: 0x2a2c34, emissive: 0xffc890, emissiveIntensity: .5, roughness: .5}), lampP.length);
  const pools = new T.InstancedMesh(new T.CircleGeometry(8.5, 28), new T.MeshBasicMaterial({map: R.softTex(T), color: 0xffb46a, transparent: true, opacity: .08, blending: T.AdditiveBlending, depthWrite: false}), lampP.length);
  const lamps = [], gp = new Float32Array(lampP.length * 3);
  lampP.forEach(({p, s}, i) => {
    const bx = p.x + p.nx * s * (WALL + .8), bz = p.z + p.nz * s * (WALL + .8), hx = p.x + p.nx * s * (WALL - 2.4), hz = p.z + p.nz * s * (WALL - 2.4), a = Math.atan2(p.nx, p.nz);
    D.scale.set(1, 1, 1); D.rotation.set(0, 0, 0); D.position.set(bx, p.y + 4.5, bz); D.updateMatrix(); poles.setMatrixAt(i, D.matrix);
    D.rotation.set(0, a, 0); D.position.set((bx + hx) / 2, p.y + 8.95, (bz + hz) / 2); D.updateMatrix(); arms.setMatrixAt(i, D.matrix);
    D.position.set(hx, p.y + 8.85, hz); D.updateMatrix(); heads.setMatrixAt(i, D.matrix);
    D.rotation.set(-Math.PI / 2, 0, 0); D.position.set(hx, p.y + .05, hz); D.updateMatrix(); pools.setMatrixAt(i, D.matrix);
    gp[i * 3] = hx; gp[i * 3 + 1] = p.y + 8.7; gp[i * 3 + 2] = hz; lamps.push({x: hx, y: p.y + 8.4, z: hz, c: 0xffb878});
  });
  for (const m of [poles, arms, heads, pools]) { m.frustumCulled = false; scene.add(m); } poles.castShadow = true;
  const glowG = new T.BufferGeometry(); glowG.setAttribute('position', new T.BufferAttribute(gp, 3));
  const glows = new T.Points(glowG, new T.PointsMaterial({color: 0xffc48a, size: 2.6, map: R.softTex(T), transparent: true, opacity: .32, depthWrite: false, blending: T.AdditiveBlending})); glows.frustumCulled = false; scene.add(glows);
  const lampL = [0, 1].map(() => { const l = new T.PointLight(0xffb878, .75, 30, 1.6); scene.add(l); return l; });

  /* --- Tunnel durch den Hügel --- */
  const i0 = Math.floor(TUNNEL[0] * NPT), i1 = Math.floor(TUNNEL[1] * NPT), SEG = 12, TH = 7.2, tpos = [], tuv = [], tidx = [];
  for (let i = i0; i <= i1; i++) { const p = PTS[i]; for (let k = 0; k <= SEG; k++) { const a = Math.PI * k / SEG, lx = Math.cos(a) * (WALL + .55), ly = Math.sin(a) * TH; tpos.push(p.x + p.nx * lx, p.y + ly - .05, p.z + p.nz * lx); tuv.push(k / SEG * 3, p.s / 8); } }
  for (let i = 0; i < i1 - i0; i++) for (let k = 0; k < SEG; k++) { const a = i * (SEG + 1) + k, b = a + SEG + 1; tidx.push(a, b, a + 1, a + 1, b, b + 1); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(tpos, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(tuv, 2)); tg.setIndex(tidx); tg.computeVertexNormals();
  const tubeM = R.pbr(T, 'stone', 1, 1, {color: 0x8e8a84, roughness: .9, side: T.DoubleSide}); scene.add(new T.Mesh(tg, tubeM));
  const tlN = Math.floor((i1 - i0) / 5), tlamp = new T.InstancedMesh(new T.BoxGeometry(.5, .08, 1.6), new T.MeshBasicMaterial({color: 0xb88a54}), tlN * 2);
  for (let k = 0; k < tlN; k++) for (const s of [-1, 1]) { const p = PTS[i0 + 2 + k * 5], a = Math.atan2(p.tx, p.tz), lx = s * 4.2; D.scale.set(1, 1, 1); D.rotation.set(0, a, 0); D.position.set(p.x + p.nx * lx, p.y + TH * .93, p.z + p.nz * lx); D.updateMatrix(); tlamp.setMatrixAt(k * 2 + (s > 0 ? 1 : 0), D.matrix); if (s > 0 && k % 2 === 0) lamps.push({x: p.x, y: p.y + 5.5, z: p.z, c: 0xffa860}); }
  tlamp.frustumCulled = false; scene.add(tlamp);
  // Einhausung: Betonkasten mit Park auf dem Deckel, Portale an beiden Enden
  const BOXW = WALL + 1.6, BOXH = TH + .9;
  const strip = (prof, vs) => { const pos = [], uv = [], idx = [], m = prof.length; for (let i = i0; i <= i1; i++) { const p = PTS[i]; prof.forEach(([lx, ly], k) => { pos.push(p.x + p.nx * lx, p.y + ly, p.z + p.nz * lx); uv.push(k / (m - 1) * vs[0], p.s / vs[1]); }); }
    for (let i = 0; i < i1 - i0; i++) for (let k = 0; k < m - 1; k++) { const a = i * m + k, b = a + m; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals(); return sg; };
  const boxM = R.pbr(T, 'stone', 1, 1, {color: 0x9a9da6, roughness: .92, side: T.DoubleSide});
  for (const s of [-1, 1]) scene.add(new T.Mesh(strip([[s * BOXW, -1.5], [s * BOXW, BOXH]], [1, 8]), boxM));
  scene.add(new T.Mesh(strip([[-BOXW, BOXH], [BOXW, BOXH]], [4, 8]), R.pbr(T, 'ground', 1, 1, {color: 0x8a9a78, side: T.DoubleSide})));
  const psh = new T.Shape(); psh.moveTo(-BOXW, -1.5); psh.lineTo(BOXW, -1.5); psh.lineTo(BOXW, BOXH); psh.lineTo(-BOXW, BOXH); psh.closePath();
  const hole = new T.Path(); hole.moveTo(WALL + .55, -.05); hole.absellipse(0, -.05, WALL + .55, TH, 0, Math.PI, false); hole.lineTo(-(WALL + .55), -1.5); hole.lineTo(WALL + .55, -1.5); hole.closePath(); psh.holes.push(hole);
  const portalG = new T.ShapeGeometry(psh, 20), portalM = R.pbr(T, 'stone', .12, .12, {color: 0xb0aca4, side: T.DoubleSide});
  const lidTrees = [];
  for (const i of [i0, i1]) { const p = PTS[i], m = new T.Mesh(portalG, portalM); m.position.set(p.x, p.y, p.z); m.rotation.y = Math.atan2(p.tx, p.tz); scene.add(m); }
  for (let i = i0 + 3; i < i1 - 2; i += 5) { const p = PTS[i]; for (const s of [-1, 1]) { const l = s * (3 + r0() * 7); lidTrees.push({x: p.x + p.nx * l, y: p.y + BOXH - .2, z: p.z + p.nz * l, s: 1 + r0() * .7}); } }
  const onHill = () => null;

  /* --- Stadt: Häuser in den Blöcken des Straßenrasters --- */
  const facC = R.canvas(128, 256), fg = facC.getContext('2d'), winC = R.canvas(128, 256), wg = winC.getContext('2d');
  fg.fillStyle = '#23252e'; fg.fillRect(0, 0, 128, 256); wg.fillStyle = '#000'; wg.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 8; x++) {
    const px = 5 + x * 15.4, py = 5 + y * 10.4, on = r0() < .42;
    fg.fillStyle = on ? '#57503f' : '#14161d'; fg.fillRect(px, py, 9.5, 6.4);
    if (on) { wg.fillStyle = ['#ffd9a0', '#ffe6bc', '#cfe0ff', '#ffc890', '#f2e2c0'][(r0() * 5) | 0]; wg.globalAlpha = .45 + r0() * .55; wg.fillRect(px, py, 9.5, 6.4); wg.globalAlpha = 1; }
  }
  const facT = new T.CanvasTexture(facC), winT = new T.CanvasTexture(winC); facT.anisotropy = winT.anisotropy = 4;
  const bGeo = new T.BoxGeometry(1, 1, 1); bGeo.translate(0, .5, 0);
  const sideM = new T.MeshStandardMaterial({map: facT, emissiveMap: winT, emissive: 0xffffff, emissiveIntensity: .5, roughness: .85}), roofM = new T.MeshStandardMaterial({color: 0x191b22, roughness: .9});
  const blds = [], trees = [], col = new T.Color();
  for (let iz = 0; iz < LD / G - 1; iz++) for (let ix = 0; ix < LW / G; ix++) {
    const cx = LX0 + (ix + .5) * G, cz = LZ0 - (iz + .5) * G, n = nearestT(cx, cz), dC = Math.hypot(cx - 20, cz + 110);
    if (dC > 640 || onHill(cx, cz) != null) continue;
    const near = Math.abs(n.lat) < 150;
    const two = r0() < .35, park = r0() < (near ? .2 : .08);
    for (let q = 0; q < (two ? 2 : 1); q++) {
      const w = two ? 16 + r0() * 6 : 24 + r0() * 16, d = 22 + r0() * 18, ox = two ? (q ? 11 : -11) : (r0() - .5) * 6, oz = (r0() - .5) * 6, x = cx + ox, z = cz + oz;
      const nn = nearestT(x, z); if (Math.abs(nn.lat) < RW / 2 + 7 + Math.max(w, d) * .72) continue;
      if (park) { for (let k = 0; k < 5; k++) trees.push({x: x + (r0() - .5) * 30, y: GY, z: z + (r0() - .5) * 30, s: 1.5 + r0() * 1.1}); continue; }
      const h = (16 + r0() * 34 + (r0() < .22 ? 30 + r0() * 50 : 0)) * (dC > 420 ? 1.25 : 1);
      blds.push({x, z, w, d, h, ry: r0() < .2 ? (r0() - .5) * .3 : 0});
    }
  }
  const city = new T.InstancedMesh(bGeo, [sideM, sideM, roofM, roofM, sideM, sideM], blds.length);
  const blinkP = [];
  blds.forEach((b, i) => { D.position.set(b.x, GY, b.z); D.scale.set(b.w, b.h, b.d); D.rotation.set(0, b.ry, 0); D.updateMatrix(); city.setMatrixAt(i, D.matrix); const v = .6 + r0() * .5; col.setRGB(v, v * (.92 + r0() * .1), v * (.9 + r0() * .2)); city.setColorAt(i, col); if (b.h > 70) blinkP.push(b.x, GY + b.h + 1.5, b.z); });
  city.frustumCulled = false; if (city.instanceColor) city.instanceColor.needsUpdate = true; scene.add(city);
  const blinkG = new T.BufferGeometry(); blinkG.setAttribute('position', new T.Float32BufferAttribute(blinkP, 3));
  const blink = new T.Points(blinkG, new T.PointsMaterial({color: 0xc02838, size: 4, map: R.softTex(T), transparent: true, depthWrite: false, blending: T.AdditiveBlending})); blink.frustumCulled = false; scene.add(blink);
  upd.push(t => { blink.material.opacity = Math.sin(t * 2.6) > .2 ? .9 : .12; });
  // Bäume: entlang der Straße, in den Parks und auf dem Hügel
  for (let i = 0; i < NPT; i += 9) { const p = PTS[i]; for (const s of [-1, 1]) { if (r0() < .45) continue; const l = s * (RW / 2 + 9 + r0() * 16), x = p.x + p.nx * l, z = p.z + p.nz * l; if (z > LZ0 - 6 || onHill(x, z) != null || Math.abs(nearestT(x, z).lat) < RW / 2 + 7) continue; trees.push({x, y: GY, z, s: 1.6 + r0() * 1.3}); } }
  trees.push(...lidTrees);
  scene.add(R.forest(T, trees, {seed: 5, noShadow: true, tint: new T.Color(.8, .9, 1)}));
  // Autos unten auf den Straßen (wandernde Lichter)
  const TN = 90, tp = new Float32Array(TN * 3), tcol = new Float32Array(TN * 3), tdat = [];
  for (let i = 0; i < TN; i++) { const horiz = r0() < .5, line = Math.floor(r0() * (horiz ? 9 : 14)), dir = r0() < .5 ? 1 : -1; tdat.push({horiz, c: horiz ? LZ0 - (line + 1) * G + dir * 2 : LX0 + (8 + line) * G + dir * 2, ph: r0() * 900, sp: (9 + r0() * 8) * dir}); const red = dir < 0; tcol[i * 3] = 1; tcol[i * 3 + 1] = red ? .2 : .92; tcol[i * 3 + 2] = red ? .2 : .75; }
  const trG = new T.BufferGeometry(); trG.setAttribute('position', new T.BufferAttribute(tp, 3)); trG.setAttribute('color', new T.BufferAttribute(tcol, 3));
  const traffic = new T.Points(trG, new T.PointsMaterial({size: 2.4, vertexColors: true, map: R.softTex(T), transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending})); traffic.frustumCulled = false; scene.add(traffic);
  upd.push(t => { tdat.forEach((d, i) => { const u = ((d.ph + t * d.sp) % 900 + 900) % 900 - 430; if (d.horiz) trG.attributes.position.setXYZ(i, u, GY + .6, d.c); else trG.attributes.position.setXYZ(i, d.c, GY + .6, Math.min(LZ0 - 4, -u * .62 - 260)); }); trG.attributes.position.needsUpdate = true; });

  /* --- Hafen: Riesenrad, Leuchtturm, Boote --- */
  const pier = new T.Mesh(new T.BoxGeometry(70, 2, 60), R.pbr(T, 'wood', 10, 8, {color: 0x8a7a6a})); pier.position.set(170, GY - .4, 66); scene.add(pier);
  const wheel = new T.Group(), spokeM = new T.MeshStandardMaterial({color: 0x9aa0b0, metalness: .8, roughness: .4}), WR = 26;
  for (const zz of [-1.6, 1.6]) { const rim = new T.Mesh(new T.TorusGeometry(WR, .28, 6, 48), spokeM); rim.position.z = zz; wheel.add(rim); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, sp = new T.Mesh(new T.BoxGeometry(.22, WR, .22), spokeM); sp.position.set(Math.cos(a) * WR / 2, Math.sin(a) * WR / 2, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp); }
  const gond = [], gcol = [0xd86a80, 0x6a90d8, 0xe0b060, 0x70b890];
  for (let k = 0; k < 12; k++) { const gm = new T.Mesh(new T.BoxGeometry(2.6, 2.4, 2.6), new T.MeshStandardMaterial({color: gcol[k % 4], roughness: .6, emissive: 0xffd9a0, emissiveIntensity: .22})); wheel.add(gm); gond.push(gm); }
  const wl = new Float32Array(48 * 3); for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; wl[k * 3] = Math.cos(a) * WR; wl[k * 3 + 1] = Math.sin(a) * WR; wl[k * 3 + 2] = 1.9; }
  const wlg = new T.BufferGeometry(); wlg.setAttribute('position', new T.BufferAttribute(wl, 3));
  wheel.add(new T.Points(wlg, new T.PointsMaterial({color: 0xffc6a0, size: 1.8, map: R.softTex(T), transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending})));
  wheel.position.set(170, GY + WR + 5, 70); scene.add(wheel);
  for (const sx of [-1, 1]) for (const zz of [-3, 3]) { const leg = new T.Mesh(new T.CylinderGeometry(.35, .5, WR + 8, 6), spokeM); leg.position.set(170 + sx * 7, GY + (WR + 6) / 2, 70 + zz); leg.rotation.z = sx * .27; scene.add(leg); }
  upd.push(t => { wheel.rotation.z = t * .12; gond.forEach((gm, k) => { const a = k / 12 * TAU; gm.position.set(Math.cos(a) * WR, Math.sin(a) * WR - 1.6, 0); gm.rotation.z = -wheel.rotation.z; }); });
  const rock = R.rock(T, 16, 4, {flat: .4}); rock.position.set(-60, GY - 1.5, 250); scene.add(rock);
  const lhT = R.paint(T, 64, 128, (c2) => { for (let k = 0; k < 4; k++) { c2.fillStyle = k % 2 ? '#b8423e' : '#e8e4da'; c2.fillRect(0, k * 32, 64, 32); } });
  const lh = new T.Mesh(new T.CylinderGeometry(2.2, 3.4, 26, 14), new T.MeshStandardMaterial({map: lhT, roughness: .8})); lh.position.set(-60, GY + 15, 250); scene.add(lh);
  const lhTop = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 3, 12), new T.MeshBasicMaterial({color: 0xc8b488})); lhTop.position.set(-60, GY + 29.5, 250); scene.add(lhTop);
  const lhCap = new T.Mesh(new T.ConeGeometry(2.6, 2.6, 12), new T.MeshStandardMaterial({color: 0x3a2a2a, roughness: .7})); lhCap.position.set(-60, GY + 32.3, 250); scene.add(lhCap);
  const lhGlow = K.sprite(T, 0xffe2a8, 12, .28); lhGlow.position.copy(lhTop.position); scene.add(lhGlow);
  const beamM = new T.MeshBasicMaterial({color: 0xffe9c0, transparent: true, opacity: .06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false});
  const lbeam = new T.Group(); for (const s of [0, Math.PI]) { const b = new T.Mesh(new T.PlaneGeometry(150, 5), beamM); b.position.x = 76; const h = new T.Group(); h.rotation.y = s; h.add(b); lbeam.add(h); } lbeam.position.copy(lhTop.position); scene.add(lbeam);
  upd.push(t => { lbeam.rotation.y = t * .5; lhGlow.material.opacity = .18 + .14 * Math.max(0, Math.sin(t * .5 + .6)); });
  const hullM = new T.MeshStandardMaterial({color: 0xdad6cc, roughness: .6}), boats = [];
  for (const [x, z, s] of [[60, 80, 1], [120, 150, 1.3], [250, 120, 1.1], [-20, 120, .9], [-140, 90, 1.2], [330, 60, 1], [10, 210, 1.4], [-220, 160, 1]]) {
    const b = new T.Group(), hull = new T.Mesh(new T.CapsuleGeometry(1.4, 6, 4, 10), hullM); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, .9); hull.position.y = .3; b.add(hull);
    const mast = new T.Mesh(new T.CylinderGeometry(.08, .1, 11, 6), poleM); mast.position.y = 6; b.add(mast);
    const ml = K.sprite(T, 0xffe0a8, 1.8, .4); ml.position.y = 11.6; b.add(ml);
    const cab = new T.Mesh(new T.BoxGeometry(2.6, 1.2, 1.6), new T.MeshStandardMaterial({color: 0x8a6a4a, emissive: 0xffc078, emissiveIntensity: .35})); cab.position.set(-.6, 1.5, 0); b.add(cab);
    b.position.set(x, GY - .6, z); b.scale.setScalar(s); b.rotation.y = r0() * TAU; scene.add(b); boats.push(b);
  }
  upd.push(t => boats.forEach((b, i) => { b.position.y = GY - .6 + Math.sin(t * .9 + i * 2) * .14; b.rotation.z = Math.sin(t * .7 + i) * .04; }));

  /* --- Start und Ziel: Torbogen, Tribüne, Fahnen --- */
  const p0 = PTS[0], gate = new T.Group(), a0 = Math.atan2(p0.tx, p0.tz);
  const chk = R.paint(T, 256, 32, (c2) => { for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { c2.fillStyle = (x + y) % 2 ? '#16161a' : '#b4b4ae'; c2.fillRect(x * 8, y * 8, 8, 8); } });
  for (const s of [-1, 1]) { const post = new T.Mesh(new T.BoxGeometry(.9, 10, .9), poleM); post.position.set(s * (WALL + 1.2), 5, 0); post.castShadow = true; gate.add(post); }
  const truss = new T.Mesh(new T.BoxGeometry(RW + 4.4, 1.5, .7), new T.MeshStandardMaterial({map: chk, roughness: .7, emissiveMap: chk, emissive: 0xffffff, emissiveIntensity: .06})); truss.position.y = 9.4; gate.add(truss);
  const ztx = R.paint(T, 512, 64, (c2, w) => { c2.fillStyle = '#141018'; c2.fillRect(0, 0, w, 64); c2.font = '700 40px Karla, sans-serif'; c2.textAlign = 'center'; c2.fillStyle = '#e8b870'; c2.fillText(`${nm('a')} ♥ ${nm('d')}`, w / 2, 46); });
  const sign = new T.Mesh(new T.PlaneGeometry(RW * .66, 2.1), new T.MeshBasicMaterial({map: ztx, side: T.DoubleSide, color: 0x9a9a9a})); sign.position.y = 11.3; sign.rotation.y = Math.PI; gate.add(sign);
  gate.position.set(p0.x, p0.y, p0.z); gate.rotation.y = a0; scene.add(gate);
  const line = new T.Mesh(new T.PlaneGeometry(RW, 2.4), new T.MeshStandardMaterial({map: chk, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2})); line.rotation.x = -Math.PI / 2; line.rotation.z = -a0 + Math.PI / 2; line.position.set(p0.x, p0.y + .03, p0.z); line.receiveShadow = true; scene.add(line);
  const ps = PTS[NPT - 8], stand = new T.Group(), stM = R.pbr(T, 'stone', 6, 1, {color: 0x80848e});
  for (let k = 0; k < 5; k++) { const st = new T.Mesh(new T.BoxGeometry(46, 1.1, 2.4), stM); st.position.set(0, .55 + k * 1.1, -k * 2.4); stand.add(st); }
  const base = new T.Mesh(new T.BoxGeometry(46, 12, 13), stM); base.position.set(0, -6, -4.8); stand.add(base);
  const roof = new T.Mesh(new T.BoxGeometry(48, .3, 14), new T.MeshStandardMaterial({color: 0x2a2e3a, metalness: .5, roughness: .5})); roof.position.set(0, 10.5, -5); roof.rotation.x = .08; stand.add(roof);
  for (const sx of [-23, 0, 23]) { const cl = new T.Mesh(new T.CylinderGeometry(.2, .2, 5.4, 6), poleM); cl.position.set(sx, 7.8, -10.6); stand.add(cl); }
  const CN = 260, cp = new Float32Array(CN * 3), cc = new Float32Array(CN * 3), cdat = [];
  for (let i = 0; i < CN; i++) { const k = (r0() * 5) | 0, x = (r0() - .5) * 44; cdat.push({x, y: 1.9 + k * 1.1, z: -k * 2.4 - .2, p: r0() * 6}); col.setHSL(r0(), .5, .5 + r0() * .2); cc[i * 3] = col.r * .8; cc[i * 3 + 1] = col.g * .8; cc[i * 3 + 2] = col.b * .8; }
  const cgm = new T.BufferGeometry(); cgm.setAttribute('position', new T.BufferAttribute(cp, 3)); cgm.setAttribute('color', new T.BufferAttribute(cc, 3));
  const crowd = new T.Points(cgm, new T.PointsMaterial({size: 1.05, vertexColors: true, map: R.softTex(T), transparent: true, alphaTest: .25})); crowd.frustumCulled = false; stand.add(crowd);
  upd.push(t => { cdat.forEach((d, i) => cp.set([d.x, d.y + Math.max(0, Math.sin(t * 5 + d.p)) * .22, d.z], i * 3)); cgm.attributes.position.needsUpdate = true; });
  stand.position.set(ps.x + ps.nx * (WALL + 3.2), ps.y - .2, ps.z + ps.nz * (WALL + 3.2)); stand.rotation.y = Math.atan2(-ps.tz, ps.tx); scene.add(stand);
  const flags = [];
  for (let k = 0; k < 8; k++) {
    const p = PTS[(NPT - 60 + k * 14) % NPT], s = k % 2 ? 1 : -1, fgp = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(.06, .06, 6.5, 6), poleM); pole.position.y = 3.25; fgp.add(pole);
    const fl = new T.Mesh(new T.PlaneGeometry(2.4, 1.3, 6, 1), new T.MeshStandardMaterial({color: k % 2 ? 0xc87a90 : 0x5f86c8, side: T.DoubleSide, roughness: .8})); fl.position.set(1.25, 5.7, 0); fgp.add(fl);
    fgp.position.set(p.x + p.nx * s * (WALL + .9), p.y + .85, p.z + p.nz * s * (WALL + .9)); fgp.rotation.y = a0; scene.add(fgp); flags.push(fl);
  }
  upd.push(t => flags.forEach((fl, i) => { const a = fl.geometry.attributes.position; for (let q = 0; q < a.count; q++) a.setZ(q, Math.sin(a.getX(q) * 2.4 - t * 6 + i) * .16 * (a.getX(q) + 1.2)); a.needsUpdate = true; }));
  // große Tafel an der ersten Kurve
  const pbd = PTS[Math.floor(.2 * NPT)], bdT = R.paint(T, 512, 256, (c2) => { const gr = c2.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a2038'); gr.addColorStop(1, '#141020'); c2.fillStyle = gr; c2.fillRect(0, 0, 512, 256); c2.textAlign = 'center'; c2.fillStyle = '#e8b870'; c2.font = '700 64px Karla, sans-serif'; c2.fillText(`${nm('a')} ♥ ${nm('d')}`, 256, 118); c2.fillStyle = '#c8c2d8'; c2.font = '600 34px Karla, sans-serif'; c2.fillText('Nachtrennen', 256, 182); c2.strokeStyle = '#e8b870'; c2.lineWidth = 5; c2.strokeRect(12, 12, 488, 232); });
  const bd = new T.Group(), bdm = new T.Mesh(new T.PlaneGeometry(22, 11), new T.MeshBasicMaterial({map: bdT, color: 0x8c8c8c})); bdm.position.y = 15; bd.add(bdm);
  for (const sx of [-8, 8]) { const lg = new T.Mesh(new T.CylinderGeometry(.35, .4, 26, 8), poleM); lg.position.set(sx, 0, -.4); bd.add(lg); }
  bd.position.set(pbd.x - pbd.nx * (WALL + 16), pbd.y, pbd.z - pbd.nz * (WALL + 16)); bd.rotation.y = Math.atan2(-pbd.tx, -pbd.tz); scene.add(bd);

  /* --- Turbo-Felder und Herzen --- */
  const arrow = R.paint(T, 64, 128, (c2) => { c2.strokeStyle = '#ffc060'; c2.lineWidth = 11; c2.lineCap = 'round'; for (let k = 0; k < 3; k++) { c2.beginPath(); c2.moveTo(10, 44 + k * 32); c2.lineTo(32, 20 + k * 32); c2.lineTo(54, 44 + k * 32); c2.stroke(); } });
  arrow.wrapT = T.RepeatWrapping; const padM = new T.MeshBasicMaterial({map: arrow, transparent: true, opacity: .45, blending: T.AdditiveBlending, depthWrite: false}), pads = [];
  for (const pd of PADS) { const p = PTS[pd.i], m = new T.Mesh(new T.PlaneGeometry(4.2, 8), padM); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(p.tx, p.tz) + Math.PI; m.position.set(p.x + p.nx * pd.lat, p.y + .06, p.z + p.nz * pd.lat); scene.add(m); pads.push(m); }
  const hgeo = K.heartGeo(T, .85, .3), hearts = [], hm = new T.MeshStandardMaterial({color: 0xe86a90, emissive: 0xd03a6a, emissiveIntensity: .4, metalness: .3, roughness: .3});
  HEARTS.forEach(h => { const p = PTS[h.i], m = new T.Mesh(hgeo, hm); m.position.set(p.x + p.nx * h.lat, p.y + 1.5, p.z + p.nz * h.lat); scene.add(m); hearts.push(m); });

  /* --- Autos, Scheinwerfer, Funken und Reifenqualm --- */
  const cars = {a: makeCar(T, 'suv'), d: makeCar(T, 'sport')}; scene.add(cars.a); scene.add(cars.d);
  const mineCar = cars[API.me], spot = new T.SpotLight(0xfff0d0, 1.35, 90, .5, .75, 1.3);
  spot.position.set(0, 1.2, -1.6); spot.target.position.set(0, -.4, -30); mineCar.add(spot); mineCar.add(spot.target); mineCar.userData.beam.visible = false;
  const mkPts = (n, size, add) => { const pos = new Float32Array(n * 3), c2 = new Float32Array(n * 3), bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(pos, 3)); bg.setAttribute('color', new T.BufferAttribute(c2, 3)); const m = new T.Points(bg, new T.PointsMaterial({size, vertexColors: true, map: R.softTex(T), transparent: true, blending: add ? T.AdditiveBlending : T.NormalBlending, depthWrite: false, opacity: add ? 1 : .5})); m.frustumCulled = false; scene.add(m); return {m, d: Array.from({length: n}, () => ({life: 0})), i: 0}; };
  return {scene, cam, sky, moon, cars, spot, pads, hearts, lamps, lampL, upd, sparks: mkPts(110, .4, true), smoke: mkPts(90, 2.6, true), camPos: null, camH: null, tubeM};
}
function puff(Q, x, y, z, c, vx, vy, vz, life) { const p = Q.d[Q.i]; Q.i = (Q.i + 1) % Q.d.length; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.l0 = life; p.c = c; }
function stepPts(Q, dt, grav, bright) {
  const pa = Q.m.geometry.attributes.position, ca = Q.m.geometry.attributes.color;
  Q.d.forEach((p, i) => {
    if (p.life > 0) { p.life -= dt; p.vy -= grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    const a = p.life > 0 ? p.life / p.l0 * bright : 0, c = p.c || [1, 1, 1];
    pa.setXYZ(i, p.x || 0, p.life > 0 ? p.y : -999, p.z || 0); ca.setXYZ(i, c[0] * a, c[1] * a, c[2] * a);
  });
  pa.needsUpdate = true; ca.needsUpdate = true;
}

/* ---------- Level ---------- */
const rennen = {
  id: 'rennen', n: 'Nachtrennen', ic: '⚑', t3: 78, t2: 105, ctrl: 'pad', padIcon: 'wheel', three: true, noClamp: true, hidePlayers: true, eAngle: [0],
  skinName: () => `${nm('a')}: SUV · ${nm('d')}: Sportwagen`,
  ctrlText: () => 'Gas gibt das Auto selbst. Linker Daumen: auflegen und seitlich ziehen zum Lenken. Rechts: DRIFT halten für enge Kurven, darüber die Bremse.',
  h: () => `${nm('a')} im rosé SUV gegen ${nm('d')} im blauen Sportwagen – zwei Runden über die Hochstraße am Hafen. Halte in der Kurve DRIFT: Das Heck bricht aus, und beim Loslassen gibt es einen Turbo. Goldene Pfeile und der Windschatten machen schneller, Herzen bringen Punkte. Wer zurückliegt, holt etwas leichter auf.`,
  start: k => startPos(k),
  countText: () => `Runde ${Math.min(LAPS, ((LOC.car && LOC.car.lap) || 0) + 1)}/${LAPS} · ♥${(S.aux.score || {})[API.me] || 0}`,
  posExtra: () => { const c = LOC.car; return c ? [Math.round(c.h * 1000) / 1000, Math.round(c.prog * 1000) / 1000, Math.round(c.v * 10) / 10, Math.round(c.y * 100) / 100, 'f' + flagsOf(c), Math.round(c.st * 50) / 50] : null; },
  note: () => {
    const f = S.aux.fin || {}, sc = S.aux.score || {a: 0, d: 0};
    if (f.a == null || f.d == null) return '';
    const w = f.a <= f.d ? 'a' : 'd';
    return `${nm(w)} gewinnt mit ${Math.abs(f.a - f.d).toFixed(1)} s Vorsprung · Herzen: ${nm('a')} ${sc.a}, ${nm('d')} ${sc.d}`;
  },
  setup() { S.aux = {fin: {}, hg: '0'.repeat(HEARTS.length), score: {a: 0, d: 0}}; S.total = LAPS * 2; },
  onTeleport() { LOC.car = null; },
  move(dt, inp) {
    if (!LOC.car) {
      const n = nearestT(mine.x, mine.y), p = PTS[n.i];
      LOC.car = {h: Math.atan2(p.tx, p.tz), v: 0, vx: 0, vz: 0, st: 0, y: n.y, vy: 0, air: false, lap: 0, mid: false, started: false, lastP: n.s / TRACK.len, idx: n.i,
        boost: 0, drift: 0, dsign: 0, slip: 0, done: false, prog: 0, bump: 0, sent: {}, wrong: 0, slow: 0, braking: false, scr: 0, wside: 0, T: 0};
    }
    const c = LOC.car, I = readPad(inp);
    let n = nearestT(mine.x, mine.y, c.idx), p = PTS[n.i]; c.idx = n.i; c.T += dt;
    // Lenkung: weich einlenken, schnell zurückstellen
    const ts = c.done ? 0 : clamp(I.steer || 0, -1, 1);
    c.st += (ts - c.st) * Math.min(1, dt * (Math.abs(ts) > Math.abs(c.st) ? 8.5 : 13));
    let fx = Math.sin(c.h), fz = Math.cos(c.h), vf = c.vx * fx + c.vz * fz;
    // Drift: Knopf halten und einlenken – das Heck bricht aus, beim Loslassen zündet der Turbo
    if (I.drift && !c.drift && !c.air && !c.done && vf > 20 && Math.abs(c.st) > .22) { c.drift = .001; c.dsign = Math.sign(c.st); tone(240, .12, .03, 'sawtooth'); }
    if (c.drift && (!I.drift || vf < 13 || c.done || c.air)) {
      if (c.drift > DR1 && !c.done) { const big = c.drift > DR2; c.boost = Math.max(c.boost, big ? 1.5 : .8); tone(big ? 1046 : 784, .3, .06, 'sawtooth'); buzz(big ? 30 : 15); toast(big ? 'Super-Turbo!' : 'Mini-Turbo!'); }
      c.drift = 0;
    }
    if (c.drift) c.drift += dt;
    c.boost = Math.max(0, c.boost - dt);
    for (const pd of PADS) if (Math.abs(n.i - pd.i) < 5 && Math.abs(n.lat - pd.lat) < 2.8 && c.boost < .9 && !c.air) { c.boost = 1.3; tone(988, .25, .05, 'sawtooth'); buzz(15); }
    // Windschatten und Aufholhilfe
    const o = API.partner(), oE = o.e || [], rx = o.x - mine.x, rz = o.y - mine.y, ahead = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
    c.slip = (ahead > 4 && ahead < 28 && side < 4.2 && vf > 24) ? c.slip + dt : 0;
    const behind = clamp(((oE[1] || 0) - c.prog) * TRACK.len / 260, 0, 1);
    // Tempo
    let top = VMX * API.diff() * (c.boost > 0 ? 1.3 : 1) * (c.slip > .5 ? 1.07 : 1) * (1 + behind * .08) * (c.drift ? .95 : 1 - .13 * c.st * c.st);
    c.braking = !!I.brake && !c.done;
    if (c.done) vf += clamp(-vf, -30 * dt, 30 * dt);
    else if (I.brake) vf = Math.max(vf - 44 * dt, Math.min(vf, 9));
    else if (!c.air) { const acc = (c.boost > 0 ? 40 : 21) * (1 - .5 * clamp(vf / top, 0, 1)) + 1.5; vf += clamp(top - vf, -11 * dt, acc * dt); }
    // Drehen: bei hohem Tempo träger, im Drift deutlich wendiger
    const yawMax = 2.4 - .55 * clamp(vf / VMX, 0, 1), low = clamp(vf / 8, 0, 1);
    const w = c.drift ? (c.dsign * .5 + c.st * .85) * yawMax * 1.22 : c.st * yawMax;
    c.h -= w * low * (c.air ? .3 : 1) * (c.scr > 0 && w * c.wside < 0 ? .25 : 1) * dt;
    // Haftung: die Seitwärtsbewegung wird abgebaut – im Drift nur langsam
    const f2x = Math.sin(c.h), f2z = Math.cos(c.h), r2x = -f2z, r2z = f2x;
    let vl = (c.vx * r2x + c.vz * r2z);
    const vfo = c.vx * fx + c.vz * fz; vf += (c.vx * f2x + c.vz * f2z) - vfo;
    if (!c.air) vl *= Math.exp(-(c.drift ? 2.6 : 8) * dt);
    c.vx = f2x * vf + r2x * vl; c.vz = f2z * vf + r2z * vl; c.vl = vl;
    mine.x += c.vx * dt; mine.y += c.vz * dt;
    // Betonwand: am Rand entlangschleifen kostet wenig, frontal anstoßen viel
    n = nearestT(mine.x, mine.y, c.idx); p = PTS[n.i];
    if (Math.abs(n.lat) > LIM) {
      const sg = Math.sign(n.lat), over = Math.abs(n.lat) - LIM; mine.x -= p.nx * sg * over; mine.y -= p.nz * sg * over;
      const vn = (c.vx * p.nx + c.vz * p.nz) * sg;
      if (vn > 0) {
        const sp = Math.hypot(c.vx, c.vz) || 1, hit = clamp(vn / sp, 0, 1);
        c.vx -= p.nx * sg * vn * 1.15; c.vz -= p.nz * sg * vn * 1.15; const k = (1 - hit * .45) * (1 - .22 * dt); c.vx *= k; c.vz *= k;
        const fwd = (f2x * p.tx + f2z * p.tz) >= 0 ? 1 : -1, tan = Math.atan2(p.tx * fwd, p.tz * fwd);
        c.h = API.lerpA(c.h, tan, clamp(hit * 1.6, .08, .6));
        if (vn > 9) c.drift = 0;
        c.scr = .22; c.wside = sg;
        if (c.bump <= 0 && vn > 2.5) { c.bump = .3; tone(vn > 10 ? 90 : 120, .14, .05, 'square'); buzz(vn > 10 ? 35 : 15); LOC.shk = Math.max(LOC.shk || 0, clamp(vn / 28, .08, .4)); }
      }
    }
    c.bump -= dt; c.scr -= dt;
    // Zusammenstoß mit dem anderen Auto
    const dd = Math.hypot(rx, rz);
    if (dd < 3.3 && dd > .01 && Math.abs((oE[3] != null ? oE[3] : c.y) - c.y) < 2) { mine.x -= rx / dd * (3.3 - dd) * .6; mine.y -= rz / dd * (3.3 - dd) * .6; c.vx *= .985; c.vz *= .985; if (c.bump <= 0) { tone(140, .15, .05, 'square'); buzz(25); c.bump = .4; LOC.shk = .2; } }
    c.v = Math.hypot(c.vx, c.vz);
    // Höhe und Sprung über die Kuppe
    const gy = n.y;
    if (c.air) { c.vy -= 34 * dt; c.y += c.vy * dt; if (c.y <= gy) { if (c.vy < -9) { LOC.shk = .35; tone(85, .2, .07, 'square'); buzz(40); } c.y = gy; c.vy = 0; c.air = false; } }
    else { const proj = c.y + c.vy * dt; if (proj > gy + .25 && c.vy > 3.5) { c.air = true; c.y = proj; } else { c.vy = clamp((gy - c.y) / Math.max(dt, .001), -40, 40); c.y = gy; } }
    // Herzen
    for (let i = 0; i < HEARTS.length; i++) {
      if (S.aux.hg[i] !== '0' || c.sent[i]) continue;
      const h = HEARTS[i], hp = PTS[h.i], hx = hp.x + hp.nx * h.lat, hz = hp.z + hp.nz * h.lat;
      if (Math.hypot(hx - mine.x, hz - mine.y) < 2.7 && Math.abs(hp.y + 1.5 - (c.y + 1)) < 3) { c.sent[i] = 1; tone(1318, .2, .05); act({k: 'heart', i}); }
    }
    // Runden
    const pr = n.s / TRACK.len;
    if (c.lastP > .8 && pr < .2) {
      if (!c.started) c.started = true;
      else if (c.mid) { c.lap++; c.mid = false; if (c.lap < LAPS) { toast('Letzte Runde!'); tone(880, .3, .05, 'square'); } }
    }
    if (pr > .45 && pr < .6 && c.started) c.mid = true;
    if (!c.started && pr < .5) c.started = true;
    c.lastP = pr;
    if (c.lap >= LAPS && !c.done) { c.done = true; toast('Im Ziel! 🏁'); }
    c.prog = c.started ? Math.min(LAPS, c.lap + (c.lap >= LAPS ? 0 : pr)) : 0;
    // Falsch herum oder festgefahren: zurück auf die Strecke
    c.wrong = (f2x * p.tx + f2z * p.tz) < -.25 ? c.wrong + dt : 0;
    c.slow = (c.v < 5 && !c.done && !I.brake && c.T > 3) ? c.slow + dt : 0;
    if (c.wrong > 2 || c.slow > 2.2) {
      mine.x = p.x + p.nx * clamp(n.lat, -4, 4); mine.y = p.z + p.nz * clamp(n.lat, -4, 4); c.h = Math.atan2(p.tx, p.tz); c.vx = p.tx * 14; c.vz = p.tz * 14; c.st = 0; c.drift = 0; c.wrong = c.slow = 0; c.y = n.y; c.air = false;
      toast('Zurück auf die Strecke'); LOC.camSnap = true;
    }
  },
  action(k, d) {
    if (d.k !== 'heart') return;
    const A = S.aux, i = d.i | 0;
    if (A.hg[i] !== '0') return;
    A.hg = A.hg.slice(0, i) + k + A.hg.slice(i + 1); A.score[k]++;
    emit({k: 'ring', o: k});
  },
  update() {
    const A = S.aux; let cnt = 0;
    for (const k of ['a', 'd']) {
      const e = S.p[k].e, pg = e ? e[1] : 0;
      cnt += Math.min(LAPS, Math.floor(pg + 1e-6));
      if (pg >= LAPS - 1e-6 && A.fin[k] == null) { A.fin[k] = Math.round((S.t - S.lt) * 10) / 10; emit({k: 'lap', o: k}); emit({k: 'toast', txt: `${nm(k)} ist im Ziel! (${A.fin[k]} s)`}); }
    }
    S.count = cnt;
    if (A.fin.a != null && A.fin.d != null) finish(2.4);
  },
  render3d(t, part) {
    const T = window.THREE; if (!T || !API.renderer3D()) return;
    if (!LOC.r3) { LOC.r3 = buildScene(T); LOC.__dispose = () => API.disposeTree(LOC.r3.scene); }
    const R = LOC.r3, sc = API.screen(), K = KIT(), dt = Math.min(.05, R.lt ? t - R.lt : .016); R.lt = t;
    const meK = API.me, oK = API.other, c = LOC.car, play = S.phase === 'play';
    const n0 = nearestT(mine.x, mine.y, c ? c.idx : null);
    const myH = c ? c.h : Math.atan2(PTS[n0.i].tx, PTS[n0.i].tz), myY = c ? c.y : n0.y;
    const oE = part.e || [myH, 0, 0, myY, 'f0', 0], oF = +String(oE[4] || 'f0').slice(1) || 0, oY = oE[3] != null ? oE[3] : myY;
    const myF = c ? flagsOf(c) : 0;
    const placeCar = (car, x, z, h, y, v, fl, steer, pitch, slide) => {
      car.position.set(x, y, z); car.rotation.set(0, h + Math.PI, 0);
      const u = car.userData;
      u.body.rotation.z += (clamp(steer * .07 * Math.min(1, v / 26) + ((fl & 16) ? steer * .04 : 0), -.11, .11) - u.body.rotation.z) * Math.min(1, dt * 8);
      u.body.rotation.x = clamp(pitch + ((fl & 8) ? .035 : 0), -.25, .25);
      u.wheels.forEach(w => { w.spin.rotation.x -= v * dt / .45; if (w.front) w.w.rotation.y = -steer * .42; });
      const boost = fl & 4;
      u.flames.forEach((f, i) => { f.material.opacity = boost ? .34 + Math.sin(t * 40 + i) * .1 : 0; f.scale.setScalar(boost ? 1.7 + Math.random() * .8 : 1); });
      u.tl.color.setHex((fl & 8) ? 0xc81c30 : 0x5e0a18); u.tgl.forEach(s => { s.material.opacity = (fl & 8) ? .3 : .12; s.scale.setScalar((fl & 8) ? 1.1 : .8); });
      // Reifenqualm im Drift und beim Bremsen
      if (play && ((fl & 16) || ((fl & 8) && v > 14)) && Math.random() < dt * 40) for (const s of [-1, 1]) puff(R.smoke, x + Math.cos(h) * s * 1.05 - Math.sin(h) * 1.7, y + .25, z - Math.sin(h) * s * 1.05 - Math.cos(h) * 1.7, [.2, .2, .22], rnd(-1, 1) + slide * Math.cos(h) * -3, rnd(.6, 1.6), rnd(-1, 1) + slide * Math.sin(h) * 3, rnd(.5, .9));
      if (play && (fl & 3) && Math.random() < dt * 50) { const cc = (fl & 3) === 2 ? [1, .55, .2] : [.45, .7, 1]; for (const s of [-1, 1]) puff(R.sparks, x + Math.cos(h) * s * 1.05 - Math.sin(h) * 1.8, y + .2, z - Math.sin(h) * s * 1.05 - Math.cos(h) * 1.8, cc, -Math.sin(h) * 6 + rnd(-3, 3), rnd(2, 5), -Math.cos(h) * 6 + rnd(-3, 3), rnd(.2, .45)); }
    };
    placeCar(R.cars[meK], mine.x, mine.y, myH, myY, c ? c.v : 0, myF, c ? c.st : 0, c ? -Math.atan2(c.vy, Math.max(c.v, 1)) * .6 : 0, c ? Math.sign(c.vl || 0) : 0);
    placeCar(R.cars[oK], part.x, part.y, oE[0], oY, oE[2] || 0, oF, oE[5] || 0, 0, 0);
    if (c && c.scr > 0 && play) { const pn = PTS[n0.i], sg = Math.sign(n0.lat); for (let i = 0; i < 2; i++) puff(R.sparks, mine.x + pn.nx * sg * 1.2, myY + .5, mine.y + pn.nz * sg * 1.2, [1, .8, .45], -c.vx * .15 + rnd(-4, 4), rnd(1, 5), -c.vz * .15 + rnd(-4, 4), rnd(.2, .45)); }
    stepPts(R.sparks, dt, 16, 1.2); stepPts(R.smoke, dt, -1.2, .32);
    // Welt
    R.sky.userData.u.tm.value = t; R.upd.forEach(f => f(t, dt));
    R.pads.forEach(m => { m.material.map.offset.y = (t * 1.5) % 1; });
    const hg = S.aux.hg || '';
    R.hearts.forEach((m, i) => { m.visible = hg[i] === '0' && !(c && c.sent[i]); m.rotation.y = t * 2.2 + i; });
    R.lamps.forEach(l => { l.d = (l.x - mine.x) ** 2 + (l.z - mine.y) ** 2 + (l.y - myY - 8) ** 2 * 4; });
    const near = R.lamps.slice().sort((a, b) => a.d - b.d);
    R.lampL.forEach((L, i) => { const l = near[i]; if (l) { L.position.set(l.x, l.y, l.z); L.color.setHex(l.c); } });
    R.cars.a.userData.beam.visible = meK !== 'a'; R.cars.d.userData.beam.visible = meK !== 'd';
    REAL().sunAt(R.moon, mine.x, myY, mine.y);
    // Kamera: folgt der Fahrtrichtung, nicht der Wagennase – im Drift sieht man das Auto quer stehen
    const vdir = c && c.v > 6 ? Math.atan2(c.vx, c.vz) : myH;
    if (R.camH == null || LOC.camSnap) R.camH = myH;
    R.camH = API.lerpA(R.camH, API.lerpA(vdir, myH, .45), Math.min(1, dt * 5.5));
    const f = new T.Vector3(Math.sin(R.camH), 0, Math.cos(R.camH)), base = new T.Vector3(mine.x, myY, mine.y);
    const sp = c ? c.v : 0, boostOn = c && c.boost > 0, port = sc.cw < sc.ch;
    const want = base.clone().addScaledVector(f, -(port ? 11.6 : 9.6) - sp * .03).add(new T.Vector3(0, (port ? 4.7 : 3.7) + sp * .012, 0));
    if (!R.camPos || LOC.camSnap) R.camPos = want.clone(); LOC.camSnap = false;
    R.camPos.x += (want.x - R.camPos.x) * Math.min(1, dt * 9); R.camPos.z += (want.z - R.camPos.z) * Math.min(1, dt * 9); R.camPos.y += (want.y - R.camPos.y) * Math.min(1, dt * 5);
    LOC.shk = Math.max(0, (LOC.shk || 0) - dt);
    const sh = LOC.shk * .7;
    R.cam.position.copy(R.camPos).add(new T.Vector3(rnd(-sh, sh), rnd(-sh, sh), rnd(-sh, sh)));
    R.cam.lookAt(base.clone().addScaledVector(f, 15).add(new T.Vector3(0, 1.3, 0)));
    R.cam.rotation.z += -(c ? c.st : 0) * .025;
    const fovT = (port ? 76 : 62) + sp * .1 + (boostOn ? 7 : 0);
    R.cam.fov += (fovT - R.cam.fov) * Math.min(1, dt * 4); R.cam.aspect = sc.cw / sc.ch; R.cam.updateProjectionMatrix();
    API.render3D(R.scene, R.cam, {bloom: .7, th: .74});

    /* --- Anzeigen --- */
    const pp = K.proj(R.cam, new T.Vector3(part.x, oY + 3.6, part.y));
    if (pp.ok) K.nameTag(nm(oK), pp.x, pp.y, COL[oK]);
    if (sp > 44 || boostOn) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = boostOn ? 'rgba(255,210,150,.16)' : 'rgba(255,255,255,.07)'; ctx.lineWidth = 2;
      for (let i = 0; i < 20; i++) { const a = rnd(0, TAU), r0 = rnd(.36, .52) * sc.ch, r1 = r0 + rnd(50, 130); ctx.beginPath(); ctx.moveTo(sc.cw / 2 + Math.cos(a) * r0, sc.ch * .5 + Math.sin(a) * r0); ctx.lineTo(sc.cw / 2 + Math.cos(a) * r1, sc.ch * .5 + Math.sin(a) * r1); ctx.stroke(); }
      ctx.restore();
    }
    // Karte
    const mx = sc.cw - 116, my = 78, ms = .2;
    ctx.fillStyle = 'rgba(10,8,24,.55)'; rr(mx - 8, my - 8, 112, 92, 14); ctx.fill();
    const toM = (x, z) => [mx + 50 + (x - 25) * ms, my + 40 + (z + 115) * ms];
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
    PTS.forEach((q, i) => { if (i % 8) return; const [a, b] = toM(q.x, q.z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); ctx.stroke();
    { const [a, b] = toM(PTS[0].x, PTS[0].z); ctx.fillStyle = '#fff'; ctx.fillRect(a - 1.5, b - 6, 3, 12); }
    for (const [x, z, k] of [[part.x, part.y, oK], [mine.x, mine.y, meK]]) { const [a, b] = toM(x, z); ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(a, b, 4.5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke(); }
    if (!c || !['play', 'count'].includes(S.phase)) return;
    const first = c.prog >= (oE[1] || 0) || c.done;
    ctx.textAlign = 'left'; ctx.font = '700 28px Karla, system-ui'; ctx.fillStyle = first ? '#f3c98f' : '#d8d0ea';
    ctx.fillText(first ? '1.' : '2.', 16, 100); ctx.font = '600 13px Karla, system-ui'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('Platz', 48, 100);
    // Tacho (oben links, damit unten Platz für die Daumen bleibt)
    const kmh = Math.round(c.v * 3.6 * 1.25), tx0 = 16, ty0 = 128;
    ctx.fillStyle = 'rgba(10,8,24,.5)'; rr(tx0 - 4, ty0 - 18, 104, 44, 12); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 24px Karla, system-ui'; ctx.fillText(String(kmh), tx0 + 6, ty0 + 6);
    ctx.font = '600 11px Karla, system-ui'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('km/h', tx0 + 58, ty0 + 6);
    const frac = clamp(c.v / (VMX * 1.3), 0, 1); ctx.fillStyle = 'rgba(255,255,255,.15)'; rr(tx0 + 4, ty0 + 13, 88, 5, 2.5); ctx.fill();
    ctx.fillStyle = boostOn ? '#ffd27a' : rgba(COL[meK], 1); rr(tx0 + 4, ty0 + 13, Math.max(5, 88 * frac), 5, 2.5); ctx.fill();
    const msgs = [];
    if (c.drift > DR1) msgs.push([c.drift > DR2 ? 'Super-Turbo bereit – loslassen!' : 'Mini-Turbo bereit', c.drift > DR2 ? '#ffb070' : '#8fc8ff']);
    else if (boostOn) msgs.push(['TURBO', '#ffd27a']);
    if (c.slip > .5) msgs.push(['Windschatten!', '#bfe8ff']);
    if (c.wrong > .8) msgs.push(['Falsche Richtung!', '#ff8a8a']);
    msgs.forEach(([txt, col], i) => { ctx.font = '700 17px Karla, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,6,20,.7)'; ctx.strokeText(txt, sc.cw / 2, sc.ch * .3 - i * 24); ctx.fillStyle = col; ctx.fillText(txt, sc.cw / 2, sc.ch * .3 - i * 24); });
    // Bedienfelder
    const U = LOC.padUI || {Z: zones(sc.cw, sc.ch)}, Z = U.Z, st = U.st, hint = play && c.T < 9;
    const bx = st ? st.sx : sc.cw * .25, by = st ? st.sy : sc.ch - 118, kx = st ? clamp(st.x - st.sx, -60, 60) : c.st * 60;
    ctx.lineCap = 'round'; ctx.strokeStyle = st ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx - 60, by); ctx.lineTo(bx + 60, by); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(bx - 1, by - 9, 2, 18);
    ctx.fillStyle = st ? rgba(COL[meK], .75) : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(bx + kx, by, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(bx + kx - 13, by); ctx.lineTo(bx + kx - 6, by - 6); ctx.lineTo(bx + kx - 6, by + 6); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx + kx + 13, by); ctx.lineTo(bx + kx + 6, by - 6); ctx.lineTo(bx + kx + 6, by + 6); ctx.fill();
    const btn = (z, on, txt, colOn, fill) => {
      ctx.fillStyle = on ? colOn : 'rgba(255,255,255,.09)'; ctx.strokeStyle = on ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.32)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); ctx.stroke();
      if (fill > 0) { ctx.strokeStyle = fill >= 1 ? '#ffb070' : '#8fc8ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(z.x, z.y, z.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, fill)); ctx.stroke(); }
      ctx.font = `700 ${z.r > 40 ? 15 : 12}px Karla, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(txt, z.x, z.y); ctx.textBaseline = 'alphabetic';
    };
    btn(Z.drift, !!c.drift, 'DRIFT', 'rgba(143,200,255,.35)', c.drift ? c.drift / DR2 : 0);
    btn(Z.brake, c.braking, 'Bremse', 'rgba(255,90,100,.4)', 0);
    if (hint && !st) { ctx.font = '600 12px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('lenken: Daumen auflegen und ziehen', Math.max(118, bx), by + 44); }
  }
};
return [rennen];
});
