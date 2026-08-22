/**
 * DIAGNOSTICA: **cosa mangia davvero chi ha scelto il digiuno**, e cosa manca alle 18 varianti.
 *
 * Nasce dalla richiesta di Simone del 17/8 («uno script che genera tutte le 18 varianti… e i
 * digiuni creati sono sbagliati»). Prima di generare qualcosa — o di spendere in chiamate all'AI —
 * servono due numeri che oggi non abbiamo, e questo script li stampa. **Non scrive niente.**
 *
 * ## Parte 1 — i digiuni
 *
 * La variante `fasting: true` in catalogo ha tre slot FISSI: pranzo, merenda, cena
 * (`engine-rules.service.ts`, `giornate-complete.ts`). Cioè è, di fatto, la variante «salta la
 * colazione», e nessun campo lo dice. Poi l'erogazione toglie dalla giornata gli slot della
 * finestra scelta dalla cliente (`slotEsclusiTotali`) — su un pool che la colazione non ce l'ha.
 *
 * ⚠️ Quindi chi ha scelto «salto la cena» dovrebbe ricevere colazione, spuntino e pranzo, e riceve
 * **il solo pranzo**. Questo script lo dice cliente per cliente, con nome ed email, confrontando i
 * pasti che la finestra promette con quelli che restano davvero.
 *
 * ## Parte 2 — le varianti
 *
 * Una famiglia (nome + stile) si declina su 3 regimi × 2 obiettivi × 3 strutture pasti = 18. Per
 * ognuna si stampa se esiste, se è approvata e quante settimane di giornate ha.
 *
 * E soprattutto si divide quello che manca in due mucchi molto diversi:
 *
 *  - **riempibile subito, senza AI**: manca solo la struttura pasti, e una variante sorella con lo
 *    stesso nome+stile+regime+obiettivo ha già le ricette. È il caso che il generatore stesso
 *    dichiara («le tre varianti di struttura CONDIVIDONO le ricette»);
 *  - **da generare con l'AI**: manca il REGIME o l'OBIETTIVO. Lì non si può riciclare niente —
 *    mettere una ricetta onnivora in una dieta vegana è l'errore che il generatore evita apposta, e
 *    servire un mantenimento con porzioni da dimagrimento è la stessa cosa in versione silenziosa.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:digiuni
 */
import { PrismaClient } from '@prisma/client';
import { FINESTRE_DIGIUNO, VALORI_FINESTRA_DIGIUNO, finestraDigiuno, slotEsclusiTotali } from '../src/menu/finestre-digiuno';
import { pastiPromessiCheMancano } from '../src/catalog/struttura-per-digiuno';
import { pickDietFor } from '../src/catalog/pick-diet';
import { pastiAttesi, NOME_PASTO } from '../src/catalog/giornate-complete';

const prisma = new PrismaClient();

const GIORNI_SETTIMANA = 7;
const REGIMI = ['omnivore', 'vegetarian', 'vegan'] as const;
const OBIETTIVI = ['dimagrimento', 'mantenimento'] as const;
/** Le tre strutture pasti della griglia, come le chiama il backoffice. */
const STRUTTURE = ['3', '5', 'fasting'] as const;

const TUTTI_GLI_SLOT = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];

/** Come si chiama questa cliente: il nome del profilo, poi quello dell'utente. Come `diag:cliente`. */
const nomeDi = (p: { name?: string | null; user?: { firstName?: string | null; lastName?: string | null } | null }): string =>
  p.name?.trim() || `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim() || '(senza nome)';

const inItaliano = (slots: string[]): string =>
  slots.length ? slots.map((s) => NOME_PASTO[s] ?? s).join(', ') : '— NIENTE —';

type DietaRiga = {
  id: string;
  name: string;
  style: string | null;
  regime: string;
  objective: string | null;
  mealsPerDay: number;
  fasting: boolean | null;
  status: string;
};

/** La struttura pasti di una riga `Diet`, nei termini della griglia. */
const strutturaDi = (d: { mealsPerDay: number; fasting: boolean | null }): string =>
  d.fasting ? 'fasting' : String(d.mealsPerDay);

// ─────────────────────────────────────────────────────────────────────────────
// Parte 1 — i digiuni
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ LE FINESTRE SCRITTE NEI PROFILI, **senza filtrare per percorso**.
 *
 * Il resto della parte 1 guarda solo chi ha `pathType: 'intermittent_fasting'`, ed è giusto così:
 * la finestra agisce solo là. Ma per **togliere una riga** dalla tabella delle finestre quella
 * misura non basta — dice quante clienti in digiuno ce l'hanno, non quante l'hanno *scritta in
 * profilo*. E il giorno che una riga sparisce dalla tabella, un valore rimasto scritto da qualche
 * parte diventa un codice al posto di una frase.
 *
 * ⚠️ **Da oggi in avanti quel residuo non si forma più**, e va detto per non spaventare chi legge:
 * tutte e due le porte di scrittura azzerano la finestra quando il percorso non è il digiuno
 * (`clients.service.ts`, `onboarding.service.ts`). Quello che questo conteggio può ancora trovare
 * sono le righe **rimaste da prima** di quella correzione — poche o nessuna, ma «poche o nessuna»
 * è una previsione, e questo script serve a sostituirla con un numero.
 *
 * Questo conteggio è nato il 21/8 per decidere su `skip_lunch`: il primo `diag:digiuni` diceva
 * «zero clienti», ma diceva zero **fra chi digiuna**. *Misura prima di decidere, e non spacciare
 * mai un ragionamento per una misura.*
 */
async function finestreScritteOvunque(): Promise<void> {
  // ⚠️ `findMany` e non `groupBy`: i profili sono poche centinaia, il conto in memoria costa niente,
  // e una query semplice qui vale più di una elegante — questo script gira in produzione a mano.
  const profili = (await prisma.clientProfile.findMany({
    where: { fastingWindow: { not: null } } as never,
    select: { fastingWindow: true, pathType: true } as never,
  })) as unknown as { fastingWindow: string | null; pathType: string | null }[];

  console.log('Finestre scritte nei profili — TUTTI i percorsi, non solo il digiuno:');
  if (!profili.length) {
    console.log('     0  nessun profilo ha una finestra scritta.\n');
    return;
  }
  const conta = new Map<string, number>();
  const fuoriDigiuno = new Map<string, number>();
  for (const p of profili) {
    const v = p.fastingWindow ?? '(null)';
    conta.set(v, (conta.get(v) ?? 0) + 1);
    if (p.pathType !== 'intermittent_fasting') fuoriDigiuno.set(v, (fuoriDigiuno.get(v) ?? 0) + 1);
  }
  for (const [v, n] of [...conta.entries()].sort((a, b) => b[1] - a[1])) {
    const riga = finestraDigiuno(v);
    // ⚠️ «Ritirata» non sta nell'etichetta: si legge da `selezionabile`, che è il punto unico.
    const etichetta = riga
      ? `${riga.etichettaStaff}${riga.selezionabile ? '' : '  [non più selezionabile]'}`
      : '⛔ VALORE CHE LA TABELLA NON CONOSCE';
    // ⚠️ La colonna che conta per togliere una riga: quante di quelle NON digiunano più, cioè
    // quante se la portano dietro senza che agisca. Sono invisibili al resto della parte 1.
    const fuori = fuoriDigiuno.get(v) ?? 0;
    console.log(`${String(n).padStart(6)}  ${v.padEnd(24)} ${fuori ? `(${fuori} fuori dal digiuno)  ` : ''}${etichetta}`);
  }
  const zero = VALORI_FINESTRA_DIGIUNO.filter((v) => !conta.has(v));
  console.log(
    `\n     Righe della tabella con ZERO profili sopra: ${zero.length ? zero.join(', ') : 'nessuna'}.\n` +
    '     ⚠️ Solo queste si possono togliere dalla tabella senza lasciare in giro un valore che\n' +
    '     nessuno sa più leggere. Le altre, al massimo, si tolgono dalle tendine.\n',
  );
}

async function digiuni(diete: DietaRiga[]): Promise<void> {
  console.log('\n════════ 1. CHI HA SCELTO IL DIGIUNO, E COSA RICEVE ════════\n');

  await finestreScritteOvunque();

  const profili = (await prisma.clientProfile.findMany({
    where: { pathType: 'intermittent_fasting' } as never,
    select: {
      userId: true, name: true, regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true,
      objective: true, pathType: true, fastingWindow: true, pastiEsclusi: true,
      // ⚠️ `User` non ha un campo `name`: ha `firstName` e `lastName`. Il nome «buono» è quello
      // scritto sul profilo (`ClientProfile.name`), e si ripiega sui due dell'utente — è lo stesso
      // ordine che usa `diag:cliente`, e due diagnostiche che chiamano la stessa persona in due modi
      // diversi costringono chi legge a capire quale delle due ha ragione.
      user: { select: { email: true, firstName: true, lastName: true } },
    } as never,
  })) as unknown as {
    userId: string; name: string | null; regime: string | null; dietStyle: string | null;
    dietFamily: string | null; mealsPerDay: number | null; objective: string | null;
    pathType: string | null; fastingWindow: string | null; pastiEsclusi: string[] | null;
    user: { email: string | null; firstName: string | null; lastName: string | null } | null;
  }[];

  if (!profili.length) {
    console.log('Nessuna cliente in digiuno intermittente. (Il difetto resta, ma oggi non tocca nessuno.)');
    return;
  }

  const perFinestra = new Map<string, number>();
  const rotte: Record<string, string>[] = [];
  const sane: Record<string, string>[] = [];
  /**
   * ⚠️ Chi è in digiuno SENZA finestra impostata sta in un elenco suo, e non fra le «rotte».
   *
   * Il 17/8 questo script ha stampato Maria fra le clienti che
   * «ricevono meno pasti di quelli promessi», e non era vero: senza finestra non si salta niente e
   * riceve il 16:8 classico. «Dovrebbe ricevere tutti e cinque i pasti» era una frase di questo
   * script, non una promessa fatta a lei — e un allarme che grida su un caso sano è il modo più
   * rapido per far smettere di credere alla lista (la lezione sta in `common/piano-attivo.ts`).
   * Il suo problema è reale ma è un altro: **la domanda non le è mai stata fatta.**
   */
  const senzaFinestra: Record<string, string>[] = [];

  for (const p of profili) {
    const finestra = p.fastingWindow ?? '(non impostata)';
    perFinestra.set(finestra, (perFinestra.get(finestra) ?? 0) + 1);

    // La dieta che il motore servirebbe ADESSO: stessa funzione dell'erogazione, nessuna copia.
    const servita = await pickDietFor<DietaRiga>(
      async (where) =>
        (await prisma.diet.findFirst({
          where: where as never,
          orderBy: { approvedAt: 'desc' },
          select: { id: true, name: true, style: true, regime: true, objective: true, mealsPerDay: true, fasting: true, status: true },
        })) as DietaRiga | null,
      p,
    );

    const esclusi = slotEsclusiTotali(p.pathType, p.fastingWindow, p.pastiEsclusi);
    // Quello che la finestra PROMETTE: tutti i pasti meno quelli che dice di saltare.
    const promessi = TUTTI_GLI_SLOT.filter((s) => !esclusi.has(s));
    // Quello che il catalogo può davvero servire: i pasti della dieta servita, meno gli esclusi.
    const inCatalogo = servita ? pastiAttesi(servita) : [];
    const ricevuti = inCatalogo.filter((s) => !esclusi.has(s));

    const riga = {
      cliente: `${nomeDi(p)} · ${p.user?.email ?? '—'}`,
      finestra,
      'dovrebbe ricevere': inItaliano(promessi),
      'riceve davvero': inItaliano(ricevuti),
      'dieta servita': servita ? `${servita.name} · ${servita.regime} · ${strutturaDi(servita)}` : '⚠️ NESSUNA',
    };

    // Senza finestra non c'è nessuna promessa da confrontare: si elenca e non si giudica.
    if (!finestraDigiuno(p.fastingWindow)) {
      senzaFinestra.push({
        cliente: riga.cliente,
        'riceve davvero': riga['riceve davvero'],
        'dieta servita': riga['dieta servita'],
      });
      continue;
    }

    /**
     * IL GIUDIZIO LO DÀ LA STESSA FUNZIONE DEL MOTORE, non un conto scritto qui.
     *
     * `pastiPromessiCheMancano` è quella che `menu.service` usa per decidere se scrivere
     * `fasting_meals_missing`. Prima questo script se lo calcolava da solo, e il 17/8 le due
     * risposte hanno divergito: il motore taceva su Maria (giustamente) e la diagnostica la
     * segnalava. Due definizioni della stessa domanda è il difetto che questo progetto paga più
     * spesso — qui basta chiamare la funzione che decide.
     */
    const mancanti = (
      // ⚠️ Nessuna dieta servita: mancano TUTTI i pasti promessi. Passare una dieta finta alla
      // funzione le farebbe rispondere sulla struttura sbagliata, cioè mentire in un caso grave.
      servita ? pastiPromessiCheMancano(p.pathType, p.fastingWindow, servita) : promessi
    )
      // Uno spuntino che la cliente ha CHIESTO di togliere non è un pasto che le manca.
      .filter((s) => !(p.pastiEsclusi ?? []).includes(s));
    if (mancanti.length) rotte.push({ ...riga, mancano: inItaliano(mancanti) });
    else sane.push(riga);
  }

  console.log(`Clienti in digiuno: ${profili.length}\n`);
  console.log('Per finestra scelta:');
  for (const f of FINESTRE_DIGIUNO) {
    const n = perFinestra.get(f.valore) ?? 0;
    console.log(`${String(n).padStart(6)}  ${f.etichettaStaff}`);
  }
  const senza = perFinestra.get('(non impostata)') ?? 0;
  if (senza) console.log(`${String(senza).padStart(6)}  ⚠️ finestra non impostata (i pasti li decide la dieta)`);

  if (senzaFinestra.length) {
    console.log(
      `\n❓ ${senzaFinestra.length} client${senzaFinestra.length === 1 ? 'e è' : 'i sono'} in digiuno SENZA finestra impostata.\n` +
      'Non è un difetto e non riceve meno del dovuto: senza finestra non si salta niente, e quello che\n' +
      'arriva è il 16:8 classico deciso dalla dieta. ⚠️ Quello che manca è LA DOMANDA — quali pasti\n' +
      'salta non le è mai stato chiesto, e la risposta cambierebbe cosa mangia.\n',
    );
    console.table(senzaFinestra);
  }

  if (rotte.length) {
    console.log(`\n⚠️ ${rotte.length} client${rotte.length === 1 ? 'e riceve' : 'i ricevono'} MENO pasti di quelli che la finestra promette:\n`);
    console.table(rotte);
    console.log(
      '\nNon è un arrotondamento: è un pasto che non arriva. Dal 17/8 il motore chiede un catalogo che\n' +
      'ABBIA i pasti della finestra (`catalog/struttura-per-digiuno.ts`), quindi se una riga è ancora\n' +
      'qui la causa è UNA: quella variante in catalogo non esiste, e l\'ultimo ripiego di `pickDietFor`\n' +
      'ha servito una struttura diversa. ⚠️ Il rimedio è generare la variante (parte 2 di questo\n' +
      'script dice se serve l\'AI o se è riempibile subito), NON toccare la scelta della dieta.\n' +
      'Le stesse righe le trovi nei log del backend come `fasting_meals_missing`.',
    );
  } else {
    console.log('\n✅ Nessuna cliente riceve meno pasti di quelli promessi dalla sua finestra.');
  }
  if (sane.length) {
    console.log(`\n${sane.length} client${sane.length === 1 ? 'e riceve' : 'i ricevono'} i pasti giusti:`);
    console.table(sane);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parte 2 — le 18 varianti
// ─────────────────────────────────────────────────────────────────────────────

async function varianti(diete: DietaRiga[]): Promise<void> {
  console.log('\n\n════════ 2. LE 18 VARIANTI, FAMIGLIA PER FAMIGLIA ════════\n');

  // Settimane di catalogo per dieta: il giorno più alto fra le giornate, come le conta il generatore.
  const perDieta = new Map<string, number>();
  for (const d of diete) {
    const ultimo = (await prisma.dietDayTemplate.findFirst({
      where: { dietId: d.id },
      orderBy: { dayIndex: 'desc' },
      select: { dayIndex: true },
    })) as { dayIndex: number } | null;
    perDieta.set(d.id, Math.ceil((ultimo?.dayIndex ?? 0) / GIORNI_SETTIMANA));
  }

  // Quante clienti stanno su ogni famiglia: è l'ordine in cui conviene lavorare.
  const clientiPerFamiglia = new Map<string, number>();
  const profili = (await prisma.clientProfile.findMany({
    select: { dietFamily: true },
  })) as unknown as { dietFamily: string | null }[];
  for (const p of profili) {
    if (!p.dietFamily) continue;
    clientiPerFamiglia.set(p.dietFamily, (clientiPerFamiglia.get(p.dietFamily) ?? 0) + 1);
  }

  const famiglie = new Map<string, DietaRiga[]>();
  for (const d of diete) {
    const k = `${d.name}\u0000${d.style ?? ''}`;
    if (!famiglie.has(k)) famiglie.set(k, []);
    famiglie.get(k)!.push(d);
  }

  let totRiempibili = 0;
  let totDaGenerare = 0;

  const ordinate = [...famiglie.entries()].sort(
    (a, b) => (clientiPerFamiglia.get(b[1][0].name) ?? 0) - (clientiPerFamiglia.get(a[1][0].name) ?? 0),
  );

  for (const [, righe] of ordinate) {
    const nome = righe[0].name;
    const stile = righe[0].style ?? '—';
    console.log(`\n── ${nome} (${stile}) · ${clientiPerFamiglia.get(nome) ?? 0} clienti ──`);

    const tabella: Record<string, string>[] = [];
    let riempibili = 0;
    let daGenerare = 0;

    for (const regime of REGIMI) {
      for (const objective of OBIETTIVI) {
        // Il «gruppo ricette» del generatore: nome + stile + regime + obiettivo, SENZA la struttura.
        const sorelle = righe.filter((d) => d.regime === regime && (d.objective ?? 'dimagrimento') === objective);
        const settimaneMax = Math.max(0, ...sorelle.map((d) => perDieta.get(d.id) ?? 0));
        const gruppoHaRicette = settimaneMax > 0;

        for (const struttura of STRUTTURE) {
          const esistente = sorelle.find((d) => strutturaDi(d) === struttura) ?? null;
          const sett = esistente ? (perDieta.get(esistente.id) ?? 0) : 0;
          let stato: string;
          if (esistente && sett >= 12 && esistente.status === 'approved') stato = '✅ completa';
          else if (esistente) stato = `${esistente.status} · ${sett}/12 settimane`;
          else if (gruppoHaRicette) { stato = `➕ manca — RIEMPIBILE (le sorelle hanno ${settimaneMax} sett.)`; riempibili++; }
          else { stato = '🤖 manca — serve l\'AI (nessuna ricetta per questo regime/obiettivo)'; daGenerare++; }

          tabella.push({ regime, obiettivo: objective, pasti: struttura, stato });
        }
      }
    }
    console.table(tabella);
    console.log(`   riempibili senza AI: ${riempibili} · da generare con l'AI: ${daGenerare}`);
    totRiempibili += riempibili;
    totDaGenerare += daGenerare;
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`TOTALE su ${famiglie.size} famiglie:`);
  console.log(`  ${String(totRiempibili).padStart(5)}  varianti riempibili SUBITO, senza una chiamata all'AI`);
  console.log(`  ${String(totDaGenerare).padStart(5)}  varianti che richiedono di generare ricette nuove`);
  console.log(
    '\nLe seconde costano: il generatore fa una settimana per volta, un pasto per volta. Prima di\n' +
    'spenderle vale la pena guardare la prima tabella — quante clienti stanno davvero su quel\n' +
    'regime e su quell\'obiettivo.',
  );
}

async function main(): Promise<void> {
  console.log('\n=== Metabole — digiuni serviti e griglia delle varianti (sola lettura) ===');

  const diete = (await prisma.diet.findMany({
    where: { status: { not: 'rejected' } } as never,
    select: {
      id: true, name: true, style: true, regime: true, objective: true,
      mealsPerDay: true, fasting: true, status: true,
    },
    orderBy: [{ name: 'asc' }, { regime: 'asc' }],
  })) as unknown as DietaRiga[];

  await digiuni(diete);
  await varianti(diete);

  console.log('\nFine. Questo script non ha scritto niente.\n');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore:', (e as Error)?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
