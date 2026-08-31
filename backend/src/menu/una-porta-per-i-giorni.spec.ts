/**
 * ⛔ **CHI CANCELLA UN GIORNO DI MENU DEVE CANCELLARNE UNA CODA.**
 *
 * ## La regola, e perché è invisibile
 *
 * `deliverIfEligible` non cerca i buchi: guarda **l'ultimo** giorno in calendario, esce se è oltre
 * oggi, e compone da lì in avanti (`vera/giorno-che-non-torna.spec.ts` tiene ferma questa premessa
 * leggendo il motore). Quindi cancellare un giorno che ne lascia uno **più avanti** apre un buco
 * **permanente**: la cliente apre l'app in quella data e trova «menu in preparazione», per sempre.
 *
 * ⚠️ E non c'è **niente** che lo segnali: nessun errore, nessun log, nessuna riga rossa. Chi scrive
 * la cancellazione vede il codice fare esattamente quello che ha chiesto. Chi la subisce vede una
 * schermata che sembra dire «aspetta». È il motivo per cui il difetto è vissuto **dieci giorni** in
 * produzione su tre percorsi diversi senza che nessuno lo nominasse — e il motivo per cui questo file
 * esiste: la prossima cancellazione non deve poter nascere senza che qualcuno abbia guardato in
 * faccia questa domanda.
 *
 * ## Cosa controlla
 *
 * Ogni file che cancella `MenuDay` va **dichiarato qui sotto con la ragione per cui è una coda**.
 * Non è una lista di permessi burocratica: è il punto in cui si scrive perché quella cancellazione
 * non lascia niente in piedi dietro di sé.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Chi cancella giorni di menu, e perché quello che cancella è una coda.
 *
 * ⚠️ Le tre rigenerazioni del motore sono code per costruzione — cancellano **tutto** da una data in
 * avanti, senza guardare il contenuto — e sono l'unica forma sicura che esisteva prima del 24/8.
 */
const PERMESSI = new Map<string, string>([
  [
    'src/menu/menu.service.ts',
    // `redeliverFutureDays` (> oggi), `regenerateFromToday` (>= oggi), `restartFromPlanStart`
    // (tutto): tre `where` per DATA, nessun filtro sul contenuto e nessuno su `viewedAt`. Dopo
    // ognuna, l'ultimo giorno rimasto è per forza precedente a quello che si vuole ricomporre.
    'le tre rigenerazioni intere: cancellano per data, quindi sono code per costruzione',
  ],
  [
    'src/vera/vera-chat.service.ts',
    // I divieti dettati in chat, i pasti e le proteine: tutti e tre passano da `codaDaRifare`.
    'passa da `codaDaRifare` in tutti e tre i punti (divieti, pasti, proteine)',
  ],
  [
    'src/vera/applica-proposta.ts',
    'passa da `codePerCliente`, che è `codaDaRifare` una volta per persona',
  ],
  /**
   * ⛔ **`prisma/` non era guardata affatto** (24/8, trovato in revisione), e lì dentro c'era il
   * QUARTO punto che cancellava giorni sparsi: `collaudo-menu-panna.ts` toglieva le giornate che
   * contengono la ricetta di collaudo, su una cliente vera, girato a mano con `PULISCI=1`. La
   * sentinella diceva «ogni file che cancella `MenuDay` va dichiarato» e ne guardava una cartella su
   * due: una regola che si annuncia più larga di com'è controlla meno di quanto fa credere.
   */
  [
    'prisma/collaudo-menu-panna.ts',
    'passa da `codaDaRifare` (corretto il 24/8: cancellava le giornate col piatto di collaudo, sparse)',
  ],
  [
    'prisma/rifai-giorni-non-sicuri.ts',
    'passa da `codaDaRifare`: cancella la coda dal primo giorno non sicuro in poi, una cliente per volta',
  ],
  [
    'prisma/prune-menu-after-planend.ts',
    'cancella tutto oltre la fine del piano: è una coda per data, e dopo non resta niente',
  ],
]);

/** `prisma.menuDay.deleteMany(...)` e `.delete(...)`, comunque sia scritto il prefisso. */
const CANCELLA = /menuDay\s*\n?\s*\.\s*delete(?:Many)?\s*\(/;

function tuttiIFile(radice: string): string[] {
  const out: string[] = [];
  for (const voce of readdirSync(radice)) {
    const pieno = join(radice, voce);
    if (statSync(pieno).isDirectory()) out.push(...tuttiIFile(pieno));
    else if (voce.endsWith('.ts') && !voce.endsWith('.spec.ts')) out.push(pieno);
  }
  return out;
}

/**
 * ⛔ La forma esatta del difetto delle proteine: `deleteMany` con «solo i non aperti» dentro il
 * `where`. Cancella i giorni non ancora arrivati e lascia in piedi quelli già mandati all'app.
 *
 * ⚠️ **E il difetto ha tre nomi, non uno** (26/8): fino al 26/8 la riga sbagliata si scriveva
 * `viewedAt: null`; dalla voce `visto-non-vuol-dire-aperto` la stessa cosa si scrive
 * `apertoDallaClienteIl: null` oppure, in forma abbreviata, `...CHE_SI_POSSONO_RIFARE`. ⛔ Una
 * sentinella che pinza il nome vecchio resta verde per sempre mentre il difetto torna sotto il nome
 * nuovo — che è **esattamente** l'errore che questa consegna ha corretto altrove, e che qui stava
 * per ripetersi nel guardiano.
 */
const CANCELLA_I_NON_APERTI =
  /\.delete(?:Many)?\s*\(\s*\{[\s\S]{0,200}?(viewedAt:\s*null|apertoDallaClienteIl:\s*null|CHE_SI_POSSONO_RIFARE)/;

describe('⛔ nessuno cancella un giorno di menu senza dichiarare perché è una coda', () => {
  /**
   * ⛔ **`src/` E `prisma/`.** Gli script di `prisma/` girano a mano su dati veri, spesso di fretta e
   * spesso su una cliente sola che qualcuno sta guardando: sono l'ultimo posto in cui ha senso non
   * controllare, non il primo.
   */
  const backend = join(__dirname, '..', '..');
  const radici = ['src', 'prisma'].map((d) => join(backend, d));
  const relativo = (f: string) => f.slice(backend.length + 1).replace(/\\/g, '/');
  const cancellanoDavvero = () =>
    radici.flatMap(tuttiIFile).filter((f) => CANCELLA.test(readFileSync(f, 'utf8'))).map(relativo);

  it('⛔ ogni file che cancella `MenuDay` è dichiarato', () => {
    expect(cancellanoDavvero().filter((rel) => !PERMESSI.has(rel))).toEqual([]);
  });

  /**
   * ⚠️ **E la dichiarazione non invecchia in silenzio.** Un permesso rimasto lì dopo che il codice
   * è cambiato è peggio di nessun permesso: dice «qualcuno ci ha pensato» quando nessuno ci ha più
   * pensato. Se un file smette di cancellare giorni, la sua riga va tolta.
   */
  it('⚠️ e ogni dichiarazione serve ancora a qualcosa', () => {
    const cancellano = new Set(cancellanoDavvero());
    expect([...PERMESSI.keys()].filter((k) => !cancellano.has(k))).toEqual([]);
  });

  /**
   * ⛔ **E LA RAGIONE SCRITTA DEV'ESSERE VERA.** Le motivazioni qui sopra erano stringhe che nessuno
   * leggeva: un file poteva dichiarare «passa da `codaDaRifare`», smettere di passarci, e restare
   * dichiarato per sempre — cioè il permesso avrebbe detto «qualcuno ci ha pensato» proprio mentre
   * nessuno ci pensava più. Chi nomina la porta nella sua ragione deve chiamarla davvero.
   */
  it('⛔ chi dichiara di passare dalla porta ci passa davvero', () => {
    const bugiardi: string[] = [];
    for (const [file, ragione] of PERMESSI) {
      const nominate = ['codaDaRifare', 'codePerCliente'].filter((f) => ragione.includes(f));
      if (!nominate.length) continue;
      const src = readFileSync(join(backend, file), 'utf8');
      if (!nominate.some((f) => src.includes(f))) bugiardi.push(file);
    }
    expect(bugiardi).toEqual([]);
  });

  /**
   * ⛔ **LA FORMA ESATTA DEL DIFETTO: `deleteMany` con `viewedAt: null` dentro.**
   *
   * È quello che faceva «cambia le proteine» fino al 24/8, ed è il caso peggiore dei tre: cancella i
   * giorni non ancora aperti e **lascia in piedi quelli letti**. Se lei aveva già aperto un menu più
   * avanti — basta un tocco sul calendario — quel giorno restava l'ultimo, i giorni cancellati prima
   * di lui non tornavano mai, e l'erogazione restava ferma **del tutto** finché quella data non
   * passava.
   *
   * ⚠️ Questo controllo non ha eccezioni dichiarabili, di proposito: «cancella i non aperti» è
   * sbagliato **sempre**, e se un giorno servisse davvero, quel giorno si riapre questo file e si
   * scrive perché — non si aggiunge una riga a un elenco.
   */
  it('⛔ nessuno cancella «i giorni non ancora aperti»: è la forma che lascia il buco', () => {
    const colpevoli = radici
      .flatMap(tuttiIFile)
      .filter((f) => CANCELLA_I_NON_APERTI.test(readFileSync(f, 'utf8')))
      .map(relativo);
    expect(colpevoli).toEqual([]);
  });

  /**
   * ⚠️ E la sentinella riconoscerebbe davvero la riga che c'era: senza questa prova, un errore nella
   * regolare sopra la renderebbe un controllo che non guarda niente e non fallisce mai.
   */
  it('⚠️ la sentinella riconosce la riga che c\'era davvero, fino al 24/8', () => {
    const com_era =
      ".deleteMany({ where: { clientId: stato.clienteId!, viewedAt: null, date: { gte: daQuandoSiPuoRifare() } } })";
    expect(CANCELLA_I_NON_APERTI.test(com_era)).toBe(true);
    expect(CANCELLA.test('await this.prisma.menuDay.deleteMany({ where: { clientId } });')).toBe(true);
  });

  /**
   * ⛔ **E RICONOSCE ANCHE I DUE NOMI NUOVI** (26/8). Dopo `visto-non-vuol-dire-aperto` la stessa
   * riga sbagliata si scrive con il campo nuovo, o con la scorciatoia `CHE_SI_POSSONO_RIFARE`: senza
   * questa prova la sentinella sarebbe rimasta verde per sempre sorvegliando un nome morto.
   */
  it('⛔ e riconosce la stessa riga scritta coi nomi del 26/8', () => {
    expect(CANCELLA_I_NON_APERTI.test(
      ".deleteMany({ where: { clientId, apertoDallaClienteIl: null, date: { gte: daQuandoSiPuoRifare() } } })",
    )).toBe(true);
    expect(CANCELLA_I_NON_APERTI.test(
      ".deleteMany({ where: { clientId, ...CHE_SI_POSSONO_RIFARE, date: { gte: daQuandoSiPuoRifare() } } })",
    )).toBe(true);
  });
});
