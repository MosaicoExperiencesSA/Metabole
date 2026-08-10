import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingService } from './marketing.service';

/**
 * IL FUNNEL CHE SOTTOSTIMAVA SENZA DIRLO (difetto trovato l'11/8).
 *
 * I conteggi si facevano in memoria su `take: 50_000` eventi. Gli eventi del funnel sono uno per ogni
 * prova attivata, misura inserita, offerta mandata, rinnovo: cinquantamila si raggiungono, e da quel
 * momento il pannello comincia a dire numeri più piccoli del vero — senza un avviso. Un pannello che
 * dice «1.200 prove» quando sono 3.000 è peggio di nessun pannello: su quello si prendono decisioni.
 *
 * E si rompeva dalla parte peggiore: senza `orderBy`, quali 50.000 righe arrivavano non era garantito,
 * quindi gli stessi numeri potevano **cambiare** fra due aperture della stessa pagina.
 *
 * Il primo test è quello che tiene: **conta il database**. Se qualcuno riporta il conteggio in
 * memoria, diventa rosso.
 */
describe('MarketingService.funnelOverview', () => {
  let service: MarketingService;
  let sql: string[];

  const monta = async (risposte: unknown[][]) => {
    sql = [];
    let i = 0;
    const prisma = {
      $queryRaw: (strings: TemplateStringsArray) => {
        sql.push(strings.join('?'));
        return Promise.resolve(risposte[i++] ?? []);
      },
      analyticsEvent: { findMany: jest.fn().mockResolvedValue([]) },
      crmRecord: { count: jest.fn().mockResolvedValue(0) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn().mockResolvedValue(0), getString: jest.fn().mockResolvedValue('') } },
      ],
    }).compile();
    service = moduleRef.get(MarketingService);
    return { prisma };
  };

  it('conta il DATABASE, senza limiti e senza tenere righe in memoria', async () => {
    const { prisma } = await monta([
      [{ name: 'trial_started', persone: 3000 }],
      [],
      [],
    ]);
    const out = await service.funnelOverview(30);

    // Tre GROUP BY: totale, per segmento, per canale.
    expect(sql.length).toBe(3);
    for (const q of sql) {
      expect(q).toContain('COUNT(DISTINCT');
      expect(q).toContain('GROUP BY');
      // Nessun limite: è il punto di tutta la correzione.
      expect(q).not.toContain('LIMIT');
    }
    // E soprattutto: non si leggono più le righe una per una.
    expect(prisma.analyticsEvent.findMany).not.toHaveBeenCalled();
    expect(out.events.find((e) => e.name === 'trial_started')?.total).toBe(3000);
  });

  it('gli anelli senza eventi restano a zero e nell\'ordine canonico', async () => {
    await monta([[{ name: 'trial_converted', persone: 12 }], [], []]);
    const out = await service.funnelOverview(30);
    expect(out.events[0].name).toBe('trial_started');
    expect(out.events[0].total).toBe(0);
    expect(out.events.find((e) => e.name === 'trial_converted')?.total).toBe(12);
  });

  it('segmenti e canali finiscono sull\'anello giusto', async () => {
    await monta([
      [{ name: 'trial_started', persone: 10 }, { name: 'trial_converted', persone: 4 }],
      [
        { name: 'trial_started', chiave: 'donne 35-45', persone: 7 },
        { name: 'trial_started', chiave: 'sconosciuto', persone: 3 },
        { name: 'trial_converted', chiave: 'donne 35-45', persone: 4 },
      ],
      [{ name: 'trial_started', chiave: 'instagram', persone: 6 }],
    ]);
    const out = await service.funnelOverview(30);
    const avviate = out.events.find((e) => e.name === 'trial_started')!;
    expect(avviate.bySegment).toEqual({ 'donne 35-45': 7, sconosciuto: 3 });
    expect(avviate.byChannel).toEqual({ instagram: 6 });
    expect(out.events.find((e) => e.name === 'trial_converted')!.bySegment).toEqual({ 'donne 35-45': 4 });
  });

  it('la finestra in giorni è limitata fra 1 e 365: nessuna query aperta sull\'intera tabella', async () => {
    await monta([[], [], []]);
    await expect(service.funnelOverview(100_000)).resolves.toBeTruthy();
    await expect(service.funnelOverview(-5)).resolves.toBeTruthy();
  });
});
