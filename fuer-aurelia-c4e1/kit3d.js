/* Zwei Lichter – 3D-Werkstatt: gemeinsame Figuren und Hilfen für alle 3D-Level */
window.ZL_KIT = (() => {
  let cache = null;
  return API => {
    if (cache) return cache;
    const {ctx, rgba, rr} = API;
    let GT = null;
    const K = {};
    K.glowTex = T => {
      if (GT) return GT;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      GT = new T.CanvasTexture(c); return GT;
    };
    K.sprite = (T, color, size, op = 1) => {
      const s = new T.Sprite(new T.SpriteMaterial({map: K.glowTex(T), color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: op}));
      s.scale.set(size, size, 1); return s;
    };
    K.proj = (cam, v) => { const p = v.clone().project(cam), s = API.screen(); return {x: (p.x * .5 + .5) * s.cw, y: (-p.y * .5 + .5) * s.ch, ok: p.z < 1 && p.z > -1}; };
    K.nameTag = (txt, x, y, c) => {
      ctx.font = '700 14px Karla, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const w = ctx.measureText(txt).width + 18;
      ctx.fillStyle = 'rgba(10,8,24,.62)'; rr(x - w / 2, y - 19, w, 25, 12.5); ctx.fill();
      ctx.strokeStyle = rgba(c, .7); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = rgba(c, 1); ctx.fillText(txt, x, y - 1);
    };
    K.sky = (T, top, mid, bot, r = 900) => {
      const m = new T.ShaderMaterial({side: T.BackSide, depthWrite: false, fog: false,
        uniforms: {a: {value: new T.Color(top)}, b: {value: new T.Color(mid)}, c: {value: new T.Color(bot)}},
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'uniform vec3 a; uniform vec3 b; uniform vec3 c; varying vec3 vP; void main(){ float h = vP.y; vec3 col = h > 0. ? mix(b, a, pow(min(h * 1.6, 1.), .7)) : mix(b, c, min(-h * 3., 1.)); gl_FragColor = vec4(col, 1.); }'});
      const s = new T.Mesh(new T.SphereGeometry(r, 32, 16), m); s.frustumCulled = false; return s;
    };
    K.heartGeo = (T, s = 1, depth = .35) => {
      const sh = new T.Shape(); sh.moveTo(0, -.9 * s);
      sh.bezierCurveTo(-1.5 * s, .1 * s, -.75 * s, 1.25 * s, 0, .45 * s);
      sh.bezierCurveTo(.75 * s, 1.25 * s, 1.5 * s, .1 * s, 0, -.9 * s);
      const g = new T.ExtrudeGeometry(sh, {depth, bevelEnabled: true, bevelThickness: .12 * s, bevelSize: .1 * s, bevelSegments: 3, curveSegments: 18});
      g.center(); return g;
    };
    K.extrudeProfile = (T, pts, width, bevel = .08) => {
      const sh = new T.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
      const g = new T.ExtrudeGeometry(sh, {depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8});
      g.rotateY(-Math.PI / 2); g.computeBoundingBox(); const bb = g.boundingBox; g.translate(-(bb.min.x + bb.max.x) / 2, 0, 0); g.computeVertexNormals(); return g;
    };
    const std = (T, color, o = {}) => new T.MeshStandardMaterial(Object.assign({color, roughness: .55, metalness: .05}, o));
    K.princess = T => {
      const g = new T.Group(), skin = std(T, 0xf5d7c4), hair = std(T, 0x4a2c24, {roughness: .8});
      const dress = new T.Mesh(new T.ConeGeometry(.75, 1.35, 24, 1, true), std(T, 0xf4a0b8, {emissive: 0x401020, emissiveIntensity: .4, side: T.DoubleSide}));
      dress.position.y = .68; g.add(dress);
      const hem = new T.Mesh(new T.TorusGeometry(.72, .06, 8, 28), std(T, 0xf3c98f, {metalness: .6, roughness: .3})); hem.rotation.x = Math.PI / 2; hem.position.y = .06; g.add(hem);
      const body = new T.Mesh(new T.CylinderGeometry(.22, .3, .55, 14), std(T, 0xf7b9c7)); body.position.y = 1.5; g.add(body);
      const belt = new T.Mesh(new T.TorusGeometry(.27, .04, 6, 20), std(T, 0xf3c98f, {metalness: .6})); belt.rotation.x = Math.PI / 2; belt.position.y = 1.3; g.add(belt);
      const head = new T.Mesh(new T.SphereGeometry(.33, 20, 16), skin); head.position.y = 2.02; g.add(head);
      const hb = new T.Mesh(new T.SphereGeometry(.36, 20, 16, 0, Math.PI * 2, 0, Math.PI * .6), hair); hb.position.set(0, 2.06, .03); g.add(hb);
      const tail = new T.Mesh(new T.CapsuleGeometry(.2, .7, 6, 12), hair); tail.position.set(0, 1.6, .26); tail.rotation.x = .15; g.add(tail);
      for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(.045, 8, 6), new T.MeshBasicMaterial({color: 0x2a1a18})); e.position.set(s * .12, 2.05, -.3); g.add(e); }
      const crown = new T.Group(), gold = std(T, 0xf3c98f, {metalness: .8, roughness: .25, emissive: 0x6a4a10, emissiveIntensity: .5});
      const ring = new T.Mesh(new T.CylinderGeometry(.22, .24, .1, 16, 1, true), gold); crown.add(ring);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = new T.Mesh(new T.ConeGeometry(.05, .16, 6), gold); c.position.set(Math.cos(a) * .22, .12, Math.sin(a) * .22); crown.add(c); }
      const gem = new T.Mesh(new T.SphereGeometry(.05, 8, 6), new T.MeshBasicMaterial({color: 0xff6f9a})); gem.position.set(0, .03, -.24); crown.add(gem);
      crown.position.y = 2.33; g.add(crown);
      const arms = []; for (const s of [-1, 1]) { const a = new T.Mesh(new T.CapsuleGeometry(.06, .5, 4, 8), skin); a.position.set(s * .32, 1.38, 0); a.rotation.z = s * .35; g.add(a); arms.push(a); }
      g.add(K.sprite(T, 0xf4a8b8, 4, .16));
      g.userData = {kind: 'princess', dress, arms};
      return g;
    };
    K.prince = T => {
      const g = new T.Group(), skin = std(T, 0xf0d0b8), dark = std(T, 0x2a2f4a);
      const legs = []; for (const s of [-1, 1]) { const l = new T.Group(); l.position.set(s * .14, .95, 0); const m = new T.Mesh(new T.CapsuleGeometry(.1, .7, 4, 8), dark); m.position.y = -.45; l.add(m); g.add(l); legs.push(l); }
      const tunic = new T.Mesh(new T.CylinderGeometry(.26, .34, .85, 16), std(T, 0x8fb8f5, {emissive: 0x102040, emissiveIntensity: .4})); tunic.position.y = 1.35; g.add(tunic);
      const belt = new T.Mesh(new T.TorusGeometry(.32, .045, 6, 20), std(T, 0xf3c98f, {metalness: .7})); belt.rotation.x = Math.PI / 2; belt.position.y = 1.08; g.add(belt);
      const cape = new T.Mesh(new T.PlaneGeometry(.75, 1.25, 1, 6), std(T, 0x3b5b9a, {side: T.DoubleSide})); cape.position.set(0, 1.25, .32); cape.rotation.x = .12; g.add(cape);
      const head = new T.Mesh(new T.SphereGeometry(.32, 20, 16), skin); head.position.y = 2.05; g.add(head);
      const hair = new T.Mesh(new T.SphereGeometry(.34, 20, 16, 0, Math.PI * 2, 0, Math.PI * .45), std(T, 0x3d2a20, {roughness: .8})); hair.position.y = 2.09; g.add(hair);
      for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(.045, 8, 6), new T.MeshBasicMaterial({color: 0x1d1612})); e.position.set(s * .12, 2.07, -.29); g.add(e); }
      const gold = std(T, 0xf3c98f, {metalness: .8, roughness: .25, emissive: 0x6a4a10, emissiveIntensity: .5});
      const crown = new T.Group(); crown.add(new T.Mesh(new T.CylinderGeometry(.24, .25, .14, 16, 1, true), gold));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = new T.Mesh(new T.BoxGeometry(.07, .14, .07), gold); c.position.set(Math.cos(a) * .24, .12, Math.sin(a) * .24); crown.add(c); }
      crown.position.y = 2.36; g.add(crown);
      const arms = []; for (const s of [-1, 1]) { const a = new T.Mesh(new T.CapsuleGeometry(.07, .55, 4, 8), std(T, 0x8fb8f5)); a.position.set(s * .38, 1.38, 0); a.rotation.z = s * .18; g.add(a); arms.push(a); }
      g.add(K.sprite(T, 0x9cc7ff, 4, .16));
      g.userData = {kind: 'prince', legs, cape, arms};
      return g;
    };
    K.animFigure = (g, t, moving) => {
      const u = g.userData, w = moving ? Math.sin(t * 11) : 0;
      if (u.kind === 'prince') { u.legs[0].rotation.x = w * .6; u.legs[1].rotation.x = -w * .6; u.cape.rotation.x = .12 + (moving ? .35 + Math.sin(t * 8) * .1 : 0); }
      else if (u.dress) { u.dress.rotation.z = w * .06; }
      u.arms.forEach((a, i) => { a.rotation.x = (i ? -1 : 1) * w * .5; });
      g.position.y += moving ? Math.abs(Math.sin(t * 11)) * .08 : Math.sin(t * 2) * .02;
    };
    K.cloud = T => {
      const g = new T.Group(), m = std(T, 0xa7a3c0, {roughness: .9, emissive: 0x201c30, emissiveIntensity: .4});
      for (const [x, y, z, r] of [[-.45, 0, 0, .55], [.45, 0, 0, .55], [0, .25, 0, .7], [0, -.1, .2, .55]]) { const s = new T.Mesh(new T.SphereGeometry(r, 16, 12), m); s.position.set(x, y, z); g.add(s); }
      for (const s of [-1, 1]) {
        const e = new T.Mesh(new T.SphereGeometry(.14, 10, 8), new T.MeshBasicMaterial({color: 0xffffff})); e.position.set(s * .22, .2, -.62); g.add(e);
        const p = new T.Mesh(new T.SphereGeometry(.07, 8, 6), new T.MeshBasicMaterial({color: 0x1d1a2c})); p.position.set(s * .22, .2, -.74); g.add(p);
      }
      g.userData = {mat: m};
      return g;
    };
    K.turtle = T => {
      const g = new T.Group();
      const shell = new T.Mesh(new T.SphereGeometry(1, 28, 18), std(T, 0x3a845a, {roughness: .5, metalness: .1, envMapIntensity: .5})); shell.scale.set(1.25, .55, 1.5); g.add(shell);
      const plate = new T.Mesh(new T.SphereGeometry(.62, 6, 4), std(T, 0x5fae78, {flatShading: true, emissive: 0x103020, emissiveIntensity: .3, envMapIntensity: .5})); plate.scale.set(1.2, .5, 1.3); plate.position.y = .32; g.add(plate);
      const rim = new T.Mesh(new T.TorusGeometry(1, .07, 8, 36), std(T, 0xf4a8b8, {emissive: 0x803048, emissiveIntensity: .6})); rim.rotation.x = Math.PI / 2; rim.scale.set(1.25, 1.5, 1); g.add(rim);
      const skin = std(T, 0x8fd0a0, {roughness: .7});
      const head = new T.Mesh(new T.SphereGeometry(.45, 20, 14), skin); head.position.set(0, .1, -1.75); g.add(head);
      for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(.085, 8, 6), new T.MeshBasicMaterial({color: 0x111111})); e.position.set(s * .2, .25, -2.12); g.add(e); }
      const bowM = std(T, 0xf48aa3, {emissive: 0x601830, emissiveIntensity: .6});
      for (const s of [-1, 1]) { const b = new T.Mesh(new T.ConeGeometry(.17, .38, 12), bowM); b.position.set(s * .22, .6, -1.65); b.rotation.z = s * Math.PI / 2; g.add(b); }
      g.userData.fl = [];
      for (const [x, z, s] of [[-1, -.7, 1], [1, -.7, -1], [-1, .9, -1], [1, .9, 1]]) {
        const pv = new T.Group(); pv.position.set(x * 1.05, -.05, z);
        const f = new T.Mesh(new T.CapsuleGeometry(.18, .7, 4, 8), skin); f.rotation.z = Math.PI / 2; f.scale.set(1, 1, .45); f.position.x = x * .45; pv.add(f); g.add(pv); g.userData.fl.push({pv, s, x});
      }
      g.add(K.sprite(T, 0xf4a8b8, 5, .14));
      return g;
    };
    K.octopus = T => {
      const g = new T.Group(), m = std(T, 0x7ea9f2, {roughness: .4, emissive: 0x102050, emissiveIntensity: .35});
      const head = new T.Mesh(new T.SphereGeometry(1, 28, 20), m); head.scale.set(1, 1.15, 1); head.position.y = .5; g.add(head);
      for (const s of [-1, 1]) {
        const e = new T.Mesh(new T.SphereGeometry(.27, 14, 10), new T.MeshBasicMaterial({color: 0xffffff})); e.position.set(s * .38, .62, -.8); g.add(e);
        const p = new T.Mesh(new T.SphereGeometry(.12, 10, 8), new T.MeshBasicMaterial({color: 0x1d2540})); p.position.set(s * .38, .62, -1.04); g.add(p);
        const c = new T.Mesh(new T.SphereGeometry(.13, 10, 8), new T.MeshBasicMaterial({color: 0xf4a8b8})); c.position.set(s * .62, .3, -.72); g.add(c);
      }
      g.userData.ten = [];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, pv = new T.Group(); pv.position.set(Math.cos(a) * .55, -.3, Math.sin(a) * .55);
        const c = new T.Mesh(new T.CapsuleGeometry(.12, 1.5, 4, 8), m); c.position.y = -.85; c.scale.set(1, 1, 1); pv.add(c);
        pv.rotation.set(Math.sin(a) * .7 + .55, 0, -Math.cos(a) * .7); g.add(pv); g.userData.ten.push({pv, i, bx: pv.rotation.x});
      }
      g.add(K.sprite(T, 0x9cc7ff, 6, .35));
      return g;
    };
    let SPT = null;
    const spongeTex = T => {
      if (SPT) return SPT;
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = '#9cc2fa'; g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 900; i++) { const v = Math.random(); g.fillStyle = v < .5 ? 'rgba(200,225,255,.25)' : 'rgba(70,110,190,.12)'; g.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
      const bump = document.createElement('canvas'); bump.width = 256; bump.height = 128; const b = bump.getContext('2d'); b.fillStyle = '#fff'; b.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * 256, y = 10 + Math.random() * 108, rx = 3 + Math.random() * 7, ry = rx * (.7 + Math.random() * .5);
        for (const ox of [-256, 0, 256]) {
          g.fillStyle = 'rgba(48,86,165,.75)'; g.beginPath(); g.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(30,60,130,.6)'; g.beginPath(); g.ellipse(x + ox + rx * .15, y + ry * .2, rx * .6, ry * .6, 0, 0, Math.PI * 2); g.fill();
          const gr = b.createRadialGradient(x + ox, y, 0, x + ox, y, rx); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); b.fillStyle = gr; b.beginPath(); b.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2); b.fill();
        }
      }
      SPT = {map: new T.CanvasTexture(c), bump: new T.CanvasTexture(bump)}; return SPT;
    };
    K.sponge = T => {
      const g = new T.Group(), tx = spongeTex(T);
      const bodyG = new T.SphereGeometry(1, 40, 28), pa = bodyG.attributes.position, v = new T.Vector3();
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); const n = 1 + .06 * Math.sin(v.x * 9 + v.y * 4) * Math.sin(v.y * 8 + v.z * 5) + .04 * Math.sin(v.z * 11); pa.setXYZ(i, v.x * n * 1.08, v.y * n * 1.22, v.z * n * .92); }
      bodyG.computeVertexNormals();
      const bm = std(T, 0xffffff, {map: tx.map, bumpMap: tx.bump, bumpScale: .06, roughness: .85, emissive: 0x16306a, emissiveIntensity: .35});
      const body = new T.Mesh(bodyG, bm); body.position.y = .2; g.add(body);
      const tuftM = std(T, 0xb4d2ff, {roughness: .8});
      for (const [x, z, r] of [[-.3, .05, .24], [0, -.05, .3], [.3, .08, .22]]) { const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), tuftM); m.position.set(x, 1.45, z); g.add(m); }
      for (const s of [-1, 1]) {
        const e = new T.Mesh(new T.SphereGeometry(.24, 16, 12), new T.MeshBasicMaterial({color: 0xffffff})); e.scale.set(1, 1.15, .6); e.position.set(s * .34, .5, -.86); g.add(e);
        const p = new T.Mesh(new T.SphereGeometry(.11, 10, 8), new T.MeshBasicMaterial({color: 0x1d2a4a})); p.position.set(s * .34, .48, -1.0); g.add(p);
        const hl = new T.Mesh(new T.SphereGeometry(.04, 6, 4), new T.MeshBasicMaterial({color: 0xffffff})); hl.position.set(s * .34 + .04, .54, -1.08); g.add(hl);
        const c = new T.Mesh(new T.SphereGeometry(.12, 10, 8), new T.MeshBasicMaterial({color: 0xf4a8b8, transparent: true, opacity: .8})); c.scale.z = .4; c.position.set(s * .62, .15, -.8); g.add(c);
      }
      const smile = new T.Mesh(new T.TorusGeometry(.2, .035, 6, 16, Math.PI), new T.MeshBasicMaterial({color: 0x2d3f6e})); smile.rotation.z = Math.PI; smile.position.set(0, .18, -.95); g.add(smile);
      const limb = std(T, 0x6f97da, {roughness: .6}), hand = std(T, 0xe9f2ff, {roughness: .5}), shoe = std(T, 0xf3c98f, {metalness: .3, roughness: .4, emissive: 0x4a3010, emissiveIntensity: .3});
      const arms = [], legs = [];
      for (const s of [-1, 1]) {
        const a = new T.Group(); a.position.set(s * 1.0, .25, 0);
        const am = new T.Mesh(new T.CapsuleGeometry(.09, .6, 4, 8), limb); am.position.set(s * .32, -.12, 0); am.rotation.z = s * 1.15; a.add(am);
        const hm = new T.Mesh(new T.SphereGeometry(.17, 12, 10), hand); hm.position.set(s * .62, -.3, 0); a.add(hm);
        g.add(a); arms.push(a);
        const l = new T.Group(); l.position.set(s * .38, -.95, 0);
        const lm = new T.Mesh(new T.CapsuleGeometry(.1, .45, 4, 8), limb); lm.position.y = -.3; l.add(lm);
        const sh = new T.Mesh(new T.SphereGeometry(.2, 12, 10), shoe); sh.scale.set(1, .65, 1.45); sh.position.set(0, -.62, -.08); l.add(sh);
        g.add(l); legs.push(l);
      }
      g.add(K.sprite(T, 0x9cc7ff, 5, .14));
      g.userData = {kind: 'sponge', arms, legs};
      return g;
    };
    K.animSponge = (g, t, swim) => {
      const u = g.userData, w = Math.sin(t * (swim ? 7 : 3));
      u.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (.2 + w * (swim ? .5 : .15)); a.rotation.x = swim ? Math.cos(t * 7) * .4 : 0; });
      u.legs.forEach((l, i) => { l.rotation.x = (i ? 1 : -1) * w * (swim ? .7 : .2); });
    };
    const ENV = {};
    K.env = (T, key, top, mid, bot, spots = []) => {
      if (ENV[key]) return ENV[key];
      const R = API.renderer3D(); if (!R) return null;
      const sc = new T.Scene(); sc.add(K.sky(T, top, mid, bot, 40));
      for (const [x, y, z, w, h, c] of spots) { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({color: c, side: T.DoubleSide})); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); }
      const pm = new T.PMREMGenerator(R); const tex = pm.fromScene(sc, .02).texture; pm.dispose();
      sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      ENV[key] = tex; return tex;
    };
    K.blobTex = T => {
      if (K._blob) return K._blob;
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      K._blob = new T.CanvasTexture(c); return K._blob;
    };
    K.blob = (T, size) => { const m = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({map: K.blobTex(T), transparent: true, depthWrite: false})); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m; };
    cache = K; return K;
  };
})();
