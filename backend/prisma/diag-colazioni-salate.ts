/**
 * QUANTO COSTA LA REGOLA «NIENTE CARNE, PESCE E VERDURE A COLAZIONE, SPUNTINO E MERENDA» —
 * sola lettura.
 *
 * Richiesta di Simone, 31/8. La lettura scelta è la sua: **il PIATTO** non dev'essere di carne,
 * pesce o verdura — non «nessuna verdura fra gli ingredienti». Vedi `catalog/piatto-di-cosa.ts`.
 *
 * ⛔ **NON SCRIVE NIENTE**, e la regola non è ancora applicata da nessuna parte: prima il numero.
 * ⚠️ È la stessa disciplina che due ore fa ha impedito al paniere DASH di nascere vuoto: qui il
 * rischio è lo stesso in grande — una regola che toglie troppo lascia panieri di colazioni che non
 * bastano a comporre un mese, e il motore non lo direbbe, comporrebbe più povero.
 *
 * ## Cosa guardare nel tabulato
 *
 * · **Restano** — quante ricette per pasto sopravvivono, per paniere. Il piano ne vuole 84 per
 *   pasto (168 per lo spuntino unico della Fase 2). Sotto quella soglia la regola costa un lavoro
 *   di riscrittura, e va saputo **prima**.
 * · **Non lo so** — l'ingrediente principale non è in tabella alimenti (373 righe contro 8012 nomi
 *   di ingrediente). ⛔ Queste NON passano: non sappiamo se sono verdure. Se sono tante, il numero
 *   vero sta fra «restano» e «restano + non lo so», e conviene riempire la tabella prima di
 *   applicare la regola.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:colazioni            → il conto per paniere e per pasto
 *   ESEMPI=30 npm run diag:colazioni  → più esempi (default 15)
 */
import { PrismaClient } from '@prisma/client';
import { paniereDellaVariante, ricetteDellaGiornata } from '../src/catalog/appartenenza-panieri';
import { PASTI_SENZA_CARNE_PESCE_VERDURA, diCosaE, ingredientePrincipale, vaBeneAColazione } from '../src/catalog/piatto-di-cosa';
import { abbinaPerRicetta, paroleChe } from '../src/nutrient-facts/abbinamento-alimenti';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 15) || 15);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};
const NOME: Record<string, string> = { breakfast: 'colazione', morning_snack: 'spuntino', afternoon_snack: 'merenda' };

/** I grammi di un ingrediente, se si possono leggere. ⚠️ `qty` è Json: non ci si fida. */
function grammi(i: unknown): number | null {
  if (!i || typeof i !== 'object') return null;
  const o = i as { qty?: unknown; unit?: unknown };
  const n = typeof o.qty === 'number' ? o.qty : Number(String(o.qty ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(o.unit ?? 'g').toLowerCase().trim();
  /** ⚠️ Solo i grammi si confrontano fra loro: «2 fette» e «150 g» non si sommano né si ordinano. */
  return u === 'g' || u === 'gr' || u === 'grammi' || u === 'ml' ? n : null;
}

async function main() {
  riga('');
  riga('==================================================================');
  riga('  «Niente carne, pesce e verdure a colazione, spuntino, merenda»');
  riga('  Sola lettura: la regola NON è applicata da nessuna parte.');
  riga('==================================================================');

  const [diete, giornate, ricette, alimenti] = await Promise.all([
    prisma.diet.findMany({ select: { id: true, name: true, regime: true } }) as unknown as
      Promise<{ id: string; name: string; regime: string }[]>,
    prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } }) as unknown as
      Promise<{ dietId: string; meals: unknown }[]>,
    prisma.recipe.findMany({ where: { active: true }, select: { id: true, name: true, ingredients: true } }) as unknown as
      Promise<{ id: string; name: string; ingredients: unknown }[]>,
    prisma.nutrientFact.findMany({ select: { name: true, synonyms: true, category: true } }) as unknown as
      Promise<{ name: string; synonyms: string[]; category: string | null }[]>,
  ]);

  const categoria = new Map<string, string>();
  const perParola = new Map<string, typeof alimenti>();
  for (const a of alimenti) {
    const nomi = [a.name, ...(a.synonyms ?? [])].map(normalizzaNome).filter(Boolean);
    for (const n of nomi) if (a.category) categoria.set(n, a.category);
    const chiavi = new Set<string>();
    for (const n of nomi) for (const p of paroleChe(n)) chiavi.add(p);
    for (const k of chiavi) perParola.set(k, [...(perParola.get(k) ?? []), a]);
  }
  /**
   * ⛔ **Non basta il nome esatto**, e il primo giro in produzione l'ha dimostrato: «Mela con burro
   * di mandorla», «Miglio soffiato con latte di capra», «Focaccia integrale con pomodoro» — cioè
   * colazioni perfette — finivano tutte in «non lo so» perché l'ingrediente principale in tabella
   * si chiama «mela» e nella ricetta «mela renetta media».
   *
   * ⚠️ Quindi si passa da `abbinaPerRicetta`, la stessa porta che usa il conto delle calorie: due
   * strade che rispondono a «a quale riga porta questo ingrediente» darebbero due risposte diverse,
   * ed è già successo il 19/8 con «spinaci freschi» — 1350 ricette.
   */
  const memo = new Map<string, string | null>();
  const categoriaDi = (nome: string): string | null => {
    const n = normalizzaNome(nome);
    if (!n) return null;
    if (memo.has(n)) return memo.get(n) ?? null;
    let cat = categoria.get(n) ?? null;
    if (!cat) {
      const candidate = new Set<(typeof alimenti)[number]>();
      for (const p of paroleChe(n)) for (const a of perParola.get(p) ?? []) candidate.add(a);
      const forse = candidate.size ? abbinaPerRicetta(n, [...candidate]) : null;
      cat = forse?.riga.category ?? null;
    }
    memo.set(n, cat);
    return cat;
  };

  /** ricetta → verdetto, calcolato una volta sola. */
  const verdetto = new Map<string, ReturnType<typeof diCosaE>>();
  const nomeDi = new Map<string, string>();
  /** L'ingrediente principale di ogni ricetta: serve all'elenco dei nomi da classificare. */
  const principaleDi = new Map<string, string | null>();
  for (const r of ricette) {
    nomeDi.set(r.id, r.name);
    const ing = Array.isArray(r.ingredients)
      ? (r.ingredients as unknown[]).map((i) => ({ name: String((i as { name?: unknown })?.name ?? ''), grammi: grammi(i) }))
      : [];
    verdetto.set(r.id, diCosaE(ing, categoriaDi));
    principaleDi.set(r.id, ingredientePrincipale(ing));
  }

  const perDieta = new Map<string, { slot: string; recipeId: string }[]>();
  for (const g of giornate) {
    const righe = ricetteDellaGiornata(g.meals);
    if (righe.length) perDieta.set(g.dietId, [...(perDieta.get(g.dietId) ?? []), ...righe]);
  }

  /** paniere → slot → { restano, carne, pesce, verdura, nonSo } su ricette DISTINTE. */
  const conto = new Map<string, Map<string, Map<string, Set<string>>>>();
  for (const d of diete) {
    const esito = paniereDellaVariante(d);
    if (esito.tipo !== 'paniere') continue;
    const k = `${esito.famiglia} × ${esito.regime}`;
    const perSlot = conto.get(k) ?? new Map<string, Map<string, Set<string>>>();
    for (const r of perDieta.get(d.id) ?? []) {
      if (!(PASTI_SENZA_CARNE_PESCE_VERDURA as readonly string[]).includes(r.slot)) continue;
      if (!verdetto.has(r.recipeId)) continue;
      const v = verdetto.get(r.recipeId) ?? null;
      const etichetta = vaBeneAColazione(v) ? 'restano' : (v ?? 'non lo so');
      const perEtichetta = perSlot.get(r.slot) ?? new Map<string, Set<string>>();
      const set = perEtichetta.get(etichetta) ?? new Set<string>();
      set.add(r.recipeId);
      perEtichetta.set(etichetta, set);
      perSlot.set(r.slot, perEtichetta);
    }
    conto.set(k, perSlot);
  }

  titolo('IL CONTO, PER PANIERE E PER PASTO');
  riga('');
  riga('  restano = il piatto non è di carne, pesce o verdura → resta dov\'è');
  riga('  ⛔ «non lo so» NON resta: l\'ingrediente principale non è in tabella alimenti.');
  riga('');
  let sottoSoglia = 0;
  for (const [paniere, perSlot] of [...conto.entries()].sort()) {
    if (![...perSlot.values()].some((m) => m.size)) continue;
    riga(`  ── ${paniere}`);
    for (const slot of PASTI_SENZA_CARNE_PESCE_VERDURA) {
      const m = perSlot.get(slot) ?? new Map<string, Set<string>>();
      const q = (k: string) => (m.get(k)?.size ?? 0);
      const restano = q('restano');
      if (restano < 84) sottoSoglia += 1;
      riga(
        `  · ${String(restano).padStart(4)} restano  (${NOME[slot]})`
        + `   fuori: carne ${q('carne')}, pesce ${q('pesce')}, verdura ${q('verdura')}`
        + `   ⛔ non lo so: ${q('non lo so')}${restano < 84 ? '   ⚠️ SOTTO 84' : ''}`,
      );
    }
  }

  titolo('IL VERDETTO');
  riga('');
  if (!sottoSoglia) {
    riga('  ✅ Nessuna cella scende sotto le 84 ricette per pasto: la regola si può applicare.');
  } else {
    riga(`  ⚠️ ${sottoSoglia} celle scenderebbero sotto le 84 ricette per pasto.`);
    riga('  ⛔ Non vuol dire che la regola è sbagliata: vuol dire che applicarla costa un lavoro di');
    riga('  riscrittura, e che il numero va guardato PRIMA — se no il motore compone più povero e');
    riga('  non lo dice nessuno.');
    riga('  ⚠️ Guardare anche la colonna «non lo so»: se è grossa, il conto vero è più alto e la');
    riga('  strada più corta è riempire la tabella alimenti, non riscrivere le ricette.');
  }

  titolo(`ESEMPI — piatti che uscirebbero da colazione/spuntino/merenda (${ESEMPI})`);
  riga('');
  let n = 0;
  for (const [id, v] of verdetto) {
    if (n >= ESEMPI) break;
    if (v && v !== 'altro') { riga(`  · [${v}] «${nomeDi.get(id)}»`); n += 1; }
  }

  titolo('⛔ I NOMI DA CLASSIFICARE — la strada più corta');
  riga('');
  riga('  L\'ingrediente PRINCIPALE di queste ricette non porta a nessuna riga della tabella');
  riga('  alimenti, quindi non sappiamo se è una verdura e il piatto non passa. ⚠️ Non serve');
  riga('  riscrivere la ricetta: basta che qualcuno dica, per ognuno di questi nomi, che cos\'è.');
  riga('');
  const daClassificare = new Map<string, number>();
  for (const [id, v] of verdetto) {
    if (v !== null) continue;
    const p = principaleDi.get(id);
    /**
     * ⚠️ **La chiave è NORMALIZZATA**, e il primo giro l'ha dimostrato: «Carciofi freschi» (23) e
     * «carciofi freschi» (26) uscivano come due righe diverse, e così «Zucchine crude» / «zucchine
     * crude», «Brodo vegetale caldo» / «brodo vegetale caldo». Un elenco di lavoro che conta la
     * stessa cosa due volte fa sembrare il lavoro più grande di quello che è — ed è il genere di
     * cosa per cui si smette di leggerlo.
     */
    if (p) {
      const k = normalizzaNome(p);
      daClassificare.set(k, (daClassificare.get(k) ?? 0) + 1);
    }
  }
  const ordinati = [...daClassificare.entries()].sort((a, b) => b[1] - a[1]);
  riga(`  Nomi diversi da classificare: ${ordinati.length}.`);
  riga('');
  for (const [nome, n] of ordinati.slice(0, ESEMPI * 4)) riga(`  · ${String(n).padStart(5)}  ${nome}`);
  if (ordinati.length > ESEMPI * 4) riga(`  …e altri ${ordinati.length - ESEMPI * 4}. Alza ESEMPI per vederli.`);
  riga('');
  riga('  ⚠️ Quante ricette si sbloccano coi primi N nomi:');
  for (const n of [10, 25, 50, 100, 250]) {
    if (n > ordinati.length) break;
    const quante = ordinati.slice(0, n).reduce((s2, [, q]) => s2 + q, 0);
    riga(`  · primi ${String(n).padStart(3)} nomi → ${quante} ricette`);
  }

  titolo(`ESEMPI — piatti che NON SO classificare (${ESEMPI})`);
  riga('');
  n = 0;
  for (const [id, v] of verdetto) {
    if (n >= ESEMPI) break;
    if (v === null) { riga(`  · «${nomeDi.get(id)}»`); n += 1; }
  }

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto, e la regola non è attiva.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
