/* Zwei Lichter – „Nebelwald“ (neu in Version 8)
   Einer läuft in der Ich-Perspektive mit der Laterne durch den dunklen Wald, der andere sieht alles von oben
   und lotst per Stimme. Den Morast sieht nur der Lotse. Danach Rollentausch in einem neuen Wald. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CA, CD, CG, rgba, rnd, clamp, nm, OTH, emit, finish, teleport, act, hostNow, mine, label, rr} = API;
const toast = t => API.toast(t);
const U = 50, NG = 11, CW = 3, SI = 9 * NG + 5, XI = 1 * NG + 5, HW = 19.5;
const wx = c => (c - 5) * CW, wz = r => (r - 5) * CW, ic = i => i % NG, ir = i => (i / NG) | 0;
const ri = n => (Math.random() * n) | 0;
const START = {x: wx(5), z: wz(9)}, EXIT = {x: wx(5), z: wz(1)};
const grid = A => A.r ? A.g1 : A.g0, flowers = A => A.r ? A.f1 : A.f0;

function mkForest() {
  for (let tries = 0; tries < 80; tries++) {
    const g = Array.from({length: NG}, () => Array(NG).fill('#')), seen = new Set(['2,4']), stack = [[2, 4]]; g[9][5] = '.';
    while (stack.length) {
      const [c, r] = stack[stack.length - 1], opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c + dx, r + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < 5 && y < 5 && !seen.has(x + ',' + y));
      if (!opts.length) { stack.pop(); continue; }
      const [x, y, dx, dy] = opts[ri(opts.length)]; seen.add(x + ',' + y); g[r * 2 + 1 + dy][c * 2 + 1 + dx] = '.'; g[y * 2 + 1][x * 2 + 1] = '.'; stack.push([x, y]);
    }
    let extra = 0; for (let n = 0; n < 300 && extra < 7; n++) { const c = 1 + ri(9), r = 1 + ri(9); if ((c % 2) === (r % 2) || g[r][c] !== '#') continue; g[r][c] = '.'; extra++; }
    // Sternblumen in drei weit auseinander liegenden Lichtungen
    const rooms = []; for (let r = 1; r < NG; r += 2) for (let c = 1; c < NG; c += 2) { const i = r * NG + c; if (i !== SI && i !== XI) rooms.push(i); }
    let fl = null;
    for (let n = 0; n < 200 && !fl; n++) { const p = [rooms[ri(rooms.length)], rooms[ri(rooms.length)], rooms[ri(rooms.length)]]; const far = (a, b) => Math.abs(ic(a) - ic(b)) + Math.abs(ir(a) - ir(b)) >= 4;
      if (far(p[0], p[1]) && far(p[0], p[2]) && far(p[1], p[2]) && p.every(i => far(i, SI))) fl = p; }
    if (!fl) continue;
    // Morast auf Durchgängen – alles muss trotzdem erreichbar bleiben
    const conn = []; for (let r = 1; r < NG - 1; r++) for (let c = 1; c < NG - 1; c++) if ((c % 2) !== (r % 2) && g[r][c] === '.') conn.push(r * NG + c);
    const reach = hz => { const sn = new Set([SI]), q = [SI]; while (q.length) { const i = q.pop(), c = ic(i), r = ir(i); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = c + dx, y = r + dy, j = y * NG + x; if (x < 0 || y < 0 || x >= NG || y >= NG || g[y][x] === '#' || hz.has(j) || sn.has(j)) continue; sn.add(j); q.push(j); } } return fl.every(i => sn.has(i)) && sn.has(XI); };
    for (let want = 6; want >= 3; want--) for (let n = 0; n < 60; n++) {
      const hz = new Set(); while (hz.size < want && hz.size < conn.length) hz.add(conn[ri(conn.length)]);
      if (![...hz].some(i => Math.abs(ic(i) - 5) + Math.abs(ir(i) - 9) <= 1) && reach(hz)) { hz.forEach(i => { g[ir(i)][ic(i)] = 'm'; }); return {g: g.map(r => r.join('')).join(''), f: fl}; }
    }
  }
  const g = Array.from({length: NG}, (_, r) => Array.from({length: NG}, (_, c) => (r % 2 && c > 0 && c < 10) || (c % 2 && r > 0 && r < 10) ? '.' : '#').join('')).join('');
  return {g, f: [1 * NG + 1, 5 * NG + 9, 9 * NG + 1]};
}
const cellAt = (x, z) => { const c = Math.round(x / CW + 5), r = Math.round(z / CW + 5); return c < 0 || r < 0 || c >= NG || r >= NG ? -1 : r * NG + c; };
function solidsNear(g, x, z) {
  const c0 = Math.round(x / CW + 5), r0 = Math.round(z / CW + 5), out = [];
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (c < 0 || r < 0 || c >= NG || r >= NG || g[r * NG + c] === '#') out.push([wx(c) - 1.5, wz(r) - 1.5, wx(c) + 1.5, wz(r) + 1.5]);
  return out;
}
/* Karte des Lotsen: Welt <-> Bildschirm */
function mapGeo() { const s = API.screen(), hh = HW * s.ch / s.cw, z0 = -18 + hh - (132 / s.ch) * 2 * hh; return {s, hh, z0, X: x => (x / HW + 1) / 2 * s.cw, Y: z => ((z - z0) / hh + 1) / 2 * s.ch, wx: sx => (sx / s.cw * 2 - 1) * HW, wz: sy => z0 + (sy / s.ch * 2 - 1) * hh}; }

/* ---------- Walddetails: Trampelpfade, Gras, Farne, Blumen, Pilze, Steine, Stämme, Eulenaugen, Spinnweben ---------- */
function decorRound(T, g, R, K, G, A) {
  const upd = [], r = R.rng(91 + A.r * 7), D = new T.Object3D(), free = (c, q) => c >= 0 && q >= 0 && c < NG && q < NG && G[q * NG + c] !== '#';
  const cells = [], walls = []; for (let i = 0; i < G.length; i++) (G[i] !== '#' ? cells : walls).push(i);
  // ausgetretener Pfad auf allen Wegen
  const pg = new T.PlaneGeometry(3.7, 3.7); pg.rotateX(-Math.PI / 2);
  const pim = new T.InstancedMesh(pg, new T.MeshStandardMaterial({transparent: true, depthWrite: false, roughness: 1, map: R.paint(T, 128, 128, (c, w) => { c.clearRect(0, 0, w, w); const gr = c.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(138,112,80,.62)'); gr.addColorStop(.6, 'rgba(120,98,70,.4)'); gr.addColorStop(1, 'rgba(110,90,64,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w); for (let i = 0; i < 260; i++) { c.fillStyle = Math.random() < .5 ? 'rgba(60,44,30,.25)' : 'rgba(190,160,120,.18)'; c.fillRect(20 + Math.random() * 88, 20 + Math.random() * 88, 2, 2); } })}), cells.length);
  cells.forEach((i, n) => { D.position.set(wx(ic(i)), .012 + (n % 4) * .0015, wz(ir(i))); D.rotation.set(0, r() * 6.28, 0); D.scale.setScalar(1); D.updateMatrix(); pim.setMatrixAt(n, D.matrix); }); pim.frustumCulled = false; pim.receiveShadow = true; g.add(pim);
  // Wegränder: Gras, Farne, Blumen, Steine, Pilze
  const grass = [], fern = [], flow = [], stone = [], mush = [], webs = [];
  for (const i of cells) {
    const c = ic(i), q = ir(i), x = wx(c), z = wz(q);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (free(c + dx, q + dz)) continue;
      for (let k = 0; k < 6; k++) { const a = -1.4 + k * .56 + (r() - .5) * .3, off = 1.2 + r() * .35; grass.push({x: x + dx * off + dz * a, z: z + dz * off + dx * a, s: .6 + r() * .6}); }
      for (let k = 0; k < 2; k++) { const a = (r() - .5) * 2.6, off = 1.5 + r() * .5; fern.push({x: x + dx * off + dz * a, z: z + dz * off + dx * a, s: .8 + r() * .6}); }
      if (r() < .45) { const a = (r() - .5) * 2.4; flow.push({x: x + dx * 1.15 + dz * a, z: z + dz * 1.15 + dx * a, s: .5 + r() * .35}); }
      if (r() < .4) { const a = (r() - .5) * 2.6; stone.push({x: x + dx * 1.3 + dz * a, z: z + dz * 1.3 + dx * a, s: .12 + r() * .34}); }
      if (r() < .22) { const a = (r() - .5) * 2.4; for (let k = 0; k < 3; k++) mush.push({x: x + dx * 1.3 + dz * a + (r() - .5) * .3, z: z + dz * 1.3 + dx * a + (r() - .5) * .3, s: .9 + r() * .8}); }
      if (r() < .07) webs.push({x: x + dx * 1.45, z: z + dz * 1.45, ry: dx ? Math.PI / 2 : 0});
    }
    if (r() < .6) grass.push({x: x + (r() - .5) * 2, z: z + (r() - .5) * 2, s: .35 + r() * .3});
  }
  g.add(R.plants(T, 'grass', grass, {w: 1, h: .75, seed: 4 + A.r})); g.add(R.plants(T, 'fern', fern, {w: 1.5, h: 1.05, seed: 6 + A.r})); g.add(R.plants(T, 'flower', flow, {w: .9, h: .7, seed: 8 + A.r}));
  g.add(R.stones(T, stone, {seed: 12 + A.r, noShadow: true})); g.add(R.mushrooms(T, mush, {seed: 5 + A.r, glow: 1.1}));
  webs.forEach(w => { const m = R.cobweb(T); m.scale.setScalar(1.7); m.position.set(w.x, 1.9, w.z); m.rotation.y = w.ry; m.material.opacity = .4; g.add(m); });
  // umgestürzte Stämme, Baumstümpfe und leuchtende Eulenaugen im Dickicht
  const bark = R.pbr(T, 'bark', 3, 1, {roughness: 1}), moss = R.pbr(T, 'bark', 2, 1, {color: 0x7aa860, roughness: 1});
  const inner = walls.filter(i => ic(i) > 0 && ir(i) > 0 && ic(i) < NG - 1 && ir(i) < NG - 1), pickW = () => inner[(r() * inner.length) | 0];
  for (let k = 0; k < 9 && inner.length; k++) { const i = pickW(), l = new T.Mesh(new T.CylinderGeometry(.2, .24, 2.5, 9), k % 2 ? moss : bark); l.position.set(wx(ic(i)) + (r() - .5), .22, wz(ir(i)) + (r() - .5)); l.rotation.set(Math.PI / 2, 0, r() * 3.14); l.castShadow = l.receiveShadow = true; g.add(l); }
  for (let k = 0; k < 10 && inner.length; k++) { const i = pickW(), st = new T.Mesh(new T.CylinderGeometry(.26, .34, .42, 9), bark); st.position.set(wx(ic(i)) + (r() - .5) * 2.2, .21, wz(ir(i)) + (r() - .5) * 2.2); st.castShadow = st.receiveShadow = true; g.add(st); }
  const eyes = [];
  for (let k = 0; k < 9 && inner.length; k++) { const i = pickW(), x = wx(ic(i)) + (r() - .5), y = 2.6 + r() * 2.2, z = wz(ir(i)) + (r() - .5), a = r() * 6.28;
    const pair = [-1, 1].map(sd => { const e = K.sprite(T, 0xffd860, .13, .95); e.material.fog = false; e.position.set(x + Math.cos(a) * .09 * sd, y, z + Math.sin(a) * .09 * sd); g.add(e); return e; }); eyes.push({pair, p: r() * 20, d: 3 + r() * 4}); }
  upd.push(t => eyes.forEach(e => { const k = (t + e.p) % e.d, open = k < .15 ? 0 : k > e.d * .6 && k < e.d * .6 + 1.4 ? 0 : 1; e.pair.forEach(s => { s.scale.set(.13, .13 * (open ? 1 : .08), 1); }); }));
  // Lager am Ziel: Sitzstämme, Topf am Dreibein, Rucksack – und ein Zelt mit Kiste am Start
  const dk = new T.MeshStandardMaterial({color: 0x1c1a1c, roughness: .6, metalness: .5}), add = (geo, m, x, y, z) => { const q = new T.Mesh(geo, m); q.position.set(x, y, z); q.castShadow = q.receiveShadow = true; g.add(q); return q; };
  add(new T.CylinderGeometry(.2, .22, 1.3, 9), bark, EXIT.x - 1.05, .2, EXIT.z + .3).rotation.set(Math.PI / 2, 0, .5); add(new T.CylinderGeometry(.2, .22, 1.2, 9), bark, EXIT.x + 1.1, .2, EXIT.z + .1).rotation.set(Math.PI / 2, 0, -.6);
  for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28, s = add(new T.CylinderGeometry(.018, .018, 1.5, 5), dk, EXIT.x + Math.cos(a) * .3, .7, EXIT.z + Math.sin(a) * .3); s.rotation.set(Math.sin(a) * .42, 0, -Math.cos(a) * .42); }
  add(new T.SphereGeometry(.16, 10, 8, 0, 6.283, Math.PI / 2.4), dk, EXIT.x, .95, EXIT.z); add(new T.BoxGeometry(.4, .5, .26), new T.MeshStandardMaterial({color: 0x6a4a34, roughness: .9}), EXIT.x + .9, .25, EXIT.z - .7).rotation.y = .4;
  const tent = add(new T.ConeGeometry(1, 1.4, 4), new T.MeshStandardMaterial({color: 0x8a7458, roughness: .9, flatShading: true}), START.x - 1, .7, START.z + .95); tent.rotation.y = Math.PI / 4;
  add(new T.BoxGeometry(.5, .4, .4), bark, START.x + .2, .2, START.z + 1.15).rotation.y = .3;
  return upd;
}

function build(T) {
  const K = window.ZL_KIT(API), R = window.ZL_REAL(API), scene = new T.Scene(), cam = new T.PerspectiveCamera(84, 1, .08, 900), top = new T.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  cam.rotation.order = 'YXZ'; scene.add(cam);
  const moonDir = new T.Vector3(.35, .6, -.55).normalize();
  const sky = R.sky(T, {zen: 0x04050e, hor: 0x0e1826, sun: moonDir, sunC: 0xaec4ff, cloud: .4, cloudC: 0x1c2434, stars: 1.2, r: 700}); scene.add(sky);
  scene.fog = new T.FogExp2(0x0a1314, .075);
  const hemi = new T.HemisphereLight(0x53678c, 0x0e120a, .22); scene.add(hemi);
  const moon = R.sun(T, scene, moonDir, 0x9db6ff, .34, {size: 24, map: 1024});
  const gr = new T.Mesh(new T.PlaneGeometry(110, 110), R.pbr(T, 'ground', 34, 34, {roughness: 1})); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; scene.add(gr);
  // Laterne in der Hand des Läufers
  const lan = new T.Group(); lan.position.set(.2, -.3, -.7); lan.scale.setScalar(.55);
  const iron = new T.MeshStandardMaterial({color: 0x1c1a1c, roughness: .6, metalness: .6});
  for (const y of [-.11, .11]) { const p = new T.Mesh(new T.CylinderGeometry(.075, .075, .02, 8), iron); p.position.y = y; lan.add(p); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .78, p = new T.Mesh(new T.CylinderGeometry(.007, .007, .22, 4), iron); p.position.set(Math.cos(a) * .068, 0, Math.sin(a) * .068); lan.add(p); }
  const hd = new T.Mesh(new T.TorusGeometry(.05, .006, 6, 14, Math.PI), iron); hd.position.y = .12; lan.add(hd);
  lan.add(new T.Mesh(new T.SphereGeometry(.042, 10, 8), new T.MeshBasicMaterial({color: 0xffd9a0})));
  const lsp = K.sprite(T, 0xffb060, .5, .7); lan.add(lsp); cam.add(lan);
  const lamp = new T.PointLight(0xffb468, 1.5, 16, 1.5); scene.add(lamp);
  const lampG = K.sprite(T, 0xffb060, 4, 0); lampG.material.fog = false; scene.add(lampG);
  // Glühwürmchen
  const FN = 130, fpos = new Float32Array(FN * 3), fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(fpos, 3));
  const flies = new T.Points(fg, new T.PointsMaterial({color: 0xd6ff9a, size: .16, map: K.glowTex(T), transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending})); flies.frustumCulled = false; scene.add(flies);
  const fdat = Array.from({length: FN}, () => ({x: rnd(-17, 17), y: rnd(.4, 2.6), z: rnd(-17, 17), p: rnd(0, 6), s: rnd(.4, 1.1)}));
  // Lichtsäule des Lotsen
  const pil = new T.Mesh(new T.CylinderGeometry(.42, .42, 70, 14, 1, true), new T.MeshBasicMaterial({color: 0xffd890, transparent: true, opacity: .34, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false})); pil.position.y = 35; pil.visible = false; scene.add(pil);
  const pilG = K.sprite(T, 0xffd890, 5, .6); pilG.material.fog = false; pilG.visible = false; scene.add(pilG);
  // Bodennebel und fallendes Laub
  const mist = R.mist(T, 28, {box: [-18, .25, -18, 18, 1.3, 18], color: 0x9ab8b0, op: .055, size: 4.5, speed: .35, seed: 5}); scene.add(mist);
  const leaves = R.motes(T, 90, {box: [-17, 0, -17, 17, 7, 17], color: 0xc88a40, size: .1, op: .9, fall: .45, sway: .7, normal: true, seed: 7}); scene.add(leaves);
  return {scene, cam, top, sky, hemi, moon, lamp, lampG, lan, lsp, flies, fdat, pil, pilG, mist, leaves, round: -1, grp: null};
}
function buildRound(T, M, A) {
  const K = window.ZL_KIT(API), R = window.ZL_REAL(API), g = new T.Group(), G = grid(A), rr2 = R.rng(17 + A.r * 31), trees = [], bush = [];
  for (let r = -3; r < NG + 3; r++) for (let c = -3; c < NG + 3; c++) {
    const inside = c >= 0 && r >= 0 && c < NG && r < NG; if (inside && G[r * NG + c] !== '#') continue;
    const n = inside ? 3 : 2;
    for (let i = 0; i < n; i++) trees.push({x: wx(c) + (rr2() - .5) * 1.9, z: wz(r) + (rr2() - .5) * 1.9, s: .95 + rr2() * .45});
    if (inside) for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + rr2(), d = .55 + rr2() * .5; bush.push({x: wx(c) + Math.cos(a) * d, z: wz(r) + Math.sin(a) * d, s: .6 + rr2() * .45}); }
  }
  g.add(R.forest(T, trees, {seed: 3 + A.r, high: 3.4, wide: 1.25})); g.add(R.bushes(T, bush, {seed: 8 + A.r}));
  // Morast: sieht nur der Lotse
  const haz = new T.Group();
  for (let i = 0; i < G.length; i++) if (G[i] === 'm') {
    const m = new T.Mesh(new T.CircleGeometry(1.3, 20), new T.MeshBasicMaterial({color: 0x8a2a22, transparent: true, opacity: .9, fog: false})); m.rotation.x = -Math.PI / 2; m.position.set(wx(ic(i)), .05, wz(ir(i))); haz.add(m);
    const m2 = new T.Mesh(new T.RingGeometry(1.3, 1.5, 20), new T.MeshBasicMaterial({color: 0xff7a60, fog: false, side: T.DoubleSide})); m2.rotation.x = -Math.PI / 2; m2.position.set(wx(ic(i)), .06, wz(ir(i))); haz.add(m2);
  }
  g.add(haz);
  // Sternblumen
  const fl = flowers(A).map((i, n) => {
    const f = new T.Group(); f.position.set(wx(ic(i)), 0, wz(ir(i)));
    const st = new T.Mesh(new T.CylinderGeometry(.025, .035, .7, 6), new T.MeshStandardMaterial({color: 0x3a7a4a, roughness: .8})); st.position.y = .35; f.add(st);
    const pm = new T.MeshStandardMaterial({color: 0xcfe6ff, emissive: 0x8fc4ff, emissiveIntensity: 1.1, roughness: .4}), head = new T.Group(); head.position.y = .74;
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, p = new T.Mesh(new T.SphereGeometry(.11, 8, 6), pm); p.scale.set(1.5, .35, .7); p.position.set(Math.cos(a) * .15, 0, Math.sin(a) * .15); p.rotation.y = -a; head.add(p); }
    head.add(new T.Mesh(new T.SphereGeometry(.07, 8, 6), new T.MeshBasicMaterial({color: 0xfff2b0}))); f.add(head);
    const sp = K.sprite(T, 0x9fd0ff, 2.6, .7); sp.position.y = .78; f.add(sp);
    const pl = new T.PointLight(0x9fd0ff, .9, 7, 1.5); pl.position.y = 1; f.add(pl);
    g.add(f); return {f, head, sp, n};
  });
  // Lagerfeuer am Ziel, Laternenpfahl am Start
  const camp = new T.Group(); camp.position.set(EXIT.x, 0, EXIT.z);
  const logM = R.pbr(T, 'bark', 1, 1, {roughness: 1});
  for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.CylinderGeometry(.07, .08, .8, 6), logM); l.position.y = .16; l.rotation.set(Math.PI / 2 - .5, i * Math.PI / 2 + .4, 0); camp.add(l); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, s = R.rock(T, .15, i + 3); s.position.set(Math.cos(a) * .55, .05, Math.sin(a) * .55); s.castShadow = false; camp.add(s); }
  const fire = [0xff8a30, 0xffd070].map((c, i) => { const s = K.sprite(T, c, i ? .7 : 1.3, .95); s.position.y = i ? .42 : .5; camp.add(s); return s; });
  const fireL = new T.PointLight(0xff8a40, 1.7, 17, 1.4); fireL.position.y = 1; camp.add(fireL);
  const tent = new T.Mesh(new T.ConeGeometry(1.1, 1.5, 4), new T.MeshStandardMaterial({color: 0x9a7a5a, roughness: .9, flatShading: true})); tent.position.set(-.2, .75, -1); tent.rotation.y = Math.PI / 4; tent.castShadow = true; camp.add(tent);
  g.add(camp);
  const post = new T.Group(); post.position.set(START.x + 1.05, 0, START.z + .9);
  const pp = new T.Mesh(new T.CylinderGeometry(.04, .05, 1.9, 6), logM); pp.position.y = .95; post.add(pp);
  const pb = new T.Mesh(new T.SphereGeometry(.09, 8, 6), new T.MeshBasicMaterial({color: 0xffd9a0})); pb.position.y = 1.95; post.add(pb);
  const pg = K.sprite(T, 0xffb060, 1.6, .7); pg.position.y = 1.95; post.add(pg); g.add(post);
  const upd = decorRound(T, g, R, K, G, A);
  M.scene.add(g);
  return {g, haz, fl, fire, fireL, upd};
}

const wald = {
  id: 'wald', n: 'Nebelwald', ic: '✿', t3: 210, t2: 360, ctrl: 'fps', three: true, noClamp: true, cross: false, isNew: true, eAngle: [0],
  staticAux: ['g0', 'g1', 'f0', 'f1'],
  noStick: () => S.aux.w !== API.me,
  skinName: () => 'Ich-Perspektive · Läufer und Lotse',
  h: k => `Dunkler Wald, dichter Nebel. Zuerst läuft ${nm('a')} mit der Laterne los, ${nm('d')} sieht den ganzen Wald von oben und lotst per Stimme: „links, geradeaus, stopp!“ Findet drei Sternblumen und dann das Lagerfeuer. Den tückischen Morast sieht nur der Lotse. Danach tauscht ihr die Rollen – in einem neuen Wald.`,
  ctrlText: () => 'Läufer: linker Daumen laufen, rechter Daumen umsehen. Lotse: Tippe auf einen Weg, um dort eine Lichtsäule zu setzen.',
  start: () => ({x: START.x * U, y: START.z * U}),
  countText: () => `${S.aux.w === API.me ? 'Du läufst' : 'Du lotst'} · ✿ ${[0, 1, 2].filter(i => S.aux.got >> i & 1).length}/3`,
  setup() { const a = mkForest(), b = mkForest(); S.aux = {r: 0, w: 'a', g0: a.g, g1: b.g, f0: a.f, f1: b.f, got: 0, ping: null, sw: 0, hz: 0}; S.total = 8; },
  posExtra: () => LOC.fp ? [Math.round(LOC.fp.yaw * 100) / 100] : null,
  onTeleport() { if (LOC.fp) { LOC.fp.yaw = 0; LOC.fp.pitch = 0; } },
  move(dt, inp) {
    const A = S.aux, f = inp.fps, R = window.ZL_REAL(API); if (!f || !A.g0) return;
    if (A.w === API.me) {
      if (A.sw) return;
      const st = R.fp(LOC, 0); R.look(st, f);
      const d = R.step(st, f, 3.4, dt), p = {x: mine.x / U + d.dx, z: mine.y / U + d.dz};
      R.push(p, solidsNear(grid(A), p.x, p.z), .45); mine.x = p.x * U; mine.y = p.z * U;
    } else {
      const mg = mapGeo(), G = grid(A);
      for (const tp of f.taps) {
        const i = cellAt(mg.wx(tp.x), mg.wz(tp.y)); if (i < 0) continue;
        if (G[i] === '#') { toast('Dort stehen Bäume – tippe auf einen Weg.'); continue; }
        act({k: 'ping', i}); API.tone(880, .3, .04);
      }
    }
  },
  action(k, d) {
    const A = S.aux; if (d.k !== 'ping' || k === A.w || A.sw) return;
    const i = d.i | 0; if (i < 0 || i >= NG * NG || grid(A)[i] === '#') return;
    A.ping = {i, t: Math.round(S.t * 10) / 10}; emit({k: 'tick', o: k, x: 0, y: 0});
  },
  update() {
    const A = S.aux, w = A.w, G = grid(A);
    if (A.sw) {
      if (S.t < A.sw) return;
      A.r = 1; A.w = 'd'; A.got = 0; A.ping = null; A.sw = 0;
      for (const k of ['a', 'd']) teleport(k, START.x * U, START.z * U);
      emit({k: 'toast', txt: `Rollentausch! Jetzt läuft ${nm('d')}, und ${nm('a')} lotst.`}); return;
    }
    if (A.ping && S.t - A.ping.t > 16) A.ping = null;
    const p = S.p[w], x = p.x / U, z = p.y / U, i = cellAt(x, z);
    if (i >= 0 && G[i] === 'm' && S.t > A.hz && Math.hypot(x - wx(ic(i)), z - wz(ir(i))) < 1.3) {
      A.hz = S.t + 1.5; teleport(w, START.x * U, START.z * U); emit({k: 'drop', x: 0, y: 0}); emit({k: 'toast', txt: `Platsch – ${nm(w)} ist im Morast versunken und steht wieder am Start.`}); return;
    }
    flowers(A).forEach((fi, n) => {
      if (A.got >> n & 1 || Math.hypot(x - wx(ic(fi)), z - wz(ir(fi))) > 1.4) return;
      A.got |= 1 << n; S.count++; emit({k: 'lit'}); const c = [0, 1, 2].filter(q => A.got >> q & 1).length;
      emit({k: 'toast', txt: c < 3 ? `Sternblume ${c} von 3 gefunden!` : 'Alle drei Sternblumen! Jetzt zum Lagerfeuer.'});
    });
    if (A.got === 7 && Math.hypot(x - EXIT.x, z - EXIT.z) < 1.7) {
      S.count++;
      if (A.r === 0) { A.sw = S.t + 3.4; emit({k: 'round', x: 0, y: 0}); emit({k: 'toast', txt: 'Am Lagerfeuer angekommen! Gleich tauscht ihr die Rollen …'}); }
      else { emit({k: 'goal', x: 0, y: 0}); finish(2.6); }
    }
  },
  render3d(t, part) {
    const T = window.THREE, K = window.ZL_KIT(API), R = window.ZL_REAL(API), sc = API.screen(), A = S.aux;
    if (!A.g0 || !A.g1) return;
    if (!LOC.M) { LOC.M = build(T); LOC.__dispose = () => API.disposeTree(LOC.M.scene); }
    const M = LOC.M, me = API.me, ot = API.other, walker = A.w === me, G = grid(A), now = hostNow();
    const dt = Math.min(.05, Math.max(0, t - (M.lt || t))); M.lt = t;
    if (M.round !== A.r) { if (M.rd) { M.scene.remove(M.rd.g); API.disposeTree(M.rd.g); } M.rd = buildRound(T, M, A); M.round = A.r; }
    const D = M.rd, st = R.fp(LOC, 0);
    const wp = walker ? {x: mine.x / U, z: mine.y / U, yaw: st.yaw} : {x: part.x / U, z: part.y / U, yaw: part.e ? part.e[0] : 0};
    // Blumen, Feuer, Glühwürmchen, Lichtsäule
    D.fl.forEach(f => { const got = A.got >> f.n & 1; f.f.visible = !got; f.head.rotation.y = t * .6; f.sp.material.opacity = .55 + Math.sin(t * 3 + f.n) * .18; });
    const fk = 1 + Math.sin(t * 13) * .1 + Math.sin(t * 29) * .06; D.fire[0].scale.set(1.3 * fk, 1.6 * fk, 1); D.fire[1].scale.set(.7 * fk, .95 * fk, 1); D.fireL.intensity = 1.6 * fk;
    D.upd.forEach(f => f(t, dt)); M.mist.userData.upd(t, dt); M.leaves.userData.upd(t); M.mist.visible = M.leaves.visible = walker;
    const fp = M.flies.geometry.attributes.position; M.fdat.forEach((f, i) => fp.setXYZ(i, f.x + Math.sin(t * f.s + f.p) * 1.1, f.y + Math.sin(t * f.s * 1.7 + f.p) * .4, f.z + Math.cos(t * f.s * .8 + f.p) * 1.1)); fp.needsUpdate = true;
    const pg = A.ping; M.pil.visible = M.pilG.visible = !!pg;
    if (pg) { const px = wx(ic(pg.i)), pz = wz(ir(pg.i)); M.pil.position.set(px, 35, pz); M.pil.material.opacity = .28 + Math.sin(t * 5) * .08; M.pilG.position.set(px, 1.2, pz); }
    // Laterne des Läufers
    const fl = 1 + Math.sin(t * 9) * .05 + Math.sin(t * 21) * .03;
    M.lamp.position.set(wp.x - Math.sin(wp.yaw) * .5, 1.5, wp.z - Math.cos(wp.yaw) * .5); M.lamp.intensity = 1.5 * fl;
    M.lsp.material.opacity = .65 * fl; M.lan.visible = walker; M.lan.position.y = -.3 + Math.sin(st.bob) * .012 * Math.min(1, st.mv); M.lan.rotation.z = Math.sin(st.bob * .5) * .06 * Math.min(1, st.mv);
    R.sunAt(M.moon, wp.x, 0, wp.z); M.sky.userData.u.tm.value = t;
    let cam;
    if (walker) {
      M.scene.fog.density = .075; M.hemi.intensity = .22; M.moon.intensity = .34; D.haz.visible = false; M.lampG.material.opacity = 0;
      cam = M.cam; cam.position.set(wp.x, 1.6 + Math.sin(st.bob) * .035 * Math.min(1, st.mv), wp.z); cam.rotation.set(st.pitch, st.yaw, 0);
      cam.aspect = sc.cw / sc.ch; cam.fov = sc.cw < sc.ch ? 86 : 64; cam.updateProjectionMatrix(); M.sky.position.copy(cam.position);
    } else {
      const mg = mapGeo(); M.scene.fog.density = 0; M.hemi.intensity = 1.5; M.moon.intensity = .7; D.haz.visible = true;
      M.lampG.position.set(wp.x, 9, wp.z); M.lampG.material.opacity = .55;
      cam = M.top; cam.left = -HW; cam.right = HW; cam.top = mg.hh; cam.bottom = -mg.hh; cam.updateProjectionMatrix();
      cam.position.set(0, 100, mg.z0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, mg.z0); M.sky.position.set(0, -2000, 0);
    }
    cam.updateMatrixWorld();
    API.render3D(M.scene, cam, {bloom: walker ? .8 : .45, th: .72});
    // ---------- Anzeige ----------
    const swap = A.sw && now < A.sw;
    if (walker) {
      if (S.phase === 'play' || S.phase === 'count') {
        const n = [0, 1, 2].filter(i => A.got >> i & 1).length;
        R.note(swap ? 'Geschafft! Gleich tauscht ihr die Rollen …' : n < 3 ? `Du läufst: Finde die drei Sternblumen (${n}/3). ${nm(ot)} sieht den Wald von oben und lotst dich. Den Morast siehst nur ${nm(ot)}!` : `Alle Sternblumen! Jetzt zum Lagerfeuer – ${nm(ot)} zeigt dir den Weg.`, 64);
        if (pg) { // Pfeil zur Lichtsäule
          const dx = wx(ic(pg.i)) - wp.x, dz = wz(ir(pg.i)) - wp.z, fc = dx * -Math.sin(st.yaw) + dz * -Math.cos(st.yaw), rc = dx * Math.cos(st.yaw) - dz * Math.sin(st.yaw), ang = Math.atan2(rc, fc);
          ctx.save(); ctx.translate(sc.cw / 2, sc.ch - 210); ctx.fillStyle = 'rgba(12,9,26,.6)'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(CG, .6); ctx.lineWidth = 1.5; ctx.stroke();
          ctx.rotate(ang); ctx.fillStyle = rgba(CG, 1); ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(9, 9); ctx.lineTo(0, 3); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.restore();
          label(`Lichtsäule · ${Math.round(Math.hypot(dx, dz))} m`, sc.cw / 2, sc.ch - 168, CG, 13, 700);
        }
      }
      return;
    }
    // Lotse: Markierungen auf der Karte
    const mg = mapGeo(), X = mg.X, Y = mg.Y, px = HW * 2 / sc.cw; void px;
    ctx.fillStyle = 'rgba(8,14,12,.5)'; rr(X(-17.4), Y(-17.4), X(17.4) - X(-17.4), Y(17.4) - Y(-17.4), 10); ctx.fill(); ctx.strokeStyle = 'rgba(243,201,143,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    const cpx = X(1.5) - X(-1.5);
    for (let i = 0; i < G.length; i++) if (G[i] !== '#') { ctx.fillStyle = G[i] === 'm' ? 'rgba(170,50,40,.85)' : 'rgba(214,196,150,.5)'; ctx.fillRect(X(wx(ic(i))) - cpx / 2 - .5, Y(wz(ir(i))) - cpx / 2 - .5, cpx + 1, cpx + 1); }
    for (let i = 0; i < G.length; i++) if (G[i] === 'm') { const x = X(wx(ic(i))), y = Y(wz(ir(i))); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
    flowers(A).forEach((fi, n) => { const x = X(wx(ic(fi))), y = Y(wz(ir(fi))), got = A.got >> n & 1; ctx.globalAlpha = got ? .35 : 1; API.glow(x, y, 22 + Math.sin(t * 4 + n) * 3, [160, 210, 255], got ? .2 : .7); ctx.fillStyle = '#eaf4ff'; ctx.font = '700 20px Karla, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(got ? '✓' : '✿', x, y + 1); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1; });
    { const x = X(EXIT.x), y = Y(EXIT.z); API.glow(x, y, 26, [255, 150, 70], .8); label('Lagerfeuer', x, y - 18, [255, 200, 140], 12, 700); const sx = X(START.x), sy = Y(START.z); label('Start', sx, sy + 26, [230, 220, 240], 12, 700); }
    if (pg) { const x = X(wx(ic(pg.i))), y = Y(wz(ir(pg.i))), k = (t * 1.2) % 1; ctx.strokeStyle = rgba(CG, 1 - k); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 8 + k * 16, 0, TAU); ctx.stroke(); ctx.fillStyle = rgba(CG, 1); ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }
    { const x = X(wp.x), y = Y(wp.z); ctx.save(); ctx.translate(x, y); ctx.rotate(-wp.yaw); ctx.fillStyle = rgba(COL[A.w], 1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 9); ctx.lineTo(0, 4); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); K.nameTag(nm(A.w), x, y - 18, COL[A.w]); }
    if (S.phase === 'play' || S.phase === 'count') {
      R.note(swap ? 'Geschafft! Gleich tauscht ihr die Rollen …' : `Du lotst: Führe ${nm(A.w)} zu den Sternblumen ✿ und dann zum Lagerfeuer. Warne vor dem Morast ✕ – den sieht ${nm(A.w)} nicht!`, 64);
      R.note('Tippe auf einen Weg: Dort erscheint eine Lichtsäule, die auch im Nebel zu sehen ist.', Y(17.4) + 14, {size: 13});
    }
  }
};
return [wald];
});
