import { aGiorno, giornoDelDato } from '../common/date-only';
import { giornoDiRientro } from './giorno-di-rientro';
import { primoGiornoUtile } from './primo-giorno-utile';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * ⛔ **QUINDICI GIORNI FRA UNA VACANZA E L'ALTRA** — decisione di Simone, 23/8.
 *
 * *«Dopo una vacanza, per 15 giorni non se ne può attivare un'altra: va chiesto alla coach, che
 * attiva a mano dal back office.»*
 *
 * Non è una regola tecnica, è una regola di percorso: due sospensioni attaccate sono un percorso
 * che non comincia mai, e la scadenza che slitta ogni volta lo nasconde.
 *
 * ## Dove ferma e dove no
 *
 * Ferma sulle porte della **cliente** — la richiesta di pausa dall'app e il «Periodo (più giorni)»
 * del suo Calendario, che creano lo stesso `pause_period` — e **non** sulla card del back office,
 * che è per definizione l'attivazione a mano che la regola stessa prevede. Là il numero si dice a
 * chi decide, e decide lei.
 *
 * ⚠️ **Sta in un file suo, e non è un metodo di `PauseService`**, per un motivo preciso: la seconda
 * porta è `calendar/events.service.ts`, e `PauseModule` importa (per vie traverse) `MenuModule`, che
 * importa `CalendarModule`. Iniettare il servizio avrebbe chiuso un anello fra moduli. Una funzione
 * pura che si prende quello che le serve non ne chiude nessuno — è lo stesso schema di
 * `misura-di-partenza.ts` e `apri-segnalazione.ts`.
 */
export interface EsitoTregua {
  /** Giorni che mancano alla fine della tregua. `0` = si può fare. */
  mancano: number;
  /** Il minimo in vigore (dai Parametri), per poterlo dire nel messaggio. */
  minimo: number;
  /** Il rientro dalla vacanza precedente, se ce n'è una. */
  ultimoRientro: Date | null;
}

/**
 * @param leggiParametro come `ConfigParamsService.getNumber`: la tregua si cambia dai Parametri
 *   (`pause_min_gap_days`), senza un rilascio.
 */
/**
 * ⛔ **QUANTI GIORNI DI TREGUA SONO IN VIGORE** — una lettura sola del parametro, 25/8.
 *
 * Serve fuori di qui perché `primoGiornoUtile` lo prende come argomento: le due porte della cliente
 * devono **proporre** la data con la stessa tregua con cui poi la **rifiutano**. ⛔ Nella prima
 * stesura non era così — proponevano con tregua zero e rifiutavano con quindici — e la revisione
 * l'ha riprodotto: il sistema diceva alla cliente «puoi cominciare dal 31/08», lei chiedeva il
 * 31/08, e si sentiva rispondere «ne mancano 15». Un vicolo cieco costruito da noi.
 */
export async function giorniDiTregua(
  leggiParametro: (chiave: string, predefinito: number) => Promise<number>,
): Promise<number> {
  const minimo = Math.floor(await leggiParametro('pause_min_gap_days', 15));
  return Number.isFinite(minimo) && minimo > 0 ? minimo : 0;
}

export async function treguaFraVacanze(
  prisma: PrismaService,
  leggiParametro: (chiave: string, predefinito: number) => Promise<number>,
  clientId: string,
  inizioNuova: Date,
): Promise<EsitoTregua> {
  const minimo = await giorniDiTregua(leggiParametro);
  if (minimo <= 0) return { mancano: 0, minimo: 0, ultimoRientro: null };
  const inizio = aGiorno(inizioNuova);
  const precedente = (await prisma.event.findFirst({
    where: { clientId, mode: 'pause_period' as never, endDate: { lt: inizio } } as never,
    orderBy: { endDate: 'desc' },
    select: { startDate: true, endDate: true },
  })) as { startDate: Date; endDate: Date } | null;
  if (!precedente) return { mancano: 0, minimo, ultimoRientro: null };
  /**
   * ⚠️ **L'aritmetica non sta più qui** (25/8): sta in `primo-giorno-utile.ts`, che risponde alla
   * domanda «da quando si può cominciare» per **tutte e tre** le porte. Qui restano le due cose che
   * sono di questo file: quale periodo guardare (il precedente, non quelli futuri) e quanti giorni
   * di tregua sono in vigore.
   *
   * ⚠️ Passando `inizio` come «oggi» la base del conto diventa la data richiesta, e i giorni che
   * mancano sono quanto la risposta si sposta in avanti rispetto a quella. Due sottrazioni della
   * stessa cosa in due file erano due sottrazioni che un giorno divergono — proprio sul numero che
   * la cliente legge in un messaggio d'errore.
   */
  const esito = primoGiornoUtile(inizio, [precedente], minimo);
  const mancano = Math.max(0, Math.round((esito.giorno.getTime() - inizio.getTime()) / 86_400_000));
  return { mancano, minimo, ultimoRientro: giornoDiRientro(precedente) };
}

/**
 * ⛔ **E LA TREGUA VALE ANCHE IN AVANTI** — trovato in revisione, 25/8.
 *
 * `treguaFraVacanze` guarda solo **indietro** (`endDate < inizio`), quindi una sospensione già
 * **programmata dopo** non è mai «la precedente». E la guardia sulle sovrapposizioni non la prende,
 * perché i due periodi non si toccano. Riprodotto: con una vacanza programmata dal 24/9, la cliente
 * chiede 12→19 settembre e passa — fra il suo rientro (20/9) e la partenza dell'altra ci sono
 * **quattro** giorni invece di quindici, e le due sospensioni si attaccano senza passare dalla coach.
 *
 * ⚠️ È la stessa regola, misurata dall'altro capo: fra il **rientro di questa** e la **partenza di
 * quella dopo** devono passare gli stessi giorni. La tregua non ha un verso — dire che ce l'ha era
 * il difetto.
 *
 * @param rientroNuova il primo giorno di dieta dopo la pausa che si sta chiedendo.
 */
export async function treguaVersoLaProssima(
  prisma: PrismaService,
  leggiParametro: (chiave: string, predefinito: number) => Promise<number>,
  clientId: string,
  rientroNuova: Date,
): Promise<{ mancano: number; minimo: number; prossimaPartenza: Date | null }> {
  const minimo = await giorniDiTregua(leggiParametro);
  if (minimo <= 0) return { mancano: 0, minimo: 0, prossimaPartenza: null };
  const rientro = aGiorno(rientroNuova);
  const successiva = (await prisma.event.findFirst({
    where: { clientId, mode: 'pause_period' as never, startDate: { gte: rientro } } as never,
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  })) as { startDate: Date } | null;
  if (!successiva) return { mancano: 0, minimo, prossimaPartenza: null };
  const partenza = giornoDelDato(successiva.startDate);
  const passati = Math.floor((partenza.getTime() - rientro.getTime()) / 86_400_000);
  return { mancano: Math.max(0, minimo - passati), minimo, prossimaPartenza: partenza };
}

/** La frase per il verso in avanti: dice quale sospensione c'è dopo, e da quando si è troppo vicini. */
export function fraseTreguaInAvanti(esito: {
  minimo: number;
  mancano: number;
  prossimaPartenza: Date | null;
}): string {
  const quando = esito.prossimaPartenza
    ? ` Ne hai già una che comincia il ${esito.prossimaPartenza.toLocaleDateString('it-IT', { timeZone: 'UTC' })}.`
    : '';
  return (
    `Questa pausa finirebbe troppo a ridosso della prossima: fra una sospensione e l'altra devono passare `
    + `${esito.minimo} giorni, e ne mancano ${esito.mancano}.${quando} `
    + 'Se ti serve davvero, parlane con la tua coach: può attivarla lei.'
  );
}

/** La frase che legge la CLIENTE quando la tregua non è finita. Una sola, per tutte le porte. */
export function fraseDellaTregua(esito: EsitoTregua): string {
  const quando = esito.ultimoRientro
    ? ` Sei rientrata il ${esito.ultimoRientro.toLocaleDateString('it-IT', { timeZone: 'UTC' })}.`
    : '';
  return (
    `Fra una sospensione e l'altra devono passare ${esito.minimo} giorni: ne mancano ${esito.mancano}.${quando} ` +
    'Se ti serve davvero fermarti adesso, parlane con la tua coach: può attivarla lei.'
  );
}
