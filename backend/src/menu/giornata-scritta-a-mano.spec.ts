/**
 * ⛔ **IL MENU SCRITTO A MANO DALLA SCHEDA CLIENTE.**
 *
 * Il 31/8, con una cliente senza menu, sarebbe stata la via d'uscita in cinque minuti. Queste prove
 * tengono ferme le tre cose che lo rendono utile invece che pericoloso: la giornata è completa, un
 * piatto incompatibile si serve solo scrivendo perché, e il giorno scritto a mano è **intoccabile**.
 */
import { controllaGiornata, ORIGINE_A_MANO, pastiDaScrivere, type PastoAMano } from './giornata-scritta-a-mano';
import { scrittaAMano, senzaQuelleAMano } from '../vera/menu-da-rifare';

const CINQUE = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
const p = (slot: string, id: string, kcal: number, over: Partial<PastoAMano> = {}): PastoAMano =>
  ({ slot, recipeId: id, name: `Piatto ${id}`, kcal, ...over });

const GIORNATA = [
  p('breakfast', 'c1', 400), p('morning_snack', 'sm1', 150), p('lunch', 'p1', 700),
  p('afternoon_snack', 'sp1', 150), p('dinner', 'd1', 600),
]; // 2000 kcal

describe('controllaGiornata — quando si può scrivere', () => {
  it('⛔ una giornata completa e dentro banda è pronta', () => {
    const v = controllaGiornata(GIORNATA, CINQUE, 2000);
    expect(v.pronta).toBe(true);
    expect(v.problemi).toEqual([]);
    expect(v.conto.kcal).toBe(2000);
  });

  /** ⛔ Un pasto che manca è kcal in meno alla cliente, e nessuno se ne accorgerebbe. */
  it('⛔ manca un pasto: non si scrive', () => {
    const v = controllaGiornata(GIORNATA.slice(0, 4), CINQUE, 2000);
    expect(v.pronta).toBe(false);
    expect(v.problemi.join(' ')).toContain('dinner');
  });

  /**
   * ⛔ Uno slot che quella dieta non ha darebbe alla cliente **un pasto in più** — è il difetto che
   * `menu-composti-con-un-pasto-in-piu` racconta per il motore, arrivato da un'altra porta.
   */
  it('⛔ uno slot che la sua giornata non ha: non si scrive', () => {
    const v = controllaGiornata([...GIORNATA, p('second_dinner', 'x1', 300)], CINQUE, 2000);
    expect(v.pronta).toBe(false);
    expect(v.problemi.join(' ')).toContain('second_dinner');
  });

  it('⛔ due piatti sullo stesso pasto: uno per pasto', () => {
    const v = controllaGiornata([...GIORNATA, p('lunch', 'p2', 700)], CINQUE, 2000);
    expect(v.pronta).toBe(false);
    expect(v.problemi.join(' ')).toContain('lunch');
  });

  /**
   * ⛔ Lo stesso piatto due volte: per il motore costa un vincolo dentro un prodotto cartesiano
   * (`stesso-piatto-spuntino-e-merenda`), qui costa un `Set`. Non c'è motivo di lasciarlo passare a
   * mano solo perché a macchina è caro.
   */
  it('⛔ lo stesso piatto allo spuntino e alla merenda: non si scrive', () => {
    const doppio = GIORNATA.map((x) => (x.slot === 'afternoon_snack' ? p('afternoon_snack', 'sm1', 150) : x));
    const v = controllaGiornata(doppio, CINQUE, 2000);
    expect(v.pronta).toBe(false);
    expect(v.problemi.join(' ')).toContain('due volte');
  });

  /**
   * ⛔ **Il piatto incompatibile si può servire, ma scrivendo perché.** Il permesso senza il motivo
   * sarebbe un pulsante «ignora»: la schermata direbbe di aver avvisato e nessuno saprebbe mai chi
   * ha deciso, né sulla base di cosa.
   */
  it('⛔ una ricetta bloccata senza motivo ferma la scrittura', () => {
    const conBlocco = GIORNATA.map((x) => (x.slot === 'lunch'
      ? p('lunch', 'p1', 700, { bloccata: true, motivoBlocco: 'incompatibile con "allergia: molluschi"' })
      : x));
    const v = controllaGiornata(conBlocco, CINQUE, 2000);
    expect(v.pronta).toBe(false);
    expect(v.problemi.join(' ')).toContain('scrivi perché');
    expect(v.problemi.join(' ')).toContain('molluschi');
  });

  it('⛔ e col motivo si scrive, ma resta scritto negli avvisi', () => {
    const conBlocco = GIORNATA.map((x) => (x.slot === 'lunch'
      ? p('lunch', 'p1', 700, { bloccata: true, motivoBlocco: 'incompatibile con "allergia: molluschi"', forzatoPerche: 'concordato con la cliente, tolti i frutti di mare' })
      : x));
    const v = controllaGiornata(conBlocco, CINQUE, 2000);
    expect(v.pronta).toBe(true);
    expect(v.avvisi.join(' ')).toContain('molluschi');
  });

  /** ⚠️ Uno spazio non è un motivo. */
  it('⚠️ un motivo fatto di spazi non conta', () => {
    const conBlocco = GIORNATA.map((x) => (x.slot === 'lunch'
      ? p('lunch', 'p1', 700, { bloccata: true, motivoBlocco: 'x', forzatoPerche: '   ' }) : x));
    expect(controllaGiornata(conBlocco, CINQUE, 2000).pronta).toBe(false);
  });

  /**
   * ⚠️ **Le kcal fuori banda AVVISANO, non fermano.** Una nutrizionista può avere una ragione
   * clinica per una giornata più leggera, e bloccarla vorrebbe dire farle scegliere fra il suo
   * giudizio e lo strumento — cioè toglierle la via d'uscita per cui questa schermata esiste.
   */
  it('⚠️ fuori banda si scrive lo stesso, e l\'avviso lo dice', () => {
    const v = controllaGiornata(GIORNATA, CINQUE, 1400); // 2000 su 1400 = +43%
    expect(v.pronta).toBe(true);
    expect(v.avvisi.join(' ')).toContain('sopra');
    expect(v.conto.dentroTolleranza).toBe(false);
  });

  /** ⚠️ E la banda arriva da fuori: quella dei Parametri, non una copia. */
  it('⚠️ con la banda larga lo stesso scostamento non è più un avviso', () => {
    expect(controllaGiornata(GIORNATA, CINQUE, 1750, 25).avvisi.join(' ')).not.toContain('sopra');
    expect(controllaGiornata(GIORNATA, CINQUE, 1750, 5).avvisi.join(' ')).toContain('sopra');
  });

  /** ⛔ «Non lo so» non è «va bene»: senza fabbisogno si scrive, ma detto. */
  it('⛔ senza fabbisogno si può scrivere, e l\'avviso dice che le kcal non si giudicano', () => {
    const v = controllaGiornata(GIORNATA, CINQUE, null);
    expect(v.pronta).toBe(true);
    expect(v.conto.dentroTolleranza).toBeNull();
    expect(v.avvisi.join(' ')).toContain('non è calcolabile');
  });

  it('⚠️ una giornata vuota non è «pronta»', () => {
    expect(controllaGiornata([], CINQUE, 2000).pronta).toBe(false);
  });
});

describe('pastiDaScrivere — la forma che va in MenuDay.meals', () => {
  it('⛔ è quella che scrivono già il motore e Vera, più il marchio', () => {
    const [primo] = pastiDaScrivere([p('breakfast', 'c1', 400)], 'Lucia', new Date('2026-09-03T10:00:00Z'));
    expect(primo).toMatchObject({ slot: 'breakfast', recipeId: 'c1', name: 'Piatto c1', kcal: 400 });
    expect(primo.scrittaAMano).toMatchObject({ origine: ORIGINE_A_MANO, da: 'Lucia' });
  });

  it('⛔ e il motivo della forzatura viaggia col pasto', () => {
    const [primo] = pastiDaScrivere([p('lunch', 'p1', 700, { forzatoPerche: 'concordato' })], 'Lucia');
    expect((primo.scrittaAMano as { forzatoPerche?: string }).forzatoPerche).toBe('concordato');
  });

  /** ⚠️ Senza forzatura il campo non c'è: un campo vuoto sembra una risposta. */
  it('⚠️ senza forzatura il campo non compare', () => {
    const [primo] = pastiDaScrivere([p('lunch', 'p1', 700)], 'Lucia');
    expect(primo.scrittaAMano).not.toHaveProperty('forzatoPerche');
  });
});

describe('l\'intoccabilità: una giornata scritta a mano non si cancella', () => {
  const aMano = pastiDaScrivere(GIORNATA, 'Lucia');
  const delMotore = [{ slot: 'breakfast', recipeId: 'c1', name: 'x', kcal: 400 }];

  it('⛔ la riconosce dal marchio', () => {
    expect(scrittaAMano(aMano)).toBe(true);
    expect(scrittaAMano(delMotore)).toBe(false);
  });

  /**
   * ⚠️ E continua a riconoscere il lavoro fatto in chat: il piatto cambiato d'accordo con la
   * cliente, e la sostituzione concordata lì.
   *
   * ⛔ **`origine: 'app'` NON conta, ed è una correzione.** Quella è la **cliente** che preme
   * «Sostituisci» dentro il suo menu — non chi lavora. Contandola, «Rigenera menu» avrebbe saltato
   * in silenzio ogni giornata futura su cui lei ha premuto quel pulsante una volta, e «Rigenera
   * menu» è lo strumento che tutti gli altri messaggi del progetto indicano come via d'uscita.
   */
  it('⚠️ le vecchie: il cambio piatto e la sostituzione concordata IN CHAT', () => {
    expect(scrittaAMano([{ ...delMotore[0], cambioPiatto: { daRecipeId: 'x' } }])).toBe(true);
    expect(scrittaAMano([{ ...delMotore[0], substitutions: [{ origine: 'chat' }] }])).toBe(true);
    expect(scrittaAMano([{ ...delMotore[0], substitutions: [{ origine: 'app' }] }])).toBe(false);
    expect(scrittaAMano([{ ...delMotore[0], substitutions: [{ from: 'a', to: 'b' }] }])).toBe(false);
  });

  /**
   * ⛔ **Rende due elenchi, non un booleano**: chi cancella deve poter dire quante ne ha
   * risparmiate. Una passata che ne salta tre in silenzio è indistinguibile da una che non ha
   * trovato niente.
   */
  it('⛔ divide quelle da rifare da quelle da tenere, e le conta', () => {
    const r = senzaQuelleAMano([{ id: 'a', meals: aMano }, { id: 'b', meals: delMotore }]);
    expect(r.aMano.map((x) => x.id)).toEqual(['a']);
    expect(r.daRifare.map((x) => x.id)).toEqual(['b']);
  });

  it('⚠️ e su un elenco vuoto non inventa niente', () => {
    expect(senzaQuelleAMano([])).toEqual({ daRifare: [], aMano: [] });
  });
});
