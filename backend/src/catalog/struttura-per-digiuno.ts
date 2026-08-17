/**
 * QUALE CATALOGO SERVE A CHI DIGIUNA — la decisione, in un modulo puro.
 *
 * Il difetto (trovato il 17/8 con `npm run diag:digiuni`, scritto in
 * `progetto/NOTA_Digiuno_E_Riempimento_Varianti.md`): la variante `fasting: true` del catalogo ha
 * tre slot **fissi** — pranzo, merenda, cena (`pastiAttesi`, `giornate-complete.ts`). È di fatto la
 * variante «salta la colazione», e nessun campo lo dice. Poi l'erogazione toglie da quella giornata
 * gli slot della finestra scelta dalla cliente (`slotEsclusiTotali`, `menu.service`).
 *
 * Messe in fila, le due cose fanno questo:
 *
 *   finestra «salto la colazione» → resta pranzo, merenda, cena  → i pasti giusti, 100% delle kcal
 *   finestra «salto la cena»      → resta il SOLO PRANZO          → **un pasto al giorno**
 *
 * Una cliente ha ricevuto un pasto al giorno (Sonia, `s.sandri66@libero.it`), e non lo ha segnalato
 * niente: la rete di sicurezza di `dayComboPools` impedisce la giornata **vuota**, non quella monca.
 *
 * ## La regola: si sceglie un catalogo che ABBIA i pasti che la finestra promette
 *
 * Non «il digiuno usa sempre il catalogo a 5 pasti». Sarebbe un peggioramento silenzioso per le
 * cinque clienti che oggi stanno bene: riceverebbero i pasti giusti con un terzo di calorie in meno,
 * perché nel catalogo a 5 pasti pranzo, merenda e cena valgono .35 + .10 + .25 = 70% della giornata,
 * mentre nel catalogo digiuno valgono .45 + .10 + .45 = 100% (`quoteKcalPerSlot`,
 * `engine-rules.service.ts`).
 *
 * Quindi: **il catalogo digiuno vince quando contiene tutti i pasti che la finestra promette**, ed è
 * il catalogo a 5 pasti a raccoglierlo quando non li contiene. Finestra per finestra viene da sé —
 * e questa è la ragione per cui la regola non è un elenco di finestre scritto a mano:
 *
 * | finestra                  | promette                            | catalogo | cambia? |
 * |---------------------------|-------------------------------------|----------|---------|
 * | salta la colazione        | pranzo, merenda, cena               | digiuno  | no      |
 * | **salta la cena**         | colazione, spuntino, pranzo         | 5 pasti  | **sì**  |
 * | **salta il pranzo**       | colazione, spuntino, merenda, cena  | 5 pasti  | **sì**  |
 * | salta colazione e pranzo  | merenda, cena                       | digiuno  | no      |
 * | salta cena e colazione    | pranzo                              | digiuno  | no      |
 *
 * Le due che si spostano sono esattamente le due rotte. Le tre che stanno bene non si muovono, e non
 * si muovono **per la regola**, non perché le ho elencate: il giorno che si aggiunge una riga a
 * `FINESTRE_DIGIUNO` questa funzione decide da sola, e decide guardando i pasti.
 *
 * ## ⚠️ Quello che questa correzione NON risolve: le calorie
 *
 * Chi salta la cena passa da un pasto al giorno (45% delle kcal) a tre pasti (65%): i pasti giusti,
 * ma ancora corti — nel catalogo a 5 pasti colazione, spuntino e pranzo valgono .20 + .10 + .35, e
 * quello che resta **non si ingrandisce**, perché `DayCombo` sceglie una ricetta per slot dentro il
 * pool e non esiste da nessuna parte un moltiplicatore di porzione. È il prezzo dichiarato della
 * strada A della nota: *meglio i pasti giusti un po' scarsi che il pasto sbagliato*. Le due strade
 * che chiudono anche il buco delle calorie (una variante per finestra, o la porzione che si scala
 * all'erogazione) sono scritte là e costano molto di più.
 *
 * ## ⚠️ Una finestra che non conosciamo non sposta nessuno
 *
 * Se `fastingWindow` è vuota o non è fra quelle in tabella, si resta sul catalogo digiuno: è il
 * comportamento di oggi, ed è il 16:8 classico. Il contrario — «non so cosa salti, quindi ti do la
 * giornata intera a 5 pasti» — vorrebbe dire togliere il digiuno a chi l'ha chiesto senza dirglielo,
 * per un dato scritto storto. Il caso esiste: Maria (`mariabonaccorso@hotmail.it`) è in digiuno senza
 * finestra impostata, perché nessuno gliel'ha mai chiesta. Il suo problema è una domanda mancata, e
 * si risolve chiedendo, non spostandole il catalogo sotto i piedi.
 */
import { pastiAttesi } from './giornate-complete';
import { finestraDigiuno, slotSaltati } from '../menu/finestre-digiuno';

/** La struttura della giornata piena, dalla stessa funzione che la dichiara al resto del prodotto. */
const TUTTA_LA_GIORNATA = pastiAttesi({ mealsPerDay: 5, fasting: false });

/** Il catalogo digiuno: `mealsPerDay` NON si filtra, come è sempre stato (vedi `pick-diet.ts`). */
const CATALOGO_DIGIUNO = { fasting: true } as const;
/** Il catalogo a 5 pasti: l'unico che ha colazione e spuntino del mattino. */
const CATALOGO_CINQUE_PASTI = { mealsPerDay: 5, fasting: false } as const;

/**
 * I pasti che la finestra promette: la giornata piena meno quelli che dice di saltare.
 *
 * ⚠️ Si guarda **solo** la finestra, non `pastiEsclusi`. La finestra è una promessa fatta alla
 * cliente («mangi da colazione a pranzo»); gli spuntini che ha chiesto di togliere sono una scelta
 * sua, successiva, e non cambiano quale catalogo deve saperla servire.
 */
export function pastiPromessiDallaFinestra(fastingWindow?: string | null): string[] {
  const salta = slotSaltati('intermittent_fasting', fastingWindow);
  return TUTTA_LA_GIORNATA.filter((slot) => !salta.has(slot));
}

/**
 * Il filtro di struttura per una cliente in digiuno: il catalogo che ha i pasti che la sua finestra
 * promette. Torna un frammento di `where` per `Diet`, che `pickDietFor` mette nella sua catena.
 */
export function strutturaPerFinestra(fastingWindow?: string | null): Record<string, unknown> {
  // Finestra sconosciuta o non impostata: non si sposta nessuno (vedi il commento in testa).
  if (!finestraDigiuno(fastingWindow)) return { ...CATALOGO_DIGIUNO };

  const promessi = pastiPromessiDallaFinestra(fastingWindow);
  const nelCatalogoDigiuno = new Set(pastiAttesi({ mealsPerDay: 3, fasting: true }));
  const bastaIlDigiuno = promessi.every((slot) => nelCatalogoDigiuno.has(slot));
  return bastaIlDigiuno ? { ...CATALOGO_DIGIUNO } : { ...CATALOGO_CINQUE_PASTI };
}

/**
 * I pasti promessi che la dieta servita NON ha in catalogo. Vuoto quando va tutto bene.
 *
 * Serve a `menu.service` per **dirlo**: la catena dei ripieghi di `pickDietFor` può finire su una
 * dieta di struttura diversa da quella chiesta (l'ultimo ripiego lascia cadere anche il filtro sui
 * pasti, perché una dieta vicina è meglio di nessun menu). Se in catalogo la variante a 5 pasti di
 * quella famiglia non c'è ancora, chi salta la cena torna a ricevere il solo pranzo — e questa volta
 * si vede, invece di succedere in silenzio come è successo fino a oggi.
 */
export function pastiPromessiCheMancano(
  pathType: string | null | undefined,
  fastingWindow: string | null | undefined,
  dieta: { mealsPerDay?: number | null; fasting?: boolean | null },
): string[] {
  if (pathType !== 'intermittent_fasting' || !finestraDigiuno(fastingWindow)) return [];
  const inCatalogo = new Set(pastiAttesi(dieta));
  return pastiPromessiDallaFinestra(fastingWindow).filter((slot) => !inCatalogo.has(slot));
}
