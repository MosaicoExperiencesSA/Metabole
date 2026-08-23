/**
 * ⛔ **IL CASO GIANLUCA, 23/8 — e la regola che lo chiude.**
 *
 * Sulla sua scheda: «Valutazione clinica — Può proseguire · 23/08/2026». Nella sua app, nello stesso
 * momento: «Menu dopo la visita». Due schermate, due verità, e quella che vedeva lui era quella
 * sbagliata: aspettava una visita che non serviva più, mentre la nutrizionista lo credeva sbloccato.
 *
 * ⚠️ Questi test sono qui perché la regola è **piccola e sbagliarla non fa rumore**: chi la sbaglia
 * non vede un errore, vede una persona che smette di ricevere i menu. Il caso in fondo — «prima e
 * dopo la decisione, sulla stessa cliente» — è quello scritto sulla situazione vera.
 */
import { attendeIlViaLiberaClinico, statoSupervisione } from './via-libera-clinico';

describe('⛔ il via libera clinico scioglie il percorso supervisionato', () => {
  it('⛔ screening + «può proseguire» → la cliente NON aspetta più niente', () => {
    expect(attendeIlViaLiberaClinico({ screeningFlag: true, idoneita: 'idonea' })).toBe(false);
  });

  it('⛔ screening e nessuna decisione → aspetta: non l\'ha ancora guardata nessuno', () => {
    expect(attendeIlViaLiberaClinico({ screeningFlag: true, idoneita: null })).toBe(true);
    expect(attendeIlViaLiberaClinico({ screeningFlag: true })).toBe(true);
  });

  /**
   * ⚠️ **`serve_visita` SENZA data resta bloccante**: sono le righe scritte prima del 23/8, quando la
   * data non esisteva. Dare loro una finestra aperta vorrebbe dire sbloccare a posteriori delle
   * persone che nessuno ha più guardato — cioè decidere una cosa clinica con una migrazione.
   */
  it('⛔ screening + «serve una visita» SENZA data → aspetta: sono le righe vecchie', () => {
    expect(attendeIlViaLiberaClinico({ screeningFlag: true, idoneita: 'serve_visita' })).toBe(true);
  });

  /**
   * ⚠️ **La decisione può solo TOGLIERE il blocco, mai crearlo.** Una `serve_visita` su una cliente
   * senza screening — capita per un'allergia — oggi riceve i menu, e fermarli sarebbe un blocco
   * nuovo su qualcuno che sta mangiando: un cambiamento nella direzione che fa danno, deciso di
   * rimbalzo mentre se ne correggeva un altro. Se un giorno lo si vuole, si fa guardandolo.
   */
  it('⚠️ senza screening non si blocca niente, nemmeno con «serve una visita»', () => {
    expect(attendeIlViaLiberaClinico({ screeningFlag: false, idoneita: 'serve_visita' })).toBe(false);
    expect(attendeIlViaLiberaClinico({ screeningFlag: null, idoneita: 'serve_visita' })).toBe(false);
  });

  /**
   * ⚠️ Profilo assente = non bloccata. Rispondere «bloccata» su un dato che non c'è fermerebbe i
   * menu **per un dato mancante**, che è il modo in cui un guasto di lettura diventa un digiuno.
   */
  it('⚠️ un profilo che non c\'è non blocca nessuno', () => {
    expect(attendeIlViaLiberaClinico(null)).toBe(false);
    expect(attendeIlViaLiberaClinico(undefined)).toBe(false);
    expect(attendeIlViaLiberaClinico({})).toBe(false);
  });

  /**
   * ⛔ **Solo `'idonea'` scioglie.** Se domani si aggiungesse un terzo esito — «da rivedere fra un
   * mese», «in attesa di esami» — deve restare bloccante finché qualcuno non lo guarda: sciogliere
   * per esclusione («tutto ciò che non è serve_visita») farebbe passare il caso nuovo in silenzio,
   * e il silenzio qui vuol dire menu consegnati a chi non doveva riceverli.
   */
  it('⛔ un esito che non conosciamo NON scioglie il blocco', () => {
    expect(attendeIlViaLiberaClinico({ screeningFlag: true, idoneita: 'da_rivedere' })).toBe(true);
    expect(attendeIlViaLiberaClinico({ screeningFlag: true, idoneita: '' })).toBe(true);
  });

  /** ⛔ La stessa cliente, prima e dopo il clic: è la situazione del 23/8, in due righe. */
  it('⛔ Gianluca: prima della decisione aspetta, dopo no — e non serve toccare `screeningFlag`', () => {
    const prima = { screeningFlag: true, idoneita: null as string | null };
    expect(attendeIlViaLiberaClinico(prima)).toBe(true);
    const dopo = { ...prima, idoneita: 'idonea' };
    expect(attendeIlViaLiberaClinico(dopo)).toBe(false);
    // ⚠️ E lo screening resta scritto: è un fatto sanitario dichiarato in registrazione, non uno
    // stato da cancellare. Quello che cambia è la risposta alla domanda, non la storia clinica.
    expect(dopo.screeningFlag).toBe(true);
  });
});

/**
 * ⛔ **LA FINESTRA DELLA VISITA — e il giorno esatto in cui si chiude.**
 *
 * Regola di Simone (23/8): «serve una visita» porta con sé **entro quando** va fatta. Fino a quel
 * giorno **compreso** la cliente riceve i menu; dal giorno dopo il percorso si ferma.
 *
 * ⚠️ Questi test **scrivono che ora è**, e non per abitudine: il confine è un giorno, e un giorno
 * dipende dal fuso. Fra la mezzanotte e le 02:00 italiane il giorno di Roma e quello UTC non
 * coincidono — è la famiglia di difetti di `common/date-only.ts` — e qui uno scarto di un giorno
 * vuol dire una persona che resta senza menu ventiquattr'ore prima del dovuto.
 */
describe('⛔ «serve una visita»: la finestra si chiude il giorno dopo la scadenza', () => {
  const conScadenza = (giorno: string) => ({
    screeningFlag: true,
    idoneita: 'serve_visita',
    idoneitaVisitaEntro: new Date(`${giorno}T00:00:00.000Z`),
  });

  it('⚠️ prima della scadenza riceve i menu, e sa che deve fare la visita', () => {
    const stato = statoSupervisione(conScadenza('2026-09-30'), new Date('2026-09-20T10:00:00.000Z'));
    expect(stato).toEqual({
      supervisionata: true, bloccata: false, motivo: 'visita_da_fare', visitaEntro: '2026-09-30',
    });
  });

  /** ⛔ **«Entro il 30» vuol dire che il 30 si mangia**: è la scelta di Simone, ed è il verso che non
   * toglie una giornata a chi la visita ce l'ha fissata proprio quel giorno nel pomeriggio. */
  it('⛔ il giorno STESSO della scadenza è ancora libero', () => {
    const stato = statoSupervisione(conScadenza('2026-09-30'), new Date('2026-09-30T10:00:00.000Z'));
    expect(stato.bloccata).toBe(false);
  });

  it('⛔ e il giorno dopo si ferma, dicendo da quando', () => {
    const stato = statoSupervisione(conScadenza('2026-09-30'), new Date('2026-10-01T10:00:00.000Z'));
    expect(stato).toEqual({
      supervisionata: true, bloccata: true, motivo: 'visita_scaduta', visitaEntro: '2026-09-30',
    });
  });

  /**
   * ⛔ **IL CONFINE ALLE 00:30, che è dove questa famiglia di difetti vive.**
   *
   * Le 22:00 UTC del 30 settembre sono già **mezzanotte e mezza del 1 ottobre a Roma**: la finestra
   * è chiusa, perché il giorno che conta è quello che intende la cliente. ⚠️ Un confronto fra
   * **istanti** — la scadenza salvata come `…T00:00:00Z` contro «adesso» — avrebbe fatto l'opposto e
   * per due ore avrebbe tenuto aperto un giorno finito. E mezz'ora prima, alle 23:30 di Roma del 30,
   * si mangia ancora.
   */
  it('⛔ alle 00:30 del 1 ottobre a Roma la finestra è chiusa, alle 23:30 del 30 no', () => {
    const scadenza = conScadenza('2026-09-30');
    expect(statoSupervisione(scadenza, new Date('2026-09-30T22:30:00.000Z')).bloccata).toBe(true);
    expect(statoSupervisione(scadenza, new Date('2026-09-30T21:30:00.000Z')).bloccata).toBe(false);
  });

  /** ⚠️ E d'inverno lo scarto è di un'ora: il confine si sposta con il fuso, non è una sottrazione fissa. */
  it('⛔ in ora solare il confine è un\'ora più tardi', () => {
    const scadenza = conScadenza('2027-01-15');
    expect(statoSupervisione(scadenza, new Date('2027-01-15T23:30:00.000Z')).bloccata).toBe(true);
    expect(statoSupervisione(scadenza, new Date('2027-01-15T22:30:00.000Z')).bloccata).toBe(false);
  });

  /** ⚠️ E «può proseguire» vince sulla scadenza, se per qualche motivo la riga la porta ancora. */
  it('⚠️ una scadenza rimasta su una cliente poi dichiarata idonea non la blocca', () => {
    const stato = statoSupervisione(
      { screeningFlag: true, idoneita: 'idonea', idoneitaVisitaEntro: new Date('2026-01-01T00:00:00.000Z') },
      new Date('2026-09-30T10:00:00.000Z'),
    );
    expect(stato.bloccata).toBe(false);
  });
});
