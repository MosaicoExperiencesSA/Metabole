import { attivoInCorso, eInCoda, staErogando } from './abbonamento-in-corso';
import { codaInRitardo, eInCodaPerStato } from './stati-abbonamento';
import { filtroClienteConPianoAttivo } from '../common/piano-attivo';

/**
 * ALL'UNA DI NOTTE DEL GIORNO IN CUI IL PIANO PARTE, IL PIANO È PARTITO.
 *
 * Il difetto (20/8): «che giorno è oggi» era `setHours(0, 0, 0, 0)` — il fuso del **processo**, che
 * su Render è UTC. Fra mezzanotte e le 02:00 in Italia il server risponde ancora «ieri». Una
 * cliente che apre l'app all'una di notte del giorno in cui il percorso comincia si sentiva dire
 * che un piano attivo non ce n'è: `staErogando` falso, `eInCoda` vero, e le schermate dello staff
 * la contavano fra quelle **senza piano**.
 *
 * ⚠️ La stessa riga era scritta in **quattro** punti di questo sottosistema — due in
 * `stati-abbonamento.ts`, una in `abbonamento-in-corso.ts`, una in `piano-attivo.ts` — e tutte e
 * quattro rispondevano UTC.
 *
 * ⚠️ **Quello che NON è cambiato, ed è una scelta**: il giorno di una data **salvata** si continua a
 * leggere in UTC. `Subscription.startDate` è un `DateTime`, non una colonna DATE: in banca dati ci
 * sono istanti veri. Rileggerli in un altro fuso sposterebbe di un giorno i piani già venduti che
 * cadono fra le 22:00 e le 24:00 UTC — una fine piano che si muove da sola su un contratto pagato.
 * Quanti siano si misura (`npm run diag:giorno-piani`), poi si decide.
 */
describe('la mezzanotte di un piano è quella di Roma', () => {
  /** Le 00:30 del 19 agosto a Roma: per Greenwich sono ancora le 22:30 del 18. */
  const UNA_DI_NOTTE = new Date('2026-08-19T00:30:00+02:00');
  /** Il piano comincia il 19: come lo scrive `toDateOnly`, mezzanotte UTC. */
  const INIZIO_19 = new Date('2026-08-19T00:00:00.000Z');
  const FINE_19 = new Date('2026-08-19T00:00:00.000Z');

  it('l’istante di prova è quello giusto', () => {
    expect(UNA_DI_NOTTE.toISOString()).toBe('2026-08-18T22:30:00.000Z');
  });

  it('sta erogando: è il suo primo giorno, e in Italia è cominciato', () => {
    expect(staErogando({ status: 'active', startDate: INIZIO_19, endDate: null }, UNA_DI_NOTTE)).toBe(true);
  });

  it('e quindi NON è in coda', () => {
    expect(eInCoda({ status: 'active', startDate: INIZIO_19, endDate: null }, UNA_DI_NOTTE)).toBe(false);
    expect(eInCodaPerStato({ status: 'active', startDate: INIZIO_19 }, UNA_DI_NOTTE)).toBe(false);
  });

  it('una coda `queued` che parte oggi risulta IN RITARDO: il giro di promozione non è passato', () => {
    // È il caso che dice al motore «questo doveva già partire»: senza, resta fermo e nessuno lo sa.
    expect(codaInRitardo({ status: 'queued', startDate: INIZIO_19 }, UNA_DI_NOTTE)).toBe(true);
  });

  it('l’ultimo giorno è un giorno di piano fino a mezzanotte di Roma', () => {
    expect(staErogando({ status: 'active', startDate: null, endDate: FINE_19 }, UNA_DI_NOTTE)).toBe(true);
  });

  it('`attivoInCorso` sceglie quello che eroga, non quello in coda', () => {
    /**
     * ⚠️ Due righe, e non una: con una sola questo test passava anche col difetto dentro, perché
     * l'ultimo ripiego di `attivoInCorso` («non eroga nessuno, ma è l'unica riga che c'è») la
     * restituiva comunque. Era verde per la ragione sbagliata — trovato con una mutazione che non
     * mordeva.
     */
    const oggi = { status: 'active', startDate: INIZIO_19, endDate: new Date('2026-11-19T00:00:00.000Z') };
    const settembre = { status: 'queued', startDate: new Date('2026-09-15T00:00:00.000Z'), endDate: new Date('2026-12-15T00:00:00.000Z') };
    const scelto = attivoInCorso([settembre, oggi], UNA_DI_NOTTE);
    expect(scelto).toBe(oggi);
  });

  it('anche il filtro «ha un piano attivo» usa la mezzanotte di Roma', () => {
    /**
     * ⚠️ Questo è il filtro che decide chi ENTRA nel motore e nelle code del nutrizionista. Il suo
     * `endDate >= oggi` con «oggi» in UTC, all'una di notte del 19, chiedeva `>= 18`: teneva dentro
     * per due ore una cliente il cui piano è finito il 18. Ora chiede `>= 19`.
     */
    const f = filtroClienteConPianoAttivo(UNA_DI_NOTTE) as {
      subscriptions: { some: { OR: { endDate?: { gte?: Date } | null }[] } };
    };
    const gte = f.subscriptions.some.OR.find((r) => r.endDate && 'gte' in r.endDate)?.endDate?.gte as Date;
    expect(gte.toISOString()).toBe('2026-08-19T00:00:00.000Z');
  });

  it('⚠️ il modo vecchio diceva il contrario, e non dipende dal fuso di chi lancia il test', () => {
    // `setHours(0,0,0,0)` su un processo a UTC è esattamente `Date.UTC(getUTC…)`: scritto così, il
    // confronto vale ovunque si lancino i test, anche su un Mac italiano.
    const giornoUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    expect(giornoUtc(INIZIO_19) > giornoUtc(UNA_DI_NOTTE)).toBe(true); // → «in coda», cioè il difetto
  });

  it('di giorno non cambia niente (il difetto viveva solo nelle due ore dopo mezzanotte)', () => {
    const POMERIGGIO = new Date('2026-08-19T15:00:00+02:00');
    expect(staErogando({ status: 'active', startDate: INIZIO_19, endDate: null }, POMERIGGIO)).toBe(true);
    const IERI = new Date('2026-08-18T15:00:00+02:00');
    expect(staErogando({ status: 'active', startDate: INIZIO_19, endDate: null }, IERI)).toBe(false);
  });
});
