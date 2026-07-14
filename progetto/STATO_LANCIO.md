# Metabole — STATO LANCIO

Pagina unica, sempre aggiornata: **"cosa manca per aprire"**. Guarda qui.
Legenda: ✅ fatto · ⏳ in corso · ⬜ da fare · 🔴 gate (blocca il lancio pubblico).
Responsabili: **[Ops]** pannelli servizi · **[Sv]** Simone · **[Pr]** Antonio.
Ultimo aggiornamento: **2026-07-14**.

---

## 🟢 Semaforo
**Tecnicamente pronti.** Restano 3 gate 🔴 (base contatori, Stripe LIVE con pagamento vero, email/DNS) + smoke test. Contenuti completabili anche subito dopo.

## ✅ Già fatto (verificato live)
- Backend in produzione (`/health` ok) · **DB Neon prod seedato** (3 piani reali €297/€497/€797).
- Pagamenti configurati (`/payment-methods` carta+bonifico).
- **App cliente live** (app.metabole.eu) · **Sito live** (metabole.eu, 9 lingue, legali, form).
- Blocker di codice chiusi: endpoint lead, form collegati, scoping per-paziente.
- Utenze staff reali create (admin + Responsabile Coach + 12 coach, cambio password obbligatorio).
- Catalogo **Keto nel motore** (118 ricette + giornate, isolato) · E1 allergeni ricette (Simone).

## 🔴 Gate — prima di aprire al pubblico
| # | Cosa | Chi | Stato |
|---|---|---|---|
| 1 | **Base contatori** nel backend (`stats_reached_base=85218`, `stats_clients_base=18979`) + redeploy sito | [Sv]/[Ops] | ⬜ |
| 2 | **Stripe LIVE**: chiavi `sk_live` + webhook + **pagamento reale di prova** | [Ops] | ⬜ |
| 3 | **Email Brevo + DNS** (SPF/DKIM/DMARC): registrazione di prova → inbox non spam | [Ops] | ⬜ |
| 4 | **Smoke test end-to-end** (registrazione→email→onboarding→pagamento→menu→allergene→lead CRM) | [Pr]/[Sv] | ⬜ |

## 🟠 Consigliati prima dell'apertura (non strettamente bloccanti)
| Cosa | Chi | Stato |
|---|---|---|
| Backoffice raggiungibile e testato (coach/nutrizionista/admin) | [Ops]/[Sv] | ⬜ |
| Push FCM configurate **oppure** disattivate per il lancio | [Ops] | ⬜ |
| Pulizie: `app/.env.example`, rimuovere `schema_1.prisma`, build/test in pipeline | [Sv] | ⬜ |

## 🔵 Contenuti (Prodotto) — anche subito dopo il lancio
| Cosa | Stato |
|---|---|
| Team: nome/CV + **foto reali** responsabile scientifico e coach/nutrizionista | ⬜ |
| **Firma nutrizionista sulle grammature Keto** (catalogo già nel motore) | ⬜ |
| Revisione madrelingua traduzioni RU/ZH/AR (sito + legali) | ⬜ |
| Prime **testimonianze** con consenso (compaiono in automatico) | ⬜ |

## ⚪ Dopo il lancio (non bloccante)
- Motore **Fase B R8–R12**: E1 Agente Esclusioni ⏳ (allergeni fatti) → E2–E5.
- Template **email in Brevo** dai nostri testi (`marketing/email_automatiche/`) + trigger.
- Modulo Marketing/CRM + Giudice · Blog automatizzato · Publisher social.
- Prodotti dinamici zero-redeploy · piani stagionali · certificazione unicità · app dedicate coach/nutrizionista.

---
**Come si usa:** quando chiedi "cosa manca", si aggiorna questa pagina (spuntando ✅ e spostando le voci). Dettaglio operativo: `Metabole_Checklist_GoLive.md` · runbook: `Metabole_Runbook_GoLive.pdf` · contatori: `Metabole_Istruzioni_Contatori_Simone.pdf`.
