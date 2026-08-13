import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegistroVeraService } from './registro.service';

const makeAudit = () => ({ log: jest.fn().mockResolvedValue(undefined) }) as unknown as AuditService;
const make = (prisma: Record<string, unknown>, audit = makeAudit()) =>
  new RegistroVeraService(prisma as unknown as PrismaService, audit);

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

describe('RegistroVeraService.scrivi', () => {
  it('conserva la frase originale per intero: senza, non esiste collaudo', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1' });
    const service = make({ azioneVera: { create } });
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'a Simone Rossi niente formaggi molli, solo il grana',
      azione: 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: 'c1',
      soggettoNome: 'Simone Rossi',
    });
    expect(create.mock.calls[0][0].data.frase).toBe('a Simone Rossi niente formaggi molli, solo il grana');
  });

  it('un’azione a raggio largo nasce «in_approvazione», non «attiva»', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1' });
    const service = make({ azioneVera: { create } });
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'nella mediterranea niente tonno',
      azione: 'regola_dieta',
      ambito: 'dieta',
      soggettoTipo: 'diet',
      soggettoId: 'd1',
      inApprovazione: true,
    });
    expect(create.mock.calls[0][0].data.stato).toBe('in_approvazione');
  });

  it('scrive ANCHE l’audit: registro e audit non si sostituiscono', async () => {
    const audit = makeAudit();
    const service = make({ azioneVera: { create: jest.fn().mockResolvedValue({ id: 'a1' }) } }, audit);
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'x',
      azione: 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: 'c1',
      conflittoSanitario: true,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'vera.restrizione_cliente', metadata: expect.objectContaining({ conflittoSanitario: true }) }),
    );
  });
});

describe('RegistroVeraService.menuDaRifare', () => {
  it('prende solo i giorni FUTURI che non sono stati visti', async () => {
    const findMany = jest.fn().mockResolvedValue([{ date: D('2026-08-14') }]);
    const service = make({ menuDay: { findMany } });
    const giorni = await service.menuDaRifare('c1');

    const where = findMany.mock.calls[0][0].where;
    expect(where.viewedAt).toBeNull();
    // ⚠️ `date: { gte: oggi }`: per i giorni erogati PRIMA che la colonna esistesse, `viewedAt`
    // null non vuol dire «non visto» — vuol dire «non lo so». Rifarli sarebbe cambiare sotto i
    // piedi un menu che la cliente può aver già letto e su cui ha fatto la spesa.
    expect(where.date.gte).toBeInstanceOf(Date);
    expect(giorni).toEqual(['2026-08-14']);
  });
});

describe('RegistroVeraService.annulla', () => {
  it('segna la riga annullata e dice quali menu si possono rifare', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'a1', stato: 'annullata' });
    const service = make({
      azioneVera: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', stato: 'attiva', soggettoTipo: 'user', soggettoId: 'c1', frase: 'x' }),
        update,
      },
      menuDay: { findMany: jest.fn().mockResolvedValue([{ date: D('2026-08-14') }]) },
    });
    const esito = await service.annulla('lucia', 'a1');
    expect(update.mock.calls[0][0].data.stato).toBe('annullata');
    expect(update.mock.calls[0][0].data.annullataDaId).toBe('lucia');
    expect(esito.daRifare).toEqual(['2026-08-14']);
  });

  it('annullare due volte non ricalcola niente', async () => {
    const menuFindMany = jest.fn();
    const service = make({
      azioneVera: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', stato: 'annullata', soggettoTipo: 'user', soggettoId: 'c1', frase: 'x' }),
        update: jest.fn(),
      },
      menuDay: { findMany: menuFindMany },
    });
    const esito = await service.annulla('lucia', 'a1');
    expect(esito.daRifare).toEqual([]);
    expect(menuFindMany).not.toHaveBeenCalled();
  });

  it('per una regola che non riguarda una cliente non cerca menu da rifare', async () => {
    const menuFindMany = jest.fn();
    const service = make({
      azioneVera: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', stato: 'attiva', soggettoTipo: 'diet', soggettoId: 'd1', frase: 'x' }),
        update: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
      menuDay: { findMany: menuFindMany },
    });
    await service.annulla('lucia', 'a1');
    expect(menuFindMany).not.toHaveBeenCalled();
  });
});
