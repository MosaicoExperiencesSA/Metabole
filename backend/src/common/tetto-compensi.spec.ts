/**
 * Il tetto di guadagno (§16.8) è una funzione di tre numeri, e i modi in cui può fare danno sono
 * tutti casi limite: il campo svuotato letto come «tetto zero», il tetto abbassato a mese
 * iniziato, lo storno che deve liberare spazio. Sono questi i test.
 */
import { CATEGORIE_COMPENSO, quotaSottoTetto, tettoAttivoCents } from './tetto-compensi';

describe('tetto di guadagno mensile', () => {
  describe('quando NON c\'è un tetto', () => {
    it('null significa nessun tetto', () => {
      expect(tettoAttivoCents(null)).toBeNull();
      expect(tettoAttivoCents(undefined)).toBeNull();
    });

    it('⚠️ ZERO significa nessun tetto, non «tetto a zero»', () => {
      // È il caso che azzererebbe lo stipendio di qualcuno in silenzio: un campo numerico
      // svuotato in un form arriva come 0, e nessuno imposta un tetto vero a zero di proposito.
      expect(tettoAttivoCents(0)).toBeNull();
      const esito = quotaSottoTetto({ tettoCents: 0, giaMaturatoCents: 500_00, dovutoCents: 25_00 });
      expect(esito.erogabileCents).toBe(25_00);
      expect(esito.tagliatoCents).toBe(0);
    });

    it('un valore negativo o non finito è trattato come nessun tetto, non come un vincolo', () => {
      expect(tettoAttivoCents(-1)).toBeNull();
      expect(tettoAttivoCents(Number.NaN)).toBeNull();
      expect(tettoAttivoCents(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it('senza tetto passa tutto, e «raggiunto» resta falso', () => {
      const esito = quotaSottoTetto({ tettoCents: null, giaMaturatoCents: 9_999_00, dovutoCents: 100_00 });
      expect(esito).toEqual({ erogabileCents: 100_00, tagliatoCents: 0, raggiunto: false });
    });
  });

  describe('quando il tetto c\'è', () => {
    it('sotto il tetto non taglia niente', () => {
      const esito = quotaSottoTetto({ tettoCents: 3_000_00, giaMaturatoCents: 1_000_00, dovutoCents: 250_00 });
      expect(esito).toEqual({ erogabileCents: 250_00, tagliatoCents: 0, raggiunto: false });
    });

    it('a cavallo del tetto paga la parte che ci sta e PERDE il resto', () => {
      // Decisione di prodotto: l'eccedenza si perde, non si accantona.
      const esito = quotaSottoTetto({ tettoCents: 3_000_00, giaMaturatoCents: 2_900_00, dovutoCents: 250_00 });
      expect(esito.erogabileCents).toBe(100_00);
      expect(esito.tagliatoCents).toBe(150_00);
      expect(esito.raggiunto).toBe(true);
    });

    it('esattamente al tetto: la quota successiva è tutta persa', () => {
      const esito = quotaSottoTetto({ tettoCents: 3_000_00, giaMaturatoCents: 3_000_00, dovutoCents: 40_00 });
      expect(esito).toEqual({ erogabileCents: 0, tagliatoCents: 40_00, raggiunto: true });
    });

    it('già OLTRE il tetto (tetto abbassato a mese iniziato) non genera credito', () => {
      // Il residuo qui è negativo: letto alla lettera diventerebbe «ti devo indietro dei soldi».
      const esito = quotaSottoTetto({ tettoCents: 1_000_00, giaMaturatoCents: 2_500_00, dovutoCents: 40_00 });
      expect(esito).toEqual({ erogabileCents: 0, tagliatoCents: 40_00, raggiunto: true });
    });

    it('lo STORNO libera spazio sotto il tetto', () => {
      // Il maturato si legge sommando il registro, dove lo storno è una riga negativa: chi era al
      // tetto e si vede stornare una vendita torna sotto, e la provvigione dopo gli viene pagata.
      const esito = quotaSottoTetto({ tettoCents: 3_000_00, giaMaturatoCents: 2_850_00, dovutoCents: 250_00 });
      expect(esito.erogabileCents).toBe(150_00);
    });

    it('maturato NEGATIVO (più storni che provvigioni): il tetto resta quello scritto sul profilo', () => {
      const esito = quotaSottoTetto({ tettoCents: 3_000_00, giaMaturatoCents: -200_00, dovutoCents: 100_00 });
      expect(esito.erogabileCents).toBe(100_00);
      expect(esito.tagliatoCents).toBe(0);
    });

    it('un dovuto a zero o negativo non diventa mai un accredito', () => {
      expect(quotaSottoTetto({ tettoCents: 3_000_00, giaMaturatoCents: 0, dovutoCents: 0 }).erogabileCents).toBe(0);
      expect(quotaSottoTetto({ tettoCents: 3_000_00, giaMaturatoCents: 0, dovutoCents: -50_00 }).erogabileCents).toBe(0);
    });

    it('erogabile + tagliato fa sempre il dovuto: non si crea né si perde denaro per arrotondamento', () => {
      for (const [tetto, gia, dovuto] of [
        [3_000_00, 2_999_99, 33_33],
        [1_00, 0, 99],
        [500_00, 499_50, 1_01],
      ]) {
        const e = quotaSottoTetto({ tettoCents: tetto, giaMaturatoCents: gia, dovutoCents: dovuto });
        expect(e.erogabileCents + e.tagliatoCents).toBe(dovuto);
        expect(e.erogabileCents).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('conta le stesse categorie che il portafoglio staff mostra come guadagno', () => {
    // Se le due liste divergono, il tetto taglia su un numero che la persona non vede da nessuna
    // parte. Compreso `visit_compensation`, che non si produce più ma nello storico c'è.
    expect(CATEGORIE_COMPENSO).toEqual(['sales_commission', 'visit_compensation']);
  });
});
