/**
 * LA GUARDIA CHE IL CONTROLLO ATWATER NON POTEVA FARE — 20/8.
 *
 * Prima di caricare le 245 righe del foglio compilato le avevo passate a un controllo di coerenza
 * (`4·proteine + 4·carboidrati + 9·grassi ≈ kcal`). Ne segnalò **una sola**, e dissi che il foglio
 * era buono. Non lo era: 173 righe su 245 sono la copia esatta dei valori di un'altra riga — 99
 * alimenti diversi tutti a «25 kcal».
 *
 * ⚠️ Il controllo non aveva sbagliato: guardava una riga per volta, e una riga vera **copiata resta
 * coerente con sé stessa** ovunque la si incolli. Nessun controllo di plausibilità interna può
 * vedere un riempimento. Serviva una domanda diversa — «queste righe sono uguali fra loro?» — e
 * questi test la tengono in piedi.
 */
import { trovaGemelli, riempimenti, radiceComune, radiciDi } from './gemelli-alimenti';
import { ALIMENTI_19_8 } from '../../prisma/dati-alimenti';
import { ALIMENTI_20_8 } from '../../prisma/dati-alimenti-20-8';

const r = (name: string, kcal: number, resto: Partial<{ protein: number; carbs: number; sugars: number; fat: number; fiber: number }> = {}) =>
  ({ name, kcal, protein: 1.5, carbs: 3.5, sugars: 2.5, fat: 0.3, fiber: 2.2, ...resto });

describe('quando i valori sono copiati', () => {
  it('tre alimenti che non c\'entrano niente con lo stesso numero sono un riempimento', () => {
    const g = riempimenti(trovaGemelli([r('tahina', 25), r('peperone rosso', 25), r('ghee', 25)]));
    expect(g).toHaveLength(1);
    expect(g[0].nomi).toEqual(['tahina', 'peperone rosso', 'ghee']);
  });

  it('due sole righe non bastano: due alimenti diversi con gli stessi valori càpitano', () => {
    expect(trovaGemelli([r('tahina', 25), r('ghee', 25)])).toHaveLength(0);
  });

  it('⚠️ lo stesso alimento scritto in tre modi NON è un riempimento (o l\'avviso comparirebbe sempre)', () => {
    const g = trovaGemelli([r('pomodoro fresco', 18), r('pomodori freschi', 18), r('pomodoro pelato', 18)]);
    expect(g).toHaveLength(1);
    expect(g[0].radiceComune).toBe('pomo');
    expect(riempimenti(g)).toHaveLength(0);
  });

  it('⚠️ zero kcal non è un numero copiato: sale, sale marino e acqua sono davvero a zero', () => {
    const zero = { protein: 0, carbs: 0, sugars: 0, fat: 0, fiber: 0 };
    expect(trovaGemelli([r('sale', 0, zero), r('sale marino', 0, zero), r('acqua', 0, zero)])).toHaveLength(0);
  });

  it('basta un valore diverso perché non siano gemelli: il confronto è su tutti i macro, non sulle kcal', () => {
    expect(trovaGemelli([r('a', 25), r('b', 25), r('c', 25, { fiber: 2.3 })])).toHaveLength(0);
  });
});

describe('le radici dei nomi', () => {
  it('«carote» e «carota» parlano della stessa cosa', () => {
    expect(radiceComune(['carote', 'carota cruda'])).toBe('caro');
  });
  it('le parole corte non contano: «di», «a», «e» non legano niente', () => {
    expect(radiciDi('olio di oliva')).toEqual(new Set(['olio', 'oliv']));
  });
  it('«tahina» e «peperone rosso» non hanno niente in comune', () => {
    expect(radiceComune(['tahina', 'peperone rosso'])).toBeNull();
  });
});

describe('i due fogli veri', () => {
  it('⛔ il foglio del 20/8 non si può caricare: 173 righe hanno i valori di un altro alimento', () => {
    const copiati = riempimenti(trovaGemelli(ALIMENTI_20_8));
    expect(copiati.length).toBeGreaterThan(0);
    expect(copiati.reduce((s, g) => s + g.nomi.length, 0)).toBe(173);
    expect(copiati[0].nomi).toHaveLength(99);
    expect(copiati[0].valori).toBe('25/1.5/3.5/2.5/0.3/2.2');
  });

  it('✅ il foglio del 19/8 passa pulito — la guardia non grida sul foglio giusto', () => {
    expect(riempimenti(trovaGemelli(ALIMENTI_19_8))).toEqual([]);
  });
});
