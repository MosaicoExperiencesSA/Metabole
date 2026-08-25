/**
 * ⛔ **NESSUNO RESTA SUL TAVOLO DI NESSUNO.**
 *
 * Il 23/8, chiudendo il via libera clinico, sono venute fuori due cose che nessuno aveva deciso: una
 * cliente in screening che **nessuno ha mai guardato riceve i menu** (il cancello sull'erogazione
 * non è mai esistito: il blocco viveva solo nella card dell'app, e quella card compariva di rado
 * proprio perché i menu c'erano), e dopo il «può proseguire» il motore restava comunque muto.
 *
 * Simone, 25/8: *«Se il cliente è supervisionato va mandata notifica a Lucia di controllarlo ogni 7
 * giorni attraverso Vera»*. Cioè: non si chiude niente — si fa arrivare la domanda a chi deve
 * rispondere, e si continua a farla arrivare finché non risponde.
 */
import {
  PROMEMORIA_OGNI_GIORNI,
  chiaveDelPromemoria,
  promemoriaDovuto,
  testoDelPromemoria,
  type ClienteDaSorvegliare,
} from './promemoria-supervisione';

const giorno = (iso: string) => new Date(`${iso}T09:00:00Z`);

const cliente = (p: Record<string, unknown>, da = '2026-08-01'): ClienteDaSorvegliare => ({
  clientId: 'c1',
  nome: 'Giulia',
  da: new Date(`${da}T00:00:00Z`),
  profilo: p as never,
});

const IN_SCREENING = { screeningFlag: true, idoneita: null, idoneitaVisitaEntro: null };

describe('⛔ quando va aperto un promemoria', () => {
  it('⛔ il giorno stesso in cui comincia la sorveglianza, sì: la finestra 0 è la prima', () => {
    const e = promemoriaDovuto(cliente(IN_SCREENING), giorno('2026-08-01'));
    expect(e.chiave).toBe(chiaveDelPromemoria('c1', 7, 0));
    expect(e.giorniInAttesa).toBe(0);
  });

  /**
   * ⛔ **La chiave è la FINESTRA, non il giorno**, ed è tutto il punto dell'idempotenza: il cron
   * può girare due volte la stessa notte, o riprendere dopo un guasto, e la domanda resta una.
   */
  it('⛔ dentro la stessa settimana la chiave non cambia: una domanda sola', () => {
    const chiavi = ['2026-08-01', '2026-08-03', '2026-08-07'].map(
      (d) => promemoriaDovuto(cliente(IN_SCREENING), giorno(d)).chiave,
    );
    expect(new Set(chiavi).size).toBe(1);
  });

  /** ⛔ E la settimana dopo la domanda TORNA: una domanda senza risposta non deve spegnersi. */
  it('⛔ dall’ottavo giorno la chiave cambia: il promemoria si ripresenta', () => {
    const prima = promemoriaDovuto(cliente(IN_SCREENING), giorno('2026-08-07'));
    const dopo = promemoriaDovuto(cliente(IN_SCREENING), giorno('2026-08-08'));
    expect(dopo.chiave).not.toBe(prima.chiave);
    expect(dopo.chiave).toBe(chiaveDelPromemoria('c1', 7, 1));
    expect(dopo.giorniInAttesa).toBe(7);
  });

  it('⚠️ e a tre settimane dice da quanto aspetta: «da 21 giorni» pesa diverso da «da 7»', () => {
    const e = promemoriaDovuto(cliente(IN_SCREENING), giorno('2026-08-22'));
    expect(e.finestra).toBe(3);
    expect(e.giorniInAttesa).toBe(21);
  });
});

describe('⛔ per chi NON si apre niente', () => {
  it('⛔ chi non è in percorso supervisionato non c’entra', () => {
    expect(promemoriaDovuto(cliente({ screeningFlag: false }), giorno('2026-08-10')).chiave).toBeNull();
  });

  /**
   * ⛔ **Col «Può proseguire» la decisione c'è, ed è definitiva.** Continuare a chiedere a Lucia di
   * guardare una cosa già guardata è il modo più rapido di farle ignorare tutti i promemoria,
   * compresi quelli che contano.
   */
  it('⛔ chi ha il via libera non torna più in coda', () => {
    const via = cliente({ screeningFlag: true, idoneita: 'idonea', idoneitaVisitaEntro: null });
    expect(promemoriaDovuto(via, giorno('2026-08-10')).chiave).toBeNull();
    expect(promemoriaDovuto(via, giorno('2026-12-10')).chiave).toBeNull();
  });

  /**
   * ⚠️ **Ma con «serve una visita entro il 30» il promemoria RESTA**: la decisione è presa, la
   * visita no — e il giorno dopo la scadenza il percorso si ferma davvero.
   */
  it('⚠️ chi aspetta una visita resta sorvegliata, prima e dopo la scadenza', () => {
    const con = cliente({
      screeningFlag: true,
      idoneita: 'serve_visita',
      idoneitaVisitaEntro: new Date('2026-08-30T00:00:00Z'),
    });
    expect(promemoriaDovuto(con, giorno('2026-08-20')).stato.motivo).toBe('visita_da_fare');
    expect(promemoriaDovuto(con, giorno('2026-08-20')).chiave).toBeTruthy();
    expect(promemoriaDovuto(con, giorno('2026-09-05')).stato.motivo).toBe('visita_scaduta');
    expect(promemoriaDovuto(con, giorno('2026-09-05')).chiave).toBeTruthy();
  });
});

describe('⚠️ i casi storti che non devono diventare rumore', () => {
  /**
   * ⚠️ **Senza data di inizio si comincia oggi, invece di saltarla.** Una cliente il cui profilo
   * non porta la data della registrazione è esattamente quella di cui sappiamo meno: escluderla
   * dalla sorveglianza perché le manca un campo sarebbe il verso sbagliato in cui sbagliare.
   */
  it('⛔ senza data di inizio la sorveglianza comincia oggi, non salta', () => {
    const senzaData: ClienteDaSorvegliare = { clientId: 'c1', da: null, profilo: IN_SCREENING as never };
    const e = promemoriaDovuto(senzaData, giorno('2026-08-10'));
    expect(e.chiave).toBe(chiaveDelPromemoria('c1', 7, 0));
    expect(e.giorniInAttesa).toBe(0);
  });

  /**
   * ⚠️ **Una soglia assurda in tabella non diventa un promemoria al giorno.** `supervision_reminder_days`
   * lo scrive una persona: a zero, la divisione darebbe `Infinity` e una chiave nuova ogni notte.
   */
  it('⛔ un passo a zero, negativo o assurdo ricade sui 7 giorni', () => {
    for (const passo of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const e = promemoriaDovuto(cliente(IN_SCREENING), giorno('2026-08-08'), passo);
      expect(e.finestra).toBe(1);
      expect(e.chiave).toBe(chiaveDelPromemoria('c1', 7, 1));
    }
    expect(PROMEMORIA_OGNI_GIORNI).toBe(7);
  });

  /** ⚠️ Una data di inizio nel futuro non produce giorni negativi né finestre all'indietro. */
  it('⚠️ una data di inizio nel futuro non fa numeri negativi', () => {
    const e = promemoriaDovuto(cliente(IN_SCREENING, '2026-09-01'), giorno('2026-08-10'));
    expect(e.giorniInAttesa).toBe(0);
    expect(e.finestra).toBe(0);
  });
});

/**
 * ⛔ **IL TESTO DEVE DIRE COSA FARE, non che c'è qualcosa.** Una domanda che dice «c'è una cliente in
 * screening» è una notifica; una che dice da quanti giorni aspetta, cosa può decidere e cosa succede
 * se non decide è una cosa che si chiude in trenta secondi.
 */
describe('⛔ il testo che legge la nutrizionista', () => {
  it('⛔ per chi non è mai stata valutata dice che NEL FRATTEMPO riceve i menu', () => {
    const c = cliente(IN_SCREENING);
    const testo = testoDelPromemoria(c, promemoriaDovuto(c, giorno('2026-08-15')));
    expect(testo).toContain('Giulia');
    expect(testo).toContain('da 14 giorni');
    expect(testo).toMatch(/RICEVE I MENU/);
    // ⛔ E dice le due strade concrete, non «valuta la situazione».
    expect(testo).toContain('Può proseguire');
    expect(testo).toContain('entro quando');
  });

  it('⚠️ per chi aspetta una visita dice la data, e che i menu vanno avanti fino a lì', () => {
    const c = cliente({
      screeningFlag: true,
      idoneita: 'serve_visita',
      idoneitaVisitaEntro: new Date('2026-08-30T00:00:00Z'),
    });
    const testo = testoDelPromemoria(c, promemoriaDovuto(c, giorno('2026-08-20')));
    expect(testo).toContain('30/08/2026');
    expect(testo).toContain('riceve i menu regolarmente');
  });

  it('⛔ e per chi ha la visita scaduta dice che i menu sono FERMI: è l’opposto', () => {
    const c = cliente({
      screeningFlag: true,
      idoneita: 'serve_visita',
      idoneitaVisitaEntro: new Date('2026-08-10T00:00:00Z'),
    });
    const testo = testoDelPromemoria(c, promemoriaDovuto(c, giorno('2026-08-20')));
    expect(testo).toContain('10/08/2026');
    expect(testo).toContain('NON riceve più i menu');
  });

  it('⚠️ senza nome non si scrive «undefined»', () => {
    const c: ClienteDaSorvegliare = { clientId: 'c1', nome: '  ', da: null, profilo: IN_SCREENING as never };
    const testo = testoDelPromemoria(c, promemoriaDovuto(c, giorno('2026-08-01')));
    expect(testo).toMatch(/^Una cliente/);
    expect(testo).not.toMatch(/undefined|null/);
  });
});

/**
 * ⛔ **CAMBIARE IL PASSO NON DEVE SPEGNERE LA SORVEGLIANZA** — trovato in revisione, 25/8.
 *
 * Il numero di finestra dipende dal passo, quindi cambiando `supervision_reminder_days` le finestre
 * si rinumerano. Con la chiave `supervisione:<cliente>:<finestra>` collidevano con quelle già
 * usate — e `apriRichiestaVera` cerca la chiave **senza filtro sullo stato**, quindi anche una riga
 * chiusa blocca. Misurato: passando da 3 a 7 giorni, ~40 giorni consecutivi senza un promemoria, con
 * l'esito che ogni notte diceva «già aperta». *Una ragione falsa è peggio di un ordine sbagliato.*
 */
describe('⛔ il passo dentro la chiave: cambiarlo non deve far sparire i promemoria', () => {
  const chiavi = (passo: number, giorni: number[]) =>
    giorni.map((g) => promemoriaDovuto(cliente(IN_SCREENING), giorno(`2026-08-${String(g).padStart(2, '0')}`), passo).chiave);

  it('⛔ le chiavi del passo 3 e quelle del passo 7 non si toccano mai', () => {
    const a = new Set(chiavi(3, [1, 4, 7, 10, 13, 16, 19, 22, 25, 28]));
    const b = new Set(chiavi(7, [1, 8, 15, 22, 29]));
    expect([...a].filter((k) => b.has(k as string))).toEqual([]);
  });

  it('⛔ e passando da 3 a 7 la prima notte utile apre davvero, invece di dire «già aperta»', () => {
    // Con la chiave vecchia, il giorno 22 col passo 7 dava la finestra 3 — già usata dal passo 3.
    const conTre = promemoriaDovuto(cliente(IN_SCREENING), giorno('2026-08-10'), 3).chiave;
    const conSette = promemoriaDovuto(cliente(IN_SCREENING), giorno('2026-08-22'), 7).chiave;
    expect(conTre).not.toBe(conSette);
    expect(conSette).toContain(':7:');
  });
});
