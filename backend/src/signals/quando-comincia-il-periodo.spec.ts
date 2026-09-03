import { ilPiuRecentePassato, inizioDelPeriodoDi } from './quando-comincia-il-periodo';
import type { PrismaService } from '../prisma/prisma.service';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ADESSO = d('2026-09-03');

describe('ilPiuRecentePassato — quale dei due momenti vale', () => {
  it('⛔ il più RECENTE, non il primo: chi ha cominciato a luglio e sospeso ad agosto è ad agosto', () => {
    expect(ilPiuRecentePassato([d('2026-07-01'), d('2026-08-30')], ADESSO)).toEqual(d('2026-08-30'));
  });

  /**
   * ⛔ Una data futura butterebbe via **tutte** le pesate di adesso, lasciando il fabbisogno senza
   * dati proprio mentre serve. `planStartDate` può essere avanti: un piano che comincia lunedì.
   */
  it('⛔ una data nel FUTURO non conta', () => {
    expect(ilPiuRecentePassato([d('2026-07-01'), d('2026-12-01')], ADESSO)).toEqual(d('2026-07-01'));
    expect(ilPiuRecentePassato([d('2026-12-01')], ADESSO)).toBeNull();
  });

  it('⚠️ senza candidati validi rende null: «non lo so», e su «non lo so» non si taglia', () => {
    expect(ilPiuRecentePassato([null, undefined, new Date('boh')], ADESSO)).toBeNull();
    expect(ilPiuRecentePassato([], ADESSO)).toBeNull();
  });

  /** ⚠️ Il bordo è incluso: un piano che comincia oggi è già cominciato. */
  it('⚠️ oggi conta', () => {
    expect(ilPiuRecentePassato([ADESSO], ADESSO)).toEqual(ADESSO);
  });
});

const prismaFinto = (pausa: Date | null, annullata = false) => ({
  event: { findMany: jest.fn().mockResolvedValue(pausa ? [{ id: 'e1', endDate: pausa }] : []) },
  pauseRequest: { findFirst: jest.fn().mockResolvedValue(annullata ? { id: 'pr1' } : null) },
} as unknown as PrismaService);

describe('inizioDelPeriodoDi — SOLO un rientro da una sospensione vera', () => {
  /** ⚠️ La pausa finisce il giorno `endDate`: il periodo nuovo comincia il GIORNO DOPO. */
  it('⛔ il rientro è il giorno dopo la fine della pausa, non il giorno stesso', async () => {
    expect(await inizioDelPeriodoDi(prismaFinto(d('2026-08-31')), 'c1', ADESSO))
      .toEqual(d('2026-09-01'));
  });

  it('⚠️ senza sospensioni rende null: chi non ha mai sospeso non ha un «rientro»', async () => {
    expect(await inizioDelPeriodoDi(prismaFinto(null), 'c1', ADESSO)).toBeNull();
  });

  /**
   * ⛔ **Una pausa ANNULLATA non è una pausa finita.** Togliendo una sospensione in corso l'evento
   * non si cancella: si **accorcia a ieri**, cioè cade esattamente nella finestra di chi cerca
   * quelle appena finite. Senza questo controllo la coach che corregge un proprio errore
   * cambierebbe il fabbisogno della cliente — e il rimedio diventerebbe un secondo sbaglio.
   * Stessa guardia di `pause.service.ts`, stessa ragione.
   */
  it('⛔ una pausa annullata non conta', async () => {
    expect(await inizioDelPeriodoDi(prismaFinto(d('2026-08-31'), true), 'c1', ADESSO)).toBeNull();
  });

  /**
   * ⛔ **Solo le vacanze.** `pause_period` non vuol dire «vacanza»: dal Calendario una cliente può
   * segnare un matrimonio, una cena, un «Altro». È una lezione già pagata e scritta in
   * `pause.service.ts`, e questa prova la tiene ferma sul filtro che parte davvero.
   */
  it('⛔ chiede le sole sospensioni da vacanza, non ogni «Periodo» del Calendario', async () => {
    const prisma = prismaFinto(d('2026-08-31'));
    await inizioDelPeriodoDi(prisma, 'c1', ADESSO);
    const dove = (prisma.event.findMany as jest.Mock).mock.calls[0][0].where;
    expect(dove.mode).toBe('pause_period');
    expect(dove.type).toBe('vacation');
  });

  /**
   * ⛔ **`planStartDate` NON conta**, ed è la correzione più importante di questa consegna: si
   * riscrive a ogni rinnovo dalla coda, quindi la regola si sarebbe accesa su ogni cliente che
   * rinnova — che non ha rientrato da niente. *Un rinnovo non è un rientro.*
   */
  it('⛔ non legge il profilo: un rinnovo di piano non è un rientro', async () => {
    const prisma = prismaFinto(null) as unknown as { clientProfile?: unknown };
    // ⚠️ Il finto non ha nemmeno `clientProfile`: se il modulo lo cercasse, esploderebbe.
    expect(prisma.clientProfile).toBeUndefined();
    expect(await inizioDelPeriodoDi(prisma as never, 'c1', ADESSO)).toBeNull();
  });

  /**
   * ⛔ Si torna al comportamento di prima, **ma si dice**: un `catch` muto spegnerebbe una regola
   * clinica su tutte le clienti, in silenzio, per sempre.
   */
  it('⛔ se la lettura fallisce rende null E lo dice a chi chiama', async () => {
    const rotto = { event: { findMany: jest.fn().mockRejectedValue(new Error('db giù')) } } as unknown as PrismaService;
    const detto: string[] = [];
    await expect(inizioDelPeriodoDi(rotto, 'c1', ADESSO, (m) => detto.push(m))).resolves.toBeNull();
    expect(detto.join(' ')).toContain('db giù');
  });
});
