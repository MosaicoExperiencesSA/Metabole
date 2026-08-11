import { calcolaTargetKcal, haCorrezioniAMano, spiegaTargetKcal, LIMITE_ASSOLUTO_KCAL } from './correzione-kcal';

/**
 * I numeri di questi test sono quelli di una cliente vera per come li produce il motore: fabbisogno
 * intorno alle 1900 kcal, deficit dedotto di qualche centinaio. Servono a leggere il test come si
 * legge una scheda, non come si legge una formula.
 */
const base = {
  tdee: 1900,
  deficitCalcolato: 285,
  soglia: 1200,
  tettoDeficitPct: 0.3,
  tettoDeficitKcal: 1000,
};

describe('correzione-kcal — le calorie scritte a mano dal nutrizionista', () => {
  it('senza niente scritto a mano: il calcolo di prima, invariato', () => {
    const e = calcolaTargetKcal(base);
    expect(e.target).toBe(1620); // 1900 − 285 = 1615, arrotondato a 10
    expect(e.fonteDeficit).toBe('calcolato');
    expect(e.correzionePct).toBe(0);
    expect(e.sottoSoglia).toBe(false);
  });

  it('il deficit imposto SOSTITUISCE quello calcolato', () => {
    const e = calcolaTargetKcal({ ...base, deficitImposto: 450 });
    expect(e.deficit).toBe(450);
    expect(e.fonteDeficit).toBe('imposto');
    expect(e.target).toBe(1450);
  });

  it('il deficit imposto resta agganciato al fabbisogno: se il TDEE scende, scendono le kcal', () => {
    const oggi = calcolaTargetKcal({ ...base, deficitImposto: 450 });
    const fraUnMese = calcolaTargetKcal({ ...base, tdee: 1830, deficitImposto: 450 });
    expect(oggi.target).toBe(1450);
    expect(fraUnMese.target).toBe(1380); // il deficit resta quello scritto, il target segue il TDEE
  });

  it('la correzione percentuale si applica DOPO il deficit', () => {
    const e = calcolaTargetKcal({ ...base, correzionePct: -10 });
    // (1900 − 285) × 0.9 = 1453,5 → 1450
    expect(e.target).toBe(1450);
    expect(e.correzionePct).toBe(-10);
  });

  it('correzione positiva: si può anche dare di più', () => {
    const e = calcolaTargetKcal({ ...base, correzionePct: 8 });
    expect(e.target).toBe(1740); // 1615 × 1.08 = 1744,2 → 1740
  });

  it('le due leve si compongono nell’ordine giusto: prima il deficit, poi la percentuale', () => {
    const e = calcolaTargetKcal({ ...base, deficitImposto: 450, correzionePct: -5 });
    // (1900 − 450) × 0.95 = 1377,5 → 1380. Se la percentuale agisse sul TDEE farebbe 1355: diverso.
    expect(e.target).toBe(1380);
  });

  it('i tetti tagliano il deficit CALCOLATO: un obiettivo irreale scritto in onboarding non passa', () => {
    const e = calcolaTargetKcal({ ...base, deficitCalcolato: 1400 });
    expect(e.deficit).toBe(570); // 30% di 1900, che morde prima del tetto assoluto di 1000
    expect(e.tettoApplicato).toBe(true);
  });

  it('i tetti NON toccano il deficit IMPOSTO: se lo scrive un clinico, l’ha scritto un clinico', () => {
    const e = calcolaTargetKcal({ ...base, deficitImposto: 900 });
    expect(e.deficit).toBe(900); // 900 > 30% di 1900 (570), e passa lo stesso
    expect(e.tettoApplicato).toBe(false);
    expect(e.target).toBe(1000);
    expect(e.sottoSoglia).toBe(true); // sotto le 1200: va detto a qualcuno
  });

  it('senza valori a mano il pavimento ALZA il target, e non c’è niente da segnalare', () => {
    const e = calcolaTargetKcal({ ...base, tdee: 1300, deficitCalcolato: 300 });
    expect(e.target).toBe(1200);
    expect(e.sogliaApplicata).toBe(true);
    expect(e.sottoSoglia).toBe(false);
  });

  it('con un valore a mano il pavimento NON alza: passa com’è e si accende sottoSoglia', () => {
    const e = calcolaTargetKcal({ ...base, tdee: 1300, deficitImposto: 300 });
    expect(e.target).toBe(1000);
    expect(e.sogliaApplicata).toBe(false);
    expect(e.sottoSoglia).toBe(true);
  });

  it('anche la sola correzione percentuale basta a scavalcare il pavimento', () => {
    const e = calcolaTargetKcal({ ...base, tdee: 1450, deficitCalcolato: 0, correzionePct: -20 });
    expect(e.target).toBe(1160); // sotto 1200
    expect(e.sottoSoglia).toBe(true);
  });

  it('il limite anti-refuso vale per tutti: uno zero di troppo non diventa una dieta', () => {
    const e = calcolaTargetKcal({ ...base, deficitImposto: 1800 });
    expect(e.target).toBe(LIMITE_ASSOLUTO_KCAL);
    expect(e.limiteAssolutoApplicato).toBe(true);
  });

  it('mantenimento (nessun deficit) e nessuna correzione: il target è il fabbisogno', () => {
    const e = calcolaTargetKcal({ ...base, deficitCalcolato: 0 });
    expect(e.fonteDeficit).toBe('nessuno');
    expect(e.target).toBe(1900);
  });

  it('zero e null non sono correzioni: non accendono niente', () => {
    expect(haCorrezioniAMano(null, null)).toBe(false);
    expect(haCorrezioniAMano(0, 0)).toBe(false);
    expect(haCorrezioniAMano(450, null)).toBe(true);
    expect(haCorrezioniAMano(null, -5)).toBe(true);
    const e = calcolaTargetKcal({ ...base, tdee: 1300, deficitImposto: 0, correzionePct: 0 });
    expect(e.sogliaApplicata).toBe(true); // trattata come «nessun valore a mano»
    expect(e.sottoSoglia).toBe(false);
  });

  describe('la frase che spiega il numero', () => {
    it('dice da dove viene il deficit e quanto vale la correzione', () => {
      const e = calcolaTargetKcal({ ...base, deficitImposto: 450, correzionePct: -5 });
      const s = spiegaTargetKcal(e, base.tdee);
      expect(s).toContain('1380 kcal/giorno');
      expect(s).toContain('deficit imposto dal nutrizionista 450 kcal');
      expect(s).toContain('correzione del nutrizionista -5%');
    });

    it('quando si va sotto la soglia lo dice a chiare lettere', () => {
      const e = calcolaTargetKcal({ ...base, tdee: 1300, deficitImposto: 300 });
      expect(spiegaTargetKcal(e, 1300)).toContain('SOTTO la soglia minima di sicurezza');
    });

    it('e quando ha morso il tetto, lo dice invece di far comparire un numero diverso', () => {
      const e = calcolaTargetKcal({ ...base, deficitCalcolato: 1400 });
      expect(spiegaTargetKcal(e, base.tdee)).toContain('tagliato dal tetto di sicurezza');
    });
  });
});
