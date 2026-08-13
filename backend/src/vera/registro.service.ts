/**
 * IL REGISTRO — cosa ha fatto Vera, su chi, e la frase da cui è nato.
 *
 * Sta **sotto la chat, sulla stessa schermata**, non in un archivio da un'altra parte: serve nel
 * momento in cui si sta lavorando. Ogni riga dice data, origine, azione, su chi, stato, e ha
 * l'annulla. E siccome la frase originale si conserva, da una riga si risale a **come è stata
 * detta** — che è il modo più rapido per capire perché una regola è venuta storta.
 *
 * ## ⚠️ Le frasi originali si conservano, e non è per curiosità
 *
 * Un traduttore non deterministico marcisce senza che nessuno se ne accorga: il giorno in cui
 * cambia il modello, il catalogo o il dizionario, nessuno saprebbe dire se ha smesso di capire le
 * frasi che prima capiva. Il guasto non è un errore rosso — è che a lei comincia a sembrare più
 * scema di prima. L'unico rimedio che funziona è un elenco di frasi vere con accanto l'azione
 * giusta, ripassato prima di ogni rilascio, e quell'elenco esce da qui: ogni correzione diventa un
 * caso di prova. Il sistema si costruisce il collaudo con gli errori che ha già fatto.
 */
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { applicaProposta, ordinaPerRischio, Proposta } from './applica-proposta';
import { avvisaConflittoSanitario } from './avvisa-capo';
import { casiCapiti, CasoCapito, fraseNonCapite, RigaMessaggio } from './corpus';
import { DizionarioService } from './dizionario.service';
import { perimetroClienti } from '../common/perimetro-clienti';
import { RigaAudit, RigaAzioneVera, RigaFoodSwap, unisciRegistro, VoceRegistro } from './registro-allargato';
import { componiReport, intervalloMese, ReportMensile, RigaReport } from './report-mensile';
import { RicettaDaScrivere, SCRITTURA_RICETTA, ScritturaRicetta } from './scrittura-ricetta';

export type AzioneVeraTipo =
  | 'restrizione_cliente'
  | 'sostituzione_cliente'
  | 'variante_cliente'
  | 'ricetta_modificata'
  | 'ricetta_nuova'
  | 'regola_dieta'
  /** Una parola che entra nel dizionario di TUTTE: nasce sempre come proposta. */
  | 'voce_dizionario';

export type AmbitoVera = 'cliente' | 'dieta' | 'catalogo';

export interface ScriviAzione {
  nutrizionistaId: string;
  frase: string;
  azione: AzioneVeraTipo;
  ambito: AmbitoVera;
  soggettoTipo: 'user' | 'diet' | 'recipe';
  soggettoId?: string | null;
  soggettoNome?: string | null;
  dettaglio?: Record<string, unknown> | null;
  /** L'azione è a raggio largo e aspetta il capo: nasce così, non «attiva». */
  inApprovazione?: boolean;
  /** Ha scavalcato un vincolo sanitario, con conferma esplicita. */
  conflittoSanitario?: boolean;
}

@Injectable()
export class RegistroVeraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dizionario: DizionarioService,
    @Inject(SCRITTURA_RICETTA) private readonly ricette: ScritturaRicetta,
  ) {}

  /**
   * Scrive la riga. Va chiamata SEMPRE, anche quando l'azione è banale.
   *
   * Il registro perde valore in modo non lineare: mancandone il 5%, non è affidabile al 95% — è
   * inutilizzabile come collaudo, perché nessuno sa quali frasi mancano.
   */
  async scrivi(input: ScriviAzione) {
    const riga = await this.prisma.azioneVera.create({
      data: {
        nutrizionistaId: input.nutrizionistaId,
        frase: input.frase,
        azione: input.azione,
        ambito: input.ambito,
        soggettoTipo: input.soggettoTipo,
        soggettoId: input.soggettoId ?? null,
        soggettoNome: input.soggettoNome ?? null,
        dettaglio: (input.dettaglio ?? null) as never,
        stato: input.inApprovazione ? 'in_approvazione' : 'attiva',
        conflittoSanitario: !!input.conflittoSanitario,
      } as never,
    });

    // ⚠️ L'audit resta, oltre al registro: sono due cose diverse. Il registro è lo strumento di
    // lavoro della nutrizionista, `AuditLog` è la traccia di sistema su un dato sanitario, e non si
    // sostituiscono a vicenda — chi cancella una riga del primo non deve poter cancellare il secondo.
    await this.audit.log({
      action: `vera.${input.azione}`,
      actorId: input.nutrizionistaId,
      entityType: input.soggettoTipo,
      entityId: input.soggettoId ?? undefined,
      metadata: { frase: input.frase, ambito: input.ambito, conflittoSanitario: !!input.conflittoSanitario },
    });

    /**
     * ⚠️ L'avviso al capo parte SUBITO, e DOPO che la riga è stata scritta.
     *
     * Dopo, perché la regola vale comunque — comanda lei, è un medico — e perdere una scrittura
     * perché non si è riusciti a mandare una notifica sarebbe un guasto peggiore del guasto:
     * `avvisaConflittoSanitario` infatti non lancia mai. Subito, perché a fine mese quella cliente
     * ha già mangiato trenta giorni di menu. Il report mensile racconta le stesse righe, ma con un
     * orologio diverso.
     */
    if (input.conflittoSanitario) {
      await avvisaConflittoSanitario(this.prisma, {
        id: (riga as unknown as { id: string }).id,
        frase: input.frase,
        azione: input.azione,
        ambito: input.ambito,
        soggettoNome: input.soggettoNome ?? null,
        nutrizionistaId: input.nutrizionistaId,
        vincolo: (input.dettaglio as { vincolo?: string } | null | undefined)?.vincolo ?? null,
      });
    }
    return riga;
  }

  /** Il registro, filtrabile. Senza filtri a regime è illeggibile: la pagina li usa sempre. */
  async elenco(filtri: {
    nutrizionistaId?: string;
    soggettoId?: string;
    azione?: string;
    stato?: string;
    limite?: number;
  }) {
    return this.prisma.azioneVera.findMany({
      where: {
        ...(filtri.nutrizionistaId ? { nutrizionistaId: filtri.nutrizionistaId } : {}),
        ...(filtri.soggettoId ? { soggettoId: filtri.soggettoId } : {}),
        ...(filtri.azione ? { azione: filtri.azione } : {}),
        ...(filtri.stato ? { stato: filtri.stato } : {}),
      } as never,
      orderBy: { createdAt: 'desc' },
      take: Math.min(filtri.limite ?? 100, 500),
    });
  }

  /**
   * TUTTO quello che è cambiato sulle sue clienti, non solo quello che ha fatto lei.
   *
   * Tre letture in parallelo e una fusione (`registro-allargato.ts`). ⚠️ Nessuna tabella nuova che
   * copi le altre: una copia va tenuta allineata per sempre, e il giorno in cui si disallinea nessuno
   * se ne accorge — un registro sbagliato non produce nessun errore.
   *
   * ⚠️ La finestra è di 60 giorni. Non è una scelta di prestazioni: un registro che parte
   * dall'inizio dei tempi è un registro che non si legge, e la domanda che serve davvero
   * («cosa è cambiato di recente su questa persona») ha una risposta corta.
   */
  async tutto(userId: string, giorni = 60, limite = 200): Promise<VoceRegistro[]> {
    const da = new Date(Date.now() - giorni * 86_400_000);
    const perimetro = await perimetroClienti(this.prisma, userId);

    const clienti = (await this.prisma.clientProfile.findMany({
      where: (perimetro ? { [perimetro.field]: { in: perimetro.staffIds } } : {}) as never,
      select: { userId: true, name: true },
      take: 1000,
    })) as { userId: string; name: string | null }[];
    const ids = clienti.map((c) => c.userId);
    const nomi = new Map(clienti.map((c) => [c.userId, c.name ?? c.userId.slice(0, 8)]));
    if (!ids.length) return [];

    const [azioni, audit, swap] = await Promise.all([
      this.prisma.azioneVera.findMany({
        where: { createdAt: { gte: da }, OR: [{ nutrizionistaId: userId }, { soggettoId: { in: ids } }] } as never,
        orderBy: { createdAt: 'desc' },
        take: limite,
      }) as Promise<unknown> as Promise<RigaAzioneVera[]>,
      this.prisma.auditLog.findMany({
        where: { createdAt: { gte: da }, entityId: { in: ids } } as never,
        orderBy: { createdAt: 'desc' },
        take: limite,
      }) as Promise<unknown> as Promise<RigaAudit[]>,
      this.prisma.foodSwap.findMany({
        where: { ultimaVoltaIl: { gte: da }, clientId: { in: ids } } as never,
        orderBy: { ultimaVoltaIl: 'desc' },
        take: limite,
      }) as Promise<unknown> as Promise<RigaFoodSwap[]>,
    ]);

    return unisciRegistro(azioni, audit, swap, nomi, limite);
  }

  /**
   * Quante sostituzioni delle sue clienti non ha ancora guardato nessuno.
   *
   * ⚠️ Sta qui e non in un contatore suo: è una lettura sulla stessa tabella che il registro
   * allargato già legge, e un numero che si calcola in due posti diversi prima o poi ne dice due.
   */
  async sostituzioniDaVerificare(userId: string): Promise<number> {
    const perimetro = await perimetroClienti(this.prisma, userId);
    const clienti = (await this.prisma.clientProfile.findMany({
      where: (perimetro ? { [perimetro.field]: { in: perimetro.staffIds } } : {}) as never,
      select: { userId: true },
      take: 1000,
    })) as { userId: string }[];
    if (!clienti.length) return 0;
    return this.prisma.foodSwap.count({
      where: { stato: 'da_verificare', clientId: { in: clienti.map((c) => c.userId) } } as never,
    });
  }

  // ────────────────────────────────────────────────────── la coda del capo ──

  /**
   * Le proposte che aspettano il capo nutrizionista, **in ordine di rischio**.
   *
   * Vedi `ordinaPerRischio`: una coda cronologica fa arrivare per ultima la cosa più importante.
   */
  async daApprovare(limite = 50) {
    const righe = (await this.prisma.azioneVera.findMany({
      where: { stato: 'in_approvazione' } as never,
      orderBy: { createdAt: 'asc' },
      take: Math.min(limite, 200),
    })) as unknown as { conflittoSanitario: boolean; ambito: string; createdAt: Date }[];
    return ordinaPerRischio(righe);
  }

  /**
   * APPROVA una proposta: la applica e la rende attiva.
   *
   * ⚠️ **Una alla volta, e non esiste l'approvazione in blocco** (decisione di Simone del 12/8). Un
   * pulsante «approva tutte» è comodissimo, e in tre settimane diventa l'unico che si preme: da lì
   * la validazione torna a essere una formalità, cioè esattamente la cosa che questa coda esiste per
   * non essere. Se qualcuno un giorno la aggiungerà, la aggiungerà sapendo di toglierla.
   */
  async approva(attore: { id: string; role: string }, id: string) {
    this.soloIlCapo(attore);
    const riga = (await this.prisma.azioneVera.findUnique({ where: { id } })) as unknown as
      | (Proposta & { stato: string; frase: string })
      | null;
    if (!riga) throw new NotFoundException('Proposta non trovata.');
    if (riga.stato !== 'in_approvazione') {
      throw new BadRequestException('Questa proposta non è in attesa di approvazione: qualcuno l’ha già decisa.');
    }

    const esito =
      riga.azione === 'voce_dizionario' ? await this.approvaVoceDizionario(attore, riga)
        : riga.azione === 'ricetta_nuova' || riga.azione === 'ricetta_modificata' ? await this.approvaRicetta(attore, riga)
          : await applicaProposta(this.prisma, riga);

    const aggiornata = await this.prisma.azioneVera.update({
      where: { id },
      data: { stato: 'attiva' } as never,
    });
    await this.audit.log({
      action: 'vera.approva',
      actorId: attore.id,
      entityType: 'azione_vera',
      entityId: id,
      metadata: { frase: riga.frase, autoreId: riga.nutrizionistaId, toccate: esito.toccate },
    });
    return { riga: aggiornata, ...esito };
  }

  /**
   * Una parola nuova nel dizionario **di tutte**: si insegna a nome di chi l'ha proposta e poi si
   * promuove.
   *
   * ⚠️ Si passa da `insegna` + `promuovi` invece di scrivere la riga a mano: quei due metodi sanno
   * cose che qui si perderebbero — la chiave larga che fa combaciare singolare e plurale, il
   * riuso della voce gemella al posto del doppione, e chi resta scritto come autore. Riscriverle
   * qui vorrebbe dire una seconda idea di cosa sia una voce di dizionario.
   */
  private async approvaVoceDizionario(attore: { id: string; role: string }, riga: Proposta) {
    const d = (riga.dettaglio ?? {}) as { famiglia?: string; membri?: string[] };
    const famiglia = (d.famiglia ?? '').trim();
    const membri = (d.membri ?? []).filter(Boolean);
    if (!famiglia || !membri.length) {
      return { toccate: 0, riepilogo: 'La proposta non conteneva né la parola né gli alimenti: non ho scritto niente.' };
    }
    const voce = await this.dizionario.insegna(riga.nutrizionistaId, { nome: famiglia, membri });
    await this.dizionario.promuovi(attore, voce.id);
    return {
      toccate: 0,
      riepilogo: `Da adesso «${famiglia}» vuol dire ${membri.join(', ')} per tutte: quando qualcuno la nomina, non la chiedo più.`,
    };
  }

  /**
   * APPROVA una ricetta: la nuova si accende, la modifica si applica.
   *
   * ⚠️ Le due strade arrivano qui in due stati diversi, ed è il punto di tutta l'azione 4-5. La
   * ricetta **nuova** è già in catalogo, spenta: approvarla vuol dire accenderla. La **modifica**
   * non è stata scritta da nessuna parte — vive nel `dettaglio` della proposta — perché quella
   * ricetta è nei piatti di oggi e applicarla subito li avrebbe cambiati stanotte.
   *
   * ⚠️ `active` si toglie dai campi della modifica. Arriva `false` da come la proposta è stata
   * costruita, e riscriverlo su una ricetta viva la spegnerebbe: sparirebbe dai menu senza che
   * nessuno abbia chiesto di toglierla, e senza nessun errore da nessuna parte.
   *
   * ⚠️ Approvare NON conferma gli allergeni: `allergensReviewed` resta `false` e `collegaRicetta`
   * continua a rifiutarsi di metterla in una giornata. È giusto così — sono due responsabilità
   * diverse — e la frase qui sotto lo dice, perché il capo non lo scopra dal fatto che la ricetta
   * non compare da nessuna parte.
   */
  private async approvaRicetta(attore: { id: string; role: string }, riga: Proposta & { azione: string; soggettoId?: string | null }) {
    const id = riga.soggettoId ?? null;
    if (!id) return { toccate: 0, riepilogo: 'La proposta non dice quale ricetta: non ho toccato niente.' };

    if (riga.azione === 'ricetta_nuova') {
      await this.ricette.updateRecipe(attore.id, id, { active: true });
      return {
        toccate: 1,
        riepilogo:
          'Ricetta attivata. ⚠️ Prima di poter entrare in una giornata servono ancora gli allergeni ' +
          'confermati, dalla scheda della ricetta.',
      };
    }

    const campi = ((riga.dettaglio ?? {}) as { campi?: RicettaDaScrivere }).campi;
    if (!campi) return { toccate: 0, riepilogo: 'La proposta non conteneva la ricetta nuova: non ho toccato niente.' };
    const { active: _spenta, ...daScrivere } = campi;
    await this.ricette.updateRecipe(attore.id, id, daScrivere);
    return { toccate: 1, riepilogo: `Ricetta «${campi.name}» aggiornata: da adesso è questa che va nei piatti.` };
  }

  /**
   * RESPINGE una proposta. Il motivo è obbligatorio.
   *
   * ⚠️ Un no senza motivo è la cosa che insegna a smettere di proporre. E siccome la proposta resta
   * in elenco con la sua frase originale, il motivo scritto qui è quello che chi l'ha dettata legge
   * per capire cosa cambiare — non un adempimento.
   */
  async respingi(attore: { id: string; role: string }, id: string, motivo: string) {
    this.soloIlCapo(attore);
    const testo = (motivo ?? '').trim();
    if (testo.length < 3) throw new BadRequestException('Serve un motivo: un no senza spiegazione insegna a non proporre più.');

    const riga = (await this.prisma.azioneVera.findUnique({ where: { id } })) as unknown as
      | { id: string; stato: string; frase: string; dettaglio: unknown }
      | null;
    if (!riga) throw new NotFoundException('Proposta non trovata.');
    if (riga.stato !== 'in_approvazione') {
      throw new BadRequestException('Questa proposta non è in attesa di approvazione: qualcuno l’ha già decisa.');
    }

    const dettaglio = { ...((riga.dettaglio ?? {}) as Record<string, unknown>), motivoRifiuto: testo };
    const aggiornata = await this.prisma.azioneVera.update({
      where: { id },
      data: { stato: 'respinta', dettaglio: dettaglio as never } as never,
    });
    await this.audit.log({
      action: 'vera.respingi',
      actorId: attore.id,
      entityType: 'azione_vera',
      entityId: id,
      metadata: { frase: riga.frase, motivo: testo },
    });
    return { riga: aggiornata };
  }

  /**
   * ⚠️ Approva e respinge SOLO il capo nutrizionista.
   *
   * Il controllo sta nel servizio e non solo nella guardia del controller di proposito: è la riga
   * che impedisce a chi propone di approvarsi da solo, ed è l'unica cosa che rende la coda una coda
   * invece di un passaggio a vuoto.
   */
  private soloIlCapo(attore: { role: string }) {
    if (attore.role !== 'head_nutritionist' && attore.role !== 'admin') {
      throw new ForbiddenException('Solo il capo nutrizionista può approvare o respingere una proposta.');
    }
  }

  /**
   * ANNULLA una riga, e dice quali menu vanno rifatti.
   *
   * ⚠️ Solo i giorni che la cliente **non ha ancora visto**. La regola l'ha decisa Simone e ha una
   * ragione precisa: rifare un menu che lei ha già letto — magari dopo aver fatto la spesa — è
   * esattamente la cosa che fa scrivere «l'app è impazzita» alla coach. Un menu già visto resta
   * suo; da lì in avanti si riparte puliti.
   *
   * ⚠️ `viewedAt = null` NON vuol dire «non visto» per i giorni erogati **prima** che la colonna
   * esistesse: per quelli vuol dire «non lo so». Per questo si guarda solo il FUTURO
   * (`date >= oggi`): un giorno futuro non ancora aperto è l'unico caso in cui il null è davvero un
   * no. Vale la regola dei tre stati: «non lo so» non è «nessuno».
   *
   * La rigenerazione vera non sta qui: questa funzione dice *cosa* va rifatto, e chi eroga lo fa.
   * Tenere separate «la decisione» e «la scrittura» è quello che permette di mostrarle la
   * conseguenza — «12 clienti hanno già visto il menu di domani» — prima di toccare qualcosa.
   */
  async annulla(attoreId: string, id: string) {
    const riga = (await this.prisma.azioneVera.findUnique({ where: { id } })) as
      | { id: string; stato: string; soggettoTipo: string; soggettoId: string | null; frase: string }
      | null;
    if (!riga) throw new NotFoundException('Riga non trovata.');
    if (riga.stato === 'annullata') return { riga, daRifare: [] as string[] };

    const aggiornata = await this.prisma.azioneVera.update({
      where: { id },
      data: { stato: 'annullata', annullataDaId: attoreId, annullataIl: new Date() } as never,
    });

    const daRifare =
      riga.soggettoTipo === 'user' && riga.soggettoId ? await this.menuDaRifare(riga.soggettoId) : [];

    await this.audit.log({
      action: 'vera.annulla',
      actorId: attoreId,
      entityType: 'azione_vera',
      entityId: id,
      metadata: { frase: riga.frase, daRifare },
    });
    return { riga: aggiornata, daRifare };
  }

  /**
   * I giorni futuri che la cliente non ha ancora aperto: gli unici che si possono rifare.
   *
   * Esposta anche da sola perché serve **prima** di scrivere, non solo dopo: è il numero che Vera
   * mostra quando chiede «i menu di domani li rifaccio o parto da dopodomani?».
   */
  async menuDaRifare(clientId: string): Promise<string[]> {
    const oggi = new Date();
    oggi.setUTCHours(0, 0, 0, 0);
    const giorni = (await this.prisma.menuDay.findMany({
      where: { clientId, viewedAt: null, date: { gte: oggi } } as never,
      orderBy: { date: 'asc' },
      select: { date: true },
    })) as { date: Date }[];
    return giorni.map((g) => g.date.toISOString().slice(0, 10));
  }

  // ──────────────────────────────────────── il foglio che legge il capo ──

  /**
   * IL REPORT DEL MESE (`report-mensile.ts` per il perché, e per cosa ci sta dentro).
   *
   * ⚠️ È una lettura: nessuna tabella `report_mensile`. Un report congelato comincia a mentire il
   * giorno dopo — una riga annullata a settembre resterebbe «attiva» nel report di agosto per
   * sempre — e chi lo legge non ha modo di accorgersene.
   */
  async reportMensile(anno: number, mese: number): Promise<ReportMensile> {
    if (!Number.isInteger(mese) || mese < 1 || mese > 12) throw new BadRequestException('Mese non valido.');
    const { dal, al } = intervalloMese(anno, mese);

    const [righe, messaggi] = await Promise.all([
      this.prisma.azioneVera.findMany({
        where: { createdAt: { gte: dal, lt: al } } as never,
        orderBy: { createdAt: 'asc' },
        take: 2000,
      }) as Promise<unknown> as Promise<RigaReport[]>,
      this.prisma.messaggioVera.findMany({
        where: { createdAt: { gte: dal, lt: al } } as never,
        orderBy: { createdAt: 'asc' },
        take: 4000,
      }) as Promise<unknown> as Promise<RigaMessaggio[]>,
    ]);

    const autori = [...new Set(righe.map((r) => r.nutrizionistaId))];
    const staff = autori.length
      ? ((await this.prisma.user.findMany({
          where: { id: { in: autori } } as never,
          select: { id: true, firstName: true, lastName: true, email: true },
        })) as { id: string; firstName: string | null; lastName: string | null; email: string }[])
      : [];
    const nomi = new Map(
      staff.map((s) => [s.id, [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email]),
    );

    return componiReport(righe, fraseNonCapite(messaggi, 15), nomi, anno, mese);
  }

  /**
   * IL CORPUS: le frasi capite e quelle no, pronte da rileggere prima di un rilascio.
   *
   * ⚠️ Non è una statistica da guardare: è materiale di lavoro. Le frasi non capite dicono quali
   * parole insegnare al dizionario, quelle capite sono i casi che devono continuare a passare
   * quando qualcuno tocca `capisci.ts`.
   */
  async corpus(userId: string, tutte: boolean, giorni = 90): Promise<{ nonCapite: ReturnType<typeof fraseNonCapite>; capite: CasoCapito[] }> {
    const da = new Date(Date.now() - giorni * 86_400_000);
    const mio = tutte ? {} : { nutrizionistaId: userId };
    const [messaggi, righe] = await Promise.all([
      this.prisma.messaggioVera.findMany({
        where: { createdAt: { gte: da }, ...mio } as never,
        orderBy: { createdAt: 'asc' },
        take: 4000,
      }) as Promise<unknown> as Promise<RigaMessaggio[]>,
      this.prisma.azioneVera.findMany({
        where: { createdAt: { gte: da }, ...mio } as never,
        orderBy: { createdAt: 'desc' },
        take: 500,
      }) as Promise<unknown> as Promise<{ frase: string; azione: string; ambito: string; stato: string }[]>,
    ]);
    return { nonCapite: fraseNonCapite(messaggi), capite: casiCapiti(righe) };
  }
}
