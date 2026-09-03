/**
 * ⛔ **LA STESSA DOMANDA DELL'APP, PER CHI CORREGGE DAL BACKOFFICE**
 * (voce `pesata-strana-chiedi-conferma`).
 *
 * `PATCH /admin/clients/:id/measurements/:id` accetta **25–400 kg** — più largo del DTO della
 * cliente — quindi questo è il punto in cui una pesata impossibile può *nascere*, dalle mani di chi
 * la sta sistemando. `GET .../measurements/verifica` risponde, in sola lettura, se il numero che si
 * sta scrivendo non torna con le righe che gli stanno attorno.
 *
 * ## ⚠️ Perché queste venti righe assomigliano a quelle dell'app
 *
 * Sono un gemello di `app/src/lib/pesataDaConfermare.ts`: i due frontend sono due build separate
 * senza un pacchetto in comune, e mettercelo per due funzioni di lettura difensiva costerebbe più
 * di quello che risparmia. ⛔ **Quello che NON è copiato è la regola**: le soglie e il confronto
 * stanno sul server (`backend/src/signals/pesata-da-confermare.ts`, Parametri), e da qui arriva già
 * la frase da mostrare. Se un domani si copiasse anche quella, la schermata direbbe «va bene» un
 * istante prima che il guardrail apra la segnalazione.
 */

/** La domanda in sospeso: la frase da mostrare e il numero per cui è stata fatta. */
export interface DomandaInSospeso {
  frase: string;
  pesoScritto: number;
}

/**
 * La frase da mostrare, o `null` se non c'è niente da chiedere.
 *
 * ⛔ **Qualunque cosa di storto vale «non chiedere»**, mai «blocca»: è una cortesia, non un
 * permesso. Se la rotta cade, la correzione deve poter partire lo stesso — chi la sta facendo di
 * solito sta riparando qualcosa, e lasciarlo fuori è il modo di trasformare un aiuto in un ostacolo.
 */
export function leggiFrase(risposta: unknown): string | null {
  if (!risposta || typeof risposta !== 'object') return null;
  const f = (risposta as { frase?: unknown }).frase;
  if (typeof f !== 'string') return null;
  const pulita = f.trim();
  return pulita ? pulita : null;
}

/**
 * Va richiesto al server, o la risposta che ho già vale ancora?
 *
 * ⚠️ Vale solo per **lo stesso identico numero**: se la domanda era su 113 e adesso c'è scritto 73,
 * il «confermo» di prima parlava di un altro peso.
 */
export function serveChiedere(gia: DomandaInSospeso | null | undefined, adesso: number): boolean {
  if (!gia) return true;
  return gia.pesoScritto !== adesso;
}

/**
 * Il giorno della riga che si sta correggendo, in `YYYY-MM-DD`.
 *
 * ⛔ **Senza, la domanda si farebbe sulla coppia sbagliata.** Dal backoffice si corregge anche una
 * pesata di due mesi fa: se non si dice al server quale giorno si sta scrivendo, lui prende oggi e
 * confronta il numero con le righe di adesso — cioè risponde su due misure che non c'entrano niente
 * con quella che si ha davanti.
 */
export function giornoDellaRiga(date: string | null | undefined): string | undefined {
  const iso = String(date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : undefined;
}
