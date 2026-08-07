# Nota di handoff — pubblicazione 2.1 (6 agosto 2026)

**Per:** chi esegue la pubblicazione (Simone, o l'agente che lo affianca)
**Versione:** 2.1 · **versionCode / build:** 5 · fonte unica `app/android-version.json`
(Xcode la legge da lì tramite `scripts/install-ios.mjs`: non va scritta a mano da nessuna parte).

Testi per gli store e sequenza: `progetto/Note_Rilascio_2.1.md`.
Racconto per esteso di ogni voce: `progetto/REGISTRO.md`, sezione 2026-08-06.

---

## 1. Cosa contiene questa release

Le 18 richieste del feedback clienti del 5/8, tranne la #10 (monitoraggio a pagamento).
**Aggiornato la sera del 6/8:** la decisione che bloccava la #10 è stata presa — provvigioni sul
rinnovo chiuse in tutte e tre le domande — e il listino è fissato (mantenimento €49/mese in
abbonamento o mese singolo, monitoraggio €19/mese in abbonamento). Lo Stripe ricorrente è il primo
lavoro del 7/8: `progetto/Stripe_Ricorrente_Sei_Domande.md`. In più: push iOS riparate, CI Android verde,
chiave APNs esposta revocata e sostituita, repo fuori da iCloud.

I 27 commit della giornata, dal più recente:

```
5e9a680 Parametri e modelli email si possono creare, non solo modificare
d4b6010 Email credenziali modificabile dal backoffice
d48542e OTA: gli errori non spariscono piu' in silenzio
f651ff7 Script di pulizia della Keto-Mediterranea
67459ff Generatore: la barra di avanzamento si nascondeva da sola
7efc7b3 Profilo: "La mia alimentazione" in sola lettura
de06571 Ricette: colonne che ordinano e filtrano, colonna Stagioni
ca0793a Note di rilascio 2.1 e verifica delle 18 voci del 5/8
450f9ba Card per prodotto in lista lavori, e nota alla nutrizionista
83f054e Keto-Mediterranea nel generatore, e il "?" su tutti i percorsi
f172b0c Il seed andava in out of memory su Render
e2b1119 Keto-Mediterranea: 30 ricette e 7 giornate (superato da 83f054e)
ff519e2 Gate misure severo, stagionalita', spiegazione diete, ref link e posta
ceb6b7b Pulsanti store nella mail credenziali, attivita' fisica, seed kcal
b3cbf3b Digiuno intermittente: la cliente sceglie i pasti da saltare, e la 20-4
f9900c8 Check-in solo con un piano attivo, e con energia, fame e stress
06dbc13 Sorveglianza durante la pausa vacanza
5339ffa Push iOS: i metodi del delegato mancavano
85887b3 Header davvero fisso, grafici scorrevoli, card obiettivo col segno giusto
```
(più i commit OTA/chiavi della mattina, già in produzione sulla 2.0.3).

---

## 2. Superfici toccate

| Superficie | Serve un deploy? |
|---|---|
| **Backend** (Render) | sì — migrazioni + seed automatici in preDeploy |
| **Backoffice** (Vercel) | sì — deploy automatico dal push |
| **App cliente** (store) | **sì, è questa la release**: build iOS + Android |
| Sito metabole.eu | no |

⚠️ Le modifiche nell'**app** entrano SOLO con la build 2.1: header, carosello grafici, card
obiettivo, digiuno con scelta dei pasti, check-in a 3 segnali, "?" sui tipi di dieta, ref link
con condivisione nativa, gate misure, «La mia alimentazione» nel profilo, errori OTA visibili.
Chi guarda l'app senza aggiornare continua a vedere la 2.0.

---

## 3. Migrazioni

Cinque, tutte già applicate se il deploy di oggi è passato. In ordine:

```
20260805100000_checkin_skip
20260806090000_pause_surveillance
20260806110000_fasting_window
20260806140000_recipe_seasons
20260806160000_measures_gate_hard
```

`preDeployCommand` in `render.yaml` esegue `prisma migrate deploy` (con un secondo tentativo se
il lock è occupato) e poi `prisma db seed`.

⚠️ **Il seed andava in out of memory** perché `package.json → prisma.seed` era l'unico script
senza `--transpile-only`: corretto. Se un deploy fallisce con «Reached heap limit», il primo
posto da guardare è quello.

---

## 4. Variabili d'ambiente

Nessuna nuova. Due da ricordare:

- **`OTA_VERSION` su Render: SVUOTATA il 6/8 alle 15:58, PRIMA della pubblicazione** — ed era
  l'ordine giusto, non un anticipo. Il manifest serviva ancora la 2.0.1, cioè il bundle senza il
  codice delle push. Se resta valorizzata, le app
  appena aggiornate scaricano sopra un bundle OTA più vecchio del nativo.
- `AI_API_KEY`: serve al generatore di catalogo. Senza, il pulsante «Genera» dà errore.

---

## 5. Android / Capacitor

- **`@capacitor/share` è un plugin NATIVO nuovo** (serve al ref link): prima della build va
  fatto `npm install` in `app/`, altrimenti la condivisione non funziona sul telefono.
- `versionCode 5`, `versionName 2.1`. Build: `bash build-aab.sh` → AAB firmato in
  `~/MetaboleBuild/app/android/app/build/outputs/bundle/release/`.
- Il keystore è in `~/MetaboleKeys` (fuori dal repo, che è pubblico).

## 6. iOS

- `bash build-ios.sh` **a Xcode chiuso**: se resta aperto, il progetto rigenerato non viene
  ricaricato e si archivia la versione vecchia.
- ⚠️ **Prima di archiviare, verificare che `aps-environment` sia `production`.** Nella 2.0 era
  `development`: è il motivo per cui le push iOS non hanno mai funzionato in produzione.
- `scripts/install-ios.mjs` reinserisce i metodi del delegato per le push a ogni rigenerazione, e
  ora **verifica il proprio risultato**: se non riesce esce con errore invece di dire «fatto».

---

## 7. Test

Nessun test nuovo in questa tornata (le voci di oggi sono quasi tutte UI e configurazione).
⚠️ **Superato la sera del 6/8.** I test rossi non erano «~30 in `src/commerce`»: erano **99 in 18
suite**. Sistemati tutti — **51 suite, 527 test, zero rossi** — e `continue-on-error: true` è stato
tolto da `ci.yml` (commit `73cc4f2`). Da adesso un test rosso **blocca la push**, che è il punto.

---

## 8. Dopo il deploy — quattro verifiche, due minuti

Sulla shell di Render, in `~/project/src/backend`:

1. **Preset Keto-Mediterranea** (devono essere 12):
   ```
   npx ts-node --transpile-only -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.rulePreset.findMany({where:{style:'keto_mediterranean'},select:{regime:true,objective:true,meals:true}}).then(r=>{console.table(r);return p.\$disconnect()})"
   ```
2. **Parametri del fabbisogno** (devono essere 6, `kcal_need_*`): già verificati oggi ✓
3. **Piano mantenimento**: `npm run diag:mantenimento` — il `period` deve essere `maintenance`.
   Se qualcuno lo accorcia dal Negozio, si spengono in silenzio quattro cose insieme (vetrina
   gated, riquadro del report, sblocco monitoraggio, attività coach «peso che risale»).
4. **Email credenziali**: in *Modelli email* deve comparire «Credenziali di accesso (al lead)».

---

## 9. Cosa resta aperto

- **#10 monitoraggio a pagamento** → ✅ decisione presa il 6/8 sera, non blocca più: nutrizionista
  0%, coach quota piena a ogni rinnovo, solo se è ancora la coach assegnata, senza scadenza
  (`progetto/Decisione_Provvigioni_Rinnovo.md`). Ora blocca solo il codice dello Stripe ricorrente.
- **Keto-Mediterranea** → ✅ generate dal nutrizionista il 6/8 dal generatore del backoffice.
  Resta la validazione e la pubblicazione: `progetto/Guida_Generatore_KetoMediterranea.md`. Non blocca la pubblicazione:
  una dieta non approvata non la vede nessuna cliente.
- **Una card per prodotto in registrazione** (oggi una per stile) → `metabole-backlog.md`.
- ~~**`continue-on-error` in `ci.yml`**~~ → ✅ tolto il 6/8 (commit `73cc4f2`), a test puliti.
- **Deployment target iOS 15.0** → non stasera: cambia la configurazione Xcode a poche ore
  dall'archiviazione.
