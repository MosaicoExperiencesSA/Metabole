# MetaboleAI — Piani d'estate (luglio): Vacanze in Serenità & Ritorno in Equilibrio

Due protocolli stagionali per il mese di luglio, quando metà del pubblico **parte** in vacanza e metà
**rientra**. Sono **due prodotti a sé**, ciascuno con il **proprio catalogo di menu** (da fornire), che
il motore e l'agente AI attivano in base al contesto del cliente. Documento **prodotto**, pronto da
condividere con lo Sviluppo per l'implementazione.

- **Piano 1 — Vacanze in Serenità**: per chi parte. Obiettivo = **mantenimento senza fame e senza sensi di colpa**.
- **Piano 2 — Ritorno in Equilibrio** *(nome proposto)*: per chi rientra. Obiettivo = **ripartire con dolcezza** verso il proprio traguardo.

> Nome del Piano 2: propongo **"Ritorno in Equilibrio"** (richiama il pilastro *equilibrio* e fa da
> coppia a "Vacanze in Serenità"). Alternative se preferisci: *Ripartenza Serena*, *Reset Dolce*,
> *Rientro Leggero*. Scegli tu e lo fisso ovunque.

---

## 0. REGOLA FONDAMENTALE — isolamento dei menu per prodotto (BLOCCO)

> **Ogni prodotto/protocollo ha il PROPRIO catalogo di menu, separato e indipendente.**
> Non si mischiano **mai** menu di diete o prodotti diversi, **nemmeno per riferimento**. Se due
> prodotti devono proporre gli stessi piatti, i menu si **duplicano** (copie proprie del prodotto),
> **non** si condividono. I menu li fornisce il **nutrizionista** (o Antonio): l'AI **non li inventa**
> e **non li prende in prestito** da un altro prodotto (es. dalla dieta Mediterranea).

Questa regola vale per la dieta Mediterranea, per i due protocolli estate e per **ogni** prodotto
futuro. Vantaggio: tracciabilità, responsabilità clinica chiara (ogni menu è validato nel suo
prodotto) e nessuna contaminazione tra diete.

## 0bis. Cosa sono i due protocolli (e cosa manca)

Vacanze in Serenità e Ritorno in Equilibrio sono **due protocolli a sé**, ciascuno con il **proprio
catalogo di menu**. In questo documento è definita la **logica** (mantenimento / ripartenza) e
l'**esperienza** cliente; i **menu sono in attesa**: oggi per questi due protocolli **non esiste alcun
menu** e il catalogo della Mediterranea **non va usato** come loro fonte.

**Stato menu dei due protocolli:** ⬜ da fornire dal **nutrizionista / Antonio**. L'AI non li prepara.

## 0bis. Come si incastrano con ciò che esiste già

Entrambi i protocolli **riusano i meccanismi** già presenti nel motore (non i menu, che sono propri di
ciascun prodotto — vedi §0):

- **Agente AI dieta** con i suoi stati (`normale`, `conforto`, `plateau`, `pre_evento`, `post_evento`, `rientro`): i due protocolli usano gli **stati** (mantenimento / rientro), applicati **al proprio catalogo**.
- **Etichette caldo/freddo** come attributo dei menu: in vacanza si privilegiano i piatti **freddi/portabili** — scelti però dentro il **catalogo del protocollo Vacanze**, non altrove.
- **Segnali** già tracciati: acqua, passi, check-in umore, misure (con il popup bloccante al 2° giorno).
- **Agente Contesto & Tempismo**: è luglio → propone questi due protocolli al pubblico giusto.

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

Implementabile riusando i **meccanismi** esistenti, con poco di nuovo:

- **Isolamento menu (hard constraint, §0)**: nel modello dati ogni catalogo di menu è legato al **prodotto/protocollo** (`product_id`); **nessun** riferimento o join tra cataloghi di prodotti diversi. I due protocolli estate hanno **cataloghi propri** (vuoti finché il nutrizionista non li popola). Se serve un piatto identico ad un altro prodotto, si **duplica** la riga, non si condivide.
- **Segnale di contesto** sul profilo cliente: `travel_mode` con `stato` = `in_partenza` / `in_vacanza` / `rientrato` + **date**. Il cliente lo attiva con un toggle "Sto per partire / Sono rientrato" (o lo propone l'agente Contesto in base al periodo).
- **Aggancio all'agente dieta**: `in_vacanza` → stato **mantenimento** applicato al **catalogo del protocollo Vacanze**; `rientrato` → stato **rientro** applicato al **catalogo del protocollo Ritorno** (spinta efficacia graduale, settimana 1 "reset").
- **Preferenza menu**: in vacanza, privilegia ricette **fredde/portabili** (attributo del menu) **dentro il catalogo del protocollo**, con la nota "versione fuori casa/ristorante" per pasto.
- **Misure**: durante `in_vacanza`, **sospendi il popup bloccante** del 2° giorno; riattivalo al rientro (settimana 2).
- **Copy di Gaia**: due set di testi (partenza / rientro) + consiglio pre-partenza.
- **Template coach**: messaggio automatico "buona partenza" e "bentornato".
- **Aggancio marketing**: lo stato `rientrato` è un **evento** che il CRM/marketing riceve (per la campagna di rientro e l'app-allert).

Tutte le soglie (durata reset, giorni di spinta) in `config_param`, mai hardcodate.

---

## 4. Prossimi passi lato Prodotto

1. Confermare il **nome** del Piano 2.
2. **Attendere i menu** dei due protocolli dal **nutrizionista / Antonio** (l'AI non li prepara). Ogni protocollo avrà il **proprio** catalogo, isolato (§0).
3. Scrivere i **testi di Gaia** (partenza / rientro / consiglio valigia) e i **template coach**.
4. Disegnare le due **schermate** (toggle contesto + card "sei in Vacanze in Serenità / Ritorno in Equilibrio" in Home).
5. Passare la spec allo Sviluppo (questo documento) e allineare in `progetto/REGISTRO.md`.

## In una riga

Due protocolli di luglio: **Vacanze in Serenità** (mantenimento, zero colpa) e **Ritorno in Equilibrio** (ripartenza dolce) — **ciascuno con i propri menu** (forniti dal nutrizionista, mai mischiati tra prodotti), che riusano i **meccanismi** del motore (stati agente, segnali) e si collegano alla campagna di rientro del marketing.
