import { chiedeUnaSostituzioneAElenchi, sostituzioneAElenchi } from './sostituzione-a-elenchi';
import { sostituzioniNelMessaggio } from '../food-swaps/impara-dalla-chat';
import { capisci } from './capisci';

/**
 * ⛔ **LE DUE STRADE LEGGONO LO STESSO ELENCO DI FORME** (3/9).
 *
 * `capisci` prova prima gli elenchi e poi la lettura singola. Finché le forme erano scritte in due
 * posti, la stessa frase veniva capita o buttata via **a seconda di quante alternative aveva scritto
 * la nutrizionista**: «il merluzzo può essere sostituito con orata **o spigola**» si leggeva,
 * «…con orata» no. ⚠️ Adesso le forme stanno in `food-swaps/forme-di-sostituzione.ts` e le usano
 * tutte e due; queste righe tengono ferma la coppia.
 */
describe('⛔ la stessa forma, con e senza elenco', () => {
  const CASI: [string, string, string[], string[]][] = [
    ['la passiva', 'il merluzzo può essere sostituito con orata', ['merluzzo'], ['orata']],
    ['l\'aggettivo', 'il merluzzo è sostituibile con orata', ['merluzzo'], ['orata']],
    ['«al posto di» in testa', 'al posto del merluzzo può mettere orata', ['merluzzo'], ['orata']],
  ];

  it.each(CASI)('%s, senza elenco: la legge la strada singola', (_t, frase, da, a) => {
    const r = sostituzioniNelMessaggio(frase);
    expect(r).toHaveLength(1);
    expect(r[0].from.toLowerCase()).toBe(da[0]);
    expect(r[0].to.toLowerCase()).toBe(a[0]);
    // ⚠️ E la strada a elenchi la lascia stare: non è il suo mestiere, e due strade sullo stesso
    // caso sono due strade che divergono.
    expect(sostituzioneAElenchi(frase)).toBeNull();
  });

  it.each([
    ['la passiva', 'il merluzzo può essere sostituito con orata o spigola', ['merluzzo'], ['orata', 'spigola']],
    ['l\'aggettivo', 'il merluzzo è sostituibile con orata o spigola', ['merluzzo'], ['orata', 'spigola']],
    ['«al posto di» in testa', 'al posto del merluzzo può mettere orata o spigola', ['merluzzo'], ['orata', 'spigola']],
  ] as [string, string, string[], string[]][])(
    '%s, CON elenco: la legge la strada a elenchi, per intero',
    (_t, frase, da, a) => {
      expect(chiedeUnaSostituzioneAElenchi(frase)).toBe(true);
      const r = sostituzioneAElenchi(frase);
      expect(r).not.toBeNull();
      expect(r!.da.map((x) => x.toLowerCase())).toEqual(da);
      expect(r!.a.map((x) => x.toLowerCase())).toEqual(a);
    },
  );

  /**
   * ⛔ **E la strada singola NON legge un elenco.** «merluzzo → orata, salmone» diventerebbe
   * l'alimento inesistente «orata salmone»: una lettura **parziale travestita da lettura**, che è
   * il modo peggiore di sbagliare quando si scrive una regola sul cibo di una persona.
   */
  it.each([
    ['al posto del merluzzo può mettere orata o spigola'],
    ['il merluzzo è sostituibile con orata o spigola'],
    // ⚠️ Con la VIRGOLA, che è il caso che solo `eUnElenco` sa riconoscere: la congiunzione «o»
    // la fermerebbe comunque `nomeTroncatoSuCongiunzione`, la virgola no.
    ['al posto del merluzzo può mettere orata, spigola'],
    ['il merluzzo è sostituibile con orata, spigola'],
    ['il pane, la pasta possono essere sostituiti con il riso'],
  ])('⛔ «%s»: la strada singola non ne legge una parte', (frase) => {
    expect(sostituzioniNelMessaggio(frase)).toEqual([]);
  });

  /**
   * ⛔ **LA NEGAZIONE SI CERCA NELLA PROPOSIZIONE DELL'ORDINE, non nel messaggio intero.**
   *
   * La prima stesura della correzione su `daScartare` la applicava a tutto il messaggio, e in
   * italiano la parola di negazione sta quasi sempre in un'**altra** proposizione: **diciassette**
   * frasi normali si spegnevano. ⚠️ Il commento di quella correzione dichiarava un costo «misurato»
   * che non lo era — l'ha detto una revisione avversariale, misurandolo davvero.
   */
  it.each([
    ['non digerisce il glutine, sostituisci la pasta con il riso o la quinoa', ['pasta'], ['riso', 'quinoa']],
    ['niente latticini, sostituisci il formaggio con il tofu o il seitan', ['formaggio'], ['tofu', 'seitan']],
    ['le va bene? sostituisci il pane con le gallette o i cracker', ['pane'], ['gallette', 'cracker']],
    ["per il colesterolo, mai burro: sostituisci il burro con l'olio o l'avocado", ['burro'], ['olio', 'avocado']],
    ['forse è meglio così: sostituisci il pane con le gallette o i cracker', ['pane'], ['gallette', 'cracker']],
  ] as [string, string[], string[]][])('⚠️ «%s» resta leggibile', (frase, da, a) => {
    const r = sostituzioneAElenchi(frase);
    expect(r).not.toBeNull();
    expect(r!.da.map((x) => x.toLowerCase())).toEqual(da);
    expect(r!.a.map((x) => x.toLowerCase())).toEqual(a);
  });
});

/**
 * ⛔ **LE NEGAZIONI NON DIVENTANO ORDINI.** È la riga che una revisione ha già dovuto imporre sulla
 * passiva — «il merluzzo **non** può essere sostituito con orata» diceva il contrario di quello che
 * veniva scritto — e vale identica per le forme nuove.
 */
describe('⛔ quello che non si legge', () => {
  it.each([
    ['il merluzzo non può essere sostituito con orata o spigola'],
    ['al posto del merluzzo non mettere orata o spigola'],
    ['il merluzzo non è sostituibile con orata o spigola'],
    ['posso sostituire il merluzzo con orata o spigola?'],
  ])('⛔ «%s»', (frase) => {
    expect(sostituzioneAElenchi(frase)).toBeNull();
    expect(sostituzioniNelMessaggio(frase)).toEqual([]);
  });

  /**
   * ⛔ **IL DIVIETO SCRITTO ALL'IMPERATIVO VENIVA ESEGUITO COME ORDINE.** Trovato il 3/9 scrivendo
   * le prove delle forme nuove, non rileggendo il codice: `daScartare` girava **dopo** il ramo
   * imperativo, e
   *
   *     «mai sostituire il pane con le gallette o i cracker»
   *     «evita di sostituire il pane con le gallette o i cracker»
   *
   * arrivavano fino in fondo come «sostituisci il pane con le gallette o i cracker» — **il
   * contrario di quello che era stato scritto**, nel ramo che *esegue un ordine*. Il «non» lo
   * fermava un controllo più a monte in `capisci`; «mai» ed «evita» no.
   */
  it.each([
    ['mai sostituire il pane con le gallette o i cracker'],
    ['evita di sostituire il pane con le gallette o i cracker'],
    ['non sostituire il pane con le gallette o i cracker'],
    ['niente pane con le gallette o i cracker'],
  ])('⛔ un divieto non diventa un ordine: «%s»', (frase) => {
    expect(sostituzioneAElenchi(frase)).toBeNull();
  });

  /**
   * ⚠️ **E il costo è misurato, non supposto**: le due frasi vere del 31/8 — quelle da cui è nato
   * tutto il ramo a elenchi — non contengono nessuna di quelle parole e continuano a passare
   * identiche. Una guardia che blocca il caso normale non è prudente: è rotta, e sembra prudente.
   */
  it.each([
    [
      'a lorena polidoro sostituisci sempre Indivia, Scarola, Verza con zucchine, melanzane, peperoni',
      ['indivia', 'scarola', 'verza'],
      ['zucchine', 'melanzane', 'peperoni'],
    ],
    ['a jolanda sostitusci ceci con fagioli o lenticchie', ['ceci'], ['fagioli', 'lenticchie']],
  ] as [string, string[], string[]][])('⚠️ «%s» passa come prima', (frase, da, a) => {
    const r = sostituzioneAElenchi(frase);
    expect(r).not.toBeNull();
    expect(r!.da.map((x) => x.toLowerCase())).toEqual(da);
    expect(r!.a.map((x) => x.toLowerCase())).toEqual(a);
  });
});

/**
 * ⛔ **QUELLO CHE LE FORME NUOVE RENDONO RAGGIUNGIBILE, e non è colpa loro.**
 *
 * Una capacità nuova non aggiunge solo letture: fa **arrivare** frasi a codice che prima non le
 * vedeva mai. Qui sotto ci sono i due difetti che si sono visti così — tutti e due vecchi, tutti e
 * due misurati, nessuno dei due nascosto in un commento.
 */
describe('⛔ difetti vecchi che le forme nuove rendono raggiungibili', () => {
  /**
   * ⛔ **`nomePersona` prende un orario per il nome di una cliente.** «il pane può essere sostituito
   * con le gallette **a colazione**» → `cliente: "colazione"`. ⚠️ In chat con Vera la cliente
   * sbagliata si vede nell'anteprima e si corregge; su `impara-dal-nutrizionista` la cliente non si
   * legge dal testo (viene dalla chat), quindi lì non morde. La cura è nel lettore del nome, non in
   * una lista di orari da escludere.
   */
  it.failing('⛔ oggi «a colazione» viene preso per il nome di una cliente', () => {
    const r = capisci('il pane può essere sostituito con le gallette a colazione');
    expect(r).not.toBeNull();
    expect((r as { cliente: string | null }).cliente).toBeNull();
  });

  /**
   * ⛔ **Le due strade leggono il lato sinistro in modo diverso**, ed è la cosa che il modulo
   * condiviso **non** unifica: condivide le **forme**, non il modo di leggere quello che catturano —
   * e su quel lato è il modo che conta. La strada singola risale dalla fine (`codaDellaFrase`) e si
   * ferma sull'articolo; quella a elenchi passa il pezzo grezzo a `leggiElenco`, che deve poter
   * leggere un elenco e quindi non può risalire.
   *
   * ⚠️ Il risultato è che «per la cliente il merluzzo è sostituibile con orata» si legge bene e
   * «…con orata **o spigola**» no. ⛔ E la cura **non** è far risalire anche di là: la risalita su
   * «il pane **e** la pasta» darebbe «pasta», cioè il troncamento silenzioso che quella strada
   * rifiuta apposta con il controllo «letto a metà». Si chiude capendo dove **comincia** il nome —
   * lo stesso nodo del saluto davanti e del vocativo minuscolo.
   */
  it.failing('⛔ oggi un vocativo minuscolo entra nel nome, ma solo sulla strada a elenchi', () => {
    const r = sostituzioneAElenchi('per la cliente il merluzzo è sostituibile con orata o spigola');
    expect(r).not.toBeNull();
    expect(r!.da).toEqual(['merluzzo']);
  });

  /** ⚠️ E senza l'elenco la stessa frase si legge bene: è la prova che la differenza è la strada. */
  it('⚠️ senza elenco la stessa frase si legge bene', () => {
    const r = sostituzioniNelMessaggio('per la cliente il merluzzo è sostituibile con orata');
    expect(r).toHaveLength(1);
    expect(r[0].from.toLowerCase()).toBe('merluzzo');
  });
});
