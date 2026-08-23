/**
 * IL VIA LIBERA CLINICO, dal servizio: tre cose che sono una cosa sola.
 *
 * Simone (13/8): «possiamo rendere obbligatoria la scrittura di una nota — dove segnamo chi ha
 * scritto, data e ora — in modo che anche la coach entrando vede la nota del nutrizionista? Il campo
 * note esiste già.»
 *
 * Quindi la nota NON è un campo nuovo sulla scheda clinica: è una riga della lista note, quella che
 * la coach apre già. I test che contano sono due:
 *  - la nota finisce **lì**, con autore e ora, e non in un campo che solo la nutrizionista vede;
 *  - le segnalazioni cliniche aperte si chiudono **da sé**. Se dovesse decidere qui e chiudere di
 *    là, prima o poi ne farebbe una sola, e la coda tornerebbe a riempirsi di casi già visti.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { aGiorno } from '../common/date-only';
import { ClientsService } from './clients.service';
import { CoachTasksService } from '../coach-tasks/coach-tasks.service';
import { PrenotazioniService } from '../agenda/prenotazioni.service';
import { TIPO_VISITA_DA_FISSARE } from './visita-da-fissare';

const NOTA = 'Valutata in visita il 12/8: allergia al latte, nessuna controindicazione al percorso.';

/**
 * ⛔ **Da oggi «serve una visita» vuole la data entro cui farla** (23/8): la decisione senza un
 * termine è quella che non cambiava niente per nessuno — il caso Gianluca. Si calcola da adesso alla
 * stessa porta del codice (`aGiorno`, il giorno di Roma), non si scrive a mano: una data fissa
 * scadrebbe da sola e questi test diventerebbero rossi in un giorno qualunque.
 */
const ENTRO = () => new Date(aGiorno(new Date()).getTime() + 21 * 86_400_000).toISOString().slice(0, 10);

async function crea(opzioni?: { permesso?: boolean }) {
  const permesso = opzioni?.permesso ?? true;
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cli-1', role: 'client', deletedAt: null }),
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where?.id === 'cli-1' ? { id: 'cli-1', role: 'client' } : { id: where?.id, role: 'nutritionist' }),
      ),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-n' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-c', assignedNutritionistId: 'staff-n' }),
      update: jest.fn().mockResolvedValue({}),
    },
    clientNote: {
      create: jest.fn().mockResolvedValue({
        id: 'nota-1',
        body: 'x',
        createdAt: new Date('2026-08-13T10:00:00Z'),
        author: { displayName: 'Dr.ssa Bini' },
      }),
    },
    escalation: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    rolePagePermission: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where?.role_pageKey?.pageKey === 'clinical_clearance'
            ? { canView: true, canManage: permesso }
            : { canView: true, canManage: true },
        ),
      ),
    },
    coachTeam: { findMany: jest.fn().mockResolvedValue([]) },
    staffMember: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  // «Serve una visita» apre un'attività della coach: sono le due porte da cui passa.
  const coachTasks = { apriAttivita: jest.fn().mockResolvedValue('creata') };
  const prenotazioni = { credito: jest.fn().mockResolvedValue({ disponibili: 1, concesse: 1, usate: 0 }) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ClientsService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: {} },
      { provide: AuditService, useValue: audit },
      { provide: NotificationsService, useValue: { notify: jest.fn() } },
      { provide: MenuService, useValue: {} },
      { provide: CoachTasksService, useValue: coachTasks },
      { provide: PrenotazioniService, useValue: prenotazioni },
    ],
  }).compile();
  return { service: moduleRef.get(ClientsService), prisma, audit, coachTasks, prenotazioni };
}

describe('la nutrizionista dice «può proseguire»', () => {
  it('⚠️ la nota finisce nella LISTA NOTE, dove la coach la cerca già', async () => {
    const { service, prisma } = await crea();
    await service.decidiIdoneita('cli-1', 'nutri-user', 'idonea', NOTA);
    const scritta = prisma.clientNote.create.mock.calls[0][0].data;
    expect(scritta.clientId).toBe('cli-1');
    // Autore e ora: `authorId` qui, `createdAt` dal default della tabella.
    expect(scritta.authorId).toBe('staff-n');
    // E dice COSA è stato deciso: aprendo le note si capisce senza chiedere.
    expect(scritta.body).toContain('Può proseguire');
    expect(scritta.body).toContain('nessuna controindicazione');
  });

  it('la decisione resta sul profilo, con chi e quando, e punta alla nota', async () => {
    const { service, prisma } = await crea();
    await service.decidiIdoneita('cli-1', 'nutri-user', 'idonea', NOTA);
    const dati = prisma.clientProfile.update.mock.calls[0][0].data;
    expect(dati.idoneita).toBe('idonea');
    expect(dati.idoneitaDecisaDaId).toBe('staff-n');
    expect(dati.idoneitaDecisaIl).toBeInstanceOf(Date);
    // ⚠️ Il testo NON si copia: si punta alla nota. Un posto solo.
    expect(dati.idoneitaNotaId).toBe('nota-1');
  });

  it('⚠️ le segnalazioni cliniche aperte si chiudono DA SÉ: un gesto solo, non due', async () => {
    // Se dovesse decidere qui e poi chiudere la segnalazione di là, prima o poi ne farebbe una
    // sola — e la coda tornerebbe a riempirsi di casi già visti.
    const { service, prisma } = await crea();
    const esito = await service.decidiIdoneita('cli-1', 'nutri-user', 'idonea', NOTA);
    const dove = prisma.escalation.updateMany.mock.calls[0][0];
    expect(dove.where).toMatchObject({ clientId: 'cli-1', category: 'clinical' });
    // ⚠️ `resolvedAt` valorizzato: è quello che `riapertura.ts` guarda per non riaprirle. Senza, la
    // tregua non parte e la stessa segnalazione torna alla prima rivalutazione del motore.
    expect(dove.data.resolvedAt).toBeInstanceOf(Date);
    expect(esito.segnalazioniChiuse).toBe(2);
  });

  it('⚠️ anche «serve una visita» è una decisione: chiude le segnalazioni e si registra', async () => {
    // Non è un «no»: è «l'ho guardata, e serve la visita». La coda non deve riproporgliela.
    const { service, prisma } = await crea();
    await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    expect(prisma.clientProfile.update.mock.calls[0][0].data.idoneita).toBe('serve_visita');
    expect(prisma.escalation.updateMany).toHaveBeenCalled();
  });

  it('resta la riga di audit, con quante segnalazioni ha chiuso', async () => {
    const { service, audit } = await crea();
    await service.decidiIdoneita('cli-1', 'nutri-user', 'idonea', NOTA);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client.idoneita.decisa',
        metadata: expect.objectContaining({ esito: 'idonea', segnalazioniChiuse: 2 }),
      }),
    );
  });
});

describe('quando NON si decide', () => {
  it('⚠️ senza nota non si scrive NIENTE: né la nota, né il profilo, né le segnalazioni', async () => {
    // Il caso brutto sarebbe una decisione registrata senza la spiegazione: il flag si spegne, la
    // coda si svuota, e non resta niente che dica perché.
    const { service, prisma } = await crea();
    await expect(service.decidiIdoneita('cli-1', 'nutri-user', 'idonea', 'ok')).rejects.toThrow(BadRequestException);
    expect(prisma.clientNote.create).not.toHaveBeenCalled();
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    expect(prisma.escalation.updateMany).not.toHaveBeenCalled();
  });

  it('senza il permesso è rifiutato, e il messaggio dice quale flag serve', async () => {
    const { service } = await crea({ permesso: false });
    await expect(service.decidiIdoneita('cli-1', 'coach-user', 'idonea', NOTA)).rejects.toThrow(ForbiddenException);
    await expect(service.decidiIdoneita('cli-1', 'coach-user', 'idonea', NOTA)).rejects.toThrow(/Idoneità a proseguire/);
  });
});

/**
 * ⚠️ «SERVE UNA VISITA» VA DETTO A QUALCUNO CHE PUÒ FISSARLA.
 *
 * Prima la decisione restava scritta sulla scheda e la visita non la fissava nessuno: l'unico modo
 * perché succedesse qualcosa era che qualcuno si ricordasse di riaprire quella scheda. Ed è una
 * decisione clinica, cioè il caso in cui «me ne ricorderò» costa di più.
 */
describe('la nutrizionista dice «serve una visita»', () => {
  it('apre l\'attività della coach, con il riferimento a QUESTA decisione', async () => {
    const { service, coachTasks } = await crea();
    const esito: any = await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    expect(coachTasks.apriAttivita).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'cli-1', kind: TIPO_VISITA_DA_FISSARE }),
    );
    expect(esito.attivitaAperta).toBe(true);
  });

  /**
   * ⚠️ `refId` È IL GIORNO, non l'id della nota — corretto rileggendo la sera stessa. Con l'id della
   * nota non poteva collidere mai (`decidiIdoneita` crea una nota nuova a ogni salvataggio), quindi
   * risalvare la stessa valutazione apriva una seconda attività e mandava una seconda push: il
   * contrario di quello che il commento prometteva.
   */
  it('⚠️ due salvataggi nello stesso giorno hanno lo STESSO riferimento', async () => {
    const { service, coachTasks } = await crea();
    await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    const [primo, secondo] = coachTasks.apriAttivita.mock.calls.map((c: any) => c[0].refId);
    expect(primo).toBe(secondo);
    expect(primo).toMatch(/^serve_visita:\d{4}-\d{2}-\d{2}$/);
  });

  /**
   * ⚠️ Senza coach assegnata l'attività non la riceve nessuno: la nutrizionista che ha appena deciso
   * deve saperlo, o crede di aver passato la palla a qualcuno.
   */
  it('⚠️ senza coach assegnata lo dice a chi ha deciso', async () => {
    const { service, prisma } = await crea();
    prisma.user.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where?.id === 'cli-1'
          ? { id: 'cli-1', role: 'client', firstName: 'Sonia', clientProfile: { assignedNutritionist: { displayName: 'Dr.ssa Bini' }, assignedCoach: null } }
          : { id: where?.id, role: 'nutritionist' },
      ),
    );
    const esito: any = await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    expect(esito.attivitaSenzaCoach).toBe(true);
  });

  it('e con la coach assegnata non dice niente, perché non c\'è niente da dire', async () => {
    const { service, prisma, coachTasks } = await crea();
    prisma.user.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where?.id === 'cli-1'
          ? { id: 'cli-1', role: 'client', firstName: 'Sonia', clientProfile: { assignedNutritionist: { displayName: 'Dr.ssa Bini' }, assignedCoach: { displayName: 'Marta' } } }
          : { id: where?.id, role: 'nutritionist' },
      ),
    );
    const esito: any = await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    expect(esito.attivitaSenzaCoach).toBe(false);
    expect(coachTasks.apriAttivita.mock.calls[0][0].description).not.toContain('COACH assegnata');
  });

  /**
   * ⚠️ «C'ERA GIÀ» È UN SUCCESSO (revisione della notte). Il secondo salvataggio dello stesso giorno
   * non crea niente, e per chi ha deciso l'attività c'è: dirle «non risulta aperta» le farebbe
   * cercare un problema che non ha, o rifare tutto una terza volta.
   */
  it('⚠️ se l\'attività c\'era già, per chi decide è aperta lo stesso', async () => {
    const { service, coachTasks } = await crea();
    coachTasks.apriAttivita.mockResolvedValue('gia-presente');
    const esito: any = await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    expect(esito.attivitaAperta).toBe(true);
    expect(esito.attivitaGiaPresente).toBe(true);
  });

  it('«può proseguire» non apre niente: non c\'è nessuna visita da fissare', async () => {
    const { service, coachTasks } = await crea();
    const esito: any = await service.decidiIdoneita('cli-1', 'nutri-user', 'idonea', NOTA);
    expect(coachTasks.apriAttivita).not.toHaveBeenCalled();
    expect(esito.attivitaAperta).toBe(false);
  });

  /**
   * ⚠️ Un'attività non aperta è un lavoro in più per qualcuno; un'eccezione qui sarebbe una
   * decisione clinica che non si salva. Quindi si degrada — ma l'errore si scrive, o «la visita
   * resta da fissare a mano» non lo saprebbe nessuno.
   */
  it('⚠️ se l\'attività non si apre, la decisione si salva lo stesso e l\'errore finisce nei log', async () => {
    const { service, coachTasks, prisma } = await crea();
    coachTasks.apriAttivita.mockRejectedValue(new Error('coda non raggiungibile'));
    const log = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    const esito: any = await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    expect(esito.idoneita).toBe('serve_visita');
    expect(esito.attivitaAperta).toBe(false);
    expect(prisma.clientProfile.update).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('coda non raggiungibile'));
  });

  /**
   * ⚠️ Il credito visite si legge da chi lo conta già per l'app: un secondo conteggio direbbe alla
   * coach un numero diverso da quello che la cliente vede sul telefono. E se non si riesce a
   * contarlo, il testo dice «non lo so» invece di «non ne ha».
   */
  it('⚠️ il credito non calcolabile non ferma niente, e non diventa zero', async () => {
    const { service, coachTasks, prenotazioni } = await crea();
    prenotazioni.credito.mockRejectedValue(new Error('ordini non leggibili'));
    await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA, ENTRO());
    const passato = coachTasks.apriAttivita.mock.calls[0][0];
    expect(passato.description).toContain('Non sono riuscito a contare');
    expect(passato.description).not.toContain('NON ha visite disponibili');
  });
});
