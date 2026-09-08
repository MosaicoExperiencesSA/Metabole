/**
 * ⛔ **CHI HA FIRMATO I TAG CHE IL RITIRO NON HA POTUTO TOGLIERE.** Sola lettura, sempre.
 *
 * ## Perché esiste
 *
 * Il ritiro del sorgo soffiato (8/9) ha recuperato **12 ricette su 78**. Le altre 66 sono rimaste
 * col glutine sbagliato per la regola di `ritira-i-tag.ts`: *«un tag su una ricetta che qualcuno ha
 * guardato non si tocca»*. La regola è giusta e non si discute. Ma «guardato» in questo progetto
 * vuol dire `allergensReviewed === true`, e quel campo diventa vero anche senza nessuna persona:
 * `prisma/approve-diets.ts` lo mette su **tutto il catalogo** con una `updateMany` e non lascia
 * nessuna riga di registro; `prisma/pubblica-tutto.ts` fa lo stesso per ogni dieta pubblicata.
 *
 * Quindi il numero «66» non si può leggere finché non si sa **di chi** sono quelle firme e **di
 * quando**. Questo script legge le date che ci sono già e le mette in fila. Il giudizio sta in
 * `src/nutrient-facts/chi-ha-firmato.ts`, con le sue prove.
 *
 * ⛔ **Non scrive niente e non ha un CONFERMA.** Serve a decidere se scrivere qualcosa, e una misura
 * che può anche scrivere è una misura che prima o poi qualcuno lancia col dito sbagliato.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *     npm run diag:firme-allergeni                              → il quadro generale
 *     ALIMENTO="sorgo soffiato" npm run diag:firme-allergeni     → le ricette rimaste, una per una
 */
import { PrismaClient } from '@prisma/client';
import { AZIONE_TAG } from '../src/nutrient-facts/agente-alimenti';
import { chiHaFirmato, PAROLE_DEL_VERDETTO, spunteSenzaNessuno, type FirmeDiUnaRicetta, type Verdetto } from '../src/nutrient-facts/chi-ha-firmato';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const ALIMENTO = normalizzaNome(process.env.ALIMENTO ?? '');
const GIORNI = Math.max(1, Number(process.env.GIORNI ?? 180) || 180);
const TETTO_RIGHE = Math.max(1, Number(process.env.RIGHE ?? 25) || 25);
const AZIONE_A_MANO = 'catalog.recipe.allergens.set';
const AZIONE_BLOCCO = 'catalog.recipe.allergens.bulk';
const AZIONE_MOTORE = 'engine_rule.review.allergens';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => { riga(''); riga('──────────────────────────────────────────────────────────────────'); riga(`  ${s}`); riga('──────────────────────────────────────────────────────────────────'); };
const quando = (d?: Date) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—');

async function main(): Promise<void> {
  riga('');
  riga('==================================================================');
  riga('  CHI HA FIRMATO I TAG DEGLI ALLERGENI — sola lettura');
  riga('==================================================================');

  /**
   * ⛔ **PARTE UNO: `allergensReviewed` è ancora una firma?** Il conto vale per tutto il catalogo e
   * non dipende da nessun alimento: quante ricette risultano guardate, e quante di quelle il
   * registro sa spiegare. La differenza non l'ha messa nessuno.
   */
  const [segnateGuardate, ricetteInTutto, firmeUnaPerUna, blocchi, dalMotore] = await Promise.all([
    prisma.recipe.count({ where: { allergensReviewed: true } as never }),
    prisma.recipe.count(),
    prisma.auditLog.findMany({ where: { action: AZIONE_A_MANO, entityType: 'recipe' } as never, select: { entityId: true } as never }) as Promise<{ entityId: string | null }[]>,
    prisma.auditLog.findMany({ where: { action: AZIONE_BLOCCO } as never, select: { entityId: true, createdAt: true, metadata: true } as never }) as Promise<{ entityId: string | null; createdAt: Date; metadata: unknown }[]>,
    prisma.auditLog.findMany({ where: { action: AZIONE_MOTORE } as never, select: { entityId: true, createdAt: true, metadata: true } as never }) as Promise<{ entityId: string | null; createdAt: Date; metadata: unknown }[]>,
  ]);
  const numero = (m: unknown, chiave: string) => Number(((m ?? {}) as Record<string, unknown>)[chiave] ?? 0) || 0;

  /**
   * ⛔ **LE RICETTE SI CONTANO UNA VOLTA SOLA — la prima stesura le sommava, e ha risposto ZERO
   * sbagliando.** Le 2151 revisioni di dieta dichiaravano 260.835 ricette confermate su un catalogo
   * di 27.136: le diete si scambiano le ricette, e sommare i loro conti contava la stessa spunta
   * centinaia di volte. Qui le revisioni si **risolvono in id** e si uniscono in un insieme, che è
   * l\'unica forma in cui quel numero vuol dire qualcosa.
   */
  const conTracciaPropria = new Set(firmeUnaPerUna.map((f) => String(f.entityId ?? '')).filter(Boolean));
  const dieteRiviste = [...new Set(dalMotore.map((r) => String(r.entityId ?? '')).filter(Boolean))];
  for (let i = 0; i < dieteRiviste.length; i += 200) {
    const giorni = (await prisma.dietDayTemplate.findMany({
      where: { dietId: { in: dieteRiviste.slice(i, i + 200) } } as never,
      select: { meals: true } as never,
    })) as { meals: unknown }[];
    for (const g of giorni) {
      for (const m of (Array.isArray(g.meals) ? g.meals : []) as { recipeId?: string }[]) {
        if (m.recipeId) conTracciaPropria.add(m.recipeId);
      }
    }
  }
  /** ⚠️ Del blocco si conosce **una** ricetta: la capofila, che il registro scrive come `entityId`. */
  for (const b of blocchi) if (b.entityId) conTracciaPropria.add(String(b.entityId));

  const dichiarateDaiBlocchi = blocchi.reduce((a, b) => a + numero(b.metadata, 'confermate'), 0);
  const conto = spunteSenzaNessuno({
    segnateGuardate,
    conTracciaPropria: conTracciaPropria.size,
    dichiarateDaiBlocchi,
  });

  titolo('LE SPUNTE DI CONFERMA — quante le ha messe una persona, e chi');
  riga(`  Ricette in catalogo                              ${String(ricetteInTutto).padStart(7)}`);
  riga(`  Segnate «allergeni guardati»                     ${String(segnateGuardate).padStart(7)}`);
  riga('');
  riga(`  ⛔ Firmate UNA PER UNA, riquadro aperto           ${String(new Set(firmeUnaPerUna.map((f) => String(f.entityId ?? ''))).size).padStart(7)}   ← l\'unico gesto su QUELLA ricetta`);
  riga(`  · ricette raggiunte da una revisione di dieta     ${String(conTracciaPropria.size).padStart(7)}   (${dieteRiviste.length} diete, ricette distinte)`);
  riga(`  · dichiarate dai blocchi (${String(blocchi.length).padStart(3)} blocchi)          ${String(dichiarateDaiBlocchi).padStart(7)}   ⚠️ quante, non QUALI`);
  riga(`  ────────────────────────────────────────────────  ${'─'.repeat(7)}`);
  riga(`  Si sa quali sono                                 ${String(conto.conTracciaPropria).padStart(7)}`);
  riga(`  Forse coperte dai blocchi                        ${String(conto.forseDaiBlocchi).padStart(7)}   ⚠️ al massimo: non si sa quali`);
  riga(`  ⛔ SENZA NESSUNA SPIEGAZIONE POSSIBILE            ${String(conto.senzaNessuno).padStart(7)}`);
  riga('');
  if (conto.senzaNessuno > 0) {
    riga('  ⛔ Queste restano anche regalando ai blocchi tutta la copertura che dichiarano: nessuna');
    riga('     persona può averle messe. Sono di `approve-diets.ts` o `pubblica-tutto.ts`, che scrivono');
    riga('     `allergensReviewed: true` in blocco e senza registro.');
  } else if (conto.forseDaiBlocchi > 0) {
    riga(`  ⚠️ NON è un via libera: ${conto.forseDaiBlocchi} spunte tornano solo se si dà per buono che i blocchi`);
    riga('     abbiano coperto ricette tutte diverse fra loro e tutte scoperte — cioè il caso più');
    riga('     favorevole possibile. Il registro dei blocchi non scrive gli id, quindi meglio di così');
    riga('     non si può sapere: la risposta onesta è «non si sa», non «a posto».');
  } else {
    riga('  ✅ Ogni spunta ha una traccia sua nel registro: si sa per ognuna chi e quando.');
  }
  riga('');

  /**
   * ⚠️ **IL NUMERO CHE CONTA DAVVERO NON È IL BUCO: È LA PRIMA RIGA.** Le firme una per una sono le
   * uniche in cui qualcuno ha guardato **quella** ricetta. Tutto il resto — blocchi, revisioni di
   * dieta — è un gesto solo su centinaia di piatti insieme. La protezione «un tag su una ricetta che
   * una persona ha guardato non si tocca» vale quanto questa proporzione.
   */
  const unaPerUna = new Set(firmeUnaPerUna.map((f) => String(f.entityId ?? ''))).size;
  if (segnateGuardate > 0) {
    const quota = (unaPerUna / segnateGuardate) * 100;
    riga(`  ▶️ Guardate una per una: ${unaPerUna} su ${segnateGuardate} (${quota < 0.1 ? '<0,1' : quota.toFixed(1)}%).`);
    riga('     ⚠️ Tutto il resto è un gesto in blocco. «Ha guardato una persona» è vero sulla FIRMA,');
    riga('     non sulla singola ricetta — ed è la frase su cui il ritiro dei tag si ferma.');
  }

  if (!ALIMENTO) {
    riga('');
    riga('  Per guardare le ricette rimaste con il tag di un alimento:');
    riga('    ALIMENTO="sorgo soffiato" npm run diag:firme-allergeni');
    riga('');
    return;
  }

  /**
   * ⛔ **PARTE DUE: le ricette rimaste col tag di QUESTO alimento**, e per ognuna chi ha firmato e
   * quando rispetto al giorno in cui il tag è arrivato.
   */
  const registro = ((await prisma.auditLog.findMany({
    where: { action: AZIONE_TAG, entityType: 'recipe', createdAt: { gte: new Date(Date.now() - GIORNI * 86_400_000) } } as never,
    select: { entityId: true, metadata: true, createdAt: true } as never,
    orderBy: { createdAt: 'desc' } as never,
  })) as { entityId: string | null; metadata: unknown; createdAt: Date }[])
    .map((r) => ({
      recipeId: String(r.entityId ?? ''),
      createdAt: r.createdAt,
      alimenti: ((((r.metadata ?? {}) as { aggiunti?: unknown }).aggiunti ?? []) as { alimento: string }[])
        .map((a) => normalizzaNome(a.alimento)),
    }))
    .filter((r) => r.recipeId && r.alimenti.includes(ALIMENTO));

  if (!registro.length) {
    titolo(`NESSUN TAG RISULTA ARRIVATO DA «${ALIMENTO}»`);
    riga(`  ⚠️ Il nome deve essere quello scritto nel registro, e la finestra è di ${GIORNI} giorni.`);
    riga('  Per l\'elenco esatto degli alimenti:  npm run ritira:tag-alimento');
    riga('');
    return;
  }

  /** ⚠️ L'ultima volta che il tag è arrivato: se è tornato piu volte, conta la piu recente. */
  const taggata = new Map<string, Date>();
  for (const r of registro) {
    const c = taggata.get(r.recipeId);
    if (!c || r.createdAt.getTime() > c.getTime()) taggata.set(r.recipeId, r.createdAt);
  }
  const ids = [...taggata.keys()];

  const [ricette, firme, revisioniDiete] = await Promise.all([
    prisma.recipe.findMany({ where: { id: { in: ids } } as never, select: { id: true, name: true, allergensReviewed: true } as never }) as Promise<{ id: string; name: string; allergensReviewed: boolean }[]>,
    prisma.auditLog.findMany({ where: { action: AZIONE_A_MANO, entityType: 'recipe', entityId: { in: ids } } as never, select: { entityId: true, createdAt: true } as never }) as Promise<{ entityId: string | null; createdAt: Date }[]>,
    prisma.auditLog.findMany({ where: { action: AZIONE_MOTORE } as never, select: { entityId: true, createdAt: true } as never }) as Promise<{ entityId: string | null; createdAt: Date }[]>,
  ]);

  /**
   * ⚠️ **La revisione del motore firma una DIETA, non una ricetta**: per sapere quali ricette ha
   * toccato bisogna passare dai giorni della dieta. Senza questo passaggio una conferma umana vera
   * verrebbe contata come «nessuno», e il conto direbbe che c'è piu da recuperare di quanto ce n'è.
   */
  const perRicettaDalMotore = new Map<string, Date[]>();
  const dieteDiQuestoGiro = [...new Set(revisioniDiete.map((r) => String(r.entityId ?? '')).filter(Boolean))];
  if (dieteDiQuestoGiro.length) {
    const giorni = (await prisma.dietDayTemplate.findMany({
      where: { dietId: { in: dieteDiQuestoGiro } } as never,
      select: { dietId: true, meals: true } as never,
    })) as { dietId: string; meals: unknown }[];
    const ricetteDellaDieta = new Map<string, Set<string>>();
    for (const g of giorni) {
      const s = ricetteDellaDieta.get(g.dietId) ?? new Set<string>();
      for (const m of (Array.isArray(g.meals) ? g.meals : []) as { recipeId?: string }[]) if (m.recipeId) s.add(m.recipeId);
      ricetteDellaDieta.set(g.dietId, s);
    }
    for (const rev of revisioniDiete) {
      for (const rid of ricetteDellaDieta.get(String(rev.entityId ?? '')) ?? []) {
        if (taggata.has(rid)) perRicettaDalMotore.set(rid, [...(perRicettaDalMotore.get(rid) ?? []), rev.createdAt]);
      }
    }
  }

  const firmePerRicetta = new Map<string, Date[]>();
  for (const f of firme) {
    const id = String(f.entityId ?? '');
    firmePerRicetta.set(id, [...(firmePerRicetta.get(id) ?? []), f.createdAt]);
  }
  const capofila = new Map<string, Date[]>();
  for (const b of blocchi) {
    const id = String(b.entityId ?? '');
    if (taggata.has(id)) capofila.set(id, [...(capofila.get(id) ?? []), b.createdAt]);
  }

  const esiti = ricette.map((r) => {
    const t = taggata.get(r.id) as Date;
    const f: FirmeDiUnaRicetta = {
      recipeId: r.id,
      ricetta: r.name,
      taggata: t,
      firmePropria: [...(firmePerRicetta.get(r.id) ?? []), ...(perRicettaDalMotore.get(r.id) ?? [])],
      bloccoCerto: capofila.get(r.id) ?? [],
      bloccoDopoIlTag: blocchi.some((b) => b.createdAt.getTime() > t.getTime()),
      reviewed: r.allergensReviewed === true,
    };
    return chiHaFirmato(f);
  });

  const per: Record<string, number> = {};
  for (const e of esiti) per[e.verdetto] = (per[e.verdetto] ?? 0) + 1;

  titolo(`LE RICETTE CHE HANNO PRESO UN TAG DA «${ALIMENTO}» — ${esiti.length}`);
  for (const [v, n] of Object.entries(per).sort((a, b) => b[1] - a[1])) {
    riga(`  ${String(n).padStart(5)}  ${PAROLE_DEL_VERDETTO[v as Verdetto] ?? v}`);
  }

  const recuperabili = esiti.filter((e) => e.verdetto === 'firmata_prima_del_tag' || e.verdetto === 'nessuna_firma_nel_registro');
  riga('');
  riga(`  ▶️ Nessuno ha mai guardato quel tag su ${recuperabili.length} ricette di ${esiti.length}.`);
  riga('  ⚠️ È una MISURA, non un permesso: cosa farne lo decide una persona, non questo script.');

  if (recuperabili.length) {
    titolo(`QUALI — prime ${Math.min(TETTO_RIGHE, recuperabili.length)}`);
    for (const e of recuperabili.slice(0, TETTO_RIGHE)) {
      riga(`  · ${e.ricetta.slice(0, 52).padEnd(54)} tag ${quando(taggata.get(e.recipeId))}   firma ${quando(e.quando)}`);
    }
    if (recuperabili.length > TETTO_RIGHE) riga(`  …e altre ${recuperabili.length - TETTO_RIGHE}. RIGHE=100 per vederne di piu.`);
  }
  riga('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
