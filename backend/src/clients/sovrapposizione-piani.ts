/**
 * LA MATITA DICE COSA STA PER ROMPERE (voce 259, §4b di `NOTA_Due_Piani_Attivi_Lorena.md`).
 *
 * Il 16/8, quarantotto secondi dopo l'acquisto di un secondo piano, qualcuno ha aperto la scheda di
 * Lorena e ha spostato la data d'inizio. Ha fatto la cosa giusta con quello che le era
 * stato mostrato — la scheda scriveva «Inizio piano: 25/08», che era la data del piano IN CODA — ma
 * il risultato è stato **due piani attivi insieme**. La matita non lo ha detto, perché non lo sapeva:
 * spostava una data e non guardava le altre righe.
 *
 * ⚠️ **Conferma e non divieto.** Chi gestisce le schede a volte deve davvero forzare (un rimborso da
 * sistemare, una promessa fatta al telefono), e un divieto secco si aggira facendo peggio: una riga
 * cambiata a mano nel database, che non lascia traccia e non passa da nessun controllo. Quindi si
 * chiede, con le parole giuste, e si registra chi ha confermato.
 *
 * ⚠️ Modulo **puro**: nessuna lettura, nessuna scrittura, nessun `Date.now()` implicito. Il giudizio
 * «chi è attivo» resta di `commerce/abbonamento-in-corso.ts` — qui si risponde a una domanda diversa
 * e nuova: *dopo lo spostamento, questa riga finirebbe addosso a un'altra?*
 */

import { giornoLocale } from '../common/date-only';

/** Un piano, per quello che serve qui: le sue date, il suo stato e come si chiama. */
export interface PianoDatato {
  id: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  /** Il nome che l'operatore legge in scheda: senza, la frase non dice contro cosa si va a sbattere. */
  nome?: string | null;
}

export interface Sovrapposizione {
  id: string;
  nome: string;
  /** `in_corso` = sta erogando adesso · `in_coda` = comincia dopo oggi. */
  quando: 'in_corso' | 'in_coda';
  inizio: Date | null;
  fine: Date | null;
}

/**
 * Il giorno **locale** (fuso aziendale), non quello UTC.
 *
 * ⚠️ Prima qui c'era `toISOString().slice(0,10)`, e il commento diceva «la stessa lettura di
 * `staErogando`» — non lo era: `abbonamento-in-corso.ts` azzera l'ora in locale. Con il server su
 * Europe/Rome, fra mezzanotte e le due il giorno UTC è ancora **ieri**: un piano concluso ieri
 * superava il filtro «non ancora finito» e faceva scattare un avviso fantasma, e un piano che parte
 * oggi veniva chiamato «in coda da oggi». Finestra stretta — e sono le ore in cui si correggono le
 * schede, cioè quelle in cui è successo il caso Lorena.
 */
const giorno = (d: Date): string => giornoLocale(d);

/**
 * Due periodi si sovrappongono?
 *
 * ⚠️ **Toccarsi non è sovrapporsi**: se un piano finisce il 25/08 e il successivo comincia il 25/08,
 * quello è il **passaggio di testimone normale** — è la coda che `finalizeApproval` costruisce da
 * sola, mettendo l'inizio del piano nuovo esattamente alla fine di quello in corso. Contarlo come
 * sovrapposizione voleva dire far scattare l'avviso del caso Lorena su **ogni rinnovo**, anche
 * risalvando la stessa identica data: e un avviso che compare sempre è un avviso che si impara a
 * cliccare via, cioè uno che non c'è il giorno che serve.
 * ⚠️ Nemmeno la cliente ne riceve due: quel giorno `attivoInCorso` sceglie **uno** dei due (quello
 * che finisce più tardi) e serve solo quello. La sovrapposizione vera è quella che dura, e comincia
 * dal giorno **dopo** il testimone.
 * ⚠️ Fine assente = piano **aperto**: non finisce mai, quindi si sovrappone a tutto quello che viene
 * dopo il suo inizio. Trattarla come «finisce oggi» era il modo di non vedere il caso peggiore.
 * ⚠️ Inizio assente = «già cominciato», la stessa lettura di `staErogando` e di
 * `filtroClienteConPianoAttivo`: due regole diverse sullo stesso campo nullo farebbero divergere
 * l'avviso dall'erogazione.
 */
export function siSovrappongono(
  aInizio: Date | null,
  aFine: Date | null,
  bInizio: Date | null,
  bFine: Date | null,
): boolean {
  if (aFine && bInizio && giorno(aFine) <= giorno(bInizio)) return false;
  if (bFine && aInizio && giorno(bFine) <= giorno(aInizio)) return false;
  return true;
}

/**
 * I piani che, dopo lo spostamento, si troverebbero addosso a quello spostato.
 *
 * Contano solo gli **attivi non conclusi**: un `cancelled` è una decisione già presa, un `expired` è
 * finito, e un `pending` è un carrello — ⚠️ non una promessa, ed è la stessa lettura che
 * `abbonamentoInCoda` dà del pending. Sovrapporsi a uno di quelli non produce due menu.
 */
export function pianiSovrapposti(
  altri: readonly PianoDatato[],
  nuovoInizio: Date,
  nuovaFine: Date,
  oggi: Date = new Date(),
): Sovrapposizione[] {
  const g = giorno(oggi);
  return (altri ?? [])
    .filter((p) => p.status === 'active')
    .filter((p) => !p.endDate || giorno(p.endDate) >= g) // già finito: non eroga niente
    .filter((p) => siSovrappongono(nuovoInizio, nuovaFine, p.startDate, p.endDate))
    .map((p) => ({
      id: p.id,
      nome: p.nome ?? 'un altro piano',
      quando: p.startDate && giorno(p.startDate) > g ? ('in_coda' as const) : ('in_corso' as const),
      inizio: p.startDate,
      fine: p.endDate,
    }));
}

const gg = (d: Date | null): string =>
  d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : 'senza data';

/**
 * La frase da mostrare a chi ha la matita in mano.
 *
 * ⚠️ Deve dire **tre** cose, e sono le tre che il 16/8 non c'erano: contro **cosa** si va a sbattere
 * (col nome, non «un abbonamento»), **quando** quello arriva o finisce, e **cosa succede** alla
 * cliente. «Attenzione: sovrapposizione» non è un avviso, è un rumore: chi lo legge non sa cosa
 * decidere e clicca avanti.
 *
 * ⚠️ Torna un **pezzo di frase**, non il messaggio intero: «Attenzione:» in testa e «se è quello che
 * vuoi, conferma» in coda li mette chi chiama, perché gli avvisi della matita sono due e quando
 * capitano insieme si chiedono in una domanda sola — con due `if` separati sullo stesso `conferma`,
 * confermare il primo zittiva il secondo.
 */
export function fraseSovrapposizione(
  sovrapposti: readonly Sovrapposizione[],
  nomeSpostato: string,
  nuovoInizio: Date,
  nuovaFine: Date,
): string {
  const primo = sovrapposti[0];
  const altri = sovrapposti.length - 1;
  const chi =
    primo.quando === 'in_coda'
      ? `«${primo.nome}» è in coda dal ${gg(primo.inizio)}`
      : `«${primo.nome}» sta erogando${primo.fine ? ` fino al ${gg(primo.fine)}` : ' e non ha una scadenza'}`;
  const coda = altri > 0 ? ` (e altri ${altri})` : '';
  return (
    `${chi}${coda}. Portando «${nomeSpostato}» dal ${gg(nuovoInizio)} al ${gg(nuovaFine)} ` +
    'la cliente avrà due piani attivi insieme: i menu glieli darà uno solo dei due (quello che finisce ' +
    'più tardi) e i giorni dell\'altro scorreranno senza che riceva niente. Se non è voluto, annulla ' +
    'prima il piano che non serve.'
  );
}
