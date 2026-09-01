/**
 * LE FAMIGLIE CHE SI CHIUDONO, E CHI CI STA SOPRA — sola lettura.
 *
 * ⚠️ Fase 9 del piano panieri. Sei famiglie di oggi **non sono famiglie**: sono regimi, strutture o
 * funzioni travestite da famiglia. Le loro varianti non versano in nessun paniere — sono le 78 che
 * `panieri:confronta` conta — e finché stanno fuori il paniere non è finito.
 *
 * ⛔ **NON SCRIVE NIENTE**, e non sposta nessuna cliente.
 *
 * ## La domanda vera non è «quante varianti», è «quante persone»
 *
 * Decisione di Simone del 26/8: *«ad oggi restano così, quando siamo pronti al passaggio li vediamo
 * uno per uno»*. Questo tabulato serve a sapere **quanti sono quegli uno per uno**, prima di
 * cominciare: se sono tre si fanno in un pomeriggio, se sono ottanta è un piano a sé.
 *
 * ⛔ **`ClientProfile.dietFamily` contiene il NOME della dieta.** Chiudere o rinominare una famiglia
 * **scollega** le clienti che ce l'hanno sopra: restano con un nome che non esiste più, e nessuno
 * se ne accorge finché non serve. Per questo esiste `npm run rinomina:prodotto`, che sposta il nome
 * dappertutto — e per questo il tabulato conta le clienti PER NOME, non per id della dieta.
 *
 * ⚠️ **Dove finiscono** lo dice `FAMIGLIE_CHE_SPARISCONO`, e per tre famiglie la risposta è
 * «da nessuna parte»: sono regimi (Vegana, Vegetariana) o strutture (Digiuno 16:8) che nel modello
 * nuovo non sono famiglie ma **colonne** — il regime e la struttura della sua dieta. Quelle clienti
 * non si spostano su un'altra famiglia: si guarda che famiglia ALIMENTARE stavano davvero seguendo,
 * ed è una domanda per una nutrizionista, non per uno script.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:famiglie-da-chiudere
 */
import { PrismaClient } from '@prisma/client';
import { FAMIGLIE_CHE_SPARISCONO, paniereDellaVariante } from '../src/catalog/appartenenza-panieri';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 40) || 40);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('LE FAMIGLIE CHE SI CHIUDONO — quante varianti, e quante persone');

  const [diete, profili, clientiPerDieta] = await Promise.all([
    prisma.diet.findMany({
      select: { id: true, name: true, regime: true, mealsPerDay: true, fasting: true, status: true },
    }) as unknown as Promise<{ id: string; name: string; regime: string; mealsPerDay: number | null; fasting: boolean | null; status: string | null }[]>,
    prisma.clientProfile.findMany({
      select: { userId: true, name: true, dietFamily: true },
    }) as unknown as Promise<{ userId: string; name: string | null; dietFamily: string | null }[]>,
    prisma.$queryRaw`
      SELECT diet_id AS "dietId", COUNT(DISTINCT client_id)::int AS clienti
      FROM menu_day WHERE date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY diet_id
    ` as Promise<{ dietId: string; clienti: number }[]>,
  ]);

  const serviteDa = new Map(clientiPerDieta.map((c) => [c.dietId, Number(c.clienti)]));

  /**
   * ⚠️ Una famiglia si riconosce dal PREFISSO del nome della variante: in banca dati le varianti si
   * chiamano «Mediterranea — vegana 5 pasti» e simili. Il confronto è sul nome esatto della
   * famiglia seguito da un separatore, non un `includes`: «Mediterranea» dentro «Mediterranea senza
   * glutine» darebbe due volte la stessa variante, a due famiglie diverse.
   */
  const famigliaDi = (nome: string): string | null => {
    for (const f of Object.keys(FAMIGLIE_CHE_SPARISCONO)) {
      if (nome === f || nome.startsWith(`${f} `) || nome.startsWith(`${f}—`) || nome.startsWith(`${f} —`)) return f;
    }
    return null;
  };

  const perFamiglia = new Map<string, { varianti: number; approvate: number; serviteDa: number; dove: string }>();
  for (const d of diete) {
    const f = famigliaDi(d.name);
    if (!f) continue;
    const c = perFamiglia.get(f) ?? { varianti: 0, approvate: 0, serviteDa: 0, dove: FAMIGLIE_CHE_SPARISCONO[f] };
    c.varianti += 1;
    if (d.status === 'approved') c.approvate += 1;
    c.serviteDa += serviteDa.get(d.id) ?? 0;
    perFamiglia.set(f, c);
  }

  /** ⚠️ E le persone: `dietFamily` è il NOME, ed è lì che una chiusura fa danno. */
  const profiliPerFamiglia = new Map<string, { userId: string; nome: string }[]>();
  for (const p of profili) {
    const nome = (p.dietFamily ?? '').trim();
    if (!nome) continue;
    const f = famigliaDi(nome) ?? (Object.prototype.hasOwnProperty.call(FAMIGLIE_CHE_SPARISCONO, nome) ? nome : null);
    if (!f) continue;
    const lista = profiliPerFamiglia.get(f) ?? [];
    lista.push({ userId: p.userId, nome: p.name ?? '—' });
    profiliPerFamiglia.set(f, lista);
  }

  riga('');
  riga('  ┌─ famiglia che si chiude ───────────────┬ var. ┬ appr ┬ serv ┬ profili ┬ dove va ─────────┐');
  let totProfili = 0;
  for (const f of Object.keys(FAMIGLIE_CHE_SPARISCONO)) {
    const c = perFamiglia.get(f) ?? { varianti: 0, approvate: 0, serviteDa: 0, dove: FAMIGLIE_CHE_SPARISCONO[f] };
    const quanti = (profiliPerFamiglia.get(f) ?? []).length;
    totProfili += quanti;
    const dove = c.dove || '⛔ da decidere a mano';
    riga(`  │ ${f.slice(0, 38).padEnd(38)} │ ${String(c.varianti).padStart(4)} │ ${String(c.approvate).padStart(4)} │ ${String(c.serviteDa).padStart(4)} │ ${String(quanti).padStart(7)} │ ${dove.slice(0, 17).padEnd(17)} │`);
  }
  riga('  └────────────────────────────────────────┴──────┴──────┴──────┴─────────┴───────────────────┘');
  riga('  var. = varianti in catalogo · appr = approvate · serv = clienti servite negli ultimi 30 giorni');
  riga('  profili = clienti che hanno QUEL NOME in `dietFamily` — sono quelle che una chiusura scollega');

  riga('');
  riga(`  Persone da vedere una per una: ${totProfili}`);

  if (totProfili) {
    riga('');
    for (const [f, gente] of profiliPerFamiglia) {
      const dove = FAMIGLIE_CHE_SPARISCONO[f];
      riga(`  · ${f} → ${dove || '⛔ nessuna famiglia corrispondente: decide una nutrizionista'}`);
      for (const g of gente.slice(0, ESEMPI)) riga(`      ${g.userId.slice(0, 8)}  ${g.nome}`);
      if (gente.length > ESEMPI) riga(`      …e altre ${gente.length - ESEMPI}.`);
    }
  }

  /** ⚠️ Il controllo che chiude il cerchio: quelle varianti stanno davvero fuori da ogni paniere? */
  const fuori = diete.filter((d) => paniereDellaVariante(d as never).tipo !== 'paniere');
  const fuoriNonCensite = fuori.filter((d) => !famigliaDi(d.name));
  riga('');
  riga(`  Varianti fuori da ogni paniere: ${fuori.length}  ·  di cui NON spiegate da queste sei famiglie: ${fuoriNonCensite.length}`);
  if (fuoriNonCensite.length) {
    riga('  ⛔ Queste stanno fuori per un motivo che il piano non ha censito — vanno guardate:');
    for (const d of fuoriNonCensite.slice(0, ESEMPI)) riga(`     · ${d.name}`);
    if (fuoriNonCensite.length > ESEMPI) riga(`     …e altre ${fuoriNonCensite.length - ESEMPI}.`);
  } else {
    riga('  ✅ Tutte quelle fuori sono spiegate: sono le sei famiglie di questa tabella.');
  }
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
