/**
 * ⛔ **LE FRECCE DI PAGINA STANNO IN CIMA E IN FONDO — su tutte le tabelle, non su quelle che
 * qualcuno si è ricordato.**
 *
 * Richiesta di Simone del 21/8: *«dove ci sono le tabelle con più pagine mettiamo anche in alto le
 * frecce per cambio pagina come in basso, da fare su tutte le tabelle»*.
 *
 * ## Perché è una regola da tenere ferma, e non una modifica fatta una volta
 *
 * Su una tabella lunga, per cambiare pagina bisogna scorrere fino in fondo, cliccare, e poi risalire
 * in cima a leggere: due viaggi per ogni pagina. E le frecce in fondo si trovano solo se si sa che
 * ci sono — in cima si vedono.
 *
 * ⚠️ Il difetto vero però non era la barra mancante: era che il backoffice aveva **due comportamenti
 * diversi per la stessa cosa**. Sei tabelle su trenta le frecce in cima ce le avevano già dall'11/8;
 * le altre no, e nessuno poteva accorgersene guardando una schermata alla volta. Un test che le
 * conta tutte è l'unico modo perché la trentunesima tabella, quella che nascerà fra due mesi, non
 * ricominci da capo.
 *
 * ## ⛔ Tre cose che questa prova ha imparato in revisione, e che spiegano com'è scritta
 *
 * 1. **Niente `fs`.** La prima stesura leggeva i file con `readFileSync`, copiando il modo del
 *    backend. Ma qui `tsconfig` include `src` e il backoffice non ha `@types/node`: i test restavano
 *    verdi (Vite non controlla i tipi) e **`npm run build` falliva**. Un test che rompe il deploy
 *    della schermata che sta proteggendo è peggio del difetto. I sorgenti arrivano da
 *    `import.meta.glob`, che è lo stesso strumento con cui Vite li impacchetta.
 * 2. **Niente regex sul tag.** La prima stesura cercava `<Pager\\b[^>]*\\/>`: si ferma al primo `>`,
 *    quindi un `onPage={(p) => setPage(p - 1)}` — **la forma che il repository usava fino a ieri** —
 *    non veniva contata affatto. Si potevano togliere tutte e due le barre della tabella dei lead e
 *    restare verdi. Adesso il tag si legge contando le graffe, come lo leggerebbe un parser.
 * 3. **Contare non basta: conta DOVE.** Due `<Pager>` disegnati entrambi in fondo, uno dei quali con
 *    la prop `sopra`, passavano. La prova guarda la posizione rispetto alla tabella.
 */
import { describe, expect, it } from 'vitest';

/**
 * I sorgenti, presi come li prende Vite. ⚠️ `eager` perché un test non aspetta: senza, tornerebbero
 * delle promesse e il conteggio sarebbe di zero file — un test che non guarda niente e passa.
 */
const SORGENTI: Record<string, string> = {
  ...import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../components/*.tsx', { query: '?raw', import: 'default', eager: true }),
};

/**
 * ⚠️ Via i commenti prima di guardare. Questo file — e le note che spiegano perché una barra sta in
 * un posto — **nominano** `<Pager>` e `sopra`: un test che si accende sulla propria spiegazione
 * costringe a togliere la spiegazione.
 *
 * ⚠️ `https://` è protetto: si toglie `//` solo quando non è preceduto da `:`.
 */
const senzaCommenti = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');

export interface BarraTrovata {
  /** Posizione nel sorgente: serve a dire se sta prima o dopo la tabella. */
  a: number;
  sopra: boolean;
}

/**
 * Ogni `<Pager …>` scritto davvero nel JSX.
 *
 * ⛔ Le graffe si contano, non si saltano con una regex. Le props di un `<Pager>` contengono `=>`,
 * `{...t.pager}`, oggetti e stringhe: un `[^>]*` si ferma alla prima freccia grassa e perde il tag
 * intero — in silenzio, che è il modo peggiore.
 */
export function barre(sorgente: string): BarraTrovata[] {
  const t = senzaCommenti(sorgente);
  const trovate: BarraTrovata[] = [];
  for (const inizio of [...t.matchAll(/<Pager\b/g)].map((m) => m.index)) {
    let i = inizio + '<Pager'.length;
    let graffe = 0;
    let apice: string | null = null;
    while (i < t.length) {
      const c = t[i];
      if (apice) { if (c === apice) apice = null; }
      else if (c === '"' || c === "'" || c === '`') apice = c;
      else if (c === '{') graffe += 1;
      else if (c === '}') graffe -= 1;
      else if (c === '>' && graffe === 0) break;
      i += 1;
    }
    const tag = t.slice(inizio, i);
    // ⚠️ `sopra={false}` non è «sopra»: sarebbe una barra in cima solo a parole.
    trovate.push({ a: inizio, sopra: /\bsopra\b(?!\s*=\s*\{\s*false)/.test(tag) });
  }
  return trovate;
}

/**
 * ⛔ **«QUESTO FILE PAGINA» — e non è «chiama `useTabella`»** (corretto in revisione, 21/8).
 *
 * La prima stesura guardava solo `useTabella`, che è l'helper condiviso. Ma `LeadsTable` — la tabella
 * più grande del backoffice, quarantamila lead, l'unica che pagina **lato server** — l'helper non lo
 * usa: si tiene la pagina da sé con un `setPage` e la manda nella query. Risultato: si potevano
 * togliere **tutte e due** le sue barre e la suite restava verde. Provato, non dedotto.
 *
 * ⚠️ I tre segnali insieme, perché sono tre modi veri di paginare in questo repository: l'helper, il
 * suo gancio, e uno stato di pagina scritto a mano. Chi ne aggiunge un quarto lo aggiunge qui.
 */
const PAGINA = /\buseTabella\s*\(|\busePagination\s*\(|\bsetPage\b/;

/**
 * ⚠️ **Gli attrezzi non sono schermate.** `ui.tsx` e `tabella.tsx` *definiscono* la paginazione — la
 * nominano tutta, ovviamente — ma non disegnano nessuna tabella: pretendere da loro una barra
 * vorrebbe dire un test che si accende su sé stesso. Si riconoscono da quello che **esportano**, non
 * dal nome del file: un domani l'helper può traslocare.
 */
const ATTREZZO = /export\s+(?:function|const)\s+(?:usePagination|useTabella|Pager)\b/;

const FILE = Object.entries(SORGENTI);
const conBarre = FILE.filter(([, s]) => barre(s).length > 0);

describe('⛔ le frecce di pagina: in cima e in fondo, su tutte', () => {
  it('i sorgenti ci sono davvero (se no il test non guarda niente)', () => {
    expect(FILE.length).toBeGreaterThan(20);
    expect(FILE.every(([, s]) => typeof s === 'string' && s.length > 0)).toBe(true);
  });

  /**
   * ⚠️ È un **minimo**: aggiungere tabelle non lo rompe. Se un giorno cala vuol dire che qualcuno ne
   * ha tolta una o l'ha rifatta senza paginazione, e va guardato — invece che scoperto da una coach
   * che non trova più le righe.
   */
  it('le tabelle paginate sono tante: questa regola non riguarda due schermate', () => {
    expect(conBarre.length).toBeGreaterThanOrEqual(28);
  });

  it('⛔ ogni tabella con la barra in fondo ha anche quella in cima, e viceversa', () => {
    const zoppe = conBarre
      .map(([nome, s]) => {
        const b = barre(s);
        return [nome, b.filter((x) => x.sopra).length, b.filter((x) => !x.sopra).length] as const;
      })
      .filter(([, sopra, sotto]) => sopra === 0 || sotto === 0 || sopra !== sotto)
      .map(([nome, sopra, sotto]) => `${nome}: ${sopra} sopra, ${sotto} sotto`);
    expect(zoppe).toEqual([]);
  });

  /**
   * ⛔ **E STA DAVVERO SOPRA LA TABELLA.** Contare i tag non basta: `sopra` è una prop, e una prop si
   * può scrivere su un elemento messo in fondo. Qui si guardano le posizioni nel sorgente.
   *
   * ⚠️ **A COPPIE, non «la prima tabella del file»** (corretto subito dopo averlo scritto). La prima
   * stesura chiedeva che ogni barra «sopra» stesse prima della **prima** `<table` del file: si
   * accendeva su `GestioneNegozio`, `Ricette`, `Vera` e `ValoriNutrizionali`, che di tabelle ne hanno
   * due — e in quei file era il **test** a sbagliare, non il codice. Un test che grida al lupo sulla
   * schermata giusta insegna a ignorarlo, ed è il modo più rapido di buttare via una regola vera.
   *
   * La regola giusta è locale: fra una barra «sopra» e la barra successiva ci deve essere l'inizio
   * di una tabella; fra la barra precedente e una barra di fondo ci deve essere la fine di una.
   *
   * ⚠️ Si astiene sui file senza `<table>`: un domani una tabella potrebbe essere fatta di `<div>`, e
   * meglio non guardare che dire una cosa falsa.
   */
  it('⛔ la barra «sopra» sta prima della SUA tabella, quella senza dopo', () => {
    const fuoriposto: string[] = [];
    for (const [nome, s] of conBarre) {
      const t = senzaCommenti(s);
      if (!t.includes('<table') || !t.includes('</table>')) continue;
      const b = barre(s);
      for (let i = 0; i < b.length; i += 1) {
        const daQui = b[i].a;
        const primaDiQui = i > 0 ? b[i - 1].a : 0;
        const finoA = i + 1 < b.length ? b[i + 1].a : t.length;
        if (b[i].sopra) {
          // Dopo di lei, e prima della barra dopo, deve cominciare una tabella.
          if (t.indexOf('<table', daQui) < 0 || t.indexOf('<table', daQui) > finoA) {
            fuoriposto.push(`${nome}: la barra «sopra» a ${daQui} non ha nessuna tabella dopo di sé`);
          }
        } else if (t.lastIndexOf('</table>', daQui) < primaDiQui) {
          fuoriposto.push(`${nome}: la barra di fondo a ${daQui} non ha nessuna tabella prima di sé`);
        }
      }
    }
    expect(fuoriposto).toEqual([]);
  });

  /**
   * ⛔ **CHI PAGINA, DISEGNA LA BARRA.** È il difetto che il censimento ha trovato, e non era
   * cosmetico: `Agenti` e `CoperturaCatalogo` chiamavano `useTabella` con un tetto di righe per
   * pagina e **non disegnavano nessun `<Pager>`**. Le righe oltre il tetto esistevano, si
   * filtravano, finivano nell'Excel — e a schermo non c'erano, senza che niente lo dicesse.
   *
   * ⚠️ Su `CoperturaCatalogo`, che è la schermata che dice *cosa manca a catalogo*, voleva dire una
   * copertura incompleta letta come completa.
   *
   * ⚠️ Una barra non costa niente quando non serve: sotto le due pagine il `Pager` si disegna
   * `null`. Metterla sempre è più economico che ricordarsi di metterla.
   */
  it('⛔ chi pagina disegna la barra: niente righe che spariscono in silenzio', () => {
    const mute = FILE
      .filter(([, s]) => PAGINA.test(senzaCommenti(s)) && !ATTREZZO.test(senzaCommenti(s)))
      .filter(([, s]) => barre(s).length === 0)
      .map(([nome]) => nome);
    expect(mute).toEqual([]);
  });

  /**
   * ⛔ **E LA BARRA DI SOPRA È INCOLLATA IN ALTO.** Senza, non serve a niente: la card che contiene
   * una tabella scorre dentro di sé (`theme.css`, `.card:has(> table.grid)` con `overflow: auto` e
   * `max-height`), quindi una barra messa lì come primo figlio se ne va al primo movimento di
   * rotella — invisibile proprio per tutto il tempo in cui servirebbe.
   *
   * ⚠️ È il difetto che avevo ripetuto diciannove volte cercando l'`overflow` nel JSX, mentre stava
   * nel CSS. La correzione è in un posto solo (`ui.tsx`), e qui si tiene ferma: `zIndex` **sopra il
   * 3** dell'intestazione incollata di `tabella.tsx`, e `left` insieme a `top` perché quei riquadri
   * scorrono anche in orizzontale.
   */
  it('⛔ `<Pager sopra>` resta incollato mentre le righe scorrono', () => {
    const ui = senzaCommenti(SORGENTI['../components/ui.tsx'] ?? '');
    expect(ui).not.toBe('');
    const riga = ui.split('\n').find((l) => l.includes("position: 'sticky'"));
    expect(riga, 'il Pager di sopra non è più `sticky`').toBeDefined();
    expect(riga).toMatch(/top:\s*0/);
    expect(riga, 'senza `left` la barra scorre via di lato sulle tabelle larghe').toMatch(/left:\s*0/);
    const z = Number(/zIndex:\s*(\d+)/.exec(riga ?? '')?.[1] ?? NaN);
    expect(z).toBeGreaterThan(3);
    // Sfondo pieno, o le righe si vedono scorrere attraverso i comandi.
    expect(riga).toMatch(/background:/);
  });
});
