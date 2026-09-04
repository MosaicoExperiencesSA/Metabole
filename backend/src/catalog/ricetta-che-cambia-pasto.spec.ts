/**
 * ⛔ **«SE SPOSTO UNA RICETTA DA COLAZIONE A CENA E SALVO NON LA SPOSTA»** — Simone, 4/9.
 *
 * `Recipe.mealSlot` e `PaniereRicetta.slot` sono due colonne diverse e `updateRecipe` scriveva solo
 * la prima: la scheda diceva «cena» e il motore continuava a servire il piatto a colazione. Nessun
 * errore, e chi aveva salvato aveva davanti la prova che il salvataggio era andato.
 */
import { cosaFareDelleRighe, perchePerNonSiPuoSpostare, raccontaSpostamento } from './ricetta-che-cambia-pasto';

const r = (id: string, paniereId: string, slot: string) => ({ id, paniereId, slot });

describe('le righe di paniere seguono il pasto della ricetta', () => {
  it('⛔ da colazione a cena: le righe si spostano', () => {
    const e = cosaFareDelleRighe([r('a', 'p1', 'breakfast'), r('b', 'p2', 'breakfast')], 'dinner');
    expect(e.daSpostare).toEqual(['a', 'b']);
    expect(e.daTogliere).toEqual([]);
  });

  it('quelle già al posto giusto non si toccano, e si contano', () => {
    const e = cosaFareDelleRighe([r('a', 'p1', 'dinner'), r('b', 'p2', 'breakfast')], 'dinner');
    expect(e.daSpostare).toEqual(['b']);
    expect(e.giaAPosto).toBe(1);
  });

  /**
   * ⚠️ **Spuntino e merenda sono un paniere solo** (Fase 2): una ricetta che passa da «spuntino» a
   * «merenda» non si sposta, perché la cella è la stessa. Muoverla vorrebbe dire scrivere una riga
   * che il resto del progetto legge come la stessa di prima.
   */
  it('⚠️ da spuntino a merenda non si sposta niente: è la stessa cella', () => {
    const e = cosaFareDelleRighe([r('a', 'p1', 'morning_snack')], 'afternoon_snack');
    expect(e.daSpostare).toEqual([]);
    expect(e.giaAPosto).toBe(1);
  });

  /**
   * ⛔ **L'unicità è `(paniere, ricetta, slot)`.** Se nello stesso paniere una riga sta già alla
   * destinazione, la seconda non ci si può spostare: si toglie. Senza questo controllo lo
   * spostamento fallirebbe a metà — alcune righe mosse, altre no — e nessuno saprebbe quali.
   */
  it('⛔ due righe dello stesso paniere non si accavallano: la seconda si toglie', () => {
    const e = cosaFareDelleRighe([r('a', 'p1', 'dinner'), r('b', 'p1', 'breakfast')], 'dinner');
    expect(e.daSpostare).toEqual([]);
    expect(e.daTogliere).toEqual(['b']);
  });

  it('⛔ e nemmeno due righe che arrivano dallo stesso paniere da due pasti diversi', () => {
    const e = cosaFareDelleRighe([r('a', 'p1', 'breakfast'), r('b', 'p1', 'lunch')], 'dinner');
    expect(e.daSpostare).toEqual(['a']);
    expect(e.daTogliere).toEqual(['b']);
  });

  /**
   * ⛔ **QUI NON SI CANCELLA PER PUNIZIONE, e questa prova è la cicatrice.**
   *
   * La prima stesura del 4/9 aveva un parametro «vietato»: se il piatto in quel pasto non ci poteva
   * stare, **toglieva tutte le righe**. Una revisione avversariale l'ha smontata prima della
   * consegna — una tendina premuta per sbaglio su una ricetta in dodici panieri ne cancellava dodici
   * righe, e rimettere «cena» non le riportava indietro.
   *
   * ⚠️ Adesso quel caso non arriva qui: lo rifiuta `updateRecipe`. Da questa funzione può uscire
   * **solo** uno spostamento, o la rimozione di un doppione che esiste già alla destinazione.
   */
  it('⛔ non esiste un esito in cui si tolgono righe che non sono doppioni', () => {
    const e = cosaFareDelleRighe([r('a', 'p1', 'dinner'), r('b', 'p2', 'lunch')], 'breakfast');
    expect(e.daSpostare).toEqual(['a', 'b']);
    expect(e.daTogliere).toEqual([]);
  });

  it('una ricetta che non sta in nessun paniere non fa niente', () => {
    expect(cosaFareDelleRighe([], 'dinner')).toEqual({ daSpostare: [], daTogliere: [], giaAPosto: 0 });
  });
});

describe('la frase per chi ha salvato', () => {
  /** ⚠️ Un avviso che dice «spostate 0 righe» insegna a non leggere gli avvisi. */
  it('⚠️ tace quando non è successo niente', () => {
    expect(raccontaSpostamento('Porridge', 'cena', { daSpostare: [], daTogliere: [], giaAPosto: 3 })).toBeNull();
  });

  it('dice quante righe si sono spostate', () => {
    const t = raccontaSpostamento('Porridge', 'cena', { daSpostare: ['a', 'b'], daTogliere: [], giaAPosto: 0 });
    expect(t).toContain('2 panieri');
    expect(t).toContain('cena');
  });

  /**
   * ⛔ **E il RIFIUTO dice come si fa** ad ottenere quello che si voleva: un divieto senza una via
   * d'uscita si aggira, e si aggira male.
   */
  it('⛔ il rifiuto dice il motivo e la strada', () => {
    const t = perchePerNonSiPuoSpostare('Branzino al vapore', 'colazione', 'è pesce.');
    expect(t).toContain('non si può spostare a colazione');
    expect(t).toContain('non è stato cambiato');
    expect(t).toContain('togli prima la carne o il pesce');
  });

  /** ⚠️ Niente asterischi: queste frasi finiscono in un banner che non disegna il markdown. */
  it('⚠️ e nessuna di queste frasi scrive markdown', () => {
    const frasi = [
      raccontaSpostamento('X', 'cena', { daSpostare: ['a'], daTogliere: ['b'], giaAPosto: 0 }) ?? '',
      perchePerNonSiPuoSpostare('X', 'colazione', 'è pesce.'),
    ];
    for (const f of frasi) expect(f).not.toContain('**');
  });

  it('⚠️ il doppione tolto dice il suo motivo', () => {
    const t = raccontaSpostamento('Porridge', 'cena', { daSpostare: [], daTogliere: ['a'], giaAPosto: 0 });
    expect(t).toContain('c\'era già a quel pasto');
  });
});
