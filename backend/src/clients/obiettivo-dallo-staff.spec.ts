import { testoNotaObiettivo, valutaObiettivoDalloStaff } from './obiettivo-dallo-staff';

/**
 * ⛔ **L'OBIETTIVO CAMBIATO DALLO STAFF — il giudizio** (Simone, 15/9). Le prove del modulo puro:
 * cosa si rifiuta, cosa si chiede di confermare, cosa si scrive e cosa si dice.
 */
const base = {
  oggi: '2026-09-15',
  sogliaSostenibile: 0.7,
  sogliaAmbiziosa: 1.0,
};

describe('⛔ valutaObiettivoDalloStaff', () => {
  it('⛔ una data che non è AAAA-MM-GG si rifiuta', () => {
    // ⛔ '2026-02-30' e '2026-09-31' passano la forma ma non esistono: JavaScript li farebbe scivolare.
    for (const d of ['', '15/10/2026', '2026-9-1', '2026-13-45x', '2026-13-01', '2027-02-30', '2026-09-31']) {
      const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 65, targetDate: d }, pesoPerIlRitmo: 70 });
      expect(r.esito).toBe('rifiuta');
    }
  });

  it('⛔ oggi e ieri si rifiutano, domani passa: il confine è stretto', () => {
    const ieri = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 69.9, targetDate: '2026-09-14' }, pesoPerIlRitmo: 70 });
    const oggi = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 69.9, targetDate: '2026-09-15' }, pesoPerIlRitmo: 70 });
    const domani = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 69.9, targetDate: '2026-09-16' }, pesoPerIlRitmo: 70 });
    expect(ieri.esito).toBe('rifiuta');
    expect(oggi.esito).toBe('rifiuta');
    expect(oggi.esito === 'rifiuta' && oggi.messaggio).toContain('15/09/2026');
    expect(domani.esito).toBe('scrivi');
  });

  it('⛔ un peso che non è un numero positivo si rifiuta', () => {
    for (const p of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: p, targetDate: '2026-12-01' }, pesoPerIlRitmo: 70 });
      expect(r.esito).toBe('rifiuta');
    }
  });

  it('✅ ritmo sostenibile: si scrive senza avvisi, e il ritmo esce coi numeri giusti', () => {
    // 70 → 65 in 70 giorni = 10 settimane = 0,5 kg/settimana
    const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 65, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70 });
    expect(r).toEqual({
      esito: 'scrivi',
      ritmo: { pace: 'sustainable', kgDaPerdere: 5, settimane: 10, kgASettimana: 0.5 },
      avvisi: [],
    });
  });

  it('⚠️ ritmo ambizioso: si scrive, e lo si dice', () => {
    // 70 → 62 in 10 settimane = 0,8
    const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 62, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70 });
    expect(r.esito).toBe('scrivi');
    if (r.esito !== 'scrivi') return;
    expect(r.ritmo?.pace).toBe('ambitious');
    expect(r.avvisi.join(' ')).toContain('0,80 kg a settimana');
  });

  it('⛔ ritmo irreale SENZA conferma: si chiede, non si scrive', () => {
    // 70 → 55 in 10 settimane = 1,5
    const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 55, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70 });
    expect(r.esito).toBe('da_confermare');
    if (r.esito !== 'da_confermare') return;
    expect(r.ritmo).toEqual({ pace: 'unreal', kgDaPerdere: 15, settimane: 10, kgASettimana: 1.5 });
    expect(r.messaggio).toContain('1,50 kg a settimana');
    expect(r.messaggio).toContain('22 settimane'); // ceil(15 / 0,7)
    expect(r.messaggio).toContain('conferma');
  });

  it('⛔ ritmo irreale CON conferma: si scrive, e l\'avviso resta', () => {
    const r = valutaObiettivoDalloStaff({
      ...base, richiesta: { targetWeightKg: 55, targetDate: '2026-11-24', conferma: true }, pesoPerIlRitmo: 70,
    });
    expect(r.esito).toBe('scrivi');
    if (r.esito !== 'scrivi') return;
    expect(r.ritmo?.pace).toBe('unreal');
    expect(r.avvisi.join(' ')).toContain('confermato');
  });

  it('⛔ il confine dell\'irreale è la soglia ambiziosa, letta dal parametro e non scritta qui', () => {
    // 70 → 60 in 10 settimane = 1,0 esatto: ancora ambizioso con soglia 1,0 …
    const alLimite = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 60, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70 });
    expect(alLimite.esito).toBe('scrivi');
    // … ma irreale se la soglia configurata è più bassa.
    const piuStretta = valutaObiettivoDalloStaff({
      ...base, sogliaAmbiziosa: 0.9, richiesta: { targetWeightKg: 60, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70,
    });
    expect(piuStretta.esito).toBe('da_confermare');
  });

  it('⚠️ senza un peso di adesso si scrive, ma senza ritmo — e lo si dice', () => {
    const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 40, targetDate: '2026-09-20' }, pesoPerIlRitmo: null });
    expect(r.esito).toBe('scrivi');
    if (r.esito !== 'scrivi') return;
    expect(r.ritmo).toBeNull();
    expect(r.avvisi.join(' ')).toContain('nessun peso registrato');
  });

  it('⚠️ un obiettivo non sotto il peso di adesso: nessun ritmo, deficit di default, e lo si dice', () => {
    for (const p of [70, 72]) {
      const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: p, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70 });
      expect(r.esito).toBe('scrivi');
      if (r.esito !== 'scrivi') return;
      expect(r.ritmo).toBeNull();
      expect(r.avvisi.join(' ')).toContain('deficit di default');
    }
  });

  it('⚠️ a una settimana o meno il motore non ricava un ritmo: si dice (7 giorni sì, 8 no)', () => {
    // 7 giorni di calendario = meno di 7 giorni veri, perché «adesso» è già dopo la mezzanotte.
    const sette = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 69.8, targetDate: '2026-09-22' }, pesoPerIlRitmo: 70 });
    const otto = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 69.8, targetDate: '2026-09-23' }, pesoPerIlRitmo: 70 });
    expect(sette.esito === 'scrivi' && sette.avvisi.join(' ')).toContain('una settimana o meno');
    expect(otto.esito === 'scrivi' && otto.avvisi.join(' ')).not.toContain('una settimana o meno');
  });

  it('⚠️ una data già passata che NON è stata toccata non ferma il salvataggio (si cambia solo la vita)', () => {
    const invariata = valutaObiettivoDalloStaff({
      ...base, dataDiPrima: '2026-09-01', richiesta: { targetWeightKg: 65, targetDate: '2026-09-01' }, pesoPerIlRitmo: 70,
    });
    expect(invariata.esito).toBe('scrivi');
    if (invariata.esito !== 'scrivi') return;
    expect(invariata.ritmo).toBeNull();
    expect(invariata.avvisi.join(' ')).toContain('già passata');
    // … ma una data passata SCRITTA adesso si rifiuta, anche se ce n'era un'altra.
    const scritta = valutaObiettivoDalloStaff({
      ...base, dataDiPrima: '2026-09-01', richiesta: { targetWeightKg: 65, targetDate: '2026-09-02' }, pesoPerIlRitmo: 70,
    });
    expect(scritta.esito).toBe('rifiuta');
  });

  it('⛔ deficit a mano o mantenimento: si dice, e il ritmo irreale si conferma LO STESSO', () => {
    const r = valutaObiettivoDalloStaff({
      ...base, deficitImposto: true, inMantenimento: true,
      richiesta: { targetWeightKg: 55, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70,
    });
    expect(r.esito).toBe('da_confermare');
    if (r.esito !== 'da_confermare') return;
    expect(r.messaggio).toContain('scritto a mano il nutrizionista');
    expect(r.messaggio).toContain('mantenimento');
    const sost = valutaObiettivoDalloStaff({
      ...base, deficitImposto: true, richiesta: { targetWeightKg: 65, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70,
    });
    expect(sost.esito === 'scrivi' && sost.avvisi).toEqual([expect.stringContaining('scritto a mano')]);
  });

  it('⚠️ un ritmo misurato su una pesata e non sulla tendenza si dice', () => {
    const r = valutaObiettivoDalloStaff({
      ...base, pesoDaUnaPesata: true, richiesta: { targetWeightKg: 65, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70,
    });
    expect(r.esito === 'scrivi' && r.avvisi.join(' ')).toContain('non partono dalla tendenza');
  });

  it('⚠️ i ritmi si dicono con due decimali: 1,04 non è «1,0, oltre la soglia di 1,0»', () => {
    // 70 → 59,6 in 10 settimane = 1,04
    const r = valutaObiettivoDalloStaff({ ...base, richiesta: { targetWeightKg: 59.6, targetDate: '2026-11-24' }, pesoPerIlRitmo: 70 });
    expect(r.esito === 'da_confermare' && r.messaggio).toContain('1,04 kg a settimana, oltre la soglia di 1,00');
  });
});

describe('testoNotaObiettivo', () => {
  it('dice chi, quando, da cosa a cosa, le calorie e il motivo', () => {
    const t = testoNotaObiettivo({
      // ⚠️ Un istante dall'app alle 22:30 UTC del 30/9 è il 1/10 a Roma, come lo mostra la scheda.
      prima: { targetWeightKg: 55, targetDate: new Date('2026-09-30T22:30:00.000Z') },
      dopo: { targetWeightKg: 62.5, targetDate: '2026-12-31' },
      targetPrima: 1200,
      targetDopo: 1450,
      chi: 'Simone',
      // 22:30 UTC del 15 = già il 16 a Roma: la data della nota è quella di Roma.
      quando: new Date('2026-09-15T22:30:00.000Z'),
      motivo: 'ritmo irreale',
    });
    expect(t).toBe(
      'Obiettivo cambiato da Simone il 16/09/2026: da 55,0 kg entro il 01/10/2026 a 62,5 kg entro il 31/12/2026. ' +
        'Calorie: da 1200 a 1450 kcal/giorno. Motivo: ritmo irreale',
    );
  });

  it('senza obiettivo di prima e con calorie invariate non inventa niente', () => {
    const t = testoNotaObiettivo({
      prima: null,
      dopo: { targetWeightKg: 60, targetDate: '2026-12-31' },
      targetPrima: 1300,
      targetDopo: 1300,
      chi: 'staff',
      quando: new Date('2026-09-15T08:00:00.000Z'),
      motivo: 'impostato a mano',
    });
    expect(t).toContain('da nessuno a 60,0 kg');
    expect(t).not.toContain('Calorie');
  });
});
