/**
 * COME LA CLIENTE CONTA L'ACQUA — bicchieri, o bottiglie da 0,5 / 1 / 1,5 litri.
 *
 * Dal 17/7 in app c'è un selettore: chi beve dalla bottiglia da un litro e mezzo non vuole contare
 * sei bicchieri, ne vuole contare uno. La scelta è **solo di visualizzazione**: il dato salvato è
 * SEMPRE in bicchieri da 250 ml, così l'obiettivo, l'aderenza, i grafici e il report continuano a
 * parlare la stessa lingua per tutte.
 *
 * ⚠️ Fino a oggi però l'unità viveva **solo** nelle preferenze dell'utente (`prefs.waterUnit`), che
 * è un valore di ADESSO: la cliente può cambiarla quando vuole. Chi in back office avesse letto
 * «12» accanto alla preferenza corrente avrebbe detto «3 bottiglie da 1 L» anche per un giorno in
 * cui lei contava a bicchieri. Perciò l'unità si scrive **sulla riga del giorno** (`water_log.unit`),
 * come già si fa con l'obiettivo: il numero di oggi resta quello di oggi anche quando domani cambia.
 *
 * ⚠️ `unit` NULL non vuol dire «bicchieri»: vuol dire **non registrata** — tutte le giornate prima
 * del 24/8, e quelle che arrivano da un'app non aggiornata. Il valore resta leggibile lo stesso
 * (è in bicchieri), ma non si può dire come li contava lei: chi mostra il dato lo dice, non lo indovina.
 */
export const UNITA_ACQUA = {
  glass: { etichetta: 'Bicchieri', singolare: 'bicchiere', plurale: 'bicchieri', breve: 'bicchieri', bicchieri: 1 },
  bottle05: { etichetta: 'Bottiglie da 0,5 L', singolare: 'bottiglia da 0,5 L', plurale: 'bottiglie da 0,5 L', breve: 'bott. 0,5 L', bicchieri: 2 },
  bottle1: { etichetta: 'Bottiglie da 1 L', singolare: 'bottiglia da 1 L', plurale: 'bottiglie da 1 L', breve: 'bott. 1 L', bicchieri: 4 },
  bottle15: { etichetta: 'Bottiglie da 1,5 L', singolare: 'bottiglia da 1,5 L', plurale: 'bottiglie da 1,5 L', breve: 'bott. 1,5 L', bicchieri: 6 },
} as const;

export type UnitaAcqua = keyof typeof UNITA_ACQUA;

export const CHIAVI_UNITA_ACQUA = Object.keys(UNITA_ACQUA) as UnitaAcqua[];

/** L'unità di ripiego quando non se ne è mai scelta una. Il bicchiere è anche l'unità del dato salvato. */
export const UNITA_ACQUA_DEFAULT: UnitaAcqua = 'glass';

export function eUnitaAcqua(v: unknown): v is UnitaAcqua {
  return typeof v === 'string' && (CHIAVI_UNITA_ACQUA as string[]).includes(v);
}

/** Quanti bicchieri vale una unità (1 bicchiere = 250 ml). */
export function bicchieriPerUnita(unita: UnitaAcqua): number {
  return UNITA_ACQUA[unita].bicchieri;
}

/**
 * Come la cliente ha contato quei bicchieri, scritto per un umano.
 *
 * ⛔ **La conversione si fa SOLO quando i conti tornano**, e questo è il rilievo più grave della
 * revisione del 24/8: l'unità è una preferenza di **profilo**, cambiabile in qualunque momento, e
 * la riga si ricorda quella dell'**ultimo tap**. Giulia beve otto bicchieri la mattina contando a
 * bicchieri, alle 19 passa a «bottiglie da 1 L» e tocca una volta: la riga diventa 12 bicchieri con
 * unità `bottle1`, e dividendo si scriverebbe «3 bottiglie da 1 L» — di bottiglie ne ha bevuta
 * **una**. Quando il totale non è un multiplo dell'unità la giornata è **mista**, e l'unica cosa
 * vera che si può dire è come contava alla fine.
 *
 * ⚠️ Torna `null` solo quando l'unità non è registrata: lì non si sa, e non si indovina.
 */
export function comeLiHaContati(bicchieri: number, unita: unknown): string | null {
  if (!eUnitaAcqua(unita)) return null;
  const per = UNITA_ACQUA[unita].bicchieri;
  if (per === 1) return 'contati in bicchieri';
  // Giornata mista: si dice l'unità, non un numero che non è mai esistito. Vedi il riquadro sopra.
  if (bicchieri % per !== 0) return `a fine giornata contava in ${UNITA_ACQUA[unita].plurale}`;
  const quante = bicchieri / per;
  const nome = quante === 1 ? UNITA_ACQUA[unita].singolare : UNITA_ACQUA[unita].plurale;
  return `${quante} ${nome}`;
}

/** Il nome dell'unità così com'è, per la riga: «bicchieri», «bottiglie da 1 L». `null` se non registrata. */
export function etichettaUnitaAcqua(unita: unknown): string | null {
  return eUnitaAcqua(unita) ? UNITA_ACQUA[unita].plurale : null;
}
