/* Planwagenfahrten Schulze-Renzel – Seitenlogik ohne Fremdbibliotheken */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const klemme = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- Menü ---------- */
  const kopf = $('.kopf'), menue = $('.menue');
  if (kopf && menue) {
    const setze = offen => { kopf.toggleAttribute('data-offen', offen); menue.setAttribute('aria-expanded', String(offen)); };
    menue.addEventListener('click', () => setze(!kopf.hasAttribute('data-offen')));
    $$('.nav a', kopf).forEach(a => a.addEventListener('click', () => setze(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && kopf.hasAttribute('data-offen')) { setze(false); menue.focus(); } });
  }

  /* ---------- Untere Leiste (Handy): weg, wo Kontakt ohnehin im Bild ist ---------- */
  const dock = $('#dock');
  if (dock && 'IntersectionObserver' in window) {
    const sichtbar = new Set();
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) sichtbar.add(e.target); else sichtbar.delete(e.target); });
      dock.toggleAttribute('data-weg', sichtbar.size > 0);
    }, { rootMargin: '0px 0px -12% 0px' });
    $$('[data-dock-aus]').forEach(el => io.observe(el));
  }

  /* ---------- Einblenden ---------- */
  if (!ruhig && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('ist-da'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    const gruppe = new Map();
    $$('.kopfzeile, .karte, .rechner-felder, .fahrkarte, .halte li, .stempel, .haken--gross li, .formular, .wege a').forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight * .92) return;
      const k = gruppe.get(el.parentElement) || 0;
      gruppe.set(el.parentElement, k + 1);
      el.style.setProperty('--d', Math.min(k, 6));
      el.classList.add('ein'); io.observe(el);
    });
  }

  /* ---------- Ablauf: das Gespann fährt mit dem Scrollen die Straße entlang ---------- */
  const strasse = $('.strasse'), gespann = $('.strasse-gespann');
  if (strasse && gespann && !ruhig) {
    let wartet = false;
    const fahre = () => {
      wartet = false;
      const r = strasse.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const p = klemme((innerHeight * .92 - r.top) / (innerHeight * .78), 0, 1);
      gespann.style.transform = `translate3d(${(p * (strasse.clientWidth - gespann.offsetWidth)).toFixed(1)}px,0,0)`;
    };
    const anstossen = () => { if (!wartet) { wartet = true; requestAnimationFrame(fahre); } };
    addEventListener('scroll', anstossen, { passive: true });
    addEventListener('resize', anstossen);
    fahre();
  }

  /* ---------- Lichtkasten: je Wagen eine eigene Bildfolge ---------- */
  let kasten, bilder = [], stelle = 0;
  function bauen() {
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
    /* Wischen am Handy */
    let x0 = null;
    kasten.addEventListener('pointerdown', e => { x0 = e.clientX; });
    kasten.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const weg = e.clientX - x0; x0 = null;
      if (Math.abs(weg) > 48) zeigen(stelle + (weg < 0 ? 1 : -1));
    });
  }
  function zeigen(i) {
    stelle = (i + bilder.length) % bilder.length;
    const b = bilder[stelle], img = $('img', kasten);
    img.src = b.src; img.alt = b.alt;
    $('figcaption', kasten).textContent = b.alt;
    $('[data-lk="stand"]', kasten).textContent = `${stelle + 1} / ${bilder.length}`;
  }
  $$('[data-galerie]').forEach(g => {
    const knoepfe = $$('button[data-voll]', g);
    const alle = knoepfe.map(k => ({ src: k.dataset.voll, alt: k.dataset.alt || '' }));
    const auf = i => {
      if (!kasten) bauen();
      bilder = alle; zeigen(i);
      if (typeof kasten.showModal === 'function') kasten.showModal(); else kasten.setAttribute('open', '');
    };
    knoepfe.forEach((k, i) => k.addEventListener('click', () => auf(i)));
    const alleKnopf = $('[data-galerie-auf]', g);
    if (alleKnopf) alleKnopf.addEventListener('click', () => auf(0));
  });

  /* ---------- Rechner: welcher Wagen passt, was kostet die Fahrzeit ---------- */
  const rechner = $('#rechner');
  let vorschlag = null;
  if (rechner) {
    const wagen = JSON.parse(rechner.dataset.wagen);
    const pers = $('#rechner-personen'), std = $('#rechner-stunden'), stdAus = $('#rechner-stunden-wert');
    const kopfzeile = $('#rechner-wagen'), summe = $('#rechner-summe'), text = $('#rechner-text');
    const euro = n => n.toLocaleString('de-DE') + ' €';
    const gruppen = [];
    for (let m = 1; m < 1 << wagen.length; m++) {
      const teil = wagen.filter((_, i) => m & (1 << i));
      gruppen.push({ teil, plaetze: teil.reduce((a, w) => a + w.plaetze, 0), preis: teil.reduce((a, w) => a + w.preis, 0) });
    }
    gruppen.sort((a, b) => a.plaetze - b.plaetze);
    const rechne = () => {
      const n = Math.max(1, parseInt(pers.value, 10) || 1), h = parseFloat(std.value);
      std.style.setProperty('--teil', ((h - std.min) / (std.max - std.min) * 100).toFixed(1) + '%');
      stdAus.textContent = String(h).replace('.', ',') + (h === 1 ? ' Stunde' : ' Stunden');
      const g = gruppen.find(x => x.plaetze >= n);
      vorschlag = { personen: n, wagen: g && g.teil.length === 1 ? g.teil[0].name : '' };
      if (!g) {
        kopfzeile.textContent = 'Mehr als ' + gruppen[gruppen.length - 1].plaetze + ' Personen';
        summe.textContent = ''; text.textContent = 'Für so große Gruppen planen wir die Fahrt gemeinsam. Rufen Sie an: ' + rechner.dataset.tel + '.';
        return;
      }
      kopfzeile.textContent = g.teil.map(w => w.name).join(' + ') + (g.teil.length > 1 ? ` (${g.plaetze} Plätze)` : '');
      summe.textContent = euro(g.preis * h);
      text.textContent = `${String(h).replace('.', ',')} × ${euro(g.preis)} brutto je Stunde Fahrzeit. ` + (g.teil.length > 1
        ? 'Dazu kommen die Zeit für An- und Abfahrt und die Endreinigung, beides nennen wir im Angebot.'
        : 'Dazu kommen die Zeit für An- und Abfahrt und einmalig 75 € brutto für die Endreinigung.');
    };
    $$('[data-schritt]', rechner).forEach(b => b.addEventListener('click', () => {
      pers.value = String(klemme((parseInt(pers.value, 10) || 1) + Number(b.dataset.schritt), 1, 120)); rechne();
    }));
    rechner.addEventListener('input', rechne); rechne();
  }

  /* ---------- Fahrtanfrage in drei Schritten ---------- */
  const form = $('#fahrtanfrage');
  if (form) {
    const schritte = $$('.schritt', form), anzeige = $$('.schritt-anzeige li', form);
    let stand = 0;
    const pruefen = f => {
      const leer = !f.value.trim(), mail = f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim());
      const meldung = leer ? 'Bitte ausfüllen.' : mail ? 'Bitte eine gültige E-Mail-Adresse eintragen, zum Beispiel name@beispiel.de.' : '';
      f.setAttribute('aria-invalid', String(Boolean(meldung)));
      $('#' + f.id + '-fehler').textContent = meldung;
      return !meldung;
    };
    const gueltig = teil => {
      const pflicht = $$('[required]', teil), ok = pflicht.map(pruefen);
      if (ok.includes(false)) { pflicht[ok.indexOf(false)].focus(); return false; }
      return true;
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
    const waehle = name => { const r = $$('input[name=wagen]', form).find(x => x.value === name); if (r) r.checked = true; };
    /* Knöpfe an den Wagen und am Rechner füllen das Formular vor */
    $$('a[data-wagen]').forEach(a => a.addEventListener('click', () => { $('#fahrtanfrage-ergebnis').hidden = true; waehle(a.dataset.wagen); zeige(0); }));
    const ausRechner = $('[data-rechner-anfrage]');
    if (ausRechner) ausRechner.addEventListener('click', () => {
      if (!vorschlag) return;
      $('#fahrtanfrage-ergebnis').hidden = true;
      waehle(vorschlag.wagen); $('#p-personen').value = String(vorschlag.personen); zeige(0);
    });
    $$('[data-weiter]', form).forEach(b => b.addEventListener('click', () => { if (gueltig(schritte[stand])) zeige(stand + 1, true); }));
    $$('[data-zurueck]', form).forEach(b => b.addEventListener('click', () => zeige(stand - 1, true)));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!gueltig(schritte[stand])) return;
      const v = id => $('#' + id).value.trim(), wagen = form.elements.wagen.value;
      const zeilen = ['Guten Tag,', '', 'ich möchte eine Planwagenfahrt anfragen:', '',
        'Name: ' + v('p-name'), 'E-Mail: ' + v('p-mail'),
        v('p-tel') ? 'Telefon: ' + v('p-tel') : null,
        'Wagen: ' + (wagen || 'noch offen'),
        'Datum der Fahrt: ' + v('p-datum'),
        'Personenzahl: ' + v('p-personen'),
        v('p-strecke') ? 'Start und Ziel: ' + v('p-strecke') : null,
        v('p-nachricht') ? '' : null, v('p-nachricht') ? 'Nachricht:' : null, v('p-nachricht') || null].filter(z => z !== null);
      const text = zeilen.join('\n');
      $('#fahrtanfrage-text').textContent = text;
      $('#fahrtanfrage-mail').href = `mailto:${form.dataset.mail}?subject=${encodeURIComponent('Anfrage Planwagenfahrt')}&body=${encodeURIComponent(text)}`;
      schritte.forEach(s => { s.hidden = true; });
      anzeige.forEach(li => { li.removeAttribute('aria-current'); li.setAttribute('data-fertig', ''); });
      const erg = $('#fahrtanfrage-ergebnis'); erg.hidden = false; erg.scrollIntoView({ block: 'nearest' }); erg.focus();
    });
    $('[data-neu]', form).addEventListener('click', () => { $('#fahrtanfrage-ergebnis').hidden = true; zeige(0, true); });
    $$('[required]', form).forEach(f => f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') pruefen(f); }));
    const kopie = $('#fahrtanfrage-kopie');
    if (kopie) kopie.addEventListener('click', async () => {
      const alt = kopie.textContent;
      try { await navigator.clipboard.writeText($('#fahrtanfrage-text').textContent); kopie.textContent = 'Kopiert'; }
      catch (e) { const r = document.createRange(); r.selectNodeContents($('#fahrtanfrage-text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); kopie.textContent = 'Text ist markiert'; }
      setTimeout(() => { kopie.textContent = alt; }, 2200);
    });
  }
})();
