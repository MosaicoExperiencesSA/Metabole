/**
 * COSA NON DEVE ARRIVARLE NEL PIATTO — l'elenco che la cliente può finalmente leggere.
 *
 * Richiesta di Simone (13/8): due pulsanti nel profilo dell'app, «Cibi assolutamente vietati» e
 * «Cibi da evitare», e dentro l'elenco vero.
 *
 * ## Perché non basta ripetere quello che ha dichiarato
 *
 * Oggi una cliente sceglie «frutta a guscio» dall'elenco e non sa cosa vuol dire per il suo piatto.
 * Il valore di questa schermata non sono i pulsanti: è l'**espansione** — *noci, mandorle, nocciole,
 * pistacchi, anacardi, pinoli, macadamia, pecan* — cioè le stesse parole con cui il motore le toglie
 * i piatti. E fa anche da controllo: se ci vede dentro qualcosa che non c'entra, lo dice alla
 * nutrizionista.
 *
 * ⚠️ **Le parole vengono da `menu/exclusions.ts`**, la stessa funzione che esclude davvero. Se l'app
 * se ne tenesse una copia, il giorno che la mappa cambia la cliente leggerebbe un elenco e ne
 * mangerebbe un altro — ed è il difetto che questo progetto ha già avuto due volte.
 *
 * ## ⚠️ Le voci che non si sanno tradurre si mostrano lo stesso
 *
 * «Favismo» e «Carboidrati» esistono in banca dati e oggi non escludono niente, perché quelle parole
 * non compaiono in nessun ingrediente. Nasconderle vorrebbe dire che la cliente non vede più una cosa
 * che ha dichiarato lei; mostrarle come le altre le farebbe credere di essere protetta. Escono con
 * `alimenti: []`, e l'app ci scrive sopra che la nutrizionista la sta traducendo (decisione di
 * Simone, 13/8).
 */
import { allergenLabel } from '../catalog/allergens';
import { NON_ALIMENTI } from '../common/allergie';
import { expandExclusion } from '../menu/exclusions';

export type MotivoEsclusione = 'allergia' | 'intolleranza' | 'non_gradito';

export interface VoceEsclusa {
  /** Quello che ha dichiarato lei, con l'etichetta leggibile: «Frutta a guscio», non `frutta_a_guscio`. */
  voce: string;
  /** Le parole con cui il motore la toglie davvero dal piatto. Vuoto = nessuno l'ha ancora tradotta. */
  alimenti: string[];
  motivo: MotivoEsclusione;
}

export interface EsclusioniCliente {
  /** Allergie: blocco duro. */
  vietati: VoceEsclusa[];
  /** Intolleranze e cibi non graditi: il motore sostituisce il piatto. */
  daEvitare: VoceEsclusa[];
}

/**
 * ⚠️ Il termine originale NON si conta come «traduzione di sé stesso».
 *
 * `expandExclusion('favismo')` torna `['favismo']`: la parola scritta vale sempre come chiave di
 * ricerca, ed è giusto così per il motore. Ma qui, se la mostrassimo come alimento, la cliente
 * leggerebbe «Favismo → favismo» e crederebbe che qualcosa venga tolto. Quindi si tiene solo quello
 * che il termine ha **aggiunto**.
 */
function alimentiDi(termine: string): string[] {
  const grezzo = (termine ?? '').trim().toLowerCase();
  if (!grezzo) return [];
  const norm = grezzo.replace(/_/g, ' ');
  return expandExclusion(grezzo)
    .map((p) => p.toLowerCase())
    .filter((p) => p !== grezzo && p !== norm);
}

function voce(termine: string, motivo: MotivoEsclusione): VoceEsclusa | null {
  const grezzo = (termine ?? '').trim();
  if (!grezzo) return null;
  // ⚠️ «altro», «nessuna» e compagnia non sono alimenti: sono segni dell'interfaccia, e nell'elenco
  // di quello che non deve mangiare non ci vanno.
  
  if (NON_ALIMENTI.has(grezzo.toLowerCase())) return null;
  const etichetta = allergenLabel(grezzo.toLowerCase());
  const leggibile = etichetta !== grezzo.toLowerCase() ? etichetta : grezzo.replace(/_/g, ' ');
  return { voce: leggibile.charAt(0).toUpperCase() + leggibile.slice(1), alimenti: alimentiDi(grezzo), motivo };
}

export interface ProfiloEsclusioni {
  allergies?: string[] | null;
  intolerances?: string[] | null;
  dislikedFoods?: string[] | null;
}

export function esclusioniCliente(p: ProfiloEsclusioni): EsclusioniCliente {
  const da = (lista: string[] | null | undefined, motivo: MotivoEsclusione) =>
    (lista ?? []).map((t) => voce(t, motivo)).filter((v): v is VoceEsclusa => v !== null);
  return {
    vietati: da(p.allergies, 'allergia'),
    // ⚠️ Intolleranze e non graditi stanno INSIEME (decisione di Simone): il motore li tratta allo
    // stesso modo — sostituisce il piatto, non blocca il piano. Restano distinguibili dal `motivo`,
    // che l'app usa per le due righe di spiegazione.
    daEvitare: [...da(p.intolerances, 'intolleranza'), ...da(p.dislikedFoods, 'non_gradito')],
  };
}
