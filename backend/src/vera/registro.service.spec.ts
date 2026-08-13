import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

describe('RegistroVeraService — la coda del capo', () => {
  const inCoda = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    stato: 'in_approvazione',
    frase: 'a tutte niente tonno',
    nutrizionistaId: 'lucia',
    azione: 'restrizione_cliente',
    ambito: 'catalogo',
    soggettoId: 'c1',
    soggettoNome: 'Giulia',
    dettaglio: { termini: ['tonno'] },
    ...over,
  });

  const conCoda = (riga: Record<string, unknown> | null, over: Record<string, unknown> = {}) => ({
    azioneVera: { findUnique: jest.fn().mockResolvedValue(riga), update: jest.fn().mockResolvedValue({ id: 'a1' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'nutritionist' }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-lucia' }) },
    clientProfile: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    ...over,
  });

  it('⚠️ una nutrizionista NON può approvare: è la riga che rende la coda una coda', async () => {
    // Senza questo controllo nel servizio, chi propone si approverebbe da solo e il passaggio dal
    // capo sarebbe un passaggio a vuoto.
    const service = make(conCoda(inCoda()));
    await expect(service.approva({ id: 'lucia', role: 'nutritionist' }, 'a1')).rejects.toThrow(ForbiddenException);
  });

  it('il capo approva, applica e la riga diventa attiva', async () => {
    const prisma = conCoda(inCoda());
    const service = make(prisma);
    const esito = await service.approva({ id: 'nocanty', role: 'head_nutritionist' }, 'a1');
    expect((prisma.azioneVera.update as jest.Mock).mock.calls[0][0].data.stato).toBe('attiva');
    expect(esito).toHaveProperty('riepilogo');
  });

  it('non si approva due volte', async () => {
    const service = make(conCoda(inCoda({ stato: 'attiva' })));
    await expect(service.approva({ id: 'nocanty', role: 'head_nutritionist' }, 'a1')).rejects.toThrow(BadRequestException);
  });

  it('respingere SENZA motivo non si può', async () => {
    // Un no senza spiegazione è la cosa che insegna a smettere di proporre.
    const service = make(conCoda(inCoda()));
    await expect(service.respingi({ id: 'nocanty', role: 'head_nutritionist' }, 'a1', '  ')).rejects.toThrow(
      /Serve un motivo/,
    );
  });

  it('il motivo del rifiuto resta scritto accanto alla proposta', async () => {
    const prisma = conCoda(inCoda());
    const service = make(prisma);
    await service.respingi({ id: 'nocanty', role: 'head_nutritionist' }, 'a1', 'il tonno serve per il ferro');
    const dati = (prisma.azioneVera.update as jest.Mock).mock.calls[0][0].data;
    expect(dati.stato).toBe('respinta');
    expect(dati.dettaglio.motivoRifiuto).toBe('il tonno serve per il ferro');
    // Il dettaglio originale non si perde: ci si aggiunge, non lo si sostituisce.
    expect(dati.dettaglio.termini).toEqual(['tonno']);
  });

  it('la coda esce in ordine di RISCHIO, non di data', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'vecchia', conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-01') },
      { id: 'sanitaria', conflittoSanitario: true, ambito: 'cliente', createdAt: D('2026-08-13') },
    ]);
    const service = make({ azioneVera: { findMany } });
    const coda = (await service.daApprovare()) as unknown as { id: string }[];
    expect(coda.map((r) => r.id)).toEqual(['sanitaria', 'vecchia']);
  });
});
