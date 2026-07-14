# Metabole — STATO LANCIO

Pagina unica, sempre aggiornata: **"cosa manca per aprire"**. Guarda qui.
Legenda: ✅ fatto · ⏳ in corso · ⬜ da fare · 🔴 gate (blocca il lancio pubblico).
Responsabili: **[Ops]** pannelli servizi · **[Sv]** Simone · **[Pr]** Antonio.
Ultimo aggiornamento: **2026-07-14 sera** (riallineamento: contatori LIVE, Stripe LIVE configurato, sito ripubblicato con restyling+galleria, motore R8–R12 completo).

---

## 🟢 Semaforo
**Tecnicamente pronti.** Resta 1 gate 🔴 vero: **pagamento reale di prova dentro lo smoke test**. Poi igiene pre-apertura e contenuti.

## ✅ Già fatto (verificato live)
- Backend in produzione (`/health` ok) · **DB Neon prod seedato** (3 piani reali €297/€497/€797).
- **Contatori con base storica LIVE**: `/public/stats` → `{clients:18983, reached:85232, methods:4, years:20}`.
- **Stripe LIVE configurato**: chiave `sk_live` + webhook `checkout.session.completed` in Render, redeploy ok (niente prodotti in Stripe: prezzi dal DB).
- **Sito live e allineato al repo** (metabole.eu: restyling a box, MetaboleAI®, galleria app, dicitura contatori, 9 lingue, legali, form).
- **App cliente live** (app.metabole.eu) · **Backoffice live** (backoffice.metabole.eu) · bundle → backend prod verificato.
- Pagine **`/payment/success` e `/payment/cancelled`** esistono e funzionano col redirect Stripe (login persiste; scelta data di inizio piano inclusa).
- **DNS email Brevo ok** (SPF · DKIM brevo1/2 · DMARC · brevo-code verificati).
- **Motore R8–R12 COMPLETO e live** (E1→E5 + rifiniture R12) · Catalogo **Keto nel motore** (118 ricette, isolato).
- Pagamenti configurati (`/payment-methods` carta+bonifico) · blocker di codice chiusi · utenze staff reali create.
- Pulizie: `app/.env.example` ✅ · `schema_1.prisma` rimosso ✅ · push FCM: si disattivano da sole senza chiave ✅.

## 🔴 Gate — prima di aprire al pubblico
| # | Cosa | Chi | Stato |
|---|---|---|---|
| 1 | **Pagamento reale di prova** (piano più economico, carta vera) → webhook 200 → abbonamento attivo; poi rimborso da Stripe + sistemazione abbonamento a mano | [Sv] | ⬜ |
| 2 | **Smoke test end-to-end** (registrazione→email **in inbox**→onboarding→pagamento (=n.1)→menu→allergene→lead CRM) | [Pr]/[Sv] | ⬜ |
| 3 | **Igiene pre-apertura**: lead di prova "Test GoLive Claude" via dal CRM · segreti Render (`ADMIN_*`, `AI_API_KEY` se serve) · **IBAN reale** in `bank_transfer_details` · conferma prezzi | [Sv]/[Ops] | ⬜ |

## 🟠 Consigliati prima dell'apertura (non strettamente bloccanti)
| Cosa | Chi | Stato |
|---|---|---|
| Backoffice testato con i ruoli reali (coach/nutrizionista/admin) | [Sv] | ⬜ |
| Rimuovere `_to_delete/schema_1.prisma` dal repo (entrata per errore col commit ba16168) | [Sv] | ⬜ |
| Build/test in pipeline (CI) | [Sv] | ⬜ |

## 🔵 Contenuti (Prodotto) — anche subito dopo il lancio
| Cosa | Stato |
|---|---|
| Team: nome/CV + **foto reali** responsabile scientifico e coach/nutrizionista | ⬜ |
| Revisione madrelingua traduzioni RU/ZH/AR (estratto pronto, manca il revisore) | ⬜ |
| Prime **testimonianze** con consenso (compaiono in automatico) | ⬜ |
| Grammature reali + **firma del nutrizionista sul Keto** · tagging 14 allergeni UE sui cataloghi | ⬜ |

## ⚪ Dopo il lancio (non bloccante)
- **Nuove richieste 14/7**: regola motore "ripetizione bigiornaliera" (nutrizionista) · **Liste CRM** manuali + import liste storiche (stato precedente + totale pagato). Design in `Lavori_Restanti_20260714.md` §2.
- Validazione socio sulle 2 rifiniture R12 · piani stagionali estate (travel_mode).
- Template **email in Brevo** dai nostri testi (48 pronte) + trigger.
- Modulo Marketing/CRM + Giudice · Blog automatizzato · Publisher social.
- Prodotti dinamici zero-redeploy · app dedicate Coach (prima) e Nutrizionista · schermi app rimasti (27–29, 33, porta un'amica) · APK Android.

---
**Come si usa:** quando chiedi "cosa manca", si aggiorna questa pagina (spuntando ✅ e spostando le voci). Dettaglio completo: `Lavori_Restanti_20260714.md` · operativo: `Metabole_Checklist_GoLive.md` · runbook: `Metabole_Runbook_GoLive.pdf`.
