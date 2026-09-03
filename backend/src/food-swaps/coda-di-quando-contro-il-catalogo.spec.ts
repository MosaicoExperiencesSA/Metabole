import { readFileSync } from 'fs';
import { join } from 'path';
import { separaIlQuando } from './coda-di-quando';

/**
 * ⛔ **L'ELENCO CHIUSO SI MISURA SUI NOMI VERI, non si giudica a occhio.**
 *
 * È la regola già scritta dentro `impara-dalla-chat.ts` per `VERBI_CHE_NEGANO`: *«chi allunga
 * questo elenco controlli prima i nomi del catalogo»* — perché una parola d'ambito che combacia con
 * la **fine** di un piatto vero fa sparire mezzo nome, cioè rimette in piedi al contrario proprio il
 * difetto che `coda-di-quando.ts` esiste per chiudere. Un «Minestrone della domenica» diventerebbe
 * «Minestrone», e la regola imparata varrebbe su tutti i minestroni.
 *
 * Qui i 1246 nomi dei tre cataloghi (606 distinti) passano uno per uno dal separatore, e **nessuno
 * deve perdere niente**. Il giorno che qualcuno aggiunge al catalogo un piatto che finisce come un
 * orario, questa prova diventa rossa e l'elenco si accorcia — invece di scoprirlo da una regola
 * sbagliata in banca dati.
 *
 * ## ⚠️ Due limiti, detti invece che scoperti dopo
 *
 * ⚠️ **Primo: oggi questa prova passa a vuoto.** Nessuna delle code dell'elenco combacia con la fine
 * di un nome del seme, quindi non sta misurando il rischio di **adesso**: è una rete per il futuro
 * del catalogo. Il rischio vero di oggi sta nella **frase** che scrive la nutrizionista, non nel
 * catalogo — «i biscotti **da** colazione» è un nome di prodotto che arriva in chat, e a quello
 * risponde l'elenco chiuso di `coda-di-quando.ts` insieme al corpus delle frasi normali. Dirlo
 * cambia cosa si va a guardare quando qualcosa non torna.
 *
 * ⚠️ **Secondo: questi file sono il seme, non la produzione.** Il catalogo vero sta in banca dati e
 * cresce da lì; un nome scritto a mano dal backoffice che finisse come un orario **non** farebbe
 * diventare rossa questa prova. È lo stesso buco della voce `scheda-stile-cablata-nell-app`, e si
 * chiude allo stesso modo: con una diagnostica che legge i nomi veri dal database.
 */

const CATALOGHI = ['keto_catalog.json', 'proteica_catalog.json', 'simple_italian_catalog.json'];

/** Ogni valore di `name`/`nome`/`title`/`titolo`, a qualunque profondità. */
function nomiDentro(dato: unknown, dentro: string[] = []): string[] {
  if (Array.isArray(dato)) {
    for (const v of dato) nomiDentro(v, dentro);
  } else if (dato && typeof dato === 'object') {
    for (const [k, v] of Object.entries(dato as Record<string, unknown>)) {
      if (['name', 'nome', 'title', 'titolo'].includes(k) && typeof v === 'string') dentro.push(v);
      else nomiDentro(v, dentro);
    }
  }
  return dentro;
}

const NOMI = CATALOGHI.flatMap((f) =>
  nomiDentro(JSON.parse(readFileSync(join(__dirname, '..', '..', 'prisma', 'data', f), 'utf8'))),
);

describe('⛔ la coda di contesto non mangia nessun nome di catalogo', () => {
  /**
   * ⛔ **La sentinella del lettore, e non è pignoleria.** Una prova che legge file altrui e non
   * trova niente passerebbe **verde sul vuoto**: se domani quei file cambiassero forma — o si
   * spostassero — «zero nomi controllati» direbbe «tutto a posto». È la stessa mutazione che il 3/9
   * ha preso su `scheda-stile-nell-app.spec.ts` («il lettore prende zero chiavi»).
   */
  it('⛔ i cataloghi si leggono davvero: più di mille nomi', () => {
    expect(NOMI.length).toBeGreaterThan(1000);
    expect(NOMI.every((n) => typeof n === 'string' && n.trim().length > 0)).toBe(true);
  });

  it('⛔ nessuno dei nomi di catalogo perde una parola', () => {
    const tagliati = NOMI.filter((n) => separaIlQuando(n).coda !== '').map(
      (n) => `${n} → «${separaIlQuando(n).nome}» (tolto: «${separaIlQuando(n).coda}»)`,
    );
    expect(tagliati).toEqual([]);
  });

  /**
   * ⚠️ Gli unici due nomi che contengono una parola d'ambito la hanno **davanti**, dove non si
   * taglia mai: la risalita parte dalla fine e si ferma alla prima parola che un alimento è. Questa
   * riga tiene fermo il caso invece di lasciarlo alla fortuna.
   */
  it('⚠️ e «Pranzo a base di pesce» resta intero: davanti non si taglia', () => {
    expect(separaIlQuando('Pranzo a base di pesce').coda).toBe('');
    expect(separaIlQuando('Pranzo a base').coda).toBe('');
  });
});
