/**
 * Lettura di un campo numerico di misura (peso, vita, fianchi, cosce).
 *
 * Sembra banale e non lo è: `Number('')` fa **0**, e uno zero è un numero valido a tutti gli
 * effetti. Un campo lasciato **vuoto** partiva quindi come `hipsCm: 0`, il backend lo rifiutava
 * con «hipsCm must not be less than 40», e alla cliente arrivava quel messaggio in inglese sotto
 * un pulsante che sembrava semplicemente non funzionare.
 *
 * È successo davvero (segnalato da una cliente il 7/8, sulla pagina Obiettivo): correggeva peso e
 * vita, lasciava i fianchi vuoti perché non li aveva mai misurati, e la correzione non si
 * salvava. La stessa funzione, nel popup delle misure, aveva il controllo `> 0` e infatti lì
 * funzionava: due copie della stessa lettura, una giusta e una no.
 *
 * Ora la lettura è una sola. Vuoto o non numerico → `undefined`, cioè «non lo mando»: il campo
 * resta com'era, che è esattamente quello che si aspetta chi lascia una casella in bianco.
 */
export function parseMisura(s: string | null | undefined): number | undefined {
  const t = String(s ?? '').trim();
  if (t === '') return undefined;
  const n = Number(t.replace(',', '.'));
  // Lo zero e i negativi non sono misure: nessun peso, nessuna circonferenza vale 0.
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
