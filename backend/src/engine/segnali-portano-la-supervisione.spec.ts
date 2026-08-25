/**
 * ⛔ **IL GUARDRAIL DEL MOTORE FALLISCE APERTO SE IL DATO NON ARRIVA — e nessuno se ne accorgeva.**
 *
 * Dal 25/8 `checkGuardrails` non legge più `screeningFlag` da solo ma passa da `statoSupervisione`,
 * che risponde `non_supervisionata` — cioè **nessun guardrail** — quando il profilo è `undefined`.
 * L'unico produttore di quel dato è `SignalsCollectorService`, e non aveva **nessun test**.
 *
 * ⛔ Misurato in revisione, 25/8: sostituendo `supervisione: {…}` con `supervisione: undefined` nel
 * collettore, **tutte** le 330 suite restavano verdi e `tsc` pure. Cioè il giorno in cui qualcuno
 * stringe il `select` del collettore, il motore torna a decidere in autonomia su **tutte** le
 * clienti mai valutate, e non diventa rosso niente. E il verso in cui degrada è quello sbagliato:
 * dato mancante → «non supervisionata» → cancello aperto.
 *
 * ⚠️ È lo stesso difetto di forma di sempre: *un finto che manca non fa fallire niente, fa passare
 * tutto* — e qui il finto che mancava era il test del produttore.
 */
import { EventsService } from '../calendar/events.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { SignalsCollectorService } from './signals-collector.service';

const PROFILO = {
  userId: 'c1',
  screeningFlag: true,
  idoneita: 'serve_visita',
  idoneitaVisitaEntro: new Date('2026-09-30T00:00:00Z'),
  cookingTime: null,
  work: null,
  weekdayLunch: null,
};

const crea = (profilo: Record<string, unknown> | null = PROFILO) => {
  const prisma = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue(profilo) },
    dailyCheckin: { findMany: jest.fn().mockResolvedValue([]) },
    recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
    pause: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const service = new SignalsCollectorService(
    prisma as unknown as PrismaService,
    { getProgress: jest.fn().mockResolvedValue(null) } as never,
    { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as unknown as ConfigParamsService,
    {
      hasUpcomingEvent: jest.fn().mockResolvedValue(false),
      activePausePeriod: jest.fn().mockResolvedValue(null),
    } as unknown as EventsService,
  );
  return { service, prisma };
};

describe('⛔ i segnali portano lo stato della supervisione, non solo il flag', () => {
  it('⛔ `supervisione` c’è, ed è quello che il guardrail legge', async () => {
    const { service } = crea();
    const esito = await service.collect('c1');
    expect(esito.supervisione).toEqual({
      screeningFlag: true,
      idoneita: 'serve_visita',
      idoneitaVisitaEntro: new Date('2026-09-30T00:00:00Z'),
    });
  });

  /**
   * ⛔ **Non basta che il campo ci sia: deve portare i TRE valori.** Con `idoneita` mancante una
   * cliente col via libera tornerebbe «mai valutata» e il motore resterebbe muto per sempre — che è
   * esattamente il difetto del 23/8 rimesso dentro dalla porta di servizio.
   */
  it('⛔ e porta anche `idoneita`: senza, il via libera non arriverebbe mai al motore', async () => {
    const { service } = crea({ ...PROFILO, idoneita: 'idonea', idoneitaVisitaEntro: null });
    const esito = await service.collect('c1');
    expect(esito.supervisione).toMatchObject({ idoneita: 'idonea' });
    expect(esito.screeningFlag).toBe(true);
  });

  it('⚠️ su una cliente non supervisionata i campi ci sono lo stesso, a zero', async () => {
    const { service } = crea({ ...PROFILO, screeningFlag: false, idoneita: null, idoneitaVisitaEntro: null });
    const esito = await service.collect('c1');
    expect(esito.supervisione).toEqual({ screeningFlag: false, idoneita: null, idoneitaVisitaEntro: null });
  });

  /**
   * ⚠️ **Il profilo si legge INTERO** (`findUnique` senza `select`), ed è la ragione per cui i tre
   * campi ci sono. Se un domani si stringesse il `select` «per fare meno traffico», i campi
   * sparirebbero in silenzio e il guardrail si aprirebbe: questo test lo dichiara, così chi lo
   * stringe lo fa sapendo cosa deve portarsi dietro.
   */
  it('⛔ il profilo si legge intero: stringere il select aprirebbe il guardrail', async () => {
    const { service, prisma } = crea();
    await service.collect('c1');
    const chiamata = prisma.clientProfile.findUnique.mock.calls[0][0];
    expect(chiamata.select).toBeUndefined();
  });
});
