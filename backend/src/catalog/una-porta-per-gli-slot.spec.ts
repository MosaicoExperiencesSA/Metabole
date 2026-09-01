import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  SLOT_SCAMBIABILI,
  allargaAiGemelli,
  puoStareNelloSlot,
  slotCapofila,
  slotDaChiedere,
  slotDaCuiPescare,
} from '../common/slot-pasto';

/**
 * «DA QUALI SLOT SI PESCA PER QUESTO PASTO?» — UNA DOMANDA, UNA PORTA.
 *
 * ⚠️ Decisione di Simone dell'1/9 (Fase 2 del piano panieri): **un piatto pensato per le 10:30 va
 * bene anche alle 17**. Spuntino e merenda diventano un paniere solo — due da 84 che fanno 168 —
 * e quale dei due sia lo decide l'ora del pasto nella giornata, non la ricetta.
 *
 * ⛔ In catalogo **non è cambiato niente**: né l'enum `MealSlot`, né una riga di `recipe`. La
 * scelta si allarga a valle, in chi pesca. È il motivo per cui questa sentinella esiste: una
 * decisione che vive solo nei punti che si sono ricordati di applicarla è una decisione che il
 * primo punto nuovo disfa in silenzio, e nessuno se ne accorge perché i menu continuano a uscire.
 */

/** Chi può nominare un `mealSlot` singolo, e perché. */
const PERMESSI = new Set<string>([
  /**
   * ⚠️ **Il filtro della lista ricette del back office, e le due scritture.** Chi in «Ricette»
   * filtra «spuntino» vuole vedere gli spuntini, non anche le merende: quella è una ricerca in
   * catalogo, non una scelta per una cliente. E `data.mealSlot = dto.mealSlot` scrive il campo,
   * non lo interroga.
   */
  'catalog/catalog.service.ts',
  /** ⚠️ Scrittura: la bozza nasce col capofila del gruppo, ed è la porta stessa a dirglielo. */
  'catalog/agente-pasti-leggeri.service.ts',
  /**
   * ⚠️ La soglia si misura sui `MAIN_SLOTS` — colazione, pranzo, cena — e **nessuno dei tre è
   * scambiabile**. Allargare qui non cambierebbe un numero; dichiararlo evita che qualcuno lo
   * "sistemi" credendo di aver trovato un difetto.
   */
  'personal-base/personal-base.service.ts',
  /**
   * ⚠️ Scrittura della ricetta generata (`create`), più la lettura di «cosa c'è già per questa
   * variante» che il generatore fa per non rifare piatti uguali. La seconda **andrebbe allargata**
   * — con i panieri uniti, generando spuntini deve vedere anche le merende — ma spostare da cosa
   * dipende il generatore è la **Fase 7** del piano e si fa con i numeri davanti, non di sponda a
   * questa consegna. Dichiarata perché si sappia che è in coda, non perché vada bene così.
   */
  'engine-rules/engine-rules.service.ts',
]);

/**
 * Le forme che nominano UN solo slot: una query per `mealSlot: <qualcosa>` invece che
 * `mealSlot: { in: … }`, un confronto secco, un `includes` su uno slot di catalogo, o il nome di
 * uno spuntino scritto a mano dentro un `where`.
 */
const SLOT_A_MANO = [
  /mealSlot:\s*[a-zA-Z_][A-Za-z0-9_.?]*\s+as never/,
  /mealSlot\s*(===|!==)/,
  /includes\([^)]*mealSlot/,
  /mealSlot:\s*'(morning|afternoon)_snack'/,
];

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

describe('spuntino e merenda sono lo stesso paniere', () => {
  const radice = join(__dirname, '..');

  it('nessuno pesca da un solo slot per conto suo', () => {
    const colpevoli = tuttiIFile(radice)
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        return SLOT_A_MANO.some((r) => r.test(src));
      })
      .map((f) => f.slice(radice.length + 1).replace(/\\/g, '/'))
      .filter((rel) => !PERMESSI.has(rel));
    expect(colpevoli).toEqual([]);
  });

  it('⚠️ e la sentinella riconoscerebbe le forme che cerca', () => {
    expect(SLOT_A_MANO.some((r) => r.test("where: { mealSlot: slot as never, active: true }"))).toBe(true);
    expect(SLOT_A_MANO.some((r) => r.test("if (r.mealSlot === atteso) return true;"))).toBe(true);
    expect(SLOT_A_MANO.some((r) => r.test("if (!attesi.includes(recipe.mealSlot)) throw"))).toBe(true);
    expect(SLOT_A_MANO.some((r) => r.test("where: { mealSlot: 'afternoon_snack' }"))).toBe(true);
    // …e tace su chi passa dalla porta, o su chi il campo lo legge e basta.
    expect(SLOT_A_MANO.some((r) => r.test("where: { mealSlot: { in: slotDaCuiPescare(slot) } as never }"))).toBe(false);
    expect(SLOT_A_MANO.some((r) => r.test("select: { id: true, mealSlot: true }"))).toBe(false);
    expect(SLOT_A_MANO.some((r) => r.test("where: { mealSlot: 'breakfast', active: true }"))).toBe(false);
  });

  it('⛔ il gruppo dichiarato è spuntino + merenda, e la colazione non ne fa parte', () => {
    expect(SLOT_SCAMBIABILI).toEqual([['morning_snack', 'afternoon_snack']]);
    expect(slotDaCuiPescare('breakfast')).toEqual(['breakfast']);
    expect(slotDaCuiPescare('lunch')).toEqual(['lunch']);
    expect(slotDaCuiPescare('dinner')).toEqual(['dinner']);
  });
});

describe('slotDaCuiPescare · puoStareNelloSlot · slotDaChiedere', () => {
  it('lo slot chiesto viene per primo, poi i gemelli', () => {
    expect(slotDaCuiPescare('morning_snack')).toEqual(['morning_snack', 'afternoon_snack']);
    expect(slotDaCuiPescare('afternoon_snack')).toEqual(['afternoon_snack', 'morning_snack']);
  });

  it('uno slot che non conosciamo risponde con se stesso invece di sparire', () => {
    expect(slotDaCuiPescare('merenda_serale')).toEqual(['merenda_serale']);
    expect(puoStareNelloSlot('merenda_serale', 'merenda_serale')).toBe(true);
  });

  it('una merenda può stare in uno spuntino, una colazione no', () => {
    expect(puoStareNelloSlot('afternoon_snack', 'morning_snack')).toBe(true);
    expect(puoStareNelloSlot('morning_snack', 'afternoon_snack')).toBe(true);
    expect(puoStareNelloSlot('breakfast', 'morning_snack')).toBe(false);
    expect(puoStareNelloSlot('morning_snack', 'lunch')).toBe(false);
  });

  it('gli slot da chiedere al catalogo non hanno doppioni', () => {
    expect(slotDaChiedere(['morning_snack', 'afternoon_snack'])).toEqual(['morning_snack', 'afternoon_snack']);
    expect(slotDaChiedere(['breakfast', 'morning_snack'])).toEqual(['breakfast', 'morning_snack', 'afternoon_snack']);
    expect(slotDaChiedere([])).toEqual([]);
  });

  it('il capofila è uno solo per gruppo, e per gli altri slot è lo slot stesso', () => {
    expect(slotCapofila('morning_snack')).toBe('morning_snack');
    expect(slotCapofila('afternoon_snack')).toBe('morning_snack');
    expect(slotCapofila('lunch')).toBe('lunch');
  });
});

describe('allargaAiGemelli', () => {
  const pool = (righe: Record<string, string[]>) =>
    new Map(Object.entries(righe).map(([k, v]) => [k, new Set(v)]));

  it('i due spuntini vedono le ricette l\'uno dell\'altro', () => {
    const out = allargaAiGemelli(pool({ morning_snack: ['a'], afternoon_snack: ['b'] }));
    expect([...out.get('morning_snack')!].sort()).toEqual(['a', 'b']);
    expect([...out.get('afternoon_snack')!].sort()).toEqual(['a', 'b']);
  });

  /**
   * ⛔ **LA RIGA CHE COSTEREBBE UN PASTO IN PIÙ.** Se l'allargamento creasse la chiave mancante,
   * una cliente che ha solo lo spuntino si troverebbe anche la merenda: kcal aggiunte al suo
   * piano perché il catalogo aveva una chiave. `dayComboPools` prende gli slot della giornata
   * proprio dalle chiavi di questo pool.
   */
  it('⛔ non inventa il pasto che la giornata non ha', () => {
    const out = allargaAiGemelli(pool({ morning_snack: ['a'], lunch: ['c'] }));
    expect([...out.keys()].sort()).toEqual(['lunch', 'morning_snack']);
    expect([...out.get('morning_snack')!]).toEqual(['a']);
  });

  it('gli slot senza gemelli restano come sono, e il pool di partenza non viene toccato', () => {
    const dentro = pool({ breakfast: ['x'], lunch: ['y'], dinner: ['z'] });
    const out = allargaAiGemelli(dentro);
    expect([...out.get('breakfast')!]).toEqual(['x']);
    out.get('breakfast')!.add('intruso');
    expect([...dentro.get('breakfast')!]).toEqual(['x']);
  });

  it('un pool vuoto resta vuoto', () => {
    expect([...allargaAiGemelli(new Map()).keys()]).toEqual([]);
  });
});
