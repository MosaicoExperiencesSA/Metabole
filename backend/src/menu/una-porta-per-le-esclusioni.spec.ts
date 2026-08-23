import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { exclusionKeys, hitsExclusion, RADICE_MINIMA, radiceChiave } from './exclusions';

/**
 * «QUESTO PIATTO CONTIENE UNA COSA ESCLUSA?» — UNA DOMANDA, UNA PORTA.
 *
 * Due difetti trovati insieme il 20/8, e il secondo è il motivo per cui il primo non si poteva
 * chiudere in un posto solo.
 *
 * **1) Le parole chiave sono scritte in una forma sola.** `mandorle` non combacia con «mandorla»,
 * `gamberi` non combacia con «gamberetti». Misurato sul catalogo keto del repo — 118 ricette vere —
 * quattro piatti che contengono l'allergene passavano il filtro.
 *
 * **2) `hitsExclusion` esisteva e non la chiamava nessuno.** Motore dei menu e sostituzioni in chat
 * avevano sette copie di `[...chiavi].some((k) => testo.includes(k))`, e il test ne aveva un'ottava
 * con scritto accanto «come lo verifica il codice vero». Correggere il confronto nella funzione
 * giusta non avrebbe cambiato niente in produzione.
 */

/* ─────────────────────────── 1) la radice ─────────────────────────── */

describe('la radice: «mandorla» e «mandorle» sono la stessa cosa', () => {
  const con = (allergene: string, piatto: string) =>
    hitsExclusion(piatto.toLowerCase(), exclusionKeys([allergene])) !== null;

  /** I quattro casi veri, presi dal catalogo del repo e non inventati. */
  it.each([
    ['frutta a guscio', 'Smoothie verde (mandorla, avocado, spinaci, lime)'],
    ['frutta a guscio', 'Gelato keto nocciola (ricotta e cocco)'],
    ['crostacei', 'Gamberetti saltati con zucchine'],
    ['uova', 'Frittatine al forno (egg muffins) con cheddar, spinaci'],
  ])('con «%s» il piatto «%s» non si propone', (allergene, piatto) => {
    expect(con(allergene, piatto)).toBe(true);
  });

  it('e le forme che già combaciavano continuano a combaciare', () => {
    expect(con('frutta a guscio', 'Torta di mandorle')).toBe(true);
    expect(con('crostacei', 'Gamberi alla griglia')).toBe(true);
    expect(con('latte', 'Burro salato')).toBe(true); // il caso Giusy dell'8/8
  });

  /**
   * ⛔ **LA TRAPPOLA, e non l'ho evitata ragionando: l'ho vista misurando.**
   *
   * `polpo` senza vocale finale è `polp`, che sta dentro **polpette**. La prima versione della
   * regola toglieva le polpette di carne a chi è allergico ai molluschi — una cosa che può mangiare,
   * sparita dal piatto, e un elenco di cui non fidarsi più. Con la soglia sulla lunghezza della
   * radice `polp` non entra in gioco e `polpo` continua a valere per quello che è.
   */
  it('⛔ le polpette di carne restano a chi è allergico ai molluschi', () => {
    expect(con('molluschi', 'Polpette di carne al sugo con spinaci')).toBe(false);
    expect(con('molluschi', 'Polpo alla griglia')).toBe(true);
  });

  it('la soglia è quella che tiene fuori `polp`', () => {
    expect(radiceChiave('polpo')).toBeNull();
    expect(radiceChiave('mandorle')).toBe('mandorl');
    expect(radiceChiave('gamberi')).toBe('gamber');
    expect(RADICE_MINIMA).toBe(6);
    // Una chiave composta non si tronca: «sedano rapa» spezzato non vuol dire niente.
    expect(radiceChiave('sedano rapa')).toBeNull();
  });

  it('la chiave riportata è quella leggibile, non il moncone', () => {
    // Serve a spiegare alla cliente perché: «mandorl» in un messaggio non si può scrivere.
    expect(hitsExclusion('gelato alla nocciola', exclusionKeys(['frutta a guscio']))).toBe('nocciole');
  });
});

/* ─────────────────────── 2) la porta sola ─────────────────────── */

/** Chi può confrontare le chiavi col testo di un piatto per conto suo, e perché. */
const PERMESSI = new Set<string>([
  'menu/exclusions.ts', // è la porta
  /**
   * ⚠️ **Dichiarato il 23/8, dopo averlo guardato**: la sentinella allargata alla *forma* lo pesca
   * per due `.some(…includes…)`, e nessuno dei due confronta chiavi escluse col testo di un piatto:
   *  · riga ~354 — `STATI_CON_UN_PIANO.includes(s.status)`, cioè gli stati di un abbonamento;
   *  · riga ~1989 — «questo alimento appartiene a questo gruppo di equivalenza?», che è la domanda
   *    del trova-gemella, non «questo piatto contiene una cosa esclusa».
   * Il filtro delle esclusioni, in questo file, passa da `ricetteNonSicure` e `ricetteVietate` —
   * che a loro volta chiamano la porta.
   */
  'menu/menu.service.ts',
  /**
   * ⚠️ **Eccezione vera, non una scorciatoia.** `cosaSiPerde` non confronta le chiavi con il testo
   * di un piatto: confronta **due insiemi di chiavi fra loro** — «quello che escludeva prima è
   * ancora coperto da quello che escluderà dopo?». È un'altra domanda, e `hitsExclusion` non la
   * risponde. (Nota di contorno: da quando il motore guarda anche la radice, questo confronto è
   * più prudente del motore — può dire «perderesti X» quando in realtà X resterebbe coperto. Sbaglia
   * dalla parte del fermarsi a chiedere, che è quella giusta.)
   */
  'chat/allergie-chat.service.ts',
]);

/**
 * `[...chiavi].some((k) => testo.includes(k))` e le sue forme, anche spezzate su più righe.
 *
 * ⛔ **La prima versione elencava i NOMI DI VARIABILE** (`allergeni|chiavi|keys|…`), e per questo la
 * **nona copia le è passata davanti**: in `vera/regola-dieta.ts` la variabile si chiamava `parole`.
 * Una sentinella che riconosce i nomi invece della forma è una sentinella che il prossimo la chiama
 * in un altro modo — e la decima copia sarebbe passata dallo stesso buco.
 *
 * ⚠️ Adesso guarda la **forma** — un `.some(...)`/`.every(...)` che dentro fa `.includes(` — e la
 * cerca **solo nei file che maneggiano le esclusioni**, cioè quelli che importano da
 * `menu/exclusions`. È la firma esatta della nona copia: prendi le chiavi dalla porta giusta e poi
 * il confronto te lo riscrivi.
 *
 * ⚠️ Guardare la forma **ovunque** l'avevo provato, e costava dieci file da dichiarare — stati di
 * abbonamento, slot del digiuno, rete dello staff — tutti `.some(…includes…)` che con le
 * esclusioni non c'entrano niente. Un guardiano che grida su dieci cose innocenti è un guardiano
 * che si impara a zittire: la precisione qui non è eleganza, è la condizione perché qualcuno lo
 * ascolti l'undicesima volta.
 */
const A_MANO = /\.(?:some|every)\s*\([\s\S]{0,80}?\.includes\s*\(/;
/** Chi prende le chiavi dalla porta giusta è anche chi può essere tentato di rifarsi il confronto. */
const TOCCA_LE_ESCLUSIONI = /from '[^']*exclusions'/;

function tuttiIFile(radice: string): string[] {
  const out: string[] = [];
  const gira = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const pieno = join(dir, nome);
      if (statSync(pieno).isDirectory()) gira(pieno);
      else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(pieno);
    }
  };
  gira(radice);
  return out;
}

describe('nessuno si riscrive il confronto per conto suo', () => {
  const radice = join(__dirname, '..');

  it('il confronto fra chiavi escluse e piatto passa da `hitsExclusion`', () => {
    const colpevoli = tuttiIFile(radice)
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        return TOCCA_LE_ESCLUSIONI.test(src) && A_MANO.test(src);
      })
      .map((f) => f.slice(radice.length + 1).replace(/\\/g, '/'))
      .filter((rel) => !PERMESSI.has(rel));
    expect(colpevoli).toEqual([]);
    // ⚠️ E la prova che la sentinella riconoscerebbe la forma della NONA copia, che si chiamava
    // `parole` — nessun nome di variabile fra quelli che il controllo cercava prima del 23/8.
    expect(A_MANO.test('if (parole.some((p) => testo.includes(p))) fuori.add(r.id);')).toBe(true);
  });

  it('l’eccezione dichiarata risponde davvero a un’altra domanda', () => {
    // Se un giorno quel file cominciasse a confrontare le chiavi con il testo di un piatto, la
    // riga che lo fa conterrebbe `hitsExclusion` o andrebbe tolta dai permessi. Qui si controlla
    // almeno che non stia guardando un piatto: nessun nome di variabile «testo/hay/txt» accanto.
    const src = readFileSync(join(__dirname, '..', 'chat/allergie-chat.service.ts'), 'utf8');
    expect(src).toContain('chiaviDopo.some((n) => k.includes(n))');
    expect(src).not.toMatch(/(?:testo|hay|txt)\.includes\(/);
  });

  it('la ricerca riconosce davvero la forma che c’era (se no non guarda niente)', () => {
    expect(A_MANO.test("if ([...allergeni].some((k) => k && testo.includes(k))) return 'allergene';")).toBe(true);
    expect(A_MANO.test('if (![...triggerKeys].some((k) => k && hay.includes(k))) continue;')).toBe(true);
    expect(A_MANO.test('if (hitsExclusion(testo, allergeni)) return null;')).toBe(false);
  });
});
