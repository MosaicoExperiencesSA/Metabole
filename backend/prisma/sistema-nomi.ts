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
 *   CERTEZZA=sicuri                      → solo le divisioni senza ambiguità (2 parole, o
 *                                          3+ con una particella): niente da rileggere
 *   CERTEZZA=dubbi                       → solo quelle da rivedere a mano (3+ parole senza
 *                                          particella: nome composto o cognome doppio?)
 *
 * ⚠️ Il numero limita **il lavoro**, non solo la stampa. Prima limitava la sola tabella: si
 * leggevano trenta righe e se ne scrivevano trecento — cioè si confermava alla cieca l'esatto
 * contrario di quello che si era appena letto. Il limite vale sul TOTALE delle due liste, clienti
 * prima: così «40» significa 40 scritture, non 40 per lista.
 */
import { PrismaClient } from '@prisma/client';
import { certezzaDivisione, dividiNome } from '../src/common/dividi-nome';

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
  // Secondo asse, indipendente da SOLO: quali divisioni lavorare.
  //   '' = tutte · 'sicuri' = solo quelle senza ambiguità · 'dubbi' = solo quelle da rivedere
  const certezza = (process.env.CERTEZZA ?? '').toLowerCase();
  const tabella: Record<string, unknown>[] = [];
  /**
   * Una sola coda per due liste: il limite deve valere sul totale, altrimenti «40» diventa
   * «40 clienti e 40 lead» e chi legge trenta righe se ne ritrova ottanta scritte.
   */
  type Certezza = 'sicuro' | 'da_controllare';
  const daScrivere: (
    | { tipo: 'cliente'; esito: Certezza; userId: string; nome: string; cognome: string; svuotaAlias: boolean; crmId: string | null }
    | { tipo: 'lead'; esito: Certezza; crmId: string; nome: string; cognome: string; svuotaAlias: boolean }
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
    const esito = certezzaDivisione(intero);
    tabella.push({
      chi: 'cliente',
      esito: esito === 'sicuro' ? 'sicuro' : '⚠️ da controllare',
      contatto: u.email,
      'com\'è ora': `nome «${u.firstName ?? '—'}» · cognome «${u.lastName ?? '—'}» · alias «${u.clientProfile?.name ?? '—'}»`,
      'diventa': `nome «${diviso.nome}» · cognome «${diviso.cognome}»`,
      alias: svuotaAlias ? 'svuotato (era il nome completo)' : (u.clientProfile?.name ? 'lasciato com\'è' : '—'),
    });
    daScrivere.push({ tipo: 'cliente', esito, userId: u.id, nome: diviso.nome, cognome: diviso.cognome, svuotaAlias, crmId: u.crmRecord?.id ?? null });
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
      const esito = certezzaDivisione(intero);
      tabella.push({
        chi: 'lead',
        esito: esito === 'sicuro' ? 'sicuro' : '⚠️ da controllare',
        contatto: l.email ?? l.phone ?? '(senza contatto)',
        'com\'è ora': `nome «${l.firstName ?? '—'}» · cognome «${l.lastName ?? '—'}» · name «${l.name ?? '—'}»`,
        'diventa': `nome «${diviso.nome}» · cognome «${diviso.cognome}»`,
        alias: svuotaAlias ? 'svuotato (era il nome completo)' : (l.alias ? 'lasciato com\'è' : '—'),
      });
      daScrivere.push({ tipo: 'lead', esito, crmId: l.id, nome: diviso.nome, cognome: diviso.cognome, svuotaAlias });
    }
    console.log(`Lead senza account: ${leadEsaminati} · già a posto: ${leadGiaOk} · senza materiale per dividere: ${leadSenzaMateriale}`);
  }
  if (tabella.length === 0) {
    console.log('\nNiente da sistemare ✓  (clienti E lead: hanno già nome e cognome separati)');
    return;
  }
  // ---------- Filtro per certezza (8/8) ----------
  // «Leggi la colonna prima di confermare» non è praticabile su cinquecento righe: va detto QUALI
  // righe leggere. I nomi di due parole, e quelli con una particella in mezzo, non hanno
  // alternative — si applicano senza rileggerli. Il dubbio vive solo nei tre-e-più parole senza
  // particella, dove «Maria Grazia Cerchiara» e «Anna Rossi Bianchi» hanno la stessa forma.
  const nSicuri = daScrivere.filter((x) => x.esito === 'sicuro').length;
  const nDubbi = daScrivere.length - nSicuri;
  if (certezza === 'sicuri' || certezza === 'dubbi') {
    const voluto = certezza === 'sicuri' ? 'sicuro' : 'da_controllare';
    // Le due liste sono allineate per indice: si filtrano insieme o la tabella mente.
    for (let i = daScrivere.length - 1; i >= 0; i--) {
      if (daScrivere[i].esito !== voluto) { daScrivere.splice(i, 1); tabella.splice(i, 1); }
    }
    console.log(`Filtro CERTEZZA=${certezza}: lavoro ${daScrivere.length} righe su ${nSicuri + nDubbi}.`);
  } else {
    console.log(`Divisioni sicure: ${nSicuri} · da controllare a mano: ${nDubbi}`);
    if (nDubbi > 0) {
      console.log(
        '  → CERTEZZA=sicuri npm run sistema:nomi   applica solo le sicure (nessuna da rileggere)\n' +
        '  → CERTEZZA=dubbi  npm run sistema:nomi   mostra SOLO le dubbie, per rivederle',
      );
    }
  }
  if (tabella.length === 0) {
    console.log('\nNiente da sistemare con questo filtro ✓');
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
    '\nLa regola è: ULTIMA parola = cognome, con le particelle attaccate (De, Di, Della…).\n' +
    'Le righe «sicuro» non hanno alternative: puoi confermarle senza rileggerle.\n' +
    'Guarda la colonna «diventa» SOLO sulle «⚠️ da controllare»: là dentro «Anna Rossi Bianchi»\n' +
    '(cognome doppio) e «Maria Grazia Cerchiara» (nome composto) hanno la stessa forma, e la\n' +
    'regola sceglie sempre la seconda. Chi conosce quella persona lo vede in un secondo.',
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
