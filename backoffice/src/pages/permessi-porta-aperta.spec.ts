import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./Permissions.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const pagina = sorgenti['./Permissions.tsx'] ?? '';

/**
 * ⛔ **Le prove «non c'è» si fanno sul CODICE, coi commenti tolti.** La prima stesura cercava
 * `PAGE_GRANTS` nel sorgente intero e falliva su un **commento** che spiega da dove arriva il
 * verdetto: una prova che vieta di *nominare* una cosa vieta di spiegarla. (Stessa correzione fatta
 * il 3/9 in `attivita-nutrizionista-in-app.spec.ts` — è un errore che si rifà da solo.)
 */
const codice = pagina
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/**
 * ⛔ **LA PAGINA PERMESSI DEVE DIRE QUANDO «SPENTO» NON VUOL DIRE CHIUSO.**
 *
 * Due porte che la matrice non nominava, tutte e due volute: l'**hub** (`PAGE_GRANTS`: «Gestione
 * dieta» concede Catalogo diete e Ricette) e l'**eredità** (una figlia senza riga vale la riga del
 * genitore — e senza riga la tabella la disegna spenta). Spegnere «Ricette» alla nutrizionista che
 * ha «Gestione dieta» non le toglie le API delle ricette: dalla schermata sembrava di sì.
 */
describe('«aperta lo stesso» nella pagina Permessi', () => {
  /**
   * ⛔ **Il conto arriva dal backend, non si rifà qui.** È la cosa che questa prova difende: due
   * copie della stessa regola divergono, e su questa regola è già successo — l'ereditarietà girava
   * in tre posti e ne era stato corretto uno.
   */
  it('⛔ la pagina LEGGE il verdetto dal backend, non lo ricalcola', () => {
    expect(codice).toMatch(/data\?\.aperteLoStesso/);
    // Nessuna traccia delle tabelle del backend riscritte qui dentro.
    expect(codice).not.toMatch(/PAGE_GRANTS|INHERIT_DEFAULTS|diet_workspace/);
  });

  it('⛔ e ogni cella che mente porta la sua etichetta', () => {
    expect(codice).toMatch(/function AvvisoPortaAperta/);
    expect(codice).toMatch(/<AvvisoPortaAperta cella=\{aperte\.get\(`\$\{r\.key\}\|\$\{pageKey\}\|view`\)\}/);
    expect(codice).toMatch(/<AvvisoPortaAperta cella=\{aperte\.get\(`\$\{r\.key\}\|\$\{pageKey\}\|manage`\)\}/);
    // ⛔ E il badge tace se la casella è stata toccata e non salvata: gli avvisi vengono dal server.
    expect(codice).toMatch(/\{!c\.canView && <AvvisoPortaAperta/);
    expect(codice).toMatch(/\{!c\.canManage && <AvvisoPortaAperta/);
  });

  /**
   * ⛔ **Le PAROLE dell'avviso stanno in `lib/portaAperta.ts`, con le loro prove.** Una revisione
   * avversariale ha misurato che queste prove — grep sul sorgente — passavano tutte anche svuotando
   * `AvvisoPortaAperta` a `return null`: la sola logica nuova del frontend non era misurata da
   * nessuno. Un ternario dentro il JSX non si prova; una funzione pura sì.
   */
  it('⛔ le parole non si scrivono qui: arrivano dal modulo che ha le prove', () => {
    expect(codice).toMatch(/paroleDellaPorta\(cella, pageLabel, nomeRuolo\)/);
    expect(codice).not.toMatch(/Aperta lo stesso da/);
  });

  /** ⛔ E il verso diretto: chi accende «Gestione dieta» sta accendendo tre cose. */
  it('⛔ la riga di un hub dice cosa apre oltre a sé', () => {
    expect(codice).toMatch(/Apre anche: \{\(apreAnche\[pageKey\] \?\? \[\]\)\.map\(pageLabel\)/);
  });

  /**
   * ⛔ **Nemmeno gli ESEMPI del banner si scrivono a mano.** La prima stesura diceva in prosa
   * «Gestione dieta concede anche Catalogo diete e Ricette»: la stessa tabella del backend
   * ricopiata con le etichette invece che con le chiavi — la seconda copia che questa pagina evita
   * apposta, e che il controllo sulle chiavi non vedeva.
   */
  it('⛔ e gli esempi nel banner si scrivono dai dati', () => {
    expect(codice).toMatch(/righeCheApronoAltro/);
    expect(codice).not.toMatch(/Gestione dieta.{0,40}Catalogo diete/);
  });

  /** ⚠️ E il perimetro si dichiara per intero: tre vie, non «tutte». */
  it('⚠️ il banner nomina tutte e tre le vie che copre', () => {
    expect(codice).toMatch(/eredita quella del genitore/);
    expect(codice).toMatch(/ruolo di base/);
  });

  /** ⛔ Le righe mai create sono un'altra cosa, e si dicono con un numero invece che con i badge. */
  it('⛔ le caselle senza riga si dicono con un numero, a parte', () => {
    expect(codice).toMatch(/\(data\.senzaRiga \?\? 0\) > 0 &&/);
    expect(codice).toMatch(/non hanno ancora una riga/);
  });

  /**
   * ⚠️ **Un avviso che compare sempre non è un avviso.** Il banner in cima esiste per far cercare i
   * badge in una tabella che scorre, e deve sparire quando non c'è niente da segnalare.
   */
  it('⚠️ il riassunto in cima compare solo se c\'è almeno una cella', () => {
    expect(codice).toMatch(/\(data\.aperteLoStesso \?\? \[\]\)\.length > 0 &&/);
  });

  /**
   * ⛔ **La pagina spiega, non cambia il significato di «spento».** Far sì che spegnere una chiave
   * la spenga davvero è l'altra strada, e va decisa da Simone. Se un giorno qualcuno la prende, che
   * lo faccia sapendo che qui c'è scritto il contrario.
   */
  it('⛔ e dice che spegnere la casella NON chiude la porta', () => {
    /** ⛔ Sul CODICE: la prima stesura cercava «va deciso da Simone», che sta solo in un commento —
     *  un test su una spiegazione, dentro il file che apre spiegando perché i commenti si tolgono. */
    expect(codice).toMatch(/spegnerle non chiude quella porta/);
  });

  /**
   * ⚠️ **Il backend può essere più vecchio della pagina** (un rilascio del backoffice prima di
   * quello del backend): senza i campi nuovi la tabella deve restare quella di prima, non rompersi.
   */
  it('⚠️ e senza i campi nuovi la pagina non si rompe', () => {
    expect(codice).toMatch(/aperteLoStesso\?: CellaAperta\[\];/);
    expect(codice).toMatch(/concede\?: Record<string, string\[\]>;/);
    expect(codice).toMatch(/senzaRiga\?: number;/);
  });
});
