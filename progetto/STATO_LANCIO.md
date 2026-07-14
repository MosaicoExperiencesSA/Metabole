# Metabole — STATO LANCIO

Pagina unica, sempre aggiornata: **"cosa manca per aprire"**. Guarda qui.
Legenda: ✅ fatto · ⏳ in corso · ⬜ da fare · 🔴 gate (blocca il lancio pubblico).
Responsabili: **[Ops]** pannelli servizi · **[Sv]** Simone · **[Pr]** Antonio.
Ultimo aggiornamento: **2026-07-14** (Stripe LIVE + pulizie fatte da Simone; **contatori OK live** 18.984/85.233; restano email/DNS, pagamento reale, redeploy sito, smoke test).

---

## 🟢 Semaforo
**Tecnicamente pronti.** Restano 3 azioni operative + smoke test: email/DNS, pagamento reale di prova, redeploy sito. Contenuti completabili anche subito dopo.

## ✅ Già fatto
- Backend in produzione · **DB Neon prod seedato** (3 piani reali) · pagamenti configurati (**Stripe LIVE** impostato da Simone).
- **App cliente live** (app.metabole.eu) · **Sito live** (metabole.eu, 9 lingue, legali, form).
- **Contatori con base storica OK live** (`/public/stats` → 18.984 / 85.233).
- Blocker di codice chiusi · utenze staff reali · **motore R8–R12 (E1–E5) completo**.
- Pulizie repo (`app/.env.example`, via `schema_1.prisma`) · catalogo **Keto nel motore**.

## 🔴 Gate — prima di aprire al pubblico
| # | Cosa | Chi | Stato |
|---|---|---|---|
| 1 | **Pagamento reale di prova** (Stripe è in LIVE): un acquisto vero end-to-end | [Ops]/[Pr] | ⬜ |
| 2 | **Email Brevo + DNS** (SPF/DKIM/DMARC): registrazione di prova → inbox non spam | [Ops] | ⬜ |
| 3 | **Redeploy sito** su SiteGround con le ultime modifiche (box uniformi, ®, **4 schermate reali dell'app**) | [Sv]/[Ops] | ⬜ |
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
| Revisione madrelingua traduzioni RU/ZH/AR (sito + legali) | ⬜ |
| Prime **testimonianze** con consenso (compaiono in automatico) | ⬜ |

## ⚪ Dopo il lancio (non bloccante)
- Motore **Fase B R8–R12**: E1 Agente Esclusioni ⏳ (allergeni fatti) → E2–E5.
- Template **email in Brevo** dai nostri testi (`marketing/email_automatiche/`) + trigger.
- Modulo Marketing/CRM + Giudice · Blog automatizzato · Publisher social.
- Prodotti dinamici zero-redeploy · piani stagionali · certificazione unicità · app dedicate coach/nutrizionista.

---
**Come si usa:** quando chiedi "cosa manca", si aggiorna questa pagina (spuntando ✅ e spostando le voci). Dettaglio operativo: `Metabole_Checklist_GoLive.md` · runbook: `Metabole_Runbook_GoLive.pdf` · contatori: `Metabole_Istruzioni_Contatori_Simone.pdf`.
