/**
 * LE CLIENTI PESCETARIANE CHE OGGI LEGGONO IL PANIERE ONNIVORO — sola lettura.
 *
 * ⛔ **Il regime del pool viene dal PROFILO della cliente**, non dalla dieta
 * (`menu.service.ts` → `buildScoringContext(clientId, profile.regime, …)`). E in banca dati la
 * famiglia «Pescetariana» ha `regime: omnivore`, perché il pescetariano come regime non è mai stato
 * acceso: i panieri lo aggirano leggendo il regime **dal nome** (`REGIME_DAL_NOME`), ma il profilo
 * di una cliente no.
 *
 * ⚠️ Conseguenza: una cliente che ha scelto «Pescetariana» e ha `omnivore` sul profilo legge il
 * paniere **Mediterranea × onnivoro**, che contiene carne. Questo tabulato dice **quante sono** e
 * **quanta carne** hanno nel pool — cioè se è un rischio vero o un numero sulla carta.
 *
 * ⛔ **NON SCRIVE NIENTE.** E la migrazione, quando si fa, conviene farla **dal back office** sulla
 * scheda di ciascuna: cambiare il regime da lì passa da `updateProfile`, che **ricostruisce la base
 * personale certificata**. Scrivendo il campo a mano nel database la base resterebbe quella vecchia
 * — certificata su piatti onnivori — ed è esattamente il tipo di incoerenza che nessuno vede.
 * Se il numero è alto, allora serve uno script che faccia tutte e due le cose: questo tabulato
 * esiste per sapere quale dei due casi è.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:pescetariane
 */
import { PrismaClient } from '@prisma/client';
import { FAMIGLIE_CHE_SPARISCONO, REGIME_DAL_NOME } from '../src/catalog/appartenenza-panieri';
import { verdettoPescetariano } from '../src/catalog/paniere-pescetariano';

const prisma = new PrismaClient();
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

/** Le famiglie il cui NOME dice «pescetariano»: sono quelle mappate su quel regime. */
const FAMIGLIE_PESCETARIANE = Object.keys(REGIME_DAL_NOME).filter((f) => REGIME_DAL_NOME[f] === 'pescetarian');

const nomiIngredienti = (v: unknown): string[] => (Array.isArray(v)
  ? (v as unknown[]).map((i) => String((i as { name?: unknown })?.name ?? '')).filter(Boolean)
  : []);

async function main() {
  titolo('CLIENTI PESCETARIANE CHE LEGGONO IL PANIERE ONNIVORO');

  riga('');
  riga(`  Famiglie che nel nome dicono «pescetariano»: ${FAMIGLIE_PESCETARIANE.join(', ') || '—'}`);

  const profili = (await prisma.clientProfile.findMany({
    select: { userId: true, name: true, dietFamily: true, regime: true },
  })) as unknown as { userId: string; name: string | null; dietFamily: string | null; regime: string | null }[];

  const suQuellaFamiglia = profili.filter((p) => {
    const f = (p.dietFamily ?? '').trim();
    return FAMIGLIE_PESCETARIANE.some((x) => f === x || f.startsWith(`${x} `) || f.startsWith(`${x}—`));
  });

  const daMigrare = suQuellaFamiglia.filter((p) => (p.regime ?? '').trim() !== 'pescetarian');
  const giaAPosto = suQuellaFamiglia.length - daMigrare.length;

  riga('');
  riga(`  Clienti su una famiglia pescetariana: ${suQuellaFamiglia.length}`);
  riga(`  …già col regime pescetariano sul profilo: ${giaAPosto}`);
  riga(`  ⛔ …col regime SBAGLIATO sul profilo:      ${daMigrare.length}`);

  if (!daMigrare.length) {
    riga('');
    riga('  ✅ Nessuna cliente da migrare: chi sta su quella famiglia ha già il regime giusto.');
    riga('  ⚠️ Il che vuol dire anche che nessuna sta ricevendo carne per questo motivo.');
    riga('');
    return;
  }

  /**
   * ⚠️ **Il numero che dice se è un rischio o una formalità**: quanta carne c'è nel paniere che
   * quelle clienti stanno leggendo davvero. Un paniere onnivoro senza carne non esiste, ma il conto
   * lo diciamo invece di darlo per scontato.
   */
  const famigliaVera = (f: string) => FAMIGLIE_CHE_SPARISCONO[f.trim()] || f.trim();
  const perPaniere = new Map<string, number>();
  for (const p of daMigrare) {
    const k = `${famigliaVera(p.dietFamily ?? '')}|${(p.regime ?? '').trim()}`;
    perPaniere.set(k, (perPaniere.get(k) ?? 0) + 1);
  }

  riga('');
  riga('  Chi sono, e quale paniere leggono OGGI:');
  for (const p of daMigrare) {
    const k = `${famigliaVera(p.dietFamily ?? '')} × ${(p.regime ?? '—').trim()}`;
    riga(`     · ${p.userId.slice(0, 8)}  ${(p.name ?? '—').slice(0, 26).padEnd(26)}  «${p.dietFamily}»  →  legge ${k}`);
  }

  riga('');
  riga('  Quanta CARNE c\'è nei panieri che stanno leggendo:');
  for (const [k, quante] of perPaniere) {
    const [famiglia, regime] = k.split('|');
    const paniere = (await prisma.paniere.findFirst({ where: { famiglia, regime }, select: { id: true } })) as { id: string } | null;
    if (!paniere) { riga(`     · ${famiglia} × ${regime}: paniere non in tabella (${quante} clienti)`); continue; }
    const righe = (await prisma.paniereRicetta.findMany({
      where: { paniereId: paniere.id },
      select: { recipeId: true },
    })) as { recipeId: string }[];
    const ids = [...new Set(righe.map((r) => r.recipeId))];
    const ricette = (await prisma.recipe.findMany({
      where: { id: { in: ids }, active: true },
      select: { name: true, ingredients: true },
    })) as unknown as { name: string; ingredients: unknown }[];
    const conCarne = ricette.filter((r) => verdettoPescetariano(r.name, nomiIngredienti(r.ingredients)) === 'carne').length;
    riga(`     · ${famiglia} × ${regime}: ${conCarne} piatti con carne su ${ricette.length} attivi  (${quante} clienti lo leggono)`);
  }

  riga('');
  riga('  ⚠️ COME MIGRARLE, e non è un dettaglio: dal BACK OFFICE, sulla scheda di ciascuna,');
  riga('     cambiando il regime in «Pescetariano». Da lì passa da `updateProfile`, che ricostruisce');
  riga('     la base personale certificata. ⛔ Scrivendo il campo a mano nel database la base');
  riga('     resterebbe quella vecchia — certificata su piatti onnivori — e nessuno lo vedrebbe.');
  riga('  ⚠️ E prima va acceso `pescetarian` fra i regimi (Impostazioni), o la tendina non lo offre.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
