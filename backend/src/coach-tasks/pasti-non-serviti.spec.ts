/**
 * ⛔ **L'ATTIVITÀ PER CHI RICEVE MENO PASTI DI QUELLI PROMESSI — e a chi arriva.**
 *
 * Due cose si provano qui, e la seconda è quella che rende la prima utile:
 *  1. il **riferimento** dell'attività, cioè quante volte nasce;
 *  2. che l'avviso raggiunga **la nutrizionista**, che è l'unica che può chiuderla.
 */
import {
  TIPO_PASTI_NON_SERVITI,
  riferimentoPastiNonServiti,
  scadenzaPastiNonServiti,
  testoPastiNonServiti,
} from './pasti-non-serviti';
import { TIPI_DELLA_NUTRIZIONISTA } from './avvisi-attivita';
import { TIPO_DIGIUNO_ESTREMO, TIPO_FINESTRA_NON_TRADUCIBILE } from './verifica-digiuno';

describe('⛔ il riferimento: una per cliente, non una per giornata composta', () => {
  /**
   * ⛔ **È il test che conta.** Il motore passa da quel punto **a ogni erogazione**: se il
   * riferimento cambiasse di giorno in giorno, una cliente rotta produrrebbe un'attività al giorno
   * per settimane, e la colonna della nutrizionista diventerebbe illeggibile proprio mentre segnala
   * una cosa vera. *Un avviso che compare sempre non è un avviso.*
   */
  it('⛔ gli stessi pasti mancanti danno sempre lo stesso riferimento', () => {
    expect(riferimentoPastiNonServiti(['breakfast'])).toBe(riferimentoPastiNonServiti(['breakfast']));
  });

  /**
   * ⛔ **Non dipende dall'ordine.** L'elenco arriva dal motore nell'ordine della giornata; se un
   * giorno cambiasse quell'ordine senza cambiare i pasti, nascerebbe un doppione su una situazione
   * identica. Un riferimento deve dipendere dal contenuto, non da come è stato scritto.
   */
  it('⛔ e non cambia se cambia l\'ordine con cui arrivano', () => {
    expect(riferimentoPastiNonServiti(['breakfast', 'morning_snack']))
      .toBe(riferimentoPastiNonServiti(['morning_snack', 'breakfast']));
  });

  /**
   * ⚠️ Ma se cambia **cosa** manca, è un'altra situazione: passare da «manca la colazione» a
   * «mancano colazione e spuntino» è un peggioramento, e chi aveva chiuso la prima deve rivedere.
   */
  it('⚠️ pasti mancanti diversi = attività diversa', () => {
    expect(riferimentoPastiNonServiti(['breakfast']))
      .not.toBe(riferimentoPastiNonServiti(['breakfast', 'morning_snack']));
  });

  /** ⚠️ Elenco vuoto: un riferimento c'è comunque, invece di una stringa vuota che rompe la chiave. */
  it('⚠️ senza mancanze il riferimento non è vuoto', () => {
    expect(riferimentoPastiNonServiti([])).toBe('nessuno');
  });
});

describe('il testo dell\'attività', () => {
  const t = (nome: string | null = 'Antonella') =>
    testoPastiNonServiti(nome, ['Colazione'], 'Digiuno intermittente (16:8)');

  it('nel titolo c\'è il nome, perché si legge in un elenco', () => {
    expect(t().title).toContain('Antonella');
  });

  it('senza nome resta una frase, non un buco', () => {
    expect(t(null).title).toContain('Una cliente');
    expect(testoPastiNonServiti('  ', ['Colazione'], null).title).toContain('Una cliente');
  });

  it('dice QUALE pasto manca e su quale dieta', () => {
    expect(t().description).toContain('Colazione');
    expect(t().description).toContain('Digiuno intermittente (16:8)');
  });

  /**
   * ⚠️ La riga che impedisce alla correzione di diventare il danno: «manca un pasto» letto da solo
   * suona come un guasto, e chi telefona allarmata a una cliente che sta mangiando ha fatto più
   * danno del pasto mancante.
   */
  it('⚠️ dice che sta già mangiando così: non è ferma e non è rotta', () => {
    expect(t().description).toContain('non è ferma e non è rotta');
  });

  /**
   * ⛔ **E dice dove NON si chiude.** La finestra la sposta la cliente dall'app, e il profilo non
   * c'entra: mandare la nutrizionista a cercare quei due comandi è mandarla a cercare qualcosa che
   * non esiste. *Una ragione falsa è peggio di un ordine sbagliato.*
   */
  it('⛔ non manda a cambiare la finestra né il profilo, ma a generare la variante', () => {
    const d = t().description;
    expect(d).toContain('Non si chiude cambiandole la finestra');
    expect(d).toContain('generando la variante mancante');
    expect(d).toContain('diag:orologio');
  });

  it('e dice che si può segnare fatta, se dopo averci guardato va bene così', () => {
    expect(t().description).toContain('segna l\'attività fatta');
  });

  /** ⚠️ Un pasto solo o più d'uno: la frase resta italiana in tutti e due i casi. */
  it('⚠️ al plurale non dice «uno di quelli non c\'è»', () => {
    const due = testoPastiNonServiti('Antonella', ['Colazione', 'Spuntino'], 'X').description;
    expect(due).toContain('Alcuni di quelli');
    expect(due).toContain('Colazione, Spuntino');
  });
});

describe('⛔ l\'avviso arriva a chi può chiuderla', () => {
  /**
   * ⛔ **È la metà che rende utile tutto il resto.** Fino al 21/8 la push di un'attività andava
   * **solo alla coach**: un'attività che chiede di generare una variante a catalogo arrivava a
   * qualcuno che non può generarla, e la nutrizionista la trovava solo aprendo l'elenco di sua
   * iniziativa. Aprire un'attività che nessuno vede è lo stesso lavoro di non aprirla, con in più
   * l'illusione di averlo fatto.
   */
  it('⛔ questo tipo è fra quelli della nutrizionista', () => {
    expect(TIPI_DELLA_NUTRIZIONISTA.has(TIPO_PASTI_NON_SERVITI)).toBe(true);
  });

  /**
   * ⚠️ E con lui gli altri due del digiuno, che avevano lo stesso difetto da prima: i loro testi
   * chiedono valutazioni cliniche, e la push andava alla coach.
   */
  /**
   * ⛔ **Le COSTANTI, non le stringhe** (corretto il 22/8). Qui c'era scritto a mano
   * `'finestra_digiuno_non_traducibile'` — con le prime due parole scambiate rispetto al tipo vero.
   * Cioè questo test, che esisteva per accorgersi di una stringa sbagliata, **certificava la stringa
   * sbagliata come giusta**. Un test che ricopia il valore invece di importarlo non prova niente:
   * prova solo che chi l'ha scritto e chi ha scritto il codice hanno sbagliato insieme.
   */
  it.each([
    ['digiuno estremo', TIPO_DIGIUNO_ESTREMO],
    ['finestra non traducibile', TIPO_FINESTRA_NON_TRADUCIBILE],
  ])('⚠️ anche «%s» è della nutrizionista', (_titolo, kind) => {
    expect(TIPI_DELLA_NUTRIZIONISTA.has(kind)).toBe(true);
  });

  /** ⛔ E il tipo vero è quello, non quello con le parole al contrario. */
  it('⛔ la finestra non traducibile si chiama «digiuno_finestra_non_traducibile»', () => {
    expect(TIPO_FINESTRA_NON_TRADUCIBILE).toBe('digiuno_finestra_non_traducibile');
    expect(TIPI_DELLA_NUTRIZIONISTA.has('finestra_digiuno_non_traducibile')).toBe(false);
  });

  /** ⚠️ E non tutte lo sono: le attività della coach restano della coach. */
  it.each([['measures_missing'], ['finestra_digiuno_mai_chiesta'], ['pause_regain']])(
    '⚠️ «%s» NON è della nutrizionista',
    (kind) => {
      expect(TIPI_DELLA_NUTRIZIONISTA.has(kind)).toBe(false);
    },
  );

  /**
   * ⚠️ **Questo test oggi è quasi una tautologia, e va detto.** Fino al 22/8 `TIPI_DELLA_NUTRIZIONISTA`
   * era un elenco di **stringhe scritte a mano**, e una era sbagliata: qui si verificava che la
   * costante e la stringa combaciassero. Da quando l'insieme si costruisce **dalle costanti**, le
   * due cose non possono più divergere e questo test non può più fallire.
   *
   * ⛔ Resta perché il valore letterale è un contratto con la **banca dati**: le righe di
   * `coach_task` già scritte hanno quel `kind`, e rinominare la costante le renderebbe orfane. È
   * quello che prova la prima riga; la seconda è il residuo storico.
   */
  it('⛔ la costante del tipo e la stringa nell\'elenco sono la stessa cosa', () => {
    expect(TIPO_PASTI_NON_SERVITI).toBe('digiuno_pasti_non_serviti');
    expect([...TIPI_DELLA_NUTRIZIONISTA]).toContain(TIPO_PASTI_NON_SERVITI);
  });
});

describe('la scadenza', () => {
  /**
   * ⚠️ Una settimana: generare una variante a catalogo è lavoro vero e la cliente intanto mangia,
   * ma ogni giorno che passa è una giornata in cui riceve meno di quello che le abbiamo scritto.
   */
  it('è a una settimana da adesso', () => {
    const adesso = new Date('2026-08-21T10:00:00Z');
    expect(scadenzaPastiNonServiti(adesso).toISOString()).toBe('2026-08-28T10:00:00.000Z');
  });
});
