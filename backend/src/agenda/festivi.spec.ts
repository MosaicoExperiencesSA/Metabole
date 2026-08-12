/**
 * L'aritmetica del calendario non si legge: si verifica sui risultati. Le date di Pasqua qui sotto
 * sono quelle vere, e sono la sola cosa che dice se l'algoritmo è giusto.
 */
import { eFestivo, festivita, festivitaDellAnno, pasqua } from './festivi';

describe('festività italiane', () => {
  describe('Pasqua, che si muove ogni anno', () => {
    // Sette anni consecutivi, con dentro i due casi limite: la Pasqua altissima (aprile inoltrato)
    // e quella bassa (marzo), che è quella che porta il lunedì dell'Angelo in un altro mese.
    const attese: [number, string][] = [
      [2024, '2024-03-31'],
      [2025, '2025-04-20'],
      [2026, '2026-04-05'],
      [2027, '2027-03-28'],
      [2028, '2028-04-16'],
      [2029, '2029-04-01'],
      [2030, '2030-04-21'],
    ];

    it.each(attese)('nel %i cade il %s', (anno, iso) => {
      const p = pasqua(anno);
      const calcolata = `${anno}-${String(p.mese).padStart(2, '0')}-${String(p.giorno).padStart(2, '0')}`;
      expect(calcolata).toBe(iso);
      expect(festivita(iso)).toBe('Pasqua');
    });

    it('⚠️ il lunedì dell\'Angelo cambia MESE quando Pasqua è il 31 marzo', () => {
      // 2024: Pasqua domenica 31 marzo, Pasquetta lunedì 1 aprile. Con un `giorno + 1` scritto a
      // mano su una stringa sarebbe diventato «31 marzo + 1 = 32 marzo», cioè niente.
      expect(festivita('2024-04-01')).toBe("Lunedì dell'Angelo");
      expect(festivita('2026-04-06')).toBe("Lunedì dell'Angelo");
    });
  });

  describe('le feste a data fissa', () => {
    it.each([
      ['2026-01-01', 'Capodanno'],
      ['2026-01-06', 'Epifania'],
      ['2026-04-25', 'Liberazione'],
      ['2026-05-01', 'Festa dei lavoratori'],
      ['2026-06-02', 'Festa della Repubblica'],
      ['2026-08-15', 'Ferragosto'],
      ['2026-11-01', 'Ognissanti'],
      ['2026-12-08', 'Immacolata'],
      ['2026-12-25', 'Natale'],
      ['2026-12-26', 'Santo Stefano'],
    ])('%s è %s', (data, nome) => {
      expect(festivita(data)).toBe(nome);
      expect(eFestivo(data)).toBe(true);
    });

    it('sono dodici in tutto: dieci fisse più le due di Pasqua', () => {
      expect(festivitaDellAnno(2026).size).toBe(12);
    });
  });

  describe('i giorni normali restano normali', () => {
    it('un mercoledì qualunque non è festivo', () => {
      expect(festivita('2026-08-12')).toBeNull();
      expect(eFestivo('2026-08-12')).toBe(false);
    });

    it('⚠️ la DOMENICA non è festiva, e non è una svista', () => {
      // 2026-08-16 è una domenica. Se un nutrizionista mette uno slot di domenica è perché la
      // domenica riceve: chiuderglielo d'ufficio sarebbe decidere al posto suo.
      expect(eFestivo('2026-08-16')).toBe(false);
    });

    it('una data storta non fa cadere niente', () => {
      expect(festivita('')).toBeNull();
      expect(festivita('non-una-data')).toBeNull();
    });
  });

  it('vale anche per gli anni che non abbiamo scritto a mano: il file non scade', () => {
    // È il motivo per cui Pasqua si calcola invece di stare in un elenco: un elenco, un anno,
    // qualcuno si dimentica di aggiornarlo e gli slot di Pasqua tornano prenotabili in silenzio.
    expect(festivita('2040-01-01')).toBe('Capodanno');
    expect(festivitaDellAnno(2040).size).toBe(12);
  });
});
