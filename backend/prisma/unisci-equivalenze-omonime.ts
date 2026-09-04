/**
 * UN NOME, UN GRUPPO — e i gruppi non sono più di una dieta.
 *
 * Decisione di Simone, 4/9: *«i gruppi NON devono essere legati alle diete, sono gruppi e stop»*, e
 * *«tutto in un gruppo solo, approvato»*. Questo script la applica ai dati che ci sono già.
 *
 * ⛔ **DI DEFAULT NON SCRIVE NIENTE.** Stampa cosa farebbe. Si scrive con `SCRIVI=1`, e prima si
 * guarda il tabulato — soprattutto le due sezioni che dicono quali alimenti mai riletti da nessuno
 * stanno per entrare nel motore.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run ripara:equivalenze-omonime               → la prova a vuoto
 *   ESEMPI=40 npm run ripara:equivalenze-omonime     → più righe di esempio (default 15)
 *   SCRIVI=1 npm run ripara:equivalenze-omonime      → scrive davvero
 *
 * ## Cosa fa, in ordine
 *
 * 1. Per ogni nome che compare più di una volta: tiene il gruppo **più vecchio** (è quello che oggi
 *    vince nella ricerca per nome), gli mette dentro l'elenco unito, lo rende **globale** e lo
 *    approva se almeno uno della famiglia era approvato.
 * 2. Le righe delle **sostituzioni promosse** che puntavano ai gruppi che spariscono si ripuntano
 *    al capofila **prima** di cancellarli. ⚠️ La colonna è `onDelete: SetNull`: senza questo passo
 *    non si romperebbe niente, sparirebbe solo la traccia di dove era finita quella promozione —
 *    che è esattamente il genere di perdita silenziosa che poi non si recupera.
 * 3. Alla fine **tutti** i gruppi rimasti diventano globali, omonimi o no.
 *
 * ⛔ **Le famiglie con due tabelle di pesi diverse NON si toccano**, e lo script le stampa: nessuna
 * pulizia può scegliere a caso fra due elenchi di grammi, perché uno dei due finirebbe nel piatto
 * di una persona senza che nessuno l'abbia deciso.
 */
import { PrismaClient } from '@prisma/client';
import {
  alimenti,
  membersMalformato,
  operazioniDiUnione,
  pianiDiUnione,
  type Gruppo,
} from '../src/catalog/gruppi-omonimi';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 15) || 15);
const SCRIVI = process.env.SCRIVI === '1';
/** Sopra questa soglia un elenco unito è così lungo che vale la pena guardarlo prima. */
const ELENCO_LUNGO = 40;

const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo(SCRIVI ? 'UNIONE DEI GRUPPI OMONIMI — SCRITTURA' : 'UNIONE DEI GRUPPI OMONIMI — prova a vuoto');

  const gruppi = (await prisma.equivalenceGroup.findMany({
    select: { id: true, name: true, productId: true, status: true, members: true, createdAt: true },
  })) as unknown as Gruppo[];

  const piani = pianiDiUnione(gruppi);
  const fatti = piani.filter((p) => !p.fermata.length);
  const fermi = piani.filter((p) => p.fermata.length);
  const spariscono = fatti.reduce((n, p) => n + p.daCancellare.length, 0);
  const diUnaDieta = gruppi.filter((g) => g.productId).length;

  riga('');
  riga(`  Gruppi in tabella                     ${String(gruppi.length).padStart(5)}`);
  riga(`  Legati a una dieta (diventano globali)${String(diUnaDieta).padStart(5)}`);
  riga(`  Nomi che compaiono più di una volta   ${String(piani.length).padStart(5)}`);
  riga(`  Righe che spariscono                  ${String(spariscono).padStart(5)}`);
  riga(`  Restano                               ${String(gruppi.length - spariscono).padStart(5)}`);
  riga(`  Famiglie ferme (pesi diversi)         ${String(fermi.length).padStart(5)}`);

  /**
   * ⛔ **I `members` CHE NON SONO UN OGGETTO** -- domanda della revisione del 4/9, e si risponde
   * misurando invece di supporre. La colonna e' `Json @default("[]")`: il valore di partenza e' una
   * **lista**. `alimenti()` sa leggerla e `membersDiPartenza()` non ci scrive sopra, ma il numero
   * va stampato lo stesso: se e' grande vuol dire che in tabella c'e' una forma che nessuno
   * ricordava, e prima di lanciare `SCRIVI=1` la si guarda.
   */
  const malformati = gruppi.filter((g) => membersMalformato(g.members));
  if (malformati.length) {
    riga('');
    riga(`  ⚠️ ${malformati.length} gruppi hanno un \`members\` che non è un oggetto (probabilmente il`);
    riga('     default `[]` della colonna). Vengono letti lo stesso e non ci si scrive sopra alla cieca;');
    riga(`     i primi: ${malformati.slice(0, 6).map((g) => `${g.id.slice(0, 8)} «${g.name}»`).join(' · ')}`);
  }

  /**
   * ⛔ **IL NUMERO CHE VA LETTO PER PRIMO.** «Approvato se almeno uno lo era» è la decisione di
   * Simone, e vuol dire che degli alimenti che nessuno ha mai riletto entrano nel motore. Quanti
   * siano non è un dettaglio: è la misura di quella decisione, e va stampata, non dedotta.
   */
  const perId = new Map(gruppi.map((g) => [g.id, g]));
  let gruppiPrimaInBozza = 0;
  let alimentiMaiApprovati = 0;
  for (const p of fatti) {
    if (p.status !== 'approved') continue;
    const eranoApprovati = new Set<string>();
    for (const id of [p.capofilaId, ...p.daCancellare]) {
      const g = perId.get(id);
      if (!g || g.status !== 'approved') continue;
      for (const a of alimenti(g.members)) eranoApprovati.add(a.trim().toLowerCase());
    }
    const nuovi = p.items.filter((a) => !eranoApprovati.has(a.trim().toLowerCase()));
    if (nuovi.length) {
      gruppiPrimaInBozza += 1;
      alimentiMaiApprovati += nuovi.length;
    }
  }
  if (alimentiMaiApprovati > 0) {
    riga('');
    riga(`  ⛔ ${alimentiMaiApprovati} alimenti che stavano SOLO in gruppi in bozza entrano in ${gruppiPrimaInBozza} gruppi approvati.`);
    riga('     È la decisione del 4/9 («tutto in un gruppo solo, approvato»), scritta qui perché si');
    riga('     veda quanto pesa: da quel momento il motore li può mettere nel piatto di una cliente.');
  }

  titolo(`SI UNISCONO — ${fatti.length} famiglie`);
  riga('');
  if (!fatti.length) riga('  (nessuna)');
  for (const p of fatti.slice(0, ESEMPI)) {
    riga(`  · «${p.nome}» — ${p.daCancellare.length + 1} gruppi → 1 (${p.status === 'approved' ? 'approvato' : 'bozza'}), ${p.items.length} alimenti (+${p.aggiunti})`);
    riga(`      ${p.items.slice(0, 8).join(', ')}${p.items.length > 8 ? ` … (+${p.items.length - 8})` : ''}`);
  }
  if (fatti.length > ESEMPI) riga(`  … e altre ${fatti.length - ESEMPI} (ESEMPI=${fatti.length} per vederle tutte)`);

  /**
   * ⚠️ **Gli elenchi che diventano lunghissimi**, stampati a parte. Un gruppo con settanta alimenti
   * dice al motore «questi settanta si scambiano fra loro», ed è una frase molto più grossa di
   * quella che c'era scritta in ognuno dei pezzi da cui nasce. Non li fermo — la decisione è di
   * unire — ma chi guarda deve poterli vedere prima.
   */
  const lunghi = fatti.filter((p) => p.items.length > ELENCO_LUNGO).sort((a, b) => b.items.length - a.items.length);
  if (lunghi.length) {
    titolo(`ELENCHI CHE DIVENTANO MOLTO LUNGHI — ${lunghi.length} sopra i ${ELENCO_LUNGO} alimenti`);
    riga('');
    riga('  ⚠️ Da qui in poi il gruppo dice «questi si scambiano tutti fra loro». Vale la pena');
    riga('  guardarli prima di approvarli, perché nessuno li ha mai letti insieme.');
    riga('');
    for (const p of lunghi.slice(0, ESEMPI)) {
      riga(`  · «${p.nome}» — ${p.items.length} alimenti da ${p.daCancellare.length + 1} gruppi (${p.status === 'approved' ? 'approvato' : 'bozza'})`);
    }
  }

  if (fermi.length) {
    titolo(`FERME — ${fermi.length} famiglie che questo script NON tocca`);
    riga('');
    for (const p of fermi.slice(0, ESEMPI)) {
      riga(`  · «${p.nome}» — ${p.daCancellare.length + 1} gruppi`);
      for (const m of p.fermata) riga(`      ⛔ ${m}`);
      riga('      Restano separate. ⚠️ Se sono approvate, la ricerca per nome continua a leggere solo la più vecchia.');
    }
  }

  /**
   * ⛔ **LE NOTE CHE NON ENTRANO NEI 300 CARATTERI si stampano per intero, QUI**, prima che i
   * gruppi che le portavano vengano cancellati. La nota è la provenienza di una regola: se non la
   * scrivo adesso, fra sei mesi non la ricostruisce nessuno.
   */
  const conNoteTagliate = fatti.filter((p) => p.note?.includes('nel log dell\'unione'));
  if (conNoteTagliate.length) {
    titolo(`LE NOTE PER INTERO — ${conNoteTagliate.length} famiglie in cui non ci stanno tutte`);
    for (const p of conNoteTagliate) {
      riga('');
      riga(`  · «${p.nome}»`);
      for (const id of [p.capofilaId, ...p.daCancellare]) {
        const nota = String((perId.get(id)?.members as { note?: unknown } | null)?.note ?? '').trim();
        if (nota) riga(`      ${id.slice(0, 8)}  ${nota}`);
      }
    }
  }

  if (!SCRIVI) {
    riga('');
    riga('==================================================================');
    riga('  Prova a vuoto: non è stato scritto niente. `SCRIVI=1` per farlo davvero.');
    riga('==================================================================');
    riga('');
    return;
  }

  titolo('SCRITTURA');
  for (const p of fatti) {
    const ops = operazioniDiUnione(p, perId.get(p.capofilaId)?.members);
    const esito = await prisma.$transaction(async (tx) => {
      /**
       * ⚠️ **Prima si ripunta, poi si cancella.** `FoodSwap.promossaGruppoId` e' `onDelete:
       * SetNull`: cancellando per primo non si romperebbe niente, sparirebbe solo la traccia di
       * dove quella promozione era finita -- ed e' l'unica cosa che, fra sei mesi, dice perche'
       * quella regola esiste.
       */
      const ripuntate = await tx.foodSwap.updateMany({
        where: { promossaGruppoId: { in: ops.ripunta.da } },
        data: { promossaGruppoId: ops.ripunta.a },
      });
      await tx.equivalenceGroup.update({
        where: { id: ops.aggiorna.id },
        data: { members: ops.aggiorna.members as never, status: ops.aggiorna.status, productId: ops.aggiorna.productId },
      });
      const tolti = await tx.equivalenceGroup.deleteMany({ where: { id: { in: ops.cancella } } });
      return { ripuntate: ripuntate.count, tolti: tolti.count };
    });
    conti.unite += 1;
    conti.cancellati += esito.tolti;
    conti.righeRipuntate += esito.ripuntate;
  }

  /** ⚠️ Anche i nomi unici e le famiglie ferme: «i gruppi non sono legati alle diete» vale per tutti. */
  const globalizzati = await prisma.equivalenceGroup.updateMany({
    where: { productId: { not: null } },
    data: { productId: null },
  });
  conti.globalizzati = globalizzati.count;
  conti.finito = true;
}

/**
 * ⛔ **I CONTI VIVONO FUORI DA `main`, e si stampano ANCHE SE CREPA** -- rilievo della revisione
 * del 4/9. Un errore alla famiglia numero 900 su 1200 usciva da `main().catch()` stampando solo lo
 * stack: nessuno sapeva quante ne erano state fuse davvero, e la `updateMany` finale non era mai
 * girata. Il database restava in uno stato misto che il tabulato non descriveva -- cioe' il
 * registro cominciava a mentire, che e' il difetto che questo progetto teme di piu'.
 */
const conti = { unite: 0, cancellati: 0, righeRipuntate: 0, globalizzati: 0, finito: false };

function stampaConti() {
  riga('');
  riga(`  Famiglie unite                        ${String(conti.unite).padStart(5)}`);
  riga(`  Gruppi cancellati                     ${String(conti.cancellati).padStart(5)}`);
  riga(`  Righe di sostituzione ripuntate       ${String(conti.righeRipuntate).padStart(5)}`);
  riga(`  Gruppi resi globali                   ${String(conti.globalizzati).padStart(5)}`);
  riga('');
  riga('==================================================================');
  riga(conti.finito
    ? '  Fatto. ⚠️ Le famiglie ferme qui sopra restano da guardare a mano.'
    : '  ⛔ INTERROTTO A META\'. I numeri qui sopra sono quello che è stato scritto davvero:\n' +
      '     le famiglie non elencate sono ancora da unire, e i gruppi NON sono stati resi globali.\n' +
      '     Si può rilanciare: quello che è già stato unito non ha più omonimi e viene saltato.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    if (SCRIVI) stampaConti();
    await prisma.$disconnect();
  });
