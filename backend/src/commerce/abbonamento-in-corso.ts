/**
 * FRA DUE PIANI ATTIVI, QUALE «È» IL PIANO — la scelta che nessuno faceva.
 *
 * Un piano messo in coda si scrive `active` con una data d'inizio futura (`finalizeApproval`).
 * Quindi due righe `active` sulla stessa cliente sono **legittime**: una sta erogando, l'altra
 * aspetta. Ma quattro punti del codice, davanti a due righe, ne prendevano una **senza scegliere**:
 *
 * | dove | come la prendeva | cosa ne usciva |
 * |---|---|---|
 * | `commerce.service` `pickMainSubscription` | la prima di una lista `createdAt desc` = **la più recente** | la scheda mostrava il piano IN CODA come piano corrente, e la matita spostava quello |
 * | `menu.service` (erogazione) | `findFirst` **senza `orderBy`** | «piano concluso?» e `planEnd` decisi da una riga a caso: quanti giorni di menu arrivano dipendeva dall'ordine del database |
 * | `pause.service` (congelamento) | `orderBy createdAt desc` | i giorni di pausa sommati alla fine del piano **sbagliato**: concessi sulla carta, mai ricevuti |
 * | `coach.service` (lista clienti) | `new Map(subs.map(…))`, che **tiene l'ultima** | `planEndDate` poteva essere la fine del piano in coda |
 *
 * ⚠️ È il caso Lorena Polidoro del 16/8, e la parte che nella prima ricostruzione mancava: la scheda
 * non è che *non avvisava* — mostrava «Inizio piano: 25/08», cioè la data del piano in coda. Chi l'ha
 * aperta ha corretto una data sbagliata, e la matita ha spostato la stessa riga sbagliata. Ha fatto
 * la cosa giusta con quello che le era stato mostrato.
 *
 * ## La regola
 *
 * 1. **Chi sta erogando oggi**: `active`, cominciato, non finito. Se ce n'è più d'uno — lo stato
 *    rotto — vince **quello che finisce più tardi**.
 * 2. Se nessuno eroga: **il primo che partirà**, cioè la coda.
 * 3. Se non c'è nessun `active`: `null`, e chi chiama si comporta come prima.
 *
 * ⚠️ **«Finisce più tardi» e non «cominciato prima»**: se due piani si sovrappongono la cliente ha
 * pagato fino alla fine del secondo, e prendere la fine più vicina le taglierebbe giorni che ha
 * comprato. Fra due scelte imperfette si prende quella che non toglie niente a nessuno.
 *
 * ⚠️ **`startDate` nulla vuol dire «già cominciato»**, non «non ancora»: è come si comporta già
 * `filtroClienteConPianoAttivo` (`common/piano-attivo.ts`), che guarda solo la fine. Due regole
 * diverse sullo stesso campo farebbero divergere l'erogazione dalle diagnostiche, che è il modo in
 * cui questi difetti nascono.
 *
 * ⚠️ **Questo non è lo stato `queued`.** La causa resta quella (`NOTA_Due_Piani_Attivi_Lorena.md`
 * §4a). Qui si rende **deterministico** un comportamento che dipendeva dall'ordine delle righe: è
 * meno, ed è quello che si può fare senza migrazione e senza rivedere 47 letture.
 *
 * Decisione: `progetto/NOTA_Chi_Sta_Erogando_Adesso.md`.
 */

/** Quello che serve per scegliere. Chi chiama si tiene i suoi campi in più. */
export interface AbbonamentoDatato {
  status: string;
  startDate: Date | null;
  endDate: Date | null;
}

/** Mezzanotte del giorno di `d`: i confronti si fanno per GIORNO, come nel resto del motore. */
const giorno = (d: Date): number => {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

/**
 * Sta erogando OGGI: attivo, cominciato (o senza data d'inizio), e non ancora finito.
 *
 * ⚠️ La fine si confronta per giorno e **compresa**: l'ultimo giorno del piano è un giorno di piano.
 * Un `active` con la fine già passata è il cron di scadenza in ritardo, e non sta erogando niente —
 * lo stesso giudizio che dà `menu.service` prima di generare, e che `piano-attivo.ts` chiama
 * «scaduto da chiudere».
 */
export function staErogando(s: AbbonamentoDatato, oggi: Date = new Date()): boolean {
  if (s.status !== 'active') return false;
  const g = giorno(oggi);
  if (s.startDate && giorno(s.startDate) > g) return false;
  if (s.endDate && giorno(s.endDate) < g) return false;
  return true;
}

/** Attivo ma comincia DOPO oggi: è in coda dietro a un altro piano. */
export function eInCoda(s: AbbonamentoDatato, oggi: Date = new Date()): boolean {
  return s.status === 'active' && !!s.startDate && giorno(s.startDate) > giorno(oggi);
}

/** Ordine di fine, con «nessuna fine» in cima: un piano senza scadenza dura più di tutti. */
const finePiuLontana = <T extends AbbonamentoDatato>(a: T, b: T): T => {
  if (!a.endDate) return a;
  if (!b.endDate) return b;
  return a.endDate.getTime() >= b.endDate.getTime() ? a : b;
};

/** Ordine d'inizio: la coda che parte prima. */
const iniziaPrima = <T extends AbbonamentoDatato>(a: T, b: T): T =>
  (a.startDate?.getTime() ?? 0) <= (b.startDate?.getTime() ?? 0) ? a : b;

/**
 * L'abbonamento attivo che conta ADESSO: quello che sta erogando, altrimenti il primo della coda.
 *
 * ⚠️ Torna `null` anche quando ci sono righe `pending`, `expired` o `cancelled`: questa funzione
 * risponde solo su `active`. Chi ha bisogno della scala completa degli stati usa
 * `pickMainSubscription`, che chiama questa per il suo primo passo.
 */
export function attivoInCorso<T extends AbbonamentoDatato>(subs: readonly T[], oggi: Date = new Date()): T | null {
  const attivi = subs.filter((s) => s.status === 'active');
  if (!attivi.length) return null;

  const erogano = attivi.filter((s) => staErogando(s, oggi));
  if (erogano.length) return erogano.reduce(finePiuLontana);

  const inCoda = attivi.filter((s) => eInCoda(s, oggi));
  if (inCoda.length) return inCoda.reduce(iniziaPrima);

  // Restano solo attivi con la fine PASSATA (il cron di scadenza in ritardo): non erogano niente,
  // ma sono l'unica cosa che c'è e chi chiama si aspetta una riga come prima — tornare `null` qui
  // farebbe sparire il piano dalla scheda di chi lo sta guardando. Si dà quello finito per ultimo,
  // che è il più recente dei due nell'unico senso che conta per una cliente.
  return attivi.reduce(finePiuLontana);
}

/**
 * Il piano in coda dietro a quello in corso, se c'è. Serve a chi deve **dirlo** — la matita che
 * avvisa prima di sovrapporre, e la pastiglia che scrive «in coda dal 25/08» invece di un secondo
 * «Attivo» identico al primo.
 */
export function abbonamentoInCoda<T extends AbbonamentoDatato>(
  subs: readonly T[],
  oggi: Date = new Date(),
): T | null {
  const inCoda = subs.filter((s) => eInCoda(s, oggi));
  return inCoda.length ? inCoda.reduce(iniziaPrima) : null;
}
