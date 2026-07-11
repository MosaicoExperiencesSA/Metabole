
## Shop backoffice (prodotti) — da fare
Quando si crea il backoffice dello shop (creazione prodotti), ogni prodotto deve
avere un flag "provvigioni a": team coaching | team nutrizionisti | entrambi.
Il motore provvigioni (finance.service) dovrà rispettare questo flag per decidere
quali quote pagare.

## Coach — video di presentazione (da fare)
Nella scheda di registrazione/profilo della coach (backoffice) aggiungere il supporto per
il **caricamento del video di presentazione** (upload file video + storage + URL sul profilo).
Il video viene mostrato al cliente nella schermata "La tua coach, Sara" durante l'onboarding
(oggi nel prototipo è un player finto). Prevedere: campo `intro_video_url` sul profilo coach,
upload da dashboard, formato/durata consigliati e fallback se assente.

## PROMEMORIA — permessi pagine
Ogni NUOVA pagina del backoffice va aggiunta alla lista permessi:
1. backend/src/permissions/pages.ts → BACKOFFICE_PAGES + DEFAULT_PERMISSIONS
2. backoffice/src/lib/labels.ts → PAGE_LABEL (etichetta)
3. menu (Layout.tsx) e rotta (App.tsx) devono usare la nuova chiave pageKey
Il seed (seedPermissions) crea le righe ruolo×pagina mancanti al deploy.
