import { scostamentoDieta } from './scostamento-dieta';

const cristina = { famiglia: 'Flessibile', regime: 'omnivore', style: 'flexible', mealsPerDay: 5 };

describe('scostamentoDieta — quello che è stato chiesto e quello che viene servito', () => {
  it('la variante esatta esiste: non c’è niente da segnalare', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'flexible', mealsPerDay: 5 }, true);
    expect(s).toBeNull();
  });

  it('IL CASO CRISTINA: chiesti 5 pasti, in catalogo solo 3 → lo dice, e dice come si chiude', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'flexible', mealsPerDay: 3 }, false);
    expect(s?.motivo).toBe('pasti');
    expect(s?.testo).toContain('5 pasti');
    expect(s?.testo).toContain('3 pasti');
    // La cosa da fare è generare la variante mancante, NON cambiare il profilo della cliente per
    // farlo combaciare con quello che c'è: il secondo modo fa sparire il sintomo e lascia il buco.
    expect(s?.testo).toContain('non cambiando il profilo');
  });

  it('il REGIME diverso non è un ripiego: è un dato incoerente, e va detto con altre parole', () => {
    // `pickDietFor` non lascia mai cadere il regime. Se qui compare, uno dei due dati è sbagliato —
    // ed è l'unico caso in cui la cliente potrebbe trovarsi nel piatto qualcosa che non mangia.
    const s = scostamentoDieta(cristina, { regime: 'vegan', style: 'flexible', mealsPerDay: 5 }, false);
    expect(s?.motivo).toBe('regime');
    expect(s?.testo).toContain('Non è un ripiego');
    expect(s?.testo).toContain('Da guardare subito');
  });

  it('stile e pasti insieme: un motivo solo, non due mezze frasi', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'mediterranean', mealsPerDay: 3 }, false);
    expect(s?.motivo).toBe('stile_e_pasti');
  });

  it('cambia solo l’obiettivo: la frase non parla di pasti, che sono giusti', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'flexible', mealsPerDay: 5 }, false);
    expect(s?.motivo).toBe('obiettivo');
    expect(s?.testo).not.toContain('pasti:');
  });

  it('senza regime o senza pasti non si inventa niente', () => {
    // Una cliente che non ha ancora dichiarato regime o pasti non ha «chiesto» niente: segnalarle
    // uno scostamento sarebbe rumore, e il rumore è il modo in cui una segnalazione vera si perde.
    expect(scostamentoDieta({ ...cristina, regime: null }, { regime: 'omnivore', style: 'flexible', mealsPerDay: 3 }, false)).toBeNull();
    expect(scostamentoDieta({ ...cristina, mealsPerDay: null }, { regime: 'omnivore', style: 'flexible', mealsPerDay: 3 }, false)).toBeNull();
  });

  it('nessuna dieta servita: niente da confrontare', () => {
    expect(scostamentoDieta(cristina, null, false)).toBeNull();
  });
});

/**
 * ⛔ **IL DIGIUNO: CONTA QUALI PASTI MANCANO, NON QUANTI** (21/8, dal caso di Antonella).
 *
 * Una cliente in digiuno ha `mealsPerDay: 3` in profilo — lo scrive l'onboarding, per tutte. Ma la
 * 14:10 le promette **quattro** pasti (colazione, pranzo, merenda, cena), che il catalogo digiuno
 * (pranzo, merenda, cena) non ha: serve la variante a 5 pasti.
 *
 * ## ⛔ E la prima stesura di questo ramo era un falso allarme su quattro protocolli su cinque
 *
 * Confrontava «quanti pasti promette l'orologio» con `servito.mealsPerDay`. Sono due scale diverse:
 * `strutturaPerFinestra` mappa i pasti promessi su un catalogo da **3 o da 5**, mai su un numero
 * qualsiasi. Quindi:
 *  - 14:10 (4 promessi) servita **bene** dal catalogo a 5 → «4 ≠ 5» → *«le promette 4 pasti, viene
 *    servita quella da 5, riceve meno pasti di quelli che le abbiamo detto»*. Cinque è più di
 *    quattro: la frase si contraddiceva nella stessa riga, e mandava la nutrizionista a generare una
 *    variante che c'era già;
 *  - 20:4 e 18:6 (2 promessi) servite **bene** dal catalogo digiuno (3) → stesso allarme, mentre
 *    pranzo e cena ci sono entrambi;
 *  - 23:1 (1 promesso) → idem.
 * L'unico protocollo silenzioso era la 16:8. E il test che avrebbe dovuto accorgersene provava una
 * dieta da `mealsPerDay: 4` — **una struttura che in questo prodotto non esiste**: verde, e cieco.
 *
 * ⚠️ La domanda giusta la risponde `pastiPromessiCheMancano`, che è la stessa funzione del motore.
 * Qui arriva il suo risultato già in italiano.
 */
describe('⛔ lo scostamento del digiuno: quali pasti mancano, non quanti', () => {
  const ANTONELLA = {
    famiglia: 'Digiuno intermittente (16:8)', regime: 'onnivoro', style: 'flexible',
    mealsPerDay: 3,
  };
  const CATALOGO_DIGIUNO = { regime: 'onnivoro', style: 'flexible', mealsPerDay: 3 };
  const CATALOGO_CINQUE = { regime: 'onnivoro', style: 'flexible', mealsPerDay: 5 };

  it('⛔ 14:10 servita col catalogo digiuno: manca la colazione, e lo dice', () => {
    const s = scostamentoDieta(
      { ...ANTONELLA, pastiCheMancano: ['Colazione'] }, CATALOGO_DIGIUNO, false,
    );
    expect(s?.motivo).toBe('finestra');
    expect(s?.testo).toContain('Colazione');
    expect(s?.testo).toContain('riceve meno pasti');
  });

  /**
   * ⛔ **I QUATTRO FALSI ALLARMI DELLA PRIMA STESURA.** Sono i casi in cui la cliente è servita
   * **bene**: il catalogo ha tutti i pasti che la finestra promette, e il motore toglie il resto —
   * che è il suo mestiere. Un avviso qui manderebbe la nutrizionista a cercare una variante che c'è.
   */
  it.each([
    ['14:10 servita dal catalogo a 5 pasti (4 promessi, 5 in struttura)', CATALOGO_CINQUE],
    ['20:4 servita dal catalogo digiuno (2 promessi, 3 in struttura)', CATALOGO_DIGIUNO],
    ['23:1 servita dal catalogo digiuno (1 promesso, 3 in struttura)', CATALOGO_DIGIUNO],
  ])('⛔ %s: nessuno scostamento di finestra', (_titolo, servita) => {
    const s = scostamentoDieta({ ...ANTONELLA, pastiCheMancano: [] }, servita, false);
    expect(s?.motivo).not.toBe('finestra');
  });

  /**
   * ⛔ **In digiuno senza finestra non le è stato promesso niente**, e non le si dice che le manca
   * qualcosa. La prima stesura calcolava «5 pasti promessi» per chi la finestra non l'ha mai
   * impostata — il caso delle clienti di prima dell'orologio — e scriveva «il suo orologio le
   * promette 5 pasti» a chi un orologio non ce l'ha.
   */
  it.each([[[] as string[]], [null], [undefined]])('⚠️ niente da segnalare (%s): nessun ramo finestra', (mancano) => {
    const s = scostamentoDieta({ ...ANTONELLA, pastiCheMancano: mancano }, CATALOGO_DIGIUNO, false);
    expect(s?.motivo).not.toBe('finestra');
  });

  /**
   * ⛔ Il testo dice **dove si chiude**, e dove NON si chiude: la finestra la sposta lei dall'app,
   * quindi mandare la nutrizionista a cambiargliela è mandarla a cercare un comando che non esiste.
   * Una ragione falsa è peggio di un ordine sbagliato.
   */
  it('⛔ dice che non si chiude né dalla finestra né dal profilo, ma generando la variante', () => {
    const t = scostamentoDieta({ ...ANTONELLA, pastiCheMancano: ['Colazione'] }, CATALOGO_DIGIUNO, false)?.testo ?? '';
    expect(t).toContain('Non si chiude cambiandole la finestra');
    expect(t).toContain('generando la variante mancante');
  });

  /**
   * ⚠️ **Niente markdown nel testo** (corretto in revisione): la scheda cliente lo stampa dentro un
   * `div` che non rende né gli asterischi né i capoversi. Un `**grassetto**` lì si legge letteralmente
   * come due asterischi, su una frase che deve essere presa sul serio.
   */
  it('⚠️ il testo è leggibile così com\'è: niente asterischi, niente a capo', () => {
    const t = scostamentoDieta({ ...ANTONELLA, pastiCheMancano: ['Colazione'] }, CATALOGO_DIGIUNO, false)?.testo ?? '';
    expect(t).not.toContain('**');
    expect(t).not.toContain('\n');
  });

  /** ⚠️ Con più pasti mancanti si elencano tutti: «ne manca uno» e «ne mancano tre» non sono uguali. */
  it('⚠️ elenca tutti i pasti che mancano, non solo il primo', () => {
    const t = scostamentoDieta({ ...ANTONELLA, pastiCheMancano: ['Colazione', 'Spuntino'] }, CATALOGO_DIGIUNO, false)?.testo ?? '';
    expect(t).toContain('Colazione, Spuntino');
  });

  /** ⚠️ Chi non digiuna resta sul confronto di prima. */
  it('⚠️ chi non digiuna resta sul confronto di prima', () => {
    const s = scostamentoDieta(
      { famiglia: 'Mediterranea', regime: 'onnivoro', style: 'mediterranean', mealsPerDay: 5 },
      { regime: 'onnivoro', style: 'mediterranean', mealsPerDay: 3 },
      false,
    );
    expect(s?.motivo).toBe('pasti');
  });

  /**
   * ⛔ **La variante esatta esiste ⇒ silenzio, anche in digiuno.** È la porta da cui il difetto era
   * entrato: finché `dieta-mostrata` cercava per `mealsPerDay`, quella porta era **sempre** aperta.
   */
  it('⚠️ se la variante esatta esiste non si dice niente', () => {
    expect(scostamentoDieta({ ...ANTONELLA, pastiCheMancano: ['Colazione'] }, CATALOGO_DIGIUNO, true)).toBeNull();
  });
});
