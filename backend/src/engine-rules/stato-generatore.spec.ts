import { ORE_PRIMA_DI_DIRLO_FERMO, statoDaiBattiti } from './stato-generatore';

const ADESSO = new Date('2026-08-18T12:00:00Z');
const oreFa = (h: number) => new Date(ADESSO.getTime() - h * 3_600_000);
const b = (h: number, metadata: Record<string, unknown>) => ({ createdAt: oreFa(h), metadata });

describe('statoDaiBattiti', () => {
  /**
   * ⚠️ LA RISPOSTA PIÙ IMPORTANTE. Nessun battito non vuol dire «non ha avuto niente da fare»:
   * vuol dire che il cron non è mai partito. Prima del 18/8 le due cose si leggevano uguali, ed è
   * il motivo per cui il battito esiste.
   */
  it('⚠️ nessun battito NON è «tutto a posto»: è «mai partito»', () => {
    const s = statoDaiBattiti([], ADESSO);
    expect(s.verdetto).toBe('mai_partito');
    expect(s.ultimoGiro).toBeNull();
    expect(s.messaggio).toContain('cron non esiste');
    expect(s.messaggio).toContain('Non vuol dire che il catalogo sia a posto');
  });

  it('ha generato: lo dice, con variante e settimana', () => {
    const s = statoDaiBattiti([b(2, { ok: true, fatto: true, variante: 'Mediterranea 5 pasti', settimana: 6 })], ADESSO);
    expect(s.verdetto).toBe('lavora');
    expect(s.messaggio).toContain('Mediterranea 5 pasti');
    expect(s.messaggio).toContain('settimana 6');
  });

  it('non aveva niente da fare: è un esito diverso dall\'errore, e si legge diverso', () => {
    const s = statoDaiBattiti([b(3, { ok: true, fatto: false, motivo: 'catalogo completo' })], ADESSO);
    expect(s.verdetto).toBe('niente_da_fare');
    expect(s.messaggio).toContain('catalogo completo');
  });

  it('è andato in errore: si dice quale', () => {
    const s = statoDaiBattiti([b(1, { ok: false, errore: 'credito esaurito' })], ADESSO);
    expect(s.verdetto).toBe('errore');
    expect(s.messaggio).toContain('credito esaurito');
  });

  /**
   * ⚠️ «Fermo» viene PRIMA di tutto il resto: se l'ultimo giro è di tre giorni fa, che sia andato
   * bene non importa più — la notizia è che non ne sono arrivati altri.
   */
  it('⚠️ l\'ultimo giro troppo vecchio vince sull\'esito, e si dice DA QUANTE ore', () => {
    const s = statoDaiBattiti([b(ORE_PRIMA_DI_DIRLO_FERMO + 12, { ok: true, fatto: true, variante: 'X' })], ADESSO);
    expect(s.verdetto).toBe('fermo');
    expect(s.messaggio).toContain('48 ore fa');
  });

  it('sul filo delle 36 ore non è ancora fermo', () => {
    expect(statoDaiBattiti([b(36, { ok: true, fatto: true })], ADESSO).verdetto).toBe('lavora');
  });

  it('conta i giri e gli errori della finestra', () => {
    const s = statoDaiBattiti(
      [b(1, { ok: true, fatto: true }), b(25, { ok: false, errore: 'x' }), b(49, { ok: true, fatto: false })],
      ADESSO,
    );
    expect(s.giri).toBe(3);
    expect(s.errori).toBe(1);
  });

  it('un metadata assente o storto non fa esplodere niente', () => {
    expect(statoDaiBattiti([{ createdAt: oreFa(1) }], ADESSO).verdetto).toBe('niente_da_fare');
    expect(statoDaiBattiti([{ createdAt: oreFa(1), metadata: 'boh' }], ADESSO).verdetto).toBe('niente_da_fare');
  });
});
