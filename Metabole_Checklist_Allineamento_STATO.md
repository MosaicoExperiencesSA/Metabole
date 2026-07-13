# Metabole — Stato allineamento web app ↔ prototipo (replica 1:1)

Aggiornato dal team Sviluppo. Legenda: ✅ allineato · 🟡 parziale · ⬜ da fare (con motivo).
Fonte di verità: `docs/Metabole_Prototipo_Navigabile.html` (Direttiva Replica 1:1). Pagamento = Stripe reale.

## Onboarding (funnel nuovo cliente)

| # | Schermata | Stato | Note |
|---|---|---|---|
| 1 | Benvenuto (Landing) | ✅ | MetaboleAI, card Gaia, Accedi/Registrati, prove sociali |
| 2 | In cosa siamo diversi | ✅ | 5 punti |
| 3 | Crea il tuo account | ✅ | minimale; Apple/Google "in arrivo" |
| 4 | Facciamo conoscenza | ✅ | 5 aree, bolla Gaia |
| 5 | [intro] La mente | ✅ | colore #6C4CD6, sfondo tenue |
| 6 | Perché vuoi iniziare adesso? | ✅ | 4 opzioni esatte; salvata in lifestyle.motivation |
| 7 | Come vuoi essere seguita? | ✅ | testo Gaia verbatim |
| 8 | Quale caratteristica…impegno? | ✅ | titolo + testo verbatim |
| 9 | [intro] La vita | ✅ | colore #2F80ED |
| 10 | La tua vita e il lavoro | ✅ | verbatim |
| 11 | Che percorso preferisci? | ✅ | verbatim |
| 12 | [intro] L'agenda | ✅ | colore #E8543C |
| 13 | Periodi senza dieta | ✅ | verbatim |
| 14 | [intro] Il gusto | ✅ | colore #E8A11B |
| 15 | Il tuo regime alimentare | ✅ | verbatim |
| 16 | **Stile che preferisci** | ⬜ | **prodotti dinamici (Keto + API): filone `Product` da fare** |
| 17 | Cibi che non ami | ✅ | verbatim |
| 18 | [intro] Il corpo | ✅ | colore #12A386 |
| 19 | Come vuoi essere chiamata? | ✅ | Nome + Età + Altezza + Sesso |
| 20 | Il tuo punto di partenza | ✅ | Peso/Vita/Fianchi; verbatim |
| 21 | Intolleranze o allergie | ✅ | verbatim |
| 22 | La tua salute | ✅ | verbatim |
| 23 | Il tuo obiettivo | ✅ | verbatim + guardrail sostenibilità |
| 24 | Scegli il colore della tua app | ✅ | palette 6 colori della direttiva |
| 25 | Trattamento dati personali (GDPR) | ✅ | bolla Gaia + "Accetta e procedi" |
| 26 | Sto cucendo il tuo percorso | ✅ | transizione ~3,2s durante il calcolo |
| 27 | Il tuo percorso è pronto | ✅ | bolla Gaia verbatim + coach/nutrizionista reali |
| 28 | La tua coach, Sara (video) | ⬜ | **serve il video** |
| 29 | Il tuo nutrizionista (video) | ⬜ | **serve il video** |
| 30 | Un assaggio del tuo menu | 🟡 | il menu reale è disponibile dopo l'avvio del piano; da valutare anteprima |
| 31 | Scegli il tuo piano | ✅ | **pagamento Stripe reale** (checkout) |
| 32 | Riepilogo | ✅ | checkout |
| 33 | Quando vuoi iniziare? | ✅ | scelta data (StartDatePrompt) |
| 34 | Tutto pronto! → Home | 🟡 | conferma post-pagamento presente; widget "tutto pronto" da rifinire |

## Dashboard (post-onboarding)

| Schermata | Stato | Note |
|---|---|---|
| Header comune (teal, METABOLEAI + titolo + 4 icone) | ✅ | su tutte le schermate |
| Tab bar Home·Percorso·Obiettivi·Contatti·Agenda (+Shop header) | ✅ | attiva rialzata in quadrato teal |
| Home (Menu di oggi · Prossimo appuntamento · Frase di Gaia) | ✅ | dati reali |
| Percorso (Menu di oggi + Diario: passati/eventi) | ✅ | dati reali |
| Obiettivi (obiettivo, misure, andamento, progressi) | ✅ | dati reali |
| Contatti (Gaia · coach · nutrizionista, LIVE) | ✅ | nomi reali |
| Agenda (appuntamenti + Prenota + Il tuo piano) | ✅ | + giorni no-diet |
| Shop (piano attivo, offerte, integratori, acquisti) | ✅ | carrello + checkout reali |
| Profilo | ✅ | dati, colore app, notifiche, piano, acquisti |
| Notifiche (campanella) | ✅ | collegata al server (GET /me/notifications) |

## Restano (per priorità)
1. **Prodotti dinamici** (schermo 16 + wizard backoffice + agente per prodotto): filone `Product`/`Menu(product_id)`/`ProductRule` — spec `Metabole_Spec_Prodotti_Dinamici_Sviluppo.md`. Sblocca "Keto" e il modello data-driven.
2. **Video coach/nutrizionista** (28–29): servono i file video.
3. **Anteprima menu (30) e widget "tutto pronto" (34)**: rifiniture.
4. **Push notifiche**: attende il progetto Firebase (guida `Metabole_Notifiche_Push_Setup.md`).
