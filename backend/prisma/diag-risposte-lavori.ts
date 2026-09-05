/**
 * ⛔ **LE RISPOSTE CHE SIMONE E LA NUTRIZIONISTA SCRIVONO IN PAGINA, LETTE DA CHI SCRIVE IL CODICE.**
 *
 * Nato il 5/9 da un difetto vero, e vale la pena scriverlo per esteso perché è costato una giornata.
 *
 * Le voci di lavoro vivono in due posti: `src/lavori/voci-iniziali.ts` (il file nel repo, che porta
 * la **domanda**) e la tabella `lavoro` in banca dati (la pagina, che porta lo **stato vivo** — la
 * spunta, la categoria, e soprattutto la **risposta**, il campo che Simone ha chiesto il 13/8:
 * *«se mi dai la possibilità di inserire le risposte… posso consultarmi e inserire mano a mano»*).
 *
 * ⛔ Chi scrive il codice legge **solo il file**. Quindi:
 * · una risposta data **in chat** finisce nel file, e si vede;
 * · una risposta scritta **nella pagina** — comprese quelle che arrivano dalla nutrizionista —
 *   resta in banca dati, e chi legge il file **non la vede mai**.
 *
 * Il 5/9 è successo esattamente questo: una domanda già decisa è stata rifatta, e un elenco di
 * «cose che restano» è stato scritto senza guardare le risposte che c'erano già. Simone: *«mi stai
 * dicendo che hai perso la risposta di Lucia?»* — non persa: mai letta, che è peggio, perché non se
 * ne accorge nessuno.
 *
 * Questo comando è la riparazione, e non ha niente di intelligente: stampa le voci con una risposta
 * scritta, e quelle **aperte senza risposta**, che è la lista di cosa si sta ancora aspettando e da
 * chi. Si lancia all'inizio di una sessione, prima di dire a qualcuno cosa manca.
 *
 *     npm run lavori:risposte              → tutte le voci con una risposta, e le aperte senza
 *     APERTE=1 npm run lavori:risposte     → solo le voci ancora aperte
 *
 * ⚠️ Sola lettura: non scrive niente, non spunta niente.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SOLO_APERTE = process.env.APERTE === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => { riga(''); riga('──────────────────────────────────────────────────────────────────'); riga(`  ${s}`); riga('──────────────────────────────────────────────────────────────────'); };
const data = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

async function main(): Promise<void> {
  const voci = (await prisma.lavoro.findMany({
    where: SOLO_APERTE ? ({ fatto: false } as never) : undefined,
    orderBy: [{ fatto: 'asc' }, { categoria: 'asc' }, { ordine: 'asc' }] as never,
    select: { chiave: true, titolo: true, categoria: true, fatto: true, risposta: true, rispostaIl: true, rispostaDa: { select: { displayName: true } } } as never,
  })) as unknown as {
    chiave: string | null; titolo: string; categoria: string; fatto: boolean;
    risposta: string | null; rispostaIl: Date | null; rispostaDa: { displayName: string } | null;
  }[];

  riga('');
  riga('==================================================================');
  riga('  LE RISPOSTE SCRITTE IN PAGINA — quelle che il file non contiene');
  riga(`  Sola lettura. Voci guardate: ${voci.length}${SOLO_APERTE ? ' (solo aperte)' : ''}.`);
  riga('==================================================================');

  const conRisposta = voci.filter((v) => (v.risposta ?? '').trim());
  titolo(`CON UNA RISPOSTA — ${conRisposta.length}`);
  if (!conRisposta.length) {
    riga('  Nessuna. ⚠️ Se qualcuno ha risposto e qui non compare, ha scritto nel dettaglio e non nel campo Risposta.');
  }
  for (const v of conRisposta) {
    riga('');
    riga(`  ${v.fatto ? '✅' : '▶️ '} ${v.titolo}`);
    riga(`     ${v.categoria}${v.chiave ? ` · ${v.chiave}` : ''}`);
    riga(`     Risposta di ${v.rispostaDa?.displayName ?? 'chi non è più in elenco'}, ${data(v.rispostaIl)}:`);
    for (const l of String(v.risposta).split('\n')) riga(`       ${l}`);
  }

  /**
   * ⚠️ **La seconda lista è la più utile delle due**: sono le voci ferme, con scritto sopra da chi
   * si aspetta la risposta (la categoria lo dice). Un elenco di «cosa manca» che non guarda qui
   * chiede di nuovo cose già decise.
   */
  const apertesenza = voci.filter((v) => !v.fatto && !(v.risposta ?? '').trim());
  titolo(`APERTE E SENZA RISPOSTA — ${apertesenza.length}`);
  for (const v of apertesenza) riga(`  · ${v.categoria.padEnd(24)} ${v.titolo}`);

  riga('');
  riga('⚠️ Sola lettura: niente è stato scritto.');
  riga('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
