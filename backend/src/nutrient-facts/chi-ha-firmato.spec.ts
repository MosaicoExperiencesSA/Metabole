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
  it('⛔ il buco è quello che il registro non spiega', () => {
    expect(spunteSenzaNessuno({ segnateGuardate: 4000, firmeUnaPerUna: 120, confermateInBlocco: 900, confermateDalMotore: 80 }))
      .toEqual({ spiegate: 1100, senzaNessuno: 2900 });
  });

  it('⚠️ se il registro spiega più di quante ne risultano, il buco è zero e non un negativo', () => {
    expect(spunteSenzaNessuno({ segnateGuardate: 100, firmeUnaPerUna: 60, confermateInBlocco: 90, confermateDalMotore: 0 }).senzaNessuno).toBe(0);
  });

  it('⚠️ tutto spiegato: nessuno script di mezzo, ed è la risposta buona', () => {
    expect(spunteSenzaNessuno({ segnateGuardate: 200, firmeUnaPerUna: 200, confermateInBlocco: 0, confermateDalMotore: 0 }))
      .toEqual({ spiegate: 200, senzaNessuno: 0 });
  });
});
