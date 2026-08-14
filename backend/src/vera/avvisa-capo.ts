/**
 * L'AVVISO CHE NON ASPETTA FINE MESE.
 *
 * Decisione di Simone del 12/8, sulla quinta domanda: «se la regola di Lucia va in conflitto con
 * quella sanitaria magari se ne è scordata, quindi noi la avvisiamo». La regola **si scrive lo
 * stesso** — comanda lei, è un medico — ma di quella riga si accorge qualcun altro **subito**.
 *
 * ## ⚠️ Perché è separato dal report mensile, che pure racconta le stesse righe
 *
 * Il report è una lettura d'insieme: serve a vedere le tendenze. Un'allergia scavalcata non è una
 * tendenza, è una cosa che o si guarda entro sera o non serve più guardarla — a fine mese quella
 * cliente ha già mangiato trenta giorni di menu. Mettere le due cose nello stesso canale vuol dire
 * scegliere: o si legge il report ogni giorno (non succede), o l'avviso arriva in ritardo di un
 * mese. Sono due canali perché sono due orologi diversi.
 *
 * ## ⚠️ Non lancia mai
 *
 * Sta in fondo a `registro.scrivi`, dopo che la riga è già stata creata. Se l'avviso fallisce, la
 * regola resta scritta e la nutrizionista non vede nessun errore: il contrario — perdere la scrittura
 * perché non si è riusciti a mandare una notifica — sarebbe un guasto peggiore del guasto.
 */
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('VeraAvvisaCapo');

export interface RigaConflitto {
  id: string;
  frase: string;
  azione: string;
  ambito: string;
  soggettoNome: string | null;
  nutrizionistaId: string;
  /** Il vincolo che è stato scavalcato, com'era scritto nel profilo. */
  vincolo?: string | null;
}

/**
 * Il testo dell'avviso. Pura, perché è la parte che si sbaglia: una notifica che dice «conflitto
 * sanitario» e basta obbliga ad aprire la pagina per sapere se vale la pena aprirla.
 *
 * Dentro ci sono le tre cose che servono per decidere se alzarsi: **chi**, **su chi**, **cosa**.
 */
export function testoAvvisoConflitto(riga: RigaConflitto, autore: string | null): { titolo: string; corpo: string } {
  const chi = autore ?? 'Una nutrizionista';
  const suChi = riga.soggettoNome ? ` su ${riga.soggettoNome}` : '';
  const vincolo = riga.vincolo ? ` (in scheda: ${riga.vincolo})` : '';
  return {
    titolo: 'Regola confermata sopra un vincolo sanitario',
    corpo: `${chi} ha confermato una regola${suChi} che scavalca un vincolo dichiarato${vincolo}: «${riga.frase.slice(0, 140)}»`,
  };
}

/**
 * Avvisa chi sorveglia: i capi nutrizionisti.
 *
 * ⚠️ **Non** l'autrice della riga. Lo sa già — l'ha appena confermata rispondendo a una domanda che
 * le diceva esattamente questo — e una notifica per una cosa che si è appena fatti da soli è il modo
 * più rapido per insegnare a chiudere le notifiche senza leggerle.
 */
/** Il minimo di un postino: così si prova con un finto e non si dipende da MailService. */
export interface MailMinimo {
  send(input: { to: string; subject: string; html: string; tags?: string[] }): Promise<boolean>;
}

export async function avvisaConflittoSanitario(
  prisma: PrismaService,
  riga: RigaConflitto,
  /**
   * ⚠️ Facoltativo, e ANCHE email quando c'è (decisione di Simone, 13/8 sera): l'avviso solo
   * in-app vale finché il capo entra nel backoffice quel giorno — «subito» che diventa «quando
   * capita». Una mail mancata non ferma né le altre né la notifica in app.
   */
  mail?: MailMinimo | null,
): Promise<number> {
  try {
    const capi = (await prisma.user.findMany({
      where: { role: 'head_nutritionist', status: 'active', deletedAt: null } as never,
      select: { id: true, email: true },
      take: 20,
    })) as { id: string }[];
    const daAvvisare = (capi as { id: string; email?: string | null }[]).filter((c) => c.id !== riga.nutrizionistaId);
    const destinatari = daAvvisare.map((c) => c.id);
    if (!destinatari.length) return 0;

    const autore = (await prisma.user.findUnique({
      where: { id: riga.nutrizionistaId },
      select: { firstName: true, lastName: true },
    })) as { firstName: string | null; lastName: string | null } | null;
    const nome = [autore?.firstName, autore?.lastName].filter(Boolean).join(' ') || null;
    const { titolo, corpo } = testoAvvisoConflitto(riga, nome);

    await prisma.notification.createMany({
      data: destinatari.map((userId) => ({
        userId,
        type: 'vera_conflitto_sanitario',
        channel: 'inapp',
        payload: { title: titolo, body: corpo, kind: 'vera_conflitto_sanitario', azioneId: riga.id },
        scheduledFor: new Date(),
        sentAt: new Date(),
      })) as never,
    });
    // L'email, DOPO la notifica in app: se il postino è giù, la campanella c'è comunque.
    if (mail) {
      for (const capo of daAvvisare) {
        if (!capo.email) continue;
        try {
          await mail.send({
            to: capo.email,
            subject: `⚠️ Vera — conflitto sanitario confermato: ${riga.soggettoNome ?? 'una cliente'}`,
            html: `<p>${corpo.replace(/\n/g, '<br/>')}</p><p>Il dettaglio è nella pagina Assistente del backoffice.</p>`,
            tags: ['vera-conflitto-sanitario'],
          });
        } catch (e) {
          logger.warn(`Email del conflitto non partita per ${capo.email}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    return destinatari.length;
  } catch (err) {
    logger.warn(`Avviso di conflitto non mandato (azione=${riga?.id}): ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** La riga appena messa in coda: quello che serve per far suonare la campanella giusta. */
export interface PropostaInCoda {
  id: string;
  frase: string;
  nutrizionistaId: string;
  soggettoNome: string | null;
}

/**
 * LA CAMPANELLA DEL CAPO quando il team gli mette una proposta in coda (Simone, 14/8).
 *
 * Prima il capo scopriva la coda solo APRENDO la pagina dell'assistente: «subito» che diventa
 * «quando capita» — e dietro una proposta ferma c'è una nutrizionista che aspetta.
 *
 * ⚠️ Solo in-app, NIENTE email: quella resta al conflitto sanitario, che è un altro orologio
 * (decisione di Simone del 13/8 sul conflitto; qui vale il contrario — una email per ogni proposta
 * insegna a cancellarle senza leggerle). ⚠️ Non l'autore della proposta: lo sa già. ⚠️ E come
 * `avvisaConflittoSanitario`, NON lancia mai: perdere la scrittura per una notifica non partita
 * sarebbe un guasto peggiore del guasto. Se la riga è anche un conflitto sanitario questa funzione
 * non viene proprio chiamata: parte l'avviso di conflitto, che è più forte — una campanella, non due.
 */
export async function avvisaPropostaInCoda(prisma: PrismaService, riga: PropostaInCoda): Promise<number> {
  try {
    const capi = (await prisma.user.findMany({
      where: { role: 'head_nutritionist', status: 'active', deletedAt: null } as never,
      select: { id: true },
      take: 20,
    })) as { id: string }[];
    const daAvvisare = capi.filter((c) => c.id !== riga.nutrizionistaId);
    if (!daAvvisare.length) return 0;

    const autore = (await prisma.user.findUnique({
      where: { id: riga.nutrizionistaId },
      select: { firstName: true, lastName: true },
    })) as { firstName: string | null; lastName: string | null } | null;
    const nome = [autore?.firstName, autore?.lastName].filter(Boolean).join(' ') || 'Una nutrizionista';
    const suCosa = riga.soggettoNome ? ` su ${riga.soggettoNome}` : '';

    // ⚠️ `title` e `body` vivono dentro `payload`: la tabella non ha quelle colonne.
    await prisma.notification.createMany({
      data: daAvvisare.map((capo) => ({
        userId: capo.id,
        type: 'vera_proposta_in_coda',
        channel: 'inapp',
        payload: {
          title: 'Una proposta aspetta te',
          body: `${nome} ha proposto${suCosa}: «${riga.frase.slice(0, 140)}»`,
          kind: 'vera_proposta_in_coda',
          azioneId: riga.id,
        },
        scheduledFor: new Date(),
        sentAt: new Date(),
      })) as never,
    });
    return daAvvisare.length;
  } catch (err) {
    logger.warn(`Avviso di proposta in coda non mandato (azione=${riga?.id}): ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}
