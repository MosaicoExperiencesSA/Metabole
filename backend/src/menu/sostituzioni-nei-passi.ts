/**
 * «NEGLI INGREDIENTI C'È SCRITTO BIETE, NEI PASSI CAROTE» (19/8, coda della voce 284).
 *
 * La scheda ricetta applica le sostituzioni concordate agli **ingredienti** (`ingredientiScalati`),
 * ma i **passi di cottura** escono dal catalogo intatti: «taglia le carote a rondelle» resta lì
 * mentre sopra c'è scritto «biete». Chi cucina legge due cose diverse sulla stessa ricetta.
 *
 * ## ⚠️ Perché NON si riscrivono i passi
 *
 * La correzione ovvia — sostituire la parola nel testo — è quella che fa danno. «La cipolla» che
 * diventa «la porro», «le carote tagliate a rondelle» che diventa «le biete tagliate a rondelle»
 * quando le biete a rondelle non si tagliano: un passo di cottura è una frase, e cambiarle dentro
 * una parola produce italiano sbagliato e istruzioni sbagliate. È la stessa ragione per cui su
 * «pesce tranne salmone» non correggiamo noi (`esclusioni-da-chiarire.ts`): una correzione
 * automatica che fa l'opposto è peggio del problema che risolve.
 *
 * Quindi si **dice**, e lo dice sopra i passi, dove serve: chi legge sa che quel nome è vecchio e
 * cosa metterci al posto. Una riga in più è meno cara di una ricetta che si contraddice.
 */

/** Come si confronta un nome dentro una frase: minuscole, accenti via, spazi normalizzati. */
const pulito = (s: unknown): string =>
  (typeof s === 'string' ? s : '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Vero se il nome dell'alimento compare nei passi **come parola**.
 *
 * ⚠️ `includes` non basta, ed è lo stesso errore che faceva sostituire i peperoni a chi scriveva
 * «pepe». Qui il danno sarebbe minore — una riga di troppo — ma una nota che parla di un
 * ingrediente che nei passi non c'è insegna a saltare le note.
 *
 * ⚠️ Si cerca anche il **singolare/plurale grezzo** (le ultime lettere): i passi dicono «la carota»
 * dove l'ingrediente si chiama «carote», e pretendere la forma esatta farebbe tacere la nota
 * proprio nei casi normali.
 */
export function nominatoNeiPassi(nome: string, passi: readonly string[]): boolean {
  const n = pulito(nome);
  if (n.length < 3) return false;
  const testo = passi.map(pulito).join(' · ');
  // La radice: si toglie l'ultima vocale, che è quella che cambia fra singolare e plurale.
  const radice = /[aeio]$/.test(n) ? n.slice(0, -1) : n;
  return new RegExp(`(^|[^a-z0-9])${radice}[aeio]?([^a-z0-9]|$)`, 'i').test(testo);
}

export interface SostituzioneDaSapere {
  /** Il nome che si legge ancora nei passi. */
  da: string;
  /** Quello che ci va davvero. */
  a: string;
}

/**
 * Le sostituzioni che vanno **dette** sopra i passi di cottura: solo quelle il cui nome vecchio
 * compare davvero lì.
 *
 * ⚠️ Solo quelle: una nota che avverte di un ingrediente che nei passi non è nominato è rumore, e
 * il rumore è quello che fa smettere di leggere anche le note utili.
 */
export function sostituzioniDaSapere(
  sostituzioni: readonly { from?: string; to?: string }[] | null | undefined,
  passi: readonly string[] | null | undefined,
): SostituzioneDaSapere[] {
  const righe = (passi ?? []).filter((p): p is string => typeof p === 'string');
  if (!righe.length) return [];
  const fuori: SostituzioneDaSapere[] = [];
  const visti = new Set<string>();
  for (const s of sostituzioni ?? []) {
    const da = (s?.from ?? '').trim();
    const a = (s?.to ?? '').trim();
    // ⚠️ Senza il nome nuovo la nota direbbe «non usare le carote» e basta: mezza istruzione è
    // peggio di nessuna, perché chi la legge si ferma e non sa cosa fare.
    if (!da || !a || pulito(da) === pulito(a)) continue;
    if (visti.has(pulito(da))) continue;
    if (!nominatoNeiPassi(da, righe)) continue;
    visti.add(pulito(da));
    fuori.push({ da, a });
  }
  return fuori;
}
