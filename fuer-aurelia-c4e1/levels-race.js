/* Zwei Lichter – Nachtrennen v2 (3D)
   Aurelias SUV gegen Daniels Sportwagen: breite Hochstraße durch die Lichterstadt, Sprungkuppe,
   Neon-Tunnel, Drift-Turbo, Windschatten, Turbo-Felder und Herzen zum Einsammeln. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CA, CD, CG, rgba, rnd, clamp, nm, emit, finish, act, hostNow, tone, buzz, rr, mine} = API;
const toast = t => API.toast(t);
const KIT = () => window.ZL_KIT(API);

/* ---------- Strecke ---------- */
const TP = [[0, 0], [120, 0], [220, -20], [290, -80], [300, -170], [250, -240], [170, -262], [110, -222], [90, -150], [30, -118],
  [-40, -160], [-110, -222], [-190, -232], [-252, -170], [-252, -80], [-200, -20], [-110, 10]];
const TW = 26, LAPS = 2, VMX = 54;
const elev = u => 3.2 * Math.sin(u * TAU * 2 + .5) + 1.8 * Math.sin(u * TAU * 5 + 1.3) + 7.5 * Math.exp(-(((u - .07) / .02) ** 2));
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
const at = u => PTS[Math.floor(((u % 1) + 1) % 1 * NPT)];
const PADS = [[.16, -6], [.27, 6], [.41, 0], [.52, -5], [.77, 6], [.9, -4]].map(([u, lat]) => ({i: Math.floor(u * NPT), lat}));
const HEARTS = [];
[[.11, 0], [.33, -1], [.47, 1], [.71, 0], [.86, -1]].forEach(([u, side], r) => { for (let k = 0; k < 5; k++) { const i = Math.floor(u * NPT) + k * 4, lat = (side * 3) + (k - 2) * 2.2 * (r % 2 ? 1 : -1) * .9; HEARTS.push({i: i % NPT, lat}); } });
const TUNNEL = [.56, .67];
function startPos(k) { const p = PTS[NPT - 14], o = k === 'a' ? -5 : 5; return {x: p.x + p.nx * o, y: p.z + p.nz * o}; }

/* ---------- Autos ---------- */
function paintMat(T, color, emis) { return new T.MeshStandardMaterial({color, metalness: .6, roughness: .3, emissive: emis, emissiveIntensity: .25}); }
function makeCar(T, kind) {
  const K = KIT(), g = new T.Group(), body = new T.Group(); g.add(body);
  const suv = kind === 'suv';
  const paint = suv ? paintMat(T, 0xd9879f, 0x3a1020) : paintMat(T, 0x5f8fe0, 0x0a1a40);
  const glass = new T.MeshStandardMaterial({color: 0x0e1422, metalness: .9, roughness: .08, emissive: 0x0a1630, emissiveIntensity: .5});
  const trim = new T.MeshStandardMaterial({color: 0x15161e, metalness: .4, roughness: .5});
  const W = suv ? 2.3 : 2.2;
  const lower = suv
    ? [[-2.5, .45], [-2.55, 1.0], [-2.25, 1.32], [2.35, 1.4], [2.55, 1.15], [2.55, .45]]
    : [[-2.6, .32], [-2.65, .6], [-2.3, .78], [-1.0, .95], [1.6, 1.0], [2.5, .98], [2.6, .7], [2.6, .32]];
  const green = suv
    ? [[-1.3, 1.3], [-.85, 2.02], [1.7, 2.07], [2.3, 1.92], [2.35, 1.3]]
    : [[-1.05, .9], [-.25, 1.34], [.9, 1.36], [1.95, .98]];
  const lg = K.extrudeProfile(T, lower, W - .16, .08); body.add(new T.Mesh(lg, paint));
  const gg = K.extrudeProfile(T, green, W - (suv ? .36 : .62), .05); body.add(new T.Mesh(gg, glass));
  if (suv) {
    const roof = new T.Mesh(new T.BoxGeometry(W - .32, .1, 2.65), paint); roof.position.set(0, 2.1, .45); body.add(roof);
    for (const s of [-1, 1]) { const r = new T.Mesh(new T.BoxGeometry(.07, .08, 2.3), trim); r.position.set(s * .85, 2.2, .45); body.add(r); }
    const skirt = new T.Mesh(new T.BoxGeometry(W + .04, .3, 4.9), trim); skirt.position.y = .55; body.add(skirt);
  } else {
    const wing = new T.Mesh(new T.BoxGeometry(W, .07, .5), trim); wing.position.set(0, 1.28, 2.35); body.add(wing);
    for (const s of [-1, 1]) { const st = new T.Mesh(new T.BoxGeometry(.07, .3, .18), trim); st.position.set(s * .75, 1.1, 2.35); body.add(st); }
    const stripe = new T.Mesh(new T.BoxGeometry(.32, .02, 4.6), new T.MeshStandardMaterial({color: 0xffffff, metalness: .3, roughness: .3})); stripe.position.set(0, 1.01, .1); body.add(stripe);
    const lip = new T.Mesh(new T.BoxGeometry(W + .1, .08, .5), trim); lip.position.set(0, .32, -2.45); body.add(lip);
  }
  const hl = new T.MeshBasicMaterial({color: 0xfff6dc}), tl = new T.MeshBasicMaterial({color: 0xb0122e});
  const fy = suv ? 1.08 : .72, fz = suv ? 2.56 : 2.66, rz = suv ? 2.56 : 2.62;
  for (const s of [-1, 1]) {
    const a = new T.Mesh(new T.BoxGeometry(.55, .16, .06), hl); a.position.set(s * (W / 2 - .38), fy, -fz); body.add(a);
    const b = new T.Mesh(new T.BoxGeometry(.6, .14, .06), tl); b.position.set(s * (W / 2 - .38), fy + .05, rz); body.add(b);
  }
  const bar = new T.Mesh(new T.BoxGeometry(W - .9, .035, .05), tl); bar.position.set(0, fy + .05, rz); body.add(bar);
  const wheels = [], r = suv ? .5 : .42, wx = W / 2 + .02, wz = suv ? 1.55 : 1.6;
  const tire = new T.MeshStandardMaterial({color: 0x0c0c10, roughness: .85}), rim = new T.MeshStandardMaterial({color: 0xdfe2ea, metalness: .95, roughness: .18});
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new T.Group(); w.position.set(sx * wx, r, sz * wz);
    const spin = new T.Group(); w.add(spin);
    const t = new T.Mesh(new T.CylinderGeometry(r, r, .4, 22), tire); t.rotation.z = Math.PI / 2; spin.add(t);
    const c = new T.Mesh(new T.CylinderGeometry(r * .62, r * .62, .42, 10), rim); c.rotation.z = Math.PI / 2; spin.add(c);
    for (let k = 0; k < 5; k++) { const sp = new T.Mesh(new T.BoxGeometry(.43, r * 1.1, .07), rim); sp.rotation.x = k / 5 * Math.PI; spin.add(sp); }
    g.add(w); wheels.push({w, spin, front: sz < 0});
  }
  const glowCol = suv ? 0xff7aa8 : 0x6fb4ff;
  const under = new T.Mesh(new T.PlaneGeometry(W + 1.6, 5.8), new T.MeshBasicMaterial({color: glowCol, transparent: true, opacity: .25, blending: T.AdditiveBlending, depthWrite: false}));
  under.rotation.x = -Math.PI / 2; under.position.y = .06; g.add(under);
  const beam = new T.Mesh(new T.PlaneGeometry(5, 18), new T.MeshBasicMaterial({color: 0xfff1c0, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false}));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, .07, -fz - 9); g.add(beam);
  const flames = [];
  for (const s of [-1, 1]) {
    const hg = K.sprite(T, 0xfff2c8, 2.6, .9); hg.position.set(s * (W / 2 - .38), fy, -fz - .3); g.add(hg);
    const tg = K.sprite(T, 0xff3355, 1.1, .3); tg.position.set(s * (W / 2 - .38), fy + .05, rz + .25); g.add(tg);
    const f = K.sprite(T, suv ? 0xff8fb4 : 0x7fc0ff, 2.4, 0); f.position.set(s * .5, .5, rz + .9); g.add(f); flames.push(f);
  }
  g.userData = {wheels, flames, body, under};
  return g;
}

/* ---------- Szene ---------- */
function canvasTex(T, w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; } t.anisotropy = 4; return t; }
function buildScene(T) {
  const K = KIT(), scene = new T.Scene();
  scene.fog = new T.FogExp2(0x1a0f2e, .0042);
  scene.add(K.sky(T, 0x05061a, 0x4a1c5a, 0x0a0614));
  scene.environment = K.env(T, 'race', 0x0a0820, 0x5a2070, 0x0a0614, [[40, 14, -30, 40, 6, 0xff5fa2], [-40, 14, 30, 40, 6, 0x5fb8ff], [0, 60, 0, 50, 50, 0x8a7aa8], [30, 8, 40, 20, 4, 0xffd27a]]);
  const cam = new T.PerspectiveCamera(66, 1, .3, 1400);
  scene.add(new T.HemisphereLight(0xb8c4ff, 0x2a1a30, .9));
  scene.add(new T.AmbientLight(0xffffff, .18));
  const moon = new T.DirectionalLight(0xd8e0ff, .7); moon.position.set(-200, 300, -100); scene.add(moon);
  const sn = 700, sp = new Float32Array(sn * 3);
  for (let i = 0; i < sn; i++) { const a = rnd(0, TAU), e = rnd(.12, 1.45), r = 800; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  scene.add(new T.Points(sg, new T.PointsMaterial({color: 0xffffff, size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: .85})));
  const moonS = K.sprite(T, 0xfff0d8, 160, 1); moonS.position.set(-320, 330, -520); moonS.material.fog = false; scene.add(moonS);
  const moonD = new T.Mesh(new T.CircleGeometry(26, 32), new T.MeshBasicMaterial({color: 0xfff6e6, fog: false})); moonD.position.copy(moonS.position); moonD.lookAt(0, 0, 0); scene.add(moonD);
  // Berge
  const mtn = new T.MeshBasicMaterial({color: 0x150b26, fog: false});
  for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, r = 760, h = rnd(80, 190), m = new T.Mesh(new T.ConeGeometry(rnd(90, 160), h, 4), mtn); m.position.set(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r - 100); scene.add(m); }
  // Boden mit Neon-Raster
  const grid = canvasTex(T, 256, 256, (g, w, h) => { g.fillStyle = '#0b0818'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(170,90,255,.55)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.strokeStyle = 'rgba(255,110,190,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); }, true);
  grid.repeat.set(80, 80);
  const ground = new T.Mesh(new T.PlaneGeometry(1600, 1600), new T.MeshBasicMaterial({map: grid})); ground.rotation.x = -Math.PI / 2; ground.position.set(20, -6, -110); scene.add(ground);
  // Fahrbahn
  const road = canvasTex(T, 256, 512, (g, w, h) => {
    g.fillStyle = '#26232f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},255,${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(8, 0, 6, h); g.fillRect(w - 14, 0, 6, h);
    g.fillStyle = 'rgba(255,230,180,.75)'; g.fillRect(w / 2 - 3, 0, 6, h * .45);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(w / 3 - 2, h * .55, 4, h * .3); g.fillRect(w * 2 / 3 - 2, h * .55, 4, h * .3);
  }, true);
  const nv = (NPT + 1) * 2;
  const ribbon = (w0, w1, y0, y1, uvScale) => {
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
    for (let i = 0; i <= NPT; i++) {
      const p = PTS[i % NPT], s = i === NPT ? TRACK.len : p.s;
      for (let k = 0; k < 2; k++) { const w = k ? w1 : w0, y = k ? y1 : y0, j = i * 2 + k; pos[j * 3] = p.x + p.nx * w; pos[j * 3 + 1] = p.y + y; pos[j * 3 + 2] = p.z + p.nz * w; uv[j * 2] = k; uv[j * 2 + 1] = s / uvScale; }
      if (i < NPT) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  scene.add(new T.Mesh(ribbon(-TW / 2, TW / 2, 0, 0, 34), new T.MeshStandardMaterial({map: road, roughness: .42, metalness: .35, side: T.DoubleSide})));
  const skirtM = new T.MeshStandardMaterial({color: 0x15121f, roughness: .8, side: T.DoubleSide});
  scene.add(new T.Mesh(ribbon(-TW / 2 - .6, -TW / 2 - .6, 0, -2.6, 20), skirtM));
  scene.add(new T.Mesh(ribbon(TW / 2 + .6, TW / 2 + .6, 0, -2.6, 20), skirtM));
  // Leitplanken aus Licht
  const railA = new T.MeshBasicMaterial({color: 0xff5fa2, transparent: true, opacity: .9, side: T.DoubleSide});
  const railD = new T.MeshBasicMaterial({color: 0x5fb8ff, transparent: true, opacity: .9, side: T.DoubleSide});
  scene.add(new T.Mesh(ribbon(-TW / 2 - .5, -TW / 2 - .5, .55, .9, 10), railA));
  scene.add(new T.Mesh(ribbon(TW / 2 + .5, TW / 2 + .5, .55, .9, 10), railD));
  const wallM = new T.MeshStandardMaterial({color: 0x2a2440, roughness: .6, transparent: true, opacity: .75, side: T.DoubleSide});
  scene.add(new T.Mesh(ribbon(-TW / 2 - .5, -TW / 2 - .5, 0, .55, 10), wallM));
  scene.add(new T.Mesh(ribbon(TW / 2 + .5, TW / 2 + .5, 0, .55, 10), wallM));
  // Pfeiler
  const pil = new T.MeshStandardMaterial({color: 0x241e36, roughness: .7});
  for (let i = 0; i < NPT; i += 18) { const p = PTS[i], h = p.y + 6, m = new T.Mesh(new T.CylinderGeometry(1.1, 1.4, h, 10), pil); m.position.set(p.x, -6 + h / 2 - .3, p.z); scene.add(m); }
  // Laternen
  const poleM = new T.MeshStandardMaterial({color: 0x3a3650, metalness: .6, roughness: .4}), bulbM = new T.MeshBasicMaterial({color: 0xfff1d6});
  for (let i = 0; i < NPT; i += 26) for (const s of [-1, 1]) {
    const p = PTS[i], x = p.x + p.nx * s * (TW / 2 + 1.2), z = p.z + p.nz * s * (TW / 2 + 1.2);
    const pole = new T.Mesh(new T.CylinderGeometry(.13, .18, 8, 8), poleM); pole.position.set(x, p.y + 4, z); scene.add(pole);
    const arm = new T.Mesh(new T.BoxGeometry(.12, .12, 2.2), poleM); arm.position.set(x - p.nx * s * 1, p.y + 7.9, z - p.nz * s * 1); arm.lookAt(p.x, p.y + 7.9, p.z); scene.add(arm);
    const bx = x - p.nx * s * 2, bz = z - p.nz * s * 2;
    const b = new T.Mesh(new T.SphereGeometry(.32, 10, 8), bulbM); b.position.set(bx, p.y + 7.75, bz); scene.add(b);
    const gsp = K.sprite(T, s < 0 ? 0xffc6d8 : 0xc6dcff, 9, .9); gsp.position.set(bx, p.y + 7.7, bz); scene.add(gsp);
    const pool = new T.Mesh(new T.CircleGeometry(4.5, 24), new T.MeshBasicMaterial({color: s < 0 ? 0xff9cc0 : 0x9cc8ff, transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false}));
    pool.rotation.x = -Math.PI / 2; pool.position.set(bx, p.y + .04, bz); scene.add(pool);
  }
  // Tunnel aus Neonbögen
  const arches = [], archG = new T.TorusGeometry(TW / 2 + 1.5, .35, 10, 40, Math.PI);
  for (let i = Math.floor(TUNNEL[0] * NPT); i < TUNNEL[1] * NPT; i += 7) {
    const p = PTS[i], m = new T.Mesh(archG, new T.MeshBasicMaterial({color: 0xff6fb0}));
    m.position.set(p.x, p.y, p.z); m.lookAt(p.x + p.tx, p.y, p.z + p.tz); scene.add(m); arches.push(m);
  }
  // Start-/Zieltor
  const p0 = PTS[0], gate = new T.Group();
  const chk = canvasTex(T, 256, 32, (g, w, h) => { for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); } });
  for (const s of [-1, 1]) { const post = new T.Mesh(new T.BoxGeometry(.8, 9, .8), poleM); post.position.set(s * (TW / 2 + 1.5), 4.5, 0); gate.add(post); }
  const banner = new T.Mesh(new T.BoxGeometry(TW + 3.8, 1.6, .4), new T.MeshBasicMaterial({map: chk})); banner.position.y = 8.6; gate.add(banner);
  const ztx = canvasTex(T, 512, 64, (g, w, h) => { g.fillStyle = '#1a1030'; g.fillRect(0, 0, w, h); g.font = '700 40px Karla, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd27a'; g.fillText(`${nm('a')} ♥ ${nm('d')}`, w / 2, 46); });
  const sign = new T.Mesh(new T.PlaneGeometry(TW * .7, 2.2), new T.MeshBasicMaterial({map: ztx, side: T.DoubleSide})); sign.position.y = 10.6; sign.rotation.y = Math.PI; gate.add(sign);
  gate.position.set(p0.x, p0.y, p0.z); gate.lookAt(p0.x + p0.tx, p0.y, p0.z + p0.tz); scene.add(gate);
  const line = new T.Mesh(new T.PlaneGeometry(TW, 2.4), new T.MeshBasicMaterial({map: chk})); line.rotation.x = -Math.PI / 2; line.rotation.z = -Math.atan2(p0.tx, p0.tz) + Math.PI / 2; line.position.set(p0.x, p0.y + .05, p0.z); scene.add(line);
  // Turbo-Felder
  const arrow = canvasTex(T, 64, 128, (g) => { g.strokeStyle = '#ffd27a'; g.lineWidth = 11; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(10, 44 + k * 32); g.lineTo(32, 20 + k * 32); g.lineTo(54, 44 + k * 32); g.stroke(); } }, true);
  const pads = [];
  for (const pd of PADS) {
    const p = PTS[pd.i], m = new T.Mesh(new T.PlaneGeometry(4.5, 8), new T.MeshBasicMaterial({map: arrow.clone(), transparent: true, blending: T.AdditiveBlending, depthWrite: false}));
    m.material.map.wrapT = T.RepeatWrapping; m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(p.tx, p.tz) + Math.PI; m.position.set(p.x + p.nx * pd.lat, p.y + .06, p.z + p.nz * pd.lat); scene.add(m); pads.push(m);
  }
  // Herzen
  const hgeo = K.heartGeo(T, .9, .3), hearts = [];
  const hm = new T.MeshStandardMaterial({color: 0xff7aa8, emissive: 0xff4f8a, emissiveIntensity: .9, metalness: .2, roughness: .3});
  HEARTS.forEach((h, i) => { const p = PTS[h.i], m = new T.Mesh(hgeo, hm); m.position.set(p.x + p.nx * h.lat, p.y + 1.6, p.z + p.nz * h.lat); scene.add(m); hearts.push(m); void i; });
  // Stadt
  const winTex = canvasTex(T, 64, 128, (g, w, h) => { g.fillStyle = '#100d22'; g.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 9) for (let x = 4; x < w; x += 9) if (Math.random() < .5) { g.fillStyle = ['#ffd9a0', '#ffe9c0', '#bcd8ff', '#ffb8d2', '#c8a8ff'][(x + y) % 5]; g.fillRect(x, y, 5, 5); } });
  const bm = new T.MeshBasicMaterial({map: winTex}), bgeo = new T.BoxGeometry(1, 1, 1);
  const N = 140, city = new T.InstancedMesh(bgeo, bm, N), d = new T.Object3D(); let placed = 0;
  for (let k = 0; k < 600 && placed < N; k++) {
    const a = rnd(0, TAU), r = rnd(80, 430), x = 20 + Math.cos(a) * r, z = -110 + Math.sin(a) * r;
    if (Math.abs(nearestT(x, z).lat) < 34) continue;
    const h = rnd(18, 95) * (r > 300 ? 1.4 : 1), w = rnd(9, 22);
    d.position.set(x, -6 + h / 2, z); d.scale.set(w, h, w); d.rotation.y = rnd(0, 1); d.updateMatrix(); city.setMatrixAt(placed++, d.matrix);
    if (h > 80 && Math.random() < .6) { const blink = K.sprite(T, 0xff3355, 6, .9); blink.position.set(x, -6 + h + 1.5, z); blink.userData.blink = rnd(0, 6); scene.add(blink); }
  }
  city.count = placed; scene.add(city);
  const cars = {a: makeCar(T, 'suv'), d: makeCar(T, 'sport')}; scene.add(cars.a); scene.add(cars.d);
  // Funken (Drift)
  const SPN = 120, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3);
  const spg = new T.BufferGeometry(); spg.setAttribute('position', new T.BufferAttribute(spPos, 3)); spg.setAttribute('color', new T.BufferAttribute(spCol, 3));
  const sparks = new T.Points(spg, new T.PointsMaterial({size: .45, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false}));
  sparks.frustumCulled = false; scene.add(sparks);
  return {scene, cam, cars, arches, pads, hearts, sparks, sp: Array.from({length: SPN}, () => ({life: 0})), spi: 0, camPos: null, shake: 0};
}
function emitSpark(R, x, y, z, color, vx, vz) {
  const p = R.sp[R.spi]; R.spi = (R.spi + 1) % R.sp.length;
  Object.assign(p, {x, y, z, vx: vx + rnd(-3, 3), vy: rnd(2, 6), vz: vz + rnd(-3, 3), life: rnd(.25, .5), c: color});
}

/* ---------- Level ---------- */
const rennen = {
  id: 'rennen', n: 'Nachtrennen', ic: '⚑', t3: 80, t2: 110, ctrl: 'drive', three: true, noClamp: true, hidePlayers: true, eAngle: [0],
  skinName: () => `${nm('a')}: SUV · ${nm('d')}: Sportwagen`,
  h: () => `${nm('a')} im rosé SUV gegen ${nm('d')} im blauen Sportwagen – zwei Runden über die Hochstraße der Lichterstadt. Lenk hart in die Kurve zum Driften: Lässt du los, gibt's einen Turbo. Goldene Pfeile und der Windschatten machen schneller, Herzen bringen Punkte. Die Kuppe am Start ist eine Sprungschanze!`,
  start: k => startPos(k),
  countText: () => `Runde ${Math.min(LAPS, ((LOC.car && LOC.car.lap) || 0) + 1)}/${LAPS} · ♥${(S.aux.score || {})[API.me] || 0}`,
  posExtra: () => { const c = LOC.car; return c ? [Math.round(c.h * 1000) / 1000, Math.round(c.prog * 1000) / 1000, Math.round(c.v * 10) / 10, Math.round(c.y * 100) / 100, (c.drift > .5 ? (c.drift > 1.2 ? 2 : 1) : 0) + (c.boost > 0 ? 4 : 0)] : null; },
  note: () => {
    const f = S.aux.fin || {}, sc = S.aux.score || {a: 0, d: 0};
    if (f.a == null || f.d == null) return '';
    const w = f.a <= f.d ? 'a' : 'd';
    return `${nm(w)} gewinnt mit ${Math.abs(f.a - f.d).toFixed(1)} s Vorsprung · Herzen: ${nm('a')} ${sc.a}, ${nm('d')} ${sc.d}`;
  },
  setup() { S.aux = {fin: {}, hg: '0'.repeat(HEARTS.length), score: {a: 0, d: 0}}; S.total = LAPS * 2; },
  move(dt, inp) {
    if (!LOC.car) {
      const n = nearestT(mine.x, mine.y), p = PTS[n.i];
      LOC.car = {h: Math.atan2(p.tx, p.tz), v: 0, y: n.y, vy: 0, air: false, lap: 0, mid: false, started: false, lastP: n.s / TRACK.len, idx: n.i,
        boost: 0, bkind: 0, drift: 0, dsign: 0, slip: 0, done: false, prog: 0, bump: 0, sent: {}, wrong: 0, lapT: 0, best: null};
    }
    const c = LOC.car, n = nearestT(mine.x, mine.y, c.idx), p = PTS[n.i]; c.idx = n.i;
    const steer = clamp(inp.steer || 0, -1, 1);
    // Drift & Mini-Turbo
    if (Math.abs(steer) > .65 && c.v > 26 && !c.air && !c.done) { if (!c.drift) c.dsign = Math.sign(steer); c.drift += dt; }
    else if (c.drift) {
      if (c.drift > .5) { const big = c.drift > 1.2; c.boost = Math.max(c.boost, big ? 1.3 : .75); c.bkind = big ? 2 : 1; tone(big ? 1046 : 784, .3, .06, 'sawtooth'); buzz(big ? 30 : 15); toast(big ? 'Super-Turbo!' : 'Mini-Turbo!'); }
      c.drift = 0;
    }
    c.boost = Math.max(0, c.boost - dt);
    for (const pd of PADS) if (Math.abs(n.i - pd.i) < 5 && Math.abs(n.lat - pd.lat) < 3 && c.boost < .9) { c.boost = 1.2; c.bkind = 3; tone(988, .25, .05, 'sawtooth'); buzz(15); }
    // Windschatten
    const o = API.partner(), fx = Math.sin(c.h), fz = Math.cos(c.h), rx = o.x - mine.x, rz = o.y - mine.y, ahead = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
    c.slip = (ahead > 4 && ahead < 26 && side < 4.5 && c.v > 24) ? c.slip + dt : 0;
    const slipOn = c.slip > .5;
    // Tempo
    let tv = c.done ? 0 : VMX * API.diff() * (c.boost > 0 ? 1.4 : 1) * (slipOn ? 1.12 : 1) * (c.drift ? .96 : 1);
    if (inp.brake) tv = Math.min(tv, 16);
    c.v += clamp(tv - c.v, -55 * dt, (c.boost > 0 ? 50 : 20) * dt);
    // Lenkung: rechts lenken = nach rechts fahren
    const rate = (c.drift ? 2.35 : 1.7) * clamp(c.v / 16, .3, 1) * (c.air ? .35 : 1);
    c.h -= (c.drift ? (steer * .55 + c.dsign * .55) : steer) * rate * dt;
    let vx = Math.sin(c.h) * c.v, vz = Math.cos(c.h) * c.v;
    if (c.drift) { vx += Math.cos(c.h) * c.dsign * c.v * .1; vz -= Math.sin(c.h) * c.dsign * c.v * .1; }
    mine.x += vx * dt; mine.y += vz * dt;
    // Leitplanken
    const lim = TW / 2 - 1.3;
    if (Math.abs(n.lat) > lim) {
      const k = (Math.abs(n.lat) - lim) * Math.sign(n.lat); mine.x -= p.nx * k; mine.y -= p.nz * k;
      const tan = Math.atan2(p.tx, p.tz); c.h = API.lerpA(c.h, tan, .15);
      if (c.bump <= 0) { c.v *= .84; c.bump = .35; tone(110, .14, .06, 'square'); buzz(25); LOC.shk = .35; if (LOC.r3) for (let i = 0; i < 10; i++) emitSpark(LOC.r3, mine.x, c.y + .5, mine.y, [1, .8, .4], -vx * .2, -vz * .2); }
    }
    c.bump -= dt;
    // Zusammenstoß mit dem anderen Auto
    const dd = Math.hypot(rx, rz);
    if (dd < 3.4 && dd > .01 && Math.abs((o.e ? o.e[3] : c.y) - c.y) < 2) { mine.x -= rx / dd * (3.4 - dd) * .6; mine.y -= rz / dd * (3.4 - dd) * .6; c.v *= .97; if (c.bump <= 0) { tone(140, .15, .05, 'square'); buzz(25); c.bump = .4; LOC.shk = .25; } }
    // Höhe, Sprünge
    const gy = n.y;
    if (c.air) { c.vy -= 40 * dt; c.y += c.vy * dt; if (c.y <= gy) { if (c.vy < -9) { LOC.shk = .45; tone(85, .2, .07, 'square'); buzz(40); } c.y = gy; c.vy = 0; c.air = false; } }
    else { const proj = c.y + c.vy * dt; if (proj > gy + .2 && c.vy > 3) { c.air = true; c.y = proj; } else { c.vy = clamp((gy - c.y) / Math.max(dt, .001), -40, 40); c.y = gy; } }
    // Herzen
    for (let i = 0; i < HEARTS.length; i++) {
      if (S.aux.hg[i] !== '0' || c.sent[i]) continue;
      const h = HEARTS[i], hp = PTS[h.i], hx = hp.x + hp.nx * h.lat, hz = hp.z + hp.nz * h.lat;
      if (Math.hypot(hx - mine.x, hz - mine.y) < 2.6 && Math.abs(hp.y + 1.6 - (c.y + 1)) < 3) { c.sent[i] = 1; tone(1318, .2, .05); act({k: 'heart', i}); }
    }
    // Runden
    const pr = n.s / TRACK.len;
    if (c.lastP > .8 && pr < .2) {
      if (!c.started) c.started = true;
      else if (c.mid) { c.lap++; c.mid = false; if (c.lap < LAPS) { toast(`Letzte Runde!`); tone(880, .3, .05, 'square'); } }
    }
    if (pr > .45 && pr < .6 && c.started) c.mid = true;
    if (!c.started && pr < .5) c.started = true;
    c.lastP = pr;
    c.wrong = (fx * p.tx + fz * p.tz) < -.3 ? c.wrong + dt : 0;
    if (c.lap >= LAPS && !c.done) { c.done = true; toast('Im Ziel! 🏁'); }
    c.prog = c.started ? Math.min(LAPS, c.lap + (c.lap >= LAPS ? 0 : pr)) : 0;
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
    const meK = API.me, oK = API.other, c = LOC.car;
    const n0 = c ? null : nearestT(mine.x, mine.y);
    const myH = c ? c.h : Math.atan2(PTS[n0.i].tx, PTS[n0.i].tz), myY = c ? c.y : n0.y;
    const oE = part.e || [myH, 0, 0, myY, 0];
    const placeCar = (car, x, z, h, y, v, flags, steer, pitch) => {
      car.position.set(x, y, z); car.rotation.set(0, h + Math.PI, 0);
      const u = car.userData;
      u.body.rotation.z = clamp(-steer * .05 * Math.min(1, v / 30), -.08, .08) + ((flags & 3) ? -Math.sign(steer || 1) * .05 : 0);
      u.body.rotation.x = clamp(pitch, -.25, .25);
      u.wheels.forEach(w => { w.spin.rotation.x -= v * dt / .45; if (w.front) w.w.rotation.y = -steer * .35; });
      const boost = flags & 4;
      u.flames.forEach((f, i) => { f.material.opacity = boost ? .8 + Math.sin(t * 40 + i) * .2 : 0; f.scale.setScalar(boost ? 2.4 + Math.random() * 1.2 : 1); });
      u.under.material.opacity = .2 + Math.sin(t * 4) * .05;
    };
    const steerNow = c ? (LOC._steer || 0) : 0;
    placeCar(R.cars[meK], mine.x, mine.y, myH, myY, c ? c.v : 0, c ? ((c.drift > .5 ? (c.drift > 1.2 ? 2 : 1) : 0) + (c.boost > 0 ? 4 : 0)) : 0, steerNow, c ? -Math.atan2(c.vy, Math.max(c.v, 1)) * .6 : 0);
    placeCar(R.cars[oK], part.x, part.y, oE[0], oE[3] != null ? oE[3] : myY, oE[2] || 0, oE[4] || 0, 0, 0);
    // Funken
    const drawSparks = (x, y, z, h, flags) => {
      if (!(flags & 3)) return;
      const col = (flags & 3) === 2 ? [1, .55, .2] : [.4, .7, 1];
      for (const s of [-1, 1]) emitSpark(R, x + Math.cos(h) * s * 1.1 - Math.sin(h) * 1.8, y + .2, z - Math.sin(h) * s * 1.1 - Math.cos(h) * 1.8, col, -Math.sin(h) * 8, -Math.cos(h) * 8);
    };
    if (c && S.phase === 'play') drawSparks(mine.x, myY, mine.y, myH, (c.drift > .5 ? (c.drift > 1.2 ? 2 : 1) : 0));
    drawSparks(part.x, oE[3] || 0, part.y, oE[0], oE[4] || 0);
    const pa = R.sparks.geometry.attributes.position, ca = R.sparks.geometry.attributes.color;
    R.sp.forEach((p, i) => {
      if (p.life > 0) { p.life -= dt; p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
      const a = Math.max(0, p.life) * 2.2;
      pa.setXYZ(i, p.x || 0, p.life > 0 ? p.y : -999, p.z || 0); ca.setXYZ(i, (p.c || [1, 1, 1])[0] * a, (p.c || [1, 1, 1])[1] * a, (p.c || [1, 1, 1])[2] * a);
    });
    pa.needsUpdate = true; ca.needsUpdate = true;
    // Welt-Animation
    R.arches.forEach((m, i) => { const k = (Math.sin(t * 3 - i * .55) + 1) / 2; m.material.color.setRGB(1 * k + .37 * (1 - k), .37 * k + .72 * (1 - k), .69 * k + 1 * (1 - k)); });
    R.pads.forEach(m => { m.material.map.offset.y = (t * 1.6) % 1; });
    const hg = S.aux.hg || '';
    R.hearts.forEach((m, i) => { m.visible = hg[i] === '0' && !(c && c.sent[i]); m.rotation.y = t * 2.2 + i; });
    R.scene.children.forEach(o => { if (o.userData && o.userData.blink != null) o.material.opacity = Math.sin(t * 3 + o.userData.blink) > .3 ? .95 : .1; });
    // Kamera
    const f = new T.Vector3(Math.sin(myH), 0, Math.cos(myH)), base = new T.Vector3(mine.x, myY, mine.y);
    const sp = c ? c.v : 0, boostOn = c && c.boost > 0;
    const want = base.clone().addScaledVector(f, -(10.5 + sp * .04)).add(new T.Vector3(0, 4.3 + sp * .015, 0));
    if (!R.camPos) R.camPos = want.clone(); R.camPos.lerp(want, Math.min(1, dt * 7));
    LOC.shk = Math.max(0, (LOC.shk || 0) - dt);
    const sh = LOC.shk * .9;
    R.cam.position.copy(R.camPos).add(new T.Vector3(rnd(-sh, sh), rnd(-sh, sh), rnd(-sh, sh)));
    R.cam.lookAt(base.clone().addScaledVector(f, 8).add(new T.Vector3(0, 1.4, 0)));
    R.cam.rotation.z += -(LOC._steer || 0) * .03;
    const fovT = (sc.cw < sc.ch ? 74 : 62) + sp * .12 + (boostOn ? 9 : 0);
    R.cam.fov += (fovT - R.cam.fov) * Math.min(1, dt * 4); R.cam.aspect = sc.cw / sc.ch; R.cam.updateProjectionMatrix();
    API.render3D(R.scene, R.cam, {bloom: 1.15, th: .6});
    // --- Anzeigen (2D) ---
    const pp = K.proj(R.cam, new T.Vector3(part.x, (oE[3] || myY) + 3.8, part.y));
    if (pp.ok) K.nameTag(oK === 'a' ? `${nm('a')}s SUV` : `${nm('d')}s Sportwagen`, pp.x, pp.y, COL[oK]);
    if (sp > 42 || boostOn) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = boostOn ? 'rgba(255,210,150,.22)' : 'rgba(255,255,255,.1)'; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const a = rnd(0, TAU), r0 = rnd(.32, .5) * sc.ch, r1 = r0 + rnd(60, 160); ctx.beginPath(); ctx.moveTo(sc.cw / 2 + Math.cos(a) * r0, sc.ch * .55 + Math.sin(a) * r0); ctx.lineTo(sc.cw / 2 + Math.cos(a) * r1, sc.ch * .55 + Math.sin(a) * r1); ctx.stroke(); }
      ctx.restore();
    }
    // Minikarte
    const mx = sc.cw - 116, my = 78, ms = .2;
    ctx.fillStyle = 'rgba(10,8,24,.55)'; rr(mx - 8, my - 8, 112, 92, 14); ctx.fill();
    const toM = (x, z) => [mx + 50 + (x - 25) * ms, my + 40 + (z + 115) * ms];
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath();
    PTS.forEach((q, i) => { if (i % 8) return; const [a, b] = toM(q.x, q.z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); ctx.stroke();
    for (const [x, z, k] of [[part.x, part.y, oK], [mine.x, mine.y, meK]]) { const [a, b] = toM(x, z); ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(a, b, 4.5, 0, TAU); ctx.fill(); }
    if (S.phase === 'play' && c) {
      const first = c.prog >= (oE[1] || 0) || c.done;
      ctx.textAlign = 'left'; ctx.font = '700 28px Karla, system-ui'; ctx.fillStyle = first ? '#f3c98f' : '#d8d0ea';
      ctx.fillText(first ? '1.' : '2.', 16, 100); ctx.font = '600 13px Karla, system-ui'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('Platz', 48, 100);
      // Tacho
      const cx0 = 74, cy0 = sc.ch - 70, r = 52, frac = clamp(c.v / (VMX * 1.45), 0, 1);
      ctx.lineCap = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(cx0, cy0, r, Math.PI * .8, Math.PI * 2.2); ctx.stroke();
      const g = ctx.createLinearGradient(cx0 - r, 0, cx0 + r, 0); g.addColorStop(0, rgba(COL[meK], 1)); g.addColorStop(1, boostOn ? '#ffd27a' : '#ffffff');
      ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx0, cy0, r, Math.PI * .8, Math.PI * (.8 + 1.4 * frac)); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 26px Karla, system-ui'; ctx.fillText(String(Math.round(c.v * 4.4)), cx0, cy0 + 8);
      ctx.font = '600 11px Karla, system-ui'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('km/h', cx0, cy0 + 24);
      const msgs = [];
      if (c.drift > .5) msgs.push([c.drift > 1.2 ? 'DRIFT · Super-Turbo bereit' : 'DRIFT · Mini-Turbo bereit', c.drift > 1.2 ? '#ffb070' : '#8fc8ff']);
      else if (boostOn) msgs.push(['TURBO', '#ffd27a']);
      if (c.slip > .5) msgs.push(['Windschatten!', '#bfe8ff']);
      if (c.wrong > 1) msgs.push(['Falsche Richtung!', '#ff8a8a']);
      msgs.forEach(([txt, col], i) => { ctx.font = '700 18px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(txt, sc.cw / 2, sc.ch - 150 - i * 26); });
    }
  }
};
// Lenkwert für Kameraneigung merken
const baseMove = rennen.move;
rennen.move = function (dt, inp) { LOC._steer = (LOC._steer || 0) + ((inp.steer || 0) - (LOC._steer || 0)) * Math.min(1, dt * 8); return baseMove.call(this, dt, inp); };
return [rennen];
});
