/**
 * ⛔ **«PIANO BLOCCATO» DEVE USCIRE DALL'APP, O NON LO SA NESSUNO.**
 *
 * La segnalazione **ferma l'erogazione**: la cliente legge «Menu in preparazione», e l'unica che
 * può sbloccare è la nutrizionista. Fino al 4/9 l'avviso era solo la riga in tabella — la vedeva
 * chi apriva il backoffice. Simone, 4/9: alla nutrizionista **e** alla coach, su push **e posta**,
 * con il nome della cliente e il motivo dentro.
 *
 * ⚠️ Queste prove guardano il **trasporto** (le porte arrivano fino in fondo e non fanno fallire
 * niente); quali canali per quale categoria stanno in `canali-della-segnalazione.spec.ts`.
 */
import { apriSegnalazione, avvisaSegnalazione } from './apri-segnalazione';

function portePrisma(opts: { utenti?: unknown[] } = {}) {
  const create = jest.fn().mockResolvedValue({ id: 'e1' });
  return {
    escalation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create,
      update: jest.fn(),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        assignedCoachId: 'sc', assignedNutritionistId: 'sn', name: 'Ilaria',
      }),
    },
    staff: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'sn', userId: 'u-nutri' }, { id: 'sc', userId: 'u-coach' },
      ]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findMany: jest.fn().mockResolvedValue(opts.utenti ?? [
        { id: 'u-nutri', email: 'n@x.it', locale: 'it', prefs: {} },
        { id: 'u-coach', email: 'c@x.it', locale: 'it', prefs: {} },
      ]),
    },
  };
}

const porte = () => ({
  push: { sendToUser: jest.fn().mockResolvedValue(undefined) },
  mail: { sendStaffAlertEmail: jest.fn().mockResolvedValue(true) },
});

describe('«Piano bloccato» esce dall\'app', () => {
  it('push e posta arrivano alla nutrizionista E alla coach', async () => {
    const prisma = portePrisma();
    const canali = porte();
    await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'base non certificabile', canali,
    });
    expect(canali.push.sendToUser.mock.calls.map((c) => c[0]).sort()).toEqual(['u-coach', 'u-nutri']);
    expect(canali.mail.sendStaffAlertEmail.mock.calls.map((c) => c[0]).sort()).toEqual(['c@x.it', 'n@x.it']);
  });

  /**
   * ⚠️ **Il corpo nomina la cliente e dice il motivo** — decisione di Simone del 4/9, presa alla
   * domanda posta apposta. Sta scritto in una prova perché è la conseguenza che si vede: quel testo
   * finisce anche in `email_log`, che il backoffice mostra.
   */
  it('la posta porta il nome della cliente e il motivo', async () => {
    const prisma = portePrisma();
    const canali = porte();
    await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'base non certificabile', canali,
    });
    const [, , titolo, corpo] = canali.mail.sendStaffAlertEmail.mock.calls[0];
    expect(titolo).toBe('Piano bloccato');
    expect(corpo).toContain('Ilaria');
    expect(corpo).toContain('base non certificabile');
  });

  /** ⛔ La riga in app resta la traccia: si scrive comunque, ed è quella che tiene lo stato. */
  it('la riga in app si scrive anche senza le porte, come prima', async () => {
    const prisma = portePrisma();
    await apriSegnalazione(prisma as never, { clientId: 'c1', category: 'diet_blocked', reason: 'x' });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **Un avviso che non parte non deve far fallire la segnalazione.** È lo stesso incidente di
   * `notificaUtente`: la riga che tiene ferma l'erogazione vale più del disturbo che la annuncia.
   */
  it('se la push o la posta esplodono, la segnalazione nasce lo stesso', async () => {
    const prisma = portePrisma();
    const canali = {
      push: { sendToUser: jest.fn().mockRejectedValue(new Error('fcm giù')) },
      mail: { sendStaffAlertEmail: jest.fn().mockRejectedValue(new Error('brevo giù')) },
    };
    const esito = await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'x', canali,
    });
    expect(esito).toEqual({ id: 'e1' });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('e se non si riesce nemmeno a leggere i destinatari, la segnalazione nasce lo stesso', async () => {
    const prisma = portePrisma();
    prisma.user.findMany = jest.fn().mockRejectedValue(new Error('database giù'));
    const canali = porte();
    const esito = await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'x', canali,
    });
    /**
     * ⛔ **`esito` e non solo le righe in app**: `apriSegnalazione` rende `null` quando qualcosa
     * esplode, e senza questa riga un errore che risale dagli avvisi passerebbe inosservato — la
     * segnalazione sarebbe già scritta, ma chi chiama crederebbe di non averla aperta. È la
     * mutazione «un avviso che non parte fa fallire la segnalazione», che senza questo controllo
     * sopravviveva.
     */
    expect(esito).toEqual({ id: 'e1' });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(canali.push.sendToUser).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **Alla coach arriva il SUO testo**, quando la nutrizionista non è assegnata: «Serve il
   * nutrizionista». Se la push ricopiasse il testo generico, la coach leggerebbe sul telefono una
   * cosa diversa da quella che ha in elenco.
   */
  it('la push porta lo stesso testo della riga in app, quello di quella persona', async () => {
    const prisma = portePrisma();
    prisma.clientProfile.findUnique = jest.fn().mockResolvedValue({
      assignedCoachId: 'sc', assignedNutritionistId: null, name: 'Ilaria',
    });
    prisma.staff.findMany = jest.fn().mockResolvedValue([{ id: 'sc', userId: 'u-coach' }]);
    prisma.staff.findFirst = jest.fn().mockResolvedValue(null);
    const canali = porte();
    await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'base non certificabile', canali,
    });
    const inApp = prisma.notification.create.mock.calls.map((c) => (c[0] as never as { data: { userId: string; payload: { title: string; body: string } } }).data);
    const perCoach = inApp.find((d) => d.userId === 'u-coach');
    const push = canali.push.sendToUser.mock.calls.find((c) => c[0] === 'u-coach');
    expect(perCoach?.payload.title).toBe('Nutrizionista richiesto');
    expect(push?.[1]).toBe(perCoach?.payload.title);
    expect(push?.[2]).toBe(perCoach?.payload.body);
  });

  /**
   * ⛔ **I dati della push escono da `datiPush`, non da un oggetto scritto qui.** La prima stesura
   * ci metteva anche `escalationId` e `category`: l'app li **butta** (`CHIAVI_UTILI`), e comporli a
   * mano scavalcava il filtro che quel file esiste per tenere — «nessun contenuto sanitario nel
   * payload». Quindi il tocco apre la scheda della cliente, e la prova dice quello che succede.
   */
  it('la push porta i dati filtrati da datiPush, e niente di più', async () => {
    const prisma = portePrisma();
    const canali = porte();
    await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'x', canali,
    });
    expect(canali.push.sendToUser.mock.calls[0][3])
      .toEqual({ type: 'escalation_diet_blocked', clientId: 'c1' });
  });

  /** ⛔ Chi ha spento quel tipo nel profilo non viene disturbato — ma la riga in elenco ce l'ha. */
  it('chi ha spento l\'avviso non riceve nemmeno la posta', async () => {
    const prisma = portePrisma({ utenti: [
      { id: 'u-nutri', email: 'n@x.it', locale: 'it', prefs: { notificationsDisabled: ['escalation_diet_blocked'] } },
      { id: 'u-coach', email: 'c@x.it', locale: 'it', prefs: {} },
    ] });
    const canali = porte();
    await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'x', canali,
    });
    expect(canali.mail.sendStaffAlertEmail.mock.calls.map((c) => c[0])).toEqual(['c@x.it']);
  });

  it('l\'opt-out toglie il disturbo, non la segnalazione', async () => {
    const prisma = portePrisma({ utenti: [
      { id: 'u-nutri', email: 'n@x.it', locale: 'it', prefs: { notificationsDisabled: ['escalation_diet_blocked'] } },
      { id: 'u-coach', email: 'c@x.it', locale: 'it', prefs: {} },
    ] });
    const canali = porte();
    await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'x', canali,
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(canali.push.sendToUser.mock.calls.map((c) => c[0])).toEqual(['u-coach']);
  });

  /** ⚠️ Anche la RIAPERTURA dentro la tregua è un fatto nuovo, e va detta sugli stessi canali. */
  it('anche la riapertura dentro la tregua manda la push', async () => {
    const prisma = portePrisma();
    prisma.escalation.findFirst = jest.fn().mockResolvedValue({
      id: 'vecchia', status: 'resolved', resolvedAt: new Date(), updatedAt: new Date(),
    });
    const canali = porte();
    await apriSegnalazione(prisma as never, {
      clientId: 'c1', category: 'diet_blocked', reason: 'ancora bloccata',
      statoNonAvviso: true, canali,
    });
    expect(prisma.escalation.create).not.toHaveBeenCalled();
    expect(canali.push.sendToUser).toHaveBeenCalled();
    /**
     * ⛔ **E la posta NO.** È l'argine al diluvio: la nutrizionista corregge le allergie,
     * `resolveBlocks` chiude, la cliente apre l'app e il blocco torna — dieci volte in un
     * pomeriggio. La push è il fatto nuovo; dieci mail identiche sono il modo più rapido per far
     * smettere di leggere proprio quelle.
     */
    expect(canali.mail.sendStaffAlertEmail).not.toHaveBeenCalled();
  });

  /** ⚠️ Senza `prisma.user` (i finti minimi delle prove vecchie) la push parte lo stesso. */
  it('senza la lettura degli utenti la push parte e la posta no', async () => {
    const prisma = portePrisma() as Record<string, unknown>;
    delete prisma.user;
    const canali = porte();
    await avvisaSegnalazione(
      prisma as never,
      { destinatari: ['u-nutri'], assegnato: 'sn', serveNutrizionista: false, coachUserId: null, nomeCliente: 'Ilaria' } as never,
      { clientId: 'c1', category: 'diet_blocked', escalationId: 'e1', reason: 'x' },
      canali,
    );
    expect(canali.push.sendToUser).toHaveBeenCalledTimes(1);
    expect(canali.mail.sendStaffAlertEmail).not.toHaveBeenCalled();
  });
});
