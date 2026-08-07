/**
 * RIPARAZIONE: spezie finite fra i "cibi non graditi" prima che esistesse la regola.
 *
 * Dall'8/8 una spezia non entra più fra i cibi esclusi (`src/menu/spezie.ts`): la regola l'ha
 * dettata la nutrizionista, e nasce da un caso vero. Una cliente aveva accumulato trenta
 * esclusioni — fra cui **curry** e **cumino** — e riceveva lo stesso pranzo per quattro giorni
 * di fila: ogni spezia esclusa cancella dal ricettario TUTTI i piatti che la contengono, e il
 * pool utilizzabile si era ridotto a un piatto su cinque.
 *
 * La regola nuova protegge chi arriva da qui in avanti. Chi ha già la spezia in lista continua
 * a subirla: questo script la toglie.
 *
 * Cosa NON tocca, di proposito:
 *  - `allergies` e `intolerances`: quella è sicurezza, non gusto, e non si tocca da uno script;
 *  - i cibi veri (funghi, verza, lenticchie…): restano esattamente dov'erano;
 *  - i menu già erogati: si riallineano da soli alla prossima erogazione. Togliere la spezia
 *    dalla lista basta a riaprire il ricettario, e rifare i giorni già consegnati confonderebbe
 *    chi ha già fatto la spesa.
 *
 * Il termine generico "spezie" viene tolto come gli altri, ma la cliente finisce in un elenco a
 * parte: lì la risposta non è tecnica ma una conversazione con la coach, e va fatta da una
 * persona.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run pulisci:spezie              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run pulisci:spezie   → applica
 */
import { PrismaClient } from '@prisma/client';
import { classificaSpezia } from '../src/menu/spezie';

const prisma = new PrismaClient();

type Riga = {
  cliente: string;
  email: string;
  tolte: string;
  restano: number;
};

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const profili = (await prisma.clientProfile.findMany({
    select: { userId: true, name: true, dislikedFoods: true, user: { select: { email: true } } },
  })) as {
    userId: string;
    name: string | null;
    dislikedFoods: string[] | null;
    user: { email: string } | null;
  }[];

  const daScrivere: { userId: string; tenuti: string[] }[] = [];
  const tabella: Riga[] = [];
  const daSentire: Riga[] = [];

  for (const p of profili) {
    const attuali = (p.dislikedFoods ?? []).filter((s) => (s ?? '').trim());
    if (attuali.length === 0) continue;

    const tenuti: string[] = [];
    const tolte: string[] = [];
    let generica = false;
    for (const c of attuali) {
      const esito = classificaSpezia(c);
      if (esito.tipo === 'nessuna') tenuti.push(c);
      else {
        tolte.push(c);
        if (esito.tipo === 'generica') generica = true;
      }
    }
    if (tolte.length === 0) continue;

    const riga: Riga = {
      cliente: p.name ?? '(senza nome)',
      email: p.user?.email ?? '—',
      tolte: tolte.join(', '),
      restano: tenuti.length,
    };
    daScrivere.push({ userId: p.userId, tenuti });
    tabella.push(riga);
    if (generica) daSentire.push(riga);
  }

  if (tabella.length === 0) {
    console.log(`Esaminati ${profili.length} profili: nessuna spezia fra i cibi esclusi ✓`);
    return;
  }

  console.log(`Esaminati ${profili.length} profili. Da ripulire: ${tabella.length}.\n`);
  console.table(tabella);
  console.log(
    '\n"restano" è quanti cibi VERI restano esclusi dopo la pulizia. Se è ancora alto (oltre una\n' +
    'decina) il pool di quella cliente è comunque stretto: vale la pena guardarla con\n' +
    '`npm run diag:varieta -- <email>` anche dopo aver applicato.',
  );

  if (daSentire.length) {
    console.log(`\n--- Da sentire: ${daSentire.length} clienti che avevano escluso "le spezie" in generale ---`);
    console.table(daSentire);
    console.log(
      'Qui non basta togliere la voce: la nutrizionista chiede che sia la coach a parlarne con\n' +
      'lei, per capire come usare i menu senza spezie. Il termine viene tolto lo stesso (altrimenti\n' +
      'continua a svuotarle il ricettario), ma la telefonata va fatta.',
    );
  }

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run pulisci:spezie');
    return;
  }

  for (const { userId, tenuti } of daScrivere) {
    await prisma.clientProfile.update({
      where: { userId },
      data: { dislikedFoods: tenuti } as never,
    });
  }
  console.log(`\n✓ Spezie tolte dai cibi esclusi di ${daScrivere.length} clienti.`);
  console.log('I menu già consegnati restano come sono; i prossimi ripartono dal ricettario pieno.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
