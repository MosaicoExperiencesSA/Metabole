/**
 * DI QUANDO È QUESTO ELENCO — voce `alimenti-da-correggere-senza-data`, 25/8.
 *
 * «Alimenti da correggere» non è un conto fatto mentre guardi: è un elenco **scritto da un passo
 * notturno**. Il 21/8 all'una, dopo aver caricato 277 alimenti, la pagina mostrava ancora `limone`
 * e `cipolla` fra i mancanti, e la domanda è stata *«stiamo perdendo pezzi invece di farli?»*.
 * Nessun pezzo perso: il passo non era ancora passato. ⚠️ Un elenco vecchio di ore che sembra vivo
 * fa credere che il lavoro appena fatto non sia servito.
 *
 * Qui dentro non c'è React apposta: è una funzione pura, quindi si può misurare.
 */

/**
 * Dopo quante ore il silenzio del passo notturno diventa una cosa da dire.
 *
 * Il passo gira una volta a notte: ventiquattr'ore sono la vita normale di un elenco, non un
 * guasto. Due ore di margine coprono la notte che parte tardi. ⚠️ Sotto le 24 la pagina griderebbe
 * ogni pomeriggio per un elenco perfettamente regolare, e un allarme che suona sempre non lo
 * guarda più nessuno.
 */
export const ORE_PRIMA_DI_INSOSPETTIRSI = 26;

export type EtaElenco =
  /** Il passo non ha mai lasciato una riga di registro: non sappiamo di quando è l'elenco. */
  | { stato: 'mai' }
  /**
   * ⛔ **La data c'è ma non si legge** — e non è «mai girato». Sono due cose diverse: una dice che
   * il lavoro non è stato fatto, l'altra che non riusciamo a raccontarlo. Confonderle è la stessa
   * bugia che questa funzione esiste per togliere.
   */
  | { stato: 'illeggibile' }
  /** Girato entro la finestra normale. */
  | { stato: 'fresco'; quando: string }
  /** Girato, ma troppo tempo fa: l'elenco può non tenere conto di quello che hai appena caricato. */
  | { stato: 'vecchio'; quando: string; ore: number }
  /**
   * ⛔ **La data è nel FUTURO**: o l'orologio del server o quello di questo computer è storto. Non è
   * «fresco» (un elenco può essere fermo da giorni e avere una data futura per un orologio avanti) e
   * non si può nemmeno dire «sono passate N ore», perché non sono passate. Si dice quello che si sa.
   */
  | { stato: 'orologio'; quando: string };

const due = (n: number) => String(n).padStart(2, '0');

/** Mezzanotte del giorno di `d`, per contare i giorni di distanza e non le 24 ore. */
const giorno = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * «ieri alle 03:12» e non «22 ore fa»: chi guarda deve poter confrontare con l'ora in cui **lui**
 * ha caricato il file. ⚠️ Un tempo relativo («22 ore fa») costringe a fare un conto a mente proprio
 * nel momento in cui si sta cercando di capire se manca qualcosa.
 */
export function quandoInParole(quando: Date, adesso: Date): string {
  const ore = `${due(quando.getHours())}:${due(quando.getMinutes())}`;
  const distanza = Math.round((giorno(adesso) - giorno(quando)) / 86_400_000);
  if (distanza === 0) return `oggi alle ${ore}`;
  if (distanza === 1) return `ieri alle ${ore}`;
  return `il ${due(quando.getDate())}/${due(quando.getMonth() + 1)} alle ${ore}`;
}

/**
 * ⚠️ **`null` vuol dire «mai», non «adesso».** È la differenza fra un elenco che non esiste ancora e
 * un elenco appena rifatto: mostrarli uguali sarebbe la stessa bugia che ha fatto perdere quella
 * mezz'ora il 21/8.
 *
 * ⚠️ **Una data nel futuro non è fresca per finta, e nemmeno vecchia.** Se l'orologio del server e
 * quello del browser non vanno d'accordo, la distanza esce negativa: chiamarla «fresca» nasconde un
 * elenco fermo da giorni, e chiamarla «vecchia» fa stampare «sono passate 72 ore» sotto una data di
 * dopodomani. Ha uno stato suo, e la pagina dice quello che sa.
 */
export function etaDellElenco(iso: string | null | undefined, adesso: Date): EtaElenco {
  if (!iso) return { stato: 'mai' };
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return { stato: 'illeggibile' };
  const parole = quandoInParole(quando, adesso);
  /**
   * ⚠️ **Un minuto di margine sul futuro**, non zero: fra l'orologio del server e quello del
   * browser ci sono sempre qualche secondo e il tempo della risposta, e chiamare «orologio storto»
   * uno scarto di tre secondi vorrebbe dire mostrare un avviso a chi ha appena premuto il pulsante.
   */
  const avanti = (quando.getTime() - adesso.getTime()) / 60_000;
  if (avanti > 1) return { stato: 'orologio', quando: parole };
  const ore = (adesso.getTime() - quando.getTime()) / 3_600_000;
  if (ore > ORE_PRIMA_DI_INSOSPETTIRSI) return { stato: 'vecchio', quando: parole, ore: Math.floor(ore) };
  return { stato: 'fresco', quando: parole };
}
