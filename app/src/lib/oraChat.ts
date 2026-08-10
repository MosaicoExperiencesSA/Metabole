/**
 * DATA E ORA DEI MESSAGGI IN CHAT.
 *
 * Segnalazione di Simone dell'11/8: «in app non c'è data e ora delle chat». Era vero: il dato
 * (`sentAt`) arrivava dal server e non veniva mostrato da nessuna parte, quindi una conversazione
 * lunga era un muro di bolle senza tempo — e non si capiva se una risposta della coach fosse di
 * dieci minuti o di tre giorni prima. Su una chat dove si aspetta la nutrizionista, quella è
 * l'informazione più importante dopo il testo.
 *
 * ## Perché il giorno sta in un separatore e l'ora dentro la bolla
 *
 * Scrivere la data intera su ogni messaggio raddoppia il rumore e non aggiunge niente: dentro la
 * stessa giornata la data è sempre la stessa. Quindi il **giorno** compare una volta, come riga in
 * mezzo alla conversazione, e cambia solo quando cambia; l'**ora** sta su ogni messaggio, perché
 * quella cambia sempre.
 *
 * È come funzionano tutte le chat che la cliente già usa — e in un'app che parla a chi non ha
 * voglia di imparare niente, somigliare a WhatsApp è una scelta tecnica, non estetica.
 */

/** «14:32». Ora locale del telefono: è quella che la persona ha in testa. */
export function oraBreve(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

const soloGiorno = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * «Oggi», «Ieri», «lunedì 4 agosto», e con l'anno quando non è quest'anno.
 *
 * «Oggi» e «Ieri» invece della data non sono un vezzo: sono le due parole che una persona usa
 * davvero, e leggere «11 agosto» per intendere oggi costringe a fare un calcolo.
 */
export function etichettaGiorno(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const oggi = new Date();
  const ieri = new Date(oggi.getTime() - 86_400_000);
  if (soloGiorno(d) === soloGiorno(oggi)) return 'Oggi';
  if (soloGiorno(d) === soloGiorno(ieri)) return 'Ieri';
  const stessoAnno = d.getFullYear() === oggi.getFullYear();
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(stessoAnno ? {} : { year: 'numeric' }),
  });
}

/**
 * L'etichetta del giorno da mostrare PRIMA di questo messaggio, o `null` se è lo stesso giorno del
 * messaggio precedente. `precedente` assente = primo messaggio della conversazione, e lì il giorno
 * va scritto sempre.
 */
export function separatoreGiorno(
  precedente: string | null | undefined,
  corrente: string | null | undefined,
): string | null {
  if (!corrente) return null;
  const c = new Date(corrente);
  if (Number.isNaN(c.getTime())) return null;
  if (!precedente) return etichettaGiorno(corrente);
  const p = new Date(precedente);
  if (Number.isNaN(p.getTime())) return etichettaGiorno(corrente);
  return soloGiorno(p) === soloGiorno(c) ? null : etichettaGiorno(corrente);
}
