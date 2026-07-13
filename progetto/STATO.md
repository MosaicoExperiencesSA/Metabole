# STATO — progetto Metabole

Aggiornato: **2026-07-13** · a cura di **[Prodotto]**.

> Nota di riconciliazione: la cartella `progetto/` non era ancora nel repo, quindi il team Prodotto
> l'ha creata con una prima versione di questi file. Se il team Sviluppo ha già un `STATO.md` con il
> **piano a 10 fasi**, teniamo quello come riferimento e uniamo qui gli stati per area. Il piano a
> fasi qui sotto è una **proposta Prodotto** da confermare/allineare.

---

## Stato per area

| Area | Stato | Note |
|---|---|---|
| **Prototipi (cliente/coach/nutrizionista)** | ✅ Completi (versione premium) | Pubblicabili via `docs/`. Onboarding + app attiva + coach + nutrizionista |
| **Voci di Gaia** | ✅ Generate | In `audio/`. Rigenerare solo le mancanti (mai FORCE su tutte) |
| **Motore & Agente dieta** | 🟩 Specificato | Catalogo (165 menu, 723 ricette), giornate bilanciate, certificazione a 3 meccanismi. Da implementare lato Sviluppo |
| **Backend** | 🟨 In corso | Milestone 1-3 completate (Auth/RBAC, Onboarding/Profilo, Segnali/Misure). Prosegue su motore/commerce |
| **Deploy** | 🟩 Pronto da eseguire | `render.yaml` + `Metabole_Guida_Pubblicazione` (demo + produzione: Neon/Render/Vercel/Brevo/Stripe) |
| **Marketing & CRM** | 🟩 Definito | Reparto + Responsabile, 8 agenti, standard lead/pipeline, calendario 12 mesi. Da integrare nel deploy (vedi `INTEGRAZIONE_MARKETING.md`) |
| **CRM (sistema)** | 🟨 In costruzione lato socio | Costruito dall'AII del team Sviluppo; allineamento tramite lo **standard** in `Metabole_Reparto_Marketing_e_Standard_CRM.md` (Parte C) |

Legenda: ✅ fatto · 🟩 pronto/definito, da eseguire · 🟨 in corso · ⬜ da iniziare.

---

## Piano a fasi (proposta Prodotto — da riconciliare)

1. **Fondamenta backend** — auth, RBAC, utenti, audit. ✅
2. **Onboarding & profilo** — questionario, screening sanitario, team, obiettivo. ✅
3. **Segnali** — misure, check-in, progressi, traguardi. ✅
4. **Motore menu** — catalogo, giornate bilanciate, dieta per cliente, blocco/escalation. 🟨
5. **Agente AI dieta** — politica su cicli di 2 giorni, apprendimento, certificazione. ⬜
6. **Commerce & pagamenti** — piani, Stripe, webhook. 🟨
7. **Deploy produzione** — Neon + Render + Vercel + Brevo + domini. 🟩
8. **CRM & standard lead** — pipeline, campi, consensi, eventi. 🟨 (lato socio)
9. **Reparto & agenti Marketing** — ruolo `head_marketing`, macchina a 8 agenti, automazioni. 🟩 (da integrare)
10. **App mobile (APK)** — Capacitor/Android. ⬜ (non blocca il lancio web)

---

## Prossime azioni

**[Prodotto]**
- Consegnare al socio `INTEGRAZIONE_MARKETING.md` (fatto oggi).
- Preparare la libreria creativa di partenza (messaggi-pilastro, hook conformi, template formati).

**[Sviluppo]** (impatti dal marketing)
- Aggiungere ruolo RBAC `head_marketing` (+ `marketing`) e sezione backoffice, senza accesso ai dati sanitari.
- Esporre gli eventi già emessi (`track`, refcod, pagamento, alert) verso CRM/marketing.
- Compilare la **CRM Interface Spec** (Parte C del doc Reparto/CRM) per allineare i due sistemi.
