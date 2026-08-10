import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineService } from './pipeline.service';

describe('PipelineService (stati pipeline + board)', () => {
  let service: PipelineService;
  let prisma: any;

  const stageRows = [
    { key: 'lead_in', label: 'Nuovo contatto', color: '#7c8c88', order: 0, isSystem: true },
    { key: 'worked', label: 'Lavorato', color: '#3a6ea5', order: 1, isSystem: false },
    { key: 'paid', label: 'Pagato', color: '#0e7c66', order: 2, isSystem: true },
  ];

  beforeEach(async () => {
    prisma = {
      pipelineStage: {
        findMany: jest.fn().mockResolvedValue(stageRows),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...stageRows[0], key: where.key, ...data })),
        delete: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { order: 2 } }),
      },
      crmRecord: {
        /**
         * Dall'11/8 la board interroga UNO STATO PER VOLTA (prima: 500 schede in tutto, poi smistate —
         * e con le liste importate le clienti vere cadevano fuori dalla finestra). Il finto Prisma
         * risponde in base al `where.stage`, altrimenti la stessa scheda comparirebbe in ogni colonna.
         */
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where?.stage === 'worked'
              ? [
                  {
                    id: 'r1',
                    stage: 'worked',
                    name: null,
                    email: 'a@b.it',
                    valueCents: 29700,
                    stageDates: { worked: { at: new Date(Date.now() - 3 * 86_400_000).toISOString() } },
                    owner: { displayName: 'Marta' },
                    client: { email: 'giulia@test.it', clientProfile: { name: 'Giulia', assignedCoach: { displayName: 'Marta Coach' } } },
                  },
                ]
              : [],
          ),
        ),
        /** I conteggi delle colonne vengono da qui, non da quante schede sono state caricate. */
        groupBy: jest.fn().mockResolvedValue([
          { stage: 'worked', _count: { _all: 1 } },
          { stage: 'lead_in', _count: { _all: 485 } },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      // La board mostra la scadenza più vicina per scheda: senza questo modello nel finto
      // Prisma la chiamata esplode.
      crmReminder: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(PipelineService);
  });

  it('board: colonne per stato + schede con nome, coach e giorni nello stato', async () => {
    const board = await service.board();
    expect(board.stages).toHaveLength(3);
    expect(board.cards.worked).toHaveLength(1);
    expect(board.cards.lead_in).toEqual([]);
    const card = board.cards.worked[0];
    expect(card.name).toBe('Giulia');
    expect(card.coach).toBe('Marta Coach');
    expect(card.daysInStage).toBe(3);
  });

  /**
   * IL CONTEGGIO DELLA COLONNA NON È «QUANTE NE HO DISEGNATE» (segnalazione dell'11/8: «perché non
   * c'è più Patricia?»). La board caricava 500 schede in tutto e contava quelle: con 485 lead in
   * «Nuovo contatto», la colonna «Acquisito» diceva 1 mentre nel database ce n'erano due. Un numero
   * sbagliato è peggio di un elenco incompleto, perché toglie anche il sospetto.
   */
  it('i conteggi delle colonne vengono dal database, non dalle schede caricate', async () => {
    const board = await service.board();
    // Nel finto Prisma «Nuovo contatto» ha 485 schede e ne vengono caricate zero.
    expect(board.cards.lead_in).toHaveLength(0);
    expect(board.totali?.lead_in).toBe(485);
    expect(board.totali?.worked).toBe(1);
    // Uno stato senza righe nel groupBy vale zero, non «assente».
    expect(board.totali?.paid).toBe(0);
    // E il totale in cima è la somma vera, non le schede caricate.
    expect(board.total).toBe(486);
  });

  it('ogni colonna si carica per conto suo, con un tetto per colonna', async () => {
    await service.board();
    const chiamate = prisma.crmRecord.findMany.mock.calls.map((c: any) => c[0]);
    // Una query per stato (più una per le schede in stati non più esistenti).
    const statiChiesti = chiamate.map((c: any) => c.where?.stage).filter((x: any) => typeof x === 'string');
    expect(statiChiesti).toEqual(['lead_in', 'worked', 'paid']);
    // E ognuna con il suo tetto: nessuna query senza `take` su tutto il CRM.
    expect(chiamate.every((c: any) => typeof c.take === 'number')).toBe(true);
  });

  it('createStage: genera la chiave dallo slug e la accoda in fondo', async () => {
    const created = await service.createStage({ label: 'In pausa' }, 'admin-1');
    expect(created.key).toBe('in_pausa');
    expect(created.order).toBe(3);
  });

  it('deleteStage: rifiuta uno stato di sistema', async () => {
    prisma.pipelineStage.findUnique.mockResolvedValue({ key: 'paid', isSystem: true });
    await expect(service.deleteStage('paid', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('deleteStage: rifiuta uno stato con clienti dentro', async () => {
    prisma.pipelineStage.findUnique.mockResolvedValue({ key: 'worked', isSystem: false });
    prisma.crmRecord.count.mockResolvedValue(4);
    await expect(service.deleteStage('worked', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('deleteStage: elimina uno stato vuoto e non di sistema', async () => {
    prisma.pipelineStage.findUnique.mockResolvedValue({ key: 'worked', isSystem: false });
    prisma.crmRecord.count.mockResolvedValue(0);
    const res = await service.deleteStage('worked', 'admin-1');
    expect(res.removed).toBe('worked');
    expect(prisma.pipelineStage.delete).toHaveBeenCalled();
  });
});
