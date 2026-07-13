# MetaboleAI — Specifica tecnica del Giudice (compliance & brand)

Specifica implementabile dallo Sviluppo per l'agente **Giudice**: il controllo che valuta **ogni**
proposta di contenuto **prima** della pubblicazione e restituisce un verdetto **Approva / Rivedi /
Blocca**. È il freno di sicurezza della Macchina di Marketing: protegge dagli **stop dei social** e
dai **claim di salute** non validati.

Riferimenti: `Metabole_Macchina_Marketing_AI` (ruolo nella macchina), `Metabole_Libreria_Creativa`
(lessico), `Metabole_Reparto_Marketing_e_Standard_CRM` (audit/consensi).

---

## 1. Ruolo e posizione nel flusso

```
Creativo/Copy → [ GIUDICE ] → (revisione umana se sensibile) → Publisher
```

Nessun asset raggiunge il Publisher senza un verdetto del Giudice. Ogni decisione è **registrata**
(audit) e **spiegata** (motivazione), sia per imparare sia per difendersi in caso di contestazione.

## 2. Input / Output

**Input (asset da valutare):**
```
{
  id, tipo: reel|carosello|testimonianza|quote|email|sms|ad,
  canale: instagram|tiktok|meta_ads|google_ads|email|sms,
  testo, media[] (immagini/video), cta,
  targeting: {eta_min, audience, paese},
  contesto: {angolo, campagna, fase_funnel}
}
```

**Output (verdetto):**
```
{
  verdetto: approva | rivedi | blocca,
  punteggio: 0-100,
  violazioni: [ {regola, gravita, dove, suggerimento} ],
  richiede_umano: bool,
  motivazione: testo,
  ruleset_version
}
```

## 3. Ruleset di compliance (regole verificabili)

Ogni regola ha **gravità**: 🔴 *bloccante* · 🟠 *da rivedere* · 🟡 *avviso*. Le regole vivono in
`config_param` (versionate), così si aggiornano quando le policy cambiano — **senza toccare il
codice**.

### 3.1 Trasversali (tutti i canali)
- 🔴 **Prima/dopo**: immagini o testi che confrontano il corpo prima/dopo, o che mostrano
  trasformazioni di peso legate al prodotto.
- 🔴 **Attributi personali**: seconda persona che implica una condizione ("sei in sovrappeso?",
  "vuoi perdere peso?", "stai lottando con i chili"). *(Riformulare sul servizio.)*
- 🔴 **Numeri/tempi/garanzie**: "-X kg in Y giorni", "garantito", "cura".
- 🔴 **Body-shaming / corpo ideale**: umiliazione del corpo, "corpo perfetto", aspetto = valore/
  successo/felicità.
- 🔴 **Claim di salute non validati**: promesse mediche/terapeutiche → **escalation nutrizionista capo**.
- 🟠 **Targeting età < 18**: i contenuti dimagrimento richiedono **18+**.
- 🟡 **Coerenza brand**: tono, palette, pilastri (persone vere + AI, senza fame, trasparenza).
- 🟡 **Landing coerente**: la pagina di destinazione rispetta le stesse regole (privacy, contatti, no promesse).

### 3.2 Specifiche Meta (Facebook/Instagram)
- 🔴 Framing indiretto su attributi ("per chi è in sovrappeso") oltre alla seconda persona.
- 🟠 **Naming sensibile** di pixel/audience/conversioni (termini sanitari) → segnalare rinomina.
- 🟡 Preferire ottimizzazione su eventi alti nel funnel (traffico/lead) per la categoria sensibile.

### 3.3 Specifiche TikTok
- 🔴 "Facile/garantito", "dimagrisci senza dieta né esercizio", risultati irrealistici.
- 🔴 Integratori dimagranti / app di digiuno (in Italia non pubblicizzabili).
- 🟠 Claim di dimagrimento ammessi solo 18+ **e** solo promuovendo stile di vita sano.

### 3.4 Specifiche Google Ads
- 🔴 Prodotti hCG per dimagrimento; farmaci su prescrizione senza certificazione.
- 🟠 Audience "curate dall'inserzionista" su temi salute (Customer Match/Lookalike) → usare audience predefinite Google.
- 🟡 Nessun body-shaming / risultati irrealistici nel testo.

### 3.5 Email / SMS
- 🔴 Invio senza **consenso** valido per il canale (email/SMS separati).
- 🟠 SMS senza opzione di **opt-out** ("STOP").
- 🟡 Email: dominio autenticato (SPF/DKIM/DMARC) e mittente coerente.

## 4. Logica di scoring e verdetto

Il Giudice valuta **quattro dimensioni**, ciascuna 0-100, poi combina:

| Dimensione | Cosa misura | Peso |
|---|---|---|
| **Compliance** | Assenza di violazioni policy (per canale) | 0.45 |
| **Veridicità/claim** | Nessuna promessa non sostenibile; claim salute validati | 0.25 |
| **Brand** | Tono, pilastri, coerenza visiva | 0.20 |
| **Qualità** | Chiarezza, hook, CTA, formato corretto | 0.10 |

```
punteggio = 45*Compliance + 25*Veridicita + 20*Brand + 10*Qualita   (normalizzato 0-100)
```

**Regole di verdetto (in ordine di precedenza):**
1. Se esiste **una** violazione 🔴 → **BLOCCA** (a prescindere dal punteggio).
2. Se claim di salute → **richiede_umano = true** + escalation nutrizionista capo (verdetto *rivedi* finché non validato).
3. Se una o più violazioni 🟠 → **RIVEDI** (torna a Creativo/Copy con i suggerimenti).
4. Altrimenti: **APPROVA** se punteggio ≥ **soglia_approva** (default 80); **RIVEDI** se tra 60 e 80; **BLOCCA** se < 60.

Le soglie (80/60) e i pesi sono in `config_param`, tarabili senza deploy.

## 5. Human-in-the-loop

Va all'**umano** (Responsabile Marketing o nutrizionista capo) quando:
- c'è un **claim di salute** (sempre nutrizionista capo);
- punteggio **incerto** vicino alle soglie (es. 58-62 o 78-82);
- **newsjacking** (contenuto reattivo a una notizia);
- primo contenuto di una **nuova campagna/angolo** (approvazione pilota).
Il resto scorre in automatico. Ogni override umano è loggato e **rieduca** il ruleset.

## 6. Audit log (formato)

Ogni decisione, immutabile (append-only, coerente con l'audit del backend):
```
{ ts, asset_id, canale, verdetto, punteggio, violazioni[], ruleset_version,
  deciso_da: giudice|umano, override_di?, motivazione }
```
Serve per: difendersi da contestazioni, misurare il tasso di blocco, migliorare la libreria.

## 7. Configurazione (config_param)

- `giudice_ruleset` (JSON versionato delle regole §3) · `giudice_pesi` · `giudice_soglia_approva` (80)
  · `giudice_soglia_rivedi` (60) · `giudice_canali_attivi`.
- **Aggiornamento policy**: quando Meta/TikTok/Google cambiano le regole, si aggiorna il ruleset (nuova
  versione) — il Giudice applica subito le nuove regole a tutti i contenuti successivi.

## 8. Pseudocodice

```
function giudica(asset):
    v = raccogli_violazioni(asset, ruleset[asset.canale])   # §3
    if any(v.gravita == ROSSO): return blocca(v)
    if contiene_claim_salute(asset): return rivedi(v, richiede_umano=True, escalation="nutrizionista_capo")
    score = pesa(dimensioni(asset))                         # §4
    if any(v.gravita == ARANCIO): return rivedi(v)
    if score >= soglia_approva:
        if serve_pilota(asset): return rivedi(v, richiede_umano=True)
        return approva(score)
    if score >= soglia_rivedi: return rivedi(v)
    return blocca(v)
```

## 9. Metriche del Giudice

Tasso di **approvazione/rivedi/blocco**, tempo medio di giudizio, % contenuti che superano poi il
controllo delle piattaforme (zero rifiuti = obiettivo), numero di override umani (se alto → ruleset
o libreria da migliorare).

## 10. Manutenzione e limiti

Le policy dei social **cambiano spesso e non sono sempre esplicite**: il ruleset va rivisto
periodicamente e il Giudice resta un **filtro di rischio**, non una garanzia legale. Per i claim
delicati decide sempre l'**umano** competente. Il Giudice riduce drasticamente il rischio di blocco,
ma la responsabilità finale sui contenuti sensibili resta umana.

## In una riga

Un controllo automatico che, prima di ogni pubblicazione, verifica le regole di Meta/TikTok/Google e
del brand, dà un punteggio e un verdetto **Approva/Rivedi/Blocca**, manda all'umano solo il sensibile
e **registra tutto** — implementabile con regole in `config_param` e audit log, così si aggiorna
quando le policy cambiano.
