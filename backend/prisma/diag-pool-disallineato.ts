/**
 * LE CLIENTI IL CUI POOL PIÙ RECENTE NON È QUELLO DELLA DIETA CHE SEGUONO — sola lettura.
 *
 * ⛔ **Il difetto, corretto il 2/9 e in produzione fino a quel giorno.** `buildPersonalBase`
 * numerava le versioni del pool per la coppia **(cliente, dieta)**, mentre tutti e quattro i suoi
 * lettori cercano per **sola cliente** e prendono la versione più alta:
 *
 * · `getStatus` — lo stato che vede la cliente nell'app;
 * · `sostituzione-chat.candidatiPerSlot` — il cambio di piatto in chat;
 * · `vera-chat.poolDellaCliente` — la giornata dettata dalla nutrizionista;
 * · la verifica del certificato, che cerca `{ clientId, version }`.
 *
 * Una cliente con quattro ricostruzioni sulla dieta vecchia (v1…v4) spostata su una famiglia nuova
 * otteneva un pool **v1**: i lettori continuavano a pescare il **v4 della dieta vecchia**. Cioè il
 * cambio di piatto in chat le proponeva piatti scelti sulla dieta che non segue più.
 *
 * ⚠️ **La correzione non ripara il passato da sola.** Le righe già scritte restano dove sono: una
 * cliente disallineata torna a posto alla **prima ricostruzione** — cioè quando qualcuno riapre la
 * sua scheda e risalva, o quando lei cambia qualcosa dall'app. Questo tabulato dice **quante sono**
 * e **chi**, così si sa se è un pomeriggio di lavoro o tre nomi.
 *
 * ⛔ **NON SCRIVE NIENTE.**
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:pool-disallineato
 *   ESEMPI=60 npm run diag:pool-disallineato   (default 25)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 25) || 25);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('IL POOL PIÙ RECENTE È QUELLO DELLA DIETA CHE SEGUE? — sola lettura');

  const [pool, profili, diete] = await Promise.all([
    prisma.clientMenuPool.findMany({
      select: { clientId: true, dietId: true, version: true, createdAt: true },
      orderBy: { version: 'desc' },
    }) as unknown as Promise<{ clientId: string; dietId: string; version: number; createdAt: Date }[]>,
    prisma.clientProfile.findMany({
      select: { userId: true, name: true, dietFamily: true, regime: true, updatedAt: true },
    }) as unknown as Promise<{ userId: string; name: string | null; dietFamily: string | null; regime: string | null; updatedAt: Date }[]>,
    prisma.diet.findMany({ select: { id: true, name: true } }) as unknown as
      Promise<{ id: string; name: string }[]>,
  ]);

  const nomeDieta = new Map(diete.map((d) => [d.id, d.name]));
  const profiloDi = new Map(profili.map((p) => [p.userId, p]));

  /**
   * ⚠️ **Si guarda quello che i lettori leggono**, non quello che il database contiene: il pool con
   * la versione più alta per cliente. È l'unico modo di misurare il difetto — un conteggio delle
   * righe direbbe che ci sono tutte, ed è vero e inutile.
   */
  const vincente = new Map<string, { dietId: string; version: number; createdAt: Date }>();
  const quanti = new Map<string, number>();
  const piuRecente = new Map<string, { dietId: string; createdAt: Date }>();
  for (const p of pool) {
    quanti.set(p.clientId, (quanti.get(p.clientId) ?? 0) + 1);
    const v = vincente.get(p.clientId);
    if (!v || p.version > v.version) vincente.set(p.clientId, p);
    const r = piuRecente.get(p.clientId);
    if (!r || p.createdAt > r.createdAt) piuRecente.set(p.clientId, p);
  }

  riga('');
  riga(`  Clienti con almeno un pool          ${String(vincente.size).padStart(5)}`);
  riga(`  Righe di pool in tutto              ${String(pool.length).padStart(5)}`);

  /**
   * ⛔ **Disallineata = il pool che vince per versione NON è il più recente per data.** È esatta:
   * dice che una ricostruzione più nuova esiste e non la legge nessuno. ⚠️ Non si confronta con la
   * dieta del profilo, perché `pickDietFor` ha una scala di ripieghi e la dieta servita può essere
   * legittimamente diversa da quella che il nome della famiglia farebbe pensare.
   */
  const rotte: { clientId: string; vince: string; recente: string; quando: Date }[] = [];
  for (const [clientId, v] of vincente) {
    const r = piuRecente.get(clientId)!;
    if (v.dietId !== r.dietId) {
      rotte.push({ clientId, vince: v.dietId, recente: r.dietId, quando: r.createdAt });
    }
  }

  riga('');
  if (rotte.length === 0) {
    riga('  ✅ NESSUNA cliente disallineata: per tutte, il pool più recente è anche quello che');
    riga('     i lettori leggono. Il difetto non ha morso, o è già stato riassorbito.');
  } else {
    riga(`  ⛔ ${rotte.length} clienti leggono un pool PIÙ VECCHIO di quello che hanno.`);
    riga('     Per loro il cambio di piatto in chat e la giornata dettata da Vera propongono');
    riga('     piatti scelti su una dieta che non seguono più.');
    riga('');
    riga('  ✅ Si sistemano una per una **riaprendo la scheda e risalvando**: dalla correzione');
    riga('     del 2/9 la ricostruzione prende la versione più alta di tutte e torna davanti.');
    riga('');
    for (const r of rotte.slice(0, ESEMPI)) {
      const p = profiloDi.get(r.clientId);
      riga(`  · ${r.clientId.slice(0, 8)}  ${(p?.name ?? '—').padEnd(18)} profilo: «${p?.dietFamily ?? '(vuoto)'}»`);
      riga(`      legge:   ${nomeDieta.get(r.vince) ?? r.vince.slice(0, 8)}`);
      riga(`      dovrebbe: ${nomeDieta.get(r.recente) ?? r.recente.slice(0, 8)}  (rifatto il ${r.quando.toISOString().slice(0, 10)})`);
    }
    if (rotte.length > ESEMPI) riga(`  … e altre ${rotte.length - ESEMPI} (ESEMPI=${rotte.length} per vederle tutte)`);
  }

  /**
   * ⚠️ **Chi ha pool su più diete è la popolazione a rischio**, anche quando oggi è allineata: sono
   * le clienti che sono state spostate almeno una volta, cioè quelle su cui il difetto poteva
   * scattare. Se il numero è alto, la correzione valeva la pena; se è zero, il difetto era teorico.
   */
  const suPiuDiete = [...vincente.keys()].filter((c) => {
    const diverse = new Set(pool.filter((p) => p.clientId === c).map((p) => p.dietId));
    return diverse.size > 1;
  });
  riga('');
  riga(`  Clienti con pool su più di una dieta (spostate almeno una volta): ${suPiuDiete.length}`);
  riga(`  …di queste, disallineate adesso:                                 ${rotte.length}`);

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
