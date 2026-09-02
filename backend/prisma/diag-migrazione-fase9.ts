/**
 * LE VENTI PERSONE DELLA FASE 9 — è andata come doveva? Sola lettura.
 *
 * ⛔ **Nasce da una cosa che ho rifiutato di fare.** Il 2/9 Simone ha chiesto di migrarle con uno
 * script. Non si può: cambiare `dietFamily` da fuori salta `buildPersonalBase`, e la base personale
 * — quella da cui Vera pesca quando una cliente chiede di cambiare un piatto in chat — resterebbe
 * sulla famiglia vecchia. E «bloccare» un piano non è un campo, è una **decisione**: `planHeldAt`
 * più il motivo e chi l'ha presa, che finisce nel registro.
 *
 * ⚠️ Quindi la migrazione si fa a mano, dalle schede. E questo tabulato è l'altra metà: dice se è
 * andata, invece di lasciarlo sperare. **Sa cosa doveva succedere** e confronta con quello che c'è.
 *
 * ⛔ **La base personale è la riga che nessuno guarderebbe.** Il certificato di personalizzazione
 * ha una data: se è più VECCHIO dell'ultima modifica del profilo, quella cliente ha la famiglia
 * nuova e il pool dei cambi ancora sulla vecchia. Non si vede da nessuna parte, e in chat esce come
 * «Vera mi propone piatti strani».
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:fase9
 */
import { PrismaClient } from '@prisma/client';
import { FAMIGLIE_CHE_SPARISCONO } from '../src/catalog/appartenenza-panieri';
import { GIORNATA_CINQUE, slotDaCuiPescare } from '../src/common/slot-pasto';

const prisma = new PrismaClient();
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

interface Attesa {
  /** ⚠️ Gli otto caratteri che si leggono nei tabulati: nessuno ha mai copiato un uuid intero. */
  id8: string;
  nome: string;
  daFamiglia: string;
  aFamiglia: string;
  /** Le quattro che la nutrizionista ferma dopo averle spostate. */
  daBloccare?: true;
}

/**
 * ⛔ **L'elenco è quello del 2/9, con le destinazioni decise da Simone.** Sta scritto qui perché un
 * controllo che non sa cosa doveva succedere può solo dire «ecco lo stato», e lo stato da solo non
 * dice se è andata.
 */
const ATTESE: readonly Attesa[] = [
  { id8: 'fa15497b', nome: 'Rosa', daFamiglia: 'Mediterranea senza glutine', aFamiglia: 'Mediterranea' },
  { id8: '88577c61', nome: 'Arianna', daFamiglia: 'Mediterranea senza glutine', aFamiglia: 'Mediterranea' },
  { id8: 'df86c95e', nome: 'Carla', daFamiglia: 'Mediterranea ipocalorica', aFamiglia: 'Mediterranea' },
  { id8: '34d612e2', nome: 'Francesco', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: '41c1d391', nome: 'Ilaria', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: '51a36b77', nome: 'Mimma', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: '6d87cf3d', nome: 'Elisabetta', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: '7979cad2', nome: 'Simona', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: '577a5082', nome: 'Patrizia', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: '890b7267', nome: 'Anna Lisa', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: '2f8c08c9', nome: 'Gioia', daFamiglia: 'Flexitariana', aFamiglia: 'Flessibile' },
  { id8: 'df6d39bf', nome: 'Patricia', daFamiglia: 'Pescetariana', aFamiglia: 'DASH (anti-ipertensiva)' },
  { id8: '80f4b9a3', nome: 'Dany', daFamiglia: 'Pescetariana', aFamiglia: 'DASH (anti-ipertensiva)' },
  { id8: '9b666315', nome: 'Jolanda', daFamiglia: 'Pescetariana', aFamiglia: 'DASH (anti-ipertensiva)' },
  { id8: '26603451', nome: 'Emanuela', daFamiglia: 'Pescetariana', aFamiglia: 'DASH (anti-ipertensiva)' },
  { id8: 'f23e42ae', nome: 'Monica Malpeli', daFamiglia: 'Ritorno in Equilibrio', aFamiglia: 'Mediterranea', daBloccare: true },
  { id8: '10ca078a', nome: 'Rosaria', daFamiglia: 'Vacanze in Serenità', aFamiglia: 'Mediterranea', daBloccare: true },
  { id8: '5bf297fa', nome: 'Davide', daFamiglia: 'Vegana', aFamiglia: 'Mediterranea', daBloccare: true },
  { id8: '8558977e', nome: 'Antonella', daFamiglia: 'Digiuno intermittente (16:8)', aFamiglia: 'Mediterranea', daBloccare: true },
];

/** ⚠️ `44ce5fc5 test` non è in elenco: è un account di prova, e contarlo falserebbe i venti. */

async function main() {
  titolo('FASE 9 — le venti persone: è andata come doveva?');

  const [profili, panieri, righe, ricette, certificati] = await Promise.all([
    prisma.clientProfile.findMany({
      select: {
        userId: true, name: true, dietFamily: true, regime: true, updatedAt: true,
        planHeldAt: true, planHeldReason: true,
      },
    }) as unknown as Promise<{
      userId: string; name: string | null; dietFamily: string | null; regime: string | null;
      updatedAt: Date; planHeldAt: Date | null; planHeldReason: string | null;
    }[]>,
    prisma.paniere.findMany({ select: { id: true, famiglia: true, regime: true } }) as unknown as
      Promise<{ id: string; famiglia: string; regime: string }[]>,
    prisma.paniereRicetta.findMany({ select: { paniereId: true, recipeId: true, slot: true } }) as unknown as
      Promise<{ paniereId: string; recipeId: string; slot: string }[]>,
    prisma.recipe.findMany({ where: { active: true }, select: { id: true } }) as unknown as Promise<{ id: string }[]>,
    prisma.personalizationCertificate.findMany({ select: { clientId: true, createdAt: true } }) as unknown as
      Promise<{ clientId: string; createdAt: Date }[]>,
  ]);

  const attive = new Set(ricette.map((r) => r.id));
  const idDi = new Map(panieri.map((p) => [`${p.famiglia}|${p.regime}`, p.id]));
  const perPaniere = new Map<string, Map<string, Set<string>>>();
  for (const r of righe) {
    if (!attive.has(r.recipeId)) continue;
    const slots = perPaniere.get(r.paniereId) ?? new Map<string, Set<string>>();
    const set = slots.get(r.slot) ?? new Set<string>();
    set.add(r.recipeId);
    slots.set(r.slot, set);
    perPaniere.set(r.paniereId, slots);
  }
  /** ⚠️ L'ULTIMO certificato per cliente: quello vecchio non dice niente sulla migrazione di oggi. */
  const ultimoCertificato = new Map<string, Date>();
  for (const c of certificati) {
    const gia = ultimoCertificato.get(c.clientId);
    if (!gia || c.createdAt > gia) ultimoCertificato.set(c.clientId, c.createdAt);
  }

  const perSlot = (famiglia: string, regime: string): string => {
    const id = idDi.get(`${famiglia}|${regime}`);
    const slots = id ? perPaniere.get(id) ?? new Map<string, Set<string>>() : new Map<string, Set<string>>();
    /** ⚠️ Gemelli uniti (Fase 2): è come li vede la cliente. */
    return GIORNATA_CINQUE.map((sl) => {
      const s = new Set<string>();
      for (const g of slotDaCuiPescare(sl)) for (const rid of slots.get(g) ?? []) s.add(rid);
      return `${sl.slice(0, 4)}=${s.size}`;
    }).join(' ');
  };

  let fatte = 0;
  let daFare = 0;
  const baseVecchia: string[] = [];
  const senzaBlocco: string[] = [];

  for (const a of ATTESE) {
    const p = profili.find((x) => x.userId.startsWith(a.id8));
    riga('');
    if (!p) { riga(`  ⛔ ${a.id8}  ${a.nome} — PROFILO NON TROVATO.`); continue; }
    const arrivata = (p.dietFamily ?? '') === a.aFamiglia;
    const ferma = (p.dietFamily ?? '') === a.daFamiglia;
    if (arrivata) fatte += 1; else daFare += 1;
    riga(`  ${arrivata ? '✅' : ferma ? '·' : '⚠️'} ${a.id8}  ${(p.name ?? a.nome).padEnd(16)} «${p.dietFamily ?? '(vuota)'}»`);
    if (!arrivata) {
      riga(`       ${ferma ? 'ancora da spostare' : '⚠️ NON è né dove stava né dove doveva andare'} → attesa: «${a.aFamiglia}»`);
      continue;
    }
    const rg = p.regime ?? '(vuoto)';
    riga(`       pesca da: ${a.aFamiglia} × ${rg}   ${perSlot(a.aFamiglia, rg)}`);
    /**
     * ⛔ **La riga che nessuno guarderebbe.** Certificato più vecchio dell'ultima modifica del
     * profilo = famiglia nuova, pool dei cambi in chat ancora sulla vecchia.
     */
    const cert = ultimoCertificato.get(p.userId);
    if (!cert) { riga('       ⛔ BASE PERSONALE MAI COSTRUITA: i cambi in chat non hanno da dove pescare.'); baseVecchia.push(a.nome); }
    else if (cert < p.updatedAt) {
      riga(`       ⛔ BASE PERSONALE VECCHIA (${cert.toISOString().slice(0, 10)}, profilo ${p.updatedAt.toISOString().slice(0, 10)}):`);
      riga('          i menu vengono dalla famiglia nuova, i cambi in chat dalla vecchia.');
      baseVecchia.push(a.nome);
    } else riga(`       base personale rifatta il ${cert.toISOString().slice(0, 10)} ✅`);
    if (a.daBloccare) {
      if (p.planHeldAt) riga(`       piano fermo dal ${p.planHeldAt.toISOString().slice(0, 10)} — «${p.planHeldReason ?? 'senza motivo scritto'}»`);
      else { riga('       ⛔ DOVEVA ESSERE BLOCCATA e non lo è: sta ricevendo menu.'); senzaBlocco.push(a.nome); }
    }
  }

  titolo('IL CONTO');
  riga('');
  riga(`  Spostate       ${fatte} su ${ATTESE.length}`);
  riga(`  Da fare        ${daFare}`);
  if (baseVecchia.length) {
    riga('');
    riga(`  ⛔ Base personale da rifare: ${baseVecchia.join(', ')}.`);
    riga('  Si rifà da sé riaprendo la scheda e risalvando la dieta — è `updateProfile` che la chiama.');
  }
  if (senzaBlocco.length) {
    riga('');
    riga(`  ⛔ Da bloccare e non bloccate: ${senzaBlocco.join(', ')}.`);
  }
  if (!daFare && !baseVecchia.length && !senzaBlocco.length) {
    riga('');
    riga('  ✅ Tutte e venti a posto: famiglia, base personale e blocchi.');
  }

  titolo('E CHI RESTA SULLE FAMIGLIE CHE SI CHIUDONO');
  riga('');
  const chiude = new Set(Object.keys(FAMIGLIE_CHE_SPARISCONO));
  const rimasti = profili.filter((p) => p.dietFamily && chiude.has(p.dietFamily));
  riga(`  Profili ancora su una famiglia da chiudere: ${rimasti.length}`);
  for (const p of rimasti) riga(`  · ${p.userId.slice(0, 8)}  ${(p.name ?? '—').padEnd(16)} «${p.dietFamily}»`);
  riga('');
  riga('  ⚠️ Qui possono comparire persone che non sono fra le venti: sono clienti nuove arrivate');
  riga('  dopo il censimento, e vanno guardate come le altre.');
  riga('');
  riga('  Fine. Niente è stato scritto.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
