/**
 * ⛔ **QUANTE PERSONE SONO IN PERCORSO SUPERVISIONATO, E CHI LE STA GUARDANDO.**
 *
 * Il 23/8, chiudendo il via libera clinico, è venuto fuori che una cliente in screening che
 * **nessuno ha mai valutato riceve i menu lo stesso**: il cancello sull'erogazione non è mai
 * esistito — il blocco viveva solo nella card dell'app, e quella card compariva di rado **proprio
 * perché i menu c'erano** (`menuStatus` risponde «disponibile» appena trova un menu visibile).
 *
 * ⚠️ Simone, 25/8, ha deciso di **non chiudere** quel cancello: *«se il cliente è supervisionato va
 * mandata notifica a Lucia di controllarlo ogni 7 giorni attraverso Vera»*. Questa diagnostica è la
 * misura che va accanto a quella decisione: dice **quante sono adesso** e **da quanto aspettano** —
 * perché «ogni 7 giorni una domanda» è un buon rimedio con dieci persone e un rumore di fondo con
 * duecento, e la differenza non si indovina.
 *
 * ⛔ Non tocca niente, non apre nessuna domanda: legge e conta. `npm run diag:supervisione`.
 */
import { PrismaClient } from '@prisma/client';
import { statoSupervisione } from '../src/clients/via-libera-clinico';
import { PROMEMORIA_OGNI_GIORNI, promemoriaDovuto } from '../src/clients/promemoria-supervisione';

type Riga = {
  userId: string;
  name: string | null;
  createdAt: Date | null;
  screeningFlag: boolean | null;
  idoneita: string | null;
  idoneitaVisitaEntro: Date | null;
};

const GIORNO = 86_400_000;

async function main() {
  const prisma = new PrismaClient();
  try {
    const oggi = new Date();
    /**
     * ⚠️ **Il numero stampato e quello usato devono essere lo stesso.** Con `Number(valore)` e basta,
     * un valore non numerico in tabella stampava «ogni NaN giorni» e poi `promemoriaDovuto` ricadeva
     * sui 7: il report diceva una cosa e il conto ne faceva un'altra. Rilievo della revisione, 25/8.
     */
    const scritto = (await prisma.configParam.findUnique({ where: { key: 'supervision_reminder_days' } }))?.value;
    const letto = Number(scritto);
    const passo = Number.isFinite(letto) && letto > 0 ? Math.floor(letto) : PROMEMORIA_OGNI_GIORNI;
    if (scritto !== undefined && passo !== letto) {
      console.log(`⚠️ supervision_reminder_days vale «${scritto}», che non è un numero di giorni: uso ${passo}.`);
    }

    const profili = (await prisma.clientProfile.findMany({
      where: { screeningFlag: true } as never,
      select: {
        userId: true,
        name: true,
        createdAt: true,
        screeningFlag: true,
        idoneita: true,
        idoneitaVisitaEntro: true,
      } as never,
    })) as Riga[];

    console.log(`\nPercorsi supervisionati: ${profili.length}. Promemoria ogni ${passo} giorni.\n`);
    if (!profili.length) {
      console.log('Nessuna cliente in percorso supervisionato.\n');
      return;
    }

    const perStato = new Map<string, Riga[]>();
    for (const p of profili) {
      const stato = statoSupervisione(p, oggi);
      const chiave = stato.motivo;
      perStato.set(chiave, [...(perStato.get(chiave) ?? []), p]);
    }

    /**
     * ⚠️ **Chi eroga davvero, e chi no** — perché è la domanda che una persona si fa leggendo questa
     * lista, e sbagliare a indovinarla è il difetto da cui nasce tutta questa storia.
     */
    const EROGA: Record<string, string> = {
      mai_valutata: 'SÌ (nessuno l\'ha ancora valutata)',
      via_libera: 'sì',
      visita_da_fare: 'sì, fino alla data',
      visita_scaduta: 'NO — ferma',
      non_supervisionata: 'sì',
    };

    for (const [motivo, righe] of [...perStato.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`── ${motivo}: ${righe.length}   (menu: ${EROGA[motivo] ?? '?'})`);
      const conAttesa = righe
        .map((r) => ({
          r,
          giorni: r.createdAt ? Math.floor((oggi.getTime() - r.createdAt.getTime()) / GIORNO) : null,
        }))
        .sort((a, b) => (b.giorni ?? 0) - (a.giorni ?? 0));
      for (const { r, giorni } of conAttesa.slice(0, 15)) {
        const entro = r.idoneitaVisitaEntro ? ` · visita entro ${r.idoneitaVisitaEntro.toISOString().slice(0, 10)}` : '';
        console.log(`     ${String(giorni ?? '?').padStart(4)} gg  ${r.name ?? r.userId}${entro}`);
      }
      if (conAttesa.length > 15) console.log(`     … e altre ${conAttesa.length - 15}`);
    }

    const inCoda = profili.filter((p) => promemoriaDovuto(
      { clientId: p.userId, nome: p.name, da: p.createdAt, profilo: p },
      oggi,
      passo,
    ).chiave !== null);

    console.log(
      `\nStanotte il giro aprirebbe (o riaprirebbe) una domanda su Vera per ${inCoda.length} clienti.\n` +
        `⚠️ Il promemoria NON ferma nessuno: serve a far arrivare la domanda a chi deve rispondere.\n`,
    );

    /**
     * ⛔ **Il numero che conta davvero**: da quanto aspetta chi aspetta di più. Se qui c'è un numero
     * a tre cifre, il promemoria ogni 7 giorni non è il problema — è che qualcosa non si sta
     * lavorando, e va detto invece di riaprirlo un'altra volta.
     */
    const attese = perStato.get('mai_valutata') ?? [];
    if (attese.length) {
      const peggio = Math.max(
        ...attese.map((r) => (r.createdAt ? Math.floor((oggi.getTime() - r.createdAt.getTime()) / GIORNO) : 0)),
      );
      console.log(`⛔ La cliente mai valutata che aspetta da più tempo: ${peggio} giorni.\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
