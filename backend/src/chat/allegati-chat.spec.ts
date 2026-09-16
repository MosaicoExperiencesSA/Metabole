import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FINESTRA_LINK_MS,
  TIPI_AMMESSI,
  MAX_BYTES_ALLEGATO,
  contentDisposition,
  linkFirmato,
  nomePulito,
  scadenzaLink,
  siVedeInBolla,
  valutaAllegato,
  verificaFirma,
} from './allegati-chat';

/**
 * ⛔ **GLI ALLEGATI IN CHAT — le regole** (Simone, 16/9). Cosa passa, cosa no, come si chiama il
 * file e com'è fatto il link che lo apre.
 */
const b64 = (n: number) => Buffer.alloc(n, 7).toString('base64');

describe('⛔ valutaAllegato', () => {
  it('✅ una foto, un PDF, un Word passano, col contenuto decodificato', () => {
    for (const tipo of ['image/jpeg', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) {
      const r = valutaAllegato({ nome: 'x', tipo, base64: b64(10) });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.contenuto.length).toBe(10);
    }
  });

  it('⛔ HTML, SVG, eseguibili e tipi vuoti NO: si riaprono dal nostro dominio', () => {
    for (const tipo of ['text/html', 'image/svg+xml', 'application/javascript', 'application/x-msdownload', '', 'application/octet-stream']) {
      const r = valutaAllegato({ nome: 'x', tipo, base64: b64(10) });
      expect(r.ok).toBe(false);
    }
  });

  it('il tipo si confronta senza maiuscole e spazi', () => {
    expect(valutaAllegato({ nome: 'x', tipo: ' Image/PNG ', base64: b64(3) }).ok).toBe(true);
  });

  it('⛔ base64 rotto o vuoto: si dice di riprovare', () => {
    for (const base64 of ['', 'abc', '@@@@', 'QUJD\u0000']) {
      const r = valutaAllegato({ nome: 'x', tipo: 'image/png', base64 });
      expect(r.ok).toBe(false);
    }
    const vuoto = valutaAllegato({ nome: 'x', tipo: 'image/png', base64: '====' });
    expect(vuoto.ok).toBe(false);
  });

  it('il base64 spezzato su più righe (come lo scrivono certi strumenti) passa', () => {
    const r = valutaAllegato({ nome: 'x', tipo: 'image/png', base64: 'QUJD\nREVG\r\n' });
    expect(r.ok && r.contenuto.toString()).toBe('ABCDEF');
  });

  it('⛔ 8 MB esatti passano, un byte in più no', () => {
    expect(valutaAllegato({ nome: 'x', tipo: 'application/pdf', base64: b64(MAX_BYTES_ALLEGATO) }).ok).toBe(true);
    const troppo = valutaAllegato({ nome: 'x', tipo: 'application/pdf', base64: b64(MAX_BYTES_ALLEGATO + 1) });
    expect(troppo.ok).toBe(false);
    if (!troppo.ok) expect(troppo.messaggio).toContain('8 MB');
  });
});

describe('nomePulito', () => {
  it('toglie le cartelle e i caratteri di controllo, tiene accenti e spazi', () => {
    expect(nomePulito('C:\\Users\\a\\Referto analisi è ok.pdf', 'application/pdf')).toBe('Referto analisi è ok.pdf');
    expect(nomePulito('../../etc/passwd', 'text/plain')).toBe('passwd.txt');
    expect(nomePulito('a\u0000b"c.png', 'image/png')).toBe('abc.png');
  });

  it('⛔ un\'estensione che non è del tipo dichiarato si sostituisce (niente .exe o .html travestiti)', () => {
    expect(nomePulito('ricetta.exe', 'application/msword')).toBe('ricetta.doc');
    expect(nomePulito('nota.html', 'text/plain')).toBe('nota.txt');
    expect(nomePulito('foto.JPEG', 'image/jpeg')).toBe('foto.JPEG');
    expect(nomePulito('scan.heic', 'image/heif')).toBe('scan.heic');
    expect(nomePulito('.exe', 'application/pdf')).toBe('allegato.pdf');
    expect(nomePulito('referto.pdf', 'image/png')).toBe('referto.png');
  });

  it('un nome vuoto diventa «allegato» con l\'estensione del tipo', () => {
    expect(nomePulito('', 'image/jpeg')).toBe('allegato.jpg');
    expect(nomePulito('..', 'application/pdf')).toBe('allegato.pdf');
  });

  it('un nome lunghissimo si accorcia tenendo l\'estensione', () => {
    const n = nomePulito(`${'a'.repeat(300)}.pdf`, 'application/pdf');
    expect(n.length).toBe(120);
    expect(n.endsWith('.pdf')).toBe(true);
  });
});

describe('come si apre', () => {
  it('le foto si vedono in bolla (HEIC no), PDF e testo si aprono, il resto si scarica', () => {
    expect(siVedeInBolla('image/png')).toBe(true);
    expect(siVedeInBolla('image/heic')).toBe(false);
    expect(contentDisposition('application/pdf', 'a.pdf')).toMatch(/^inline;/);
    expect(contentDisposition('application/msword', 'a.doc')).toMatch(/^attachment;/);
  });

  it('il nome con gli accenti arriva intero (RFC 5987) e senza virgolette nel campo semplice', () => {
    const d = contentDisposition('image/png', 'però "x".png');
    expect(d).toContain(`filename*=UTF-8''${encodeURIComponent('però "x".png')}`);
    expect(d).toContain('filename="per_ _x_.png"');
  });
});

describe('⛔ il link firmato', () => {
  const SEGRETO = 'segreto-di-prova';
  const ORA = Date.parse('2026-09-16T10:07:00.000Z');
  const parti = (url: string) => {
    const u = new URL(url);
    return { id: decodeURIComponent(u.pathname.split('/').pop()!), q: Object.fromEntries(u.searchParams) };
  };

  it('vale almeno mezz\'ora, e non cambia dentro la stessa mezz\'ora (la chat si ricarica ogni 12 secondi)', () => {
    const s = scadenzaLink(ORA);
    expect(s - ORA).toBeGreaterThanOrEqual(FINESTRA_LINK_MS);
    expect(s - ORA).toBeLessThanOrEqual(2 * FINESTRA_LINK_MS);
    expect(linkFirmato('https://api.x', SEGRETO, 'a1', 'u1', ORA)).toBe(linkFirmato('https://api.x', SEGRETO, 'a1', 'u1', ORA + 12_000));
  });

  it('✅ il link appena fatto si apre, e dice per chi è', () => {
    const url = linkFirmato('https://api.x/', SEGRETO, 'a1', 'u1', ORA);
    expect(url.startsWith('https://api.x/api/v1/chat-files/a1?')).toBe(true);
    const { id, q } = parti(url);
    expect(verificaFirma(SEGRETO, id, q, ORA + 60_000)).toEqual({ ok: true, utente: 'u1' });
  });

  it('⛔ cambiare file, persona o scadenza rompe la firma', () => {
    const { q } = parti(linkFirmato('https://api.x', SEGRETO, 'a1', 'u1', ORA));
    expect(verificaFirma(SEGRETO, 'a2', q, ORA)).toEqual({ ok: false, scaduto: false });
    expect(verificaFirma(SEGRETO, 'a1', { ...q, u: 'u2' }, ORA)).toEqual({ ok: false, scaduto: false });
    expect(verificaFirma(SEGRETO, 'a1', { ...q, e: String(Number(q.e) + FINESTRA_LINK_MS) }, ORA)).toEqual({ ok: false, scaduto: false });
    expect(verificaFirma('altro-segreto', 'a1', q, ORA)).toEqual({ ok: false, scaduto: false });
    expect(verificaFirma(SEGRETO, 'a1', { e: q.e, u: q.u }, ORA)).toEqual({ ok: false, scaduto: false });
    // Una firma di lunghezza diversa è un «no», non un errore del server.
    expect(verificaFirma(SEGRETO, 'a1', { ...q, s: q.s.slice(2) }, ORA)).toEqual({ ok: false, scaduto: false });
    expect(verificaFirma(SEGRETO, 'a1', { ...q, s: q.s + 'xx' }, ORA)).toEqual({ ok: false, scaduto: false });
  });

  it('⛔ la firma NON è un HMAC col segreto nudo: la chiave dei link è derivata', () => {
    const { createHmac } = jest.requireActual('crypto') as typeof import('crypto');
    const { q } = parti(linkFirmato('https://api.x', SEGRETO, 'a1', 'u1', ORA));
    const nuda = createHmac('sha256', SEGRETO).update(`a1.${q.e}.u1`).digest('base64url');
    expect(q.s).not.toBe(nuda);
    expect(verificaFirma(SEGRETO, 'a1', { ...q, s: nuda }, ORA)).toEqual({ ok: false, scaduto: false });
  });

  it('⛔ dopo la scadenza non si apre, e lo dice solo se la firma è buona', () => {
    const { q } = parti(linkFirmato('https://api.x', SEGRETO, 'a1', 'u1', ORA));
    const dopo = Number(q.e) + 1;
    expect(verificaFirma(SEGRETO, 'a1', q, Number(q.e))).toEqual({ ok: true, utente: 'u1' });
    expect(verificaFirma(SEGRETO, 'a1', q, dopo)).toEqual({ ok: false, scaduto: true });
    expect(verificaFirma(SEGRETO, 'a1', { ...q, s: q.s.slice(1) + 'A' }, dopo)).toEqual({ ok: false, scaduto: false });
  });
});

describe('⛔ le due pagine propongono gli stessi tipi che il server accetta', () => {
  it('app e backoffice: stessa lista, stesso tetto', () => {
    for (const pacchetto of ['app', 'backoffice']) {
      const src = readFileSync(join(__dirname, '..', '..', '..', pacchetto, 'src', 'lib', 'allegati.ts'), 'utf8');
      const blocco = src.slice(src.indexOf('export const ACCETTA_ALLEGATI'), src.indexOf("].join(',')"));
      const tipi = [...blocco.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
      expect(tipi).toEqual(Object.keys(TIPI_AMMESSI).sort());
      expect(src).toContain('export const MAX_BYTES_ALLEGATO = 8 * 1024 * 1024;');
    }
  });
});
