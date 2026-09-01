/**
 * DA QUALE PANIERE VIENE UNA VARIANTE — la regola della migrazione della Fase 1.
 *
 * ⛔ `Diet` oggi è la **variante** (famiglia × regime × obiettivo × struttura pasti: 318 righe).
 * Il paniere è **famiglia × regime** e basta: 10 × 4 − 2 = 38. Quindi molte varianti confluiscono
 * nello stesso paniere, ed è esattamente quello che il piano vuole (§1.6, strada B) — un pranzo
 * vegano a basso indice glicemico serve anche DASH vegana e Mediterranea vegana, e non si
 * riscrive.
 *
 * ⚠️ **Obiettivo e struttura pasti NON entrano nella chiave.** «Mediterranea onnivora dimagrimento
 * 3 pasti» e «Mediterranea onnivora mantenimento 5 pasti» versano nello stesso paniere: le calorie
 * e la struttura le decide il motore quando compone, non l'appartenenza del piatto.
 *
 * ⛔ **E il digiuno nemmeno**: `Digiuno intermittente (16:8)` non è una famiglia, è una struttura
 * pasti travestita (§2.1 del piano). Qui si mappa sulla famiglia vera che il piano gli assegna, o
 * si dichiara non mappabile — non si inventa un paniere «Digiuno», che sarebbe la settima famiglia
 * fantasma dopo le sei che questo lavoro esiste per chiudere.
 */

/** Le dieci famiglie del piano (§1.1), coi nomi come stanno in `Diet.name`. */
export const FAMIGLIE = [
  /**
   * ⛔ **`DASH` si chiama `DASH (anti-ipertensiva)` in banca dati** — il primo giro in produzione
   * (31/8) l'ha trovato: quattro varianti approvate, 420 righe di giornata ciascuna, tutte fuori da
   * ogni paniere per un nome scritto come sta nel piano invece che come sta nel database.
   * ⚠️ È il difetto che il tabulato in sola lettura esiste per trovare: se lo script avesse scritto
   * al primo colpo, il paniere DASH sarebbe nato vuoto e nessuno l'avrebbe collegato al nome.
   */
  'Basso indice glicemico', 'DASH (anti-ipertensiva)', 'Detossinante (reset depurativo)', 'Flessibile',
  'Iperproteica sportiva / ricomposizione', 'Keto (non terapeutica)', 'Keto-Mediterranea',
  'Low carb', 'Mediterranea', 'Proteica',
] as const;

/** I quattro regimi (§1.2), coi nomi come stanno in `Diet.regime`. */
export const REGIMI = ['omnivore', 'pescetarian', 'vegetarian', 'vegan'] as const;

/**
 * ⛔ Le due combinazioni dichiarate impossibili (§1.3). Si bloccano **a priori**: chi ci finisce
 * sopra legge «combinazione non possibile», non un paniere vuoto — che sembra un problema
 * temporaneo e nessuno lo guarda.
 */
export const IMPOSSIBILI: readonly string[] = ['Keto (non terapeutica)|vegan', 'Keto-Mediterranea|vegan'];

/**
 * Le famiglie di oggi che **non sono famiglie** e dove vanno (§2.1). ⚠️ Vuoto = la variante non si
 * migra e si dichiara: meglio una riga in un elenco da guardare che un paniere inventato.
 */
export const FAMIGLIE_CHE_SPARISCONO: Readonly<Record<string, string>> = {
  /**
   * ⛔ **«Flexitariana» non era nel piano, e in catalogo ha varianti APPROVATE con 420 righe di
   * giornata ciascuna** — trovata dal primo giro in sola lettura, 31/8.
   *
   * Decisione di Simone: confluisce in **Flessibile**. Il §1.2 del piano dice che il flexitariano
   * non è un regime ma una **regola di frequenza** sul paniere onnivoro (carne al massimo tre volte
   * a settimana); come famiglia vale lo stesso — le sue ricette non hanno niente che le distingua
   * da quelle flessibili, e tenerla a sé farebbe nascere quattro panieri quasi identici da
   * mantenere per sempre. La frequenza diventa una `ProductRule`.
   */
  Flexitariana: 'Flessibile',
  /**
   * ⛔ **«Pescetariana» è un REGIME travestito da famiglia** (31/8, decisione di Simone), ed è la
   * quinta dopo le quattro che il §2.1 aveva già censito. Le sue varianti hanno `style:
   * mediterranean`, quindi la famiglia vera è la Mediterranea.
   *
   * ⚠️ E il regime va letto **dal nome**, non dalla colonna: in banca dati quelle righe dicono
   * `regime: omnivore`, perché il pescetariano non è mai stato acceso (§1.2). Prenderlo dalla
   * colonna vorrebbe dire versare piatti pescetariani nel paniere onnivoro — legittimi lì, ma il
   * paniere pescetariano resterebbe vuoto, che è il difetto che questa riforma viene a chiudere.
   * Vedi `REGIME_DAL_NOME`.
   */
  Pescetariana: 'Mediterranea',
  // Regimi travestiti da famiglia: la famiglia vera non c'è, il regime sì → non si migra.
  Vegana: '',
  'Vegetariana (latto-ovo)': '',
  // Strutture e obiettivi travestiti da famiglia.
  'Digiuno intermittente (16:8)': '',
  'Mediterranea ipocalorica': 'Mediterranea',
  // Decisione di Simone del 27/8: il paniere resta, la famiglia si chiude → confluisce.
  'Mediterranea senza glutine': 'Mediterranea',
  // Funzioni, non panieri (§6).
  'Ritorno in Equilibrio': '',
  'Vacanze in Serenità': '',
};

/**
 * ⛔ **Le famiglie che dicono il REGIME nel nome.** Per queste il regime si legge di qua e non dalla
 * colonna: in banca dati «Pescetariana» ha `regime: omnivore`, perché il pescetariano come regime
 * non è mai stato acceso — e prendendo la colonna i suoi piatti finirebbero nel paniere onnivoro
 * mentre quello pescetariano resta vuoto.
 *
 * ⚠️ Elenco chiuso, e corto apposta: vale solo dove il nome della famiglia **è** un regime. Non è
 * una regola su «se il nome somiglia a un regime», che sul «Flessibile» o sul «Detossinante»
 * comincerebbe a indovinare.
 */
export const REGIME_DAL_NOME: Readonly<Record<string, string>> = {
  Pescetariana: 'pescetarian',
  Vegana: 'vegan',
  'Vegetariana (latto-ovo)': 'vegetarian',
};

/**
 * ⛔ **DOVE VANNO LE RICETTE DELLE COMBINAZIONI IMPOSSIBILI** — decisione di Simone del 31/8.
 *
 * «Keto × vegano» e «Keto-Mediterranea × vegano» si chiudono, ma in catalogo hanno 1764 righe di
 * giornata: il §1.6 dice che «tornano in catalogo come vegane», non che si buttano — è il guadagno
 * della strada B, e buttarle sarebbe esattamente quello che la strada B è stata scelta per evitare.
 *
 * Sono ricette vegane e povere di carboidrati, quindi entrano nei panieri vegani delle due famiglie
 * più vicine che esistono. ⚠️ **In tutte e due**, e non è una duplicazione: un piatto appartiene a
 * più panieri per costruzione, ed è il senso della tabella di appartenenza.
 */
export const DOVE_VANNO_LE_IMPOSSIBILI: Readonly<Record<string, readonly string[]>> = {
  'Keto (non terapeutica)|vegan': ['Low carb', 'Basso indice glicemico'],
  'Keto-Mediterranea|vegan': ['Low carb', 'Basso indice glicemico'],
};

/**
 * ⛔ **LA FRASE CHE LEGGE CHI CHIEDE UNA COMBINAZIONE IMPOSSIBILE** — Fase 5, decisione del 31/8:
 * *«chi le chiede legge "combinazione non possibile", non un paniere vuoto — che sembra un problema
 * temporaneo e nessuno lo guarda»*.
 *
 * ⚠️ **E non basta dire di no.** Un rifiuto senza un'alternativa lascia la cliente ferma davanti a
 * una schermata: se il vegano è la sua scelta di vita e la keto è quella che le hanno consigliato,
 * qualcuno deve dirle quale delle due si può tenere insieme all'altra. Le famiglie che si
 * propongono sono le stesse in cui vanno a finire le ricette di quella cella (`DOVE_VANNO_LE_IMPOSSIBILI`),
 * ed è voluto: sono i panieri che quei piatti li hanno davvero.
 *
 * ⛔ Torna `null` quando la combinazione si può fare — cioè quasi sempre. Chi chiama scrive
 * `if (motivo) throw`, e non deve conoscere l'elenco.
 */
export function combinazioneImpossibile(famiglia: string | null | undefined, regime: string | null | undefined): string | null {
  const f = (famiglia ?? '').trim();
  const r = (regime ?? '').trim();
  if (!f || !r) return null;
  if (!IMPOSSIBILI.includes(`${f}|${r}`)) return null;
  const alternative = DOVE_VANNO_LE_IMPOSSIBILI[`${f}|${r}`] ?? [];
  const dove = alternative.length
    ? ` Con questo regime funzionano ${alternative.join(' e ')}: gli stessi piatti stanno lì.`
    : '';
  return `«${f}» e il regime «${r}» non si possono mettere insieme: una dieta chetogenica ha bisogno`
    + ` di proteine e grassi che quel regime esclude, e il risultato non sarebbe né l'una né l'altro.${dove}`;
}


export interface VariantePerPaniere {
  id: string;
  name: string;
  regime: string;
}

export type Esito =
  | { tipo: 'paniere'; famiglia: string; regime: string }
  /** Chiusa, ma le sue ricette hanno una casa: `dove` sono i panieri in cui versano. */
  | { tipo: 'impossibile'; famiglia: string; regime: string; dove: { famiglia: string; regime: string }[] }
  | { tipo: 'non_mappabile'; perche: string };

const FAMIGLIA = new Set<string>(FAMIGLIE);
const REGIME = new Set<string>(REGIMI);

export function paniereDellaVariante(d: VariantePerPaniere): Esito {
  const nome = (d.name ?? '').trim();
  /**
   * ⚠️ **Il nome prima della colonna**, per le famiglie che il regime lo dicono nel nome: vedi
   * `REGIME_DAL_NOME`. Per tutte le altre — cioè quasi tutte — vale la colonna, come sempre.
   */
  const regime = (REGIME_DAL_NOME[nome] ?? d.regime ?? '').trim();
  if (!REGIME.has(regime)) return { tipo: 'non_mappabile', perche: `regime sconosciuto: «${regime}»` };

  let famiglia = nome;
  if (!FAMIGLIA.has(famiglia)) {
    const dove = FAMIGLIE_CHE_SPARISCONO[famiglia];
    if (dove === undefined) return { tipo: 'non_mappabile', perche: `famiglia sconosciuta: «${nome}»` };
    if (!dove) return { tipo: 'non_mappabile', perche: `«${nome}» non è una famiglia (§2.1 del piano)` };
    famiglia = dove;
  }
  const chiave = `${famiglia}|${regime}`;
  if (IMPOSSIBILI.includes(chiave)) {
    return {
      tipo: 'impossibile',
      famiglia,
      regime,
      dove: (DOVE_VANNO_LE_IMPOSSIBILI[chiave] ?? []).map((f) => ({ famiglia: f, regime })),
    };
  }
  return { tipo: 'paniere', famiglia, regime };
}

/** I 38 panieri da creare, in ordine stabile. */
export function panieriDaCreare(): { famiglia: string; regime: string }[] {
  const out: { famiglia: string; regime: string }[] = [];
  for (const famiglia of FAMIGLIE) {
    for (const regime of REGIMI) {
      if (!IMPOSSIBILI.includes(`${famiglia}|${regime}`)) out.push({ famiglia, regime });
    }
  }
  return out;
}

/** Gli id di ricetta nominati da una giornata, per slot. ⚠️ `meals` è Json: non ci si fida. */
export function ricetteDellaGiornata(meals: unknown): { slot: string; recipeId: string }[] {
  if (!Array.isArray(meals)) return [];
  const out: { slot: string; recipeId: string }[] = [];
  for (const m of meals) {
    if (!m || typeof m !== 'object') continue;
    const slot = String((m as { slot?: unknown }).slot ?? '').trim();
    const recipeId = String((m as { recipeId?: unknown }).recipeId ?? '').trim();
    if (slot && recipeId) out.push({ slot, recipeId });
  }
  return out;
}
