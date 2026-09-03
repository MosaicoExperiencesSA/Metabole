/**
 * ⛔ **LE FAMIGLIE CHE CHIUDONO NON SI SCRIVONO PIÙ** — Simone, 3/9, guardando la pagina
 * «Descrizioni diete»: *«qui dovrei poter modificare le descrizioni che poi le clienti leggono
 * sull'app, ma ci sono le vecchie diete»*.
 *
 * Nove famiglie su diciannove stanno confluendo altrove (`FAMIGLIE_CHE_SPARISCONO` nel backend): le
 * loro clienti si spostano, e quei testi non li leggerà più nessuno. Erano in cima all'elenco, e i
 * loro buchi contavano nel numero «famiglie incomplete» — che così non sarebbe mai tornato a zero.
 * ⚠️ *Un avviso che compare sempre non è un avviso*: è la stessa ragione per cui le varianti
 * archiviate non si contano.
 */
import { describe, expect, it } from 'vitest';
import { FAMIGLIE_IN_CHIUSURA_NOTE, contiDelleFamiglie, raggruppaFamiglie, type DietRow } from './famiglieDiete';

const riga = (name: string, over: Partial<DietRow> = {}): DietRow => ({
  id: `${name}-${over.mealsPerDay ?? 5}`, name, style: 'mediterranean', regime: 'omnivore',
  mealsPerDay: 5, status: 'approved', ...over,
});

describe('le famiglie in chiusura, nella tabella delle descrizioni', () => {
  it('una famiglia viva non è in chiusura', () => {
    const f = raggruppaFamiglie([riga('Mediterranea')]);
    expect(f[0].inChiusura).toBe(false);
  });

  it('⛔ una famiglia che confluisce altrove è marcata', () => {
    const f = raggruppaFamiglie([riga('Mediterranea senza glutine')]);
    expect(f[0].inChiusura).toBe(true);
  });

  /**
   * ⛔ **L'elenco vero arriva dal backend**, dove la lista è una sola. Quello scritto qui è il
   * ripiego per quando `GET /catalog/taxonomy` non risponde.
   */
  it('⛔ l\'elenco passato da fuori vince sul ripiego', () => {
    const f = raggruppaFamiglie([riga('Mediterranea'), riga('Pescetariana')], new Set(['Mediterranea']));
    expect(f.find((x) => x.nome === 'Mediterranea')?.inChiusura).toBe(true);
    // ⚠️ E quella del ripiego NON è più in chiusura: comanda l'elenco di fuori, non l'unione dei due.
    expect(f.find((x) => x.nome === 'Pescetariana')?.inChiusura).toBe(false);
  });

  it('⚠️ senza elenco da fuori si usa il ripiego, e conosce le nove di oggi', () => {
    expect(FAMIGLIE_IN_CHIUSURA_NOTE).toHaveLength(9);
    for (const nome of FAMIGLIE_IN_CHIUSURA_NOTE) {
      expect(raggruppaFamiglie([riga(nome)])[0].inChiusura).toBe(true);
    }
  });

  /**
   * ⚠️ **Il ripiego non è la lista canonica**, e le due possono divergere: se una famiglia si chiude
   * e questo file non lo sa, ricompare in elenco — un errore per **eccesso**, che si vede. L'errore
   * opposto (nascondere una famiglia viva) sarebbe invisibile, e non può capitare perché queste
   * nove sono già chiuse.
   */
  it('⚠️ e il ripiego non contiene nessuna delle famiglie vive di oggi', () => {
    for (const viva of ['Mediterranea', 'Keto (non terapeutica)', 'Low carb', 'Flessibile', 'Proteica']) {
      expect(FAMIGLIE_IN_CHIUSURA_NOTE).not.toContain(viva);
    }
  });
});

/**
 * ⛔ **I NUMERI IN CIMA NON CONTANO LE FAMIGLIE CHE CHIUDONO.**
 *
 * Contandole, «famiglie incomplete» non tornerebbe mai a zero e il filtro «solo quelle incomplete»
 * non si svuoterebbe mai: l'unico modo di spegnere l'avviso sarebbe scrivere testi su famiglie che
 * nessuna cliente leggerà. Un avviso che compare sempre non è un avviso.
 */
describe('i conti in cima alla pagina', () => {
  const viva = riga('Mediterranea', { clientDescription: 'un testo' });
  const vivaScoperta = riga('Low carb');
  const chiusaScoperta = riga('Pescetariana');

  it('⛔ le famiglie in chiusura restano fuori da TUTTI i numeri', () => {
    const c = contiDelleFamiglie(raggruppaFamiglie([viva, vivaScoperta, chiusaScoperta]));
    expect(c.vive.map((f) => f.nome).sort()).toEqual(['Low carb', 'Mediterranea']);
    expect(c.inChiusura).toBe(1);
    expect(c.varianti).toBe(2);
    expect(c.coperte).toBe(1);
    // ⛔ La riga rossa: senza il filtro sarebbe 2, e non tornerebbe mai a zero.
    expect(c.scoperte).toBe(1);
  });

  it('⚠️ e quando le famiglie vive sono tutte compilate, «incomplete» va a zero', () => {
    const c = contiDelleFamiglie(raggruppaFamiglie([viva, chiusaScoperta]));
    expect(c.scoperte).toBe(0);
    expect(c.inChiusura).toBe(1);
  });

  it('nessuna famiglia: zero dappertutto, non un errore', () => {
    expect(contiDelleFamiglie([])).toMatchObject({ inChiusura: 0, varianti: 0, coperte: 0, scoperte: 0 });
  });
});

