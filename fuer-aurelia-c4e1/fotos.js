/* Zwei Lichter – Erinnerungsfotos (ab 8.2)
   Die Bilder liegen als durchgemischte Kacheln im Ordner und werden erst im Spiel zusammengesetzt –
   so sieht man der Datei nicht an, was sie zeigt, und niemand kann vorab spicken. */
window.ZL_FOTO = (() => {
  const DEF = {m1: {w: 672, h: 864, seed: 4711}, m2: {w: 720, h: 960, seed: 2609}}, C = {}, TS = 48;
  const perm = (n, seed) => { let x = seed; const a = Array.from({length: n}, (_, i) => i); for (let i = n - 1; i > 0; i--) { x = x * 48271 % 2147483647; const j = x % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  function get(k) {
    if (C[k]) return C[k];
    const d = DEF[k], o = C[k] = {ready: false, cv: document.createElement('canvas'), w: d.w, h: d.h};
    o.cv.width = d.w; o.cv.height = d.h;
    const im = new Image();
    im.onload = () => {
      const g = o.cv.getContext('2d'), nx = d.w / TS, p = perm(nx * d.h / TS, d.seed);
      p.forEach((s, j) => g.drawImage(im, (j % nx) * TS, Math.floor(j / nx) * TS, TS, TS, (s % nx) * TS, Math.floor(s / nx) * TS, TS, TS));
      o.ready = true;
    };
    im.src = k + '.jpg?v=82';  // die Bilddateien selbst sind unverändert
    return o;
  }
  /* stark weichgezeichnete Fassung: Farben und Licht ja, erkennen kann man darauf nichts */
  const soft = k => { const o = get(k); if (!o.ready) return null; if (!o.blur) { const t = document.createElement('canvas'); t.width = 12; t.height = 16; t.getContext('2d').drawImage(o.cv, 0, 0, 12, 16); const c = document.createElement('canvas'); c.width = o.w; c.height = o.h; const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.filter = 'saturate(.8) brightness(.78)'; g.drawImage(t, 0, 0, o.w, o.h); o.blur = c; } return o.blur; };
  /* etwas abgedunkelte Fassung für die Spielfläche, damit helle Bildstellen im Leuchteffekt nicht ausbrennen */
  const tone = k => { const o = get(k); if (!o.ready) return null; if (!o.tn) { const c = document.createElement('canvas'); c.width = o.w; c.height = o.h; const g = c.getContext('2d'); g.drawImage(o.cv, 0, 0); try { const im = g.getImageData(0, 0, o.w, o.h), d = im.data, lut = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) { const v = i / 255; lut[i] = 255 * (.86 * v - .2 * v * v * v); } for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; } g.putImageData(im, 0, 0); } catch (e) {} o.tn = c; } return o.tn; };
  const url = k => { const o = get(k); if (!o.ready) return ''; if (!o.url) { try { o.url = o.cv.toDataURL('image/jpeg', .86); } catch (e) { o.url = ''; } } return o.url; };
  /* Bilderrahmen wie ein Abzug: heller Rand, weicher Schatten */
  const frame = (g, x, y, w, h, b = 6) => {
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18; g.shadowOffsetY = 6; g.fillStyle = '#cfc6b4'; g.fillRect(x - b, y - b, w + 2 * b, h + 2 * b); g.restore();
    g.fillStyle = '#17131f'; g.fillRect(x, y, w, h);
  };
  /* Bild groß in der Bildschirmmitte: k = 0 … 1 lässt es aus dem Rechteck `from` herauswachsen */
  const big = (g, o, s, k, from, cap) => {
    const e = k < 1 ? 1 - Math.pow(1 - k, 3) : 1, W = Math.min(s.cw * .8, (s.ch * .56) * o.w / o.h), H = W * o.h / o.w, X = (s.cw - W) / 2, Y = s.ch * .46 - H / 2;
    const x = from.x + (X - from.x) * e, y = from.y + (Y - from.y) * e, w = from.w + (W - from.w) * e, h = from.h + (H - from.h) * e;
    g.fillStyle = `rgba(8,6,18,${.62 * e})`; g.fillRect(0, 0, s.cw, s.ch);
    frame(g, x, y, w, h, 3 + 5 * e);
    if (cap && e > .6) { g.globalAlpha = (e - .6) / .4; g.font = '600 15px Karla, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fbf3e6'; String(cap).split('\n').forEach((ln, i) => g.fillText(ln, s.cw / 2, y + h + 34 + i * 21)); g.globalAlpha = 1; }
    return {x, y, w, h};
  };
  setTimeout(() => { get('m1'); get('m2'); }, 5000);
  return {get, url, soft, tone, perm, frame, big};
})();
