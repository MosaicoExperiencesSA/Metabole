/**
 * §16.7 — IL CALENDARIO UNICO.
 *
 * Richiesta di Simone del 12/8: «anche la coach deve vedere nel suo calendario gli appuntamenti di
 * tutte le sue clienti». Il test che conta davvero è l'ultimo: le note cliniche non escono di lì.
 */
import { unisciCalendario, vociCalendario, type VoceCalendario } from './calendario';

const voce = (v: Partial<VoceCalendario>): VoceCalendario => ({
  id: 'x',
  fonte: 'appuntamento',
  clientId: 'c-1',
  clientName: 'Patrizia',
  staffRole: 'coach',
  staffId: 's-1',
  staffName: 'Giulia',
  type: 'call',
  datetime: '2026-09-10T09:00:00.000Z',
  fine: null,
  note: null,
  ...v,
});

describe('unisciCalendario', () => {
  it('mette in fila per orario quello che viene dalle due tabelle', () => {
    const out = unisciCalendario([
      voce({ id: 'a', datetime: '2026-09-10T15:00:00.000Z' }),
      voce({ id: 'b', fonte: 'visita', staffId: 's-2', datetime: '2026-09-10T09:00:00.000Z' }),
      voce({ id: 'c', staffId: 's-3', datetime: '2026-09-11T08:00:00.000Z' }),
    ]);
    expect(out.map((v) => v.id)).toEqual(['b', 'a', 'c']);
  });

  it('⚠️ la stessa cosa scritta in tutte e due le tabelle è UNA riga, e vince la visita', () => {
    // Il nutrizionista può fissare la visita dalla scheda clinica E l'appuntamento dall'altra
    // schermata: oggi niente glielo impedisce. Due righe alla stessa ora sono il modo più sicuro
    // per far presentare qualcuno all'ora sbagliata; e delle due va tenuta quella che porta la
    // stanza video.
    const out = unisciCalendario([
      voce({ id: 'appunt', staffRole: 'nutritionist', staffId: 's-9', type: 'televisit' }),
      voce({ id: 'visita', fonte: 'visita', staffRole: 'nutritionist', staffId: 's-9', type: 'televisit', videoRoomId: 'stanza-1' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('visita');
    expect(out[0].videoRoomId).toBe('stanza-1');
  });

  it('l\'ordine di arrivo non cambia chi vince', () => {
    const coppia = [
      voce({ id: 'visita', fonte: 'visita', staffId: 's-9' }),
      voce({ id: 'appunt', staffId: 's-9' }),
    ];
    expect(unisciCalendario(coppia)[0].id).toBe('visita');
    expect(unisciCalendario([...coppia].reverse())[0].id).toBe('visita');
  });

  it('due persone diverse alla stessa ora restano due righe', () => {
    const out = unisciCalendario([voce({ id: 'a' }), voce({ id: 'b', clientId: 'c-2' })]);
    expect(out).toHaveLength(2);
  });

  it('lo stesso staff con la stessa cliente a mezz\'ora di distanza resta due righe', () => {
    const out = unisciCalendario([
      voce({ id: 'a', datetime: '2026-09-10T09:00:00.000Z' }),
      voce({ id: 'b', datetime: '2026-09-10T09:30:00.000Z' }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('vociCalendario', () => {
  const prismaFinto = (visite: any[], appuntamenti: any[]) => ({
    visit: { findMany: jest.fn().mockResolvedValue(visite) },
    appointment: { findMany: jest.fn().mockResolvedValue(appuntamenti) },
    staff: { findMany: jest.fn().mockResolvedValue([{ id: 's-coach', displayName: 'Giulia' }]) },
  });

  const VISITA = {
    id: 'v-1',
    clientId: 'c-1',
    nutritionistId: 's-nutri',
    type: 'in_person',
    datetime: new Date('2026-09-10T08:00:00.000Z'),
    endsAt: new Date('2026-09-10T09:00:00.000Z'),
    videoRoomId: null,
    nutritionist: { displayName: 'Dr.ssa Rossi' },
  };
  const APPUNTAMENTO = {
    id: 'a-1',
    clientId: 'c-1',
    staffId: 's-coach',
    staffRole: 'coach',
    type: 'call',
    datetime: new Date('2026-09-11T10:00:00.000Z'),
    note: 'check settimanale',
  };

  it('la coach vede la visita della sua cliente, non solo la propria chiamata', async () => {
    const p: any = prismaFinto([VISITA], [APPUNTAMENTO]);
    const out = await vociCalendario(p, { clientIds: ['c-1'], dal: new Date('2026-09-01') });
    expect(out.map((v) => v.fonte)).toEqual(['visita', 'appuntamento']);
    expect(out[0].staffName).toBe('Dr.ssa Rossi');
    expect(out[0].fine).toBe('2026-09-10T09:00:00.000Z');
    expect(out[1].staffName).toBe('Giulia');
  });

  it('⚠️ le note della visita NON escono: sono cliniche', async () => {
    // Un calendario è la cosa più condivisa che ci sia. `Visit.notes` è riservato al nutrizionista
    // e al capo, e non deve poterci passare per sbaglio.
    const p: any = prismaFinto([{ ...VISITA, notes: 'ipotiroidismo, TSH 6.1' }], []);
    const out = await vociCalendario(p, { clientIds: ['c-1'], dal: new Date('2026-09-01') });
    expect(out[0].note).toBeNull();
    expect(JSON.stringify(out)).not.toContain('TSH');
    // E non le chiede nemmeno al database.
    expect(p.visit.findMany.mock.calls[0][0].select.notes).toBeUndefined();
  });

  it('nessuna cliente in carico: non interroga il database', async () => {
    const p: any = prismaFinto([], []);
    expect(await vociCalendario(p, { clientIds: [], dal: new Date() })).toEqual([]);
    expect(p.visit.findMany).not.toHaveBeenCalled();
  });

  it('chiede solo quello che è ancora in programma', async () => {
    const p: any = prismaFinto([], []);
    await vociCalendario(p, { clientIds: ['c-1'], dal: new Date('2026-09-01') });
    expect(p.visit.findMany.mock.calls[0][0].where.status).toBe('scheduled');
    expect(p.appointment.findMany.mock.calls[0][0].where.status).toBe('scheduled');
  });
});
