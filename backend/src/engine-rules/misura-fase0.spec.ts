import type { CoperturaVariante } from './copertura-catalogo';
import { misuraVariante, primaQuelleConClienti, verdettoFase0 } from './misura-fase0';

const cop = (perSlot: Record<string, { piatti: number; attivi: number; rotti: number }>): CoperturaVariante => ({
  dietId: 'd', giorni: 84, ultimoGiorno: 84, settimane: 12, giorniSettimana: 84, perSlot,
});

const PIENA = {
  breakfast: { piatti: 84, attivi: 84, rotti: 0 },
  morning_snack: { piatti: 84, attivi: 84, rotti: 0 },
  lunch: { piatti: 84, attivi: 84, rotti: 0 },
  afternoon_snack: { piatti: 84, attivi: 84, rotti: 0 },
  dinner: { piatti: 84, attivi: 84, rotti: 0 },
};

describe('la misura della Fase 0: si procede o no', () => {
  describe('il minimo per pasto', () => {
    it('è il pasto messo peggio, e si dice quale', () => {
      const m = misuraVariante({ id: 'd', mealsPerDay: 5 }, cop({ ...PIENA, lunch: { piatti: 40, attivi: 12, rotti: 0 } }), 0, 60);
      expect(m.minimoAttivi).toBe(12);
      expect(m.pastoPeggiore).toBe('lunch');
      expect(m.sottoSoglia).toBe(true);
    });

    /**
     * ⛔ Il difetto che questa prova esiste per fermare: contare i pasti che la struttura NON
     * prevede farebbe risultare sotto soglia una dieta a tre pasti per uno spuntino che non ha —
     * e il tabulato direbbe che il catalogo è messo peggio di com'è.
     */
    it('⛔ non conta i pasti che quella struttura non prevede', () => {
      const tre = misuraVariante({ id: 'd', mealsPerDay: 3 }, cop({
        breakfast: { piatti: 84, attivi: 84, rotti: 0 },
        lunch: { piatti: 84, attivi: 84, rotti: 0 },
        dinner: { piatti: 84, attivi: 84, rotti: 0 },
        morning_snack: { piatti: 0, attivi: 0, rotti: 0 },
        afternoon_snack: { piatti: 0, attivi: 0, rotti: 0 },
      }), 0, 60);
      expect(tre.attesi).not.toContain('morning_snack');
      expect(tre.minimoAttivi).toBe(84);
      expect(tre.sottoSoglia).toBe(false);
    });

    it('⚠️ si guardano gli ATTIVI, non i piatti nominati', () => {
      // 84 nominati e 3 attivi è sotto soglia: «84» è il massimo, non l'utile (§2.4 del piano).
      const m = misuraVariante({ id: 'd', mealsPerDay: 5 }, cop({ ...PIENA, dinner: { piatti: 84, attivi: 3, rotti: 0 } }), 0, 60);
      expect(m.minimoAttivi).toBe(3);
    });

    /**
     * ⚠️ Il bordo, che la prima stesura non fissava (mutazione M38, sopravvissuta): il piano dice
     * «attivi ≥ 60», quindi 60 esatti **si procede** e 59 no. Un `<=` al posto di `<` metterebbe
     * sotto soglia tutte le celle esattamente a 60 — e su un catalogo riempito a target sono tante.
     */
    it('⛔ esattamente alla soglia NON è sotto soglia: il piano dice «≥», non «>»', () => {
      const a60 = misuraVariante({ id: 'd', mealsPerDay: 5 }, cop({ ...PIENA, lunch: { piatti: 60, attivi: 60, rotti: 0 } }), 0, 60);
      expect(a60.sottoSoglia).toBe(false);
      const a59 = misuraVariante({ id: 'd', mealsPerDay: 5 }, cop({ ...PIENA, lunch: { piatti: 59, attivi: 59, rotti: 0 } }), 0, 60);
      expect(a59.sottoSoglia).toBe(true);
    });

    it('una variante senza nessuna copertura è sotto soglia, non «a posto»', () => {
      const m = misuraVariante({ id: 'd', mealsPerDay: 5 }, undefined, 0, 60);
      expect(m.minimoAttivi).toBe(0);
      expect(m.sottoSoglia).toBe(true);
      expect(m.stato).toBe('vuota');
    });
  });

  describe('il verdetto', () => {
    const diete = [
      { id: 'piena', mealsPerDay: 5 },
      { id: 'magra-sola', mealsPerDay: 5 },
      { id: 'magra-con-clienti', mealsPerDay: 5 },
    ];
    const copertura = new Map([
      ['piena', cop(PIENA)],
      ['magra-sola', cop({ ...PIENA, lunch: { piatti: 12, attivi: 12, rotti: 0 } })],
      ['magra-con-clienti', cop({ ...PIENA, dinner: { piatti: 20, attivi: 20, rotti: 2 } })],
    ]);
    const clienti = new Map([['magra-con-clienti', 4]]);

    it('⛔ una sola cella sotto soglia basta a NON procedere', () => {
      const { verdetto } = verdettoFase0(diete, copertura, clienti, 60);
      expect(verdetto.siProcede).toBe(false);
      expect(verdetto.sotto).toHaveLength(2);
    });

    it('⚠️ e distingue il numero che conta per i tempi: quelle con clienti sopra', () => {
      // Il piano dice che le magre SENZA clienti spariscono da sole chiudendo le famiglie doppione.
      const { verdetto } = verdettoFase0(diete, copertura, clienti, 60);
      expect(verdetto.sottoConClienti).toBe(1);
      expect(verdetto.conClienti).toBe(1);
    });

    it('con tutte le celle piene si procede', () => {
      const { verdetto } = verdettoFase0([{ id: 'piena', mealsPerDay: 5 }], copertura, new Map(), 60);
      expect(verdetto.siProcede).toBe(true);
      expect(verdetto.sotto).toEqual([]);
    });

    it('⛔ «nominati ma non attivi» è la differenza fra le due porte, e si conta', () => {
      const { verdetto } = verdettoFase0(
        [{ id: 'x', mealsPerDay: 5 }],
        new Map([['x', cop({ ...PIENA, lunch: { piatti: 84, attivi: 30, rotti: 0 } })]]),
        new Map(), 60,
      );
      expect(verdetto.piattiTot).toBe(84 * 5);
      expect(verdetto.attiviTot).toBe(84 * 4 + 30);
      expect(verdetto.nominatiNonAttivi).toBe(54);
    });

    /**
     * ⛔ Mutazione M-C della revisione, sopravvissuta alla prima stesura: `rotti += p.rotti` scritto
     * `rotti = p.rotti`. Passava perché nel fixture i rotti stavano tutti sull'ULTIMO pasto
     * iterato. Servono rotti su due pasti diversi, e uno che non sia l'ultimo.
     */
    it('⛔ i rotti si SOMMANO fra i pasti, e non conta solo l\'ultimo', () => {
      const { misure } = verdettoFase0(
        [{ id: 'x', mealsPerDay: 5 }],
        new Map([['x', cop({
          ...PIENA,
          breakfast: { piatti: 84, attivi: 84, rotti: 3 },
          lunch: { piatti: 84, attivi: 84, rotti: 5 },
        })]]),
        new Map(), 60,
      );
      expect(misure[0].rotti).toBe(8);
    });

    it('i rotti si sommano su tutte le varianti', () => {
      const { verdetto } = verdettoFase0(diete, copertura, clienti, 60);
      expect(verdetto.rottiTot).toBe(2);
    });

    /**
     * ⛔ Mutazione M-A, la peggiore delle tre sopravvissute: `siProcede` calcolato solo sulle
     * varianti con clienti sopra. Ribalta la semantica dell'unica cosa che questo modulo esiste per
     * produrre, e nessuna delle tredici prove se ne accorgeva.
     */
    it('⛔ `siProcede` guarda TUTTE le celle, non solo quelle con clienti sopra', () => {
      const soloMagraSenzaClienti = verdettoFase0(
        [{ id: 'magra-sola', mealsPerDay: 5 }], copertura, new Map(), 60,
      ).verdetto;
      expect(soloMagraSenzaClienti.siProcede).toBe(false);
      // …e l'altra metà della domanda dice l'opposto, che è il suo mestiere.
      expect(soloMagraSenzaClienti.siProcedeSulleVive).toBe(true);
    });

    it('⛔ e i ROTTI da soli bastano a non procedere, anche con tutti i pasti pieni', () => {
      const { verdetto } = verdettoFase0(
        [{ id: 'x', mealsPerDay: 5 }],
        new Map([['x', cop({ ...PIENA, dinner: { piatti: 84, attivi: 84, rotti: 30 } })]]),
        new Map(), 60,
      );
      expect(verdetto.sotto).toEqual([]);
      expect(verdetto.siProcede).toBe(false);
    });

    it('⚠️ una variante con clienti e con rotti fa fallire anche il verdetto sulle vive', () => {
      const { verdetto } = verdettoFase0(
        [{ id: 'x', mealsPerDay: 5 }],
        new Map([['x', cop({ ...PIENA, dinner: { piatti: 84, attivi: 84, rotti: 1 } })]]),
        new Map([['x', 2]]), 60,
      );
      expect(verdetto.siProcedeSulleVive).toBe(false);
    });

    it('e lo stato di ogni variante si conta per stato', () => {
      const { verdetto } = verdettoFase0(diete, copertura, clienti, 60);
      expect([...verdetto.perStato.values()].reduce((a, b) => a + b, 0)).toBe(3);
    });

    it('un catalogo vuoto non dice «si procede» per finta… anzi sì, e va saputo', () => {
      // ⚠️ Zero varianti = zero celle sotto soglia. È vero e inutile: chi legge il verdetto deve
      // vedere anche `varianti`, ed è per questo che il numero si stampa accanto.
      const { verdetto } = verdettoFase0([], new Map(), new Map(), 60);
      expect(verdetto.siProcede).toBe(true);
      expect(verdetto.varianti).toBe(0);
    });
  });

  /**
   * ⛔ Mutazione M-B, sopravvissuta: passare a `statoCopertura` tutti e cinque i pasti invece di
   * quelli attesi. È esattamente il difetto che il ⛔ in cima al modulo dichiara di prevenire, e
   * nessuna prova guardava il campo `stato` fuori dal caso «vuota».
   */
  describe('lo stato si giudica sui pasti ATTESI', () => {
    it('⛔ una dieta a tre pasti piena non risulta «magra» per lo spuntino che non ha', () => {
      const m = misuraVariante({ id: 'd', mealsPerDay: 3 }, cop({
        breakfast: { piatti: 84, attivi: 84, rotti: 0 },
        lunch: { piatti: 84, attivi: 84, rotti: 0 },
        dinner: { piatti: 84, attivi: 84, rotti: 0 },
        morning_snack: { piatti: 0, attivi: 0, rotti: 0 },
        afternoon_snack: { piatti: 0, attivi: 0, rotti: 0 },
      }), 0, 60);
      expect(m.stato).toBe('completa');
    });

    it('e col digiuno i pasti attesi sono quelli del digiuno', () => {
      const m = misuraVariante({ id: 'd', mealsPerDay: 5, fasting: true }, cop(PIENA), 0, 60);
      expect(m.attesi).not.toContain('breakfast');
      expect(m.stato).toBe('completa');
    });
  });

  describe('guardando una settimana sola', () => {
    it('l\'atteso diventa sette, non 7 × le settimane', () => {
      // ⚠️ Il ramo `SETTIMANA=N` non era provato affatto: qui una settimana con 7 piatti per pasto
      // è completa, mentre sul totale del catalogo le stesse cifre sarebbero magre.
      const unaSettimana = {
        breakfast: { piatti: 7, attivi: 7, rotti: 0 },
        morning_snack: { piatti: 7, attivi: 7, rotti: 0 },
        lunch: { piatti: 7, attivi: 7, rotti: 0 },
        afternoon_snack: { piatti: 7, attivi: 7, rotti: 0 },
        dinner: { piatti: 7, attivi: 7, rotti: 0 },
      };
      const c: CoperturaVariante = { dietId: 'd', giorni: 84, ultimoGiorno: 84, settimane: 12, giorniSettimana: 7, perSlot: unaSettimana };
      expect(misuraVariante({ id: 'd', mealsPerDay: 5 }, c, 0, 60, 3).stato).toBe('completa');
      expect(misuraVariante({ id: 'd', mealsPerDay: 5 }, c, 0, 60).stato).toBe('magra');
    });

    it('e una settimana mai generata è «vuota», non «magra»', () => {
      const c: CoperturaVariante = { dietId: 'd', giorni: 84, ultimoGiorno: 84, settimane: 12, giorniSettimana: 0, perSlot: {} };
      expect(misuraVariante({ id: 'd', mealsPerDay: 5 }, c, 0, 60, 3).stato).toBe('vuota');
    });
  });

  it('l\'ordine mette davanti chi ha clienti sopra, poi chi sta peggio', () => {
    const m = (clienti: number, minimoAttivi: number) => ({ clienti, minimoAttivi } as never);
    expect([m(0, 1), m(3, 50), m(0, 5)].sort(primaQuelleConClienti)).toEqual([m(3, 50), m(0, 1), m(0, 5)]);
  });
});
