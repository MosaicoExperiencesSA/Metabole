import { capisci } from './capisci';
import { testi } from './vera-chat';

/**
 * ⛔ **«CHIUDI ILARIA»** — il terzo gruppo del vocabolario misurato il 31/8
 * (`vera-vocabolario-quattro-gruppi`). La nutrizionista ha sentito la cliente, la cosa è risolta, e
 * lo scrive a Vera in due parole. ⚠️ Fino al 3/9 la risposta era «**non ci arrivo**» — che è
 * **falso**: la frase si capisce benissimo, ed è la risposta che una persona racconta agli altri.
 *
 * ⛔ **Chiudere davvero non si fa da qui**, e non è pigrizia: una segnalazione chiusa è la traccia
 * che qualcuno ha guardato, e resta scritto **chi** e **perché**. Farla chiudere da una frase di due
 * parole senza un motivo scritto è una decisione di prodotto — sta nella voce dei lavori con la
 * domanda pronta. Fino ad allora si dice cosa si è capito e dove si fa.
 */
describe('⛔ «chiudi <cliente>» si capisce, e la risposta non è «non ci arrivo»', () => {
  it.each([
    ['chiudi ilaria', 'ilaria'],
    ['chiudi Ilaria', 'Ilaria'],
    ['chiudi la segnalazione di ilaria', 'ilaria'],
    ['chiudi la segnalazione di Ilaria Rossi', 'Ilaria Rossi'],
    ['archivia la segnalazione di ilaria', 'ilaria'],
  ])('«%s» → si è capito che si parla di «%s»', (frase, chi) => {
    expect(capisci(frase)).toEqual({ tipo: 'fuori_portata', cosa: 'chiudi_segnalazione', dettaglio: chi });
  });

  /**
   * ⚠️ **Senza un nome si risponde lo stesso, ma senza fingere di saperlo.** «chiudi le
   * segnalazioni» dava `dettaglio: "segnalazioni"`, cioè la risposta avrebbe detto «la segnalazione
   * di segnalazioni è risolta».
   */
  it('⚠️ «chiudi le segnalazioni»: si risponde senza inventare di chi', () => {
    expect(capisci('chiudi le segnalazioni')).toEqual({
      tipo: 'fuori_portata',
      cosa: 'chiudi_segnalazione',
      dettaglio: '',
    });
  });

  /**
   * ⛔ **Il verbo da solo non basta.** «chiudi» compare dove non c'entra niente con la coda, e
   * prendere quelle frasi qui vorrebbe dire rispondere la cosa sbagliata a una richiesta che gli
   * altri riconoscitori sanno leggere.
   */
  it.each([
    ['chiudi la lista dei formaggi molli'],
    ['chiudi tutto'],
    ['chiudi il menu di oggi'],
  ])('⛔ «%s» non è una chiusura di segnalazione', (frase) => {
    const r = capisci(frase);
    expect(r === null || r.tipo !== 'fuori_portata').toBe(true);
  });

  /** ⚠️ E le altre frasi della coda, che si sanno già fare, restano dove stanno. */
  it('⚠️ «hai segnalazioni per me?» resta la lettura della coda', () => {
    expect(capisci('hai segnalazioni per me?')).toEqual({ tipo: 'segnalazioni' });
  });

  /**
   * ⚠️ **Quello che resta fuori, misurato**: «ho sentito ilaria, puoi chiudere» non si legge, perché
   * il nome sta **prima** del verbo e in un'altra proposizione. ⛔ Cercarlo ovunque nella frase
   * vorrebbe dire indovinare di chi si parla su una cosa che si scrive in un registro clinico: si
   * preferisce chiedere. Sta scritto qui invece che scoperto dopo.
   */
  it('⚠️ il nome prima del verbo non si legge ancora', () => {
    expect(capisci('ho sentito ilaria, puoi chiudere')).toBeNull();
  });
});

describe('⛔ la risposta dice cosa si è capito e dove si fa', () => {
  it('col nome, lo ripete: così si vede subito se ha capito la cliente sbagliata', () => {
    expect(testi.chiusuraSegnalazione('Ilaria')).toContain('Ilaria');
  });

  it('⛔ e dice DOVE si chiude, invece di «non ci arrivo»', () => {
    const t = testi.chiusuraSegnalazione('Ilaria');
    expect(t).toContain('Segnalazioni');
    expect(t).not.toMatch(/non ci arrivo/i);
  });

  /** ⛔ E dice **perché** non lo fa: resta scritto chi ha guardato e perché ha chiuso. */
  it('⛔ dice perché non lo fa, non solo che non lo fa', () => {
    expect(testi.chiusuraSegnalazione('Ilaria')).toMatch(/chi.*perch|perch.*chi/is);
  });

  it('⚠️ senza nome la frase regge lo stesso', () => {
    const t = testi.chiusuraSegnalazione('');
    expect(t).toContain('Segnalazioni');
    expect(t).not.toContain('di  è risolta');
  });
});
