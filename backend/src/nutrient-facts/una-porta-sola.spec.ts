import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * ⚠️ **CHI CHIEDE «A QUALE RIGA SI ABBINA QUESTO INGREDIENTE?» PASSA DA UNA PORTA SOLA.**
 *
 * Questo test non guarda un comportamento: guarda **il codice sorgente**. È insolito, e c'è una
 * ragione precisa per cui esiste — un difetto vero, del 20/8, che nessun test poteva vedere.
 *
 * `abbina` prende `nomiDi` e `statoDi` come parametri, ed è giusto: è una funzione pura e non deve
 * sapere com'è fatta una riga della tabella. ⛔ Ma allora i chiamanti possono passarli **diversi**, e
 * l'hanno fatto: `cercaPerIngrediente` passava lo stato della riga, `diag:crudo-cotto` **no**.
 *
 * Dalla sera del 19/8 una parola di stato («freschi») si accetta solo se combacia con lo stato della
 * riga. Senza `statoDi` lo stato è sempre vuoto, quindi non combacia mai: la diagnostica rispondeva
 * **«spinaci freschi NON si abbina»** su un nome che in produzione si abbina — 1350 ricette. E quella
 * diagnostica è il foglio da cui la nutrizionista decide **quali righe scrivere a mano**: la stava
 * mandando a fare un lavoro che non serve.
 *
 * ⚠️ È la stessa specie di errore di un test double che si comporta diversamente dall'originale — mi
 * ha morso sei volte in due giorni. Ma un test double lo scopre una mutazione; **questa copia
 * sbagliata viveva in uno script, dove nessuna mutazione arriva**. L'unico modo di tenerla ferma è
 * guardare chi chiama cosa.
 *
 * ⛔ Se un giorno serve davvero l'abbinamento con regole diverse: si aggiunge il file qui sotto, con
 * scritto **perché**. Il punto non è vietare — è che la scelta si veda in un commit.
 */
const PERMESSI = new Set([
  // La sua casa: `abbinaPerRicetta` è lì dentro e chiama `abbina`.
  'nutrient-facts/abbinamento-alimenti.ts',
  // I test provano la funzione pura, con tutte le combinazioni: è il loro mestiere.
  'nutrient-facts/abbinamento-alimenti.spec.ts',
]);

function fileSorgente(radice: string, base = ''): string[] {
  const fuori: string[] = [];
  for (const voce of readdirSync(radice)) {
    const pieno = join(radice, voce);
    const relativo = base ? `${base}/${voce}` : voce;
    if (statSync(pieno).isDirectory()) fuori.push(...fileSorgente(pieno, relativo));
    else if (voce.endsWith('.ts')) fuori.push(relativo);
  }
  return fuori;
}

describe('l\'abbinamento degli ingredienti ha una porta sola', () => {
  it('⚠️ nessuno chiama `abbina` per conto suo: si passa da `abbinaPerRicetta`', () => {
    const radice = join(__dirname, '..');
    const colpevoli = fileSorgente(radice)
      .filter((f) => !PERMESSI.has(f))
      .filter((f) => /\babbina\s*\(/.test(readFileSync(join(radice, f), 'utf8')));
    expect(colpevoli).toEqual([]);
  });

  /**
   * ⚠️ E la stessa regola vale per gli **script** di `prisma/`, che è precisamente dove il difetto
   * viveva: uno script non ha test, quindi è il posto dove una copia sbagliata può restare per
   * settimane senza che niente diventi rosso.
   */
  it('⚠️ e nemmeno gli script, che sono il posto dove il difetto era nascosto', () => {
    const radice = join(__dirname, '..', '..', 'prisma');
    const colpevoli = fileSorgente(radice).filter((f) =>
      /\babbina\s*\(/.test(readFileSync(join(radice, f), 'utf8')),
    );
    expect(colpevoli).toEqual([]);
  });
});
