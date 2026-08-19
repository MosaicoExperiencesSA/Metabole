import { BadRequestException } from '@nestjs/common';
import { giornoLocale } from '../common/date-only';

/**
 * LE REGOLE DELL'ELENCO DEI LAVORI, senza database.
 *
 * Stanno fuori dal servizio per la ragione di sempre in questo progetto: quello che si può provare
 * con un elenco di casi si prova con un elenco di casi. Il servizio resta la parte che scrive.
 */

/** Il minimo perché una voce voglia dire qualcosa a chi la rilegge fra un mese. */
export const TITOLO_MIN = 3;
export const TITOLO_MAX = 200;
export const CATEGORIA_DEFAULT = 'Da fare';

/**
 * LA PRIORITÀ — la dà Simone, dalla pagina (19/8).
 *
 * ⚠️ **Non è `blocca`.** `blocca` è un FATTO che chiunque può verificare — dietro questa voce c'è
 * una fila ferma —; la priorità è un GIUDIZIO, e lo dà una persona sola. Tenerle separate è quello
 * che permette di dire «lo so che ferma la coda, aspetta lo stesso»: con un campo solo quella frase
 * non si potrebbe più dire, e il rosso tornerebbe a voler dire «urgente» — cioè in un mese sarebbe
 * tutto rosso e il colore smetterebbe di dire qualcosa.
 *
 * ⚠️ **`neutra` è il default, non `bassa`.** Una voce nuova non è meno importante delle altre: è una
 * voce su cui nessuno si è ancora pronunciato. Metterla in fondo al posto di chi deve decidere è un
 * giudizio inventato, lo stesso difetto delle tre stelle di default (voce 270).
 */
export const PRIORITA = ['alta', 'neutra', 'bassa'] as const;
export type Priorita = (typeof PRIORITA)[number];
export const PRIORITA_DEFAULT: Priorita = 'neutra';

export const MSG_PRIORITA = `La priorità può essere solo: ${PRIORITA.join(', ')}.`;

/**
 * ⚠️ Un valore che non conosciamo **è un errore, non una neutra**.
 *
 * Il valore arriva dalla nostra pagina: se un giorno ci arriva «Alta » con uno spazio o «media»,
 * silenziosamente la voce che Simone aveva messo in cima tornerebbe in mezzo al mucchio — e lui lo
 * scoprirebbe non vedendola più. Meglio un errore che si legge subito.
 *
 * Gli spazi e le maiuscole sì: «Alta» dalla pagina e «alta» dal file sono la stessa cosa.
 */
export function normalizzaPriorita(v: unknown): Priorita {
  const t = (typeof v === 'string' ? v : '').trim().toLowerCase();
  if (!(PRIORITA as readonly string[]).includes(t)) throw new BadRequestException(MSG_PRIORITA);
  return t as Priorita;
}

/** Alta prima, bassa in fondo: il peso dell'ordinamento, in un posto solo. */
export const PESO_PRIORITA: Record<Priorita, number> = { alta: 0, neutra: 1, bassa: 2 };

export interface DatiLavoro {
  titolo?: unknown;
  dettaglio?: unknown;
  categoria?: unknown;
  ordine?: unknown;
  blocca?: unknown;
  priorita?: unknown;
}

/**
 * Ripulisce quello che arriva dalla pagina, e torna **solo i campi presenti**.
 *
 * ⚠️ `undefined` e stringa vuota sono cose diverse — «non te l'ho mandato» contro «l'ho svuotato» —
 * ed è la stessa distinzione di `common/non-perdere.ts`: confonderle è il modo in cui una modifica
 * di un campo ne cancella un altro senza che nessuno se ne accorga.
 */
export function normalizzaLavoro(d: DatiLavoro, obbligaTitolo: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.titolo !== undefined) {
    const t = typeof d.titolo === 'string' ? d.titolo.trim() : '';
    if (t.length < TITOLO_MIN) throw new BadRequestException(MSG_TITOLO);
    out.titolo = t.slice(0, TITOLO_MAX);
  } else if (obbligaTitolo) {
    throw new BadRequestException(MSG_TITOLO);
  }
  if (d.dettaglio !== undefined) {
    const v = typeof d.dettaglio === 'string' ? d.dettaglio.trim() : '';
    // Il dettaglio è facoltativo: svuotarlo è un gesto legittimo, e qui `''` diventa `null`.
    out.dettaglio = v ? v.slice(0, 4000) : null;
  }
  if (d.categoria !== undefined) {
    const v = typeof d.categoria === 'string' ? d.categoria.trim() : '';
    out.categoria = v ? v.slice(0, 80) : CATEGORIA_DEFAULT;
  }
  if (d.blocca !== undefined) {
    // ⚠️ Il rosso: «finché questa non si chiude, dietro c'è una fila ferma». Non «urgente».
    out.blocca = d.blocca === true || d.blocca === 'true' || d.blocca === 1;
  }
  if (d.ordine !== undefined) {
    const n = Number(d.ordine);
    out.ordine = Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  if (d.priorita !== undefined) {
    // ⚠️ Non si azzera con la stringa vuota come il dettaglio: «senza priorità» non esiste, esiste
    // «neutra». Un campo vuoto qui sarebbe un quarto stato che nessuno ha chiesto.
    out.priorita = normalizzaPriorita(d.priorita);
  }
  return out;
}

export const MSG_TITOLO = 'Scrivi cosa c\'è da fare: bastano poche parole, ma devono dirlo.';

/**
 * Cosa scrive la risposta.
 *
 * ⚠️ **Svuotarla azzera anche chi e quando**, come per la spunta: una risposta cancellata che lascia
 * dietro «risposto da Simone il 13/8» racconta che qualcuno ha risposto, quando non c'è più niente.
 *
 * ⚠️ La risposta **non** spunta la voce. Sapere una cosa e averla fatta sono due stati diversi, e
 * confonderli farebbe sparire dall'elenco proprio le voci che hanno appena ricevuto quello che
 * serviva per lavorarci.
 */
export function datiRisposta(testo: unknown, staffId: string | null | undefined, adesso: Date) {
  const v = typeof testo === 'string' ? testo.trim() : '';
  if (!v) return { risposta: null, rispostaIl: null, rispostaDaId: null };
  return { risposta: v.slice(0, 8000), rispostaIl: adesso, rispostaDaId: staffId ?? null };
}

/**
 * Cosa scrive la spunta.
 *
 * ⚠️ **Togliendola si azzerano anche chi e quando.** Una voce riaperta che continua a dire «fatta da
 * Simone il 13 agosto» è la riga che fa perdere fiducia in tutta la lista — e una lista di cui non
 * ci si fida non si guarda più, che è l'unico modo in cui questa pagina può fallire.
 *
 * ⚠️ Chi spunta senza scheda staff (un admin creato a mano) lascia `null` nel nome: la voce resta
 * fatta, con la sua data. Meglio una spunta senza nome che una spunta rifiutata.
 */
export function datiSpunta(fatto: boolean, staffId: string | null | undefined, adesso: Date) {
  return {
    fatto,
    fattoIl: fatto ? adesso : null,
    fattoDaId: fatto ? (staffId ?? null) : null,
  };
}

/**
 * L'ordine della pagina: **da fare in cima, fatte in fondo**, e fra le fatte le ultime chiuse per
 * prime.
 *
 * Le fatte non spariscono — è la parte «così è tutto registrato» della richiesta — ma non devono
 * nemmeno stare in mezzo, o l'elenco smette di rispondere a «cosa resta» a colpo d'occhio.
 */
export function ordinaLavori<T extends { fatto: boolean; fattoIl?: Date | null; priorita?: string | null }>(righe: T[]): T[] {
  /**
   * ⚠️ **La priorità viene prima della categoria, e prima di `blocca`.** È la richiesta del 19/8
   * («aggiungi la possibilità per me di dare le priorità»), e serve a una cosa sola: che l'elenco
   * risponda a «cosa faccio adesso» invece che a «cosa esiste». Il `blocca` resta il colore e resta
   * nel testo, ma non decide più l'ordine: una voce può bloccare altro lavoro **ed essere
   * rimandata**, ed è proprio la frase che le due colonne separate permettono di dire.
   *
   * ⚠️ A parità di priorità l'ordine **non si tocca**: resta quello che ha mandato il server
   * (categoria, `ordine`, data). Un secondo criterio inventato qui farebbe muovere le righe sotto
   * gli occhi di chi le sta guardando senza che nessuno l'abbia chiesto.
   */
  const peso = (r: T) => PESO_PRIORITA[(r.priorita ?? PRIORITA_DEFAULT) as Priorita] ?? PESO_PRIORITA.neutra;
  const daFare = righe
    .filter((r) => !r.fatto)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => peso(a.r) - peso(b.r) || a.i - b.i)
    .map((x) => x.r);
  const fatte = righe.filter((r) => r.fatto).sort((a, b) => (b.fattoIl?.getTime() ?? 0) - (a.fattoIl?.getTime() ?? 0));
  return [...daFare, ...fatte];
}

/** Quel che serve al riassunto: niente Prisma, così si prova con un elenco di oggetti. */
export interface LavoroDaRiassumere {
  titolo: string;
  dettaglio?: string | null;
  categoria: string;
  blocca: boolean;
  fatto: boolean;
  priorita?: string | null;
  /** Quando è nato il punto, se lo sappiamo. Vedi `dataDiNascita`. */
  nataIl?: Date | null;
  /** Quando la riga è entrata in elenco. ⚠️ Non è la stessa cosa: vedi `dataDiNascita`. */
  createdAt?: Date | null;
  risposta?: string | null;
  rispostaIl?: Date | null;
  rispostaDa?: { displayName: string } | null;
}

/**
 * «QUANDO È NATO QUESTO PUNTO» — e i due modi diversi di rispondere (19/8, richiesta di Simone:
 * «altrimenti non capisco nulla»).
 *
 * ⚠️ `createdAt` **non** è la data di nascita per le voci che vengono dal file: entrano tutte
 * insieme al clic su «Aggiorna dal rilascio», quindi cento voci nate in due settimane risulterebbero
 * create nello stesso minuto. Spacciare quella per la data di nascita sarebbe una **data falsa**, e
 * una data falsa è peggio di una assente: si legge come un fatto e non si può controllare.
 *
 * Perciò due risposte con parole diverse — ed è il solito terzo stato di questo progetto, quello che
 * dice «non lo so» invece di indovinare.
 */
export function dataDiNascita(l: { nataIl?: Date | null; createdAt?: Date | null }): { quando: Date; certa: boolean } | null {
  if (l.nataIl) return { quando: l.nataIl, certa: true };
  if (l.createdAt) return { quando: l.createdAt, certa: false };
  return null;
}

/**
 * IL TESTO DA INCOLLARE IN CHAT — il pulsante «Copia per Claude».
 *
 * Richiesta di Simone (13/8): «così posso consultarmi, inserire mano a mano, e poi te le esporto al
 * momento giusto». Il database non è raggiungibile da fuori — e non deve esserlo — quindi il ponte è
 * lui che copia e incolla. Questa funzione fa il testo.
 *
 * ⚠️ **Solo le voci APERTE.** Lo storico sono 481 righe: incollarle tutte vorrebbe dire annegare le
 * dieci che contano dentro sei mesi di cose già fatte. Chi vuole lo storico apre la pagina.
 *
 * ⚠️ **I blocchi per primi, dentro ogni gruppo**: è l'ordine in cui va letto: quello che tiene ferme
 * altre cose viene prima di quello che aspetta e basta.
 *
 * ⚠️ La data si scrive con `giornoLocale`, non con `toISOString`: è la lezione del 13/8, tre test
 * che erano veri solo a Greenwich.
 */
export function testoPerClaude(righe: LavoroDaRiassumere[]): string {
  const aperte = righe.filter((r) => !r.fatto);
  const conRisposta = aperte.filter((r) => (r.risposta ?? '').trim()).length;
  const out: string[] = [];
  out.push(`# Lavori Metabole — ${aperte.length} aperte, ${conRisposta} con una risposta`);
  out.push('');
  out.push('Estratto dalla pagina Lavori del backoffice. Le voci già fatte non ci sono.');
  out.push('Legenda: 🔴 blocca altro lavoro · 🟡 aspetta una persona o una decisione.');
  out.push('La priorità la dà Simone dalla pagina: si scrive solo quando è alta o bassa.');
  out.push('');
  const categorie = Array.from(new Set(aperte.map((r) => r.categoria)));
  for (const c of categorie) {
    // ⚠️ Stesso ordine della pagina: la priorità prima, e a parità di priorità quello che blocca.
    // Due ordini diversi per la stessa lista vorrebbero dire che il testo incollato in chat e la
    // pagina non raccontano la stessa cosa — ed è la lista su cui si decide cosa fare.
    const voci = aperte
      .filter((r) => r.categoria === c)
      .map((r, i) => ({ r, i }))
      .sort((a, b) =>
        (PESO_PRIORITA[(a.r.priorita ?? PRIORITA_DEFAULT) as Priorita] ?? 1) - (PESO_PRIORITA[(b.r.priorita ?? PRIORITA_DEFAULT) as Priorita] ?? 1) ||
        Number(b.r.blocca) - Number(a.r.blocca) || a.i - b.i)
      .map((x) => x.r);
    out.push(`## ${c}`);
    out.push('');
    for (const v of voci) {
      const segno = v.blocca ? '🔴' : /^aspetta/i.test(v.categoria) ? '🟡' : '·';
      // ⚠️ La priorità si scrive solo quando qualcuno l'ha data: stampare «(neutra)» su ogni riga
      // riempirebbe il testo di una parola che non aggiunge niente, e le due «alta» sparirebbero
      // in mezzo. Un contrassegno che c'è sempre non contrassegna niente.
      const pr = (v.priorita ?? PRIORITA_DEFAULT) !== PRIORITA_DEFAULT ? ` [priorità ${v.priorita}]` : '';
      out.push(`### ${segno} ${v.titolo}${pr}`);
      const nata = dataDiNascita(v);
      // ⚠️ «Aperta il» e «in elenco dal» sono due fatti diversi: vedi `dataDiNascita`.
      if (nata) out.push(nata.certa ? `Aperta il ${giornoLocale(nata.quando)}` : `In elenco dal ${giornoLocale(nata.quando)} (data del caricamento, non di nascita)`);
      if ((v.dettaglio ?? '').trim()) out.push(`Domanda: ${v.dettaglio!.trim()}`);
      const risposta = (v.risposta ?? '').trim();
      if (risposta) {
        const firma = [v.rispostaIl ? giornoLocale(v.rispostaIl) : null, v.rispostaDa?.displayName ?? null]
          .filter(Boolean)
          .join(', ');
        out.push(`RISPOSTA${firma ? ` (${firma})` : ''}: ${risposta}`);
      }
      out.push('');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}
