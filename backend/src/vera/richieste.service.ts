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
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  PROMEMORIA_OGNI_GIORNI,
  TIPO_PROMEMORIA,
  promemoriaDovuto,
  testoDelPromemoria,
  type ClienteDaSorvegliare,
} from '../clients/promemoria-supervisione';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { apriRichiestaVera } from './apri-richiesta';

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

/**
 * La porta delle CALORIE scritte a mano (14/8, Nocanty via Vera). Stessa forma di
 * `SCRITTURA_CLIENTE` e per la stessa ragione: `impostaKcal` ha già il permesso, lo storico in
 * `kcal_override`, il rifiuto sotto soglia e l'avviso ai capi. Rifarli qui vorrebbe dire due
 * strade per lo stesso dato clinico.
 */
export interface ScritturaKcal {
  simulaKcal(
    user: { sub: string; role: string },
    clientId: string,
    /**
     * ⚠️ **`undefined` non è `null`**: `null` vuol dire «togli il deficit», `undefined` «non lo sto
     * nominando, resta com'è». Passare `null` per sbaglio fa calcolare un «dopo» senza il deficit
     * imposto dal nutrizionista — un numero più alto del vero, mostrato per farlo confermare.
     */
    deficitKcal?: number | null,
    correzionePct?: number | null,
  ): Promise<{
    /**
     * ⚠️ `pesoIncoerente` sta nel tipo apposta: il fabbisogno può essere **sospeso** (pesate che non
     * stanno in piedi fra loro), e allora questi `target` **non sono quelli nel piatto** — i menu
     * usano il livello della dieta. Chi legge solo `target` racconta un numero che non viene servito,
     * ed è successo in tre punti prima del 28/8.
     */
    prima: { target: number; pesoIncoerente?: { frase: string } | null } | null;
    dopo: { target: number; pesoIncoerente?: { frase: string } | null } | null;
  }>;
  impostaKcal(
    user: { sub: string; role: string },
    clientId: string,
    input: { deficitKcal?: number | null; correzionePct?: number | null; motivo: string; perGiorni?: number | null },
  ): Promise<{
    /**
     * ⚠️ **Valorizzato quando il fabbisogno era sospeso.** Era `Promise<unknown>`, e Vera dopo il sì
     * chiudeva con «Fatto: sale a 1760 kcal al giorno» — contraddicendo l'avviso che aveva dato
     * trenta secondi prima. Il tipo che non dice niente è il modo in cui un dato nuovo non arriva
     * mai a chi lo deve leggere.
     */
    fabbisognoSospeso?: string | null;
  }>;
}

export const SCRITTURA_KCAL = 'VERA_SCRITTURA_KCAL';

export interface RichiestaAperta {
  id: string;
  tipo: string;
  clienteId: string;
  clienteNome: string | null;
  testo: string;
  origine: string;
  createdAt: Date;
}

/**
 * Quante supervisionate guarda al massimo un giro notturno. ⚠️ È largo — la supervisione riguarda
 * una minoranza delle clienti — e se un giorno mordesse, il giro lo **scrive** invece di tacere.
 */
const TETTO_SORVEGLIATE = 2000;

@Injectable()
export class RichiesteVeraService {
  private readonly logger = new Logger(RichiesteVeraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(SCRITTURA_CLIENTE) private readonly clients: ScritturaCliente,
    private readonly config: ConfigParamsService,
  ) {}

  /**
   * ⛔ **IL GIRO DI SORVEGLIANZA SUI PERCORSI SUPERVISIONATI** — Simone, 25/8: *«Se il cliente è
   * supervisionato va mandata notifica a Lucia di controllarlo ogni 7 giorni attraverso Vera»*.
   *
   * Chiude due domande aperte dal 23/8 (`mai-valutata-eroga-lo-stesso`, `motore-dopo-il-via-libera`),
   * e le chiude **senza fermare nessuno**: una cliente in screening che nessuno ha mai guardato
   * riceve i menu — non è mai esistito un cancello sull'erogazione, e la card dell'app compariva di
   * rado proprio perché i menu c'erano. Il rimedio non è fermarla: è far arrivare la domanda a chi
   * deve rispondere, e **continuare a farla arrivare** finché non risponde.
   *
   * ⚠️ **Non tocca l'erogazione, e non decide niente di clinico.** Apre una domanda su Vera, che è
   * la porta da cui la nutrizionista lavora. La regola di quando aprirla è pura e provata a parte
   * (`clients/promemoria-supervisione.ts`).
   *
   * ⚠️ **A chi arriva lo sa `apriRichiestaVera`**: la nutrizionista assegnata, o il capo se non ce
   * n'è una. È la stessa porta di tutte le altre domande, e per la stessa ragione — una cliente di
   * nessuno è esattamente quella che non deve sparire.
   *
   * ⚠️ Non lancia mai: è un passo del cron notturno, e un promemoria che non parte non deve far
   * cadere i passi dopo di lui. Ma quello che salta si **conta e si scrive**, perché una
   * sorveglianza che smette in silenzio è peggio di nessuna sorveglianza.
   */
  async promemoriaSupervisione(oggi: Date = new Date()): Promise<{
    /** Quante sono in tutto: `guardati` può essere meno, se il tetto morde — e allora lo dice il log. */
    inScreening: number;
    guardati: number;
    aperti: number;
    giaAperti: number;
    falliti: number;
  }> {
    // ⚠️ Se il parametro non si legge si ripiega, ma **lo si dice**: un passo che cambia in silenzio
    // è un passo che nessuno collega al comportamento che vede.
    const ogniGiorni = await this.config
      .getNumber('supervision_reminder_days', PROMEMORIA_OGNI_GIORNI)
      .catch((err: unknown) => {
        this.logger.warn(
          `supervision_reminder_days non letto (${err instanceof Error ? err.message : String(err)}): ` +
            `uso ${PROMEMORIA_OGNI_GIORNI} giorni.`,
        );
        return PROMEMORIA_OGNI_GIORNI;
      });

    /**
     * ⚠️ Si leggono **tutte** le supervisionate e si filtra in memoria, invece di chiedere al
     * database «quelle senza decisione»: la regola di chi aspetta ancora è in
     * `statoSupervisione`, e riscriverla come `where` vorrebbe dire averne due — che un giorno
     * divergono, e a divergere sarebbe chi viene guardata e chi no. Sono poche righe: la
     * supervisione riguarda una minoranza delle clienti, e il conto sta in una notte.
     */
    /**
     * ⚠️ **Il tetto c'è, e se morde si dice.** `take: 2000` senza un conto a fianco è un troncamento
     * silenzioso: oltre quel numero il giro ne guarda 2000 e risponde «guardati: 2000», senza
     * distinguere «ho finito» da «ho smesso» — e a restare fuori è chi capita in fondo
     * all'ordinamento del database, cioè nessuno che qualcuno abbia scelto. Rilievo della revisione
     * del 25/8. Il tetto resta (una query senza limite su una tabella che cresce è l'altro modo di
     * sbagliare), ma adesso il numero vero si conta e la differenza si scrive.
     */
    const quante = await this.prisma.clientProfile.count({ where: { screeningFlag: true } as never });
    if (quante > TETTO_SORVEGLIATE) {
      this.logger.error(
        `Sorveglianza percorsi supervisionati: ${quante} clienti in screening, ma il giro ne guarda ` +
          `${TETTO_SORVEGLIATE}. ${quante - TETTO_SORVEGLIATE} restano senza promemoria stanotte: ` +
          'alza il tetto o pagina il giro.',
      );
    }

    const profili = (await this.prisma.clientProfile.findMany({
      where: { screeningFlag: true } as never,
      select: {
        userId: true,
        name: true,
        createdAt: true,
        screeningFlag: true,
        idoneita: true,
        idoneitaVisitaEntro: true,
      } as never,
      take: TETTO_SORVEGLIATE,
    })) as {
      userId: string;
      name: string | null;
      createdAt: Date | null;
      screeningFlag: boolean | null;
      idoneita: string | null;
      idoneitaVisitaEntro: Date | null;
    }[];

    let aperti = 0;
    let giaAperti = 0;
    let falliti = 0;

    for (const p of profili) {
      const cliente: ClienteDaSorvegliare = {
        clientId: p.userId,
        nome: p.name,
        da: p.createdAt,
        profilo: p,
      };
      const esito = promemoriaDovuto(cliente, oggi, ogniGiorni);
      if (!esito.chiave) continue;
      try {
        /**
         * ⛔ **UN PROMEMORIA APERTO PER VOLTA, PER CLIENTE** — corretto in revisione, 25/8.
         *
         * Il promemoria torna a ogni finestra e **non lo chiude nessuno**: nella prima stesura
         * restavano tutti aperti, e la coda di Vera è FIFO con `take: 100` (`aperte`). Con le
         * clienti in screening di oggi bastavano pochi mesi perché le cento righe più vecchie
         * fossero tutte promemoria di sorveglianza — e allora **una domanda vera su un'allergia**
         * («dietro c'è una cliente il cui piatto oggi non è filtrato») non compariva più né in chat
         * né nella card, mentre il contatore `quante()`, che il `take` non ce l'ha, continuava a
         * dire il numero giusto. Contatore e lista divergevano, e a sparire era la riga urgente.
         *
         * ⚠️ Chiudere quello vecchio non archivia la persona: quello nuovo nasce nella stessa
         * transazione logica, con il conteggio dei giorni aggiornato — «da 21 giorni» al posto di
         * «da 14». Cioè la coda porta **lo stato di adesso**, non la storia di chi non ha risposto.
         */
        const vecchi = (await this.prisma.richiestaVera.findMany({
          where: { clienteId: p.userId, tipo: TIPO_PROMEMORIA, stato: 'aperta' } as never,
          select: { id: true, chiave: true },
          take: 50,
        })) as { id: string; chiave: string }[];
        for (const v of vecchi) {
          if (v.chiave === esito.chiave) continue;
          await this.chiudiSenzaRisposta(v.id, null, 'Sostituito dal promemoria della finestra successiva.')
            .catch(() => undefined);
        }

        const aperta = await apriRichiestaVera(this.prisma, {
          tipo: TIPO_PROMEMORIA,
          clienteId: p.userId,
          testo: testoDelPromemoria(cliente, esito),
          origine: 'sorveglianza-supervisione',
          chiave: esito.chiave,
        });
        /**
         * ⛔ **«Non l'ho aperta» ha DUE significati, e contarli insieme è una sorveglianza finta.**
         *
         * `apriRichiestaVera` non lancia mai — è la sua promessa, e va bene: una domanda che non
         * parte non deve far cadere il cron. Ma allora rende `{ creata: false }` sia quando la
         * domanda **c'era già** (giusto, è l'idempotenza) sia quando **è esplosa**. Contandoli
         * insieme, una notte in cui il database non risponde si chiudeva con «zero falliti, tutte
         * già aperte» — cioè un giro di sorveglianza che dichiara di aver guardato tutti senza aver
         * scritto niente. ⚠️ Le due si distinguono dall'`id`: c'è solo quando la riga esiste.
         */
        if (aperta.creata) aperti += 1;
        else if (aperta.id) giaAperti += 1;
        else falliti += 1;
      } catch (err) {
        falliti += 1;
        this.logger.warn(
          `Promemoria supervisione non aperto per ${p.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (falliti) {
      this.logger.error(
        `Sorveglianza percorsi supervisionati: ${falliti} promemoria non aperti su ${profili.length} clienti guardate.`,
      );
    }
    return { inScreening: quante, guardati: profili.length, aperti, giaAperti, falliti };
  }

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
