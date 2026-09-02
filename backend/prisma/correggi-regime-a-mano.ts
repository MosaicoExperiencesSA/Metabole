/**
 * LE CORREZIONI DECISE DA UNA PERSONA, UNA PER UNA — e la scrittura che le esegue.
 *
 * ⛔ **Queste righe NON sono un giudizio del codice.** Sono decisioni che Simone ha preso il 2/9
 * guardando le ricette una per una in back office, dopo che `regime:contenuto` le aveva messe fra
 * le dubbie e si era rifiutato di toccarle. L'elenco sta qui, scritto, perché una correzione a mano
 * fatta in una shell senza traccia è una correzione che fra tre mesi nessuno sa spiegare.
 *
 * ⚠️ **E LE SEI DEL PESCE HANNO UN SECONDO DIFETTO, PIÙ GROSSO DI QUELLO CHE SI STA CORREGGENDO.**
 * Erano nel mucchio «solo nel nome» **precisamente perché il pesce non compare fra i loro
 * ingredienti**. Se il pesce c'è davvero — e Simone dice di sì, avendole aperte — allora l'elenco
 * ingredienti è **incompleto**, e da quell'elenco escono: gli allergeni suggeriti, le kcal, i
 * macro, la lista della spesa.
 *
 * ⛔ Quindi mettere il regime a posto le rende **servibili a una pescetariana con le calorie
 * sbagliate e gli allergeni incompleti**. Il regime è la metà facile; l'ingrediente lo aggiunge una
 * nutrizionista dalla scheda, con le grammature, e questo script non lo inventa.
 *
 * ⚠️ Si scrive **per nome esatto**, non per id: l'id non l'ha letto nessuno, il nome sì. Se un nome
 * ne trova più d'una, si scrivono tutte e si stampano gli id — e se non ne trova nessuna, si dice.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run regime:a-mano              → sola lettura: cosa cambierebbe
 *   APPLICA=1 npm run regime:a-mano    → scrive
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLICA = process.env.APPLICA === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

interface Decisione {
  nome: string;
  regime: string;
  perche: string;
  /** ⚠️ Vero dove il pesce c'è ma NON è fra gli ingredienti: resta un difetto aperto dopo di noi. */
  ingredienteDaAggiungere?: true;
}

/**
 * ⛔ **L'ELENCO, e ogni riga è una decisione di una persona.** Chi lo rilegge deve poter risalire
 * al perché senza chiedere a nessuno.
 */
const DECISIONI: readonly Decisione[] = [
  // ── Le sei del 2/9: Simone le ha aperte in back office e il pesce c'è davvero. ──
  { nome: 'Branzino al forno con verdure rosse e limone', regime: 'pescetarian', perche: 'il branzino c\'è (verificato in scheda, 2/9)', ingredienteDaAggiungere: true },
  { nome: 'Branzino ai funghi trifolati con patate al forno e cavolo nero', regime: 'pescetarian', perche: 'il branzino c\'è (verificato in scheda, 2/9)', ingredienteDaAggiungere: true },
  { nome: 'Polpo Freddo su Letto di Orzo e Spinaci Saltati', regime: 'pescetarian', perche: 'il polpo c\'è (verificato in scheda, 2/9)', ingredienteDaAggiungere: true },
  { nome: 'Riso Integrale al Nero di Seppia-Bietola con Uova Sode', regime: 'pescetarian', perche: 'il nero di seppia è seppia (verificato in scheda, 2/9)', ingredienteDaAggiungere: true },
  { nome: 'Tartine di pane di segale con crema di noci, rucola e acciuga marina', regime: 'pescetarian', perche: 'l\'acciuga c\'è (verificato in scheda, 2/9)', ingredienteDaAggiungere: true },
  /**
   * ⚠️ **Questa l'avevo segnalata come probabile imitazione** — «(vegetale)» nel titolo — e Simone
   * ha risposto che il pesce c'è in tutte. Si scrive quello che ha deciso lui, e si scrive anche
   * che avevo pensato il contrario: se un giorno risulta un errore, la riga dice dove guardare.
   */
  { nome: 'Branzino al forno con verdure (vegetale)', regime: 'pescetarian', perche: 'il branzino c\'è (verificato in scheda, 2/9) — ⚠️ il «(vegetale)» nel titolo faceva pensare a un\'imitazione', ingredienteDaAggiungere: true },

  // ── Le due spostate per sbaglio da falsi positivi miei, già chiusi nel codice ma non nei dati. ──
  { nome: 'Poke Bowl Vegano con Riso e Alga Nori', regime: 'vegan', perche: 'spostata a pescetarian per «riso sushi», che è una varietà di riso' },
  { nome: 'Polenta Morbida ai Funghi Misti con Spinaci Freschi e Noci Tostate', regime: 'vegan', perche: 'spostata a pescetarian per «champignon, ostriche», che sono funghi' },
];

async function main() {
  titolo('CORREZIONI DI REGIME DECISE A MANO — sola lettura salvo APPLICA=1');
  riga('');
  riga(APPLICA ? '  ⚠️ APPLICA=1: le correzioni verranno scritte.' : '  Sola lettura. Per scrivere: APPLICA=1');

  const nomi = DECISIONI.map((d) => d.nome);
  const ricette = (await prisma.recipe.findMany({
    where: { name: { in: nomi } },
    select: { id: true, name: true, regime: true, active: true, ingredients: true },
  })) as unknown as { id: string; name: string; regime: string; active: boolean; ingredients: unknown }[];

  const perNome = new Map<string, typeof ricette>();
  for (const r of ricette) perNome.set(r.name, [...(perNome.get(r.name) ?? []), r]);

  let daScrivere = 0;
  let giaAPosto = 0;
  const mancanti: string[] = [];

  titolo('RIGA PER RIGA');
  for (const d of DECISIONI) {
    const trovate = perNome.get(d.nome) ?? [];
    riga('');
    riga(`  · «${d.nome}»  →  «${d.regime}»`);
    riga(`      perché: ${d.perche}`);
    if (!trovate.length) {
      riga('      ⛔ NON TROVATA in catalogo con questo nome esatto. Da guardare a mano.');
      mancanti.push(d.nome);
      continue;
    }
    for (const r of trovate) {
      const stato = r.active ? 'attiva' : 'spenta';
      if (r.regime === d.regime) { giaAPosto += 1; riga(`      ✅ già «${d.regime}» (${r.id.slice(0, 8)}, ${stato}): niente da fare.`); continue; }
      daScrivere += 1;
      riga(`      da «${r.regime}» a «${d.regime}»  (${r.id.slice(0, 8)}, ${stato})`);
    }
    if (trovate.length > 1) riga(`      ⚠️ ${trovate.length} ricette hanno questo nome: si scrivono tutte.`);
    if (d.ingredienteDaAggiungere) {
      const ing = (Array.isArray(trovate[0].ingredients) ? trovate[0].ingredients : []) as { name?: string }[];
      riga(`      ⛔ E L'INGREDIENTE MANCA: oggi in elenco ce ne sono ${ing.length}, e il pesce non è`);
      riga('         fra loro — è per questo che era finita nei dubbi. Da quell\'elenco escono kcal,');
      riga('         macro, allergeni e lista della spesa: il regime da solo non basta.');
    }
  }

  titolo('IL CONTO');
  riga('');
  riga(`  Decisioni in elenco        ${DECISIONI.length}`);
  riga(`  · da scrivere              ${daScrivere}`);
  riga(`  · già a posto              ${giaAPosto}`);
  riga(`  · non trovate              ${mancanti.length}`);

  if (!APPLICA) {
    riga('');
    riga('  Sola lettura: niente è stato scritto. Per scrivere: APPLICA=1 npm run regime:a-mano');
    riga('');
    return;
  }

  titolo('SCRITTURA');
  riga('');
  let fatte = 0;
  for (const d of DECISIONI) {
    for (const r of perNome.get(d.nome) ?? []) {
      if (r.regime === d.regime) continue;
      await prisma.recipe.update({ where: { id: r.id }, data: { regime: d.regime } as never });
      fatte += 1;
    }
  }
  riga(`  ✅ Scritte ${fatte} correzioni.`);
  riga('');
  riga('  ⛔ RESTA IL DIFETTO PIÙ GROSSO: le sei del pesce hanno l\'elenco ingredienti incompleto.');
  riga('  Il regime adesso è giusto, quindi possono arrivare a una pescetariana — con le kcal e gli');
  riga('  allergeni calcolati su un elenco in cui il pesce non c\'è. Vanno aperte in scheda e');
  riga('  completate da una nutrizionista, con le grammature.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
