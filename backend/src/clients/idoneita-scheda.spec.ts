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
import { ClientsService } from './clients.service';

const NOTA = 'Valutata in visita il 12/8: allergia al latte, nessuna controindicazione al percorso.';

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
  const moduleRef = await Test.createTestingModule({
    providers: [
      ClientsService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: {} },
      { provide: AuditService, useValue: audit },
      { provide: NotificationsService, useValue: { notify: jest.fn() } },
      { provide: MenuService, useValue: {} },
    ],
  }).compile();
  return { service: moduleRef.get(ClientsService), prisma, audit };
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
    await service.decidiIdoneita('cli-1', 'nutri-user', 'serve_visita', NOTA);
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
