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
 * LA QUANTITÀ COME LA LEGGE LEI, nell'unità di quel giorno.
 *
 * ⚠️ **È la stessa regola che gira in app** (`app/src/lib/water.ts`, `waterValue`): la cliente vede
 * «3» accanto all'icona della bottiglia, e in back office deve leggere lo stesso numero — altrimenti
 * la coach e la cliente parlano di due giornate diverse guardando lo stesso giorno.
 *
 * ⚠️ **I mezzi si scrivono.** L'unità è una preferenza di profilo e la riga si ricorda quella
 * dell'ultimo tap: chi conta otto bicchieri la mattina e poi passa alle bottiglie da 1 L chiude a
 * «2,5 bottiglie». Arrotondare a 2 racconterebbe mezzo litro come se non l'avesse bevuto — e 2,5 è
 * esattamente quello che le ha mostrato l'app.
 *
 * Unità non registrata (giornate prima del 24/8) = si legge il dato com'è salvato, in bicchieri: chi
 * mostra la riga lo dice nella colonna dell'unità, non lo indovina qui.
 */
export function quantitaNellaUnita(bicchieri: number, unita: unknown): string {
  const per = eUnitaAcqua(unita) ? UNITA_ACQUA[unita].bicchieri : 1;
  const quante = bicchieri / per;
  return Number.isInteger(quante)
    ? String(quante)
    : quante.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * L'OBIETTIVO DI QUEL GIORNO, nell'unità di quel giorno — richiesta di Simone (24/8): «anche
 * l'obiettivo si deve aggiornare con quello mostrato in app, che varia in funzione dell'unità di
 * misura scelta».
 *
 * ⚠️ **Bottiglie INTERE, e la ragione è in `app/src/lib/water.ts`** (`waterGoalValue`, dove questa
 * regola è nata): l'obiettivo arriva dal server in bicchieri ed è calcolato sul peso (~33 ml/kg),
 * quindi in bottiglie non torna quasi mai tondo — 11 bicchieri sono 1,83 bottiglie da 1,5 L, e
 * «1,8» accanto a «bottiglie da 1,5 L» si legge come la misura della bottiglia, non come
 * l'obiettivo. Se conta in bottiglie, l'obiettivo va detto in bottiglie: quante gliene servono.
 * Mai sotto una.
 *
 * ⛔ **L'obiettivo VERO resta quello in bicchieri**: è quello scritto sulla riga e quello su cui il
 * motore valuta l'aderenza (`alerts.service.ts`). Qui cambia solo come lo si legge — e chi confronta
 * due giornate contate in unità diverse deve guardare i bicchieri, non questo numero.
 */
export function obiettivoNellaUnita(bicchieriObiettivo: number, unita: unknown): string {
  const per = eUnitaAcqua(unita) ? UNITA_ACQUA[unita].bicchieri : 1;
  return String(Math.max(1, Math.round(bicchieriObiettivo / per)));
}

/** Il nome dell'unità così com'è, per la riga: «bicchieri», «bottiglie da 1 L». `null` se non registrata. */
export function etichettaUnitaAcqua(unita: unknown): string | null {
  return eUnitaAcqua(unita) ? UNITA_ACQUA[unita].plurale : null;
}
