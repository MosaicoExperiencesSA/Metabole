/**
 * ⛔ **CHI È «LA NUTRIZIONISTA», nel backoffice, in un posto solo.**
 *
 * Il gemello di `backend/src/common/ruoli-nutrizionista.ts`, nato il 22/8 dopo un difetto che era
 * esattamente questo: l'elenco dei tipi di attività che nascono addosso a lei stava in un file e
 * l'elenco dei ruoli che possono aprirla in un altro, e per un giorno la push le è arrivata
 * mandandola davanti a un 403.
 *
 * ⚠️ Qui la copia era già a tre: `AttivitaCoach.tsx`, `pages/Home.tsx` e `pages/Impostazioni.tsx`
 * scrivevano tutte e tre `role === 'nutritionist' || role === 'head_nutritionist'` a mano.
 *
 * ⚠️ **Il ruolo che arriva da `/me` è quello di BASE**: `resolveRole` scrive il `baseRole` nella
 * colonna `role` e mette la chiave del ruolo personalizzato a parte (`customRoleKey`). Quindi una
 * «Nutrizionista junior» è coperta da questa funzione. ⛔ Non lo è invece il **permesso di pagina**,
 * che `/me/permissions` legge con `customRoleKey ?? role`: quello è un altro discorso, e sta scritto
 * nel gemello lato backend.
 */
export const RUOLI_NUTRIZIONISTA = ['nutritionist', 'head_nutritionist'] as const;

export const eNutrizionista = (role: string | null | undefined): boolean =>
  role === 'nutritionist' || role === 'head_nutritionist';
