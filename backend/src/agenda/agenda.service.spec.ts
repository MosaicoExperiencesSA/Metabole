/**
 * §16.7 — le tre regole dell'agenda, quelle in cui un errore si vede solo quando una persona si
 * presenta (o non si presenta) a una visita.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { aGiorno } from '../common/date-only';
import { AgendaService } from './agenda.service';
import { istanteRomano } from './settimana-tipo';

const LUNEDI = 1;

async function creaServizio(tocca?: (prisma: any) => void) {
  const prisma: any = {
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-n', displayName: 'Dr.ssa Rossi' }) },
    visitSlot: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'slot-1', ...data })),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    staffTimeOff: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'ferie-1', ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    visit: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  if (tocca) tocca(prisma);
  const moduleRef = await Test.createTestingModule({
    providers: [
      AgendaService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
    ],
  }).compile();
  return { service: moduleRef.get(AgendaService) as AgendaService, prisma };
}

/**
 * ⛔ **UNA DATA CHE VUOL DIRE «FRA N GIORNI» NON SI SCRIVE A MANO** — 24/8.
 *
 * Il test «il controllo arriva fino a SERA dell'ultimo giorno» chiedeva le ferie dal `2026-09-10` al
 * `2026-09-20`: due date scritte a mano per dire «un periodo nel futuro». Dal **1 ottobre** quel
 * periodo è nel passato, `creaFerie` lo rifiuta con «Quel periodo è già passato», e il test diventa
 * rosso **per sempre** — misurato con `ORA_FINTA=2026-10-01T10:00:00.000Z npm run test:notte`, e
 * identico a novembre, dicembre e marzo. Non è il caso limite di una data: è la data scritta a mano.
 * ⚠️ Una CI rossa per sempre è una CI che si smette di guardare, e allora il primo difetto vero
 * arriva in produzione in mezzo al rumore. Stessa famiglia di `coach.service.spec.ts` (voce
 * `test-che-scadono-il-2-settembre`).
 *
 * ⚠️ E il giorno si conta **alla stessa porta del codice**: `aGiorno(new Date())` è il giorno di
 * Roma, cioè quello che `creaFerie` legge con `toDateOnly()` per decidere se un periodo è passato.
 * La versione di prima faceva `new Date().setDate(+n)` e poi `toISOString()`, cioè prendeva il
 * giorno **UTC**: fra la mezzanotte e le 02:00 italiane rispondeva ieri, ed è la stessa famiglia di
 * difetti che `src/common/date-only.ts` esiste per chiudere.
 *
 * ⚠️ L'aritmetica è in millisecondi su una mezzanotte UTC, non `setDate`: `setDate` lavora nel fuso
 * del processo e conserva l'ora di parete, e un giorno di cambio d'ora non dura 24 ore. ⚠️ Lo scarto
 * si vede **in primavera**, non in autunno: partendo da una mezzanotte UTC (le 01:00/02:00 a Roma)
 * è l'ora che salta in avanti a cadere dentro il buco. Misurato il 24/8: con `TZ=Europe/Rome` le
 * uniche date con scarto sono il 28/3/2027 e il 26/3/2028; in ottobre nessuna.
 */
const fra = (giorni: number) =>
  new Date(aGiorno(new Date()).getTime() + giorni * 86_400_000).toISOString().slice(0, 10);

describe('AgendaService — la settimana tipo', () => {
  it('scrive lo slot con gli orari in MINUTI: 9:00–10:00 diventa 540–600', async () => {
    const { service, prisma } = await creaServizio();
    await service.creaSlot('u-n', { inizio: '09:00', fine: '10:00', ripete: true, weekday: LUNEDI });
    expect(prisma.visitSlot.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ startMin: 540, endMin: 600, weekday: LUNEDI, repeats: true, date: null }),
    );
  });

  it('l\'esempio di Simone si scrive tutto: 9–10 e poi 10:05–11:10', async () => {
    const { service, prisma } = await creaServizio();
    await service.creaSlot('u-n', { inizio: '09:00', fine: '10:00', ripete: true, weekday: LUNEDI });
    prisma.visitSlot.findMany.mockResolvedValue([
      { id: 'slot-1', nutritionistId: 'staff-n', weekday: LUNEDI, date: null, startMin: 540, endMin: 600, repeats: true, type: 'in_person', active: true },
    ]);
    await expect(
      service.creaSlot('u-n', { inizio: '10:05', fine: '11:10', ripete: true, weekday: LUNEDI }),
    ).resolves.toBeDefined();
  });

  it('⚠️ uno slot che si accavalla NON nasce, e l\'errore dice con quale', async () => {
    const { service, prisma } = await creaServizio((p) => {
      p.visitSlot.findMany.mockResolvedValue([
        { id: 'slot-1', nutritionistId: 'staff-n', weekday: LUNEDI, date: null, startMin: 540, endMin: 600, repeats: true, type: 'in_person', active: true },
      ]);
    });
    await expect(
      service.creaSlot('u-n', { inizio: '09:30', fine: '10:30', ripete: true, weekday: LUNEDI }),
    ).rejects.toThrow(/si accavalla con 09:00–10:00/);
    expect(prisma.visitSlot.create).not.toHaveBeenCalled();
  });

  it('due orari attaccati non si accavallano: 9–10 e 10–11 si scrivono tutti e due', async () => {
    const { service } = await creaServizio((p) => {
      p.visitSlot.findMany.mockResolvedValue([
        { id: 'slot-1', nutritionistId: 'staff-n', weekday: LUNEDI, date: null, startMin: 540, endMin: 600, repeats: true, type: 'in_person', active: true },
      ]);
    });
    await expect(service.creaSlot('u-n', { inizio: '10:00', fine: '11:00', ripete: true, weekday: LUNEDI })).resolves.toBeDefined();
  });

  it('un orario scritto male non arriva al database', async () => {
    const { service, prisma } = await creaServizio();
    await expect(service.creaSlot('u-n', { inizio: '10:00', fine: '09:00', ripete: true, weekday: LUNEDI })).rejects.toThrow(/dopo/);
    await expect(service.creaSlot('u-n', { inizio: 'mattina', fine: '10:00', ripete: true, weekday: LUNEDI })).rejects.toThrow(/09:30/);
    await expect(service.creaSlot('u-n', { inizio: '09:00', fine: '10:00', ripete: true, weekday: null })).rejects.toThrow(/giorno della settimana/);
    expect(prisma.visitSlot.create).not.toHaveBeenCalled();
  });

  it('una giornata straordinaria nel passato non si crea: nessuno potrebbe prenotarla', async () => {
    const { service } = await creaServizio();
    await expect(
      service.creaSlot('u-n', { inizio: '09:00', fine: '10:00', ripete: false, data: fra(-3) }),
    ).rejects.toThrow(/già passata/);
  });

  it('chi non ha una scheda staff non ha un\'agenda', async () => {
    const { service } = await creaServizio((p) => p.staff.findUnique.mockResolvedValue(null));
    await expect(service.miaSettimana('u-x')).rejects.toThrow(/scheda staff/);
  });
});

describe('AgendaService — ritirare un orario', () => {
  const slot = {
    id: 'slot-1', nutritionistId: 'staff-n', weekday: LUNEDI, date: null,
    startMin: 540, endMin: 600, repeats: true, type: 'in_person', active: true,
  };

  it('senza appuntamenti si cancella davvero', async () => {
    const { service, prisma } = await creaServizio((p) => {
      p.visitSlot.findUnique.mockResolvedValue(slot);
      p.visit.count.mockResolvedValue(0);
    });
    const esito = await service.eliminaSlot('u-n', 'slot-1');
    expect(esito.disattivato).toBe(false);
    expect(prisma.visitSlot.delete).toHaveBeenCalled();
  });

  it('⚠️ con appuntamenti presi si DISATTIVA, e gli appuntamenti restano', async () => {
    const { service, prisma } = await creaServizio((p) => {
      p.visitSlot.findUnique.mockResolvedValue(slot);
      p.visit.count.mockResolvedValue(2);
    });
    const esito = await service.eliminaSlot('u-n', 'slot-1');
    expect(esito.disattivato).toBe(true);
    expect(prisma.visitSlot.delete).not.toHaveBeenCalled();
    expect(prisma.visitSlot.update).toHaveBeenCalledWith({ where: { id: 'slot-1' }, data: { active: false } });
    expect(esito.messaggio).toContain('2 appuntamenti');
  });

  it('l\'orario di un\'altra persona non si tocca', async () => {
    const { service } = await creaServizio((p) => {
      p.visitSlot.findUnique.mockResolvedValue({ ...slot, nutritionistId: 'staff-altro' });
    });
    await expect(service.eliminaSlot('u-n', 'slot-1')).rejects.toThrow(/un'altra persona/);
  });
});

describe('AgendaService — le ferie', () => {
  it('un periodo libero si chiude', async () => {
    const { service, prisma } = await creaServizio();
    await service.creaFerie('u-n', { dal: fra(10), al: fra(20), motivo: 'Ferie' });
    expect(prisma.staffTimeOff.create).toHaveBeenCalled();
  });

  it('⚠️ un periodo CON appuntamenti non si chiude, e l\'errore dice quali', async () => {
    // La decisione del 12/8: nessuna cliente perde una visita a sua insaputa, e a spostarla è chi
    // sa chi sono quelle pazienti.
    const { service, prisma } = await creaServizio((p) => {
      p.visit.findMany.mockResolvedValue([
        { id: 'v1', datetime: new Date('2026-08-18T08:00:00Z'), client: { firstName: 'Patrizia', lastName: 'B.', email: 'p@x.it' } },
      ]);
    });
    await expect(service.creaFerie('u-n', { dal: fra(10), al: fra(20) })).rejects.toThrow(/Patrizia/);
    await expect(service.creaFerie('u-n', { dal: fra(10), al: fra(20) })).rejects.toThrow(/Spostali o annullali/);
    expect(prisma.staffTimeOff.create).not.toHaveBeenCalled();
  });

  it('⚠️ il controllo arriva fino a SERA dell\'ultimo giorno', async () => {
    // Fermarsi alla mezzanotte di `al` vorrebbe dire non vedere l'appuntamento delle 18 dell'ultimo
    // giorno, cioè chiudere per ferie proprio il giorno che aveva un appuntamento.
    const { service, prisma } = await creaServizio();
    const [ilGiornoPrima, dal, al, ilGiornoDopo] = [fra(19), fra(20), fra(30), fra(31)];
    await service.creaFerie('u-n', { dal, al });
    const where = prisma.visit.findMany.mock.calls[0][0].where;
    /**
     * ⚠️ **Anche il confine di SINISTRA, e non era coperto** — trovato il 24/8 rompendo apposta il
     * servizio: spostando `gte` da `dal` ad `al` questo test restava **verde**. Cioè il periodo
     * cercato si sarebbe ristretto all'ultimo giorno e le ferie si sarebbero chiuse sopra tutti gli
     * appuntamenti dei giorni in mezzo, senza che niente lo dicesse.
     */
    expect(istanteRomano(dal, 0).getTime()).toBeGreaterThanOrEqual(where.datetime.gte.getTime());
    expect(istanteRomano(ilGiornoPrima, 18 * 60).getTime()).toBeLessThan(where.datetime.gte.getTime());
    // Un appuntamento alle 18 dell'ULTIMO giorno deve cadere dentro la finestra cercata.
    const leSeiDiSera = istanteRomano(al, 18 * 60);
    expect(leSeiDiSera.getTime()).toBeGreaterThanOrEqual(where.datetime.gte.getTime());
    expect(leSeiDiSera.getTime()).toBeLessThan(where.datetime.lt.getTime());
    // E uno del giorno DOPO la fine no: il confine è la mezzanotte romana del giorno successivo.
    expect(istanteRomano(ilGiornoDopo, 9 * 60).getTime()).toBeGreaterThanOrEqual(where.datetime.lt.getTime());
  });

  it('le date al contrario, o un periodo già passato, non si salvano', async () => {
    const { service } = await creaServizio();
    await expect(service.creaFerie('u-n', { dal: fra(20), al: fra(10) })).rejects.toThrow(/prima/);
    await expect(service.creaFerie('u-n', { dal: fra(-30), al: fra(-20) })).rejects.toThrow(/già passato/);
  });
});
