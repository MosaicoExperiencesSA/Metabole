/**
 * ESPORTA IN EXCEL — un file .xlsx vero, senza dipendenze.
 *
 * Richiesta di Simone dell'11/8 sulla pagina Gestione dieta: «un esporta in excel dove mi esporti
 * la tabella coi filtri applicati al momento del click».
 *
 * ## Perché scritto a mano e non con una libreria
 *
 * Il backoffice ha **tre** dipendenze in tutto (react, react-dom, react-router-dom). Aggiungere
 * SheetJS o ExcelJS per scrivere una griglia di testo significa un `npm install` e un
 * `package-lock.json` rigenerato prima di ogni commit — e i commit li fa Simone da GitHub Desktop,
 * dove quel passaggio non c'è. Un .xlsx è uno zip di cinque file XML: il costo di scriverlo è
 * questo file, una volta.
 *
 * ## Perché .xlsx e non CSV
 *
 * Il CSV in Excel italiano si apre a colonna unica se il separatore non è il punto e virgola, e i
 * numeri con la virgola diventano testo. «Esporta in Excel» deve dare un file che si apre e basta.
 *
 * ## Cosa contiene il foglio
 *
 * Intestazione in grassetto e bloccata (scorrendo mille ricette i titoli restano), filtro
 * automatico sulle colonne, larghezze calcolate sul contenuto. I numeri sono celle numeriche —
 * altrimenti le kcal non si sommano e non si ordinano.
 */

/** Un valore di cella: i numeri restano numeri, tutto il resto diventa testo. */
export type Cella = string | number | null | undefined;

export interface FoglioExcel {
  /** Nome della scheda in basso nel foglio Excel (max 31 caratteri, senza `[]:*?/\`). */
  nome: string;
  intestazioni: string[];
  righe: Cella[][];
}

/* ------------------------------------------------------------------ XML */

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // I caratteri di controllo non sono ammessi in XML: un solo byte sporco dentro un nome di
    // ricetta renderebbe illeggibile l'intero file, e Excel direbbe solo «formato non valido».
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/** A, B, … Z, AA, AB: la lettera della colonna. Serve oltre la Z, le tabelle hanno più di 26 campi. */
function lettera(i: number): string {
  let n = i + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Nome di scheda accettabile per Excel. Un carattere vietato o più di 31 caratteri non danno un
 * errore: danno un file che Excel si rifiuta di aprire.
 */
const nomeFoglio = (s: string): string => {
  // Il taglio a 31 viene PRIMA della ripulitura finale: tagliando dopo aver tolto gli spazi si
  // ottiene un nome che finisce con uno spazio, e Excel non accetta nemmeno quello.
  const pulito = s.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).replace(/^['\s]+|['\s]+$/g, '');
  return pulito || 'Foglio1';
};

function cella(rif: string, v: Cella, stile: 0 | 1): string {
  if (v === null || v === undefined || v === '') return '';
  // `Number.isFinite` e non `typeof v === 'number'`: NaN e Infinity scritti in un `<v>` producono
  // un file corrotto, e arrivano facilmente da una divisione fatta a monte.
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${rif}" s="${stile}"><v>${v}</v></c>`;
  return `<c r="${rif}" s="${stile}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function foglioXml(f: FoglioExcel): string {
  // `Math.max(...righe)` con qualche migliaio di elementi fa saltare lo stack: si conta a mano.
  const nCol = f.righe.reduce((m, r) => Math.max(m, r.length), Math.max(f.intestazioni.length, 1));
  const nRig = f.righe.length + 1;

  // Larghezza delle colonne: il testo più lungo della colonna, con un minimo e un tetto. Senza,
  // Excel apre tutto a larghezza fissa e i nomi delle ricette finiscono tagliati.
  const larghezze: string[] = [];
  for (let c = 0; c < nCol; c++) {
    let max = (f.intestazioni[c] ?? '').length;
    for (const r of f.righe) {
      const v = r[c];
      const l = v === null || v === undefined ? 0 : String(v).length;
      if (l > max) max = l;
    }
    larghezze.push(`<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, Math.max(10, max + 2))}" customWidth="1"/>`);
  }

  const testa = `<row r="1">${f.intestazioni.map((h, c) => cella(`${lettera(c)}1`, h, 1)).join('')}</row>`;
  const corpo = f.righe
    .map((r, i) => {
      const n = i + 2;
      const celle = r.map((v, c) => cella(`${lettera(c)}${n}`, v, 0)).join('');
      return celle ? `<row r="${n}">${celle}</row>` : '';
    })
    .join('');

  // L'ordine degli elementi è quello imposto dallo schema (sheetViews → cols → sheetData →
  // autoFilter): invertirne due dà un file che Excel considera danneggiato.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lettera(nCol - 1)}${nRig}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${larghezze.join('')}</cols><sheetData>${testa}${corpo}</sheetData><autoFilter ref="A1:${lettera(nCol - 1)}${nRig}"/></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

/** Due soli stili: 0 normale, 1 grassetto (la riga dei titoli). */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/* ------------------------------------------------------------------ ZIP */

const TABELLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABELLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Voce { nome: string; dati: Uint8Array }

/** Data DOS fissa (1 gennaio 2026): un giorno 0 renderebbe lo zip invalido per alcuni lettori. */
const DATA_DOS = ((2026 - 1980) << 9) | (1 << 5) | 1;

/**
 * Zip **senza compressione** (metodo 0, «store»).
 *
 * Comprimere vorrebbe dire portarsi dentro un deflate, e in cambio di che: il file più grosso che
 * questa pagina produce è il catalogo ricette intero, qualche centinaio di kB di testo che il
 * browser scrive in memoria in un istante. Uno zip store è uno zip valido a tutti gli effetti:
 * Excel, Numbers e LibreOffice lo aprono senza saperlo.
 */
function zip(voci: Voce[]): Blob {
  const pezzi: Uint8Array[] = [];
  const centrale: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const v of voci) {
    const nome = new TextEncoder().encode(v.nome);
    const crc = crc32(v.dati);
    const n = v.dati.length;
    // Flag 0x0800 = i nomi dei file sono in UTF-8. Data e ora fisse: un file identico deve dare
    // byte identici, così due esportazioni della stessa tabella si confrontano.
    const comune = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(DATA_DOS), ...u32(crc), ...u32(n), ...u32(n), ...u16(nome.length)];
    pezzi.push(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...comune, ...u16(0)]), nome, v.dati);
    // Le 46 byte dell'intestazione centrale, nell'ordine dello standard: firma, versione di chi ha
    // scritto, il blocco comune, lunghezza extra, lunghezza commento, disco, attributi interni,
    // attributi esterni, posizione dell'intestazione locale. Un campo di lunghezza sbagliata sposta
    // tutti quelli dopo e lo zip diventa illeggibile — senza che niente qui dentro se ne accorga.
    centrale.push(new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...comune, ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), nome);
    offset += 30 + nome.length + n;
  }

  const dimCentrale = centrale.reduce((s, p) => s + p.length, 0);
  const fine = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(voci.length), ...u16(voci.length), ...u32(dimCentrale), ...u32(offset), ...u16(0)]);

  // Un buffer solo invece di una lista di pezzi passata a `Blob`: TypeScript distingue
  // `Uint8Array<ArrayBuffer>` da `Uint8Array<ArrayBufferLike>` e solo il primo è un `BlobPart`.
  // Concatenare qui costa una copia di qualche centinaio di kB e toglie il problema alla radice.
  const tutti = [...pezzi, ...centrale, fine];
  const totale = tutti.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(new ArrayBuffer(totale));
  let cursore = 0;
  for (const p of tutti) { out.set(p, cursore); cursore += p.length; }

  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ------------------------------------------------------------------ API */

/** Costruisce il .xlsx in memoria. Separato dal download per poterlo provare senza un browser. */
export function creaExcel(foglio: FoglioExcel): Blob {
  const txt = (s: string) => new TextEncoder().encode(s);
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(nomeFoglio(foglio.nome))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  return zip([
    { nome: '[Content_Types].xml', dati: txt(CONTENT_TYPES) },
    { nome: '_rels/.rels', dati: txt(RELS) },
    { nome: 'xl/workbook.xml', dati: txt(workbook) },
    { nome: 'xl/_rels/workbook.xml.rels', dati: txt(WORKBOOK_RELS) },
    { nome: 'xl/styles.xml', dati: txt(STYLES) },
    { nome: 'xl/worksheets/sheet1.xml', dati: txt(foglioXml(foglio)) },
  ]);
}

/** Data di oggi come `2026-08-11`, da appendere al nome del file. */
export function oggiIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Genera il file e lo fa scaricare. `nomeFile` senza estensione: la mette questa funzione, così
 * non può arrivare un `.xls` che poi Excel apre con l'avviso «il formato non corrisponde».
 */
export function scaricaExcel(nomeFile: string, foglio: FoglioExcel): void {
  const url = URL.createObjectURL(creaExcel(foglio));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeFile.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Senza revoca il Blob resta in memoria finché la scheda è aperta, e questa è la pagina su cui
  // il nutrizionista passa le ore: dieci esportazioni sono dieci copie del catalogo in RAM.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
