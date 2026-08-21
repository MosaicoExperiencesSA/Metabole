/**
 * L'OROLOGIO NELL'APP NON DEVE RIFARE I CONTI DEL SERVER.
 *
 * Questi test leggono il **sorgente**, come `giornata-in-tre-forme.spec.ts` nel backend, e per la
 * stessa ragione: il difetto che cercano non vive dentro una funzione — vive nella scelta di
 * scriverne una seconda. Nessuna mutazione lo troverebbe, perché il codice sbagliato sarebbe
 * perfettamente funzionante.
 *
 * ⛔ Quali pasti riceve, e a che ora, lo decide **`menu/orologio-digiuno.ts` sul server**. Se l'app
 * se li ricalcolasse, esisterebbero due regole per la stessa domanda: e il giorno che le soglie
 * cambiano da `config_param` — cosa che il modulo del server permette apposta — l'app continuerebbe
 * a mostrare gli orari vecchi con la sicurezza di chi li ha appena calcolati.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const radice = join(__dirname, '..');
const leggi = (rel: string): string => readFileSync(join(radice, rel), 'utf8');

const PAGINA = 'pages/Digiuno.tsx';
const CARD = 'components/CardDigiuno.tsx';
const QUADRANTE = 'components/OrologioDigiuno.tsx';

describe('⛔ i pasti li calcola il server, non l\'app', () => {
  /**
   * ⛔ Le soglie che decidono **quanti pasti** stanno per una finestra sono nel modulo del server
   * (`SOGLIE_PASTI_PREDEFINITE`) e si possono cambiare da `config_param`. Un elenco di numeri qui
   * dentro sarebbe una copia che nessuno aggiornerebbe.
   */
  it.each([PAGINA, CARD, QUADRANTE])('%s non contiene soglie di pasti scritte a mano', (file) => {
    const s = leggi(file);
    expect(s).not.toMatch(/breakfast|morning_snack|afternoon_snack|lunch|dinner/);
    expect(s).not.toMatch(/SOGLIE|soglie/);
  });

  /**
   * ⛔ **E nemmeno la finestra.** `fastingWindow` — cioè quali pasti salta — non si manda più
   * dall'app: la deriva l'orologio. Il DTO del server la rifiuta (`whitelist: true`), ma una riga
   * qui che provasse a mandarla sarebbe comunque un secondo modo di rispondere alla stessa domanda,
   * e il primo a scoprirlo sarebbe chi si trova i pasti cambiati.
   */
  it('⛔ la pagina non manda `fastingWindow`, e non ha nessuna tendina «quali pasti salti»', () => {
    const s = leggi(PAGINA);
    expect(s).not.toContain('fastingWindow');
    expect(s).not.toMatch(/skip_/);
    expect(s).not.toMatch(/pasti (che )?salt/i);
  });

  /**
   * ⛔ **Nemmeno l'elenco dei protocolli.** Arrivano da `GET /me/digiuno`, che li prende dalla
   * tabella: cinque sigle scritte a mano qui sarebbero il difetto delle finestre dell'11/8 rifatto
   * su un altro elenco — «mancavano da cinque posti diversi».
   */
  it('⛔ i cinque protocolli non sono scritti nell\'app: arrivano dal server', () => {
    const s = leggi(PAGINA);
    // Il 16:8 compare una volta sola, come valore di partenza dichiarato, non come elenco.
    const sigle = s.match(/'\d{2}:\d{1,2}'/g) ?? [];
    expect(sigle.length).toBeLessThanOrEqual(1);
    // I bottoni si disegnano dall'elenco che arriva, non da una costante scritta qui.
    expect(s).toMatch(/vista\.protocolli/);
    expect(s).toMatch(/catalogo\.map|vista\.protocolli\.map/);
  });
});

describe('⚠️ l\'orologio si legge dove si può provare', () => {
  /**
   * ⚠️ La trigonometria sta in `lib/orologio.ts`, che ha i suoi test. Se rientrasse nel componente
   * tornerebbe a essere codice che non si prova — e un quadrante sbagliato non dà errore: disegna.
   */
  it('⚠️ il componente non fa trigonometria per conto suo', () => {
    const s = leggi(QUADRANTE);
    // `Math.atan2` resta: serve a leggere dove ha toccato il dito, ed è l'unico punto che lo fa.
    expect(s.match(/Math\.cos|Math\.sin/g)).toBeNull();
    expect(s).toContain("from '../lib/orologio'");
  });

  it('⚠️ e la home non disegna un secondo orologio: usa lo stesso componente', () => {
    expect(leggi(CARD)).toContain('OrologioDigiuno');
    expect(leggi(CARD)).not.toContain('<svg');
  });
});

describe('⛔ quello che la pagina promette e non deve tradire', () => {
  /**
   * ⛔ Dopo il salvataggio la pagina si ridisegna con **la risposta del server**, non con quello che
   * la cliente aveva chiesto. Col piano graduale sono cose diverse apposta: ha chiesto le 08:00, in
   * vigore restano le 12:00 per qualche giorno. Anticipare il risultato le mostrerebbe un orologio
   * che non esiste da nessuna parte.
   */
  it('⛔ il salvataggio riscrive la vista con quello che torna dal server', () => {
    const s = leggi(PAGINA);
    expect(s).toMatch(/const v = await api<Vista>\('\/me\/digiuno', \{[\s\S]*?method: 'PATCH'/);
    expect(s).toContain('setVista(v)');
  });

  /**
   * ⚠️ «Lo faccio dopo» deve funzionare davvero: l'atterraggio si ricorda per la **sessione**, non
   * per sempre. Con `localStorage` la domanda sparirebbe e basta — e rimandare non è rispondere.
   */
  it('⚠️ l\'atterraggio si ricorda per la sessione, non per sempre', () => {
    const s = leggi(CARD);
    expect(s).toMatch(/sessionStorage\s*\./);
    // ⚠️ Si guarda l'**uso**, non la parola: il commento accanto alla riga spiega perché non è
    // `localStorage`, e un test che cercasse la parola secca boccerebbe la propria spiegazione.
    expect(s).not.toMatch(/localStorage\s*\./);
  });
});
