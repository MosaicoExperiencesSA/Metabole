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
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type AzioneVeraTipo =
  | 'restrizione_cliente'
  | 'sostituzione_cliente'
  | 'variante_cliente'
  | 'ricetta_modificata'
  | 'ricetta_nuova'
  | 'regola_dieta';

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
}
