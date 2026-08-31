/**
 * ⛔ **SE L'EROGAZIONE ESCE A MANO VUOTA, IL COLPEVOLE DEVE ESSERE UNA RIGA DEL TABULATO.**
 *
 * ## Il fatto, il 23/8
 *
 * Una cliente vera è rimasta ferma per ore. `npm run prova:erogazione` ha stampato i suoi cancelli,
 * tutti ✓ tranne «pausa attiva ⛔», poi «NESSUN giorno erogato» — e **nessuna delle righe stampate
 * spiegava perché**. La caccia è durata un'ora, per esclusione, sui log che non c'erano: perché
 * `deliverIfEligible` ha **diciannove** uscite a mano vuota e il tabulato ne guardava nove,
 * fermandosi proprio dove stava la risposta.
 *
 * ⚠️ Una diagnostica incompleta è peggio di nessuna diagnostica: quella completa non c'è e si va a
 * leggere il codice, quella incompleta la si crede e si cerca altrove.
 *
 * ## Cosa tiene fermo questo file
 *
 * Il tabulato è una copia a mano di una lista che sta in un altro file. Quindi la copia va tenuta in
 * pari: qui si **conta** quante uscite ha `deliverIfEligible`, e se ne nasce una nuova questo test
 * diventa rosso, con scritto cosa fare. Non controlla che il testo sia giusto — quello lo può fare
 * solo una persona — controlla che nessuno ne aggiunga una senza accorgersi che esiste un tabulato.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MOTORE = readFileSync(join(__dirname, 'menu.service.ts'), 'utf8');
const TABULATO = readFileSync(join(__dirname, '..', '..', 'prisma', 'prova-erogazione.ts'), 'utf8');

/** Il corpo di `deliverIfEligible`: dalla sua firma al metodo successivo. */
function corpoDiDeliverIfEligible(): string {
  const inizio = MOTORE.indexOf('async deliverIfEligible(');
  expect(inizio).toBeGreaterThan(0);
  // Il metodo successivo comincia con due spazi d'indentazione: è la fine del corpo.
  const resto = MOTORE.slice(inizio + 10);
  const fine = resto.search(/\n {2}(?:private |async |\/\*\*)/);
  return resto.slice(0, fine > 0 ? fine : undefined);
}

describe('⛔ le uscite a mano vuota dell\'erogazione sono tutte nel tabulato', () => {
  /**
   * ⚠️ **Il numero è quello contato il 24/8**, non una stima. Se cambia, la domanda da farsi è: «la
   * riga nuova esce in silenzio? e `prova:erogazione` la stampa?». Poi si aggiorna questo numero.
   *
   * ⚠️ **E la prima volta che l'ho contato mi è venuto 16**, perché avevo guardato solo le prime
   * quattrocento righe della funzione — che invece è lunga **novecentosettanta**. Le tre che mi
   * erano sfuggite sono tutte dopo la composizione: fine piano contro primo giorno da comporre,
   * giornate tutte scartate, esclusioni non sostituibili. Due delle tre escono in silenzio, e una è
   * quella che il brief nominava per nome. È il motivo per cui questo conto lo fa una macchina.
   */
  /**
   * ⚠️ **20 dal 31/8**: ne è nata una dopo lo swap dei piatti non graditi. Il piatto scambiato
   * ripassa da `evaluateMeals` (prima non ripassava da niente: è così che una cliente allergica ai
   * crostacei ha ricevuto i gamberoni), e se da lì uscisse una violazione l'erogazione si ferma
   * come per tutte le altre. ⚠️ Non esce in silenzio — scrive l'escalation al nutrizionista — e la
   * causa è la stessa che il tabulato stampa già: «esclusioni non sostituibili». In condizioni
   * normali non scatta mai: lo swap sceglie solo candidati che non violano niente. Se scatta, vuol
   * dire che un'altra strada ci è sfuggita, ed è esattamente quello che vogliamo vedere.
   */
  const USCITE_CENSITE = 20;

  it('⛔ `deliverIfEligible` ha esattamente le uscite che il tabulato conosce', () => {
    const quante = (corpoDiDeliverIfEligible().match(/return \[\];/g) ?? []).length;
    expect(quante).toBe(USCITE_CENSITE);
  });

  /**
   * ⛔ **Le domande si fanno alle STESSE PORTE del motore.** Una diagnostica che risponde a una
   * domanda leggermente diversa da quella del servizio è peggio di nessuna: il cancello della pausa
   * era esattamente così — confrontava `end_date` con **l'istante** invece che col giorno, quindi
   * dalle 00:00 in poi diceva «nessuna pausa» mentre il servizio ne vedeva una attiva.
   */
  it.each([
    ['statoSupervisione', 'la visita clinica scaduta'],
    ['attivoInCorso', 'quale piano eroga fra due attivi'],
    ['activePausePeriod', 'la sospensione in corso'],
    ['rientroInArrivo', 'la finestra di rientro'],
    ['pausaAppenaFinita', 'il cancello che sopravvive al rientro'],
    ['mancaLaPesataDelRientro', 'la pesata del rientro'],
    ['mancaMisuraDiPartenza', 'la misura di partenza del piano'],
    ['cycleNeedsMeasure', 'le misure del ciclo'],
    ['giornateComplete', 'la completezza delle giornate'],
  ])('⛔ il tabulato usa `%s` (%s), non una query riscritta a mano', (porta) => {
    expect(TABULATO).toContain(porta);
  });

  /**
   * ⚠️ **La scelta della dieta**: il motore chiama `this.pickDiet`, che dentro chiama `pickDietFor`;
   * il tabulato chiama `pickDietFor` diretto. Sono la stessa porta, ma i due nomi sono diversi —
   * quindi il controllo si scrive per quello che è, invece di far finta che coincidano.
   */
  it('⛔ e la dieta la sceglie `pickDietFor`, la stessa che sta sotto `pickDiet`', () => {
    expect(MOTORE).toMatch(/pickDietFor/);
    expect(TABULATO).toContain('pickDietFor');
  });

  /**
   * ⛔ **E non torna la query a mano sulla pausa.** È la riga che il 23/8 rispondeva diversamente dal
   * servizio: `startDate <= adesso AND endDate >= adesso`, con `endDate` che è una colonna di soli
   * giorni (mezzanotte UTC). Alle 9 del mattino dell'ultimo giorno sospeso il confronto è **falso** —
   * il tabulato diceva «nessuna pausa» e il motore stava fermo per una pausa.
   */
  it('⛔ nessun confronto fra una data di sospensione e l\'ISTANTE corrente', () => {
    expect(TABULATO).not.toMatch(/pause_period[\s\S]{0,200}?(?:lte|gte):\s*new Date\(\)/);
  });

  /**
   * ⚠️ **Il valore GREZZO dei parametri si stampa.** Con `menu_visible_days_before_return` a zero la
   * finestra di rientro non si apre mai e l'erogazione esce da un `return []` muto: leggere «anticipo
   * 0» in tabulato è la differenza fra un minuto e un'ora.
   */
  it('⚠️ e i tre parametri che comandano l\'erogazione si leggono in tabulato', () => {
    for (const chiave of ['menu_days_delivered', 'menu_visible_days_before_start', 'menu_visible_days_before_return']) {
      expect(TABULATO).toContain(chiave);
    }
    // Il valore scritto in tabella, non solo quello che esce da `getNumber` dopo il ripiego.
    expect(TABULATO).toContain('configParam.findUnique');
  });
});
