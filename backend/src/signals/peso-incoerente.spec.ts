import { FINESTRA_GIORNI, SALTO_KG_DEFAULT, SALTO_RITMO_DEFAULT, saltiImpossibili, saltoPeggiore, spiegaSalto } from './peso-incoerente';

const g = (giorniFa: number): Date => new Date(Date.UTC(2026, 7, 28) - giorniFa * 86_400_000);
const p = (giorniFa: number, weightKg: number) => ({ date: g(giorniFa), weightKg });

describe('peso incoerente — due pesate che non possono essere della stessa persona', () => {
  it('una storia normale non fa suonare niente', () => {
    const pesate = [p(30, 78), p(23, 77.4), p(16, 77.1), p(9, 76.3), p(2, 75.9)];
    expect(saltiImpossibili(pesate)).toEqual([]);
    expect(saltoPeggiore(pesate)).toBeNull();
  });

  it('trova il salto e lo descrive con tutt\'e due le pesate', () => {
    const salto = saltoPeggiore([p(14, 73), p(7, 113)]);
    expect(salto).not.toBeNull();
    expect(salto!.daKg).toBe(73);
    expect(salto!.aKg).toBe(113);
    expect(salto!.giorni).toBe(7);
    expect(salto!.salto).toBe(40);
    expect(salto!.ritmo).toBe(40);
  });

  /**
   * ⛔ LE DUE CONDIZIONI VANNO IN **E**, e questi due test sono l'unica cosa che lo tiene fermo:
   * con un `||` al posto dell'`&&` passerebbero entrambi i casi qui sotto — cioè il guardrail
   * suonerebbe su un percorso normale (otto chili in due mesi) e su un chilo d'acqua in un giorno.
   */
  it('dieci chili in due mesi sono un percorso riuscito, non un errore', () => {
    expect(saltiImpossibili([p(70, 88), p(10, 78)])).toEqual([]);
  });

  it('un chilo in un giorno non è un errore, anche se sarebbero 7 kg/settimana', () => {
    expect(saltiImpossibili([p(3, 70), p(2, 71)])).toEqual([]);
  });

  /**
   * ⛔ **I CONTROESEMPI CHE HANNO ALZATO LE SOGLIE** (revisione del 28/8: la prima stesura metteva
   * 5 kg / 4 kg-settimana e li bloccava tutti). Sono clienti vere e frequenti, non casi di scuola:
   * un guardrail che suona su di loro è un guardrail che nessuno legge più.
   */
  it.each([
    ['prima settimana di piano su 130 kg (glicogeno e acqua)', 130, 124.5, 7],
    ['post-parto, perdita di liquidi', 78, 71, 9],
    ['avvio di diuretico su edema', 95, 89, 5],
    ['malattia con inappetenza', 92, 82, 14],
    ['rientro da due settimane di vacanza', 70, 78, 14],
  ])('⛔ fisiologia vera, non blocca: %s', (_nome, da, a, giorni) => {
    expect(saltiImpossibili([p(giorni, da), p(0, a)])).toEqual([]);
  });

  /**
   * ⚠️ La banda fra le due soglie: un calo **vero e grave** deve continuare a essere un calo rapido
   * (soglia 1,5 kg/settimana) e non finire zittito qui dentro come «dato sbagliato».
   */
  it('un calo rapido vero — 2,5 kg/settimana — non è un dato impossibile', () => {
    expect(saltiImpossibili([p(21, 82), p(14, 79.5), p(7, 77), p(0, 74.5)])).toEqual([]);
  });

  /**
   * ⛔ **TUTT'E DUE I VERSI, e servono tutt'e due i test.** Con la differenza presa **con segno**
   * invece che in valore assoluto, il caso in discesa smette di suonare — ed è il caso vero: le
   * righe che Simone ha visto in produzione erano 113 → 99,8 e 92,2 → 80.
   *
   * ⚠️ **Misurato, e la prima stesura di questa nota diceva una cosa più grossa del vero.** Mutando
   * `Math.abs` e togliendo il test in discesa: **la suite di QUESTO file resta verde**, ma la suite
   * intera no — cadono quattro test di `signals.service.spec.ts`, la cui fixture è per caso in
   * discesa. ⛔ Non è una ragione per togliere il test: un modulo puro che si affida alla fixture di
   * un altro file per coprire metà del proprio dominio è coperto per fortuna, e la fortuna cambia
   * alla prima riscrittura di quella fixture. È una ragione per non scrivere «resta verde» quando
   * si è provato solo un file.
   */
  it('vale in salita', () => {
    const salto = saltoPeggiore([p(10, 60), p(6, 74)]);
    expect(salto!.salto).toBe(14);
    expect(salto!.daKg).toBe(60);
  });

  it('⛔ e vale in discesa: è il verso in cui è successo davvero', () => {
    const salto = saltoPeggiore([p(10, 113), p(6, 99.8)]);
    expect(salto).not.toBeNull();
    expect(salto!.salto).toBe(13.2);
    expect(salto!.daKg).toBe(113);
    expect(salto!.aKg).toBe(99.8);
  });

  it('le pesate si riordinano da sole: dal database arrivano dalla più recente', () => {
    const desc = [p(7, 113), p(14, 73)];
    const salto = saltoPeggiore(desc);
    expect(salto!.daKg).toBe(73);
    expect(salto!.aKg).toBe(113);
    expect(salto!.dal.getTime()).toBeLessThan(salto!.al.getTime());
  });

  it('due pesi diversi nello stesso giorno contano come un giorno, non come una divisione per zero', () => {
    const salto = saltoPeggiore([p(5, 70), p(5, 84)]);
    expect(salto).not.toBeNull();
    expect(salto!.giorni).toBe(1);
    expect(Number.isFinite(salto!.ritmo)).toBe(true);
  });

  it('le soglie si possono spostare: sono cliniche, non nostre', () => {
    const pesate = [p(10, 70), p(8, 73)];
    expect(saltiImpossibili(pesate)).toEqual([]); // 3 kg: sotto i 10 di default
    expect(saltiImpossibili(pesate, 2, 4)).toHaveLength(1);
    expect(saltiImpossibili(pesate, 2, 99)).toEqual([]); // il ritmo resta una condizione
  });

  /** ⚠️ Il bordo è INCLUSO: esattamente dieci chili a esattamente 7 kg/settimana suona. */
  it('⚠️ il bordo esatto suona', () => {
    expect(saltiImpossibili([p(10, 70), p(0, 80)])).toHaveLength(1); // 10 kg in 10 gg = 7 kg/sett
    expect(saltiImpossibili([p(11, 70), p(0, 80)])).toEqual([]); // 10 kg in 11 gg = 6,36
  });

  it('i valori non numerici non fanno finta di essere pesate', () => {
    const sporche = [p(10, 70), { date: g(8), weightKg: NaN }, p(6, 71)] as never;
    expect(saltiImpossibili(sporche)).toEqual([]);
  });

  it('fra più salti sceglie il più grosso in chili, e a parità il più recente', () => {
    const tre = [p(40, 70), p(38, 82), p(36, 70), p(10, 70), p(5, 100)];
    expect(saltiImpossibili(tre).length).toBeGreaterThan(1);
    expect(saltoPeggiore(tre)!.aKg).toBe(100);

    const pari = [p(40, 70), p(38, 82), p(20, 70), p(18, 82)];
    expect(saltoPeggiore(pari)!.al.getTime()).toBe(g(18).getTime());
  });

  it('la frase nomina le due date e i due valori: chi legge decide senza aprire altro', () => {
    const frase = spiegaSalto(saltoPeggiore([p(14, 73), p(7, 113)])!);
    expect(frase).toContain('73 kg');
    expect(frase).toContain('113 kg');
    // ⚠️ Le date come le legge una persona, non in ISO: la frase la leggono coach e nutrizionista.
    expect(frase).toContain('14/08/2026');
    expect(frase).toContain('21/08/2026');
    expect(frase).toContain('7 giorni');
  });

  it('le costanti sono quelle che il resto del codice si aspetta', () => {
    expect(SALTO_KG_DEFAULT).toBe(10);
    expect(SALTO_RITMO_DEFAULT).toBe(7);
    // ⚠️ La finestra del fabbisogno: se cambia qui, cambia là — e il test lo dice.
    expect(FINESTRA_GIORNI).toBe(90);
  });
});
