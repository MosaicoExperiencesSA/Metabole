/**
 * ⛔ **LA REGOLA DEL RIENTRO, PROVATA DOVE VIENE USATA.**
 *
 * I moduli puri (`signals/peso-al-rientro.ts`, `signals/quando-comincia-il-periodo.ts`) hanno le
 * loro prove. Qui si prova il **montaggio**: che il fabbisogno e il kit di rientro chiamino davvero
 * quella regola, e con gli ingredienti giusti.
 *
 * ⚠️ È la lezione del 3/9 sulla pagina Permessi: *le prove sul modulo puro non provano il
 * montaggio*. Quando una regola si sposta in un modulo, il punto che ce la porta resta scoperto — e
 * lì vivono i difetti che cambiano cosa mangia una persona.
 *
 * ## La regola, per intero
 *
 * Simone, 3/9: *«Quando uno rientra noi consideriamo sempre il peso del giorno prima dell'inizio di
 * quel momento e non dei piani precedenti»* — e, sul kit, *«Sì esatto»*: anche le porzioni partono
 * dall'ultima pesata.
 */
import { KcalNeedService } from './kcal-need.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigParamsService } from '../config-params/config-params.service';

const g = (giorno: string, kg: number) => ({ date: new Date(`${giorno}T09:00:00Z`), weightKg: kg });

/** Un profilo completo: senza, `estimate` risponde null prima di arrivare al peso. */
const PROFILO = {
  userId: 'c1', sex: 'female', age: 40, heightCm: 165,
  activityLevel: 'sedentary', lifestyle: null, goal: null,
  startWeightKg: 80, targetWeightKg: null, targetDate: null,
  deficitImposto: null, correzionePct: null,
};

function servizio(pesate: { date: Date; weightKg: number }[], pausaFinita: Date | null, _piano: Date | null = null) {
  const prisma = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ ...PROFILO }) },
    measurement: {
      // ⚠️ La query vera ordina `desc`: si rende in quell'ordine, o la prova misurerebbe un mondo
      //    più comodo di quello vero.
      findMany: jest.fn().mockResolvedValue([...pesate].sort((a, b) => b.date.getTime() - a.date.getTime())),
      findFirst: jest.fn().mockResolvedValue(pesate.length ? pesate[pesate.length - 1] : null),
    },
    event: { findMany: jest.fn().mockResolvedValue(pausaFinita ? [{ id: 'e1', endDate: pausaFinita }] : []) },
    pauseRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    kcalOverride: { findFirst: jest.fn().mockResolvedValue(null) },
    objective: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  const config = {
    getNumber: jest.fn(async (k: string, def: number) => def),
  } as unknown as ConfigParamsService;
  return new KcalNeedService(prisma, config);
}

describe('il fabbisogno al rientro', () => {
  /**
   * ⛔ **Il caso che la regola chiude, e va guardato dove si vede: con UNA o DUE pesate nuove.**
   *
   * Con tre o più, `pesoDiAdesso` prende già le ultime tre e il taglio non sposterebbe un kcal —
   * l'ha misurato una revisione avversariale, e la prima stesura di questa prova non se ne era
   * accorta. Il difetto vero è la **miscela**: due pesate del rientro più una del piano di prima.
   */
  it('⛔ con due pesate nuove non ci mescola quella del piano di prima', async () => {
    /**
     * ⛔ **I due valori nuovi sono DIVERSI, apposta.** La prima stesura usava 76 e 76: media e
     * ultima coincidevano, e una mutazione che rimetteva la regola inventata — «sotto tre pesate si
     * usa l'ultima invece della tendenza» — **sopravviveva**. Con 76 e 78 i tre numeri possibili
     * sono distinti: 77 (la media giusta), 78 (l'ultima) e 74,67 (la miscela col piano di prima).
     */
    const pesate = [g('2026-07-29', 70), g('2026-09-02', 76), g('2026-09-09', 78)];
    const conRientro = await servizio(pesate, new Date('2026-08-31T00:00:00Z')).estimate('c1');
    const senza = await servizio(pesate, null).estimate('c1');
    expect(conRientro?.weightKg).toBe(77);   // la MEDIA delle due nuove, non l'ultima
    expect(conRientro?.weightKg).not.toBe(78);
    expect(senza?.weightKg).toBeCloseTo(74.67, 1); // 70+76+78 diviso tre: il corpo di due mesi fa dentro
  });

  /** ⛔ Finché non si ripesa vale il riferimento: «il peso del giorno prima dell'inizio». */
  it('⛔ senza pesate nuove usa il peso di prima del rientro, non la media dei piani vecchi', async () => {
    const est = await servizio(
      [g('2026-07-01', 90), g('2026-07-15', 85), g('2026-07-29', 79.5)],
      new Date('2026-08-31T00:00:00Z'),
    ).estimate('c1');
    expect(est?.weightKg).toBe(79.5);
  });

  /**
   * ⛔ **La media resta una media.** Una prima stesura, sotto tre pesate dal rientro, passava
   * all'**ultima** invece che alla tendenza: una regola che Simone non ha mai detto, e che una
   * revisione avversariale ha smontato. Questa prova la tiene fuori.
   */
  it('⛔ con tre pesate nuove è la loro MEDIA, non l\'ultima', async () => {
    const est = await servizio(
      [g('2026-07-29', 70), g('2026-09-01', 86), g('2026-09-05', 85), g('2026-09-09', 84)],
      new Date('2026-08-31T00:00:00Z'),
    ).estimate('c1');
    expect(est?.weightKg).toBe(85); // media di 86, 85, 84 — non 84
  });

  /** ⚠️ E chi non ha mai sospeso si comporta esattamente come prima della regola. */
  it('⚠️ senza rientro noto niente cambia', async () => {
    const est = await servizio([g('2026-08-20', 82), g('2026-08-27', 81), g('2026-09-02', 80)], null).estimate('c1');
    expect(est?.weightKg).toBe(81);
  });

  /**
   * ⛔ **UNA SOSPENSIONE PIÙ LUNGA DELLA FINESTRA.** È il caso per cui la regola è nata, ed era
   * quello scoperto: le righe caricate sono di novanta giorni, quindi il riferimento non ci stava
   * dentro e usciva `null`. Adesso si va a prenderlo.
   */
  it('⛔ dopo cinque mesi di sospensione il riferimento si trova lo stesso', async () => {
    const est = await servizio([g('2026-03-01', 88)], new Date('2026-08-31T00:00:00Z')).estimate('c1');
    expect(est?.weightKg).toBe(88);
  });

  /**
   * ⛔ **Il salto attraverso il rientro NON ferma il fabbisogno**, ed è una scelta: la soglia è
   * clinica, la voce dice che non la scegliamo noi, e la risposta di Simone dà il riferimento e non
   * una soglia d'allarme. Una prima stesura l'aveva aggiunta; questa prova impedisce di rimetterla
   * senza deciderlo.
   */
  it('⛔ venti chili attraverso il rientro NON fermano il fabbisogno: la soglia è di Nocanty', async () => {
    const est = await servizio(
      [g('2026-08-08', 73), g('2026-09-02', 93)],
      new Date('2026-08-31T00:00:00Z'),
    ).estimate('c1');
    expect(est?.pesoIncoerente).toBeNull();
    // ⚠️ La controprova: la regola normale funziona ancora, e su una coppia ravvicinata suona.
    const vicine = await servizio([g('2026-08-28', 73), g('2026-09-02', 93)], null).estimate('c1');
    expect(vicine?.pesoIncoerente).not.toBeNull();
  });

  /**
   * ⛔ **La porta esplicita del kit di rientro.** `sullUltimaPesata` prende l'ultima anche fuori da
   * un rientro, perché lì la tendenza è vecchia **per il salto**, non per il tempo.
   */
  it('⛔ `sullUltimaPesata` prende l\'ultima, e senza quella porta esce la media', async () => {
    const pesate = [g('2026-08-20', 68.2), g('2026-08-27', 68.0), g('2026-09-02', 71.0)];
    expect((await servizio(pesate, null).estimate('c1', { sullUltimaPesata: true }))?.weightKg).toBe(71.0);
    expect((await servizio(pesate, null).estimate('c1'))?.weightKg).not.toBe(71.0);
  });

  /**
   * ⛔ **Una pausa ANNULLATA non è un rientro.** Togliendo una sospensione in corso l'evento non si
   * cancella: si accorcia a ieri, cioè da fuori somiglia a una appena finita. Senza questo, la
   * coach che corregge un proprio errore cambierebbe il fabbisogno della cliente.
   */
  it('⛔ una pausa annullata non fa scattare la regola', async () => {
    const pesate = [g('2026-07-29', 70), g('2026-09-02', 76), g('2026-09-09', 76)];
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ ...PROFILO }) },
      measurement: {
        findMany: jest.fn().mockResolvedValue([...pesate].sort((a, b) => b.date.getTime() - a.date.getTime())),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      event: { findMany: jest.fn().mockResolvedValue([{ id: 'e1', endDate: new Date('2026-08-31T00:00:00Z') }]) },
      pauseRequest: { findFirst: jest.fn().mockResolvedValue({ id: 'pr1' }) }, // annullata
      objective: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const config = { getNumber: jest.fn(async (_k: string, def: number) => def) } as unknown as ConfigParamsService;
    const est = await new KcalNeedService(prisma, config).estimate('c1');
    expect(est?.weightKg).toBe(74); // come se il rientro non ci fosse
  });
});
