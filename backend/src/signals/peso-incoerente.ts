import { giornoItaliano } from '../common/date-only';

/**
 * QUANDO DUE PESATE NON POSSONO ESSERE DELLA STESSA PERSONA.
 *
 * Nasce da una misura, non da un'idea. Il 27/8 `diag:fabbisogno-media` — lo strumento scritto per
 * decidere se il fabbisogno dovesse passare alla media mobile — ha stampato quattro clienti con la
 * media mobile lontana **12,2 · 12,8 · 13,5 · 19,7 chili** dall'ultima pesata. In novanta giorni un
 * corpo non fa quel viaggio: non era la regola nuova a sbagliare, erano le pesate. Erano account di
 * prova (Simone, 28/8), quindi il danno non c'è stato — ⚠️ ma il danno era **possibile**, e il
 * fatto che questa volta le righe fossero finte non è una difesa: è solo fortuna. Da qui la
 * richiesta: *«non considerare questi account; se succede una cosa simile arriva il blocco e deve
 * intervenire la coach o il nutrizionista»*.
 *
 * ## Cosa guarda, e perché non guarda quello che sembrerebbe ovvio
 *
 * La cosa ovvia sarebbe misurare **quanto la media si scosta dall'ultima pesata**: è il numero che
 * si è visto nella tabella. Sarebbe però misurare il **sintomo**. Lo scostamento della media
 * dipende da quanto è larga la finestra e da quante pesate ci sono dentro: la stessa riga sbagliata
 * dà uno scarto diverso a seconda di un parametro che non c'entra niente col corpo della cliente, e
 * soprattutto **non dice quale pesata è sbagliata** — che è l'unica informazione utile a chi la
 * deve correggere.
 *
 * Qui si guarda invece la **coppia di pesate consecutive**: quanto è cambiato il peso, e in quanti
 * giorni. È l'affermazione fisiologica, e regge da sola: *un corpo non cambia di N chili in G
 * giorni*. Non dipende dalla finestra della media, e indica **le due righe** fra cui sta l'errore.
 *
 * ## Due condizioni insieme, e nessuna delle due basta
 *
 * - **il salto in chili** (`sogliaKg`, default 10): senza questo, due pesate a un giorno di distanza
 *   che differiscono di un chilo — acqua, sale, ora del giorno — farebbero 7 kg/settimana e
 *   suonerebbero tutti i giorni.
 * - **il ritmo in kg/settimana** (`sogliaRitmo`, default 7): senza questo, dieci chili in **due
 *   mesi** suonerebbero — ed è un percorso riuscito, non un errore.
 *
 * Servono entrambe, e il bordo è **incluso** (esattamente 10 kg a esattamente 7 kg/settimana
 * suona): con due soglie in E, includere il bordo è il verso in cui sbagliare che fa guardare una
 * riga in più, non una in meno.
 *
 * ## ⛔ Perché 10 e 7, e non 5 e 4 come nella prima stesura
 *
 * La prima stesura metteva 5 kg / 4 kg-settimana. La revisione ha tirato fuori i controesempi, e
 * sono **clienti vere e frequenti**: una signora di 130 kg che nella prima settimana di piano fa
 * 130 → 124,5 (glicogeno e acqua, non grasso) sarebbe stata bloccata; una post-parto 78 → 71 in
 * nove giorni; un avvio di diuretico su edema 95 → 89 in cinque; un rientro da due settimane di
 * vacanza a +8 kg. Tutte fisiologia normale, tutte zittite. ⚠️ Un guardrail che suona sul terzo
 * delle clienti non è severo: è **spento**, perché chi lo riceve impara a chiuderlo senza leggerlo.
 *
 * Con 10 kg **e** 7 kg/settimana — cioè dieci chili in dieci giorni — tutti i controesempi qui
 * sopra passano. ⚠️ Sopra questa soglia esiste ancora qualcosa di vero e raro (una paracentesi, un
 * edema drenato in ospedale): **e va bene così**, perché quello che chiediamo non è «cancellate il
 * dato» ma «qualcuno guardi» — e in quel caso guardare serve ancora di più.
 *
 * ## I quattro casi del 27/8 con le soglie nuove: presi, ma il conto va scritto
 *
 * Lo scarto che si vedeva nella diagnostica è **fra media e ultima pesata**, non fra due pesate. Con
 * la finestra a tre e la riga sbagliata in ultima posizione vale `scarto = 2·salto/3`, cioè
 * `salto = 1,5 · scarto`: i quattro scarti diventano salti di **18,3 · 19,2 · 20,3 · 29,6 kg**. Con
 * due sole pesate il fattore è 2 e i salti sono ancora più grossi. ⛔ **Quindi non è il salto in
 * chili a decidere: decidono i giorni.** Siccome `ritmo ≥ 7` equivale a `giorni ≤ salto`, quei
 * quattro sono presi se le due pesate distano meno di 18–29 giorni — cioè sempre, con la pesata
 * settimanale del ciclo.
 *
 * ⚠️ **E c'è un buco, va detto invece che scoperto dopo.** Chi rientra da una sospensione lunga —
 * modalità viaggio, un mese senza pesarsi — ha due pesate consecutive distanti: venti chili
 * sbagliati dopo venticinque giorni fanno 5,6 kg/settimana e **non scattano**. È proprio la cliente
 * del kit di rientro, cioè quella che `kcal-need.service.ts` descrive come «il caso che faceva il
 * danno più grosso». Un secondo ramo (un salto enorme a qualunque distanza) si scrive in tre righe,
 * ⛔ ma la soglia giusta è una decisione clinica e non la prendiamo noi: venti chili in tre mesi
 * senza pesarsi sono possibili per una persona molto pesante. Sta in elenco come
 * `pesate-lontane-buco-del-ritmo`.
 *
 * ## Cosa NON dice, e le parole vanno scelte di conseguenza
 *
 * ⛔ **Non dice «una delle due è sbagliata».** Non lo sa. Sa che il ritmo implicito è oltre soglia, e
 * quel dominio contiene sia gli errori di tastiera (la stragrande maggioranza) sia gli eventi
 * clinici veri (rari). ⚠️ Chi scrive i testi che escono da qui — segnalazione al nutrizionista,
 * avviso alla coach, riquadro in scheda — deve dire **tutt'e due le possibilità**, non la più
 * probabile: se dicessimo «è un errore di battitura» a chi ha davanti una diuresi vera, gli
 * faremmo cercare la cosa sbagliata. *Una ragione falsa è peggio di un ordine sbagliato.*
 *
 * ⚠️ E non dice **quale** delle due pesate è la buona. Le due righe hanno la stessa dignità: una 73
 * seguita da una 113 può essere un 113 digitato al posto di 73, oppure un 73 digitato al posto di
 * 173 mesi prima. Chi guarda ha la scheda, il grafico e il telefono della cliente; noi abbiamo due
 * numeri.
 *
 * ## Il rapporto col calo rapido, e cosa gli succede
 *
 * È la stessa forma dell'allarme calo rapido (`allarme-calo.ts`), ma non è la stessa cosa: quello
 * misura **un corpo** che cala troppo in fretta (1,5 kg/settimana), questo misura **un numero** di
 * cui non ci si può fidare. ⚠️ Sotto queste soglie i due convivono e il calo rapido suona come
 * sempre: fra 1,5 e 7 kg/settimana (con salti sotto i 10 kg) c'è tutta la banda dei cali veri e
 * gravi, ed è lì che vive il guardrail clinico. ⛔ **Sopra**, invece, il calo rapido tace e parla
 * questo — ed è voluto, ma il prezzo va detto: un calo vero di 12 kg in dieci giorni arriva al
 * nutrizionista come «pesate da verificare» e non come «calo rapido». Arriva, con la stessa
 * categoria clinica e lo stesso destinatario; cambia la frase, non la scrivania. Il testo della
 * segnalazione è scritto apposta perché in quel caso non sia fuorviante.
 *
 * ⚠️ Non copre il peso **assurdo in assoluto**: quello lo ferma già il DTO delle misure (35–250 kg)
 * al momento dell'inserimento. Qui si copre il buco che restava: due valori **entrambi plausibili**
 * che non possono stare insieme.
 *
 * Modulo **puro**: nessuna dipendenza, si collauda con una tabella di date e numeri.
 */

/** Una pesata, ridotta a quello che serve qui. */
export interface PesataPerCoerenza {
  date: Date;
  weightKg: number;
}

/** Due pesate consecutive che non possono essere della stessa persona. */
export interface SaltoImpossibile {
  /** La più vecchia delle due. */
  dal: Date;
  /** La più recente delle due. */
  al: Date;
  daKg: number;
  aKg: number;
  /** Giorni fra le due (mai meno di 1: vedi sotto). */
  giorni: number;
  /** Differenza in chili, sempre positiva. */
  salto: number;
  /** Ritmo implicito in kg/settimana. */
  ritmo: number;
}

export const SALTO_KG_DEFAULT = 10;
export const SALTO_RITMO_DEFAULT = 7;

/**
 * ⚠️ **La finestra è la stessa del fabbisogno, e deve restarlo.**
 *
 * `kcal-need.service.ts` importa questa costante invece di tenerne una sua. Se le due divergessero,
 * esisterebbe una pesata capace di **sporcare le calorie nel piatto** senza far suonare niente —
 * cioè esattamente il difetto che questo modulo esiste per chiudere. *Se due punti rispondono alla
 * stessa domanda, uno deve chiamare l'altro.*
 */
export const FINESTRA_GIORNI = 90;

const GIORNO = 86_400_000;

const arrotonda = (n: number): number => Math.round(n * 10) / 10;

/**
 * Tutte le coppie consecutive che non stanno in piedi, dalla più vecchia alla più recente.
 *
 * ⚠️ Le pesate si **riordinano qui dentro** invece di pretenderle ordinate: chi chiama le legge da
 * query diverse (`desc` per il fabbisogno, `asc` per gli alert) e un ordinamento sbagliato non
 * darebbe un errore — darebbe salti inventati con il segno rovesciato, cioè un guardrail che suona
 * a caso. Meglio pagare un `sort` che fidarsi.
 *
 * ⚠️ `Math.max(1, giorni)`: due pesate con la **stessa data** non esistono in banca dati (c'è un
 * vincolo di unicità su cliente+data), ma se arrivassero, dividere per zero darebbe `Infinity` e la
 * riga passerebbe comunque — quindi si contano come un giorno. Non è un ripiego prudente: due pesi
 * diversi di cinque chili **nello stesso giorno** sono un errore ancora più certo, non meno.
 */
export function saltiImpossibili(
  pesate: readonly PesataPerCoerenza[],
  sogliaKg: number = SALTO_KG_DEFAULT,
  sogliaRitmo: number = SALTO_RITMO_DEFAULT,
): SaltoImpossibile[] {
  const buone = (pesate ?? [])
    .filter((p) => p && p.date instanceof Date && Number.isFinite(p.date.getTime()) && Number.isFinite(p.weightKg))
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const fuori: SaltoImpossibile[] = [];
  for (let i = 1; i < buone.length; i++) {
    const prima = buone[i - 1];
    const dopo = buone[i];
    const salto = Math.abs(dopo.weightKg - prima.weightKg);
    const giorni = Math.max(1, Math.round((dopo.date.getTime() - prima.date.getTime()) / GIORNO));
    const ritmo = (salto / giorni) * 7;
    if (salto < sogliaKg || ritmo < sogliaRitmo) continue;
    fuori.push({
      dal: prima.date,
      al: dopo.date,
      daKg: prima.weightKg,
      aKg: dopo.weightKg,
      giorni,
      salto: arrotonda(salto),
      ritmo: arrotonda(ritmo),
    });
  }
  return fuori;
}

/**
 * Il salto più grosso, o `null` se le pesate stanno in piedi.
 *
 * ⚠️ Si ordina per **chili**, non per ritmo: è il numero che chi legge riconosce («da 73 a 113») e
 * quello che rende evidente quale coppia andare a guardare per prima. A parità di chili vince la
 * coppia più recente, perché è quella che sta decidendo le calorie di adesso.
 */
export function saltoPeggiore(
  pesate: readonly PesataPerCoerenza[],
  sogliaKg: number = SALTO_KG_DEFAULT,
  sogliaRitmo: number = SALTO_RITMO_DEFAULT,
): SaltoImpossibile | null {
  const tutti = saltiImpossibili(pesate, sogliaKg, sogliaRitmo);
  if (!tutti.length) return null;
  return tutti.reduce((peggio, s) => {
    if (s.salto > peggio.salto) return s;
    if (s.salto === peggio.salto && s.al.getTime() >= peggio.al.getTime()) return s;
    return peggio;
  });
}

/**
 * ⚠️ **Le date si scrivono come le legge una persona** (`giornoItaliano`, `common/date-only.ts`):
 * questa frase la leggono la coach e il nutrizionista, e un `2026-08-14` in mezzo a un testo
 * italiano è un terzo formato che chi legge deve tradurre a mente.
 */

/**
 * La frase per la coach, per il nutrizionista e per la diagnostica.
 *
 * ⚠️ Dice **le due pesate per intero** — date e valori — e non «peso incoerente» e basta: chi la
 * legge deve poter decidere senza aprire nient'altro, e soprattutto deve poter vedere da sé che
 * l'errore è in una delle due e non nella nostra regola.
 */
export function spiegaSalto(s: SaltoImpossibile): string {
  const g = s.giorni === 1 ? 'un giorno' : `${s.giorni} giorni`;
  return `da ${s.daKg} kg del ${giornoItaliano(s.dal)} a ${s.aKg} kg del ${giornoItaliano(s.al)}: ${s.salto} kg in ${g} (${s.ritmo} kg/settimana)`;
}
