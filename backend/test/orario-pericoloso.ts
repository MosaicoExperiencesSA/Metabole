/**
 * ⛔ **LA SUITE GIRATA ALL'ORA IN CUI SI ROMPE.**
 *
 * Fra la mezzanotte e le 02:00 italiane (l'01:00 in ora solare) il giorno di Roma e il giorno UTC
 * non coincidono. È la fascia in cui vive tutta la famiglia di difetti che
 * `src/common/date-only.ts` esiste per chiudere — e, per le stesse due ore, è la fascia in cui un
 * test scritto male diventa rosso senza che il prodotto abbia niente che non va, o **verde mentre
 * il prodotto è rotto**.
 *
 * Prima di questo file la suite era verde 22 ore su 24 e rossa 2, e nessuno lo sapeva finché non
 * capitava di lanciarla di notte. Con `npm run test:notte` quelle due ore si possono avere quando si
 * vuole; il passo omonimo nella CI fa sì che le si abbia **sempre**, che è l'unico modo perché un
 * quinto file col difetto non venga scritto domani.
 *
 * ⚠️ Quale istante sia «l'ora pericolosa» lo decide `ora-pericolosa.ts`, che sta accanto ed è puro:
 * qui c'è solo la parte che tocca jest. `ORA_FINTA=<iso> npm run test:notte` va a vedere un'altra
 * ora, o un altro giorno.
 *
 * ## ⚠️ L'orologio si falsifica PRIMA che i moduli vengano caricati
 *
 * La prima versione di questo file lo faceva dentro `beforeEach`, cioè **dopo** l'import del file di
 * test: le costanti calcolate a livello di modulo restavano sull'ora vera, e il confronto fra quelle
 * e l'ora finta faceva cadere file dove non c'era niente da correggere. Contava 8 suite rotte invece
 * di 4. ⛔ Una misura sbagliata è peggio di nessuna misura, perché manda a correggere codice che
 * funziona — e il tempo speso lì non torna indietro.
 *
 * `setupFilesAfterEnv` gira dopo l'ambiente di test e **prima** del file di test: è il posto giusto.
 *
 * ## ⚠️ Si falsifica solo `Date`
 *
 * I timer restano veri. Falsificando anche `setTimeout` ogni suite che aspetta una promessa dietro
 * un timer si bloccherebbe fino allo scadere del limite di jest — e una suite in timeout assomiglia
 * moltissimo a una suite che ha trovato un difetto, il che rimanderebbe al punto di sopra.
 */
import { oraPericolosa } from './ora-pericolosa';
import { TIMER_VERI } from './orologio-fermo';

const OPZIONI = {
  doNotFake: TIMER_VERI as never,
  now: oraPericolosa(),
};

/**
 * ⚠️ Una bandiera che dice «l'orologio notturno è caricato»: `lora-pericolosa-si-gira.spec.ts` la
 * legge per poter verificare che «adesso» sia **davvero** dentro la fascia pericolosa, invece di
 * limitarsi a guardare com'è scritto questo file. Senza, sostituire `now` con l'ora vera rendeva
 * `test:notte` un doppione di `test` e nessun test se ne accorgeva.
 */
(global as unknown as { __OROLOGIO_NOTTURNO__?: boolean }).__OROLOGIO_NOTTURNO__ = true;

jest.useFakeTimers(OPZIONI);

/**
 * ⚠️ E si rimette a ogni test: una suite che chiama `jest.useRealTimers()` nel suo `afterEach`
 * — ce ne sono — tornerebbe all'ora vera per tutte quelle dopo di lei, e la misura si sfalderebbe
 * a metà file senza dirlo.
 */
beforeEach(() => {
  jest.useFakeTimers(OPZIONI);
});
