/**
 * RIPARA i nomi delle clienti importate: nome e cognome separati, alias ripulito.
 *
 * ## Che cosa è andato storto
 *
 * Nelle liste storiche il nome arrivava tutto attaccato — «Maria Grazia Cerchiara» — e
 * l'import lo ha messo dove capitava: `firstName` ha preso la prima parola («Maria»),
 * `lastName` è rimasto **vuoto**, e il nome intero è finito nell'**alias** (il campo che in
 * scheda si chiamava «Nome nel percorso», cioè il nome con cui la cliente si fa chiamare in
 * app). Risultato: in app veniva chiamata col nome e cognome per esteso, come una raccomandata,
 * e in backoffice la colonna Cognome era vuota — quindi non si poteva ordinare per cognome né
 * cercare per cognome.
 *
 * ## Come divide, e perché così
 *
 * **L'ultima parola è il cognome, il resto è il nome.** Non il contrario: «Maria Grazia
 * Cerchiara» è Maria Grazia di cognome Cerchiara, non Maria di cognome Grazia Cerchiara.
 * Le PARTICELLE («de», «di», «della», «lo», «van»…) restano attaccate al cognome, altrimenti
 * «Maria Teresa De Santis» diventerebbe una signora di cognome «Santis».
 *
 * Resta un margine di errore — i cognomi doppi senza particella («Anna Rossi Bianchi») vengono
 * divisi male — ed è il motivo per cui questo script **mostra prima e scrive solo su conferma**:
 * la tabella va letta, non lanciata al buio. Chi non convince si sistema a mano dalla scheda.
 *
 * ## L'alias
 *
 * Se l'alias è identico al nome completo non aggiunge niente e viene **svuotato**: da lì in poi
 * l'app usa il nome, che è il comportamento normale. Se invece contiene qualcos'altro — un
 * soprannome vero — non si tocca: è un dato che qualcuno ha scritto apposta.
 *
 * ## E i LEAD, che sono la parte che mancava (8/8)
 *
 * Lo script guardava solo `user` con ruolo `client`: chi ha un account. Ma i lead importati dalle
 * liste **non hanno un account** — sono righe `CrmRecord` con `clientId` a null — quindi restavano
 * fuori, e il messaggio «Niente da sistemare ✓» era vero solo per le clienti. Simone l'8/8: «ma io
 * voglio sistemare i lead anche».
 *
 * Su `CrmRecord` il guasto è più semplice: `firstName`/`lastName` sono **vuoti** e c'è solo `name`
 * col nome intero (è scritto anche nel commento dello schema: «restano NULLABLE perché i lead
 * importati dalle liste storiche hanno solo il nome intero»). Senza il cognome, in Gestione lead non
 * si ordina e non si cerca per cognome — lo stesso problema delle clienti, sulla lista più grande.
 * `name` resta e viene tenuto allineato come «Nome Cognome»: lo leggono decine di punti.
 *
 * USO (shell di Render, dentro la cartella del backend):
 *   npm run sistema:nomi                 → mostra cosa farebbe, non scrive niente
 *   npm run sistema:nomi -- 40           → si ferma alle prime 40 (mostrate E, con CONFERMA, scritte)
 *   CONFERMA=1 npm run sistema:nomi      → applica a tutti (clienti E lead)
 *   SOLO=lead / SOLO=clienti             → lavora una sola delle due liste
 *
 * ⚠️ Il numero limita **il lavoro**, non solo la stampa. Prima limitava la sola tabella: si
 * leggevano trenta righe e se ne scrivevano trecento — cioè si confermava alla cieca l'esatto
 * contrario di quello che si era appena letto. Il limite vale sul TOTALE delle due liste, clienti
 * prima: così «40» significa 40 scritture, non 40 per lista.
 */
import { PrismaClient } from '@prisma/client';
import { dividiNome } from '../src/common/dividi-nome';

const prisma = new PrismaClient();

const uguale = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase().replace(/\s+/g, ' ') === (b ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main(): Promise<void> {
  const limite = Number(process.argv[2]) || 0;
  const conferma = process.env.CONFERMA === '1';

  const utenti = (await prisma.user.findMany({
    where: { role: 'client' as never, deletedAt: null } as never,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      clientProfile: { select: { name: true } },
      // `firstName`/`lastName` sono colonne appena aggiunte: il client Prisma locale non le
      // conosce finché non viene rigenerato (lo fa il deploy). Qui servono solo `id` e `name`.
      crmRecord: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })) as never as {
    id: string; email: string; firstName: string | null; lastName: string | null;
    clientProfile: { name: string | null } | null;
    crmRecord: { id: string; name: string | null } | null;
  }[];

  const solo = (process.env.SOLO ?? '').toLowerCase(); // '' | 'lead' | 'clienti'
  const tabella: Record<string, unknown>[] = [];
  /**
   * Una sola coda per due liste: il limite deve valere sul totale, altrimenti «40» diventa
   * «40 clienti e 40 lead» e chi legge trenta righe se ne ritrova ottanta scritte.
   */
  const daScrivere: (
    | { tipo: 'cliente'; userId: string; nome: string; cognome: string; svuotaAlias: boolean; crmId: string | null }
    | { tipo: 'lead'; crmId: string; nome: string; cognome: string; svuotaAlias: boolean }
  )[] = [];
  let giaOk = 0;
  let senzaMateriale = 0;

  for (const u of solo === 'lead' ? [] : utenti) {
    if (u.lastName && u.lastName.trim()) { giaOk += 1; continue; }

    // Da dove prendiamo il nome intero, in ordine di attendibilità: l'alias (è lì che l'import
    // ha scaricato tutto), poi il nome della scheda CRM, poi `firstName` se contiene più parole.
    const candidati = [u.clientProfile?.name, u.crmRecord?.name, u.firstName].filter(
      (x): x is string => !!x && x.trim().split(/\s+/).length >= 2,
    );
    const intero = candidati[0];
    if (!intero) { senzaMateriale += 1; continue; }

    const diviso = dividiNome(intero);
    if (!diviso) { senzaMateriale += 1; continue; }

    const svuotaAlias = uguale(u.clientProfile?.name, intero);
    tabella.push({
      chi: 'cliente',
      contatto: u.email,
      'com\'è ora': `nome «${u.firstName ?? '—'}» · cognome «${u.lastName ?? '—'}» · alias «${u.clientProfile?.name ?? '—'}»`,
      'diventa': `nome «${diviso.nome}» · cognome «${diviso.cognome}»`,
      alias: svuotaAlias ? 'svuotato (era il nome completo)' : (u.clientProfile?.name ? 'lasciato com\'è' : '—'),
    });
    daScrivere.push({ tipo: 'cliente', userId: u.id, nome: diviso.nome, cognome: diviso.cognome, svuotaAlias, crmId: u.crmRecord?.id ?? null });
  }

  console.log(`Clienti esaminate: ${utenti.length} · già a posto (hanno il cognome): ${giaOk} · senza materiale per dividere: ${senzaMateriale}`);

  // ---------- LEAD PURI: righe CRM senza account (8/8) ----------
  // `clientId: null` è la definizione di «lead puro»: chi ha l'account è già passato dal giro sopra,
  // che gli allinea anche la scheda CRM. Rifarlo qui vorrebbe dire scrivere due volte la stessa riga.
  let leadEsaminati = 0;
  let leadGiaOk = 0;
  let leadSenzaMateriale = 0;
  if (solo !== 'clienti') {
    const lead = (await prisma.crmRecord.findMany({
      where: { clientId: null } as never,
      select: { id: true, email: true, phone: true, name: true, firstName: true, lastName: true, alias: true } as never,
      orderBy: { id: 'asc' },
    })) as never as {
      id: string; email: string | null; phone: string | null;
      name: string | null; firstName: string | null; lastName: string | null; alias: string | null;
    }[];
    leadEsaminati = lead.length;

    for (const l of lead) {
      if (l.lastName && l.lastName.trim()) { leadGiaOk += 1; continue; }
      // Sul lead il nome intero sta in `name`; l'alias e `firstName` sono ripieghi, come per le clienti.
      const candidati = [l.name, l.alias, l.firstName].filter(
        (x): x is string => !!x && x.trim().split(/\s+/).length >= 2,
      );
      const intero = candidati[0];
      if (!intero) { leadSenzaMateriale += 1; continue; }
      const diviso = dividiNome(intero);
      if (!diviso) { leadSenzaMateriale += 1; continue; }

      const svuotaAlias = uguale(l.alias, intero);
      tabella.push({
        chi: 'lead',
        contatto: l.email ?? l.phone ?? '(senza contatto)',
        'com\'è ora': `nome «${l.firstName ?? '—'}» · cognome «${l.lastName ?? '—'}» · name «${l.name ?? '—'}»`,
        'diventa': `nome «${diviso.nome}» · cognome «${diviso.cognome}»`,
        alias: svuotaAlias ? 'svuotato (era il nome completo)' : (l.alias ? 'lasciato com\'è' : '—'),
      });
      daScrivere.push({ tipo: 'lead', crmId: l.id, nome: diviso.nome, cognome: diviso.cognome, svuotaAlias });
    }
    console.log(`Lead senza account: ${leadEsaminati} · già a posto: ${leadGiaOk} · senza materiale per dividere: ${leadSenzaMateriale}`);
  }
  if (tabella.length === 0) {
    console.log('\nNiente da sistemare ✓  (clienti E lead: hanno già nome e cognome separati)');
    return;
  }
  // Il limite vale per TUTTO: quello che si vede è esattamente quello che si scrive.
  const totale = tabella.length;
  const tabellaVista = limite > 0 ? tabella.slice(0, limite) : tabella;
  const daScrivereVere = limite > 0 ? daScrivere.slice(0, limite) : daScrivere;
  console.log(`\n--- DA SISTEMARE (${totale}) ---`);
  console.table(tabellaVista);
  if (limite > 0 && totale > limite) {
    console.log(`Ti fermi alle prime ${limite} di ${totale}: con CONFERMA=1 verranno sistemate SOLO queste.`);
    console.log(`Ne restano ${totale - limite}: rilancia senza numero per farle tutte.`);
  }
  console.log(
    '\nLeggi la colonna «diventa» prima di confermare. La regola è: ULTIMA parola = cognome,\n' +
    'con le particelle attaccate (De, Di, Della…). I cognomi doppi senza particella — «Rossi\n' +
    'Bianchi» — vengono divisi male: quelli si correggono a mano dalla scheda, sono pochi.',
  );

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run sistema:nomi');
    return;
  }

  let fatti = 0;
  for (const x of daScrivereVere) {
    try {
      if (x.tipo === 'cliente') {
        await prisma.user.update({ where: { id: x.userId }, data: { firstName: x.nome, lastName: x.cognome } });
        if (x.svuotaAlias) {
          await prisma.clientProfile.updateMany({ where: { userId: x.userId }, data: { name: null } as never });
        }
        // La scheda CRM tiene gli stessi dati: allinearla evita che backoffice e app raccontino
        // due storie diverse sulla stessa persona.
        if (x.crmId) {
          await prisma.crmRecord.update({
            where: { id: x.crmId },
            data: { firstName: x.nome, lastName: x.cognome, name: `${x.nome} ${x.cognome}` } as never,
          });
        }
      } else {
        // Lead puro: nessun `user` da aggiornare. `name` si riscrive normalizzato («Nome Cognome»)
        // perché è il campo che legge mezzo backoffice; l'alias si svuota solo se non aggiungeva
        // niente. Il telefono e l'email non si toccano: sono le chiavi con cui il lead è stato
        // importato e riconosciuto.
        await prisma.crmRecord.update({
          where: { id: x.crmId },
          data: {
            firstName: x.nome,
            lastName: x.cognome,
            name: `${x.nome} ${x.cognome}`,
            ...(x.svuotaAlias ? { alias: null } : {}),
          } as never,
        });
      }
      fatti += 1;
    } catch (e) {
      const chi = x.tipo === 'cliente' ? x.userId : `lead ${x.crmId}`;
      console.log(`⚠️  ${chi}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n✓ Sistemate ${fatti} schede su ${daScrivereVere.length} lavorate (${totale} in tutto).`);
  if (totale > daScrivereVere.length) {
    console.log(`Ne restano ${totale - daScrivereVere.length}: rilancia il comando per continuare.`);
  }
  console.log('Chi resta storto si corregge dalla sua scheda, campo Nome e Cognome: clienti da Utenti,\nlead da Gestione lead.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
