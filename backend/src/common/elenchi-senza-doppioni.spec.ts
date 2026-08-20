/**
 * I QUATTRO ELENCHI SCRITTI A MANO — nessuno può avere doppioni.
 *
 * Ognuno di questi finisce in una `create` su una colonna unica o su una chiave composta, dietro
 * una `Set` che dice «questo c'è già». Quella `Set` è costruita **prima** del giro: vede la banca
 * dati, non l'elenco. Due voci uguali nell'elenco passano tutte e due.
 *
 * ⚠️ Il 20/8 è successo davvero, sui fogli degli alimenti: due elenchi con una ventina di nomi in
 * comune, la mappa che non si aggiornava, e il nome nudo che finiva a prendersi il valore da cotto.
 * Questi test sono la stessa domanda fatta agli altri tre elenchi, prima che tocchi a loro.
 *
 * Se uno di questi test diventa rosso: hai incollato una riga due volte. Il messaggio dice quale.
 */
import { doppioni } from './elenchi-senza-doppioni';
import { BACKOFFICE_PAGES } from '../permissions/pages';
import { VOCI_INIZIALI } from '../lavori/voci-iniziali';
import { VIGNETTE_CATALOG } from '../social/vignette-catalog.data';

describe('doppioni()', () => {
  it('un elenco pulito non dà niente', () => {
    expect(doppioni(['a', 'b', 'c'], (x) => x)).toEqual([]);
  });
  it('dice quale chiave e quante volte', () => {
    expect(doppioni(['a', 'b', 'a', 'a'], (x) => x)).toEqual([{ chiave: 'a', volte: 3 }]);
  });
  it('la chiave la sceglie il chiamante, non la voce intera', () => {
    expect(doppioni([{ k: 'x', t: 1 }, { k: 'x', t: 2 }], (v) => v.k)).toEqual([{ chiave: 'x', volte: 2 }]);
  });
});

describe('gli elenchi veri', () => {
  it('BACKOFFICE_PAGES — finisce in rolePagePermission, chiave [role, pageKey]', () => {
    expect(doppioni(BACKOFFICE_PAGES, (p) => p)).toEqual([]);
  });

  it('VOCI_INIZIALI — finisce in lavoro.create, `chiave` è @unique', () => {
    expect(doppioni(VOCI_INIZIALI, (v) => v.chiave)).toEqual([]);
  });

  it('VIGNETTE_CATALOG — finisce in socialPost.create per collectionId', () => {
    expect(doppioni(VIGNETTE_CATALOG, (v) => v.collectionId)).toEqual([]);
  });
});
