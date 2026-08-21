/**
 * IL SEED NON CANCELLA QUELLO CHE NON HA — 20/8 sera.
 *
 * `seedValoriNutrizionali` costruiva l'oggetto da scrivere con un blocco di `?? null` e `?? []`.
 * ⚠️ Su una riga **non ancora confermata** il seed la riscrive tutta, e quel `?? null` non vuol dire
 * «non ho questo campo»: vuol dire **«azzeralo»**.
 *
 * Il 20/8 l'import degli alimenti aveva creato «burro» con stato `crudo`; al primo deploy — il seed
 * gira dentro `preDeployCommand` — lo stato era `NULL` e i sinonimi di «noci» spariti, perché quelle
 * due righe del seed non hanno né stato né sinonimi. Undici alimenti comuni usati in oltre 3.000
 * ricette sono finiti «senza stato» in `npm run diag:crudo-cotto`.
 *
 * ⛔ **E non c'entrava la firma.** Per un paio d'ore ho creduto che il difetto fosse che il seed
 * firma righe che non ha guardato nessuno, e l'avevo scritto in una voce dell'elenco Lavori. Non è
 * vero: le righe di `VALORI` stanno dentro `firmateDalCapo`, e il commento sopra dice perché il
 * confine è là. La firma è legittima. Avevo letto la riga della firma e non le quaranta sopra.
 *
 * La regola vera: **un seed è una fonte, non una fotografia dello stato finale.** Se non porta un
 * dato, quel dato resta com'era; se lo porta, vince lui.
 */
import { datiDellaRiga, VALORI } from '../../prisma/seed-valori-nutrizionali';

describe('quello che il seed non ha, non lo scrive', () => {
  it('⛔ una riga senza stato non porta la chiave `state`: altrimenti azzererebbe quello che c\'è', () => {
    const dati = datiDellaRiga({ name: 'burro', category: 'grassi', kcal: 758 } as never);
    expect('state' in dati).toBe(false);
  });

  it('⛔ e una riga senza sinonimi non porta `synonyms`', () => {
    const dati = datiDellaRiga({ name: 'noci', category: 'grassi', kcal: 702 } as never);
    expect('synonyms' in dati).toBe(false);
  });

  it('⚠️ lo stesso per l\'indice glicemico, che arriva da `importa:ig` e non da qui', () => {
    const dati = datiDellaRiga({ name: 'burro', category: 'grassi', kcal: 758 } as never);
    for (const c of ['glycemicIndex', 'glycemicIndexMin', 'glycemicIndexMax', 'glycemicIndexReliability']) {
      expect(c in dati).toBe(false);
    }
  });

  it('✅ ma quello che il seed HA, lo scrive: se porta un dato, vince lui', () => {
    const dati = datiDellaRiga({ name: 'carote', synonyms: ['carota'], category: 'verdura', state: 'bollite', kcal: 35, gi: 35 } as never);
    expect(dati.state).toBe('bollite');
    expect(dati.synonyms).toEqual(['carota']);
    expect(dati.kcal).toBe(35);
    expect(dati.glycemicIndex).toBe(35);
  });

  it('⚠️ uno zero è un dato, non un campo mancante', () => {
    const dati = datiDellaRiga({ name: 'sale', category: 'altro', kcal: 0, protein: 0, fiber: 0 } as never);
    expect(dati.kcal).toBe(0);
    expect(dati.protein).toBe(0);
    expect(dati.fiber).toBe(0);
  });

  it('la categoria c\'è sempre: è l\'unico campo che ogni riga del seed dichiara', () => {
    expect(datiDellaRiga({ name: 'x', category: 'frutta' } as never).category).toBe('frutta');
  });
});

describe('le righe vere del seed', () => {
  /**
   * ⚠️ Questo test dice quante righe del seed **non** portano lo stato: prima erano tutte quelle che
   * azzeravano il campo su una riga non confermata. Non è un numero da tenere fermo per sé — è lì
   * per far vedere che il caso non è raro, e quindi che la regola serve.
   */
  it('la maggior parte delle righe non dichiara uno stato, ed è il motivo per cui la regola serve', () => {
    const senzaStato = VALORI.filter((r) => r.state === undefined);
    expect(senzaStato.length).toBeGreaterThan(VALORI.length / 2);
    for (const r of senzaStato) expect('state' in datiDellaRiga(r)).toBe(false);
  });

  it('e quelle che lo dichiarano lo scrivono', () => {
    for (const r of VALORI.filter((x) => x.state !== undefined)) {
      expect(datiDellaRiga(r).state).toBe(r.state);
    }
  });
});
