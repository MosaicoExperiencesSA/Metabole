/**
 * ⛔ **GLI ALLEGATI NELLE CHAT — la parte che si può provare senza un telefono** (Simone, 16/9).
 *
 * Le regole vere le decide il server (`backend/src/chat/allegati-chat.ts`): qui si ripetono solo per
 * dire alla persona **prima** di mandare che il file non va, invece di farle aspettare un invio da
 * 8 MB per leggere un «no». Se le due liste divergono, vince il server e la frase arriva lo stesso.
 */

/** I tipi che il campo file propone. Stessa lista del server. */
export const ACCETTA_ALLEGATI = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
].join(',');

export const MAX_BYTES_ALLEGATO = 8 * 1024 * 1024;

/** Oltre questa misura (lato lungo) o questo peso una foto si rimpicciolisce prima di partire. */
export const LATO_MASSIMO_FOTO = 2000;
export const PESO_FOTO_DA_RIDURRE = 1.2 * 1024 * 1024;

export interface AllegatoDaInviare {
  nome: string;
  tipo: string;
  base64: string;
  peso: number;
}

export interface AllegatoRicevuto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  immagine: boolean;
  url: string;
}

/** `1,4 MB`, `820 KB`: quanto pesa, detto come lo si legge. */
export function pesoDetto(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(byte / 1024))} KB`;
}

/**
 * Il tipo che il telefono dichiara; se non lo dichiara, o ne dichiara uno che non è in elenco
 * (Android e Windows mandano spesso `application/octet-stream`, o `image/jpg`), quello
 * dell'estensione.
 */
export function tipoDelFile(nome: string, tipoDichiarato: string): string {
  let t = (tipoDichiarato || '').trim().toLowerCase();
  if (t === 'image/jpg' || t === 'image/pjpeg') t = 'image/jpeg';
  if (t && ACCETTA_ALLEGATI.split(',').includes(t)) return t;
  const est = (nome.split('.').pop() || '').toLowerCase();
  const per: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain',
  };
  return per[est] ?? t;
}

/** Il nome accorciato come lo accorcerebbe il server (120 caratteri, estensione salva). */
export function nomeCorto(nome: string): string {
  if (nome.length <= 120) return nome;
  const punto = nome.lastIndexOf('.');
  const est = punto > 0 && nome.length - punto <= 8 ? nome.slice(punto) : '';
  return nome.slice(0, 120 - est.length) + est;
}

/** `null` se va bene, altrimenti la frase da mostrare. */
export function problemaAllegato(tipo: string, peso: number): string | null {
  if (!ACCETTA_ALLEGATI.split(',').includes(tipo)) {
    return 'Questo tipo di file non si può allegare. Vanno bene foto, PDF, documenti Word o Excel e file di testo.';
  }
  if (peso <= 0) return 'Il file è vuoto.';
  if (peso > MAX_BYTES_ALLEGATO) return 'Il file è troppo grande: il massimo è 8 MB.';
  return null;
}

/** Le foto che si possono rimpicciolire nel browser (HEIC no: il browser non lo sa disegnare). */
export function fotoDaRidurre(tipo: string, peso: number, lato: number): boolean {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) return false;
  return peso > PESO_FOTO_DA_RIDURRE || lato > LATO_MASSIMO_FOTO;
}

/**
 * ⛔ **SU IPHONE L'ALLEGATO ARRIVA SOLO CON UNA VERSIONE NATIVA NUOVA.**
 *
 * Il campo file di iOS propone «Scatta foto», e un'app che apre la fotocamera senza aver dichiarato
 * `NSCameraUsageDescription` viene **chiusa dal sistema**. La dichiarazione la mette
 * `scripts/install-ios.mjs` dal 16/9, ma arriva ai telefoni solo con una build nativa nuova — un
 * aggiornamento OTA porta questo codice anche sulle app vecchie, che la dichiarazione non ce l'hanno.
 * Quindi su iPhone il pulsante compare solo da questa versione nativa in su.
 *
 * ⚠️ Se la prossima build iOS pubblicata ha un numero diverso, si cambia QUI.
 */
export const IOS_ALLEGATI_DALLA_VERSIONE = '2.3';

/** `true` se la versione `a` è uguale o successiva a `b` (`2.10` viene dopo `2.9`). */
export function versioneAlmeno(a: string, b: string): boolean {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

export function allegatiPossibili(piattaforma: string, versioneNativa: string | null): boolean {
  if (piattaforma !== 'ios') return true;
  return !!versioneNativa && versioneAlmeno(versioneNativa, IOS_ALLEGATI_DALLA_VERSIONE);
}
