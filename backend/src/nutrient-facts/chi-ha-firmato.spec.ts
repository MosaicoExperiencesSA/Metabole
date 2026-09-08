/**
 * ⛔ **LE PROVE DEL GIUDIZIO SULLE FIRME** — 8/9.
 *
 * Questo modulo non tocca niente: risponde a una domanda. Ma è la domanda da cui dipende se un
 * giorno si scriverà uno script che toglie un tag allergene a decine di ricette — quindi ogni caso
 * in cui sbaglia è un allergene tolto per sbaglio, o lasciato per sbaglio.
 *
 * ⚠️ **Il caso che conta di più è quello al confine**: firma e tag nello stesso minuto. Lì il
 * verdetto deve stare dalla parte di chi ha l'allergia, e la prova lo fissa.
 */
import { chiHaFirmato, PAROLE_DEL_VERDETTO, spunteSenzaNessuno, type FirmeDiUnaRicetta, type Verdetto } from './chi-ha-firmato';

const IL_TAG = new Date('2026-09-05T02:00:00Z');
const d = (iso: string) => new Date(iso);

const caso = (p: Partial<FirmeDiUnaRicetta> = {}): FirmeDiUnaRicetta => ({
  recipeId: 'r1',
  ricetta: 'Pasta fresca sorgo soffiato',
  taggata: IL_TAG,
  firmePropria: [],
  bloccoCerto: [],
  bloccoDopoIlTag: false,
  reviewed: true,
  ...p,
});

describe('chiHaFirmato — chi ha guardato quel tag, e quando', () => {
  it('⛔ firma sua DOPO il tag: quel tag l’ha visto, non si tocca', () => {
    const e = chiHaFirmato(caso({ firmePropria: [d('2026-09-06T10:00:00Z')] }));
    expect(e.verdetto).toBe<Verdetto>('firmata_dopo_il_tag');
    expect(e.quando).toEqual(d('2026-09-06T10:00:00Z'));
  });

  it('⛔ firma sua PRIMA del tag: la firma sta sotto una lista che è cambiata', () => {
    const e = chiHaFirmato(caso({ firmePropria: [d('2026-08-01T10:00:00Z')] }));
    expect(e.verdetto).toBe<Verdetto>('firmata_prima_del_tag');
    expect(e.quando).toEqual(d('2026-08-01T10:00:00Z'));
  });

  it('⛔ due firme, una prima e una dopo: vince quella dopo — il tag è stato visto', () => {
    const e = chiHaFirmato(caso({ firmePropria: [d('2026-08-01T10:00:00Z'), d('2026-09-07T09:00:00Z')] }));
    expect(e.verdetto).toBe<Verdetto>('firmata_dopo_il_tag');
  });

  it('⛔ più firme tutte prima: si riporta l’ULTIMA, che è quella da guardare', () => {
    const e = chiHaFirmato(caso({ firmePropria: [d('2026-06-01T10:00:00Z'), d('2026-08-20T10:00:00Z')] }));
    expect(e.verdetto).toBe<Verdetto>('firmata_prima_del_tag');
    expect(e.quando).toEqual(d('2026-08-20T10:00:00Z'));
  });

  /**
   * ⛔ **IL CONFINE.** Stesso istante vuol dire che la firma non può aver visto il tag: la
   * propagazione scrive la riga di registro **dopo** aver scritto la ricetta, quindi «uguale» è al
   * massimo «nello stesso secondo», e su un allergene il pari non lo vince chi vuole togliere.
   */
  it('⛔ firma e tag nello stesso istante: NON conta come firmata dopo', () => {
    expect(chiHaFirmato(caso({ firmePropria: [IL_TAG] })).verdetto).toBe<Verdetto>('firmata_prima_del_tag');
  });

  it('⛔ blocco di cui è capofila, dopo il tag: si sa che c’era dentro, vale come firma', () => {
    const e = chiHaFirmato(caso({ bloccoCerto: [d('2026-09-06T10:00:00Z')] }));
    expect(e.verdetto).toBe<Verdetto>('firmata_dopo_il_tag');
  });

  it('⚠️ nessuna firma sua, ma un blocco è passato dopo: «non si sa», non «si può togliere»', () => {
    expect(chiHaFirmato(caso({ bloccoDopoIlTag: true })).verdetto).toBe<Verdetto>('forse_in_un_blocco');
  });

  it('⛔ segnata guardata e nel registro non c’è nessuno: la spunta è di uno script', () => {
    expect(chiHaFirmato(caso()).verdetto).toBe<Verdetto>('nessuna_firma_nel_registro');
  });

  it('⚠️ non segnata guardata: il tag è restato per un altro motivo, e si dice quale non è', () => {
    expect(chiHaFirmato(caso({ reviewed: false, firmePropria: [d('2026-09-09T10:00:00Z')] })).verdetto)
      .toBe<Verdetto>('non_e_segnata_guardata');
  });

  it('⚠️ ogni verdetto ha le sue parole: un conto senza parole non lo legge nessuno', () => {
    const verdetti: Verdetto[] = [
      'firmata_dopo_il_tag', 'firmata_prima_del_tag', 'forse_in_un_blocco',
      'nessuna_firma_nel_registro', 'non_e_segnata_guardata',
    ];
    for (const v of verdetti) expect(PAROLE_DEL_VERDETTO[v].length).toBeGreaterThan(30);
    expect(Object.keys(PAROLE_DEL_VERDETTO).sort()).toEqual([...verdetti].sort());
  });
});

describe('spunteSenzaNessuno — quante conferme non ha messo nessuno', () => {
  /**
   * ⛔ **QUESTA È LA PROVA CHE MANCAVA L'8/9**, ed è il caso che è successo davvero su Render: la
   * prima stesura sommava i tre numeri, il totale sfondava il catalogo di dieci volte, la
   * sottrazione andava sotto zero e il pavimento la riportava a zero — che veniva letto come «tutto
   * a posto». ⚠️ Adesso i numeri veri del 8/9 devono dare la risposta vera.
   */
  it('⛔ i numeri VERI di Render: 23695 guardate, 10 firmate, 9316 dai blocchi', () => {
    // `conTracciaPropria` è già l'unione DISTINTA: 10 firme + le ricette delle 2151 diete riviste.
    expect(spunteSenzaNessuno({ segnateGuardate: 23695, conTracciaPropria: 12000, dichiarateDaiBlocchi: 9316 }))
      .toEqual({ conTracciaPropria: 12000, forseDaiBlocchi: 9316, senzaNessuno: 2379 });
  });

  it('⛔ e i blocchi NON si sommano alle tracce: coprono al massimo quello che resta scoperto', () => {
    const e = spunteSenzaNessuno({ segnateGuardate: 1000, conTracciaPropria: 900, dichiarateDaiBlocchi: 5000 });
    expect(e.forseDaiBlocchi).toBe(100);
    expect(e.senzaNessuno).toBe(0);
  });

  it('⛔ nessun blocco: quello che non ha traccia propria non lo ha messo nessuno', () => {
    expect(spunteSenzaNessuno({ segnateGuardate: 23695, conTracciaPropria: 10, dichiarateDaiBlocchi: 0 }))
      .toEqual({ conTracciaPropria: 10, forseDaiBlocchi: 0, senzaNessuno: 23685 });
  });

  it('⚠️ tutte con traccia propria: niente da attribuire ai blocchi, e il buco è zero per davvero', () => {
    expect(spunteSenzaNessuno({ segnateGuardate: 200, conTracciaPropria: 200, dichiarateDaiBlocchi: 50 }))
      .toEqual({ conTracciaPropria: 200, forseDaiBlocchi: 0, senzaNessuno: 0 });
  });

  /**
   * ⚠️ Le tracce distinte possono superare le segnate guardate: una ricetta può stare in una dieta
   * rivista **e** aver perso la spunta dopo (gli ingredienti cambiati la fanno decadere). Il numero
   * non deve sfondare e non deve mangiarsi il buco.
   */
  it('⚠️ più tracce che spunte: il conto si ferma, non va in negativo', () => {
    expect(spunteSenzaNessuno({ segnateGuardate: 100, conTracciaPropria: 400, dichiarateDaiBlocchi: 0 }))
      .toEqual({ conTracciaPropria: 100, forseDaiBlocchi: 0, senzaNessuno: 0 });
  });
});
