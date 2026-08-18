/**
 * LE STELLE CHE CONTANO — quelle che la cliente ha dato davvero.
 *
 * ## Il caso (voci 269-270, deciso da Simone la notte del 18/8)
 *
 * Il popup «Com'è andata ieri?» chiede due cose insieme: se ha seguito il piatto e quante stelle gli
 * dà. Se lei tocca **solo** «Seguita / Non seguita» e va via, l'app manda comunque `stars: 3`, perché
 * la rotta le stelle le pretende e l'aderenza viaggia come tag (decisione di Simone del 18/8: «se il
 * cliente non specifica metti 3 stelle» — quella parte non cambia).
 *
 * ⚠️ Quel 3 **non è un'opinione**: è un valore di scorta scritto dall'app. Finiva nel segnale
 * «gradimento» con cui il motore decide cosa riproporle, quindi una cliente che diceva soltanto
 * «non l'ho seguita» risultava aver dato **tre stelle** a quel piatto — e il motore glielo
 * ripresentava con la stessa faccia di uno che le era piaciuto.
 *
 * Dal 18/8 il popup marca quei voti col tag `stelle_non_date`. **La decisione di stanotte:
 * ESCLUDERLI dal gradimento.**
 *
 * ## ⚠️ Il prezzo, detto
 *
 * Per chi non dà quasi mai le stelle il motore ha **meno segnale**, e torna a scegliere per varietà
 * e calorie invece che per gusto. Non è peggio di prima — prima sceglieva **col segnale sbagliato**,
 * che è un'altra cosa — ma va saputo: una cliente che valuta poco non è una cliente a cui tutto
 * piace mediamente.
 *
 * ## ⚠️ Dove NON si applica, e perché
 *
 * Solo dove le stelle **orientano il motore**: il punteggio del pool, il gradimento del ciclo, i
 * segnali del motore. Restano com'erano i «piatti più apprezzati» del report e le schermate dello
 * staff: là il numero è un resoconto di quello che è stato scritto, non una decisione su cosa
 * arriverà nel piatto (scelta di Simone, stessa notte).
 */

/** Il tag che il popup dell'app mette quando le stelle non le ha date lei. */
export const TAG_STELLE_NON_DATE = 'stelle_non_date';

/**
 * Il pezzo di `where` che tiene fuori i voti mai dati, da aggiungere a una lettura di
 * `recipeRating`.
 *
 * ⚠️ **Si filtra nella query e non in memoria**: filtrando dopo servirebbe leggere i tag ovunque, e
 * il primo posto che si dimentica di farlo torna a contare il valore di scorta senza che si veda.
 * ⚠️ E si usa `NOT … has`, non `hasEvery`/`equals`: un voto può avere anche altri tag (`seguita`,
 * `non_seguita`), e quello che conta è solo se c'è **questo**.
 */
export const SOLO_STELLE_DATE = { NOT: { tags: { has: TAG_STELLE_NON_DATE } } } as const;

/**
 * Lo stesso giudizio su un voto già in mano — per chi i tag ce li ha già letti.
 *
 * ⚠️ Un voto **senza** tag conta: sono tutti quelli scritti prima del 18/8, e non c'è modo di sapere
 * quali fossero valori di scorta. Trattarli come «non dati» vorrebbe dire buttare via la storia di
 * chi le stelle le ha date davvero, che è la parte buona del segnale.
 */
export function stellaData(voto: { tags?: string[] | null }): boolean {
  return !(voto.tags ?? []).includes(TAG_STELLE_NON_DATE);
}
