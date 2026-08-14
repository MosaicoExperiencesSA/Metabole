import { leggiVerdetto, MAX_NOTA, motivoDetto, raccontaSostituzione } from './verifica-sostituzioni';

/**
 * VERIFICARE A VOCE I CAMBI CONCORDATI IN CHAT — voce 245, lettura **A** di Simone (14/8).
 * Foglio: `progetto/DECISIONE_Verificare_Cambi_A_Voce.md`.
 *
 * La riga che tiene in piedi tutto: **70 ml di panna sono ~200 kcal, 70 g di olio ~630**. Per
 * questo a voce passano solo ✓ e ✗, e un numero dettato **blocca il giro** invece di passare per
 * una conferma.
 */

describe('leggiVerdetto — a voce passano solo ✓ e ✗', () => {
  it('le forme del sì', () => {
    for (const f of ['va bene', 'sì', 'si', 'ok', 'confermo', 'giusto', 'va bene sì', 'approvo']) {
      expect(leggiVerdetto(f)).toBe('ok');
    }
  });

  it('le forme del no', () => {
    for (const f of ['no', 'no, non va bene', 'annulla questa', 'rifiuto', 'nega', 'non va bene']) {
      expect(leggiVerdetto(f)).toBe('no');
    }
  });

  it('⚠️ un NUMERO dettato non è una conferma: blocca il giro e si va in scheda', () => {
    // 70 ml di panna ≈200 kcal, 70 g di olio ≈630: il numero che decide il pasto non si detta.
    expect(leggiVerdetto('metti 30 g invece di 70')).toBe('grammi');
    expect(leggiVerdetto('30 grammi')).toBe('grammi');
    expect(leggiVerdetto('mettine 25 ml')).toBe('grammi');
  });

  it('⚠️ il caso peggiore: «sì, ma metti 30 g» NON è un sì', () => {
    // Se questo passasse come conferma, la riga verrebbe validata con la grammatura VECCHIA — e
    // sembrerebbe che lei l'abbia approvata. È l\'unico modo di sbagliare che non lascia traccia.
    expect(leggiVerdetto('sì, ma metti 30 g')).toBe('grammi');
    expect(leggiVerdetto('va bene però 25 grammi')).toBe('grammi');
  });

  it('⚠️ un numero senza unità non è una grammatura: «no, per la terza volta» resta un no', () => {
    expect(leggiVerdetto('no, è la terza volta')).toBe('no');
  });

  it('⚠️ quello che non è né sì né no né un numero è null: non si indovina', () => {
    for (const f of ['', '   ', 'boh', 'e la cena?', 'aspetta']) {
      expect(leggiVerdetto(f)).toBeNull();
    }
  });
});

describe('motivoDetto — il motivo si prende solo se lo dice lei', () => {
  it('«no, è troppo grassa» tiene il motivo', () => {
    expect(motivoDetto('no, è troppo grassa')).toBe('è troppo grassa');
  });

  it('⚠️ un «no» secco non produce un motivo inventato', () => {
    expect(motivoDetto('no')).toBeNull();
    expect(motivoDetto('no.')).toBeNull();
  });

  it('non si tiene un moncone di due lettere: non è un motivo', () => {
    expect(motivoDetto('no, ok')).toBeNull();
  });

  it('⚠️ un motivo lunghissimo si taglia al limite del campo in scheda, non si scrive più lungo', () => {
    // `AggiornaSostituzioneDto.nota` ha @MaxLength(300): a voce il DTO non gira, e senza taglio si
    // scriverebbe una nota che dalla pagina verrebbe rifiutata — due regole per lo stesso campo.
    const lungo = motivoDetto(`no, ${'parola '.repeat(80)}`);
    expect(lungo!.length).toBeLessThanOrEqual(MAX_NOTA + 1);
    expect(lungo!.endsWith('…')).toBe(true);
  });
});

describe('raccontaSostituzione — cosa deve esserci per poter decidere', () => {
  const riga = {
    id: 's1',
    cliente: 'Giulia Rossi',
    dishName: 'Pasta al pesto',
    fromFood: 'panna',
    toFood: 'olio',
    fromQty: 70,
    toQty: 70,
    unit: 'g',
    volte: 3,
  };

  it('nomina la cliente, il piatto, il da/a e le quantità', () => {
    const t = raccontaSostituzione(riga);
    expect(t).toContain('Giulia Rossi');
    expect(t).toContain('Pasta al pesto');
    expect(t).toContain('panna');
    expect(t).toContain('olio');
    expect(t).toContain('70');
  });

  it('⚠️ dice QUANTE VOLTE l\'ha chiesta: una richiesta ripetuta non è un caso', () => {
    expect(raccontaSostituzione(riga)).toContain('3');
  });

  it('senza piatto e senza quantità resta leggibile e non stampa «null»', () => {
    const t = raccontaSostituzione({ ...riga, dishName: null, fromQty: null, toQty: null, unit: null, volte: 1 });
    expect(t).toContain('panna');
    expect(t.toLowerCase()).not.toContain('null');
    expect(t.toLowerCase()).not.toContain('undefined');
  });
});
