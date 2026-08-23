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

/**
 * ⛔ **LE SCADENZE DELLE VISITE IN CALENDARIO** — richiesta di Simone, 23/8.
 *
 * Quando la nutrizionista scrive «serve una visita entro il 30», dal giorno dopo l'erogazione della
 * cliente si ferma **da sola**. Finché quella data viveva solo in una nota e in un'attività in
 * elenco, il giorno del blocco arrivava addosso alla coach nello stesso momento in cui arrivava
 * addosso alla cliente.
 *
 * ⛔ **La prima stesura non ha mai funzionato, e i suoi test erano verdi.** Leggeva le attività
 * filtrando `status: { in: ['open', 'in_progress'] }` — gli stati veri sono `todo | done | skipped`,
 * quindi zero righe, sempre. E il test asseriva **la stessa stringa da cui il filtro era stato
 * copiato**: un test che verifica che il codice contenga il suo stesso errore. Questi qui sotto
 * guardano **quello che esce**, con un finto che risponde alla query giusta e a nessun'altra.
 */
describe('⛔ le scadenze delle visite compaiono in calendario', () => {
  /** Risponde SOLO alla domanda giusta: profili `serve_visita` con la scadenza nella finestra. */
  const finto = (profili: unknown[]) => ({
    visit: { findMany: jest.fn().mockResolvedValue([]) },
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
    staff: { findMany: jest.fn().mockResolvedValue([]) },
    clientProfile: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.idoneita === 'serve_visita' && where.idoneitaVisitaEntro ? profili : []),
      ),
    },
  });

  const profilo = (over: Record<string, unknown> = {}) => ({
    userId: 'c1',
    idoneitaVisitaEntro: new Date('2026-09-30T00:00:00.000Z'),
    ...over,
  });

  it('⛔ una scadenza diventa una riga di tutto il giorno, nel giorno giusto', async () => {
    const voci = await vociCalendario(finto([profilo()]) as never, { dal: new Date('2026-09-01'), scadenzeVisite: true });
    expect(voci).toHaveLength(1);
    expect(voci[0].fonte).toBe('scadenza');
    expect(voci[0].tuttoIlGiorno).toBe(true);
    expect(voci[0].datetime.slice(0, 10)).toBe('2026-09-30');
    // ⚠️ Un testo scritto per un calendario, non il titolo interno dell'attività.
    expect(voci[0].note).toContain('da domani i menu si fermano');
  });

  /**
   * ⛔ **SENZA IL FLAG NON ESCE NIENTE — ed è il cancello che tiene la riga fuori dall'agenda della
   * CLIENTE.** `vociCalendario` la chiamano anche `clientAgenda` e l'app: senza questo, la cliente
   * avrebbe letto «Fissa la visita…» alle 02:00 come prossimo appuntamento. Trovato in revisione
   * prima che si vedesse, solo perché l'altro difetto teneva la query a zero righe.
   */
  it('⛔ senza `scadenzeVisite` la query non parte proprio', async () => {
    const prisma = finto([profilo()]);
    const voci = await vociCalendario(prisma as never, { dal: new Date('2026-09-01') });
    expect(voci).toEqual([]);
    expect(prisma.clientProfile.findMany).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **Si legge il PROFILO, non l'attività** — e la differenza è quando la riga sparisce.
   * L'attività si chiude quando la visita è **fissata**; il blocco cade solo quando la nutrizionista
   * **rivaluta**. Fra i due momenti la scadenza è ancora vera, e deve restare in calendario. Il
   * finto qui risponde solo alla domanda sul profilo: se il codice tornasse a chiedere le attività,
   * questi test vedrebbero il vuoto.
   */
  it('⚠️ le decisioni senza data (prima del 23/8) non entrano: niente giorni inventati', async () => {
    const voci = await vociCalendario(finto([profilo({ idoneitaVisitaEntro: null })]) as never, {
      dal: new Date('2026-09-01'),
      scadenzeVisite: true,
    });
    expect(voci).toEqual([]);
  });

  /**
   * ⛔ **E una visita fissata PROPRIO quel giorno non fa sparire il promemoria.** Sono due
   * informazioni diverse — «ci vediamo giovedì» e «se giovedì non si fa, i menu si fermano» — e la
   * seconda è quella con la conseguenza automatica.
   */
  it('⛔ convive con una visita fissata nello stesso giorno', async () => {
    const prisma = finto([profilo()]);
    prisma.visit.findMany = jest.fn().mockResolvedValue([
      {
        id: 'vis-1', clientId: 'c1', nutritionistId: 'n1', type: 'in_person',
        datetime: new Date('2026-09-30T00:00:00.000Z'), endsAt: null, videoRoomId: null,
        nutritionist: { displayName: 'Lucia' },
      },
    ]);
    const voci = await vociCalendario(prisma as never, { dal: new Date('2026-09-01'), scadenzeVisite: true });
    expect(voci.map((v) => v.fonte).sort()).toEqual(['scadenza', 'visita']);
  });
});
