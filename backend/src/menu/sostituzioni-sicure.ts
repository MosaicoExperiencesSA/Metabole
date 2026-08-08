/**
 * Sostituzioni equivalenti sicure (v1). Chiave = parola chiave nell'ingrediente → sostituto.
 * Se un ingrediente escluso NON è qui e deriva da un'intolleranza, il piano si blocca
 * (frutta secca/pesce/crostacei/uova: nessuna sostituzione sicura come cardine → blocco).
 *
 * Sta in un file suo, e non dentro `menu.service.ts`, perché ora la usano due strade che
 * devono proporre la STESSA alternativa: il motore (`evaluateMeals`) e la sostituzione
 * concordata in chat con Gaia (`sostituzione-chat.service.ts`). Due copie della mappa
 * vorrebbero dire che la chat propone il porro e il motore la cipolla, sulla stessa cliente.
 *
 * Nessuna dipendenza da Nest né da Prisma: importabile anche dagli script `prisma/`.
 */
export const SUBSTITUTION_MAP: Record<string, string> = {
  // lattosio
  latte: 'bevanda vegetale',
  yogurt: 'yogurt senza lattosio',
  formaggio: 'formaggio senza lattosio',
  mozzarella: 'mozzarella senza lattosio',
  ricotta: 'ricotta senza lattosio',
  burro: 'olio evo',
  panna: 'panna vegetale',
  parmigiano: 'parmigiano ben stagionato',
  // glutine
  pane: 'pane senza glutine',
  pasta: 'pasta senza glutine',
  farro: 'riso',
  orzo: 'riso',
  couscous: 'quinoa',
  cracker: 'gallette di riso',
  pizza: 'pizza senza glutine',
  // gusti non graditi comuni
  funghi: 'cavolfiore',
  cipolla: 'porro',
  peperoni: 'zucchine',
};

/**
 * Sostituto sicuro per un ingrediente, cercato sulla parola chiave, poi sul nome intero, poi
 * sulle sue PAROLE ("petto di pollo" → "pollo"; "pasta integrale" → "pasta").
 *
 * Il confronto sulle parole e non con `nome.includes(chiave)`: quest'ultimo faceva combaciare
 * la chiave "pane" con "pancetta" e "orzo" con "gorzo"-qualunque-cosa. Una chiave di tre o
 * quattro lettere dentro una sottostringa non è un alimento, è un caso.
 *
 * ⚠️ Questa mappa serve a rendere un piatto SICURO con un'intolleranza. Non è una mappa di
 * alternative gradevoli: molte voci sono varianti dello stesso cibo ("pane" → "pane senza
 * glutine"), inutili a chi quel cibo non piace o non ce l'ha in casa. Chi la usa per un motivo
 * di gusto deve scartare i sostituti che condividono una parola con l'originale — lo fa
 * `condividonoAlimento` in `sostituzione-chat.ts`.
 */
export function sostitutoSicuro(ingrediente: string, parolaChiave?: string): string | null {
  const nome = (ingrediente ?? '').toLowerCase().trim();
  if (!nome) return null;
  if (parolaChiave && SUBSTITUTION_MAP[parolaChiave]) return SUBSTITUTION_MAP[parolaChiave];
  if (SUBSTITUTION_MAP[nome]) return SUBSTITUTION_MAP[nome];
  for (const parola of nome.split(/[^a-zà-ù]+/).filter(Boolean)) {
    if (SUBSTITUTION_MAP[parola]) return SUBSTITUTION_MAP[parola];
  }
  return null;
}
