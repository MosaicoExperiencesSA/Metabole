import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { avvisaNutrizionistaDellaCliente } from '../common/avvisa-nutrizionista';
import { oggiPiu } from '../common/date-only';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgendaService } from './agenda.service';
import { GIORNI_ANTEPRIMA_AGENDA } from './finestra-agenda';
import {
  ORE_PER_MODIFICARE,
  creditoVisite,
  siPuoModificare,
  testoTroppoTardi,
  visiteConcesseDa,
  type RigaOrdine,
} from './prenotazioni';
import { istanteRomano, minutiDaOra } from './settimana-tipo';

const iso = (d: Date): string => d.toISOString().slice(0, 10);

const quando = (d: Date): string =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(d);

/**
 * §16.7 — LA PRENOTAZIONE, dal lato della cliente.
 *
 * L'altra metà di `AgendaService`: là si scrive la propria agenda, qui si occupa il tempo di
 * un'altra persona. Sono due mestieri, ed è il motivo per cui sono due servizi.
 *
 * ## Le quattro regole, e cosa succederebbe senza
 *
 * 1. **Prenota solo chi ha acquistato una visita non ancora usata** (Simone, 12/8). Senza, l'agenda
 *    del nutrizionista si riempirebbe di ore che nessuno ha pagato.
 * 2. **Solo la SUA nutrizionista.** Gli slot che vede sono di chi la segue: una visita clinica con
 *    una persona che non ha mai letto la sua cartella non è una visita.
 * 3. **Fino a 24 ore prima** si sposta e si disdice da sola; sotto, si passa dalla coach.
 * 4. **Disdire libera lo slot E restituisce il credito.** Se lo slot torna libero ma il diritto no,
 *    la cliente ha pagato una visita e ne ha zero: la disdetta diventerebbe una trappola.
 */
@Injectable()
export class PrenotazioniService {
  private readonly logger = new Logger(PrenotazioniService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly agenda: AgendaService,
    private readonly mail: MailService,
  ) {}

  /** La nutrizionista che la segue, o `null`. */
  private async suaNutrizionista(clientId: string): Promise<{ id: string; displayName: string } | null> {
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedNutritionist: { select: { id: true, displayName: true } } },
    })) as { assignedNutritionist: { id: string; displayName: string } | null } | null;
    return p?.assignedNutritionist ?? null;
  }

  /**
   * Quante visite può ancora prenotare.
   *
   * Si somma quello che ha comprato e si toglie quello che ha già fissato. ⚠️ Le visite
   * **annullate** non contano fra quelle usate: è la conseguenza di «se disdice, lo slot torna
   * libero».
   */
  async credito(clientId: string): Promise<{ disponibili: number; concesse: number; usate: number }> {
    const [ordini, prodotti, usate] = await Promise.all([
      this.prisma.order.findMany({
        // Solo gli ordini PAGATI: un ordine in attesa di bonifico non è una visita acquistata.
        where: { clientId, payment: { status: 'approved' as never } },
        select: { items: true },
      }) as Promise<{ items: unknown }[]>,
      this.prisma.product.findMany({
        where: { visitsGranted: { gt: 0 } },
        select: { id: true, visitsGranted: true },
      }) as Promise<{ id: string; visitsGranted: number }[]>,
      this.prisma.visit.count({ where: { clientId, status: { not: 'cancelled' as never } } }),
    ]);

    const perProdotto = new Map(prodotti.map((p) => [p.id, p.visitsGranted]));
    const concesse = ordini.reduce((n, o) => n + visiteConcesseDa((o.items as RigaOrdine[]) ?? [], perProdotto), 0);
    return { disponibili: creditoVisite(concesse, usate), concesse, usate };
  }

  /** Gli orari che può scegliere, con quante visite le restano. */
  async disponibilita(clientId: string, dal?: string, al?: string) {
    const nutri = await this.suaNutrizionista(clientId);
    const credito = await this.credito(clientId);
    if (!nutri) {
      // Non è un errore: è una cosa che deve fare qualcun altro, e va detta così.
      return {
        nutrizionista: null,
        credito,
        orari: [],
        messaggio: 'Non hai ancora una nutrizionista assegnata: scrivi alla tua coach e te la assegna lei. 💚',
      };
    }
    /**
     * ⛔ **I DUE ESTREMI CON DUE DEFINIZIONI DI GIORNO DIVERSE: 29 giorni invece di 30** (25/8).
     *
     * `oggi` era già il giorno di Roma (`toDateOnly`), ma `fra30` partiva da `new Date()` e si
     * sommava 30 giorni nel fuso del processo — UTC su Render. Fra la mezzanotte e le 02:00 italiane
     * l'estremo destro cadeva sul giorno prima: la finestra prenotabile si accorciava di un giorno e
     * **l'ultimo giorno disponibile non compariva** — a una cliente che sta cercando quando può.
     *
     * ⚠️ Due conti diversi per la stessa domanda: adesso i due estremi vengono dalla stessa funzione
     * e da **una sola** lettura dell'orologio (a cavallo della mezzanotte sarebbero 29 o 31), e il
     * numero di giorni è lo stesso che vede il nutrizionista nella sua anteprima.
     */
    const adesso = new Date();
    const orari = await this.agenda.orariLiberi(
      nutri.id,
      dal || iso(oggiPiu(0, adesso)),
      al || iso(oggiPiu(GIORNI_ANTEPRIMA_AGENDA, adesso)),
    );
    return {
      nutrizionista: { nome: nutri.displayName },
      credito,
      orari,
      messaggio:
        credito.disponibili > 0
          ? null
          : 'Per prenotare una visita serve prima acquistarla dal negozio. Se pensi di averlo già fatto, scrivi alla tua coach.',
    };
  }

  /**
   * Prenota. Tutti i controlli PRIMA di scrivere: una visita creata e poi annullata perché mancava
   * il credito è un appuntamento che la nutrizionista ha già visto in agenda.
   */
  async prenota(clientId: string, input: { slotId: string; data: string; tipo?: string }) {
    const nutri = await this.suaNutrizionista(clientId);
    if (!nutri) throw new BadRequestException('Non hai ancora una nutrizionista assegnata: scrivi alla tua coach.');

    const credito = await this.credito(clientId);
    if (credito.disponibili <= 0) {
      throw new BadRequestException('Non hai visite da prenotare: acquistane una dal negozio, poi torna qui.');
    }

    const slot = (await this.prisma.visitSlot.findUnique({ where: { id: input.slotId } })) as
      | { id: string; nutritionistId: string; startMin: number; endMin: number; type: string; active: boolean }
      | null;
    if (!slot || !slot.active) throw new NotFoundException('Quell\'orario non è più disponibile.');
    if (slot.nutritionistId !== nutri.id) throw new BadRequestException('Quell\'orario è di un\'altra nutrizionista.');

    // Che quel giorno lo slot ci sia davvero (ferie, festivi) e sia libero: si chiede alla stessa
    // funzione che ha costruito l'elenco da cui la cliente ha scelto. Chiederlo di nuovo non è
    // paranoia: fra il momento in cui ha guardato e quello in cui preme può essere passato un
    // minuto e un'altra persona.
    const liberi = await this.agenda.orariLiberi(nutri.id, input.data, input.data);
    const scelto = liberi.find((o) => o.slotId === slot.id && o.data === input.data);
    if (!scelto) throw new BadRequestException('Quell\'orario è appena stato preso, oppure quel giorno è chiuso. Scegline un altro.');

    const inizio = istanteRomano(input.data, minutiDaOra(scelto.inizio) ?? slot.startMin);
    const fine = istanteRomano(input.data, minutiDaOra(scelto.fine) ?? slot.endMin);
    if (inizio.getTime() <= Date.now()) throw new BadRequestException('Quell\'orario è già passato.');

    /**
     * ⚠️ La PRIMA visita è sempre in presenza. La regola non nasce qui — sta in
     * `visits.service.create` dal principio — e va ripetuta perché questa è una seconda strada che
     * arriva allo stesso posto: una regola clinica applicata solo su uno dei due ingressi non è
     * una regola.
     */
    const precedenti = await this.prisma.visit.count({ where: { clientId, status: { not: 'cancelled' as never } } });
    const tipo = slot.type === 'televisit' ? 'televisit' : 'in_person';
    if (precedenti === 0 && tipo === 'televisit') {
      throw new BadRequestException('La prima visita si fa sempre in presenza: scegli un orario in studio.');
    }

    const visita = (await this.prisma.visit.create({
      data: {
        clientId,
        nutritionistId: nutri.id,
        type: tipo as never,
        datetime: inizio,
        endsAt: fine,
        slotId: slot.id,
      } as never,
    })) as { id: string };

    await this.audit.log({
      action: 'visita.prenotata',
      actorId: clientId,
      entityType: 'visit',
      entityId: visita.id,
      metadata: { slotId: slot.id, data: input.data, ora: scelto.inizio, nutritionistId: nutri.id },
    });
    await this.avvisaEConferma(clientId, visita.id, inizio, nutri.displayName, 'prenotata');
    return { id: visita.id, quando: inizio.toISOString(), tipo, nutrizionista: nutri.displayName };
  }

  /** Spostare = disdire e riprenotare, in un colpo solo. Le 24 ore valgono sul vecchio orario. */
  async sposta(clientId: string, visitId: string, input: { slotId: string; data: string }) {
    const visita = await this.suaVisita(clientId, visitId);
    if (!siPuoModificare(visita.datetime)) throw new BadRequestException(testoTroppoTardi(visita.datetime));

    // Prima si libera il vecchio, poi si prende il nuovo: al contrario, il credito risulterebbe
    // esaurito e la cliente si vedrebbe rifiutare lo spostamento del suo stesso appuntamento.
    await this.prisma.visit.update({ where: { id: visitId }, data: { status: 'cancelled' as never } });
    try {
      const nuova = await this.prenota(clientId, input);
      await this.audit.log({
        action: 'visita.spostata',
        actorId: clientId,
        entityType: 'visit',
        entityId: visitId,
        metadata: { da: visita.datetime.toISOString(), a: nuova.quando },
      });
      return nuova;
    } catch (err) {
      // Lo spostamento non è riuscito: si rimette com'era, o la cliente resta senza appuntamento
      // avendo solo provato a cambiarlo.
      await this.prisma.visit.update({ where: { id: visitId }, data: { status: 'scheduled' as never } });
      throw err;
    }
  }

  /** Disdire: lo slot torna libero e il credito torna alla cliente. */
  async disdici(clientId: string, visitId: string) {
    const visita = await this.suaVisita(clientId, visitId);
    if (!siPuoModificare(visita.datetime)) throw new BadRequestException(testoTroppoTardi(visita.datetime));

    await this.prisma.visit.update({ where: { id: visitId }, data: { status: 'cancelled' as never } });
    await this.audit.log({
      action: 'visita.disdetta',
      actorId: clientId,
      entityType: 'visit',
      entityId: visitId,
      metadata: { quando: visita.datetime.toISOString() },
    });
    const nutri = await this.suaNutrizionista(clientId);
    await this.avvisaEConferma(clientId, visitId, visita.datetime, nutri?.displayName ?? '', 'disdetta');
    return { ok: true, messaggio: 'Appuntamento annullato. Quell\'orario torna libero e la visita resta tua: puoi riprenotarla quando vuoi. 💚' };
  }

  /** Le sue visite future, con la possibilità o meno di toccarle. */
  async mieVisite(clientId: string) {
    const righe = (await this.prisma.visit.findMany({
      where: { clientId, datetime: { gte: new Date() }, status: 'scheduled' as never },
      orderBy: { datetime: 'asc' },
      select: { id: true, datetime: true, endsAt: true, type: true, nutritionist: { select: { displayName: true } } },
    })) as { id: string; datetime: Date; endsAt: Date | null; type: string; nutritionist: { displayName: string } | null }[];
    return righe.map((v) => ({
      id: v.id,
      quando: v.datetime.toISOString(),
      fine: v.endsAt?.toISOString() ?? null,
      tipo: v.type,
      nutrizionista: v.nutritionist?.displayName ?? null,
      modificabile: siPuoModificare(v.datetime),
      // Perché il pulsante non c'è: senza questa riga il pulsante sparisce e basta.
      perche: siPuoModificare(v.datetime) ? null : testoTroppoTardi(v.datetime),
    }));
  }

  private async suaVisita(clientId: string, visitId: string) {
    const v = (await this.prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true, clientId: true, datetime: true, status: true },
    })) as { id: string; clientId: string; datetime: Date; status: string } | null;
    if (!v || v.clientId !== clientId) throw new NotFoundException('Appuntamento non trovato.');
    if (v.status !== 'scheduled') throw new BadRequestException('Quell\'appuntamento non è più in programma.');
    return v;
  }

  /**
   * L'email alla cliente e la notifica alla nutrizionista.
   *
   * ⚠️ Non lancia mai. La visita è già scritta: se l'email non parte, la cliente deve comunque
   * vedere l'appuntamento in agenda. Un avviso che non arriva è un problema; una prenotazione che
   * fallisce perché l'avviso non è partito è un problema peggiore.
   */
  private async avvisaEConferma(
    clientId: string,
    visitId: string,
    inizio: Date,
    nomeNutrizionista: string,
    cosa: 'prenotata' | 'disdetta',
  ): Promise<void> {
    try {
      const cliente = (await this.prisma.user.findUnique({
        where: { id: clientId },
        select: { email: true, firstName: true, locale: true },
      })) as { email: string; firstName: string | null; locale: string | null } | null;
      const nome = cliente?.firstName ?? 'Una cliente';

      await avvisaNutrizionistaDellaCliente(this.prisma, null, clientId, {
        type: cosa === 'prenotata' ? 'appointment_created' : 'appointment_cancelled',
        title: cosa === 'prenotata' ? 'Nuovo appuntamento prenotato' : 'Appuntamento annullato',
        body: `${nome} ha ${cosa === 'prenotata' ? 'prenotato' : 'annullato'} la visita di ${quando(inizio)}.`,
        payload: { kind: 'visita', visitId },
      });

      if (cliente?.email) {
        await this.mail.sendVisitaPrenotata(
          cliente.email,
          { quando: quando(inizio), nutrizionista: nomeNutrizionista, disdetta: cosa === 'disdetta' },
          cliente.locale,
        );
      }
    } catch (err) {
      this.logger.warn(`Avviso della visita ${visitId} non partito: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Esposto per i testi: quante ore prima si può ancora toccare l'appuntamento. */
  static get orePerModificare(): number {
    return ORE_PER_MODIFICARE;
  }
}
