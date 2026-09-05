import { EU_ALLERGEN_CODES, allergenLabel } from '../catalog/allergens';
import { nomiIngredienti } from '../catalog/elenco-ingredienti';
import { normalizzaNome } from './valori-nutrizionali.service';
import { riempimenti, trovaGemelli, type RigaDaControllare } from './gemelli-alimenti';
import { STATI_A_CRUDO, normalizzaStato } from './stato-alimento';

/**
 * ⛔ **L'AGENTE ALIMENTI — «prende la parola, cerca in internet gli allergeni e i valori
 * nutrizionali e li popola»** (Simone, 5/9).
 *
 * ## Da dove nasce
 *
 * Dalla quarta volta che il vocabolario degli allergeni andava allungato a mano (taleggio, seppie,
 * scamorza…): «continuiamo ad avere questo problema, possibile che non riusciamo a trovare una
 * soluzione?». I vocabolari sono stati unificati lo stesso giorno, ma un elenco di parole resta un
 * elenco di parole: il foglio del 31/8 lo aveva già scritto — *«essere in tabella non vuol dire
 * conoscerne gli allergeni… si chiude dichiarando gli allergeni SULL'ALIMENTO, non allungando un
 * elenco di parole»*. Questo agente è quella strada: per ogni nome di ingrediente che le ricette
 * usano e la tabella alimenti non ha, chiede all'AI — con la ricerca in rete accesa — gli allergeni
 * UE e i valori per 100 g **con la fonte**, e scrive la riga.
 *
 * ## ⛔ Scrive direttamente, e i tag valgono subito — decisione di Simone del 5/9
 *
 * Gli era stata offerta la bozza da confermare; ha scelto «direttamente, valgono subito». Quindi:
 * la riga nasce **da confermare** (`verifiedAt` vuoto, come ogni valore che entra: la tabella lo
 * dice in testa, «un valore entra e Gaia lo usa subito», decisione di Simone dell'11/8) ma **usabile
 * subito**, e la stessa notte le ricette con quell'ingrediente prendono il tag (`tagDallaTabella`).
 * Il costo dichiarato: un allergene sbagliato dell'AI toglie un piatto a una cliente (falso
 * positivo) o — peggio — un allergene mancante lo lascia passare. Per il secondo caso vale la
 * regola del 31/8: l'AI **aggiunge** ai tag dedotti dalle parole, non li sostituisce; quindi un
 * allergene che il vocabolario vede resta anche se l'AI non lo dice.
 *
 * ## ⚠️ I freni, perché un agente che scrive in tabella si accende quando qualcuno decide
 *
 * · interruttore `agente_alimenti_acceso` (nasce spento); · tetto per notte `agente_alimenti_max`
 * (default 20: sono 20 chiamate con ricerca, e le ricerche si pagano a parte); · tre giri a vuoto e
 * si ferma; · errore fatale dell'AI (credito, chiave, modello) e si ferma subito — è la lezione del
 * 12/8, 270 chiamate allo stesso 400.
 *
 * ## ⛔ Il vaglio, che è la parte che conta
 *
 * L'AI risponde; **qui si decide se la risposta entra**. Una riga entra solo se: ha una fonte con un
 * indirizzo; ha le kcal, e i macro tornano con le kcal (Atwater, con tolleranza larga); gli
 * zuccheri non superano i carboidrati; ogni allergene è uno dei quattordici codici UE (uno sconosciuto
 * boccia tutta la riga — lasciarlo cadere sarebbe un allergene perso in silenzio); e non è una
 * **gemella** — la lezione del 20/8, 99 alimenti con «25 kcal» copiate: una riga identica a due
 * righe di alimenti diversi non entra (`gemelli-alimenti.ts`). ⚠️ Nessuno di questi controlli sa
 * se il numero è **giusto**: sanno se è plausibile e tracciabile. Per questo la riga resta nella
 * coda «da confermare» della nutrizionista, con la fonte accanto, e con `filledBy` che dice chi l'ha
 * scritta.
 */

export const CHIAVE_ACCESO = 'agente_alimenti_acceso';
export const CHIAVE_MAX = 'agente_alimenti_max';
export const MAX_PER_NOTTE = 20;
export const GIRI_A_VUOTO_MAX = 3;
/** Cosa c'è scritto in `filledBy` sulle righe che ha compilato lui. */
export const SCRITTO_DA = 'agente_alimenti';
export const AZIONE_RIGA = 'nutrient_fact.agente_alimenti';
export const AZIONE_TAG = 'catalog.recipe.allergens.dalla_tabella';
/** Il registro del secondo giro: gli allergeni chiesti per una riga che in tabella c'era già. */
export const AZIONE_ALLERGENI = 'nutrient_fact.agente_allergeni';
/** Quante ricerche in rete per alimento: oltre, il modello risponde con quello che ha. */
export const RICERCHE_PER_ALIMENTO = 3;

export const STATI = ['crudo', 'secco', 'non_applicabile', 'cotto', 'bollito'] as const;
/** Gli stati con cui la riga RISOLVE il termine per il conto delle ricette (le grammature sono a crudo). */
export const STATI_CHE_RISOLVONO = [...STATI_A_CRUDO, 'non_applicabile'];
export const AFFIDABILITA = ['solida', 'media', 'debole'] as const;

/** I limiti della porta a mano (`POST /nutrient-facts/mancanti/:id/crea`), con le kcal a 920: lo strutto ne ha 902. */
export const LIMITI: Readonly<Record<string, number>> = { kcal: 920, protein: 100, carbs: 100, sugars: 100, fat: 100, fiber: 100, alcol: 100 };

export const SYSTEM = [
  'Sei un nutrizionista che compila una tabella di composizione degli alimenti per una piattaforma italiana di diete.',
  'Ti viene dato il NOME di un ingrediente come compare nelle ricette. Devi cercare in rete (fonti preferite: CREA Tabelle di composizione degli alimenti, BDA Banca Dati Alimenti IEO, USDA FoodData Central, Ciqual ANSES, etichette del produttore per i prodotti di marca) e rispondere SOLO con un oggetto JSON, senza testo attorno.',
  'Campi: e_un_alimento (boolean: false se il nome non è un alimento, es. «q.b.», «a piacere», «per guarnire»), nome (il nome normalizzato in italiano), categoria (stringa breve), stato (OBBLIGATORIO, uno fra: crudo, secco, non_applicabile, cotto, bollito), kcal, proteine, carboidrati, zuccheri, grassi, fibre, alcol (numeri, grammi per 100 g; alcol 0 se non ne ha), allergeni (array di codici presi SOLO da questo elenco: '
    + EU_ALLERGEN_CODES.join(', ')
    + ' — vuoto se non ne contiene nessuno; per un prodotto trasformato considera anche gli ingredienti tipici dell\'etichetta), fonte ({ nome, url } della pagina da cui hai preso i valori), affidabilita (solida, media o debole).',
  'Lo stato: nelle ricette le grammature sono A CRUDO, quindi dai i valori dell\'alimento crudo (stato «crudo»), o «secco» per legumi, cereali, pasta, frutta secca ed essiccati; «non_applicabile» per olio, aceto, sale, zucchero, miele, spezie, bevande, dove crudo e cotto sono la stessa cosa; «cotto» o «bollito» SOLO se il nome stesso lo dice («ceci lessati», «riso cotto»).',
  'Regole: mai inventare un numero — se non trovi una fonte, metti affidabilita "debole" e dì la fonte più vicina che hai trovato; i valori si riferiscono all\'alimento così com\'è nel nome (se dice «in scatola» o «affumicato», quello); «senza lattosio» NON toglie l\'allergene latte; un formaggio, uno yogurt, un burro contengono latte; un pesce, anche affumicato o in scatola, è pesce.',
].join('\n');

/**
 * ⛔ **IL SECONDO GIRO: SOLO GLI ALLERGENI, sulle righe che in tabella ci sono già.**
 *
 * L'agente compila i nomi che **mancano**. Ma il foglio del 31/8 diceva un'altra cosa ancora — *«su
 * un pesto pronto che avesse la sua riga la deduzione direbbe nessun allergene con la stessa
 * faccia»* — e quel caso l'agente non lo copriva: le righe già scritte (il foglio del 20/8, quelle
 * a mano, gli import) hanno `allergens` vuoto, cioè **non si sa**, e nessuno lo chiede a nessuno.
 *
 * ⚠️ Qui non si toccano i **valori**: quelli una persona li ha già messi, e riscriverli sarebbe
 * l'AI che corregge una nutrizionista. Si chiede **solo** l'elenco degli allergeni, e si scrive solo
 * se la riga non ne ha nessuno.
 */
export const SYSTEM_SOLO_ALLERGENI = [
  'Sei un nutrizionista che compila la colonna ALLERGENI di una tabella di composizione degli alimenti, per una piattaforma italiana di diete.',
  'Ti viene dato il nome di un alimento che è già in tabella. Cerca in rete (etichette dei produttori, CREA, BDA, USDA, Ciqual) e rispondi SOLO con un oggetto JSON.',
  'Campi: e_un_alimento (boolean), allergeni (array di codici presi SOLO da questo elenco: '
    + EU_ALLERGEN_CODES.join(', ')
    + ' — vuoto se non ne contiene nessuno), fonte ({ nome, url }), affidabilita (solida, media, debole).',
  'Regole: per un prodotto trasformato o pronto considera gli ingredienti tipici dell\'etichetta (un pesto pronto ha di solito latte e frutta a guscio); «senza lattosio» NON toglie l\'allergene latte; un formaggio, uno yogurt, un burro contengono latte; un pesce, anche affumicato o in scatola, è pesce. Se non sei sicuro di cosa contenga un prodotto di marca, rispondi con la lista degli allergeni tipici di quella categoria e affidabilita "debole".',
].join('\n');

export const promptSoloAllergeni = (nome: string, categoria: string | null): string =>
  `Alimento: «${nome}»${categoria ? ` (categoria: ${categoria})` : ''}.\nRispondi con il solo JSON.`;

export type MotivoScartoAllergeni =
  'risposta_vuota' | 'allergene_sconosciuto' | 'senza_fonte' | 'vuoto_e_debole' | 'allergene_perso';

export type VaglioAllergeni =
  | { esito: 'ok'; allergens: string[]; fonte: string; affidabilita: string }
  | { esito: 'non_alimento' }
  | { esito: 'scartata'; motivo: MotivoScartoAllergeni; dettaglio: string };

/**
 * ⛔ **Lo stesso vaglio del giro grande, ma sui soli allergeni**: fonte con un indirizzo
 * obbligatoria, e un codice fuori dai quattordici UE boccia tutta la riga invece di cadere in
 * silenzio — un allergene perso è il verso in cui si sbaglia addosso a una persona.
 *
 * ⛔ **Due guardie in più, dalla revisione del 5/9, e sono la ragione per cui questo vaglio è più
 * severo di quello grande** — là un allergene mancato accompagna dei valori che una nutrizionista
 * rileggerà, qui l'allergene è **l'unica cosa** che si scrive, e scriverlo fa smettere di guardare:
 *
 * · **`[]` con affidabilità debole si scarta.** Il sistema dice all'AI di rispondere «debole» quando
 *   non sa: un elenco vuoto e debole è un'ipotesi, e la pagina la mostrerebbe come «l'agente ha
 *   cercato e non ne ha trovati». Fra «non lo sa nessuno» e una scrollata di spalle, meglio il primo.
 * · **Un allergene che le PAROLE trovano e l'AI non dichiara boccia la riga** (`dalleParole`): se
 *   «taleggio» sta nel vocabolario come latte e l'AI risponde `[]`, la risposta è sbagliata, e
 *   scriverla chiuderebbe la riga con un allergene in meno. Il contrario — l'AI ne trova uno che le
 *   parole non conoscono — è il motivo per cui il giro esiste, e passa.
 */
export function vagliaAllergeni(
  grezza: RispostaGrezza | null | undefined,
  dalleParole: readonly string[] = [],
): VaglioAllergeni {
  if (!grezza || typeof grezza !== 'object') return { esito: 'scartata', motivo: 'risposta_vuota', dettaglio: 'nessun JSON' };
  if (grezza.e_un_alimento === false) return { esito: 'non_alimento' };
  const allergeniGrezzi = Array.isArray(grezza.allergeni) ? grezza.allergeni : null;
  if (allergeniGrezzi === null) return { esito: 'scartata', motivo: 'risposta_vuota', dettaglio: 'niente elenco allergeni' };
  const allergens: string[] = [];
  for (const a of allergeniGrezzi) {
    const code = String(a ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!EU_ALLERGEN_CODES.includes(code)) return { esito: 'scartata', motivo: 'allergene_sconosciuto', dettaglio: String(a) };
    if (!allergens.includes(code)) allergens.push(code);
  }
  const fonte = (grezza.fonte && typeof grezza.fonte === 'object' ? grezza.fonte : {}) as { nome?: unknown; url?: unknown };
  const url = testo(fonte.url, 500);
  if (!url || !/^https?:\/\//i.test(url)) return { esito: 'scartata', motivo: 'senza_fonte', dettaglio: url ?? 'nessun url' };
  const affidabilita = (AFFIDABILITA as readonly string[]).includes(String(grezza.affidabilita ?? '').toLowerCase())
    ? String(grezza.affidabilita).toLowerCase()
    : 'debole';
  if (!allergens.length && affidabilita === 'debole') {
    return { esito: 'scartata', motivo: 'vuoto_e_debole', dettaglio: 'nessun allergene, ma la fonte è debole' };
  }
  const persi = dalleParole.filter((a) => !allergens.includes(a));
  if (persi.length) return { esito: 'scartata', motivo: 'allergene_perso', dettaglio: persi.join(', ') };
  return { esito: 'ok', allergens, fonte: testo(fonte.nome, 160) ?? url, affidabilita };
}

export function prompt(nome: string, esempi: readonly string[]): string {
  const dove = esempi.length ? ` Compare in ricette come: ${esempi.slice(0, 3).map((e) => `«${e}»`).join(', ')}.` : '';
  return `Ingrediente: «${nome}».${dove}\nRispondi con il solo JSON.`;
}

/** La forma che l'AI deve restituire; tutto è `unknown` finché il vaglio non lo ha guardato. */
export interface RispostaGrezza {
  e_un_alimento?: unknown;
  nome?: unknown;
  categoria?: unknown;
  stato?: unknown;
  kcal?: unknown; proteine?: unknown; carboidrati?: unknown; zuccheri?: unknown; grassi?: unknown; fibre?: unknown; alcol?: unknown;
  allergeni?: unknown;
  fonte?: unknown;
  affidabilita?: unknown;
}

/**
 * ⚠️ **Niente sinonimi dall'AI**, ed è voluto (revisione del 5/9): un sinonimo è una chiave di
 * abbinamento esatto per il conto e per i tag, e un iperonimo («formaggio» per il taleggio) farebbe
 * rispondere questa riga a ogni ricetta con «formaggio». I sinonimi li scrive una persona.
 */
export interface RigaDaScrivere {
  name: string;
  category: string | null;
  state: string;
  /** La riga risolve il termine per le ricette (stato a crudo o non applicabile)? Altrimenti resta nella lista di lavoro. */
  risolve: boolean;
  kcal: number; protein: number | null; carbs: number | null; sugars: number | null; fat: number | null; fiber: number | null;
  allergens: string[];
  source: string;
  sourceRef: string;
  affidabilita: (typeof AFFIDABILITA)[number];
}

export type MotivoScarto =
  | 'risposta_vuota' | 'senza_kcal' | 'numero_illeggibile' | 'numero_fuori_scala' | 'kcal_incoerenti'
  | 'zuccheri_oltre_carboidrati' | 'allergene_sconosciuto' | 'senza_fonte' | 'senza_stato' | 'gemella';

export type Vaglio =
  | { esito: 'ok'; riga: RigaDaScrivere }
  /** ⚠️ «Non è un alimento» è un esito suo: il termine si chiude come `ignored`, non si ritenta. */
  | { esito: 'non_alimento' }
  | { esito: 'scartata'; motivo: MotivoScarto; dettaglio: string };

const numero = (v: unknown): number | null | undefined => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : undefined;
};

const testo = (v: unknown, max = 120): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t.slice(0, max) : null;
};

/**
 * ⚠️ Atwater con tolleranza larga: 4·P + 4·C + 9·G contro le kcal dichiarate. Le fibre, gli acidi
 * organici, l'alcol e gli arrotondamenti delle fonti spostano il conto anche del 30%; sotto le 50 kcal
 * non si guarda (una verdura da 20 kcal con 4 g di carboidrati «sbaglia» del 20% per un grammo).
 */
export function kcalTornano(kcal: number, protein: number | null, carbs: number | null, fat: number | null, alcol: number | null = null): boolean {
  if (kcal < 50) return true;
  if (protein === null && carbs === null && fat === null) return true;
  const calcolate = 4 * (protein ?? 0) + 4 * (carbs ?? 0) + 9 * (fat ?? 0) + 7 * (alcol ?? 0);
  return Math.abs(calcolate - kcal) <= Math.max(40, kcal * 0.35);
}

/**
 * ⛔ **IL VAGLIO.** `esistenti` sono le righe già in tabella (per la guardia delle gemelle) — vanno
 * passate anche quelle scritte questa stessa notte, altrimenti venti righe copiate una dall'altra
 * passerebbero una alla volta.
 */
export function vaglia(termine: string, grezza: RispostaGrezza | null | undefined, esistenti: readonly RigaDaControllare[]): Vaglio {
  if (!grezza || typeof grezza !== 'object') return { esito: 'scartata', motivo: 'risposta_vuota', dettaglio: 'nessun JSON' };
  if (grezza.e_un_alimento === false) return { esito: 'non_alimento' };

  const kcal = numero(grezza.kcal);
  if (kcal === null) return { esito: 'scartata', motivo: 'senza_kcal', dettaglio: String(grezza.kcal ?? '') };
  if (kcal === undefined) return { esito: 'scartata', motivo: 'numero_illeggibile', dettaglio: `kcal = ${String(grezza.kcal)}` };
  const campi: [keyof RispostaGrezza, string][] = [['proteine', 'protein'], ['carboidrati', 'carbs'], ['zuccheri', 'sugars'], ['grassi', 'fat'], ['fibre', 'fiber'], ['alcol', 'alcol']];
  const valori: Record<string, number | null> = { kcal };
  for (const [da, a] of campi) {
    const n = numero(grezza[da]);
    if (n === undefined) return { esito: 'scartata', motivo: 'numero_illeggibile', dettaglio: `${da} = ${String(grezza[da])}` };
    valori[a] = n;
  }
  for (const [k, v] of Object.entries(valori)) {
    if (v !== null && (v < 0 || v > LIMITI[k])) return { esito: 'scartata', motivo: 'numero_fuori_scala', dettaglio: `${k} = ${v}` };
  }
  if (!kcalTornano(kcal, valori.protein, valori.carbs, valori.fat, valori.alcol)) {
    return { esito: 'scartata', motivo: 'kcal_incoerenti', dettaglio: `${kcal} kcal con P ${valori.protein ?? '–'} C ${valori.carbs ?? '–'} G ${valori.fat ?? '–'} alcol ${valori.alcol ?? '–'}` };
  }
  if (valori.sugars !== null && valori.carbs !== null && valori.sugars > valori.carbs + 1) {
    return { esito: 'scartata', motivo: 'zuccheri_oltre_carboidrati', dettaglio: `zuccheri ${valori.sugars} > carboidrati ${valori.carbs}` };
  }

  /**
   * ⛔ **Lo stato è obbligatorio**, ed è un pezzo del vaglio e non una cortesia: le grammature delle
   * ricette sono a crudo (`stato-alimento.ts`), e una riga senza stato entra in tabella, chiude il
   * termine e lascia il conto della ricetta esattamente dov'era — con il buco sparito dalla lista di
   * lavoro (revisione del 5/9). `normalizzaStato` legge anche «a crudo», «lessati», «non si applica».
   */
  const state = normalizzaStato(grezza.stato);
  if (!(STATI as readonly string[]).includes(state)) return { esito: 'scartata', motivo: 'senza_stato', dettaglio: String(grezza.stato ?? '') };

  const allergeniGrezzi = Array.isArray(grezza.allergeni) ? grezza.allergeni : [];
  const allergens: string[] = [];
  for (const a of allergeniGrezzi) {
    const code = String(a ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!EU_ALLERGEN_CODES.includes(code)) return { esito: 'scartata', motivo: 'allergene_sconosciuto', dettaglio: String(a) };
    if (!allergens.includes(code)) allergens.push(code);
  }

  const fonte = (grezza.fonte && typeof grezza.fonte === 'object' ? grezza.fonte : {}) as { nome?: unknown; url?: unknown };
  const url = testo(fonte.url, 500);
  const nomeFonte = testo(fonte.nome, 160);
  if (!url || !/^https?:\/\//i.test(url)) return { esito: 'scartata', motivo: 'senza_fonte', dettaglio: url ?? 'nessun url' };

  const name = normalizzaNome(termine);
  const affidabilita = String(grezza.affidabilita ?? '').toLowerCase();

  const riga: RigaDaScrivere = {
    name,
    category: testo(grezza.categoria, 60),
    state,
    risolve: STATI_CHE_RISOLVONO.includes(state),
    kcal, protein: valori.protein, carbs: valori.carbs, sugars: valori.sugars, fat: valori.fat, fiber: valori.fiber,
    allergens,
    source: nomeFonte ?? url,
    sourceRef: url,
    affidabilita: (AFFIDABILITA as readonly string[]).includes(affidabilita) ? (affidabilita as RigaDaScrivere['affidabilita']) : 'debole',
  };

  /** ⛔ La lezione del 20/8: una riga uguale a righe di alimenti diversi è una copia, non un dato. */
  const copie = riempimenti(trovaGemelli([...esistenti, riga])).find((g) => g.nomi.includes(name));
  if (copie) return { esito: 'scartata', motivo: 'gemella', dettaglio: `stessi valori di ${copie.nomi.filter((n) => n !== name).slice(0, 3).join(', ')}` };

  return { esito: 'ok', riga };
}

/**
 * ⚠️ Cosa resta scritto in `source`: la fonte e l'affidabilità. NON in `note`: la nota la legge Gaia
 * insieme al valore e la ripete alla cliente — un promemoria per la nutrizionista non ci va
 * (revisione del 5/9). Chi ha scritto la riga sta in `filledBy`.
 */
export const fonteDellaRiga = (riga: RigaDaScrivere): string =>
  riga.affidabilita === 'solida' ? riga.source : `${riga.source} (affidabilità ${riga.affidabilita})`;

// ---------------------------------------------------------------------------------------------------
// I TAG DALLA TABELLA ALLE RICETTE
// ---------------------------------------------------------------------------------------------------

export interface RigaConAllergeni {
  name: string;
  synonyms: readonly string[];
  allergens: readonly string[];
}

export interface RicettaDaTaggare {
  id: string;
  name: string;
  ingredients: unknown;
  allergens?: readonly string[] | null;
  /** ⛔ Chi ha scelto i tag a mano non si tocca (registro `catalog.recipe.allergens.set`). */
  toccataAMano?: boolean;
}

export interface TagDaAggiungere {
  recipeId: string;
  ricetta: string;
  allergen: string;
  ingrediente: string;
  alimento: string;
}

/**
 * ⛔ **I TAG CHE LA TABELLA DICE E LA RICETTA NON HA.** Il nome dell'ingrediente deve essere **uguale**
 * (normalizzato) al nome o a un sinonimo della riga: non «contiene», perché «latte» dentro «latte di
 * mandorla» è esattamente il difetto del 31/8. Aggiunge, mai toglie, e non tocca `allergensReviewed`.
 */
export function tagDallaTabella(ricette: readonly RicettaDaTaggare[], righe: readonly RigaConAllergeni[]): TagDaAggiungere[] {
  const perNome = new Map<string, RigaConAllergeni>();
  for (const r of righe) {
    if (!r.allergens.length) continue;
    for (const n of [r.name, ...r.synonyms]) {
      const k = normalizzaNome(n);
      if (k && !perNome.has(k)) perNome.set(k, r);
    }
  }
  if (!perNome.size) return [];
  const out: TagDaAggiungere[] = [];
  for (const ric of ricette) {
    if (ric.toccataAMano) continue;
    const ha = new Set(ric.allergens ?? []);
    const visti = new Set<string>();
    for (const ing of nomiIngredienti(ric.ingredients)) {
      const riga = perNome.get(normalizzaNome(ing));
      if (!riga) continue;
      for (const a of riga.allergens) {
        if (ha.has(a) || visti.has(a)) continue;
        visti.add(a);
        out.push({ recipeId: ric.id, ricetta: ric.name, allergen: a, ingrediente: ing, alimento: riga.name });
      }
    }
  }
  return out;
}

export interface ContoTag {
  ricette: number;
  perAllergene: { allergen: string; label: string; ricette: number; esempi: string[] }[];
}

export function contaTag(tag: readonly TagDaAggiungere[]): ContoTag {
  const per = new Map<string, { ricette: Set<string>; esempi: string[] }>();
  for (const t of tag) {
    const p = per.get(t.allergen) ?? { ricette: new Set<string>(), esempi: [] };
    p.ricette.add(t.recipeId);
    if (p.esempi.length < 3) p.esempi.push(`${t.ricetta} (${t.ingrediente})`);
    per.set(t.allergen, p);
  }
  return {
    ricette: new Set(tag.map((t) => t.recipeId)).size,
    perAllergene: [...per.entries()]
      .map(([allergen, p]) => ({ allergen, label: allergenLabel(allergen), ricette: p.ricette.size, esempi: p.esempi }))
      .sort((a, b) => b.ricette - a.ricette),
  };
}
