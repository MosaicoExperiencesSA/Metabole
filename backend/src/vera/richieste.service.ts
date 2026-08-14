/**
 * LE RICHIESTE APERTE — l'elenco, e cosa succede quando la nutrizionista risponde.
 *
 * Contratto: `progetto/CONTRATTO_Vera_Richieste.md`. Il pezzo che conta è il §2: da **una** risposta
 * escono **due scritture diverse**, e non vanno fuse.
 *
 * | | cosa si scrive | dove | come |
 * |---|---|---|---|
 * | per quella cliente | fave e legumi fra le sue esclusioni | profilo | subito, dal punto unico |
 * | per tutte | «favismo» diventa una parola conosciuta | dizionario | **proposta in approvazione** |
 *
 * ⚠️ Una traduzione clinica data di fretta su una cliente non deve entrare nel vocabolario di tutte
 * perché qualcuno ha risposto in fretta a una domanda. È lo stesso principio dell'ambito che Vera
 * chiede già quando una regola nasce, applicato qui.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ⚠️ IL PUNTO DI SCRITTURA ARRIVA PER TOKEN, non importando `ClientsService`.
 *
 * Il servizio vero è sempre quello — lo lega `VeraModule` con `useExisting` — ma qui dentro non c'è
 * il suo `import`, e la differenza è pratica: importarlo trascina nel grafo di compilazione mezza
 * applicazione, e i test di Vera smettono di girare da soli per colpa di un errore che sta in un
 * file che non c'entra niente. Un modulo che si può collaudare in isolamento è un modulo che
 * qualcuno collauderà.
 *
 * L'interfaccia dichiara **solo il metodo che serve**: è anche il modo di dire, leggendo, che da qui
 * non si fa altro sul profilo di una cliente.
 */
export interface ScritturaCliente {
  updateClient(userId: string, actorId: string, dto: unknown): Promise<unknown>;
}

export const SCRITTURA_CLIENTE = 'VERA_SCRITTURA_CLIENTE';

export interface RichiestaAperta {
  id: string;
  tipo: string;
  clienteId: string;
  clienteNome: string | null;
  testo: string;
  origine: string;
  createdAt: Date;
}

@Injectable()
export class RichiesteVeraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(SCRITTURA_CLIENTE) private readonly clients: ScritturaCliente,
  ) {}

  /**
   * Le domande aperte per questa persona.
   *
   * Il capo (`tutte = true`) le vede tutte, comprese quelle di una cliente senza nutrizionista
   * assegnata — che altrimenti non le vedrebbe nessuno.
   */
  async aperte(userId: string, tutte = false): Promise<RichiestaAperta[]> {
    return (await this.prisma.richiestaVera.findMany({
      where: { stato: 'aperta', ...(tutte ? {} : { nutrizionistaId: userId }) } as never,
      orderBy: { createdAt: 'asc' },
      take: 100,
    })) as unknown as RichiestaAperta[];
  }

  /**
   * Chiude una domanda SENZA risposta: è quello che serve quando la cosa è già stata gestita
   * altrove (la segnalazione chiusa dalla pagina) o quando la nutrizionista dice «la vedo io».
   *
   * ⚠️ Si chiude, non si cancella: la domanda è successa, e il registro di cosa il sistema ha
   * chiesto è la stessa traccia che rende leggibile tutto il resto.
   */
  async chiudiSenzaRisposta(id: string, attoreId?: string | null, nota?: string): Promise<void> {
    await this.prisma.richiestaVera
      .update({
        where: { id },
        data: {
          stato: 'chiusa',
          chiusaDaId: attoreId ?? null,
          chiusaIl: new Date(),
          ...(nota ? { risposta: nota } : {}),
        } as never,
      })
      .catch(() => undefined);
  }

  async quante(userId: string, tutte = false): Promise<number> {
    return this.prisma.richiestaVera.count({
      where: { stato: 'aperta', ...(tutte ? {} : { nutrizionistaId: userId }) } as never,
    });
  }

  /**
   * PRIMA SCRITTURA: gli alimenti da togliere finiscono fra le esclusioni **di quella cliente**.
   *
   * ⚠️ Passa da `ClientsService.updateClient` e **non** da un `prisma.clientProfile.update` scritto
   * qui, ed è un vincolo del contratto, non uno stile: quel metodo controlla il permesso
   * `change_allergies`, ricalcola `allergiesOther`, fa la transazione e lascia la traccia. Una
   * seconda strada per lo stesso dato sanitario è il difetto che questo campo ha già avuto **due
   * volte** — il consenso perso l'8/8, il tipo di dieta l'11/8.
   *
   * Gli alimenti vanno fra le **intolleranze** e non fra le allergie: `allergies` accetta i 14 codici
   * UE, e «fave» non è uno di quelli. L'allergia dichiarata resta scritta com'era — è quello che ha
   * detto la cliente — e qui si aggiunge la **traduzione operativa**, che è ciò che il motore sa
   * usare.
   */
  async rispondi(
    attoreId: string,
    id: string,
    input: { alimenti: string[]; risposta: string },
  ): Promise<{ aggiunti: string[]; clienteNome: string | null }> {
    const richiesta = (await this.prisma.richiestaVera.findUnique({ where: { id } })) as
      | { id: string; clienteId: string; clienteNome: string | null; stato: string; testo: string }
      | null;
    if (!richiesta) throw new NotFoundException('Richiesta non trovata.');

    const alimenti = [...new Set(input.alimenti.map((a) => (a ?? '').trim()).filter(Boolean))];
    if (alimenti.length) {
      const profilo = (await this.prisma.clientProfile.findUnique({
        where: { userId: richiesta.clienteId },
        select: { intolerances: true },
      })) as { intolerances: string[] } | null;
      const attuali = profilo?.intolerances ?? [];
      const nuovi = alimenti.filter((a) => !attuali.some((x) => x.toLowerCase() === a.toLowerCase()));
      if (nuovi.length) {
        await this.clients.updateClient(richiesta.clienteId, attoreId, {
          intolerances: [...attuali, ...nuovi],
        });
      }
    }

    await this.prisma.richiestaVera.update({
      where: { id },
      data: { stato: 'chiusa', risposta: input.risposta, chiusaDaId: attoreId, chiusaIl: new Date() } as never,
    });
    await this.audit.log({
      action: 'vera.richiesta.risposta',
      actorId: attoreId,
      entityType: 'richiesta_vera',
      entityId: id,
      metadata: { clienteId: richiesta.clienteId, alimenti, domanda: richiesta.testo },
    });

    return { aggiunti: alimenti, clienteNome: richiesta.clienteNome };
  }

  /** Collega alla richiesta la riga di registro nata dalla risposta, quando ne nasce una. */
  async collega(id: string, azioneId: string) {
    await this.prisma.richiestaVera.update({ where: { id }, data: { azioneId } as never }).catch(() => undefined);
  }
}
