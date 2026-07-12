# Analisi tecnica del motore MetaboleAI — personalizzazione e unicità della dieta

Analisi formale del motore descritto in `Metabole_Motore_Personalizzazione.md` e
`Metabole_Agente_AI_Dieta.md`, con l'obiettivo di rispondere: **possiamo certificare che la dieta è
personalizzata e che non esistono due diete uguali?**

Risposta sintetica: **sì, con una distinzione**. "Personalizzata" (l'output dipende dai dati della
persona) è certificabile **per costruzione e per audit**. "Unica" (nessuna coppia di clienti riceve lo
stesso piano) è **quasi-certa in pratica** per ragioni entropiche e diventa **garantita per
costruzione** aggiungendo due meccanismi (seed per-cliente + garanzia di varietà). Sono proprietà
distinte: una dieta *diversa* non è automaticamente *personalizzata*.

---

## 1. Che tipo di sistema è (classificazione)

Il motore non è un semplice "generatore di menu casuali": è un **sistema di raccomandazione
personalizzato, vincolato, multi-obiettivo, stateful e con apprendimento online**. In termini formali:

- **Vincolato**: un filtro rigido (allergie/intolleranze/patologie) definisce l'insieme ammissibile; se
  vuoto → blocco + escalation.
- **Multi-obiettivo**: massimizza *efficacia* (perdita peso/cm) e *gradimento*, con pesi variabili.
- **Stateful**: una macchina a stati (Normale/Conforto/Rientro/Pre-evento/Plateau) modula la scelta in
  base a umore, eventi, andamento.
- **Online-learning (tipo contextual bandit)**: stima l'efficacia dei menu per quel cliente
  (`MenuWeight`) da un segnale ritardato (esito peso/cm a fine ciclo di 2 giorni) e sfrutta/esplora.

## 2. Modello formale

Sia per il cliente `c` lo **stato** al ciclo `t`:
`S_c(t) = ⟨ E_c, O_c, R_c(t), W_c(t), M_c(t), A_c(t), season(t), meals_c ⟩`
dove
- `E_c` = esclusioni (allergie, intolleranze, cibi non graditi) — insieme;
- `O_c` = obiettivo (peso/cm target, ritmo) + misure/trend correnti — vettore continuo;
- `R_c(t)` = valutazioni per ricetta (il menu eredita `max` stelle) — cronologia;
- `W_c(t)` = efficacia appresa per menu (path-dependent) — vettore continuo;
- `M_c(t)` = cronologia umore; `A_c(t)` = eventi in agenda; più stagione e n° pasti.

La **decisione** è una funzione `π`:
`Piano_c(t) = π( S_c(t), Config, seed_c )`
che produce le **2 giornate del ciclo** (stessi menu, 2 ricette diverse per giorno). `Config` sono le
soglie/pesi (in `config_param`); `seed_c` è un eventuale seme per-cliente (vedi §6).

Il **loop**: l'esito del ciclo (Δpeso, Δcm, seguito?) aggiorna `W_c` e `R_c` → cambia lo stato → cambia
la decisione successiva. È un sistema **path-dependent**: due traiettorie divergono appena un input
diverge.

## 3. Le dimensioni della personalizzazione (dove nasce la differenza)

Ogni dieta è determinata da un **vettore personale ad alta dimensione**:
1. **Catalogo filtrato** dalle esclusioni: due insiemi di esclusioni diversi → cataloghi ammissibili
   diversi (differenza già a monte, prima di ogni scelta).
2. **Obiettivo e misure**: valori **continui** (peso, vita, fianchi, ritmo) → praticamente mai identici
   tra due persone.
3. **Gradimento**: sequenza di valutazioni per ricetta, che evolve nel tempo.
4. **Efficacia appresa** (`MenuWeight`): dipende dagli esiti misurati del singolo cliente → **unica per
   cronologia**.
5. **Contesto temporale**: sequenza di umori e di eventi in agenda, con i loro **timestamp**.
6. Stagione e n° pasti.

La dieta completa = **traiettoria di cicli** = funzione di tutto questo. Poiché contiene componenti
continue e temporizzate, il vettore è di fatto un'impronta individuale.

## 4. Analisi di unicità (combinatoria + probabilità + path-dependence)

**Combinatoria (ordine di grandezza, dieta mediterranea).** Per stagione: ~5 colazioni, ~14 pranzi,
~14 cene ammissibili; le **giornate bilanciate** valide (col+pranzo+cena entro tolleranza) sono ~30.
Ogni menu ha 3–5 ricette; un ciclo di 2 giorni sceglie **2 ricette ordinate** per menu (fino a
5·4 = 20 combinazioni) su 3 pasti → ~20³ ≈ 8·10³ varianti di cottura per ogni giornata-base. Quindi le
**varianti di un singolo ciclo** per stagione sono dell'ordine di `30 · 8·10³ ≈ 2·10⁵`.

Su un percorso di 18 settimane ≈ **63 cicli**, il numero di traiettorie possibili (anche con forti
vincoli di non-ripetizione) supera qualunque scala pratica: `~ (10⁵)^{decine}` → **>> 10²⁰⁰**.

**Probabilità di collisione.** Con una popolazione di clienti dell'ordine di `10⁴–10⁵`, il limite del
compleanno `≈ n²/(2N)` con `N > 10²⁰⁰` dà una probabilità di due traiettorie identiche **≈ 0**
(nell'ordine di 10⁻¹⁹⁰). In pratica: impossibile per caso.

**Path-dependence.** Non è però "caso": due clienti divergono **deterministicamente** appena differisce
un input (una valutazione, un esito, un umore, un timestamp). Poiché `O_c`, `W_c`, `R_c`, `M_c`
contengono valori continui/temporizzati, la coincidenza totale richiederebbe due persone con **la stessa
identica cronologia** — evento nullo nella pratica.

**Stima entropica.** Le sole esclusioni (sottoinsiemi di ~50 alimenti) più l'obiettivo continuo, la
cronologia valutazioni e gli esiti misurati superano ampiamente le **128 bit** di informazione: soglia
oltre la quale le collisioni sono considerate crittograficamente trascurabili.

## 5. Cosa possiamo certificare (e cosa no)

**Certificabile per costruzione/audit:**
- **P1 — Dipendenza dall'individuo (personalizzazione).** L'output cambia se cambia un qualsiasi input
  personale (proprietà di *sensitività*). Dimostrabile con test: perturba un input → l'output cambia.
- **P2 — Non-degenerazione.** Clienti con esclusioni/preferenze diverse ottengono insiemi ammissibili e
  scelte diverse (non è una funzione costante).
- **P3 — Tracciabilità/spiegabilità.** Ogni ciclo è funzione pura `π(S_c, Config, seed_c)`: si può
  ricostruire **perché** ogni menu è stato scelto (audit log) → dieta "personalizzata *e motivata*".

**Certificabile solo statisticamente (senza meccanismi aggiuntivi):**
- **P4 — Unicità.** "Nessuna coppia identica" è quasi-certa (≈ 1 − 10⁻¹⁹⁰) ma **non** una garanzia
  assoluta: due clienti con **questionario identico**, stessa stagione e nessun feedback ancora
  raccolto (cold start) potrebbero ricevere lo **stesso primo ciclo** sotto un tie-break deterministico.

## 6. Come rendere l'unicità *garantita* (non solo probabile)

Tre accorgimenti ingegneristici trasformano P4 da "quasi-certa" a **garantita per costruzione**:

1. **Seed per-cliente**: `seed_c = H(client_id)`. Il tie-break (a parità di punteggio) usa `seed_c`.
   Così anche due profili identici al cold start ricevono selezioni diverse **da subito**. La funzione
   resta **deterministica e riproducibile** (dato il seed) → compatibile con l'audit.
2. **Garanzia di varietà**: penalità di ripetizione + un termine di **esplorazione** (ε-greedy /
   novelty) per evitare che il motore converga verso un piccolo insieme di menu "vincenti" (rischio di
   *exploitation* che ridurrebbe l'unicità nel tempo).
3. **Monitor di collisione**: hash del piano per ciclo/percorso; un job verifica che non esistano due
   piani identici tra clienti e allerta in caso (in pratica non dovrebbe mai scattare).

Con (1)+(2)+(3) si può enunciare una **garanzia deterministica**: *per ogni coppia c1≠c2, i piani
differiscono*.

## 7. Rischi e limiti (onestà tecnica)

- **Cold start**: senza il seed (§6.1), profili identici → primo ciclo identico. Il seed lo risolve.
- **Vincoli pesanti**: un cliente con molte esclusioni ha un insieme ammissibile piccolo → meno varietà
  e maggior rischio di somiglianza con un altro molto vincolato. Mitigazione: soglia minima di varietà
  → sotto soglia, **blocco + escalation** al nutrizionista (già previsto).
- **Convergenza per apprendimento**: l'ottimizzazione dell'efficacia può far convergere clienti diversi
  verso menu "migliori" comuni → serve l'esplorazione (§6.2) per preservare l'unicità.
- **Natura del claim**: è una proprietà **algoritmica** (personalizzazione/unicità del piano), **non**
  un claim clinico. Posizionamento benessere/stile di vita, non dispositivo medico. Le kcal restano
  interne; l'efficacia dietetica è validata dal nutrizionista, non "certificata" dal software.
- **Determinismo vs privacy**: log completo delle decisioni per l'audit → deve rispettare GDPR
  (minimizzazione, cifratura dei dati sanitari, accesso per ruolo).

## 8. Protocollo di certificazione proposto

Per poter **dichiarare** la personalizzazione in modo difendibile:
1. **Funzione pura + seed**: `Piano = π(S_c, Config, seed_c)`; nessuno stato nascosto non loggato.
2. **Audit trail**: per ogni ciclo salvare input, `Config`, `seed_c`, punteggi, menu/ricette scelti,
   stato attivo, esito → riproducibilità e spiegazione per-cliente.
3. **Test-suite (property-based):**
   - *Sensitività (P1)*: perturbo un input personale → l'output deve cambiare.
   - *Non-degenerazione (P2)*: esclusioni diverse ⇒ insiemi ammissibili diversi.
   - *Unicità (P4)*: su una popolazione sintetica (es. 10⁵ profili), verifica **zero collisioni** di
     piano; e test cold-start su profili identici che devono divergere grazie al seed.
   - *Varietà intra-cliente*: nessun ciclo identico ripetuto entro N cicli.
4. **Monitor in produzione**: tasso di collisione (atteso 0), copertura del catalogo, deriva verso
   l'exploitation.

## 9. Verdetto

- **La dieta è personalizzata?** Sì, in senso forte e certificabile: ogni piano è **funzione dei dati
  dell'individuo**, tracciabile e spiegabile (P1–P3).
- **Non esistono due diete uguali?** In pratica **no** (probabilità di collisione ≈ 10⁻¹⁹⁰). Se serve
  una **garanzia formale** ("nessuna coppia identica, per costruzione"), basta aggiungere **seed
  per-cliente + esplorazione + monitor di collisione** (§6): a quel punto l'unicità è dimostrabile, non
  solo probabile.

In una riga: **con seed per-cliente, garanzia di varietà e audit trail, possiamo certificare sia la
personalizzazione (il piano dipende dalla persona) sia l'unicità (nessun piano identico tra clienti) —
come proprietà algoritmiche verificabili, non come claim medico.**
