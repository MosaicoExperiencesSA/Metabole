/**
 * UNA DOMANDA SENZA RISPOSTA VA CHIUSA DA CHI L'HA FATTA.
 *
 * ## La conversazione da cui nasce (18/8, girata da Simone)
 *
 * Nella chat di una cliente, tre volte di fila lo stesso messaggio di Gaia:
 *
 *     Certo Patricia, vediamo insieme. Quale alimento vuoi cambiare?
 *     Oggi hai — colazione: … · pranzo: … · cena: …
 *     Scrivimi solo il nome dell'alimento (per esempio «le carote»).   [10 ago, 13:07]
 *     Certo Patricia, vediamo insieme. Quale alimento vuoi cambiare?   [11 ago, 16:00]
 *     Certo Patricia, vediamo insieme. Quale alimento vuoi cambiare?   […]
 *
 * ⚠️ E in mezzo, nessuna risposta della cliente.
 *
 * ## Perché succedeva, che non è «Gaia insiste»
 *
 * Nessun cron scrive quel messaggio: lo scrive il pulsante «Sostituisci» della home (e della
 * schermata Menu) → `POST /me/threads/sostituzione` → `SostituzioneChatService.apri`. Quelle tre
 * righe sono **tre aperture**: la cliente tocca il pulsante, legge — nel messaggio c'è anche il
 * menu del giorno, che è metà del motivo per cui uno lo tocca — e se ne va senza rispondere.
 *
 * Lo stato del dialogo scade dopo un'ora (`SCADENZA_FLUSSO_MS`), quindi l'apertura dopo riparte da
 * zero e **non sa** di aver già chiesto. Ogni volta la stessa domanda, per sempre.
 *
 * ## Cosa cambia
 *
 * La domanda rimasta senza risposta non resta appesa: dopo un giorno di silenzio Gaia la **chiude
 * lei**, dicendo che ha capito. Richiesta di Simone, parola sua: «se la cliente non risponde dopo
 * la seconda volta Gaia dice ok capisco che l'argomento non è più di tuo interesse e finisce la
 * conversazione».
 *
 * ⚠️ **Chiude il tempo, non un altro tocco del pulsante.** La strada alternativa — alla terza
 * apertura rispondere con la frase di chiusura invece che con la domanda — le direbbe «capisco che
 * non ti interessa più» **nell'istante esatto in cui sta chiedendo di cambiare un alimento**. È il
 * contrario di quello che serve. Chiudendo a tempo, la seconda domanda identica non arriva
 * nemmeno: la prima è già stata chiusa quando lei torna.
 *
 * ⚠️ E la chiusura **non toglie niente**: il pulsante funziona come sempre, e chi torna trova una
 * conversazione nuova e pulita invece di una vecchia a metà. È il motivo per cui la frase lo dice.
 */

import { appellativo } from './sostituzione-chat';

/** Il minimo che serve di un messaggio per decidere. Strutturale: la spec non importa Prisma. */
export interface MessaggioDiChat {
  senderRole: string;
  sentAt: Date;
  meta?: unknown;
}

/**
 * Quante ore di silenzio prima di chiudere. Un giorno: il dialogo muore da sé dopo un'ora, quindi
 * qui non si sta interrompendo niente di vivo — si sta solo dicendo a voce alta una cosa già vera.
 * ⚠️ Sovrascrivibile da `config_param` (`chat_chiusura_silenzio_ore`), come tutte le soglie.
 */
export const ORE_DI_SILENZIO = 24;

/**
 * ⚠️ E una finestra oltre la quale non si torna: al primo giro dopo il rilascio ci sono in banca
 * dati tutte le conversazioni lasciate a metà da sempre, e svegliare una persona per una domanda di
 * marzo non è chiudere una conversazione — è aprirne una. Trenta giorni.
 */
export const GIORNI_ALL_INDIETRO = 30;

const oreFra = (prima: Date, dopo: Date) => (dopo.getTime() - prima.getTime()) / 3_600_000;

/**
 * Il messaggio è una domanda di Gaia rimasta in attesa?
 *
 * Il marcatore **è la riga stessa**, come per la campagna allergie (`campagna-allergie.ts`) e per
 * la ri-domanda sulle sostituzioni: un contatore a parte sarebbe una seconda verità da tenere
 * allineata, e il giorno che divergono si scrive due volte alla stessa persona.
 *
 * ⚠️ `meta.sost` c'è **solo** finché il dialogo aspetta qualcosa: quando si applica, si rifiuta o
 * si passa alla coach, quel campo non viene scritto. Quindi la sua presenza è esattamente la
 * domanda «stiamo ancora aspettando una risposta?», senza doverla ricostruire dal passo.
 */
export function eUnaDomandaInAttesa(m: MessaggioDiChat | null | undefined): boolean {
  if (!m || m.senderRole !== 'ai') return false;
  const meta = m.meta as { kind?: unknown; sost?: unknown } | null | undefined;
  if (!meta || typeof meta !== 'object') return false;
  if (meta.kind !== 'sostituzione') return false;
  return !!meta.sost && typeof meta.sost === 'object';
}

export type EsitoChiusura =
  | { chiudere: true }
  /** `perche` serve alla diagnostica e ai test: un «no» muto non si capisce mai. */
  | { chiudere: false; perche: 'non_e_una_domanda' | 'troppo_presto' | 'troppo_vecchia' };

/**
 * Va chiusa questa conversazione?
 *
 * Tre condizioni, e tutte e tre dicono di no in modo diverso: non è una domanda in attesa (il
 * dialogo è finito, o l'ultimo messaggio è altro), è ancora presto (silenzio sotto la soglia:
 * potrebbe rispondere fra un minuto), è troppo vecchia (fuori dalla finestra: chiuderla oggi
 * sarebbe scrivere a qualcuno di una cosa che non ricorda).
 */
export function vaChiusa(
  ultimo: MessaggioDiChat | null | undefined,
  adesso: Date,
  ore: number = ORE_DI_SILENZIO,
  giorniIndietro: number = GIORNI_ALL_INDIETRO,
): EsitoChiusura {
  if (!eUnaDomandaInAttesa(ultimo)) return { chiudere: false, perche: 'non_e_una_domanda' };
  const silenzio = oreFra(ultimo!.sentAt, adesso);
  if (silenzio < ore) return { chiudere: false, perche: 'troppo_presto' };
  if (silenzio > giorniIndietro * 24) return { chiudere: false, perche: 'troppo_vecchia' };
  return { chiudere: true };
}

/**
 * La frase con cui Gaia chiude.
 *
 * ⚠️ Dice tre cose, e servono tutte e tre: **che cosa** era rimasto in sospeso (o «capisco» non si
 * capisce a cosa si riferisca, a distanza di un giorno), **che si chiude**, e **che si può
 * ricominciare quando vuole**. Senza l'ultima, una frase che dice «ho capito che non ti interessa»
 * suona come una porta chiusa a una persona che magari si era solo distratta.
 */
export function testoChiusuraPerSilenzio(nome?: string | null): string {
  // ⚠️ `appellativo` e non il nome così com'è: prende solo il nome proprio e scarta quello che
  // nome non è («M3», un cognome attaccato). È lo stesso di tutti gli altri testi di Gaia, e vive
  // in un posto solo apposta.
  const chi = appellativo(nome);
  return (
    `${chi}${chi ? 't' : 'T'}i avevo chiesto quale alimento volevi cambiare e non ci siamo più sentite: ` +
    'capisco che l\'argomento non sia più di tuo interesse, quindi chiudo qui.\n\n' +
    'Se cambi idea tocca «Sostituisci» dalla home quando vuoi: ripartiamo da capo, senza fretta. 💚'
  );
}
