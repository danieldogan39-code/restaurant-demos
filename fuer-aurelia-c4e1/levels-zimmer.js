/* Zwei Lichter – „Zwei Zimmer“ (neu in Version 8)
   Escape-Room in der Ich-Perspektive. Jeder ist in seinem eigenen Zimmer eingeschlossen; die Hinweise
   für die eigenen Rätsel hängen beim anderen. Drei Rätsel: Symbolräder, Lampen-Hebel, Bodenplatten. */
(window.ZL_PACKS = window.ZL_PACKS || []).push(API => {
'use strict';
const {S, LOC, ctx, TAU, COL, CA, CD, CG, rgba, clamp, nm, OTH, emit, finish, teleport, act, hostNow, mine} = API;
const toast = t => API.toast(t);
const U = 50, EYE = 1.62, HH = 3.4;
const sgn = k => k === 'a' ? -1 : 1;
const HOME = k => ({x: sgn(k) * 4, z: 1.7});
/* Welche Lampen (Bit 0 = Lampe 1) jeder Hebel umschaltet */
const LVEC = {a: [3, 14, 24], d: [5, 18, 28]};
const NUM = ['I', 'II', 'III'];
const lamps = A => { let v = A.l0; for (const k of ['a', 'd']) A.lev[k].forEach((on, i) => { if (on) v ^= LVEC[k][i]; }); return v; };
const leverZ = (k, i) => k === 'a' ? 1.9 + i * .6 : 3.1 - i * .6;
const tilePos = (k, c, r) => ({x: sgn(k) * (2.5 + c), z: -3.5 + r});
function tileOf(k, x, z) {
  const u = x * sgn(k), fc = u - 2, fr = z + 4, c = Math.floor(fc), r = Math.floor(fr);
  if (c < 0 || c > 3 || r < 0 || r > 3) return -1;
  const ic = fc - c, ir = fr - r; if (ic < .14 || ic > .86 || ir < .14 || ir > .86) return -1;
  return r * 4 + c;
}
function mkPath() {
  for (let n = 0; n < 500; n++) {
    let c = (Math.random() * 4) | 0, r = 3; const p = [r * 4 + c], seen = new Set(p);
    while (!(r === 0 && (c === 1 || c === 2))) {
      const opts = [[c, r - 1], [c, r - 1], [c - 1, r], [c + 1, r]].filter(([x, y]) => x >= 0 && x < 4 && y >= 0 && !seen.has(y * 4 + x)
        && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => seen.has((y + dy) * 4 + x + dx) && x + dx >= 0 && x + dx < 4).length === 1);
      if (!opts.length) break;
      [c, r] = opts[(Math.random() * opts.length) | 0]; p.push(r * 4 + c); seen.add(r * 4 + c);
    }
    if (r === 0 && (c === 1 || c === 2) && p.length >= 5 && p.length <= 8) return p;
  }
  return [13, 9, 5, 1];
}
function rects() {
  const A = S.aux, out = [[-.2, -4.25, .2, 4.3]];
  for (const k of ['a', 'd']) {
    const s = sgn(k), X = (a, b) => s < 0 ? [-b, -a] : [a, b], add = (a, b, z0, z1) => { const [x0, x1] = X(a, b); out.push([x0, z0, x1, z1]); };
    add(.2, 3.3, -4.25, -4); add(4.7, 8.3, -4.25, -4);
    if (!(A.door && A.door[k])) add(3.3, 4.7, -4.25, -4);
    add(3.25, 5.35, 3.1, 4.3); add(.55, 2.65, 3.3, 4.3);
    add(6, 8, -4.1, -3.2); add(.3, 1.8, -4, -2.6); add(.3, 1.4, -2.45, -1.35); add(7.1, 7.95, 3.35, 4.2); add(5.5, 5.95, 3.6, 4.2);
  }
  out.push([-2.3, -10.1, -1.5, -9.4], [1.5, -10.1, 2.3, -9.4], [-7.35, -10.1, -5.05, -9.5], [5.05, -10.1, 7.35, -9.5], [-1.15, -4.85, -.65, -4.35], [.65, -4.85, 1.15, -4.35]);
  return out;
}

/* ---------- Einrichtung: Vertäfelung, Kamin, Sessel, Fässer, Wandteppiche, Fenster, Halle ---------- */
function decor(T, scene, R, K, add, MT, me) {
  const upd = [], {gold, iron, darkWood} = MT, B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, n = 12) => new T.CylinderGeometry(a, b, h, n);
  const panel = R.pbr(T, 'wood', 3, .5, {color: 0x7a5c44, roughness: .75}), caskM = R.pbr(T, 'wood', 2, 1, {color: 0x9a7450, roughness: .7}), hearthM = R.pbr(T, 'stone', 1, 1, {color: 0xb8aca0, roughness: .95});
  const cloth = c => new T.MeshStandardMaterial({color: c, roughness: .96}), wax = new T.MeshStandardMaterial({color: 0xf2e8d4, roughness: .6}), black = new T.MeshStandardMaterial({color: 0x0c0a0a, roughness: 1});
  const steel = new T.MeshStandardMaterial({color: 0xa4aab4, metalness: .9, roughness: .34, envMapIntensity: 1.2}), potM = new T.MeshStandardMaterial({color: 0x8a4a34, roughness: .8});
  const flame = (x, y, z, sz = .16) => { const f = K.sprite(T, 0xffb860, sz, .95); f.position.set(x, y, z); scene.add(f); const ph = x * 3 + z; upd.push(t => { const k = 1 + Math.sin(t * 12 + ph) * .1 + Math.sin(t * 27 + ph) * .06; f.scale.set(sz * k, sz * 1.35 * k, 1); }); };
  const candle = (x, y, z) => { add(C(.05, .07, .05, 8), gold, x, y + .025, z, false); add(C(.022, .026, .18, 8), wax, x, y + .14, z, false); flame(x, y + .29, z); };
  const barrel = (x, z) => { add(C(.3, .3, .86, 14), caskM, x, .43, z); for (const y of [.16, .7]) { const t = add(new T.TorusGeometry(.303, .016, 6, 18), iron, x, y, z, false); t.rotation.x = Math.PI / 2; } };
  const winTex = () => R.paint(T, 128, 240, (g, w, h) => { g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#16224a'); gr.addColorStop(1, '#3a4a7a'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(10, h - 8); g.lineTo(10, 64); g.arc(w / 2, 64, w / 2 - 10, Math.PI, 0); g.lineTo(w - 10, h - 8); g.closePath(); g.fill(); g.save(); g.clip();
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(Math.random() * w, Math.random() * h * .7, 1.6, 1.6); } g.fillStyle = '#fff4d8'; g.beginPath(); g.arc(82, 70, 17, 0, 6.283); g.fill(); g.fillStyle = '#16224a'; g.beginPath(); g.arc(90, 64, 15, 0, 6.283); g.fill(); g.restore();
    g.strokeStyle = '#1c1612'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 8); for (const y of [100, 150, 200]) { g.moveTo(10, y); g.lineTo(w - 10, y); } g.stroke(); });
  const shaftT = R.paint(T, 32, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(150,180,255,.5)'); gr.addColorStop(1, 'rgba(150,180,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const windowAt = (x, y, z, ry, shaft) => { const w = add(new T.PlaneGeometry(.95, 1.78), new T.MeshBasicMaterial({map: winTex()}), x, y, z, false); w.rotation.y = ry;
    if (shaft) { const sh = add(new T.PlaneGeometry(.9, 3.4), new T.MeshBasicMaterial({map: shaftT, transparent: true, opacity: .22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide}), x, y - 1.05, z - 1.2, false); sh.rotation.x = .85; sh.receiveShadow = false;
      const fl = add(new T.PlaneGeometry(.9, 1.5), new T.MeshBasicMaterial({color: 0x6a86d0, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false}), x, .016, z - 2.3, false); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = false; } };
  const fernPot = (x, z, sc = 1) => { add(C(.24 * sc, .17 * sc, .4 * sc, 12), potM, x, .2 * sc, z); const f = R.plants(T, 'fern', [{x, y: .34 * sc, z, s: sc}, {x: x + .05, y: .32 * sc, z: z + .04, s: sc * .8}], {w: 1.1, h: .9, seed: 3}); scene.add(f); };
  for (const k of ['a', 'd']) {
    const s = sgn(k), own = k === me, X = u => s * u;
    // Holzvertäfelung rundum, mit Abschlussleiste
    const wains = (x, z, w, d) => { add(B(w, .9, d), panel, x, .45, z, false); add(B(w + (w > d ? 0 : .03), .06, d + (d > w ? 0 : .03)), darkWood, x, .93, z, false); };
    wains(X(7.965), .1, .05, 8.2); wains(X(4.1), 4.165, 7.8, .05); wains(X(1.75), -3.965, 3.1, .05); wains(X(6.35), -3.965, 3.3, .05); wains(X(.228), 2.7, .05, 3); wains(X(.228), -2.6, .05, 2.8);
    // Kamin mit Feuer, Sims, Kerzen und Uhr
    add(B(.32, 1.45, .52), hearthM, X(6.26), .725, -3.74); add(B(.32, 1.45, .52), hearthM, X(7.74), .725, -3.74); add(B(1.8, .3, .56), hearthM, X(7), 1.6, -3.72);
    add(B(2.04, .07, .68), darkWood, X(7), 1.785, -3.66); add(B(1.16, 1.45, .06), black, X(7), .725, -3.96, false); add(B(1.95, .06, .95), hearthM, X(7), .03, -3.55, false);
    add(B(1.5, HH - 1.82, .36), hearthM, X(7), (1.82 + HH) / 2, -3.82);
    for (const [dy, dz, rz] of [[.1, -3.72, 0], [.1, -3.6, .25], [.22, -3.68, -.12]]) { const l = add(C(.065, .07, .72, 8), caskM, X(7), dy, dz, false); l.rotation.set(0, rz, Math.PI / 2); }
    const fire = R.fire(T, {size: .85, light: own, inten: 1.05, dist: 8, ph: s}); fire.position.set(X(7), .12, -3.66); scene.add(fire); upd.push(fire.userData.upd);
    candle(X(6.25), 1.82, -3.62); candle(X(7.75), 1.82, -3.62);
    add(C(.15, .15, .08, 16), gold, X(7), 1.97, -3.6, false).rotation.x = Math.PI / 2; add(B(.34, .06, .14), darkWood, X(7), 1.83, -3.6, false);
    const pic = add(new T.PlaneGeometry(.62, .52), new T.MeshStandardMaterial({roughness: .8, map: R.paint(T, 124, 104, (g, w, h) => { g.fillStyle = '#d9ad62'; g.fillRect(0, 0, w, h); g.fillStyle = k === 'a' ? '#40243a' : '#243050'; g.fillRect(8, 8, w - 16, h - 16); R.sym(g, 0, w / 2, h / 2 + 2, 26, '#f48aa3'); })}), X(7), 2.55, -3.635, false); void pic;
    // Ecke mit Fässern, Kisten und einem Sack
    barrel(X(.7), -3.6); barrel(X(1.42), -3.55); add(B(.6, .6, .6), caskM, X(.72), .3, -2.95); add(B(.4, .4, .4), caskM, X(.74), .8, -2.97).rotation.y = .5;
    add(new T.SphereGeometry(.3, 12, 10), cloth(0xb8a078), X(1.45), .24, -2.92).scale.set(1, .8, .9);
    // Sessel mit Kissen und rundem Teppich
    { const g = new T.Group(), fab = cloth(k === 'a' ? 0x7a3044 : 0x30487a), ad = (geo, m, x, y, z) => { const q = new T.Mesh(geo, m); q.position.set(x, y, z); q.castShadow = q.receiveShadow = true; g.add(q); return q; };
      ad(B(.82, .34, .78), fab, 0, .17, 0); ad(B(.7, .14, .66), fab, 0, .4, -.03); ad(B(.82, .9, .17), fab, 0, .75, .33); ad(B(.14, .3, .74), fab, -.4, .5, 0); ad(B(.14, .3, .74), fab, .4, .5, 0);
      ad(new T.SphereGeometry(.2, 12, 8), cloth(0xe8c888), 0, .56, .16).scale.set(1.1, .9, .5);
      g.position.set(X(.86), 0, -1.9); g.rotation.y = -s * Math.PI / 2; scene.add(g);
      const rug = add(new T.CircleGeometry(.95, 28), cloth(k === 'a' ? 0x5a2838 : 0x283a5a), X(1.5), .013, -1.9, false); rug.rotation.x = -Math.PI / 2; }
    // Wandteppich und Wappen
    const tap = add(new T.PlaneGeometry(1.5, 1.8), new T.MeshStandardMaterial({roughness: .95, map: R.paint(T, 300, 360, (g, w, h) => {
      g.fillStyle = k === 'a' ? '#6a2440' : '#243a6a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9ad62'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24); g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
      R.sym(g, k === 'a' ? 2 : 3, w / 2, 130, 56, '#f3d9a0'); for (let i = 0; i < 5; i++) R.sym(g, 1, 60 + i * 45, 262, 13, '#f3d9a0'); g.fillStyle = '#f3d9a0'; g.font = '700 30px Georgia, serif'; g.textAlign = 'center'; g.fillText(nm(k), w / 2, 320);
      for (let i = 0; i < 1600; i++) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); } })}), X(.212), 2.1, -2.6, false); tap.rotation.y = s * Math.PI / 2;
    add(C(.025, .025, 1.7, 8), gold, X(.24), 3.03, -2.6, false).rotation.x = Math.PI / 2;
    const sh = add(new T.PlaneGeometry(1.15, 1.25), new T.MeshStandardMaterial({transparent: true, alphaTest: .3, roughness: .5, metalness: .4, map: R.paint(T, 230, 250, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.lineCap = 'round'; g.strokeStyle = '#b8bcc4'; g.lineWidth = 9; g.beginPath(); g.moveTo(26, 20); g.lineTo(204, 220); g.moveTo(204, 20); g.lineTo(26, 220); g.stroke(); g.strokeStyle = '#d9ad62'; g.lineWidth = 12; g.beginPath(); g.moveTo(44, 62); g.lineTo(76, 34); g.moveTo(186, 62); g.lineTo(154, 34); g.stroke();
      g.fillStyle = k === 'a' ? '#8a2c4a' : '#2c4a8a'; g.beginPath(); g.moveTo(62, 52); g.lineTo(168, 52); g.lineTo(168, 130); g.quadraticCurveTo(168, 196, 115, 222); g.quadraticCurveTo(62, 196, 62, 130); g.closePath(); g.fill(); g.strokeStyle = '#d9ad62'; g.lineWidth = 7; g.stroke(); R.sym(g, 0, 115, 126, 30, '#f3d9a0'); })}), X(1.75), 2.2, -3.955, false); void sh;
    // Fenster mit Mondlicht, Farn, Stehleuchter, Dinge auf dem Tisch und dem Regal
    windowAt(X(6.7), 2.1, 4.168, Math.PI, true);
    fernPot(X(7.5), 3.72, 1.25);
    add(C(.03, .04, 1.5, 8), gold, X(5.72), .75, 3.85, false); add(C(.16, .2, .05, 12), gold, X(5.72), .03, 3.85, false); for (const dx of [-.14, 0, .14]) { add(C(.02, .02, .14, 6), wax, X(5.72) + dx, 1.57 + (dx ? 0 : .06), 3.85, false); flame(X(5.72) + dx, 1.7 + (dx ? 0 : .06), 3.85, .13); }
    const cx = s * 4.3; candle(cx - .9, .89, 3.4);
    [[0x7a2c2c, 0], [0x2c4a6a, .25], [0x3a5a34, -.2]].forEach(([c, ry], i) => { add(B(.3, .055, .22), cloth(c), cx + .9, .92 + i * .057, 3.45, false).rotation.y = ry; });
    add(new T.SphereGeometry(.15, 12, 10), potM, X(1.2), 2.62, 3.85, false).scale.y = 1.25; add(B(.34, .26, .24), caskM, X(2.05), 2.63, 3.85, false);
    // Spinnweben und Staub im Licht
    for (const [u, z, ry] of [[7.6, 3.85, 2.4], [.6, 3.85, .8], [7.6, -3.6, -2.3]]) { const w = R.cobweb(T); w.scale.setScalar(1.25); w.position.set(X(u), HH - .62, z); w.rotation.y = s * ry; scene.add(w); }
    if (own) { const m = R.motes(T, 70, {box: [Math.min(X(.5), X(7.8)), .3, -3.8, Math.max(X(.5), X(7.8)), 3, 4], color: 0xffdcae, size: .035, op: .55, sway: .25, seed: 3 + s}); scene.add(m); upd.push(m.userData.upd); }
  }
  // Halle: Ritterrüstungen, Fackeln, Bänke, Säulen, Farne, Mondfenster
  for (const s of [-1, 1]) {
    const x = s * 1.9, z = -9.72;
    add(C(.26, .2, .78, 12), steel, x, 1.25, z); add(new T.SphereGeometry(.2, 14, 12), steel, x, 1.86, z); add(new T.ConeGeometry(.07, .3, 8), new T.MeshStandardMaterial({color: 0xb02c3c, roughness: .8}), x, 2.16, z);
    for (const dx of [-.13, .13]) { add(C(.08, .09, .86, 8), steel, x + dx, .43, z); add(new T.SphereGeometry(.12, 10, 8), steel, x + dx * 2.6, 1.56, z); }
    add(B(.3, .06, .3), black, x, .03, z, false); add(C(.02, .02, 2.5, 6), darkWood, x + s * .42, 1.25, z + .1); add(new T.ConeGeometry(.06, .3, 6), steel, x + s * .42, 2.62, z + .1, false);
    for (const [tx, tz] of [[s * 5.2, -10.12], [s * 2.6, -4.36]]) { add(B(.1, .3, .14), iron, tx, 2.05, tz + (tz < -8 ? .08 : -.08), false); const f = R.fire(T, {size: .34, light: false, ph: tx}); f.position.set(tx, 2.2, tz + (tz < -8 ? .16 : -.16)); scene.add(f); upd.push(f.userData.upd); }
    add(B(2.2, .09, .5), darkWood, s * 6.2, .46, -9.8); for (const dx of [-.95, .95]) add(B(.1, .45, .44), darkWood, s * 6.2 + dx, .225, -9.8);
    add(C(.2, .23, HH, 16), R.pbr(T, 'marble', 1, 2, {color: 0xe8ddd0, roughness: .4}), s * .9, HH / 2, -4.6); add(B(.6, .2, .6), hearthM, s * .9, .1, -4.6);
    fernPot(s * 7.45, -9.65, 1.5); fernPot(s * 7.45, -4.75, 1.5);
    windowAt(s * 3.7, 2.2, -10.168, 0, false);
  }
  return upd;
}

function build(T) {
  const K = window.ZL_KIT(API), R = window.ZL_REAL(API), scene = new T.Scene(), cam = new T.PerspectiveCamera(74, 1, .08, 80);
  cam.rotation.order = 'YXZ';
  scene.background = new T.Color(0x05040a);
  scene.environment = K.env(T, 'zimmer', 0x2a2030, 0x4a3424, 0x140e0a, [[0, 8, 0, 10, 10, 0xffc080]]);
  scene.add(new T.HemisphereLight(0x8a90c0, 0x2a2018, .3));
  const inter = [], me = API.me;
  const add = (geo, mat, x, y, z, sh = true) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; scene.add(m); return m; };
  const stone = (w, h) => R.pbr(T, 'stone', Math.max(.5, w / 1.7), Math.max(.5, h / 1.7), {roughness: .92, color: 0xd8ccc0});
  const wall = (x0, z0, x1, z1, y0 = 0, y1 = HH) => { const w = x1 - x0, d = z1 - z0; return add(new T.BoxGeometry(w, y1 - y0, d), stone(Math.max(w, d), y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); };
  const gold = new T.MeshStandardMaterial({color: 0xd9ad62, metalness: .85, roughness: .32, envMapIntensity: 1.1});
  const iron = new T.MeshStandardMaterial({color: 0x2c2a2e, metalness: .7, roughness: .5});
  const darkWood = R.pbr(T, 'wood', 1, 1, {color: 0x8a6a52, roughness: .7});
  // Böden und Decke
  const fl = add(new T.PlaneGeometry(16.6, 8.5), R.pbr(T, 'wood', 6, 3, {roughness: .58, envMapIntensity: .35}), 0, 0, 0, false); fl.rotation.x = -Math.PI / 2;
  const hf = add(new T.PlaneGeometry(16.6, 6.2), R.pbr(T, 'marble', 5, 2, {roughness: .3, envMapIntensity: .6}), 0, 0, -7.2, false); hf.rotation.x = -Math.PI / 2;
  const ce = add(new T.PlaneGeometry(16.6, 14.6), R.pbr(T, 'wood', 5, 5, {color: 0x6a5648, roughness: .95}), 0, HH, -3, false); ce.rotation.x = Math.PI / 2;
  for (const z of [-9, -7, -5.2, -2.6, 0, 2.6]) add(new T.BoxGeometry(16.6, .26, .3), darkWood, 0, HH - .13, z, false);
  // Außenwände, Trennwand mit Gitterfenster, Wände zur Halle
  wall(-8.4, -10.4, -8, 4.4); wall(8, -10.4, 8.4, 4.4); wall(-8.4, 4.2, 8.4, 4.6); wall(-8.4, -10.6, 8.4, -10.2);
  wall(-.2, -4, .2, -1.2); wall(-.2, 1.2, .2, 4.2); wall(-.2, -1.2, .2, 1.2, 0, 1); wall(-.2, -1.2, .2, 1.2, 2.95, HH);
  for (const s of [-1, 1]) {
    const X = (a, b) => s < 0 ? [-b, -a] : [a, b];
    let [x0, x1] = X(0, 3.3); wall(x0, -4.25, x1, -4); [x0, x1] = X(4.7, 8); wall(x0, -4.25, x1, -4); [x0, x1] = X(3.3, 4.7); wall(x0, -4.25, x1, -4, 2.35, HH);
  }
  for (let i = 0; i < 8; i++) add(new T.CylinderGeometry(.024, .024, 1.38, 8), iron, 0, 1.68, -1.05 + i * .3);
  add(new T.BoxGeometry(.07, .07, 2.4), iron, 0, 2.36, 0); add(new T.BoxGeometry(.07, .07, 2.4), iron, 0, 1.02, 0);
  // Fünf Lampen über dem Gitter (von beiden Zimmern aus zu sehen), mit Nummern
  const lampsM = [], digit = n => R.paint(T, 64, 64, g => { g.fillStyle = '#1c1612'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#d9ad62'; g.lineWidth = 4; g.strokeRect(3, 3, 58, 58); g.fillStyle = '#f3d9a0'; g.font = '700 42px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 32, 35); });
  for (let i = 0; i < 5; i++) {
    const z = -.8 + i * .4, m = new T.MeshStandardMaterial({color: 0x3a3028, emissive: 0xffb040, emissiveIntensity: 0, roughness: .3});
    add(new T.CylinderGeometry(.012, .012, .2, 6), iron, 0, 2.86, z, false);
    const b = add(new T.SphereGeometry(.125, 16, 12), m, 0, 2.66, z, false), sp = K.sprite(T, 0xffb040, .9, 0); sp.position.set(0, 2.66, z); scene.add(sp);
    lampsM.push({m, sp, b});
    for (const s of [-1, 1]) { const p = add(new T.PlaneGeometry(.2, .2), new T.MeshBasicMaterial({map: digit(i + 1)}), s * .206, 3.1, z, false); p.rotation.y = s * Math.PI / 2; }
  }
  const lampLight = new T.PointLight(0xffb050, 0, 7, 1.5); lampLight.position.set(0, 2.6, 0); scene.add(lampLight);
  // Symbol-Karten für die Räder
  const symTex = R.SYM.map((_, i) => R.paint(T, 128, 144, (g, w, h) => { g.fillStyle = '#efe4cc'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8); R.sym(g, i, w / 2, h / 2 + 4, 40); }));
  const rooms = {};
  for (const k of ['a', 'd']) {
    const s = sgn(k), o = OTH(k), A = S.aux, own = k === me, Rm = rooms[k] = {wheels: [], levers: [], tiles: []};
    const clue = (tex, w, h, y, z, frame = true) => {
      const p = add(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({map: tex, roughness: .8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .42}), s * 7.925, y, z, false); p.rotation.y = -s * Math.PI / 2;
      if (frame) add(new T.BoxGeometry(.07, h + .16, w + .16), gold, s * 7.985, y, z, false);
    };
    // Gemälde: der Code für die Truhe des anderen
    clue(R.paint(T, 640, 336, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d2748'); gr.addColorStop(1, '#3a2c50'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(Math.random() * w, Math.random() * h * .5, 2, 2); }
      g.fillStyle = '#f3d9a0'; g.font = '600 30px Georgia, serif'; g.textAlign = 'center'; g.fillText(`Für ${nm(o)}s Truhe`, w / 2, 46);
      (A.code[o] || []).forEach((sy, i) => { const x = 104 + i * 144; g.fillStyle = '#efe4cc'; R.rrect(g, x - 56, 78, 112, 176, 12); g.fill(); R.sym(g, sy, x, 160, 44); g.fillStyle = '#f3d9a0'; g.font = '700 26px Georgia, serif'; g.fillText(String(i + 1), x, 296); });
    }), 2.05, 1.08, 1.8, 2.3);
    // Pergament: was die Hebel des anderen schalten
    clue(R.paint(T, 420, 500, (g, w, h) => {
      R.parchment(g, w, h, 3 + s); g.fillStyle = '#3a2410'; g.textAlign = 'center'; g.font = '700 34px Georgia, serif'; g.fillText(`${nm(o)}s Hebel`, w / 2, 62);
      g.font = '600 20px Georgia, serif'; g.fillText('● schaltet diese Lampe um', w / 2, 96);
      for (let i = 0; i < 5; i++) { g.font = '700 22px Georgia, serif'; g.fillText(String(i + 1), 148 + i * 54, 146); }
      LVEC[o].forEach((v, i) => { const y = 200 + i * 96; g.font = '700 40px Georgia, serif'; g.textAlign = 'left'; g.fillText(NUM[i], 34, y + 14); g.textAlign = 'center';
        for (let b = 0; b < 5; b++) { g.beginPath(); g.arc(148 + b * 54, y, 19, 0, TAU); g.lineWidth = 3; g.strokeStyle = '#3a2410'; g.stroke(); if (v >> b & 1) { g.fillStyle = '#b3541e'; g.fill(); g.fillStyle = '#3a2410'; } } });
    }), .95, 1.13, 1.65, .15, false);
    // Karte: der sichere Weg des anderen über seine Bodenplatten
    clue(R.paint(T, 460, 540, (g, w, h) => {
      R.parchment(g, w, h, 9 + s); g.fillStyle = '#3a2410'; g.textAlign = 'center'; g.font = '700 32px Georgia, serif'; g.fillText(`${nm(o)}s Weg zur Tür`, w / 2, 56);
      const cs = 84, x0 = (w - cs * 4) / 2, y0 = 118, path = A.path[o] || [];
      g.fillStyle = '#6a3a1a'; g.fillRect(w / 2 - 52, y0 - 26, 104, 16); g.font = '700 18px Georgia, serif'; g.fillStyle = '#3a2410'; g.fillText('TÜR', w / 2, y0 - 34);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const col = o === 'a' ? 3 - c : c, idx = r * 4 + c, n = path.indexOf(idx), x = x0 + col * cs, y = y0 + r * cs;
        g.fillStyle = n >= 0 ? '#d9a13a' : 'rgba(90,60,30,.16)'; g.fillRect(x + 4, y + 4, cs - 8, cs - 8); g.strokeStyle = '#3a2410'; g.lineWidth = 2.5; g.strokeRect(x + 4, y + 4, cs - 8, cs - 8);
        if (n >= 0) { g.fillStyle = '#3a2410'; g.font = '700 32px Georgia, serif'; g.fillText(String(n + 1), x + cs / 2, y + cs / 2 + 11); }
      }
      g.font = '600 19px Georgia, serif'; g.fillStyle = '#3a2410'; g.fillText(`▲ so sieht ${nm(o)} die Platten, mit Blick zur Tür`, w / 2, y0 + cs * 4 + 34); g.fillText('1 = erste Platte, Start unten', w / 2, y0 + cs * 4 + 60);
    }), 1.12, 1.32, 1.65, -1.75, false);
    // Kerzen an der Außenwand
    Rm.cand = [-.82, 1.12, 3.5].map((z, i) => {
      add(new T.BoxGeometry(.2, .05, .12), iron, s * 7.88, 2.22, z, false); add(new T.CylinderGeometry(.035, .04, .22, 8), new T.MeshStandardMaterial({color: 0xf2e8d4, roughness: .6}), s * 7.84, 2.36, z, false);
      const fsp = K.sprite(T, 0xffb860, .42, .95); fsp.position.set(s * 7.84, 2.53, z); scene.add(fsp);
      const pl = i < 2 && own ? new T.PointLight(0xffa860, 1, 8.5, 1.5) : null; if (pl) { pl.position.set(s * 7.5, 2.5, z); scene.add(pl); }
      return {fsp, pl, ph: i * 2.1 + s};
    });
    // Tisch mit Truhe und vier Symbolrädern
    const cx = s * 4.3;
    add(new T.BoxGeometry(2.05, .08, .85), darkWood, cx, .85, 3.6);
    for (const [dx, dz] of [[-.92, -.34], [.92, -.34], [-.92, .34], [.92, .34]]) add(new T.BoxGeometry(.09, .82, .09), darkWood, cx + dx, .41, 3.6 + dz);
    add(new T.BoxGeometry(1.5, .5, .55), R.pbr(T, 'wood', 1, .5, {color: 0x7a5236, roughness: .6}), cx, 1.14, 3.62);
    for (const dx of [-.55, .55]) add(new T.BoxGeometry(.07, .52, .57), iron, cx + dx, 1.14, 3.62, false);
    const lid = new T.Group(); lid.position.set(cx, 1.39, 3.895);
    const lm = new T.Mesh(new T.BoxGeometry(1.54, .13, .59), R.pbr(T, 'wood', 1, .5, {color: 0x7a5236, roughness: .6})); lm.position.set(0, .065, -.275); lm.castShadow = true; lid.add(lm);
    const lk = new T.Mesh(new T.BoxGeometry(.16, .16, .04), gold); lk.position.set(0, .03, -.59); lid.add(lk); scene.add(lid); Rm.lid = lid;
    const tr = K.sprite(T, 0xffd890, 1.5, 0); tr.position.set(cx, 1.5, 3.6); scene.add(tr); Rm.treasure = tr;
    for (let i = 0; i < 4; i++) {
      const x = cx + (1.5 - i) * .34, mat = new T.MeshStandardMaterial({map: symTex[0], roughness: .6}), g = new T.Group(); g.position.set(x, 1.14, 3.3);
      const body = new T.Mesh(new T.BoxGeometry(.28, .32, .07), gold); g.add(body);
      const face = new T.Mesh(new T.PlaneGeometry(.24, .27), mat); face.rotation.y = Math.PI; face.position.z = -.037; g.add(face); scene.add(g);
      const hit = add(new T.BoxGeometry(.33, .6, .3), new T.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}), x, 1.14, 3.25, false); hit.receiveShadow = false;
      hit.userData.u = {o: k, d: {k: 'wheel', i}, lab: 'Rad drehen'}; inter.push(hit);
      Rm.wheels.push({g, mat, cur: -1, t: -9});
    }
    // Drei Hebel an der Gitterwand
    for (let i = 0; i < 3; i++) {
      const z = leverZ(k, i);
      add(new T.BoxGeometry(.06, .56, .26), iron, s * .23, 1.3, z, false);
      const pv = new T.Group(); pv.position.set(s * .27, 1.3, z);
      const h = new T.Mesh(new T.CylinderGeometry(.022, .026, .46, 8), gold); h.position.y = .23; h.castShadow = true; pv.add(h);
      const kn = new T.Mesh(new T.SphereGeometry(.06, 12, 10), new T.MeshStandardMaterial({color: k === 'a' ? 0xf48aa3 : 0x7fb0ff, roughness: .35, emissive: k === 'a' ? 0x601828 : 0x183060, emissiveIntensity: .6})); kn.position.y = .47; pv.add(kn);
      scene.add(pv);
      const pl = add(new T.PlaneGeometry(.26, .2), new T.MeshBasicMaterial({map: R.paint(T, 96, 72, g => { g.fillStyle = '#1c1612'; g.fillRect(0, 0, 96, 72); g.strokeStyle = '#d9ad62'; g.lineWidth = 4; g.strokeRect(3, 3, 90, 66); g.fillStyle = '#f3d9a0'; g.font = '700 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(NUM[i], 48, 38); })}), s * .206, 1.82, z, false); pl.rotation.y = s * Math.PI / 2;
      const hit = add(new T.BoxGeometry(.3, .95, .46), new T.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}), s * .35, 1.32, z, false); hit.receiveShadow = false;
      hit.userData.u = {o: k, d: {k: 'lever', i}, lab: 'Hebel umlegen'}; inter.push(hit);
      Rm.levers.push({pv, ang: -s * .9});
    }
    // Bodenplatten vor der Tür
    for (let i = 0; i < 16; i++) {
      const p = tilePos(k, i % 4, (i / 4) | 0), m = new T.MeshStandardMaterial({color: 0x4c4844, roughness: .8, envMapIntensity: .15, emissive: 0xf3b040, emissiveIntensity: 0});
      const t = add(new T.BoxGeometry(.9, .06, .9), m, p.x, .03, p.z, false); Rm.tiles.push({m, t});
    }
    // Tür
    const door = new T.Group(); door.position.set(s * 4.7, 0, -4.12);
    const leaf = new T.Mesh(new T.BoxGeometry(1.4, 2.32, .09), R.pbr(T, 'wood', 1, 1.6, {color: 0x80583a, roughness: .65})); leaf.position.set(-s * .7, 1.16, 0); leaf.castShadow = true; door.add(leaf);
    for (const y of [.5, 1.85]) { const b = new T.Mesh(new T.BoxGeometry(1.36, .09, .11), iron); b.position.set(-s * .7, y, 0); door.add(b); }
    const hd = new T.Mesh(new T.TorusGeometry(.09, .018, 8, 16), gold); hd.position.set(-s * 1.15, 1.1, .07); door.add(hd); scene.add(door); Rm.door = door;
    const rune = K.sprite(T, k === 'a' ? 0xf4a8b8 : 0x9cc7ff, 1.3, 0); rune.position.set(s * 4, 2.75, -3.95); scene.add(rune); Rm.rune = rune;
    // Teppich, Bücherregal, Deckenlaterne
    const cp = add(new T.PlaneGeometry(3.2, 2.2), new T.MeshStandardMaterial({roughness: .95, map: R.paint(T, 320, 220, (g, w, h) => {
      g.fillStyle = k === 'a' ? '#7a2c44' : '#2c4470'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9ad62'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24); g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
      R.sym(g, 0, w / 2, h / 2, 44, '#e8c080'); for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } })}), s * 5, .012, 1.3, false); cp.rotation.x = -Math.PI / 2;
    const bs = add(new T.BoxGeometry(2.05, 2.5, .5), darkWood, s * 1.6, 1.25, 3.85);
    const bf = add(new T.PlaneGeometry(1.9, 2.36), new T.MeshStandardMaterial({roughness: .85, map: R.paint(T, 380, 472, (g, w, h) => {
      g.fillStyle = '#20150e'; g.fillRect(0, 0, w, h); const rr = R.rng(4 + s);
      for (let sh = 0; sh < 5; sh++) { let x = 6; const y = sh * 94 + 6; while (x < w - 14) { const bw = 12 + rr() * 16, bh = 62 + rr() * 22; g.fillStyle = ['#7a2c2c', '#2c4a6a', '#3a5a34', '#8a6a2a', '#5a3060', '#a08060'][(rr() * 6) | 0]; g.fillRect(x, y + 84 - bh, bw - 2, bh); g.fillStyle = 'rgba(243,201,143,.6)'; g.fillRect(x + 2, y + 84 - bh + 8, bw - 6, 3); x += bw; } g.fillStyle = '#4a3222'; g.fillRect(0, y + 84, w, 8); } })}), s * 1.6, 1.25, 3.595, false); bf.rotation.y = Math.PI; void bs;
    add(new T.CylinderGeometry(.012, .012, .5, 6), iron, s * 4.3, HH - .25, .2, false);
    add(new T.CylinderGeometry(.16, .12, .3, 8), new T.MeshBasicMaterial({color: 0xffd9a0}), s * 4.3, HH - .62, .2, false);
    const lg = K.sprite(T, 0xffc880, 1.6, .5); lg.position.set(s * 4.3, HH - .62, .2); scene.add(lg);
    const sp = new T.SpotLight(0xffd2a0, .9, 13, 1.2, .6, 1.3); sp.position.set(s * 4.3, HH - .7, .2); sp.target.position.set(s * 4.3, 0, .2);
    sp.castShadow = own && !!API.SET.fx; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -.002; sp.shadow.camera.near = .3; sp.shadow.camera.far = 12; scene.add(sp); scene.add(sp.target);
  }
  // Halle: Läufer, Herz-Mosaik, Kronleuchter, Wappen
  for (const s of [-1, 1]) { const r = add(new T.PlaneGeometry(1.3, 4.4), new T.MeshStandardMaterial({color: 0x6e2030, roughness: .95}), s * 4, .012, -6.2, false); r.rotation.x = -Math.PI / 2; }
  const run = add(new T.PlaneGeometry(9.3, 1.3), new T.MeshStandardMaterial({color: 0x6e2030, roughness: .95}), 0, .011, -7.75, false); run.rotation.x = -Math.PI / 2;
  const heart = add(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({transparent: true, depthWrite: false, map: R.paint(T, 256, 256, (g, w) => { g.clearRect(0, 0, w, w); const gr = g.createRadialGradient(128, 128, 10, 128, 128, 124); gr.addColorStop(0, 'rgba(243,201,143,.9)'); gr.addColorStop(1, 'rgba(243,201,143,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); R.sym(g, 0, 128, 132, 78, '#c8405f'); })}), 0, .02, -7.75, false); heart.rotation.x = -Math.PI / 2;
  const hl = new T.PointLight(0xffc890, 1.25, 15, 1.4); hl.position.set(0, 2.7, -7.5); scene.add(hl);
  add(new T.TorusGeometry(.6, .04, 8, 28), gold, 0, 2.8, -7.5, false).rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, f = K.sprite(T, 0xffc070, .5, .9); f.position.set(Math.cos(a) * .6, 2.95, -7.5 + Math.sin(a) * .6); scene.add(f); }
  const ban = add(new T.PlaneGeometry(2.4, 2.6), new T.MeshStandardMaterial({roughness: .9, map: R.paint(T, 240, 260, (g, w, h) => { g.fillStyle = '#3a1830'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9ad62'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#f3d9a0'; g.textAlign = 'center'; g.font = '700 66px Georgia, serif'; g.fillText(nm('a')[0], 62, 120); g.fillText(nm('d')[0], 178, 120); R.sym(g, 0, 120, 100, 22, '#f48aa3'); g.font = '600 22px Georgia, serif'; g.fillText('Zwei Lichter', 120, 200); })}), 0, 1.9, -10.19, false); void ban;
  // Figuren
  const figs = {a: K.princess(T), d: K.prince(T)};
  for (const k of ['a', 'd']) { figs[k].scale.setScalar(.72); R.shadows(figs[k], true, false); scene.add(figs[k]); figs[k].visible = k !== me; }
  const upd = decor(T, scene, R, K, add, {gold, iron, darkWood}, me);
  return {scene, cam, rooms, lampsM, lampLight, symTex, inter, figs, ray: new T.Raycaster(), hl, upd};
}

/* Was liegt unter dem Finger bzw. in der Bildmitte? */
function pick(M, sx, sy) {
  const s = API.screen(), T = window.THREE;
  M.ray.setFromCamera(new T.Vector2(sx / s.cw * 2 - 1, -(sy / s.ch) * 2 + 1), M.cam);
  const hit = M.ray.intersectObjects(M.inter, false)[0];
  if (!hit || hit.distance > 3.7) return null;
  const u = hit.object.userData.u; return u.o === API.me ? u : null;
}
function use(u) {
  const A = S.aux, me = API.me;
  if (u.d.k === 'wheel') { if (A.ok1[me]) { toast('Deine Truhe ist schon offen.'); return; } }
  else if (u.d.k === 'lever') { if (A.st < 2) { toast('Die Hebel klemmen noch – erst müssen beide Truhen offen sein.'); return; } if (A.st > 2) return; }
  act(u.d);
}

const zimmer = {
  id: 'zimmer', n: 'Zwei Zimmer', ic: '⚿', t3: 300, t2: 480, ctrl: 'fps', three: true, noClamp: true, cross: true, isNew: true, eAngle: [0],
  skinName: () => 'Ich-Perspektive · Rätsel',
  h: k => `Ihr seid im alten Schloss eingeschlossen – jeder in seinem eigenen Zimmer, nur ein Gitterfenster verbindet euch. Der Haken: Die Hinweise für deine Rätsel hängen bei ${nm(OTH(k))}, und ${nm(OTH(k))}s Hinweise bei dir. Drei Rätsel öffnen die Türen. Redet miteinander!`,
  ctrlText: () => 'Linker Daumen: laufen. Rechter Daumen: umsehen. Räder und Hebel tippst du einfach an.',
  start: k => { const h = HOME(k); return {x: h.x * U, y: h.z * U}; },
  countText: () => `Rätsel ${Math.min(S.aux.st, 3)}/3`,
  staticAux: ['code', 'path'],
  setup() {
    const code = {}, wh = {};
    for (const k of ['a', 'd']) {
      const pool = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
      code[k] = pool.slice(0, 4); do { wh[k] = [0, 1, 2, 3].map(() => (Math.random() * 6) | 0); } while (wh[k].some((v, i) => v === code[k][i]));
    }
    let l0 = 31;
    for (let n = 0; n < 200; n++) {
      const pa = [0, 1, 2].map(() => Math.random() < .5), pd = [0, 1, 2].map(() => Math.random() < .5), cnt = pa.filter(Boolean).length + pd.filter(Boolean).length;
      if (cnt < 3 || !pa.some(Boolean) || !pd.some(Boolean)) continue;
      let v = 31; pa.forEach((on, i) => { if (on) v ^= LVEC.a[i]; }); pd.forEach((on, i) => { if (on) v ^= LVEC.d[i]; });
      if (v !== 31) { l0 = v; break; }
    }
    if (l0 === 31) l0 = 31 ^ LVEC.a[0] ^ LVEC.d[1] ^ LVEC.d[2];
    S.aux = {st: 1, code, wh, ok1: {a: 0, d: 0}, l0, lev: {a: [0, 0, 0], d: [0, 0, 0]}, path: {a: mkPath(), d: mkPath()}, tl: {a: 0, d: 0}, door: {a: 0, d: 0}, tf: {a: 0, d: 0}};
    S.total = 4;
  },
  posExtra: () => LOC.fp ? [Math.round(LOC.fp.yaw * 100) / 100] : null,
  move(dt, inp) {
    const R = window.ZL_REAL(API), st = R.fp(LOC, 0), f = inp.fps; if (!f) return;
    R.look(st, f);
    const d = R.step(st, f, 3, dt), p = {x: mine.x / U + d.dx, z: mine.y / U + d.dz};
    R.push(p, rects(), .34);
    p.x = clamp(p.x, -7.62, 7.62); p.z = clamp(p.z, -9.82, 3.82);
    mine.x = p.x * U; mine.y = p.z * U;
    const M = LOC.M; if (!M) return;
    const sc = API.screen();
    for (const tp of f.taps) { const u = pick(M, tp.x, tp.y); if (u) { use(u); return; } }
    if (f.use) { const u = pick(M, sc.cw / 2, sc.ch / 2); if (u) use(u); }
  },
  action(k, d) {
    const A = S.aux;
    if (d.k === 'wheel' && A.st === 1 && !A.ok1[k]) {
      const i = d.i | 0; if (i < 0 || i > 3) return;
      A.wh[k][i] = (A.wh[k][i] + 1) % 6; emit({k: 'click', o: k});
      if (A.wh[k].every((v, j) => v === A.code[k][j])) {
        A.ok1[k] = 1; emit({k: 'open', x: 0, y: 0, o: k}); emit({k: 'toast', txt: `Klack – ${nm(k)}s Truhe springt auf!`});
        if (A.ok1.a && A.ok1.d) { A.st = 2; S.count = 1; emit({k: 'round', x: 0, y: 0}); emit({k: 'toast', txt: 'In den Truhen lagen die Hebelgriffe. Jetzt lassen sich die Hebel an der Gitterwand bewegen!'}); }
      }
    } else if (d.k === 'lever' && A.st === 2) {
      const i = d.i | 0; if (i < 0 || i > 2) return;
      A.lev[k][i] ^= 1; emit({k: 'flip', o: k});
      if (lamps(A) === 31) {
        A.st = 3; S.count = 2; emit({k: 'lit'}); emit({k: 'toast', txt: 'Alle fünf Lampen brennen! Die Bodenplatten vor euren Türen erwachen …'});
        // wer gerade auf den Platten steht, wird freundlich zurückgestellt
        for (const q of ['a', 'd']) { const u = S.p[q].x / U * sgn(q), z = S.p[q].y / U; if (u > 1.8 && u < 6.2 && z < .2 && z > -4.2) { const h = HOME(q); teleport(q, h.x * U, h.z * U); } }
      }
    }
  },
  update() {
    const A = S.aux;
    if (A.st === 3) {
      for (const k of ['a', 'd']) {
        if (A.door[k] || S.t < A.tf[k]) continue;
        const p = S.p[k], i = tileOf(k, p.x / U, p.y / U); if (i < 0) continue;
        const path = A.path[k];
        if (!path.includes(i)) {
          A.tl[k] = 0; A.tf[k] = S.t + 1.2; const h = HOME(k); teleport(k, h.x * U, h.z * U);
          emit({k: 'wrong', x: 0, y: 0}); emit({k: 'toast', txt: `Falsche Platte! ${nm(k)} steht wieder am Anfang.`});
        } else if (!(A.tl[k] >> i & 1)) {
          A.tl[k] |= 1 << i; emit({k: 'tick', o: k, x: 0, y: 0});
          if (i === path[path.length - 1]) {
            A.door[k] = 1; emit({k: 'creak'}); emit({k: 'toast', txt: `${nm(k)}s Tür schwingt auf!`});
            if (A.door.a && A.door.d) { A.st = 4; S.count = 3; emit({k: 'toast', txt: 'Beide Türen sind offen – trefft euch in der Halle!'}); }
          }
        }
      }
    } else if (A.st === 4) {
      const a = S.p.a, d = S.p.d;
      if (a.y / U < -4.5 && d.y / U < -4.5 && Math.hypot(a.x - d.x, a.y - d.y) / U < 1.7) { S.count = 4; emit({k: 'meet', x: 0, y: 0}); finish(2.8); }
    }
  },
  render3d(t, part) {
    const T = window.THREE, K = window.ZL_KIT(API), R = window.ZL_REAL(API), sc = API.screen();
    if (!S.aux.code || !S.aux.path) return;
    if (!LOC.M) { LOC.M = build(T); LOC.__dispose = () => API.disposeTree(LOC.M.scene); }
    const M = LOC.M, A = S.aux, me = API.me, ot = API.other, st = R.fp(LOC, 0), now = hostNow();
    const dt = Math.min(.05, Math.max(0, t - (M.lt || t))); M.lt = t;
    const lv = lamps(A);
    for (const k of ['a', 'd']) {
      const Rm = M.rooms[k], s = sgn(k);
      Rm.wheels.forEach((w, i) => { const v = A.wh[k][i]; if (w.cur !== v) { if (w.cur >= 0) w.t = t; w.cur = v; w.mat.map = M.symTex[v]; } const q = clamp((t - w.t) / .22, 0, 1); w.g.rotation.x = (1 - q) * -1.2; });
      const lo = A.ok1[k] ? 1.2 : 0; Rm.lid.rotation.x += (lo - Rm.lid.rotation.x) * Math.min(1, dt * 5);
      Rm.treasure.material.opacity = A.ok1[k] ? .5 + Math.sin(t * 3) * .12 : 0;
      Rm.levers.forEach((l, i) => { const want = -s * (.9 + (A.lev[k][i] ? Math.PI - 1.8 : 0)); l.ang += (want - l.ang) * Math.min(1, dt * 12); l.pv.rotation.z = l.ang; });
      const path = A.path[k] || [];
      Rm.tiles.forEach((tl, i) => {
        let e = 0, c = 0xf3b040;
        if (A.st >= 3) { if (A.tl[k] >> i & 1 || A.door[k] && path.includes(i)) e = 1.1; else if (now < A.tf[k]) { e = .9 * (.5 + .5 * Math.sin(t * 20)); c = 0xff4030; } else e = .1 + .05 * Math.sin(t * 2 + i); }
        tl.m.emissive.set(c); tl.m.emissiveIntensity = e; tl.t.position.y = .03 - (A.tl[k] >> i & 1 ? .02 : 0);
      });
      const dw = A.door[k] ? -s * 1.45 : 0; Rm.door.rotation.y += (dw - Rm.door.rotation.y) * Math.min(1, dt * 2.2);
      Rm.rune.material.opacity = A.door[k] ? .7 : A.st === 3 ? .25 + .15 * Math.sin(t * 3) : 0;
      Rm.cand.forEach(c => { const f = 1 + Math.sin(t * 11 + c.ph) * .08 + Math.sin(t * 23 + c.ph * 2) * .05; c.fsp.scale.set(.42 * f, .52 * f, 1); if (c.pl) c.pl.intensity = .95 * f; });
    }
    let on = 0;
    M.lampsM.forEach((l, i) => { const lit = lv >> i & 1; on += lit; l.m.emissiveIntensity += ((lit ? .9 : 0) - l.m.emissiveIntensity) * Math.min(1, dt * 10); l.sp.material.opacity = lit ? .4 : 0; l.m.color.set(lit ? 0xffd9a0 : 0x3a3028); });
    M.lampLight.intensity = on * .32;
    M.hl.intensity = 1.2 + Math.sin(t * 9) * .06; M.upd.forEach(f => f(t, dt));
    // Partner-Figur
    const f = M.figs[ot]; f.position.set(part.x / U, 0, part.y / U); f.rotation.y = part.e ? part.e[0] : 0;
    const pm = M.pp ? Math.hypot(part.x - M.pp.x, part.y - M.pp.y) > .4 : false; M.pp = {x: part.x, y: part.y}; K.animFigure(f, t, pm);
    // Kamera in Augenhöhe
    M.cam.position.set(mine.x / U, EYE + Math.sin(st.bob) * .03 * Math.min(1, st.mv), mine.y / U); M.cam.rotation.set(st.pitch, st.yaw, 0);
    M.cam.aspect = sc.cw / sc.ch; M.cam.fov = sc.cw < sc.ch ? 86 : 64; M.cam.updateProjectionMatrix(); M.cam.updateMatrixWorld();
    API.render3D(M.scene, M.cam, {bloom: .75, th: .72});
    // Anzeige: Name des Partners, Aufgabe, Hinweis zum Antippen
    const pp = K.proj(M.cam, new T.Vector3(part.x / U, 1.95, part.y / U)); if (pp.ok && pp.x > 30 && pp.x < sc.cw - 30 && pp.y > 90) K.nameTag(nm(ot), pp.x, pp.y, COL[ot]);
    if (S.phase === 'play' || S.phase === 'count') {
      const o = nm(ot);
      const txt = A.st === 1 ? (A.ok1[me] ? `① Deine Truhe ist offen. Hilf ${o}: Sag die vier Symbole von deinem Gemälde an, von links nach rechts.` : `① An deiner Außenwand hängt ein Gemälde mit dem Code für ${o}s Truhe. Sagt euch die Symbole an und stellt sie an den Rädern eurer Truhe ein.`)
        : A.st === 2 ? `② Alle fünf Lampen über dem Gitter sollen brennen. Dein Pergament zeigt, was ${o}s Hebel schalten. Überlegt gemeinsam, wer welchen Hebel umlegt.`
        : A.st === 3 ? (A.door[me] ? `③ Deine Tür ist offen! Lotse ${o} mit der Karte an deiner Wand über die Platten.` : `③ Vor deiner Tür ist nur ein Weg über die Platten sicher. ${o} sieht ihn auf der Karte an der Wand und lotst dich.`)
        : 'Beide Türen sind offen – trefft euch in der Halle auf dem Herz!';
      R.note(txt, 64);
      const u = pick(M, sc.cw / 2, sc.ch / 2); LOC.useLabel = u ? u.lab : null;
      if (A.st === 2) R.note(`Lampen an: ${on} von 5`, sc.ch - 200, {size: 13});
    } else LOC.useLabel = null;
  }
};
return [zimmer];
});
