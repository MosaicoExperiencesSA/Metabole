import { InvitoGaiaService } from './invito-gaia.service';
import { tokenInvito } from './regole';
import { prefsToken } from '../../common/funnel-segment';

const SEGRETO = 'segreto-di-prova';
// 16/9/2026 alle 10:00 di Roma
const ADESSO = new Date('2026-09-16T08:00:00Z');

type Param = Record<string, string>;

function costruisci(opz: { params?: Param; lotti?: unknown[][]; utenti?: unknown[]; invitati?: unknown[]; oggi?: number; modello?: unknown; promemoria?: unknown[]; falliti?: unknown[] } = {}) {
  const params: Param = {
    gaia_invito_attivo: 'true',
    gaia_invito_al_giorno: '100',
    gaia_invito_promemoria_giorni: '15',
    gaia_invito_ora_da: '9',
    gaia_invito_ora_a: '20',
    gaia_invito_link_ore: '48',
    marketing_require_consent: 'false',
    ...(opz.params ?? {}),
  };
  const lotti = [...(opz.lotti ?? [])];
  let contati = opz.oggi ?? 0;
  const prisma = {
    gaiaInvite: {
      findMany: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where.email) return Promise.resolve(opz.invitati ?? []);
        if (where.esito === 'fallito') return Promise.resolve(opz.falliti ?? []);
        if (where.esito === 'inviato') return Promise.resolve(opz.promemoria ?? []);
        return Promise.resolve([]);
      }),
      create: jest.fn().mockImplementation(({ data }: { data: { crmRecordId: string; esito: string } }) => {
        if (!data.esito.startsWith('saltato')) contati += 1;
        return Promise.resolve({ id: `inv-${data.crmRecordId}` });
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => Promise.resolve(where.ultimoTentativoAt ? contati : 0)),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    crmRecord: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(lotti.shift() ?? [])),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findMany: jest.fn().mockResolvedValue(opz.utenti ?? []),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'u-nuovo', role: 'client', mustChangePassword: true, status: 'active', deletedAt: null }),
    },
    emailTemplate: {
      findUnique: jest.fn().mockResolvedValue(opz.modello === undefined ? null : opz.modello),
      findMany: jest.fn().mockResolvedValue([]),
    },
    actionToken: { create: jest.fn().mockResolvedValue({}) },
    clientProfile: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
  };
  const mail = { send: jest.fn().mockResolvedValue(true) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((k: string) => ({ JWT_ACCESS_SECRET: SEGRETO, APP_URL: 'https://app.metabole.eu', PUBLIC_API_URL: 'https://api.x.eu' } as Record<string, string>)[k]),
  };
  const configParams = {
    getBool: jest.fn((k: string, f: boolean) => Promise.resolve(k in params ? params[k] === 'true' : f)),
    getNumber: jest.fn((k: string, f: number) => Promise.resolve(k in params ? Number(params[k]) : f)),
    update: jest.fn().mockResolvedValue({}),
  };
  const marketing = {
    filtraConsensi: jest.fn((r: { id: string }[]) => Promise.resolve(r)),
    prefsLink: jest.fn((id: string) => `https://app.metabole.eu/preferenze?t=${id}`),
    prefsPageUrlForToken: jest.fn((t: string) => `https://app.metabole.eu/preferenze?t=${t}`),
    oneClickUnsubscribe: jest.fn().mockResolvedValue({ unsubscribed: true }),
  };
  const svc = new InvitoGaiaService(prisma as never, mail as never, audit as never, config as never, configParams as never, marketing as never);
  return { svc, prisma, mail, audit, configParams, marketing };
}

const lead = (id: string, email: string | null, extra: Record<string, unknown> = {}) => ({ id, email, name: 'MARIA ROSSI', firstName: null, clientId: null, consentChannels: [], ...extra });
const doppione = () => Object.assign(new Error('unique'), { code: 'P2002' });
const esitiCreati = (f: ReturnType<typeof costruisci>) =>
  f.prisma.gaiaInvite.create.mock.calls.map((c) => [c[0].data.crmRecordId, c[0].data.esito, c[0].data.email]);

describe('InvitoGaiaService — il giro', () => {
  it('spento: non legge nemmeno i lead', async () => {
    const f = costruisci({ params: { gaia_invito_attivo: 'false' } });
    expect((await f.svc.giro(ADESSO)).nota).toBe('spento');
    expect(f.prisma.crmRecord.findMany).not.toHaveBeenCalled();
    expect(f.mail.send).not.toHaveBeenCalled();
  });

  it('fuori orario: niente email', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]] });
    expect((await f.svc.giro(new Date('2026-09-16T01:00:00Z'))).nota).toBe('fuori dalla finestra oraria');
    expect(f.mail.send).not.toHaveBeenCalled();
  });

  it('pesca «Nuovo contatto» senza account e senza invito, escludendo solo chi ha detto no', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]] });
    await f.svc.giro(ADESSO);
    const where = f.prisma.crmRecord.findMany.mock.calls[0][0].where;
    expect(where.stage).toBe('lead_in');
    expect(where.clientId).toBeNull();
    expect(where.gaiaInvite).toEqual({ is: null });
    // ⛔ `not: false` in SQL escluderebbe anche i NULL: serve l'OR esplicito
    expect(where.OR).toEqual([{ marketingConsent: null }, { marketingConsent: true }]);
  });

  it('con marketing_require_consent acceso pesca solo i consensi espliciti (e non scarta gli altri per sempre)', async () => {
    const f = costruisci({ params: { marketing_require_consent: 'true' }, lotti: [[lead('r1', 'a@example.it')]] });
    await f.svc.giro(ADESSO);
    const where = f.prisma.crmRecord.findMany.mock.calls[0][0].where;
    expect(where.marketingConsent).toBe(true);
    expect(where.OR).toBeUndefined();
  });

  it('il tetto si riconta prima di ogni invio: con 98 già partiti ne manda 2', async () => {
    const f = costruisci({ oggi: 98, lotti: [[lead('r1', 'a@example.it'), lead('r2', 'c@example.it'), lead('r3', 'e@example.it')]] });
    expect((await f.svc.giro(ADESSO)).inviti).toBe(2);
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(f.prisma.gaiaInvite.update).toHaveBeenCalledWith({ where: { id: 'inv-r1' }, data: { esito: 'inviato', sentAt: expect.any(Date), tentativi: 1 } });
    // il conteggio è dei tentativi del giorno di Roma e non conta gli scartati
    const w = f.prisma.gaiaInvite.count.mock.calls[0][0].where;
    expect(w.ultimoTentativoAt.gte.toISOString()).toBe('2026-09-15T22:00:00.000Z');
    expect(w.NOT).toEqual({ esito: { startsWith: 'saltato' } });
  });

  it('quota già piena: non legge i lead', async () => {
    const f = costruisci({ params: { gaia_invito_al_giorno: '2' }, oggi: 2 });
    await f.svc.giro(ADESSO);
    expect(f.prisma.crmRecord.findMany).not.toHaveBeenCalled();
  });

  it('l email ha nome, link firmato con /api/v1, disiscrizione e header un-clic', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'Maria@Example.com')]] });
    await f.svc.giro(ADESSO);
    const m = f.mail.send.mock.calls[0][0];
    expect(m.to).toBe('maria@example.com');
    expect(m.subject).toBe('Maria, ti presento Gaia: la nuova AI per stare bene ✨');
    expect(m.html).toContain(`https://api.x.eu/api/v1/public/gaia/inizia?t=${tokenInvito('r1', SEGRETO)}`);
    expect(m.html).toContain(`https://api.x.eu/api/v1/public/gaia/cancellami?t=${prefsToken('r1', SEGRETO)}`);
    expect(m.html).toContain('https://app.metabole.eu/preferenze?t=r1');
    expect(m.html).toContain('https://app.metabole.eu/brand/logo.png');
    expect(m.html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
    expect(m.listUnsubscribeUrl).toBe(`https://api.x.eu/api/v1/public/marketing/unsubscribe?t=${prefsToken('r1', SEGRETO)}`);
    expect(m.copiaCoach).toBeUndefined();
    expect(esitiCreati(f)).toEqual([['r1', 'invio', 'maria@example.com']]);
  });

  it('i valori finiscono protetti nell HTML, non nell oggetto', async () => {
    const f = costruisci({
      lotti: [[lead('r1', 'a@example.it')]],
      modello: { key: 'gaia_invito', subject: '{{nome}} & co', bodyHtml: '<p>{{email}}</p>', active: true },
    });
    await f.svc.giro(ADESSO);
    const m = f.mail.send.mock.calls[0][0];
    expect(m.subject).toBe('Maria & co');
    expect(m.html).toBe('<p>a@example.it</p>');
  });

  it('chi non riceve esce dalla coda con il suo motivo; gli altri ricevono', async () => {
    const f = costruisci({
      lotti: [[
        lead('r1', 'no@example.it'),
        lead('r2', 'utente@example.it'),
        lead('r3', 'invitata@example.it'),
        lead('r4', 'nonvalida'),
        lead('r5', 'soloWhatsapp@example.it', { consentChannels: ['whatsapp'] }),
        lead('r6', 'si@example.it'),
        lead('r7', 'SI@example.it'),
      ]],
      utenti: [{ email: 'utente@example.it', secondaryEmail: null }],
      invitati: [{ email: 'invitata@example.it' }],
    });
    f.marketing.filtraConsensi.mockImplementation((r: { id: string }[]) => Promise.resolve(r.filter((x) => x.id !== 'r1')));
    expect((await f.svc.giro(ADESSO)).inviti).toBe(1);
    expect(f.mail.send.mock.calls.map((c) => c[0].to)).toEqual(['si@example.it']);
    expect(esitiCreati(f)).toEqual([
      ['r1', 'saltato:consenso', null],
      ['r2', 'saltato:account', null],
      ['r3', 'saltato:doppione', null],
      ['r4', 'saltato:email', null],
      ['r5', 'saltato:canale', null],
      ['r6', 'invio', 'si@example.it'],
      ['r7', 'saltato:doppione', null],
    ]);
  });

  it('esaurito un lotto rilegge la coda (gli scartati ne sono usciti)', async () => {
    const f = costruisci({
      lotti: [[lead('r1', 'utente@example.it')], [lead('r2', 'nuova@example.it')]],
      utenti: [{ email: 'utente@example.it', secondaryEmail: null }],
    });
    expect((await f.svc.giro(ADESSO)).inviti).toBe(1);
    expect(f.prisma.crmRecord.findMany).toHaveBeenCalledTimes(3);
    expect(f.prisma.crmRecord.findMany.mock.calls[1][0].skip).toBeUndefined();
  });

  it('un lotto da cui non esce nessuno non si rilegge all infinito', async () => {
    const stesso = [lead('r1', 'a@example.it')];
    const f = costruisci({ lotti: Array.from({ length: 30 }, () => stesso) });
    f.prisma.gaiaInvite.create.mockRejectedValue(doppione());
    await f.svc.giro(ADESSO);
    expect(f.prisma.crmRecord.findMany).toHaveBeenCalledTimes(1);
    expect(f.mail.send).not.toHaveBeenCalled();
  });

  it('indirizzo già preso da un altra scheda nel frattempo: questa è scartata come doppione', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]] });
    f.prisma.gaiaInvite.create.mockRejectedValueOnce(doppione()).mockResolvedValueOnce({ id: 'x' });
    await f.svc.giro(ADESSO);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(f.prisma.gaiaInvite.create.mock.calls[1][0].data).toEqual({ crmRecordId: 'r1', email: null, esito: 'saltato:doppione' });
  });

  it('un errore del database che non è un doppione non si ingoia', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]] });
    f.prisma.gaiaInvite.create.mockRejectedValue(new Error('db giù'));
    await expect(f.svc.giro(ADESSO)).rejects.toThrow('db giù');
    // e il giro successivo può ripartire
    f.prisma.gaiaInvite.create.mockResolvedValue({ id: 'ok' });
    await expect(f.svc.giro(ADESSO)).resolves.toBeDefined();
  });

  it('invio fallito: la riga resta «fallito» (fuori dalla testa della coda); tre di fila e ci si ferma', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it'), lead('r2', 'b@example.it'), lead('r3', 'c@example.it'), lead('r4', 'd@example.it')]] });
    f.mail.send.mockResolvedValue(false);
    expect((await f.svc.giro(ADESSO)).inviti).toBe(0);
    expect(f.mail.send).toHaveBeenCalledTimes(3);
    expect(f.prisma.gaiaInvite.update.mock.calls.map((c) => c[0].data)).toEqual([
      { esito: 'fallito', tentativi: 1 },
      { esito: 'fallito', tentativi: 1 },
      { esito: 'fallito', tentativi: 1 },
    ]);
  });

  it('i falliti si riprovano dopo sei ore; se la scheda è cambiata torna in coda, se ha detto no esce', async () => {
    const f = costruisci({
      falliti: [
        { id: 'f1', email: 'a@example.it', tentativi: 1, crmRecord: { ...lead('r1', 'a@example.it'), stage: 'lead_in' } },
        { id: 'f2', email: 'b@example.it', tentativi: 2, crmRecord: { ...lead('r2', 'corretta@example.it'), stage: 'lead_in' } },
        { id: 'f3', email: 'c@example.it', tentativi: 1, crmRecord: { ...lead('r3', 'c@example.it'), stage: 'lead_in' } },
        { id: 'f4', email: 'd@example.it', tentativi: 1, crmRecord: { ...lead('r4', 'd@example.it'), stage: 'lead_in', consentChannels: ['sms'] } },
        { id: 'f5', email: 'e@example.it', tentativi: 1, crmRecord: { ...lead('r5', 'e@example.it'), stage: 'lead_in' } },
      ],
      utenti: [{ email: 'e@example.it', secondaryEmail: null }],
    });
    f.marketing.filtraConsensi.mockImplementation((r: { id: string }[]) => Promise.resolve(r.filter((x) => x.id !== 'r3')));
    expect((await f.svc.giro(ADESSO)).inviti).toBe(1);
    const where = f.prisma.gaiaInvite.findMany.mock.calls.find((c) => c[0].where.esito === 'fallito')![0].where;
    expect(where.tentativi).toEqual({ lt: 3 });
    expect(where.ultimoTentativoAt.lte.toISOString()).toBe(new Date(ADESSO.getTime() - 6 * 3600_000).toISOString());
    expect(f.mail.send.mock.calls.map((c) => c[0].to)).toEqual(['a@example.it']);
    // indirizzo corretto dallo staff: la riga sparisce e la scheda torna in coda
    expect(f.prisma.gaiaInvite.deleteMany).toHaveBeenCalledWith({ where: { id: 'f2', esito: 'fallito', tentativi: 2 } });
    // ha detto no / canale / account: esce, e l'indirizzo si libera
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith({ where: { id: 'f3', esito: 'fallito' }, data: { esito: 'saltato:consenso', email: null } });
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith({ where: { id: 'f4', esito: 'fallito' }, data: { esito: 'saltato:canale', email: null } });
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith({ where: { id: 'f5', esito: 'fallito' }, data: { esito: 'saltato:account', email: null } });
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1', esito: 'fallito', tentativi: 1 }, data: expect.objectContaining({ tentativi: 2, esito: 'invio' }) }),
    );
  });

  it('i riprovati si fermano dopo tre errori di fila', async () => {
    const f = costruisci({
      falliti: ['1', '2', '3', '4'].map((i) => ({ id: `f${i}`, email: `${i}@example.it`, tentativi: 1, crmRecord: { ...lead(`r${i}`, `${i}@example.it`), stage: 'lead_in' } })),
    });
    f.mail.send.mockResolvedValue(false);
    await f.svc.mandaInviti({ attivo: true, alGiorno: 100, promemoriaGiorni: 15, oraDa: 9, oraA: 20, linkOre: 48 }, ADESSO);
    // tre riprovati, poi il giro normale (nessun lotto) non manda altro
    expect(f.mail.send).toHaveBeenCalledTimes(3);
  });

  it('un errore dentro l invio (segreto mancante) vale come invio fallito, non blocca la riga su «invio»', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]] });
    (f.svc as unknown as { linkPer: () => never }).linkPer = () => { throw new Error('segreto mancante'); };
    expect((await f.svc.giro(ADESSO)).inviti).toBe(0);
    expect(f.prisma.gaiaInvite.update).toHaveBeenCalledWith({ where: { id: 'inv-r1' }, data: { esito: 'fallito', tentativi: 1 } });
  });

  it('modello disattivato dal backoffice: niente parte', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]], modello: { key: 'gaia_invito', subject: 's', bodyHtml: 'b', active: false } });
    await f.svc.giro(ADESSO);
    expect(f.mail.send).not.toHaveBeenCalled();
  });

  it('modello ritoccato dal backoffice: usa quello', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]], modello: { key: 'gaia_invito', subject: 'Ehi {{nome}}', bodyHtml: '<p>{{link_prova}}</p>', active: true } });
    await f.svc.giro(ADESSO);
    expect(f.mail.send.mock.calls[0][0].subject).toBe('Ehi Maria');
  });

  it('due giri insieme nello stesso processo: il secondo non parte', async () => {
    const f = costruisci({ lotti: [[lead('r1', 'a@example.it')]] });
    const [a, b] = await Promise.all([f.svc.giro(ADESSO), f.svc.giro(ADESSO)]);
    expect([a.nota, b.nota]).toContain('giro già in corso');
  });
});

describe('InvitoGaiaService — il promemoria', () => {
  const riga = (id: string, extra: Record<string, unknown> = {}, rigaExtra: Record<string, unknown> = {}) => ({
    id: `inv-${id}`,
    email: `${id}@example.it`,
    reminderEsito: null,
    crmRecord: { ...lead(id, `${id}@example.it`), stage: 'lead_in', client: null, ...extra },
    ...rigaExtra,
  });

  it('cerca inviti partiti da 15 giorni, senza entrata, mai promemoria o fallito una volta sei ore fa', async () => {
    const f = costruisci({ params: { gaia_invito_al_giorno: '0' } });
    await f.svc.giro(ADESSO);
    const where = f.prisma.gaiaInvite.findMany.mock.calls.find((c) => c[0].where.esito === 'inviato')![0].where;
    expect(where.sentAt.lte.toISOString()).toBe(new Date(ADESSO.getTime() - 15 * 86_400_000).toISOString());
    expect(where.enteredAt).toBeNull();
    expect(where.OR[0]).toEqual({ reminderEsito: null });
    expect(where.OR[1].reminderEsito).toBe('fallito:1');
  });

  it('manda a chi non è entrata; salta chi ha la password, chi si è registrata, le clienti, chi ha detto no, chi ha cambiato email', async () => {
    const f = costruisci({
      params: { gaia_invito_al_giorno: '0' },
      promemoria: [
        riga('r1'),
        riga('r2', { clientId: 'u2', client: { mustChangePassword: false } }),
        riga('r3', { stage: 'paid' }),
        riga('r4'),
        riga('r5', { clientId: 'u5', client: { mustChangePassword: true } }),
        riga('r6'),
        riga('r7', { email: 'nuova@example.it' }),
        riga('r8', { consentChannels: ['sms'] }),
      ],
      utenti: [{ email: 'r6@example.it', secondaryEmail: null }],
    });
    f.marketing.filtraConsensi.mockImplementation((r: { id: string }[]) => Promise.resolve(r.filter((x) => x.id !== 'r4')));
    expect((await f.svc.giro(ADESSO)).promemoria).toBe(2);
    expect(f.mail.send.mock.calls.map((c) => c[0].to)).toEqual(['r1@example.it', 'r5@example.it']);
    expect(f.mail.send.mock.calls[0][0].subject).toBe('Maria, Gaia ti sta ancora aspettando 💜');
    const esiti = Object.fromEntries(f.prisma.gaiaInvite.updateMany.mock.calls.map((c) => [c[0].where.id, c[0].data.reminderEsito]));
    expect(esiti).toEqual({
      'inv-r1': 'invio',
      'inv-r2': 'saltato:entrata',
      'inv-r3': 'saltato:cliente',
      'inv-r4': 'saltato:consenso',
      'inv-r5': 'invio',
      'inv-r6': 'saltato:entrata',
      'inv-r7': 'saltato:cambiata',
      'inv-r8': 'saltato:canale',
    });
    expect(f.prisma.gaiaInvite.update).toHaveBeenCalledWith({ where: { id: 'inv-r1' }, data: { reminderEsito: 'inviato' } });
  });

  it('le colonne da cliente (acquisito, in sospensione) non ricevono il promemoria', async () => {
    const { STAGE_DA_CLIENTE } = jest.requireActual('../../commerce/sospensione-in-pipeline') as { STAGE_DA_CLIENTE: string[] };
    const f = costruisci({ params: { gaia_invito_al_giorno: '0' }, promemoria: STAGE_DA_CLIENTE.map((st, i) => riga(`c${i}`, { stage: st })) });
    await f.svc.giro(ADESSO);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(f.prisma.gaiaInvite.updateMany.mock.calls.every((c) => c[0].data.reminderEsito === 'saltato:cliente')).toBe(true);
  });

  it('invio fallito: si riprova una volta, poi basta', async () => {
    const f = costruisci({ params: { gaia_invito_al_giorno: '0' }, promemoria: [riga('r1'), riga('r2', {}, { reminderEsito: 'fallito:1' })] });
    f.mail.send.mockResolvedValue(false);
    await f.svc.giro(ADESSO);
    expect(f.prisma.gaiaInvite.update).toHaveBeenCalledWith({ where: { id: 'inv-r1' }, data: { reminderEsito: 'fallito:1' } });
    expect(f.prisma.gaiaInvite.update).toHaveBeenCalledWith({ where: { id: 'inv-r2' }, data: { reminderEsito: 'fallito' } });
    // la presa è condizionata all'esito letto: due giri non mandano due volte
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv-r2', reminderEsito: 'fallito:1' } }));
  });

  it('già preso da un altro giro: non manda', async () => {
    const f = costruisci({ params: { gaia_invito_al_giorno: '0' }, promemoria: [riga('r1')] });
    f.prisma.gaiaInvite.updateMany.mockResolvedValue({ count: 0 });
    await f.svc.giro(ADESSO);
    expect(f.mail.send).not.toHaveBeenCalled();
  });
});

describe('InvitoGaiaService — il link «Prova Gaia»', () => {
  const scheda = {
    id: 'r1', email: 'Maria@Example.com', name: 'Maria Rossi', firstName: null, phone: '333', clientId: null,
    assignedCoachId: 's-1', assignedNutritionistId: null, assignmentStatus: 'accepted',
    gaiaInvite: { email: 'maria@example.com', sentAt: new Date('2026-09-01') },
  };

  it('la pagina (GET) non crea niente e non mostra l email intera', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue(scheda);
    const html = await f.svc.paginaInizio(tokenInvito('r1', SEGRETO));
    expect(html).toContain('Maria, Gaia ti aspetta');
    expect(html).toContain('ma•••@example.com');
    expect(html).not.toContain('maria@example.com');
    expect(html).toContain('method="post"');
    expect(f.prisma.user.create).not.toHaveBeenCalled();
    expect(f.prisma.actionToken.create).not.toHaveBeenCalled();
  });

  it('token sbagliato: pagina di link non valido, nessuna lettura', async () => {
    const f = costruisci();
    const esito = await f.svc.inizia('r1.000');
    expect('pagina' in esito && esito.pagina).toContain('non funziona');
    expect(f.prisma.crmRecord.findUnique).not.toHaveBeenCalled();
  });

  it('⛔ la scheda ha cambiato indirizzo dopo l invito: il vecchio link non apre niente', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue({ ...scheda, email: 'figlia@example.org' });
    expect('pagina' in (await f.svc.inizia(tokenInvito('r1', SEGRETO)))).toBe(true);
    expect(await f.svc.paginaInizio(tokenInvito('r1', SEGRETO))).toContain('non funziona');
    expect(f.prisma.user.findFirst).not.toHaveBeenCalled();
    expect(f.prisma.user.create).not.toHaveBeenCalled();
    expect(f.prisma.actionToken.create).not.toHaveBeenCalled();
  });

  it('scheda senza invito partito (scartata, fallita o mai invitata): il link non apre niente', async () => {
    for (const gaiaInvite of [null, { email: null, sentAt: null }, { email: 'maria@example.com', sentAt: null }]) {
      const f = costruisci();
      f.prisma.crmRecord.findUnique.mockResolvedValue({ ...scheda, gaiaInvite });
      expect('pagina' in (await f.svc.inizia(tokenInvito('r1', SEGRETO)))).toBe(true);
      expect(f.prisma.actionToken.create).not.toHaveBeenCalled();
    }
  });

  it('cerca l account anche per indirizzo secondario', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue(scheda);
    await f.svc.inizia(tokenInvito('r1', SEGRETO));
    expect(f.prisma.user.findFirst.mock.calls[0][0].where).toEqual({ OR: [{ email: 'maria@example.com' }, { secondaryEmail: 'maria@example.com' }] });
  });

  it('account già collegato a un altra scheda: il collegamento non fa fallire il link', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue(scheda);
    f.prisma.user.findFirst.mockResolvedValue({ id: 'u-1', role: 'client', mustChangePassword: true, status: 'active', deletedAt: null });
    f.prisma.crmRecord.updateMany.mockRejectedValue(doppione());
    const esito = await f.svc.inizia(tokenInvito('r1', SEGRETO));
    expect('vai' in esito && esito.vai).toContain('/reset-password?token=');
  });

  it('un token delle preferenze non apre l account', async () => {
    const f = costruisci();
    const esito = await f.svc.inizia(prefsToken('r1', SEGRETO));
    expect('pagina' in esito).toBe(true);
  });

  it('senza account: lo crea, collega la scheda, e porta alla scelta della password', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue(scheda);
    const esito = await f.svc.inizia(tokenInvito('r1', SEGRETO));
    expect(f.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'maria@example.com', role: 'client', mustChangePassword: true, firstName: 'Maria', phone: '333' }) }),
    );
    expect(f.prisma.crmRecord.updateMany).toHaveBeenCalledWith({ where: { id: 'r1', clientId: null }, data: { clientId: 'u-nuovo' } });
    const tok = f.prisma.actionToken.create.mock.calls[0][0].data;
    expect(tok.userId).toBe('u-nuovo');
    expect(tok.type).toBe('password_reset');
    const ore = (tok.expiresAt.getTime() - Date.now()) / 3600_000;
    expect(ore).toBeGreaterThan(47.9);
    expect(ore).toBeLessThan(48.1);
    expect('vai' in esito && esito.vai).toMatch(/^https:\/\/app\.metabole\.eu\/reset-password\?token=[0-9a-f]{64}$/);
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith({ where: { crmRecordId: 'r1', clickedAt: null }, data: { clickedAt: expect.any(Date) } });
  });

  it('chi ha già scelto la sua password va all accesso, senza token', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue({ ...scheda, clientId: 'u-1' });
    f.prisma.user.findFirst.mockResolvedValue({ id: 'u-1', role: 'client', mustChangePassword: false, status: 'active', deletedAt: null });
    const esito = await f.svc.inizia(tokenInvito('r1', SEGRETO));
    expect(esito).toEqual({ vai: 'https://app.metabole.eu/login' });
    expect(f.prisma.actionToken.create).not.toHaveBeenCalled();
    expect(f.prisma.user.create).not.toHaveBeenCalled();
  });

  it('un indirizzo dello staff non diventa mai un reset dal link', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue(scheda);
    f.prisma.user.findFirst.mockResolvedValue({ id: 'u-staff', role: 'coach', mustChangePassword: true, status: 'active', deletedAt: null });
    expect(await f.svc.inizia(tokenInvito('r1', SEGRETO))).toEqual({ vai: 'https://app.metabole.eu/login' });
    expect(f.prisma.actionToken.create).not.toHaveBeenCalled();
  });

  it('account già creato ma mai usato: nessun doppione, nuovo token', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue(scheda);
    f.prisma.user.findFirst.mockResolvedValue({ id: 'u-1', role: 'client', mustChangePassword: true, status: 'active', deletedAt: null });
    const esito = await f.svc.inizia(tokenInvito('r1', SEGRETO));
    expect(f.prisma.user.create).not.toHaveBeenCalled();
    expect(f.prisma.actionToken.create.mock.calls[0][0].data.userId).toBe('u-1');
    expect('vai' in esito && esito.vai).toContain('/reset-password?token=');
  });

  it('doppio clic: se la creazione fallisce riusa l account appena nato', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue(scheda);
    f.prisma.user.create.mockRejectedValue(new Error('unique'));
    f.prisma.user.findUnique.mockResolvedValue({ id: 'u-altro', role: 'client', mustChangePassword: true, status: 'active', deletedAt: null });
    await f.svc.inizia(tokenInvito('r1', SEGRETO));
    expect(f.prisma.actionToken.create.mock.calls[0][0].data.userId).toBe('u-altro');
  });
});

describe('InvitoGaiaService — cancellarsi', () => {
  it('la pagina (GET) non disiscrive nessuno', async () => {
    const f = costruisci();
    f.prisma.crmRecord.findUnique.mockResolvedValue({ id: 'r1', email: 'maria@example.com' });
    const html = await f.svc.paginaCancellami(prefsToken('r1', SEGRETO));
    expect(html).toContain('Sì, cancellami');
    expect(f.marketing.oneClickUnsubscribe).not.toHaveBeenCalled();
  });

  it('il pulsante (POST) disiscrive con la stessa logica delle campagne', async () => {
    const f = costruisci();
    const t = prefsToken('r1', SEGRETO);
    expect(await f.svc.cancellami(t)).toContain('sei fuori dalla lista');
    expect(f.marketing.oneClickUnsubscribe).toHaveBeenCalledWith(t);
  });

  it('token sbagliato o scheda sparita: pagina di link non valido', async () => {
    const f = costruisci();
    expect(await f.svc.cancellami('r1.00')).toContain('non funziona');
    expect(f.marketing.oneClickUnsubscribe).not.toHaveBeenCalled();
    f.marketing.oneClickUnsubscribe.mockRejectedValue(new Error('404'));
    expect(await f.svc.cancellami(prefsToken('r1', SEGRETO))).toContain('non funziona');
  });
});

describe('InvitoGaiaService — impostazioni e prova', () => {
  it('ora di inizio dopo quella di fine: rifiutata, niente scritto', async () => {
    const f = costruisci();
    await expect(f.svc.aggiorna({ oraDa: 21 }, 'adm')).rejects.toThrow(/prima dell/);
    expect(f.configParams.update).not.toHaveBeenCalled();
  });

  it('scrive solo quello che cambia', async () => {
    const f = costruisci();
    await f.svc.aggiorna({ attivo: true, alGiorno: 50 }, 'adm');
    expect(f.configParams.update.mock.calls).toEqual([
      ['gaia_invito_attivo', 'true', 'adm'],
      ['gaia_invito_al_giorno', '50', 'adm'],
    ]);
  });

  it('la prova manda le due email con [PROVA] e senza segnaposto', async () => {
    const f = costruisci();
    await f.svc.prova('io@x.it', 'adm');
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    for (const c of f.mail.send.mock.calls) {
      expect(c[0].subject.startsWith('[PROVA] Maria')).toBe(true);
      expect(c[0].html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
    }
  });

  it('prova non partita: lo dice', async () => {
    const f = costruisci();
    f.mail.send.mockResolvedValue(false);
    await expect(f.svc.prova('io@x.it', 'adm')).rejects.toThrow(/BREVO/);
  });
});

describe('InvitoGaiaService — gli elenchi del pannello (17/9)', () => {
  const scheda = (id: string, extra: Record<string, unknown> = {}) => ({
    id, email: `${id}@example.it`, name: 'Maria Grazia Cerchiara', firstName: null, lastName: null, clientId: null, createdAt: new Date('2026-09-01T10:00:00Z'), ...extra,
  });

  it('inviati: solo esito inviato, dal più recente, con nome e cognome divisi e la data d invio', async () => {
    const f = costruisci();
    f.prisma.gaiaInvite.count.mockResolvedValue(1);
    f.prisma.gaiaInvite.findMany.mockResolvedValue([
      { email: 'maria@example.it', esito: 'inviato', sentAt: new Date('2026-09-17T07:01:04Z'), createdAt: new Date(), crmRecord: scheda('r1', { clientId: 'u1' }) },
    ]);
    const e = await f.svc.elenco('inviati');
    const arg = f.prisma.gaiaInvite.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ AND: [{ esito: 'inviato' }] });
    expect(arg.orderBy[0]).toEqual({ sentAt: { sort: 'desc', nulls: 'last' } });
    expect(arg.take).toBe(50);
    expect(arg.skip).toBe(0);
    expect(e).toEqual({
      tipo: 'inviati', pagina: 1, perPagina: 50, totale: 1,
      righe: [{ recordId: 'r1', clientId: 'u1', nome: 'Maria Grazia', cognome: 'Cerchiara', email: 'maria@example.it', quando: '2026-09-17T07:01:04.000Z', motivo: null }],
    });
  });

  it('ogni casella ha il suo filtro e la sua data', async () => {
    const attesi: Record<string, [object, string]> = {
      cliccati: [{ clickedAt: { not: null } }, 'clickedAt'],
      entrati: [{ enteredAt: { not: null } }, 'enteredAt'],
      promemoria: [{ reminderEsito: 'inviato' }, 'reminderSentAt'],
      scartati: [{ OR: [{ esito: { startsWith: 'saltato' } }, { esito: 'fallito' }] }, 'ultimoTentativoAt'],
    };
    for (const [tipo, [where, data]] of Object.entries(attesi)) {
      const f = costruisci();
      await f.svc.elenco(tipo as never);
      const arg = f.prisma.gaiaInvite.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ AND: [where] });
      expect(Object.keys(arg.orderBy[0])).toEqual([data]);
    }
  });

  it('oggi: gli stessi che conta la casella (tentativi di oggi, scartati esclusi), con il motivo se è fallito', async () => {
    const f = costruisci();
    f.prisma.gaiaInvite.findMany.mockResolvedValue([
      { email: 'a@example.it', esito: 'inviato', ultimoTentativoAt: new Date(), createdAt: new Date(), crmRecord: scheda('r1') },
      { email: 'b@example.it', esito: 'fallito', ultimoTentativoAt: new Date(), createdAt: new Date(), crmRecord: scheda('r2') },
    ]);
    const e = await f.svc.elenco('oggi');
    const w = f.prisma.gaiaInvite.findMany.mock.calls[0][0].where.AND[0];
    expect(w.NOT).toEqual({ esito: { startsWith: 'saltato' } });
    expect(Object.keys(w.ultimoTentativoAt)).toEqual(['gte']);
    expect(e.righe.map((r) => r.motivo)).toEqual([null, 'Invio non riuscito (si riprova più tardi)']);
  });

  it('scartati: il motivo in italiano, e la data di nascita della riga se manca il tentativo', async () => {
    const f = costruisci();
    f.prisma.gaiaInvite.findMany.mockResolvedValue([
      { email: null, esito: 'saltato:account', ultimoTentativoAt: null, createdAt: new Date('2026-09-17T07:00:00Z'), crmRecord: scheda('r1') },
    ]);
    const e = await f.svc.elenco('scartati');
    expect(e.righe[0]).toEqual(expect.objectContaining({ motivo: 'Ha già un account', email: 'r1@example.it', quando: '2026-09-17T07:00:00.000Z' }));
  });

  it('coda: le schede che il giro pescherebbe, con la ricerca e la pagina', async () => {
    const f = costruisci();
    f.prisma.crmRecord.count.mockResolvedValue(67358);
    f.prisma.crmRecord.findMany.mockResolvedValue([scheda('r9', { firstName: 'Lucia', lastName: 'Bianchi' })]);
    const e = await f.svc.elenco('coda', '3', ' bianchi ');
    const arg = f.prisma.crmRecord.findMany.mock.calls[0][0];
    expect(arg.where.AND[0]).toEqual(expect.objectContaining({ stage: 'lead_in', clientId: null, gaiaInvite: { is: null } }));
    expect(arg.where.AND[1].OR).toContainEqual({ email: { contains: 'bianchi', mode: 'insensitive' } });
    expect(arg.skip).toBe(100);
    expect(e.totale).toBe(67358);
    expect(e.righe[0]).toEqual(expect.objectContaining({ nome: 'Lucia', cognome: 'Bianchi', quando: '2026-09-01T10:00:00.000Z' }));
    expect(f.prisma.gaiaInvite.findMany).not.toHaveBeenCalled();
  });

  it('la ricerca sugli inviti passa dalla scheda', async () => {
    const f = costruisci();
    await f.svc.elenco('cliccati', 1, 'rossi');
    const w = f.prisma.gaiaInvite.findMany.mock.calls[0][0].where;
    expect(w.AND[1].crmRecord.OR).toContainEqual({ name: { contains: 'rossi', mode: 'insensitive' } });
    expect(f.prisma.gaiaInvite.count.mock.calls.at(-1)![0].where).toEqual(w);
  });

  it('una ricerca di una lettera sola non filtra', async () => {
    const f = costruisci();
    await f.svc.elenco('entrati', 1, 'r');
    expect(f.prisma.gaiaInvite.findMany.mock.calls[0][0].where.AND).toHaveLength(1);
  });
});
