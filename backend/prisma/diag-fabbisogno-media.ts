/**
 * ⛔ **CHE COSA CAMBIA NEL PIATTO SE IL FABBISOGNO PASSA ALLA MEDIA MOBILE** — cliente per cliente,
 * il target di ieri e quello di oggi.
 *
 * Decisione di Simone, 27/8: *«il fabbisogno deve utilizzare la media mobile»*. È l'ultimo dei
 * quattro punti che rispondevano in modo diverso alla domanda «quanto pesa adesso»; gli altri tre
 * sono passati alla tendenza il 19/8.
 *
 * ⚠️ **Questa correzione tocca QUANTE CALORIE MANGIA OGNI CLIENTE**, non una schermata. Non è una
 * cosa da accendere e guardare dopo: *misurare prima di decidere* vale soprattutto quando la
 * decisione è già presa, perché il numero che serve non è «se farlo» ma «quanto si sposta».
 *
 * ⚠️ **Non scrive niente**: chiama `estimate`, che legge e basta. (Non «non può»: ha in mano un
 * client Prisma vivo. La garanzia è che non lo usa per scrivere, non che gli sia impedito.) Il
 * «prima» si ottiene passandogli `simulazione.pesoKg` con l'ultima pesata — la stessa porta che il
 * backoffice usa per mostrare «se scrivessi questo deficit».
 *
 * ⛔ **E il segno dello scarto NON è sempre lo stesso**, perché il peso entra due volte e le due
 * entrate tirano in direzioni opposte (il perché, coi conti, sta nel docblock di
 * `kcal-need.service.ts`). Per questo la tabella stampa anche **da dove viene il deficit** e **se il
 * tetto ha morso**: senza quelle due colonne non si può sapere in quale regime sta la riga che si sta
 * guardando, e si finisce per costruirsi una regola mentale che vale solo per metà delle clienti.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:fabbisogno-media
 *   SOLO=paola@esempio.it npm run diag:fabbisogno-media     # una cliente sola
 */
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { ConfigParamsService } from '../src/config-params/config-params.service';
import { KcalNeedService } from '../src/menu/kcal-need.service';
import { spiegaSalto } from '../src/signals/peso-incoerente';

const prisma = new PrismaClient();
const SOLO = process.env.SOLO?.trim().toLowerCase() || null;

async function main(): Promise<void> {
  const config = new ConfigParamsService(prisma as never, new AuditService(prisma as never));
  const kcal = new KcalNeedService(prisma as never, config);

  const clienti = (await prisma.user.findMany({
    // ⚠️ `mode: 'insensitive'`: un'email con una maiuscola in banca dati faceva rispondere «nessuna
    // cliente con quell'email», che è indistinguibile da «non esiste».
    where: { role: 'client', ...(SOLO ? { email: { equals: SOLO, mode: 'insensitive' } } : {}) } as never,
    select: { id: true, email: true, clientProfile: { select: { name: true } } },
    orderBy: { email: 'asc' },
  })) as { id: string; email: string; clientProfile: { name: string | null } | null }[];

  if (!clienti.length) {
    console.log(SOLO ? `Nessuna cliente con l'email "${SOLO}".` : 'Nessuna cliente.');
    return;
  }

  const righe: {
    cliente: string;
    'ultima pesata': string;
    'media mobile': string;
    'kcal prima': number | string;
    'kcal dopo': number | string;
    scarto: string;
    deficit: string;
    tetto: string;
    pesate: string;
  }[] = [];
  let nonStimabili = 0;
  let senzaPesate = 0;
  let piuGrande = 0;

  for (const c of clienti) {
    const ultima = (await prisma.measurement.findFirst({
      where: { clientId: c.id },
      orderBy: { date: 'desc' },
      select: { weightKg: true },
    })) as { weightKg: number } | null;

    // Il «dopo» è il comportamento nuovo: nessuna simulazione, il servizio fa quello che farà.
    const dopo = await kcal.estimate(c.id);
    /**
     * ⚠️ Il «prima» si ricostruisce passando l'ultima pesata, che è **esattamente** quello che il
     * servizio usava fino al 27/8. Non è una stima: è lo stesso calcolo con l'ingresso di ieri.
     */
    const prima = ultima ? await kcal.estimate(c.id, { pesoKg: ultima.weightKg }) : null;

    /**
     * ⚠️ Chi non si può confrontare si CONTA e non sparisce: un elenco più corto del vero è un elenco
     * che rassicura per la ragione sbagliata. ⛔ E i motivi sono **due e diversi**, quindi si contano
     * a parte: c'è chi non si può stimare (mancano sesso, età, altezza o peso) e c'è chi non ha
     * **nessuna pesata** — per quest'ultima il fabbisogno esce lo stesso, dal peso di partenza, e
     * semplicemente non cambia. La prima stesura le metteva insieme sotto il motivo sbagliato.
     */
    if (!dopo) { nonStimabili++; continue; }
    if (!prima) { senzaPesate++; continue; }
    const scarto = dopo.target - prima.target;
    if (Math.abs(scarto) > Math.abs(piuGrande)) piuGrande = scarto;
    righe.push({
      cliente: c.clientProfile?.name ?? c.email,
      'ultima pesata': ultima ? `${ultima.weightKg} kg` : '—',
      'media mobile': `${dopo.weightKg} kg`,
      'kcal prima': prima.target,
      'kcal dopo': dopo.target,
      scarto: `${scarto > 0 ? '+' : ''}${scarto}`,
      /**
       * ⛔ **«CALCOLATO» ERANO DUE COSE, E LA TABELLA LE CHIAMAVA CON LO STESSO NOME** (corretto il
       * 28/8, dopo che Simone aveva letto la prima passata in produzione).
       *
       * Il deficit dedotto nasce dal **ritmo dell'obiettivo** oppure da una **percentuale fissa del
       * TDEE**, e le due hanno derivata di segno **opposto** rispetto al peso. Con un'etichetta sola
       * la tabella mostrava righe con lo stesso regime dichiarato e lo scarto con segni contrari:
       * chi la leggeva non poteva che concludere che il conto fosse sbagliato. Non lo era — era
       * questa colonna a mettere insieme due regimi diversi.
       */
      deficit:
        dopo.fonteDeficit === 'calcolato'
          ? dopo.calcoloDeficit === 'ritmo'
            ? 'ritmo'
            : 'default %'
          : dopo.fonteDeficit,
      tetto: dopo.tettoApplicato ? 'sì' : '—',
      /**
       * ⚠️ **E se le pesate non stanno in piedi, questa riga non è un confronto fra due regole**
       * (28/8): è il confronto fra due numeri costruiti su un dato sbagliato. Erano le quattro righe
       * in cima alla passata del 27/8 — media mobile lontana 12,2 · 12,8 · 13,5 · 19,7 chili dall'ultima pesata —
       * ed era la tabella a non saperlo dire. Ora lo dice, e da queste clienti il fabbisogno **non
       * esce affatto**: mangiano il livello della loro dieta.
       */
      pesate: dopo.pesoIncoerente ? `⛔ ${spiegaSalto(dopo.pesoIncoerente)}` : 'ok',
    });
  }

  /**
   * ⚠️ **In cima chi si sposta di più**, non l'ordine alfabetico: se c'è un caso da guardare in
   * faccia prima di accendere, dev'essere la prima riga — non la ventottesima.
   */
  righe.sort((a, b) => Math.abs(Number(b.scarto)) - Math.abs(Number(a.scarto)));

  console.log(`\nFabbisogno: ultima pesata → media mobile. Clienti confrontabili: ${righe.length}.`);
  if (nonStimabili) console.log(`⚠️ Non stimabili (mancano sesso, età, altezza o peso): ${nonStimabili}. Il fabbisogno non esce né prima né dopo.`);
  if (senzaPesate) console.log(`⚠️ Senza nessuna pesata: ${senzaPesate}. Il fabbisogno esce dal peso di partenza, e non cambia.`);
  console.log('');
  console.table(righe);

  const mosse = righe.filter((r) => Number(r.scarto) !== 0);
  console.log(
    `\nCambia qualcosa a ${mosse.length} clienti su ${righe.length}. Scarto più grande: ` +
      `${piuGrande > 0 ? '+' : ''}${piuGrande} kcal/giorno.`,
  );
  console.log(
    '⚠️ Come si legge: scarto POSITIVO = da domani mangia di più, NEGATIVO = di meno. ⛔ Il segno NON ' +
      'si può dedurre dai due pesi: il peso entra sia nel metabolismo basale (più pesante → più ' +
      'calorie) sia nel ritmo di calo verso l\'obiettivo (più pesante → più deficit → meno calorie), ' +
      'e quale dei due domina dipende da quante settimane mancano al traguardo e da se il tetto ha ' +
      'morso. Le colonne «deficit» e «tetto» servono a quello: nelle righe con deficit «ritmo» e ' +
      'tetto «—» domina il secondo termine, e il segno sorprende. ⚠️ «ritmo» e «default %» NON sono ' +
      'la stessa cosa e non si leggono allo stesso modo: «ritmo» viene dall\'obiettivo e ha derivata ' +
      'negativa (più pesante → meno calorie), «default %» è una percentuale del mantenimento e ha ' +
      'derivata positiva (più pesante → più calorie). Fino al 27/8 questa colonna diceva «calcolato» ' +
      'per tutt\'e due, e la tabella sembrava contraddirsi.',
  );
  const rotte = righe.filter((r) => r.pesate !== 'ok');
  if (rotte.length) {
    console.log(
      `\n⛔ ${rotte.length} client${rotte.length === 1 ? 'e ha' : 'i hanno'} pesate che non stanno in piedi fra loro. ` +
        'Per loro le due colonne kcal NON sono un confronto fra due regole: sono due numeri costruiti su un ' +
        'dato sbagliato, e dal 28/8 il fabbisogno non esce affatto — mangiano il livello della loro dieta ' +
        'finché qualcuno non verifica le misure. La coach le ha in coda («Pesate incoerenti») e il ' +
        'nutrizionista come segnalazione clinica.',
    );
  }
  console.log(
    '⚠️ E non c\'è una conversione fissa fra kcal di scarto e chili: dipende dalle settimane che ' +
      'restano a quella cliente. Guardare le due colonne dei pesi accanto allo scarto dice più di ' +
      'qualunque soglia di rumore.\n',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
