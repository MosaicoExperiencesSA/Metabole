import { describe, it, expect } from 'vitest';
import { etaDellElenco, quandoInParole, ORE_PRIMA_DI_INSOSPETTIRSI } from './elenco-di-quando';

/**
 * DI QUANDO È L'ELENCO DEGLI ALIMENTI DA CORREGGERE.
 *
 * Il fatto da cui nasce: 21/8, l'una di notte. 277 alimenti caricati alle 19:43, e la pagina che
 * mostrava ancora `limone` fra i mancanti. *«Stiamo perdendo pezzi invece di farli?»* No: il passo
 * notturno non era ancora passato. Bastava che l'elenco dicesse di quando era.
 */
describe('etaDellElenco', () => {
  const adesso = new Date(2026, 7, 25, 13, 0);

  it('dice il giorno e l\'ora in cui il passo è girato', () => {
    const e = etaDellElenco(new Date(2026, 7, 25, 3, 12).toISOString(), adesso);
    expect(e).toEqual({ stato: 'fresco', quando: 'oggi alle 03:12' });
  });

  /**
   * ⚠️ **«ieri alle 03:12», non «34 ore fa».** Chi guarda sta confrontando con l'ora in cui ha
   * caricato il suo file: un tempo relativo lo obbliga a fare la sottrazione a mente proprio mentre
   * cerca di capire se ha perso dei dati.
   */
  it('ieri è «ieri», anche se sono meno di 24 ore', () => {
    expect(quandoInParole(new Date(2026, 7, 24, 23, 50), adesso)).toBe('ieri alle 23:50');
    expect(quandoInParole(new Date(2026, 7, 23, 3, 5), adesso)).toBe('il 23/08 alle 03:05');
  });

  /**
   * ⛔ **IL CUORE DELLA VOCE.** `null` non è «adesso»: è «non è mai girato». Sono i due stati che
   * il 21/8 sembravano uguali — e sembrare uguali è costato mezz'ora di sospetto su un import
   * perfettamente riuscito.
   */
  it('⛔ senza riga di registro dice «mai», non una data finta', () => {
    expect(etaDellElenco(null, adesso)).toEqual({ stato: 'mai' });
    expect(etaDellElenco(undefined, adesso)).toEqual({ stato: 'mai' });
  });

  /**
   * ⛔ **E una data che non si legge NON è «mai girato»** — corretto dopo la revisione avversariale
   * del 25/8. «Il lavoro non è stato fatto» e «il lavoro è stato fatto e non riusciamo a dire
   * quando» sono due cose diverse, ed è la differenza che tutta questa funzione esiste per tenere.
   */
  it('⛔ una data illeggibile ha uno stato suo, non «mai»', () => {
    expect(etaDellElenco('non-una-data', adesso)).toEqual({ stato: 'illeggibile' });
  });

  /**
   * ⚠️ Ventiquattr'ore sono la vita normale di un elenco notturno, non un guasto: la soglia sta più
   * in là apposta. Un avviso che compare ogni pomeriggio non lo legge più nessuno.
   */
  it('a venticinque ore è ancora normale, a ventisette no', () => {
    const ore = (n: number) => new Date(adesso.getTime() - n * 3_600_000).toISOString();
    expect(etaDellElenco(ore(25), adesso).stato).toBe('fresco');
    expect(etaDellElenco(ore(ORE_PRIMA_DI_INSOSPETTIRSI), adesso).stato).toBe('fresco');
    const vecchio = etaDellElenco(ore(27), adesso);
    expect(vecchio.stato).toBe('vecchio');
    expect(vecchio).toMatchObject({ ore: 27 });
  });

  /**
   * ⚠️ Server e browser non hanno lo stesso orologio. Se la data esce nel futuro, il conto delle ore
   * diventa negativo e ogni confronto con la soglia direbbe «fresco»: un orologio storto
   * nasconderebbe un elenco fermo da giorni. Si guarda la distanza, non il segno.
   */
  it('⚠️ una data nel futuro non passa per fresca, e nemmeno per vecchia', () => {
    const fraTreGiorni = new Date(adesso.getTime() + 3 * 86_400_000).toISOString();
    /**
     * ⛔ Trattarla come «vecchia» faceva stampare «sono passate più di 72 ore» sotto una data di
     * **dopodomani**: una frase che si contraddice da sola nella stessa riga.
     */
    expect(etaDellElenco(fraTreGiorni, adesso)).toEqual({ stato: 'orologio', quando: 'il 28/08 alle 13:00' });
  });

  /** ⚠️ Ma qualche secondo di scarto fra i due orologi non è un orologio storto: è la rete. */
  it('⚠️ tre secondi avanti restano «fresco»: non si grida per lo scarto fra due orologi', () => {
    expect(etaDellElenco(new Date(adesso.getTime() + 3000).toISOString(), adesso).stato).toBe('fresco');
  });
});
