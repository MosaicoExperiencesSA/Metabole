/**
 * ⛔ **RITIRA I TAG CHE UNA RIGA DELLA TABELLA ALIMENTI HA MESSO SULLE RICETTE.**
 *
 * È il gesto inverso dell'agente alimenti, e serve per una ragione precisa: Simone, il 5/9, ha
 * deciso che le righe scritte dall'agente **valgono subito** — gli allergeni che l'AI mette su un
 * alimento arrivano alle ricette la notte stessa. Il costo dichiarato di quella decisione è che un
 * allergene sbagliato, una volta propagato, resta anche dopo che la riga è stata corretta. Senza il
 * gesto inverso, «valgono subito» diventa «valgono per sempre».
 *
 * ⚠️ Non indovina niente: legge il **registro** della propagazione
 * (`catalog.recipe.allergens.dalla_tabella`, una riga per ricetta con allergene, ingrediente e
 * alimento di origine) e ricostruisce cosa era stato aggiunto **da quell'alimento**. Il giudizio sta
 * in `src/nutrient-facts/ritira-i-tag.ts`, con le sue prove.
 *
 * ⛔ **Cosa NON toglie, e sono le quattro cose che contano**: un tag che la ricetta avrebbe comunque
 * dalla deduzione sulle parole (toglierlo sarebbe un falso negativo addosso a chi ha quell'allergia);
 * un tag che **un altro alimento** della tabella giustifica ancora (le lasagne con besciamella *e*
 * pesto: il registro ne segna uno solo); un tag su una ricetta che qualcuno ha guardato, una per una
 * o spuntata in blocco; e non tocca mai `allergensReviewed`.
 *
 * ⛔ **Prima si corregge la riga, poi si ritira.** Se la riga in tabella dichiara ancora quegli
 * allergeni, la propagazione notturna li rimette dov'erano e il gesto è stato inutile: lo script si
 * ferma e lo dice, invece di lasciare che qualcuno lo scopra il giorno dopo.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *     ALIMENTO="pesto pronto" npm run ritira:tag-alimento              → sola lettura
 *     ALIMENTO="pesto pronto" CONFERMA=1 npm run ritira:tag-alimento   → scrive
 *     npm run ritira:tag-alimento                                      → elenca gli alimenti che hanno propagato
 */
import { PrismaClient } from '@prisma/client';
import { allergenLabel, suggestAllergens } from '../src/catalog/allergens';
import { AZIONE_TAG, tagDallaTabella } from '../src/nutrient-facts/agente-alimenti';
import { allergeniDopoIlRitiro, tagDaRitirare, type RicettaOggi, type RigaDiRegistro } from '../src/nutrient-facts/ritira-i-tag';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const SCRIVE = process.env.CONFERMA === '1';
/**
 * ⚠️ Il confronto è sul nome **normalizzato** da tutte e due le parti: il registro scrive il nome
 * grezzo della riga in tabella, e un solo carattere maiuscolo avrebbe fatto rispondere «nessun tag
 * risulta arrivato da questo alimento» — una rassicurazione sbagliata proprio sul gesto che si sta
 * cercando di fare.
 */
const ALIMENTO = normalizzaNome(process.env.ALIMENTO ?? '');
const TETTO_RIGHE = Math.max(1, Number(process.env.RIGHE ?? 20) || 20);
const GIORNI = Math.max(1, Number(process.env.GIORNI ?? 180) || 180);
const TETTO_REGISTRO = 200_000;
const FORZA = process.env.FORZA === '1';
const AZIONE_A_MANO = 'catalog.recipe.allergens.set';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => { riga(''); riga('──────────────────────────────────────────────────────────────────'); riga(`  ${s}`); riga('──────────────────────────────────────────────────────────────────'); };

async function main(): Promise<void> {
  riga('');
  riga('==================================================================');
  riga('  RITIRA I TAG MESSI DA UNA RIGA DELLA TABELLA ALIMENTI');
  riga(SCRIVE ? '  ⛔ CONFERMA=1: questo giro SCRIVE.' : '  Sola lettura. Per scrivere: CONFERMA=1');
  riga('==================================================================');

  /**
   * ⚠️ Una finestra, non «tutto»: la propagazione scrive una riga **per ricetta** ogni notte in cui
   * aggiunge qualcosa, e senza tetto questa lettura cresce senza fine dentro una shell di Render.
   * `GIORNI=…` la allarga quando serve risalire più indietro.
   */
  const registro = ((await prisma.auditLog.findMany({
    where: {
      action: AZIONE_TAG,
      entityType: 'recipe',
      createdAt: { gte: new Date(Date.now() - GIORNI * 86_400_000) },
    } as never,
    select: { entityId: true, metadata: true } as never,
    orderBy: { createdAt: 'desc' } as never,
    take: TETTO_REGISTRO,
  })) as { entityId: string | null; metadata: unknown }[])
    .map((r) => ({
      recipeId: String(r.entityId ?? ''),
      aggiunti: ((((r.metadata ?? {}) as { aggiunti?: unknown }).aggiunti ?? []) as RigaDiRegistro['aggiunti'])
        .map((a) => ({ ...a, alimento: normalizzaNome(a.alimento) })),
    }))
    .filter((r) => r.recipeId && Array.isArray(r.aggiunti));

  if (!registro.length) {
    riga('');
    riga('  Il registro della propagazione è vuoto: nessun tag è mai arrivato dalla tabella alimenti.');
    riga('  (L\'agente scrive questa riga solo quando aggiunge davvero qualcosa.)');
    riga('');
    return;
  }

  /**
   * ⚠️ **Senza `ALIMENTO` non si sceglie per conto di nessuno**: si stampa cosa c'è, e chi legge
   * decide. Un comando che «ripara tutto» su un dato clinico è il modo di fare un danno grande con
   * un gesto piccolo.
   */
  if (!ALIMENTO) {
    const per = new Map<string, { ricette: Set<string>; allergeni: Set<string> }>();
    for (const r of registro) {
      for (const a of r.aggiunti) {
        const p = per.get(a.alimento) ?? { ricette: new Set<string>(), allergeni: new Set<string>() };
        p.ricette.add(r.recipeId);
        p.allergeni.add(a.allergen);
        per.set(a.alimento, p);
      }
    }
    titolo(`GLI ALIMENTI CHE HANNO PROPAGATO — ${per.size}`);
    for (const [alimento, p] of [...per.entries()].sort((a, b) => b[1].ricette.size - a[1].ricette.size)) {
      riga(`  · ${alimento.padEnd(40)} ${String(p.ricette.size).padStart(5)} ricette   [${[...p.allergeni].join(', ')}]`);
    }
    riga('');
    riga('  Per vedere cosa si toglierebbe:  ALIMENTO="nome esatto" npm run ritira:tag-alimento');
    riga('');
    return;
  }

  const ids = [...new Set(registro.flatMap((r) => (r.aggiunti.some((a) => a.alimento === ALIMENTO) ? [r.recipeId] : [])))];
  if (!ids.length) {
    riga('');
    riga(`  Nessun tag risulta arrivato da «${ALIMENTO}». ⚠️ Il nome deve essere quello scritto nel registro:`);
    riga('  lancia il comando senza ALIMENTO per vedere l\'elenco esatto.');
    riga('');
    return;
  }

  const ricette = (await prisma.recipe.findMany({
    where: { id: { in: ids } } as never,
    select: { id: true, name: true, ingredients: true, allergens: true, allergensReviewed: true } as never,
  })) as unknown as { id: string; name: string; ingredients: unknown; allergens: string[]; allergensReviewed: boolean }[];
  const aMano = new Set(((await prisma.auditLog.findMany({
    where: { action: AZIONE_A_MANO, entityType: 'recipe', entityId: { in: ids } } as never,
    select: { entityId: true } as never,
  })) as { entityId: string | null }[]).map((x) => String(x.entityId ?? '')));

  /**
   * ⛔ **LA RIGA CHE SI STA DISFACENDO, GUARDATA PRIMA DI TOCCARE LE RICETTE** (revisione del 5/9).
   * Il ritiro è il gesto che si fa **dopo** aver corretto la riga: se in tabella dichiara ancora
   * quegli allergeni, la propagazione di stanotte li rimette tutti, il tabulato avrà detto «✅ 340
   * ricette aggiornate» e la mattina dopo non sarà cambiato niente — con il registro nel frattempo
   * raddoppiato. Ci si ferma qui, e si dice cosa fare.
   */
  const rigaInTabella = (await prisma.nutrientFact.findFirst({
    where: { name: ALIMENTO } as never,
    select: { name: true, allergens: true } as never,
  })) as { name: string; allergens: string[] } | null;

  /**
   * ⛔ **QUELLO CHE LA TABELLA DIREBBE SENZA DI LUI.** `tagDallaTabella` deduplica per ricetta: se
   * due ingredienti portano lo stesso allergene, il registro ne ha memorizzato **uno solo**. Le
   * lasagne con besciamella pronta e pesto pronto — tutte e due dichiarate `latte` — hanno nel
   * registro il solo pesto, e nessuna delle due parole sta nel vocabolario: senza questo conto,
   * disfare il pesto toglierebbe `latte` a un piatto che la besciamella ce l'ha dentro.
   */
  const altreRighe = ((await prisma.nutrientFact.findMany({
    where: { NOT: { allergens: { isEmpty: true } } } as never,
    select: { name: true, synonyms: true, allergens: true } as never,
  })) as unknown as { name: string; synonyms: string[]; allergens: string[] }[])
    .filter((r) => normalizzaNome(r.name) !== ALIMENTO)
    .map((r) => ({ name: r.name, synonyms: r.synonyms ?? [], allergens: r.allergens ?? [] }));
  const daAltri = new Map<string, string[]>();
  for (const t of tagDallaTabella(
    ricette.map((r) => ({ id: r.id, name: r.name, ingredients: r.ingredients, allergens: [] })),
    altreRighe,
  )) {
    daAltri.set(t.recipeId, [...(daAltri.get(t.recipeId) ?? []), t.allergen]);
  }

  const mappa = new Map<string, RicettaOggi>();
  for (const r of ricette) {
    mappa.set(r.id, {
      id: r.id,
      name: r.name,
      allergens: r.allergens ?? [],
      /** ⛔ Quello che la deduzione sulle parole direbbe **oggi**, senza la riga in tabella. */
      dedottoDalleParole: suggestAllergens(r.ingredients).map((a) => a.allergen),
      datoDaAltri: daAltri.get(r.id) ?? [],
      /**
       * ⚠️ `allergensReviewed` vale come una conferma a mano: la spunta **in blocco** scrive una
       * riga di registro sola per tutto il blocco, quindi le ricette confermate così non hanno un
       * `catalog.recipe.allergens.set` loro e sembrerebbero mai guardate.
       */
      toccataAMano: aMano.has(r.id) || r.allergensReviewed === true,
    });
  }

  const esito = tagDaRitirare(ALIMENTO, registro, mappa);

  titolo('I NUMERI');
  riga(`  Alimento                                     ${ALIMENTO}`);
  riga(`  Ricette che avevano preso un tag da lui      ${String(ids.length).padStart(6)}`);
  riga(`  ⛔ Tag da ritirare                            ${String(esito.daRitirare.length).padStart(6)}  su ${esito.ricette} ricette`);
  riga(`  ⚠️ Tag che restano                            ${String(esito.tenuti.length).padStart(6)}`);

  if (esito.tenuti.length) {
    const per: Record<string, number> = {};
    for (const t of esito.tenuti) per[t.perche] = (per[t.perche] ?? 0) + 1;
    titolo('PERCHÉ RESTANO — e nessuno di questi è un errore');
    const PAROLE: Record<string, string> = {
      dedotto_dalle_parole: 'la ricetta lo avrebbe comunque dai suoi ingredienti (toglierlo sarebbe un falso negativo)',
      dato_da_un_altro_alimento: 'un altro alimento della tabella dà ancora quell\'allergene a quella ricetta',
      toccata_a_mano: 'qualcuno ha guardato i tag di quella ricetta: quello che c\'è scritto è suo',
      non_c_e_piu: 'il tag su quella ricetta non c\'è già più',
    };
    for (const [k, n] of Object.entries(per)) riga(`  · ${String(n).padStart(5)}  ${PAROLE[k] ?? k}`);
  }

  if (esito.daRitirare.length) {
    titolo(`COSA SI TOGLIE — prime ${Math.min(TETTO_RIGHE, esito.daRitirare.length)}`);
    for (const t of esito.daRitirare.slice(0, TETTO_RIGHE)) {
      riga(`  · ${t.ricetta.slice(0, 60).padEnd(62)} − ${t.label} (${t.ingrediente})`);
    }
    if (esito.daRitirare.length > TETTO_RIGHE) riga(`  …e altri ${esito.daRitirare.length - TETTO_RIGHE}. RIGHE=100 per vederne di più.`);
  }

  /**
   * ⛔ **LA RIGA IN TABELLA DEVE ESSERE GIÀ STATA CORRETTA**, altrimenti stanotte torna tutto com'era.
   */
  const ancoraDichiarati = (rigaInTabella?.allergens ?? [])
    .filter((a) => esito.daRitirare.some((t) => t.allergen === a));
  if (ancoraDichiarati.length && !FORZA) {
    titolo('⛔ FERMI: LA RIGA IN TABELLA DICE ANCORA QUEGLI ALLERGENI');
    riga(`  «${rigaInTabella?.name}» dichiara: ${ancoraDichiarati.map((a) => allergenLabel(a)).join(', ')}`);
    riga('');
    riga('  Togliere i tag adesso non serve a niente: la propagazione di stanotte li rimette tutti.');
    riga('  Prima si corregge la riga (pagina Valori nutrizionali → allergeni), poi si rilancia questo.');
    riga('  Se sai quello che stai facendo:  FORZA=1');
    riga('');
    return;
  }

  if (!SCRIVE) {
    riga('');
    riga(`  Fine. Niente è stato scritto. Per applicare:  ALIMENTO="${ALIMENTO}" CONFERMA=1 npm run ritira:tag-alimento`);
    riga('');
    return;
  }

  titolo('SCRITTURA');
  const perRicetta = new Map<string, typeof esito.daRitirare>();
  for (const t of esito.daRitirare) perRicetta.set(t.recipeId, [...(perRicetta.get(t.recipeId) ?? []), t]);
  /**
   * ⚠️ **A blocchi, e ogni blocco è una transazione**: su un alimento usato da mille ricette erano
   * duemila andate e ritorni in fila da una shell, e una caduta a metà non lasciava nessun conto di
   * cosa era stato scritto. Il progresso si stampa mentre va, non alla fine.
   */
  const BLOCCO = 50;
  const lavoro = [...perRicetta.entries()].filter(([id]) => mappa.has(id));
  let scritte = 0;
  for (let i = 0; i < lavoro.length; i += BLOCCO) {
    const fetta = lavoro.slice(i, i + BLOCCO);
    await prisma.$transaction(fetta.flatMap(([id, tolti]) => {
      const r = mappa.get(id) as RicettaOggi;
      return [
        prisma.recipe.update({
          where: { id },
          data: { allergens: allergeniDopoIlRitiro(id, r.allergens, tolti) } as never,
        }),
        prisma.auditLog.create({
          data: {
            action: 'catalog.recipe.allergens.ritirati',
            entityType: 'recipe',
            entityId: id,
            metadata: { alimento: ALIMENTO, tolti: tolti.map((t) => t.allergen) },
          } as never,
        }),
      ];
    }));
    for (const [id, tolti] of fetta) {
      scritte += 1;
      if (scritte <= TETTO_RIGHE) riga(`  · ${(mappa.get(id) as RicettaOggi).name.slice(0, 60)}: − ${tolti.map((t) => t.label).join(', ')}`);
    }
    riga(`  … ${scritte} / ${lavoro.length}`);
  }
  riga('');
  riga(`  ✅ ${scritte} ricette aggiornate. ⚠️ La spunta di conferma non è stata toccata.`);
  riga('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
