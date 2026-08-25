import React from 'react';

/**
 * ⛔ **GLI ASTERISCHI CHE LE CLIENTI LEGGEVANO** — voce del 22/8, chiusa il 25/8.
 *
 * In tutto il progetto non è mai esistito un renderer markdown: niente `remark`, niente `marked`,
 * nessun `dangerouslySetInnerHTML`. Eppure decine di testi sono scritti col grassetto di markdown e
 * disegnati come testo semplice — quindi gli asterischi **si leggono**. In chat la cliente vedeva
 * «Hai qualche \*\*allergia\*\* alimentare?».
 *
 * ## ⚠️ Perché QUI si disegna, e altrove si tolgono gli asterischi
 *
 * Il censimento del 25/8 ha contato **108 stringhe** con `**` fuori dalla pagina Lavori, su tre
 * superfici diverse. La risposta non è la stessa per tutte, e dipende da **quante strade fa quella
 * stringa**:
 *  · il testo di una bolla di chat resta dentro la bolla — la push che avvisa la cliente ha un corpo
 *    generico («Apri la chat per leggere il messaggio»), quindi qui l'enfasi si può disegnare;
 *  · il corpo di una **notifica** o di una **email** viaggia dove un renderer non ci sarà mai: lì gli
 *    asterischi si tolgono dal testo, ed è quello che si è fatto (`menu/senza-glutine.ts`,
 *    `clients/visita-da-fissare.ts`, `commerce/annulla-abbonamento.ts`).
 *
 * ## ⛔ Perché non `dangerouslySetInnerHTML`, che sarebbe stato più corto
 *
 * Nelle bolle finisce anche quello che scrive **una persona** — la cliente, la coach. Trattarlo come
 * HTML vorrebbe dire che chi scrive in chat può scrivere uno `<script>`. Qui si costruiscono
 * **elementi React**: quello che non è `**grassetto**` resta testo, e non c'è nessuna strada per cui
 * diventi markup.
 *
 * ## ⚠️ È il GEMELLO di `backoffice/src/components/TestoConGrassetto.tsx`
 *
 * App e back office sono due progetti separati, senza un pacchetto in comune: questa è per forza una
 * seconda copia. Le due si comportano uguale, e `testo-con-grassetto.spec.ts` (qui) e
 * `testoConGrassetto.spec.ts` (là) tengono ferma la stessa tabella di casi. Chi cambia una regola qui
 * la cambi anche là — o la chat dell'app e quella di Vera cominceranno a leggersi in due modi.
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
