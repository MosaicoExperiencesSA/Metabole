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
 * USO (shell di Render, dentro la cartella del backend):
 *   npm run sistema:nomi                 → mostra cosa farebbe, non scrive niente
 *   npm run sistema:nomi -- 40           → si ferma alle prime 40 (mostrate E, con CONFERMA, scritte)
 *   CONFERMA=1 npm run sistema:nomi      → applica a tutte
 *
 * ⚠️ Il numero limita **il lavoro**, non solo la stampa. Prima limitava la sola tabella: si
 * leggevano trenta righe e se ne scrivevano trecento — cioè si confermava alla cieca l'esatto
 * contrario di quello che si era appena letto.
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

  const tabella: Record<string, unknown>[] = [];
  const daScrivere: {
    userId: string; nome: string; cognome: string;
    svuotaAlias: boolean; crmId: string | null;
  }[] = [];
  let giaOk = 0;
  let senzaMateriale = 0;

  for (const u of utenti) {
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
      cliente: u.email,
      'com\'è ora': `nome «${u.firstName ?? '—'}» · cognome «${u.lastName ?? '—'}» · alias «${u.clientProfile?.name ?? '—'}»`,
      'diventa': `nome «${diviso.nome}» · cognome «${diviso.cognome}»`,
      alias: svuotaAlias ? 'svuotato (era il nome completo)' : (u.clientProfile?.name ? 'lasciato com\'è' : '—'),
    });
    daScrivere.push({ userId: u.id, nome: diviso.nome, cognome: diviso.cognome, svuotaAlias, crmId: u.crmRecord?.id ?? null });
  }

  console.log(`Clienti esaminate: ${utenti.length} · già a posto (hanno il cognome): ${giaOk} · senza materiale per dividere: ${senzaMateriale}`);
  if (tabella.length === 0) {
    console.log('\nNiente da sistemare ✓');
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
      fatti += 1;
    } catch (e) {
      console.log(`⚠️  ${x.userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n✓ Sistemate ${fatti} schede su ${daScrivereVere.length} lavorate (${totale} in tutto).`);
  if (totale > daScrivereVere.length) {
    console.log(`Ne restano ${totale - daScrivereVere.length}: rilancia il comando per continuare.`);
  }
  console.log('Le clienti che restano storte si correggono dalla loro scheda, campo Nome e Cognome.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
