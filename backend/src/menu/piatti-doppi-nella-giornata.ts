/**
 * ⛔ **LO STESSO PIATTO DUE VOLTE NELLA STESSA GIORNATA: il conto, non il rimedio.**
 *
 * Voce `stesso-piatto-spuntino-e-merenda`, aperta il 2/9 dalla revisione avversariale. Dalla Fase 2
 * (1/9) `poolPerSlot` allarga il pool ai **gemelli**: `morning_snack` e `afternoon_snack` escono con
 * la stessa identica lista, perché una merenda deve poter servire lo spuntino e viceversa. È
 * giusto — ma da lì in poi **niente vieta che la stessa ricetta finisca in tutti e due**:
 * `DayComboService.enumerate` è un prodotto cartesiano, `rank` e `greedy` non penalizzano un
 * `recipeId` ripetuto, e `coppiaDellaGiornata` guarda solo pranzo/cena, e **fra giornate diverse**.
 *
 * ⛔ **Questo file non ripara niente, e non deve.** La voce dice che il primo passo è **contarlo**
 * sulle giornate già scritte, perché «quanto spesso capita» decide dove va la correzione: dentro
 * `dayCombo`, o in una guardia a valle. Misurare prima di scegliere, e scegliere sui numeri.
 *
 * ⚠️ **Due cause separate, e due denominatori diversi.** Un piatto ripetuto fra spuntino e merenda
 * nasce dall'allargamento; uno fra colazione e cena no, ed è un'altra storia con un altro rimedio.
 * La prima stesura del 2/9 li contava separati e poi **dava il verdetto sul totale**: su un campione
 * con zero doppioni fra gemelli e sessanta fra gli altri pasti diceva «correggi `dayCombo`» per un
 * difetto che in quel campione non era mai capitato. Un numero che mette insieme due cause non si
 * può usare — e allora non lo si usa nemmeno per decidere.
 *
 * ⛔ **E IL DENOMINATORE NON È «TUTTE LE GIORNATE».** Una giornata da tre pasti (`GIORNATA_TRE`) non
 * ha nessuno slot gemello, una da digiuno ne ha uno solo: lì il doppione fra gemelli è
 * **impossibile**, non raro. Metterle sotto la linea di frazione diluisce il tasso di quanto è
 * grande la fetta a tre pasti, che nessuno controlla. Con 800 giornate da tre e 200 da cinque di cui
 * 30 col doppione, il tasso vero è il 15% e il totale dice 3%: sotto soglia, verdetto sbagliato,
 * con la faccia di un numero preciso.
 *
 * ⚠️ **Il giudizio sta qui e non nello script** perché da questo conto dipende una scelta di
 * progetto, e una cosa che decide non sta in un file di `prisma/` che nessun test guarda.
 */
import { SLOT_SCAMBIABILI, etichettaSlot, slotDaCuiPescare } from '../common/slot-pasto';

/** I pasti di una giornata, come stanno nel JSON `MenuDay.meals`. */
export interface PastoLetto {
  slot?: string | null;
  recipeId?: string | null;
  name?: string | null;
}

/**
 * Che tipo di doppione è, che è la cosa da cui dipende dove si corregge.
 *
 * ⚠️ **`altri-pasti`, non «principali»**: la prima stesura chiamava così *qualunque* coppia non
 * gemella, spuntini compresi — e `dinner + morning_snack` finiva sotto l'etichetta «pasti
 * principali», mandando chi legge a cercare un difetto pranzo/cena che non c'era. `MAIN_SLOTS` sono
 * colazione, pranzo e cena, e questa categoria contiene ben altro.
 *
 * ⚠️ **`misto` con due soli slot è irraggiungibile**, e va detto invece di lasciar credere che quello
 * zero sia una misura: serve la stessa ricetta in **almeno tre** pasti, di cui alcuni gemelli e
 * alcuni no. Capita, ma è raro per costruzione.
 */
export type SpecieDiDoppione = 'gemelli' | 'altri-pasti' | 'misto';

export interface Doppione {
  recipeId: string;
  nome: string | null;
  /** Gli slot in cui quel piatto compare, senza doppioni, in ordine di comparsa. */
  slot: string[];
  specie: SpecieDiDoppione;
}

/**
 * I doppioni di UNA giornata. Elenco vuoto = nessuna ricetta ripetuta.
 *
 * ⚠️ **Le righe senza `recipeId` si saltano**, e non fanno coppia fra loro: una giornata con due
 * pasti monchi ha un altro problema, e mescolarlo a questo gonfierebbe il conto proprio dove è più
 * facile crederci.
 */
export function doppioniDellaGiornata(pasti: readonly PastoLetto[]): Doppione[] {
  const perRicetta = new Map<string, { slot: string[]; nome: string | null }>();
  for (const p of pasti ?? []) {
    const id = (p?.recipeId ?? '').trim();
    const slot = (p?.slot ?? '').trim();
    if (!id || !slot) continue;
    if (!perRicetta.has(id)) perRicetta.set(id, { slot: [], nome: p?.name ?? null });
    perRicetta.get(id)!.slot.push(slot);
  }
  const out: Doppione[] = [];
  for (const [recipeId, { slot, nome }] of perRicetta) {
    /**
     * ⚠️ **Slot DISTINTI, non righe.** Lo stesso pasto scritto due volte nella stessa giornata è un
     * guasto della scrittura, non un piatto ripetuto: contarlo qui direbbe «doppione» di una
     * giornata che ne ha uno solo — e nel tabulato scriverebbe una coppia «pranzo + pranzo».
     */
    const distinti = [...new Set(slot)];
    if (distinti.length < 2) continue;
    out.push({ recipeId, nome, slot: distinti, specie: specieDi(distinti) });
  }
  return out;
}

/**
 * ⛔ **`gemelli` solo se TUTTI gli slot stanno nello stesso gruppo scambiabile.** Con tre slot di cui
 * due gemelli e uno no, la causa non è (solo) l'allargamento: è `misto`, e va guardata a mano.
 *
 * ⚠️ Il confronto è contro il **primo** slot e basta, perché `SLOT_SCAMBIABILI` è una partizione in
 * gruppi: la relazione è simmetrica e transitiva. La prima stesura girava un doppio `every` e
 * sembrava difendere una sottigliezza che non esiste — la mutazione che lo riduceva a un confronto
 * solo sopravviveva, perché era codice equivalente, non un cancello.
 */
function specieDi(slot: readonly string[]): SpecieDiDoppione {
  const primo = slot[0];
  const gemelliDelPrimo = slotDaCuiPescare(primo);
  const quantiGemelli = slot.filter((s) => gemelliDelPrimo.includes(s)).length;
  if (quantiGemelli === slot.length) return 'gemelli';
  return quantiGemelli === 1 ? 'altri-pasti' : 'misto';
}

/**
 * ⛔ **UNA GIORNATA «A RISCHIO GEMELLI» è quella che ha almeno due slot dello stesso gruppo
 * scambiabile.** È il denominatore giusto per il tasso dei doppioni spuntino↔merenda: sulle altre
 * quel difetto non può capitare, e contarle sotto la linea di frazione abbassa il tasso di quanto è
 * grande la fetta a tre pasti.
 */
export function aRischioGemelli(pasti: readonly PastoLetto[]): boolean {
  const slot = new Set((pasti ?? []).map((p) => (p?.slot ?? '').trim()).filter(Boolean));
  return SLOT_SCAMBIABILI.some((gruppo) => gruppo.filter((s) => slot.has(s)).length >= 2);
}

export interface GiornataLetta {
  clientId: string;
  data: Date | string;
  pasti: readonly PastoLetto[];
}

export interface ContoDeiDoppioni {
  giornate: number;
  /** Quelle su cui il doppione fra gemelli è possibile: il denominatore del tasso che conta. */
  giornateARischioGemelli: number;
  giornateConDoppione: number;
  clientiLette: number;
  clientiConDoppione: number;
  /** Quante GIORNATE per ciascuna specie. ⚠️ Una giornata con due specie conta in tutt'e due. */
  perSpecie: Record<SpecieDiDoppione, number>;
  /** Le combinazioni di slot più frequenti, dalla più comune. */
  coppie: { slot: string; etichetta: string; giornate: number }[];
  esempi: { clientId: string; data: string; doppione: Doppione }[];
  /** Il primo e l'ultimo giorno visti: un tabulato deve dire su cosa ha misurato. */
  dal: string | null;
  al: string | null;
}

/**
 * Il conto su un insieme di giornate.
 *
 * ⚠️ **`giornateConDoppione` non è la somma di `perSpecie`**, ed è dichiarato invece che lasciato
 * scoprire: una giornata con un doppione fra gemelli **e** uno fra gli altri pasti conta una volta
 * nel primo numero e una in ciascuna specie. Sommare le specie darebbe più giornate di quante ne
 * esistono.
 *
 * ⚠️ **Il tetto degli esempi è per GIORNATA, non per doppione.** Con il tetto per doppione, una sola
 * giornata patologica con dodici doppioni si mangiava tutto il budget e il tabulato mostrava dodici
 * righe con la stessa data e la stessa cliente, sotto un titolo «Esempi (12)» che faceva credere a
 * uno spaccato.
 */
export function contaDoppioni(giornate: readonly GiornataLetta[], quanteGiornateDiEsempio = 12): ContoDeiDoppioni {
  const perSpecie: Record<SpecieDiDoppione, number> = { gemelli: 0, 'altri-pasti': 0, misto: 0 };
  const perCoppia = new Map<string, number>();
  const clienti = new Set<string>();
  const clientiTutte = new Set<string>();
  const esempi: ContoDeiDoppioni['esempi'] = [];
  let conDoppione = 0;
  let aRischio = 0;
  let dal: string | null = null;
  let al: string | null = null;
  let giornateNegliEsempi = 0;

  for (const g of giornate ?? []) {
    const d = giorno(g?.data);
    if (d) {
      if (dal === null || d < dal) dal = d;
      if (al === null || d > al) al = d;
    }
    if (g?.clientId) clientiTutte.add(g.clientId);
    if (aRischioGemelli(g?.pasti ?? [])) aRischio += 1;

    const doppioni = doppioniDellaGiornata(g?.pasti ?? []);
    if (!doppioni.length) continue;
    conDoppione += 1;
    if (g.clientId) clienti.add(g.clientId);
    for (const s of new Set(doppioni.map((x) => x.specie))) perSpecie[s] += 1;
    for (const s of new Set(doppioni.map(chiaveSlot))) perCoppia.set(s, (perCoppia.get(s) ?? 0) + 1);
    if (giornateNegliEsempi < quanteGiornateDiEsempio) {
      giornateNegliEsempi += 1;
      for (const x of doppioni) esempi.push({ clientId: g.clientId, data: d, doppione: x });
    }
  }

  const coppie = [...perCoppia.entries()]
    .map(([slot, n]) => ({ slot, etichetta: slot.split(' + ').map(etichettaSlot).join(' + '), giornate: n }))
    // ⚠️ Tie-break sul nome: due combinazioni a pari merito si alternavano a seconda dell'ordine di
    //    lettura, e un tabulato che cambia riga fra due letture degli stessi dati fa dubitare di tutto.
    .sort((a, b) => b.giornate - a.giornate || a.slot.localeCompare(b.slot));

  return {
    giornate: (giornate ?? []).length,
    giornateARischioGemelli: aRischio,
    giornateConDoppione: conDoppione,
    clientiLette: clientiTutte.size,
    clientiConDoppione: clienti.size,
    perSpecie,
    coppie,
    esempi,
    dal,
    al,
  };
}

const chiaveSlot = (d: Doppione): string => [...d.slot].sort().join(' + ');

const giorno = (d: Date | string | null | undefined): string =>
  (typeof d === 'string' ? d : (d?.toISOString?.() ?? (d == null ? '' : String(d)))).slice(0, 10);

/**
 * ⛔ **LA SOGLIA È UN NUMERO DI PRODOTTO, non una costante tecnica**, e sta dichiarata qui perché chi
 * la vuole cambiare la trovi insieme alla ragione: sotto il 5% la correzione costa più del difetto,
 * perché un vincolo dentro `dayCombo` moltiplica le combinazioni da scartare in un prodotto
 * cartesiano; sopra, è una cosa che le clienti vedono, e la sceglie chi compone la giornata coi
 * vincoli di kcal e macro davanti.
 */
export const QUOTA_CHE_CAMBIA_LA_STRADA = 0.05;

/**
 * ⛔ **Sotto questo numero di giornate a rischio non si dà un verdetto.**
 *
 * Tre giornate con un doppione fanno il 33%, e su tre casi quel 33% è compatibile sia con «sotto
 * soglia» sia con «capita quasi sempre». Un verdetto perentorio su un campione così è peggio di
 * nessun verdetto, perché ha la faccia di una misura.
 */
export const GIORNATE_MINIME = 100;

export type DoveCorreggere =
  | 'non misurato'
  | 'campione troppo piccolo'
  | 'non serve'
  | 'guardia a valle'
  | 'nella composizione';

/**
 * ⛔ **IL VERDETTO GUARDA I GEMELLI, E SOLO LORO** — è il difetto che l'allargamento della Fase 2 ha
 * reso possibile, ed è quello per cui la voce è stata aperta. I doppioni fra gli altri pasti nascono
 * da un'altra parte e li conta `perSpecie['altri-pasti']`, ma non entrano in questa decisione: la
 * ragione scritta sopra la soglia parla del prodotto cartesiano di `dayCombo`, cioè dei gemelli.
 */
export function doveCorreggere(
  conto: ContoDeiDoppioni,
  soglia = QUOTA_CHE_CAMBIA_LA_STRADA,
  minime = GIORNATE_MINIME,
): DoveCorreggere {
  if (!conto || conto.giornate <= 0) return 'non misurato';
  /**
   * ⚠️ **Zero giornate a rischio non è «non serve»**: vuol dire che in questo campione non c'era
   * nemmeno una giornata con tutti e due i pasti gemelli, cioè che il difetto non è stato messo
   * alla prova. Dire «✅ non capita» sarebbe la bugia più comoda di tutto il tabulato.
   */
  if (conto.giornateARischioGemelli <= 0) return 'non misurato';
  if (conto.giornateARischioGemelli < minime) return 'campione troppo piccolo';
  if (conto.perSpecie.gemelli === 0) return 'non serve';
  return conto.perSpecie.gemelli / conto.giornateARischioGemelli >= soglia
    ? 'nella composizione'
    : 'guardia a valle';
}
