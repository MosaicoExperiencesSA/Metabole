/**
 * IL DIFETTO CHE HA TROVATO LA PROVA A VUOTO — 20/8.
 *
 * `npm run importa:alimenti` sui due fogli insieme stampava `~ rinomino «broccoli»` **due volte**.
 * Non era un doppione di stampa: la mappa dei nomi veniva costruita una volta sola prima del giro e
 * non si aggiornava mai, quindi alla riga del secondo foglio rispondeva ancora con la riga *da
 * cotto*, come se il primo foglio non fosse passato. Uscivano due rinomine della stessa riga e —
 * peggio — il nome nudo finiva a prendersi il valore **da cotto**: l'opposto di ciò per cui lo
 * script esiste. E con `NutrientFact.name` unico, la seconda `create` sarebbe morta a metà lavoro.
 *
 * ⚠️ Il difetto non stava in una funzione: stava nel fatto che la decisione viveva dentro `main()`,
 * fra una `findMany` e una `create`, dove per provarla ci voleva un database. Per questo il primo
 * pezzo del lavoro è stato tirarla fuori (`piano-alimenti.ts`), non correggerla.
 */
import { pianifica, nomeConStato, type Conosciuta } from './piano-alimenti';
import type { RigaAlimento } from './riga-alimento';

const riga = (p: Partial<RigaAlimento> & { name: string }): RigaAlimento =>
  ({
    synonyms: [], category: 'Verdura', state: 'crudo', kcal: 35, protein: 1, carbs: 7, sugars: 7,
    fat: 0.2, fiber: 3, source: 'CREA', foglio: 'prova', ...p,
  }) as RigaAlimento;

/** Com'è la tabella prima dell'import: «carote» esiste, ed è la carota BOLLITA. */
const IN_TABELLA: Conosciuta[] = [
  { id: 'c1', name: 'carote', synonyms: [], state: 'bollite', kcal: 35 },
];

describe('lo stesso nome nei due fogli', () => {
  /** Foglio 19/8: la carota a crudo. Foglio 20/8: la stessa carota, ma col valore da bollita. */
  const DUE_FOGLI = [
    riga({ name: 'carote', state: 'crudo', kcal: 35, foglio: '19/8' }),
    riga({ name: 'carote', state: 'bollite', kcal: 35, foglio: '20/8' }),
  ];

  it('rinomina la riga vecchia UNA volta sola', () => {
    const piano = pianifica(DUE_FOGLI, IN_TABELLA);
    expect(piano.mosse.filter((m) => m.tipo === 'rinomina-e-crea')).toHaveLength(1);
    expect(piano.rinominati).toBe(1);
  });

  it('non prepara due righe con lo stesso nome (`name` è unico: la seconda create morirebbe a metà)', () => {
    const piano = pianifica(DUE_FOGLI, IN_TABELLA);
    const nomiCreati = piano.mosse.filter((m) => m.tipo !== 'salta').map((m) => m.riga.name);
    expect(nomiCreati).toEqual([...new Set(nomiCreati)]);
  });

  /**
   * ⚠️ **La prima versione di questo test non mordeva.** Cercava la *prima* mossa sul nome nudo con
   * `find`, e la prima è quella del 19/8, che è a crudo anche col difetto: passava sia prima sia
   * dopo la correzione. Il difetto sta nella **seconda** mossa, e per vederla bisogna guardarle
   * tutte. È la terza volta in questa sessione che una mutazione non morde e il test sbagliato sono
   * io: `find` risponde alla domanda «ce n'è una giusta?», e la domanda vera era «ce n'è una
   * sbagliata?».
   */
  it('⛔ NESSUNA riga da cotto si prende il nome nudo', () => {
    const piano = pianifica(DUE_FOGLI, IN_TABELLA);
    const sulNomeNudo = piano.mosse.filter((m) => m.tipo !== 'salta' && m.riga.name === 'carote');
    expect(sulNomeNudo).toHaveLength(1);
    expect(sulNomeNudo.map((m) => m.riga.state)).toEqual(['crudo']);
  });

  it('la seconda riga viene saltata dicendo da dove viene il numero (e non dice «in tabella» di una riga che in tabella non c\'è ancora)', () => {
    const piano = pianifica(DUE_FOGLI, IN_TABELLA);
    const saltata = piano.mosse.find((m) => m.tipo === 'salta');
    expect(saltata).toBeDefined();
    expect(saltata!.messaggio).toContain('nel foglio di prima');
    expect(saltata!.messaggio).not.toContain('in tabella');
  });
});

describe('quello che deve continuare a funzionare', () => {
  it('un nome che non c\'è si crea', () => {
    const piano = pianifica([riga({ name: 'tahina' })], IN_TABELLA);
    expect(piano.mosse.map((m) => m.tipo)).toEqual(['crea']);
  });

  it('una riga già a crudo in tabella non si tocca, e si dice che il numero è quello della tabella', () => {
    const piano = pianifica([riga({ name: 'carote', kcal: 41 })], [
      { id: 'c1', name: 'carote', synonyms: [], state: 'crudo', kcal: 35 },
    ]);
    expect(piano.mosse.map((m) => m.tipo)).toEqual(['salta']);
    expect(piano.mosse[0].messaggio).toContain('in tabella 35 kcal');
    expect(piano.mosse[0].messaggio).toContain('in questa riga 41');
  });

  it('la riga vecchia si porta dietro il nome come sinonimo', () => {
    const piano = pianifica([riga({ name: 'carote' })], IN_TABELLA);
    const m = piano.mosse[0];
    expect(m.tipo).toBe('rinomina-e-crea');
    expect(m.tipo === 'rinomina-e-crea' && m.sinonimi).toContain('carote');
    expect(m.tipo === 'rinomina-e-crea' && m.nuovoNome).toBe('carote (da cotto)');
  });

  it('senza kcal si salta: è l\'unico campo che non si può indovinare', () => {
    const piano = pianifica([riga({ name: 'boh', kcal: null })], []);
    expect(piano.mosse.map((m) => m.tipo)).toEqual(['salta']);
    expect(piano.creati).toBe(0);
  });

  it('il nome della riga rinominata è grammaticale per qualunque alimento', () => {
    expect(nomeConStato('broccoli', 'bollito')).toBe('broccoli (da cotto)');
    expect(nomeConStato('barbabietola', 'bollito')).toBe('barbabietola (da cotto)');
    expect(nomeConStato('polenta', 'cotto')).toBe('polenta (da cotto)');
    expect(nomeConStato('miele', null)).toBe('miele (vecchia)');
  });
});

/**
 * «SENZA STATO» NON VUOL DIRE «DA COTTO» — 20/8 sera, dopo l'import vero.
 *
 * L'import in produzione ha rinominato **undici** righe in «X (vecchia)»: burro, mandorle, noci,
 * mela, pera, fragole, avocado, parmigiano reggiano, miele, pane integrale, ricotta di vacca. Tutte
 * righe che in tabella non avevano uno stato — e lo script le trattava come se fossero cotte, le
 * spostava, e dava il nome nudo alla riga nuova.
 *
 * ⛔ È un difetto mio, e della specie peggiore: **stava indovinando**. Una riga senza stato può
 * essere benissimo a crudo, e in quel caso spostarla fa l'opposto di quello che serve. Il prezzo si
 * legge nella pagina Alimenti, dove «burro (vecchia)» sta scritto per una persona.
 *
 * ⚠️ E la cosa che brucia è che il commento su `nomeConStato` — scritto da me la mattina stessa —
 * dice esattamente questo: «questi nomi li legge una persona, un nome storto in banca dati si
 * corregge solo con un'altra migrazione». Ho messo la regola e poi ho lasciato un ripiego che la
 * viola.
 */
describe('la riga vecchia senza stato', () => {
  const SENZA_STATO: Conosciuta[] = [{ id: 'b1', name: 'burro', synonyms: [], state: null, kcal: 760 }];

  it('⛔ NON si rinomina in «burro (vecchia)»', () => {
    const piano = pianifica([riga({ name: 'burro', state: 'crudo', kcal: 758 })], SENZA_STATO);
    expect(piano.mosse.map((m) => m.tipo)).toEqual(['salta']);
    expect(piano.rinominati).toBe(0);
    expect(piano.mosse[0].messaggio).not.toContain('(vecchia)');
  });

  it('e il messaggio dice PERCHÉ, con i due numeri accanto', () => {
    const piano = pianifica([riga({ name: 'burro', state: 'crudo', kcal: 758 })], SENZA_STATO);
    expect(piano.mosse[0].messaggio).toContain('non ha uno stato');
    expect(piano.mosse[0].messaggio).toContain('760');
    expect(piano.mosse[0].messaggio).toContain('758');
  });

  it('lo stesso per lo stato vuoto o fatto di spazi: sono tutti «non lo so»', () => {
    for (const stato of ['', '   ']) {
      const piano = pianifica([riga({ name: 'burro' })], [{ id: 'b1', name: 'burro', synonyms: [], state: stato, kcal: 760 }]);
      expect(piano.mosse.map((m) => m.tipo)).toEqual(['salta']);
    }
  });

  it('✅ mentre una riga con uno stato da cotto si rinomina come prima', () => {
    const piano = pianifica([riga({ name: 'carote' })], [
      { id: 'c1', name: 'carote', synonyms: [], state: 'bollite', kcal: 35 },
    ]);
    expect(piano.mosse[0].tipo).toBe('rinomina-e-crea');
  });
});
