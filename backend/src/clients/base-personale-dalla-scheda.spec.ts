/**
 * ⛔ **LA BASE PERSONALE NON SI RIFACEVA QUANDO A CAMBIARE LA DIETA ERA LO STAFF** — 2/9.
 *
 * `diag:fase9` ha mostrato Rosa, Arianna e Carla sulla famiglia **nuova** con la base personale
 * **vecchia** — una non l'aveva proprio. Non era un caso loro: erano state spostate dalla scheda
 * del backoffice, e `clients.service` non conosceva nemmeno `PersonalBaseService`. La ricostruzione
 * esisteva **solo** in `profile.service`, cioè quando è la cliente a toccare i suoi dati dall'app.
 *
 * ⚠️ Da `ClientMenuPool` pescano il cambio di piatto in chat e la giornata dettata dalla
 * nutrizionista: con la base ferma quelle due porte scelgono coi dati **di prima**, compresa
 * un'allergia aggiunta oggi dalla scheda.
 *
 * ⛔ È la stessa forma del difetto dei panieri dell'1/9 e dei segnali del 28/8: **due porte sulla
 * stessa colonna, e solo una faceva il lavoro.**
 */
import { ClientsService } from './clients.service';

function servizio(profiloPrima: Record<string, unknown> = { dietFamily: 'Pescetariana', regime: 'omnivore', dietStyle: 'mediterranean', allergies: [] }) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'client' }),
      update: jest.fn().mockReturnValue({ op: 'user.update' }),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(profiloPrima),
      upsert: jest.fn().mockReturnValue({ op: 'profile.upsert' }),
    },
    rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canManage: true }) },
    $transaction: jest.fn().mockResolvedValue([]),
  } as never;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const menu = { redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) };
  const personalBase = { buildPersonalBase: jest.fn().mockResolvedValue({}) };
  /** ⚠️ Le notifiche servono al solo caso «obiettivo raggiunto»: lì il servizio le manda davvero. */
  const notifiche = { notify: jest.fn().mockResolvedValue(undefined) };
  const s = new ClientsService(
    prisma, {} as never, audit as never, notifiche as never, menu as never,
    {} as never, {} as never, {} as never, {} as never, personalBase as never,
  );
  (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
  (s as unknown as { roleCanManage: () => Promise<boolean> }).roleCanManage = () => Promise.resolve(true);
  return { s, personalBase, audit };
}

describe('⛔ la scheda rifà la base personale', () => {
  it('⛔ cambiando la DIETA — è il caso di Rosa, Arianna e Carla', async () => {
    const { s, personalBase } = servizio();
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea' } as never);
    expect(personalBase.buildPersonalBase).toHaveBeenCalledWith('u1');
  });

  /**
   * ⛔ **Le allergie sono il motivo per cui la base esiste.** Una aggiunta dalla scheda che non la
   * rifà lascia dentro i piatti che la contengono, e il cambio di piatto in chat pesca proprio lì.
   */
  it('⛔ e aggiungendo un\'ALLERGIA', async () => {
    const { s, personalBase } = servizio({ dietFamily: 'Mediterranea', allergies: [] });
    await s.updateClient('u1', 'admin', { allergies: ['latte'] } as never);
    expect(personalBase.buildPersonalBase).toHaveBeenCalledWith('u1');
  });

  /** ⚠️ E per i campi che spostano la variante servita, non solo la famiglia. */
  it.each([
    ['regime', { regime: 'vegan' }],
    ['numero di pasti', { mealsPerDay: 3 }],
    ['percorso', { pathType: 'classic3' }],
    ['obiettivo', { objective: 'mantenimento' }],
  ])('⚠️ e cambiando %s', async (_, patch) => {
    const { s, personalBase } = servizio({ dietFamily: 'Mediterranea', regime: 'omnivore', mealsPerDay: 5, pathType: 'five', objective: 'dimagrimento' });
    await s.updateClient('u1', 'admin', patch as never);
    expect(personalBase.buildPersonalBase).toHaveBeenCalledWith('u1');
  });

  /**
   * ⛔ **CAMBIATI, non «mandati».** Il form della scheda rimanda TUTTI i campi a ogni Salva: su
   * «mandati» la base si rifarebbe a ogni click. È la stessa trappola in cui era caduta la regola
   * del senza-glutine, che girava su ogni salvataggio e il 31/8 ha fatto risultare a Patrizia
   * quattro cambi di dieta in un'ora, tutti annullati dentro la stessa richiesta.
   */
  it('⛔ ma NON quando la dieta viene rimandata uguale a com\'era', async () => {
    const { s, personalBase } = servizio({ dietFamily: 'Mediterranea', regime: 'omnivore' });
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea', regime: 'omnivore', name: 'Rosa' } as never);
    expect(personalBase.buildPersonalBase).not.toHaveBeenCalled();
  });

  it('⚠️ e nemmeno per un campo che non sposta le ricette', async () => {
    const { s, personalBase } = servizio();
    await s.updateClient('u1', 'admin', { name: 'Rosa Tinelli' } as never);
    expect(personalBase.buildPersonalBase).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **IL GLUTINE CAMBIA LA FAMIGLIA FUORI DA `profileData`** — trovato in revisione, 2/9.
 *
 * `assegnaSenzaGlutineEAvvisa` scrive `dietFamily` con una `updateMany` sua: quel cambio non
 * compare nel confronto prima/dopo, quindi una cliente che dichiara il glutine fra le
 * **intolleranze** o i **cibi non graditi** si vedeva cambiare la dieta e restava con la base di
 * prima. ⚠️ La prova che copre quel caso passava verde attraversandoci in mezzo, perché guardava
 * la famiglia e non la base.
 */
describe('⛔ il glutine dichiarato altrove', () => {
  /** ⚠️ Il finto della regola dev'essere quello vero: è lui che decide se la famiglia cambia. */
  function conGlutine(patch: Record<string, unknown>, prima: Record<string, unknown>) {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'client' }), update: jest.fn().mockReturnValue({}) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue(prima),
        upsert: jest.fn().mockReturnValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'd-sg', name: 'Mediterranea senza glutine', style: 'mediterranean' }) },
      rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canManage: true }) },
      $transaction: jest.fn().mockResolvedValue([]),
    } as never;
    const personalBase = { buildPersonalBase: jest.fn().mockResolvedValue({}) };
    const s = new ClientsService(
      prisma, {} as never, { log: jest.fn().mockResolvedValue(undefined) } as never,
      { notify: jest.fn().mockResolvedValue(undefined) } as never,
      { redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) } as never,
      {} as never, {} as never, {} as never, {} as never, personalBase as never,
    );
    (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
    (s as unknown as { roleCanManage: () => Promise<boolean> }).roleCanManage = () => Promise.resolve(true);
    return { s, personalBase, patch };
  }

  it.each([
    ['fra le INTOLLERANZE', { intolerances: ['glutine'] }],
    ['fra i CIBI NON GRADITI', { dislikedFoods: ['glutine'] }],
  ])('⛔ dichiarato %s, la famiglia cambia e la base si rifà', async (_, patch) => {
    const { s, personalBase } = conGlutine(patch, {
      dietFamily: 'Mediterranea', regime: 'omnivore', allergies: [], intolerances: [], dislikedFoods: [],
    });
    await s.updateClient('u1', 'admin', patch as never);
    expect(personalBase.buildPersonalBase).toHaveBeenCalledWith('u1');
  });

  /**
   * ⚠️ **E non a ogni salvataggio.** La regola scatta solo quando la dichiarazione **cambia**: chi
   * il glutine ce l'aveva già non fa ricostruire niente rimandando gli stessi campi — è la stessa
   * lezione dei quattro cambi di dieta di Patrizia del 31/8.
   */
  it('⚠️ ma non se il glutine era già dichiarato prima', async () => {
    const { s, personalBase } = conGlutine({ intolerances: ['glutine'] }, {
      dietFamily: 'Mediterranea senza glutine', regime: 'omnivore',
      allergies: [], intolerances: ['glutine'], dislikedFoods: [],
    });
    await s.updateClient('u1', 'admin', { intolerances: ['glutine'] } as never);
    expect(personalBase.buildPersonalBase).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **NON BLOCCANTE, MA NON MUTO.** Il salvataggio della scheda non deve fallire se la
 * ricostruzione va male; ma una base non rifatta è **invisibile** — la pagina dice «salvato», la
 * cliente non vede niente, e il disallineamento si scopre contando a mano tre giorni dopo. È
 * esattamente com'è arrivato fin qui.
 */
describe('⛔ quando la ricostruzione fallisce', () => {
  function servizioRotto() {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'client' }), update: jest.fn().mockReturnValue({}) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ dietFamily: 'Pescetariana' }),
        upsert: jest.fn().mockReturnValue({}),
      },
      rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canManage: true }) },
      $transaction: jest.fn().mockResolvedValue([]),
    } as never;
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const personalBase = { buildPersonalBase: jest.fn().mockRejectedValue(new Error('profilo incompleto')) };
    const s = new ClientsService(
      prisma, {} as never, audit as never, {} as never,
      { redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) } as never,
      {} as never, {} as never, {} as never, {} as never, personalBase as never,
    );
    (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
    (s as unknown as { roleCanManage: () => Promise<boolean> }).roleCanManage = () => Promise.resolve(true);
    return { s, audit, personalBase };
  }

  it('⚠️ il salvataggio della scheda riesce lo stesso', async () => {
    const { s } = servizioRotto();
    await expect(s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea' } as never))
      .resolves.toMatchObject({ updated: true });
  });

  it('⛔ ma finisce nell\'audit, col motivo e coi campi', async () => {
    const { s, audit } = servizioRotto();
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea' } as never);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'client.personal_base_failed',
      entityId: 'u1',
      metadata: expect.objectContaining({ campi: ['dietFamily'], errore: 'profilo incompleto' }),
    }));
  });
});
