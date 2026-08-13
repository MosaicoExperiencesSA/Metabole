/**
 * LA NOTIFICA CHE APRE LA RI-DOMANDA — e il freno che impedisce di farla due volte.
 *
 * §7.3 e §7.4 dell'handoff. Sta in una funzione con Prisma passato, e non in un servizio Nest, per
 * la stessa ragione di `menu/senza-glutine.ts`: la deve poter chiamare anche lo script
 * `prisma/chiedi-allergie.ts`, e un servizio Nest in uno script `ts-node` non si importa.
 *
 * ## ⚠️ CHI CONTATTA: due popolazioni su tre
 *
 * Il 13/8 Simone ha deciso che a chi **non ha mai risposto** la domanda la fa la scheda in home
 * dell'app (`app/src/components/ChiediAllergie.tsx`, OTA della stessa sera): niente notifica,
 * niente conversazione che scade, la vedono tutte quelle che aprono l'app.
 *
 * Restano fuori da quella scheda due cose che una casella da spuntare non sa fare, e sono
 * esattamente quelle per cui serve parlare:
 *
 *  1. **`intolleranza_ignota`** — ha spuntato «Altro» fra le intolleranze e non ha mai potuto dire
 *     cosa (il campo non esisteva fino al 13/8). La scheda in home chiede le **allergie**: questa
 *     domanda lì non c'è.
 *  2. **`allergie_da_codificare`** — ha un'allergia scritta a mano che nessuno ha tradotto in
 *     codice. La scheda in home **aggiunge e non sostituisce**, di proposito: da lì quel testo
 *     libero non si tocca, e resta a bloccare la base personale.
 *
 * ⚠️ Questa lista **non è un criterio nuovo**: è un sottoinsieme di quello che decide
 * `common/da-ricontattare.ts`, la stessa funzione che le ha contate il 13/8. Se un giorno la
 * scheda in home coprisse anche queste due, qui si toglie una riga — non si riscrive una regola.
 */
import { MotivoDialogo } from './allergie-chat';

/** Il tipo della notifica. È anche il marcatore di «gliel'ho già chiesto»: vedi sotto. */
export const TIPO_NOTIFICA_ALLERGIE = 'allergie_conferma';

/** Le popolazioni che la campagna in chat contatta davvero. Vedi il commento in testa al file. */
export const POPOLAZIONI_IN_CAMPAGNA: readonly MotivoDialogo[] = ['intolleranza_ignota', 'allergie_da_codificare'];

/**
 * Titolo e corpo, uno per popolazione.
 *
 * ⚠️ Nessun contenuto sanitario nel titolo: questa roba si legge sulla schermata di blocco, e sul
 * telefono di una persona che magari lo appoggia sul tavolo. «Una domanda sulle tue allergie» va
 * bene; l'allergia che ha dichiarato, no.
 */
export function testoNotifica(motivo: MotivoDialogo): { title: string; body: string } {
  if (motivo === 'intolleranza_ignota') {
    return {
      title: 'Una domanda rimasta in sospeso',
      body: 'Nel questionario avevi segnato «Altro» fra le intolleranze, ma il campo per scrivere quale non c\'era ancora. Dimmelo in chat: bastano dieci secondi.',
    };
  }
  return {
    title: 'Controlliamo le tue allergie?',
    body: 'Ne avevi scritta una con parole tue e voglio essere sicura di averla capita bene, così i tuoi menu la evitano davvero. Ci mettiamo un minuto in chat.',
  };
}

/** Il minimo di Prisma che serve. Un tipo strutturale, così lo script non deve importare Nest. */
export interface PrismaPerCampagnaAllergie {
  clientProfile: {
    findUnique(args: unknown): Promise<Record<string, unknown> | null>;
  };
  notification: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<unknown>;
  };
}

export type EsitoInvito =
  | { esito: 'inviata'; motivo: MotivoDialogo }
  | { esito: 'gia_chiesta'; motivo: MotivoDialogo }
  | { esito: 'fuori_campagna'; motivo: MotivoDialogo }
  | { esito: 'non_serve'; motivo: null };

/**
 * Invita una cliente alla ri-domanda, se le serve e se non gliel'abbiamo già chiesto.
 *
 * ## «Gliel'ho già chiesto?» — lo dice la notifica stessa
 *
 * Non c'è un flag generico per «domanda già posta», e non serve inventarlo: la riga della notifica
 * **è** il marcatore, com'è già fatto in `sostituzione-chat.service.ts:1288-1298`. Un contatore a
 * parte sarebbe una seconda verità da tenere allineata, e la prima volta che divergono si mandano
 * due notifiche uguali alla stessa persona.
 *
 * ⚠️ Senza finestra temporale: qui «già chiesto» è **per sempre**. Ma per *quel* motivo: se
 * un domani la stessa cliente ricade nell'altra popolazione, quella è un'altra domanda e ha diritto
 * alla sua. Filtrare solo per tipo la lascerebbe con un'intolleranza ignota per sempre, perché sei
 * mesi prima le avevamo chiesto un'altra cosa.
 */
export async function invitaARidichiarare(
  prisma: PrismaPerCampagnaAllergie,
  clientId: string,
  motivo: MotivoDialogo,
  opzioni?: { /** Non scrivere niente: la prova dello script. */ prova?: boolean },
): Promise<EsitoInvito> {
  if (!POPOLAZIONI_IN_CAMPAGNA.includes(motivo)) return { esito: 'fuori_campagna', motivo };

  const gia = await prisma.notification.findFirst({
    where: {
      type: TIPO_NOTIFICA_ALLERGIE,
      userId: clientId,
      AND: [
        { payload: { path: ['clientId'], equals: clientId } },
        { payload: { path: ['motivo'], equals: motivo } },
      ],
    },
    select: { id: true },
  });
  if (gia) return { esito: 'gia_chiesta', motivo };
  if (opzioni?.prova) return { esito: 'inviata', motivo };

  const { title, body } = testoNotifica(motivo);
  const adesso = new Date();
  await prisma.notification.create({
    data: {
      userId: clientId,
      type: TIPO_NOTIFICA_ALLERGIE,
      channel: 'inapp',
      /**
       * ⚠️ `title` e `body` **non sono colonne**: vivono qui dentro. Scriverli come campi fa
       * esplodere Prisma a runtime (`senza-glutine.ts:236-238`).
       *
       * ⚠️ E qui dentro ci vanno **solo stringhe** per le chiavi che viaggiano nella push
       * (`notifications/dati-push.ts`): `kind`, `clientId`, `counterpart`. Un numero o un `null`
       * fa fallire l'invio **intero**, e il fallimento si vede solo nei log del server.
       *
       * `counterpart: 'ai'` porta già a `/assistente` (`app/src/lib/rottaNotifica.ts`); è `kind`
       * che fa aggiungere `?intent=allergie` e fa cominciare il dialogo invece di aprire una chat
       * vuota su cui la cliente non sa cosa scrivere.
       */
      payload: {
        title,
        body,
        kind: TIPO_NOTIFICA_ALLERGIE,
        counterpart: 'ai',
        clientId,
        motivo,
      },
      scheduledFor: adesso,
      sentAt: adesso,
    },
  });
  return { esito: 'inviata', motivo };
}
