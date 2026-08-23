/**
 * ⛔ **LA PESATA DEL RIENTRO** — il punto A della ripartenza, e perché non basta quella del ciclo.
 *
 * Richiesta di Simone (23/8): *«se la modalità viaggio termina il 24 agosto, il 23 le deve chiedere
 * le misure ed erogare il menu per il 24: il primo menu, come all'inizio, va erogato con un giorno
 * d'anticipo.»*
 *
 * ## Perché serve un gate suo, e non `cycleNeedsMeasure`
 *
 * Il cancello di metà percorso guarda «c'è una misura da quando è cominciato il ciclo corrente?».
 * Dopo una sospensione il ciclo corrente è quello **di prima della vacanza**, quindi la sua
 * finestra è vecchia di settimane — e dentro ci cade la sorveglianza della pausa, che una pesata
 * ogni due giorni la chiede già (`pause.service.surveillanceTick`). Risultato: al rientro il gate
 * risulterebbe soddisfatto da una pesata fatta a metà vacanza, e il menu del rientro partirebbe su
 * un peso di dieci giorni prima. È lo stesso identico difetto del caso Gioia (11/8), spostato di
 * qualche giorno: *il fabbisogno si calcola sul peso attuale*.
 *
 * ## La finestra
 *
 * È la stessa del rientro, e non un parametro nuovo che qualcuno dovrà indovinare: vale come pesata
 * del rientro quella fatta **da quando si apre la finestra** (`rientro − menu_visible_days_before_return`)
 * in avanti. Prima di quel giorno la cliente era in vacanza e quella pesata racconta la vacanza, non
 * la ripartenza — è la stessa regola con cui `misura-di-partenza.ts` decide cosa vale come punto A
 * di un piano nuovo.
 *
 * Verso il futuro nessun limite, per la stessa ragione di là: chi si pesa il giorno dopo il rientro
 * ha comunque fatto la cosa giusta, e trattenerle il menu per un giorno di ritardo sarebbe una
 * punizione.
 */
import type { PrismaService } from '../prisma/prisma.service';

const GIORNO = 86_400_000;

/** Da quale giorno una pesata vale come pesata del rientro. */
export function inizioFinestraRientro(rientro: Date, anticipoGiorni: number): Date {
  const g = Number.isFinite(anticipoGiorni) && anticipoGiorni > 0 ? Math.floor(anticipoGiorni) : 0;
  return new Date(rientro.getTime() - g * GIORNO);
}

/**
 * Vero se **manca** la pesata del rientro: allora il menu del rientro resta trattenuto e si chiede.
 */
export async function mancaLaPesataDelRientro(
  prisma: PrismaService,
  clientId: string,
  rientro: Date | null | undefined,
  anticipoGiorni: number,
): Promise<boolean> {
  if (!rientro) return false;
  const da = inizioFinestraRientro(rientro, anticipoGiorni);
  const misura = await prisma.measurement.findFirst({
    where: { clientId, date: { gte: da } },
    select: { id: true },
  });
  return !misura;
}

/** Il tipo della richiesta: **uno solo**, così le due porte che la mandano non si accavallano. */
export const TIPO_PESATA_DEL_RIENTRO = 'measures_return_required';

/**
 * Il testo della richiesta, scritto una volta sola.
 *
 * ⚠️ Lo mandano **due** punti: `menu.service` quando la cliente apre l'app, e il giro notturno
 * della sorveglianza (`pause.service.surveillanceTick`) per chi l'app non la apre — che è il caso
 * normale in vacanza. Due copie dello stesso testo divergono: la prima volta che qualcuno cambia
 * la frase la cambia in un posto solo, e metà delle clienti legge l'altra.
 *
 * ⚠️ Nomina **la data**: al rientro da una vacanza «inserisci la pesata» da solo non spiega
 * niente. Quello che fa alzare e prendere la bilancia è sapere che domani ricomincia e che il menu
 * è già pronto dall'altra parte del gesto.
 */
export function testoPesataDelRientro(rientro: Date): { titolo: string; corpo: string } {
  const quando = rientro.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return {
    titolo: 'Si riparte: pesati e il menu è tuo 📏',
    corpo:
      `Il ${quando} riprendi con la dieta. Inserisci peso e misure adesso e trovi subito in app il `
      + 'menu del primo giorno, così fai la spesa con calma.',
  };
}
