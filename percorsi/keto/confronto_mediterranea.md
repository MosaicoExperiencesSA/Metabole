# Percorso KETO vs Mediterranea — confronto delle regole di costruzione

Confronto tra le **regole 1–10 del Keto** e la spec validata della **Mediterranea**
(`Metabole_Motore_Personalizzazione.md`, `Metabole_Agente_AI_Dieta.md`).
**Esito di sintesi: stesso metodo, stessa ossatura.** Le differenze sono su alcuni dettagli che nel Keto vanno ancora allineati.

---

## Cosa è IDENTICO (il metodo validato è rispettato)
- **Isolamento per prodotto**: menu solo Keto, mai mischiati con altri percorsi (R5 = §0 Mediterranea).
- **Base approvata dal nutrizionista** prima dell'uso (R5 = workflow catalogo Mediterranea).
- **Catalogo diviso per pasto** colazioni/pranzi/cene/spuntini/merende (R2 = §1).
- **3–5 modi di cottura per piatto a kcal invariate** (R6 = "Ricette" §1).
- **Esclusioni** allergie/intolleranze/non graditi con **sostituzione via gruppi di equivalenza** (R7 = §2).
- **Ciclo bigiornaliero**: stesso menu per 2 giorni, 2 cotture diverse, misura a fine ciclo (R8 = §3).
- **Gradimento opzionale, default 5★** (R8 = §4).
- **Su peso in aumento riproporre ciò che ha fatto perdere di più; apprendimento personale** (R9 = §5–6).
- **Seme personale per l'unicità** della dieta (R10 = §9bis meccanismo 1).

---

## Le DIFFERENZE (dove il Keto diverge o è ancora da completare)

| # | Tema | Mediterranea (validata) | Keto (R1–10) | Nota |
|---|---|---|---|---|
| 1 | **Stagionalità** | Catalogo per pasto **× stagione** (Prim/Est/Aut/Inv/Tutte) | **Nessuna dimensione stagione** | Da decidere se il Keto usa la stagionalità o no |
| 2 | **Gestione esclusione non sostituibile** | **Non rimuove mai in silenzio**: blocca quel menu + **escalation** a coach+nutrizionista | R7 **rimuove/sostituisce**, escala solo se una **categoria si svuota** | Allineare: nel Keto un allergene non sostituibile dovrebbe **bloccare+escalare**, non sparire |
| 3 | **Porzioni / fame** | **Porzioni standard, niente restrizione, "no fame"**: risultato dalla qualità | R non esplicita il principio "no fame"; Keto è di per sé un protocollo a macro controllati | Aggiungere il principio esplicito (compatibile con la keto) |
| 4 | **Giornata bilanciata** | Colazione+Pranzo+Cena a **totale interno costante** (mediana); spuntino/merenda **fuori** dal bilancio ma tracciati | R non specifica il meccanismo di bilanciamento della giornata | Da aggiungere (regola sul bilancio giornata) |
| 5 | **"Seguito sì/no"** | Esito registrato **solo se** seguito=sì **e** misure aggiornate | R8 rende le **misure obbligatorie** ma **non** ha il flag "seguito" | Aggiungere il gate di aderenza |
| 6 | **Esito peso vs cm** | **Due esiti separati**: peso *e* cm (vita+fianchi) | R8 li tratta insieme (📉 peso e/o cm) | Separare i due esiti come in Mediterranea |
| 7 | **Gradimento** | Per **ricetta**; il menu vale **max(stelle)**, non la media | R8 parla di gradimento per piatto, senza la regola **max(stelle)** | Adottare max(stelle) |
| 8 | **Apprendimento** | **Isola il singolo pasto**: confronta giornate che differiscono per un solo pasto → pesa colazione/pranzo/cena | R9 fa un **ranking del menu intero**, non isola il pasto | Il Keto è più "grezzo": manca l'attribuzione al singolo pasto |
| 9 | **Decisione (agente)** | **Scoring** `w_eff·Efficacia + w_grad·Gradimento` con **stati**: Conforto→Rientro, Pre-evento proteico, Post-evento, Plateau (umore/eventi/agenda) | R9 è una **regola deterministica** (📈 ripesca il migliore · ➖/📉 nuovo menu); **niente umore/eventi/conforto** | Differenza grossa: il Keto oggi non modella umore/eventi |
| 10 | **Unicità/certificazione** | 3 meccanismi: seme+traiettoria stateful, **collision check**, **registro firmato + certificato** | R10 usa il **seme** per differenziare la partenza; mancano collision check e certificato | Estendere se serve la certificazione di unicità |
| 11 | **Obiettivo prodotto** | Parametro **dimagrimento/mantenimento** che modula i pesi | Non trattato (Keto assunto = dimagrimento) | Aggiungere il parametro se il Keto avrà anche mantenimento |
| 12 | **kcal verso il cliente** | Le **kcal restano interne**, mai mostrate al cliente | R3 mette le **calorie in catalogo** (lato costruzione) | OK per la costruzione, ma lato cliente le kcal vanno **nascoste** come in Mediterranea |
| 13 | **Segnalazioni** | Matrice completa: `diet_blocked`, `no_progress`, `low_adherence`, `mood_risk`, `clinical` | R9 escala su aumenti/plateau/cali | Estendere la matrice (aderenza, umore, clinico) |
| 14 | **RBAC** | Nutrizionista tutto · Coach aderenza (no clinico) · Cliente no kcal/logiche | R cita solo cifratura dati sanitari | Esplicitare i ruoli come in Mediterranea |

---

## Cosa il Keto ha reso più ESPLICITO (miglioria di metodo)
- **Calorie per piatto** come passo di costruzione dichiarato (R3) — nella Mediterranea le kcal vengono da CREA e restano interne.
- **23 gruppi di equivalenza** documentati come tabella (R4) — nella Mediterranea la sostituzione c'è ma non è un artefatto elencato.
- **Menu di partenza differenziati** come regola a sé (R10).

## In una riga
Il Keto **ripete fedelmente il metodo** validato della Mediterranea (isolamento, catalogo per pasto, cotture, esclusioni, ciclo 2 giorni, apprendimento personale, seme). Le differenze vere sono: **niente stagionalità**, **gestione esclusioni più "taglia" e meno "blocca+escala"**, e un **agente più semplice** (manca umore/eventi/conforto, l'attribuzione al singolo pasto, seguito-sì/no, peso vs cm separati, e la certificazione di unicità completa). Sono i punti da allineare nelle prossime regole se vogliamo la piena parità con la Mediterranea.
