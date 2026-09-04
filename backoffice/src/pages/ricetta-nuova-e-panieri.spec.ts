import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./Ricette.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('./MenuAMano.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const ricette = sorgenti['./Ricette.tsx'] ?? '';
const menu = sorgenti['./MenuAMano.tsx'] ?? '';

/**
 * ⛔ **UNA RICETTA NUOVA CHE NON STA IN NESSUN PANIERE NON ARRIVA A NESSUNO.**
 *
 * Simone, 4/9: *«ovviamente mi chiederà anche in quali panieri metterla»*. Fino a quel giorno
 * «Nuova ricetta» salvava e chiudeva: la ricetta entrava in catalogo e **il motore non la pescava
 * mai**, perché con `panieri_sorgente_pool` è il paniere a decidere cosa arriva nel piatto. Chi
 * l'aveva appena scritta la ritrovava «da nessuna parte» senza nessun errore.
 */
describe('la ricetta appena creata chiede in quali panieri va', () => {
  it('⛔ dopo il POST la finestra NON si chiude: passa al secondo passo', () => {
    expect(ricette).toMatch(/const nata = await api<Recipe>\('\/recipes'/);
    expect(ricette).toMatch(/if \(nata\?\.id\) \{ setCreata\(nata\); setBusy\(false\); return; \}/);
  });

  /** ⚠️ E il secondo passo riusa lo stesso pezzo della modifica, invece di un secondo elenco. */
  it('⚠️ il secondo passo è `InQualiPanieri`, non un elenco nuovo', () => {
    expect(ricette).toMatch(/<InQualiPanieri recipe=\{creata\} \/>/);
  });

  /**
   * ⛔ **La riga in cima non dice «salvata con successo».** Dice cosa manca ancora perché quel
   * piatto arrivi a qualcuno: un messaggio di successo davanti a una ricetta che nessuna cliente
   * riceverà mai è la bugia più facile da scrivere.
   */
  it('⛔ e dice che senza paniere il motore non la pesca', () => {
    expect(ricette).toMatch(/Finché non sta in un paniere il motore non la pesca/);
  });

  /** ⚠️ Il passo si può saltare — ma bisogna vederlo. */
  it('⚠️ si può chiudere, e chiudendo la ricetta resta creata', () => {
    expect(ricette).toMatch(/onClick=\{\(\) => onSaved\(null, creata\)\}/);
  });
});

/**
 * ⛔ **«IL PIATTO CHE SERVE NON C'È» — da dentro il menu della cliente.**
 *
 * Terza parte della richiesta del 4/9. ⚠️ Le due cose che la rendono utile invece che pericolosa
 * sono qui sotto: il verdetto lo dà il **server** anche sulla ricetta appena scritta, e il permesso
 * si chiede **prima** di far compilare il modulo.
 */
describe('scrivere una ricetta nuova da «Scrivi menu a mano»', () => {
  it('⚠️ riusa la finestra della pagina Ricette invece di riscriverne una seconda', () => {
    expect(menu).toMatch(/import \{ RecipeModal, type Recipe \} from '\.\/Ricette';/);
    expect(menu).toMatch(/<RecipeModal/);
  });

  /**
   * ⛔ **Il verdetto è del SERVER anche qui.** Comporre la riga con quello che si è appena digitato
   * e `bloccata: false` vorrebbe dire servire alla cliente un piatto con un suo allergene senza
   * barratura e senza motivo: la ricetta l'ha appena scritta una persona, non un controllo.
   */
  it('⛔ la ricetta appena creata si mette nel pasto ripassando dal server', () => {
    expect(menu).toMatch(/async function metti\(slot: string, creata: Recipe\)/);
    expect(menu).toMatch(/const riga = r\.righe\.find\(\(x\) => x\.recipeId === creata\.id\);/);
    expect(menu).toMatch(/if \(riga\) \{ scegli\(slot, riga\); return; \}/);
  });

  /** ⚠️ E se il server non la rende, non si indovina: si dice. */
  it('⚠️ se il server non la rende, lo dice invece di comporla a mano', () => {
    expect(menu).toMatch(/setAvvisoCreazione\(/);
    /** ⚠️ Ancorata a inizio riga: la stessa stringa compare nel commento che spiega perché NON si fa. */
    expect(menu).not.toMatch(/^\s*bloccata: false/m);
  });

  /**
   * ⛔ **Il permesso si chiede PRIMA**, non dopo aver compilato nome, ingredienti e metodo: un 403
   * a quel punto è lavoro buttato e sembra un guasto invece che un permesso.
   */
  it('⛔ senza il permesso di scrivere ricette il pulsante non c\'è', () => {
    expect(menu).toMatch(/const puoScrivereRicette = can\('recipes', 'manage'\);/);
    expect(menu).toMatch(/\{puoScrivereRicette && \(/);
  });

  /**
   * ⚠️ **Il regime proposto è il SUO.** Partire da «onnivoro» per una cliente vegana vuol dire
   * farla sbagliare su un campo che aveva già deciso aprendo la schermata, e l'errore si vedrebbe
   * solo al salvataggio.
   *
   * ⛔ **E su regime illeggibile si passa `undefined`, NON il ripiego** — corretto il 4/9 dopo una
   * revisione. `regimiAmmessi` su regime ignoto vale `['vegan']`: come filtro è un ripiego di
   * sicurezza innocuo, come valore **scritto** su una ricetta che resta in catalogo è
   * un'affermazione falsa. I due campi sono due campi apposta.
   */
  it('⚠️ propone il regime della cliente, non il default di catalogo', () => {
    expect(menu).toMatch(/defaultRegime=\{regimeCliente \?\? undefined\}/);
    expect(menu).toMatch(/defaultSlot=\{creandoPer\}/);
  });

  it('⛔ e non usa `regimiAmmessi` per scrivere il regime: quello è il ripiego del filtro', () => {
    expect(menu).not.toMatch(/defaultRegime=\{regimiAmmessi/);
  });

  /**
   * ⛔ **CHIUDERE NON È «FINE».** `Modal` si chiude cliccando fuori, e quel clic chiamava `onSaved`
   * con la ricetta: da qui voleva dire **sostituire il piatto già scelto** per quel pasto,
   * motivazione della forzatura compresa, senza conferma e senza messaggio.
   */
  it('⛔ chiudendo la finestra il pasto non si tocca: la ricetta la porta via solo il pulsante', () => {
    expect(ricette).toMatch(/onClose=\{\(\) => onSaved\(null\)\}/);
    expect(ricette).not.toMatch(/onClose=\{\(\) => onSaved\(null, creata\)\}/);
  });

  /** ⚠️ E il pulsante dice cosa fa: da qui non è «Fine», è «Metti nel pasto». */
  it('⚠️ il pulsante dice cosa succede', () => {
    expect(ricette).toMatch(/contesto === 'menu' \? 'Metti nel pasto' : 'Fine'/);
  });

  /**
   * ⛔ **`fuoriDalPaniere` sopravvive alla scelta.** La ricerca lo diceva sulla riga e `scegli` lo
   * buttava via: su una ricetta appena creata — fuori dal pool per definizione, e messa nel pasto
   * da codice, senza che la riga si disegni mai — non si vedeva da nessuna parte.
   */
  it('⛔ e resta scritto che il piatto è fuori dal paniere', () => {
    expect(menu).toMatch(/fuoriDalPaniere: r\.fuoriDalPaniere,/);
    expect(menu).toMatch(/\{scelta\.fuoriDalPaniere && \(/);
  });

  /**
   * ⚠️ **Il pulsante sta in FONDO all'elenco, non in cima.** Scrivere una ricetta nuova quando in
   * catalogo ce n'è già una uguale è il modo in cui un catalogo di ventimila piatti diventa di
   * quarantamila doppioni: prima si cerca — anche fuori dal paniere — e solo dopo si scrive.
   */
  it('⚠️ e il motivo per cui sta in fondo resta scritto nella pagina', () => {
    expect(menu).toMatch(/diventa di\n\s+\* +quarantamila doppioni|quarantamila\n?\s*\*?\s*doppioni/);
  });
});
