/**
 * I PASTI DEL DIGIUNO — e il giorno in cui la scheda cliente ha smesso di poterli scrivere.
 *
 * Fino al 21/8 `fastingWindow` si cambiava da qui, con un permesso suo. Poi è arrivato l'orologio:
 * quali pasti riceve chi digiuna lo **deriva la durata della finestra**, e la finestra la imposta la
 * cliente dall'app. Simone, 21/8: *«non ha più senso scegliere i pasti, sono campi che devono
 * proprio sparire»*.
 *
 * ⛔ **Perché non bastava togliere il campo dal DTO.** `PROFILE_FIELDS` è la porta che decide cosa
 * la scheda può scrivere sul profilo, e il ciclo la percorre **ciecamente**: finché il campo era in
 * quell'elenco, bastava un chiamante che lo passasse lo stesso — un altro servizio, uno script, un
 * DTO cambiato domani — e la finestra finiva in database senza nessun controllo. La guardia sta
 * dove si scrive.
 *
 * ⚠️ E quello che **resta**: uscire dal digiuno azzera l'orologio. Non solo la finestra — anche
 * `fastingSceltoIl`, o al ritorno al digiuno non le verrebbe chiesto niente e si ritroverebbe la
 * finestra di sei mesi prima.
 */

import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CoachTasksService } from '../coach-tasks/coach-tasks.service';
import { PrenotazioniService } from '../agenda/prenotazioni.service';
import { PauseService } from '../pause/pause.service';
import { ClientsService } from './clients.service';

const PROFILO = { fastingWindow: 'skip_breakfast', pathType: 'intermittent_fasting' };

async function crea(opzioni?: { permesso?: boolean; profilo?: Record<string, unknown> }) {
  const permesso = opzioni?.permesso ?? true;
  const profilo = { ...PROFILO, ...(opzioni?.profilo ?? {}) };
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cli-1', role: 'client', deletedAt: null }),
      // `findUnique` serve per DUE cose nello stesso metodo: leggere il ruolo dell'attore e
      // verificare che il destinatario sia una cliente. Rispondere sempre «coach» faceva fallire
      // il secondo controllo con «Modificabile solo per i clienti»: si distingue per id.
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where?.id === 'cli-1' ? { id: 'cli-1', role: 'client' } : { id: where?.id, role: 'coach' }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ ...profilo, assignedCoachId: 'staff-1', objective: 'dimagrimento' }),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    rolePagePermission: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where?.role_pageKey?.pageKey === 'change_fasting_window'
            ? { canView: true, canManage: permesso }
            : { canView: true, canManage: true },
        ),
      ),
    },
    coachTeam: { findMany: jest.fn().mockResolvedValue([]) },
    staffMember: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    diet: { findFirst: jest.fn().mockResolvedValue(null) },
    menuDay: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'e1' }) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ClientsService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: {} },
      { provide: AuditService, useValue: audit },
      { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined) } },
      { provide: MenuService, useValue: { restartFromPlanStart: jest.fn(), regenerateFromToday: jest.fn() } },
      { provide: CoachTasksService, useValue: { apriAttivita: jest.fn().mockResolvedValue(true) } },
      { provide: PrenotazioniService, useValue: { credito: jest.fn().mockResolvedValue({ disponibili: 0, concesse: 0, usate: 0 }) } },
      /**
       * ⚠️ `PauseService` è entrato nel costruttore il 23/8: la modalità viaggio adesso crea una
       * sospensione vera. Qui non è l'oggetto del test, ma i due metodi vanno esposti — la scheda
       * li chiama a ogni salvataggio della card viaggio.
       */
      {
        provide: PauseService,
        useValue: {
          sospendiPerViaggio: jest.fn().mockResolvedValue({ giorni: 0, nuovaScadenza: null, avviso: null }),
          togliSospensioneDaViaggio: jest.fn().mockResolvedValue({ tolta: false, avviso: null }),
        },
      },
    ],
  }).compile();
  return { service: moduleRef.get(ClientsService), prisma, audit };
}

/** I dati scritti sul profilo nell'ultima chiamata a `upsert`. */
const scritto = (prisma: any) => (prisma.clientProfile.upsert.mock.calls.at(-1)?.[0] as any)?.update ?? {};

describe('⛔ la scheda cliente non scrive più i pasti del digiuno', () => {
  /**
   * ⛔ Il caso che conta: **anche mandandolo di proposito** il campo non arriva a destinazione.
   * È la stessa prova che si faceva prima sul permesso, girata dall'altra parte.
   */
  it('⛔ mandare `fastingWindow` non scrive niente, con o senza permesso', async () => {
    for (const permesso of [true, false]) {
      const { service, prisma } = await crea({ permesso });
      await expect(
        service.updateClient('cli-1', 'coach-user', { fastingWindow: 'skip_breakfast_lunch' } as never),
      ).resolves.toBeDefined();
      expect(scritto(prisma).fastingWindow).toBeUndefined();
    }
  });

  /**
   * ⛔ **DUE STRATI, E FANNO DUE MESTIERI DIVERSI** (chiarito in revisione, 21/8: qui c'era scritto
   * «non lancia nemmeno… rifiutare sarebbe peggio», e a livello HTTP **rifiuta**).
   *
   * *Alla porta* — `UpdateClientDto` — il campo è dichiarato e **rifiutato con una frase italiana**
   * che dice cosa fare («ricarica la pagina»). Serve perché l'API ha `forbidNonWhitelisted`: senza
   * quella dichiarazione, una scheda aperta prima del deploy — che manda `fastingWindow: ''` a ogni
   * salvataggio — non riuscirebbe più a salvare **niente**, nemmeno un telefono, con un errore in
   * inglese su un campo che dalla sua schermata non si vede.
   *
   * *Nel servizio* — qui — il campo **non esiste**: non è in `PROFILE_FIELDS`, quindi il ciclo di
   * scrittura non lo vede nemmeno passando. Questi test chiamano il servizio direttamente, cioè
   * scavalcano la porta di proposito: verificano che se qualcosa la superasse (un altro chiamante,
   * un DTO cambiato domani) **non arriverebbe comunque in database**. Una guardia sola è una
   * guardia che qualcuno aggira per sbaglio.
   */
  it('⚠️ e non fa fallire il resto del salvataggio', async () => {
    const { service, prisma } = await crea({ permesso: false });
    await expect(
      service.updateClient('cli-1', 'coach-user', { fastingWindow: 'skip_dinner', phone: '333' } as never),
    ).resolves.toEqual({ updated: true });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('nessuna riga di log dedicata: non è successo niente da raccontare', async () => {
    const { service, audit } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'coach-user', { fastingWindow: 'skip_dinner' } as never);
    const azioni = audit.log.mock.calls.map((c: any) => c[0].action);
    expect(azioni).not.toContain('client.fasting_window.change');
  });

  /**
   * ⛔ **USCIRE DAL DIGIUNO PORTA VIA TUTTO L'OROLOGIO.** La finestra si azzerava già; dal 21/8 si
   * azzerano anche protocollo, orario, bersagli e — la più importante — `fastingSceltoIl`. Se
   * quella sopravvivesse, il giorno in cui questa cliente tornasse al digiuno **non le verrebbe
   * chiesto niente**: si ritroverebbe la finestra di sei mesi prima, senza che nessuno gliel'abbia
   * chiesta. È il difetto da cui è nata tutta questa parte.
   */
  it('⛔ cambiando percorso a 5 pasti si azzera l\'orologio intero, non solo la finestra', async () => {
    const { service, prisma } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'coach-user', { pathType: 'five' } as never);
    const s = scritto(prisma);
    expect(s.fastingWindow).toBeNull();
    expect(s.fastingProtocol).toBeNull();
    expect(s.fastingStartMin).toBeNull();
    expect(s.fastingSceltoIl).toBeNull();
    expect(s.fastingTargetStartMin).toBeNull();
    expect(s.fastingTargetProtocol).toBeNull();
  });

  it('restando nel digiuno, cambiare altro non tocca la finestra', async () => {
    const { service, prisma } = await crea({ permesso: false });
    await service.updateClient('cli-1', 'coach-user', { pathType: 'intermittent_fasting', phone: '333' } as never);
    // Nessun cambio → nessun permesso richiesto e il valore resta quello di prima.
    expect(scritto(prisma).fastingWindow ?? 'skip_breakfast').toBe('skip_breakfast');
  });
});
