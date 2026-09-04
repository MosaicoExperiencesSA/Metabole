import { readFileSync } from 'fs';
import { join } from 'path';
import { CoachDiRiservaService } from './coach-di-riserva.service';

/**
 * ⛔ **IL GIRO NOTTURNO E LE PORTE, sorvegliati insieme.**
 *
 * La prima metà prova il servizio con un Prisma finto: spenta non legge, non valida non scrive e
 * lo dice, accesa scrive attraverso il ponte e registra. La seconda legge i sorgenti: che il cron
 * abbia il passo, **prima** dei compiti coach; che lo script esista; che il seed porti la riga.
 * Sono le cose che una consegna parallela può cancellare senza che un test di comportamento se ne
 * accorga (è successo il 4/9 con i due cancelli delle ricette).
 */

const giusy = { id: 'st-giusy', userId: 'u-giusy', displayName: 'Giusy Vita', active: true, user: { role: 'sales', status: 'active', deletedAt: null } };

function monta(valore: string, scheda: unknown, utenti: unknown[] = []) {
  const prisma = {
    staff: { findUnique: jest.fn().mockResolvedValue(scheda) },
    user: { findMany: jest.fn().mockResolvedValue(utenti) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: null }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const config = { getString: jest.fn().mockResolvedValue(valore) };
  return { prisma, audit, service: new CoachDiRiservaService(prisma as never, config as never, audit as never) };
}

describe('giroNotturno', () => {
  it('⚠️ spenta: non legge nemmeno le clienti', async () => {
    const { prisma, service } = monta('off', null);
    expect(await service.giroNotturno()).toEqual({ riserva: 'spenta', senzaCoach: 0 });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('⛔ non valida: non scrive niente, e non legge le clienti', async () => {
    const { prisma, service } = monta('st-giusy', { ...giusy, active: false });
    expect(await service.giroNotturno()).toEqual({ riserva: 'non_valida', senzaCoach: 0 });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
  });

  it('⛔ accesa: assegna chi è senza, attraverso il ponte, e scrive il registro con la porta', async () => {
    const { prisma, audit, service } = monta('st-giusy', giusy, [
      { id: 'u1', email: 'a@x.it', createdAt: new Date(), clientProfile: { name: 'A', assignedCoachId: null, onboardingCompletedAt: null } },
    ]);
    expect(await service.giroNotturno()).toEqual({ riserva: 'ok', senzaCoach: 1, assegnate: 1, schedeCreate: 0, giaAssegnate: 0 });
    expect(prisma.clientProfile.update).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' }, data: { assignedCoachId: 'st-giusy' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'assegnazione.coach_di_riserva',
      entityId: 'u1',
      metadata: expect.objectContaining({ porta: 'giro_notturno', staffId: 'st-giusy' }),
    }));
  });

  it('⚠️ accesa e nessuno senza coach: zero scritture, zero righe', async () => {
    const { prisma, audit, service } = monta('st-giusy', giusy, []);
    const out = await service.giroNotturno();
    expect(out.assegnate).toBe(0);
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('⛔ le porte, lette nei sorgenti', () => {
  const radice = join(__dirname, '..', '..');
  const leggi = (p: string) => readFileSync(join(radice, p), 'utf8');

  it('⛔ il cron ha il passo, PRIMA dei compiti coach', () => {
    const src = leggi('src/cron/cron.controller.ts');
    const riserva = src.indexOf("step('coachDiRiserva'");
    const compiti = src.indexOf("step('coachTasks'");
    expect(riserva).toBeGreaterThan(-1);
    expect(compiti).toBeGreaterThan(-1);
    expect(riserva).toBeLessThan(compiti);
  });

  it('⛔ il questionario e la rimozione a mano chiamano la stessa funzione', () => {
    expect(leggi('src/onboarding/onboarding.service.ts')).toMatch(/coachDiRiserva\(this\.prisma as never, this\.configParams\)/);
    expect(leggi('src/users/users.service.ts')).toMatch(/coachDiRiserva\(this\.prisma as never, this\.configParams\)/);
  });

  it('⚠️ lo script esiste ed è lo stesso giro (stessa funzione, stesso registro)', () => {
    expect(JSON.parse(leggi('package.json')).scripts['assegna:coach-di-riserva']).toContain('prisma/assegna-coach-di-riserva.ts');
    const script = leggi('prisma/assegna-coach-di-riserva.ts');
    expect(script).toContain("from '../src/common/coach-di-riserva'");
    expect(script).toContain('assegnaLaRiserva(');
    expect(script).toContain("process.env.CONFERMA === '1'");
  });

  it('⚠️ il seed porta la riga, spenta: la casella compare nei Parametri senza doverla creare', () => {
    expect(leggi('prisma/seed.ts')).toMatch(/key: 'coach_di_riserva',\s*value: 'off'/);
  });
});
