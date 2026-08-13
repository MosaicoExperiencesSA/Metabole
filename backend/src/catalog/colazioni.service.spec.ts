/**
 * Le colazioni nel servizio catalogo: elenco con proposta, conferma singola e in blocco.
 * Decisione: `Decisioni_Simone_20260813.md` §12 — il tag scritto è la conferma, la proposta si
 * calcola al volo e non si salva.
 */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TAG_DOLCE, TAG_SALATO } from '../vera/colazioni';
import { CatalogService } from './catalog.service';

describe('CatalogService — colazioni dolce/salato', () => {
  let service: CatalogService;
  let prisma: any;
  let audit: any;

  const ricette = [
    { id: 'r-uova', name: 'Uova strapazzate', kcal: 220, tags: [], ingredients: [{ name: 'uova', qty: 2, unit: 'pz' }] },
    { id: 'r-marm', name: 'Fette con marmellata', kcal: 180, tags: [TAG_DOLCE], ingredients: [{ name: 'marmellata', qty: 30, unit: 'g' }] },
    { id: 'r-boh', name: 'Bowl energetica', kcal: 300, tags: ['dieta:keto'], ingredients: [{ name: 'semi di chia', qty: 10, unit: 'g' }] },
  ];

  beforeEach(async () => {
    prisma = {
      recipe: {
        findMany: jest.fn().mockResolvedValue(ricette),
        findUnique: jest.fn().mockResolvedValue(ricette[0]),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
      },
    };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  it('elencoColazioni: solo mealSlot=breakfast attive, con proposta calcolata e stato confermato', async () => {
    const r = await service.elencoColazioni();
    expect(prisma.recipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ mealSlot: 'breakfast', active: true }) }),
    );
    const uova = r.items.find((i: any) => i.id === 'r-uova')!;
    expect(uova.proposta).toBe('salato');
    expect(uova.confermato).toBeNull();
    const marm = r.items.find((i: any) => i.id === 'r-marm')!;
    expect(marm.confermato).toBe('dolce');
    expect(r.conta).toEqual({ totale: 3, confermateSalato: 0, confermateDolce: 1, proposteSalato: 1, proposteDolce: 0, senzaProposta: 1 });
  });

  it('setColazione scrive il tag senza toccare gli altri, e lascia traccia in audit', async () => {
    prisma.recipe.findUnique.mockResolvedValue(ricette[2]);
    await service.setColazione('staff-1', 'r-boh', 'salato');
    expect(prisma.recipe.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r-boh' }, data: { tags: ['dieta:keto', TAG_SALATO] } }),
    );
    expect(audit.log).toHaveBeenCalled();
  });

  it('setColazione con null toglie la classificazione', async () => {
    prisma.recipe.findUnique.mockResolvedValue(ricette[1]);
    await service.setColazione('staff-1', 'r-marm', null);
    expect(prisma.recipe.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tags: [] } }),
    );
  });

  it('setColazione rifiuta un tipo che non esiste', async () => {
    await expect(service.setColazione('staff-1', 'r-uova', 'piccante' as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confermaColazioni: in blocco, salta chi non esiste, un audit solo', async () => {
    prisma.recipe.findMany.mockResolvedValue([ricette[0], ricette[2]]);
    const esito = await service.confermaColazioni('staff-1', [
      { id: 'r-uova', tipo: 'salato' },
      { id: 'r-boh', tipo: 'salato' },
      { id: 'r-sparita', tipo: 'dolce' },
    ]);
    expect(esito).toEqual({ scritte: 2, saltate: 1 });
    expect(prisma.recipe.update).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('confermaColazioni rifiuta il blocco sopra il tetto', async () => {
    const troppe = Array.from({ length: 501 }, (_, i) => ({ id: `r-${i}`, tipo: 'dolce' as const }));
    await expect(service.confermaColazioni('staff-1', troppe)).rejects.toBeInstanceOf(BadRequestException);
  });
});
