
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

## App cliente — login social (Google + Apple) — da fare DOPO
Il mockup prevede "Continua con Google" e "Continua con Apple". Oggi il backend ha
solo email/password. Per aggiungerli servirà: Google (progetto Google Cloud + OAuth Client ID,
endpoint backend che verifica l'ID token, campi provider/providerId sull'utente); Apple
("Sign in with Apple": account Apple Developer + Services ID/key). NB: Apple OBBLIGA
"Sign in with Apple" se l'app iOS offre anche Google → farli insieme, dopo l'account Apple Developer.

## Ref code vs onboarding — conflitto di assegnazione (da sistemare)
onboarding.submitAnswers() assegna coach+nutrizionista con pickLeastLoadedStaff al
completamento del questionario: questo SOVRASCRIVE la coach assegnata via ref code in
registrazione (autoAssignByRefCode). Fix: in submitAnswers, se la cliente ha già una coach
assegnata (ref code o manager) NON riassegnarla; assegnare solo il ruolo mancante (es. nutrizionista).

## Scheda cliente — modifica campi (da fare)
Rendere modificabili tutti i campi della scheda (anagrafica: nome, cognome, telefono, indirizzo;
questionario: età, misure, regime, ecc.) da chi ha i diritti di edit, con tasto "Modifica" +
endpoint PATCH /admin/clients/:id. Oggi la scheda è di sola lettura.

## PROMEMORIA — permessi pagine
Ogni NUOVA pagina del backoffice va aggiunta alla lista permessi:
1. backend/src/permissions/pages.ts → BACKOFFICE_PAGES + DEFAULT_PERMISSIONS
2. backoffice/src/lib/labels.ts → PAGE_LABEL (etichetta)
3. menu (Layout.tsx) e rotta (App.tsx) devono usare la nuova chiave pageKey
Il seed (seedPermissions) crea le righe ruolo×pagina mancanti al deploy.
