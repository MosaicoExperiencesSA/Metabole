import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  BMI_MINIMO, DOMANDE_DI_ESCLUSIONE, calcolaBmi, digiunoSiPuoProporre, vaSospesoSubito,
} from './digiuno-si-puo';

/**
 * ⛔ **LE REGOLE CLINICHE DI LUCIA (5/9), una prova per ognuna.** Non sono scelte di software: se
 * una di queste cambia, cambia perché una nutrizionista lo ha deciso, e allora si cambia anche il
 * documento firmato in `progetto/guide/`.
 */

describe('calcolaBmi', () => {
  it('kg / m², arrotondato al decimo', () => {
    expect(calcolaBmi(60, 170)).toBe(20.8);
    expect(calcolaBmi(50, 170)).toBe(17.3);
  });

  it('⛔ senza peso o senza altezza è null, che NON è «va bene»', () => {
    expect(calcolaBmi(null, 170)).toBeNull();
    expect(calcolaBmi(60, null)).toBeNull();
    expect(calcolaBmi(0, 170)).toBeNull();
  });
});

describe('digiunoSiPuoProporre', () => {
  const sana = { pesoKg: 65, heightCm: 168, risposte: { dca: false, gravidanza: false, ipoglicemizzanti: false } };

  it('✅ chi non ha esclusioni e sta sopra la soglia: si può', () => {
    expect(digiunoSiPuoProporre(sana)).toEqual({ siPuo: true, bmi: 23 });
  });

  it(`⛔ sotto BMI ${BMI_MINIMO} non si propone, ed è la soglia di Lucia`, () => {
    const out = digiunoSiPuoProporre({ ...sana, pesoKg: 50 }); // 17.7
    expect(out).toMatchObject({ siPuo: false, motivo: 'sottopeso' });
  });

  it('⚠️ esattamente 18,5 si può: la soglia è «sotto», non «sotto o uguale»', () => {
    // 53,4 kg su 170 cm = 18,5
    expect(digiunoSiPuoProporre({ ...sana, pesoKg: 53.4, heightCm: 170 }).siPuo).toBe(true);
  });

  it('⛔ le tre domande di esclusione bloccano, ognuna con la sua frase', () => {
    for (const { chiave } of DOMANDE_DI_ESCLUSIONE) {
      const out = digiunoSiPuoProporre({ ...sana, risposte: { [chiave]: true } });
      expect(out).toMatchObject({ siPuo: false, motivo: chiave });
      if (!out.siPuo) expect(out.frase.length).toBeGreaterThan(20);
    }
  });

  it('⛔ le esclusioni vengono PRIMA del BMI: a una donna in gravidanza non si dice «sei sottopeso»', () => {
    const out = digiunoSiPuoProporre({ pesoKg: 45, heightCm: 170, risposte: { gravidanza: true } });
    expect(out).toMatchObject({ siPuo: false, motivo: 'gravidanza' });
  });

  it('⛔ senza peso o altezza NON si propone: «non lo so» non è «va bene»', () => {
    expect(digiunoSiPuoProporre({ heightCm: 170 })).toMatchObject({ siPuo: false, motivo: 'dati_mancanti' });
  });
});

describe('vaSospesoSubito — per chi sta GIÀ digiunando', () => {
  it('⚠️ il caso normale non costa niente: nessun motivo, nessuna sospensione', () => {
    expect(vaSospesoSubito({ pesoKg: 65, heightCm: 168, risposte: { dca: false } })).toBeNull();
  });

  it('⛔ una controindicazione dichiarata sospende subito, e lo dice per esteso', () => {
    const out = vaSospesoSubito({ pesoKg: 65, heightCm: 168, risposte: { dca: true } });
    expect(out?.motivi).toEqual(['dca']);
    expect(out?.frase).toMatch(/giornata piena/);
  });

  it('⛔ i motivi si dicono TUTTI, non solo il primo', () => {
    const out = vaSospesoSubito({ pesoKg: 65, heightCm: 170, risposte: { dca: true, gravidanza: true } });
    expect(out?.motivi).toEqual(['dca', 'gravidanza']);
  });

  /**
   * ⛔ **IL SOTTOPESO NON SOSPENDE, e non è una svista** (corretto in revisione il 5/9). Il BMI si
   * calcola su una pesata che nessuno ha verificato: una cliente di 68 kg che digita 48 si sarebbe
   * vista togliere il digiuno quella notte, senza nessun gesto inverso. La soglia di Lucia protegge
   * dove costa una proposta in meno — `digiunoSiPuoProporre` — non un percorso tolto.
   */
  it('⛔ un BMI bassissimo da solo NON sospende: sospende solo quello che qualcuno ha dichiarato', () => {
    expect(vaSospesoSubito({ pesoKg: 45, heightCm: 175, risposte: { dca: false } })).toBeNull();
    expect(digiunoSiPuoProporre({ pesoKg: 45, heightCm: 175, risposte: { dca: false } }).siPuo).toBe(false);
  });

  it('⛔ un dato MANCANTE non sospende: togliere il digiuno per una nostra ignoranza è un danno', () => {
    expect(vaSospesoSubito({ heightCm: 170, risposte: { dca: false } })).toBeNull();
    expect(vaSospesoSubito({})).toBeNull();
  });
});

describe('⛔ le decisioni di Lucia, lette nei sorgenti', () => {
  const radice = join(__dirname, '..', '..');
  const leggi = (p: string) => readFileSync(join(radice, p), 'utf8');

  /**
   * ⛔ **LE QUOTE 45-10-45 NON SI TOCCANO, ed è una decisione, non una dimenticanza.** Il manuale
   * clinico propone 36 · 16 · 48 (la cena diventa il pasto più grande); Lucia il 5/9 ha barrato
   * «Standard Attuale». Senza questa prova, il prossimo che rilegge il manuale «corregge» il codice.
   */
  it('⛔ le quote del digiuno restano .45/.10/.45, e il codice dice perché', () => {
    const src = leggi('src/catalog/struttura-per-digiuno.ts');
    expect(src).toMatch(/0?\.45/);
    expect(src).toMatch(/36/); // il numero del manuale è nominato, con la ragione per cui NON si usa
    expect(src).toMatch(/Lucia|5\/9/);
  });

  it('⚠️ il documento firmato è nel repo, e non solo in una chat', () => {
    // ⚠️ `existsSync` e non una lettura: è un PDF, e leggerlo come testo non direbbe niente in più.
    expect(existsSync(join(radice, '..', 'progetto/guide/Risposte_Cliniche_Lucia_2026-09-05.pdf'))).toBe(true);
  });
});
