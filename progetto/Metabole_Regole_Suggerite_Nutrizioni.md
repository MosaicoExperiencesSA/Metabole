# Regole del motore — regole suggerite per tipo di nutrizione

Documento di riferimento per il **capo nutrizionista** e il socio. Le regole qui descritte
sono **già caricate** nel backoffice, in **Regole motore → Regole suggerite per nutrizione**
(col flag *Suggerita*): si possono modificare, aggiungere e applicare a una singola dieta.
I valori sono fondati sulla letteratura (LARN/EFSA/AMDR, StatPearls, ISSN, NHLBI, ADA…).

> Nota di lettura: le quote proteiche sono espresse come **frazione 0–1 delle kcal**
> (parametro `menu_daycombo_protein_min/max`); es. 0,20 = 20% delle kcal da proteine.
> Le tolleranze sono in **%**. I pesi *efficacia*/*gradimento* modulano la scelta ricette.

## I 5 stili esistenti

| Stile | Carbo % | Prot % | Grassi % | protein_min | protein_max | kcal_tol % | varietà | efficacia/gradimento | bigiornaliera |
|---|---|---|---|---|---|---|---|---|---|
| Mediterranea | 45–55 | 15–20 | 30–40 | 0,15 | 0,22 | 13 | alta | eff basso / grad alto | off |
| Proteica | 35–45 | 25–35 | 25–30 | 0,25 | 0,40 | 11 | bassa | eff alto / grad medio | on |
| Low carb | <26 | 25–35 | 35–50 | 0,25 | 0,35 | 13 | media | pari | off |
| Flessibile | 40–55 | 18–25 | 25–35 | 0,18 | 0,30 | 18 | alta | eff basso / grad alto | off |
| Keto (non terapeutica) | 5–10 (≤50 g) | 15–25 | 65–80 | 0,15 | 0,25 | 12 | bassa | eff medio-alto | on |

## Nuovi tipi di nutrizione suggeriti (compatibili col sistema)

Aggiunti come regole suggerite, applicabili a una dieta:

- **DASH (anti-ipertensiva)** — ~55/18/27, SFA ~6%, sodio ≤ 2300 mg. Regime onnivoro/vegetariano. Fonte: NHLBI.
- **Mediterranea ipocalorica** — profilo mediterraneo + deficit 15–25%, obiettivo dimagrimento. Fonte: PREDIMED-Plus.
- **Iperproteica sportiva / ricomposizione** — proteine 1,6–2,2 g/kg, per sportivi sani. Fonte: ISSN 2017.
- **Vegetariana (latto-ovo)** — regime vegetariano; presidiare proteine, ferro, B12. Fonte: Academy of Nutrition and Dietetics.
- **Vegana** — regime vegano; B12 da integrare (avviso). Fonte: AND 2016 / EFSA.
- **Pescetariana** — mediterranea + pesce ≥ 2–3/sett (richiede regime pescetariano). Fonte: EPIC-Oxford.
- **Flexitariana** — prevalentemente vegetale, carne rossa ≤ 1–2/sett. Fonte: EAT-Lancet 2019.
- **Basso indice glicemico** — carbo a basso IG, fibra alta (non diabete in terapia). Fonte: ADA 2024.
- **Digiuno intermittente (16:8)** — finestra di 8 ore, incide sulla distribuzione dei pasti. Fonte: meta-analisi TRE 2023.

### Esclusi (non adatti a piattaforma non-clinica)
Chetogenica terapeutica, VLCD < 800 kcal, Low-FODMAP (protocollo diagnostico a 3 fasi),
senza glutine a scopo terapeutico, diete di eliminazione mediche: richiedono diagnosi e
follow-up clinico.

## Regole cliniche che oggi il motore NON sa ancora esprimere (nuovi parametri da valutare)

Sono elencate nelle note di ogni preset e proponibili dalla pagina (sezione *Proposte*).
In ordine di priorità:

1. **Tetto carboidrati in grammi** (`carbs_max_g`) — indispensabile per Keto e Low carb.
2. **Banda grassi** (`fat_min`/`fat_max`) — oggi solo le proteine hanno una banda esplicita.
3. **Target proteine in g/kg peso** e **dose per-pasto** — per Proteica/sportiva (la % kcal da sola non garantisce i g/kg).
4. **Indice/carico glicemico** e **fibre minime (g)** — per Basso IG, Low carb, Mediterranea, DASH.
5. **Cap sodio (mg)** e **frequenze settimanali per categoria** (pesce, legumi, carne rossa) — per DASH, Mediterranea, Flexitariana, Pescetariana.
6. **Finestra oraria dei pasti** — per il digiuno intermittente/TRE.
7. **Nuovo regime "pescetariano"** e **tag qualità** sulle ricette (SFA, omega-3, whole-foods).

*Avvertenza: “low carb” e “Zona/anti-infiammatoria” hanno definizioni meno univoche in
letteratura; le soglie proteiche in g/kg (ISSN 1,6–2,0; fino a 2,3–3,1 g/kg di massa magra in
“cutting”) valgono per soggetti allenati in deficit, non come regola generale.*
