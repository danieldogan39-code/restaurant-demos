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
      g.add(Object.assign(K.sprite(T, 0xf4a8b8, 4.5, .35), {}));
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
      g.add(K.sprite(T, 0x9cc7ff, 4.5, .35));
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
      const shell = new T.Mesh(new T.SphereGeometry(1, 28, 18), std(T, 0x4f9e6e, {roughness: .45, metalness: .1})); shell.scale.set(1.25, .55, 1.5); g.add(shell);
      const plate = new T.Mesh(new T.SphereGeometry(.62, 6, 4), std(T, 0x76c891, {flatShading: true, emissive: 0x103020, emissiveIntensity: .4})); plate.scale.set(1.2, .5, 1.3); plate.position.y = .32; g.add(plate);
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
      g.add(K.sprite(T, 0xf4a8b8, 6, .35));
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
    cache = K; return K;
  };
})();
