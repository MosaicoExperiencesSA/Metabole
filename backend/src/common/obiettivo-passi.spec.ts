/**
 * L'OBIETTIVO PASSI SU MISURA — domanda di Simone (12/8): «il numero di passi potrebbe essere una
 * variabile bilanciata per cliente?».
 *
 * I test che contano sono due: che a chi si muove meno si chieda **meno** (un obiettivo
 * irraggiungibile non fa camminare, fa chiudere la schermata), e che la crescita **si fermi** — una
 * progressione senza fine finisce sempre nello stesso posto.
 */
import {
  GIORNI_PER_INCREMENTO,
  PASSI_PER_ATTIVITA,
  TETTO_INCREMENTI,
  eCresciuto,
  obiettivoPassi,
} from './obiettivo-passi';

const BASE = 8000;

describe('il punto di partenza', () => {
  it('⚠️ a chi si muove meno si chiede MENO, non di più', () => {
    // Sembra il contrario di quello che serve, ed è voluto: 10.000 passi al primo giorno a chi ne
    // fa 3.000 non la fanno camminare, le fanno chiudere la schermata.
    const sedentaria = obiettivoPassi({ activityLevel: 'sedentary' }, BASE);
    const attiva = obiettivoPassi({ activityLevel: 'active' }, BASE);
    expect(sedentaria).toBeLessThan(attiva);
    expect(sedentaria).toBe(PASSI_PER_ATTIVITA.sedentary);
  });

  it('le cinque fasce del questionario sono tutte coperte', () => {
    for (const fascia of ['sedentary', 'light', 'moderate', 'active', 'very_active']) {
      expect(obiettivoPassi({ activityLevel: fascia }, BASE)).toBe(PASSI_PER_ATTIVITA[fascia]);
    }
  });

  it('⚠️ senza fascia si torna al valore globale, non si inventa', () => {
    // È il caso delle clienti registrate prima che il campo esistesse.
    expect(obiettivoPassi({ activityLevel: null }, BASE)).toBe(BASE);
    expect(obiettivoPassi({}, BASE)).toBe(BASE);
    expect(obiettivoPassi({ activityLevel: 'inventato' }, BASE)).toBe(BASE);
  });
});

describe('la crescita', () => {
  it('il primo giorno è ancora il punto di partenza', () => {
    expect(obiettivoPassi({ activityLevel: 'sedentary', giorniDiPercorso: 0 }, BASE)).toBe(6000);
    expect(obiettivoPassi({ activityLevel: 'sedentary', giorniDiPercorso: 13 }, BASE)).toBe(6000);
  });

  it('sale ogni due settimane, di poco', () => {
    expect(GIORNI_PER_INCREMENTO).toBe(14);
    const dopoDueSettimane = obiettivoPassi({ activityLevel: 'sedentary', giorniDiPercorso: 14 }, BASE);
    expect(dopoDueSettimane).toBeGreaterThan(6000);
    // +5% su 6000 = 6300, arrotondato a 250 → 6250.
    expect(dopoDueSettimane).toBe(6250);
  });

  it('⚠️ e SI FERMA: una progressione senza fine diventa un numero che non si raggiunge mai', () => {
    const aRegime = obiettivoPassi({ activityLevel: 'sedentary', giorniDiPercorso: 14 * TETTO_INCREMENTI }, BASE);
    const dopoUnAnno = obiettivoPassi({ activityLevel: 'sedentary', giorniDiPercorso: 400 }, BASE);
    expect(dopoUnAnno).toBe(aRegime);
    // Il tetto è +40% sulla partenza: da 6.000 si arriva a 8.400, non oltre.
    expect(dopoUnAnno).toBe(8500);
  });

  it('una sedentaria arriva in un paio di mesi dove una moderata comincia', () => {
    // È il senso della progressione: la porta lì, invece di chiederglielo il primo giorno.
    const dopoDueMesi = obiettivoPassi({ activityLevel: 'sedentary', giorniDiPercorso: 60 }, BASE);
    expect(dopoDueMesi).toBeGreaterThanOrEqual(PASSI_PER_ATTIVITA.light);
  });

  it('i giorni negativi o assurdi non fanno danno', () => {
    expect(obiettivoPassi({ activityLevel: 'moderate', giorniDiPercorso: -50 }, BASE)).toBe(8000);
    expect(obiettivoPassi({ activityLevel: 'moderate', giorniDiPercorso: null }, BASE)).toBe(8000);
  });

  it('⚠️ è sempre un numero tondo: 7.437 sembra il risultato di un calcolo, non una meta', () => {
    for (const g of [0, 14, 28, 42, 56, 100, 300]) {
      const v = obiettivoPassi({ activityLevel: 'light', giorniDiPercorso: g }, BASE);
      expect(v % 250).toBe(0);
    }
  });
});

describe('eCresciuto — serve a dire alla cliente PERCHÉ il numero è cambiato', () => {
  it('falso finché è al punto di partenza', () => {
    expect(eCresciuto({ activityLevel: 'sedentary', giorniDiPercorso: 3 }, BASE)).toBe(false);
  });

  it('vero appena sale', () => {
    // Un obiettivo che sale da solo, senza una riga che lo spieghi, si legge come un guasto.
    expect(eCresciuto({ activityLevel: 'sedentary', giorniDiPercorso: 14 }, BASE)).toBe(true);
  });
});
