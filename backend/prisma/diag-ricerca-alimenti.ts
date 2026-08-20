/**
 * DIAGNOSTICA: **quanto è grosso il difetto del «pezzo di parola»** — sola lettura.
 *
 * Nasce dalla revisione avversariale del 19/8 sera e dalla voce «Gaia trova "mela" dentro
 * "melanzane"». ⚠️ Non è un difetto nuovo: è come la ricerca degli alimenti ha sempre funzionato.
 * Per rispondere a «quante calorie ha X?» si cercano i nomi della tabella **dentro** il testo della
 * domanda, e i pezzi di testo si incastrano dove non dovrebbero:
 *
 *     «melanzane»  contiene  «mela»       18 kcal contro 44
 *     «risotto»    contiene  «riso»
 *     «panettone»  contiene  «pane»
 *
 * ⛔ **Il danno è che il numero sbagliato è plausibile**: nessuno controlla «44 kcal» su una
 * melanzana. E la strada vera è `cercaTutti` (non `cerca`): `schedaPerRisposta` chiama lei, e ci
 * passa **ogni** risposta di Gaia sui numeri.
 *
 * ## ⚠️ PERCHÉ NON L'HO CORRETTO E BASTA
 *
 * Perché lo **stesso** meccanismo che sbaglia è quello che salva:
 *
 *     «pomodorini»  trova la riga  «pomodori»    e va bene
 *     «melanzane»   trova la riga  «mela»        e non va bene
 *
 * In tutti e due i casi il nome della riga è un pezzo della parola scritta dalla cliente, e da fuori
 * non si distinguono. Cercare solo **parole intere** li toglie tutti e due. Quante ne salva e quante
 * ne sbaglia non si indovina: si conta.
 *
 * ⚠️ **E questa diagnostica non dice quale delle due sia**: mette in fila la coppia
 * «riga trovata ⊂ parola della domanda» e la fa leggere. Chiamare «costo» tutta la colonna sarebbe
 * la bugia comoda — la maggior parte di quelle righe potrebbero essere proprio gli errori.
 *
 * ## COSA FA
 *
 * 1. **Le trappole della tabella**: quali nomi si incastrano dentro un altro nome di cibo, e quali
 *    di quelle trappole possono davvero scattare (cioè: la parola lunga in tabella **non c'è**, e
 *    quindi non può vincere lei).
 * 2. **Le domande vere**: ripassa i messaggi delle clienti attraverso il codice di produzione, due
 *    volte — com'è oggi e a parole intere — e conta dove le due risposte **differiscono**.
 *
 * ⚠️ **Usa il codice vero, non una copia.** Il modo di cercare è un parametro di `cercaTutti`
 * (`nome-dentro-la-domanda.ts`): una diagnostica che si riscrive la regola misura la propria copia,
 * e la copia è sempre un po' diversa dall'originale.
 *
 * ⚠️ **NON STAMPA IL TESTO DEI MESSAGGI**, mai — né una frase, né un nome di persona, né una data.
 * Quello che una cliente scrive alla nutrizionista è materia sanitaria. Escono due cose sole: i
 * **nomi degli alimenti** che le due ricerche hanno trovato, e — dove serve a capire — la **singola
 * parola** che conteneva il nome («melanzane»), che senza la frase intorno non dice niente di
 * nessuno. Nient'altro, e i conteggi.
 *
 * ⚠️ Non scrive niente e non cambia il modo di cercare. ✅ **Il 19/8 sera Simone ha letto questi
 * numeri e ha scelto le parole intere**, che sono in produzione dalla consegna dopo. La misura resta
 * viva per due ragioni: la sezione 1 è la **lista della spesa** della tabella alimenti in ordine di
 * urgenza (ogni trappola aperta è un alimento vero che manca), e la sezione 2 dirà se un giorno il
 * pezzo di parola è tornato a valere qualcosa.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:ricerca
 *   QUANTI=40 npm run diag:ricerca      quante righe di elenco mostrare
 *   MESSAGGI=20000 npm run diag:ricerca quanti messaggi ripassare (default 5000, i più recenti)
 */
import { PrismaClient } from '@prisma/client';
import { domandaNutrizionale } from '../src/chat/domanda-nutrizionale';
import { ValoriNutrizionaliService, normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';
import { paroleChe } from '../src/nutrient-facts/abbinamento-alimenti';
import { MODO_DI_OGGI } from '../src/nutrient-facts/nome-dentro-la-domanda';

const prisma = new PrismaClient();
const QUANTI = Math.max(1, Number(process.env.QUANTI ?? 20) || 20);
const MESSAGGI = Math.max(1, Number(process.env.MESSAGGI ?? 5000) || 5000);

/**
 * ⚠️ IL SERVIZIO VERO, con dentro il client vero: è il punto di tutta la diagnostica.
 *
 * ⚠️ **Con una sola libertà, e va dichiarata**: `cercaTutti` rilegge l'intera tabella alimenti a
 * ogni chiamata — che in produzione va benissimo (una domanda alla volta) e qui vorrebbe dire
 * **diecimila letture identiche** su una banca dati che sta servendo delle clienti. Quindi il
 * client che passo al servizio ha `nutrientFact.findMany` **memorizzato per la durata dello
 * script**: la tabella si legge una volta e basta.
 *
 * ⛔ Non è un cambio di comportamento: dentro una diagnostica in sola lettura la tabella non cambia,
 * e le due ricerche vedono esattamente le stesse righe. Se un giorno questa diagnostica dovesse
 * scrivere, questa riga va tolta per prima.
 */
let tabellaLetta: unknown[] | null = null;
const prismaPerIlServizio = new Proxy(prisma, {
  get(target, prop) {
    if (prop !== 'nutrientFact') return (target as never)[prop];
    return {
      findMany: async (...args: unknown[]) => {
        if (!tabellaLetta) tabellaLetta = await (target as never as typeof prisma).nutrientFact.findMany(...(args as []));
        return tabellaLetta;
      },
    };
  },
}) as typeof prisma;
const valori = new ValoriNutrizionaliService(prismaPerIlServizio as never);

const nomiDi = (a: { name: string; synonyms: string[] }) =>
  [a.name, ...(a.synonyms ?? [])].map(normalizzaNome).filter((n) => n.length >= 3);

async function trappoleDellaTabella() {
  console.log('==================================================================');
  console.log('  1) LE TRAPPOLE DELLA TABELLA — nomi che stanno dentro altre parole');
  console.log('==================================================================');
  console.log('');

  const alimenti = (await prisma.nutrientFact.findMany({
    select: { name: true, synonyms: true } as never,
  })) as { name: string; synonyms: string[] }[];
  const ricette = (await prisma.recipe.findMany({
    where: { active: true },
    select: { ingredients: true } as never,
  })) as { ingredients: unknown }[];

  /**
   * Il vocabolario del cibo che gira davvero: i nomi in tabella + le parole degli ingredienti.
   *
   * ⚠️ **E accanto a ogni parola, i nomi INTERI in cui compare** (20/8). Prima si stampava solo la
   * parola, e per decidere cosa farne bisognava indovinare: leggendo «denocciolate → nocciola» non
   * si può sapere se serve una **riga nuova** in tabella o basta un **sinonimo** su una riga che c'è
   * già — dipende da com'è scritto l'ingrediente per intero («olive nere denocciolate» è un'altra
   * cosa da «prugne denocciolate»).
   *
   * ⛔ Ci sono cascato io stamattina: ho ragionato su «denocciolate» come se l'ingrediente fosse
   * «olive denocciolate», e stavo per proporre una regola su un nome che non ho mai visto. *Una
   * diagnostica che costringe chi la legge a immaginare il dato è una diagnostica che si legge
   * male.*
   */
  const quante = new Map<string, number>();
  const nomiInteri = new Map<string, Map<string, number>>();
  for (const r of ricette) {
    if (!Array.isArray(r.ingredients)) continue;
    for (const i of r.ingredients as { name?: unknown }[]) {
      if (typeof i?.name !== 'string') continue;
      const intero = normalizzaNome(i.name);
      for (const p of paroleChe(intero)) {
        if (p.length < 4) continue;
        quante.set(p, (quante.get(p) ?? 0) + 1);
        const dentro = nomiInteri.get(p) ?? new Map<string, number>();
        dentro.set(intero, (dentro.get(intero) ?? 0) + 1);
        nomiInteri.set(p, dentro);
      }
    }
  }
  /** I due nomi interi più frequenti in cui quella parola compare: bastano a capire di cosa si parla. */
  const comeLoScrivono = (parola: string): string => {
    const dentro = [...(nomiInteri.get(parola) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
    if (!dentro.length) return '';
    return dentro.slice(0, 2).map(([n, q]) => `«${n}» ×${q}`).join(' · ');
  };
  const inTabella = new Set(alimenti.flatMap(nomiDi));
  const paroleInTabella = new Set([...inTabella].flatMap((n) => paroleChe(n)));
  /**
   * ⚠️ **COME SI CHIAMA DAVVERO** — e questa riga nasce da un mio errore del 20/8 mattina.
   *
   * Qui si lavora su nomi **normalizzati** (senza accenti né apostrofi), perché è così che si
   * confrontano. Ma stampare la forma normalizzata fa sembrare **rotta** una riga che è giusta: ho
   * letto «purea → risponderebbe **pure**» e ho scritto a Simone che in tabella c'era una riga
   * chiamata «pure», «probabilmente un *purè* a cui è caduto l'accento in fase di import».
   *
   * ⛔ Non era vero: l'import scrive il nome **verbatim**, `normalizzaNome` serve solo ai confronti.
   * Quel «pure» era la stampa di un «purè» perfettamente in ordine — cioè **la diagnostica aveva
   * mangiato l'accento e io ho dato la colpa ai dati**. Gli ho fatto cercare un fantasma.
   *
   * ⚠️ *Una diagnostica che mostra i nomi storpiati manda le persone a caccia di errori che non ci
   * sono, e ci va per prima chi l'ha scritta.* Adesso si stampa il nome vero, e la forma
   * normalizzata resta dov'è: dentro i confronti, dove serve.
   */
  const nomeVero = new Map<string, string>();
  for (const a of alimenti) {
    for (const n of [a.name, ...(a.synonyms ?? [])]) {
      const k = normalizzaNome(n);
      if (k && !nomeVero.has(k)) nomeVero.set(k, n);
    }
  }
  const comeSiChiama = (n: string) => (nomeVero.get(n) === n ? n : `${nomeVero.get(n) ?? n}`);

  const trappole: { corto: string; lungo: string; quante: number; scatta: boolean }[] = [];
  for (const corto of inTabella) {
    if (corto.includes(' ')) continue; // ⚠️ un nome di più parole non si incastra dentro una parola
    for (const [parola, n] of quante) {
      if (parola === corto || !parola.includes(corto)) continue;
      /**
       * ⚠️ **Scatta davvero solo se la parola lunga in tabella non c'è.** Se «melanzane» c'è, vince
       * lei perché la ricerca prende il nome più lungo che combacia, e la trappola resta chiusa.
       * Contarle tutte come danno gonfierebbe il numero — ed è il modo più veloce di far ignorare
       * una diagnostica.
       */
      const scatta = !inTabella.has(parola) && !paroleInTabella.has(parola);
      trappole.push({ corto, lungo: parola, quante: n, scatta });
    }
  }
  trappole.sort((a, b) => Number(b.scatta) - Number(a.scatta) || b.quante - a.quante);

  const scattano = trappole.filter((t) => t.scatta);
  /**
   * ⚠️ **QUESTA INTESTAZIONE MENTIVA DAL 19/8 SERA, E L'HO VISTA SOLO RILEGGENDO L'OUTPUT VERO.**
   *
   * Diceva «⚠️ di queste ne possono scattare 40», ed era giusto **finché il modo era il pezzo di
   * parola**. Dalla sera del 19/8 il modo è `parole_intere`: nessuna di quelle trappole può più
   * scattare, e la riga continuava a gridare — venti righe sopra un'altra riga dello stesso
   * programma che diceva «il modo in produzione adesso è: parole_intere».
   *
   * ⛔ *Un avviso che non può più scattare fa credere che stia proteggendo qualcosa*, ed è la stessa
   * regola per cui il 19/8 sera ho tolto un controllo morto da `abbinamento-alimenti.ts`. Qui era
   * peggio, perché il numero era grosso e allarmante: 40.
   *
   * ✅ Adesso la frase **dipende dal modo**, che è l'unica cosa che la rende vera in tutti e due i
   * casi — e il giorno che il modo tornasse indietro, tornerebbe indietro anche l'avviso.
   */
  const pericolose = MODO_DI_OGGI === 'pezzo_di_parola';
  console.log(`   Coppie trovate: ${trappole.length}, di cui ${scattano.length} su una parola che in tabella NON c'è.`);
  if (pericolose) {
    console.log(`   ⚠️ Il modo è «${MODO_DI_OGGI}»: tutte e ${scattano.length} POSSONO SCATTARE — Gaia`);
    console.log('      risponderebbe con le calorie dell\'alimento a destra.');
  } else {
    console.log(`   ✅ Il modo è «${MODO_DI_OGGI}»: nessuna di queste può scattare — su questi nomi Gaia`);
    console.log('      dice «non ce l\'ho», che è la risposta giusta finché la riga non c\'è.');
    console.log('   ⚠️ Resta però la LISTA DELLA SPESA: ogni riga qui sotto è un alimento vero, usato');
    console.log('      nelle ricette, che in tabella manca — e finché manca il conto lo salta.');
  }
  console.log('');
  for (const t of scattano.slice(0, QUANTI)) {
    const freccia = pericolose
      ? `→  risponderebbe «${comeSiChiama(t.corto)}»`
      : `(il conto lo salta · somiglia a «${comeSiChiama(t.corto)}»)`;
    console.log(`     ${pericolose ? '⚠️' : ' ·'} ${String(t.quante).padStart(5)} usi   «${t.lungo}»  ${freccia}`);
    const scritti = comeLoScrivono(t.lungo);
    if (scritti) console.log(`                    scritto così: ${scritti}`);
  }
  if (scattano.length > QUANTI) console.log(`     … e altre ${scattano.length - QUANTI} (QUANTI=n per vederne di più)`);
  if (!scattano.length) console.log('     Nessuna: ogni parola lunga ha già la sua riga in tabella.');
  console.log('');

  const chiuse = trappole.filter((t) => !t.scatta);
  console.log(`   Le altre ${chiuse.length} hanno la parola lunga già in tabella: lì non manca niente.`);
  for (const t of chiuse.slice(0, Math.min(5, QUANTI))) {
    console.log(`        ${String(t.quante).padStart(5)} usi   «${t.lungo}» contiene «${comeSiChiama(t.corto)}» — ma «${t.lungo}» c'è`);
  }
  console.log('');
}

async function domandeVere() {
  console.log('==================================================================');
  console.log('  2) LE DOMANDE VERE — le due ricerche a confronto');
  console.log('==================================================================');
  console.log('');

  const messaggi = (await prisma.message.findMany({
    where: { senderRole: 'client', deletedAt: null },
    orderBy: { sentAt: 'desc' },
    take: MESSAGGI,
    select: { body: true } as never,
  })) as { body: string }[];

  console.log(`   Messaggi di clienti letti: ${messaggi.length} (i più recenti; MESSAGGI=n per cambiare).`);
  const domande = messaggi.filter((m) => typeof m.body === 'string' && domandaNutrizionale(m.body));
  console.log(`   Di questi, quelli che Gaia tratta come domande sull'alimentazione: ${domande.length}.`);
  console.log('   ⚠️ Il testo dei messaggi non si stampa. Escono i nomi degli alimenti trovati e, dove');
  console.log('      serve a capire, la singola parola che li conteneva. Mai la frase.');
  console.log('');

  let uguali = 0;
  let nessunaDelleDue = 0;
  /** Le righe che oggi si reggono SOLO su un pezzo di parola, con la parola che le conteneva. */
  const soloPezzo = new Map<string, number>();
  const soloIntere = new Map<string, number>();

  /**
   * ⚠️ **La parola della domanda che conteneva il nome della riga.** Serve a far leggere la coppia:
   * «pomodori ⊂ pomodorini» si legge come giusta, «mela ⊂ melanzane» si legge come sbagliata — e la
   * differenza la vede una persona in un secondo, mentre un programma che provasse a deciderla da
   * solo sbaglierebbe in silenzio proprio sui casi nuovi.
   */
  const parolaCheLoConteneva = (domanda: string, nome: string): string => {
    const parole = normalizzaNome(domanda).split(' ');
    const n = normalizzaNome(nome);
    return parole.find((p) => p !== n && p.includes(n)) ?? '(in mezzo alla frase)';
  };

  for (const m of domande) {
    const oggi = await valori.cercaTutti(m.body);
    const intere = await valori.cercaTutti(m.body, 3, 'parole_intere');
    const a = oggi.map((v) => v.name).join(' + ');
    const b = intere.map((v) => v.name).join(' + ');
    if (a === b) {
      if (!oggi.length) nessunaDelleDue++;
      else uguali++;
      continue;
    }
    /**
     * ⚠️ **Ogni riga che oggi c'è e a parole intere sparisce si regge, per forza, su un pezzo di
     * parola**: se avesse combaciato per intero la troverebbero tutt'e due. Quindi non c'è niente da
     * indovinare — si mostra la coppia.
     */
    const persi = oggi.filter((v) => !intere.some((w) => w.name === v.name));
    for (const v of persi) {
      const k = `«${v.name}»  ⊂  «${parolaCheLoConteneva(m.body, v.name)}»`;
      soloPezzo.set(k, (soloPezzo.get(k) ?? 0) + 1);
    }
    const guadagnati = intere.filter((v) => !oggi.some((w) => w.name === v.name));
    for (const v of guadagnati) soloIntere.set(v.name, (soloIntere.get(v.name) ?? 0) + 1);
  }

  const somma = (m: Map<string, number>) => [...m.values()].reduce((s, n) => s + n, 0);
  const elenco = (m: Map<string, number>) => [...m.entries()].sort((x, y) => y[1] - x[1]);

  console.log(`   a) le due ricerche rispondono UGUALE:          ${uguali}`);
  console.log(`   b) nessuna delle due trova niente:            ${nessunaDelleDue}`);
  console.log(`   c) ⚠️ righe che oggi si reggono SOLO su un pezzo di parola: ${somma(soloPezzo)}`);
  console.log(`   d) righe che oggi mancano e a parole intere ci sarebbero:   ${somma(soloIntere)}`);
  console.log('');

  console.log('   c) ⚠️ TUTTO IL CAMBIO STA QUI, e va letto una riga per volta.');
  console.log('      A sinistra la riga che Gaia usa oggi, a destra la parola che la conteneva.');
  console.log('      «pomodori ⊂ pomodorini» è il meccanismo che funziona; «mela ⊂ melanzane» è');
  console.log('      lo stesso meccanismo che sbaglia. ⚠️ Quale sia, lo dice chi legge — non io.');
  for (const [k, n] of elenco(soloPezzo).slice(0, QUANTI)) console.log(`     ▸ ${String(n).padStart(4)} volte   ${k}`);
  if (!soloPezzo.size) console.log('        Nessuna: sulle domande vere il pezzo di parola non cambia mai la risposta.');
  if (soloPezzo.size > QUANTI) console.log(`     … e altre ${soloPezzo.size - QUANTI} (QUANTI=n per vederne di più)`);
  console.log('');

  if (soloIntere.size) {
    console.log('   d) righe che oggi NON escono e a parole intere uscirebbero:');
    console.log('      (succede quando un nome più corto e sbagliato ne copriva uno giusto)');
    for (const [k, n] of elenco(soloIntere).slice(0, QUANTI)) console.log(`     ▸ ${String(n).padStart(4)} volte   ${k}`);
    console.log('');
  }
}

async function main() {
  console.log('');
  await trappoleDellaTabella();
  await domandeVere();
  console.log('──────────────────────────────────────────────────────────────────');
  console.log(`  ⚠️ IL MODO IN PRODUZIONE ADESSO È: ${MODO_DI_OGGI}.`);
  console.log('  Scelto da Simone il 19/8 sera leggendo questi numeri: 40 trappole tutte aperte,');
  console.log('  ~1700 usi sbagliati contro 231 giusti, e zero differenze sulle domande vere.');
  console.log('');
  console.log('  A COSA SERVE ANCORA QUESTA MISURA, adesso che la scelta è fatta:');
  console.log('   · la sezione 1 è la LISTA DELLA SPESA della tabella alimenti, in ordine di');
  console.log('     urgenza: ogni trappola aperta è un alimento vero che in tabella NON c\'è.');
  console.log('     Il giorno che la riga si aggiunge, la trappola si chiude da sola.');
  console.log('   · la sezione 2 dice se il pezzo di parola è tornato a valere qualcosa: si');
  console.log('     rilancia quando la tabella si è riempita, o quando Gaia riceve più domande.');
  console.log('  ⚠️ Il cambio è sempre una riga: `MODO_DI_OGGI` in `nome-dentro-la-domanda.ts`.');
  console.log('  Nessuna scrittura: questa diagnostica legge e basta.');
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
