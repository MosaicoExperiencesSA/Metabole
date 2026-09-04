import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ⛔ **GLI ASTERISCHI SI SCRIVONO SOLO DOVE QUALCUNO LI DISEGNA** — voce del 22/8, chiusa il 25/8
 * con un censimento invece che con una stima.
 *
 * In questo progetto non è mai esistito un renderer markdown. Eppure i testi lo scrivevano: la
 * cliente leggeva «Hai qualche \*\*allergia\*\* alimentare?» in chat, e la nutrizionista gli
 * asterischi in mezzo alle risposte di Vera. Il censimento del 25/8: **755 stringhe** con `**`,
 * di cui 647 nella pagina Lavori (che il grassetto lo disegna dal 22/8) e **108 altrove**.
 *
 * ## La regola, in una riga
 *
 * Il markdown si può scrivere **solo** nei testi che finiscono in una superficie che lo disegna —
 * le bolle di chat dell'app e la chat di Vera in back office. Ovunque altro (notifiche, email,
 * push, testi delle attività, `confirm()` del browser) gli asterischi si vedono, e vanno tolti.
 *
 * ⚠️ **Perché la regola sta in un test e non in un commento**: un commento lo legge chi lo cerca.
 * Qui il difetto diventa **rosso** nel momento in cui qualcuno scrive `**` in un file nuovo, ed è
 * l'unico modo per cui una cosa trovata guardando la pagina non torni indietro fra due mesi.
 *
 * ⚠️ E se un giorno una superficie nuova disegna il grassetto — le email, per dire — si aggiunge
 * **qui**, insieme alla ragione. Aggiungere un file a questo elenco è una decisione, non una toppa.
 */

/** I file che possono contenere markdown, e PERCHÉ. Una riga senza motivo non è un permesso. */
const CHI_LO_DISEGNA: { file: string; dove: string }[] = [
  { file: 'src/lavori/voci-iniziali.ts', dove: 'pagina Lavori (backoffice) — `TestoConGrassetto` dal 22/8' },
  { file: 'src/vera/vera-chat.ts', dove: 'chat di Vera (backoffice) — `TestoConGrassetto` dal 25/8' },
  { file: 'src/vera/vera-chat.service.ts', dove: 'chat di Vera' },
  { file: 'src/vera/coda-approvazioni.ts', dove: 'chat di Vera' },
  { file: 'src/vera/equivalenza-dettata.ts', dove: 'chat di Vera' },
  /**
   * ⚠️ `testoChiediAccorpamento` (4/9) esce **solo** dalla chat di Vera, esattamente come
   * `equivalenza-dettata` qui sopra: il resto del file è calcolo puro e non produce testo.
   */
  { file: 'src/catalog/gia-in-un-altro-gruppo.ts', dove: 'chat di Vera' },
  { file: 'src/vera/verifica-sostituzioni.ts', dove: 'chat di Vera' },
  { file: 'src/vera/allergeni-ricetta.ts', dove: 'chat di Vera' },
  { file: 'src/vera/conflitti-dizionario.ts', dove: 'chat di Vera' },
  { file: 'src/vera/macro-da-ingredienti.ts', dove: 'chat di Vera' },
  { file: 'src/nutrient-facts/stato-alimento.ts', dove: 'risposta di Vera (backoffice)' },
  /**
   * ⚠️ **Le bolle di Gaia si leggono in TRE posti**, non solo in app — rilievo della revisione del
   * 25/8: la card «Conversazioni» della scheda cliente si apre di default proprio sul thread di
   * Gaia, e la pagina Chat del back office mostra le stesse conversazioni. Finché una di quelle tre
   * disegna il testo grezzo, il permesso qui sotto è una bugia: adesso tutte e tre usano
   * `TestoConGrassetto`.
   */
  { file: 'src/chat/allergie-chat.ts', dove: 'bolle di chat: app, scheda cliente, pagina Chat — `TestoConGrassetto` dal 25/8' },
  { file: 'src/menu/cambio-piatto.ts', dove: 'bolle di chat (Gaia), tutte e tre le superfici' },
  { file: 'src/menu/sostituzione-chat.service.ts', dove: 'bolle di chat (Gaia), tutte e tre le superfici' },
];

const PERMESSI = new Set(CHI_LO_DISEGNA.map((c) => c.file));

/** Tutti i `.ts` di produzione (niente `.spec`, niente `dist`). */
function* sorgenti(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist') yield* sorgenti(p);
    } else if (/\.ts$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) yield p;
  }
}

/**
 * ⚠️ Si guardano le **stringhe**, non le righe: i commenti di questo progetto sono pieni di
 * `**grassetto**` — è il modo in cui sono scritti — e cercarlo sulle righe darebbe centinaia di
 * falsi positivi, cioè un test che si impara a ignorare.
 */
const STRINGHE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
/**
 * ⚠️ **I commenti si cancellano TENENDO gli a capo** (rilievo della revisione del 25/8): togliendoli
 * del tutto, ogni numero di riga dopo il primo `/** *\/` risultava spostato — il guardiano mandava a
 * riga 405 una stringa che stava alla 553, cioè faceva perdere dieci minuti proprio a chi arriva lì
 * di corsa perché ha appena scritto un testo.
 */
function senzaCommenti(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((r) => r.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n');
}

/**
 * ⛔ **Le stringhe si cercano su TUTTO il sorgente, non riga per riga** — e la prima stesura lo
 * faceva riga per riga. Un template su più righe (il modo più naturale di scrivere il corpo di una
 * notifica) sfuggiva del tutto: provato in revisione, il difetto del 22/8 si poteva reintrodurre
 * nel punto esatto in cui era nato e i test restavano verdi.
 */
function stringheCon(src: string, cosa: string): { riga: number; testo: string }[] {
  const fuori: { riga: number; testo: string }[] = [];
  for (const m of src.matchAll(STRINGHE)) {
    if (!m[0].includes(cosa)) continue;
    /**
     * ⚠️ Le maschere dei dati (`'$1***$2'`, il «Mar***co» delle campagne) non sono markdown: sono
     * asterischi usati come carattere. Si riconoscono dalla FORMA — tre o più di fila — e non
     * permettendo il file che le contiene, che è il postino delle campagne e domani potrebbe
     * ospitare un testo vero.
     */
    if (/\*{3,}/.test(m[0])) continue;
    fuori.push({ riga: src.slice(0, m.index ?? 0).split('\n').length, testo: m[0].replace(/\s+/g, ' ').slice(0, 90) });
  }
  return fuori;
}

describe('il markdown si scrive solo dove qualcuno lo disegna', () => {
  const trovati: { file: string; riga: number; testo: string }[] = [];
  const radice = join(__dirname, '..');
  for (const file of sorgenti(radice)) {
    const relativo = `src/${file.slice(radice.length + 1)}`;
    for (const t of stringheCon(senzaCommenti(readFileSync(file, 'utf8')), '**')) {
      trovati.push({ file: relativo, ...t });
    }
  }

  it('⛔ nessun testo NUOVO scrive markdown dove si legge come testo semplice', () => {
    const fuori = trovati.filter((t) => !PERMESSI.has(t.file));
    // Il messaggio dice cosa fare, non solo che è rosso: chi arriva qui sta scrivendo un testo, non
    // studiando questo file.
    expect(
      fuori.map((t) => `${t.file}:${t.riga} ${t.testo}`).join('\n')
      + (fuori.length
        ? '\n\n→ Questo testo si legge dove NON c\'è nessun renderer (notifica, email, push, attività,'
          + ' confirm del browser): togli gli asterischi. Se invece finisce in una chat che li disegna,'
          + ' aggiungi il file a CHI_LO_DISEGNA qui sopra, con il motivo.'
        : ''),
    ).toBe('');
  });

  /**
   * ⚠️ **E l'elenco dei permessi non deve diventare un cimitero**: un file che non scrive più
   * markdown va tolto da lì, o fra sei mesi nessuno saprà più quali di quelle righe servono davvero.
   */
  it('⚠️ ogni file nell\'elenco dei permessi ha ancora del markdown da disegnare', () => {
    const conMarkdown = new Set(trovati.map((t) => t.file));
    expect(CHI_LO_DISEGNA.filter((c) => !conMarkdown.has(c.file)).map((c) => c.file)).toEqual([]);
  });

  it('il censimento del 25/8 resta vero: la parte grossa è la pagina Lavori', () => {
    const nelleVoci = trovati.filter((t) => t.file === 'src/lavori/voci-iniziali.ts').length;
    expect(nelleVoci).toBeGreaterThan(500);
    // Fuori dalle voci ce n'erano 108 il 25/8, quasi tutte di Vera: se questo numero esplode,
    // qualcuno sta scrivendo markdown a mano dove prima non ce n'era.
    /**
     * ⚠️ **Il tetto è passato da 150 a 175 il 4/9, e questo è il conto di chi ha aggiunto cosa.**
     * Erano 108 il 25/8, sono 152 adesso: la consegna dei gruppi di equivalenza globali ne porta
     * una ventina (le frasi dell'accorpamento in chat, la spiegazione del regime a chi propone un
     * alimento che il suo piano non prevede), il resto arriva dalle consegne della stessa giornata.
     * ⛔ Il senso della sentinella non cambia: serve a vedere un **salto**, non a bloccare la
     * crescita normale. Se la si alza senza scrivere perché, la volta dopo non vuol più dire niente.
     */
    expect(trovati.length - nelleVoci).toBeLessThan(175);
  });
});
