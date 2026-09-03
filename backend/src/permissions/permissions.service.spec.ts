import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { DEFAULT_ESPLICITI, DEFAULT_PERMISSIONS, NON_EREDITANO } from './pages';
import { PermissionsService } from './permissions.service';

describe('Matrice permessi (default da specifica sez. 4)', () => {
  it('la coach NON vede i documenti sanitari', () => {
    expect(DEFAULT_PERMISSIONS.coach.health_documents).toBeUndefined();
  });

  it('il commerciale NON vede dati sanitari né clienti', () => {
    expect(DEFAULT_PERMISSIONS.sales.health_documents).toBeUndefined();
    expect(DEFAULT_PERMISSIONS.sales.clients).toBeUndefined();
    expect(DEFAULT_PERMISSIONS.sales.crm_leads).toEqual({ view: true, manage: true });
  });

  it('l\'admin NON accede ai documenti sanitari di default', () => {
    expect(DEFAULT_PERMISSIONS.admin.health_documents).toBeUndefined();
    expect(DEFAULT_PERMISSIONS.admin.users).toEqual({ view: true, manage: true });
  });

  it('nutrizionista e capo gestiscono cartelle e documenti sanitari', () => {
    expect(DEFAULT_PERMISSIONS.nutritionist.health_documents).toEqual({ view: true, manage: true });
    expect(DEFAULT_PERMISSIONS.head_nutritionist.diets_catalog).toEqual({ view: true, manage: true });
  });

  it('il ruolo client non ha alcuna pagina di backoffice', () => {
    expect(Object.keys(DEFAULT_PERMISSIONS.client)).toHaveLength(0);
  });
});

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ role: 'coach', pageKey: 'crm_leads', canView: true, canManage: false }),
      },
    };
    audit = { log: jest.fn() };
    const roles = {
      // sistema + un ruolo personalizzato di prova
      validKeys: jest.fn().mockResolvedValue(new Set(['coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin', 'client', 'segreteria'])),
      listAll: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: RolesService, useValue: roles },
      ],
    }).compile();
    service = moduleRef.get(PermissionsService);
  });

  it('aggiorna un permesso e logga in audit', async () => {
    await service.update({ role: 'coach', pageKey: 'crm_leads', canView: true }, 'admin-1');
    expect(prisma.rolePagePermission.upsert).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.permissions.update' }),
    );
  });

  it('syncDefaults crea solo le righe mancanti dai default (Parametri/Chat inclusi)', async () => {
    /**
     * ⚠️ **Il finto rende il conteggio vero, come `createMany` del database.** `syncDefaults` adesso
     * restituisce `esito.count` e non più le righe *proposte*: un finto che dice sempre zero
     * farebbe passare per «non ha creato niente» un giro che ha creato tutto.
     */
    const createMany = jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }));
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([]), // nessuna riga esistente
        createMany,
      },
      customRole: {
        findMany: jest.fn().mockResolvedValue([{ key: 'segreteria', baseRole: 'sales' }]),
      },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    const res = await svc.syncDefaults();
    expect(res.created).toBeGreaterThan(0);
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string; canView: boolean }[];
    const adminEngine = data.find((d) => d.role === 'admin' && d.pageKey === 'engine_config');
    expect(adminEngine?.canView).toBe(true); // Parametri torna visibile all'admin
    // il ruolo personalizzato eredita i default del ruolo di base per le sezioni nuove
    const customPosta = data.find((d) => d.role === 'segreteria' && d.pageKey === 'posta');
    expect(customPosta?.canView).toBe(true);
    const customUsers = data.find((d) => d.role === 'segreteria' && d.pageKey === 'users');
    expect(customUsers?.canView).toBe(false);
    // non ricrea righe già presenti
    (p2.rolePagePermission.findMany as jest.Mock).mockResolvedValue([{ role: 'admin', pageKey: 'engine_config' }]);
    createMany.mockClear();
    await svc.syncDefaults();
    const data2 = createMany.mock.calls[0][0].data as { pageKey: string; role: string }[];
    expect(data2.find((d) => d.role === 'admin' && d.pageKey === 'engine_config')).toBeUndefined();
  });

  /**
   * ⛔ **LA PROMESSA DI `INHERIT_DEFAULTS`, MISURATA SUL SERVIZIO.**
   *
   * «Separare una schermata nei Permessi non toglie accesso a nessuno» — e la promessa vale nei due
   * versi. Fino al 2/9 la riga della figlia nasceva dal **default del codice**, quindi:
   * · al ruolo con la pagina accesa **a mano** la figlia nasceva spenta (si vede subito);
   * · ⛔ al ruolo con la pagina spenta **a mano** la figlia nasceva **accesa** — la pagina tornava a
   *   chi era stata tolta, e questo non lo segnala nessuno.
   *
   * `equivalence_groups` è figlia di `diets_catalog`, che di default il capo nutrizionista ha
   * acceso in gestione: la prova spegne quella riga a mano, come farebbe Simone dai Permessi.
   */
  it('⛔ una figlia nasce dalla RIGA del genitore, non dal suo default (verso spento)', async () => {
    /**
     * ⚠️ **Il finto rende il conteggio vero, come `createMany` del database.** `syncDefaults` adesso
     * restituisce `esito.count` e non più le righe *proposte*: un finto che dice sempre zero
     * farebbe passare per «non ha creato niente» un giro che ha creato tutto.
     */
    const createMany = jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }));
    const p2 = {
      rolePagePermission: {
        // La riga vera: il capo ha il catalogo SPENTO a mano, mentre il default lo dà acceso.
        findMany: jest.fn().mockResolvedValue([
          { role: 'head_nutritionist', pageKey: 'diets_catalog', canView: false, canManage: false },
        ]),
        createMany,
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    await svc.syncDefaults();
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string; canView: boolean; canManage: boolean }[];
    const figlia = data.find((d) => d.role === 'head_nutritionist' && d.pageKey === 'equivalence_groups');
    expect(figlia).toBeDefined();
    // ⛔ Col difetto: canView true, cioè la pagina torna a chi il catalogo era stato tolto.
    expect(figlia?.canView).toBe(false);
    expect(figlia?.canManage).toBe(false);
    // ⚠️ E il default del capo su quella pagina è davvero acceso: senza, la prova sarebbe vuota.
    expect(DEFAULT_PERMISSIONS.head_nutritionist.equivalence_groups).toEqual({ view: true, manage: true });
  });

  it('⛔ e nell\'altro verso: genitore acceso a mano dove il default è spento', async () => {
    /**
     * ⚠️ **Il finto rende il conteggio vero, come `createMany` del database.** `syncDefaults` adesso
     * restituisce `esito.count` e non più le righe *proposte*: un finto che dice sempre zero
     * farebbe passare per «non ha creato niente» un giro che ha creato tutto.
     */
    const createMany = jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }));
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'coach', pageKey: 'diets_catalog', canView: true, canManage: true },
        ]),
        createMany,
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    await svc.syncDefaults();
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string; canView: boolean }[];
    const figlia = data.find((d) => d.role === 'coach' && d.pageKey === 'equivalence_groups');
    expect(figlia?.canView).toBe(true);
    // ⚠️ E il default della coach su quella pagina è spento: senza, la prova sarebbe vuota.
    expect(DEFAULT_PERMISSIONS.coach.equivalence_groups).toBeUndefined();
  });

  /**
   * ⚠️ **Un ruolo personalizzato eredita dalla riga del GENITORE DI QUEL RUOLO**, non da quella del
   * ruolo di base: sono due ruoli diversi e possono avere permessi diversi. Il default del ruolo di
   * base resta il ripiego quando il genitore non ha ancora una riga sua.
   */
  it('⚠️ un ruolo personalizzato eredita dalla propria riga di genitore', async () => {
    /**
     * ⚠️ **Il finto rende il conteggio vero, come `createMany` del database.** `syncDefaults` adesso
     * restituisce `esito.count` e non più le righe *proposte*: un finto che dice sempre zero
     * farebbe passare per «non ha creato niente» un giro che ha creato tutto.
     */
    const createMany = jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }));
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'segreteria', pageKey: 'diets_catalog', canView: true, canManage: false },
          { role: 'sales', pageKey: 'diets_catalog', canView: false, canManage: false },
        ]),
        createMany,
      },
      customRole: { findMany: jest.fn().mockResolvedValue([{ key: 'segreteria', baseRole: 'sales' }]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    await svc.syncDefaults();
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string; canView: boolean; canManage: boolean }[];
    const figlia = data.find((d) => d.role === 'segreteria' && d.pageKey === 'equivalence_groups');
    expect(figlia).toMatchObject({ canView: true, canManage: false });
  });

  /**
   * ⚠️ **Le righe già scritte non si toccano**, ed è la parte che questa correzione **non** fa: una
   * riga sbagliata dal difetto vecchio è indistinguibile da una scelta dell'admin, e riscriverla
   * sarebbe decidere al posto suo.
   */
  it('⚠️ una figlia che ha già la sua riga non viene toccata, per quanto sia diversa dal genitore', async () => {
    /**
     * ⚠️ **Il finto rende il conteggio vero, come `createMany` del database.** `syncDefaults` adesso
     * restituisce `esito.count` e non più le righe *proposte*: un finto che dice sempre zero
     * farebbe passare per «non ha creato niente» un giro che ha creato tutto.
     */
    const createMany = jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }));
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'coach', pageKey: 'diets_catalog', canView: false, canManage: false },
          { role: 'coach', pageKey: 'equivalence_groups', canView: true, canManage: true },
        ]),
        createMany,
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    await svc.syncDefaults();
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string }[];
    expect(data.find((d) => d.role === 'coach' && d.pageKey === 'equivalence_groups')).toBeUndefined();
  });

  /**
   * ⚠️ **Chi ha ereditato lascia una riga nel log.** Un permesso che compare senza che nessuno
   * l'abbia acceso deve essere rintracciabile, o al primo controllo della matrice nessuno saprà da
   * dove viene.
   */
  /**
   * ⛔ **LA RIGA DEL GENITORE È QUELLA DI QUEL RUOLO.** Nella prima stesura la funzione riceveva
   * `(role, pageKey)` e nessuna prova del servizio legava i due: la mutazione «prendi la riga del
   * genitore di un ruolo qualsiasi» — la coach che eredita la riga dell'**admin** — passava verde.
   */
  it('⛔ la figlia NON eredita dalla riga di un altro ruolo', async () => {
    const createMany = jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }));
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'admin', pageKey: 'diets_catalog', canView: true, canManage: true },
          { role: 'coach', pageKey: 'diets_catalog', canView: false, canManage: false },
        ]),
        createMany,
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    await svc.syncDefaults();
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string; canView: boolean }[];
    expect(data.find((d) => d.role === 'coach' && d.pageKey === 'equivalence_groups')?.canView).toBe(false);
  });

  /**
   * ⛔ **UNA PAGINA «HUB» NON EREDITA.** `diet_workspace` è figlia di `diets_catalog` **e** grantor
   * di `diets_catalog` + `recipes`: ereditare la riga del genitore le darebbe di aprire `recipes`,
   * che il genitore non apre — cioè «non toglie **e non dà** accesso a nessuno» sarebbe falso
   * proprio sulle due chiavi che lato server contano davvero.
   */
  it('⛔ una figlia che è anche «hub» non eredita: nasce dal suo default', async () => {
    const createMany = jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }));
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'coach', pageKey: 'diets_catalog', canView: true, canManage: true },
        ]),
        createMany,
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    await svc.syncDefaults();
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string; canView: boolean }[];
    // La coach non ha `diet_workspace` fra i default: non lo prende dal catalogo acceso a mano.
    expect(data.find((d) => d.role === 'coach' && d.pageKey === 'diet_workspace')?.canView).toBe(false);
    // ⚠️ E la figlia che NON è hub lo eredita: senza, la prova sarebbe verde per la ragione sbagliata.
    expect(data.find((d) => d.role === 'coach' && d.pageKey === 'equivalence_groups')?.canView).toBe(true);
  });

  it('⚠️ le righe ereditate finiscono nel log, col genitore da cui vengono', async () => {
    const log = jest.fn();
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'coach', pageKey: 'diets_catalog', canView: true, canManage: true },
        ]),
        createMany: jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length })),
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    (svc as unknown as { logger: { log: jest.Mock } }).logger = { log } as never;
    await svc.syncDefaults();
    const righe = log.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(righe.some((r) => /ereditate dalla riga del genitore/.test(r) && /coach:equivalence_groups←diets_catalog/.test(r))).toBe(true);
  });

  /**
   * ⛔ **E NEL REGISTRO, non solo nel log.** Un permesso che compare senza che nessuno l'abbia
   * acceso dev'essere rintracciabile mesi dopo, e i log di Render non lo sono.
   */
  it('⛔ chi eredita lascia una riga in AuditLog, con l\'elenco dentro', async () => {
    const audit = { log: jest.fn() };
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'coach', pageKey: 'diets_catalog', canView: true, canManage: true },
        ]),
        createMany: jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length })),
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, audit as never, {} as never);
    await svc.syncDefaults();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.permissions.inherited' }));
    const riga = audit.log.mock.calls[0][0] as { metadata: { quante: number; righe: string[] } };
    expect(riga.metadata.quante).toBeGreaterThan(0);
    expect(riga.metadata.righe.some((r) => r.startsWith('coach:equivalence_groups←diets_catalog'))).toBe(true);
    // ⚠️ L'elenco è INTERO nel registro: il taglio a venti è solo del log di Render.
    expect(riga.metadata.righe).toHaveLength(riga.metadata.quante);
  });

  /**
   * ⚠️ **L'istanza che ha perso la corsa non lascia una traccia di permessi che non ha creato.**
   * Su Render partono più istanze insieme: `skipDuplicates` fa scrivere una sola, e le altre
   * scriverebbero un registro falso.
   */
  it('⚠️ se `createMany` non ha scritto niente, niente registro e niente log', async () => {
    const audit = { log: jest.fn() };
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'coach', pageKey: 'diets_catalog', canView: true, canManage: true },
        ]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }), // ← l'altra istanza è arrivata prima
      },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, audit as never, {} as never);
    const res = await svc.syncDefaults();
    expect(res.created).toBe(0);
    expect(audit.log).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **`canView`/`canManage` vanno CHIESTI nel `select`**, e questa è un'asserzione sugli
   * **argomenti** della query, non sul risultato: il finto Prisma rende l'oggetto intero, quindi
   * togliendoli dal `select` tutte le prove qui sopra resterebbero verdi — e in produzione
   * l'ereditarietà leggerebbe `undefined` da ogni riga, cioè tornerebbe al difetto senza che nulla
   * cadesse. È l'ottava volta che un doppio più generoso del database vero copre proprio il codice
   * che dovrebbe provare (`menu/come-dal-database.ts`).
   */
  it('⛔ syncDefaults chiede i permessi nel `select`, non solo le chiavi', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const p2 = {
      rolePagePermission: { findMany, createMany: jest.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length })) },
      customRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    await svc.syncDefaults();
    expect(findMany.mock.calls[0][0].select).toEqual(
      expect.objectContaining({ role: true, pageKey: true, canView: true, canManage: true }),
    );
  });

  /**
   * ⛔ **GLI HUB HANNO IL LORO DEFAULT SCRITTO, e senza questa prova si può cancellare senza che
   * cada niente.** `diet_workspace` e `creation_validation` non ereditano più (concedono più del
   * genitore): se perdessero anche il default esplicito, nutrizionista e capo si troverebbero
   * «Gestione dieta» e «Creazione e validazione» **spente** ogni volta che la riga manca — cioè la
   * regola sarebbe chiusa da una porta e aperta dall'altra, al contrario.
   */
  it('⛔ le pagine «hub» hanno un default scritto a mano, non dedotto dall\'eredità', () => {
    for (const chiave of ['diet_workspace', 'creation_validation'] as const) {
      expect(NON_EREDITANO.has(chiave)).toBe(true);
      for (const ruolo of ['nutritionist', 'head_nutritionist', 'admin'] as const) {
        expect(DEFAULT_ESPLICITI[ruolo]?.[chiave]).toEqual({ view: true, manage: true });
      }
      // ⚠️ E la coach non ce l'ha, né scritto né dedotto: la prova sarebbe vuota se l'avessero tutti.
      expect(DEFAULT_ESPLICITI.coach?.[chiave]).toBeUndefined();
    }
  });

  it('rifiuta una sezione sconosciuta', async () => {
    await expect(
      service.update({ role: 'coach', pageKey: 'pagina_inventata', canView: true }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('anti-lockout: i permessi admin sulla gestione permessi non si toccano', async () => {
    await expect(
      service.update({ role: 'admin', pageKey: 'permissions', canView: false }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('getForRole restituisce solo le pagine visibili', async () => {
    prisma.rolePagePermission.findMany.mockResolvedValue([
      { pageKey: 'dashboard', canView: true, canManage: false },
    ]);
    const result = await service.getForRole('coach');
    expect(prisma.rolePagePermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'coach', canView: true } }),
    );
    expect(result.pages).toHaveLength(1);
  });
});
