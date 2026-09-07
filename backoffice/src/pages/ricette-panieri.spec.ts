import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./Ricette.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const pagina = sorgenti['./Ricette.tsx'] ?? '';

/**
 * ⛔ **«DOVE È USATA» È STATA TOLTA DAL POPUP — decisione di Simone, 3/9.**
 *
 * Il 2/9 le due sezioni convivevano, ed era già scritto qui perché fossero **due domande diverse**:
 * «Dove è usata» sono le **giornate** che nominano il piatto, «In quali panieri» è il **pool** da
 * cui il motore pesca. Con `panieri_sorgente_pool` su `paniere` è il secondo a decidere cosa arriva
 * nel piatto di una cliente, e le giornate sono diventate storia.
 *
 * ⛔ Il passo successivo era inevitabile: un elenco che **sembra comandare** e non comanda più — con
 * un pulsante «Togli» per ogni riga — è peggio di un elenco che non c'è. Resta la stessa domanda,
 * fatta alla porta giusta.
 */
describe('la sezione dei panieri nel popup della ricetta', () => {
  it('⛔ «Dove è usata» non c\'è più: restano i panieri, che sono la porta vera', () => {
    expect(pagina).toMatch(/function InQualiPanieri/);
    expect(pagina).toMatch(/<InQualiPanieri recipe=\{recipe\}/);
    expect(pagina).not.toMatch(/<DoveUsata/);
    expect(pagina).not.toMatch(/function DoveUsata/);
  });

  /** ⚠️ E il motivo resta scritto nella pagina: senza, fra sei mesi sembra una dimenticanza. */
  it('⚠️ e la pagina dice PERCHÉ è stata tolta', () => {
    expect(pagina).toMatch(/«DOVE È USATA» È STATA TOLTA/);
  });

  it('⛔ e dice che il paniere è una cosa diversa dalle giornate', () => {
    expect(pagina).toMatch(/da dove il motore pesca/);
  });

  /**
   * ⛔ **Il motivo si dice PRIMA del clic che fallirebbe.** Il server rifiuta una ricetta spenta o
   * con gli allergeni non confermati: scoprirlo premendo un pulsante, paniere per paniere, è far
   * cercare a qualcuno una cosa che sappiamo già.
   */
  it('⛔ se non si può aggiungere, lo dice prima invece di far fallire il clic', () => {
    expect(pagina).toMatch(/stato\.bloccata \?/);
  });

  /**
   * ⛔ **Se il terzo di cinque fallisce, i primi due sono scritti davvero.** Dire «non riuscito» e
   * basta nasconderebbe due scritture avvenute, e chi legge riproverebbe tutto.
   */
  it('⛔ aggiungendo a più panieri conta i riusciti e i falliti separatamente', () => {
    expect(pagina).toMatch(/const fatti: string\[\] = \[\];/);
    expect(pagina).toMatch(/const falliti: string\[\] = \[\];/);
  });

  /**
   * ⚠️ Chi non ha la chiave `panieri` non deve vedere un errore rosso in fondo alla scheda: la
   * sezione semplicemente non c'è. Un 403 previsto non è un guasto da mostrare.
   */
  it('⚠️ e senza la chiave `panieri` la sezione sparisce invece di mostrare un errore', () => {
    expect(pagina).toMatch(/e\.status === 403 \|\| e\.status === 401/);
  });

  /** ⚠️ La conferma dice cosa cambia per le clienti, come nella pagina Panieri. */
  it('⚠️ togliere da un paniere dice cosa cambia per le clienti', () => {
    expect(pagina).toMatch(/Non lo riceverà più nessuna cliente di quel paniere/);
  });
});

/**
 * ⛔ **IL PULSANTE CHE DICEVA «Aggiungi a nessun panierei»** — 7/9, arrivato da uno screenshot di
 * Simone insieme a «il capo nutrizionista non riesce».
 *
 * La riga era `Aggiungi a ${scelte.length || 'nessun'} paniere${scelte.length === 1 ? '' : 'i'}`: a
 * zero scelte componeva una parola che non esiste, e una frase che si legge come un'azione quando è
 * uno stato. Il pulsante in quel momento è disabilitato ma aveva lo stile pieno, identico a uno
 * attivo: si preme, non succede niente, e sembra rotto — cioè manda a cercare un guasto dove c'è
 * solo «non hai ancora scelto».
 */
describe('⛔ il pulsante «Aggiungi» a zero scelte', () => {
  it('⛔ «panierei» non compare più nel testo che si mostra', () => {
    // Il commento che racconta il difetto può nominarla; il codice no.
    const senzaCommenti = pagina.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(senzaCommenti).not.toContain('panierei');
  });

  it('a zero scelte NON dice «Aggiungi»: dice cosa fare', () => {
    expect(pagina).toContain('Scegli un paniere qui sopra');
  });

  it('⚠️ e a zero si vede che è spento: stile pieno solo quando c’è qualcosa da aggiungere', () => {
    expect(pagina).toMatch(/className=\{scelte\.length \? 'btn sm' : 'btn ghost sm'\}/);
  });
});

/**
 * ⛔ **SENZA «gestisce» LA SEZIONE È IN SOLA LETTURA.** Fino al 7/9 pastiglie e pulsanti comparivano
 * a chiunque avesse «vede», e il clic moriva in un 403 muto.
 */
describe('⛔ i panieri in sola lettura', () => {
  it('il permesso si legge, e si legge «gestisce»', () => {
    expect(pagina).toMatch(/const puoGestireIPanieri = can\('panieri', 'manage'\)/);
  });

  it('⛔ «Togli» sta dietro il permesso', () => {
    expect(pagina).toMatch(/puoGestireIPanieri && \(\s*<button className="btn ghost sm" disabled=\{busy\} onClick=\{\(\) => void togli\(p\)\}/);
  });

  it('⛔ e senza permesso non compaiono le pastiglie: si dice perché, invece di lasciare pulsanti che falliscono', () => {
    expect(pagina).toMatch(/!puoGestireIPanieri \? \(/);
    expect(pagina).toContain('Sola lettura');
    expect(pagina).toContain('Panieri · gestisce');
  });
});

/**
 * Il paniere di partenza, quando la ricetta nasce dalla pagina Panieri (Simone, 7/9).
 */
describe('il paniere di partenza arriva già scelto', () => {
  it('la modale lo passa al passo dei panieri', () => {
    expect(pagina).toMatch(/paniereDiPartenza=\{paniereDiPartenza\}/);
  });

  it('⚠️ si preseleziona SOLO se è davvero fra i disponibili: una pastiglia accesa su una scelta impossibile prometterebbe un’aggiunta che fallisce', () => {
    expect(pagina).toMatch(/stato\.disponibili\.some\(\(d\) => `\$\{d\.famiglia\}\|\$\{d\.regime\}` === chiave\)/);
  });
});

/**
 * ⛔ **TRE CASI DIVERSI, TRE SCHERMATE DIVERSE** — 7/9, da «l'elenco c'è ma non tutte lo mostrano».
 *
 * Il ramo di errore chiamava `setErr(...)` e lasciava `stato` a `null`; tre righe più sotto
 * `if (!stato) return null` toglieva di mezzo il riquadro **compreso il banner appena riempito**. Su
 * una ricetta il cui caricamento falliva, «In quali panieri sta» non c'era — identica a una senza
 * permesso e identica a una che non sta in nessun paniere.
 *
 * ⚠️ È il difetto peggiore di questa famiglia: non lascia traccia. Chi guarda non vede un errore,
 * vede un pezzo di pagina che manca, e conclude che il piatto non stia in nessun paniere — la
 * risposta **opposta** a quella vera.
 */
describe('⛔ quando i panieri non si leggono, la sezione lo DICE', () => {
  it('senza permesso sparisce, e solo per quello', () => {
    expect(pagina).toMatch(/setStato\(null\); setErr\(null\); setFuoriPermesso\(true\); return;/);
    expect(pagina).toMatch(/if \(fuoriPermesso\) return null;/);
  });

  it('⛔ con un errore la sezione RESTA: non si esce se c’è qualcosa da dire', () => {
    expect(pagina).toMatch(/if \(!stato && !err\) return null;/);
  });

  it('⛔ e il messaggio dice che «non lo so» non è «non sta in nessun paniere»', () => {
    expect(pagina).toContain('non vuol dire che la ricetta non stia in nessun paniere');
  });
});

/**
 * ⛔ **«NESSUN PANIERE PER QUESTO REGIME» NON È «È GIÀ IN TUTTI»** — 7/9, da «non ho la lista panieri
 * per poter aggiungere».
 *
 * Le due cose si vedono uguali — nessuna pastiglia — e la pagina ne diceva una sola, quella
 * sbagliata. Chi leggeva «è già in tutti i panieri» concludeva che il piatto fosse a posto, e invece
 * non poteva entrare da nessuna parte, per una ragione che non era sua.
 */
describe('⛔ i due modi di non avere pastiglie', () => {
  it('il server manda quanti panieri esistono per quel regime', () => {
    expect(pagina).toMatch(/panieriDelRegime\?: number;/);
  });

  it('⛔ a zero panieri la pagina lo DICE, e non dice «è già in tutti»', () => {
    expect(pagina).toMatch(/stato\.panieriDelRegime === 0 \? \(/);
    expect(pagina).toContain('Non esiste nessun paniere per il regime');
  });

  it('⚠️ e la frase indica le due strade: o il regime della ricetta o il paniere che manca', () => {
    expect(pagina).toContain('va corretto il');
    expect(pagina).toContain('non è ancora stato creato');
  });

  it('⚠️ «è già in tutti» adesso porta un NUMERO: una frase con dentro un conto si può verificare', () => {
    expect(pagina).toMatch(/\{stato\.panieriDelRegime \?\? ''\} panieri/);
  });
});
