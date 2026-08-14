/**
 * LA TABELLA DELL'INDICE GLICEMICO DEL CAPO NUTRIZIONISTA — i dati, trascritti dal PDF del 13/8
 * («Tabella Nutrizionale Completa e Indice Glicemico», Linus Pauling Institute / International
 * Tables of Glycemic Index and Glycemic Load Values 2008 / USDA / CREA — 6 pagine, 96 righe).
 *
 * ⚠️ OGNI RIGA HA LO STATO ESPLICITO, ed è la ragione per cui questo import è sbloccato
 * (Decisioni 13/8 §16): la pasta qui è BOLLITA (158 kcal/100 g), e dichiararlo nella riga è ciò
 * che impedisce a «80 g di spaghetti» a crudo di sbagliare di due volte e mezzo.
 *
 * Formato: [nome, sinonimi, categoria, stato, ig, igMin, igMax, kcal, prot, carb, gras, fibre,
 * affidabilità (solida|media|debole), nota]. `ig` 0 con min/max null = «IG prossimo a 0» (tracce
 * di carboidrati). I nomi sono come li scriverebbe una cliente (minuscoli, italiani).
 */
export type RigaIg = [
  string, string[], string, string,
  number | null, number | null, number | null,
  number, number, number, number, number,
  'solida' | 'media' | 'debole',
  string | null,
];

export const FONTE_IG = 'International Tables 2008';
export const FONTE_IG_REF = 'Linus Pauling Institute / USDA / CREA';

const F = 'frutta e succhi';
const C = 'cereali, pane e pasta';
const L = 'legumi e tuberi';
const T = 'latticini e latti vegetali';
const D = 'dolci, zuccheri e snack';
const V = 'verdure, ortaggi e frutta secca';

export const RIGHE_IG: RigaIg[] = [
  ['mela', [], F, 'crudo', 36, 32, 40, 52, 0.3, 13.8, 0.2, 2.4, 'solida', null],
  ['pera', ['pero'], F, 'crudo', 38, 33, 42, 57, 0.4, 15.2, 0.1, 3.1, 'solida', null],
  ['arancia', [], F, 'crudo', 43, 37, 48, 47, 0.9, 11.8, 0.1, 2.4, 'solida', null],
  ['pompelmo', [], F, 'crudo', 25, 20, 30, 42, 0.8, 10.7, 0.1, 1.6, 'solida', null],
  ['banana matura', ['banana'], F, 'crudo', 51, 46, 56, 89, 1.1, 22.8, 0.3, 2.6, 'solida', null],
  ['banana verde', ['banana acerba'], F, 'crudo', 30, 26, 35, 89, 1.1, 22.8, 0.3, 2.6, 'media', null],
  ['uva fresca', ['uva'], F, 'crudo', 59, 53, 64, 69, 0.7, 18.1, 0.2, 0.9, 'solida', null],
  ['fragole', ['fragola'], F, 'crudo', 41, 36, 45, 32, 0.7, 7.7, 0.3, 2.0, 'media', null],
  ['pesca', ['pesche'], F, 'crudo', 42, 38, 46, 39, 0.9, 9.5, 0.3, 1.5, 'solida', null],
  ['prugna fresca', ['prugna', 'susina'], F, 'crudo', 40, 35, 45, 46, 0.7, 11.4, 0.3, 1.4, 'media', null],
  ['albicocca fresca', ['albicocca'], F, 'crudo', 34, 30, 40, 48, 1.4, 11.1, 0.4, 2.0, 'media', null],
  ['albicocca secca', ['albicocche secche'], F, 'secco', 30, 26, 35, 241, 3.4, 62.6, 0.5, 7.3, 'media', null],
  ['ciliegie', ['ciliegia'], F, 'crudo', 22, 18, 26, 50, 1.0, 12.0, 0.2, 1.6, 'solida', null],
  ['kiwi', [], F, 'crudo', 52, 47, 57, 61, 1.1, 14.7, 0.5, 3.0, 'solida', null],
  ['mango', [], F, 'crudo', 51, 45, 58, 60, 0.8, 15.0, 0.4, 1.6, 'media', null],
  ['ananas', [], F, 'crudo', 59, 51, 66, 50, 0.5, 13.1, 0.1, 1.4, 'solida', null],
  ['anguria', ['cocomero'], F, 'crudo', 72, 68, 76, 30, 0.6, 7.5, 0.2, 0.4, 'solida', null],
  ['melone cantalupo', ['melone'], F, 'crudo', 65, 60, 70, 34, 0.8, 8.2, 0.2, 0.9, 'media', null],
  ['fichi freschi', ['fico', 'fichi'], F, 'crudo', 35, 30, 40, 74, 0.8, 19.2, 0.3, 2.9, 'debole', null],
  ['datteri secchi', ['datteri', 'dattero'], F, 'secco', 62, 55, 72, 282, 2.5, 75.0, 0.4, 8.0, 'media', null],
  ['uva passa', ['uvetta', 'sultanina'], F, 'secco', 64, 59, 69, 299, 3.1, 79.2, 0.5, 3.7, 'solida', null],
  ["spremuta d'arancia", ["succo d'arancia"], F, 'liquido', 50, 45, 55, 45, 0.7, 10.4, 0.2, 0.2, 'solida', '100% frutta'],
  ['succo di mela', [], F, 'liquido', 41, 37, 45, 46, 0.1, 11.3, 0.1, 0.2, 'solida', '100% frutta'],

  ['spaghetti', ['spaghetti bianchi', 'pasta di semola'], C, 'bollito', 49, 45, 53, 158, 5.8, 31.0, 0.9, 1.8, 'solida', 'IG misurato al dente'],
  ['spaghetti integrali', ['pasta integrale'], C, 'bollito', 42, 37, 47, 124, 5.3, 26.5, 0.5, 4.5, 'solida', null],
  ['maccheroni', ['penne', 'penne bianche'], C, 'bollito', 50, 45, 55, 158, 5.8, 31.0, 0.9, 1.8, 'solida', null],
  ['riso bianco', ['riso brillato', 'riso lungo'], C, 'bollito', 73, 68, 78, 130, 2.7, 28.2, 0.3, 0.4, 'solida', null],
  ['riso basmati', ['basmati'], C, 'bollito', 57, 52, 62, 121, 3.5, 25.2, 0.4, 0.6, 'media', null],
  ['riso integrale', [], C, 'bollito', 68, 62, 74, 123, 2.7, 25.6, 1.0, 1.6, 'solida', null],
  ['riso parboiled', [], C, 'bollito', 38, 32, 44, 123, 2.9, 26.8, 0.3, 0.9, 'media', null],
  ['gallette di riso', ['riso soffiato', 'gallette'], C, 'secco', 87, 82, 92, 387, 8.0, 82.0, 2.8, 3.1, 'solida', null],
  ['pane bianco', ['pane in cassetta', 'pancarré', 'tramezzino'], C, 'cotto', 75, 71, 79, 265, 9.0, 49.0, 3.2, 2.7, 'solida', null],
  ['pane integrale', [], C, 'cotto', 51, 47, 55, 247, 13.0, 41.0, 3.4, 6.0, 'solida', 'integrale 100%'],
  ['baguette', ['baguette bianca', 'pane francese'], C, 'cotto', 95, 90, 100, 274, 9.5, 52.0, 2.2, 2.3, 'solida', null],
  ['pane di segale', ['pane di segale integrale'], C, 'cotto', 48, 44, 52, 217, 8.5, 42.0, 1.3, 6.6, 'solida', null],
  ['pane di farro', [], C, 'cotto', 54, 49, 59, 240, 10.0, 45.0, 2.0, 5.5, 'media', null],
  ['piadina', ['piadina romagnola'], C, 'cotto', 68, 62, 74, 320, 8.0, 50.0, 10.0, 2.5, 'media', null],
  ["fiocchi d'avena", ['avena in fiocchi', 'avena'], C, 'crudo', 55, 50, 60, 371, 13.0, 58.0, 7.0, 10.0, 'solida', 'valori a crudo; IG valido anche da bollito (porridge)'],
  ['corn flakes', ['fiocchi di mais'], C, 'secco', 81, 76, 86, 378, 7.5, 84.0, 0.9, 3.0, 'solida', null],
  ['muesli', ['muesli tradizionale'], C, 'secco', 57, 52, 62, 360, 10.0, 64.0, 6.0, 8.0, 'media', null],
  ['cuscus', ['couscous'], C, 'bollito', 65, 60, 70, 112, 3.8, 23.0, 0.2, 1.4, 'media', null],
  ['quinoa', [], C, 'bollito', 53, 48, 58, 120, 4.4, 21.3, 1.9, 2.8, 'media', null],
  ['orzo perlato', ['orzo'], C, 'bollito', 28, 24, 32, 123, 2.3, 28.2, 0.4, 3.8, 'solida', null],
  ['farro perlato', ['farro'], C, 'bollito', 45, 40, 50, 127, 5.0, 25.0, 0.7, 3.0, 'media', null],
  ['polenta', ['farina di mais cotta'], C, 'cotto', 70, 65, 75, 85, 2.0, 18.5, 0.5, 1.2, 'media', null],

  ['lenticchie', [], L, 'bollito', 28, 24, 32, 116, 9.0, 20.0, 0.4, 7.9, 'solida', null],
  ['ceci', [], L, 'bollito', 28, 21, 35, 164, 8.9, 27.4, 2.6, 7.6, 'solida', null],
  ['fagioli cannellini', ['fagioli borlotti', 'cannellini', 'borlotti'], L, 'bollito', 24, 20, 28, 127, 8.7, 22.8, 0.5, 6.4, 'solida', null],
  ['fagioli neri', [], L, 'bollito', 30, 25, 35, 132, 8.9, 23.7, 0.5, 8.7, 'media', null],
  ['piselli', ['piselli surgelati'], L, 'bollito', 51, 46, 56, 81, 5.4, 14.5, 0.4, 5.7, 'solida', null],
  ['fave', ['fave fresche'], L, 'bollito', 40, 35, 45, 88, 7.6, 17.6, 0.7, 5.4, 'media', null],
  ['soia', ['semi di soia'], L, 'bollito', 16, 12, 20, 173, 16.6, 9.9, 9.0, 6.0, 'solida', null],
  ['patate bollite', ['patata bollita', 'patata bianca', 'patata gialla'], L, 'bollito', 82, 76, 88, 87, 1.9, 20.1, 0.1, 1.8, 'solida', null],
  ['patate al forno', ['patata al forno'], L, 'al forno', 85, 80, 90, 93, 2.5, 21.0, 0.1, 2.2, 'solida', null],
  ['purè di patate', ['purè'], L, 'cotto', 83, 78, 88, 113, 2.0, 15.0, 4.2, 1.3, 'solida', null],
  ['patatine fritte', [], L, 'fritto', 75, 70, 80, 312, 3.4, 41.0, 15.0, 3.8, 'solida', null],
  ['patata dolce', ['batata', 'patata americana'], L, 'bollito', 61, 54, 68, 86, 1.6, 20.1, 0.1, 3.0, 'media', null],
  ['carote', ['carota'], L, 'bollito', 39, 33, 45, 35, 0.8, 8.2, 0.2, 3.0, 'solida', null],
  ['zucca', [], L, 'cotto', 75, 68, 82, 26, 1.0, 6.5, 0.1, 0.5, 'media', null],
  ['barbabietola', ['barbabietola rossa', 'rapa rossa'], L, 'bollito', 64, 58, 70, 43, 1.6, 9.6, 0.2, 2.8, 'media', null],

  ['latte intero', [], T, 'liquido', 31, 27, 35, 61, 3.2, 4.8, 3.3, 0.0, 'solida', null],
  ['latte parzialmente scremato', [], T, 'liquido', 32, 28, 36, 46, 3.4, 5.0, 1.5, 0.0, 'solida', null],
  ['latte scremato', [], T, 'liquido', 32, 28, 36, 35, 3.4, 5.0, 0.1, 0.0, 'solida', null],
  ['yogurt intero', ['yogurt naturale', 'yogurt bianco'], T, 'fresco', 36, 31, 41, 61, 3.5, 4.7, 3.3, 0.0, 'solida', null],
  ['yogurt greco', ['yogurt greco 0%'], T, 'fresco', 25, 20, 30, 59, 10.0, 3.6, 0.0, 0.0, 'media', 'bianco, 0% grassi'],
  ['yogurt alla frutta', [], T, 'fresco', 41, 36, 46, 102, 3.8, 17.0, 2.0, 0.2, 'solida', null],
  ['latte di soia', [], T, 'liquido', 34, 29, 39, 33, 2.8, 1.8, 1.6, 0.5, 'solida', null],
  ['latte di mandorla', [], T, 'liquido', 25, 20, 30, 15, 0.5, 0.3, 1.1, 0.4, 'debole', 'senza zuccheri aggiunti'],
  ['latte di riso', [], T, 'liquido', 86, 80, 92, 47, 0.3, 9.2, 1.0, 0.2, 'media', null],
  ['gelato alla crema', ['gelato', 'fiordilatte'], T, 'freddo', 57, 51, 63, 207, 3.5, 24.0, 11.0, 0.7, 'solida', null],
  ['mozzarella', [], T, 'fresco', 0, null, null, 280, 18.0, 0.7, 22.0, 0.0, 'solida', 'tracce minime di carboidrati: IG prossimo a 0'],
  ['parmigiano', ['parmigiano reggiano', 'grana'], T, 'stagionato', 0, null, null, 431, 38.0, 0.0, 29.0, 0.0, 'solida', 'tracce minime di carboidrati: IG prossimo a 0'],
  ['ricotta', ['ricotta vaccina'], T, 'fresco', 27, 20, 35, 146, 8.8, 3.5, 10.9, 0.0, 'debole', 'valori stimati per presenza lattosio'],

  ['zucchero', ['zucchero bianco', 'saccarosio'], D, 'secco', 65, 60, 70, 387, 0.0, 100.0, 0.0, 0.0, 'solida', null],
  ['fruttosio', [], D, 'secco', 15, 12, 18, 368, 0.0, 100.0, 0.0, 0.0, 'solida', null],
  ['miele', [], D, 'viscoso', 61, 55, 67, 304, 0.3, 82.0, 0.0, 0.2, 'solida', null],
  ["sciroppo d'acero", [], D, 'viscoso', 54, 48, 60, 260, 0.0, 67.0, 0.1, 0.0, 'media', null],
  ['cioccolato fondente', ['fondente'], D, 'secco', 23, 18, 28, 598, 7.8, 45.9, 42.6, 10.9, 'solida', '70% cacao o più'],
  ['cioccolato al latte', [], D, 'secco', 43, 38, 48, 535, 7.6, 59.0, 29.7, 3.4, 'solida', null],
  ['biscotti frollini', ['frollini', 'biscotti'], D, 'cotto', 57, 52, 62, 460, 7.0, 68.0, 18.0, 2.5, 'solida', null],
  ['croissant', ['cornetto'], D, 'cotto', 67, 60, 74, 406, 8.2, 45.8, 21.0, 2.6, 'media', 'vuoto'],
  ['brioche', ['tortine tipo brioche', 'merendina'], D, 'cotto', 65, 59, 71, 390, 6.5, 54.0, 17.0, 1.8, 'media', null],
  ['popcorn', [], D, 'cotto', 65, 60, 70, 387, 12.9, 78.0, 4.5, 14.5, 'solida', 'senza sale né grassi aggiunti'],
  ['patatine in busta', ['chips', 'patatine'], D, 'fritto', 56, 51, 61, 536, 7.0, 53.0, 35.0, 4.8, 'solida', null],
  ['crema di nocciole', ['nutella'], D, 'crema', 33, 28, 38, 539, 6.3, 57.5, 30.9, 3.0, 'media', null],

  ['zucchine', ['zucchina'], V, 'crudo', 15, 10, 20, 17, 1.2, 3.1, 0.3, 1.0, 'solida', 'carboidrati molto bassi; vale anche da bollite'],
  ['pomodori', ['pomodoro'], V, 'crudo', 15, 10, 20, 18, 0.9, 3.9, 0.2, 1.2, 'solida', 'carboidrati molto bassi'],
  ['spinaci', [], V, 'bollito', 15, 10, 20, 23, 2.9, 3.6, 0.4, 2.2, 'solida', 'carboidrati molto bassi'],
  ['broccoli', [], V, 'bollito', 15, 10, 20, 34, 2.8, 6.6, 0.4, 2.6, 'solida', 'carboidrati molto bassi'],
  ['cetrioli', ['cetriolo'], V, 'crudo', 15, 10, 20, 15, 0.7, 3.6, 0.1, 0.5, 'solida', 'carboidrati molto bassi'],
  ['lattuga', ['insalata'], V, 'crudo', 15, 10, 20, 15, 1.4, 2.9, 0.2, 1.3, 'solida', 'carboidrati molto bassi'],
  ['mandorle', ['mandorla'], V, 'secco', 15, 10, 20, 579, 21.2, 21.7, 49.9, 12.5, 'solida', 'ricche di grassi sani e fibre'],
  ['noci', ['noce'], V, 'secco', 15, 10, 20, 654, 15.2, 13.7, 65.2, 6.7, 'solida', 'ricche di omega-3'],
  ['nocciole', ['nocciola'], V, 'secco', 15, 10, 20, 628, 15.0, 16.7, 60.8, 9.7, 'solida', 'ricche di grassi monoinsaturi'],
  ['anacardi', [], V, 'tostato', 22, 17, 27, 553, 18.2, 30.2, 43.8, 3.3, 'media', null],
  ['arachidi', ['noccioline'], V, 'tostato', 13, 10, 16, 567, 25.8, 16.1, 49.2, 8.5, 'solida', null],
];
