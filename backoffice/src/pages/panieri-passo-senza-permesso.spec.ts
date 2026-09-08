import { describe, expect, it } from 'vitest';

const sorgenti = import.meta.glob('./Ricette.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ricette = sorgenti['./Ricette.tsx'] ?? '';

/**
 * ⛔ **DENTRO LA CATENA DELLA RICETTA NUOVA, SPARIRE È UNA BUGIA** — 8/9.
 *
 * Il 7/9 «In quali panieri sta» ha imparato a distinguere tre casi che prima erano uno solo:
 * senza permesso sparisce, con un errore lo dice, in nessun paniere lo diceva già. La scelta di
 * far **sparire** la sezione a chi non ha la chiave `panieri` è giusta **nella scheda del
 * catalogo**: lì non c'è niente che stia promettendo un elenco.
 *
 * ⚠️ Nel passo «In quali panieri?» che si apre dopo aver creato una ricetta, no: la riga sopra ha
 * appena scritto *«qui sotto ci sono i panieri in cui può andare — o il motivo per cui non può
 * andare in nessuno»*. Sparire lì lascia una finestra che **promette un elenco e mostra il vuoto**,
 * e chi la legge conclude che i panieri non ci siano — mentre il problema è il suo permesso. È la
 * stessa famiglia di difetti che il 7/9 è stata tolta dall'altra parte.
 */
describe('il passo «In quali panieri?» non resta muto senza permesso', () => {
  it('⛔ la catena della ricetta nuova chiede di DIRE il motivo', () => {
    expect(ricette).toMatch(/<InQualiPanieri recipe=\{creata\}[^>]*senzaPermessoDillo/);
  });

  /** ⚠️ E la scheda del catalogo NON lo chiede: lì sparire resta la cosa giusta. */
  it('⚠️ la scheda del catalogo continua a farla sparire', () => {
    expect(ricette).toMatch(/\{recipe && <InQualiPanieri recipe=\{recipe\} paniereDiPartenza=\{paniereDiPartenza\} \/>\}/);
  });

  /**
   * ⛔ **E il valore di riposo è «sparisci»** — trovato da una revisione avversariale l'8/9: con la
   * prova qui sopra scritta solo sul punto di chiamata, cambiare la default del prop a `true`
   * avrebbe acceso il banner **anche nella scheda del catalogo** senza far diventare rossa nessuna
   * prova. Una prova che guarda solo chi chiama non custodisce l'invariante di chi risponde.
   */
  it('⛔ il prop nasce spento: chi non lo chiede continua a far sparire la sezione', () => {
    expect(ricette).toMatch(/senzaPermessoDillo = false \}/);
  });

  /**
   * ⛔ **Il motivo dice anche la conseguenza**, non solo «non hai il permesso»: la ricetta è
   * salvata, ma finché nessuno la mette in un paniere il motore non la pesca per nessuna cliente.
   * Un messaggio che dice solo cosa manca a chi legge, e non cosa succede alla ricetta, lascia
   * credere che il lavoro sia finito.
   */
  it('⛔ e dice cosa succede alla ricetta, non solo cosa manca a chi guarda', () => {
    expect(ricette).toMatch(/Non hai il permesso «Panieri»/);
    expect(ricette).toMatch(/motore non la pesca per nessuna cliente/);
    expect(ricette).toMatch(/chiedilo a chi gestisce i panieri/);
  });

  /**
   * ⛔ **IL VICOLO CIECO DI TUTTI I GIORNI: «vede» senza «gestisce»** — 8/9, da una revisione
   * avversariale che ha misurato i permessi di default invece di fidarsi.
   *
   * La Nutrizionista ha `panieri · vede` e non `gestisce`: la lettura **riesce**, quindi il ramo
   * del permesso mancante qui sopra non entra mai, e si finiva su «Sola lettura: serve il permesso
   * Panieri · gestisce» — una riga grigia, sotto una promessa di elenco, in fondo a una ricetta
   * appena nata che nessuna cliente riceverà. Il ramo coperto era quello raro; questo è quello che
   * la nutrizionista incontra ogni volta.
   */
  it('⛔ «vede» senza «gestisce», dentro la catena, dice la conseguenza e a chi chiedere', () => {
    expect(ricette).toMatch(/senzaPermessoDillo \? \(\s*\n\s*<Banner kind="warn">/);
    expect(ricette).toMatch(/Hai «Panieri · vede» ma non «<b>gestisce<\/b>»/);
  });

  /** ⚠️ E fuori dalla catena la riga grigia resta: lì si stava solo guardando. */
  it('⚠️ nella scheda del catalogo resta la riga di sola lettura', () => {
    expect(ricette).toMatch(/Sola lettura: per aggiungere o togliere panieri serve il permesso/);
  });
});

/**
 * ⛔ **UN MOTIVO FALSO È PEGGIO DI NESSUN MOTIVO** — 8/9.
 *
 * Finché senza permesso la sezione spariva, mettere 401 e 403 nello stesso ramo era innocuo. Dal
 * momento in cui quel ramo **scrive** «non hai il permesso Panieri», non lo è più: a chi il
 * permesso ce l'ha e ha solo la sessione scaduta direbbe di andare a disturbare un collega.
 */
describe('la sessione scaduta non è un permesso mancante', () => {
  it('⛔ solo il 403 diventa «fuori permesso»', () => {
    expect(ricette).toMatch(/if \(e instanceof ApiError && e\.status === 403\) \{/);
  });

  it('⛔ il 401 dice che la sessione è scaduta, e non tocca il permesso', () => {
    expect(ricette).toMatch(/if \(e instanceof ApiError && e\.status === 401\) \{/);
    expect(ricette).toMatch(/La sessione è scaduta: rientra e riapri la ricetta\./);
  });
});

/**
 * ⛔ **IL MESSAGGIO ROSSO DELL 8/9** — «Il campo «verified» non è previsto in questa richiesta».
 *
 * La finestra manda `verified` anche in creazione (`!recipe` rende «cambiata» la spunta), ed è
 * giusto così: la casella «Verificata dalla nutrizionista» sta lì e si può premere. Il campo che
 * mancava era nel DTO del server — vedi `backend/src/catalog/ricetta-nuova-si-salva.spec.ts`.
 *
 * ⚠️ Questa prova esiste per il caso opposto: se un domani qualcuno «risolvesse» smettendo di
 * mandarlo, la casella tornerebbe a essere una casella che si preme e non accende niente.
 */
describe('la spunta «verificata» vale anche su una ricetta nuova', () => {
  it('⛔ in creazione il corpo porta «verified»', () => {
    expect(ricette).toMatch(/const verificaCambiata = !recipe \|\| f\.verified !== !!recipe\.verifiedAt;/);
    expect(ricette).toMatch(/\.\.\.\(verificaCambiata \? \{ verified: f\.verified \} : \{\}\)/);
  });

  it('⚠️ e la casella è nella finestra anche quando la ricetta non esiste ancora', () => {
    expect(ricette).toMatch(/<Toggle on=\{f\.verified\} onChange=\{\(v\) => setF\(\{ \.\.\.f, verified: v \}\)\} \/>/);
  });
});
