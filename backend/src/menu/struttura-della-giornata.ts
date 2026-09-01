import { GIORNATA_CINQUE } from '../common/slot-pasto';

/**
 * QUANTI E QUALI PASTI HA LA GIORNATA DI QUESTA CLIENTE.
 *
 * ⛔ **Il difetto che questo file corregge, nato l'1/9 con l'interruttore su `paniere`.**
 *
 * `dayComboPools` prendeva gli slot dalle **chiavi del pool**. Finché il pool si costruiva dalle
 * giornate della dieta di questa cliente era la stessa cosa, e ha funzionato per mesi. Dalla Fase 1
 * il pool arriva dal **paniere**, che è famiglia × regime e raccoglie tutte le varianti che ci
 * versano dentro — comprese quelle con una struttura diversa.
 *
 * ⛔ Il costo non è teorico: una cliente a **3 pasti** il cui paniere contiene anche varianti a 5 si
 * vedeva comporre una giornata da **5 pasti**, cioè kcal in più di quelle che le spettano, senza
 * che niente lo dicesse. Il paniere dice **quali piatti** possono entrare in un pasto; **quanti
 * pasti ci sono** lo dice la sua dieta, e sono due domande diverse.
 *
 * ⚠️ La struttura si legge dalle sue GIORNATE e non da `pastiAttesi(diet)`: quella funzione non
 * conosce la giornata da **quattro** pasti e la tratta come un tre (commento in
 * `giornate-complete.ts`), quindi userebbe la dichiarazione per togliere un pasto che la cliente
 * riceve davvero.
 */
export function slotDaComporre(opzioni: {
  /** Gli slot che le giornate della SUA dieta prevedono. È la voce che comanda. */
  strutturaDellaDieta?: ReadonlySet<string> | null;
  /** Ripiego per chi non la passa: le chiavi del pool, cioè il comportamento di prima. */
  chiaviDelPool: Iterable<string>;
  /** La finestra del digiuno e gli spuntini tolti da Vera. */
  salta?: ReadonlySet<string> | null;
}): string[] {
  const { strutturaDellaDieta, chiaviDelPool } = opzioni;
  const salta = opzioni.salta ?? new Set<string>();

  const base = strutturaDellaDieta && strutturaDellaDieta.size > 0
    ? [...strutturaDellaDieta]
    : [...chiaviDelPool];

  const tutti = inOrdineDiPasto(base);
  const rimasti = tutti.filter((s) => !salta.has(s));
  /**
   * ⚠️ Rete di sicurezza, già qui prima di questa correzione: se la finestra svuotasse la giornata
   * si ignora il filtro. Meglio un digiuno impreciso che una cliente senza niente da mangiare.
   */
  return rimasti.length > 0 ? rimasti : tutti;
}

/**
 * ⚠️ **L'ordine dei pasti, non quello di lettura.** `slots` decide anche in che ordine la giornata
 * esce, e l'ordine di un `Set` è quello in cui si sono lette le righe: finché il JSON delle
 * giornate è in ordine coincidono, ma il giorno che una riga arriva fuori posto la cena finirebbe
 * prima della colazione — il danno scritto nel commento di `collega-ricetta.ts`.
 *
 * ⚠️ Uno slot che non è nella giornata da cinque non sparisce: va **in fondo**, nell'ordine in cui
 * è arrivato. Un pasto che non si vede è un pasto che nessuno verifica.
 */
export function inOrdineDiPasto(elenco: readonly string[]): string[] {
  const canonici = GIORNATA_CINQUE as readonly string[];
  const posto = (s: string): number => {
    const i = canonici.indexOf(s);
    return i < 0 ? canonici.length : i;
  };
  return [...elenco]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => posto(a.s) - posto(b.s) || a.i - b.i)
    .map((x) => x.s);
}
