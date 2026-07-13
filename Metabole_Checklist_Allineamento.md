# MetaboleAI — Checklist di allineamento web app ↔ prototipo

Da usare mentre si allinea la web app al prototipo (`docs/Metabole_Prototipo_Navigabile.html`).
Spunta ogni riga quando la schermata web è **identica** al prototipo (layout, testi verbatim, colori,
ordine, voce/scritto di Gaia). Riferimento completo: `Metabole_Direttiva_Replica_Prototipo.pdf`.

Legenda: ☐ da fare · ✅ allineata · ⚠️ da rivedere.

---

## A. Onboarding (34 schermate → Home)

| # | Schermata | Da verificare | Stato |
|---|---|---|---|
| 1 | Benvenuto (landing) | Logo MetaboleAI, card assistente Gaia (voce), Accedi/Registrati, prove sociali, 2 testimonianze | ☐ |
| 2 | In cosa siamo diversi | 5 punti, "Sono pronta/o" | ☐ |
| 3 | Crea il tuo account | Nome/Cognome/Email/Password/Codice invito, "oppure registrati con" | ☐ |
| 4 | Facciamo conoscenza | Le 5 aree (Mente/Vita/Agenda/Gusto/Corpo) | ☐ |
| 5 | **Intro sezione: La mente** | Schermo pieno colore `#6C4CD6`, voce sezione | ☐ |
| 6 | Perché vuoi iniziare adesso? | 4 opzioni | ☐ |
| 7 | Come vuoi essere seguita? | opzioni | ☐ |
| 8 | Quale caratteristica ti contraddistingue… | opzioni | ☐ |
| 9 | **Intro sezione: La vita** | Colore `#2F80ED` | ☐ |
| 10 | La tua vita e il lavoro | lavoro → tempo cottura → dove pranzi (a cascata) | ☐ |
| 11 | Che percorso preferisci? | 5 pasti / 3 pasti / integratori; digiuno "in arrivo" | ☐ |
| 12 | **Intro sezione: L'agenda** | Colore `#E8543C` | ☐ |
| 13 | Periodi senza dieta | opzioni | ☐ |
| 14 | **Intro sezione: Il gusto** | Colore `#E8A11B` | ☐ |
| 15 | Il tuo regime alimentare | Onnivoro/Vegetariano/Vegano | ☐ |
| 16 | Stile che preferisci | **Lista prodotti dinamica (API)**; voce generica; caratteristiche al tocco | ☐ |
| 17 | Cibi che non ami | campo testo | ☐ |
| 18 | **Intro sezione: Il corpo** | Colore `#12A386` (brand) | ☐ |
| 19 | Come vuoi essere chiamata? | Nome + **Età** + **Sesso (Uomo/Donna)** sempre visibili | ☐ |
| 20 | Il tuo punto di partenza | **Peso · Altezza · Vita · Fianchi** + "Vedi il video" | ☐ |
| 21 | Intolleranze o allergie | opzioni | ☐ |
| 22 | La tua salute | patologie/farmaci → nota nutrizionista | ☐ |
| 23 | Il tuo obiettivo | slider peso + tempo, vita/fianchi, guardrail sostenibilità | ☐ |
| 24 | Scegli il colore della tua app | Palette 6 colori + Auto | ☐ |
| 25 | **Trattamento dei dati personali** | GDPR + consenso; voce "Manca solo la tua approvazione…" | ☐ |
| 26 | Sto cucendo il tuo percorso | Gaia grande + countdown ~10s | ☐ |
| 27 | Il tuo percorso è pronto | badge check + team (Sara / dott.ssa Marini) | ☐ |
| 28 | La tua coach, Sara | video/presentazione coach | ☐ |
| 29 | Il tuo nutrizionista, dott.ssa Marini | presentazione nutrizionista | ☐ |
| 30 | Un assaggio del tuo menu | giorno tipo, ricetta/consiglio per pasto | ☐ |
| 31 | Scegli il tuo piano | **PAGAMENTO STRIPE REALE** (grafica del prototipo) | ☐ |
| 32 | Riepilogo | value stack + garanzia + obiezioni | ☐ |
| 33 | Quando vuoi iniziare? | scelta data avvio | ☐ |
| 34 | Tutto pronto, Giulia! | conferma + widget → Home | ☐ |

---

## B. Dashboard (app attiva)

| Area | Da verificare | Stato |
|---|---|---|
| **Header comune** | banda teal + "METABOLEAI" + titolo + icone (notifiche, da-completare, shop, profilo) | ☐ |
| **Nav bar (icone)** | Home · Percorso · Obiettivi · Contatti · Agenda (Shop in header); attiva in quadrato teal | ☐ |
| **Home** | IL MENU DI OGGI (carosello + Spesa), PROSSIMO APPUNTAMENTO, GAIA · LA FRASE DI OGGI, "In arrivo" | ☐ |
| **Percorso** | IL MENU DI OGGI + Diario (Menu passati / Eventi) | ☐ |
| **Menu** | giornata (5 pasti), Oggi/Domani, ricetta/consiglio, storico | ☐ |
| **Ricetta** | come si cucina (3 modi), valutazione a stelle | ☐ |
| **Obiettivi** | obiettivo attuale, misure di oggi, grafici andamento, barre | ☐ |
| **Contatti** | Gaia (AI, LIVE) · coach · nutrizionista, "Conversazioni passate", nota privacy | ☐ |
| **Agenda** | eventi (matrimonio…) con Prima/Il giorno/Dopo, scadenza piano | ☐ |
| **Shop** | piano attivo + rinnovo, "porta un'amica", integratori, acquisti | ☐ |
| **Profilo** | dati, scelta colore app (palette), email/telefono | ☐ |
| **Notifiche / Allert** | pagine header | ☐ |

---

## C. Popup e comportamenti

| Elemento | Da verificare | Stato |
|---|---|---|
| **Popup misure** | bloccante al 2° giorno del ciclo (erogazione ferma finché non aggiorni) | ☐ |
| **Check-in del mattino** | umore + acqua/passi, una volta al giorno | ☐ |
| **Voce di Gaia** | ogni schermata: audio (mp3) + testo con effetto typewriter, **frasi identiche** | ☐ |
| **Colori sezioni** | Mente/Vita/Agenda/Gusto/Corpo esatti (§ direttiva) + sfondi tenui | ☐ |
| **Tema app** | `--brand` cambia con la palette scelta; "Auto" ruota ogni 2 giorni | ☐ |

---

## Nota finale

Verifica **affiancando** prototipo e web (usa `Metabole_Confronto_App.html`). L'unica differenza
ammessa: i **dati reali** (nomi, misure, menu dal backend) e il **pagamento vero**. Tutto il resto deve
essere **indistinguibile** dal prototipo.
