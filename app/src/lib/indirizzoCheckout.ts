/**
 * Indirizzo di spedizione nel carrello (16/9, richiesta di Simone).
 *
 * Prima il pulsante «Paga» restava spento finché l'indirizzo era incompleto, e nessuno diceva
 * perché: la cliente sceglieva «Carta» o «Bonifico», non succedeva niente e si fermava lì.
 * Ora, se tocca il metodo di pagamento o il pulsante con l'indirizzo a metà, esce un popup
 * con la scritta rossa e i campi vuoti si colorano di rosso.
 */
export type IndirizzoCheckout = { addressLine: string; postalCode: string; city: string; province: string };

export const AVVISO_INDIRIZZO = 'Completa i dati per procedere';

/** Nell'ordine in cui stanno sullo schermo: il primo è quello su cui si porta il cursore. */
export const CAMPI_INDIRIZZO: { chiave: keyof IndirizzoCheckout; nome: string }[] = [
  { chiave: 'addressLine', nome: 'Via e numero civico' },
  { chiave: 'postalCode', nome: 'CAP' },
  { chiave: 'city', nome: 'Città' },
  { chiave: 'province', nome: 'Provincia' },
];

/** I campi ancora vuoti (gli spazi non contano come dato). */
export function campiMancanti(a: IndirizzoCheckout): (keyof IndirizzoCheckout)[] {
  return CAMPI_INDIRIZZO.filter((c) => !(a[c.chiave] ?? '').trim()).map((c) => c.chiave);
}

export function nomeCampo(chiave: keyof IndirizzoCheckout): string {
  return CAMPI_INDIRIZZO.find((c) => c.chiave === chiave)?.nome ?? chiave;
}
