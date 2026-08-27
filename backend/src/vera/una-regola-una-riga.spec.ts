import { CAMPI_DEL_GIORNO, CHE_SI_POSSONO_RIFARE, siPuoCancellare } from './menu-da-rifare';

/**
 * ⛔ **LA STESSA REGOLA IN DUE FORME, E DEVONO DIRE LA STESSA COSA** — 26/8, voce
 * `visto-non-vuol-dire-aperto`.
 *
 * «Questo giorno lo posso cancellare?» ha due scritture, e non per pigrizia: `siPuoCancellare`
 * decide su una riga già in mano, `CHE_SI_POSSONO_RIFARE` è il `where` per le query che devono solo
 * **contare** quanti se ne potrebbero rifare senza caricarli tutti.
 *
 * ⚠️ Due forme della stessa regola sono due forme che un giorno divergono: si cambia il `where` per
 * una fretta e la funzione resta vecchia, e da quel momento la coda che si mostra alla nutrizionista
 * e i giorni che si cancellano davvero **non sono più gli stessi**. Questi test sono il punto in cui
 * quella divergenza diventa rossa.
 */
describe('⛔ «si può rifare?»: il `where` e la funzione non devono divergere', () => {
  const domani = new Date('2026-08-27T00:00:00.000Z');

  it('una riga che il `where` accetterebbe, la funzione la accetta', () => {
    const riga = { date: domani, ...CHE_SI_POSSONO_RIFARE };
    expect(siPuoCancellare(riga)).toBe(true);
  });

  /**
   * ⚠️ E il verso opposto, uno per uno: ogni condizione del `where` è **necessaria** anche per la
   * funzione. Se domani qualcuno togliesse `apertureTracciate` dal `where` per «semplificare», qui
   * si vedrebbe subito che le due strade hanno smesso di rispondere uguale.
   */
  it.each(Object.keys(CHE_SI_POSSONO_RIFARE))('⛔ togliendo «%s» la funzione dice di no', (campo) => {
    const opposto: Record<string, unknown> = { ...CHE_SI_POSSONO_RIFARE };
    opposto[campo] = campo === 'apertureTracciate' ? false : new Date('2026-08-25');
    expect(siPuoCancellare(opposto)).toBe(false);
  });

  /**
   * ⚠️ **Il `where` non contiene la data, e non è una dimenticanza**: ogni chiamante ha il suo
   * confine (da oggi, da domani, da una data dettata), e metterlo qui vorrebbe dire deciderlo per
   * tutti. Il confine lo dà `daQuandoSiPuoRifare`, che è un'altra domanda.
   */
  it('⚠️ il `where` parla solo di «aperto», non di date', () => {
    expect(Object.keys(CHE_SI_POSSONO_RIFARE).sort()).toEqual(['apertoDallaClienteIl', 'apertureTracciate']);
  });

  /**
   * ⛔ **E LE QUERY DEVONO CHIEDERE I CAMPI CHE LE DECISIONI LEGGONO.**
   *
   * Il `select` dei giorni passa da `as never` — il client Prisma generato non conosce le colonne
   * nuove finché non gira `prisma generate`, e quel cast spegne ogni controllo. Un campo dimenticato
   * lì arriva `undefined`, e `undefined` su `apertureTracciate` vuol dire «non lo so» **per sempre**,
   * su tutti i giorni, senza un errore da nessuna parte. Qui si tiene fermo l'elenco.
   */
  it('⛔ `CAMPI_DEL_GIORNO` chiede tutto quello che le decisioni guardano', () => {
    expect(Object.keys(CAMPI_DEL_GIORNO).sort()).toEqual(
      ['apertoDallaClienteIl', 'apertureTracciate', 'clientId', 'date', 'id', 'meals'],
    );
    // ⚠️ Le due condizioni del `where` devono stare fra i campi che si caricano: chi filtra in
    // memoria e chi filtra nel database devono guardare le stesse colonne.
    for (const campo of Object.keys(CHE_SI_POSSONO_RIFARE)) {
      expect(Object.keys(CAMPI_DEL_GIORNO)).toContain(campo);
    }
  });
});
