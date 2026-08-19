/**
 * QUALI ETICHETTE STANNO SULL'ASSE, QUANDO I PUNTI SONO TANTI.
 *
 * `MiniTrend` scriveva **tutti** i mesi sotto il grafico. Andava bene finché i punti erano tre o
 * quattro; dal 19/8 i grafici della contabilità mostrano **dodici mesi**, e dodici «ago 26» larghi
 * ~35 px su una scheda da 320 px si sovrappongono fino a diventare una riga grigia illeggibile —
 * cioè un asse che non dice più a che mese sei.
 *
 * ⚠️ **L'ULTIMA SI TIENE SEMPRE, E IL DIRADAMENTO PARTE DA LEI.** L'ultimo punto è il mese che si
 * sta guardando, quello a cui corrispondono i numeri grandi in cima alla pagina: se sparisse
 * l'etichetta, il grafico direbbe un numero senza dire di quando. Contando all'indietro da lei, i
 * mesi mostrati cadono sempre alla stessa distanza — contando in avanti dal primo, l'ultima
 * etichetta finirebbe a caso e a volte attaccata alla penultima.
 *
 * ⚠️ Non è un problema di stile: un'etichetta illeggibile e un'etichetta assente sono la stessa
 * cosa, ma la prima sembra che qualcuno l'abbia messa apposta.
 */
export function etichetteDaMostrare(quante: number, massimo = 6): boolean[] {
  if (quante <= 0) return [];
  // Con pochi punti si scrivono tutti: è il caso della dashboard e dei grafici clienti.
  if (quante <= massimo) return Array.from({ length: quante }, () => true);
  const passo = Math.ceil(quante / massimo);
  // `(quante - 1 - i) % passo === 0`: si conta all'indietro dall'ultimo, che è sempre incluso.
  return Array.from({ length: quante }, (_v, i) => (quante - 1 - i) % passo === 0);
}
