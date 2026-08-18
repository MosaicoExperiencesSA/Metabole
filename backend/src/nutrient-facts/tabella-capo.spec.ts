/**
 * LA TABELLA FIRMATA DAL CAPO NUTRIZIONISTA, 18/8/2026 — e il collaudo che la tiene ferma.
 *
 * ⚠️ Questo file non prova un comportamento: prova che **i numeri non sono cambiati**. È una copia
 * indipendente della tabella che il capo ha mandato, trascritta dal PDF, e il test confronta riga
 * per riga il seed contro di essa.
 *
 * Serve a due cose, e la seconda vale più della prima:
 *
 * 1. Il 18/8 il confronto fra il seed e la sua tabella ha trovato **58 differenze, tutte nella
 *    stessa direzione**: un buco nel seed, un valore nella sua tabella. Zero contraddizioni. Quel
 *    confronto l'ho fatto una volta a mano; qui diventa una cosa che si rifà da sola.
 * 2. ⚠️ Da adesso queste righe sono **confermate**, cioè un deploy non le sovrascrive più. Se
 *    qualcuno cambia un numero nel seed pensando di correggerlo, in produzione non succede niente e
 *    il file e il database dicono due cose diverse in silenzio. Questo test fa rumore invece.
 *
 * **Se questo test fallisce, la domanda non è «come lo aggiusto»: è «chi ha firmato il numero
 * nuovo?».** Un valore clinico si cambia con una tabella nuova del capo, o dalla sua scheda —
 * e allora si aggiorna anche questa copia, citando la data della tabella nuova.
 *
 * ⚠️ Le colonne sono quelle del suo PDF, e `sugars` non c'è: il seed lo tiene dal CREA e questo
 * test non lo tocca. Nella colonna «Affidabilità» il suo **N.D.** vuol dire `non_applicabile` —
 * l'alimento un indice glicemico non ce l'ha — che è diverso da «non lo so».
 */
import { VALORI } from '../../prisma/seed-valori-nutrizionali';

/** nome · categoria · stato · I.G. · affidabilità · kcal · proteine · carboidrati · grassi · fibre */
type Riga = [string, string, string | null, number | null, string | null, number, number, number, number, number];

const TABELLA_CAPO_18_8: Riga[] = [
  ['ananas', 'frutta', null, 58, 'media', 42, 0.5, 10, 0.1, 1],
  ['anguria', 'frutta', null, 60, 'debole', 16, 0.4, 3.7, 0.2, 0.2],
  ['arancia', 'frutta', null, 40, 'solida', 37, 0.7, 7.8, 0.2, 1.6],
  ['avocado', 'grassi', null, 10, 'debole', 238, 4.4, 1.8, 23, 3.3],
  ['banana', 'frutta', null, 62, 'media', 76, 1.2, 17.4, 0.3, 1.8],
  ['bresaola', 'proteici', null, null, 'non_applicabile', 152, 33.1, 0.4, 2, 0],
  ['burro', 'grassi', null, null, 'non_applicabile', 758, 0.8, 1.1, 83.4, 0],
  ['carote', 'verdura', 'bollite', 35, 'media', 35, 0.8, 7.6, 0.2, 2.7],
  ['ceci', 'legumi', 'bolliti', 28, 'debole', 132, 7, 18.9, 2.4, 5.8],
  ['cioccolato fondente', 'dolci', null, 29, 'debole', 531, 6.6, 49.7, 33.6, 8],
  ['couscous', 'cereali', 'crudo', 65, 'media', 361, 13.7, 76.5, 1.1, 4.5],
  ['fagioli borlotti', 'legumi', 'secchi', 28, 'debole', 312, 20.2, 47.7, 2, 17.3],
  ['fagioli cannellini', 'legumi', 'secchi', 31, 'debole', 279, 23.4, 45.5, 1.6, 17.6],
  ['farro perlato', 'cereali', 'crudo', 63, 'debole', 353, 14.6, 69.3, 2.4, 6.5],
  ['fesa di tacchino', 'proteici', 'cruda', null, 'non_applicabile', 107, 24, 0, 1.2, 0],
  ['fiocchi d\'avena', 'cereali', 'secco', 55, 'media', 367, 8, 66.8, 7.5, 8.3],
  ['fragole', 'frutta', null, 40, 'media', 30, 0.9, 5.3, 0.4, 1.6],
  ['gallette di riso', 'cereali', null, 82, 'solida', 387, 8.1, 81, 2.8, 3.1],
  ['kiwi', 'frutta', null, 52, 'media', 48, 1.2, 9, 0.6, 2.2],
  ['latte intero', 'latticini', null, 41, 'media', 64, 3.3, 4.9, 3.6, 0],
  ['latte parzialmente scremato', 'latticini', null, 32, 'media', 46, 3.5, 5, 1.5, 0],
  ['lenticchie', 'legumi', 'bollite', 29, 'media', 109, 6.9, 16.3, 0.4, 8.3],
  ['mandorle', 'grassi', null, 15, 'debole', 628, 22, 4.6, 55.3, 12.7],
  ['manzo magro', 'proteici', 'crudo', null, 'non_applicabile', 103, 21.8, 0, 1.8, 0],
  ['mela', 'frutta', null, 39, 'solida', 44, 0.2, 10, 0.1, 2.6],
  ['merluzzo', 'proteici', 'crudo', null, 'non_applicabile', 71, 17, 0, 0.3, 0],
  ['miele', 'dolci', null, 61, 'media', 304, 0.6, 80.3, 0, 0],
  ['mozzarella di vacca', 'latticini', null, null, 'non_applicabile', 253, 18.7, 0.7, 19.5, 0],
  ['noci', 'grassi', null, 15, 'debole', 702, 14.3, 5.1, 68.1, 6.2],
  ['olio extravergine di oliva', 'grassi', null, null, 'non_applicabile', 899, 0, 0, 99.9, 0],
  ['orzo perlato', 'cereali', 'crudo', 28, 'media', 346, 9.4, 73.7, 1.5, 9.2],
  ['pane bianco', 'cereali', null, 75, 'media', 268, 8.1, 59.5, 0.5, 3.8],
  ['pane integrale', 'cereali', null, 74, 'media', 224, 8.5, 44.1, 1.3, 6.5],
  ['parmigiano reggiano', 'latticini', null, null, 'non_applicabile', 397, 32.4, 0, 29.7, 0],
  ['pasta di semola', 'cereali', 'cruda', 46, 'media', 341, 13.5, 72.7, 1.2, 1.7],
  ['pasta integrale', 'cereali', 'cruda', 42, 'media', 330, 13.3, 64.8, 2.2, 7.1],
  ['patata dolce', 'verdura', 'cruda', 70, 'media', 80, 1.6, 16.8, 0.1, 3],
  ['patate', 'verdura', 'crude', 78, 'media', 72, 2, 16, 0.1, 1.8],
  ['pera', 'frutta', null, 38, 'media', 43, 0.3, 8.8, 0.1, 3.8],
  ['pesca', 'frutta', null, 42, 'media', 27, 0.8, 6.1, 0.1, 1.6],
  ['petto di pollo', 'proteici', 'crudo', null, 'non_applicabile', 100, 23.3, 0, 0.8, 0],
  ['piselli', 'legumi', 'freschi', 51, 'media', 64, 5.5, 6.5, 0.6, 6.3],
  ['prosciutto crudo', 'proteici', null, null, 'non_applicabile', 269, 25.9, 0.3, 18.3, 0],
  ['quinoa', 'cereali', 'cruda', 53, 'solida', 376, 15.4, 57.8, 8.1, 12.2],
  ['ricotta di vacca', 'latticini', null, null, 'non_applicabile', 146, 8.8, 3.5, 10.9, 0],
  ['riso basmati', 'cereali', 'crudo', 62, 'debole', 367, 9, 82.9, 1.9, 1.3],
  ['riso bianco', 'cereali', 'crudo', 73, 'debole', 334, 6.7, 80.4, 0.4, 1],
  ['riso integrale', 'cereali', 'crudo', 65, 'media', 341, 7.5, 77.4, 1.9, 1.9],
  ['riso parboiled', 'cereali', 'crudo', 68, 'media', 337, 7.4, 73.8, 0.3, 1],
  ['salmone', 'proteici', 'crudo', null, 'non_applicabile', 185, 18.4, 1, 12, 0],
  ['tonno al naturale', 'proteici', null, null, 'non_applicabile', 103, 25.1, 0, 0.3, 0],
  ['uovo', 'proteici', 'crudo', null, 'non_applicabile', 128, 12.4, 0, 8.7, 0],
  ['uva', 'frutta', null, 59, 'media', 61, 0.5, 15.6, 0.1, 1.5],
  ['yogurt bianco intero', 'latticini', null, 12, 'debole', 66, 3.8, 4.3, 3.9, 0],
  ['yogurt greco 0%', 'latticini', null, 19, 'debole', 51, 9, 4, 0, 0],
  ['zucca', 'verdura', 'bollita', 51, 'debole', 18, 0.8, 3.5, 0.1, 1.2],
  ['zucchero', 'dolci', null, 63, 'media', 392, 0, 100, 0, 0],
];

describe('la tabella firmata dal capo nutrizionista (18/8/2026)', () => {
  const perNome = new Map(VALORI.map((v) => [v.name, v]));

  it('gli alimenti sono esattamente quelli della sua tabella: né uno in più, né uno in meno', () => {
    expect(VALORI).toHaveLength(TABELLA_CAPO_18_8.length);
    const suoi = TABELLA_CAPO_18_8.map((r) => r[0]).sort();
    expect(VALORI.map((v) => v.name).sort()).toEqual(suoi);
  });

  it.each(TABELLA_CAPO_18_8)(
    '%s: i valori sono quelli che ha firmato',
    (nome, categoria, stato, ig, affidabilita, kcal, proteine, carboidrati, grassi, fibre) => {
      const v = perNome.get(nome);
      expect(v).toBeDefined();
      expect(v!.category).toBe(categoria);
      expect(v!.state ?? null).toBe(stato);
      expect(v!.gi ?? null).toBe(ig);
      expect(v!.giReliability ?? null).toBe(affidabilita);
      expect(v!.kcal).toBe(kcal);
      expect(v!.protein).toBe(proteine);
      expect(v!.carbs).toBe(carboidrati);
      expect(v!.fat).toBe(grassi);
      expect(v!.fiber).toBe(fibre);
    },
  );

  it('⚠️ tutte le righe sono marcate come confermate: è quello che le rende intoccabili dai deploy', () => {
    const senzaFirma = VALORI.filter((v) => !v.confermato).map((v) => v.name);
    expect(senzaFirma).toEqual([]);
  });

  it('⚠️ «non si applica» è distinto da «non lo so»: chi non ha indice lo dichiara', () => {
    // Le 14 righe che il capo ha marcato N.D. Un `gi` nullo senza questa marcatura vorrebbe dire
    // «non lo sappiamo», ed è la cosa che questa consegna esiste per non far più succedere.
    const senzaIndice = VALORI.filter((v) => v.gi === undefined);
    expect(senzaIndice).toHaveLength(14);
    for (const v of senzaIndice) expect(v.giReliability).toBe('non_applicabile');
    // E nessuna riga CON un indice può dire «non si applica»: sarebbe un numero e la sua smentita.
    for (const v of VALORI) if (v.gi !== undefined) expect(v.giReliability).not.toBe('non_applicabile');
  });

  it('un range senza il suo minimo o il suo massimo non esiste', () => {
    for (const v of VALORI) expect(v.giMin === undefined).toBe(v.giMax === undefined);
  });
});
