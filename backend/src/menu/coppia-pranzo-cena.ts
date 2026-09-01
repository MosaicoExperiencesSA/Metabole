/**
 * LA COPPIA PRANZO/CENA — che non si ripete.
 *
 * Richiesta testuale di Simone del 26/8: *«se a Simone oggi dai a pranzo spaghetti al pomodoro e
 * cena branzino al forno, la prossima volta che a pranzo avrò spaghetti al pomodoro mi devi
 * cambiare la cena»*.
 *
 * ⚠️ **Non è un quinto meccanismo anti-ripetizione.** Ce ne sono già quattro — penalità su 14
 * giorni, distanza minima per slot, niente due volte nello stesso giorno, rotazione fra le migliori
 * — e sono **tutti per singolo slot**. Nessuno guarda la giornata come una cosa sola: con gli
 * spaghetti concessi ogni due giorni e il branzino pure, la stessa coppia può tornare mercoledì
 * senza che nessuno dei quattro se ne accorga, perché nessuno dei due piatti si sta ripetendo
 * troppo. Quello che si ripete è la **giornata**, e non c'era niente che la guardasse.
 *
 * ⛔ **Il vincolo è largo, non è un muro**: con 84 pranzi e 84 cene le coppie possibili sono 7.056.
 * Ma un pool piccolo — una variante nuova, un paniere povero — le esaurisce presto, e allora il
 * divieto diventerebbe «niente da mangiare». Per questo `scartaLeCoppieGiaViste` **non svuota mai**:
 * se tutte le coppie rimaste sono già state viste, le tiene tutte e chi ha chiamato lo sa dal
 * secondo valore di ritorno. Una coppia ripetuta è un difetto di varietà; una giornata vuota è una
 * cliente senza cena.
 */

/**
 * La chiave di una coppia. ⚠️ Ordinata per slot e non per id: `pranzo|cena` e `cena|pranzo` sono la
 * stessa giornata solo se si guarda l'insieme, e non è quello che ha chiesto Simone — «a pranzo
 * spaghetti **e** a cena branzino» è una cosa diversa da «a pranzo branzino e a cena spaghetti»,
 * che infatti nessuno servirebbe.
 */
export const chiaveCoppia = (pranzo: string, cena: string): string => `${pranzo}|${cena}`;

/** Gli slot che formano la coppia. Una giornata che non ha tutti e due non ne ha nessuna. */
export const SLOT_DELLA_COPPIA = { pranzo: 'lunch', cena: 'dinner' } as const;

/**
 * La coppia di una giornata, se ce l'ha.
 *
 * ⚠️ Torna `null` per le giornate senza pranzo o senza cena — il digiuno stretto, gli spuntini
 * tolti, una giornata monca. Non è un caso da segnalare: è una giornata che a questa regola non
 * risponde, e trattarla come coppia vuota vorrebbe dire vietare tutte le altre giornate monche.
 */
export function coppiaDellaGiornata(
  pasti: readonly { slot?: string | null; recipeId?: string | null }[] | null | undefined,
): string | null {
  let pranzo: string | null = null;
  let cena: string | null = null;
  for (const m of pasti ?? []) {
    if (!m?.slot || !m?.recipeId) continue;
    if (m.slot === SLOT_DELLA_COPPIA.pranzo) pranzo = m.recipeId;
    else if (m.slot === SLOT_DELLA_COPPIA.cena) cena = m.recipeId;
  }
  return pranzo && cena ? chiaveCoppia(pranzo, cena) : null;
}

/**
 * Toglie dai candidati le giornate la cui coppia è già stata servita.
 *
 * ⛔ **Non svuota mai.** Se non resta niente si restituiscono tutti i candidati e `ripiegato: true`:
 * chi chiama compone lo stesso, e sa di aver ripetuto una coppia. È la stessa forma di rete che
 * regge `dayComboPools` e la finestra del digiuno — meglio un difetto di varietà dichiarato che una
 * cliente senza giornata.
 */
export function scartaLeCoppieGiaViste<T>(
  candidati: readonly T[],
  coppiaDi: (c: T) => string | null,
  giaViste: ReadonlySet<string>,
): { restano: T[]; ripiegato: boolean } {
  if (!candidati.length || giaViste.size === 0) return { restano: [...candidati], ripiegato: false };
  const restano = candidati.filter((c) => {
    const k = coppiaDi(c);
    return k === null || !giaViste.has(k);
  });
  return restano.length > 0
    ? { restano, ripiegato: false }
    : { restano: [...candidati], ripiegato: true };
}
