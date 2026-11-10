(function () {
  'use strict';
  var ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var kannBeobachten = 'IntersectionObserver' in window;
  var $ = function (id) { return document.getElementById(id); };
  var alle = function (sel, von) { return Array.prototype.slice.call((von || document).querySelectorAll(sel)); };
  function klemme(x) { return Math.max(0, Math.min(1, x)); }

  /* Kopfzeile: dunkel über dem Seitenkopf, hell darunter */
  var kopf = $('kopf');
  var dunkel = document.querySelector('[data-kopf-dunkel]');
  function kopfStand() {
    kopf.classList.toggle('ist-unterwegs', window.scrollY > 8);
    kopf.classList.toggle('auf-dunkel', !!dunkel && dunkel.getBoundingClientRect().bottom > kopf.getBoundingClientRect().bottom);
  }
  window.addEventListener('scroll', kopfStand, { passive: true });
  window.addEventListener('resize', kopfStand);
  kopfStand();

  /* Handy-Menü */
  var menueKnopf = $('menue-knopf'), mobilnav = $('mobilnav');
  function menue(offen) {
    mobilnav.hidden = !offen;
    menueKnopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
    menueKnopf.textContent = offen ? 'Schließen' : 'Menü';
  }
  menueKnopf.addEventListener('click', function () { menue(mobilnav.hidden); });
  mobilnav.addEventListener('click', function (e) { if (e.target.tagName === 'A') menue(false); });

  /* Titelfilm: läuft von selbst, lässt sich anhalten */
  var film = $('film'), pause = $('film-pause');
  if (film && pause) {
    var pauseText = pause.querySelector('span');
    var zeige = function (laeuft) {
      pause.setAttribute('aria-pressed', laeuft ? 'false' : 'true');
      pauseText.textContent = laeuft ? 'Film anhalten' : 'Film abspielen';
      pause.querySelector('.ic-pause').style.display = laeuft ? '' : 'none';
      pause.querySelector('.ic-play').style.display = laeuft ? 'none' : '';
    };
    var hoch = window.innerWidth < 900 && window.innerHeight > window.innerWidth;
    if (hoch) film.poster = film.getAttribute('data-poster-hoch');
    var lade = function () {
      if (film.getAttribute('src')) return;
      film.src = film.getAttribute(hoch ? 'data-klein' : 'data-gross');
    };
    var spiele = function () {
      lade();
      var p = film.play();
      if (p && p.then) p.then(function () { zeige(true); }, function () { zeige(false); }); else zeige(true);
    };
    pause.addEventListener('click', function () { if (film.paused) spiele(); else { film.pause(); zeige(false); } });
    if (ruhig) zeige(false); else spiele();
    if (kannBeobachten) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { if (film.dataset.warLos === '1') spiele(); }
        else if (!film.paused) { film.dataset.warLos = '1'; film.pause(); }
        else film.dataset.warLos = '0';
      }, { threshold: 0.05 }).observe(film);
    }
  }

  /* Vorher-Nachher-Regler */
  alle('[data-vn]').forEach(function (vn) {
    var regler = vn.querySelector('.vn__regler'), zieht = false;
    vn.setze = function (wert) {
      wert = Math.max(0, Math.min(100, wert));
      vn.style.setProperty('--pos', wert + '%');
      regler.value = Math.round(wert);
    };
    function ausZeiger(e) { var b = vn.getBoundingClientRect(); return (e.clientX - b.left) / b.width * 100; }
    regler.addEventListener('input', function () { vn.setze(+regler.value); });
    vn.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      zieht = true;
      try { vn.setPointerCapture(e.pointerId); } catch (err) {}
      if (e.pointerType !== 'touch') vn.setze(ausZeiger(e));
    });
    vn.addEventListener('pointermove', function (e) { if (zieht) vn.setze(ausZeiger(e)); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { vn.addEventListener(t, function () { zieht = false; }); });
  });

  /* Galerie */
  var gVn = $('galerie-vn'), knoepfe = alle('.projekt');
  if (gVn) knoepfe.forEach(function (knopf, i) {
    knopf.addEventListener('click', function () {
      knoepfe.forEach(function (k) { k.setAttribute('aria-pressed', k === knopf ? 'true' : 'false'); });
      var id = knopf.getAttribute('data-id'), titel = knopf.getAttribute('data-titel');
      var vor = $('galerie-vor'), nach = $('galerie-nach');
      vor.src = vor.getAttribute('src').replace(/r\d\d-vorher/, 'r' + id + '-vorher');
      nach.src = nach.getAttribute('src').replace(/r\d\d-nachher/, 'r' + id + '-nachher');
      vor.alt = titel + ' vor der Reinigung';
      nach.alt = titel + ' nach der Reinigung';
      $('galerie-titel').textContent = titel;
      $('galerie-zaehler').textContent = (i + 1) + ' von ' + knoepfe.length;
      gVn.setze(50);
    });
  });

  /* Rechner */
  var feld = $('anstrich'), schieber = $('anstrich-regler');
  if (feld && schieber) {
    var euro = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
    var rechne = function (wert) {
      if (!isFinite(wert) || wert <= 0) return;
      $('aus-anstrich').textContent = euro.format(wert) + ' €';
      $('aus-reinigung').textContent = 'ab ' + euro.format(wert * 0.3) + ' €';
      $('aus-ersparnis').textContent = 'bis zu ' + euro.format(wert * 0.7) + ' €';
    };
    feld.addEventListener('input', function () {
      var w = parseFloat(feld.value);
      if (isFinite(w)) schieber.value = Math.max(+schieber.min, Math.min(+schieber.max, w));
      rechne(w);
    });
    schieber.addEventListener('input', function () { feld.value = schieber.value; rechne(+schieber.value); });
  }

  /* Zeichnung: die Lanze fährt aus */
  var zeichnung = $('zeichnung');
  if (zeichnung && kannBeobachten && !ruhig && zeichnung.getBoundingClientRect().top > window.innerHeight) {
    zeichnung.classList.add('ist-kurz');
    var zSeher = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { zeichnung.classList.remove('ist-kurz'); zSeher.disconnect(); }
    }, { threshold: 0.2 });
    zSeher.observe(zeichnung);
  }

  /* Feste Handy-Leiste: aus, solange Titel oder Formular zu sehen sind */
  var leiste = $('leiste'), aus = alle('[data-leiste-aus]');
  if (kannBeobachten && leiste && aus.length) {
    var sichtbar = [];
    leiste.classList.add('ist-weg');
    var lSeher = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        var n = sichtbar.indexOf(e.target);
        if (e.isIntersecting && n < 0) sichtbar.push(e.target);
        if (!e.isIntersecting && n >= 0) sichtbar.splice(n, 1);
      });
      leiste.classList.toggle('ist-weg', sichtbar.length > 0);
    }, { threshold: 0.08 });
    aus.forEach(function (el) { lSeher.observe(el); });
  }

  /* Einblenden beim Scrollen: nur was unterhalb des ersten Bildschirms liegt */
  if (kannBeobachten && !ruhig) {
    var einSeher = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('ist-drin'); einSeher.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0 });
    alle('.kopfzeile, .zahlen li, .phase, .galerie, .stimmen, .vergleich, .rechner, .zeichnung, .vorteile li, .objekte, .gruppen > div, .befall, .wissen > div, .faq details, .zusagen li, .kontakt__links, .formular, .kachel, .ref, .prosa > *, .blick, .band__in').forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      var platz = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty('--warte', (Math.min(platz, 5) * 60) + 'ms');
      el.classList.add('ein');
      einSeher.observe(el);
    });
  }

  /* Zahlen zählen hoch */
  if (kannBeobachten && !ruhig) {
    var nSeher = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        nSeher.unobserve(e.target);
        var el = e.target, ende = +el.getAttribute('data-zaehl'), beginn = null;
        requestAnimationFrame(function lauf(zeit) {
          if (beginn === null) beginn = zeit;
          var t = klemme((zeit - beginn) / 1400);
          el.textContent = Math.round(ende * (1 - Math.pow(1 - t, 4)));
          if (t < 1) requestAnimationFrame(lauf);
        });
      });
    }, { threshold: 0.6 });
    alle('[data-zaehl]').forEach(function (el) { nSeher.observe(el); });
  }

  /* Karussell: Pfeile und Ziehen mit der Maus; Klicks auf Links bleiben erhalten */
  var bahn = document.querySelector('.objekte');
  if (bahn && $('obj-weiter')) {
    var schritt = function (r) {
      bahn.scrollBy({ left: r * (bahn.querySelector('.objekt').offsetWidth + 20), behavior: ruhig ? 'auto' : 'smooth' });
    };
    $('obj-zurueck').addEventListener('click', function () { schritt(-1); });
    $('obj-weiter').addEventListener('click', function () { schritt(1); });
    var zieh = null, gezogen = false;
    bahn.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button) return;
      zieh = { x: e.clientX, links: bahn.scrollLeft, id: e.pointerId, fest: false }; gezogen = false;
    });
    bahn.addEventListener('pointermove', function (e) {
      if (!zieh) return;
      var dx = e.clientX - zieh.x;
      if (!zieh.fest && Math.abs(dx) > 6) { zieh.fest = true; gezogen = true; bahn.style.scrollSnapType = 'none'; bahn.setPointerCapture(zieh.id); }
      if (zieh.fest) bahn.scrollLeft = zieh.links - dx;
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      bahn.addEventListener(t, function () { if (zieh) { zieh = null; bahn.style.scrollSnapType = ''; } });
    });
    bahn.addEventListener('click', function (e) { if (gezogen) { e.preventDefault(); gezogen = false; } }, true);
    bahn.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  /* Anfrage in drei Schritten: im Entwurf wird nichts versendet */
  var formular = $('anfrage');
  if (!formular) return;
  var meldung = $('meldung'), stufen = alle('.stufe', formular), aktuell = 0;
  var FELDER = {
    'Probefläche': ['f-name', 'f-strasse', 'f-plz', 'f-ort', 'f-tel', 'f-mail', 'f-foto', 'f-text'],
    'Rückruf': ['f-name', 'f-tel', 'f-text'],
    'Infoblatt': ['f-name', 'f-mail']
  };
  var PFLICHT = {
    'Probefläche': ['f-name', 'f-strasse', 'f-plz', 'f-ort', 'f-tel', 'f-mail'],
    'Rückruf': ['f-name', 'f-tel'],
    'Infoblatt': ['f-name', 'f-mail']
  };
  function gewaehlt(name) { var e = formular.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }
  function zeigeStufe(n, mitFokus) {
    aktuell = n;
    stufen.forEach(function (st, i) { st.hidden = i !== n; });
    $('stufen-titel').textContent = stufen[n].getAttribute('data-titel');
    $('stufen-zahl').textContent = 'Schritt ' + (n + 1) + ' von ' + stufen.length;
    $('fortschritt').style.width = ((n + 1) / stufen.length * 100) + '%';
    $('zurueck').hidden = n === 0;
    $('weiter').textContent = n < stufen.length - 1 ? 'Weiter' : 'Anfrage senden';
    $('ende-hinweis').textContent = n < stufen.length - 1
      ? 'Drei kurze Schritte. Ihre Angaben helfen uns, den Einsatz zu planen.'
      : 'Ein Kundenbetreuer meldet sich bei Ihnen und kümmert sich um Ihr Anliegen.';
    meldung.hidden = true;
    if (n === stufen.length - 1) {
      var wunsch = gewaehlt('wunsch'), auswahl = $('auswahl');
      alle('.feld', stufen[n]).forEach(function (f) { f.hidden = FELDER[wunsch].indexOf(f.querySelector('input, textarea').id) < 0; });
      auswahl.textContent = '';
      var fett = document.createElement('strong'); fett.textContent = wunsch; auswahl.appendChild(fett);
      auswahl.appendChild(document.createTextNode(' für: ' + gewaehlt('gebaeude') + ', ' + gewaehlt('hoehe') + ', Belag: ' + gewaehlt('befall')));
    }
    if (mitFokus) $('stufen-titel').focus();
  }
  $('zurueck').addEventListener('click', function () { zeigeStufe(aktuell - 1, true); });
  formular.addEventListener('submit', function (e) {
    e.preventDefault();
    if (aktuell < stufen.length - 1) { zeigeStufe(aktuell + 1, true); return; }
    var wunsch = gewaehlt('wunsch'), fehlt = null;
    PFLICHT[wunsch].forEach(function (id) { var f = $(id); if (!fehlt && !f.value.trim()) fehlt = f; });
    meldung.hidden = false;
    if (fehlt) {
      meldung.textContent = 'Bitte füllen Sie noch das Feld „' + formular.querySelector('label[for="' + fehlt.id + '"]').textContent + '“ aus.';
      fehlt.focus(); return;
    }
    var mail = $('f-mail');
    if (PFLICHT[wunsch].indexOf('f-mail') >= 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.value.trim())) {
      meldung.textContent = 'Bitte prüfen Sie Ihre E-Mail-Adresse. Sie braucht die Form name@beispiel.de.';
      mail.focus(); return;
    }
    meldung.textContent = 'Entwurf: Ihre Angaben sind vollständig, wurden aber noch nicht versendet. Auf der fertigen Website geht die Anfrage an info@fassaden-trio.de.';
  });
})();
