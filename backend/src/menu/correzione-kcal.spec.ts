import { calcolaTargetKcal, haCorrezioniAMano, spiegaTargetKcal, LIMITE_ASSOLUTO_KCAL, correzioneAttiva, scadenzaDaGiorni, quotaProteicaMinima, minimoDaPiuProteine } from './correzione-kcal';

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

/**
 * LA CORREZIONE HA UNA DURATA (risposta di Nocanty, 13/8; decisione 14/8 in
 * progetto/NOTA_Correzione_Kcal_A_Termine.md): «riduci le kcal del 10% per 7 giorni e poi riprendi
 * col normale ritmo».
 */
describe('correzioneAttiva — «per 7 giorni, e poi si riprende»', () => {
  const G = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it('senza scadenza vale finché non la togli: è il comportamento di prima, e non cambia', () => {
    expect(correzioneAttiva(-10, null, G('2026-12-31'))).toBe(-10);
  });

  it('dentro la finestra si applica', () => {
    expect(correzioneAttiva(-10, G('2026-08-21'), G('2026-08-14'))).toBe(-10);
  });

  it('⚠️ l\'ultimo giorno è COMPRESO: «per 7 giorni» copre anche il settimo', () => {
    expect(correzioneAttiva(-10, G('2026-08-20'), G('2026-08-20'))).toBe(-10);
  });

  it('⚠️ si confronta per GIORNO, non per istante: un menu delle 23:50 fa come uno delle 8:00', () => {
    expect(correzioneAttiva(-10, G('2026-08-20'), new Date('2026-08-20T23:50:00.000Z'))).toBe(-10);
  });

  it('dopo la scadenza non si applica più: il target torna quello normale, da solo', () => {
    expect(correzioneAttiva(-10, G('2026-08-20'), G('2026-08-21'))).toBe(0);
  });

  it('nessuna correzione scritta resta nessuna correzione', () => {
    expect(correzioneAttiva(null, G('2026-08-21'), G('2026-08-14'))).toBe(0);
  });
});

describe('scadenzaDaGiorni — «per 7 giorni» da oggi', () => {
  it('7 giorni da oggi coprono oggi e i sei successivi', () => {
    const fine = scadenzaDaGiorni(7, new Date('2026-08-14T10:00:00.000Z'))!;
    expect(fine.toISOString().slice(0, 10)).toBe('2026-08-20');
  });

  it('1 giorno vuol dire solo oggi', () => {
    expect(scadenzaDaGiorni(1, new Date('2026-08-14T10:00:00.000Z'))!.toISOString().slice(0, 10)).toBe('2026-08-14');
  });

  it('⚠️ zero o meno non è una durata: si torna null e non si scrive una scadenza già passata', () => {
    expect(scadenzaDaGiorni(0, new Date('2026-08-14T10:00:00.000Z'))).toBeNull();
    expect(scadenzaDaGiorni(-3, new Date('2026-08-14T10:00:00.000Z'))).toBeNull();
  });
});

/**
 * «RIFAI CON PIÙ PROTEINE» (14/8, decisione A di Simone): la quota minima di QUESTA cliente vince
 * su quella della dieta — e vince solo sul minimo.
 */
describe('quotaProteicaMinima — la sua vince su quella della dieta', () => {
  it('senza niente sul profilo vale la banda della dieta: il comportamento di oggi', () => {
    expect(quotaProteicaMinima(null, 0.2)).toBe(0.2);
    expect(quotaProteicaMinima(undefined, 0.2)).toBe(0.2);
  });

  it('la sua vince quando c\'è', () => {
    expect(quotaProteicaMinima(0.3, 0.2)).toBe(0.3);
  });

  it('⚠️ vale anche se è PIÙ BASSA di quella della dieta: è una decisione clinica, non un massimo', () => {
    // Se la nutrizionista scrive 15 su una dieta che ne chiede 20, ha deciso lei: il campo
    // esiste per contare più della regola generale, in tutte e due le direzioni.
    expect(quotaProteicaMinima(0.15, 0.2)).toBe(0.15);
  });

  it('⚠️ un valore fuori scala si ignora: 0–1 è una frazione, 30 è un errore di battitura', () => {
    expect(quotaProteicaMinima(30, 0.2)).toBe(0.2);
    expect(quotaProteicaMinima(-0.1, 0.2)).toBe(0.2);
  });
});

describe('minimoDaPiuProteine — «più proteine» senza un numero', () => {
  it('+10 punti sul minimo della dieta (decisione di Simone: dal 20% al 30%)', () => {
    expect(minimoDaPiuProteine(0.2)).toBeCloseTo(0.3, 5);
  });

  it('⚠️ non si sfonda: sopra il 60% non è più una giornata, è un integratore', () => {
    expect(minimoDaPiuProteine(0.55)).toBeCloseTo(0.6, 5);
  });
});
