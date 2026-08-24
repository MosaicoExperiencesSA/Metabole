/**
 * QUANTO È ALTA UNA TABELLA DI DIECI RIGHE — il conto, separato da chi lo applica.
 *
 * Sta qui e non dentro `components/tabella-scorrevole.tsx` per una ragione trovata in revisione il
 * 24/8: dentro il componente questa aritmetica non era verificabile (i test del backoffice girano
 * senza DOM, quindi tutte le altezze sarebbero zero e il conto non verrebbe mai eseguito), e una
 * formula che nessuno può sbagliare **rumorosamente** è una formula che si sbaglia in silenzio —
 * un fattore storto e la tabella mostra nove righe e mezza per sempre, senza che niente diventi rosso.
 */
export function altezzaPerRighe(altezzaTesta: number, altezzeRighe: number[], righe: number): number | null {
  // Ci stanno tutte: nessun limite e nessuna barra di scorrimento. Una tabella con tre pesate non
  // deve avere spazio vuoto sotto né una barra che non serve a niente.
  if (altezzeRighe.length <= righe) return null;
  const visibili = altezzeRighe.slice(0, righe);
  const somma = visibili.reduce((tot, h) => tot + h, 0);
  /**
   * ⚠️ `somma <= 0` capita davvero: nei test senza DOM e in una card ancora nascosta le altezze sono
   * tutte zero. Lì si lascia perdere il limite invece di applicarne uno sbagliato — una tabella
   * lunga è un fastidio, una tabella alta zero è una tabella sparita.
   */
  if (somma <= 0) return null;
  // Mezza riga in più: il taglio netto sull'ultima riga si legge come «finita», e chi legge non
  // scorre. La mezza riga scoperta è quello che dice «sotto continua».
  return Math.round(altezzaTesta + somma + (somma / righe) * 0.5);
}
