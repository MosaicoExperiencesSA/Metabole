> # ⛔ DOCUMENTO CHIUSO — 12 agosto 2026
>
> **Non usare questo file per decidere cosa fare.** Il punto della situazione, verificato sul ramo
> pubblicato, è in **[`PUNTO_DELLA_SITUAZIONE.md`](PUNTO_DELLA_SITUAZIONE.md)**.
>
> I tre gate del lancio sono chiusi da luglio. Le quattro voci di contenuto che nessuno stava più tenendo — foto e CV del team, revisione madrelingua RU/ZH/AR, prime testimonianze, modelli email — sono nel §8.3 del nuovo documento.
>
> Resta qui perché è una fotografia di quel giorno e il `REGISTRO.md` ci si appoggia. Quello che valeva
> per il futuro — le regole ferree, le trappole, i controlli già fatti — è stato travasato nel nuovo
> documento: da qui non serve ripescare niente.

---

# Metabole — STATO LANCIO

Pagina unica, sempre aggiornata: **"cosa manca per aprire"**. Guarda qui.
Legenda: ✅ fatto · ⏳ in corso · ⬜ da fare · 🔴 gate (blocca il lancio pubblico).
Responsabili: **[Ops]** pannelli servizi · **[Sv]** Simone · **[Pr]** Antonio.
Ultimo aggiornamento: **2026-08-07** (abbonamenti ricorrenti Stripe: codice, app e configurazione Stripe fatti; restano prezzi e provvigioni da compilare in Negozio). Voce precedente: 2026-07-16 (smoke test end-to-end **fatto**; rifiniture sito: percorsi "gestiti"+carosello, galleria app 5 schermate auto-scroll, orbita Gaia allineata + bagliore centro; audio Gaia v02; 19 stendardi equipaggio).

---

## 🟢 Semaforo
**VIA LIBERA: tutti i gate chiusi (16/07).** Pagamento reale testato, smoke test end-to-end fatto, igiene pre-apertura completata. **Si può aprire al pubblico.** Restano solo voci di contenuto (non bloccanti): foto/CV team, testimonianze, revisione madrelingua RU/ZH/AR, grammature + firma nutrizionista sul Keto + tagging allergeni.

## ✅ Già fatto (verificato live)
- Backend in produzione (`/health` ok) · **DB Neon prod seedato** (3 piani reali €297/€497/€797).
- **Contatori con base storica LIVE**: `/public/stats` → `{clients:18983, reached:85232, methods:4, years:20}`.
- **Stripe LIVE configurato**: chiave `sk_live` in Render (niente prodotti in Stripe: prezzi dal DB).
  Webhook a **5 eventi** dal 7/8 — `checkout.session.completed`, `invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated` — e
  **portale clienti** configurato (serve a «Aggiorna la carta»: prima non esisteva).
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
| 1 | **Pagamento reale di prova** (piano più economico, carta vera) → webhook 200 → abbonamento attivo; poi rimborso da Stripe + sistemazione abbonamento a mano | [Sv] | ✅ testato e confermato 14/07 |
| 2 | **Smoke test end-to-end** (registrazione→email **in inbox**→onboarding→pagamento (=n.1)→menu→allergene→lead CRM) | [Pr]/[Sv] | ✅ fatto 16/07 |
| 3 | **Igiene pre-apertura**: lead di prova via dal CRM · segreti Render (`ADMIN_*`, `AI_API_KEY` se serve) · **IBAN reale** in `bank_transfer_details` · conferma prezzi | [Sv]/[Ops] | ✅ fatto 16/07 |

## 🟠 Consigliati prima dell'apertura (non strettamente bloccanti)
| Cosa | Chi | Stato |
|---|---|---|
| Backoffice testato con i ruoli reali (coach/nutrizionista/admin) | [Sv] | ⬜ |
| Rimuovere `_to_delete/schema_1.prisma` dal repo | [Sv] | ✅ verificato 7/8: non è più tracciato da git (la riga era rimasta ⬜ per errore, due righe sopra era già segnato fatto) |
| Build/test in pipeline (CI) | [Sv] | ✅ dal 6/8: `.github/workflows/ci.yml` compila backend+backoffice+app e lancia i test, **senza `continue-on-error`** — un rosso blocca davvero |

## 🟡 Abbonamenti ricorrenti — cosa manca per venderne uno (7/8)
Il codice c'è ed è testato, la configurazione Stripe è fatta. Quello che resta è **dati**, e si
compila dal backoffice — nessuno dei due si accorge da solo di essere sbagliato.

| Cosa | Chi | Stato |
|---|---|---|
| Codice backend + app + backoffice (checkout, disdetta, carta, rinnovi) | [Sv] | ✅ 7/8 |
| Stripe: 5 eventi sulla webhook + portale clienti | [Sv] | ✅ 7/8 |
| **Prezzi e provvigioni** di «Mantenimento Metabole» (€49) e «Monitoraggio Metabole» (€19) in Negozio | [Sv] | ✅ 7/8 — Mantenimento era già a posto (Coach 25 · Coord. 10 · Mgr 10, nessun nutrizionista); Monitoraggio compilato al **25% totale** proporzionale (Coach 14 · Coord. 19 · Mgr 25 cumulativi) |
| Verifica con `npm run diag:ricorrente` sulla shell di Render | [Sv] | ⬜ dice cosa manca e non tocca niente — ora dovrebbe uscire pulito |
| Primo addebito ricorrente vero (carta vera, poi rimborso) | [Sv] | ⬜ è l'equivalente del gate n.1, ma per l'abbonamento |

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
