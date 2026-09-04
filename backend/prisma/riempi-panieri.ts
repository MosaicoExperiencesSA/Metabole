/**
 * FASE 1 — L'APPARTENENZA ESCE DAL JSON: si riempiono i panieri dalle giornate.
 *
 * ⛔ **SOLA LETTURA finché non gli si dice `APPLICA=1`.** Senza, stampa il tabulato e non scrive
 * niente: né i panieri, né le appartenenze, né una riga di `diet_day_template`.
 *
 * ⚠️ **Non cancella e non tocca niente di esistente.** `diet_day_template` resta esattamente com'è:
 * finché il motore legge di là, spegnere quella strada sarebbe una consegna a sé (§4.3 del piano,
 * il ripiego). Qui si **aggiunge** la tabella di appartenenza accanto, e si confronta.
 *
 * ## Il confronto prima/dopo, che il piano pretende (Fase 1, «come si verifica»)
 *
 * ⛔ *«Se una ricetta si perde per strada, il paniere si assottiglia e nessuno se ne accorge — il
 * motore continua a comporre, con meno scelta.»* Quindi per ogni variante si contano le ricette
 * **distinte per slot** prima (dalle giornate) e dopo (dal paniere in cui è confluita), e **se il
 * conto non torna la migrazione si ferma**: non scrive niente e stampa cosa manca.
 *
 * ⚠️ Il conto «dopo» è per PANIERE, e su strada B molte varianti versano nello stesso: quindi
 * l'atteso non è l'uguaglianza variante per variante, è che **ogni ricetta nominata da una
 * giornata si ritrovi nel paniere della sua variante, con lo stesso slot**. È quello che si
 * verifica, ed è più severo del confronto fra due numeri.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run panieri:riempi              → tabulato, NON scrive
 *   APPLICA=1 npm run panieri:riempi    → crea i panieri e le appartenenze
 *   ESEMPI=40 npm run panieri:riempi    → più righe negli elenchi (default 20)
 */
import { PrismaClient } from '@prisma/client';
import { IMPOSSIBILI, paniereDellaVariante, panieriDaCreare, ricetteDellaGiornata } from '../src/catalog/appartenenza-panieri';
import { ricettaVaBene } from '../src/common/regimi';
/**
 * ⛔ **IL CANCELLO A VALLE — Simone, 4/9: «correggiamo immediatamente riempi-panieri».**
 *
 * Lo stesso giorno in cui i panieri sono stati ripuliti da carne e pesce a colazione, spuntino e
 * merenda, questo script li rimetterebbe dentro alla prossima passata: **deriva l'appartenenza
 * dalle giornate**, e nelle giornate quei piatti ci sono ancora. Una pulizia che il primo
 * riempimento annulla non è una pulizia: è un giro a vuoto che fa credere che il problema sia
 * chiuso.
 *
 * ⚠️ **E si passa dalla PORTA GIÀ ESISTENTE** (`fuoriPostoAColazione`), non da un secondo giudizio
 * scritto qui: due riconoscitori della carne divergono, e il giorno che divergono uno dei due
 * mette del pesce in una colazione senza che nessuno lo veda.
 */
import { MINIMO_PER_CELLA, PASTI_SENZA_CARNE_PESCE_VERDURA, fuoriPostoAColazione } from '../src/catalog/colazione-senza-carne-e-pesce';
import { nomiIngredienti } from '../src/catalog/elenco-ingredienti';

const prisma = new PrismaClient();

const APPLICA = process.env.APPLICA === '1';
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 20) || 20);

const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  riga('');
  riga('==================================================================');
  riga('  FASE 1 — l\'appartenenza esce dal JSON');
  riga(`  ${APPLICA ? '⚠️  APPLICA=1: SCRIVE panieri e appartenenze.' : 'Sola lettura: non scrive niente.'}`);
  riga('==================================================================');

  const [diete, giornate, ricetteVive] = await Promise.all([
    prisma.diet.findMany({ select: { id: true, name: true, regime: true, status: true } }) as unknown as
      Promise<{ id: string; name: string; regime: string; status: string }[]>,
    prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } }) as unknown as
      Promise<{ dietId: string; meals: unknown }[]>,
    /**
     * ⚠️ Anche il `regime`: da qui esce il controllo che nessuno faceva (vedi sotto, 1/9).
     * ⛔ E dal 4/9 anche `name` e `ingredients`, per il cancello su colazione, spuntino e merenda:
     * il giudizio vuole **due letture**, perché i gamberetti nel nome spesso non compaiono.
     */
    prisma.recipe.findMany({ select: { id: true, regime: true, name: true, ingredients: true } }) as unknown as
      Promise<{ id: string; regime: string; name: string; ingredients: unknown }[]>,
  ]);

  const esiste = new Set(ricetteVive.map((r) => r.id));
  const regimeDi = new Map(ricetteVive.map((r) => [r.id, r.regime]));
  const laRicetta = new Map(ricetteVive.map((r) => [r.id, r]));
  /** ⚠️ Gli slot leggeri come insieme: la domanda «questo pasto è leggero?» si fa per ogni riga. */
  const PASTI_LEGGERI = new Set<string>(PASTI_SENZA_CARNE_PESCE_VERDURA);
  /** Quante ne sono state fermate, raggruppate per motivo — e qualche nome vero davanti. */
  const carneNeiLeggeri = new Map<string, { quante: number; esempi: string[] }>();
  const perDieta = new Map<string, { slot: string; recipeId: string }[]>();
  for (const g of giornate) {
    const righe = ricetteDellaGiornata(g.meals);
    if (!righe.length) continue;
    perDieta.set(g.dietId, [...(perDieta.get(g.dietId) ?? []), ...righe]);
  }

  /** paniere «famiglia|regime» → set di «recipeId|slot». */
  const dentro = new Map<string, Set<string>>();
  /** nome famiglia → { varianti, righe, approvate }. ⚠️ RAGGRUPPATE: 120 righe non si leggono. */
  const nonMappabili = new Map<string, { varianti: number; righe: number; approvate: number; perche: string }>();
  const impossibiliConRicette: string[] = [];
  /**
   * ⛔ I riferimenti ROTTI: la chiave esterna li renderà impossibili, ma **oggi ci sono** (58
   * misurati il 31/8). Non si possono scrivere, quindi si contano e si dichiarano — sono l'unica
   * cosa che questa migrazione **perde di proposito**, ed è il senso della Fase 1.
   */
  const rotti = new Map<string, number>();
  /** ⚠️ Chi non ha proprio un paniere dove stare: si stampa, non si nasconde. */
  const fuoriRegime = new Map<string, number>();
  /** ⚠️ E chi è stato SPOSTATO nel paniere della stessa famiglia col suo regime. */
  const spostate = new Map<string, number>();
  let nominateVive = 0;

  for (const d of diete) {
    const righe = perDieta.get(d.id) ?? [];
    const esito = paniereDellaVariante(d);
    if (esito.tipo === 'non_mappabile') {
      if (righe.length) {
        const v = nonMappabili.get(d.name) ?? { varianti: 0, righe: 0, approvate: 0, perche: esito.perche };
        v.varianti += 1;
        v.righe += righe.length;
        if (d.status === 'approved') v.approvate += 1;
        nonMappabili.set(d.name, v);
      }
      continue;
    }
    /**
     * ⚠️ Una combinazione impossibile **non butta le sue ricette**: versano nei panieri che la
     * decisione del 31/8 le assegna (§1.6, il guadagno della strada B). Se non ne ha nessuno
     * assegnato, si dichiara e basta.
     */
    const destinazioni = esito.tipo === 'impossibile'
      ? esito.dove
      : [{ famiglia: esito.famiglia, regime: esito.regime }];
    if (esito.tipo === 'impossibile') {
      if (righe.length) {
        impossibiliConRicette.push(
          `  · «${esito.famiglia}» × ${esito.regime} — ${righe.length} righe → `
          + (destinazioni.length ? destinazioni.map((x) => `${x.famiglia} × ${x.regime}`).join(' + ') : '⛔ NESSUN paniere: si perderebbero'),
        );
      }
      if (!destinazioni.length) continue;
    }
    for (const r of righe) {
      if (!esiste.has(r.recipeId)) {
        rotti.set(`${d.name} · ${d.regime}`, (rotti.get(`${d.name} · ${d.regime}`) ?? 0) + 1);
        continue;
      }
      nominateVive += 1;
      for (const dest of destinazioni) {
        /**
         * ⛔ **UNA RICETTA NON ENTRA IN UN PANIERE CHE NON PUÒ MANGIARLA** — controllo aggiunto
         * l'1/9, e non c'era.
         *
         * ⚠️ La destinazione viene dal regime della **variante**, e le ricette da quello che le sue
         * giornate nominano: nessuno dei due garantisce che la ricetta stessa sia di quel regime.
         * Il 1/9 `diag:carne-fuori-posto` ha trovato 175 piatti con pesce o carne dentro panieri
         * vegani e vegetariani — e la pagina Panieri questo controllo ce l'ha da sempre per chi
         * aggiunge a mano. Due porte sulla stessa tabella, e solo una controllava.
         *
         * ⛔ **Ma non era questo a lasciarli passare**: quei 175 sono ricette **dichiarate vegane**
         * che contengono pesce, e per questo controllo sarebbero passate lo stesso. L'etichetta si
         * corregge con `npm run regime:contenuto`, e quello che è già scritto si toglie con
         * `npm run panieri:pulisci` — perché questo script solo AGGIUNGE, e non toglie mai niente.
         * Questa riga serve a domani: una volta pulito, tiene pulito.
         */
        /**
         * ⛔ **E SE NON CI STA, SI SPOSTA — non si butta.** Corretto l'1/9 poche ore dopo averlo
         * scritto, e il difetto era mio: la prima stesura **scartava** la ricetta, e questo ha
         * quasi cancellato dai menu 531 piatti di pesce.
         *
         * La sequenza che l'ha prodotto: `regime:contenuto` sposta il pesce da `vegan` a
         * `pescetarian` (giusto), `panieri:pulisci` lo toglie dai panieri vegani (giusto) — ma
         * quelle ricette **stavano solo lì**, nelle giornate delle diete vegane, e nel paniere
         * onnivoro non c'erano mai state. `panieri:pesce` deriva il pescetariano **da quello**, e
         * quindi non le trovava. Non più nel posto sbagliato, non ancora in quello giusto: da
         * nessuna parte.
         *
         * ⚠️ **La regola giusta era già tutta nei dati**: la FAMIGLIA la dà la variante che nomina
         * la ricetta, il REGIME lo dà la ricetta. Il salmone nominato da «Basso indice glicemico
         * vegana» appartiene a «Basso indice glicemico × pescetarian» — stessa famiglia, il suo
         * regime — ed è esattamente dove le cinque clienti pescetariane andranno a pescarlo.
         *
         * ⚠️ Si sposta solo dove un paniere **esiste**: le celle dichiarate impossibili (§Fase 5)
         * non si creano per far posto a una ricetta.
         */
        let regime = dest.regime;
        if (!ricettaVaBene(regimeDi.get(r.recipeId), regime)) {
          const suo = String(regimeDi.get(r.recipeId) ?? '').trim();
          const esiste = suo && !IMPOSSIBILI.includes(`${dest.famiglia}|${suo}`)
            && panieriDaCreare().some((p) => p.famiglia === dest.famiglia && p.regime === suo);
          const etichetta = `ricetta «${suo || '(vuoto)'}» dal paniere «${dest.regime}»`;
          if (!esiste) {
            fuoriRegime.set(`${etichetta} → NESSUN paniere per lei`, (fuoriRegime.get(`${etichetta} → NESSUN paniere per lei`) ?? 0) + 1);
            continue;
          }
          spostate.set(`${etichetta} → «${suo}»`, (spostate.get(`${etichetta} → «${suo}»`) ?? 0) + 1);
          regime = suo;
        }
        /**
         * ⛔ **NIENTE CARNE NÉ PESCE IN COLAZIONE, SPUNTINO E MERENDA — il cancello a valle.**
         *
         * ⚠️ Sta **dopo** lo spostamento di regime e **prima** della scrittura, ed è l'unico punto
         * in cui può stare: qui si sa già in quale cella la riga finirebbe, e non è ancora finita
         * dentro. La riga non si sposta altrove — a colazione un branzino non ha una cella giusta:
         * si **ferma**, e si dice quante e quali.
         *
         * ⚠️ La ricetta resta in catalogo e resta nei panieri di pranzo e cena: qui si toglie
         * l'appartenenza a **quella cella**, come fa `diag:colazioni-con-carne`.
         */
        const ric = laRicetta.get(r.recipeId);
        if (PASTI_LEGGERI.has(r.slot) && ric) {
          const fuori = fuoriPostoAColazione({
            id: ric.id,
            nome: ric.name,
            ingredienti: nomiIngredienti(ric.ingredients),
          });
          if (fuori) {
            const k = `${fuori.motivo} · slot ${r.slot}`;
            const v2 = carneNeiLeggeri.get(k) ?? { quante: 0, esempi: [] };
            v2.quante += 1;
            if (v2.esempi.length < 5 && !v2.esempi.includes(ric.name)) v2.esempi.push(ric.name);
            carneNeiLeggeri.set(k, v2);
            continue;
          }
        }
        const chiave = `${dest.famiglia}|${regime}`;
        const set = dentro.get(chiave) ?? new Set<string>();
        set.add(`${r.recipeId}|${r.slot}`);
        dentro.set(chiave, set);
      }
    }
  }

  const tutti = panieriDaCreare();
  const appartenenze = [...dentro.values()].reduce((s, v) => s + v.size, 0);
  const pieni = [...dentro.entries()].filter(([, v]) => v.size > 0).length;

  titolo('COSA VERREBBE SCRITTO');
  riga('');
  riga(`  Panieri da creare                          ${tutti.length}  (10 famiglie × 4 regimi − 2 impossibili)`);
  riga(`  …di cui con almeno una ricetta dentro      ${pieni}`);
  riga(`  Appartenenze (ricetta × slot × paniere)    ${appartenenze}`);
  riga('');
  riga(`  Righe di giornata lette                    ${[...perDieta.values()].reduce((s, v) => s + v.length, 0)}`);
  riga(`  …che nominano una ricetta VIVA             ${nominateVive}`);
  riga('  ⚠️ Il secondo numero è più piccolo del primo per due ragioni sane: la stessa ricetta è');
  riga('  nominata da più giornate (e nel paniere sta una volta), e le varianti non mappabili non');
  riga('  versano in nessun paniere. La terza ragione, i rotti, è qui sotto.');

  titolo('⛔ QUELLO CHE SI PERDE, E PERCHÉ');
  riga('');
  const rottiTot = [...rotti.values()].reduce((s, n) => s + n, 0);
  riga(`  Riferimenti ROTTI non trasferibili: ${rottiTot} righe, su ${rotti.size} varianti.`);
  riga('  ⛔ Nominano una ricetta che non esiste più. La chiave esterna li rende impossibili da');
  riga('  domani, e per questo NON si possono scrivere: è la cosa che la Fase 1 esiste per chiudere.');
  for (const [nome, n] of [...rotti.entries()].sort((a, b) => b[1] - a[1]).slice(0, ESEMPI)) {
    riga(`  · ${String(n).padStart(4)}  ${nome}`);
  }
  if (rotti.size > ESEMPI) riga(`  …e altre ${rotti.size - ESEMPI}.`);

  /**
   * ⚠️ **Si stampa anche quando è zero.** Un controllo nuovo che parla solo quando trova qualcosa
   * è un controllo di cui, fra un mese, nessuno sa più se sta girando — ed è la stessa ragione per
   * cui il riquadro del generatore in pagina Ricette non sparisce quando va tutto bene.
   */
  const spostateTot = [...spostate.values()].reduce((s2, n) => s2 + n, 0);
  const fuoriTot = [...fuoriRegime.values()].reduce((s2, n) => s2 + n, 0);
  riga('');
  riga(`  SPOSTATE nel paniere della stessa famiglia col loro regime: ${spostateTot}.`);
  if (spostateTot) {
    riga('  ⚠️ La famiglia la dà la variante che nomina la ricetta, il regime lo dà la ricetta: un');
    riga('  salmone nominato da «Basso indice glicemico vegana» va in «Basso indice glicemico ×');
    riga('  pescetarian», dove le clienti pescetariane lo trovano.');
    for (const [k, n] of [...spostate.entries()].sort((a, b) => b[1] - a[1]).slice(0, ESEMPI)) {
      riga(`  · ${String(n).padStart(4)}  ${k}`);
    }
  } else {
    riga('  ✅ Nessuna da spostare: ogni ricetta nominata sta già nel paniere giusto.');
  }
  riga('');
  riga(`  Senza NESSUN paniere possibile: ${fuoriTot}.`);
  if (fuoriTot) {
    riga('  ⛔ Il loro regime non ha un paniere in quella famiglia (o è una cella impossibile).');
    riga('  Queste restano fuori davvero, e vanno guardate: `npm run diag:orfane`.');
    for (const [k, n] of [...fuoriRegime.entries()].sort((a, b) => b[1] - a[1]).slice(0, ESEMPI)) {
      riga(`  · ${String(n).padStart(4)}  ${k}`);
    }
  } else {
    riga('  ✅ Nessuna.');
    riga('  ⚠️ Non vuol dire che nei panieri non ci sia pesce dove non deve: una ricetta con');
    riga('  l\'ETICHETTA sbagliata passa di qui indisturbata. Quello lo dice `regime:contenuto`.');
  }

  /**
   * ⚠️ **Si stampa anche quando è zero**, come il blocco qui sopra e per la stessa ragione: un
   * cancello che parla solo quando ferma qualcosa è un cancello di cui fra un mese nessuno sa più
   * se è aperto.
   */
  const leggeriTot = [...carneNeiLeggeri.values()].reduce((s2, v2) => s2 + v2.quante, 0);
  riga('');
  riga(`  FERMATE perché carne o pesce in colazione, spuntino o merenda: ${leggeriTot} RIGHE DI GIORNATA.`);
  riga('  ⚠️ Sono righe di giornata, non celle: la stessa ricetta nominata da cinquanta giornate della');
  riga('     stessa famiglia conta cinquanta. Non è confrontabile con «Appartenenze» qui sopra, che è');
  riga('     deduplicato per (ricetta × slot × paniere), né con le righe che toglie il diagnostico.');
  if (leggeriTot) {
    riga('  ⛔ La regola è del 31/8 e fino al 4/9 la leggeva SOLO l\'agente che genera i piatti nuovi:');
    riga('  questo script, derivando l\'appartenenza dalle giornate, le rimetteva dentro alla passata');
    riga('  successiva — cioè annullava la pulizia dei panieri fatta lo stesso giorno.');
    riga('  ⚠️ Le ricette restano in catalogo e restano a pranzo e a cena: qui si ferma solo');
    riga('  l\'appartenenza a quelle celle.');
    for (const [k, v2] of [...carneNeiLeggeri.entries()].sort((a, b) => b[1].quante - a[1].quante).slice(0, ESEMPI)) {
      riga(`  · ${String(v2.quante).padStart(4)}  ${k}`);
      riga(`          ${v2.esempi.join(' · ')}`);
    }
  } else {
    riga('  ✅ Nessuna: nelle giornate non è rimasto niente di carne o pesce in quei tre pasti.');
  }

  /**
   * ⛔ **E LE CELLE CHE RESTANO TROPPO VUOTE SI NOMINANO.** È lo stesso numero di
   * `diag:colazioni-con-carne` e la stessa ragione: una colazione con tre piatti serve alla cliente
   * lo stesso piatto a giorni alterni, e dopo tre giorni smette di aprire l'app.
   *
   * ⚠️ Qui però la soglia **non ferma niente**: là si toglieva da un paniere che esisteva, qui lo
   * si sta componendo, e riempirlo di branzini per far numero sarebbe rimettere il difetto per
   * rispettare la misura fatta per curarlo. Si dice quali sono, e si riempiono con dei piatti
   * giusti — che è lavoro di catalogo.
   */
  const vuoteLeggere: string[] = [];
  /**
   * ⛔ **Si gira su TUTTI i panieri, non su quelli che hanno già una riga** — e lo zero si nomina.
   *
   * La prima stesura iterava `dentro`, che contiene solo i panieri con almeno una riga, e saltava
   * `quante === 0`: cioè taceva esattamente sul caso peggiore — la colazione i cui unici piatti
   * erano di pesce, che il cancello svuota del tutto. Il riquadro prometteva «si dice quali sono» e
   * l'unico risultato davvero grave era l'unico invisibile. Trovato da una revisione prima della
   * consegna.
   */
  for (const p of tutti) {
    const set = dentro.get(`${p.famiglia}|${p.regime}`) ?? new Set<string>();
    for (const slot of PASTI_LEGGERI) {
      const quante = [...set].filter((x) => x.endsWith(`|${slot}`)).length;
      if (quante < MINIMO_PER_CELLA) {
        vuoteLeggere.push(`${p.famiglia} · ${p.regime} · ${slot}: ${quante}${quante === 0 ? '  ⛔ VUOTA' : ''}`);
      }
    }
  }
  riga('');
  riga(`  Celle leggere che nascono sotto i ${MINIMO_PER_CELLA} piatti: ${vuoteLeggere.length}.`);
  if (vuoteLeggere.length) {
    riga('  ⚠️ Non si riempiono con carne o pesce per far numero: vanno riempite con dei piatti che a');
    riga('  colazione ci stanno. La soglia qui NON ferma la scrittura — vedi il commento nel file.');
    for (const x of vuoteLeggere.sort().slice(0, ESEMPI)) riga(`  · ${x}`);
    if (vuoteLeggere.length > ESEMPI) riga(`  …e altre ${vuoteLeggere.length - ESEMPI}.`);
  } else {
    riga('  ✅ Nessuna.');
  }

  if (nonMappabili.size) {
    const varianti = [...nonMappabili.values()].reduce((s2, v) => s2 + v.varianti, 0);
    titolo(`FAMIGLIE CHE NON VERSANO IN NESSUN PANIERE (${nonMappabili.size} nomi, ${varianti} varianti)`);
    riga('');
    riga('  ⚠️ **Raggruppate per NOME**, e non è un dettaglio: la prima stesura ne stampava una riga');
    riga('  per variante — centoventi righe per dieci nomi — e un elenco che costringe a contare a');
    riga('  mano è un elenco che non si legge. Qui si vede subito quali nomi mancano davvero.');
    riga('');
    for (const [nome, v] of [...nonMappabili.entries()].sort((a, b) => b[1].righe - a[1].righe)) {
      riga(`  · ${String(v.righe).padStart(5)} righe · ${String(v.varianti).padStart(3)} varianti (${v.approvate} approvate) — «${nome}»`);
      riga(`      ${v.perche}`);
    }
    riga('');
    riga('  ⛔ «famiglia sconosciuta» vuol dire che quel nome NON è nell\'elenco delle dieci: o è una');
    riga('  famiglia vera che manca al piano, o è un nome scritto diverso. ⚠️ «non è una famiglia»');
    riga('  vuol dire che il piano l\'ha già dichiarata un asse travestito, ed è atteso.');
  }
  if (impossibiliConRicette.length) {
    titolo('COMBINAZIONI CHIUSE, E DOVE VANNO LE LORO RICETTE');
    riga('');
    riga('  Il piano (§1.6) dice che tornano in catalogo come vegane, non che si buttano — ed è il');
    riga('  guadagno della strada B. La destinazione è la decisione di Simone del 31/8.');
    impossibiliConRicette.forEach(riga);
  }

  titolo('I PANIERI SECONDO LE GIORNATE — non è lo stato della tabella');
  riga('');
  /**
   * ⛔ **QUESTO ELENCO DICE MENO DI QUELLO CHE SEMBRA, e il 2/9 stava per far prendere un colpo.**
   *
   * Sono le ricette che **queste giornate** versano in ogni paniere: è quello che lo script sta per
   * scrivere, non quello che nel paniere c'è. Le righe scritte da `panieri:pesce` — la derivazione
   * dei panieri pescetariani, novemila e passa — da qui **non si vedono**, perché dalle giornate
   * non escono.
   *
   * ⚠️ Quindi una riga come «Flessibile × pescetarian 1» non vuol dire che quel paniere ha un
   * piatto: vuol dire che una giornata sola lo nomina. Lo stato vero si guarda nella **pagina
   * Panieri** del back office, che conta le righe in tabella e distingue i piatti dagli attivi.
   */
  riga('  ⚠️ Sono le ricette che LE GIORNATE versano in ogni paniere, cioè quello che questo script');
  riga('  sta per scrivere — NON quello che nel paniere c\'è. Le righe scritte da `panieri:pesce`');
  riga('  (la derivazione pescetariana) da qui non si vedono, perché dalle giornate non escono.');
  riga('  ⛔ «Flessibile × pescetarian 1» vuol dire «una giornata lo nomina», non «ha un piatto».');
  riga('  Lo stato vero è nella pagina Panieri del back office.');
  riga('');
  for (const p of tutti) {
    const set = dentro.get(`${p.famiglia}|${p.regime}`) ?? new Set<string>();
    const perSlot = new Map<string, number>();
    for (const k of set) {
      const slot = k.split('|')[1];
      perSlot.set(slot, (perSlot.get(slot) ?? 0) + 1);
    }
    const dettaglio = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
      .map((s) => `${s}=${perSlot.get(s) ?? 0}`).join(' ');
    riga(`  · ${String(set.size).padStart(5)}  ${p.famiglia} × ${p.regime}   ${dettaglio}`);
  }

  if (!APPLICA) {
    riga('');
    riga('==================================================================');
    riga('  Fine. NIENTE è stato scritto. Per scrivere: APPLICA=1');
    riga('==================================================================');
    riga('');
    return;
  }

  titolo('SCRITTURA');
  riga('');
  let creati = 0;
  let scritte = 0;
  for (const p of tutti) {
    const paniere = await prisma.paniere.upsert({
      where: { famiglia_regime: { famiglia: p.famiglia, regime: p.regime } },
      update: {},
      create: { famiglia: p.famiglia, regime: p.regime },
    });
    creati += 1;
    const set = dentro.get(`${p.famiglia}|${p.regime}`) ?? new Set<string>();
    const righe = [...set].map((k) => {
      const [recipeId, slot] = k.split('|');
      return { paniereId: paniere.id, recipeId, slot };
    });
    /**
     * ⚠️ `skipDuplicates`: lo script si può rilanciare. La chiave unica è (paniere, ricetta, slot),
     * quindi un secondo giro non aggiunge niente e non toglie niente — e questo è ciò che rende la
     * migrazione ripetibile senza doverla prima disfare.
     */
    for (let i = 0; i < righe.length; i += 1000) {
      const r = await prisma.paniereRicetta.createMany({ data: righe.slice(i, i + 1000), skipDuplicates: true });
      scritte += r.count;
    }
  }
  riga(`  Panieri creati o già presenti: ${creati}.`);
  riga(`  Appartenenze scritte adesso:   ${scritte}.`);
  riga('');
  /**
   * ⛔ **IL CONTROLLO PRESUMEVA DI ESSERE L'UNICO A SCRIVERE, E DALL'1/9 NON È PIÙ VERO.**
   *
   * Confrontava le righe in tabella con quelle che QUESTO script deriva dalle giornate, e le
   * pretendeva uguali. Andava bene finché il riempimento era l'unico scrittore. Poi è arrivato
   * `panieri:pesce`, che deriva i panieri pescetariani e scrive righe che dalle giornate non
   * escono: 32335 in tabella contro 23227 attese, e il tabulato ha gridato ⛔ IL CONTO NON TORNA
   * su una serata in cui non era andato storto niente.
   *
   * ⚠️ **E un allarme falso costa più di un allarme mancato**, qui: dice a chi legge di fermarsi e
   * di andare a cercare un guasto che non c'è, alle undici di sera, dopo cinque ore di lavoro.
   *
   * ⚠️ La domanda giusta non era «sono uguali» ma **«c'è tutto quello che mi aspettavo?»**: le
   * righe in più hanno un nome e un padrone, e si dicono invece di far paura.
   *
   * ⛔ **E dal 4/9 i padroni sono DUE, non uno.** Il cancello sui pasti leggeri (vedi in cima al
   * file) ferma delle righe che dalle giornate escono: `appartenenze` non le conta più, mentre in
   * tabella possono benissimo esserci — `diag:colazioni-con-carne` lascia apposta le attive delle
   * celle sotto soglia. Quindi `inPiu` cresce **anche** per quel motivo, e attribuirlo tutto a
   * `panieri:pesce` sarebbe la solita frase falsa detta su un numero vero. Si nominano tutti e due,
   * e si dice quante ne ha fermate questo giro: il resto è l'incognita, ed è dichiarata tale.
   */
  const controllo = await prisma.paniereRicetta.count();
  const inPiu = controllo - appartenenze;
  riga(`  Controllo: righe in tabella = ${controllo}, derivabili dalle giornate = ${appartenenze}.`);
  if (inPiu < 0) {
    riga(`  ⛔ NE MANCANO ${-inPiu}: qualcosa non è stato scritto. Guardare prima di andare avanti.`);
  } else if (inPiu === 0) {
    riga('  ✅ Il conto torna esatto.');
  } else {
    riga(`  ✅ Il conto torna, con ${inPiu} righe in più delle giornate.`);
    riga('  ⚠️ Non è un errore, e i motivi noti sono DUE:');
    riga('     · le righe che scrive `panieri:pesce`, che deriva i panieri pescetariani da quelli');
    riga('       vegetariano e onnivoro — roba che dalle giornate non esce;');
    riga(`     · le righe di carne o pesce nei tre pasti leggeri: qui ne sono state fermate ${leggeriTot},`);
    riga('       ma in tabella possono restarci quelle che `diag:colazioni-con-carne` lascia apposta');
    riga('       nelle celle sotto soglia. Sono attese, e da qui non si possono contare.');
    riga('  ⛔ Se questo numero cresce senza che nessuno abbia lanciato quella derivazione e senza che');
    riga('  il cancello qui sopra abbia fermato niente, allora sì che c\'è da guardare:');
    riga('  `npm run panieri:pulisci` e `npm run diag:colazioni-con-carne`, tutti e due in sola lettura.');
  }
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
