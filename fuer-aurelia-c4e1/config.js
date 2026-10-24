/* ==========================================================
   ZWEI LICHTER – DIE REISE
   Alle persönlichen Texte stehen hier. Einfach anpassen,
   speichern, hochladen – das Spiel übernimmt sie automatisch.
   ========================================================== */
window.ZL_CONFIG = {
  a: 'Aurelia',
  d: 'Daniel',

  welcome: 'Fünf Welten, neunzehn kleine Abenteuer – und keins davon schafft man allein. Bereit für unsere Reise?',

  // Kurzer Satz nach jedem Level (Schlüssel = Level-Kennung)
  lines: {
    funken: 'Gold gibt es nur zu zweit. Wie so vieles Schöne.',
    schnuppen: 'Mein Wunsch bei jeder Sternschnuppe? Du.',
    immer: '∞ – so lange möchte ich mit dir zusammen leuchten.',
    perlen: 'Eine echte Perle findet man selten. Ich habe meine gefunden.',
    stroemung: 'Egal wie stark die Strömung ist – ich halte zu dir.',
    echo: 'Du hast ein gutes Gedächtnis. Vergiss nur nie, wie lieb ich dich hab.',
    saeen: 'Was wir zusammen pflanzen, wächst.',
    schmetterlinge: 'Manches Glück fängt man nur zu zweit.',
    tor: 'Du hältst mir Türen auf – und ich dir.',
    mauer: 'Zusammen halten wir alles in der Luft – sogar einen Ball aus Licht.',
    kette: 'Wie eine Lichterkette: Erst zusammen leuchtet es richtig.',
    wolken: 'Mit dir fühlt sich vieles ein bisschen wie Fliegen an.',
    strasse: 'Egal wie viel Verkehr ist – ich warte auf der anderen Seite auf dich.',
    irrgarten: 'In jedem Irrgarten finde ich den Weg zu dir.',
    lied: 'Unser erstes gemeinsames Lied. Ich hoffe, es folgen noch viele.',
    memory: 'Die schönsten Erinnerungen sind die, die wir zusammen machen.',
    flammen: 'Wenn mein Licht mal ausgeht, gibst du mir neues Feuer.',
    wege: 'Selbst im Dunkeln finde ich zu dir, wenn ich deine Stimme höre.'
  },

  // Nach jeder Welt: ein Gedanke und eine Frage zum Reden
  worlds: [
    { msg: 'Die erste Welt ist geschafft. Danke, dass du dir heute Abend Zeit für uns nimmst.',
      question: 'Was ist bisher dein schönster Moment mit uns beiden?' },
    { msg: 'Selbst in der Tiefe finden wir zusammen den Weg nach oben.',
      question: 'Wovon träumst du gerade am meisten?' },
    { msg: 'Mit dir blüht so vieles auf – auch in mir.',
      question: 'Was wollen wir unbedingt machen, wenn wir uns das nächste Mal sehen?' },
    { msg: 'Die Spielhalle ist geschafft – wir sind ein richtig gutes Team.',
      question: 'Welches Spiel aus deiner Kindheit hast du am liebsten gespielt?' }
  ],

  // „Dies oder Das“ zwischen den Welten (je 4 Paare pro Pause)
  quiz: [
    ['Berge', 'Meer'], ['Kaffee', 'Tee'], ['Sonnenaufgang', 'Sonnenuntergang'], ['Kinoabend', 'Spieleabend'],
    ['Pizza', 'Sushi'], ['Frühling', 'Herbst'], ['Sprachnachricht', 'Anruf'], ['Alles planen', 'Spontan sein'],
    ['Frühstück im Bett', 'Brunch draußen'], ['Stadtbummel', 'Natur'], ['Süß', 'Salzig'], ['Fotos machen', 'Einfach genießen'],
    ['Morgenmensch', 'Nachteule'], ['Tanzen', 'Singen'], ['Gemütlicher Abend', 'Ausgehen'], ['Alte Spiele', 'Neue Spiele']
  ],

  finale: {
    title: 'Unser Herz',
    text: 'Fünf Welten, neunzehn Level – und am Ende ein Herz, das wir nur zusammen anzünden konnten. Egal wie weit du gerade weg bist: Wir leuchten zusammen. Ich liebe dich.',
    sign: '– Dein Daniel'
  }
};
