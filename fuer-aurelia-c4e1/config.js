/* ==========================================================
   ZWEI LICHTER – DIE REISE
   Alle persönlichen Texte stehen hier. Einfach anpassen,
   speichern, hochladen – das Spiel übernimmt sie automatisch.
   ========================================================== */
window.ZL_CONFIG = {
  a: 'Aurelia',
  d: 'Daniel',

  welcome: 'Zwölf Spiele, vier Kapitel. Unterwegs sammeln wir Stücke von zwei Bildern, auf denen man noch nichts erkennt. Was sie zeigen, siehst du erst, wenn deine Hälfte und meine zusammenkommen. Bereit?',

  // Kurzer Satz nach jedem Spiel (Schlüssel = Kennung des Spiels)
  lines: {
    see: 'Wenn nur einer paddelt, drehen wir uns im Kreis. Im gleichen Takt kommen wir überall an.',
    korallen: 'Die ersten Stücke haben wir. Noch erkennt man nichts – aber ich weiß schon, wie gern ich dieses Bild habe.',
    zimmer: 'Zwischen uns war eine Wand, und trotzdem hast du mir alles gesagt, was ich brauchte. Das schaffen wir auch über viele Kilometer.',
    spiegel: 'Ein Spiegel allein wirft das Licht nur zurück. Zu zweit bringen wir es ans Ziel.',
    irrgarten: 'Du bist deinen Weg gegangen und ich meinen. Darunter lag die ganze Zeit dasselbe Bild.',
    wald: 'Ich sehe den Weg nicht immer. Aber ich höre dich, und das reicht.',
    lied: 'Jeder hatte nur seine Töne. Ein Lied wurde es erst zusammen.',
    rennen: 'Egal, wer vorne lag: Ich fahre am liebsten dorthin, wo du bist.',
    kugel: 'Allein rollt sie davon. Zu zweit bringen wir sie ins Ziel.',
    zueinander: 'Zwei Schlösser, viele Tore – und wir treffen uns trotzdem in der Mitte.',
    bild: 'Deine Hälfte und meine Hälfte. Scharf wird es erst, wenn beide da sind – auf den Bildern und bei uns.',
    herz: 'Deine Seite und meine Seite. Erst zusammen wird ein Herz daraus.'
  },

  // Nach jedem Kapitel: ein Gedanke und zwei Fragen zum Reden
  worlds: [
    { msg: 'Kapitel eins: einmal über den See und einmal durchs Riff. Die ersten Bildstücke liegen bereit. Verrat mir nicht, falls du schon etwas ahnst.',
      questions: ['Was glaubst du: Welcher Moment von uns steckt in dem ersten Bild?',
                  'Wohin würdest du mit mir sofort losfahren, wenn wir morgen beide frei hätten?'] },
    { msg: 'Zwei Zimmer, ein Saal voller Spiegel und ein Irrgarten – und wir haben uns jedes Mal gefunden. Jetzt liegen auch die Stücke vom zweiten Bild bereit.',
      questions: ['Welche Kleinigkeit von mir fehlt dir am meisten, wenn wir uns nicht sehen?',
                  'Welchen Moment mit mir hättest du gern als Foto, obwohl es keins davon gibt?'] },
    { msg: 'Durch den Nebel, durch ein Lied und einmal quer durch die Nacht. Im letzten Kapitel setzen wir zusammen, was wir gesammelt haben.',
      questions: ['Was machen wir beim nächsten Wiedersehen als Allererstes?',
                  'Wovon träumst du gerade, bei dem ich unbedingt dabei sein soll?'] }
  ],

  // „Dies oder Das“ zwischen den Kapiteln (je 4 Paare pro Pause, die letzten vier sind Reserve)
  quiz: [
    ['Sonnenuntergang am Wasser', 'Lichter der Stadt bei Nacht'], ['Lange telefonieren', 'Viele kleine Nachrichten'], ['Erst umarmen', 'Erst etwas sagen'], ['Zusammen kochen', 'Essen gehen'],
    ['Überraschung', 'Vorfreude'], ['Regentag auf dem Sofa', 'Sonnentag draußen'], ['Brief schreiben', 'Sprachnachricht schicken'], ['Karte lesen', 'Einfach loslaufen'],
    ['Früh aufstehen', 'Lange wach bleiben'], ['Zusammen lachen', 'Zusammen still sein'], ['Selbst fahren', 'Sich fahren lassen'], ['Viele Fotos machen', 'Den Moment einfach genießen'],
    ['Paddeln', 'Treiben lassen'], ['Tanzen', 'Mitsingen'], ['Plan machen', 'Spontan sein'], ['Jetzt sofort', 'In Ruhe morgen']
  ],

  finale: {
    title: 'Unser Herz',
    text: 'Zwölf Spiele, vier Kapitel – und zwei Bilder von uns, die erst scharf wurden, als deine Hälfte und meine zusammenkamen. So ist es mit allem bei uns: Allein bleibt es verschwommen, zu zweit ergibt es ein Ganzes. Egal, wie weit du gerade weg bist: Ich bin bei dir. Ich liebe dich.',
    sign: '– Dein Daniel'
  }
};
