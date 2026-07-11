## FATTO (11 luglio 2026)
- Scheda cliente — modifica campi: ✓ (tasto Modifica + PATCH /admin/clients/:id).
- Shop prodotti — flag "provvigioni a" (coaching | nutrizionisti | entrambi): ✓
  campo Product.commissionTeam, select nel Negozio, motore provvigioni che calcola
  due basi imponibili per lato (default "both" = comportamento invariato).
- Ref code vs onboarding — conflitto di assegnazione: ✓ submitAnswers non riassegna
  la coach se già assegnata (ref code o manager sul lead); assegna solo la nutrizionista.

## Coach — video di presentazione (da fare)
Nella scheda di registrazione/profilo della coach (backoffice) aggiungere il supporto per
il **caricamento del video di presentazione** (upload file video + storage + URL sul profilo).
Il video viene mostrato al cliente nella schermata "La tua coach, Sara" durante l'onboarding
(oggi nel prototipo è un player finto). Prevedere: campo `intro_video_url` sul profilo coach,
upload da dashboard, formato/durata consigliati e fallback se assente. NB: valutare dove
salvare i video (storage esterno tipo S3/Cloudflare R2, non nel DB).

## App cliente — login social (Google + Apple) — da fare DOPO
Il mockup prevede "Continua con Google" e "Continua con Apple". Oggi il backend ha
solo email/password. Per aggiungerli servirà: Google (progetto Google Cloud + OAuth Client ID,
endpoint backend che verifica l'ID token, campi provider/providerId sull'utente); Apple
("Sign in with Apple": account Apple Developer + Services ID/key). NB: Apple OBBLIGA
"Sign in with Apple" se l'app iOS offre anche Google → farli insieme, dopo l'account Apple Developer.

## PROMEMORIA — permessi pagine
Ogni NUOVA pagina del backoffice va aggiunta alla lista permessi:
1. backend/src/permissions/pages.ts → BACKOFFICE_PAGES + DEFAULT_PERMISSIONS
2. backoffice/src/lib/labels.ts → PAGE_LABEL (etichetta)
3. menu (Layout.tsx) e rotta (App.tsx) devono usare la nuova chiave pageKey
Il seed (seedPermissions) crea le righe ruolo×pagina mancanti al deploy.
