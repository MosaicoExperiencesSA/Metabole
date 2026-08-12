import { LeadsTable } from './LeadsTable';

/**
 * ELENCO CLIENTI = la tabella di Gestione lead, con il filtro «ha pagato» inchiodato.
 *
 * §16.4, richiesta di Simone dell'11/8: «uniformare le tabelle Clienti e Gestione lead, devono
 * essere uguali a Gestione lead» e «contenere solo gli utenti che hanno effettuato un acquisto di
 * valore maggiore di 0».
 *
 * Qui c'erano 200 righe che facevano *quasi* le stesse cose di `LeadsTable`: stessa idea di filtri,
 * ordinamento e ricerca, scritti una seconda volta. Due copie non restano uguali — l'ultima
 * divergenza in ordine di tempo sono stati i filtri fissi in cima, che una aveva e l'altra no — e
 * ogni richiesta di Simone («lo stato in pipeline», «le pastiglie si vedano poco») andava applicata
 * due volte, o si dimenticava.
 *
 * Quindi non una tabella che le somiglia: **la stessa**. Quello che cambia lo dice `modo`.
 *
 * Cosa si guadagna, oltre a non riscrivere: la ricerca e i filtri lavorano **sul database** e non
 * sulle 500 righe caricate. Il vecchio elenco filtrava in memoria e lo diceva con un avviso
 * («mostro le 500 più recenti di N»): adesso quell'avviso non serve più, perché non è più vero.
 */
export function Clienti() {
  return <LeadsTable modo="clienti" />;
}
