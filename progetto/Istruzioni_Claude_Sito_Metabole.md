# Istruzioni per Claude — Sito Metabole (collegamento al backend + go-live)

Queste istruzioni servono a chi pubblica/mantiene il **sito di presentazione** di Metabole
(`Metabole_Sito_Presentazione.html`) e la pagina **"Lavora con noi"** (`Metabole_Lavora.html`).
Il **backend è già in produzione e funzionante**: il tuo compito è solo assicurarti che il sito
lo chiami correttamente e che il dominio dove hai pubblicato sia autorizzato (CORS). **Non modificare il backend.**

---

## 1. Backend a cui il sito si collega

Base URL di produzione (già in uso dal form lead del sito):

```
https://metabole-backend.onrender.com/api/v1
```

Il sito è **data-driven**: legge gli URL da attributi `data-*` sul tag `<body>` e da `data-endpoint`
sui form. Questi sono **già valorizzati** nel file del repository. Se hai pubblicato una **copia**
del sito, verifica che nel tuo file `<body>` ci siano esattamente questi valori:

```html
<body
  data-i18n-endpoint=""
  data-stats-endpoint="https://metabole-backend.onrender.com/api/v1/public/stats"
  data-paths-endpoint="https://metabole-backend.onrender.com/api/v1/public/paths"
  data-testimonials-endpoint="https://metabole-backend.onrender.com/api/v1/public/testimonials">
```

- `data-i18n-endpoint` **va lasciato vuoto**: non esiste un endpoint i18n lato server, il sito fa no-op (le traduzioni sono già nel file).
- Il **form lead** (in `Metabole_Sito_Presentazione.html`) e il form candidature (in `Metabole_Lavora.html`) hanno già:
  ```
  data-endpoint="https://metabole-backend.onrender.com/api/v1/public/leads"
  ```

**Non inventare altri endpoint.** Gli unici pubblici disponibili sono i quattro qui sotto.

---

## 2. Contratto degli endpoint (cosa restituiscono)

Tutti pubblici (nessuna autenticazione), con rate-limit lato server. Il sito li chiama in sola lettura, tranne i lead (POST).

### `GET /public/paths` — percorsi alimentari (home)
Array di percorsi visibili, uno per stile:
```json
[
  { "style": "mediterranean", "name": "Mediterranea", "clientName": "Mediterranea",
    "description": "…", "highlights": ["…","…"], "objective": "dimagrimento", "seasonalTag": null }
]
```
Il sito usa `name` (fallback `clientName`); `color`/`icon` sono opzionali (il sito ha già dei default).

### `GET /public/stats` — numeri della home
Oggetto con campi opzionali:
```json
{ "clients": 0, "reached": 0, "methods": 4, "years": 0 }
```
`methods` = numero di percorsi. `clients`/`reached` sono conteggi reali dal DB, **sovrascrivibili** con numeri
marketing dal backoffice (parametri `site_stats_clients`, `site_stats_reached`, `site_stats_years`) — **non è compito tuo**.

### `GET /public/testimonials` — testimonianze (sezione storie)
Array delle testimonianze **pubblicate**, ordinate:
```json
[ { "name": "Martina", "age": 41, "text": "…", "photo": null } ]
```
`photo` può essere `null` → il sito usa un'immagine di ripiego. Le testimonianze si gestiscono dal **backoffice**
(sezione Marketing → Testimonianze), **non dal sito**.

### `POST /public/leads` — invio form (contatti + candidature)
Body JSON:
```json
{ "nome": "…", "email": "…", "fonte": "sito_presentazione", "lingua": "it",
  "ruolo": "…(solo Lavora con noi)…", "messaggio": "…(opzionale)…", "website": "" }
```
- `email` è l'unico campo obbligatorio.
- `website` è un **honeypot anti-bot**: deve restare **vuoto e nascosto** all'utente. Se valorizzato, il server
  risponde `200` ma **scarta** silenziosamente (non toccare questo comportamento — il markup del sito lo gestisce già).
- Risposta attesa: `200` con `{ "ok": true, "id": "…" }`.

---

## 3. CORS — il punto che fa "non funzionare" il sito

Le chiamate del sito al backend sono **cross-origin**: il dominio da cui servi il sito **deve** essere
nella variabile `CORS_ORIGINS` del backend su Render, altrimenti il browser blocca tutto (le sezioni restano vuote,
il form dà errore) anche se gli endpoint funzionano.

Origini attualmente autorizzate su Render:
```
https://backoffice.metabole.eu, https://app.metabole.eu, https://metabole.eu
```

**Verifica dove hai pubblicato il sito:**
- Se è su **`https://metabole.eu`** (dominio nudo) → sei già coperto. ✅
- Se è su **`https://www.metabole.eu`**, su un altro sottodominio, o su un URL tipo **`*.vercel.app`** →
  quell'origine **non è ancora autorizzata**: va **aggiunta a `CORS_ORIGINS`** su Render (pannello del servizio
  `metabole-backend` → Environment). Solo `protocollo + dominio`, separati da virgola, **senza slash finale**.
  Questa modifica la fa Simone (o chi ha accesso a Render) — segnalagli l'origine esatta da aggiungere.

> Regola pratica: l'origine nel browser (schema+host, es. `https://www.metabole.eu`) deve comparire **identica**
> in `CORS_ORIGINS`. `metabole.eu` e `www.metabole.eu` sono origini **diverse**.

---

## 4. Come verificare che tutto funzioni

1. **Endpoint vivi** (indipendente dal sito): apri in un browser
   `https://metabole-backend.onrender.com/api/v1/public/paths` (e `/stats`, `/testimonials`) →
   devono rispondere JSON. Se sì, il backend è ok.
2. **Sito online**: apri il sito pubblicato, apri la **console del browser** (F12 → Network/Console).
   - Se vedi errori **CORS** → l'origine del sito non è in `CORS_ORIGINS` (vedi §3).
   - Se le chiamate tornano `200` → home (percorsi + numeri) e sezione storie si popolano da sole.
3. **Form lead**: compila e invia dal sito → deve arrivare `200`; il lead compare nel CRM del backoffice
   (sezione lead). Prova anche a lasciare il campo honeypot valorizzato (via devtools) → deve NON creare lead.

---

## 5. Cosa NON fare
- **Non modificare il backend** né gli endpoint: sono in produzione e usati anche dall'app.
- **Non cambiare** il comportamento honeypot del form né la base URL degli endpoint.
- **Non aggiungere** endpoint inesistenti (blog, i18n server, ecc.): oggi non ci sono.
- Le **testimonianze** e i **numeri** si gestiscono dal **backoffice**, non dal codice del sito.

---

## 6. Riassunto operativo
1. Assicurati che il `<body>` del sito abbia i tre `data-*-endpoint` valorizzati (§1).
2. Verifica che l'**origine dove hai pubblicato** sia in `CORS_ORIGINS` su Render; se no, comunica a Simone l'origine da aggiungere (§3).
3. Testa endpoint, console browser e invio form (§4).

Fatto questo, il sito è pienamente collegato al backend: percorsi, numeri e testimonianze dinamici, e i form che salvano i lead nel CRM.
