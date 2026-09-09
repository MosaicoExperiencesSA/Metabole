/**
 * ⛔ **«RIGENERA MENU» NON CANCELLA PIÙ LE GIORNATE SCRITTE A MANO.**
 *
 * È la promessa centrale del menu scritto a mano — *«il giorno scritto a mano è intoccabile dalla
 * passata notturna e da "Rigenera menu"»* — e fino al 3/9 sera **non aveva nessuna prova**: una
 * revisione avversariale ha rimesso `regenerateFromToday` al `deleteMany` secco di prima e
 * duemilacinquecento test sono rimasti verdi.
 *
 * ⚠️ *Le prove sul modulo puro non provano il montaggio.* `senzaQuelleAMano` era provata bene, su
 * un array in memoria; le tre righe che la chiamano — cioè quelle che decidono se il lavoro di una
 * persona sopravvive a un clic — non erano toccate da niente.
 */
import { MenuService } from './menu.service';
/**
 * ⛔ **«Oggi» si chiede alla stessa funzione del codice** (`toDateOnly`), non si ricalcola con la
 * mezzanotte UTC: sotto `npm run test:notte` i due valori differiscono di un giorno intero, e una
 * prova scritta con l'UTC è verde di giorno e rossa di notte — cioè proprio nel turno per cui esiste.
 * È già successo l'8/9 due volte, con l'avviso alla cliente e con la giornata dettata a Vera.
 */
import { toDateOnly } from '../common/date-only';

const aMano = [{ slot: 'lunch', recipeId: 'p1', name: 'Salmone al forno', kcal: 700, scrittaAMano: { origine: 'nutrizionista', da: 'Lucia', il: '2026-09-03' } }];
const delMotore = [{ slot: 'lunch', recipeId: 'p2', name: 'y', kcal: 700 }];

/**
 * Il minimo perché i tre metodi girino: quello che conta è **quali id finiscono nel `deleteMany`**.
 * `deliverIfEligible` è finto — qui non si prova l'erogazione, si prova cosa viene cancellato.
 */
function servizio(
  giorni: { id: string; meals: unknown; date?: Date }[],
  regime: string | null = 'omnivore',
  ricette: { id: string; name: string; ingredients: unknown }[] = [],
) {
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  const apri = jest.fn().mockResolvedValue({});
  const prisma = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ planHeldAt: null }) },
    menuDay: {
      findMany: jest.fn().mockResolvedValue(giorni),
      /** ⚠️ La lettura del regime della dieta appena erogata: senza, l'avviso non parte. */
      findFirst: jest.fn().mockResolvedValue({ diet: { regime } }),
      deleteMany,
      createMany,
    },
    recipe: { findMany: jest.fn().mockResolvedValue(ricette) },
    /** ⚠️ La porta usa `findUnique` sulla chiave composta, non `findFirst`. */
    coachTask: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((a: never) => { apri(a); return Promise.resolve({ id: 't1' }); }),
    },
    /**
     * ⚠️ `avvisaAttivitaNuova` gira subito dopo la creazione: senza questi assorbe e logga.
     * ⛔ E dall'8/9 `findUnique` deve rendere una PERSONA: `notificaUtente` esce senza scrivere
     * niente se non trova il destinatario, quindi un `null` qui faceva passare per «non avvisa» un
     * codice che avvisava benissimo.
     */
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'c1', prefs: null }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    /** ⚠️ `findMany` dall'8/9: è il dedup dell'avviso alla cliente. Vuoto = nessuno in attesa. */
    notification: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as never;
  /** ⚠️ Le push, dall'8/9: la cliente va avvisata quando le si riscrivono giorni che aveva aperto. */
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const s = new MenuService(
    prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, push as never,
  );
  // ⚠️ L'erogazione non è l'oggetto di queste prove: si finge, e si guarda solo la cancellazione.
  (s as unknown as { deliverIfEligible: unknown }).deliverIfEligible = jest.fn().mockResolvedValue([]);
  const avviso = (prisma as unknown as { notification: { create: jest.Mock } }).notification.create;
  const letture = (prisma as unknown as { menuDay: { findMany: jest.Mock } }).menuDay.findMany;
  return { s, deleteMany, createMany, apri, avviso, push, letture };
}

const _dummy = 0; void _dummy;
const idCancellati = (deleteMany: jest.Mock): string[] =>
  (deleteMany.mock.calls[0]?.[0]?.where?.id?.in ?? []) as string[];

describe('le tre porte che cancellano giornate risparmiano quelle scritte a mano', () => {
  const GIORNI = [
    { id: 'a-mano', meals: aMano, date: new Date('2026-09-20T00:00:00Z') },
    { id: 'del-motore', meals: delMotore, date: new Date('2026-09-21T00:00:00Z') },
  ];

  it('⛔ «Rigenera menu» cancella solo quella del motore', async () => {
    const { s, deleteMany } = servizio(GIORNI);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['del-motore']);
  });

  it('⛔ il cambio di tipo dieta idem', async () => {
    const { s, deleteMany } = servizio(GIORNI);
    await s.redeliverFutureDays('c1');
    expect(idCancellati(deleteMany)).toEqual(['del-motore']);
  });

  /** ⛔ E qui più che altrove: questo metodo cancella TUTTI i menu, passati compresi. */
  it('⛔ e la ripartenza dal piano, che cancella tutto', async () => {
    const { s, deleteMany } = servizio(GIORNI);
    await s.restartFromPlanStart('c1');
    expect(idCancellati(deleteMany)).toEqual(['del-motore']);
  });

  /**
   * ⚠️ **La controprova**: senza giornate a mano si cancella tutto, come prima. Senza questa, le tre
   * prove sopra passerebbero anche se il filtro cancellasse sempre niente.
   */
  it('⚠️ e senza giornate a mano si cancella tutto, come prima', async () => {
    // ⚠️ La data c'è: una riga di `menu_day` senza data non esiste, e dall'8/9 il codice la legge.
    const { s, deleteMany } = servizio([
      { id: 'x', meals: delMotore, date: new Date('2026-09-20T00:00:00Z') },
      { id: 'y', meals: delMotore, date: new Date('2026-09-21T00:00:00Z') },
    ]);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['x', 'y']);
  });

  /**
   * ⛔ **`origine: 'app'` è la CLIENTE, e non rende intoccabile la giornata.** Una prima stesura la
   * contava: «Rigenera menu» avrebbe saltato in silenzio ogni giornata futura su cui lei ha premuto
   * «Sostituisci» una volta — e «Rigenera menu» è lo strumento che tutti gli altri messaggi del
   * progetto indicano come via d'uscita.
   */
  it('⛔ una sostituzione chiesta dalla CLIENTE non blocca la rigenerazione', async () => {
    const dallApp = [{ ...delMotore[0], substitutions: [{ from: 'a', to: 'b', reason: 'x', origine: 'app' }] }];
    const { s, deleteMany } = servizio([{ id: 'app', meals: dallApp, date: new Date('2026-09-20T00:00:00Z') }]);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['app']);
  });

  /** ⚠️ Mentre un cambio concordato in chat con la nutrizionista sì: quello è lavoro di una persona. */
  it('⚠️ un cambio concordato in chat invece resta', async () => {
    const dallaChat = [{ ...delMotore[0], substitutions: [{ from: 'a', to: 'b', reason: 'x', origine: 'chat' }] }];
    const { s, deleteMany } = servizio([{ id: 'chat', meals: dallaChat, date: new Date('2026-09-20T00:00:00Z') }]);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual([]);
  });

  /**
   * ⚠️ **Il ripristino guarda quelle davvero cancellate.** Se tutte le giornate future erano a mano,
   * `daRifare` è vuoto: entrare nel ramo del ripristino farebbe un `createMany` su niente e
   * loggherebbe «0 giorni rimessi com'erano», un messaggio che non descrive niente.
   */
  it('⚠️ con tutte le giornate a mano non si finge un ripristino', async () => {
    const { s, createMany } = servizio([{ id: 'a-mano', meals: aMano }]);
    await s.redeliverFutureDays('c1');
    expect(createMany).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **DOPO UN CAMBIO DI TIPO DIETA, LA GIORNATA A MANO CHE SOPRAVVIVE VIENE GUARDATA.**
 *
 * È il caso 5 dei limiti dichiarati, e l'unico rimasto a poter arrivare nel piatto di qualcuno: lì
 * l'intoccabilità lavora **contro** la cliente — la stessa regola che tiene il lavoro di una
 * persona tiene anche un piatto che non le si può più servire.
 */
describe('il cambio di tipo dieta guarda le giornate a mano rimaste', () => {
  const SALMONE = [{ id: 'p1', name: 'Salmone al forno', ingredients: [{ name: 'salmone' }] }];
  const giorno = { id: 'a-mano', meals: aMano, date: new Date('2026-09-20T00:00:00Z') };

  it('⛔ passando a vegana, il salmone rimasto apre un\'attività', async () => {
    const { s, apri } = servizio([giorno], 'vegan', SALMONE);
    await s.redeliverFutureDays('c1');
    expect(apri).toHaveBeenCalled();
    const dati = apri.mock.calls[0][0].data;
    expect(dati.kind).toBe('giornata_a_mano_fuori_regime');
    expect(dati.title).toContain('20/09/2026');
    expect(dati.description).toContain('Salmone al forno');
  });

  /** ⚠️ Per un'onnivora non c'è niente da rivedere: un avviso che arriva sempre non è un avviso. */
  it('⚠️ restando onnivora non apre niente', async () => {
    const { s, apri } = servizio([giorno], 'omnivore', SALMONE);
    await s.redeliverFutureDays('c1');
    expect(apri).not.toHaveBeenCalled();
  });

  /** ⚠️ E una giornata del motore non è affar suo: quella il motore l'ha appena rifatta. */
  it('⚠️ una giornata del motore non apre niente', async () => {
    const { s, apri } = servizio([{ id: 'x', meals: delMotore, date: new Date('2026-09-20T00:00:00Z') }], 'vegan', SALMONE);
    await s.redeliverFutureDays('c1');
    expect(apri).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **La scadenza è il giorno PRIMA di quella giornata**: una scadenza generica su una cosa che
   * ne ha una precisa è il modo di farla arrivare tardi.
   */
  it('⛔ scade il giorno prima della giornata da rivedere', async () => {
    const { s, apri } = servizio([giorno], 'vegan', SALMONE);
    await s.redeliverFutureDays('c1');
    const scadenza = apri.mock.calls[0][0].data.dueDate as Date;
    expect(scadenza.toISOString().slice(0, 10)).toBe('2026-09-19');
  });

  /** ⛔ E non blocca: se l'attività non si apre, il menu è stato erogato lo stesso. */
  it('⛔ un guaio nell\'avviso non ferma la rierogazione', async () => {
    const { s } = servizio([giorno], 'vegan', SALMONE);
    (s as unknown as { avvisaGiornateAManoFuoriRegime: unknown }).avvisaGiornateAManoFuoriRegime =
      jest.fn().mockRejectedValue(new Error('boom'));
    await expect(s.redeliverFutureDays('c1')).resolves.toMatchObject({ removed: 0 });
  });
});

/**
 * ⛔ **IL GIORNO DI OGGI SI RIFÀ SOLO SE LEI NON L'HA APERTO** — decisione di Simone, 8/9:
 * *«rigenera menu deve rifare solo quelli futuri»*, precisata in *«oggi si rifà se non l'ha
 * aperto»*.
 *
 * ⚠️ **La prima stesura aveva scritto «mai oggi», e una revisione avversariale l'ha smontata**:
 * questo pulsante esiste per riparare una giornata sbagliata — un giorno con la sola colazione, un
 * piatto col glutine a una celiaca — e il caso più urgente è proprio oggi. Con un divieto secco, a
 * chi non aveva ancora aperto niente il difetto restava nel piatto.
 */
describe('Rigenera menu: il giorno di oggi resta suo solo se lo ha aperto', () => {
  const oggi = () => toDateOnly();
  const fraGiorni = (n: number) => new Date(toDateOnly().getTime() + n * 86_400_000);
  const apertoDavvero = { apertoDallaClienteIl: new Date('2026-09-01'), apertureTracciate: true };
  const maiAperto = { apertoDallaClienteIl: null, apertureTracciate: true };
  const nonLoSo = { apertoDallaClienteIl: null, apertureTracciate: false };

  /** ⚠️ Il filtro resta `gte`: oggi si toglie DOPO, guardando chi l'ha aperto. */
  it('⚠️ legge da oggi compreso: il giorno si toglie dopo, non nel `where`', async () => {
    const { s, letture } = servizio([]);
    await s.regenerateFromToday('c1');
    const dove = letture.mock.calls[0][0].where.date;
    expect(Object.keys(dove)).toEqual(['gte']);
    expect((dove.gte as Date).toISOString()).toBe(oggi().toISOString());
  });

  it('⛔ se lo ha già aperto, il giorno di oggi NON si cancella', async () => {
    const { s, deleteMany } = servizio([
      { id: 'oggi', meals: delMotore, date: oggi(), ...apertoDavvero },
      { id: 'domani', meals: delMotore, date: fraGiorni(1), ...maiAperto },
    ] as never);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['domani']);
  });

  /**
   * ⛔ **La controprova, ed è quella che tiene in piedi il pulsante**: a chi non l'ha aperto, oggi
   * si rifà. Senza questa, «salta oggi» e «salta oggi se aperto» sono indistinguibili.
   */
  it('⛔ se non lo ha aperto, oggi si rifà come prima', async () => {
    const { s, deleteMany } = servizio([
      { id: 'oggi', meals: delMotore, date: oggi(), ...maiAperto },
    ] as never);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['oggi']);
  });

  /** ⛔ E «non lo so» non basta a toglierlo: chi preme il pulsante ha letto una conferma. */
  it('⛔ il dubbio non salva il giorno di oggi', async () => {
    const { s, deleteMany } = servizio([
      { id: 'oggi', meals: delMotore, date: oggi(), ...nonLoSo },
    ] as never);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['oggi']);
  });

  /** ⚠️ E chi ha premuto lo legge nella risposta, invece di dedurlo dal numero dei giorni. */
  it('⚠️ la risposta dice che oggi è rimasto suo', async () => {
    const { s } = servizio([{ id: 'oggi', meals: delMotore, date: oggi(), ...apertoDavvero }] as never);
    expect((await s.regenerateFromToday('c1')).oggiRestaSuo).toBe(true);
    const { s: s2 } = servizio([{ id: 'oggi', meals: delMotore, date: oggi(), ...maiAperto }] as never);
    expect((await s2.regenerateFromToday('c1')).oggiRestaSuo).toBe(false);
  });

  /** ⚠️ Un giorno FUTURO che aveva aperto si rifà lo stesso: la protezione è solo per oggi. */
  it('⚠️ un giorno futuro già aperto si rifà comunque', async () => {
    const { s, deleteMany } = servizio([
      { id: 'domani', meals: delMotore, date: fraGiorni(1), ...apertoDavvero },
    ] as never);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['domani']);
  });
});

/**
 * ⛔ **E LA CLIENTE VIENE AVVISATA** — la stessa decisione della giornata riscritta a mano, portata
 * dove il danno è più grande: queste porte non riscrivono **un** giorno, li riscrivono tutti quelli
 * futuri. ⚠️ E siccome aprire la **lista della spesa** segna aperti tutti e sette i giorni
 * consegnati, quasi sempre la persona colpita **ha già comprato**.
 */
describe('quando i giorni riscritti li aveva già aperti, glielo si dice', () => {
  const fraGiorni = (n: number) => new Date(toDateOnly().getTime() + n * 86_400_000);
  const apertoIeri = { apertoDallaClienteIl: new Date('2026-09-01'), apertureTracciate: true };
  const maiAperto = { apertoDallaClienteIl: null, apertureTracciate: true };
  /** ⚠️ L'avviso parte solo se i giorni sono stati **rimessi**: vedi la prova in fondo. */
  const conErogazione = (giorni: unknown[]) => {
    const r = servizio(giorni as never);
    (r.s as unknown as { deliverIfEligible: unknown }).deliverIfEligible = jest.fn().mockResolvedValue(['x']);
    return r;
  };

  it('⛔ un avviso solo, e nomina il PRIMO giorno cambiato', async () => {
    const { s, avviso, push } = conErogazione([
      { id: 'g1', meals: delMotore, date: fraGiorni(3), ...apertoIeri },
      { id: 'g2', meals: delMotore, date: fraGiorni(1), ...apertoIeri },
    ]);
    await s.regenerateFromToday('c1');
    /** ⛔ Uno, non due: sette notifiche in fila sono un campanello che si smette di guardare. */
    expect(avviso).toHaveBeenCalledTimes(1);
    const riga = avviso.mock.calls[0][0].data;
    expect(riga.payload.giorno).toBe(fraGiorni(1).toISOString().slice(0, 10));
    expect(riga.payload.quanti).toBe(2);
    /** ⛔ E il titolo dice DA QUANDO, non «qualcosa è cambiato». */
    expect(riga.payload.title).toMatch(/^Il tuo menu è cambiato da /);
    expect(push.sendToUser).toHaveBeenCalled();
  });

  it('⛔ nessun avviso se non aveva aperto nessuno di quei giorni', async () => {
    const { s, avviso } = conErogazione([{ id: 'g1', meals: delMotore, date: fraGiorni(2), ...maiAperto }]);
    await s.regenerateFromToday('c1');
    expect(avviso).not.toHaveBeenCalled();
  });

  it('⚠️ anche la rierogazione avvisa', async () => {
    const { s, avviso } = conErogazione([{ id: 'g1', meals: delMotore, date: fraGiorni(2), ...apertoIeri }]);
    await s.redeliverFutureDays('c1');
    expect(avviso).toHaveBeenCalledTimes(1);
  });

  /** ⚠️ E la ripartenza dal piano, che cancella tutto: senza questa, l'avviso lì si poteva togliere. */
  it('⚠️ e la ripartenza dal piano', async () => {
    const { s, avviso } = conErogazione([{ id: 'g1', meals: delMotore, date: fraGiorni(2), ...apertoIeri }]);
    await s.restartFromPlanStart('c1');
    expect(avviso).toHaveBeenCalledTimes(1);
  });

  /**
   * ⛔ **CANCELLARE NON È RISCRIVERE** — il difetto peggiore di questa consegna, trovato da una
   * revisione avversariale. Si sposta la data d'inizio al 20: si cancella tutto, l'erogazione non
   * rimette niente (la finestra è ancora chiusa) e la cliente resta col calendario **vuoto**.
   * L'avviso le diceva «ricontrolla la lista della spesa» per giornate che non esistono più.
   */
  it('⛔ se non è stato rimesso niente, non le si dice che il menu è cambiato', async () => {
    const { s, avviso, deleteMany } = servizio([
      { id: 'g1', meals: delMotore, date: fraGiorni(2), ...apertoIeri },
    ] as never);
    await s.regenerateFromToday('c1');
    expect(deleteMany).toHaveBeenCalled();
    expect(avviso).not.toHaveBeenCalled();
  });

  /** ⛔ Una giornata a mano non è stata cancellata: avvisare per lei sarebbe un allarme falso. */
  it('⛔ le giornate scritte a mano non entrano nell\'avviso', async () => {
    const { s, avviso } = conErogazione([{ id: 'a-mano', meals: aMano, date: fraGiorni(1), ...apertoIeri }]);
    await s.regenerateFromToday('c1');
    expect(avviso).not.toHaveBeenCalled();
  });

  /** ⛔ E un avviso che non parte non ferma la rigenerazione: il lavoro vero è il menu. */
  it('⛔ se l\'avviso fallisce, la rigenerazione va avanti lo stesso', async () => {
    const { s, avviso, deleteMany } = conErogazione([
      { id: 'g1', meals: delMotore, date: fraGiorni(1), ...apertoIeri },
    ]);
    avviso.mockRejectedValueOnce(new Error('database giù'));
    await expect(s.regenerateFromToday('c1')).resolves.toBeDefined();
    expect(deleteMany).toHaveBeenCalled();
    expect(avviso).toHaveBeenCalled();
  });
});
