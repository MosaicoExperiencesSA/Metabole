# 09 · La checklist di montaggio

Da spuntare in ordine. Ogni riga si spunta **solo dopo averla verificata**, non dopo averla scritta:
un comando che non gira non stampa niente, e «niente» somiglia troppo a «tutto bene».

## Giorno 1 — le fondamenta

- [ ] `kit/manuale/00-decisioni.md` compilato in tutte e undici le righe
- [ ] Repository creato, `.gitignore` che esclude `.env` e ogni file di segreti
- [ ] `CLAUDE.md` del progetto nuovo scritto, con dentro: stack, ruoli, **la regola d'oro dei
      permessi**, la regola dei centesimi, e dove stanno le chiavi (mai nel repo)
- [ ] Backend che parte, database vuoto raggiungibile
- [ ] Schema Prisma con `User`, `RefreshToken`, `ActionToken`, `AuditLog`, `ConfigParam`
- [ ] Prima migrazione applicata

## Giorno 2 — grafica e gabbia

- [ ] `theme.css` copiato e la palette sostituita (capitolo 01)
- [ ] `ThemeProvider` montato, almeno due temi nei **tre** posti
- [ ] `Layout.tsx`, `UserMenu.tsx`, `ui.tsx` copiati (capitolo 02)
- [ ] `NAV` con le prime voci
- [ ] `grep -rn "#[0-9a-fA-F]\{6\}" src/pages/` → **vuoto**

## Giorno 3 — permessi (prima delle pagine)

- [ ] `pages.ts`, `permissions.service.ts`, `page.guard.ts`, `require-page.decorator.ts` copiati
- [ ] Le quattro spec dei permessi copiate e **verdi**
- [ ] `BACKOFFICE_PAGES` con una chiave per ogni voce di `NAV`
- [ ] `PAGE_LABEL` con una etichetta per ogni chiave
- [ ] `syncDefaults` gira all'avvio e **fallisce rumorosamente**
- [ ] `GET /me/permissions` risponde, e il `can()` del frontend lo usa

## Giorno 4 — identità

- [ ] `auth.service.ts` + `auth.controller.ts` copiati (capitolo 04)
- [ ] Mailer collegato, i quattro modelli email esistono
- [ ] Registrazione → email → verifica: provato davvero, su una casella vera
- [ ] Login, refresh, logout: provati
- [ ] Reset password: provato, e revoca le sessioni

## Giorno 5 — email utente e profilo

- [ ] Le quattro rotte del cambio email (capitolo 05)
- [ ] Provato il giro completo: aggiungi → verifica → rendi principale → togli
- [ ] Provato che il login funziona con **tutte e due** le email
- [ ] Pagina Impostazioni con le sue card (capitolo 06)
- [ ] Provato che nessun `/me/*` accetta un id utente dal client

## Giorno 6 — amministrazione

- [ ] Utenti, Ruoli, Permessi, Log attività, Lista lavori (capitolo 07)
- [ ] Creato un ruolo personalizzato dalla pagina, senza migrazioni
- [ ] Tolto un permesso a un ruolo, fatto login con quel ruolo, verificato che la pagina **non**
      si apre nemmeno andando all'URL a mano
- [ ] Il registro attività si popola, e non ha endpoint di scrittura
- [ ] Ritenzione del registro decisa e programmata

## Giorno 7 — commerciale (solo se serve)

- [ ] Le otto pagine del capitolo 08, ognuna con la sua chiave
- [ ] Provato un giro intero: acquisto → contabile → approvazione → provvigione → prelievo
- [ ] Verificato che i totali del conto economico tornano leggendo **solo** `LedgerEntry`
- [ ] Provato uno storno, e verificato che i conti tornano lo stesso

---

## Le sei verifiche finali (nessuna è facoltativa)

### 1 · Nessuna chiave orfana

```
npm test -- chiavi-senza-guardia
```

Ogni chiave dichiarata è letta da almeno un `@RequirePage`.

### 2 · Nessuna porta aperta per un'altra strada

Per ogni pagina: togli il permesso, fai login con quel ruolo, **chiama l'endpoint a mano**.
Non basta che la voce di menu sparisca.

### 3 · Nessun colore fuori dal tema

```
grep -rn "#[0-9a-fA-F]\{6\}\|rgb(" src/pages/ src/components/ | grep -v theme.css
```

### 4 · Nessun segreto nel repository

```
git log -p | grep -iE "password|secret|api[_-]?key|postgres://|DATABASE_URL"
```

⚠️ Anche nello **storico**, non solo nell'ultima versione. Una chiave committata e poi tolta è una
chiave pubblicata: si revoca, non si cancella.

### 5 · Nessun importo in virgola mobile

```
grep -rn "Float\|Decimal" prisma/schema.prisma
```

### 6 · Rileggi quello che hai scritto

Per ogni file toccato da uno script: `grep` sul pezzo cambiato, non l'`ok` stampato dallo script.
È la regola che in Metabole è costata una consegna che diceva «fatto» su un file mai modificato.

---

## Cosa NON è nel kit (e va deciso a parte)

Il kit copre la base comune. Queste sono le cose che cambiano da progetto a progetto e che vanno
progettate ogni volta:

- **Il dominio vero** — quello che il prodotto fa, che è il motivo per cui esiste
- **Il modello di vendita** — abbonamento, una tantum, consumo, freemium
- **L'app mobile**, se serve, e la sua strategia di aggiornamento
- **Le notifiche push** e i loro token
- **Le integrazioni** — pagamenti, fatturazione, CRM, calendario
- **I backup e il ripristino** ⚠️ un backup mai ripristinato non è un backup: provalo
- **Il monitoraggio** — errori, tempi di risposta, avvisi
- **I documenti legali** — privacy, termini, cookie, e il registro dei trattamenti

⚠️ L'ultima riga è quella che si rimanda sempre. Se il progetto tratta dati di persone in Europa,
serve **prima** del primo utente vero, non dopo.
