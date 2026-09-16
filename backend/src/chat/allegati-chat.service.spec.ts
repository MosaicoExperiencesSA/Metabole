import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, ForbiddenException, GoneException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { decryptBuffer, deriveKey } from '../health-area/crypto.util';
import { ChatService } from './chat.service';
import { AllegatiChatService } from './allegati-chat.service';
import { ChatFilesController, ThreadsController, baseDellaRichiesta } from './chat.controller';

/**
 * ⛔ **GLI ALLEGATI IN CHAT — la porta** (Simone, 16/9). Si prova che il file si cifri, che il
 * contenuto non esca mai nelle liste, che il link si ricontrolli all'apertura, che Gaia non ne
 * riceva, e che il corpo vero mandato dalle pagine passi la validazione.
 */
const CHIAVE = 'chiave-di-prova';
const SEGRETO = 'segreto-di-prova';
const config = (valori: Record<string, string> = { FILE_ENCRYPTION_KEY: CHIAVE, JWT_ACCESS_SECRET: SEGRETO }) => ({
  get: jest.fn((k: string) => valori[k]),
});
const PNG = Buffer.from('ciao sono una foto');

function servizio(prisma: Record<string, unknown> = {}) {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const s = new AllegatiChatService(prisma as never, config() as never, audit as never);
  return { s, audit };
}

const parti = (url: string) => {
  const u = new URL(url);
  return { id: decodeURIComponent(u.pathname.split('/').pop()!), q: Object.fromEntries(u.searchParams) as Record<string, string> };
};

describe('⛔ AllegatiChatService.prepara', () => {
  it('✅ cifra con la chiave dei documenti: il contenuto salvato non è il file, e si decifra', () => {
    const { s } = servizio();
    const p = s.prepara({ nome: 'foto.png', tipo: 'image/png', base64: PNG.toString('base64') });
    expect(p).toMatchObject({ fileName: 'foto.png', mimeType: 'image/png', sizeBytes: PNG.length });
    expect(Buffer.from(p.data).includes(PNG)).toBe(false);
    expect(decryptBuffer(Buffer.from(p.data), deriveKey(CHIAVE)).equals(PNG)).toBe(true);
  });

  it('⛔ un file che non va: 400 con la frase', () => {
    const { s } = servizio();
    expect(() => s.prepara({ nome: 'x.html', tipo: 'text/html', base64: PNG.toString('base64') })).toThrow(BadRequestException);
  });
});

describe('⛔ conLink — il contenuto non esce mai', () => {
  it('toglie `attachments`, aggiunge `allegati` col link, e un messaggio senza allegati esce con []', () => {
    const { s } = servizio();
    const m = s.conLink(
      { id: 'm1', body: '', attachments: [{ id: 'a1', fileName: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 9, data: 'SEGRETO' } as never] },
      'u1',
      'https://api.x',
    );
    expect(m).not.toHaveProperty('attachments');
    expect(JSON.stringify(m)).not.toContain('SEGRETO');
    expect(m.allegati).toEqual([
      expect.objectContaining({ id: 'a1', fileName: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 9, immagine: false }),
    ]);
    expect(m.allegati[0].url).toMatch(/^https:\/\/api\.x\/api\/v1\/chat-files\/a1\?/);
    // Le foto che il browser sa disegnare si segnano come immagini (e si vedono in bolla).
    expect(s.conLink({ attachments: [{ id: 'a2', fileName: 'f.jpg', mimeType: 'image/jpeg', sizeBytes: 1 }] }, 'u1', 'https://api.x').allegati[0].immagine).toBe(true);
    expect(s.conLink({ id: 'gaia' }, 'u1', 'https://api.x').allegati).toEqual([]);
  });
});

describe('⛔ apri — il link si ricontrolla adesso', () => {
  const ORA = Date.parse('2026-09-16T10:00:00.000Z');

  function montaggio(opts: { cancellato?: boolean; utente?: { id: string; role: string } | null; chiave?: string } = {}) {
    const { s: cifratore } = servizio();
    const cifrato = cifratore.prepara({ nome: 'foto.png', tipo: 'image/png', base64: PNG.toString('base64') }).data;
    const prisma = {
      messageAttachment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1', fileName: 'foto.png', mimeType: 'image/png', data: cifrato,
          message: { id: 'm1', threadId: 'th-1', deletedAt: opts.cancellato ? new Date() : null, thread: { clientId: 'cli-1' } },
        }),
      },
      user: { findFirst: jest.fn().mockResolvedValue(opts.utente === undefined ? { id: 'u-coach', role: 'coach' } : opts.utente) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const s = new AllegatiChatService(
      prisma as never,
      config({ FILE_ENCRYPTION_KEY: opts.chiave ?? CHIAVE, JWT_ACCESS_SECRET: SEGRETO }) as never,
      audit as never,
    );
    const { q } = parti(s.conLink({ attachments: [{ id: 'a1', fileName: 'f', mimeType: 'image/png', sizeBytes: 1 }] }, 'u-coach', 'https://api.x', ORA).allegati[0].url);
    return { s, prisma, audit, q };
  }

  it('✅ firma buona e accesso buono: il file in chiaro, il tipo e l\'audit dello staff', async () => {
    const { s, audit, q } = montaggio();
    const puo = jest.fn().mockResolvedValue(true);
    const f = await s.apri('a1', q, puo, ORA);
    expect(f.contenuto.equals(PNG)).toBe(true);
    expect(f.tipo).toBe('image/png');
    expect(f.disposizione).toMatch(/^inline;/);
    expect(puo).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u-coach', role: 'coach' }), 'th-1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'chat.attachment_opened', actorId: 'u-coach', entityId: 'a1' }));
  });

  it('⛔ file che non esiste: 404, non un 500', async () => {
    const { s, prisma, q } = montaggio();
    prisma.messageAttachment.findUnique.mockResolvedValueOnce(null);
    await expect(s.apri('a1', q, async () => true, ORA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('l\'apertura dell\'admin resta nell\'audit come quella di chiunque dello staff', async () => {
    const { s, audit, q } = montaggio({ utente: { id: 'u-coach', role: 'admin' } });
    await s.apri('a1', q, async () => true, ORA);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'chat.attachment_opened', metadata: expect.objectContaining({ role: 'admin' }) }));
  });

  it('la cliente che apre il suo file non lascia righe nell\'audit', async () => {
    const { s, audit, q } = montaggio({ utente: { id: 'u-coach', role: 'client' } });
    await s.apri('a1', q, async () => true, ORA);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('⛔ firma falsa: 403 e nessuna lettura del database', async () => {
    const { s, prisma, q } = montaggio();
    await expect(s.apri('a1', { ...q, u: 'u-altro' }, async () => true, ORA)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.messageAttachment.findUnique).not.toHaveBeenCalled();
  });

  it('⛔ scaduto: 410, con la frase che dice cosa fare', async () => {
    const { s, q } = montaggio();
    await expect(s.apri('a1', q, async () => true, Number(q.e) + 1)).rejects.toThrow(GoneException);
  });

  it('⛔ messaggio cancellato dal suo autore: il file sparisce con lui', async () => {
    const { s, q } = montaggio({ cancellato: true });
    await expect(s.apri('a1', q, async () => true, ORA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('⛔ utente che non c\'è più: 403, e il cancello si chiede solo agli utenti veri', async () => {
    const { s, prisma, q } = montaggio({ utente: null });
    const puo = jest.fn().mockResolvedValue(true);
    await expect(s.apri('a1', q, puo, ORA)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u-coach', deletedAt: null, status: 'active' } }));
    expect(puo).not.toHaveBeenCalled();
  });

  it('⛔ chi non può più leggere la conversazione non apre il file, e non resta traccia di un\'apertura', async () => {
    const { s, audit, q } = montaggio();
    await expect(s.apri('a1', q, async () => false, ORA)).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('⚠️ chiave cambiata: 410, non un 500 muto', async () => {
    const { s, q } = montaggio({ chiave: 'un-altra-chiave' });
    await expect(s.apri('a1', q, async () => true, ORA)).rejects.toBeInstanceOf(GoneException);
  });
});

describe('⛔ ChatService — gli allegati nel messaggio', () => {
  const nutri = { sub: 'nutri-user', email: 'n@m.eu', role: 'nutritionist' } as never;
  const client = { sub: 'cli-1', email: 'c@m.eu', role: 'client' } as never;
  const ALLEGATO = { fileName: 'f.png', mimeType: 'image/png', sizeBytes: 3, data: new Uint8Array([1, 2, 3]) };

  function montaggio(counterpart: string) {
    const prisma = {
      chatThread: {
        findUnique: jest.fn().mockResolvedValue({ id: 'th-1', clientId: 'cli-1', counterpart }),
        update: jest.fn().mockResolvedValue({}),
      },
      message: {
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'm1', sentAt: new Date(), ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // La rete sopra lo staff (letture): nessuno sotto a nessuno.
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-n' }), findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-c', assignedNutritionistId: 'staff-n' }) },
      chatRead: { upsert: jest.fn().mockResolvedValue({}) },
      foodSwap: { upsert: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const notifications = { notifyOncePerDay: jest.fn().mockResolvedValue(undefined), notify: jest.fn().mockResolvedValue(undefined) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const ai = { reply: jest.fn() };
    const s = new ChatService(
      prisma as never, notifications as never, audit as never, ai as never,
      {} as never, {} as never, {} as never, {} as never,
      { getNumber: jest.fn(async (_k: string, d: number) => d), getString: jest.fn(async (_k: string, d: string) => d) } as never,
    );
    return { s, prisma, notifications, ai };
  }

  it('✅ il file si scrive DENTRO il messaggio, e un messaggio fatto solo di file è valido', async () => {
    const { s, prisma, notifications } = montaggio('nutritionist');
    await s.postMessage(nutri, 'th-1', undefined, ALLEGATO);
    const arg = prisma.message.create.mock.calls[0][0] as { data: Record<string, unknown>; include: unknown };
    expect(arg.data.body).toBe('');
    expect(arg.data.attachments).toEqual({ create: [ALLEGATO] });
    // ⚠️ La risposta porta i metadati dell'allegato, e mai il contenuto.
    expect(arg.include).toEqual({ attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } } });
    // La cliente viene avvisata come per un messaggio scritto.
    expect(notifications.notifyOncePerDay).toHaveBeenCalled();
  });

  it('⛔ niente testo e niente file: 400, e niente scritto', async () => {
    const { s, prisma } = montaggio('nutritionist');
    await expect(s.postMessage(nutri, 'th-1', '   ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.postMessage(nutri, 'th-1', undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('⛔ un file a Gaia: 400 che dice dove mandarlo, e Gaia non parte', async () => {
    const { s, prisma, ai } = montaggio('ai');
    await expect(s.postMessage(client, 'th-1', 'guarda', ALLEGATO)).rejects.toThrow(/coach o alla nutrizionista/);
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(ai.reply).not.toHaveBeenCalled();
  });

  it('senza file il messaggio si scrive com\'era, testo compreso di spazi, senza `attachments`', async () => {
    const { s, prisma } = montaggio('nutritionist');
    await s.postMessage(nutri, 'th-1', ' ciao ');
    const data = (prisma.message.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.body).toBe(' ciao ');
    expect(data).not.toHaveProperty('attachments');
  });

  it('⛔ le letture chiedono degli allegati SOLO i metadati, mai `data`', async () => {
    const { s, prisma } = montaggio('nutritionist');
    await s.listMessages(nutri, 'th-1');
    const arg = prisma.message.findMany.mock.calls[0][0] as { include: { attachments: { select: Record<string, boolean> } } };
    expect(arg.include.attachments.select).toEqual({ id: true, fileName: true, mimeType: true, sizeBytes: true });
  });

  it('puoLeggereIlThread: la stessa risposta del cancello delle LETTURE (non delle scritture)', async () => {
    const { s, prisma } = montaggio('nutritionist');
    expect(await s.puoLeggereIlThread(nutri, 'th-1')).toBe(true);
    // Chi legge e non scrive: l'admin e (dal 16/9) la coach della cliente.
    expect(await s.puoLeggereIlThread({ sub: 'admin-u', role: 'admin' } as never, 'th-1')).toBe(true);
    prisma.staff.findUnique.mockResolvedValueOnce({ id: 'staff-c' });
    expect(await s.puoLeggereIlThread({ sub: 'coach-u', role: 'coach' } as never, 'th-1')).toBe(true);
    expect(await s.puoLeggereIlThread({ sub: 'altra', role: 'client' } as never, 'th-1')).toBe(false);
    prisma.chatThread.findUnique.mockResolvedValueOnce(null);
    expect(await s.puoLeggereIlThread(nutri, 'th-x')).toBe(false);
  });
});

describe('⛔ i controller', () => {
  const req = { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'api.metabole.test' }, protocol: 'http' } as never;

  it('⛔ il file si controlla PRIMA di scrivere il messaggio', async () => {
    const chat = { postMessage: jest.fn() };
    const { s } = servizio();
    const c = new ThreadsController(chat as never, s);
    await expect(
      c.send({ sub: 'u', role: 'coach' } as never, 'th-1', { body: 'ecco', allegato: { nome: 'x', tipo: 'text/html', base64: 'QUJD' } }, req),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(chat.postMessage).not.toHaveBeenCalled();
  });

  it('✅ invio con file: al servizio arriva cifrato, e la risposta porta il link sull\'host pubblico', async () => {
    const chat = {
      postMessage: jest.fn().mockResolvedValue({
        message: { id: 'm1', body: '', attachments: [{ id: 'a1', fileName: 'f.png', mimeType: 'image/png', sizeBytes: 3 }] },
      }),
    };
    const { s } = servizio();
    const c = new ThreadsController(chat as never, s);
    const r = await c.send({ sub: 'u', role: 'coach' } as never, 'th-1', { allegato: { nome: 'f.png', tipo: 'image/png', base64: 'QUJD' } }, req);
    expect(chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u' }), 'th-1', undefined,
      expect.objectContaining({ fileName: 'f.png', mimeType: 'image/png', sizeBytes: 3 }),
    );
    expect(r.message.allegati[0].url.startsWith('https://api.metabole.test/api/v1/chat-files/a1?')).toBe(true);
    expect(r).not.toHaveProperty('aiReply');
  });

  it('la risposta di Gaia esce anche lei con `allegati` (vuoti)', async () => {
    const chat = { postMessage: jest.fn().mockResolvedValue({ message: { id: 'm1', attachments: [] }, aiReply: { id: 'm2', body: 'ok' } }) };
    const { s } = servizio();
    const c = new ThreadsController(chat as never, s);
    const r = await c.send({ sub: 'u', role: 'client' } as never, 'th-1', { body: 'ciao' }, req);
    expect(r.aiReply).toEqual({ id: 'm2', body: 'ok', allegati: [] });
  });

  it('l\'indirizzo dei link: PUBLIC_API_URL se c\'è, altrimenti l\'host della richiesta', () => {
    const prima = process.env.PUBLIC_API_URL;
    try {
      delete process.env.PUBLIC_API_URL;
      expect(baseDellaRichiesta({ headers: { host: 'localhost:3000' }, protocol: 'http' } as never)).toBe('http://localhost:3000');
      process.env.PUBLIC_API_URL = 'https://api.metabole.eu/';
      expect(baseDellaRichiesta({ headers: { 'x-forwarded-host': 'evil.example' }, protocol: 'http' } as never)).toBe('https://api.metabole.eu');
    } finally {
      if (prima === undefined) delete process.env.PUBLIC_API_URL; else process.env.PUBLIC_API_URL = prima;
    }
  });

  it('le letture passano dal link: ogni messaggio esce con `allegati`', async () => {
    const chat = { listMessages: jest.fn().mockResolvedValue([{ id: 'm1', attachments: [] }, { id: 'm2' }]) };
    const { s } = servizio();
    const c = new ThreadsController(chat as never, s);
    const r = await c.list({ sub: 'u', role: 'coach' } as never, 'th-1', req);
    expect(r).toEqual([{ id: 'm1', allegati: [] }, { id: 'm2', allegati: [] }]);
  });

  it('⛔ la rotta del file è pubblica, con le tre intestazioni che contano', async () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ChatFilesController)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ThreadsController)).toBeUndefined();
    const allegati = { apri: jest.fn().mockResolvedValue({ contenuto: PNG, tipo: 'image/png', disposizione: 'inline; filename="f.png"' }) };
    const chat = { puoLeggereIlThread: jest.fn().mockResolvedValue(true) };
    const c = new ChatFilesController(chat as never, allegati as never);
    const intestazioni: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => { intestazioni[k] = v; }, end: jest.fn() };
    await c.apri('a1', { e: '1', u: 'u', s: 's' }, res as never);
    expect(intestazioni).toMatchObject({
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="f.png"',
      'Content-Length': String(PNG.length),
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=1800',
    });
    expect(res.end).toHaveBeenCalledWith(PNG);
    // ⚠️ Il cancello passato è quello delle conversazioni, non uno scritto qui.
    const cancello = allegati.apri.mock.calls[0][2] as (u: unknown, t: string) => Promise<boolean>;
    await cancello({ sub: 'u' }, 'th-9');
    expect(chat.puoLeggereIlThread).toHaveBeenCalledWith({ sub: 'u' }, 'th-9');
  });
});

describe('⛔ il corpo che mandano le pagine passa la validazione vera', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const tipo = Reflect.getMetadata('design:paramtypes', ThreadsController.prototype, 'send')[2];
  const valida = (body: unknown) => pipe.transform(body, { type: 'body', metatype: tipo });

  it('✅ solo testo, solo file, testo e file', async () => {
    await expect(valida({ body: 'ciao' })).resolves.toBeTruthy();
    await expect(valida({ allegato: { nome: 'f.png', tipo: 'image/png', base64: 'QUJD' } })).resolves.toBeTruthy();
    await expect(valida({ body: 'ecco', allegato: { nome: 'f.png', tipo: 'image/png', base64: 'QUJD' } })).resolves.toBeTruthy();
  });

  it('⛔ niente testo e niente file, un campo in più nell\'allegato, un testo troppo lungo', async () => {
    await expect(valida({})).rejects.toBeTruthy();
    await expect(valida({ allegato: { nome: 'f', tipo: 'image/png', base64: 'QUJD', percorso: '/etc' } })).rejects.toBeTruthy();
    await expect(valida({ allegato: { nome: 'f', tipo: 'image/png' } })).rejects.toBeTruthy();
    await expect(valida({ body: 'x'.repeat(4001), allegato: { nome: 'f', tipo: 'image/png', base64: 'QUJD' } })).rejects.toBeTruthy();
  });
});

describe('⛔ le pagine: la graffetta c\'è in tutte le chat umane, e non su Gaia', () => {
  const leggi = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');
  it('app: foglio chat, pagina chat, chat dello staff', () => {
    for (const f of [['app', 'src', 'components', 'ChatSheet.tsx'], ['app', 'src', 'pages', 'Assistente.tsx'], ['app', 'src', 'staff', 'coach', 'CoachChat.tsx']]) {
      const src = leggi(...f);
      expect(src).toContain('<BottoneAllega');
      expect(src).toContain('<AllegatiInBolla allegati={m.allegati} />');
    }
    // Sulle due pagine della cliente la graffetta è legata al thread NON di Gaia.
    expect(leggi('app', 'src', 'components', 'ChatSheet.tsx')).toMatch(/thread\.counterpart !== 'ai' && puoAllegare && \(\s*<BottoneAllega/);
    expect(leggi('app', 'src', 'pages', 'Assistente.tsx')).toMatch(/conAllegati && puoAllegare && \(\s*<BottoneAllega/);
    expect(leggi('app', 'src', 'pages', 'Assistente.tsx')).toContain("const conAllegati = who !== 'ai' && thread?.counterpart !== 'ai';");
  });

  it('backoffice: pagina Chat e conversazioni in scheda', () => {
    for (const f of [['backoffice', 'src', 'pages', 'Chat.tsx'], ['backoffice', 'src', 'pages', 'ClientDetail.tsx']]) {
      const src = leggi(...f);
      expect(src).toContain('<BottoneAllega');
      expect(src).toContain('<AllegatiInBolla allegati={m.allegati} />');
    }
  });

  it('⛔ chat dello staff: cambiando conversazione il file scelto sparisce, e l\'Invio non manda due volte', () => {
    const src = leggi('app', 'src', 'staff', 'coach', 'CoachChat.tsx');
    expect(src).toMatch(/useEffect\(\(\) => \{\s*setAllegato\(null\);\s*setErrore\(null\);\s*setText\(''\);\s*\}, \[threadId\]\);/);
    expect(src).toContain('if ((!body && !allegato) || !threadId || sending) return;');
    expect(leggi('backoffice', 'src', 'pages', 'Chat.tsx')).toContain('if (!sel || busy || (!body && !allegato)) return;');
    expect(leggi('backoffice', 'src', 'pages', 'ClientDetail.tsx')).toContain('if (!sel || invio || (!testo && !allegato)) return;');
  });

  it('⛔ la coach apre la chat della nutrizionista in SOLA LETTURA: niente campo, niente graffetta', () => {
    const scheda = leggi('app', 'src', 'staff', 'coach', 'CoachClienteDetail.tsx');
    expect(scheda).toContain("soloLettura: true");
    const chat = leggi('app', 'src', 'staff', 'coach', 'CoachChat.tsx');
    expect(chat).toContain('{!soloLettura && <div className="sf-chat-bar">');
    // La graffetta sta DENTRO la barra: in sola lettura non c'è. Una sola graffetta nella schermata.
    const barra = chat.slice(chat.indexOf('{!soloLettura && <div className="sf-chat-bar">'));
    expect(barra).toContain('<BottoneAllega');
    expect(chat.match(/<BottoneAllega/g)).toHaveLength(1);
  });

  it('⛔ iOS: i permessi fotocamera e foto sono nello script della build', () => {
    const src = leggi('scripts', 'install-ios.mjs');
    expect(src).toContain("'NSCameraUsageDescription'");
    expect(src).toContain("'NSPhotoLibraryUsageDescription'");
  });
});
