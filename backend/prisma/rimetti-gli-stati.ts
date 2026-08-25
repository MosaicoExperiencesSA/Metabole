/**
 * RIMETTE LO STATO CHE IL SEED AVEVA AZZERATO — voce `seed-nutrienti-firma-falsa`, coda del difetto.
 *
 * ## Cosa è successo (misurato il 20/8 sera, non dedotto)
 *
 * `prisma/seed-valori-nutrizionali.ts` scriveva `state: r.state ?? null`: su una riga che il seed
 * non porta con lo stato, quel `?? null` non vuol dire «non ho questo campo», vuol dire
 * **«azzeralo»**. Undici righe caricate dal foglio quindici minuti prima hanno perso la colonna che
 * chi ha compilato il foglio aveva scritto — e sono alimenti usati in migliaia di ricette.
 *
 * ✅ **La causa è corretta** (`datiDellaRiga` costruisce l'oggetto solo coi campi che ci sono, e
 * `seed-non-azzera.spec.ts` lo tiene fermo). ⛔ Ma correggere la causa non rimette il dato: in
 * tabella lo stato è ancora vuoto. Questo script rimette **quelle** righe, e nessun'altra.
 *
 * ## ⛔ PERCHÉ UN ELENCO A MANO E NON «TUTTO IL FOGLIO»
 *
 * La prima versione leggeva i due fogli del repo e rimetteva lo stato **a chiunque non ce l'avesse,
 * accoppiando sul nome**. La revisione avversariale del 25/8 l'ha smontata, misurando:
 *
 *  · ⛔ **avrebbe scritto `secco` su righe che in tabella hanno i valori da BOLLITO.** `ceci` in
 *    tabella è a 132 kcal (bollito), nel foglio è `secco` a 334. `secco` vale «a crudo» per il
 *    motore: 80 g di ceci sarebbero diventati 106 kcal invece di 267, **e l'avviso «stato ignoto»
 *    che oggi lo ferma sarebbe sparito**. Il difetto che `stato-alimento.ts` esiste per impedire,
 *    introdotto dallo script che doveva ripararne un altro;
 *  · ⛔ **la colonna `state` del foglio 20/8 non è affidabile**: `aceto di riso → secco`,
 *    `acqua filtrata → crudo` mentre `acqua → liquido`. Quel foglio dichiara **esso stesso** che 173
 *    righe su 245 nascono da un riempimento automatico. Chiamarla «scritta da una persona» era falso;
 *  · ⛔ e in sei casi il foglio 20/8 **ribaltava** il 19/8 (carote crudo → bollite), disfacendo una
 *    correzione fatta a mano il 20/8 sera con tanto di motivo scritto.
 *
 * ✅ Quindi: **undici righe, nominate una per una**, con lo stato che il foglio del 20/8 aveva per
 * loro e le kcal con cui devono combaciare. Non è meno automatico per prudenza: è che «rimetti la
 * colonna a tutti quelli che non ce l'hanno» era un'altra cosa da quella che serviva.
 *
 * ## Le tre condizioni per scrivere, tutte e tre insieme
 *
 *  1. il nome combacia **esatto** (normalizzato come lo normalizza la ricerca degli alimenti);
 *  2. lo stato in tabella è **vuoto** (`NULL` o stringa vuota): una riga che uno stato ce l'ha non
 *     si tocca nemmeno per «uniformarla», perché potrebbe essere una correzione di una nutrizionista;
 *  3. le **kcal combaciano** con quelle attese. È l'impronta digitale della riga: se «burro» in
 *     tabella non fa più 758 kcal, non è la riga che questo script conosce, e scriverci sopra uno
 *     stato vorrebbe dire indovinare.
 *
 * ⚠️ **Nessuna di queste undici diventa «solo da cotto»**, e questo va detto perché è l'altro modo
 * di fare danno: `normalizzaStato` legge `crudo`/`cruda` → `crudo`, `secco` → `secco`, `fresco` →
 * `crudo`, e sono tutti stati «a crudo», cioè la convenzione con cui le grammature sono scritte.
 * Uno stato «bollito» su una di queste **toglierebbe** l'alimento dalle ricette invece di rimetterlo
 * in ordine. Misurato con la funzione vera, non dedotto dai nomi.
 *
 * ⚠️ **La firma non si tocca**, e non serve toccarla: queste undici righe stanno nella tabella
 * firmata dal capo nutrizionista il 18/8 — quello che mancava era la colonna, non lo sguardo.
 *
 * ⚠️ **E il seed non le disferà**: `VALORI` non porta `state` per nessuna di queste undici (è
 * esattamente il motivo per cui il `?? null` le aveva svuotate), e dal 20/8 il seed scrive solo i
 * campi che ha. Verificato riga per riga in `seed-valori-nutrizionali.ts`.
 *
 * ⚠️ **Quello che questo script NON decide**: per il miele — e per l'olio, che qui dentro non c'è —
 * la risposta giusta potrebbe essere «non si applica» invece di «crudo»: crudo o cotto sono la
 * stessa cosa. Quella è una **dichiarazione** che scrive una persona (voce `tabella-alimenti-igiene`),
 * non un ripristino. Qui si rimette quello che il foglio diceva, e chi passa di lì corregge.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run ripara:stati                  → guarda e stampa riga per riga, NON scrive
 *   CONFERMA=1 npm run ripara:stati       → scrive quello che la prova a vuoto ha elencato
 */
import { PrismaClient } from '@prisma/client';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';

/**
 * Le undici righe, con lo stato del foglio del 20/8 e le kcal che devono avere per essere loro.
 *
 * ⚠️ Le kcal vengono da `seed-valori-nutrizionali.ts`, cioè dalla riga che il seed riscrive a ogni
 * deploy: è il valore che quella riga **ha davvero** in tabella, non un valore sperato.
 */
const DA_RIMETTERE: { nome: string; stato: string; kcal: number }[] = [
  { nome: 'burro', stato: 'crudo', kcal: 758 },
  { nome: 'mandorle', stato: 'secco', kcal: 628 },
  { nome: 'noci', stato: 'secco', kcal: 702 },
  { nome: 'mela', stato: 'cruda', kcal: 44 },
  { nome: 'pera', stato: 'cruda', kcal: 43 },
  { nome: 'fragole', stato: 'crudo', kcal: 30 },
  { nome: 'avocado', stato: 'crudo', kcal: 238 },
  { nome: 'parmigiano reggiano', stato: 'fresco', kcal: 397 },
  { nome: 'miele', stato: 'crudo', kcal: 304 },
  { nome: 'pane integrale', stato: 'secco', kcal: 224 },
  { nome: 'ricotta di vacca', stato: 'fresco', kcal: 146 },
];

/** Le kcal in tabella sono decimali: si confrontano con una tolleranza, non con `===`. */
const STESSE_KCAL = 1;

interface Riga {
  id: string;
  name: string;
  state: string | null;
  kcal: number | null;
  verifiedAt: Date | null;
}

async function main(): Promise<void> {
  console.log(
    CONFERMA
      ? '⚠️ CONFERMA=1: SCRIVO sul database a cui punta DATABASE_URL.\n'
      : 'Prova a vuoto: guardo e stampo, non scrivo niente.\n',
  );

  const righe = (await prisma.nutrientFact.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, state: true, kcal: true, verifiedAt: true },
  } as never)) as unknown as Riga[];
  const perNome = new Map<string, Riga[]>();
  for (const r of righe) {
    const chiave = normalizzaNome(r.name);
    perNome.set(chiave, [...(perNome.get(chiave) ?? []), r]);
  }

  const daScrivere: { riga: Riga; stato: string }[] = [];
  const fermate: string[] = [];

  for (const atteso of DA_RIMETTERE) {
    const candidate = perNome.get(normalizzaNome(atteso.nome)) ?? [];
    if (candidate.length === 0) {
      fermate.push(`«${atteso.nome}»: in tabella non c'è nessuna riga con questo nome.`);
      continue;
    }
    /**
     * ⚠️ `name` è unico in tabella, ma unico **con le maiuscole e gli accenti**: «Burro» e «burro»
     * possono coesistere e normalizzano uguale. Due righe per lo stesso nome vuol dire che non si sa
     * quale sia quella giusta, e allora non si sceglie.
     */
    if (candidate.length > 1) {
      fermate.push(`«${atteso.nome}»: ${candidate.length} righe con questo nome. Non scelgo io quale.`);
      continue;
    }
    const riga = candidate[0];
    if ((riga.state ?? '').trim() !== '') {
      fermate.push(`«${atteso.nome}»: lo stato c'è già (${riga.state}) — non si tocca.`);
      continue;
    }
    if (riga.kcal === null || Math.abs(riga.kcal - atteso.kcal) > STESSE_KCAL) {
      fermate.push(
        `«${atteso.nome}»: kcal ${riga.kcal ?? '(vuote)'} invece di ${atteso.kcal}. ` +
          'Non è la riga che conosco: scriverci uno stato sarebbe indovinare.',
      );
      continue;
    }
    daScrivere.push({ riga, stato: atteso.stato });
  }

  console.log(`## DA RIMETTERE A POSTO — ${daScrivere.length} righe su ${DA_RIMETTERE.length}\n`);
  for (const { riga, stato } of daScrivere) {
    console.log(
      `  ${riga.name.padEnd(24)} stato: (vuoto) → ${stato.padEnd(8)} ${String(riga.kcal).padStart(4)} kcal` +
        `${riga.verifiedAt ? '   ✍️ confermata dal capo (la firma non si tocca)' : ''}`,
    );
  }

  if (fermate.length > 0) {
    console.log(`\n## NON TOCCATE — ${fermate.length}\n`);
    for (const f of fermate) console.log(`  ⏭️  ${f}`);
  }

  console.log(
    '\n⚠️ Qui si rimette la colonna che il seed aveva azzerato, non si decide qual è la risposta giusta.\n' +
      '   Per il miele (e per l\'olio, che qui non c\'è) la risposta vera può essere «non si applica»:\n' +
      '   quella la scrive una persona dalla pagina Alimenti — è la voce `tabella-alimenti-igiene`.',
  );

  if (!CONFERMA) {
    console.log(`\n⚠️ PROVA A VUOTO: non ho scritto niente. Per scrivere le ${daScrivere.length} righe qui sopra:`);
    console.log('   CONFERMA=1 npm run ripara:stati');
    return;
  }

  let scritte = 0;
  let saltate = 0;
  let fallite = 0;
  for (const { riga, stato } of daScrivere) {
    try {
      /**
       * ⚠️ **Le tre condizioni si ripetono nella `where`, non solo nel controllo di sopra.** Fra la
       * prova a vuoto e il `CONFERMA=1` può passare del tempo, e in mezzo qualcuno può aver messo
       * lo stato dalla pagina Alimenti: senza queste righe glielo riscriveremmo sopra.
       * ⚠️ E lo stato vuoto si guarda **in tutti e due i modi**: `POST /nutrient-facts` scrive
       * `state: body.state ?? null`, e `??` non trasforma la stringa vuota in `NULL`. Una riga con
       * `state = ''` è vuota per chi la legge e piena per un `state: null`.
       */
      const esito = await prisma.nutrientFact.updateMany({
        where: { id: riga.id, OR: [{ state: null }, { state: '' }] } as never,
        data: { state: stato } as never,
      });
      if (esito.count === 1) scritte += 1;
      else {
        saltate += 1;
        console.log(`  ⏭️  «${riga.name}» non scritta: la riga non è più come l'avevo trovata (stato messo da qualcuno, o riga sparita).`);
      }
    } catch (err) {
      fallite += 1;
      console.log(`  ⛔ «${riga.name}» non scritta: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  /**
   * ⚠️ Si contano gli esiti, non le intenzioni, e i tre conti **tornano**: scritte + saltate +
   * fallite = quelle che ci si era proposti. «12 rimesse» con il database caduto a metà è un guasto
   * che si racconta come successo, e una differenza non spiegata è la stessa cosa più educata.
   */
  console.log(`\n✅ Scritte ${scritte} · saltate ${saltate} · fallite ${fallite} — su ${daScrivere.length} previste.`);
  if (fallite > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
