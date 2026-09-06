/**
 * ⛔ **CHI RIMANE SENZA LA SCHEDA DEL «?» — misurato sugli stili VERI, non sui preset.**
 *
 * La voce `scheda-stile-cablata-nell-app` è rimasta aperta per una ragione precisa, scritta lì
 * dentro: la prova del 3/9 confronta le schede dell'app con i **preset** del backend, ma gli stili
 * che una cliente vede arrivano dal **database** (`GET /onboarding/diet-products`) — i preset sono
 * solo il seme. Una dieta scritta a mano in banca dati, con uno stile che nei preset non c'è, esce
 * senza scheda e nessuna prova se ne accorge. Questo comando è il numero che mancava.
 *
 * ⚠️ Il giudizio non sta qui: sta in `src/engine-rules/scheda-stile.ts`, con le sue prove. Qui c'è
 * solo la lettura dalla banca dati e il tabulato — che è la divisione che questo progetto tiene
 * ovunque, perché uno script non lo prova nessuno.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *     npm run diag:schede-stile
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chiRestaSenzaScheda, fontiGenerali, raccogliStili, schedeDelloStile } from '../src/engine-rules/scheda-stile';

const prisma = new PrismaClient();
const riga = (s = '') => console.log(s);
const titolo = (s: string) => { riga(''); riga('──────────────────────────────────────────────────────────────────'); riga(`  ${s}`); riga('──────────────────────────────────────────────────────────────────'); };

const ETICHETTA: Record<string, string> = {
  titolo: 'il titolo',
  cose: '«che cos\'è»',
  inPratica: '«in pratica»',
  cosaDiceLaRicerca: '«cosa dice la ricerca»',
  attenzione: '«da tenere presente»',
};

async function main(): Promise<void> {
  riga('');
  riga('==================================================================');
  riga('  LA SCHEDA DEL «?»: CHI CE L\'HA E CHI NO');
  riga('  Sola lettura.');
  riga('==================================================================');

  /**
   * ⚠️ Il file dell'app si legge dal repo, come fa la prova del 3/9. Se un giorno l'app vivesse in
   * un altro repository questo comando andrebbe rifatto — e il fatto che smetta di funzionare è
   * meglio di un comando che dice «tutte le schede ci sono» perché non ha trovato il file.
   */
  const percorso = join(__dirname, '..', '..', 'app', 'src', 'onboarding', 'dietInfo.ts');
  let sorgente = '';
  try {
    sorgente = readFileSync(percorso, 'utf8');
  } catch {
    riga('');
    riga(`  ⛔ Non trovo il file delle schede: ${percorso}`);
    riga('     Senza quello questo comando non può dire niente — e tacere sarebbe peggio.');
    riga('     ⚠️ Questo è l\'unico comando che legge fuori da `backend/`: la cartella `app/` deve');
    riga('     essere nel container. Da controllare con:  ls ~/project/src/app');
    riga('');
    return;
  }
  const schede = schedeDelloStile(sorgente);
  /**
   * ⛔ **La mappa vuota si dice, e si smette.** Un lettore che non legge più niente — il file
   * riscritto, la dichiarazione rinominata — farebbe risultare **ogni** stile «senza scheda»: un
   * tabulato pieno di allarmi falsi, che è il modo più veloce per far smettere di leggere i
   * tabulati.
   */
  if (!schede.size) {
    riga('');
    riga('  ⛔ Il file c\'è ma non ne ho ricavato nessuna scheda: il lettore non riconosce più');
    riga('     `export const DIET_INFO`. Da correggere prima di fidarsi di qualunque numero.');
    riga('');
    return;
  }

  const diete = (await prisma.diet.findMany({
    where: { clientVisible: true, status: 'approved' } as never,
    select: { style: true, name: true, clientName: true } as never,
  })) as unknown as { style: string | null; name: string | null; clientName: string | null }[];

  /**
   * ⛔ **SOLO CLIENTI VIVE, e non è pignoleria.** L'archiviazione e la cancellazione self-service
   * scrivono `deletedAt` sull'utente e **lasciano il profilo dov'è**, `dietStyle` compreso; e
   * `dietStyle` si scrive alla consegna del questionario, cioè **prima del pagamento**. Senza il
   * filtro, il numero da cui dipende se vale un rilascio dell'app è gonfio di account cancellati e
   * di persone che non hanno mai comprato. La stessa regola sta già in `diag-commerciale-e-coach.ts`.
   */
  const profili = (await prisma.clientProfile.findMany({
    where: { user: { role: 'client', deletedAt: null } } as never,
    select: { dietStyle: true } as never,
  })) as unknown as { dietStyle: string | null }[];
  const profiliTotali = await prisma.clientProfile.count();
  const clientiDi = new Map<string, number>();
  for (const p of profili) {
    const k = String(p.dietStyle ?? '').trim();
    if (k) clientiDi.set(k, (clientiDi.get(k) ?? 0) + 1);
  }

  const { pubblicati, senzaCodice, clientiFuoriCatalogo } = raccogliStili(diete, clientiDi);
  const esito = chiRestaSenzaScheda(pubblicati, schede);

  titolo('I NUMERI');
  riga(`  Stili in gioco                                  ${String(pubblicati.length).padStart(6)}`);
  riga(`  · con la scheda piena                           ${String(esito.piene.length).padStart(6)}`);
  riga(`  · ⛔ senza nessuna scheda                        ${String(esito.senzaScheda.length).padStart(6)}   il «?» non compare in registrazione`);
  riga(`  · ⚠️ con la scheda a metà                        ${String(esito.aMeta.length).padStart(6)}   il «?» compare e apre mezzo popup`);
  if (esito.nonLeggibili.length) {
    riga(`  · ⛔ scheda che non riesco a leggere             ${String(esito.nonLeggibili.length).padStart(6)}   NON è un problema di contenuto`);
  }
  riga('');
  /**
   * ⚠️ **L'etichetta dice «scelto in registrazione», e la differenza è vera.** Nel profilo il «?» si
   * apre sullo stile **assegnato**, che il motore può cambiare ripiegando su un'altra dieta quando
   * la variante giusta non esiste. Chiamarlo «lo stile che vede» sarebbe più bello e falso.
   */
  riga(`  ⛔ Clienti che hanno SCELTO uno stile scoperto   ${String(esito.clientiToccate).padStart(6)}`);
  riga(`     (nel profilo il «?» segue lo stile ASSEGNATO, che il motore può aver cambiato)`);
  riga('');
  riga(`  Profili guardati (clienti vive)                 ${String(profili.length).padStart(6)}   su ${profiliTotali} in tabella`);
  if (clientiFuoriCatalogo) {
    riga(`  ⚠️ di cui su uno stile che nessuna dieta pubblica ${String(clientiFuoriCatalogo).padStart(5)}   assegnato dallo staff o dal motore`);
  }
  if (senzaCodice) {
    riga(`  ⛔ Diete pubblicate SENZA codice stile           ${String(senzaCodice).padStart(6)}   alla cliente escono senza «?»`);
  }
  const fonti = fontiGenerali(sorgente);
  riga(`  ${fonti.length ? ' ' : '⛔'} Fonti generali nel file                      ${String(fonti.length).padStart(6)}${fonti.length ? '' : '   il popup mostra «Fonti:» e basta'}`);
  riga(`  Schede scritte per stili che nessuno usa        ${String(esito.schedeSenzaStile.length).padStart(6)}   (non è un difetto)`);

  if (!pubblicati.length) {
    riga('');
    riga('  ⛔ Nessuna dieta pubblicata e visibile: lo zero qui sopra non vuol dire «va tutto bene»,');
    riga('     vuol dire che non c\'è niente da mostrare a nessuna cliente. Da guardare prima di tutto.');
    riga('');
    return;
  }

  if (esito.senzaScheda.length) {
    titolo('⛔ SENZA SCHEDA — in registrazione il pallino «?» non compare proprio');
    for (const s of esito.senzaScheda) {
      riga(`  · ${s.style.padEnd(22)} ${String(s.clienti).padStart(5)} clienti   ${s.diete.slice(0, 3).join(', ')}`);
    }
    riga('');
    riga('  Alla cliente restano il nome e la descrizione del backoffice: spariscono «cosa dice la');
    riga('  ricerca», «da tenere presente» e le fonti — la parte che le dice perché fidarsi.');
  }

  if (esito.aMeta.length) {
    titolo('⚠️ SCHEDA A METÀ — il «?» c\'è, e apre un popup svuotato');
    for (const s of esito.aMeta) {
      riga(`  · ${s.style.padEnd(22)} ${String(s.clienti).padStart(5)} clienti   manca ${s.mancano.map((m) => ETICHETTA[m] ?? m).join(', ')}`);
    }
  }

  if (esito.nonLeggibili.length) {
    titolo('⛔ SCHEDE CHE NON RIESCO A LEGGERE — guardare COME sono scritte, non cosa dicono');
    for (const s of esito.nonLeggibili) riga(`  · ${s.style}`);
    riga('');
    riga('  Tutti e cinque i campi risultano vuoti, che per una scheda scritta davvero non capita:');
    riga('  quasi sempre vuol dire backtick, virgolette doppie o tutta su una riga. ⚠️ NON mandare');
    riga('  nessuno a riscrivere il testo clinico: probabilmente è già scritto.');
  }

  if (esito.schedeSenzaStile.length) {
    titolo('SCHEDE CHE NESSUNA DIETA USA — lavoro fermo, o una dieta ritirata');
    riga(`  ${esito.schedeSenzaStile.join(', ')}`);
  }

  if (!esito.senzaScheda.length && !esito.aMeta.length && !esito.nonLeggibili.length) {
    riga('');
    riga('  ✅ Ogni stile che una cliente può ricevere ha la sua scheda, piena.');
  } else {
    riga('');
    riga('  ▶️ Le schede si scrivono in `app/src/onboarding/dietInfo.ts` e vogliono un rilascio');
    riga('     dell\'app. ⛔ «Cosa dice la ricerca» e «da tenere presente» sono testo clinico: li');
    riga('     scrive la nutrizionista, non chi tocca il codice.');
  }
  riga('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
