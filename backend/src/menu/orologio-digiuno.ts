/**
 * L'OROLOGIO DEL DIGIUNO — da «a che ora mangi» a «quali pasti ricevi».
 *
 * Fino a oggi alla cliente si chiedeva una cosa astratta — *«quali pasti preferisci saltare?»* — e
 * da lì il motore ricavava tutto. Da qui in avanti si chiede una cosa concreta, *«a che ora
 * mangi»*, e i pasti li ricava il sistema. `fastingWindow` **resta** ed è ancora il dato che il
 * motore legge: non lo sceglie più nessuno a mano, lo **deriva** questo modulo.
 *
 * Foglio di riferimento: `Documents/Metabole/Digiuno_Orologio/progetto/01_SPECIFICA…md` (versione 2).
 *
 * ## LA REGOLA, ed è quella su cui si sbaglia
 *
 * **La DURATA della finestra dice QUANTI pasti. La POSIZIONE non dice niente.**
 *
 * Il primo modello che avevo scritto ancorava i pasti a ore fisse (colazione 08:00, pranzo 13:00…)
 * e guardava quali cadessero dentro la finestra. Provandolo è saltato fuori il difetto: partendo da
 * 12:00-20:00, **spostare la finestra di un'ora cambiava cosa mangi** — a 11:00 entrava la merenda,
 * a 10:30 lo spuntino. Cioè ogni traslazione diventava un cambio di dieta.
 *
 * ⚠️ E il manuale dice l'esatto contrario (pag. 2): *«gli orari della finestra possono essere
 * traslati liberamente, a patto che il blocco di digiuno continuativo sia rigorosamente rispettato
 * prima del pasto successivo»*. Con quel modello la Regola d'Oro non sarebbe esistita, e
 * l'adattamento graduale — spostarsi di un'ora al giorno per quattro giorni — sarebbe stato
 * **quattro cambi di dieta di fila**.
 *
 * ## La prova che il modello è quello giusto
 *
 * 16:8 aperta alle 12:00 → **12:15 · 15:55 · 19:30**.
 * Il piano del manuale (pag. 3) dice **12:00 · 16:00 · 19:30**. Non è tarato: viene dalla regola.
 *
 * ## ⚠️ Chi digiuna oggi: UNA finestra su cinque non si muove, le altre quattro sì
 *
 * Le tre occasioni della 16:8 danno `lunch · afternoon_snack · dinner`, che è **esattamente** il
 * catalogo digiuno di oggi (`skip_breakfast`, quote .45/.10/.45): **chi è su quella finestra non
 * cambia struttura, catalogo né menu.**
 *
 * ⛔ **Ma è l'unica**, e scrivere «le clienti non si muovono» sarebbe stato un taglio silenzioso.
 * L'orologio, in tutte le posizioni e con tutti i protocolli, produce **quattro** valori:
 * `skip_morning_snack`, `skip_breakfast`, `skip_breakfast_and_snacks`, `skip_all_but_dinner`.
 * Restano fuori le altre quattro righe della tabella — `skip_dinner` (il caso Sonia), `skip_lunch`,
 * `skip_breakfast_lunch`, `skip_dinner_breakfast` — e chi le ha oggi, il giorno del backfill,
 * **cambierebbe catalogo e quote**.
 *
 * ⚠️ Non è una svista da correggere qui: è la ragione per cui il backfill **non parte** finché
 * `npm run diag:digiuni` non dice quante clienti stanno su ognuna. `finestreRaggiungibili()` sotto
 * lo dichiara in codice, e un test lo tiene fermo: il giorno che una soglia cambia, l'elenco cambia
 * con lei e qualcuno se ne accorge.
 *
 * ## ⚠️ Il nome dello slot non è il nome che legge la cliente
 *
 * Con la finestra 08:00-16:00 il motore chiama `lunch` il pasto delle 08:15, ed è giusto che
 * l'etichetta interna resti quella: è la chiave che il catalogo e le quote conoscono. Ma alla
 * cliente si scrive **«Primo pasto 08:15»**, mai «Pranzo alle 08:15» — `etichettaPasto` sotto.
 *
 * ## ⚠️ Perché questo modulo NON legge `config_param`
 *
 * Le soglie e i margini sono **parametri con un default esportato**, non una lettura dal database:
 * così il modulo resta puro e si prova senza montare niente, e chi ha il `ConfigParamsService` gli
 * passa i valori veri. È la stessa forma di `porzione-scalata.ts` coi suoi `TETTI_PREDEFINITI`.
 */
import { FINESTRE_DIGIUNO, type FinestraDigiuno, type SlotPasto } from './finestre-digiuno';

/** Gli slot nell'ordine della giornata. Serve a costruire il complemento di «quali salto». */
const TUTTI_GLI_SLOT: SlotPasto[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];

const MINUTI_AL_GIORNO = 1440;

export interface ProtocolloDigiuno {
  valore: string;
  /** Ore in cui si mangia. Il digiuno è `24 − oreFinestra`: non si salva due volte. */
  oreFinestra: number;
  /** Come lo chiama il manuale. */
  nome: string;
}

/**
 * I cinque protocolli del manuale (pag. 2). Il 5:2 **non c'è ed è voluto**: è un modello a calorie
 * settimanali, non una finestra oraria, e su un orologio non è disegnabile.
 */
export const PROTOCOLLI_DIGIUNO: ProtocolloDigiuno[] = [
  { valore: '14:10', oreFinestra: 10, nome: 'Principiante' },
  { valore: '16:8', oreFinestra: 8, nome: 'Standard' },
  { valore: '18:6', oreFinestra: 6, nome: 'Avanzato' },
  { valore: '20:4', oreFinestra: 4, nome: 'Esperto' },
  { valore: '23:1', oreFinestra: 1, nome: 'OMAD' },
];

export const VALORI_PROTOCOLLO_DIGIUNO: string[] = PROTOCOLLI_DIGIUNO.map((p) => p.valore);

export const protocolloDigiuno = (valore?: string | null): ProtocolloDigiuno | undefined =>
  PROTOCOLLI_DIGIUNO.find((p) => p.valore === valore);

export interface SogliaPasti {
  /** Ore di finestra da cui in su vale questa riga. Si legge dall'alto: la prima che rientra vince. */
  oreMin: number;
  slots: SlotPasto[];
}

/**
 * QUANTI PASTI CI STANNO IN UNA FINESTRA — la tabella, e nient'altro.
 *
 * ⚠️ I nomi si prendono **dal fondo della giornata**: l'ultimo pasto è sempre la cena. Non è
 * un'etichetta a caso — è quello che tiene la 16:8 sul catalogo digiuno di oggi (vedi in testa), e
 * quello che rende `pastoPrincipale` sempre vero senza doverlo calcolare a parte.
 *
 * ⚠️ **Con UNA eccezione, e va detta perché è la riga che decide un catalogo.** A quattro pasti dal
 * fondo verrebbero `morning_snack · lunch · afternoon_snack · dinner`; la tabella scrive invece
 * `breakfast · lunch · afternoon_snack · dinner`. Il motivo è che a quel punto la finestra è lunga
 * dieci ore e **contiene il mattino**: chiamare «spuntino» il primo pasto di una giornata che
 * comincia alle otto vorrebbe dire togliere la colazione a chi ce l'ha. È questa scelta a produrre
 * `skip_morning_snack` invece di `skip_breakfast`, e quindi il catalogo a 5 pasti invece di quello
 * digiuno. La regola vera è **«dal fondo, ma la colazione prende il posto dello spuntino del
 * mattino quando i pasti sono quattro»** — e adesso è scritta.
 *
 * ⛔ Le soglie sono **una proposta mia**, non un dato del manuale: vanno confermate dalla
 * nutrizionista, e per questo stanno in una tabella che si cambia da `config_param` invece che
 * dentro una catena di `if`.
 */
export const SOGLIE_PASTI_PREDEFINITE: SogliaPasti[] = [
  { oreMin: 9, slots: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'] },
  { oreMin: 7, slots: ['lunch', 'afternoon_snack', 'dinner'] },
  { oreMin: 3.5, slots: ['lunch', 'dinner'] },
  { oreMin: 0, slots: ['dinner'] },
];

export interface MarginiPasti {
  /** Il primo pasto quanti minuti dopo l'apertura. */
  primoDopoApertura: number;
  /** L'ultimo quanti minuti prima della chiusura. */
  ultimoPrimaChiusura: number;
  /** A quanti minuti si arrotondano gli orari mostrati. */
  arrotondaA: number;
}

export const MARGINI_PREDEFINITI: MarginiPasti = {
  primoDopoApertura: 15,
  ultimoPrimaChiusura: 30,
  arrotondaA: 5,
};

/** Minuti da mezzanotte, sempre dentro la giornata. Anche per i negativi. */
export const dentroLaGiornata = (min: number): number => ((min % MINUTI_AL_GIORNO) + MINUTI_AL_GIORNO) % MINUTI_AL_GIORNO;

/** L'ora di chiusura della finestra. ⚠️ Non si salva: si calcola, o prima o poi diverge dall'inizio. */
export const chiusuraFinestra = (inizioMin: number, oreFinestra: number): number =>
  dentroLaGiornata(inizioMin + oreFinestra * 60);

/** `hh:mm` da minuti-da-mezzanotte, per i testi e per la scheda. */
export function oraDelGiorno(min: number): string {
  const t = dentroLaGiornata(Math.round(min));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * I pasti che stanno in una finestra di quella durata. ⚠️ **Non dipende dall'ora di apertura**: è
 * il cuore della regola in testa al file, e il test che ci gira sopra prova ogni posizione.
 */
export function pastiDellaFinestra(oreFinestra: number, soglie: SogliaPasti[] = SOGLIE_PASTI_PREDEFINITE): SlotPasto[] {
  const riga = soglie.find((s) => oreFinestra >= s.oreMin);
  // ⚠️ Nessuna riga che rientra vuol dire tabella scritta male (nessuna con `oreMin: 0`): si torna
  // vuoto e chi chiama lo dice, invece di ripiegare su una giornata inventata.
  return riga ? [...riga.slots] : [];
}

export interface PastoConOra {
  slot: SlotPasto;
  /** Minuti da mezzanotte. Può essere il giorno dopo, se la finestra scavalca la mezzanotte. */
  oraMin: number;
}

/**
 * Gli orari dei pasti dentro la finestra: il primo poco dopo l'apertura, l'ultimo mezz'ora prima
 * della chiusura, gli altri spalmati in mezzo.
 *
 * ⚠️ Con **un solo pasto** non si spalma niente: si mette in fondo, perché una finestra di un'ora
 * (OMAD) col pasto messo «all'inizio» finirebbe di fatto 45 minuti prima del previsto.
 *
 * ⚠️ Se i margini non ci stanno (finestra corta), si **stringono in proporzione** invece di
 * produrre un ultimo pasto prima del primo.
 */
export function orariDeiPasti(
  inizioMin: number,
  oreFinestra: number,
  soglie: SogliaPasti[] = SOGLIE_PASTI_PREDEFINITE,
  margini: MarginiPasti = MARGINI_PREDEFINITI,
): PastoConOra[] {
  const slots = pastiDellaFinestra(oreFinestra, soglie);
  if (slots.length === 0) return [];
  const durata = oreFinestra * 60;

  // I margini non possono mangiarsi la finestra: se la somma supera la durata, si scalano insieme.
  const sommaMargini = margini.primoDopoApertura + margini.ultimoPrimaChiusura;
  const fattore = sommaMargini > 0 && sommaMargini >= durata ? (durata * 0.5) / sommaMargini : 1;
  const primo = inizioMin + margini.primoDopoApertura * fattore;
  const ultimo = inizioMin + durata - margini.ultimoPrimaChiusura * fattore;

  const passo = slots.length > 1 ? (ultimo - primo) / (slots.length - 1) : 0;
  const arrotonda = (m: number) => Math.round(m / margini.arrotondaA) * margini.arrotondaA;

  return slots.map((slot, i) => ({
    slot,
    oraMin: dentroLaGiornata(arrotonda(slots.length === 1 ? ultimo : primo + passo * i)),
  }));
}

/**
 * LA FINESTRA DEL MOTORE che corrisponde a questi pasti — cercata **dentro `FINESTRE_DIGIUNO`**,
 * non con una mappa scritta qui.
 *
 * ⚠️ È la differenza fra un modulo che segue la tabella e uno che le corre accanto: il giorno che
 * qualcuno aggiunge o corregge una riga là, questa funzione la trova da sé. Una seconda mappa qui
 * sarebbe il classico «due punti che rispondono alla stessa domanda».
 *
 * Torna `undefined` se quel gruppo di pasti in tabella non c'è: **non si ripiega su una finestra
 * vicina**, perché servire tre pasti a chi ne aspetta due è esattamente il difetto che ha dato a
 * una cliente un pasto al giorno. Chi chiama lo dice.
 */
export function finestraPerPasti(pasti: readonly SlotPasto[]): FinestraDigiuno | undefined {
  const restano = new Set(pasti);
  const daSaltare = TUTTI_GLI_SLOT.filter((s) => !restano.has(s));
  return FINESTRE_DIGIUNO.find(
    (f) => f.salta.length === daSaltare.length && daSaltare.every((s) => f.salta.includes(s)),
  );
}

export interface DerivazioneOrologio {
  protocollo: ProtocolloDigiuno;
  inizioMin: number;
  fineMin: number;
  pasti: PastoConOra[];
  /** La riga di `FINESTRE_DIGIUNO`, se quel gruppo di pasti esiste. */
  finestra?: FinestraDigiuno;
  /** Il valore da scrivere in `Client.fastingWindow`. `undefined` = non si sa, e si dice. */
  fastingWindow?: string;
}

/**
 * DA OROLOGIO A DATO DEL MOTORE, in un colpo solo. È la funzione che chiamano l'endpoint del
 * profilo, il backfill e la scheda staff — così la derivazione è **una**, e non tre che si
 * somigliano.
 *
 * ⚠️ Protocollo sconosciuto → `undefined`. Non si ripiega sul 16:8: un dato scritto storto non deve
 * decidere in silenzio cosa mangia una persona.
 */
export function derivaDaOrologio(
  inizioMin: number,
  protocollo?: string | null,
  soglie: SogliaPasti[] = SOGLIE_PASTI_PREDEFINITE,
  margini: MarginiPasti = MARGINI_PREDEFINITI,
): DerivazioneOrologio | undefined {
  const p = protocolloDigiuno(protocollo);
  if (!p) return undefined;
  const inizio = dentroLaGiornata(inizioMin);
  const pasti = orariDeiPasti(inizio, p.oreFinestra, soglie, margini);
  const finestra = finestraPerPasti(pasti.map((x) => x.slot));
  return {
    protocollo: p,
    inizioMin: inizio,
    fineMin: chiusuraFinestra(inizio, p.oreFinestra),
    pasti,
    finestra,
    fastingWindow: finestra?.valore,
  };
}

/**
 * COME SI CHIAMA QUEL PASTO PER LA CLIENTE.
 *
 * ⚠️ Non si riusa il nome dello slot: con la finestra 08:00-16:00 il motore chiama `lunch` il pasto
 * delle 08:15, e scrivere «Pranzo alle 08:15» a una persona è dirle una cosa falsa. Qui il nome
 * viene dalla **posizione**, che è l'unica cosa vera in una finestra che si sposta.
 *
 * ⛔ I nomi esatti li conferma la nutrizionista: stanno tutti in questa funzione apposta.
 */
export function etichettaPasto(indice: number, totale: number, slot: SlotPasto): string {
  if (slot === 'morning_snack' || slot === 'afternoon_snack') return 'Spuntino';
  if (totale === 1) return 'Il tuo pasto';
  if (indice === 0) return 'Primo pasto';
  if (indice === totale - 1) return 'Ultimo pasto';
  return 'Pasto';
}

/**
 * Quante ore del digiuno passano dormendo — l'indicatore del manuale (pag. 6), quello che fa
 * sembrare il digiuno fattibile: «8 ore su 16 le passi dormendo».
 *
 * ⚠️ Si campiona a passi di 5 minuti invece di intersecare due intervalli a mano: gli intervalli
 * che scavalcano la mezzanotte sono **due** su un asse lineare, e il caso in cui li scavalcano
 * tutti e due è quello che nessuno prova.
 */
export function oreDigiunoNelSonno(
  inizioMin: number,
  oreFinestra: number,
  sonnoInizioMin: number,
  sonnoFineMin: number,
): number {
  const fine = chiusuraFinestra(inizioMin, oreFinestra);
  // ⚠️ `da === a` è ambiguo: può voler dire «tutto» o «niente». Per la finestra di pasto vuol dire
  // TUTTO (24 ore di finestra = non si digiuna mai), e senza questa riga il confronto finiva nel
  // ramo «scavalca la mezzanotte» e contava l'intera giornata come digiuno. Non lo raggiunge
  // nessuno dei cinque protocolli, ma la funzione è esportata e prende le ore libere.
  if (oreFinestra >= 24 || oreFinestra <= 0) return oreFinestra >= 24 ? 0 : 24 - oreFinestra;
  const dentro = (m: number, da: number, a: number) => (da <= a ? m >= da && m < a : m >= da || m < a);
  let minuti = 0;
  for (let m = 0; m < MINUTI_AL_GIORNO; m += 5) {
    if (!dentro(m, dentroLaGiornata(inizioMin), fine) && dentro(m, dentroLaGiornata(sonnoInizioMin), dentroLaGiornata(sonnoFineMin))) {
      minuti += 5;
    }
  }
  return minuti / 60;
}

/**
 * LE FINESTRE CHE L'OROLOGIO SA PRODURRE — dichiarate calcolandole, non elencandole a mano.
 *
 * ⚠️ Serve a dire ad alta voce quello che il §8 in testa spiega: **quattro righe della tabella
 * restano fuori**, e le clienti che ce l'hanno oggi non si possono migrare senza guardarle una per
 * una. *Niente tagli silenziosi: se si scarta qualcosa, si dice quanto.*
 *
 * È calcolata e non scritta apposta: se domani cambia una soglia, cambia anche questo elenco — e il
 * test che ci gira sopra lo fa notare a chi l'ha cambiata.
 */
export function finestreRaggiungibili(
  soglie: SogliaPasti[] = SOGLIE_PASTI_PREDEFINITE,
  margini: MarginiPasti = MARGINI_PREDEFINITI,
): string[] {
  const trovate = new Set<string>();
  for (const p of PROTOCOLLI_DIGIUNO) {
    for (let inizio = 0; inizio < 1440; inizio += 15) {
      const v = derivaDaOrologio(inizio, p.valore, soglie, margini)?.fastingWindow;
      if (v) trovate.add(v);
    }
  }
  return [...trovate];
}
