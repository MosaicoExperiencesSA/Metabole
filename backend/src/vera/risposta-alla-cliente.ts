/**
 * «DA UNA PARTE O DALL'ALTRA IL NUTRIZIONISTA RISPONDE» — i due gesti che chiudono il giro.
 *
 * Richiesta di Simone del 14/8: le richieste che Gaia gira alla nutrizionista devono arrivare
 * **anche** attraverso l'assistente, restando dove sono già; e la risposta data da una parte deve
 * valere per l'altra. Decisione in `progetto/NOTA_Vera_Porta_I_Girati_Di_Gaia.md`.
 *
 * Funzioni libere che ricevono `prisma`, come `avvisa-capo.ts` e `notifica-utente.ts`: Vera non
 * importa `ChatModule` né `EscalationsModule` — importarli trascinerebbe mezza applicazione nel
 * grafo di compilazione e i test di Vera smetterebbero di girare da soli (regola §4.6 del
 * passaggio di consegne).
 *
 * ⚠️ Nessuna delle due lancia: dicono a chi chiama se hanno fatto il loro lavoro, e chi chiama lo
 * racconta alla nutrizionista invece di far esplodere il dialogo.
 */
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('VeraRispostaAllaCliente');

/** Il prefisso della chiave con cui si apre una domanda nata da un «girato» di Gaia. */
export const CHIAVE_GAIA = 'gaia:';

/**
 * L'id della segnalazione, letto dalla chiave della richiesta (`gaia:<escalationId>`).
 *
 * ⚠️ La chiave è già la chiave di idempotenza — quindi è anche il legame con la segnalazione, e non
 * serve una colonna nuova su una tabella condivisa. `null` su qualunque altra forma: qui non si
 * indovina, e una richiesta di altro tipo non deve chiudere una segnalazione per sbaglio.
 */
export function escalationIdDallaChiave(chiave: string | null | undefined): string | null {
  const k = (chiave ?? '').trim();
  if (!k.startsWith(CHIAVE_GAIA)) return null;
  const id = k.slice(CHIAVE_GAIA.length).trim();
  return id.length ? id : null;
}

export interface RispostaAllaCliente {
  clienteId: string;
  /** Chi ha dettato la risposta: finisce come mittente del messaggio, non «il sistema». */
  autoreId: string;
  ruoloAutore: string;
  testo: string;
}

/**
 * Scrive la risposta nel thread della NUTRIZIONISTA di quella cliente.
 *
 * ⚠️ `upsert` sul thread e non `findFirst`: una cliente che non ha mai scritto alla nutrizionista
 * non ha ancora quel thread, e far fallire la risposta per questo vorrebbe dire che la funzione
 * serve solo a chi ne aveva già bisogno meno.
 *
 * ⚠️ Il mittente è la persona che ha dettato, col suo ruolo: la cliente deve vedere la sua
 * nutrizionista, non un messaggio anonimo. Parlare al posto di qualcun altro ha un'altra strada,
 * dichiarata e tracciata (l'impersonazione).
 */
export async function scriviAllaCliente(prisma: PrismaService, input: RispostaAllaCliente): Promise<boolean> {
  const testo = (input.testo ?? '').trim();
  // Un messaggio vuoto nel thread di una cliente è peggio di nessun messaggio: sembra un guasto.
  if (!testo) return false;
  try {
    const thread = (await prisma.chatThread.upsert({
      where: { clientId_counterpart: { clientId: input.clienteId, counterpart: 'nutritionist' } } as never,
      create: { clientId: input.clienteId, counterpart: 'nutritionist', lastMessageAt: new Date() } as never,
      update: { lastMessageAt: new Date() } as never,
      select: { id: true },
    })) as { id: string };

    await prisma.message.create({
      data: {
        threadId: thread.id,
        senderRole: input.ruoloAutore,
        senderUserId: input.autoreId,
        body: testo,
      } as never,
    });
    return true;
  } catch (err) {
    // Un catch muto è un mistero: qui dentro si è persa una risposta destinata a una persona.
    logger.warn(
      `Risposta alla cliente non scritta (cliente=${input.clienteId}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * Chiude la segnalazione che aveva portato la domanda: è l'altra metà di «da una parte o
 * dall'altra». Senza, la stessa cosa resterebbe aperta in pagina Segnalazioni per sempre.
 *
 * ⚠️ Non lancia: la risposta alla cliente a questo punto è già partita, e quella conta di più.
 * Una segnalazione che resta aperta si chiude a mano; una risposta persa non si recupera.
 */
export async function chiudiSegnalazione(
  prisma: PrismaService,
  escalationId: string | null,
  attoreId: string,
): Promise<boolean> {
  if (!escalationId) return false;
  try {
    await prisma.escalation.update({
      where: { id: escalationId },
      data: { status: 'resolved', resolvedAt: new Date(), assignedToId: undefined } as never,
    });
    return true;
  } catch (err) {
    logger.warn(
      `Segnalazione ${escalationId} non chiusa dopo la risposta di ${attoreId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * La segnalazione è ancora aperta? Serve PRIMA di portare la domanda in chat: se qualcuno l'ha già
 * gestita dalla pagina, quella domanda non va fatta.
 *
 * ⚠️ Nel dubbio si risponde `true` (la si porta): meglio una domanda in più che una richiesta che
 * sparisce perché una lettura è andata storta.
 */
export async function segnalazioneAncoraAperta(prisma: PrismaService, escalationId: string): Promise<boolean> {
  try {
    const riga = (await prisma.escalation.findUnique({
      where: { id: escalationId },
      select: { status: true },
    })) as { status: string } | null;
    if (!riga) return false;
    return riga.status === 'open' || riga.status === 'in_progress';
  } catch {
    return true;
  }
}
