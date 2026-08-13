/**
 * APRIRE UNA DOMANDA PER LA NUTRIZIONISTA — la porta che l'altra sessione chiama.
 *
 * Contratto: `progetto/CONTRATTO_Vera_Richieste.md` (13/8/2026). Quando il sistema incontra qualcosa
 * che **non sa tradurre** — un'allergia scritta a mano come «Favismo», che oggi non toglie un solo
 * piatto perché quella parola non compare in nessun ingrediente — non inventa e non blocca: apre una
 * domanda, e la domanda arriva a chi sa rispondere.
 *
 * ## ⚠️ È una FUNZIONE, non un servizio da iniettare
 *
 * Stessa forma di `registra-sostituzione.ts`, e per la stessa ragione: chi chiama sta dentro il
 * percorso che costruisce la base personale o salva il questionario, e legare quel percorso a un
 * modulo di backoffice vorrebbe dire che un problema qui può far fallire il salvataggio di una
 * cliente. Prende `prisma` e basta.
 *
 * ## ⚠️ Non lancia mai
 *
 * Sta in fondo a operazioni che devono riuscire comunque. Una domanda non aperta è un lavoro in più
 * per qualcuno; un'eccezione qui è un questionario che non si salva. Ma l'errore **si scrive nei
 * log**: una coda che smette di riempirsi in silenzio è peggio di una coda vuota, perché sembra che
 * non ci sia niente da fare.
 */
import { Logger } from '@nestjs/common';
import { normalizza } from '../common/nomi-alimento';
import type { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('RichiesteVera');

export type TipoRichiesta = 'allergia_da_tradurre' | 'intolleranza_da_tradurre';

export interface RichiestaDaAprire {
  tipo: TipoRichiesta;
  clienteId: string;
  /** La domanda già scritta, in italiano, pronta da leggere: la scrive chi sa cosa manca. */
  testo: string;
  /** Chi l'ha aperta: `personal-base` | `scheda-cliente` | `campagna-allergie` … */
  origine: string;
  /**
   * L'idempotenza. Forma: `allergia:<clientId>:<termine normalizzato>`.
   * Se non la passi la costruisco da tipo+cliente+testo, ma è meglio passarla: il testo può cambiare
   * (una virgola, una maiuscola) e allora la stessa domanda tornerebbe a essere nuova.
   */
  chiave?: string;
  /**
   * La parola che non si sa tradurre («Favismo»). Facoltativa ma consigliata: serve al passo «vale
   * per tutte?». Se non la passi la leggo fra le virgolette del testo, e se non c'è nemmeno lì
   * scrivo solo sulla cliente — il ripiego che non sbaglia.
   */
  termine?: string;
}

/** La parola fra virgolette basse, che è la forma con cui il contratto scrive le domande. */
export const termineDalTesto = (testo: string): string | null => {
  const m = /[«"']([^»"']{2,60})[»"']/.exec(testo ?? '');
  return m ? m[1].trim() : null;
};

export interface EsitoRichiesta {
  /** `false` se esisteva già: **non è un errore**, ed è il caso normale dopo la prima notte. */
  creata: boolean;
  id: string | null;
}

/** La chiave di riserva, quando chi chiama non ne passa una. */
export const chiaveRichiesta = (tipo: string, clienteId: string, termine: string): string =>
  `${tipo.split('_')[0]}:${clienteId}:${normalizza(termine).slice(0, 120)}`;

/**
 * Apre la domanda, una volta sola.
 *
 * ⚠️ La notifica parte **solo alla creazione vera**, mai su una riapertura: è il motivo per cui qui
 * si guarda l'esito della scrittura invece di notificare e basta. Una notifica ripetuta ogni notte
 * per la stessa domanda è il modo più rapido per insegnare a ignorare le notifiche.
 */
export async function apriRichiestaVera(prisma: PrismaService, dati: RichiestaDaAprire): Promise<EsitoRichiesta> {
  try {
    if (!dati?.clienteId || !dati?.testo?.trim()) return { creata: false, id: null };
    const chiave = dati.chiave?.trim() || chiaveRichiesta(dati.tipo, dati.clienteId, dati.testo);

    // Prima si guarda: la stragrande maggioranza delle chiamate è una ripetizione, e una lettura
    // costa meno di una scrittura che fallisce sul vincolo.
    const gia = (await prisma.richiestaVera.findUnique({ where: { chiave }, select: { id: true } })) as { id: string } | null;
    if (gia) return { creata: false, id: gia.id };

    const profilo = (await prisma.clientProfile.findUnique({
      where: { userId: dati.clienteId },
      select: { name: true, assignedNutritionist: { select: { userId: true } } },
    })) as { name: string | null; assignedNutritionist: { userId: string } | null } | null;

    let riga: { id: string };
    try {
      riga = (await prisma.richiestaVera.create({
        data: {
          chiave,
          tipo: dati.tipo,
          clienteId: dati.clienteId,
          clienteNome: profilo?.name ?? null,
          // `null` = nessuna nutrizionista assegnata. La domanda esiste lo stesso e la vede il capo:
          // sparire perché manca un'assegnazione sarebbe il modo di perderla proprio nei casi
          // in cui qualcosa è già storto.
          nutrizionistaId: profilo?.assignedNutritionist?.userId ?? null,
          testo: dati.testo.trim(),
          termine: dati.termine?.trim() || termineDalTesto(dati.testo),
          origine: dati.origine || 'sconosciuta',
        } as never,
      })) as { id: string };
    } catch (err) {
      // Due chiamate insieme sulla stessa chiave: la seconda perde la corsa, e va bene così.
      const esistente = (await prisma.richiestaVera.findUnique({ where: { chiave }, select: { id: true } })) as { id: string } | null;
      if (esistente) return { creata: false, id: esistente.id };
      throw err;
    }

    await avvisa(prisma, profilo?.assignedNutritionist?.userId ?? null, dati, riga.id);
    return { creata: true, id: riga.id };
  } catch (err) {
    logger.warn(
      `Richiesta non aperta (cliente=${dati?.clienteId}, origine=${dati?.origine}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return { creata: false, id: null };
  }
}

/**
 * L'avviso alla nutrizionista, una volta sola.
 *
 * ⚠️ `title` e `body` vivono **dentro `payload`**: la tabella `notification` non ha quelle colonne, e
 * scriverle come campi fa esplodere Prisma a runtime (è già successo con l'avviso senza glutine).
 */
async function avvisa(prisma: PrismaService, userId: string | null, dati: RichiestaDaAprire, richiestaId: string) {
  if (!userId) return;
  await prisma.notification
    .create({
      data: {
        userId,
        type: 'vera_richiesta',
        channel: 'inapp',
        payload: {
          title: 'Una domanda che aspetta te',
          body: dati.testo.slice(0, 160),
          kind: 'vera_richiesta',
          richiestaId,
        },
        scheduledFor: new Date(),
        sentAt: new Date(),
      } as never,
    })
    .catch(() => undefined);
}
