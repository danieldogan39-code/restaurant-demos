/* Reiterhof Schulze-Renzel – Seitenlogik ohne Fremdbibliotheken */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    $$('.kopfzeile, .plan, .anlage-liste li, .stall, .spalte, .futter, .stimmen figure, .galerie button, .hof-bild, .zeit li, .formular, .wege a').forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight * .92) return;
      const k = gruppe.get(el.parentElement) || 0;
      gruppe.set(el.parentElement, k + 1);
      el.style.setProperty('--d', Math.min(k, 6));
      el.classList.add('ein'); io.observe(el);
    });
  }

  /* ---------- Lichtkasten ---------- */
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
    knoepfe.forEach((k, i) => k.addEventListener('click', () => {
      if (!kasten) bauen();
      bilder = alle; zeigen(i);
      if (typeof kasten.showModal === 'function') kasten.showModal(); else kasten.setAttribute('open', '');
    }));
  });

  /* ---------- Stallanfrage in drei Schritten ---------- */
  const form = $('#stallanfrage');
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
    $$('[data-weiter]', form).forEach(b => b.addEventListener('click', () => { if (gueltig(schritte[stand])) zeige(stand + 1, true); }));
    $$('[data-zurueck]', form).forEach(b => b.addEventListener('click', () => zeige(stand - 1, true)));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!gueltig(schritte[stand])) return;
      const v = id => $('#' + id).value.trim(), stall = form.elements.stallart.value;
      const zeilen = ['Guten Tag,', '', 'ich interessiere mich für einen Pensionsplatz auf dem Reiterhof:', '',
        'Name: ' + v('r-name'), 'E-Mail: ' + v('r-mail'),
        v('r-tel') ? 'Telefon: ' + v('r-tel') : null,
        'Wunsch-Stallart: ' + (stall || 'noch offen'),
        v('r-zeit') ? 'Gewünschter Zeitpunkt: ' + v('r-zeit') : null,
        '', 'Nachricht:', v('r-nachricht')].filter(z => z !== null);
      const text = zeilen.join('\n');
      $('#stallanfrage-text').textContent = text;
      $('#stallanfrage-mail').href = `mailto:${form.dataset.mail}?subject=${encodeURIComponent('Stallanfrage Reiterhof')}&body=${encodeURIComponent(text)}`;
      schritte.forEach(s => { s.hidden = true; });
      anzeige.forEach(li => { li.removeAttribute('aria-current'); li.setAttribute('data-fertig', ''); });
      const erg = $('#stallanfrage-ergebnis'); erg.hidden = false; erg.scrollIntoView({ block: 'nearest' }); erg.focus();
    });
    $('[data-neu]', form).addEventListener('click', () => { $('#stallanfrage-ergebnis').hidden = true; zeige(0, true); });
    $$('[required]', form).forEach(f => f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') pruefen(f); }));
    const kopie = $('#stallanfrage-kopie');
    if (kopie) kopie.addEventListener('click', async () => {
      const alt = kopie.textContent;
      try { await navigator.clipboard.writeText($('#stallanfrage-text').textContent); kopie.textContent = 'Kopiert'; }
      catch (e) { const r = document.createRange(); r.selectNodeContents($('#stallanfrage-text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); kopie.textContent = 'Text ist markiert'; }
      setTimeout(() => { kopie.textContent = alt; }, 2200);
    });
  }
})();
