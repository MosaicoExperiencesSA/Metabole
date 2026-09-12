import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DiscountsService } from '../commerce/discounts.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { LIFECYCLE_CATALOG, LifecycleService } from './lifecycle.service';

/**
 * ⛔ **IL RICHIAMO RICORRENTE, DALLO SCAN — cioè da dove parte davvero.**
 *
 * `richiamo-ricorrente.spec.ts` prova il modulo puro e l'interruttore, e li prova bene: il
 * mutation testing uccide tutte le mutazioni su `giriDelRichiamo`, `giorniIndietro` e
 * `chiaveRichiamo`. Ma il modulo puro **nessuno lo eseguiva**: scambiando i due argomenti
 * (`giriDelRichiamo(tetto, cadenza)` → sessanta email a sei giorni di distanza), fissando il giro a
 * `1` (una email sola in tutto, per sempre) o forzando il tetto a zero (funzione morta), restava
 * tutto verde. Cioè: il modulo era provato, il fatto che qualcuno lo usasse — e lo usasse giusto —
 * no. Questo file chiude quel buco.
 */
describe('Richiamo ricorrente — lo scan', () => {
  const IL_PIANO = 'sub-finito';

  /**
   * ⚠️ **Il finto FILTRA COME IL DATABASE VERO** — sullo stato, sul prezzo del piano e sulla
   * finestra di `endDate`. È la parte che fa la differenza: un finto che ignora il `where`
   * risponde uguale a domande diverse, e proprio qui il difetto peggiore era **nel `where`**
   * (`status: 'expired'`, che i piani a pagamento non raggiungono mai).
   */
  function fintoPrisma(righe: {
    id: string; clientId: string; status: string; priceCents: number; endDateGiorniFa: number;
  }[]) {
    const inviate: { userId: string; dedupeKey: string }[] = [];
    const finestreLette: { gte: Date; lt: Date }[] = [];

    const subscription = {
      findMany: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = (args?.where ?? {}) as Record<string, never>;
        const range = w.endDate as { gte: Date; lt: Date } | undefined;
        if (range) finestreLette.push(range);
        const stati = ((w.status as { in?: string[] } | undefined)?.in) ?? null;
        const prezzoMin = ((w.plan as { priceCents?: { gt?: number } } | undefined)?.priceCents?.gt) ?? -1;
        return righe
          .filter((r) => (stati ? stati.includes(r.status) : true))
          .filter((r) => r.priceCents > prezzoMin)
          .filter((r) => {
            if (!range) return true;
            const fine = new Date(Date.now() - r.endDateGiorniFa * 86_400_000);
            return fine >= range.gte && fine < range.lt;
          })
          .map((r) => ({
            id: r.id,
            clientId: r.clientId,
            endDate: new Date(Date.now() - r.endDateGiorniFa * 86_400_000),
            client: { email: 'ex@test.it', firstName: 'Giulia', deletedAt: null, clientProfile: { name: 'Giulia', assignedCoach: { displayName: 'Marta' } } },
          }));
      }),
      // Nessun altro piano: né in ballo, né più recente.
      findFirst: jest.fn().mockResolvedValue(null),
    };

    const prisma = {
      lifecycleSettings: {
        findUnique: jest.fn().mockResolvedValue({
          enabled: true,
          // Tutti gli altri inneschi SPENTI: così l'unico blocco che gira è quello in prova.
          triggers: { ...Object.fromEntries(LIFECYCLE_CATALOG.map((t) => [t.key, false])), wb_ricorrente: true },
          lastRunAt: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      lifecycleEmail: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: { userId: string; dedupeKey: string } }) => {
          inviate.push({ userId: data.userId, dedupeKey: data.dedupeKey });
          return data;
        }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      emailTemplate: { findUnique: jest.fn().mockResolvedValue({ key: 'wb_ricorrente', active: true, subject: 'Oggetto', bodyHtml: 'Ciao{{nome}}, {{coach}} {{link}} {{link_preferenze}}' }) },
      marketingOptOut: { findUnique: jest.fn().mockResolvedValue(null) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ notificationPrefs: null }) },
      crmRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      // La domanda «la stiamo ancora seguendo?»: nessun piano, nessun monitoraggio omaggio.
      monitoringPeriod: { findFirst: jest.fn().mockResolvedValue(null) },
      subscription,
    };
    return { prisma, inviate, finestreLette, subscription };
  }

  function servizio(prisma: unknown, parametri: Record<string, number> = {}) {
    const mail = { send: jest.fn().mockResolvedValue(true) };
    const configParams = {
      getNumber: jest.fn((k: string, d?: number) => Promise.resolve(k in parametri ? parametri[k] : d ?? 0)),
      getString: jest.fn((_k: string, d?: string) => Promise.resolve(d)),
    };
    const svc = new LifecycleService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
      { log: jest.fn() } as unknown as AuditService,
      { get: jest.fn((k: string) => (k === 'JWT_ACCESS_SECRET' ? 'segreto-di-prova' : undefined)) } as unknown as ConfigService,
      {} as DiscountsService,
      configParams as unknown as ConfigParamsService,
    );
    return { svc, mail };
  }

  const giorniIndietroDi = (r: { gte: Date }) => Math.round((Date.now() - r.gte.getTime()) / 86_400_000);

  /**
   * ⛔ **IL DIFETTO PIÙ GROSSO DELLA PRIMA STESURA, e questo caso è la sua sentinella.**
   *
   * La query filtrava `status: 'expired'`. In tutto il backend `expired` su `Subscription` lo
   * scrivono tre posti e nessuno copre il caso normale: le prove gratuite, il webhook Stripe di
   * abbonamento cancellato, e un'altra tabella. **Un piano a pagamento arrivato alla fine resta
   * `active` con `endDate` passata.** Il richiamo non avrebbe trovato quasi nessuno: staccato
   * tutto, e niente in cambio.
   */
  it('⛔ un piano a pagamento finito è rimasto `active`: il richiamo lo trova lo stesso', async () => {
    const { prisma, inviate } = fintoPrisma([
      { id: IL_PIANO, clientId: 'u1', status: 'active', priceCents: 12900, endDateGiorniFa: 60 },
    ]);
    await servizio(prisma).svc.tick('manual');
    expect(inviate.map((i) => i.dedupeKey)).toEqual(['wb_ricorrente:sub-finito:1']);
  });

  it('una prova gratuita finita lo stesso giorno non riceve niente', async () => {
    const { prisma, inviate } = fintoPrisma([
      { id: 'prova', clientId: 'u1', status: 'expired', priceCents: 0, endDateGiorniFa: 60 },
    ]);
    await servizio(prisma).svc.tick('manual');
    expect(inviate).toEqual([]);
  });

  /**
   * ⛔ **I GIRI SONO DAVVERO SEI, DAVVERO A SESSANTA GIORNI L'UNO DALL'ALTRO.**
   *
   * Le mutazioni che questo caso uccide: `giriDelRichiamo(tetto, cadenza)` con gli argomenti
   * scambiati (sessanta giri a sei giorni), `giorniIndietro(1, cadenza)` fisso (sei letture dello
   * stesso giorno), il tetto forzato a zero (funzione morta).
   */
  it('⛔ sei finestre, distanti due mesi: 60, 120, 180, 240, 300, 360 giorni', async () => {
    const { prisma, finestreLette } = fintoPrisma([]);
    await servizio(prisma).svc.tick('manual');
    expect(finestreLette.map(giorniIndietroDi)).toEqual([60, 120, 180, 240, 300, 360]);
  });

  it('la cadenza e il tetto vengono dai parametri, non dal codice', async () => {
    const { prisma, finestreLette } = fintoPrisma([]);
    await servizio(prisma, { winback_ricorrente_giorni: 30, winback_ricorrente_max: 2 }).svc.tick('manual');
    expect(finestreLette.map(giorniIndietroDi)).toEqual([30, 60]);
  });

  /**
   * ⛔ **DUE PASSAGGI, DUE CHIAVI.** `lifecycle_email` è unica su (utente, chiave): con una chiave
   * che non porta il numero del giro, il secondo richiamo risulterebbe già inviato e ne partirebbe
   * **uno solo in tutto** — invisibile per due mesi.
   */
  it('⛔ la stessa cliente al primo e al terzo giro: due chiavi diverse', async () => {
    const { prisma, inviate } = fintoPrisma([
      { id: IL_PIANO, clientId: 'u1', status: 'active', priceCents: 12900, endDateGiorniFa: 180 },
    ]);
    await servizio(prisma).svc.tick('manual');
    expect(inviate.map((i) => i.dedupeKey)).toEqual(['wb_ricorrente:sub-finito:3']);
  });

  /** ⚠️ Controprova dell'interruttore: spento, non si legge nemmeno il database. */
  it('⚠️ spento non manda niente e non legge niente', async () => {
    const { prisma, inviate, subscription } = fintoPrisma([
      { id: IL_PIANO, clientId: 'u1', status: 'active', priceCents: 12900, endDateGiorniFa: 60 },
    ]);
    (prisma.lifecycleSettings.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
      triggers: Object.fromEntries(LIFECYCLE_CATALOG.map((t) => [t.key, false])),
      lastRunAt: null,
    });
    await servizio(prisma).svc.tick('manual');
    expect(inviate).toEqual([]);
    expect(subscription.findMany).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **Se le stiamo ancora dando qualcosa, il richiamo è fuori luogo** — ed è la stessa domanda
   * che spegne le notifiche, non un controllo suo. Qui il monitoraggio **omaggio**, che non è un
   * abbonamento: guardando i soli abbonamenti risulterebbe «senza piano» mentre riceve i menu.
   */
  it('⚠️ nel monitoraggio omaggio non le si scrive', async () => {
    const { prisma, inviate } = fintoPrisma([
      { id: IL_PIANO, clientId: 'u1', status: 'active', priceCents: 12900, endDateGiorniFa: 60 },
    ]);
    (prisma.monitoringPeriod.findFirst as jest.Mock).mockResolvedValue({ id: 'mon-1' });
    await servizio(prisma).svc.tick('manual');
    expect(inviate).toEqual([]);
  });

  /** ⚠️ E la coach riceve copia: è la cadenza che Simone ha chiesto per lei. */
  it('⚠️ la coach riceve copia di ogni richiamo', async () => {
    const { prisma } = fintoPrisma([
      { id: IL_PIANO, clientId: 'u1', status: 'active', priceCents: 12900, endDateGiorniFa: 60 },
    ]);
    const { svc, mail } = servizio(prisma);
    await svc.tick('manual');
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].copiaCoach).toBe(true);
  });
});
