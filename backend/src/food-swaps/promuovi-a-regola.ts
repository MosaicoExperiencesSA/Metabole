import { combaciaAlimento } from '../common/nomi-alimento';

export interface GruppoCandidato {
  id: string;
  name: string;
  status: string;
  productId: string | null;
  items: string[];
}

export type EsitoPromozione =
  | { azione: 'gia_regola'; gruppoId: string; nomeGruppo: string }
  | { azione: 'aggiungi'; gruppoId: string; nomeGruppo: string; daAggiungere: string[] }
  | { azione: 'crea'; items: string[] };

/**
 * «PROMUOVI A REGOLA»: decidere COSA fare, senza toccare il database.
 *
 * Una riga validata dice «per questa cliente, in questo piatto, X si può fare con Y». Portarla nei
 * gruppi di equivalenza vuol dire dire «X e Y si equivalgono», per tutte. È un salto, e il punto di
 * §16.9 è che lo faccia una persona, una riga per volta — non un automatismo.
 *
 * Le tre risposte possibili, in ordine di quanto sono utili:
 *
 * 1. **`gia_regola`** — esiste già un gruppo APPROVATO che contiene tutti e due gli alimenti. Il
 *    motore lo sa già: creare un secondo gruppo con dentro le stesse due cose non aggiunge niente e
 *    lascia in giro un doppione da approvare. Si dice e basta, e la riga si segna come promossa lì.
 * 2. **`aggiungi`** — c'è un gruppo in BOZZA che contiene uno dei due: si aggiunge il mancante.
 *    Senza questo passaggio, dieci promozioni sullo stesso alimento fanno dieci gruppi da due voci
 *    ciascuno, e la tabella dei gruppi diventa illeggibile proprio mentre la si sta usando.
 * 3. **`crea`** — niente di simile in giro: nasce un gruppo nuovo, IN BOZZA.
 *
 * ⚠️ Un gruppo **approvato** non viene mai modificato da qui, nemmeno per aggiungere una voce. Il
 * motore usa solo i gruppi approvati: allargarne uno senza che nessuno lo riapprovi cambierebbe i
 * menu di tutte le clienti a partire dalla notte stessa, per una richiesta fatta da una. Se il
 * gruppo giusto è approvato ma copre solo uno dei due alimenti, si crea una bozza — che qualcuno
 * guarderà, e semmai fonderà a mano.
 *
 * ⚠️ Il confronto è `combaciaAlimento`, per parola e con la radice: con `includes` un gruppo che
 * contiene «peperoni» risponderebbe alla promozione di «pepe».
 */
export function decidiPromozione(
  da: string,
  a: string,
  gruppi: GruppoCandidato[],
): EsitoPromozione {
  const contiene = (g: GruppoCandidato, alimento: string) => g.items.some((i) => combaciaAlimento(i, alimento));

  const approvati = gruppi.filter((g) => g.status === 'approved');
  const gia = approvati.find((g) => contiene(g, da) && contiene(g, a));
  if (gia) return { azione: 'gia_regola', gruppoId: gia.id, nomeGruppo: gia.name };

  const bozze = gruppi.filter((g) => g.status !== 'approved');
  // Prima le bozze che contengono ENTRAMBI (niente da aggiungere, ma è lì che va segnata), poi
  // quelle che ne contengono uno.
  const bozza = bozze.find((g) => contiene(g, da) && contiene(g, a)) ?? bozze.find((g) => contiene(g, da) || contiene(g, a));
  if (bozza) {
    const daAggiungere = [da, a].filter((alimento) => !contiene(bozza, alimento));
    return { azione: 'aggiungi', gruppoId: bozza.id, nomeGruppo: bozza.name, daAggiungere };
  }

  return { azione: 'crea', items: [da, a] };
}

/** Il nome di un gruppo nato da una promozione: si deve capire da dove viene, leggendolo. */
export function nomeGruppoDaSostituzione(da: string, a: string): string {
  const pulito = (s: string) => s.trim().replace(/\s+/g, ' ');
  return `${pulito(da)} ↔ ${pulito(a)}`.slice(0, 80);
}
