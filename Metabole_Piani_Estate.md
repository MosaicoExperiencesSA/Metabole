# MetaboleAI — Piani d'estate (luglio): Vacanze in Serenità & Ritorno in Equilibrio

Due percorsi stagionali per il mese di luglio, quando metà del pubblico **parte** in vacanza e metà
**rientra**. Non sono nuovi abbonamenti: sono **due modalità** del percorso Metabole che il motore e
l'agente AI attivano in base al contesto del cliente. Documento **prodotto**, pronto da condividere
con lo Sviluppo per l'implementazione.

- **Piano 1 — Vacanze in Serenità**: per chi parte. Obiettivo = **mantenimento senza fame e senza sensi di colpa**.
- **Piano 2 — Ritorno in Equilibrio** *(nome proposto)*: per chi rientra. Obiettivo = **ripartire con dolcezza** verso il proprio traguardo.

> Nome del Piano 2: propongo **"Ritorno in Equilibrio"** (richiama il pilastro *equilibrio* e fa da
> coppia a "Vacanze in Serenità"). Alternative se preferisci: *Ripartenza Serena*, *Reset Dolce*,
> *Rientro Leggero*. Scegli tu e lo fisso ovunque.

---

## 0. Come si incastrano con ciò che esiste già

Entrambi i piani **riusano** i mattoni già presenti nel motore (non serve reinventare):

- **Agente AI dieta** con i suoi stati (`normale`, `conforto`, `plateau`, `pre_evento`, `post_evento`, `rientro`): i due piani sono in pratica due **stati stagionali** guidati da un segnale di contesto.
- **Catalogo menu stagionale** (estate) con etichette **caldo/freddo**: per la vacanza si privilegiano i piatti **freddi/portabili**.
- **Segnali** già tracciati: acqua, passi, check-in umore, misure (con il popup bloccante al 2° giorno).
- **Agente Contesto & Tempismo**: è luglio → propone questi due piani al pubblico giusto.

Serve solo un **segnale di contesto** nuovo ("sto per partire" / "sono rientrato/a") con le date, che accende la modalità. Dettaglio implementativo in §3.

---

## 1. Piano 1 — Vacanze in Serenità

**Per chi:** cliente attivo che sta per andare in vacanza (o è già in vacanza).

**Promessa:** *"Goditi la vacanza. Al tuo equilibrio ci pensiamo noi — senza fame, senza sensi di colpa."*

**Obiettivo:** **mantenimento**, non dimagrimento. La vacanza è una fase in cui si difende il risultato, non si spinge il deficit. Zero restrizione, zero peso psicologico.

**Cosa cambia nell'esperienza:**

- **Menu da vacanza**: estivi, freschi, veloci; priorità ai piatti **freddi e portabili** (spiaggia, pic-nic, treno). Per ogni pasto, l'app suggerisce anche la **versione "fuori casa"**: come scegliere bene al **ristorante** o al bar (non un menu rigido, ma una bussola).
- **Gestione strappi senza colpa**: se salta un pasto o arriva il gelato/la cena fuori, l'agente **riequilibra il pasto successivo** (logica conforto→rientro già esistente), senza mai colpevolizzare.
- **Idratazione & movimento leggero**: reminder acqua (già a sistema) e passi/camminate/nuoto come "movimento della vacanza", non allenamento.
- **Check-in alleggerito**: durante la vacanza le **misure non bloccano** l'erogazione (il popup del 2° giorno si sospende); il check-in umore resta, in versione soft.
- **Gaia**: tono rilassato e rassicurante ("rilassati, ci sono io"), più un **consiglio pre-partenza** (cosa mettere in valigia: snack sani, borraccia; come organizzare i pasti in viaggio).

**Team:** la **coach** manda un messaggio di *buona partenza* (template). Il **nutrizionista** interviene solo per casi clinici (patologie, allattamento) — vedi guardrail.

**Durata:** le date della vacanza scelte dal cliente. Alla fine, l'app propone il passaggio al **Piano 2**.

**Guardrail:** in presenza di patologie/gravidanza/allattamento il mantenimento è **validato dal nutrizionista**; mai digiuni o tagli. Sicurezza prima di tutto.

---

## 2. Piano 2 — Ritorno in Equilibrio (post-vacanza)

**Per chi:** cliente che rientra dalle vacanze **e** — come gancio — ex clienti da riattivare (win-back, collegato all'app-allert di rientro).

**Promessa:** *"Bentornato/a. Ripartiamo con calma: niente diete lampo, solo ritmo ritrovato."*

**Obiettivo:** **ripartenza dolce** — sgonfiarsi, reidratarsi, rimettere ordine in sonno e pasti, e tornare gradualmente verso il proprio obiettivo. L'antitesi della "dieta punitiva di settembre".

**Come funziona (prime ~2 settimane):**

- **Settimana 1 — Reset dolce**: menu **leggeri e di stagione** (verdure, acqua, meno sale), idratazione, ritmo sonno/pasti, movimento leggero. Obiettivo psicologico = **rimettersi in carreggiata**, non i numeri. In questa settimana le misure sono gentili (si riprende, ma senza ansia).
- **Settimana 2 — Ritmo**: si riprende il **percorso pieno** verso l'obiettivo; l'agente entra in spinta **efficacia graduale** (come lo stato `rientro`/`plateau` già esistente); il popup misure del 2° giorno **ritorna attivo**.

**Cosa cambia nel motore:** cicli di 2 giorni con menu di stagione e spinta efficacia progressiva; nessuno shock calorico. Porzioni standard, **niente fame**.

**Gaia:** "bentornato/a", nessun senso di colpa per gli strappi ("è normale, si riparte"), focus su **come ci si sente** (energia, leggerezza) più che sul numero.

**Team:** la **coach** manda un *bentornato* + eventuale breve call motivazionale; il **nutrizionista** verifica se in vacanza sono emerse cose cliniche.

**Doppio uso (marketing):** questo piano è anche il **prodotto-gancio** della campagna di rientro (agente Contesto & Tempismo, luglio→settembre) e il percorso dietro l'**app-allert di rientro** per gli ex clienti ("pesati ogni settimana → ti proponiamo una ripartenza").

---

## 3. Cosa serve allo Sviluppo (impatto [Sviluppo])

Implementabile riusando i mattoni esistenti, con poco di nuovo:

- **Segnale di contesto** sul profilo cliente: `travel_mode` con `stato` = `in_partenza` / `in_vacanza` / `rientrato` + **date**. Il cliente lo attiva con un toggle "Sto per partire / Sono rientrato" (o lo propone l'agente Contesto in base al periodo).
- **Aggancio all'agente dieta**: `in_vacanza` → stato **mantenimento** (nuovo o mappato su `normale` con deficit=0 e preferenza menu freddi/portabili); `rientrato` → stato **rientro** già esistente (spinta efficacia graduale, con la settimana 1 "reset").
- **Preferenza menu**: in vacanza, privilegia ricette **fredde/portabili** e aggiunge la nota "versione fuori casa/ristorante" per pasto.
- **Misure**: durante `in_vacanza`, **sospendi il popup bloccante** del 2° giorno; riattivalo al rientro (settimana 2).
- **Copy di Gaia**: due set di testi (partenza / rientro) + consiglio pre-partenza.
- **Template coach**: messaggio automatico "buona partenza" e "bentornato".
- **Aggancio marketing**: lo stato `rientrato` è un **evento** che il CRM/marketing riceve (per la campagna di rientro e l'app-allert).

Tutte le soglie (durata reset, giorni di spinta) in `config_param`, mai hardcodate.

---

## 4. Prossimi passi lato Prodotto

1. Confermare il **nome** del Piano 2.
2. Scrivere i **testi di Gaia** (partenza / rientro / consiglio valigia) e i **template coach**.
3. Selezionare dal catalogo estivo i **menu "da vacanza"** (freddi/portabili) e le **alternative ristorante**.
4. Disegnare le due **schermate** (toggle contesto + card "sei in Vacanze in Serenità / Ritorno in Equilibrio" in Home).
5. Passare la spec allo Sviluppo (questo documento) e allineare in `progetto/REGISTRO.md`.

## In una riga

Due modalità di luglio: **Vacanze in Serenità** (mantenimento, zero colpa, menu da spiaggia e bussola-ristorante) e **Ritorno in Equilibrio** (ripartenza dolce in due settimane) — entrambe costruite sui mattoni già esistenti del motore, con un solo segnale di contesto nuovo, e collegate alla campagna di rientro del marketing.
