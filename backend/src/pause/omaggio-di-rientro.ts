/**
 * L'OMAGGIO DI RIENTRO DURANTE LA PAUSA — la porta, e perché ne serve una.
 *
 * Richiesta di Simone del 27/8: *«mentre il cliente è in vacanza monitora il peso (lo fa inserire
 * quando vuole) e se vede un grosso aumento gli suggerisce 4 giorni di menu tra quelli che gli
 * hanno reso di più. Vale solo per chi ha un percorso in corso e sospende.»*
 *
 * ⛔ **PERCHÉ QUESTA PORTA ESISTE, ED È LA GUARDIA (a) DEL 27/8.**
 *
 * Tutto il motore si ferma quando il piano è sospeso, e quella regola ha una ragione: la cliente ha
 * chiesto di non ricevere menu. L'omaggio è l'unica eccezione — ed è un'eccezione **voluta**, non
 * una dimenticanza.
 *
 * ⚠️ La tentazione era metterla dentro il controllo «piano fermo», con un `if` in più. Sarebbe
 * stato l'errore: da quel momento la condizione «si eroga a piano sospeso» vivrebbe **dentro il
 * cancello**, e il prossimo pezzo di codice che passa di lì la erediterebbe senza saperlo. Un
 * cancello con un buco dentro non è più un cancello, è una porta che qualcuno ha lasciato
 * accostata — e nessuno dei due lo vede dal proprio lato.
 *
 * Qui l'eccezione ha un nome, una firma e un file: chi la usa la chiama, e chi legge il cancello
 * continua a leggere «a piano fermo non si eroga», che resta vero per tutti gli altri.
 *
 * ⛔ **E l'omaggio non passa da `deliverIfEligible`**: `generateRientroMenus` scrive le giornate
 * direttamente, ed è l'unico posto del progetto che lo fa. Va detto perché è la ragione tecnica per
 * cui l'eccezione funziona senza toccare il cancello — non un dettaglio implementativo.
 */

/** Quello che serve per decidere. Tutto già letto da chi chiama: qui non si tocca il database. */
export interface StatoPerOmaggio {
  /** Il peso del giorno in cui la pausa è cominciata. `null` = non l'abbiamo mai pesata. */
  refWeightKg: number | null;
  /** L'ultima pesata, quella che la cliente inserisce quando vuole. `null` = non ne ha mandate. */
  ultimaPesataKg: number | null;
  /** Quanti kg sopra il riferimento fanno scattare l'omaggio. */
  sogliaKg: number;
  /** Quando le è stato dato l'ultimo omaggio di rientro, se mai. */
  ultimoOmaggioIl: Date | null;
  /** Oggi. */
  oggi: Date;
}

export type EsitoOmaggio =
  | { spetta: true; deltaKg: number }
  /**
   * ⚠️ I «no» sono **quattro e distinti**, e non è pedanteria: chi legge i log deve poter dire se
   * una cliente non ha ricevuto l'omaggio perché non è ingrassata, perché non si pesa, o perché
   * l'ha già avuto questo mese. Un booleano solo li appiattirebbe in «niente da fare», che è la
   * frase da cui non si impara niente.
   */
  | { spetta: false; perche: 'mai_pesata' | 'nessuna_pesata_recente' | 'sotto_soglia' | 'gia_avuto_questo_mese' };

/**
 * ⚠️ **«UNA VOLTA PER MESE SOLARE», ED È IL MESE DEL CALENDARIO — non trenta giorni.**
 *
 * È la guardia (b) del 27/8, e la forma la decide un precedente del progetto: il report mensile,
 * dove *«la notifica del mese fa da marcatore»*. Trenta giorni sarebbe più "giusto" in astratto e
 * molto peggio da spiegare: una cliente che riceve l'omaggio il 30 giugno e lo rivuole il 2 agosto
 * non capirebbe perché deve aspettare, e avrebbe ragione.
 *
 * ⛔ E soprattutto: senza un segno che dura, **un cron che gira due volte in una notte regala
 * l'omaggio due volte**. Il segno è una data scritta sulla pausa, non un conteggio in memoria.
 */
export const stessoMeseSolare = (a: Date, b: Date): boolean =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

/**
 * ⚠️ **Una pesata vecchia non è una pesata.** Durante la pausa la cliente si pesa quando vuole, e
 * il confronto usa «l'ultima»: senza un limite, una pesata di sei settimane fa farebbe scattare
 * l'omaggio oggi su un peso che non è più il suo — o, peggio, lo farebbe scattare **all'infinito**
 * ogni mese, perché quella pesata resta l'ultima finché non ne manda un'altra.
 */
export const GIORNI_PESATA_ANCORA_BUONA = 21;

/** L'omaggio spetta? */
export function spettaLOmaggio(s: StatoPerOmaggio, ultimaPesataIl: Date | null = null): EsitoOmaggio {
  if (s.refWeightKg == null || s.refWeightKg <= 0) return { spetta: false, perche: 'mai_pesata' };
  if (s.ultimaPesataKg == null) return { spetta: false, perche: 'mai_pesata' };

  if (ultimaPesataIl) {
    const giorni = (s.oggi.getTime() - ultimaPesataIl.getTime()) / 86_400_000;
    if (giorni > GIORNI_PESATA_ANCORA_BUONA) return { spetta: false, perche: 'nessuna_pesata_recente' };
  }

  const delta = s.ultimaPesataKg - s.refWeightKg;
  if (delta < s.sogliaKg) return { spetta: false, perche: 'sotto_soglia' };

  /**
   * ⚠️ Il controllo del mese va **per ultimo**, dopo la soglia: così chi legge «già avuto questo
   * mese» sa che l'omaggio le sarebbe spettato davvero — e quella è un'informazione, mentre
   * «già avuto» su una che non è ingrassata non direbbe niente a nessuno.
   */
  if (s.ultimoOmaggioIl && stessoMeseSolare(s.ultimoOmaggioIl, s.oggi)) {
    return { spetta: false, perche: 'gia_avuto_questo_mese' };
  }

  return { spetta: true, deltaKg: Math.round(delta * 10) / 10 };
}
