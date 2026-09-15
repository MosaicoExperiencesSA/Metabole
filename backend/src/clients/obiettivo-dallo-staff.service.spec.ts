import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
  ValidationPipe,
} from '@nestjs/common';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { ClientsController } from './clients.controller';
import { ObiettivoDalloStaffService } from './obiettivo-dallo-staff.service';

/**
 * ⛔ **LA PORTA CHE SCRIVE L'OBIETTIVO DALLA SCHEDA** (Simone, 15/9). Qui non si prova il giudizio
 * (sta in `obiettivo-dallo-staff.spec.ts`): si prova che il service lo **usi**, e lo usi giusto —
 * col peso di adesso, col giorno di Roma, prima di scrivere — e che dopo la scrittura succeda
 * quello che la card promette: stato confermato, storico, nota, audit, menu rifatti.
 */
type Stima = { weightKg: number; target: number; pesoIncoerente: unknown } | null;

const AGGIORNATO_IL = new Date('2026-09-10T09:00:00.000Z');
const OBIETTIVO = {
  id: 'obj-1',
  updatedAt: AGGIORNATO_IL,
  clientId: 'cli-1',
  targetWeightKg: 55,
  targetWaistCm: 70,
  targetHipsCm: 95,
  targetDate: new Date('2026-10-01T00:00:00.000Z'),
  status: 'proposed',
  history: [{ event: 'updated_by_client', at: '2026-09-01T00:00:00.000Z' }],
};

function montaggio(opts: {
  obiettivo?: typeof OBIETTIVO | null;
  ruolo?: string | null;
  stime?: (Stima | Error)[];
  accesso?: () => Promise<void>;
  redeliver?: jest.Mock;
  notaFallisce?: boolean;
  update?: jest.Mock;
  ultimaPesata?: number | null;
  profilo?: { startWeightKg: number | null; objective: string | null; kcalDeficitOverride: number | null };
} = {}) {
  const stime = [...(opts.stime ?? [
    { weightKg: 70, target: 1400, pesoIncoerente: null },
    { weightKg: 70, target: 1350, pesoIncoerente: null },
  ])];
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue(opts.ruolo === null ? null : { role: opts.ruolo ?? 'client' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(opts.profilo ?? { startWeightKg: 90, objective: 'dimagrimento', kcalDeficitOverride: null }),
    },
    measurement: {
      findFirst: jest.fn().mockResolvedValue(opts.ultimaPesata === null ? null : { weightKg: opts.ultimaPesata ?? 80 }),
    },
    objective: {
      findFirst: jest.fn().mockResolvedValue(opts.obiettivo === undefined ? OBIETTIVO : opts.obiettivo),
      update: opts.update ?? jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'obj-1', ...data })),
      create: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'obj-new', ...data })),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-9', displayName: 'Simone' }) },
    clientNote: {
      create: opts.notaFallisce
        ? jest.fn().mockRejectedValue(new Error('db giù'))
        : jest.fn().mockResolvedValue({ id: 'n1' }),
    },
  };
  const clients = { assertClientAccess: jest.fn(opts.accesso ?? (() => Promise.resolve())) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const configParams = {
    getNumber: jest.fn((k: string, d: number) =>
      Promise.resolve(k === 'sustainable_rate_max_kg_week' ? 0.7 : k === 'ambitious_rate_max_kg_week' ? 1.0 : d),
    ),
  };
  const kcalNeed = {
    estimate: jest.fn(() => {
      const x = stime.shift() ?? null;
      return x instanceof Error ? Promise.reject(x) : Promise.resolve(x);
    }),
  };
  const menu = {
    redeliverFutureDays: opts.redeliver ?? jest.fn().mockResolvedValue({ removed: 5, delivered: ['a', 'b', 'c', 'd', 'e'], ripristinati: 0 }),
  };
  const s = new ObiettivoDalloStaffService(
    prisma as never, clients as never, audit as never, configParams as never, kcalNeed as never, menu as never,
  );
  return { s, prisma, clients, audit, kcalNeed, menu };
}

// 70 → 65 in 10 settimane dal 15/9 = 0,5 kg/settimana
const SOSTENIBILE = { targetWeightKg: 65, targetDate: '2026-11-24', motivo: 'ritmo della cliente irreale' };
// 70 → 55 in 10 settimane = 1,5
const IRREALE = { targetWeightKg: 55, targetDate: '2026-11-24', motivo: 'la cliente insiste' };

describe('⛔ ObiettivoDalloStaffService.aggiorna', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-09-15T08:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('⛔ il perimetro si controlla PRIMA di leggere o scrivere, con attore e cliente nell\'ordine giusto', async () => {
    const { s, prisma, clients } = montaggio({ accesso: () => Promise.reject(new ForbiddenException('non tua')) });
    await expect(s.aggiorna('cli-1', 'user-staff', SOSTENIBILE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(clients.assertClientAccess).toHaveBeenCalledWith('user-staff', 'cli-1');
    expect(prisma.objective.update).not.toHaveBeenCalled();
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it('⛔ solo alle clienti', async () => {
    const { s, prisma } = montaggio({ ruolo: 'coach' });
    await expect(s.aggiorna('cli-1', 'u', SOSTENIBILE)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it('⛔ e non a una cliente cancellata: la ricerca esclude le cancellate', async () => {
    const { s, prisma } = montaggio({ ruolo: null });
    await expect(s.aggiorna('cli-1', 'u', SOSTENIBILE)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cli-1', deletedAt: null } }));
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it('⛔ se la stima delle calorie fallisce NON si scrive: un errore non vale «nessun peso»', async () => {
    const { s, prisma, menu } = montaggio({ stime: [new Error('db giù')] });
    await expect(s.aggiorna('cli-1', 'u', IRREALE)).rejects.toThrow('db giù');
    expect(prisma.objective.update).not.toHaveBeenCalled();
    expect(menu.redeliverFutureDays).not.toHaveBeenCalled();
  });

  it('⛔ a valori identici non si scrive niente (la data confrontata nel giorno di Roma)', async () => {
    // La cliente dall'app ha salvato un istante: 23:30 UTC del 23/11 è già il 24/11 a Roma (ora solare).
    const { s, prisma, menu } = montaggio({
      obiettivo: { ...OBIETTIVO, targetWeightKg: 65, targetDate: new Date('2026-11-23T23:30:00.000Z') },
    });
    await expect(s.aggiorna('cli-1', 'u', { ...SOSTENIBILE, targetWaistCm: 70 })).rejects.toThrow('Nessuna modifica');
    expect(prisma.objective.update).not.toHaveBeenCalled();
    expect(menu.redeliverFutureDays).not.toHaveBeenCalled();
    // … e basta una circonferenza diversa perché si scriva.
    await s.aggiorna('cli-1', 'u', { ...SOSTENIBILE, targetWaistCm: 68 });
    expect(prisma.objective.update).toHaveBeenCalledTimes(1);
  });

  it('⛔ … e basta anche solo il peso, o solo la data, perché si scriva', async () => {
    const stesso = { ...OBIETTIVO, targetWeightKg: 65, targetDate: new Date('2026-11-24T00:00:00.000Z') };
    const a = montaggio({ obiettivo: stesso });
    await a.s.aggiorna('cli-1', 'u', { ...SOSTENIBILE, targetWeightKg: 64.5 });
    expect(a.prisma.objective.update).toHaveBeenCalledTimes(1);
    const b = montaggio({ obiettivo: stesso });
    await b.s.aggiorna('cli-1', 'u', { ...SOSTENIBILE, targetDate: '2026-11-25' });
    expect(b.prisma.objective.update).toHaveBeenCalledTimes(1);
  });

  it('⛔ senza motivo non si scrive (anche se sono solo spazi)', async () => {
    const { s, prisma } = montaggio();
    await expect(s.aggiorna('cli-1', 'u', { ...SOSTENIBILE, motivo: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it('⛔ ritmo irreale senza conferma: 409 col ritmo dentro, e NIENTE scritto né rifatto', async () => {
    const { s, prisma, menu, audit } = montaggio();
    const err = await s.aggiorna('cli-1', 'u', IRREALE).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ daConfermare: true, ritmo: { pace: 'unreal', kgASettimana: 1.5 } });
    expect(prisma.objective.update).not.toHaveBeenCalled();
    expect(menu.redeliverFutureDays).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('⛔ il ritmo si misura sul peso DI ADESSO (la stima), non su un altro', async () => {
    // Con la stima a 80 kg lo stesso obiettivo (65 in 10 settimane) è 1,5 kg/settimana: irreale.
    const { s, prisma } = montaggio({ stime: [{ weightKg: 80, target: 1500, pesoIncoerente: null }] });
    await expect(s.aggiorna('cli-1', 'u', SOSTENIBILE)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it('⛔ con le pesate incoerenti il ritmo si misura sull\'ultima pesata: l\'irreale si conferma lo stesso', async () => {
    const incoerente = { weightKg: 70, target: 1500, pesoIncoerente: { salto: 10 } };
    // Ultima pesata 70: 70 → 55 in 10 settimane = 1,5 → conferma.
    const { s, prisma } = montaggio({ stime: [incoerente, incoerente], ultimaPesata: 70 });
    await expect(s.aggiorna('cli-1', 'u', IRREALE)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it('⚠️ con le pesate incoerenti, confermato: si scrive, lo si dice, e le calorie restano null', async () => {
    const incoerente = { weightKg: 70, target: 1500, pesoIncoerente: { salto: 10 } };
    const { s, prisma } = montaggio({ stime: [incoerente, incoerente], ultimaPesata: 70 });
    const out = await s.aggiorna('cli-1', 'u', { ...IRREALE, conferma: true });
    expect(prisma.objective.update).toHaveBeenCalled();
    expect(out.ritmo).toMatchObject({ pace: 'unreal', kgDaPerdere: 15 });
    expect(out.avvisi.join(' ')).toContain('non partono dalla tendenza');
    expect(out.targetPrima).toBeNull();
    expect(out.targetDopo).toBeNull();
  });

  it('⚠️ senza stima e senza pesate il ritmo si misura sul peso di partenza', async () => {
    // Partenza 70: 70 → 55 in 10 settimane = 1,5 → conferma.
    const { s, prisma } = montaggio({
      stime: [null, null], ultimaPesata: null,
      profilo: { startWeightKg: 70, objective: 'dimagrimento', kcalDeficitOverride: null },
    });
    await expect(s.aggiorna('cli-1', 'u', IRREALE)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it('⚠️ con un deficit scritto a mano lo si dice (e il profilo è quello letto)', async () => {
    const { s } = montaggio({ profilo: { startWeightKg: 90, objective: 'dimagrimento', kcalDeficitOverride: 400 } });
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(out.avvisi.join(' ')).toContain('scritto a mano il nutrizionista');
  });

  it('⚠️ se il tetto taglia il deficit dedotto lo si dice', async () => {
    const { s } = montaggio({
      stime: [
        { weightKg: 70, target: 1400, pesoIncoerente: null },
        { weightKg: 70, target: 1200, pesoIncoerente: null, tettoApplicato: true, fonteDeficit: 'calcolato' } as never,
      ],
    });
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(out.avvisi.join(' ')).toContain('tetto del deficit');
  });

  it('⛔ «oggi» è il giorno di Roma: alle 22:30 UTC del 15 il 16 è già oggi, e si rifiuta', async () => {
    jest.setSystemTime(new Date('2026-09-15T22:30:00.000Z'));
    const { s, prisma } = montaggio();
    await expect(
      s.aggiorna('cli-1', 'u', { targetWeightKg: 69.9, targetDate: '2026-09-16', motivo: 'prova del fuso' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it('✅ la scrittura: valori, stato confermato, data a mezzanotte UTC, storico che si allunga', async () => {
    const { s, prisma } = montaggio();
    await s.aggiorna('cli-1', 'user-staff', { ...IRREALE, conferma: true });
    expect(prisma.objective.update).toHaveBeenCalledTimes(1);
    const arg = prisma.objective.update.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> };
    // ⚠️ Con `updatedAt`: se la cliente l'ha cambiato nel frattempo, non si scrive sopra.
    expect(arg.where).toEqual({ id: 'obj-1', updatedAt: AGGIORNATO_IL });
    expect(arg.data.targetWeightKg).toBe(55);
    expect((arg.data.targetDate as Date).toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(arg.data.status).toBe('confirmed');
    // ⚠️ Le circonferenze non mandate NON si toccano.
    expect(arg.data).not.toHaveProperty('targetWaistCm');
    expect(arg.data).not.toHaveProperty('targetHipsCm');
    const history = arg.data.history as Record<string, unknown>[];
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(OBIETTIVO.history[0]);
    expect(history[1]).toMatchObject({
      event: 'updated_by_staff',
      byStaffId: 'staff-9',
      byUserId: 'user-staff',
      motivo: 'la cliente insiste',
      prima: { targetWeightKg: 55, targetDate: '2026-10-01T00:00:00.000Z', status: 'proposed' },
      dopo: { targetWeightKg: 55, targetDate: '2026-11-24T00:00:00.000Z' },
      ritmo: { pace: 'unreal' },
    });
  });

  it('⚠️ circonferenze: null le toglie, un numero le scrive', async () => {
    const { s, prisma } = montaggio();
    await s.aggiorna('cli-1', 'u', { ...SOSTENIBILE, targetWaistCm: null, targetHipsCm: 90 });
    const data = (prisma.objective.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.targetWaistCm).toBeNull();
    expect(data.targetHipsCm).toBe(90);
  });

  it('✅ senza obiettivo se ne crea uno, sulla cliente giusta', async () => {
    const { s, prisma } = montaggio({ obiettivo: null });
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(prisma.objective.update).not.toHaveBeenCalled();
    expect(prisma.objective.create).toHaveBeenCalledTimes(1);
    const data = (prisma.objective.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ clientId: 'cli-1', targetWeightKg: 65, status: 'confirmed' });
    expect((data.history as { prima: unknown }[])[0].prima).toBeNull();
    expect(out.objective.id).toBe('obj-new');
  });

  it('⛔ se l\'obiettivo è cambiato nel frattempo: 412 (non 409, che la pagina legge come «conferma»)', async () => {
    const { Prisma } = jest.requireActual('@prisma/client') as typeof import('@prisma/client');
    const update = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'x' }),
    );
    const { s, menu, audit } = montaggio({ update });
    await expect(s.aggiorna('cli-1', 'u', SOSTENIBILE)).rejects.toBeInstanceOf(PreconditionFailedException);
    expect(menu.redeliverFutureDays).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('⛔ i menu NON si rifanno se le calorie non cambiano', async () => {
    const { s, menu } = montaggio({
      stime: [
        { weightKg: 70, target: 1400, pesoIncoerente: null },
        { weightKg: 70, target: 1400, pesoIncoerente: null },
      ],
    });
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(menu.redeliverFutureDays).not.toHaveBeenCalled();
    expect(out.menu).toMatchObject({ saltato: true, removed: 0 });
  });

  it('⚠️ … e si rifanno se la stima DOPO non riesce: meglio un giro in più che le calorie vecchie', async () => {
    const { s, menu } = montaggio({ stime: [{ weightKg: 70, target: 1400, pesoIncoerente: null }, new Error('x')] });
    await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(menu.redeliverFutureDays).toHaveBeenCalledWith('cli-1');
  });

  it('⛔ i menu futuri si rifanno DOPO la scrittura, per quella cliente', async () => {
    const { s, prisma, menu } = montaggio();
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(menu.redeliverFutureDays).toHaveBeenCalledWith('cli-1');
    expect(prisma.objective.update.mock.invocationCallOrder[0]).toBeLessThan(
      menu.redeliverFutureDays.mock.invocationCallOrder[0],
    );
    expect(out.menu).toMatchObject({ removed: 5 });
  });

  it('⛔ le calorie prima e dopo: la stima letta PRIMA e DOPO la scrittura', async () => {
    const { s, prisma, kcalNeed } = montaggio();
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(out.targetPrima).toBe(1400);
    expect(out.targetDopo).toBe(1350);
    expect(kcalNeed.estimate).toHaveBeenCalledTimes(2);
    expect(kcalNeed.estimate.mock.invocationCallOrder[0]).toBeLessThan(prisma.objective.update.mock.invocationCallOrder[0]);
    expect(kcalNeed.estimate.mock.invocationCallOrder[1]).toBeGreaterThan(prisma.objective.update.mock.invocationCallOrder[0]);
  });

  it('✅ nota in scheda firmata e audit con prima, dopo e motivo', async () => {
    const { s, prisma, audit } = montaggio();
    const out = await s.aggiorna('cli-1', 'user-staff', SOSTENIBILE);
    expect(out.notaInScheda).toBe(true);
    const nota = (prisma.clientNote.create.mock.calls[0][0] as { data: { clientId: string; authorId: string; body: string } }).data;
    expect(nota.clientId).toBe('cli-1');
    expect(nota.authorId).toBe('staff-9');
    expect(nota.body).toContain('Obiettivo cambiato da Simone');
    expect(nota.body).toContain('a 65,0 kg entro il 24/11/2026');
    expect(nota.body).toContain('da 1400 a 1350 kcal/giorno');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'client.objective.update',
      actorId: 'user-staff',
      entityType: 'objective',
      entityId: 'obj-1',
      metadata: expect.objectContaining({
        clientId: 'cli-1',
        motivo: 'ritmo della cliente irreale',
        dopo: { targetWeightKg: 65, targetDate: '2026-11-24' },
        notaInScheda: true,
      }),
    }));
  });

  it('⚠️ se la nota non nasce l\'obiettivo resta scritto, e la risposta lo dice', async () => {
    const { s, prisma, audit } = montaggio({ notaFallisce: true });
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(prisma.objective.update).toHaveBeenCalled();
    expect(out.notaInScheda).toBe(false);
    expect(audit.log.mock.calls[0][0].metadata.notaInScheda).toBe(false);
  });

  it('⚠️ se la rierogazione salta l\'obiettivo resta scritto, e la risposta lo dice', async () => {
    const { s, prisma } = montaggio({ redeliver: jest.fn().mockRejectedValue(new Error('menu giù')) });
    const out = await s.aggiorna('cli-1', 'u', SOSTENIBILE);
    expect(prisma.objective.update).toHaveBeenCalled();
    expect(out.ok).toBe(true);
    expect(out.menu).toMatchObject({ errore: true });
  });
});

describe('⛔ il corpo che manda la pagina passa la validazione vera (whitelist + forbidNonWhitelisted)', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const tipo = Reflect.getMetadata('design:paramtypes', ClientsController.prototype, 'aggiornaObiettivo')[2];
  const valida = (body: unknown) => pipe.transform(body, { type: 'body', metatype: tipo });

  it('con le circonferenze a null («tolte») e la conferma', async () => {
    await expect(valida({ targetWeightKg: 62.5, targetDate: '2026-12-01', motivo: 'ok ok', conferma: true, targetWaistCm: null, targetHipsCm: null }))
      .resolves.toMatchObject({ targetWaistCm: null });
  });

  it('senza circonferenze e senza conferma', async () => {
    await expect(valida({ targetWeightKg: 62.5, targetDate: '2026-12-01', motivo: 'ok ok' })).resolves.toBeTruthy();
  });

  it('⛔ e rifiuta un campo in più, un peso fuori scala e il motivo mancante', async () => {
    await expect(valida({ targetWeightKg: 62, targetDate: '2026-12-01', motivo: 'ok ok', status: 'confirmed' })).rejects.toBeTruthy();
    await expect(valida({ targetWeightKg: 3, targetDate: '2026-12-01', motivo: 'ok ok' })).rejects.toBeTruthy();
    await expect(valida({ targetWeightKg: 62, targetDate: '2026-12-01' })).rejects.toBeTruthy();
  });
});

describe('⛔ la porta ha la sua chiave, in scrittura', () => {
  it('PATCH :id/objective chiede change_objective in manage', () => {
    const meta = Reflect.getMetadata(PAGE_KEY, ClientsController.prototype.aggiornaObiettivo);
    expect(meta).toEqual({ pageKey: 'change_objective', level: 'manage' });
  });

  it('e il controller passa attore e cliente al service, non il contrario', async () => {
    const aggiorna = jest.fn().mockResolvedValue({ ok: true });
    const c = new ClientsController({} as never, {} as never, { aggiorna } as never);
    await c.aggiornaObiettivo({ sub: 'user-staff' } as never, 'cli-1', SOSTENIBILE as never);
    expect(aggiorna).toHaveBeenCalledWith('cli-1', 'user-staff', SOSTENIBILE);
  });

  it('⚠️ il pulsante in scheda si accende con la stessa chiave, e solo lì', () => {
    const scheda = readFileSync(join(__dirname, '..', '..', '..', 'backoffice', 'src', 'pages', 'ClientDetail.tsx'), 'utf8');
    expect(scheda).toMatch(/const canChangeObjective = can\('change_objective',\s*'manage'\)/);
    expect(scheda.match(/setObiettivoAperto\(true\)/g)).toHaveLength(1);
    expect(scheda).toMatch(/\{canChangeObjective && \(\s*<button[^>]*onClick=\{\(\) => setObiettivoAperto\(true\)\}/);
    expect(scheda).toContain('/admin/clients/${clientId}/objective');
  });
});
