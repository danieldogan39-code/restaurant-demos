/* Zwei Lichter – Werkstatt für die realistischen 3D-Welten (ab Version 8)
   Oberflächen mit Relief (Stein, Holz, Marmor, Waldboden, Rinde, Fels), Himmel mit Wolken und Sternen,
   Wasser mit Spiegelung, Wald, Felsen, Schattenlicht und die Ich-Perspektive. */
window.ZL_REAL = (() => {
  let cache = null;
  return API => {
    if (cache) return cache;
    const {clamp, TAU, ctx} = API, R = {U: 50}, TX = {};
    const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    R.rng = rng;
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
    const rrect = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
    R.rrect = rrect;

    /* ---------- Relief (Normal-Map) aus der Helligkeit einer Zeichnung ---------- */
    function normalFrom(src, strength) {
      const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h).data, out = canvas(w, h), og = out.getContext('2d'), od = og.createImageData(w, h), d = od.data;
      const H = (x, y) => { const i = (((y + h) % h) * w + ((x + w) % w)) * 4; return (sd[i] * .3 + sd[i + 1] * .59 + sd[i + 2] * .11) / 255; };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
        d[i] = (-dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
      }
      og.putImageData(od, 0, 0); return out;
    }
    function tex(T, key, size, draw, o = {}) {
      if (!TX[key]) {
        const c = canvas(size); draw(c.getContext('2d'), size, rng(o.seed || 7));
        const mk = cv => { const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
        TX[key] = {map: mk(c), nm: o.bump ? mk(normalFrom(c, o.bump)) : null};
      }
      return TX[key];
    }
    const speck = (g, n, r, cols, size, a) => { const W = g.canvas.width; for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.globalAlpha = a * (.3 + r() * .7); const s = size * (.4 + r()); g.fillRect(r() * W, r() * W, s, s); } g.globalAlpha = 1; };
    const DEF = {
      stone: T => tex(T, 'stone', 512, (g, n, r) => {
        g.fillStyle = '#2b2724'; g.fillRect(0, 0, n, n);
        const rows = 8, bh = n / rows;
        for (let y = 0; y < rows; y++) {
          let x = (y % 2) * -48 - r() * 24; const x0 = x;
          while (x < n + x0) {
            let bw = 64 + r() * 74; if (n + x0 - x - bw < 44) bw = n + x0 - x;
            const v = 92 + r() * 46, t = r() * 10;
            for (const ox of [0, -n, n]) { g.fillStyle = `rgb(${v + t + 8 | 0},${v + 3 | 0},${v - 9 | 0})`; rrect(g, x + ox + 3, y * bh + 3, bw - 6, bh - 6, 8); g.fill(); g.fillStyle = 'rgba(255,255,255,.07)'; rrect(g, x + ox + 6, y * bh + 6, bw - 12, bh * .3, 6); g.fill(); }
            x += bw;
          }
        }
        speck(g, 5200, r, ['#000', '#fff', '#5a4a3a', '#000'], 2.4, .12);
      }, {bump: 6, seed: 11}),
      wood: T => tex(T, 'wood', 512, (g, n, r) => {
        const pw = n / 5;
        for (let i = 0; i < 5; i++) {
          const v = r() * 22; g.fillStyle = `rgb(${96 + v | 0},${66 + v * .7 | 0},${40 + v * .4 | 0})`; g.fillRect(i * pw, 0, pw, n);
          for (let k = 0; k < 46; k++) { g.strokeStyle = r() < .5 ? 'rgba(40,22,10,.22)' : 'rgba(190,150,110,.12)'; g.lineWidth = .6 + r() * 1.6; const x = i * pw + r() * pw, w = (r() - .5) * 8; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + w, n * .3, x - w, n * .7, x, n); g.stroke(); }
          if (r() < .7) { const kx = i * pw + pw * (.25 + r() * .5), ky = r() * n; g.fillStyle = 'rgba(45,26,12,.55)'; g.beginPath(); g.ellipse(kx, ky, 5 + r() * 5, 9 + r() * 8, 0, 0, TAU); g.fill(); }
          g.fillStyle = 'rgba(18,10,5,.8)'; g.fillRect(i * pw - 1.5, 0, 3, n);
          const cut = r() * n; g.fillRect(i * pw, cut, pw, 2.5);
        }
      }, {bump: 3.5, seed: 5}),
      marble: T => tex(T, 'marble', 512, (g, n, r) => {
        const h = n / 2;
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
          const dark = (x + y) % 2; g.fillStyle = dark ? '#585f66' : '#d9d2c6'; g.fillRect(x * h, y * h, h, h);
          g.save(); g.beginPath(); g.rect(x * h, y * h, h, h); g.clip();
          for (let k = 0; k < 16; k++) { g.strokeStyle = dark ? `rgba(215,220,226,${.06 + r() * .16})` : `rgba(120,104,92,${.06 + r() * .16})`; g.lineWidth = .5 + r() * 2.2; let px = x * h + r() * h, py = y * h + r() * h; g.beginPath(); g.moveTo(px, py); for (let q = 0; q < 5; q++) { px += (r() - .5) * 130; py += (r() - .5) * 130; g.lineTo(px, py); } g.stroke(); }
          g.restore();
        }
        g.fillStyle = '#3a3a3c'; g.fillRect(0, 0, n, 2); g.fillRect(0, h - 1, n, 2); g.fillRect(0, 0, 2, n); g.fillRect(h - 1, 0, 2, n);
      }, {bump: .8, seed: 3}),
      ground: T => tex(T, 'ground', 512, (g, n, r) => {
        g.fillStyle = '#2b2a1d'; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 260; i++) { g.fillStyle = ['rgba(52,66,34,.5)', 'rgba(66,50,32,.5)', 'rgba(30,38,24,.6)', 'rgba(84,70,44,.35)'][(r() * 4) | 0]; g.beginPath(); g.ellipse(r() * n, r() * n, 8 + r() * 30, 6 + r() * 22, r() * 3, 0, TAU); g.fill(); }
        for (let i = 0; i < 520; i++) { g.fillStyle = ['#6a5226', '#7d5a22', '#4d5a2a', '#8a6a34', '#3d3220'][(r() * 5) | 0]; g.globalAlpha = .55 + r() * .4; g.beginPath(); g.ellipse(r() * n, r() * n, 2 + r() * 5, 1 + r() * 2.4, r() * 3, 0, TAU); g.fill(); }
        g.globalAlpha = 1;
        for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(28,20,12,.8)'; g.lineWidth = 1 + r() * 1.6; const x = r() * n, y = r() * n, a = r() * TAU, l = 10 + r() * 26; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
        speck(g, 3000, r, ['#000', '#9a8a60'], 2, .14);
      }, {bump: 4, seed: 23}),
      bark: T => tex(T, 'bark', 256, (g, n, r) => {
        g.fillStyle = '#3b2d22'; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 150; i++) { g.strokeStyle = r() < .55 ? 'rgba(16,10,6,.6)' : 'rgba(110,88,66,.35)'; g.lineWidth = 1 + r() * 4; const x = r() * n, y = r() * n, l = 30 + r() * 90; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - .5) * 12, y + l * .3, x + (r() - .5) * 12, y + l * .7, x + (r() - .5) * 8, y + l); g.stroke(); }
      }, {bump: 5, seed: 31}),
      rock: T => tex(T, 'rock', 256, (g, n, r) => {
        g.fillStyle = '#6a655f'; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 180; i++) { const v = 70 + r() * 80; g.fillStyle = `rgba(${v | 0},${v - 4 | 0},${v - 10 | 0},.4)`; g.beginPath(); g.ellipse(r() * n, r() * n, 6 + r() * 26, 5 + r() * 18, r() * 3, 0, TAU); g.fill(); }
        for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(20,18,16,.6)'; g.lineWidth = .8 + r() * 1.4; let x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 4; q++) { x += (r() - .5) * 50; y += (r() - .5) * 50; g.lineTo(x, y); } g.stroke(); }
        speck(g, 1800, r, ['#000', '#fff'], 2, .12);
      }, {bump: 5, seed: 41})
    };
    /* Relief-Textur aus einer eigenen Zeichnung (für Asphalt, Sand, Hecken …) */
    R.canvas = canvas;
    R.nmap = (T, cv, strength) => { const t = new T.CanvasTexture(normalFrom(cv, strength)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
    /* Material mit Relief; rx, ry = wie oft sich die Oberfläche wiederholt */
    R.pbr = (T, key, rx = 1, ry = 1, o = {}) => {
      const t = DEF[key](T), map = t.map.clone(); map.repeat.set(rx, ry); map.needsUpdate = true;
      const p = Object.assign({map, roughness: .86, metalness: 0}, o);
      if (t.nm) { const nm = t.nm.clone(); nm.repeat.set(rx, ry); nm.needsUpdate = true; p.normalMap = nm; }
      return new T.MeshStandardMaterial(p);
    };
    /* Einmalige Zeichnung als Textur (Gemälde, Pläne, Schilder) */
    R.paint = (T, w, h, draw) => { const c = canvas(w, h); draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; };
    R.parchment = (g, w, h, seed = 1) => {
      const r = rng(seed), gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * .75); gr.addColorStop(0, '#ead9b4'); gr.addColorStop(1, '#b79a66');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { g.fillStyle = r() < .5 ? 'rgba(90,60,20,.07)' : 'rgba(255,245,220,.08)'; g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 4); }
      g.strokeStyle = 'rgba(80,52,20,.55)'; g.lineWidth = 5; g.strokeRect(7, 7, w - 14, h - 14);
    };

    /* ---------- Symbole für Rätsel ---------- */
    R.SYM = ['Herz', 'Stern', 'Mond', 'Sonne', 'Blume', 'Kerze'];
    R.sym = (g, i, x, y, s, col) => {
      g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
      const C = col || ['#c8405f', '#c98a1c', '#3d5fa8', '#d2691e', '#a04a9a', '#3f7d55'][i]; g.fillStyle = C; g.strokeStyle = C;
      if (i === 0) { g.beginPath(); g.moveTo(0, s * .85); g.bezierCurveTo(-s * 1.45, -s * .1, -s * .72, -s * 1.2, 0, -s * .42); g.bezierCurveTo(s * .72, -s * 1.2, s * 1.45, -s * .1, 0, s * .85); g.fill(); }
      else if (i === 1) { g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? s * .42 : s, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
      else if (i === 2) { g.beginPath(); g.arc(0, 0, s * .92, .35 * Math.PI, 1.65 * Math.PI); g.quadraticCurveTo(-s * .05, 0, Math.cos(.35 * Math.PI) * s * .92, Math.sin(.35 * Math.PI) * s * .92); g.fill(); }
      else if (i === 3) { g.lineWidth = s * .16; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * s * .68, Math.sin(a) * s * .68); g.lineTo(Math.cos(a) * s, Math.sin(a) * s); g.stroke(); } g.beginPath(); g.arc(0, 0, s * .48, 0, TAU); g.fill(); }
      else if (i === 4) { for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g.beginPath(); g.ellipse(Math.cos(a) * s * .52, Math.sin(a) * s * .52, s * .4, s * .26, a, 0, TAU); g.fill(); } g.fillStyle = '#e8b93c'; g.beginPath(); g.arc(0, 0, s * .25, 0, TAU); g.fill(); }
      else { g.fillRect(-s * .3, -s * .1, s * .6, s * 1.05); g.fillStyle = '#e08a1e'; g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * .34, -s * .45, 0, -s * .22); g.quadraticCurveTo(-s * .34, -s * .45, 0, -s); g.fill(); }
      g.restore();
    };

    /* ---------- Himmel ---------- */
    const SKYFN = `uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunC;
      vec3 skyCol(vec3 d){ float h = clamp(d.y, 0., 1.); vec3 c = mix(uHor, uZen, pow(h, .5)); float s = max(dot(d, uSun), 0.); c += uSunC * (pow(s, 6.) * .2 + pow(s, 40.) * .3); return c; }`;
    const NOISE = `float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }`;
    R.sky = (T, o) => {
      const u = {uZen: {value: new T.Color(o.zen)}, uHor: {value: new T.Color(o.hor)}, uSun: {value: o.sun.clone().normalize()}, uSunC: {value: new T.Color(o.sunC)}, tm: {value: 0},
        uCloud: {value: o.cloud || 0}, uCloudC: {value: new T.Color(o.cloudC || 0xffffff)}, uStars: {value: o.stars || 0}, uDisc: {value: o.disc != null ? o.disc : 1}};
      const m = new T.ShaderMaterial({side: T.BackSide, depthWrite: false, fog: false, uniforms: u,
        vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `varying vec3 vD; uniform float tm; uniform float uCloud; uniform vec3 uCloudC; uniform float uStars; uniform float uDisc; ${SKYFN} ${NOISE}
          float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 7.; a *= .5; } return s; }
          void main(){ vec3 d = normalize(vD); vec3 c = skyCol(d); float s = max(dot(d, uSun), 0.);
            c += uSunC * smoothstep(.9990, .9995, s) * uDisc;
            if (uStars > 0. && d.y > 0.) { vec2 g = d.xz / (d.y + .4) * 70.; vec2 id = floor(g); float st = step(.985, h2(id)) * (1. - smoothstep(.08, .45, length(fract(g) - .5)));
              c += st * uStars * (.55 + .45 * sin(tm * 2. + h2(id + 3.) * 40.)) * smoothstep(0., .2, d.y); }
            if (uCloud > 0. && d.y > -.02) { vec2 p = d.xz / (d.y + .22) * 1.3 + vec2(tm * .01, tm * .004); float n = fbm(p);
              float cl = smoothstep(1. - uCloud * .62, 1.32 - uCloud * .62, n) * smoothstep(-.02, .2, d.y);
              vec3 lit = uCloudC * (.5 + .5 * pow(s, 3.)) + uSunC * pow(s, 12.) * .35; c = mix(c, lit, cl * .85); }
            gl_FragColor = vec4(c, 1.); }`});
      const mesh = new T.Mesh(new T.SphereGeometry(o.r || 900, 32, 20), m); mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.userData.u = u; return mesh;
    };
    /* ---------- Wasser: Wellen, Spiegelung des Himmels, Sonnenglitzern ---------- */
    R.water = (T, sky, o = {}) => {
      const su = sky.userData.u, u = {tm: su.tm, uZen: su.uZen, uHor: su.uHor, uSun: su.uSun, uSunC: su.uSunC, uDeep: {value: new T.Color(o.deep || 0x0b2c40)}, uFogD: {value: o.fog || .003}, uRip: {value: Array.from({length: 6}, () => new T.Vector4(0, 0, -99, 0))}};
      const m = new T.ShaderMaterial({uniforms: u, fog: false,
        vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `varying vec3 vW; uniform float tm; uniform vec3 uDeep; uniform float uFogD; uniform vec4 uRip[6]; ${SKYFN} ${NOISE}
          vec2 wv(vec2 p, vec2 d, float f, float sp, float a){ return d * f * a * cos(dot(p, d) * f + tm * sp); }
          void main(){ vec2 p = vW.xz; float dist = length(cameraPosition - vW); float att = 1. / (1. + dist * .018);
            vec2 g = wv(p, vec2(.958, .287), .33, 1.0, .2) + wv(p, vec2(-.514, .857), .58, 1.3, .1) + wv(p, vec2(.371, -.928), 1.25, 1.9, .05)
              + wv(p, vec2(-.894, -.447), 2.6, 2.6, .028) + wv(p, vec2(.664, .747), 5.1, 3.4, .015);
            float e = .09, n0 = vn(p * 2.6 + tm * .5), nx = vn(p * 2.6 + vec2(e, 0.) + tm * .5), nz = vn(p * 2.6 + vec2(0., e) + tm * .5);
            g += vec2(nx - n0, nz - n0) / e * .06;
            // Ringe von Paddelschlägen
            for (int i = 0; i < 6; i++) { vec4 r = uRip[i]; float age = tm - r.z; if (age < 0. || age > 3.) continue; vec2 q = p - r.xy; float l = length(q) + .001, rad = age * 2.4;
              float e1 = (l - rad) / .5, k = exp(-e1 * e1) * (1. - age / 3.) * r.w; g += q / l * cos((l - rad) * 5.) * k * .9; }
            g *= mix(.3, 1., att);
            vec3 N = normalize(vec3(-g.x, 1., -g.y)), V = normalize(cameraPosition - vW);
            float F = .03 + .97 * pow(1. - max(dot(N, V), 0.), 5.);
            vec3 Rr = reflect(-V, N); Rr.y = abs(Rr.y);
            float sd = max(dot(Rr, uSun), 0.);
            vec3 c = mix(uDeep, skyCol(Rr), F) + uSunC * (pow(sd, 260.) * 1.5 + pow(sd, 28.) * .2);
            float fg = 1. - exp(-dist * uFogD); c = mix(c, uHor, clamp(fg, 0., 1.));
            gl_FragColor = vec4(c, 1.); }`});
      const mesh = new T.Mesh(new T.PlaneGeometry(o.size || 4000, o.size || 4000), m); mesh.rotation.x = -Math.PI / 2; mesh.userData.u = u; return mesh;
    };

    /* ---------- Bäume, Büsche, Felsen ---------- */
    const wob = (geo, amt, seed) => { const pa = geo.attributes.position, r = rng(seed); const cache2 = {}; for (let i = 0; i < pa.count; i++) { const key = pa.getX(i).toFixed(2) + ',' + pa.getY(i).toFixed(2) + ',' + pa.getZ(i).toFixed(2); const d = cache2[key] || (cache2[key] = [(r() - .5) * amt, (r() - .5) * amt * .6, (r() - .5) * amt]); pa.setXYZ(i, pa.getX(i) + d[0], pa.getY(i) + d[1], pa.getZ(i) + d[2]); } geo.computeVertexNormals(); return geo; };
    /* pts: [{x, z, s}] – Nadelbäume als wenige gemeinsame Zeichenaufrufe */
    R.forest = (T, pts, o = {}) => {
      const g = new T.Group(), n = pts.length, r = rng(o.seed || 77), D = new T.Object3D(), col = new T.Color(), hi = o.high || 0;
      const trunk = new T.InstancedMesh(new T.CylinderGeometry(.15, .32, 4.2 + hi, 8), R.pbr(T, 'bark', 2, 3 + hi, {roughness: 1}), n);
      const leafM = new T.MeshStandardMaterial({color: 0xffffff, roughness: .95, flatShading: true});
      const lay = [[2.0, 2.7, 2.7], [1.55, 2.4, 4.2], [1.05, 2.1, 5.6], [.55, 1.5, 6.8]].map(([rad, h, y], i) => ({im: new T.InstancedMesh(wob(new T.ConeGeometry(rad * (o.wide || 1), h, 9, 2), .3, 5 + i), leafM, n), y: y + hi}));
      pts.forEach((p, i) => {
        const s = p.s || 1, ry = r() * TAU, tilt = (r() - .5) * .08;
        const by = p.y || 0; D.position.set(p.x, by + (2.1 + hi / 2) * s, p.z); D.rotation.set(tilt, ry, tilt); D.scale.setScalar(s); D.updateMatrix(); trunk.setMatrixAt(i, D.matrix);
        const v = r(); col.setRGB(.07 + v * .07, .17 + v * .13, .1 + v * .06); if (o.tint) col.multiply(o.tint);
        lay.forEach(L => { D.position.set(p.x, by + L.y * s, p.z); D.rotation.set(tilt, ry + L.y, tilt); D.updateMatrix(); L.im.setMatrixAt(i, D.matrix); L.im.setColorAt(i, col); });
      });
      for (const im of [trunk, ...lay.map(L => L.im)]) { im.castShadow = !o.noShadow; im.receiveShadow = true; im.frustumCulled = false; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
      return g;
    };
    R.bushes = (T, pts, o = {}) => {
      const n = pts.length, r = rng(o.seed || 99), D = new T.Object3D(), col = new T.Color();
      const im = new T.InstancedMesh(wob(new T.IcosahedronGeometry(1, 2), .3, 12), new T.MeshStandardMaterial({color: 0xffffff, roughness: 1, flatShading: true}), n);
      pts.forEach((p, i) => { const s = p.s || 1; D.position.set(p.x, (p.y || 0) + .55 * s, p.z); D.rotation.set(0, r() * TAU, 0); D.scale.set(s * (1 + r() * .4), s * (.6 + r() * .3), s * (1 + r() * .4)); D.updateMatrix(); im.setMatrixAt(i, D.matrix); const v = r(); col.setRGB(.035 + v * .045, .09 + v * .08, .045 + v * .04); im.setColorAt(i, col); });
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.instanceColor.needsUpdate = true; return im;
    };
    R.rock = (T, rad, seed = 1, o = {}) => {
      const geo = new T.SphereGeometry(rad, 18, 12), pa = geo.attributes.position, v = new T.Vector3(), a = seed * 1.7;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); const n = v.clone().normalize(); const k = 1 + .2 * Math.sin(n.x * 3.1 + a) * Math.cos(n.z * 2.7 + a * 2.) + .12 * Math.sin(n.y * 6. + n.x * 4. + a) + .07 * Math.sin(n.z * 9. + a * 3.); pa.setXYZ(i, v.x * k, v.y * k * (o.flat || .7), v.z * k); }
      geo.computeVertexNormals();
      const m = new T.Mesh(geo, R.pbr(T, 'rock', 3, 2, Object.assign({roughness: .95}, o.mat || {}))); m.castShadow = true; m.receiveShadow = true; return m;
    };

    /* ---------- Licht mit Schatten, das dem Geschehen folgt ---------- */
    R.sun = (T, scene, dir, color, inten, o = {}) => {
      const l = new T.DirectionalLight(color, inten); l.userData.dir = dir.clone().normalize(); l.castShadow = !!API.SET.fx;
      const s = l.shadow, k = o.size || 28; s.mapSize.set(o.map || 1024, o.map || 1024);
      s.camera.left = -k; s.camera.right = k; s.camera.top = k; s.camera.bottom = -k; s.camera.near = 1; s.camera.far = 170; s.camera.updateProjectionMatrix();
      s.bias = -.0008; s.normalBias = .04; scene.add(l); scene.add(l.target); R.sunAt(l, 0, 0, 0); return l;
    };
    R.sunAt = (l, x, y, z) => { l.target.position.set(x, y, z); l.position.set(x, y, z).addScaledVector(l.userData.dir, 70); };
    R.shadows = (root, cast = true, recv = true) => root.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = recv; } });

    /* ---------- Ich-Perspektive: Blick, Schritt, Anstoßen ---------- */
    R.fp = (LOC, yaw0 = 0) => LOC.fp || (LOC.fp = {yaw: yaw0, pitch: 0, bob: 0, mv: 0});
    R.look = (st, f, lim = 1.05) => { st.yaw -= f.lx * .0052; st.pitch = clamp(st.pitch - f.ly * .0042, -lim, lim); };
    R.step = (st, f, speed, dt) => { const s = Math.sin(st.yaw), c = Math.cos(st.yaw); st.mv = Math.hypot(f.mx, f.my); st.bob += st.mv * dt * 9; return {dx: (-s * f.my + c * f.mx) * speed * dt, dz: (-c * f.my - s * f.mx) * speed * dt}; };
    /* rects: [x0, z0, x1, z1] in Metern */
    R.push = (p, rects, rad) => {
      for (const q of rects) {
        const cx = clamp(p.x, q[0], q[2]), cz = clamp(p.z, q[1], q[3]), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (d >= rad) continue;
        if (d > 1e-4) { p.x = cx + dx / d * rad; p.z = cz + dz / d * rad; }
        else { const l = p.x - q[0], r = q[2] - p.x, t = p.z - q[1], b = q[3] - p.z, m = Math.min(l, r, t, b); if (m === l) p.x = q[0] - rad; else if (m === r) p.x = q[2] + rad; else if (m === t) p.z = q[1] - rad; else p.z = q[3] + rad; }
      }
    };
    /* ---------- Hinweiszeile oben am Bildschirm (mit Zeilenumbruch) ---------- */
    R.note = (txt, y, o = {}) => {
      const s = API.screen(), maxW = Math.min(s.cw - 28, 430), fs = o.size || 14;
      ctx.save(); ctx.font = `${o.weight || 600} ${fs}px Karla, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const words = String(txt).split(' '), lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW - 26 && cur) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur);
      const lh = fs * 1.32, h = lines.length * lh + 16, w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 30), x = s.cw / 2;
      ctx.fillStyle = o.bg || 'rgba(12,9,26,.68)'; rrect(ctx, x - w / 2, y, w, h, 13); ctx.fill();
      ctx.strokeStyle = o.line || 'rgba(243,201,143,.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = o.col || '#fbf3e6'; lines.forEach((l, i) => ctx.fillText(l, x, y + 9 + i * lh));
      ctx.restore(); return h;
    };

    /* ---------- Kleinteile für die Umgebung (ab 8.1) ---------- */
    R.merge = (T, geos) => {
      const pos = [], nor = [], uv = [];
      for (const g0 of geos) { const g = g0.index ? g0.toNonIndexed() : g0; for (const v of g.attributes.position.array) pos.push(v); for (const v of g.attributes.normal.array) nor.push(v); for (const v of g.attributes.uv.array) uv.push(v); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); return g;
    };
    const PLANT = {
      grass: (g, n, r) => { g.lineCap = 'round'; for (let i = 0; i < 30; i++) { const x = n * (.1 + r() * .8), h = n * (.4 + r() * .55), b = (r() - .5) * n * .4; g.strokeStyle = `rgb(${46 + r() * 44 | 0},${104 + r() * 76 | 0},${38 + r() * 30 | 0})`; g.lineWidth = 3 + r() * 4; g.beginPath(); g.moveTo(x, n); g.quadraticCurveTo(x + b * .3, n - h * .6, x + b, n - h); g.stroke(); } },
      fern: (g, n, r) => { g.lineCap = 'round'; for (let f = 0; f < 6; f++) { const a = -Math.PI / 2 + (f - 2.5) * .42 + (r() - .5) * .2, len = n * (.6 + r() * .32), col = `rgb(${40 + r() * 30 | 0},${96 + r() * 60 | 0},${48 + r() * 24 | 0})`;
        for (let k = 1; k <= 14; k++) { const u = k / 14, px = n / 2 + Math.cos(a) * len * u + Math.sin(u * 2.2) * (f - 2.5) * 5, py = n - 2 + Math.sin(a) * len * u, lw = (1 - u) * n * .1 + 2; g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(px - Math.sin(a) * lw, py + Math.cos(a) * lw - 3); g.lineTo(px, py); g.lineTo(px + Math.sin(a) * lw, py - Math.cos(a) * lw - 3); g.stroke(); } } },
      flower: (g, n, r) => { PLANT.grass(g, n, r); for (let i = 0; i < 9; i++) { const x = n * (.12 + r() * .76), y = n * (.12 + r() * .45); g.strokeStyle = '#4c8a40'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, n); g.lineTo(x, y); g.stroke(); g.fillStyle = ['#fff4f6', '#ffd86a', '#f6a8c0', '#c8b4ff', '#ffffff'][(r() * 5) | 0]; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4.2, 0, TAU); g.fill(); } g.fillStyle = '#e8a020'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } },
      reed: (g, n, r) => { g.lineCap = 'round'; for (let i = 0; i < 14; i++) { const x = n * (.1 + r() * .8), h = n * (.6 + r() * .36), b = (r() - .5) * n * .14; g.strokeStyle = `rgb(${92 + r() * 40 | 0},${120 + r() * 40 | 0},${52 + r() * 20 | 0})`; g.lineWidth = 2.5 + r() * 2; g.beginPath(); g.moveTo(x, n); g.quadraticCurveTo(x + b * .4, n - h * .5, x + b, n - h); g.stroke(); if (r() < .55) { g.strokeStyle = '#5a3a22'; g.lineWidth = 8; g.beginPath(); g.moveTo(x + b * .92, n - h * .9); g.lineTo(x + b * .78, n - h * .72); g.stroke(); } } }
    };
    R.plantTex = (T, kind, seed = 1) => { const key = 'pl-' + kind + seed; if (!TX[key]) { const c = canvas(128); PLANT[kind](c.getContext('2d'), 128, rng(seed * 13 + 5)); const t = new T.CanvasTexture(c); t.anisotropy = 4; TX[key] = t; } return TX[key]; };
    /* pts: [{x, y, z, s}] – zwei gekreuzte Flächen pro Pflanze, alle in einem Zeichenaufruf */
    R.plants = (T, kind, pts, o = {}) => {
      const w = o.w || 1, h = o.h || 1, p1 = new T.PlaneGeometry(w, h); p1.translate(0, h / 2, 0); const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
      const geo = R.merge(T, [p1, p2]), na = geo.attributes.normal; for (let i = 0; i < na.count; i++) na.setXYZ(i, 0, 1, 0);
      const mat = new T.MeshStandardMaterial({map: R.plantTex(T, kind, o.seed || 1), alphaTest: .4, side: T.DoubleSide, roughness: 1, color: o.color || 0xffffff});
      const im = new T.InstancedMesh(geo, mat, pts.length), D = new T.Object3D(), r = rng(o.seed || 3);
      pts.forEach((p, i) => { const s = p.s || 1; D.position.set(p.x, p.y || 0, p.z); D.rotation.set(0, r() * TAU, 0); D.scale.set(s, s * (.8 + r() * .4), s); D.updateMatrix(); im.setMatrixAt(i, D.matrix); });
      im.frustumCulled = false; im.receiveShadow = true; return im;
    };
    R.stones = (T, pts, o = {}) => {
      const im = new T.InstancedMesh(wob(new T.IcosahedronGeometry(1, 1), .5, 21), R.pbr(T, 'rock', 1, 1, Object.assign({roughness: .95, flatShading: true}, o.mat || {})), pts.length), D = new T.Object3D(), r = rng(o.seed || 5);
      pts.forEach((p, i) => { const s = p.s || 1; D.position.set(p.x, (p.y || 0) + s * .18, p.z); D.rotation.set(r() * 3, r() * 6, r() * 3); D.scale.set(s, s * (.5 + r() * .3), s * (.7 + r() * .5)); D.updateMatrix(); im.setMatrixAt(i, D.matrix); });
      im.frustumCulled = false; im.castShadow = !o.noShadow; im.receiveShadow = true; return im;
    };
    R.mushrooms = (T, pts, o = {}) => {
      const g = new T.Group(), n = pts.length, D = new T.Object3D(), r = rng(o.seed || 9), col = o.color || 0x7fe8d0;
      const stem = new T.InstancedMesh(new T.CylinderGeometry(.03, .045, .16, 6), new T.MeshStandardMaterial({color: 0xe8e0d0, roughness: .8}), n);
      const cap = new T.InstancedMesh(new T.SphereGeometry(.1, 10, 6, 0, TAU, 0, Math.PI / 2), new T.MeshStandardMaterial({color: col, emissive: col, emissiveIntensity: o.glow != null ? o.glow : .9, roughness: .5}), n);
      pts.forEach((p, i) => { const s = (p.s || 1) * (.7 + r() * .7); D.rotation.set(0, 0, 0); D.scale.setScalar(s); D.position.set(p.x, (p.y || 0) + .08 * s, p.z); D.updateMatrix(); stem.setMatrixAt(i, D.matrix); D.position.y = (p.y || 0) + .15 * s; D.updateMatrix(); cap.setMatrixAt(i, D.matrix); });
      stem.frustumCulled = cap.frustumCulled = false; g.add(stem, cap); return g;
    };
    R.softTex = T => { if (!TX.soft) { const c = canvas(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); TX.soft = new T.CanvasTexture(c); } return TX.soft; };
    /* Vögel, die um einen Punkt kreisen */
    R.birds = (T, n, o = {}) => {
      const g = new T.Group(), m = new T.MeshBasicMaterial({color: o.color || 0x20202a, side: T.DoubleSide, fog: o.fog !== false}), wg = new T.BufferGeometry(), r = rng(o.seed || 4), list = [];
      wg.setAttribute('position', new T.Float32BufferAttribute([0, 0, -.22, 0, 0, .2, 1.05, 0, .05], 3));
      for (let i = 0; i < n; i++) { const b = new T.Group(), wl = new T.Mesh(wg, m), wr = new T.Mesh(wg, m); wr.scale.x = -1; b.add(wl, wr); b.scale.setScalar(o.size || .8); g.add(b); list.push({b, wl, wr, a: r() * TAU, rad: (o.r0 || 20) + r() * (o.r1 || 25), h: (o.h0 || 20) + r() * (o.h1 || 12), sp: (.12 + r() * .1) * (r() < .5 ? 1 : -1)}); }
      g.userData.upd = t => list.forEach(q => { const a = t * q.sp + q.a; q.b.position.set((o.x || 0) + Math.cos(a) * q.rad, q.h + Math.sin(t * .6 + q.a) * 1.6, (o.z || 0) + Math.sin(a) * q.rad); q.b.rotation.y = -a + (q.sp > 0 ? 0 : Math.PI); const f = Math.sin(t * 8 + q.a * 5) * .65; q.wl.rotation.z = f; q.wr.rotation.z = -f; });
      return g;
    };
    /* Nebelschwaden: große, weiche Flächen, die langsam ziehen */
    R.mist = (T, n, o) => {
      const g = new T.Group(), r = rng(o.seed || 6), list = [], b = o.box;
      for (let i = 0; i < n; i++) { const s = new T.Sprite(new T.SpriteMaterial({map: R.softTex(T), color: o.color, transparent: true, opacity: (o.op || .1) * (.6 + r() * .8), depthWrite: false, fog: o.fog !== false})); const sc = (o.size || 12) * (.6 + r() * .9); s.scale.set(sc * 1.8, sc * .55, 1); s.position.set(b[0] + r() * (b[3] - b[0]), b[1] + r() * (b[4] - b[1]), b[2] + r() * (b[5] - b[2])); g.add(s); list.push({s, v: (.25 + r() * .5) * (o.speed || 1)}); }
      g.userData.upd = (t, dt) => list.forEach(q => { q.s.position.x += q.v * dt; if (q.s.position.x > b[3]) q.s.position.x = b[0]; });
      return g;
    };
    /* Schwebende Teilchen: Staub im Licht, Blütenblätter, fallendes Laub */
    R.motes = (T, n, o) => {
      const pos = new Float32Array(n * 3), geo = new T.BufferGeometry(), r = rng(o.seed || 8), b = o.box, d = Array.from({length: n}, () => ({x: b[0] + r() * (b[3] - b[0]), y: b[1] + r() * (b[4] - b[1]), z: b[2] + r() * (b[5] - b[2]), p: r() * 6, s: .3 + r() * .8}));
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({color: o.color, size: o.size || .05, map: R.softTex(T), transparent: true, opacity: o.op || .7, depthWrite: false, blending: o.normal ? T.NormalBlending : T.AdditiveBlending, fog: o.fog !== false}));
      pts.frustumCulled = false; const fall = o.fall || 0, H = b[4] - b[1];
      pts.userData.upd = t => { const a = geo.attributes.position; d.forEach((q, i) => { const y = fall ? b[1] + ((((q.y - b[1]) - t * fall * q.s) % H) + H) % H : q.y + Math.sin(t * q.s * .7 + q.p) * .25; a.setXYZ(i, q.x + Math.sin(t * q.s * .5 + q.p) * (o.sway || .3), y, q.z + Math.cos(t * q.s * .4 + q.p) * (o.sway || .3)); }); a.needsUpdate = true; };
      return pts;
    };
    /* Feuer: drei flackernde Flammen und ein warmes Licht */
    R.fire = (T, o = {}) => {
      const g = new T.Group(), sc = o.size || 1, fl = [[0xff7a28, 1.1, .34], [0xffb040, .8, .3], [0xffe6a0, .45, .24]].map(([c, s, y]) => { const sp = new T.Sprite(new T.SpriteMaterial({map: R.softTex(T), color: c, transparent: true, opacity: .95, depthWrite: false, blending: T.AdditiveBlending, fog: false})); sp.position.y = y * sc; sp.userData.s = s * sc; g.add(sp); return sp; });
      const light = o.light === false ? null : new T.PointLight(0xff8a40, o.inten || 1.2, o.dist || 9, 1.5); if (light) { light.position.y = .6 * sc; g.add(light); }
      g.userData.upd = t => { const k = 1 + Math.sin(t * 13 + (o.ph || 0)) * .1 + Math.sin(t * 29 + (o.ph || 0) * 2) * .07; fl.forEach((sp, i) => { const s = sp.userData.s; sp.scale.set(s * (.9 + (k - 1) * (i + 1)), s * 1.5 * k, 1); }); if (light) light.intensity = (o.inten || 1.2) * k; };
      return g;
    };
    R.cobweb = T => { if (!TX.web) { const c = canvas(128), g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2; for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 126, Math.sin(a) * 126); g.stroke(); } for (let k = 1; k <= 6; k++) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2, rr = k * 20 - (i % 2 ? 0 : 5); i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); } TX.web = new T.CanvasTexture(c); }
      return new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map: TX.web, transparent: true, opacity: .32, depthWrite: false, side: T.DoubleSide})); };
    cache = R; return R;
  };
})();
