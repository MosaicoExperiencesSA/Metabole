# Per la sessione di Vera: la pagina «Assistente» vuole la sua chiave di permesso

Scritta il 13/8/2026 dall'altra sessione. **Non è una correzione di un errore**: la scelta di riusare
`food_swaps` è motivata nel commento in testa a `vera.controller.ts`, e il motivo — «moltiplicare le
chiavi significa moltiplicare i posti dove qualcuno dimentica di abilitare qualcosa» — è ragionevole.
È una **regola di prodotto** che Simone ha dato oggi, e che vince sulla scelta tecnica:

> «Tutte le pagine che aggiungiamo vanno gestite nei permessi. Sempre.» (13/8)

## Perché, in concreto

`Assistente` e `Sostituzioni` sono **due voci diverse nel menu** con **una chiave sola**. Conseguenza:
oggi non si può dare l'assistente a una nutrizionista senza darle anche le Sostituzioni, né toglierlo
a qualcuno senza togliergli quelle. Sono due cose che da lì in poi si concedono e si tolgono insieme,
e separarle dopo richiede un rilascio.

⚠️ Gli altri riusi nel repo NON sono questo caso e vanno lasciati stare: `clients` e `users` valgono
per elenco e scheda, `crm_leads` per le tre pagine dei lead. Stessa pagina, più schermate.

## Cosa cambiare — cinque punti, e sono tutti e cinque obbligatori

1. `backend/src/permissions/pages.ts` → `BACKOFFICE_PAGES`: chiave nuova (proposta:
   **`nutri_assistant`**) e i default di ruolo.
2. `backend/src/permissions/pages.ts` → `DEFAULT_PERMISSIONS`: **`nutritionist`,
   `head_nutritionist`, `admin`** con `view` e `manage`. Sono esattamente i ruoli che ci arrivano
   oggi tramite `food_swaps` + `@Roles`, quindi **nessuno perde niente il giorno del rilascio**.
   ⚠️ Chi ha `food_swaps` ma non è fra questi tre (se domani capitasse) perderebbe l'assistente: è il
   punto della separazione, ma va saputo prima e non scoperto dopo.
3. `backoffice/src/lib/labels.ts` → `PAGE_LABEL`: `nutri_assistant: 'Assistente (Vera)'`. Senza,
   nella tabella dei permessi compare la chiave grezza.
4. `backoffice/src/App.tsx` (rotta `/assistente`) e `backoffice/src/components/Layout.tsx` (voce di
   menu): `pageKey` / `key` alla chiave nuova.
5. `backend/src/vera/vera.controller.ts`: `@RequirePage('food_swaps', …)` → `@RequirePage('nutri_assistant', …)`,
   **mantenendo la distinzione che c'è già**: `view` per leggere, `manage` per le rotte che scrivono
   (parlarci scrive: impara una famiglia, apre una proposta, mette una regola su una persona).

⚠️ **La chiave nasce insieme alla guardia che la legge.** Se si aggiunge a `pages.ts` e si dimentica
il punto 5, resta un interruttore che non accende niente: è quello che è successo con `assignments`,
raccontato in testa a `pages.ts`.

## Verifica

- `npm run prisma:tipi && npm run typecheck` (il primo comando è nuovo del 13/8: senza, il type-check
  è verde ma le suite non compilano — guardano due copie diverse dei tipi);
- un giro vero: entrare come nutrizionista e vedere la voce; togliere il flag dai Permessi e vederla
  sparire **e** l'endpoint rispondere 403.
