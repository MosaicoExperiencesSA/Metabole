import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalNotesService } from './clinical-notes.service';
import { decryptBuffer, deriveKey, encryptBuffer } from './crypto.util';
import { DocumentsService } from './documents.service';
import { VisitsService } from './visits.service';

const nutri: AuthUser = { sub: 'nutri-user', email: 'n@m.eu', role: 'nutritionist' };
const head: AuthUser = { sub: 'head-user', email: 'h@m.eu', role: 'head_nutritionist' };
const client: AuthUser = { sub: 'client-1', email: 'c@m.eu', role: 'client' };
const coach: AuthUser = { sub: 'coach-user', email: 'co@m.eu', role: 'coach' };

describe('Cifratura documenti (AES-256-GCM)', () => {
  it('round-trip: cifra e decifra identico', () => {
    const key = deriveKey('segreto-di-test');
    const plain = Buffer.from('referto analisi del sangue — PDF finto');
    const encrypted = encryptBuffer(plain, key);
    expect(encrypted.length).toBeGreaterThan(plain.length); // iv+tag
    expect(decryptBuffer(encrypted, key).toString()).toBe(plain.toString());
  });

  it('chiave sbagliata → errore (autenticazione GCM)', () => {
    const encrypted = encryptBuffer(Buffer.from('dati'), deriveKey('chiave-giusta'));
    expect(() => decryptBuffer(encrypted, deriveKey('chiave-sbagliata'))).toThrow();
  });
});

describe('Area sanitaria', () => {
  let visits: VisitsService;
  let documents: DocumentsService;
  let notes: ClinicalNotesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      staff: {
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.userId === 'nutri-user'
              ? { id: 'staff-n' }
              : where.userId === 'head-user'
                ? { id: 'staff-h' }
                : null,
          ),
        ),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ assignedNutritionistId: 'staff-n' }),
      },
      visit: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'v1', ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'v1', ...data })),
      },
      objective: {
        findFirst: jest.fn().mockResolvedValue({ id: 'o1', history: [] }),
        update: jest.fn(),
      },
      document: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'd1', ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'd1', ...data })),
      },
      clinicalNote: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'cn1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        VisitsService,
        DocumentsService,
        ClinicalNotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('chiave-file-test') } },
      ],
    }).compile();
    visits = moduleRef.get(VisitsService);
    documents = moduleRef.get(DocumentsService);
    notes = moduleRef.get(ClinicalNotesService);
  });

  const future = new Date(Date.now() + 86_400_000).toISOString();

  describe('visite', () => {
    it('VINCOLO: la prima visita in televisita è rifiutata', async () => {
      prisma.visit.count.mockResolvedValue(0);
      await expect(
        visits.create(nutri, { clientId: 'client-1', type: 'televisit', datetime: future }),
      ).rejects.toThrow(BadRequestException);
    });

    it('la prima visita in presenza passa; la televisita di controllo pure', async () => {
      prisma.visit.count.mockResolvedValue(0);
      const first = await visits.create(nutri, { clientId: 'client-1', type: 'in_person', datetime: future });
      expect(first.type).toBe('in_person');

      prisma.visit.count.mockResolvedValue(1);
      const control = await visits.create(nutri, { clientId: 'client-1', type: 'televisit', datetime: future });
      expect(control.type).toBe('televisit');
    });

    it('un nutrizionista non prenota per pazienti non suoi (il capo sì)', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue({ assignedNutritionistId: 'staff-altro' });
      await expect(
        visits.create(nutri, { clientId: 'client-1', type: 'in_person', datetime: future }),
      ).rejects.toThrow(ForbiddenException);
      const byHead = await visits.create(head, { clientId: 'client-1', type: 'in_person', datetime: future });
      expect(byHead.id).toBe('v1');
    });

    it('start: solo le televisite hanno la stanza video', async () => {
      prisma.visit.findUnique.mockResolvedValue({ id: 'v1', clientId: 'client-1', type: 'in_person', status: 'scheduled' });
      await expect(visits.start(nutri, 'v1')).rejects.toThrow(BadRequestException);
      prisma.visit.findUnique.mockResolvedValue({ id: 'v1', clientId: 'client-1', type: 'televisit', status: 'scheduled', videoRoomId: null });
      const started = await visits.start(nutri, 'v1');
      expect(started.joinUrl).toContain('metabole-');
    });

    it('complete con confirmObjective riconferma l\'obiettivo in history', async () => {
      prisma.visit.findUnique.mockResolvedValue({ id: 'v1', clientId: 'client-1', status: 'scheduled' });
      const result = await visits.complete(nutri, 'v1', { notes: 'Tutto bene', confirmObjective: true });
      expect(result.objectiveReconfirmed).toBe(true);
      const update = prisma.objective.update.mock.calls[0][0];
      expect(update.data.status).toBe('confirmed');
      expect(update.data.history[0].event).toBe('reconfirmed_after_visit');
    });

    it('le visite della cliente NON espongono le note riservate', async () => {
      await visits.listForClient('client-1');
      const select = prisma.visit.findMany.mock.calls[0][0].select;
      expect(select.notes).toBeUndefined();
    });
  });

  describe('documenti', () => {
    const pdfBase64 = Buffer.from('%PDF-1.4 contenuto finto').toString('base64');

    it('upload cifrato: nel DB non finisce mai il contenuto in chiaro', async () => {
      await documents.upload('client-1', {
        type: 'blood_test', fileName: 'analisi.pdf', mimeType: 'application/pdf', contentBase64: pdfBase64,
      });
      const stored = prisma.document.create.mock.calls[0][0].data.data as Buffer;
      expect(stored.includes(Buffer.from('%PDF'))).toBe(false);
    });

    it('download: la cliente riottiene il file identico', async () => {
      await documents.upload('client-1', {
        type: 'blood_test', fileName: 'analisi.pdf', mimeType: 'application/pdf', contentBase64: pdfBase64,
      });
      const stored = prisma.document.create.mock.calls[0][0].data.data;
      prisma.document.findUnique.mockResolvedValue({
        id: 'd1', clientId: 'client-1', fileName: 'analisi.pdf', mimeType: 'application/pdf', data: stored,
      });
      const result = await documents.download(client, 'd1');
      expect(result.contentBase64).toBe(pdfBase64);
    });

    it('la COACH non accede mai ai documenti sanitari', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1', clientId: 'client-1', data: Buffer.alloc(40) });
      await expect(documents.download(coach, 'd1')).rejects.toThrow(ForbiddenException);
    });

    it('una cliente non scarica i documenti di un\'altra', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1', clientId: 'client-ALTRA', data: Buffer.alloc(40) });
      await expect(documents.download(client, 'd1')).rejects.toThrow(ForbiddenException);
    });

    it('mime non ammesso → rifiutato', async () => {
      await expect(
        documents.upload('client-1', { type: 'other', fileName: 'x.exe', mimeType: 'application/x-msdownload' as never, contentBase64: pdfBase64 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('review del nutrizionista con flag "fuori range"', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1', clientId: 'client-1' });
      const reviewed = await documents.review(nutri, 'd1', { flags: ['glicemia fuori range'], reviewNote: 'Da rivedere in visita' });
      expect(reviewed.status).toBe('reviewed');
      expect(reviewed.flags).toContain('glicemia fuori range');
    });
  });

  describe('note cliniche', () => {
    it('il nutrizionista assegnato scrive e legge', async () => {
      const note = await notes.create(nutri, 'client-1', 'Anamnesi iniziale.');
      expect(note.nutritionistId).toBe('staff-n');
      await notes.list(nutri, 'client-1');
      expect(prisma.clinicalNote.findMany).toHaveBeenCalled();
    });

    it('coach e admin non hanno scheda staff sanitaria valida → esclusi', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      await expect(notes.list(coach, 'client-1')).rejects.toThrow(ForbiddenException);
    });

    it('nutrizionista non assegnato → escluso; capo → ammesso', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue({ assignedNutritionistId: 'staff-altro' });
      await expect(notes.list(nutri, 'client-1')).rejects.toThrow(ForbiddenException);
      await expect(notes.list(head, 'client-1')).resolves.toBeDefined();
    });
  });
});
