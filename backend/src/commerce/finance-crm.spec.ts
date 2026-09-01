import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CrmService } from './crm.service';
import { PipelineService } from './pipeline.service';
import { FinanceService } from './finance.service';

describe('FinanceService (eventi economici automatici)', () => {
  let service: FinanceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ledgerEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
      },
      staffCompensation: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      pendingCommission: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      staff: {
        findUnique: jest.fn().mockResolvedValue({ managerId: 'staff-hn' }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          assignedCoachId: 'staff-c',
          assignedNutritionistId: 'staff-n',
          assignedCoach: { managerId: 'staff-mc' },
          assignedNutritionist: { managerId: 'staff-hn' },
        }),
      },
      // Le provvigioni ora sono importi in € sul PIANO dell'abbonamento (non %).
      // Piano da 297€ con quote: coach 29,70 · mgr 8,91 · nutri 44,55 · capo 14,85.
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          subscription: {
            plan: {
              priceCents: 29700,
              commissionCoachCents: 2970,
              commissionManagerCoachCents: 891,
              commissionNutritionistCents: 4455,
              commissionHeadNutritionistCents: 1485,
            },
          },
          order: null,
        }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigParamsService,
          useValue: {
            // Nessun parametro letto da questi test: le provvigioni arrivano dagli importi del
            // piano, e il compenso a visita (l'unico che leggeva un parametro) non esiste più.
            getString: jest.fn(async (_k: string, d?: string) => d),
            getNumber: jest.fn(() => Promise.resolve(undefined)),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(FinanceService);
  });

  it('provvigioni a catena dagli importi € del piano: coach 29,70 + mgr 8,91 + nutri 44,55 + capo 14,85, expense a ledger', async () => {
    await service.generateCommissions({ id: 'pay-1', clientId: 'c1', amountCents: 29700 });
    const upserts = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create);
    expect(upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ staffId: 'staff-c', amountCents: 2970 }),
        expect.objectContaining({ staffId: 'staff-mc', amountCents: 891 }),
        expect.objectContaining({ staffId: 'staff-n', amountCents: 4455 }),
        expect.objectContaining({ staffId: 'staff-hn', amountCents: 1485 }),
      ]),
    );
    const ledger = prisma.ledgerEntry.create.mock.calls.map((c: any) => c[0].data);
    expect(ledger.every((l: any) => l.type === 'expense' && l.category === 'sales_commission')).toBe(true);
  });

  it('provvigioni: senza responsabile paga solo coach e nutrizionista', async () => {
    prisma.clientProfile.findUnique.mockResolvedValueOnce({
      assignedCoachId: 'staff-c',
      assignedNutritionistId: 'staff-n',
      assignedCoach: { managerId: null },
      assignedNutritionist: { managerId: null },
    });
    prisma.payment.findUnique.mockResolvedValueOnce({
      subscription: { plan: { priceCents: 10000, commissionCoachCents: 1000, commissionManagerCoachCents: 300, commissionNutritionistCents: 1500, commissionHeadNutritionistCents: 500 } },
      order: null,
    });
    await service.generateCommissions({ id: 'pay-2', clientId: 'c1', amountCents: 10000 });
    const staffIds = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create.staffId);
    expect(staffIds).toEqual(expect.arrayContaining(['staff-c', 'staff-n']));
    expect(staffIds).not.toContain('staff-mc');
    expect(staffIds).not.toContain('staff-hn');
  });

  it('accantona: nutrizionista non assegnato → provvigioni in sospeso, non pagate subito', async () => {
    prisma.clientProfile.findUnique.mockResolvedValueOnce({
      assignedCoachId: 'staff-c',
      assignedNutritionistId: null,
      assignedCoach: { managerId: 'staff-mc' },
      assignedNutritionist: null,
    });
    prisma.payment.findUnique.mockResolvedValueOnce({
      subscription: { plan: { priceCents: 10000, commissionCoachCents: 1000, commissionManagerCoachCents: 300, commissionNutritionistCents: 1500, commissionHeadNutritionistCents: 500 } },
      order: null,
    });
    await service.generateCommissions({ id: 'pay-3', clientId: 'c1', amountCents: 10000 });
    // coach + manager pagati subito
    const staffIds = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create.staffId);
    expect(staffIds).toEqual(expect.arrayContaining(['staff-c', 'staff-mc']));
    // nutrizionista + capo accantonati (importi € del piano)
    const pendings = prisma.pendingCommission.create.mock.calls.map((c: any) => c[0].data);
    expect(pendings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'nutritionist', amountCents: 1500, clientId: 'c1', paymentId: 'pay-3' }),
        expect.objectContaining({ role: 'head_nutritionist', amountCents: 500 }),
      ]),
    );
  });

  it('risolve: all\'assegnazione del nutrizionista paga gli accantonamenti', async () => {
    prisma.pendingCommission.findMany.mockResolvedValueOnce([
      { id: 'pc1', role: 'nutritionist', amountCents: 1500, paymentId: 'pay-3' },
      { id: 'pc2', role: 'head_nutritionist', amountCents: 500, paymentId: 'pay-3' },
    ]);
    prisma.staff.findUnique.mockResolvedValueOnce({ managerId: 'staff-hn' });
    await service.resolvePendingForAssignment('c1', 'nutritionist', 'staff-n');
    const staffIds = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create.staffId);
    expect(staffIds).toEqual(expect.arrayContaining(['staff-n', 'staff-hn']));
    const paid = prisma.pendingCommission.update.mock.calls.map((c: any) => c[0].data.status);
    expect(paid.every((s: string) => s === 'paid')).toBe(true);
  });

  /**
   * Il compenso a visita non esiste più (11/8, «togliamolo totalmente»). Al posto del test che
   * verificava i 40 €, il test che verifica che quella strada sia chiusa: `FinanceService` non deve
   * più esporre nessun modo di accreditare un compenso a visita. Senza questo, il metodo potrebbe
   * tornare per copia-incolla e nessuno se ne accorgerebbe fino al primo accredito di troppo.
   */
  it('non esiste più un compenso a visita da accreditare', () => {
    expect((service as unknown as Record<string, unknown>).creditVisitCompensation).toBeUndefined();
  });

  /**
   * La CATEGORIA invece resta viva: gli accrediti già fatti sono soldi dovuti o già pagati, e
   * `creditStaff` deve continuare a saperla scrivere — è quello che tiene leggibili le righe vecchie
   * in Contabilità, nei Compensi staff e nei Prelievi.
   */
  it('la categoria «visit_compensation» resta accreditabile per lo storico', async () => {
    await service.creditStaff({ staffId: 'staff-n', amountCents: 4000, kind: 'visit_compensation', ref: 'v1', clientId: 'c1' });
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'visit_compensation' }) }),
    );
  });

  it('periodo esistente: incrementa senza duplicare', async () => {
    prisma.staffCompensation.findUnique.mockResolvedValue({ amountCents: 1000, items: [] });
    await service.creditStaff({ staffId: 'staff-n', amountCents: 500, kind: 'visit_compensation', ref: 'v2' });
    expect(prisma.staffCompensation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ amountCents: { increment: 500 } }) }),
    );
  });
});

describe('CrmService (data + responsabile su ogni transizione)', () => {
  let notifiche: { notify: jest.Mock };
  let service: CrmService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      // `assertLeadAccess` passa da `coachTeamScope`, che legge il ruolo da prisma.user:
      // qui l'attore e' 'sales-user', cioe' vede tutti i lead.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'sales' }) },
      crmRecord: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'lead1', stageDates: { lead_in: { at: 'x', byUserId: null } } }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'lead1', ...data })),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'lead1', ...data })),
        findMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([
          { stage: 'lead_in', _count: { _all: 6 } },
          { stage: 'paid', _count: { _all: 3 } },
          { stage: 'first_visit', _count: { _all: 1 } },
        ]),
      },
      ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 89100 } }) },
      crmList: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'L1', name: 'Storici 2024', color: null, _count: { members: 3 } },
          { id: 'L2', name: 'Keto', color: '#33B190', _count: { members: 0 } },
        ]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'Lnew', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'L1', ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      crmListMember: { deleteMany: jest.fn(), upsert: jest.fn() },
      subscription: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      // ⚠️ Servono alla regola «Non ha seguito»: senza, la scelta fra le due colonne non si può provare.
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      pipelineStage: { findUnique: jest.fn().mockResolvedValue({ order: 9 }) },
      // Serve all'avviso alla coach (chi segue quella cliente) E alla regola «Non ha seguito»
      // (`onboardingCompletedAt`, il giorno della misura scritta dal questionario).
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      staff: {
        findMany: jest.fn().mockResolvedValue([{ id: 'staff-c', refCode: 'VOLPEA01' }]),
        // `create` guarda lo staff di chi sta inserendo, per capire se sta assegnando a sé
        // stessa (e quindi saltare il ciclo di accettazione). Qui l'attore è 'sales': nessuno
        // staff, nessuna assegnazione automatica.
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    // Le notifiche si catturano: dall'11/8 la chiusura automatica del percorso avvisa la coach, e
    // «l'avviso non è partito» è un difetto che non si vede da nessun'altra parte.
    notifiche = { notify: jest.fn().mockResolvedValue(undefined) };
    prisma.crmRecord.findFirst = jest.fn().mockResolvedValue(null);
    prisma.crmRecord.create = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'new1', ...data }));
    const pipeline = {
      stageKeys: jest.fn().mockResolvedValue(new Set(['lead_in', 'worked', 'paid', 'coach_assigned', 'coach_call', 'nutritionist_assigned', 'first_visit', 'follow_up'])),
      listStages: jest.fn().mockResolvedValue([
        { key: 'lead_in', order: 0 },
        { key: 'worked', order: 1 },
        { key: 'paid', order: 2 },
        { key: 'first_visit', order: 6 },
      ]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CrmService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PipelineService, useValue: pipeline },
        // Provider aggiunti al costruttore del servizio ma dimenticati qui: il test non
        // falliva su un'asserzione, non partiva proprio (Nest non risolve le dipendenze).
        { provide: MailService, useValue: { sendLeadCredentials: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: notifiche },
        // Serve a `sendCredentials`: legge `lead_credentials_link_days` per la scadenza del link.
        {
          // ⚠️ Risponde PER CHIAVE: `chiudiPercorsiConclusi` ne legge due — i giorni dopo la scadenza
          // e la finestra della misura di partenza — e un finto che risponde sempre lo stesso numero
          // darebbe una finestra di 7 giorni prima dell'inizio invece di 2, cioè misurerebbe un
          // comportamento che il prodotto non ha.
          provide: ConfigParamsService,
          useValue: {
            getString: jest.fn(async (_k: string, d?: string) => d),
            getNumber: jest.fn((chiave: string) =>
              Promise.resolve(chiave === 'menu_visible_days_before_start' ? 2 : 7)),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(CrmService);
  });

  it('advance registra stage con data e responsabile, preservando la storia', async () => {
    const updated: any = await service.advance('sales-user', 'lead1', { stage: 'worked' });
    expect(updated.stage).toBe('worked');
    expect(updated.stageDates.lead_in).toBeDefined(); // storia preservata
    expect(updated.stageDates.worked.byUserId).toBe('sales-user');
    expect(updated.stageDates.worked.at).toBeDefined();
  });

  it('updateInfo aggiorna nome/email/valore e stringa vuota → null', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({ id: 'lead1', name: 'Vecchio', email: 'old@x.it', valueCents: null });
    const updated: any = await service.updateInfo('sales-user', 'lead1', { name: 'Anna', email: '', valueCents: 29000 });
    expect(prisma.crmRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Anna', email: null, valueCents: 29000 } }),
    );
    expect(updated.valueCents).toBe(29000);
  });

  it('detail solleva NotFound se il lead non esiste', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue(null);
    await expect(service.detail('sconosciuto')).rejects.toThrow('Lead non trovato');
  });

  it('ensureLead non solleva mai (il CRM non blocca la registrazione)', async () => {
    prisma.crmRecord.upsert.mockRejectedValue(new Error('db down'));
    await expect(service.ensureLead('u1', 'a@b.it')).resolves.toBeUndefined();
  });

  it('dashboard sales: conversione paid+ / totale e incasso mese', async () => {
    const dash = await service.salesDashboard();
    expect(dash.totalLeads).toBe(10);
    expect(dash.conversionToPaidPercent).toBe(40); // (3 paid + 1 first_visit) / 10
    expect(dash.monthIncomeCents).toBe(89100);
  });

  it('listLists espone il numero di membri per lista', async () => {
    const lists: any = await service.listLists();
    expect(lists).toEqual([
      expect.objectContaining({ id: 'L1', name: 'Storici 2024', memberCount: 3 }),
      expect.objectContaining({ id: 'L2', name: 'Keto', memberCount: 0 }),
    ]);
    expect(lists[0]._count).toBeUndefined(); // _count non deve trapelare
  });

  it('setLeadLists rimpiazza le appartenenze (upsert per lista + deleteMany fuori insieme)', async () => {
    prisma.crmRecord.findUnique.mockImplementation(({ select }: any) =>
      select
        ? Promise.resolve({ id: 'lead1' })
        : Promise.resolve({ id: 'lead1', reminders: [], listMemberships: [{ list: { id: 'L1', name: 'Storici 2024', color: null } }] }),
    );
    const res: any = await service.setLeadLists('sales-user', 'lead1', ['L1', 'L1', 'L2']); // dedup
    expect(prisma.crmListMember.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.crmListMember.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recordId: 'lead1', listId: { notIn: ['L1', 'L2'] } } }),
    );
    expect(res.lists).toEqual([{ id: 'L1', name: 'Storici 2024', color: null }]); // detail appiattisce
  });

  it('setLeadLists solleva NotFound se il lead non esiste', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue(null);
    await expect(service.setLeadLists('u', 'x', ['L1'])).rejects.toThrow('Lead non trovato');
  });

  it('detail appiattisce listMemberships in lists e non espone il grezzo', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({
      id: 'lead1', reminders: [], listMemberships: [{ list: { id: 'L2', name: 'Keto', color: '#33B190' } }],
    });
    const d: any = await service.detail('lead1');
    expect(d.lists).toEqual([{ id: 'L2', name: 'Keto', color: '#33B190' }]);
    expect(d.listMemberships).toBeUndefined();
  });

  it('import dryRun: conta creati/uniti e nuove liste, senza scrivere', async () => {
    prisma.crmRecord.findFirst
      .mockResolvedValueOnce(null)            // riga 1 → nuovo
      .mockResolvedValueOnce({ id: 'esiste' }); // riga 2 → già presente
    const s: any = await service.importRows('admin', [
      { phone: '3331234567', name: 'Anna', lists: 'Storici 2024|NuovaLista', coachRefCode: 'volpea01' },
      { email: 'gia@x.it', lists: 'Keto' },
      { name: 'senza chiave' }, // saltato
    ], true);
    expect(s.created).toBe(1);
    expect(s.merged).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.coachAssigned).toBe(1); // volpea01 → staff-c
    expect(s.newLists).toContain('nuovalista'); // "Storici 2024" e "Keto" esistono già
    expect(prisma.crmRecord.create).not.toHaveBeenCalled(); // dryRun non scrive
    expect(prisma.crmList.create).not.toHaveBeenCalled();
  });

  it('import reale: crea il record, aggancia le liste e assegna la coach dal refcode', async () => {
    prisma.crmRecord.findFirst.mockResolvedValue(null);
    const s: any = await service.importRows('admin', [
      { phone: '+39 333 1234567', name: 'Anna', lists: 'Storici 2024', coachRefCode: 'VOLPEA01', historicalPaidCents: 9900 },
    ], false);
    expect(s.created).toBe(1);
    expect(prisma.crmRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '393331234567', // solo cifre
          assignedCoachId: 'staff-c',
          assignmentStatus: 'accepted',
          historicalPaidCents: 9900,
        }),
      }),
    );
    expect(prisma.crmListMember.upsert).toHaveBeenCalled(); // agganciata la lista
    expect(s.coachAssigned).toBe(1);
  });

  it('import: codice fiscale (upper) e indirizzo dalle liste storiche finiscono sul record', async () => {
    prisma.crmRecord.findFirst.mockResolvedValue(null);
    await service.importRows('admin', [
      { phone: '3331234567', name: 'Anna', codiceFiscale: 'rssmra80a01h501u', address: 'Via Roma 1, Milano' },
    ], false);
    expect(prisma.crmRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codiceFiscale: 'RSSMRA80A01H501U', // normalizzato in maiuscolo
          address: 'Via Roma 1, Milano',
        }),
      }),
    );
  });

  it('import: senza CF/indirizzo NON scrive quei campi (re-import idempotente, non cancella)', async () => {
    prisma.crmRecord.findFirst.mockResolvedValue(null);
    await service.importRows('admin', [{ phone: '3339999999', name: 'Bea' }], false);
    const data = (prisma.crmRecord.create as jest.Mock).mock.calls.at(-1)![0].data;
    expect('codiceFiscale' in data).toBe(false);
    expect('address' in data).toBe(false);
  });
  /**
   * NOME E COGNOME SEPARATI + ALIAS (form «Nuovo lead», 9/8).
   *
   * Prima c'era un solo campo «Nome (facoltativo)»: si potevano inserire lead senza nome — che
   * in tabella diventano una riga con la sola email, e nessuno sa più chi sia — e chi il nome lo
   * scriveva lo scriveva come gli veniva, quindi ordinare per cognome era impossibile.
   * `name` continua a esistere ed è tenuto allineato: lo leggono tabella, pipeline, email e
   * ricevute, e riscrivere tutti quei punti sarebbe stato un rischio senza guadagno.
   */
  it('create: nome e cognome separati, alias, e `name` composto', async () => {
    const rec: any = await service.create('sales-user', {
      email: 'anna@test.it', firstName: ' Anna ', lastName: ' Bianchi ', alias: ' Annina ',
    });
    expect(rec.firstName).toBe('Anna');
    expect(rec.lastName).toBe('Bianchi');
    expect(rec.alias).toBe('Annina');
    expect(rec.name).toBe('Anna Bianchi');
  });

  it('create: senza nome e cognome (import storico) tiene `name` e lascia vuoti gli altri due', async () => {
    // Spezzare «Maria Teresa De Santis» a occhio produrrebbe un cognome sbagliato: meglio
    // vuoto che inventato.
    const rec: any = await service.create('sales-user', { email: 'mt@test.it', name: 'Maria Teresa De Santis' });
    expect(rec.name).toBe('Maria Teresa De Santis');
    expect(rec.firstName).toBeNull();
    expect(rec.lastName).toBeNull();
  });

  it('updateInfo: correggendo il cognome si riallinea anche `name`', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({
      id: 'lead1', firstName: 'Anna', lastName: 'Bianchi', name: 'Anna Bianchi', stageDates: {},
    });
    const upd: any = await service.updateInfo('sales-user', 'lead1', { lastName: 'Bianchini' });
    expect(upd.lastName).toBe('Bianchini');
    // Senza questo la scheda direbbe una cosa e la tabella un'altra, e nessuno saprebbe quale
    // delle due è quella vera.
    expect(upd.name).toBe('Anna Bianchini');
  });
  /**
   * «PERCORSO CONCLUSO» (richiesta delle coach, 8/8). La colonna `path_ended` esisteva dal primo
   * giorno e **non la scriveva nessuno**: restava vuota, e chi aveva finito il percorso restava
   * fermo nella colonna dell'ultima cosa fatta, mescolato a chi era ancora in corso.
   */
  describe('chiudiPercorsiConclusi', () => {
    it('piano finito da più di 7 giorni e nessun rinnovo → la scheda passa a «Percorso concluso»', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ clientId: 'cli-1' }]);
      prisma.subscription.findFirst.mockResolvedValue(null); // niente di attivo né in attesa
      prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
      prisma.pipelineStage.findUnique
        .mockResolvedValueOnce({ order: 9 })  // path_ended
        .mockResolvedValueOnce({ order: 8 }); // follow_up: più indietro, quindi si avanza

      const res = await service.chiudiPercorsiConclusi();

      expect(res).toEqual({ esaminati: 1, spostati: 1 });
      expect(prisma.crmRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stage: 'path_ended' }) }),
      );
    });

    /**
     * ⛔ **UNA SCHEDA PARCHEGGIATA IN «IN SOSPENSIONE» DEVE POTER USCIRE** — rilievo della revisione
     * del 25/8, ed era il difetto più insidioso della colonna nuova.
     *
     * Su una board vera «In sospensione» nasce **in fondo** (il seed la mette dopo l'ultima colonna
     * quando il posto è occupato, e su una board riordinata lo è sempre): `avanzaStatoSeIndietro`
     * confronta gli `order` e non retrocede mai, quindi **rifiutava** lo spostamento, in silenzio.
     * Il piano scade davvero anche durante una vacanza — quella segnata dal Calendario non allunga
     * la scadenza — e la coach non avrebbe mai ricevuto «piano finito da 7 giorni senza rinnovo»,
     * cioè la telefonata che fa rinnovare.
     */
    it('⛔ una scheda in «In sospensione» va comunque in «Percorso concluso», anche se quella colonna sta in fondo', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ clientId: 'cli-1' }]);
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.crmRecord.findUnique.mockResolvedValue({
        stage: 'in_sospensione', stageDates: {}, stagePrimaSospensione: 'follow_up',
      });
      // La colonna della sospensione sta DOPO «Percorso concluso»: con `avanzaStatoSeIndietro` non
      // si sarebbe mossa niente.
      prisma.pipelineStage.findUnique.mockResolvedValue({ key: 'path_ended', order: 9 });

      const res = await service.chiudiPercorsiConclusi();

      expect(res.spostati).toBe(1);
      const scritta = prisma.crmRecord.update.mock.calls.at(-1)[0].data;
      expect(scritta.stage).toBe('path_ended');
      // ⚠️ E la memoria della parentesi si azzera: quella parentesi è finita col percorso.
      expect(scritta.stagePrimaSospensione).toBeNull();
    });

    /**
     * L'AVVISO ALLA COACH (richiesta di Simone dell'11/8: «e soprattutto che mandavamo notifiche alla
     * sua coach? dello spostamento?»). Prima lo spostamento lasciava solo una riga di audit: la scheda
     * cambiava colonna di notte, e la coach lo scopriva guardando la board — se la guardava. È
     * l'avviso più utile di tutti, perché arriva nella settimana in cui una telefonata fa ancora
     * rinnovare.
     */
    it('avvisa la COACH assegnata dello spostamento', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ clientId: 'cli-1' }]);
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
      prisma.pipelineStage.findUnique.mockResolvedValueOnce({ order: 9 }).mockResolvedValueOnce({ order: 8 });
      prisma.clientProfile.findUnique.mockResolvedValue({ name: 'Anna Lisa', assignedCoachId: 'staff-c' });
      prisma.staff.findUnique.mockResolvedValue({ userId: 'u-coach' });

      await service.chiudiPercorsiConclusi();

      expect(notifiche.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-coach', type: 'client_path_ended', payload: { clientId: 'cli-1' } }),
      );
      expect(notifiche.notify.mock.calls[0][0].body).toContain('Anna Lisa');
    });

    it('cliente senza coach assegnata: si sposta comunque, e non si avvisa nessun altro', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ clientId: 'cli-1' }]);
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
      prisma.pipelineStage.findUnique.mockResolvedValueOnce({ order: 9 }).mockResolvedValueOnce({ order: 8 });
      prisma.clientProfile.findUnique.mockResolvedValue({ name: 'Anna Lisa', assignedCoachId: null });

      const res = await service.chiudiPercorsiConclusi();

      expect(res.spostati).toBe(1);
      // Un avviso mandato a chi non segue quella cliente è rumore, e insegna a ignorare le notifiche.
      expect(notifiche.notify).not.toHaveBeenCalled();
    });

    it('ha rinnovato (o ha un bonifico in attesa) → NON si tocca', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ clientId: 'cli-1' }]);
      // Un pagamento in attesa è una persona che sta tornando, non una che se n'è andata.
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-nuovo' });

      const res = await service.chiudiPercorsiConclusi();

      expect(res).toEqual({ esaminati: 1, spostati: 0 });
      expect(prisma.crmRecord.update).not.toHaveBeenCalled();
    });

    it('scheda già più avanti → non retrocede', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ clientId: 'cli-1' }]);
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'path_ended', stageDates: {} });
      prisma.pipelineStage.findUnique.mockResolvedValue({ order: 9 }); // stesso ordine

      const res = await service.chiudiPercorsiConclusi();

      expect(res.spostati).toBe(0);
    });

    /**
     * ⛔ **«NON HA SEGUITO» (richiesta di Simone, 24/8).** Chi ha comprato e non si è mai pesata
     * mentre il piano correva non ha «concluso il percorso»: non l'ha nemmeno cominciato, e la
     * telefonata che le si fa è un'altra da quella del rinnovo.
     *
     * ⚠️ `subscription.findMany` viene chiamata **due volte** per ogni giro: la prima dà le
     * candidate (i piani scaduti nella finestra), la seconda — dentro `nonHaMaiSeguito` — dà i piani
     * di quella cliente con le loro date. Sono due domande diverse allo stesso metodo, ed è il motivo
     * per cui qui si usa `mockResolvedValueOnce` invece di una risposta sola.
     */
    describe('«Non ha seguito»', () => {
      const G = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
      const PIANO = [{ startDate: G('2026-05-01'), endDate: G('2026-06-01') }];

      /** Le due colonne, con `non_seguita` in fondo: è l'ordine che la fa scrivere. */
      const colonne = (map: Record<string, number | null>) =>
        prisma.pipelineStage.findUnique.mockImplementation(({ where }: any) => {
          const o = map[where.key];
          return Promise.resolve(o == null ? null : { order: o });
        });

      it('nessuna misura per tutta la durata del piano → «Non ha seguito», non «Percorso concluso»', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([{ clientId: 'cli-1' }]).mockResolvedValueOnce(PIANO);
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.measurement.findFirst.mockResolvedValue(null);
        prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
        colonne({ non_seguita: 11, path_ended: 10, follow_up: 9 });

        const res = await service.chiudiPercorsiConclusi();

        expect(res).toEqual({ esaminati: 1, spostati: 1 });
        expect(prisma.crmRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ stage: 'non_seguita' }) }),
        );
      });

      it('una pesata dentro il piano → resta «Percorso concluso»', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([{ clientId: 'cli-1' }]).mockResolvedValueOnce(PIANO);
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.measurement.findFirst.mockResolvedValue({ id: 'mis-1' });
        prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
        colonne({ non_seguita: 11, path_ended: 10, follow_up: 9 });

        await service.chiudiPercorsiConclusi();

        expect(prisma.crmRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ stage: 'path_ended' }) }),
        );
      });

      /**
       * ⚠️ **IL RETROATTIVO, deciso da Simone il 24/8.** Chi era già finita in «Percorso concluso»
       * nelle notti scorse e non ha misure si sposta la prima notte. È il motivo per cui la colonna
       * nuova sta in FONDO: `avanzaStatoSeIndietro` non retrocede mai, quindi solo un ordine più alto
       * di `path_ended` le permette di muoversi ancora.
       */
      it('⚠️ chi era già in «Percorso concluso» e non ha misure ci passa lo stesso', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([{ clientId: 'cli-1' }]).mockResolvedValueOnce(PIANO);
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.measurement.findFirst.mockResolvedValue(null);
        prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'path_ended', stageDates: {} });
        colonne({ non_seguita: 11, path_ended: 10 });

        const res = await service.chiudiPercorsiConclusi();

        expect(res.spostati).toBe(1);
        expect(prisma.crmRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ stage: 'non_seguita' }) }),
        );
      });

      /**
       * ⛔ **SE LA COLONNA NON C'È, SI RIPIEGA — e la scheda si muove lo stesso.**
       * `avanzaStatoSeIndietro` risponde `false` in silenzio quando la colonna di destinazione non
       * esiste. Senza il ripiego, su un'installazione in cui l'admin avesse cancellato `non_seguita`
       * le schede di chi non ha seguito **smetterebbero di muoversi del tutto**, e la colonna vuota
       * si leggerebbe come «non è successo a nessuno».
       */
      it('⛔ colonna «Non ha seguito» mancante → ripiega su «Percorso concluso», non lascia ferma la scheda', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([{ clientId: 'cli-1' }]).mockResolvedValueOnce(PIANO);
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.measurement.findFirst.mockResolvedValue(null);
        prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
        colonne({ non_seguita: null, path_ended: 10, follow_up: 9 });

        const res = await service.chiudiPercorsiConclusi();

        expect(res.spostati).toBe(1);
        expect(prisma.crmRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ stage: 'path_ended' }) }),
        );
      });

      /**
       * ⛔ **IL RETROATTIVO NON SCAVALCA UNA PERSONA** (rilievo della revisione, 24/8). Una scheda in
       * «Percorso concluso» può ancora muoversi perché la colonna nuova sta più avanti — ma se ce
       * l'ha messa una coach, quella è una decisione, non un residuo del giro notturno. È la prima
       * volta che un automatismo potrebbe tirare una scheda fuori dall'ultima colonna scelta da
       * qualcuno, e `stageDates` distingue i due casi da sempre.
       */
      it('⛔ se in «Percorso concluso» ce l\'ha messa una PERSONA, il giro notturno non la sposta', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([{ clientId: 'cli-1' }]).mockResolvedValueOnce(PIANO);
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.measurement.findFirst.mockResolvedValue(null);
        prisma.crmRecord.findUnique.mockResolvedValue({
          stage: 'path_ended',
          stageDates: { path_ended: { at: 'x', byUserId: 'u-coach' } },
        });
        colonne({ non_seguita: 11, path_ended: 10 });

        const res = await service.chiudiPercorsiConclusi();

        expect(res.spostati).toBe(0);
        expect(prisma.crmRecord.update).not.toHaveBeenCalled();
      });

      /**
       * ⛔ **QUANDO SI RIPIEGA, L'AVVISO SEGUE DOVE LA SCHEDA È FINITA DAVVERO.** La prima stesura
       * diceva «è passata in «Non ha seguito»» a una coach la cui board quella colonna non ce
       * l'aveva: una push che manda a cercare qualcuno in un posto che non esiste, e un audit che
       * conta spostamenti mai avvenuti.
       */
      it('⛔ col ripiego l\'avviso NON nomina una colonna che non c\'è', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([{ clientId: 'cli-1' }]).mockResolvedValueOnce(PIANO);
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.measurement.findFirst.mockResolvedValue(null);
        prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
        colonne({ non_seguita: null, path_ended: 10, follow_up: 9 });
        prisma.clientProfile.findUnique.mockResolvedValue({ name: 'Anna Lisa', assignedCoachId: 'staff-c' });
        prisma.staff.findUnique.mockResolvedValue({ userId: 'u-coach' });

        await service.chiudiPercorsiConclusi();

        expect(prisma.crmRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ stage: 'path_ended' }) }),
        );
        expect(notifiche.notify).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'u-coach', type: 'client_path_ended' }),
        );
        expect(notifiche.notify.mock.calls[0][0].body).not.toContain('Non ha seguito');
      });

      it('la coach riceve un avviso che dice la cosa GIUSTA: non ha seguito, non «ha finito»', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([{ clientId: 'cli-1' }]).mockResolvedValueOnce(PIANO);
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.measurement.findFirst.mockResolvedValue(null);
        prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'follow_up', stageDates: {} });
        colonne({ non_seguita: 11, path_ended: 10, follow_up: 9 });
        prisma.clientProfile.findUnique.mockResolvedValue({ name: 'Anna Lisa', assignedCoachId: 'staff-c' });
        prisma.staff.findUnique.mockResolvedValue({ userId: 'u-coach' });

        await service.chiudiPercorsiConclusi();

        expect(notifiche.notify).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'u-coach', type: 'client_path_not_followed' }),
        );
        expect(notifiche.notify.mock.calls[0][0].body).toContain('non ha mai inserito una misura');
        // ⚠️ E NON quello del percorso concluso: due avvisi diversi per due telefonate diverse.
        expect(notifiche.notify.mock.calls[0][0].body).not.toContain('non ha rinnovato');
      });
    });
  });
});
