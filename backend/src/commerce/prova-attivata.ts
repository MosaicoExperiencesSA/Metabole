/**
 * «LA PROVA È PARTITA DAVVERO» — i tre pezzi che raccontano lo stesso momento, in un posto solo.
 *
 * Sono sempre stati tre righe dentro `finalizeApproval`, nel ramo dell'importo a zero:
 *  1. evento di funnel `trial_started`;
 *  2. CRM che avanza a «Prova»;
 *  3. avviso alla coach — la finestra in cui una telefonata cambia l'esito della prova.
 *
 * ## Perché non stanno più lì (decisione di Simone, 11/8)
 *
 * Con l'attivazione automatica di «Conosciamoci» a fine questionario, la cliente **scegli lei la
 * data di inizio** — e fra l'attivazione e il primo menu possono passare settimane. «Prova» su una
 * che non ha ancora visto un piatto dice il falso: la manager delle coach vedrebbe una colonna
 * piena di gente che non ha cominciato, e la coach riceverebbe l'avviso settimane prima del momento
 * in cui serve telefonare.
 *
 * Quindi il momento vero è **il primo menu in assoluto**, e chi lo conosce è `deliverIfEligible`.
 * I tre pezzi si spostano insieme: tenerli separati vorrebbe dire tre risposte diverse alla domanda
 * «quando è iniziata la prova?», e nessuno saprebbe più quale credere.
 *
 * ## Idempotenza
 *
 * `deliverIfEligible` gira a ogni apertura dell'app. La guardia è l'evento `trial_started`: se c'è,
 * qui non si fa nulla. Senza, il conto delle prove avviate diventerebbe il conto delle erogazioni.
 */
import { avanzaStatoSeIndietro } from './avanza-stato';
import { emettiEventoFunnel, eventoGiaEmesso } from './funnel-event';
import { avvisaCoachDellaCliente } from '../common/avvisa-coach';
import { notificaUtente, type PushMinimo } from '../notifications/notifica-utente';
import type { PrismaService } from '../prisma/prisma.service';

/** Esito, per chi vuole loggarlo o provarlo: `false` = era già stata registrata. */
export interface EsitoProvaAttivata {
  registrata: boolean;
}

export async function provaAttivata(
  prisma: PrismaService,
  push: PushMinimo,
  input: { clientId: string; subscriptionId?: string | null; byUserId?: string },
): Promise<EsitoProvaAttivata> {
  const { clientId } = input;
  if (await eventoGiaEmesso(prisma, clientId, 'trial_started')) return { registrata: false };

  await emettiEventoFunnel(prisma, clientId, 'trial_started', {
    ...(input.subscriptionId ? { subscriptionId: input.subscriptionId } : {}),
    momento: 'primo_menu',
  });

  /**
   * CRM → «Prova». `avanzaStatoSeIndietro` e non `autoAdvance`: la regola di prima era la guardia
   * «se non è già `paid` non retrocedere», e questa funzione fa la stessa cosa in generale —
   * confronta l'ORDINE delle colonne, quindi non riporta indietro nemmeno una cliente che è già a
   * «Follow-up» o «Percorso concluso». Chi è avanti resta avanti.
   */
  await avanzaStatoSeIndietro(prisma as never, clientId, 'trial', input.byUserId ?? clientId).catch(
    () => false,
  );

  await avvisaCoachDellaCliente(
    prisma,
    { notify: (i) => notificaUtente(prisma, push, i as never) },
    clientId,
    {
      type: 'client_trial_started',
      title: 'Prova attivata',
      body: (nome) => `${nome} ha ricevuto il suo primo menu: la prova è iniziata.`,
    },
  ).catch(() => false);

  return { registrata: true };
}

/**
 * RETE DI SICUREZZA DEL FUNNEL — il buco che si apre spostando `trial_started` al primo menu.
 *
 * `trial_converted` scatta solo se `trial_started` esiste già (`finalizeApproval`). Ma ora
 * `trial_started` arriva al primo menu, e una cliente può comprare **prima** di averlo ricevuto —
 * è il caso di chi si entusiasma subito, cioè esattamente quella che si vuole contare. Senza questa
 * funzione la sua conversione non verrebbe registrata mai, e il tasso di conversione della prova
 * sarebbe silenziosamente più basso del vero.
 *
 * Allora: se al primo acquisto vero manca l'evento ma la prova c'è stata (una Subscription su un
 * piano a €0), l'evento si scrive **a ritroso**, marcato `recuperato: true` per non far sembrare un
 * dato pulito una ricostruzione. Poi la conversione può essere contata.
 *
 * Ritorna `true` se, dopo questa chiamata, la prova risulta iniziata.
 */
export async function assicuraProvaIniziata(
  prisma: PrismaService,
  clientId: string,
): Promise<boolean> {
  if (await eventoGiaEmesso(prisma, clientId, 'trial_started')) return true;

  const provaFatta = await prisma.subscription
    .findFirst({
      where: { clientId, plan: { priceCents: 0 } } as never,
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    })
    .catch(() => null);
  if (!provaFatta) return false;

  await emettiEventoFunnel(prisma, clientId, 'trial_started', {
    subscriptionId: (provaFatta as { id: string }).id,
    momento: 'recuperato_al_primo_acquisto',
    recuperato: true,
  });
  return true;
}
