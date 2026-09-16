import { createHmac, timingSafeEqual } from 'crypto';

/**
 * ⛔ **GLI ALLEGATI NELLE CHAT** (Simone, 16/9: *«nelle chat tutte, anche quella del Nutrizionista,
 * mettiamo la possibilità di allegare un file, immagine, ecc»*).
 *
 * Qui stanno le regole, senza database e senza chiavi: cosa si può allegare, quanto grande, come si
 * chiama, e com'è fatto il link che lo apre. Il service legge, cifra e scrive.
 *
 * ## Le scelte, una per una
 *
 * - **Un file per messaggio.** Chi vuole mandarne tre manda tre messaggi: la bolla resta leggibile e
 *   la ✕ di «chi scrive può cancellare» toglie una cosa sola.
 * - **8 MB al massimo.** Il file viaggia in base64 dentro il JSON, che cresce di un terzo, e il
 *   corpo delle richieste è limitato a 12 MB (`main.ts`): 8 × 4/3 ≈ 10,7 sta dentro con margine.
 *   Le foto le rimpicciolisce prima il telefono, quindi il tetto lo toccano quasi solo i PDF.
 * - **Un elenco di tipi ammessi, non un elenco di vietati.** Il file si riapre dal NOSTRO dominio: un
 *   HTML o un SVG caricati da una cliente diventerebbero una pagina che gira col nostro indirizzo.
 *   Quindi: immagini, PDF, documenti d'ufficio, testo semplice. Nient'altro.
 * - **Il link è firmato e scade.** `<img src>` e «apri il PDF» non possono mandare il token di
 *   accesso, e sul telefono un PDF si apre fuori dall'app. Il link porta con sé chi lo ha chiesto e
 *   fino a quando vale; la firma impedisce di cambiarli. ⚠️ La scadenza è **a finestre di mezz'ora**:
 *   la chat si ricarica ogni 12 secondi, e un link che cambiasse a ogni giro farebbe riscaricare
 *   tutte le foto ogni 12 secondi.
 */

export const MAX_BYTES_ALLEGATO = 8 * 1024 * 1024;

/** I tipi ammessi, con l'estensione che si mostra se il nome non ne ha una. */
export const TIPI_AMMESSI: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
};

/**
 * Le estensioni che un tipo può avere. ⚠️ Un nome la cui estensione NON è fra queste la perde e prende
 * quella del tipo (revisione, 16/9): «ricetta.exe» dichiarato Word si scaricava come `.exe`, e
 * «nota.html» dichiarato testo si apriva dalla cartella Download come una pagina web.
 */
const ESTENSIONI: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/heic': ['heic'],
  'image/heif': ['heif', 'heic'],
  'text/plain': ['txt'],
};

/**
 * Le immagini che un browser disegna da solo: queste si mostrano dentro la bolla. HEIC no — Chrome
 * non lo sa leggere, e una miniatura rotta è peggio di un link che funziona.
 */
const SI_VEDONO: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Quelle che il browser apre dentro la sua finestra invece di scaricarle. */
const SI_APRONO: ReadonlySet<string> = new Set([...SI_VEDONO, 'application/pdf', 'text/plain']);

export interface AllegatoInArrivo {
  nome: string;
  tipo: string;
  base64: string;
}

export type EsitoAllegato =
  | { ok: false; messaggio: string }
  | { ok: true; nome: string; tipo: string; contenuto: Buffer };

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Il nome come lo vedrà chi lo riceve: senza cartelle, senza caratteri di controllo, non vuoto, non
 * infinito. ⚠️ Non si toccano accenti e spazi: è il nome che ha scelto una persona.
 */
export function nomePulito(grezzo: string, tipo: string): string {
  const soloNome = String(grezzo ?? '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  let nome = soloNome.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  if (!nome || nome === '.' || nome === '..') nome = 'allegato';
  if (nome.length > 120) {
    const punto = nome.lastIndexOf('.');
    const est = punto > 0 && nome.length - punto <= 8 ? nome.slice(punto) : '';
    nome = nome.slice(0, 120 - est.length) + est;
  }
  const est = TIPI_AMMESSI[tipo];
  if (!est) return nome;
  const buone = ESTENSIONI[tipo] ?? [est];
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(nome);
  if (m && buone.includes(m[1].toLowerCase())) return nome;
  // Estensione assente o incoerente: si toglie quella sbagliata e si mette quella del tipo.
  const radice = m ? nome.slice(0, -m[0].length) || 'allegato' : nome;
  return `${radice.slice(0, 120 - est.length - 1)}.${est}`;
}

export function valutaAllegato(a: AllegatoInArrivo): EsitoAllegato {
  const tipo = String(a?.tipo ?? '').trim().toLowerCase();
  if (!TIPI_AMMESSI[tipo]) {
    return {
      ok: false,
      messaggio: 'Questo tipo di file non si può allegare. Vanno bene foto, PDF, documenti Word o Excel e file di testo.',
    };
  }
  const b64 = String(a?.base64 ?? '').replace(/\s/g, '');
  if (!b64 || b64.length % 4 !== 0 || !BASE64.test(b64)) {
    return { ok: false, messaggio: 'Il file non è arrivato intero: riprova ad allegarlo.' };
  }
  const contenuto = Buffer.from(b64, 'base64');
  if (contenuto.length === 0) return { ok: false, messaggio: 'Il file è vuoto.' };
  if (contenuto.length > MAX_BYTES_ALLEGATO) {
    return { ok: false, messaggio: 'Il file è troppo grande: il massimo è 8 MB.' };
  }
  return { ok: true, nome: nomePulito(a.nome, tipo), tipo, contenuto };
}

export function siVedeInBolla(tipo: string): boolean {
  return SI_VEDONO.has(tipo);
}

/** `inline` per quello che il browser apre da sé, `attachment` per il resto. Nome codificato RFC 5987. */
export function contentDisposition(tipo: string, nome: string): string {
  const modo = SI_APRONO.has(tipo) ? 'inline' : 'attachment';
  const ascii = nome.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

// ---------- Il link firmato ----------

export const FINESTRA_LINK_MS = 30 * 60_000;

/**
 * Fino a quando vale un link chiesto adesso: la fine della mezz'ora dopo quella in corso. Così vale
 * sempre **almeno** trenta minuti e resta **identico** per tutta la mezz'ora.
 */
export function scadenzaLink(adessoMs: number): number {
  return (Math.floor(adessoMs / FINESTRA_LINK_MS) + 2) * FINESTRA_LINK_MS;
}

/**
 * ⚠️ La chiave dei link è DERIVATA dal segreto, non il segreto stesso (revisione, 16/9): se il
 * segreto è quello dei token di accesso, una firma di un link non deve mai poter valere come
 * qualcos'altro, né il contrario.
 */
function chiaveLink(segreto: string): Buffer {
  return createHmac('sha256', segreto).update('metabole:chat-files:v1').digest();
}

function firma(segreto: string, id: string, scade: number, utente: string): string {
  return createHmac('sha256', chiaveLink(segreto)).update(`${id}.${scade}.${utente}`).digest('base64url');
}

export function linkFirmato(base: string, segreto: string, id: string, utente: string, adessoMs: number): string {
  const scade = scadenzaLink(adessoMs);
  const q = new URLSearchParams({ e: String(scade), u: utente, s: firma(segreto, id, scade, utente) });
  return `${base.replace(/\/$/, '')}/api/v1/chat-files/${encodeURIComponent(id)}?${q.toString()}`;
}

export type EsitoFirma = { ok: true; utente: string } | { ok: false; scaduto: boolean };

export function verificaFirma(
  segreto: string,
  id: string,
  q: { e?: string; u?: string; s?: string },
  adessoMs: number,
): EsitoFirma {
  const scade = Number(q.e);
  const utente = String(q.u ?? '');
  const data = String(q.s ?? '');
  if (!Number.isFinite(scade) || !utente || !data) return { ok: false, scaduto: false };
  const atteso = Buffer.from(firma(segreto, id, scade, utente));
  const arrivato = Buffer.from(data);
  if (atteso.length !== arrivato.length || !timingSafeEqual(atteso, arrivato)) return { ok: false, scaduto: false };
  // ⚠️ La scadenza si guarda DOPO la firma: a un link falso non si dice nemmeno che è scaduto.
  if (adessoMs > scade) return { ok: false, scaduto: true };
  return { ok: true, utente };
}
