import { KcalNeedService } from './kcal-need.service';
import { FINESTRA_MASSIMA } from '../signals/percentuale-obiettivo';

/**
 * ⛔ **IL PESO CON CUI SI CALCOLANO LE CALORIE DI UNA PERSONA** — e fino al 27/8 questo servizio non
 * aveva **nessun test**.
 *
 * ⚠️ È il posto del progetto dove un numero pesa di più: da qui esce il fabbisogno, e dal fabbisogno
 * escono le kcal che una cliente si trova nel piatto. Che non ci fosse un test si è visto proprio
 * cambiando la riga del peso: la suite intera è rimasta verde. **Un servizio senza test non è un
 * servizio provato per caso: è un servizio che nessuna modifica può rompere in modo visibile.**
 *
 * Decisione di Simone, 27/8: *«il fabbisogno deve utilizzare la media mobile»*. È l'ultimo dei
 * quattro punti che rispondevano in modo diverso alla domanda «quanto pesa adesso» — gli altri tre
 * erano passati alla tendenza il 19/8.
 */
const GIORNO = 86_400_000;
const PROFILO = {
  userId: 'c1',
  sex: 'female',
  age: 40,
  heightCm: 165,
  startWeightKg: 80,
  objective: 'mantenimento',
  lifestyle: null,
  activityLevel: 'sedentary',
};

const config = (finestra = 3) => ({
  getNumber: jest.fn().mockImplementation((chiave: string, dato: number) =>
    Promise.resolve(chiave === 'moving_average_window' ? finestra : dato),
  ),
});

/**
 * ⛔ **IL FINTO ONORA `orderBy`, `take` E IL FILTRO SULLE DATE — e non è pignoleria.**
 *
 * Un doppio che risponde sempre uguale renderebbe verdi anche i cambi che in produzione fanno il
 * danno peggiore. ⚠️ E non è ipotetico: `progress.service.spec.ts` porta scritto che **questo esatto
 * difetto è già successo in questo repo** — le misure lette con `orderBy: 'asc', take: 120` erano le
 * centoventi **più vecchie**. Con un finto sordo all'ordinamento, cambiare `desc` in `asc` qui
 * significherebbe alimentare una cliente col peso di quando si è iscritta, e la suite resterebbe
 * tutta verde.
 *
 * @param pesi le pesate dalla più VECCHIA alla più recente, con quanti giorni fa sono state prese
 */
const conPesate = (
  pesi: { kg: number; giorniFa: number }[],
  profilo: Record<string, unknown> = {},
  obiettivo: unknown = null,
) => {
  const righe = pesi.map((p) => ({ weightKg: p.kg, date: new Date(Date.now() - p.giorniFa * GIORNO) }));
  return {
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ ...PROFILO, ...profilo }) },
    measurement: {
      findMany: jest.fn().mockImplementation(({ where, orderBy, take }: never) => {
        const w = (where ?? {}) as { date?: { gte?: Date } };
        const dopo = w.date?.gte ? righe.filter((r) => r.date.getTime() >= w.date!.gte!.getTime()) : righe;
        const ord = (orderBy as { date?: string })?.date === 'desc' ? [...dopo].reverse() : [...dopo];
        return Promise.resolve(typeof take === 'number' ? ord.slice(0, take) : ord);
      }),
      findFirst: jest.fn().mockImplementation(({ orderBy }: never) => {
        const ord = (orderBy as { date?: string })?.date === 'desc' ? [...righe].reverse() : [...righe];
        return Promise.resolve(ord[0] ?? null);
      }),
    },
    objective: { findFirst: jest.fn().mockResolvedValue(obiettivo) },
  };
};

const servizio = (prisma: unknown, finestra = 3) =>
  new KcalNeedService(prisma as never, config(finestra) as never);

describe('⛔ il peso del fabbisogno è la media mobile, non l\'ultima pesata', () => {
  const RECENTI = [{ kg: 70, giorniFa: 14 }, { kg: 70, giorniFa: 7 }, { kg: 69, giorniFa: 0 }];

  /**
   * ⛔ **IL CASO CHE DECIDE.** Tre pesate: 70, 70, 69. L'ultima dice 69, la tendenza dice 69,67.
   */
  it('⛔ usa la media delle ultime pesate, non l\'ultima', async () => {
    const est = await servizio(conPesate(RECENTI)).estimate('c1');
    expect(est).not.toBeNull();
    expect(est!.weightKg).toBeCloseTo(69.67, 2);
  });

  /**
   * ⛔ **E LE PESATE SI LEGGONO DALLA PIÙ RECENTE.** Cambiando `desc` in `asc` la cliente verrebbe
   * alimentata col peso di quando si è iscritta: è già successo altrove nel progetto.
   */
  it('⛔ le pesate si chiedono dalla più recente, e non più di `FINESTRA_MASSIMA`', async () => {
    const prisma = conPesate(RECENTI);
    await servizio(prisma).estimate('c1');
    const chiamata = (prisma.measurement.findMany as jest.Mock).mock.calls[0][0];
    expect(chiamata.orderBy.date).toBe('desc');
    expect(chiamata.take).toBe(FINESTRA_MASSIMA);
  });

  /** ⚠️ La finestra è quella dei Parametri, e si ritaglia: le pesate più vecchie non entrano. */
  it('⚠️ guarda solo le ultime `moving_average_window` pesate', async () => {
    const con100 = [{ kg: 100, giorniFa: 30 }, { kg: 100, giorniFa: 21 }, ...RECENTI];
    const est = await servizio(conPesate(con100)).estimate('c1');
    expect(est!.weightKg).toBeCloseTo(69.67, 2);
  });

  /**
   * ⚠️ **LA VIA DI RITORNO, e va tenuta ferma.** Con la finestra a 1 il servizio torna a comportarsi
   * **esattamente** come prima del 27/8: se questa correzione dovesse fare più danni che bene, si
   * spegne dai Parametri senza un rilascio. Un cambio clinico senza interruttore è un cambio che si
   * può solo subire.
   */
  it('⚠️ con la finestra a 1 torna al comportamento di prima: l\'ultima pesata', async () => {
    const est = await servizio(conPesate(RECENTI), 1).estimate('c1');
    expect(est!.weightKg).toBe(69);
  });

  /**
   * ⛔ **UNA MEDIA DI DATI VECCHI NON È IL PESO DI ADESSO.** La cliente in monitoraggio si pesa a
   * 70,2 / 69,8 tre mesi fa, sospende, torna oggi a 76: la media direbbe 72,0 — quattro chili sotto
   * il vero — e le metterebbe in tavola cento kcal al giorno di troppo. È esattamente la cliente per
   * cui esiste il kit di rientro.
   */
  it('⛔ le pesate più vecchie di novanta giorni non contano', async () => {
    const rientrata = [{ kg: 70.2, giorniFa: 100 }, { kg: 69.8, giorniFa: 95 }, { kg: 76, giorniFa: 0 }];
    const est = await servizio(conPesate(rientrata)).estimate('c1');
    expect(est!.weightKg).toBe(76);
  });

  /**
   * ⚠️ E se **nessuna** pesata è recente si prende l'ultima, non la media delle vecchie: di due cose
   * sbagliate, un dato vecchio è meno sbagliato della media di più dati vecchi.
   */
  it('⚠️ se sono tutte vecchie vale l\'ultima, non la loro media', async () => {
    const ferma = [{ kg: 90, giorniFa: 400 }, { kg: 84, giorniFa: 380 }];
    const est = await servizio(conPesate(ferma)).estimate('c1');
    expect(est!.weightKg).toBe(84);
  });
});

/**
 * ⛔ **IL PESO ENTRA DUE VOLTE, E LE DUE ENTRATE TIRANO IN DIREZIONI OPPOSTE** — trovato in
 * revisione il 27/8, dopo che la prima stesura di questa consegna aveva scritto il contrario.
 *
 *   TDEE    = (10·P + …) · PAL          →  ∂/∂P = +10·PAL
 *   deficit = (P − obiettivo)·7700/sett →  ∂/∂P = −1100/settimane
 *
 * Nel regime più comune — dimagrimento con obiettivo e data — **domina il secondo**: vederla più
 * pesante vuol dire darle **meno** calorie. Questo test tiene fermo il segno, perché è una
 * conseguenza clinica e non un dettaglio: se un giorno cambia, qualcuno deve accorgersene qui.
 */
describe('⛔ il peso entra nel BMR e nel ritmo di calo, e col segno che sorprende', () => {
  const PESI = [{ kg: 90, giorniFa: 14 }, { kg: 90, giorniFa: 7 }, { kg: 89, giorniFa: 0 }];
  const OBIETTIVO = { targetWeightKg: 80, targetDate: new Date(Date.now() + 280 * GIORNO) };
  const inCalo = { objective: 'dimagrimento' };

  it('⛔ con un obiettivo, la media PIÙ PESANTE dà MENO calorie dell\'ultima pesata', async () => {
    const prisma = conPesate(PESI, inCalo, OBIETTIVO);
    const conMedia = await servizio(prisma).estimate('c1');
    const conUltima = await servizio(prisma).estimate('c1', { pesoKg: 89 });
    expect(conMedia!.weightKg).toBeCloseTo(89.67, 2);
    // ⚠️ La media la vede più pesante (89,67 > 89) e il target SCENDE: è il termine del ritmo di
    // calo che domina quello del metabolismo basale.
    expect(conMedia!.target).toBeLessThan(conUltima!.target);
  });

  /** ⚠️ E in mantenimento — dove il deficit non c'è — il segno si ribalta: più pesante, più calorie. */
  it('⚠️ in mantenimento invece la media più pesante dà PIÙ calorie', async () => {
    const prisma = conPesate(PESI);
    const conMedia = await servizio(prisma).estimate('c1');
    const conUltima = await servizio(prisma).estimate('c1', { pesoKg: 89 });
    expect(conMedia!.target).toBeGreaterThan(conUltima!.target);
  });
});

describe('⚠️ i ripieghi, nell\'ordine', () => {
  it('⚠️ senza nessuna pesata usa il peso di partenza del profilo', async () => {
    const est = await servizio(conPesate([])).estimate('c1');
    expect(est!.weightKg).toBe(80);
  });

  /**
   * ⛔ **E senza nemmeno quello non si stima niente.** Meglio «non lo so» che un fabbisogno costruito
   * su un peso inventato: da questo numero escono le calorie di una persona.
   */
  it('⛔ senza pesate e senza peso di partenza non si stima', async () => {
    const est = await servizio(conPesate([], { startWeightKg: null })).estimate('c1');
    expect(est).toBeNull();
  });

  it('⚠️ senza i dati della formula non si stima', async () => {
    const est = await servizio(conPesate([{ kg: 70, giorniFa: 0 }], { heightCm: null })).estimate('c1');
    expect(est).toBeNull();
  });
});

/**
 * ⛔ **«STO SIMULANDO IL DEFICIT» NON È «MI È ARRIVATO UN OGGETTO»** — il difetto trovato in
 * revisione, e il più insidioso della consegna.
 *
 * Il codice diceva `simulazione ? … : …`, cioè guardava il **puntatore**: bastava passare
 * `{ pesoKg }` — che del deficit non dice niente — perché il deficit scritto a mano dal
 * nutrizionista sparisse in silenzio. Ci è inciampata la diagnostica di questa stessa consegna, che
 * stampava «il target di ieri» **senza la prescrizione clinica**, sbagliando per eccesso e proprio
 * sulle clienti seguite di persona.
 */
describe('⛔ chiedere «con quale peso sarebbe uscito» non spegne la prescrizione', () => {
  const CON_DEFICIT = { objective: 'dimagrimento', kcalDeficitOverride: 400 };

  it('⛔ `pesoKg` da solo lascia in piedi il deficit imposto dal nutrizionista', async () => {
    const prisma = conPesate([{ kg: 70, giorniFa: 0 }], CON_DEFICIT);
    const est = await servizio(prisma).estimate('c1', { pesoKg: 69 });
    expect(est!.weightKg).toBe(69);
    expect(est!.fonteDeficit).toBe('imposto');
    expect(est!.deficit).toBe(400);
  });

  /** ⚠️ Mentre chi simula **il deficit** continua a vedere quello che ha chiesto, non quello scritto. */
  it('⚠️ simulare il deficit invece lo sostituisce, come prima', async () => {
    const prisma = conPesate([{ kg: 70, giorniFa: 0 }], CON_DEFICIT);
    const est = await servizio(prisma).estimate('c1', { deficitImposto: 100 });
    expect(est!.deficit).toBe(100);
  });
});
