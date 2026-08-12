/**
 * «Promuovi a regola» porta la scelta di UNA cliente dentro i gruppi di equivalenza, che valgono
 * per TUTTE. I modi in cui può fare danno sono tre, e sono questi i test: allargare un gruppo già
 * approvato (cambierebbe i menu di tutte stanotte), creare il decimo doppione dello stesso gruppo,
 * e rispondere «sì» a un gruppo che contiene «peperoni» quando l'alimento è «pepe».
 */
import { decidiPromozione, nomeGruppoDaSostituzione, type GruppoCandidato } from './promuovi-a-regola';

const gruppo = (id: string, status: string, items: string[]): GruppoCandidato => ({
  id,
  name: `gruppo ${id}`,
  status,
  productId: null,
  items,
});

describe('promuovi a regola', () => {
  it('niente di simile in giro: crea un gruppo nuovo', () => {
    const esito = decidiPromozione('pane', 'gallette di riso', []);
    expect(esito).toEqual({ azione: 'crea', items: ['pane', 'gallette di riso'] });
  });

  it('un gruppo APPROVATO che li contiene già: non si crea niente e lo si dice', () => {
    const esito = decidiPromozione('pane', 'gallette di riso', [
      gruppo('g1', 'approved', ['pane', 'gallette di riso', 'crackers']),
    ]);
    expect(esito).toEqual({ azione: 'gia_regola', gruppoId: 'g1', nomeGruppo: 'gruppo g1' });
  });

  it('⚠️ un gruppo APPROVATO che ne contiene solo UNO non si tocca: si crea una bozza', () => {
    // Allargare un gruppo approvato vuol dire cambiare i menu di TUTTE le clienti a partire dalla
    // notte stessa, per una richiesta fatta da una — e senza che nessuno l'abbia approvato.
    const esito = decidiPromozione('pane', 'gallette di riso', [gruppo('g1', 'approved', ['pane', 'crackers'])]);
    expect(esito.azione).toBe('crea');
  });

  it('una BOZZA che ne contiene uno: si aggiunge il mancante, invece di fare il doppione', () => {
    // Senza questo, dieci promozioni sullo stesso alimento fanno dieci gruppi da due voci.
    const esito = decidiPromozione('pane', 'gallette di riso', [gruppo('g2', 'draft', ['pane', 'crackers'])]);
    expect(esito).toEqual({
      azione: 'aggiungi',
      gruppoId: 'g2',
      nomeGruppo: 'gruppo g2',
      daAggiungere: ['gallette di riso'],
    });
  });

  it('una BOZZA che li contiene già tutti e due: si collega e non si aggiunge niente', () => {
    const esito = decidiPromozione('pane', 'gallette di riso', [gruppo('g2', 'draft', ['pane', 'gallette di riso'])]);
    expect(esito).toEqual({ azione: 'aggiungi', gruppoId: 'g2', nomeGruppo: 'gruppo g2', daAggiungere: [] });
  });

  it('l\'approvato vince sulla bozza: se il motore lo sa già, non si apre altro lavoro', () => {
    const esito = decidiPromozione('pane', 'gallette di riso', [
      gruppo('bozza', 'draft', ['pane']),
      gruppo('approvato', 'approved', ['pane', 'gallette di riso']),
    ]);
    expect(esito).toEqual({ azione: 'gia_regola', gruppoId: 'approvato', nomeGruppo: 'gruppo approvato' });
  });

  it('⚠️ il confronto è per parola: un gruppo con «peperoni» non risponde per «pepe»', () => {
    const esito = decidiPromozione('pepe', 'paprika dolce', [gruppo('g3', 'draft', ['peperoni', 'zucchine'])]);
    expect(esito.azione).toBe('crea');
  });

  it('il plurale non fa un secondo gruppo: «carote» trova la bozza che dice «carota»', () => {
    const esito = decidiPromozione('carote', 'zucchine', [gruppo('g4', 'draft', ['carota'])]);
    expect(esito).toEqual({ azione: 'aggiungi', gruppoId: 'g4', nomeGruppo: 'gruppo g4', daAggiungere: ['zucchine'] });
  });

  describe('il nome del gruppo', () => {
    it('si legge e si capisce da dove viene', () => {
      expect(nomeGruppoDaSostituzione(' pane  ', 'gallette di riso')).toBe('pane ↔ gallette di riso');
    });

    it('non sfora il limite del campo, anche con due nomi lunghissimi', () => {
      const lungo = 'a'.repeat(70);
      expect(nomeGruppoDaSostituzione(lungo, lungo).length).toBeLessThanOrEqual(80);
    });
  });
});
