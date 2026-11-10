/* MSR Maschinenvermietung – Seitenlogik ohne Fremdbibliotheken */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const daten = (() => { try { return JSON.parse($('#msr-daten').textContent); } catch (e) { return {}; } })();
  const namen = daten.namen || {};

  /* ---------- Menü ---------- */
  const kopf = $('.kopf'), menue = $('.menue-knopf');
  if (kopf && menue) {
    menue.addEventListener('click', () => {
      const offen = kopf.toggleAttribute('data-offen');
      menue.setAttribute('aria-expanded', String(offen));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && kopf.hasAttribute('data-offen')) { kopf.removeAttribute('data-offen'); menue.setAttribute('aria-expanded', 'false'); menue.focus(); }
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

  /* ---------- Höhenprofil im Hero ---------- */
  const profil = $('.profil');
  if (profil) {
    const saeulen = $$('.saeule', profil);
    const feld = n => $(`[data-anz="${n}"]`, profil);
    const waehlen = s => {
      saeulen.forEach(x => x.toggleAttribute('data-aktiv', x === s));
      const d = s.dataset;
      feld('name').textContent = d.name;
      feld('art').textContent = d.art;
      feld('hoehe').textContent = d.hoehe;
      feld('preis').textContent = d.preis;
      const l = feld('link'); l.href = d.href; l.firstElementChild.textContent = d.name + ' ansehen';
    };
    const fein = window.matchMedia('(hover:hover) and (pointer:fine)');
    saeulen.forEach(s => {
      const a = $('a', s);
      s.addEventListener('pointerenter', () => { if (fein.matches) waehlen(s); });
      a.addEventListener('focus', () => waehlen(s));
      a.addEventListener('click', e => { if (!s.hasAttribute('data-aktiv')) { e.preventDefault(); waehlen(s); } });
    });
  }

  /* ---------- Bühnenfinder ---------- */
  const finder = $('#finder-form');
  if (finder) {
    const regler = $('#finder-hoehe'), aus = $('#finder-wert'), stand = $('#finder-stand'), leer = $('#finder-leer');
    const zeilen = $$('.treffer');
    const de = n => String(n).replace('.', ',');
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
      stand.textContent = passend.length === 0 ? '' : passend.length === 1
        ? `1 von ${zeilen.length} Bühnen passt.` : `${passend.length} von ${zeilen.length} Bühnen passen.`;
      leer.hidden = passend.length > 0;
    };
    finder.addEventListener('input', rechne);
    finder.addEventListener('submit', e => e.preventDefault());
    rechne();
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

  /* ---------- Anfrageformular ---------- */
  const form = $('#anfrage');
  if (form) {
    const wahl = $('#k-maschine');
    wahl.addEventListener('change', () => { if (wahl.value && !liste.hat(wahl.value)) liste.wechseln(wahl.value); wahl.value = ''; });
    const pruefen = f => {
      const leer = !f.value.trim(), mail = f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim());
      const meldung = leer ? 'Bitte ausfüllen.' : mail ? 'Bitte eine gültige E-Mail-Adresse eintragen, zum Beispiel name@beispiel.de.' : '';
      f.setAttribute('aria-invalid', String(Boolean(meldung)));
      $('#' + f.id + '-fehler').textContent = meldung;
      return !meldung;
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const pflicht = $$('[required]', form), ok = pflicht.map(pruefen);
      if (ok.includes(false)) { pflicht[ok.indexOf(false)].focus(); return; }
      const v = id => $('#' + id).value.trim();
      const gewaehlt = liste.lesen().map(s => namen[s] || s);
      const zeilen = ['Guten Tag,', '', 'ich möchte anfragen:', '',
        'Name: ' + v('k-name'), 'E-Mail: ' + v('k-mail'),
        v('k-tel') ? 'Telefon: ' + v('k-tel') : null,
        v('k-zeit') ? 'Wunschzeitraum: ' + v('k-zeit') : null,
        gewaehlt.length ? 'Mietmaschinen: ' + gewaehlt.join(', ') : null,
        $('#k-reiterhof').checked ? 'Die Anfrage bezieht sich auf den Reiterhof (Stallanfrage).' : null,
        '', 'Nachricht:', v('k-nachricht')].filter(z => z !== null);
      const text = zeilen.join('\n');
      const betreff = 'Anfrage' + (gewaehlt.length ? ': ' + gewaehlt.join(', ') : '');
      $('#anfrage-text').textContent = text;
      $('#anfrage-mail').href = `mailto:${form.dataset.mail}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
      const erg = $('#anfrage-ergebnis'); erg.hidden = false; erg.scrollIntoView({ block: 'nearest' }); erg.focus();
    });
    $$('[required]', form).forEach(f => f.addEventListener('blur', () => { if (f.getAttribute('aria-invalid') === 'true') pruefen(f); }));
  }
})();
