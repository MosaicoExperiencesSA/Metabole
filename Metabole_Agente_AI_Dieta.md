# Metabole — Agente AI della dieta (politica di decisione)

Ogni dieta (es. mediterranea) ha un **agente AI dedicato** che ragiona **per singolo cliente** e
compone la proposta quotidiana. Questo documento definisce **cosa deve ragionare** l'agente: priorità,
regole, stati (umore, eventi), e quando **segnalare** a coach e nutrizionista. Si appoggia al motore
descritto in `Metabole_Motore_Personalizzazione.md`.

---

## 1. Ruolo

Un agente per dieta, un'istanza di ragionamento per cliente. **La consegna dei menu avviene ogni 2
giorni** (2 giornate insieme): l'agente **ragiona e propone a cicli di 2 giorni**, non giorno per
giorno. A ogni ciclo sceglie, tra i menu **approvati** e **filtrati** per quel cliente, i **menu del
ciclo** (colazione, pranzo, cena) — **gli stessi per entrambi i giorni, ma cucinati in modo diverso**
(2 ricette per menu, una per giorno) — bilanciando **obiettivo (perdere peso)**, **gradimento** (per non farlo mollare) e
**contesto** (umore, eventi), sempre dentro i **vincoli di sicurezza**. Le misure si aggiornano alla
fine del ciclo (2° giorno) e danno l'**esito** del ciclo. Se qualcosa non va, **avvisa coach e
nutrizionista**.

## 2. Gerarchia delle priorità (in quest'ordine)

1. **Sicurezza (vincoli assoluti).** Allergie, intolleranze, patologie/farmaci (dal nutrizionista):
   mai violare. Se non è possibile comporre un menu sicuro → **blocco + escalation** (vedi §6).
2. **Vincoli del cliente.** Cibi non graditi (evitare/sostituire), n° pasti, stagione.
3. **Obiettivo primario: perdere peso/cm.** Dopo sicurezza e vincoli, l'agente punta all'efficacia.
4. **Gradimento / aderenza.** Il piacere del cliente serve a farlo **restare nel percorso**.
5. **Contesto.** Umore ed eventi modulano temporaneamente la scelta (senza perdere l'obiettivo).

> Regola d'oro: l'agente non sacrifica mai la sicurezza per l'obiettivo, né l'obiettivo di lungo
> periodo per il piacere di un giorno. Il piacere è uno strumento di aderenza, non il fine.

## 3. Politica quotidiana (scoring)

Per ogni menu candidato del cliente l'agente calcola un punteggio:

`score = w_eff · Efficacia(menu) + w_grad · Gradimento(menu) − penalità`

- **Efficacia(menu)** = quanto quel menu (per questo cliente) è associato a perdita di peso/cm
  (dal learning: `MenuWeight`). All'inizio è neutra e cresce con i dati.
- **Gradimento(menu)** = **stella più alta** tra le sue ricette per il cliente (default 5★).
- **penalità** = ripetizione recente (varietà), stagione non ottimale, ecc.
- I pesi `w_eff` / `w_grad` cambiano con lo **stato** (sotto).

L'agente sceglie **un menu per pasto** valido per il ciclo (stesso nei 2 giorni) e per ognuno **2
ricette diverse** (giorno 1 e giorno 2): la preparazione migliore per prima (stelle più alte / che ha
fatto perdere peso), un'altra per il secondo giorno, così la base resta la stessa ma cambia il modo di
cucinarla.

## 4. Stati e modulatori

| Stato | Trigger | Cosa fa l'agente |
|---|---|---|
| **Normale** | default | Massimizza `Efficacia × Gradimento`: propone menu efficaci ma graditi. |
| **Conforto** | umore basso/triste (check-in) | Il **ciclo corrente** (2 giorni, stessi menu) è composto coi menu **più amati** (max gradimento) per risollevare l'umore, anche se meno "dimagranti". |
| **Rientro** | subito dopo un Conforto | Il **ciclo successivo** è composto coi menu **più efficaci** per rimettere il cliente in linea con l'obiettivo. |
| **Pre-evento** | evento in agenda in cui il cliente non vuole fare dieta (entro K giorni) | Propone menu **più proteici** (più pesce/carni bianche/legumi, meno carbo) per arrivare più leggero e proteggere i risultati. |
| **Post-evento** | dopo l'evento | **Rientro morbido**: giorni leggeri e proteici, riprende l'obiettivo. |
| **Plateau** | nessun calo per N cicli, o peso in aumento | Sposta i pesi verso l'**efficacia**, riduce le concessioni e **segnala** (vedi §6). |

**Guardrail sui giorni di Conforto:** limitati (es. non consecutivi, max X a settimana). Se il cliente
"chiede conforto" troppo spesso o l'umore resta basso → non si moltiplicano i giorni comfort: si
**segnala alla coach** (tema motivazionale) — l'obiettivo non si perde di vista.

## 5. Comportamenti richiesti (mappati)

- **"Proporre il menu che fa perdere peso"** → stato Normale/Rientro/Plateau: massimizza Efficacia.
- **"Cibo che più aggrada per risollevare l'umore, poi quello dimagrante"** → stato Conforto (ciclo
  corrente, max Gradimento) → Rientro (ciclo successivo, max Efficacia). La cadenza è a 2 giorni.
- **"Menu più proteici prima di un evento in cui non vuole fare dieta"** → stato Pre-evento (agenda).
- **"Considerare piacere/intolleranze/allergie ma con l'obiettivo di far perdere peso, e segnalare se
  non va"** → gerarchia §2 (sicurezza→vincoli→obiettivo→gradimento) + segnalazioni §6.

## 6. Segnalazioni (quando e a chi)

L'agente apre un **Alert/Escalation** quando i fattori del cliente ostacolano l'obiettivo:

| Situazione | A chi | Tipo |
|---|---|---|
| Menu non componibile in sicurezza (allergia non sostituibile) | Coach **+** Nutrizionista | `diet_blocked` (app bloccata, presa in carico) |
| Nessun calo per N cicli / peso in aumento (plateau) | Nutrizionista (protocollo) + Coach (aderenza) | `no_progress` |
| Aderenza bassa (molti "non seguito") | Coach | `low_adherence` |
| Umore basso persistente / troppi giorni conforto | Coach | `mood_risk` |
| Tema clinico emerso (patologia/farmaco/valore) | **Solo** Nutrizionista | `clinical` |

Principio: **problemi di aderenza/motivazione → coach; problemi clinici/di efficacia del piano →
nutrizionista**; il blocco di sicurezza → entrambi.

## 7. Input / Output dell'agente

**Input (per cliente):** dieta filtrata (menu sicuri), esclusioni, obiettivo (peso/cm + data),
misure e trend, `RecipeRating` (gradimento), `MenuWeight` (efficacia appresa), umore (check-in),
eventi (agenda), n° pasti, stagione corrente.

**Output (per ciclo):** la **giornata** proposta (colazione+pranzo+cena + snack) con le **ricette**
scelte; lo **stato** attivo (Normale/Conforto/…); eventuali **Alert** a coach/nutrizionista.

## 8. Note di implementazione

- L'agente è **per dieta**: ragiona solo sul catalogo di quel regime (qui, mediterranea). Stessa
  struttura per gli altri regimi.
- Usa il **learning** del motore (attribuzione all'intera giornata all'inizio, poi isola il singolo
  pasto) per stimare l'Efficacia dei menu.
- Tutte le soglie (N cicli, K giorni pre-evento, max giorni conforto, pesi `w_eff`/`w_grad`) stanno in
  `config_param` (mai hardcoded), così sono regolabili dal nutrizionista/capo.
- Le kcal restano **interne** (bilanciamento), mai esposte al cliente.

## 9. In una riga

Un agente per dieta che, entro i vincoli di **sicurezza** e i **gusti** del cliente, punta a
**fargli perdere peso**, usa il **piacere** per tenerlo nel percorso (conforto → rientro), si
**adatta agli eventi** (pre-evento più proteico) e **avvisa coach e nutrizionista** appena le cose non
vanno come dovrebbero.
