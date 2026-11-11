/* MSR Maschinenvermietung – Seitenlogik ohne Fremdbibliotheken */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const daten = (() => { try { return JSON.parse($('#msr-daten').textContent); } catch (e) { return {}; } })();
  const namen = daten.namen || {};

  /* ---------- Menü und Kopfzeile ---------- */
  const kopf = $('.kopf'), menue = $('.menue-knopf');
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (kopf && menue) {
    const setze = offen => {
      kopf.toggleAttribute('data-offen', offen);
      menue.setAttribute('aria-expanded', String(offen));
      document.documentElement.classList.toggle('menue-offen', offen);
    };
    menue.addEventListener('click', () => setze(!kopf.hasAttribute('data-offen')));
    $$('.haupt-nav a', kopf).forEach(a => a.addEventListener('click', () => setze(false)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && kopf.hasAttribute('data-offen')) { setze(false); menue.focus(); }
    });
  }

  /* ---------- Anfrageliste (bleibt nur im eigenen Browser) ---------- */
  const SCHLUESSEL = 'msr-anfrage';
  const liste = {
    lesen() { try { const v = JSON.parse(localStorage.getItem(SCHLUESSEL) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return this._ersatz || []; } },
    schreiben(v) { this._ersatz = v; try { localStorage.setItem(SCHLUESSEL, JSON.stringify(v)); } catch (e) { /* ohne Speicher gilt die Liste nur für diese Seite */ } zeichnen(); },
    hat(s) { return this.lesen().includes(s); },
    wechseln(s) { const v = this.lesen(); this.schreiben(v.includes(s) ? v.filter(x => x !== s) : v.concat(s)); },
  };
  function zeichnen() {
    const v = liste.lesen();
    $$('[data-merk-zaehler]').forEach(el => { el.textContent = String(v.length); el.hidden = v.length === 0; });
    $$('.merken').forEach(b => {
      const drin = v.includes(b.dataset.merken);
      b.setAttribute('aria-pressed', String(drin));
      b.textContent = drin ? 'Auf der Anfrageliste – entfernen' : 'Auf die Anfrageliste';
    });
    const ziel = $('#k-merkliste');
    if (ziel) {
      ziel.innerHTML = '';
      v.forEach(s => {
        const li = document.createElement('li');
        li.append(namen[s] || s);
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', (namen[s] || s) + ' entfernen');
        b.addEventListener('click', () => liste.wechseln(s));
        li.append(b); ziel.append(li);
      });
      const leer = $('#k-merkliste-leer'); if (leer) leer.hidden = v.length > 0;
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.merken');
    if (b) liste.wechseln(b.dataset.merken);
    const a = e.target.closest('[data-anfragen]');
    if (a && !liste.hat(a.dataset.anfragen)) liste.wechseln(a.dataset.anfragen);
  });
  zeichnen();

  /* ---------- Scroll: Kopfzeile, Parallaxe, Aufstieg ---------- */
  const klemme = (x, a, b) => Math.min(b, Math.max(a, x));
  const weich = t => 1 - Math.pow(1 - t, 3);
  const parallaxen = ruhig ? [] : $$('[data-parallax]');
  const film = $('[data-film]');
  let filmBild = null;

  /* Aussage: Wörter einzeln einblenden */
  const aussage = ruhig ? null : $('[data-worte]');
  let worte = [], wortStand = -1;
  if (aussage) {
    const text = aussage.textContent.trim();
    aussage.innerHTML = '<span class="sr"></span>' + text.split(/\s+/).map(w => '<span class="wort" aria-hidden="true">' + w + '</span>').join(' ');
    aussage.firstChild.textContent = text;
    worte = $$('.wort', aussage);
  }
  const wachsen = ruhig ? [] : $$('[data-wachsen]');
  const grund = ruhig ? null : $('.grund');

  if (film) {
    const stufen = $$('.stufe', film), n = stufen.length;
    const hoehen = stufen.map(s => parseFloat(s.dataset.hoehe));
    const zahl = $('[data-film-zahl]', film), name = $('[data-film-name]', film), bahn = $('.stufen-bahn', film);
    const marke = $('.skala-marke', film), fuellung = $('.skala-fuellung', film), leiste = $('.skala-leiste', film);
    const lineal = $('.lineal', film), lFuell = $('.lineal-fuellung', film), lMarke = $('.lineal-marke', film), lHalte = $$('.lineal-halt', film);
    const halte = $$('.skala-halt', film), punkte = $$('.aufstieg-punkte button:not(.pfeil)', film), stand = $('[data-film-stand]', film);
    /* Mit der Maus: Film beim Scrollen. Am Handy, Tablet und bei reduzierter Bewegung: waagerecht wischen, die Seite scrollt normal weiter. */
    const eng = matchMedia('(max-width: 899px), (pointer: coarse)');
    let modus = '', aktiv = -1, letzte = '', ruhe = [], gezaehlt = false;
    film.style.setProperty('--n', n);
    /* Eine Anzeige für beide Arten: Höhe h (in Metern) und die gerade aktive Bühne */
    const zeige = (h, jetzt) => {
      const text = h.toFixed(2).replace('.', ',');
      if (text !== letzte) { zahl.textContent = text; letzte = text; }
      const anteil = h / 25;
      if (modus === 'an') {
        marke.style.transform = `translate3d(0,${-anteil * leiste.clientHeight}px,0)`;
        fuellung.style.transform = `scaleY(${anteil})`;
      } else {
        lMarke.style.transform = `translate3d(${anteil * lineal.clientWidth}px,0,0)`;
        lFuell.style.transform = `scaleX(${anteil})`;
      }
      if (jetzt === aktiv) return;
      aktiv = jetzt;
      stufen.forEach((s, k) => s.classList.toggle('ist-aktiv', k === aktiv));
      halte.forEach((s, k) => s.toggleAttribute('data-da', k <= aktiv));
      lHalte.forEach((s, k) => s.toggleAttribute('data-da', hoehen[k] <= hoehen[aktiv]));
      punkte.forEach((s, k) => { s.toggleAttribute('data-da', k < aktiv); s.setAttribute('aria-current', String(k === aktiv)); });
      if (stand) stand.textContent = `${aktiv + 1} / ${n}`;
      if (name) name.textContent = stufen[aktiv].dataset.name;
    };
    const messen = () => { ruhe = stufen.map(s => s.offsetLeft + s.offsetWidth / 2 - bahn.clientWidth / 2); };
    const wischBild = () => {
      if (modus !== 'wisch' || !gezaehlt) return;
      const x = bahn.scrollLeft; let i = 0;
      while (i < n - 2 && x > ruhe[i + 1]) i++;
      const f = klemme((x - ruhe[i]) / ((ruhe[i + 1] - ruhe[i]) || 1), 0, 1);
      zeige(hoehen[i] + (hoehen[i + 1] - hoehen[i]) * f, f < .5 ? i : i + 1);
    };
    const sprung = i => {
      i = klemme(i, 0, n - 1);
      if (modus === 'wisch') { bahn.scrollTo({ left: ruhe[i], behavior: ruhig ? 'auto' : 'smooth' }); return; }
      const r = film.getBoundingClientRect(), weg = r.height - innerHeight;
      scrollTo({ top: scrollY + r.top + (i + .75) / n * weg, behavior: 'smooth' });
    };
    halte.forEach((h, i) => h.addEventListener('click', () => sprung(i)));
    punkte.forEach((h, i) => h.addEventListener('click', () => sprung(i)));
    $$('[data-film-pfeil]', film).forEach(b => b.addEventListener('click', () => sprung(aktiv + Number(b.dataset.filmPfeil))));
    let bahnWartet = false;
    bahn.addEventListener('scroll', () => { if (!bahnWartet) { bahnWartet = true; requestAnimationFrame(() => { bahnWartet = false; wischBild(); }); } }, { passive: true });
    filmBild = () => {
      if (modus !== 'an') return;
      const r = film.getBoundingClientRect(), weg = r.height - innerHeight;
      if (r.bottom < 0 || r.top > innerHeight) return;
      const x = klemme(-r.top / weg, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
      const von = i === 0 ? 0 : hoehen[i - 1];
      zeige(von + (hoehen[i] - von) * weich(klemme(f / .5, 0, 1)), (i > 0 && f < .42) ? i - 1 : i);
    };
    /* Beim ersten Erscheinen zählt die Anzeige einmal von 0 auf die erste Bühne hoch */
    const hochzaehlen = () => {
      if (ruhig) { gezaehlt = true; wischBild(); return; }
      const t0 = performance.now(), dauer = 900;
      const schritt = t => {
        const p = klemme((t - t0) / dauer, 0, 1);
        if (bahn.scrollLeft > 4 || modus !== 'wisch') { gezaehlt = true; wischBild(); return; }
        zeige(hoehen[0] * weich(p), 0);
        if (p < 1) requestAnimationFrame(schritt); else gezaehlt = true;
      };
      requestAnimationFrame(schritt);
    };
    const stelle = () => {
      const neu = (ruhig || eng.matches) ? 'wisch' : 'an';
      if (neu === modus) { if (modus === 'wisch') { messen(); wischBild(); } return; }
      modus = neu; film.dataset.film = modus; aktiv = -1; letzte = '';
      if (modus === 'wisch') {
        messen();
        if (gezaehlt) wischBild(); else {
          zeige(0, 0);
          if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); hochzaehlen(); } }, { threshold: .35 });
            io.observe(film);
          } else { gezaehlt = true; wischBild(); }
        }
      } else filmBild();
    };
    stelle();
    eng.addEventListener('change', stelle);
    addEventListener('resize', stelle);
  }

  let wartet = false;
  const beiScroll = () => {
    wartet = false;
    const y = scrollY;
    if (kopf) kopf.toggleAttribute('data-fest', y > 24);
    parallaxen.forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) return;
      const mitte = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.transform = `translate3d(0,${(klemme(mitte, -1, 1) * parseFloat(el.dataset.parallax) * -innerHeight).toFixed(1)}px,0)`;
    });
    if (filmBild) filmBild();
    if (worte.length) {
      const r = aussage.getBoundingClientRect();
      if (r.bottom > -200 && r.top < innerHeight + 200) {
        const n = Math.round(klemme((innerHeight * .86 - r.top) / (r.height + innerHeight * .4), 0, 1) * worte.length);
        if (n !== wortStand) { wortStand = n; worte.forEach((w, i) => w.classList.toggle('an', i < n)); }
      }
    }
    if (grund) grund.style.transform = `translate3d(0,${(-(y * .28) % 1800).toFixed(1)}px,0)`;
    wachsen.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = klemme((innerHeight - r.top) / (innerHeight * .8), 0, 1);
      el.style.transform = `scale(${(.9 + .1 * p).toFixed(4)})`;
    });
  };
  const anstossen = () => { if (!wartet) { wartet = true; requestAnimationFrame(beiScroll); } };
  addEventListener('scroll', anstossen, { passive: true });
  addEventListener('resize', anstossen);
  beiScroll();

  /* ---------- Einblenden beim Scrollen ---------- */
  if (!ruhig && 'IntersectionObserver' in window) {
    const ziele = $$('.kopfzeile, .zusage, .bento > *, .karte, .stimmen figure, .meldung, .tor, .finder-liste, .finder-regler, .wagen, .stall, .stationen li, .kat-kopf, .rampe-text > *, .rampe-bild, .preisfeld, .fakten, .rechner, .anruf > *, .hof-teil, .bahn-kopf, .kachel, .bildraster, .formular, .kontaktwege, .seitenkopf-bild, .tabelle-huelle');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('ist-da'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    const gruppe = new Map();
    ziele.forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight * .92) return;   // schon sichtbar: nichts verstecken
      const k = gruppe.get(el.parentElement) || 0;
      gruppe.set(el.parentElement, k + 1);
      el.style.setProperty('--d', Math.min(k, 5));
      el.classList.add('ein'); io.observe(el);
    });
  }

  /* ---------- Zahlen hochzählen ---------- */
  if (!ruhig && 'IntersectionObserver' in window) {
    const zo = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      zo.unobserve(e.target);
      const el = e.target, ziel = parseFloat(el.dataset.zaehle), st = parseInt(el.dataset.stellen || '0', 10), t0 = performance.now();
      const schritt = t => {
        const p = klemme((t - t0) / 1400, 0, 1);
        el.textContent = (ziel * weich(p)).toFixed(st).replace('.', ',');
        if (p < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }), { threshold: .6 });
    $$('[data-zaehle]').forEach(el => zo.observe(el));
  }

  /* ---------- Lichtkegel auf Tafeln ---------- */
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.licht').forEach(el => el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
  }

  /* ---------- Bahn: waagerecht blättern ---------- */
  $$('[data-bahn]').forEach(b => {
    const spur = $('.bahn', b);
    $$('[data-bahn-pfeil]', b).forEach(p => p.addEventListener('click', () => {
      const karte = $('.kachel', spur), schritt = karte ? karte.getBoundingClientRect().width + 20 : 320;
      spur.scrollBy({ left: schritt * (p.dataset.bahnPfeil === 'vor' ? 1 : -1), behavior: ruhig ? 'auto' : 'smooth' });
    }));
  });

  /* ---------- Seitenwechsel: das Maschinenbild wandert von der Karte auf die Bühne der Maschinenseite ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href$=".html"]');
    if (!a || ruhig) return;
    const huelle = a.closest('.karte, .kachel, .treffer, .stufe, .reihe li, .rampe-raster');
    const img = huelle && huelle.querySelector('.buehne img, .rampe-bild img, a > img');
    if (!img) return;
    $$('[style*="view-transition-name"]').forEach(x => { x.style.viewTransitionName = ''; });
    img.style.viewTransitionName = 'maschine';
  });

  /* ---------- Kategorienleiste: zeigt, in welchem Abschnitt man gerade ist ---------- */
  const katLeiste = $('[data-kat-leiste]');
  if (katLeiste && 'IntersectionObserver' in window) {
    const marken = $$('a[href^="#"]', katLeiste), ziele = marken.map(a => $(a.getAttribute('href')));
    const setze = i => marken.forEach((a, k) => {
      if (k !== i) { a.removeAttribute('aria-current'); return; }
      if (a.getAttribute('aria-current') === 'true') return;
      a.setAttribute('aria-current', 'true');
      katLeiste.scrollTo({ left: a.offsetLeft - 12, behavior: ruhig ? 'auto' : 'smooth' });
    });
    const io = new IntersectionObserver(() => {
      const mitte = innerHeight * .4;
      let i = -1;
      ziele.forEach((z, k) => { if (z && z.getBoundingClientRect().top < mitte) i = k; });
      setze(i);
    }, { rootMargin: '-39% 0px -60% 0px' });
    ziele.forEach(z => z && io.observe(z));
  }

  /* ---------- Arbeitsbühnen vergleichen (bis zu drei) ---------- */
  const vglQuelle = $('#vergleich-daten');
  if (vglQuelle) {
    const daten = JSON.parse(vglQuelle.textContent), wahl = [];
    const knoepfe = $$('[data-vergleich]'), ablage = $('#vgl-ablage'), dialog = $('#vgl'), raster = $('.vgl-raster', dialog);
    const bilder = $('.vgl-bilder', ablage), text = $('.vgl-text', ablage), auf = $('[data-vgl-auf]', ablage);
    const esc = s => String(s).replace(/[&<>"]/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));
    const stand = () => {
      knoepfe.forEach(k => {
        const an = wahl.includes(k.dataset.vergleich);
        k.setAttribute('aria-pressed', String(an));
        k.disabled = !an && wahl.length >= 3;
        $('span', k).textContent = an ? 'Im Vergleich' : 'Vergleichen';
      });
      ablage.hidden = wahl.length === 0;
      document.documentElement.classList.toggle('vgl-aktiv', wahl.length > 0);
      bilder.innerHTML = wahl.map(s => `<img src="${esc(daten[s].bild)}" alt="">`).join('');
      text.textContent = wahl.length === 1 ? 'Noch eine Bühne wählen' : `${wahl.length} Bühnen gewählt`;
      auf.disabled = wahl.length < 2;
    };
    const zeile = (titel, wert) => `<div class="vgl-titel">${esc(titel)}</div>` + wahl.map(s => `<div class="vgl-wert">${wert(daten[s])}</div>`).join('');
    const oeffnen = () => {
      const schluessel = [];
      wahl.forEach(s => daten[s].fakten.forEach(f => { if (!schluessel.includes(f[0])) schluessel.push(f[0]); }));
      raster.style.setProperty('--n', wahl.length);
      raster.innerHTML =
        wahl.map(s => `<div class="vgl-kopfzelle"><div class="buehne"><img src="${esc(daten[s].bild)}" alt=""></div><strong>${esc(daten[s].name)}</strong><span>${esc(daten[s].kurz)}</span></div>`).join('') +
        zeile('Preis', d => `<b>${esc(d.preis)}</b><small>${esc(d.zusatz)}</small>`) +
        schluessel.map(k => zeile(k, d => { const f = d.fakten.find(x => x[0] === k); return f ? esc(f[1]) : '<i>keine Angabe</i>'; })).join('') +
        wahl.map(s => `<div class="vgl-fuss"><a class="knopf knopf--klein" href="${esc(s)}.html"><span>Ansehen</span></a><button class="merken" type="button" data-merken="${esc(s)}" aria-pressed="false">Auf die Anfrageliste</button></div>`).join('');
      zeichnen();
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    };
    knoepfe.forEach(k => k.addEventListener('click', () => {
      const s = k.dataset.vergleich, i = wahl.indexOf(s);
      if (i >= 0) wahl.splice(i, 1); else if (wahl.length < 3) wahl.push(s);
      stand();
    }));
    auf.addEventListener('click', oeffnen);
    $('[data-vgl-leeren]', ablage).addEventListener('click', () => { wahl.length = 0; stand(); });
    $('[data-vgl-zu]', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    stand();
  }

  /* ---------- Untere Leiste (Handy) ---------- */
  const dock = $('#dock'), dockAus = $$('[data-dock-aus], #anfrage');
  if (dock && 'IntersectionObserver' in window) {
    const sichtbar = new Set();
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) sichtbar.add(e.target); else sichtbar.delete(e.target); });
      dock.toggleAttribute('data-weg', sichtbar.size > 0);
    }, { rootMargin: '0px 0px -12% 0px' });
    dockAus.forEach(el => io.observe(el));
  }

  /* ---------- Bühnenfinder ---------- */
  const finder = $('#finder-form');
  if (finder) {
    const regler = $('#finder-hoehe'), aus = $('#finder-wert'), stand = $('#finder-stand'), leer = $('#finder-leer');
    const zeilen = $$('.treffer'), liste = $('.finder-liste'), rest = $('.finder-rest', liste);
    const de = n => String(n).replace('.', ',');
    const zahl = (z, k) => parseFloat(z.dataset[k]);
    let erst = true;
    /* Passende Bühnen nach oben, günstigste zuerst; die Karten gleiten an ihren neuen Platz */
    const ordne = (passend, uebrig) => {
      const folge = [...passend, rest, ...uebrig], ist = Array.from(liste.children);
      rest.hidden = !passend.length || !uebrig.length;
      if (folge.every((el, i) => ist[i] === el)) return;
      const bewegt = !ruhig && !erst && typeof liste.animate === 'function';
      const vorher = bewegt ? new Map(zeilen.map(z => [z, z.getBoundingClientRect().top])) : null;
      if (bewegt) zeilen.forEach(z => z.getAnimations().forEach(a => { if (a.id === 'ordnen') a.cancel(); }));
      folge.forEach(el => liste.append(el));
      if (!bewegt) return;
      zeilen.forEach(z => {
        const weg = vorher.get(z) - z.getBoundingClientRect().top;
        if (Math.abs(weg) > 1) z.animate([{ transform: `translateY(${weg}px)` }, { transform: 'translateY(0)' }],
          { duration: 460, easing: 'cubic-bezier(.22,.9,.24,1)', id: 'ordnen' });
      });
    };
    const rechne = () => {
      const soll = parseFloat(regler.value);
      const filter = $$('input[type=checkbox]:checked', finder).map(c => c.value);
      regler.style.setProperty('--teil', ((soll - regler.min) / (regler.max - regler.min) * 100) + '%');
      aus.textContent = de(soll) + ' m';
      let passend = [], beste = null;
      zeilen.forEach(z => {
        const h = parseFloat(z.dataset.hoehe), tags = (z.dataset.tags || '').split(' ');
        const ok = h >= soll && filter.every(f => tags.includes(f));
        z.toggleAttribute('data-aus', !ok); z.removeAttribute('data-beste');
        $('.balken', z).style.setProperty('--soll', soll);
        if (ok) { passend.push(z); if (!beste || parseFloat(z.dataset.preis) < parseFloat(beste.dataset.preis)) beste = z; }
      });
      if (beste && passend.length > 1) beste.setAttribute('data-beste', '');
      const nachPreis = (a, b) => zahl(a, 'preis') - zahl(b, 'preis') || zahl(a, 'hoehe') - zahl(b, 'hoehe');
      ordne(passend.sort(nachPreis), zeilen.filter(z => z.hasAttribute('data-aus')));
      stand.textContent = passend.length === 0 ? '' : passend.length === 1
        ? `1 von ${zeilen.length} Bühnentypen passt.` : `${passend.length} von ${zeilen.length} Bühnentypen passen.`;
      leer.hidden = passend.length > 0;
    };
    finder.addEventListener('input', rechne);
    finder.addEventListener('submit', e => e.preventDefault());
    rechne(); erst = false;
  }

  /* ---------- Lichtkasten ---------- */
  let kasten, bilder = [], stelle = 0;
  function kastenBauen() {
    kasten = document.createElement('dialog');
    kasten.className = 'lichtkasten';
    kasten.innerHTML = '<div class="lichtkasten-kopf"><span class="zahl" data-lk="stand"></span><div class="lichtkasten-nav">' +
      '<button type="button" data-lk="zurueck" aria-label="Vorheriges Foto">‹</button><button type="button" data-lk="weiter" aria-label="Nächstes Foto">›</button>' +
      '<button type="button" data-lk="zu">Schließen</button></div></div><figure><img alt=""></figure><figcaption></figcaption>';
    document.body.append(kasten);
    $('[data-lk="zu"]', kasten).addEventListener('click', () => kasten.close());
    $('[data-lk="zurueck"]', kasten).addEventListener('click', () => zeigen(stelle - 1));
    $('[data-lk="weiter"]', kasten).addEventListener('click', () => zeigen(stelle + 1));
    kasten.addEventListener('click', e => { if (e.target === kasten || e.target.tagName === 'FIGURE') kasten.close(); });
    kasten.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') zeigen(stelle - 1);
      if (e.key === 'ArrowRight') zeigen(stelle + 1);
    });
  }
  function zeigen(i) {
    stelle = (i + bilder.length) % bilder.length;
    const b = bilder[stelle], img = $('img', kasten);
    img.src = b.src; img.alt = b.alt;
    $('figcaption', kasten).textContent = b.alt;
    $('[data-lk="stand"]', kasten).textContent = `${stelle + 1} / ${bilder.length}`;
    const einzeln = bilder.length < 2;
    $('[data-lk="zurueck"]', kasten).hidden = einzeln; $('[data-lk="weiter"]', kasten).hidden = einzeln;
  }
  function oeffnen(liste_, i) {
    if (!kasten) kastenBauen();
    bilder = liste_; zeigen(i);
    if (typeof kasten.showModal === 'function') kasten.showModal(); else kasten.setAttribute('open', '');
  }
  $$('[data-galerie]').forEach(g => {
    const knoepfe = $$('button[data-voll]', g);
    const alle = knoepfe.map(k => ({ src: k.dataset.voll, alt: k.dataset.alt || '' }));
    const gross = $('.galerie-gross', g);
    let aktiv = 0;
    knoepfe.forEach((k, i) => k.addEventListener('click', () => {
      if (!gross) return oeffnen(alle, i);
      aktiv = i;
      const img = $('img', gross); img.src = k.dataset.voll; img.alt = k.dataset.alt || '';
      knoepfe.forEach(x => x.setAttribute('aria-current', String(x === k)));
    }));
    if (gross) gross.addEventListener('click', () => oeffnen(alle.length ? alle : [{ src: $('img', gross).src, alt: $('img', gross).alt }], aktiv));
  });

  /* ---------- Planwagen-Rechner ---------- */
  const rechner = $('#rechner');
  if (rechner) {
    const wagen = JSON.parse(rechner.dataset.wagen);
    const pers = $('#rechner-personen'), std = $('#rechner-stunden'), stdAus = $('#rechner-stunden-wert');
    const kopf_ = $('#rechner-wagen'), summe = $('#rechner-summe'), text = $('#rechner-text');
    const euro = n => n.toLocaleString('de-DE') + ' €';
    const gruppen = [];
    for (let m = 1; m < 1 << wagen.length; m++) {
      const teil = wagen.filter((_, i) => m & (1 << i));
      gruppen.push({ teil, plaetze: teil.reduce((a, w) => a + w.plaetze, 0), preis: teil.reduce((a, w) => a + w.preis, 0) });
    }
    gruppen.sort((a, b) => a.plaetze - b.plaetze);
    const rechne = () => {
      const n = Math.max(1, parseInt(pers.value, 10) || 1), h = parseFloat(std.value);
      stdAus.textContent = String(h).replace('.', ',') + (h === 1 ? ' Stunde' : ' Stunden');
      const g = gruppen.find(x => x.plaetze >= n);
      if (!g) {
        kopf_.textContent = 'Mehr als ' + gruppen[gruppen.length - 1].plaetze + ' Personen';
        summe.textContent = ''; text.textContent = 'Für so große Gruppen planen wir die Fahrt gemeinsam. Rufen Sie an: ' + rechner.dataset.tel + '.';
        return;
      }
      kopf_.textContent = g.teil.map(w => w.name).join(' + ') + (g.teil.length > 1 ? ` (${g.plaetze} Plätze)` : '');
      summe.textContent = euro(g.preis * h);
      text.textContent = `${String(h).replace('.', ',')} × ${euro(g.preis)} brutto je Stunde Fahrzeit. ` + (g.teil.length > 1
        ? 'Dazu kommen die Zeit für An- und Abfahrt und die Endreinigung, beides nennen wir im Angebot.'
        : 'Dazu kommen die Zeit für An- und Abfahrt und einmalig 75 € brutto für die Endreinigung.');
    };
    rechner.addEventListener('input', rechne); rechne();
  }

  /* ---------- Kopieren ---------- */
  async function kopiere(text, knopf) {
    const alt = knopf.textContent;
    try { await navigator.clipboard.writeText(text); knopf.textContent = 'Kopiert'; }
    catch (e) {
      const ziel = knopf.dataset.ziel && $(knopf.dataset.ziel);
      if (ziel) { const r = document.createRange(); r.selectNodeContents(ziel); const s = getSelection(); s.removeAllRanges(); s.addRange(r); knopf.textContent = 'Text ist markiert'; }
    }
    setTimeout(() => { knopf.textContent = alt; }, 2200);
  }
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-kopie]');
    if (k) kopiere(k.dataset.kopie || ($(k.dataset.ziel) || {}).textContent || '', k);
  });

  /* ---------- Anfrage in drei Schritten ---------- */
  const form = $('#anfrage');
  if (form) {
    const wahl = $('#k-maschine');
    wahl.addEventListener('change', () => { if (wahl.value && !liste.hat(wahl.value)) liste.wechseln(wahl.value); wahl.value = ''; });
    const schritte = $$('.schritt', form), anzeige = $$('.schritt-anzeige li', form), nachricht = $('#k-nachricht');
    const anliegen = () => (form.elements.anliegen.value || 'maschine');
    const titel = { maschine: 'Maschine mieten', planwagen: 'Planwagenfahrt', frage: 'Allgemeine Frage' };
    let stand = 0;
    if (liste.lesen().length && liste.lesen().every(s => s.startsWith('planwagen'))) form.elements.anliegen.value = 'planwagen';
    const pruefen = f => {
      const leer = !f.value.trim(), mail = f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim());
      const meldung = leer ? 'Bitte ausfüllen.' : mail ? 'Bitte eine gültige E-Mail-Adresse eintragen, zum Beispiel name@beispiel.de.' : '';
      f.setAttribute('aria-invalid', String(Boolean(meldung)));
      $('#' + f.id + '-fehler').textContent = meldung;
      return !meldung;
    };
    const gueltig = teil => {
      const pflicht = $$('[required]', teil).filter(f => !f.closest('[hidden]')), ok = pflicht.map(pruefen);
      if (ok.includes(false)) { pflicht[ok.indexOf(false)].focus(); return false; }
      return true;
    };
    const anpassen = () => {
      const a = anliegen();
      $$('[data-fuer]', form).forEach(el => { el.hidden = !el.dataset.fuer.split(' ').includes(a); });
      const pflicht = a === 'frage';
      nachricht.required = pflicht;
      $('[data-pflicht]', form).hidden = !pflicht;
      if (!pflicht) { nachricht.removeAttribute('aria-invalid'); $('#k-nachricht-fehler').textContent = ''; }
    };
    const zeige = (i, fokus) => {
      stand = i;
      schritte.forEach((s, k) => { s.hidden = k !== i; });
      anzeige.forEach((li, k) => {
        if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        li.toggleAttribute('data-fertig', k < i);
      });
      if (fokus) { const ziel = $('legend', schritte[i]); ziel.tabIndex = -1; ziel.focus({ preventScroll: true }); form.scrollIntoView({ block: 'nearest' }); }
    };
    $$('input[name=anliegen]', form).forEach(r => r.addEventListener('change', anpassen));
    $$('[data-weiter]', form).forEach(b => b.addEventListener('click', () => { anpassen(); if (gueltig(schritte[stand])) zeige(stand + 1, true); }));
    $$('[data-zurueck]', form).forEach(b => b.addEventListener('click', () => zeige(stand - 1, true)));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!gueltig(schritte[stand])) return;
      const v = id => $('#' + id).value.trim(), a = anliegen();
      const gewaehlt = a === 'frage' ? [] : liste.lesen().map(s => namen[s] || s);
      const zeilen = ['Guten Tag,', '', 'ich möchte anfragen:', '',
        'Anliegen: ' + titel[a],
        'Name: ' + v('k-name'), 'E-Mail: ' + v('k-mail'),
        v('k-tel') ? 'Telefon: ' + v('k-tel') : null,
        gewaehlt.length ? (a === 'planwagen' ? 'Auswahl: ' : 'Mietmaschinen: ') + gewaehlt.join(', ') : null,
        a === 'maschine' && v('k-zeit') ? 'Wunschzeitraum: ' + v('k-zeit') : null,
        a === 'maschine' && v('k-ort') ? 'Einsatzort: ' + v('k-ort') : null,
        a === 'planwagen' && v('k-datum') ? 'Datum der Fahrt: ' + v('k-datum') : null,
        a === 'planwagen' && v('k-personen') ? 'Personenzahl: ' + v('k-personen') : null,
        a === 'planwagen' && v('k-strecke') ? 'Start und Ziel: ' + v('k-strecke') : null,
        v('k-nachricht') ? '' : null, v('k-nachricht') ? 'Nachricht:' : null, v('k-nachricht') || null].filter(z => z !== null);
      const text = zeilen.join('\n');
      const betreff = 'Anfrage ' + titel[a] + (gewaehlt.length ? ': ' + gewaehlt.join(', ') : '');
      $('#anfrage-text').textContent = text;
      $('#anfrage-mail').href = `mailto:${form.dataset.mail}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
      schritte.forEach(s => { s.hidden = true; });
      anzeige.forEach(li => { li.removeAttribute('aria-current'); li.setAttribute('data-fertig', ''); });
      const erg = $('#anfrage-ergebnis'); erg.hidden = false; erg.scrollIntoView({ block: 'nearest' }); erg.focus();
    });
    $('[data-neu]', form).addEventListener('click', () => { $('#anfrage-ergebnis').hidden = true; zeige(0, true); });
    $$('#k-name, #k-mail, #k-nachricht', form).forEach(f => f.addEventListener('blur', () => { if (f.getAttribute('aria-invalid') === 'true') pruefen(f); }));
    anpassen();
  }
})();
