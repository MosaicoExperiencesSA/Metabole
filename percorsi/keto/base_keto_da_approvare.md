# Percorso KETO — Base da validare e approvare (Regola 5)

Questa è la **base del percorso Keto** — **solo Keto**, isolata dagli altri percorsi (regola ferrea: i menu non si mischiano mai tra prodotti diversi).
Il **nutrizionista** controlla i menu **divisi per colazione, pranzo, cena, spuntini e merende** e li **approva**. Una volta approvata, questa base diventa il **pool ufficiale per ogni cliente che sceglie la dieta Keto**.

**Stato:** 🟢 **APPROVATA dal nutrizionista** — base ufficiale del percorso Keto. (Da qui partono le basi personali dei clienti: vedi `personalizzazione_cliente.md`.) Nessun deploy.

---

## Cosa contiene la base (documenti)
1. `raccolta_menu_web.md` — materia prima (5 fonti, ~31 giornate).
2. `catalogo_pasti.md` — **118 piatti** deduplicati e **divisi per pasto**.
3. `catalogo_pasti_calorie.md` — gli stessi piatti **con le calorie** (senza grammature: le fissa il nutrizionista).
4. `regola4_sostituzioni.md` — **23 gruppi di equivalenza**, ~32 varianti generate e una "Settimana B".

## Divisione per pasto (da approvare)
| Categoria | Piatti base | Varianti (sost.) | Da approvare |
|---|---|---|---|
| Colazioni | 28 | +7 | ☐ |
| Pranzi | 32 | +8 | ☐ |
| Cene | 31 | +11 | ☐ |
| Spuntini | 21 | +3 | ☐ |
| Merende | 6 | +2 | ☐ |
| **Totale** | **118** | **+31** | |

---

## Cosa deve verificare il nutrizionista (per categoria)
- **Conformità keto**: rapporto grassi/proteine/carboidrati corretto; carboidrati sotto soglia; nessun alimento vietato.
- **Grammature/porzioni**: definire le quantità per ogni piatto (qui ci sono solo le kcal del piatto tipo).
- **Sostituzioni sicure**: confermare i gruppi di equivalenza (es. pesci grassi salmone↔aringa↔sgombro) e i sostituti per allergie/intolleranze.
- **Sicurezza clinica**: allergeni, controindicazioni; casi da escludere (es. patologie renali/epatiche, gravidanza/allattamento — la keto non è indicata).
- **Etichette/tag**: veg/vegano dove applicabile, senza glutine/lattosio, evidenza allergeni.

## Esito approvazione (sign-off)
| Categoria | Esito | Note del nutrizionista | Approvato da | Data |
|---|---|---|---|---|
| Colazioni | ☐ Approvato ☐ Da correggere | | | |
| Pranzi | ☐ Approvato ☐ Da correggere | | | |
| Cene | ☐ Approvato ☐ Da correggere | | | |
| Spuntini | ☐ Approvato ☐ Da correggere | | | |
| Merende | ☐ Approvato ☐ Da correggere | | | |
| **BASE KETO (intera)** | ☐ **APPROVATA** | | Dott. ______________ | __/__/____ |

---

## Dopo l'approvazione (come diventa operativa)
- La base approvata diventa il **pool menu del prodotto "Keto"** (isolato: `product_id` / `Diet` keto). **Non si mischia** con Mediterranea, Proteica, Low-carb o altri percorsi.
- Per **ogni cliente keto**, l'app/motore compone le giornate **pescando solo da questo pool approvato**, applicando sopra:
  - **esclusioni** personali (allergie/intolleranze/non graditi) → sostituzione con lo stesso metodo (gruppi di equivalenza) o blocco+escalation al nutrizionista;
  - **stato/eventi** (agente dieta) e **gradimento** (learning).
- Ogni modifica futura alla base passa di nuovo dal nutrizionista (versione + firma).

## Metodo riusabile (per i prossimi percorsi)
Lo stesso metodo (raccolta → catalogo per pasto → calorie → sostituzioni → **approvazione nutrizionista**) si ripeterà **identico** per gli altri percorsi (**Proteica, Low-carb, Mediterranea già validata, gravidanza, menopausa, sportivo, pre-matrimonio…**), ognuno con la **propria base separata**.

→ **impatto [Sviluppo]:** al prodotto Keto va agganciato questo pool come catalogo isolato; il motore compone i giorni del cliente keto solo da qui, con sostituzioni/esclusioni personali; versioning della base con approvazione.
