/**
 * DALLA CHAT ALLA TABELLA — quello che il nutrizionista scrive alla cliente diventa memoria.
 *
 * Il riconoscimento del testo sta in `impara-dalla-chat.ts`; qui c'è solo il passo che scrive.
 *
 * ## ⚠️ Nasce `da_verificare` anche se l'ha detto il nutrizionista
 *
 * Sembra una contraddizione: la coda di verifica esiste perché un umano guardi quello che ha
 * concordato Gaia, e qui l'umano è proprio chi ha scritto la frase. Ma **quello che va verificato
 * non è la decisione, è la lettura**. La frase è stata scritta per una persona; a rileggerla è un
 * programma, che può averne invertito la direzione o preso la parola sbagliata. Segnarla
 * `verificata` vorrebbe dire far entrare nella memoria di Gaia — con l'autorevolezza di una regola
 * clinica — una riga che nessuno ha mai riletto.
 *
 * Per questo la riga si porta dietro **la frase esatta**: chi apre la tabella conferma in un
 * secondo, senza dover ritrovare il messaggio nella conversazione.
 *
 * ## ⚠️ Nessuna notifica
 *
 * Il nutrizionista ha appena scritto quel messaggio. Avvisarlo di quello che ha fatto tre secondi
 * prima è il modo più rapido per insegnargli a ignorare le notifiche (stessa ragione di
 * `esclusoUserId` in `avvisaCapiNutrizionisti`). La riga lo aspetta nella tabella, quando passa.
 *
 * ## ⚠️ Non lancia mai
 *
 * Sta in fondo all'invio di un messaggio in chat. Il messaggio è la cosa necessaria; questa è la
 * cosa utile. Un errore qui non deve impedire a una nutrizionista di parlare con la sua paziente.
 */
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sostituzioniNelMessaggio } from './impara-dalla-chat';
import { registraSostituzione } from './registra-sostituzione';

const logger = new Logger('ImparaDalNutrizionista');

/** I ruoli le cui parole valgono come istruzione clinica. */
const VOCI_CHE_DECIDONO = new Set(['nutritionist', 'head_nutritionist']);

const dataItaliana = (d: Date): string =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit' }).format(d);

/**
 * Legge un messaggio appena scritto e registra le sostituzioni che contiene.
 *
 * Ritorna quante ne ha imparate — zero quasi sempre, ed è il comportamento voluto.
 */
export async function imparaDalNutrizionista(
  prisma: PrismaService,
  dati: {
    clientId: string;
    autoreRuolo: string;
    autoreId?: string | null;
    testo: string;
    quando?: Date;
  },
): Promise<number> {
  // ⚠️ Solo il nutrizionista. La stessa frase scritta dalla CLIENTE («posso mangiare il tacchino al
  // posto del pollo») è una richiesta, non un permesso: trattarla come una regola vorrebbe dire
  // lasciare che si autorizzi da sola scrivendo nella chat giusta.
  if (!VOCI_CHE_DECIDONO.has(dati.autoreRuolo)) return 0;
  if (!dati.clientId || !dati.testo) return 0;

  try {
    const lette = sostituzioniNelMessaggio(dati.testo);
    if (!lette.length) return 0;

    let scritte = 0;
    for (const s of lette) {
      const riga = await registraSostituzione(prisma, {
        clientId: dati.clientId,
        tipo: 'ingrediente',
        from: s.from,
        to: s.to,
        // ⚠️ Nessun piatto: una frase in chat non dice in quale ricetta vale. Scriverne uno a caso
        // sarebbe peggio che non averlo — `chiaveSostituzione` lo mette nella chiave, e un piatto
        // sbagliato spezzerebbe il conteggio con la riga giusta.
        recipeId: null,
        origine: 'nutrizionista',
        stato: 'da_verificare',
        nota: `Letto dalla chat del ${dataItaliana(dati.quando ?? new Date())}: «${s.frase}»`,
        creataDaId: dati.autoreId ?? null,
      });
      if (riga) scritte += 1;
    }
    return scritte;
  } catch (err) {
    logger.warn(
      `Sostituzioni non imparate dalla chat (cliente=${dati.clientId}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return 0;
  }
}
