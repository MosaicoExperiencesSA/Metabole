/**
 * IL PASSO NOTTURNO, FINTO — solo per i test del controller.
 *
 * Dal 25/8 il controller tiene in mano `ValoriNutrizionaliService`, perché la pagina può chiedere
 * di **rifare il conto adesso** invece di aspettare la notte. I test che costruiscono il controller
 * a mano devono passargli qualcosa: questo.
 *
 * ⚠️ **Il suffisso `.finto.ts` non è decorativo**: `tsconfig.build.json` lo esclude, come fa
 * con gli `.spec.ts`. Un doppio che usa `jest.fn()` e finisce in `dist/` è codice di prova
 * spedito in produzione.
 *
 * ⚠️ Sta in un file suo e non copiato in tre spec: *se due punti rispondono alla stessa domanda,
 * uno deve chiamare l'altro*. E torna i **quattro** conti veri del passo, non `undefined` — un
 * finto che risponde meno dell'originale non fa fallire niente: fa passare tutto.
 */
export const passoFinto = (esito?: Partial<{ scoperti: number; scritti: number; falliti: number; fuori: number }>) => ({
  aggiornaIngredientiScoperti: jest
    .fn()
    .mockResolvedValue({ scoperti: 0, scritti: 0, falliti: 0, fuori: 0, ...esito }),
});
