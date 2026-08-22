import React from 'react';

/**
 * ⛔ **IL GRASSETTO NELLE VOCI DEI LAVORI — 103 su 155 lo scrivevano e nessuno lo disegnava.**
 *
 * Trovato il 22/8 **guardando la pagina vera**, di rimbalzo da un difetto identico sulle attività.
 * `Lavori.tsx` disegna `{l.dettaglio}` come testo semplice: le voci sono scritte in markdown da
 * mesi, quindi Simone legge `⛔ **Trovato misurando**` con gli asterischi in mezzo, su più di due
 * terzi dell'elenco che usa per decidere cosa si fa.
 *
 * ## ⛔ PERCHÉ NON `dangerouslySetInnerHTML`, che sarebbe stato più corto
 *
 * Il dettaglio di un lavoro **si scrive dalla pagina**: c'è una `textarea` e un `testoAMano`. È
 * testo di una persona, non una costante del codice — trattarlo come HTML vorrebbe dire che chi
 * scrive una voce può scrivere uno `<script>`. Qui si costruiscono **elementi React**: quello che
 * non è `**grassetto**` resta testo, e non c'è nessuna strada per cui diventi markup.
 *
 * ## ⚠️ SOLO IL GRASSETTO, di proposito
 *
 * Niente titoli, elenchi, link, corsivo. ⛔ Un renderer markdown completo su un campo scritto a mano
 * è una superficie che va poi mantenuta, e la domanda «cosa succede se scrivo questo» smette di
 * avere una risposta corta. Il grassetto copre quello che le voci usano davvero; il resto — i `##`
 * di quattro voci, i backtick — resta com'è e si legge lo stesso.
 *
 * ## ⚠️ E i testi delle ATTIVITÀ restano senza markdown
 *
 * Potrebbe sembrare che questo componente permetta di rimettere i `**` nei testi delle attività,
 * corretti lo stesso giorno. **No**: quei testi finiscono anche nel **corpo delle push**
 * (`avvisi-attivita.ts`), dove non c'è nessun renderer e non ci sarà mai. Un testo che si legge bene
 * solo dove qualcuno lo interpreta è un testo che si rompe appena cambia strada.
 */

/** Il pezzo di stringa fra `**` e `**`, con quello che sta prima e dopo. */
const PEZZI = /\*\*([^*]+)\*\*/g;

export function TestoConGrassetto({ testo }: { testo: string }): React.ReactElement {
  const parti: React.ReactNode[] = [];
  let ultimo = 0;
  let n = 0;
  for (const m of testo.matchAll(PEZZI)) {
    const inizio = m.index ?? 0;
    if (inizio > ultimo) parti.push(testo.slice(ultimo, inizio));
    parti.push(<b key={`b${n++}`}>{m[1]}</b>);
    ultimo = inizio + m[0].length;
  }
  // ⚠️ La coda va sempre aggiunta, anche quando non c'è nessun grassetto: senza, un testo senza
  // asterischi uscirebbe **vuoto** — cioè il caso più comune sarebbe l'unico rotto.
  if (ultimo < testo.length) parti.push(testo.slice(ultimo));
  return <>{parti}</>;
}
