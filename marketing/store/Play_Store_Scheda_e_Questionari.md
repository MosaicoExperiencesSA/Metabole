# Metabole — Scheda Play Store e questionari (testi pronti da incollare)

Account: **Mosaico Experiences SA (organizzazione)** → nessun obbligo di test chiuso, si può
pubblicare in produzione. Resta la revisione Google (in genere 1–7 giorni per un'app nuova).

---

## 1. Scheda dello store (Store listing → Scheda principale)

**Nome dell'app** (max 30 caratteri):
```
Metabole — Nutrizione e Coach
```

**Descrizione breve** (max 80 caratteri):
```
Percorso di nutrizione su misura, con coach reali e la guida di Gaia.
```

**Descrizione completa** (max 4000 caratteri):
```
Metabole è il tuo percorso di nutrizione personalizzato: un metodo costruito su di te,
seguito ogni giorno da coach e nutrizionisti reali, con Gaia — la nostra guida — che ti
accompagna passo dopo passo.

COME FUNZIONA
• Rispondi al questionario iniziale: abitudini, gusti, esclusioni alimentari, obiettivi.
• Il metodo Metabole costruisce il tuo percorso e i tuoi menu giornalieri su misura.
• Ogni giorno trovi cosa mangiare, i check-in, le misure e i tuoi progressi.
• Il percorso si adatta a te: eventi speciali, giornate difficili, esigenze che cambiano.

PERSONE VERE, NON SOLO ALGORITMI
• Un coach ti segue davvero: chat diretta, promemoria, incoraggiamenti.
• I nutrizionisti validano le scelte del metodo e i tuoi documenti sanitari.
• Visite e appuntamenti in agenda, con promemoria automatici.

OGNI GIORNO CON TE
• Menu giornalieri con ricette e alternative.
• Diario di percorso: peso, misure, foto, sensazioni.
• Widget con Gaia sulla schermata home e contapassi integrato.
• Notifiche intelligenti che si adattano al tuo momento (e si spengono quando vuoi).

PENSATA PER OGNI CULTURA
Percorsi e menu rispettano le tue esclusioni: religiose, etiche, intolleranze o semplici
gusti. In italiano e inglese.

PER IL TEAM METABOLE
La stessa app è usata da coach e nutrizionisti per seguire i propri clienti: dashboard,
alert, chat, agenda e guadagni, sempre a portata di mano.

L'installazione e la registrazione sono gratuite; il percorso completo si attiva con un
abbonamento al servizio di coaching. Maggiori informazioni su https://metabole.eu

Privacy: https://metabole.eu/Metabole_Privacy.html
Assistenza: info@metabole.eu
```

**Grafiche** (file pronti in questa cartella):
- Icona: `play_icon_512.png` (512×512)
- Immagine in evidenza (feature graphic): `play_feature_1024x500.png` (1024×500)
- **Screenshot: servono minimo 2** (consigliati 4–8), da fare dal telefono con l'APK:
  suggeriti Landing/benvenuto, un menu del giorno, il percorso/diario, la chat col coach.
  Vanno bene gli screenshot nativi del telefono (proporzione 9:16). NB: senza dati di
  clienti veri — usa l'account di prova Giulia Test.

**Categoria**: App → **Salute e fitness**. Tag suggeriti: nutrizione, dieta, coach.

**Dettagli di contatto**: email **info@metabole.eu**, sito **https://metabole.eu**.

---

## 2. Questionari della checklist "Configura la tua app"

### Privacy policy
```
https://metabole.eu/Metabole_Privacy.html
```

### Accesso alle app (App access)
L'app richiede login → scegli "Tutte le funzionalità o alcune funzionalità sono limitate".
Aggiungi istruzioni + credenziali di un account di prova CLIENTE con abbonamento attivo
(es. l'account "Giulia Test" — le credenziali le inserisci tu in console, MAI in chat):
```
Istruzioni: aprire l'app, toccare "Accedi", inserire le credenziali fornite.
L'account di prova ha un percorso attivo: menu, diario, chat e agenda sono visibili subito.
```

### Annunci (Ads)
**No, l'app non contiene annunci.**

### Classificazione dei contenuti (content rating / IARC)
Email: info@metabole.eu. Categoria: **Utility / altro**. Poi rispondi **No** a tutto
(violenza, sessualità, linguaggio, sostanze, gioco d'azzardo, contenuti generati dagli
utenti pubblici — la chat è 1:1 col proprio coach, non pubblica). Risultato atteso: PEGI 3.

### Pubblico di destinazione (Target audience)
**Solo 18 e più** (è un servizio di coaching nutrizionale a pagamento). Non rivolta ai
bambini → nessun ulteriore requisito Famiglie.

### App per la salute (Health apps declaration)
Dichiara che l'app è un'app per la salute/benessere: funzionalità di
**nutrizione / gestione del peso / benessere**. NON è un dispositivo medico e non fa
diagnosi. Nessuna funzione di emergenza.

### Sicurezza dei dati (Data safety) — la parte più lunga
Raccolta dati: **Sì**. Dati criptati in transito: **Sì** (HTTPS). 
L'utente può chiederne l'eliminazione: **Sì** → URL cancellazione account:
```
https://metabole.eu/Metabole_Cancellazione_Account.html
```
Dichiara questi tipi di dati (tutti "raccolti", associati all'utente, NON condivisi con
terze parti a fini commerciali, non usati per pubblicità):

| Tipo | Dettaglio | Scopo |
|---|---|---|
| Informazioni personali | nome, email, telefono | funzionalità dell'app, gestione account |
| Informazioni sanitarie | peso, misure, esclusioni alimentari, documenti sanitari | funzionalità dell'app (percorso nutrizionale) |
| Informazioni finanziarie | cronologia acquisti (abbonamento) | funzionalità dell'app |
| Messaggi | chat con il proprio coach | funzionalità dell'app |
| Foto | foto progressi / documenti caricati dall'utente | funzionalità dell'app |
| Attività fisica | contapassi (resta sul dispositivo se non condiviso) | funzionalità dell'app |

Pagamenti: gestiti da Stripe (processore); i dati carta NON transitano né vengono
conservati da Metabole.

### Funzionalità finanziarie
**No** (niente prestiti/banking). L'abbonamento è l'acquisto di un servizio di coaching
personale reso da professionisti reali + prodotti fisici → pagamento esterno (Stripe)
consentito dalle norme Play (non sono "beni digitali").

### App governativa / anti-COVID / news
No a tutte.

### Paesi
Consigliato: **Italia + Svizzera** per il lancio (aggiungerne altri è un clic, toglierli
dopo è brutto). Se preferisci: tutta Europa.

---

## 3. Caricamento dell'AAB e pubblicazione

1. **Produzione → Crea nuova release**. Alla prima release accetta la **firma
   dell'app gestita da Google (Play App Signing)**: il nostro keystore diventa la "upload
   key" — va comunque custodito.
2. Carica `app-release.aab` (quello generato da build-aab.sh).
3. Note di release (it):
```
Prima versione pubblica di Metabole: percorso nutrizionale personalizzato,
menu giornalieri, coach dedicato, chat, agenda e widget con Gaia.
```
4. Salva → Controlla release → risolvi eventuali avvisi → **Avvia rollout in produzione**.
5. La revisione di un'app nuova richiede in genere da 1 a 7 giorni. Lo stato si segue in
   "Panoramica della pubblicazione".

---

## 4. Cose da NON dimenticare (post-invio)

- **Cancellazione account in-app**: Google richiede che, oltre alla pagina web, esista un
  percorso di eliminazione DENTRO l'app. Oggi non c'è → da aggiungere in un prossimo
  aggiornamento (schermata Profilo → "Elimina account" + endpoint backend). Da fare presto.
- **Aggiornamenti futuri**: ad ogni nuovo AAB va alzato `versionCode` (ci penserà uno
  script o te lo ricordo io).
- Il keystore (`~/MetaboleKeys/`) va tenuto in backup fuori dal Mac.
