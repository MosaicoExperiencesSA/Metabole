/**
 * REVOCA DEL CONSENSO — il servizio che cancella davvero.
 *
 * Questi test tengono ferme le cose che, sbagliate, non si scoprono con un errore ma con un danno:
 *
 *  1. **niente parte senza la parola scritta a mano** — è l'unico attrito prima di un'operazione
 *     irreversibile;
 *  2. **la contabilità non si tocca**: fatture, ordini, abbonamenti, ledger, provvigioni e compensi
 *     restano. Le fatture per obbligo di legge; i compensi perché sono fatti avvenuti fra noi e
 *     persone terze, che non hanno chiesto niente;
 *  3. **l'utenza si anonimizza, non si elimina**: una fattura appesa a un id che non esiste più è
 *     una fattura che in contabilità nessuno sa più leggere — e il database la rifiuterebbe;
 *  4. **solo il link ferma il termine**: il token è l'autorizzazione, e non c'è nessuna strada che
 *     passi da una sessione dello staff;
 *  5. **premere due volte non fa partire due termini**, e non sposta la data.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { CommerceService } from '../commerce/commerce.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { GIORNI_ATTESA, dataCancellazione } from './cancellazione';
import { PrivacyService } from './privacy.service';

const GIORNO = 86_400_000;

/** Le tabelle che NON devono essere toccate: se una comparisse, il test fallisce. */
const CONTABILITA = ['payment', 'order', 'subscription', 'ledgerEntry', 'pendingCommission', 'staffCompensation', 'discountRedemption'];

interface Opzioni {
  /** Richiesta già aperta nel database. */
  aperta?: Record<string, unknown> | null;
  /** Esito della disdetta del rinnovo: `false` = non c'era nessun abbonamento ricorrente. */
  haRinnovo?: boolean;
}

async function crea(opzioni: Opzioni = {}) {
  /** Tutte le `deleteMany` fatte, per modello: è il modo di verificare cosa si è cancellato. */
  const cancellazioni: Record<string, unknown> = {};
  const modelloFinto = (nome: string) => ({
    deleteMany: jest.fn().mockImplementation((args: unknown) => {
      cancellazioni[nome] = args;
      return Promise.resolve({ count: 1 });
    }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn().mockResolvedValue({ id: 'x' }),
  });

  const prisma: any = new Proxy(
    {
      deletionRequest: {
        findFirst: jest.fn().mockResolvedValue(opzioni.aperta ?? null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'req-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          consents: { healthDataConsent: { accepted: true, at: '2026-06-01T10:00:00.000Z' } },
          assignedCoach: { user: { email: 'coach@metabole.eu' } },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockImplementation((args: unknown) => {
          cancellazioni['clientProfile'] = args;
          return Promise.resolve({ count: 1 });
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'giulia@x.it', firstName: 'Giulia', lastName: 'Rossi', locale: 'it',
        }),
        findMany: jest.fn().mockResolvedValue([{ email: 'admin@metabole.eu' }]),
        update: jest.fn().mockResolvedValue({}),
      },
      chatThread: {
        findMany: jest.fn().mockResolvedValue([{ id: 'th-1' }]),
        deleteMany: jest.fn().mockImplementation((args: unknown) => {
          cancellazioni['chatThread'] = args;
          return Promise.resolve({ count: 1 });
        }),
      },
      message: {
        deleteMany: jest.fn().mockImplementation((args: unknown) => {
          cancellazioni['message'] = args;
          return Promise.resolve({ count: 3 });
        }),
      },
    } as Record<string, unknown>,
    {
      // Ogni altro modello nominato dal servizio esiste e conta la sua `deleteMany`: così il test
      // vede TUTTO quello che il servizio tocca, comprese le tabelle che non dovrebbe toccare.
      get: (target: Record<string, unknown>, prop: string) => {
        if (prop in target) return target[prop];
        const finto = modelloFinto(prop);
        target[prop] = finto;
        return finto;
      },
    },
  );

  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const mail = { send: jest.fn().mockResolvedValue(true) };
  const commerce = {
    cancelMyRecurring: jest.fn().mockImplementation(() =>
      opzioni.haRinnovo === false
        ? Promise.reject(new NotFoundException('Nessun abbonamento da disdire.'))
        : Promise.resolve({ disdetta: true }),
    ),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      PrivacyService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: audit },
      { provide: MailService, useValue: mail },
      { provide: CommerceService, useValue: commerce },
      { provide: ConfigService, useValue: { get: () => 'https://app.metabole.eu' } },
    ],
  }).compile();
  return { service: moduleRef.get(PrivacyService), prisma, audit, mail, commerce, cancellazioni };
}

describe('la revoca', () => {
  it('senza la parola scritta a mano non parte niente', async () => {
    const { service, prisma, mail } = await crea();
    await expect(service.revoca('cli-1', 'si')).rejects.toThrow(BadRequestException);
    await expect(service.revoca('cli-1', '')).rejects.toThrow(/ELIMINA/);
    expect(prisma.deletionRequest.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('con ELIMINA crea la richiesta a 30 giorni e manda le mail', async () => {
    const { service, prisma, mail, audit } = await crea();
    const esito = await service.revoca('cli-1', 'ELIMINA');

    expect(esito.giorniRimanenti).toBe(GIORNI_ATTESA);
    const creata = prisma.deletionRequest.create.mock.calls[0][0].data;
    expect(creata.status).toBe('pending');
    // Il token in chiaro NON si conserva: in tabella va solo l'hash, come per i reset password.
    expect(creata.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(creata)).not.toContain('token');
    expect(new Date(creata.scheduledFor).getTime()).toBe(dataCancellazione(new Date(creata.requestedAt)).getTime());

    // Una mail a lei col pulsante, e le copie allo staff.
    const destinatari = mail.send.mock.calls.map((c: any) => c[0].to);
    expect(destinatari).toContain('giulia@x.it');
    expect(destinatari).toContain('coach@metabole.eu');
    const perLei = mail.send.mock.calls.find((c: any) => c[0].to === 'giulia@x.it')[0];
    expect(perLei.html).toMatch(/privacy\/sospendi\?token=[0-9a-f]{64}/);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'privacy.consenso.revocato' }));
  });

  /** Il consenso si segna revocato SUBITO: dal momento in cui l'ha detto il trattamento non è più autorizzato. */
  it('il consenso risulta revocato subito, non al 31° giorno', async () => {
    const { service, prisma } = await crea();
    await service.revoca('cli-1', 'ELIMINA');
    const scritto = prisma.clientProfile.updateMany.mock.calls.at(-1)[0].data.consents;
    expect(scritto.healthDataConsent.accepted).toBe(false);
    expect(scritto.healthDataConsent.revokedAt).toBeTruthy();
    // La data in cui l'aveva DATO resta: è la storia, e serve.
    expect(scritto.healthDataConsent.at).toBe('2026-06-01T10:00:00.000Z');
  });

  /** Decisione del 10/8: la revoca disdice il rinnovo automatico. */
  it('disdice il rinnovo automatico', async () => {
    const { service, commerce } = await crea();
    const esito = await service.revoca('cli-1', 'ELIMINA');
    expect(commerce.cancelMyRecurring).toHaveBeenCalledWith('cli-1');
    expect(esito.rinnovoDisdetto).toBe(true);
  });

  it('e se non c\'è nessun abbonamento ricorrente la revoca vale comunque', async () => {
    const { service, prisma } = await crea({ haRinnovo: false });
    const esito = await service.revoca('cli-1', 'ELIMINA');
    expect(esito.rinnovoDisdetto).toBe(false);
    expect(prisma.deletionRequest.create).toHaveBeenCalled();
  });

  /**
   * Premere due volte è probabile: la pagina si ricarica, il pulsante si tocca di nuovo. Due termini
   * per la stessa persona vorrebbero dire due date, due serie di mail e nessuno che capisce quale
   * vale.
   */
  it('premuta due volte non fa partire due termini né sposta la data', async () => {
    const aperta = {
      id: 'req-0',
      clientId: 'cli-1',
      requestedAt: new Date(Date.now() - 5 * GIORNO),
      scheduledFor: new Date(Date.now() + 25 * GIORNO),
      status: 'pending',
      warnedAt: null,
    };
    const { service, prisma, mail } = await crea({ aperta });
    const esito = await service.revoca('cli-1', 'ELIMINA');
    expect(esito.giaInCorso).toBe(true);
    expect(esito.previstaIl).toBe(aperta.scheduledFor.toISOString());
    expect(prisma.deletionRequest.create).not.toHaveBeenCalled();
    // E nessuna seconda mail: due messaggi identici a un minuto di distanza fanno sembrare rotto un
    // processo delicato.
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('sospendere il termine', () => {
  it('un token che non esiste non ferma niente', async () => {
    const { service } = await crea();
    await expect(service.sospendi('inventato')).rejects.toThrow(NotFoundException);
  });

  it('col token giusto il termine si ferma e il consenso torna attivo', async () => {
    const { service, prisma, mail, audit } = await crea();
    prisma.deletionRequest.findUnique.mockResolvedValue({
      id: 'req-1', clientId: 'cli-1', status: 'pending', scheduledFor: new Date(Date.now() + 10 * GIORNO),
    });
    const esito = await service.sospendi('un-token');

    expect(esito.fermata).toBe(true);
    expect(prisma.deletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'suspended', suspendedBy: 'cli-1' }) }),
    );
    // Fermare la cancellazione RIMETTE il consenso: lasciarlo revocato le darebbe un account fermo,
    // senza menu e senza spiegazione.
    const scritto = prisma.clientProfile.updateMany.mock.calls.at(-1)[0].data.consents;
    expect(scritto.healthDataConsent.accepted).toBe(true);
    expect(scritto.healthDataConsent.revokedAt).toBeNull();
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ templateKey: 'privacy_sospesa' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'privacy.cancellazione.sospesa' }));
  });

  it('una cancellazione già eseguita non si può fermare, e si dice chiaramente', async () => {
    const { service, prisma } = await crea();
    prisma.deletionRequest.findUnique.mockResolvedValue({ id: 'r', clientId: 'c', status: 'done', scheduledFor: new Date() });
    await expect(service.sospendi('t')).rejects.toThrow(/già stata eseguita/);
  });

  it('premere due volte lo stesso link non è un errore', async () => {
    const { service, prisma } = await crea();
    prisma.deletionRequest.findUnique.mockResolvedValue({ id: 'r', clientId: 'c', status: 'suspended', scheduledFor: new Date() });
    await expect(service.sospendi('t')).resolves.toEqual({ fermata: true, giaFermata: true });
  });
});

describe('la cancellazione', () => {
  it('svuota i dati sanitari e del percorso', async () => {
    const { service, cancellazioni } = await crea();
    await service.cancella('cli-1', 'req-1');
    for (const tabella of ['measurement', 'menuDay', 'document', 'clinicalNote', 'dailyCheckin', 'objective', 'clientProfile']) {
      expect(cancellazioni[tabella]).toEqual({ where: expect.objectContaining({}) });
    }
    // Le conversazioni: prima i messaggi, poi i thread. Al contrario resterebbero messaggi orfani.
    expect(cancellazioni['message']).toEqual({ where: { threadId: { in: ['th-1'] } } });
    expect(cancellazioni['chatThread']).toEqual({ where: { clientId: 'cli-1' } });
  });

  /**
   * IL CONFINE. Le fatture per obbligo di legge (dieci anni); i compensi e le provvigioni perché
   * sono fatti avvenuti fra noi e persone terze — cancellarli falserebbe il conto economico e i
   * compensi di chi non ha chiesto niente.
   */
  it.each(CONTABILITA)('NON tocca «%s»', async (tabella) => {
    const { service, cancellazioni } = await crea();
    await service.cancella('cli-1', 'req-1');
    expect(cancellazioni[tabella]).toBeUndefined();
  });

  it('anonimizza l\'utenza invece di eliminarla', async () => {
    const { service, prisma } = await crea();
    await service.cancella('cli-1', 'req-1');
    const dati = prisma.user.update.mock.calls.at(-1)[0].data;
    expect(dati.email).toBe('cancellato+cli-1@metabole.invalid');
    expect(dati.firstName).toBe('Utente');
    expect(dati.deletedAt).toBeInstanceOf(Date);
    // Niente più indirizzo, telefono, data di nascita, codice fiscale, foto.
    for (const campo of ['phone', 'addressLine', 'postalCode', 'city', 'province', 'country', 'birthDate', 'codiceFiscale', 'photoUrl']) {
      expect(dati[campo]).toBeNull();
    }
    // La password diventa rumore: nessuno può più entrare, e nemmeno noi possiamo «riattivarla».
    expect(dati.passwordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('registra la richiesta come eseguita, col conto di cosa è stato cancellato', async () => {
    const { service, prisma, audit } = await crea();
    await service.cancella('cli-1', 'req-1');
    const agg = prisma.deletionRequest.update.mock.calls.at(-1)[0];
    expect(agg.data.status).toBe('done');
    expect(agg.data.completedAt).toBeInstanceOf(Date);
    expect(Object.keys(agg.data.report).length).toBeGreaterThan(5);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'privacy.dati.cancellati' }));
  });

  it('l\'ultima mail parte DOPO la cancellazione, non prima', async () => {
    const { service, mail, prisma } = await crea();
    await service.cancella('cli-1', 'req-1');
    const inviata = mail.send.mock.calls.find((c: any) => c[0].templateKey === 'privacy_fatta');
    expect(inviata).toBeTruthy();
    // Prima era una promessa, dopo è un fatto: l'anonimizzazione è già avvenuta quando si manda.
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

describe('il passo notturno del cron', () => {
  const richiesta = (giorni: number, warnedAt: Date | null = null) => ({
    id: `req-${giorni}`,
    clientId: `cli-${giorni}`,
    scheduledFor: new Date(Date.now() + giorni * GIORNO),
    warnedAt,
  });

  it('avvisa chi scade domani, e non chi scade fra una settimana', async () => {
    const { service, prisma, mail } = await crea();
    prisma.deletionRequest.findMany.mockResolvedValue([richiesta(1), richiesta(7)]);
    const esito = await service.passoGiornaliero();
    expect(esito.avvisate).toBe(1);
    expect(esito.cancellate).toBe(0);
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ templateKey: 'privacy_ultimo_avviso' }));
  });

  it('l\'avviso non si ripete ogni notte', async () => {
    const { service, prisma } = await crea();
    prisma.deletionRequest.findMany.mockResolvedValue([richiesta(1, new Date())]);
    expect((await service.passoGiornaliero()).avvisate).toBe(0);
  });

  it('cancella chi è scaduto', async () => {
    const { service, prisma, cancellazioni } = await crea();
    prisma.deletionRequest.findMany.mockResolvedValue([richiesta(-1)]);
    const esito = await service.passoGiornaliero();
    expect(esito.cancellate).toBe(1);
    expect(cancellazioni['measurement']).toBeTruthy();
  });

  /**
   * Il caso del cron saltato: se ieri non è girato, chi doveva essere avvisato ieri viene avvisato
   * OGGI, prima di essere cancellata. Meglio un avviso in ritardo che una cancellazione senza
   * preavviso — è l'unica delle due cose che non si può rimediare.
   */
  it('chi è scaduto senza aver ricevuto l\'avviso lo riceve comunque', async () => {
    const { service, prisma, mail } = await crea();
    prisma.deletionRequest.findMany.mockResolvedValue([richiesta(-2)]);
    const esito = await service.passoGiornaliero();
    expect(esito.avvisate).toBe(1);
    expect(esito.cancellate).toBe(1);
    const ordine = mail.send.mock.calls.map((c: any) => c[0].templateKey);
    expect(ordine.indexOf('privacy_ultimo_avviso')).toBeLessThan(ordine.indexOf('privacy_fatta'));
  });

  /**
   * Una cancellazione che fallisce resta `pending` e ripassa domani. Segnarla `done` per far tacere
   * il cron sarebbe un adempimento dichiarato e non fatto: il caso peggiore di tutti.
   */
  it('una cancellazione fallita non viene dichiarata fatta', async () => {
    const { service, prisma } = await crea();
    prisma.deletionRequest.findMany.mockResolvedValue([richiesta(-1)]);
    prisma.user.update.mockRejectedValueOnce(new Error('database giù'));
    const esito = await service.passoGiornaliero();
    expect(esito.cancellate).toBe(0);
    expect(esito.errori.length).toBe(1);
    const segnateFatte = prisma.deletionRequest.update.mock.calls.filter((c: any) => c[0]?.data?.status === 'done');
    expect(segnateFatte).toHaveLength(0);
  });
});

describe('lo stato mostrato nel profilo', () => {
  it('dice quando è stato dato il consenso e se c\'è una richiesta in corso', async () => {
    const aperta = {
      id: 'r', clientId: 'cli-1',
      requestedAt: new Date(Date.now() - 3 * GIORNO),
      scheduledFor: new Date(Date.now() + 27 * GIORNO),
      status: 'pending', warnedAt: null,
    };
    const { service } = await crea({ aperta });
    const stato = await service.statoConsenso('cli-1');
    expect(stato.il).toBe('2026-06-01T10:00:00.000Z');
    expect(stato.cancellazione?.giorniRimanenti).toBe(27);
    expect(stato.parolaConferma).toBe('ELIMINA');
    // I testi del popup arrivano dal backend: così la frase sulle fatture è una sola in tutto il
    // prodotto, e non una copia nell'app che un giorno diverge da quella delle mail.
    expect(stato.testi.fatture).toMatch(/dieci anni/i);
  });

  it('senza richieste aperte il campo è nullo, non un oggetto vuoto', async () => {
    const { service } = await crea();
    expect((await service.statoConsenso('cli-1')).cancellazione).toBeNull();
  });
});
