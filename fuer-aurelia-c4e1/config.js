/* ==========================================================
   ZWEI LICHTER – DIE REISE
   Alle persönlichen Texte stehen hier. Einfach anpassen,
   speichern, hochladen – das Spiel übernimmt sie automatisch.
   ========================================================== */
window.ZL_CONFIG = {
  a: 'Aurelia',
  d: 'Daniel',

  welcome: 'Vier Welten, zwölf kleine Abenteuer – und keins davon schafft man allein. Bereit für unsere Reise?',

  // Kurzer Satz nach jedem Level (Level 1 bis 11; nach Level 12 kommt das Finale)
  lines: [
    'Gold gibt es nur zu zweit. Wie so vieles Schöne.',
    'Mein Wunsch bei jeder Sternschnuppe? Du.',
    '∞ – so lange möchte ich mit dir zusammen leuchten.',
    'Eine echte Perle findet man selten. Ich habe meine gefunden.',
    'Egal wie stark die Strömung ist – ich halte zu dir.',
    'Du hast ein gutes Gedächtnis. Vergiss nur nie, wie lieb ich dich hab.',
    'Was wir zusammen pflanzen, wächst.',
    'Manches Glück fängt man nur zu zweit.',
    'Du hältst mir Türen auf – und ich dir.',
    'Wenn mein Licht mal ausgeht, gibst du mir neues Feuer.',
    'Selbst im Dunkeln finde ich zu dir, wenn ich deine Stimme höre.'
  ],

  // Nach jeder Welt: ein Gedanke und eine Frage zum Reden
  worlds: [
    { msg: 'Die erste Welt ist geschafft. Danke, dass du dir heute Abend Zeit für uns nimmst.',
      question: 'Was ist bisher dein schönster Moment mit uns beiden?' },
    { msg: 'Selbst in der Tiefe finden wir zusammen den Weg nach oben.',
      question: 'Wovon träumst du gerade am meisten?' },
    { msg: 'Mit dir blüht so vieles auf – auch in mir.',
      question: 'Was wollen wir unbedingt machen, wenn wir uns das nächste Mal sehen?' }
  ],

  // „Dies oder Das“ zwischen den Welten (je 4 Paare pro Pause)
  quiz: [
    ['Berge', 'Meer'], ['Kaffee', 'Tee'], ['Sonnenaufgang', 'Sonnenuntergang'], ['Kinoabend', 'Spieleabend'],
    ['Pizza', 'Sushi'], ['Frühling', 'Herbst'], ['Sprachnachricht', 'Anruf'], ['Alles planen', 'Spontan sein'],
    ['Frühstück im Bett', 'Brunch draußen'], ['Stadtbummel', 'Natur'], ['Süß', 'Salzig'], ['Fotos machen', 'Einfach genießen']
  ],

  finale: {
    title: 'Unser Herz',
    text: 'Vier Welten, zwölf Level – und am Ende ein Herz, das wir nur zusammen anzünden konnten. Egal wie weit du gerade weg bist: Wir leuchten zusammen. Ich liebe dich.',
    sign: '– Dein Daniel'
  }
};
