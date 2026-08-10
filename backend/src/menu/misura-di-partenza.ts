/**
 * SENZA UNA MISURA DI QUESTO PIANO IL MENU NON PARTE. Anche a costo di due pesate di fila.
 *
 * Segnalazione di una cliente (11/8), riportata da Simone: «non mi sono state richieste le misure, ma
 * i menu li ho ricevuti». Aveva ragione su tutt'e due i pezzi, e sono due difetti diversi.
 *
 * ## Difetto 1 — il gate si accontentava di qualunque misura
 *
 * Il controllo era questo, in tre punti del servizio menu:
 *
 * ```ts
 * const hasMeasure = await this.prisma.measurement.count({ where: { clientId } });
 * if (hasMeasure === 0) return [];
 * ```
 *
 * Nessun filtro sulla data, nessun legame col piano. La cliente in questione aveva pesate dal **20
 * luglio**; il suo piano è partito il **6 agosto**: alla partenza il gate risultava già soddisfatto da
 * misure che appartenevano a un'altra stagione della sua storia. Quindi niente popup, niente blocco,
 * menu erogati dal primo giorno — e nessuno che le chiedesse niente.
 *
 * ## La regola, decisa da Simone
 *
 * «Ci serve **sempre** una misura per erogare il menu, anche a costo di registrare due misure
 * consecutive.» Non si riusa una pesata vecchia per far partire un piano nuovo: se si è pesata la
 * settimana prima, le si chiede di rifarlo. Il costo è due righe vicine nel diario; il beneficio è che
 * il punto A di ogni percorso è una misura presa **per quel percorso**, e il confronto A→B alla fine
 * significa qualcosa.
 *
 * ## Quanto indietro può stare quella misura: non un numero, la finestra del piano
 *
 * La tentazione era un parametro tipo «vale se è degli ultimi 7 giorni». Ma un numero arbitrario apre
 * di nuovo la porta a pesate che col piano non hanno niente a che fare, e va tarato da qualcuno che non
 * saprebbe su cosa.
 *
 * Il confine giusto esiste già: il menu diventa visibile `menu_visible_days_before_start` giorni prima
 * dell'inizio, e **quello** è il momento in cui il piano comincia a esistere per la cliente. Una pesata
 * fatta dentro quella finestra è una pesata fatta per questo piano; una fatta prima è di un'altra
 * storia. Quindi la finestra del punto A è la stessa finestra della visibilità: nessun parametro nuovo,
 * e nessuna soglia che qualcuno dovrà indovinare.
 *
 * Verso il futuro non c'è limite: una pesata al terzo giorno è comunque la sua partenza, e pretendere il
 * giorno esatto vorrebbe dire tenere fermo il menu di chi ha fatto la cosa giusta in ritardo di un
 * giorno.
 *
 * ## Difetto 2 — nessuno chiedeva niente
 *
 * Il gate sapeva solo **bloccare**: il popup lo vede chi apre l'app, e l'unica notifica che diceva
 * «inserisci le misure adesso» viveva dentro `unlockMeasures`, cioè partiva **soltanto dopo** che una
 * coach aveva sbloccato una cliente già murata fuori. Chi passava il gate non riceveva niente; chi non
 * lo passava riceveva qualcosa solo se apriva l'app da sola. La richiesta esisteva come punizione, non
 * come richiesta. La correzione sta in `chiediMisureDiPartenza` (`menu.service.ts`).
 */

/**
 * Si prende il `PrismaService` vero, come fanno gli altri aiutanti puri del progetto
 * (`rete-staff.ts`, `apri-segnalazione.ts`): nel sandbox il client Prisma è uno stub e un'interfaccia
 * ristretta non gli combacia, quindi ogni file che ci provasse aggiungerebbe errori di compilazione
 * alla soglia. I test passano un oggetto finto con un cast — è il modo in vigore qui.
 */
import type { PrismaService } from '../prisma/prisma.service';

/** Azzera l'ora: `measurement.date` è un giorno, e confrontarlo con un istante sposta il confine. */
const soloGiorno = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Da quale giorno una pesata vale come punto A: da quando il menu di questo piano è visibile.
 *
 * `giorniPrima` è `menu_visible_days_before_start`, lo stesso valore che decide la visibilità — non un
 * secondo parametro che gli somiglia.
 */
export function inizioFinestraPuntoA(inizio: Date, giorniPrima: number): Date {
  const g = Number.isFinite(giorniPrima) && giorniPrima > 0 ? Math.floor(giorniPrima) : 0;
  return new Date(soloGiorno(inizio).getTime() - g * 86_400_000);
}

/**
 * Vero se **manca** la misura di partenza di questo piano.
 *
 * Senza `inizio` torna `false`: un piano senza data di inizio non è ancora partito, e trattenere il
 * menu di chi non ha una partenza vorrebbe dire bloccarlo per sempre senza motivo.
 */
export async function mancaMisuraDiPartenza(
  prisma: PrismaService,
  clientId: string,
  inizio: Date | null | undefined,
  giorniPrima: number,
): Promise<boolean> {
  if (!inizio) return false;
  const da = inizioFinestraPuntoA(inizio, giorniPrima);
  const misura = await prisma.measurement.findFirst({
    where: { clientId, date: { gte: da } },
    select: { id: true },
  });
  return !misura;
}
