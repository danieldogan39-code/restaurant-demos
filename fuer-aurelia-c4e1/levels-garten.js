/* Zwei Lichter – Irrgarten v2 (ab 8.2)
   Prinzessin und Prinz im Heckengarten des alten Schlosses bei Mondschein.
   Neu: Wischen ohne Absetzen, Kurven werden weich geschnitten, höhere Kamera, Mondlicht mit Schatten,
   Pflaster und Hecken mit Relief, Schloss und Bäume ringsum – und unter den Lichtpunkten liegt ein Bild,
   das ihr Feld für Feld freilauft. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CA, CG, rgba, dist, rnd, clamp, nm, emit, finish, teleport, hostNow, rr, heartPath, mine, speedMul} = API;
const KIT = () => window.ZL_KIT(API), REAL = () => window.ZL_REAL(API), FOTO = window.ZL_FOTO;
const MAZE = [
  '#####################',
  '#o..#...#...#...#..o#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.#...#...#...#...#.#',
  '#.#######.#.#######.#',
  '#...#...........#...#',
  '#.#.#.#########.#.#.#',
  '#.#.#.#...#...#.#.#.#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.....#.#...#.#.....#',
  '#.#####.#.#.#.#####.#',
  '#.#...............#.#',
  '#.#.#.##.....##.#.#.#',
  '#.#.#.....G.....#.#.#',
  '#.#.###.......###.#.#',
  '#.....#.......#.....#',
  '#####.###.#.###.#####',
  '#...#...........#...#',
  '#.#.#####.#.#####.#.#',
  '#.#...#...#...#...#.#',
  '#.#.#.#.#####.#.#.#.#',
  '#...#.#.......#.#...#',
  '#.###.###.#.###.###.#',
  '#...#...#.#.#...#...#',
  '#.#.###.#.#.#.###.#.#',
  '#o.................o#',
  '#####################'];
const MC = 52, MX0 = 14, MY0 = 160, NC = 21, NR = 27, WH = 2.4;
const inRoom = (c, r) => r >= 11 && r <= 15 && c >= 7 && c <= 13;
const cen = (c, r) => ({x: MX0 + c * MC + MC / 2, y: MY0 + r * MC + MC / 2});
const mopen = (c, r) => r >= 0 && r < NR && c >= 0 && c < NC && MAZE[r][c] !== '#';
const cellOf = p => ({c: Math.round((p.x - MX0 - MC / 2) / MC), r: Math.round((p.y - MY0 - MC / 2) / MC)});
const DX = {l: -1, r: 1, u: 0, d: 0}, DY = {l: 0, r: 0, u: -1, d: 1}, OPP = {l: 'r', r: 'l', u: 'd', d: 'u'};
const mazeStart = k => cen(k === 'a' ? 8 : 12, 25);
const MX = px => (px - MX0) / MC * 2 - NC, MZ = py => (py - MY0) / MC * 2 - NR;
const X3 = c => 2 * c - (NC - 1), Z3 = r => 2 * r - (NR - 1);
const dirOf = (x, y) => Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : (y > 0 ? 'd' : 'u');

/* ---------- Steuerung: irgendwo wischen – ohne abzusetzen in die nächste Richtung weiterwischen ---------- */
function readPad(inp) {
  const P = inp.pad; if (!P) return null; let w = null;
  for (const T of P.tp) {
    if (T.ax == null) { T.ax = T.sx; T.ay = T.sy; }
    const dx = T.x - T.ax, dy = T.y - T.ay;
    if (Math.hypot(dx, dy) > 20) { w = dirOf(dx, dy); T.ax = T.x; T.ay = T.y; T.sw = 1; }
  }
  for (const tp of P.taps) { const m = LOC.meScr || {x: P.cw / 2, y: P.ch * .55}; if (Math.hypot(tp.x - m.x, tp.y - m.y) > 24) w = dirOf(tp.x - m.x, tp.y - m.y); }
  if (P.tilt && Math.hypot(P.tilt.x, P.tilt.y) > .45) w = dirOf(P.tilt.x, P.tilt.y);
  for (const [k1, k2, d] of [['arrowleft', 'a', 'l'], ['arrowright', 'd', 'r'], ['arrowup', 'w', 'u'], ['arrowdown', 's', 'd']]) if (P.key(k1) || P.key(k2)) w = d;
  return w;
}

const irrgarten = {
  id: 'irrgarten', n: 'Irrgarten', ic: '•', t3: 170, t2: 260, ctrl: 'pad', padIcon: 'swipe', noClamp: true, three: true, hidePlayers: true, hideNames: true, foto: 'm1',
  skinName: () => `Prinzessin ${nm('a')} · Prinz ${nm('d')}`,
  ctrlText: () => 'Wische in die Richtung, in die du laufen willst – du läufst von selbst weiter. Für die nächste Abzweigung einfach weiterwischen, ohne den Finger abzusetzen.',
  h: () => `Prinzessin ${nm('a')} und Prinz ${nm('d')} im Heckengarten des alten Schlosses: Sammelt gemeinsam alle Lichtpunkte. Unter ihnen liegt ein Bild – auf der Karte oben rechts seht ihr, was ihr schon freigelaufen habt. Vier Regenwolken streifen durch die Gänge; die leuchtenden Herzen in den Ecken lassen sie ein paar Sekunden vor euch fliehen. Teilt euch auf!`,
  start: k => mazeStart(k),
  note: () => `Bild freigelaufen in ${API.fmt(S.lastTime || (S.t - S.lt))}`,
  setup() {
    let dots = '', total = 0;
    for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) { const ch = MAZE[r][c]; if (ch === '.' && !inRoom(c, r)) { dots += '1'; total++; } else if (ch === 'o') { dots += '2'; total++; } else dots += '0'; }
    const pen = cen(10, 13);
    S.aux = {dots, power: 0, pen, cl: [0, 1, 2, 3].map(i => ({id: i, x: pen.x, y: pen.y, dir: null, lc: '', wait: S.t + 2 + i * 2.5}))};
    S.total = total;
  },
  move(dt, inp) {
    const g = LOC.g || (LOC.g = {dir: null, want: null, wt: 0});
    const w = readPad(inp);
    if (w) { g.want = w; g.wt = 1.6; } else if (g.want && g.want !== g.dir) { g.wt -= dt; if (g.wt <= 0) g.want = g.dir; }
    const sp = 215 * speedMul() * dt, {c, r} = cellOf(mine), cc = cen(c, r), TOL = 12;
    if (g.want && g.dir && g.want === OPP[g.dir]) g.dir = g.want;
    if (!g.dir && g.want && mopen(c + DX[g.want], r + DY[g.want])) g.dir = g.want;
    if (g.dir) {
      const dx = DX[g.dir], dy = DY[g.dir], along = (cc.x - mine.x) * dx + (cc.y - mine.y) * dy;
      // abbiegen, sobald die Abzweigung nah genug ist – die Ecke wird weich geschnitten
      if (g.want && g.want !== g.dir && g.want !== OPP[g.dir] && Math.abs(along) <= Math.max(TOL, sp) && mopen(c + DX[g.want], r + DY[g.want])) g.dir = g.want;
      else if (!mopen(c + dx, r + dy) && along <= sp) { if (dx) mine.x = cc.x; else mine.y = cc.y; g.dir = (g.want && g.want !== g.dir && mopen(c + DX[g.want], r + DY[g.want])) ? g.want : null; }
    }
    if (g.dir) {
      const dx = DX[g.dir], dy = DY[g.dir];
      mine.x += dx * sp; mine.y += dy * sp;
      if (dx) mine.y += clamp(cc.y - mine.y, -sp, sp); else mine.x += clamp(cc.x - mine.x, -sp, sp);
    } else { mine.x += clamp(cc.x - mine.x, -sp, sp); mine.y += clamp(cc.y - mine.y, -sp, sp); }
  },
  onTeleport() { LOC.g = null; },
  update(dt) {
    const A = S.aux, pw = A.power > S.t;
    for (const k of ['a', 'd']) {
      const p = S.p[k], {c, r} = cellOf(p);
      if (c < 0 || r < 0 || c >= NC || r >= NR) continue;
      const i = r * NC + c, v = A.dots[i];
      if (v !== '1' && v !== '2') continue;
      const cc = cen(c, r);
      if (Math.abs(p.x - cc.x) > 21 || Math.abs(p.y - cc.y) > 21) continue;
      A.dots = A.dots.slice(0, i) + '0' + A.dots.slice(i + 1); S.count++;
      if (v === '2') { A.power = S.t + 8; emit({k: 'power', x: cc.x, y: cc.y}); emit({k: 'toast', txt: 'Ein Herz! Die Wolken fliehen – jetzt könnt ihr sie verscheuchen.'}); }
      else emit({k: 'dot', o: k});
    }
    const spd = (pw ? 95 : 128 + 40 * S.count / S.total) * API.diff() * dt;
    for (const cl of A.cl) {
      if (S.t < cl.wait) continue;
      const {c, r} = cellOf(cl), cc = cen(c, r), key = c + ',' + r;
      if (!cl.dir || (key !== cl.lc && Math.abs(cl.x - cc.x) + Math.abs(cl.y - cc.y) <= spd + .01)) {
        cl.x = cc.x; cl.y = cc.y; cl.lc = key;
        let opts = ['u', 'd', 'l', 'r'].filter(d => mopen(c + DX[d], r + DY[d]) && d !== OPP[cl.dir]);
        if (!opts.length) opts = ['u', 'd', 'l', 'r'].filter(d => mopen(c + DX[d], r + DY[d]));
        const tgt = dist(S.p.a, cl) < dist(S.p.d, cl) ? S.p.a : S.p.d;
        let best = opts[0];
        if (Math.random() < .25) best = opts[(Math.random() * opts.length) | 0];
        else { let bs = Infinity; for (const d of opts) { const dd = Math.hypot(cc.x + DX[d] * MC - tgt.x, cc.y + DY[d] * MC - tgt.y), s = pw ? -dd : dd; if (s < bs) { bs = s; best = d; } } }
        cl.dir = best;
      }
      cl.x += DX[cl.dir] * spd; cl.y += DY[cl.dir] * spd;
      for (const k of ['a', 'd']) {
        const p = S.p[k];
        if (dist(p, cl) >= 34) continue;
        if (pw) { cl.x = A.pen.x; cl.y = A.pen.y; cl.dir = null; cl.lc = ''; cl.wait = S.t + 3; emit({k: 'poof', x: p.x, y: p.y}); break; }
        if (p.inv <= 0) { const s = mazeStart(k); emit({k: 'caught', x: p.x, y: p.y, o: k}); teleport(k, s.x, s.y); p.inv = 2.5; emit({k: 'toast', txt: `Eine Wolke hat ${nm(k)} erwischt – zurück zum Start.`}); }
      }
    }
    if (S.count >= S.total) finish(6.5);
  }
};

/* ---------- Der Garten in 3D ---------- */
function xrayMat(mat, U) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uP = U.uP; sh.uniforms.uC = U.uC;
    sh.vertexShader = 'varying vec3 vZW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 zw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        zw = instanceMatrix * zw;
      #endif
      vZW = (modelMatrix * zw).xyz;`);
    sh.fragmentShader = 'uniform vec3 uP; uniform vec3 uC; varying vec3 vZW;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      vec3 seg = uP - uC; float tt = clamp(dot(vZW - uC, seg) / dot(seg, seg), 0.0, 1.0);
      float dd = length(vZW - (uC + seg * tt));
      if (tt < .93 && dd < 1.3) discard;`);
  };
  return mat;
}
function buildMaze(T) {
  const K = KIT(), R = REAL(), scene = new T.Scene(), U = {uP: {value: new T.Vector3()}, uC: {value: new T.Vector3()}}, r0 = R.rng(1408), D = new T.Object3D(), col = new T.Color(), upd = [];
  const moonDir = new T.Vector3(-.42, .62, -.5).normalize();
  scene.fog = new T.FogExp2(0x0d1226, .018);
  const sky = R.sky(T, {zen: 0x04061a, hor: 0x1a2244, sun: moonDir, sunC: 0xb8c4ee, stars: 1, cloud: .45, cloudC: 0x2a3252, r: 400}); scene.add(sky);
  scene.environment = K.env(T, 'maze2', 0x0c1030, 0x222a4c, 0x0a0c12, [[30, 25, -40, 12, 12, 0xb8c4ee], [-30, 8, 20, 30, 6, 0xffc890]]);
  const cam = new T.PerspectiveCamera(62, 1, .1, 520);
  const hemi = new T.HemisphereLight(0x8090d8, 0x141a14, .5); scene.add(hemi);
  const moon = R.sun(T, scene, moonDir, 0xb4c0f4, .9, {size: 22, map: 1024});

  /* Boden: Pflaster im Garten, Wiese drumherum */
  const paveM = R.pbr(T, 'stone', NC * .5, NR * .5, {color: 0x9a98a8, roughness: .8, envMapIntensity: .4});
  const floor = new T.Mesh(new T.PlaneGeometry(NC * 2, NR * 2), paveM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const lawn = new T.Mesh(new T.PlaneGeometry(260, 260), R.pbr(T, 'ground', 46, 46, {color: 0x6c8a5c})); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -.03; lawn.receiveShadow = true; scene.add(lawn);

  /* Hecken mit Blattrelief; jede ein wenig anders hoch und anders grün */
  const lc = R.canvas(256), lg = lc.getContext('2d'); lg.fillStyle = '#143220'; lg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3400; i++) { const v = r0(); lg.fillStyle = v < .4 ? `rgba(66,132,80,${.45 + r0() * .5})` : v < .8 ? 'rgba(18,58,32,.75)' : 'rgba(118,180,112,.5)'; lg.beginPath(); lg.ellipse(r0() * 256, r0() * 256, 2 + r0() * 4.5, 1.5 + r0() * 2.6, r0() * 3, 0, TAU); lg.fill(); }
  const leafT = new T.CanvasTexture(lc), leafN = R.nmap(T, lc, 4.5); leafT.wrapS = leafT.wrapT = T.RepeatWrapping; leafT.anisotropy = 4;
  const walls = []; for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) if (MAZE[r][c] === '#') walls.push([c, r]);
  const hg = new T.BoxGeometry(2, WH, 2, 3, 3, 3), hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), top = y > WH * .49 ? 1 : 0, edge = (Math.abs(x) > .99 ? 1 : 0) + (Math.abs(z) > .99 ? 1 : 0); hp.setXYZ(i, x * (top ? .93 : 1), y - (top && edge ? .16 * edge : 0) + (top && !edge ? .06 : 0), z * (top ? .93 : 1)); }
  hg.computeVertexNormals();
  const hedgeM = xrayMat(new T.MeshStandardMaterial({map: leafT, normalMap: leafN, normalScale: new T.Vector2(1.2, 1.2), roughness: .92, envMapIntensity: .25}), U);
  const wim = new T.InstancedMesh(hg, hedgeM, walls.length);
  walls.forEach(([c, r], i) => { const hh = 1 + ((c * 7 + r * 13) % 5) * .035; D.position.set(X3(c), WH * hh / 2, Z3(r)); D.scale.set(1, hh, 1); D.rotation.set(0, 0, 0); D.updateMatrix(); wim.setMatrixAt(i, D.matrix); const v = .5 + ((c * 5 + r * 11) % 7) * .035; col.setRGB(v * .9, v, v * .95); wim.setColorAt(i, col); });
  wim.castShadow = true; wim.receiveShadow = true; wim.frustumCulled = false; wim.instanceColor.needsUpdate = true; scene.add(wim);
  // Rosen an den Hecken, Lichterketten obenauf
  const faces = []; walls.forEach(([c, r]) => { for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (mopen(c + dc, r + dr)) faces.push([c, r, dc, dr]); });
  const roses = new T.InstancedMesh(new T.IcosahedronGeometry(.085, 1), xrayMat(new T.MeshStandardMaterial({roughness: .6, flatShading: true}), U), faces.length * 2);
  const fairy = new T.InstancedMesh(new T.SphereGeometry(.045, 6, 4), xrayMat(new T.MeshBasicMaterial({color: 0xffffff}), U), faces.length);
  const rc = [0xd85a80, 0xe8b8c4, 0xb8324e, 0xeadfe2].map(c => new T.Color(c)), fc = [0xe8b878, 0xe89ab0, 0xe8d8a8].map(c => new T.Color(c));
  let ri = 0;
  faces.forEach(([c, r, dc, dr], i) => {
    for (let k = 0; k < 2; k++) { const al = rnd(-.8, .8); D.position.set(X3(c) + dc * 1.02 + (dr ? al : 0), rnd(.5, WH - .4), Z3(r) + dr * 1.02 + (dc ? al : 0)); D.scale.setScalar(rnd(.7, 1.3)); D.updateMatrix(); roses.setMatrixAt(ri, D.matrix); roses.setColorAt(ri, rc[(i + k) % 4]); ri++; }
    D.position.set(X3(c) + dc * .96 + (dr ? rnd(-.9, .9) : 0), WH + .02, Z3(r) + dr * .96 + (dc ? rnd(-.9, .9) : 0)); D.scale.setScalar(1); D.updateMatrix(); fairy.setMatrixAt(i, D.matrix); fairy.setColorAt(i, fc[i % 3]);
  });
  roses.frustumCulled = fairy.frustumCulled = false; scene.add(roses); scene.add(fairy);
  // Gras und Blumen am Fuß der Hecken
  const tuft = [], blo = []; faces.forEach(([c, r, dc, dr], i) => { if (i % 3 === 0) { const al = rnd(-.8, .8); (i % 6 ? tuft : blo).push({x: X3(c) + dc * 1.08 + (dr ? al : 0), y: 0, z: Z3(r) + dr * 1.08 + (dc ? al : 0), s: .5 + r0() * .4}); } });
  scene.add(R.plants(T, 'grass', tuft, {w: .7, h: .5, seed: 4})); scene.add(R.plants(T, 'flower', blo, {w: .7, h: .55, seed: 5}));

  /* Laternen an den Kreuzungen */
  const lamps = [], postM = new T.MeshStandardMaterial({color: 0x24262e, metalness: .7, roughness: .4}), junc = [];
  for (let r = 1; r < NR - 1; r++) for (let c = 1; c < NC - 1; c++) { if (!mopen(c, r) || inRoom(c, r)) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => mopen(c + dc, r + dr)).length >= 3) junc.push([c, r]); }
  const LJ = junc.filter((_, i) => i % 2 === 0), posts = new T.InstancedMesh(new T.CylinderGeometry(.045, .075, 2.1, 8), postM, LJ.length), caps = new T.InstancedMesh(new T.ConeGeometry(.2, .18, 6), postM, LJ.length);
  const glass = new T.InstancedMesh(new T.CylinderGeometry(.13, .1, .3, 6), new T.MeshBasicMaterial({color: 0xf0cf9a}), LJ.length), pools = new T.InstancedMesh(new T.CircleGeometry(1.7, 24), new T.MeshBasicMaterial({map: R.softTex(T), color: 0xffb060, transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false}), LJ.length), gpos = [];
  LJ.forEach(([c, r], i) => {
    const x = X3(c) + .74, z = Z3(r) + .74; D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1);
    D.position.set(x, 1.05, z); D.updateMatrix(); posts.setMatrixAt(i, D.matrix); D.position.y = 2.24; D.updateMatrix(); glass.setMatrixAt(i, D.matrix); D.position.y = 2.48; D.updateMatrix(); caps.setMatrixAt(i, D.matrix);
    D.rotation.set(-Math.PI / 2, 0, 0); D.position.set(x - .5, .03, z - .5); D.updateMatrix(); pools.setMatrixAt(i, D.matrix);
    gpos.push(x, 2.24, z); lamps.push({x, z, ph: rnd(0, 6)});
  });
  for (const m of [posts, caps, glass, pools]) { m.frustumCulled = false; scene.add(m); } posts.castShadow = true;
  const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gpos, 3));
  const lglow = new T.Points(gg, new T.PointsMaterial({color: 0xffc27a, size: 1.5, map: R.softTex(T), transparent: true, opacity: .6, depthWrite: false, blending: T.AdditiveBlending})); lglow.frustumCulled = false; scene.add(lglow);
  const lampLights = [0, 1].map(() => { const l = new T.PointLight(0xffb878, 1.2, 8, 1.6); scene.add(l); return l; });

  /* Brunnen in der Mitte – dort wohnen die Wolken */
  const stone = R.pbr(T, 'rock', 2, 1, {color: 0xb0aeb8, roughness: .7});
  const basin = new T.Mesh(new T.TorusGeometry(2.2, .3, 10, 40), stone); basin.rotation.x = Math.PI / 2; basin.position.y = .35; basin.castShadow = true; scene.add(basin);
  const water = new T.Mesh(new T.CircleGeometry(2.1, 40), new T.MeshStandardMaterial({color: 0x24507a, metalness: .6, roughness: .12, envMapIntensity: 1.4})); water.rotation.x = -Math.PI / 2; water.position.y = .42; scene.add(water);
  const fcol = new T.Mesh(new T.CylinderGeometry(.22, .34, 1.6, 12), stone); fcol.position.y = .8; fcol.castShadow = true; scene.add(fcol);
  const bowl = new T.Mesh(new T.SphereGeometry(.75, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), stone); bowl.position.y = 1.72; bowl.castShadow = true; scene.add(bowl);
  const fh = new T.Mesh(K.heartGeo(T, .45, .2), new T.MeshStandardMaterial({color: 0xe8a8bc, emissive: 0xd0608a, emissiveIntensity: .6, roughness: .4})); fh.position.y = 2.3; scene.add(fh);
  const SPN = 90, spos = new Float32Array(SPN * 3), spray = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(spos, 3)), new T.PointsMaterial({color: 0xb8d4f0, size: .08, transparent: true, opacity: .7}));
  spray.userData.p = Array.from({length: SPN}, () => ({t: rnd(0, 1), a: rnd(0, TAU), v: rnd(.8, 1.2)})); scene.add(spray);
  for (const [bx, bz, ry] of [[-4.6, 0, Math.PI / 2], [4.6, 0, -Math.PI / 2]]) { const b = new T.Group(), wood = R.pbr(T, 'wood', 1, 1); const seat = new T.Mesh(new T.BoxGeometry(1.7, .1, .5), wood); seat.position.y = .5; b.add(seat); const backr = new T.Mesh(new T.BoxGeometry(1.7, .5, .08), wood); backr.position.set(0, .85, -.24); b.add(backr); for (const s of [-1, 1]) { const lg2 = new T.Mesh(new T.BoxGeometry(.1, .5, .46), postM); lg2.position.set(s * .75, .25, 0); b.add(lg2); } b.position.set(bx, 0, bz); b.rotation.y = ry; R.shadows(b); scene.add(b); }

  /* Ringsum: Gartenmauer, Bäume, Büsche, Wiesenblumen und das Schloss im Norden */
  const wallM = R.pbr(T, 'stone', 16, 1, {color: 0x8c8a96});
  for (const [x, z, w, d] of [[0, -NR - 2.6, NC * 2 + 6.4, .8], [0, NR + 2.6, NC * 2 + 6.4, .8], [-NC - 2.8, 0, .8, NR * 2 + 6], [NC + 2.8, 0, .8, NR * 2 + 6]]) { const m = new T.Mesh(new T.BoxGeometry(w, 1.3, d), wallM); m.position.set(x, .65, z); m.castShadow = m.receiveShadow = true; scene.add(m); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const urn = new T.Mesh(new T.CylinderGeometry(.5, .32, 1, 10), stone); urn.position.set(sx * (NC + 2.8), 1.8, sz * (NR + 2.6)); scene.add(urn); const fl = R.plants(T, 'flower', [{x: urn.position.x, y: 2.2, z: urn.position.z, s: 1.2}], {w: 1, h: .9, seed: 7}); scene.add(fl); }
  const ring = (n, a, b) => Array.from({length: n}, () => { let x, z; do { x = (r0() - .5) * 2 * b; z = (r0() - .5) * 2 * b; } while ((Math.abs(x) < NC + a && Math.abs(z) < NR + a) || (z < -NR - 20 && Math.abs(x) < 34)); return {x, y: 0, z, s: 1}; });
  scene.add(R.forest(T, ring(90, 9, 95).map(p => (p.s = 1.3 + r0() * 1.4, p)), {seed: 3, noShadow: true, tint: new T.Color(.8, .9, 1)}));
  scene.add(R.bushes(T, ring(70, 4.5, 60).map(p => (p.s = 1 + r0() * 1.3, p)), {seed: 8}));
  scene.add(R.plants(T, 'grass', ring(500, 3.4, 50).map(p => (p.s = .8 + r0() * .9, p)), {w: 1, h: .7, seed: 9}));
  scene.add(R.plants(T, 'flower', ring(160, 3.4, 44).map(p => (p.s = .8 + r0() * .7, p)), {w: 1, h: .75, seed: 10}));
  const castle = new T.Group(), cst = R.pbr(T, 'stone', 6, 3, {color: 0x7c7a8a}), winM = new T.MeshBasicMaterial({color: 0xe8b060}), roofM = new T.MeshStandardMaterial({color: 0x2a2c40, roughness: .8});
  const keep = new T.Mesh(new T.BoxGeometry(44, 20, 14), cst); keep.position.y = 10; castle.add(keep);
  for (const [tx, th, tr] of [[-24, 30, 5], [24, 30, 5], [0, 38, 6], [-11, 24, 3.4], [11, 24, 3.4]]) { const tw = new T.Mesh(new T.CylinderGeometry(tr, tr * 1.08, th, 14), cst); tw.position.set(tx, th / 2, 0); castle.add(tw); const rf = new T.Mesh(new T.ConeGeometry(tr * 1.25, tr * 2.2, 14), roofM); rf.position.set(tx, th + tr * 1.1, 0); castle.add(rf); for (let k = 0; k < 3; k++) if (r0() < .75) { const wn = new T.Mesh(new T.PlaneGeometry(1, 1.8), winM); wn.position.set(tx + (r0() - .5) * tr * .6, th * (.4 + k * .18), tr + .12); castle.add(wn); } }
  for (let k = 0; k < 9; k++) if (k !== 4 && r0() < .8) { const wn = new T.Mesh(new T.PlaneGeometry(1.3, 2.4), winM); wn.position.set(-18 + k * 4.5, 9 + (k % 2) * 4, 7.06); castle.add(wn); }
  const gate = new T.Mesh(new T.PlaneGeometry(4.5, 7), new T.MeshBasicMaterial({color: 0x120c0a})); gate.position.set(0, 3.5, 7.07); castle.add(gate);
  castle.position.set(0, 0, -NR - 46); scene.add(castle);

  /* Lichtpunkte, Herzen mit Lichtsäule */
  const cells = []; for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) if (MAZE[r][c] === '.' && !inRoom(c, r)) cells.push(r * NC + c);
  const dim = new T.InstancedMesh(new T.SphereGeometry(.15, 10, 8), new T.MeshStandardMaterial({color: 0xf0d8a0, emissive: 0xf0b860, emissiveIntensity: 1.05, roughness: .4}), cells.length); dim.frustumCulled = false; scene.add(dim);
  const hearts = {}, hgeo = K.heartGeo(T, .5, .2), hm = new T.MeshStandardMaterial({color: 0xe8809c, emissive: 0xd84a80, emissiveIntensity: .85, metalness: .4, roughness: .3});
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) if (MAZE[r][c] === 'o') {
    const g = new T.Group(); g.position.set(X3(c), 0, Z3(r));
    const m = new T.Mesh(hgeo, hm); m.position.y = 1.1; g.add(m); const hs = K.sprite(T, 0xff9ec4, 3, .45); hs.position.y = 1.1; g.add(hs);
    const beam = new T.Mesh(new T.CylinderGeometry(.3, .55, 26, 16, 1, true), new T.MeshBasicMaterial({color: 0xff9ec4, transparent: true, opacity: .08, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false}));
    beam.position.y = 13; g.add(beam); scene.add(g); hearts[r * NC + c] = {g, m};
  }
  /* Glühwürmchen, Bodennebel, Funken */
  const FN = 170, fpos = new Float32Array(FN * 3), fdat = [];
  for (let i = 0; i < FN; i++) fdat.push({x: rnd(-NC - 8, NC + 8), z: rnd(-NR - 8, NR + 8), y: rnd(.4, 3.2), p: rnd(0, 6), s: rnd(.3, .9)});
  const flies = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(fpos, 3)), new T.PointsMaterial({color: 0xd8f090, size: .14, map: K.glowTex(T), transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
  flies.frustumCulled = false; scene.add(flies);
  const mist = R.mist(T, 22, {box: [-NC - 6, .3, -NR - 6, NC + 6, .9, NR + 6], color: 0x8a94c8, op: .07, size: 6, speed: .5}); scene.add(mist); upd.push(mist.userData.upd);
  const PN = 160, ppos = new Float32Array(PN * 3), pcol = new Float32Array(PN * 3), pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(ppos, 3)); pg.setAttribute('color', new T.BufferAttribute(pcol, 3));
  const sparks = new T.Points(pg, new T.PointsMaterial({size: .13, vertexColors: true, map: K.glowTex(T), transparent: true, depthWrite: false, blending: T.AdditiveBlending})); sparks.frustumCulled = false; scene.add(sparks);
  /* Figuren, eigenes Licht */
  const fig = {a: K.princess(T), d: K.prince(T)}, lights = {};
  for (const k of ['a', 'd']) { scene.add(fig[k]); fig[k].scale.setScalar(1.05); fig[k].traverse(o => { if (o.isMesh) o.castShadow = true; }); if (k === API.me) { lights[k] = new T.PointLight(k === 'a' ? 0xffd6e2 : 0xd6e6ff, .8, 8, 1.5); scene.add(lights[k]); } }
  /* Regenwolken */
  const clouds = [0, 1, 2, 3].map(() => {
    const c = K.cloud(T); c.scale.setScalar(1.05); c.userData.mat.transparent = true; c.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(c);
    const RN = 40, rp = new Float32Array(RN * 6), rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    const rain = new T.LineSegments(rg, new T.LineBasicMaterial({color: 0x9fb8ff, transparent: true, opacity: .5})); rain.frustumCulled = false; scene.add(rain);
    return {c, rain, drops: Array.from({length: RN}, () => ({x: rnd(-.6, .6), z: rnd(-.5, .5), y: rnd(0, 1)})), flash: 0};
  });
  // die Karte mit dem Bild darunter
  const pic = document.createElement('canvas'); pic.width = NC * 16; pic.height = NR * 16;
  return {scene, cam, sky, moon, U, dim, cells, hearts, fig, lights, clouds, hemi, lamps, lampLights, lglow, flies, fdat, upd, sparks, sp: Array.from({length: PN}, () => ({life: 0})), spi: 0,
    spray, fh, pic, picKey: '', last: '', camPos: null, prev: {}, head: {a: 0, d: 0}, endT: 0};
}
/* Karte: Hecken dunkelgrün, freigelaufene Felder zeigen das Bild; am Ende lösen sich die Hecken auf */
function drawPic(M, dots, fade) {
  const g = M.pic.getContext('2d'), F = FOTO.get('m1'), cs = 16, k = F.w / NC;
  g.globalAlpha = 1; g.fillStyle = '#0c1410'; g.fillRect(0, 0, M.pic.width, M.pic.height);
  if (fade > 0 && F.ready) { g.globalAlpha = fade; g.drawImage(F.cv, 0, 0, M.pic.width, M.pic.height); g.globalAlpha = 1; }
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const v = MAZE[r][c], d = dots[r * NC + c], x = c * cs, y = r * cs;
    if (v === '#') { if (fade < 1) { g.globalAlpha = 1 - fade; g.fillStyle = (c + r) % 2 ? '#1f4a2c' : '#1b4227'; g.fillRect(x, y, cs, cs); g.globalAlpha = 1; } continue; }
    const had = v === 'o' || (v === '.' && !inRoom(c, r));
    if (had && d === '0' && F.ready) g.drawImage(F.cv, c * k, r * k, k, k, x, y, cs, cs);
    else if (fade < 1) { g.globalAlpha = 1 - fade; g.fillStyle = '#10161c'; g.fillRect(x, y, cs, cs); if (d === '1') { g.fillStyle = 'rgba(240,200,130,.9)'; g.fillRect(x + cs / 2 - 1.5, y + cs / 2 - 1.5, 3, 3); } g.globalAlpha = 1; }
  }
}
irrgarten.render3d = function (t, part) {
  const T = window.THREE; if (!T || !API.renderer3D()) return;
  const A = S.aux; if (!A.dots || A.dots.length !== NC * NR) return;
  if (!LOC.m3) { LOC.m3 = buildMaze(T); LOC.__dispose = () => API.disposeTree(LOC.m3.scene); FOTO.get('m1'); }
  const M = LOC.m3, K = KIT(), sc = API.screen(), dt = Math.min(.05, M.lt ? t - M.lt : .016); M.lt = t;
  const pw = A.power > hostNow(), o = M.o3 || (M.o3 = new T.Object3D());
  // Punkte und Funken beim Einsammeln
  if (M.last !== A.dots) {
    for (let i = 0; i < A.dots.length && M.last; i++) if (M.last[i] !== '0' && A.dots[i] === '0') {
      const c = i % NC, r = (i / NC) | 0, cl = M.last[i] === '2' ? [1, .5, .7] : [1, .85, .5];
      for (let k = 0; k < 12; k++) { const p = M.sp[M.spi]; M.spi = (M.spi + 1) % M.sp.length; Object.assign(p, {x: X3(c), y: .6, z: Z3(r), vx: rnd(-2, 2), vy: rnd(1.5, 4.2), vz: rnd(-2, 2), life: rnd(.45, .8), c: cl}); }
    }
    for (const i in M.hearts) M.hearts[i].g.visible = A.dots[i] === '2';
    M.last = A.dots;
  }
  M.cells.forEach((i, k) => { const on = A.dots[i] === '1'; o.position.set(X3(i % NC), .6 + Math.sin(t * 2.4 + i) * .07, Z3((i / NC) | 0)); o.scale.setScalar(on ? 1 : 0); o.updateMatrix(); M.dim.setMatrixAt(k, o.matrix); });
  M.dim.instanceMatrix.needsUpdate = true;
  for (const i in M.hearts) { const h = M.hearts[i]; h.m.rotation.y = t * 2; h.m.position.y = 1.1 + Math.sin(t * 3 + +i) * .15; }
  const pa = M.sparks.geometry.attributes.position, pc = M.sparks.geometry.attributes.color;
  M.sp.forEach((p, i) => {
    if (p.life > 0) { p.life -= dt; p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    const a = Math.max(0, p.life) * 1.2, c = p.c || [1, 1, 1]; pa.setXYZ(i, p.x || 0, p.life > 0 ? p.y : -99, p.z || 0); pc.setXYZ(i, c[0] * a, c[1] * a, c[2] * a);
  });
  pa.needsUpdate = true; pc.needsUpdate = true;
  // Figuren
  const meK = API.me, oK = API.other;
  const pos = {[meK]: {x: MX(mine.x), z: MZ(mine.y)}, [oK]: {x: MX(part.x), z: MZ(part.y)}};
  for (const k of ['a', 'd']) {
    const f = M.fig[k], p = pos[k], pr = M.prev[k] || p, vx = p.x - pr.x, vz = p.z - pr.z, mv = Math.hypot(vx, vz) > .004 && Math.hypot(vx, vz) < 1.5;
    if (mv) M.head[k] = API.lerpA(M.head[k], Math.atan2(-vx, -vz), Math.min(1, dt * 12));
    f.position.set(p.x, 0, p.z); f.rotation.y = M.head[k];
    K.animFigure(f, t + (k === 'a' ? 0 : 1.3), mv);
    const inv = S.p[k].inv > 0 && S.phase === 'play'; f.visible = !inv || Math.sin(t * 22) > -.3;
    if (M.lights[k]) M.lights[k].position.set(p.x, 3.2, p.z + .6);
    M.prev[k] = p;
  }
  // Wolken mit Regen
  if (!LOC.cs) LOC.cs = {};
  A.cl.forEach((cl, i) => {
    const s = LOC.cs[cl.id] || (LOC.cs[cl.id] = {x: cl.x, y: cl.y, h: 0});
    if (Math.hypot(cl.x - s.x, cl.y - s.y) > 60) { s.x = cl.x; s.y = cl.y; } else { s.x += (cl.x - s.x) * Math.min(1, dt * 14); s.y += (cl.y - s.y) * Math.min(1, dt * 14); }
    const C = M.clouds[i]; if (!C) return;
    if (cl.dir) s.h = API.lerpA(s.h, Math.atan2(-DX[cl.dir], -DY[cl.dir]), Math.min(1, dt * 10));
    const cx = MX(s.x) + (pw ? Math.sin(t * 30 + i) * .06 : 0), cz = MZ(s.y), cy = 1.7 + Math.sin(t * 2.4 + i) * .15;
    C.c.position.set(cx, cy, cz); C.c.rotation.y = s.h;
    const waiting = hostNow() < cl.wait, m = C.c.userData.mat;
    if (!pw && Math.random() < dt * .12) C.flash = .22;
    C.flash = Math.max(0, C.flash - dt);
    m.color.set(pw ? 0xa8c4f0 : 0x6c6884); m.emissive.set(pw ? 0x2a4488 : (C.flash > 0 ? 0xb0b8e8 : 0x121024)); m.emissiveIntensity = C.flash > 0 ? 1 : .5; m.opacity = waiting ? .45 : 1;
    const rp = C.rain.geometry.attributes.position;
    C.drops.forEach((d, j) => { d.y -= dt * 2.6; if (d.y < 0) d.y += 1; const y = d.y * (cy - .3); rp.setXYZ(j * 2, cx + d.x, y + .25, cz + d.z); rp.setXYZ(j * 2 + 1, cx + d.x, y, cz + d.z); });
    rp.needsUpdate = true; C.rain.visible = !pw && !waiting;
  });
  // Laternen: die zwei nächsten werfen echtes Licht
  const me3 = pos[meK];
  M.lamps.forEach(l => { l.d = (l.x - me3.x) ** 2 + (l.z - me3.z) ** 2; });
  const near = M.lamps.slice().sort((a, b) => a.d - b.d);
  M.lampLights.forEach((L, i) => { const l = near[i]; if (l) { L.position.set(l.x, 2.2, l.z); L.intensity = 1.15 + Math.sin(t * 9 + l.ph) * .12; } });
  M.lglow.material.opacity = .55 + Math.sin(t * 7) * .05;
  const fp = M.flies.geometry.attributes.position;
  M.fdat.forEach((f, i) => fp.setXYZ(i, f.x + Math.sin(t * f.s + f.p) * 1.2, f.y + Math.sin(t * f.s * 1.7 + f.p) * .4, f.z + Math.cos(t * f.s * .8 + f.p) * 1.2));
  fp.needsUpdate = true; M.flies.material.opacity = .6 + Math.sin(t * 3) * .2;
  const sp = M.spray.geometry.attributes.position;
  M.spray.userData.p.forEach((p, i) => { p.t = (p.t + dt * .7 * p.v) % 1; const r = .2 + p.t * 1.1; sp.setXYZ(i, Math.cos(p.a) * r, 1.9 + p.t * 1.2 - p.t * p.t * 2.2, Math.sin(p.a) * r); });
  sp.needsUpdate = true; M.fh.rotation.y = t * 1.5;
  M.upd.forEach(f => f(t, dt)); M.sky.userData.u.tm.value = t;
  M.hemi.color.set(pw ? 0xd898c0 : 0x8090d8); M.scene.fog.color.set(pw ? 0x24102a : 0x0d1226);
  REAL().sunAt(M.moon, me3.x, 0, me3.z);
  // Kamera: erhöht hinter der eigenen Figur, Blick immer nach Norden – passend zum Wischen
  const port = sc.cw < sc.ch;
  const want = new T.Vector3(me3.x, port ? 13 : 9.5, me3.z + (port ? 7.5 : 7.5));
  if (!M.camPos || M.camPos.distanceTo(want) > 12) M.camPos = want.clone(); M.camPos.lerp(want, Math.min(1, dt * 6));
  M.cam.position.copy(M.camPos); M.cam.lookAt(M.camPos.x, .9, M.camPos.z - (port ? 10 : 10.5));
  M.cam.aspect = sc.cw / sc.ch; M.cam.fov = port ? 70 : 52; M.cam.updateProjectionMatrix();
  M.U.uC.value.copy(M.cam.position); M.U.uP.value.set(me3.x, 1.1, me3.z);
  API.render3D(M.scene, M.cam, {bloom: .7, th: .68});
  // Namen, Pfeil zum Partner
  const mp = K.proj(M.cam, new T.Vector3(me3.x, 1, me3.z)); LOC.meScr = {x: mp.x, y: mp.y};
  for (const k of [oK, meK]) { const p = K.proj(M.cam, new T.Vector3(pos[k].x, 3.1, pos[k].z)); if (p.ok && p.x > 0 && p.x < sc.cw && p.y > 0 && p.y < sc.ch) K.nameTag(nm(k), p.x, p.y, COL[k]); }
  const op = K.proj(M.cam, new T.Vector3(pos[oK].x, 1, pos[oK].z));
  if (!(op.ok && op.x > 20 && op.x < sc.cw - 20 && op.y > 80 && op.y < sc.ch - 20)) {
    const ang = Math.atan2(pos[oK].z - me3.z, pos[oK].x - me3.x), ex = sc.cw / 2 + Math.cos(ang) * sc.cw * .4, ey = Math.max(sc.ch * .55 + Math.sin(ang) * sc.ch * .36, ex > sc.cw * .55 ? 292 : 90);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = rgba(COL[oK], .95); ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.font = '700 12px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(COL[oK], 1); ctx.fillText(nm(oK), ex, ey + 22);
  }
  // Karte mit dem Bild
  const done = !!S.done; if (done) M.endT += dt;
  const fade = done ? clamp((M.endT - .5) / 1.6, 0, 1) : 0, F = FOTO.get('m1'), key = A.dots + (F.ready ? 'r' : '') + fade.toFixed(2);
  if (key !== M.picKey) { M.picKey = key; drawPic(M, A.dots, fade); }
  const cs = Math.min(6.6, (sc.cw * .31) / NC), mw = NC * cs, mh = NR * cs, mx = sc.cw - mw - 14, my = 70;
  let q = {x: mx, y: my, w: mw, h: mh};
  if (done && S.phase === 'play') q = FOTO.big(ctx, {w: NC, h: NR}, sc, clamp((M.endT - .4) / 1.5, 0, 1), q, 'Euer Bild – Feld für Feld freigelaufen'); else FOTO.frame(ctx, mx, my, mw, mh, 3);
  ctx.drawImage(M.pic, q.x, q.y, q.w, q.h);
  if (!done) {
    const toM = (x, z) => [mx + (x + NC) / 2 * cs, my + (z + NR) / 2 * cs];
    for (const i in M.hearts) if (A.dots[i] === '2') { ctx.fillStyle = '#ff8fb4'; heartPath(mx + (i % NC) * cs + cs / 2, my + ((i / NC) | 0) * cs + cs / 2, cs * .5); ctx.fill(); }
    A.cl.forEach(cl => { const s = LOC.cs[cl.id]; if (!s) return; const [a, b] = toM(MX(s.x), MZ(s.y)); ctx.fillStyle = pw ? '#9cc4ff' : '#c4c0d4'; ctx.beginPath(); ctx.arc(a, b, cs * .58, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke(); });
    for (const k of [oK, meK]) { const [a, b] = toM(pos[k].x, pos[k].z); ctx.fillStyle = rgba(COL[k], 1); ctx.beginPath(); ctx.arc(a, b, cs * .66, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.font = '600 11px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(`Bild ${Math.round(100 * S.count / Math.max(1, S.total))} %`, mx + mw / 2, my + mh + 18);
    if (pw) { ctx.textAlign = 'center'; ctx.font = '700 17px Karla, system-ui'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,6,20,.7)'; const tx = `Herz-Zeit! Die Wolken fliehen · ${Math.ceil(A.power - hostNow())}`; ctx.strokeText(tx, sc.cw / 2, sc.ch - 110); ctx.fillStyle = rgba(CA, 1); ctx.fillText(tx, sc.cw / 2, sc.ch - 110); }
    const g = LOC.g;
    if (S.phase === 'play' && (!g || (!g.dir && S.t - S.lt < 12))) { ctx.font = '600 13px Karla, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('Wische in eine Richtung, um loszulaufen', sc.cw / 2, sc.ch - 70); }
  }
};
return [irrgarten];
});
