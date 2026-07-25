# Metabole — App Store Connect: testi e questionari (pronti da incollare)

Team Apple: **Genius Company SA** (rinomina → Mosaico Experiences SA richiesta ad Apple;
il nome "venditore" sullo store si aggiornerà quando Apple la completa).
Bundle ID: **app.metabole** · Categoria: **Salute e benessere (Health & Fitness)**.

---

## 1. Informazioni sull'app (App Information)

**Nome** (max 30):
```
Metabole — Nutrizione e Coach
```

**Sottotitolo** (max 30):
```
Percorso su misura con coach
```

**URL assistenza**:
```
https://metabole.eu
```

**URL informativa privacy**:
```
https://metabole.eu/Metabole_Privacy.html
```

**Categoria primaria**: Salute e benessere · **Secondaria** (facoltativa): Cibo e bevande

---

## 2. Versione (1.0) — scheda in italiano

**Testo promozionale** (max 170, modificabile senza revisione):
```
Il tuo percorso di nutrizione personalizzato, seguito ogni giorno da coach e nutrizionisti reali, con Gaia che ti accompagna passo dopo passo.
```

**Descrizione** (max 4000) — stessa di Google Play:
```
Metabole è il tuo percorso di nutrizione personalizzato: un metodo costruito su di te, seguito ogni giorno da coach e nutrizionisti reali, con Gaia — la nostra guida — che ti accompagna passo dopo passo.

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
• Widget con Gaia e contapassi integrato.
• Notifiche intelligenti che si adattano al tuo momento (e si spengono quando vuoi).

PENSATA PER OGNI CULTURA
Percorsi e menu rispettano le tue esclusioni: religiose, etiche, intolleranze o semplici gusti. In italiano e inglese.

PER IL TEAM METABOLE
La stessa app è usata da coach e nutrizionisti per seguire i propri clienti: dashboard, alert, chat, agenda e guadagni, sempre a portata di mano.

L'installazione e la registrazione sono gratuite; il percorso completo si attiva con un abbonamento al servizio di coaching. Maggiori informazioni su https://metabole.eu
```

**Parole chiave** (max 100, separate da virgola):
```
nutrizione,dieta,coach,benessere,dimagrire,menu,peso,nutrizionista,alimentazione,salute
```

**URL di supporto**: https://metabole.eu · **URL marketing** (facoltativo): https://metabole.eu

---

## 3. Prezzo e disponibilità
- **Gratuita** (l'abbonamento al coaching è un servizio reso fuori dall'app, non un acquisto in-app digitale).
- Paesi: Italia + Svizzera per il lancio (poi ampliabile).

---

## 4. Privacy dell'app (App Privacy) — analoga al Data safety di Android
Raccogliamo dati COLLEGATI all'utente, NON usati per tracciamento pubblicitario:
- **Dati di contatto**: nome, email, telefono → Funzionalità app, Gestione account
- **Salute e fitness**: peso, misure, esclusioni alimentari, documenti sanitari, passi → Funzionalità app
- **Informazioni finanziarie**: cronologia acquisti abbonamento → Funzionalità app
- **Contenuti utente**: foto caricate, messaggi con il coach → Funzionalità app
- **Identificatori**: ID utente → Funzionalità app
Tracciamento (ATT): **NO**. Dati condivisi con terze parti a fini pubblicitari: **NO**.
Pagamenti carta gestiti da Stripe (processore); i dati carta non transitano da Metabole.

---

## 5. Classificazione per età (Age Rating)
Rispondi **Nessuno/No** a tutte le voci sui contenuti sensibili. La chat è 1:1 col proprio
coach (non è social/UGC pubblico). Risultato atteso: **17+** solo se il questionario lo impone
per "assistenza medica/trattamento" — se chiede di app medica, rispondi che NON fornisce
diagnosi né trattamenti medici (è benessere/nutrizione). Probabile esito 4+ o 12+.

---

## 6. Informazioni per la revisione (App Review Information)
**Account di prova** (Sign-in richiesto → fornisci credenziali):
```
Utente: simone.salogni+playreview@gmail.com
Password: [inseriscila qui in ASC, non in chat]
```
**Note** (in inglese, per i revisori):
```
Metabole is a nutrition coaching app. Log in with the provided credentials to see the full
client experience (daily menus, journey, coach chat, agenda) — the test account has an ACTIVE
subscription, no purchase needed. The app is used by clients and, with staff accounts, by
coaches/nutritionists (role-based after login).

Payments: the subscription is a HUMAN coaching service + physical products, delivered outside
the app; payment is handled externally (Stripe), not as a digital in-app purchase.

Account deletion is available in-app: Profile → Elimina account (bottom), confirmed with password.
```
**Contatto**: nome, cognome, telefono, email (info@metabole.eu).

---

## 7. Screenshot (obbligatori)
Servono per **iPhone 6.9"/6.7"**: dimensione **1290 × 2796** (o 1320×2868). Minimo 3, max 10.
Falli dal tuo iPhone (Metabole è già installata): stesse schermate di Android — menu del giorno,
percorso/obiettivi, contatti col team, agenda/piano, personalizzazione. Poi passali al Mac e
li rifinisco io alla dimensione esatta richiesta da Apple (come ho fatto per il Play Store).
NB: l'iPhone su cui gira l'app è già in formato giusto; bastano gli screenshot nativi (tasto
laterale + volume su).

---

## 8. Consegna (dopo aver compilato tutto)
1. In Xcode: menu in alto → dispositivo **"Any iOS Device (arm64)"** → **Product → Archive**.
2. A fine archivio si apre l'Organizer → **Distribute App → App Store Connect → Upload**.
3. La build compare in ASC dopo qualche minuto (elaborazione). Assegnala alla versione 1.0.
4. **TestFlight**: puoi installarla sul tuo iPhone dalla app TestFlight per una prova "reale".
5. Quando tutto è a posto → **Aggiungi per la revisione / Invia**.
   Revisione Apple: in genere 24-48 ore.
```
Nota versione: MARKETING_VERSION 1.0, build 2 (allineati ad Android via android-version.json).
Per ogni nuovo invio Apple vuole un build number più alto → si alza come per Android.
```
