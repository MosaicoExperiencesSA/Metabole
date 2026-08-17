/**
 * LA MATITA DICE COSA STA PER ROMPERE (voce 259, §4b di `NOTA_Due_Piani_Attivi_Lorena.md`).
 *
 * Il 16/8, quarantotto secondi dopo l'acquisto di un secondo piano, qualcuno ha aperto la scheda di
 * Lorena Polidoro e ha spostato la data d'inizio. Ha fatto la cosa giusta con quello che le era
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

const giorno = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Due periodi si toccano?
 *
 * ⚠️ Confronto per **giorno** e fine **compresa**, come tutto il resto del prodotto: l'ultimo giorno
 * di un piano è un giorno di piano, e due piani che si passano il testimone lo stesso giorno sono
 * sovrapposti per un giorno — che è esattamente il caso in cui una cliente riceve due menu.
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
  if (aFine && bInizio && giorno(aFine) < giorno(bInizio)) return false;
  if (bFine && aInizio && giorno(bFine) < giorno(aInizio)) return false;
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
 * ⚠️ Si chiude come l'altro avviso della stessa matita («se è quello che vuoi, conferma»), perché è
 * la stessa promessa: non è un divieto.
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
    `Attenzione: ${chi}${coda}. Portando «${nomeSpostato}» dal ${gg(nuovoInizio)} al ${gg(nuovaFine)} ` +
    'la cliente avrà due piani attivi insieme: i menu glieli darà uno solo dei due (quello che finisce ' +
    'più tardi) e i giorni dell\'altro scorreranno senza che riceva niente. Se è quello che vuoi, ' +
    'conferma; altrimenti annulla prima il piano che non serve.'
  );
}
