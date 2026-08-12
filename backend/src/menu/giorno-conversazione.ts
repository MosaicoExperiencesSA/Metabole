/**
 * DI QUALE GIORNO STIAMO PARLANDO (§16.2).
 *
 * «Anche il menu di domani o dopodomani, se lo vedo.» Fino a qui il dialogo con Gaia sapeva fare i
 * conti con **una** giornata: quella di oggi, cablata in sei punti diversi del servizio. Una cliente
 * che apriva il menu di domani e chiedeva una sostituzione stava chiedendo una cosa che non le
 * potevamo dare — e la risposta che riceveva («non vedo il menu di oggi») non c'entrava niente con
 * quello che aveva davanti.
 *
 * Qui vivono le tre decisioni che servono a spostare la conversazione su un altro giorno: come si
 * riconosce il giorno da quello che scrive, come lo si chiama parlandole, e quali giorni sono
 * ammessi. Nessuna dipendenza da Nest né da Prisma: solo stringhe `YYYY-MM-DD`.
 *
 * ## ⚠️ Perché NON si riusa `leggiData` di `data-inizio-chat.ts`
 *
 * Quel parser esiste, è buono, e riconosce molto di più: «il 15», «fra tre giorni», «15 settembre».
 * Ma nasce per una domanda diversa — *quando vuoi cominciare il piano?* — dove un numero nella
 * frase è quasi sempre una data. Qui la stessa frase parla di **grammi**: «togli il 15», «mettine
 * 20», «facciamo 100 di pasta». Con quel parser «togli il 15» diventerebbe «il quindici del mese»,
 * e la cliente si vedrebbe correggere il menu di un giorno a caso.
 *
 * Quindi qui si riconoscono solo le parole che nella lingua parlata indicano un giorno e nient'altro:
 * oggi/stasera, domani, dopodomani, e i nomi dei giorni della settimana. Bastano: il menu visibile
 * arriva a una settimana scarsa, e un giorno più in là del nome della settimana non è raggiungibile
 * comunque.
 */

const GIORNI_SETTIMANA = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/**
 * Quanto in là si può spostare la conversazione. Non è un limite di prodotto: è il limite di
 * quello che la cliente **vede**, e serve solo a non far calcolare a Gaia un giorno che poi non
 * troverà. Il perimetro vero lo decide il database (`visibleFrom <= oggi`).
 */
export const GIORNI_AVANTI_MAX = 13;

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Una data-solo `YYYY-MM-DD` come `Date` in UTC: niente fusi, nessuna ora. */
function comeData(iso: string): Date {
  const [a, m, g] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, (m ?? 1) - 1, g ?? 1));
}

const comeIso = (d: Date): string => d.toISOString().slice(0, 10);

export function sommaGiorni(iso: string, giorni: number): string {
  const d = comeData(iso);
  d.setUTCDate(d.getUTCDate() + giorni);
  return comeIso(d);
}

/** Quanti giorni separano `iso` da `oggiIso` (negativo se è passato). */
export function distanzaGiorni(iso: string, oggiIso: string): number {
  return Math.round((comeData(iso).getTime() - comeData(oggiIso).getTime()) / 86_400_000);
}

/**
 * Il giorno di cui la cliente sta parlando, o `null` se non l'ha detto.
 *
 * ⚠️ Sul nome del giorno della settimana la regola è **diversa** da quella della data di inizio
 * piano: lì «lunedì» detto di lunedì significa *fra sette giorni*, perché un piano che comincia si
 * guarda in avanti. Qui significa **oggi**: una cliente che di giovedì scrive «giovedì a pranzo ho
 * il minestrone» sta guardando il piatto che ha davanti, non quello della settimana prossima.
 *
 * Restituisce sempre una data compresa fra oggi e `GIORNI_AVANTI_MAX`, oppure `null`: il passato
 * non si corregge — un menu di ieri è una cosa che è già stata mangiata.
 */
export function giornoDalTesto(testo: string, oggiIso: string): string | null {
  const t = normalizza(testo);
  if (!t) return null;

  if (/\bdopodomani\b/.test(t)) return sommaGiorni(oggiIso, 2);
  if (/\bdomani\b/.test(t)) return sommaGiorni(oggiIso, 1);
  // «stasera», «stamattina» e «stanotte» sono oggi: la cliente sta parlando della cena o della
  // colazione che ha già sul menu davanti.
  if (/\b(oggi|stasera|stamattina|stamane|stanotte|adesso)\b/.test(t)) return oggiIso;

  const oggiGiorno = comeData(oggiIso).getUTCDay();
  for (let i = 0; i < GIORNI_SETTIMANA.length; i += 1) {
    // `\b` con la radice: prende «lunedi» e «lunedì» (l'accento è già caduto), e «di lunedì».
    if (!new RegExp(`\\b${GIORNI_SETTIMANA[i]}\\b`).test(t)) continue;
    const avanti = (i - oggiGiorno + 7) % 7; // 0 = oggi stesso, ed è quello che vuol dire
    return sommaGiorni(oggiIso, avanti);
  }
  return null;
}

/**
 * Come si chiama quel giorno parlandole: «oggi», «domani», «dopodomani», «giovedì 14».
 *
 * Il nome con il numero serve dal terzo giorno in poi: «giovedì» da solo, detto di martedì, è
 * ambiguo quanto una data — e su un menu che si sta per riscrivere l'ambiguità costa un piatto.
 * Minuscolo di proposito: queste etichette finiscono **dentro** una frase, non in cima.
 */
export function etichettaGiorno(dataIso: string, oggiIso: string): string {
  const d = distanzaGiorni(dataIso, oggiIso);
  if (d === 0) return 'oggi';
  if (d === 1) return 'domani';
  if (d === 2) return 'dopodomani';
  const data = comeData(dataIso);
  return `${GIORNI_SETTIMANA[data.getUTCDay()].replace(/i$/, 'ì')} ${data.getUTCDate()} ${MESI[data.getUTCMonth()]}`;
}

/** Vero se la conversazione parla della giornata di oggi: il caso normale, e quello di prima. */
export const eOggi = (dataIso: string | null | undefined, oggiIso: string): boolean =>
  !dataIso || dataIso === oggiIso;

/**
 * Il giorno su cui lavorare, dati: quello che ha appena scritto, quello che la conversazione si
 * porta dietro, e oggi.
 *
 * L'ordine non è casuale. Se in questo messaggio ha nominato un giorno, vince quello: sta
 * correggendo il tiro, ed è l'informazione più fresca che abbiamo. Altrimenti si resta su quello di
 * cui si stava parlando — perché una conversazione su domani non deve tornare a oggi solo perché la
 * frase successiva è «sì, va bene».
 */
export function giornoDellaConversazione(input: {
  testo?: string | null;
  statoData?: string | null;
  oggiIso: string;
}): string {
  const daTesto = input.testo ? giornoDalTesto(input.testo, input.oggiIso) : null;
  if (daTesto) return daTesto;
  if (input.statoData) {
    // Lo stato viaggia appeso a un messaggio, e un messaggio può essere vecchio: una conversazione
    // ripresa il giorno dopo si porterebbe dietro un «domani» che nel frattempo è diventato ieri.
    // Fuori dalla finestra si torna a oggi, che è sempre una risposta sensata.
    const d = distanzaGiorni(input.statoData, input.oggiIso);
    if (d >= 0 && d <= GIORNI_AVANTI_MAX) return input.statoData;
  }
  return input.oggiIso;
}
