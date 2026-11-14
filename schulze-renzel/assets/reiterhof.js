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
    }, { rootMargin: '-96px 0px -12% 0px'   /* was unter der festen Kopfzeile liegt, zählt nicht mehr als sichtbar */ });
    $$('[data-dock-aus]').forEach(el => io.observe(el));
  }

  /* ---------- Einblenden ---------- */
  if (!ruhig && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el); el.classList.add('ist-da');
      setTimeout(() => el.classList.remove('ein', 'ist-da'), 1100);   // danach gelten wieder die eigenen Übergänge des Elements
    }), { rootMargin: '0px 0px -4% 0px' });
    const gruppe = new Map();
    $$('.kopfzeile, .plan, .anlage-liste li, .stall, .spalte, .futter, .stimmen figure, .galerie button, .hof-bild, .zeit li, .formular, .wege a').forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight * .92) return;
      if (el.classList.contains('stall') && getComputedStyle(el.parentElement).overflowX !== 'visible') return;   // in der Leiste zum Wischen nichts verschieben
      const k = gruppe.get(el.parentElement) || 0;
      gruppe.set(el.parentElement, k + 1);
      el.style.setProperty('--d', Math.min(k, 4));
      el.classList.add('ein'); io.observe(el);
    });
  }


  /* ---------- Menü zeigt den Abschnitt, in dem man gerade liest ---------- */
  if ('IntersectionObserver' in window) {
    const paare = $$('.kopf .nav ul a[href^="#"]').map(a => [a, document.getElementById(a.getAttribute('href').slice(1))]).filter(p => p[1]);
    const imBild = new Set();
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) imBild.add(e.target); else imBild.delete(e.target); });
      const aktiv = paare.filter(p => imBild.has(p[1])).pop();
      paare.forEach(p => { if (aktiv && p === aktiv) p[0].setAttribute('aria-current', 'true'); else p[0].removeAttribute('aria-current'); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    paare.forEach(p => io.observe(p[1]));
  }

  /* ---------- Lichtkasten ---------- */
  /* Wischen im Lichtkasten: Das Foto folgt dem Finger und kippt ab einem Fünftel der Breite oder mit Schwung zum nächsten.
     Senkrechtes Wischen und Zoomen mit zwei Fingern bleiben beim Browser. */
  function wischbar(kasten, blaettern, anzahl) {
    const fig = $('figure', kasten), img = $('img', fig);
    let id = null, x0 = 0, y0 = 0, dx = 0, t0 = 0, quer = null, zuletzt = 0;
    const weich = an => { img.style.transition = an ? 'transform .26s cubic-bezier(.22,1,.36,1), opacity .26s' : 'none'; };
    const ruhe = () => { weich(true); img.style.transform = ''; img.style.opacity = ''; };
    img.draggable = false;
    fig.addEventListener('pointerdown', e => {
      if (anzahl() < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; t0 = e.timeStamp; quer = null;
    });
    fig.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (quer === null) {
        const dy = e.clientY - y0;
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        quer = Math.abs(dx) > Math.abs(dy);
        if (quer) { try { fig.setPointerCapture(id); } catch (f) {} weich(false); }
      }
      if (!quer || ruhig) return;
      img.style.transform = `translate3d(${dx.toFixed(1)}px,0,0)`;
      img.style.opacity = String(1 - Math.min(.55, Math.abs(dx) / fig.clientWidth));
    });
    const ende = e => {
      if (e.pointerId !== id) return;
      id = null;
      if (!quer) return;
      zuletzt = e.timeStamp;
      const tempo = dx / Math.max(1, e.timeStamp - t0);
      if (e.type !== 'pointerup' || (Math.abs(dx) < fig.clientWidth * .2 && Math.abs(tempo) < .45)) return ruhe();
      const r = dx < 0 ? 1 : -1;
      if (ruhig) return blaettern(r);
      weich(true); img.style.transform = `translate3d(${-r * fig.clientWidth * .45}px,0,0)`; img.style.opacity = '0';
      setTimeout(async () => {
        blaettern(r);
        weich(false); img.style.transform = `translate3d(${r * 56}px,0,0)`;
        try { await img.decode(); } catch (f) {}
        requestAnimationFrame(() => requestAnimationFrame(ruhe));
      }, 150);
    };
    fig.addEventListener('pointerup', ende);
    fig.addEventListener('pointercancel', ende);
    return e => e.timeStamp - zuletzt < 400;   // true: dieser Klick gehört noch zum Wischen und schließt nichts
  }
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
    const gewischt = wischbar(kasten, r => zeigen(stelle + r), () => bilder.length);
    kasten.addEventListener('click', e => { if (gewischt(e)) return; if (e.target === kasten || e.target.tagName === 'FIGURE') kasten.close(); });
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
    if (bilder.length > 1) [stelle + 1, stelle - 1].forEach(k => { new Image().src = bilder[(k + bilder.length) % bilder.length].src; });
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
    /* „Diesen Stall anfragen“ an den Stallkarten wählt die Stallart im Formular vor */
    $$('a[data-stall]').forEach(l => l.addEventListener('click', () => {
      const r = $$('input[name=stallart]', form).find(x => x.value === l.dataset.stall);
      if (r) r.checked = true;
      $('#stallanfrage-ergebnis').hidden = true; zeige(0);
    }));
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
