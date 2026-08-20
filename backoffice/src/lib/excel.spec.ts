import { describe, expect, it } from 'vitest';
import { creaExcel, type FoglioExcel } from './excel';

/**
 * IL FILE SI APRE DAVVERO? — la domanda che `excel.ts` non aveva mai dovuto rispondere.
 *
 * `excel.ts` scrive uno zip e cinque XML **a mano**, byte per byte, e finora non aveva un test:
 * il modo in cui si rompe non è un'eccezione ma un file che Excel rifiuta con «formato non
 * valido», cioè un errore che arriva a chi sta cercando di lavorare e non a chi ha scritto il
 * codice. Il 20/8 quel file è diventato il modo in cui la nutrizionista riceve l'elenco degli
 * alimenti da correggere, quindi la domanda va posta qui.
 *
 * ⚠️ Lo zip è **senza compressione** (metodo 0, «store»): per questo si può rileggere qui con
 * venti righe invece che con una libreria. Se un domani si comprimesse, questo test smetterebbe di
 * capire il file — e va bene: si accorgerebbe subito, invece che Excel.
 */

/** Rilegge uno zip «store»: nome → contenuto. Legge le intestazioni locali, in ordine. */
async function apriZip(blob: Blob): Promise<Map<string, string>> {
  const b = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(b.buffer);
  const out = new Map<string, string>();
  let i = 0;
  while (i + 30 <= b.length && dv.getUint32(i, true) === 0x04034b50) {
    const metodo = dv.getUint16(i + 8, true);
    const dim = dv.getUint32(i + 18, true);
    const lunNome = dv.getUint16(i + 26, true);
    const lunExtra = dv.getUint16(i + 28, true);
    const nome = new TextDecoder().decode(b.slice(i + 30, i + 30 + lunNome));
    const inizio = i + 30 + lunNome + lunExtra;
    expect(metodo).toBe(0); // «store»: se cambia, questo lettore non vale più
    out.set(nome, new TextDecoder().decode(b.slice(inizio, inizio + dim)));
    i = inizio + dim;
  }
  return out;
}

const FOGLIO: FoglioExcel = {
  nome: 'Da correggere',
  intestazioni: ['Elenco', 'Alimento', 'Ricette che lo usano', 'kcal', 'Stato', 'Ultima richiesta'],
  righe: [
    ['Usati dalle ricette', 'spinaci freschi', 1350, null, '', '2026-08-19'],
    ['Chiesti dalle clienti', 'tempeh', 0, 192, 'crudo', '2026-08-20T09:30:00.000Z'],
    // Virgolette, accenti e «&»: i tre modi ovvi di produrre un XML non valido.
    ['Usati dalle ricette', 'pane «integrale» & segale', 12, null, '', ''],
  ],
};

describe('creaExcel — un .xlsx che si apre', () => {
  it('contiene i sei pezzi di un foglio Excel, nell’ordine giusto', async () => {
    const pezzi = await apriZip(creaExcel(FOGLIO));
    expect([...pezzi.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('le intestazioni ci sono tutte, in riga 1', async () => {
    const sheet = (await apriZip(creaExcel(FOGLIO))).get('xl/worksheets/sheet1.xml') as string;
    const riga1 = /<row r="1">(.*?)<\/row>/.exec(sheet)?.[1] ?? '';
    for (const h of FOGLIO.intestazioni) expect(riga1).toContain(h);
  });

  it('i numeri restano numeri e il testo resta testo', async () => {
    const sheet = (await apriZip(creaExcel(FOGLIO))).get('xl/worksheets/sheet1.xml') as string;
    // 1350 come cella numerica: se uscisse come `inlineStr` le ricette non si ordinerebbero.
    expect(sheet).toMatch(/<c r="C2"[^>]*><v>1350<\/v><\/c>/);
    expect(sheet).toMatch(/<c r="B2"[^>]*t="inlineStr"/);
  });

  it('una cella vuota non produce una cella, e non sposta le colonne dopo', async () => {
    const sheet = (await apriZip(creaExcel(FOGLIO))).get('xl/worksheets/sheet1.xml') as string;
    expect(sheet).not.toContain('r="D2"'); // kcal è null sulla prima riga
    expect(sheet).toContain('r="E3"'); // ...ma «crudo» resta in colonna E, non scivola in D
  });

  it('le date escono come date, non come testo', async () => {
    const sheet = (await apriZip(creaExcel(FOGLIO))).get('xl/worksheets/sheet1.xml') as string;
    // 2026-08-19 → seriale 46253 (giorni dal 30/12/1899), stile 2 = formato DD/MM/YYYY.
    expect(sheet).toMatch(/<c r="F2" s="2"><v>46253<\/v><\/c>/);
    // Con l'ora lo stile è 3 (DD/MM/YYYY HH:MM) e il seriale ha una frazione.
    expect(sheet).toMatch(/<c r="F3" s="3"><v>4625[45]\.\d+<\/v><\/c>/);
  });

  it('virgolette, accenti e «&» non rompono l’XML', async () => {
    const sheet = (await apriZip(creaExcel(FOGLIO))).get('xl/worksheets/sheet1.xml') as string;
    expect(sheet).toContain('pane «integrale» &amp; segale');
    // Nessuna `&` nuda: è precisamente il byte che fa dire a Excel «formato non valido».
    expect(sheet.replace(/&(amp|lt|gt|quot|apos);/g, '')).not.toContain('&');
  });

  it('due esportazioni identiche danno byte identici (data DOS fissa)', async () => {
    // ⚠️ Niente `Buffer` qui dentro: è di Node, il backoffice non ha `@types/node` (tre dipendenze
    // in tutto, e va tenuto così) e `tsc -b` — cioè il build vero, quello che gira su Vercel —
    // si ferma su `Cannot find name 'Buffer'`. `vitest` invece passava, perché non fa quel
    // controllo: *il verde non è una riga sola*, ed è costato un rilascio del backoffice.
    const a = new Uint8Array(await creaExcel(FOGLIO).arrayBuffer());
    const b = new Uint8Array(await creaExcel(FOGLIO).arrayBuffer());
    expect(a.length).toBe(b.length);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
