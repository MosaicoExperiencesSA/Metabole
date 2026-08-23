import { aGiorno } from '../common/date-only';
import { giornoDiRientro } from './giorno-di-rientro';
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
export async function treguaFraVacanze(
  prisma: PrismaService,
  leggiParametro: (chiave: string, predefinito: number) => Promise<number>,
  clientId: string,
  inizioNuova: Date,
): Promise<EsitoTregua> {
  const minimo = Math.floor(await leggiParametro('pause_min_gap_days', 15));
  if (!Number.isFinite(minimo) || minimo <= 0) return { mancano: 0, minimo: 0, ultimoRientro: null };
  const inizio = aGiorno(inizioNuova);
  const precedente = (await prisma.event.findFirst({
    where: { clientId, mode: 'pause_period' as never, endDate: { lt: inizio } } as never,
    orderBy: { endDate: 'desc' },
    select: { startDate: true, endDate: true },
  })) as { startDate: Date; endDate: Date } | null;
  if (!precedente) return { mancano: 0, minimo, ultimoRientro: null };
  const rientro = giornoDiRientro(precedente);
  const passati = Math.floor((inizio.getTime() - rientro.getTime()) / 86_400_000);
  return { mancano: Math.max(0, minimo - passati), minimo, ultimoRientro: rientro };
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
