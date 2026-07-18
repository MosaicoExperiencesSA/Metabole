# Registro modifiche — Logo MetaboleAI in email e report

**Data:** 18 luglio 2026 · Base: origin/main 70dc812 (asset `marketing/brand/` del socio, commit 62b7c2e).

## Summary
Il nuovo logo MetaboleAI compare ora in **tutte le email in uscita**, nei **PDF** (ricevuta e
Diario/report mensile) e nel **Diario in app**.

## Description
- **Asset**: `app/public/brand/logo.png` (300px, ottimizzato ~10 KB, dal
  `MetaboleAI_Logo_trasparente.png` del socio) — servito da Vercel su
  `https://app.metabole.eu/brand/logo.png`.
- **Email (mail.service.send)**: intestazione col logo aggiunta in cima a OGNI email in uscita
  (transazionali, cicli di vita, campagne) usando l'URL pubblico (i client di posta bloccano
  spesso le immagini incorporate). Anti-duplicazione: se l'HTML del template contiene già il
  logo non viene aggiunto due volte. Nessun template da toccare a mano.
- **PDF (pdf.service)**: nuovo segnaposto `{{logo}}` SEMPRE disponibile in tutti i template
  (data URI incorporato in `src/pdf/logo.ts`, ~7 KB: il rendering non dipende dalla rete).
  Template predefiniti "Ricevuta" e "Report mensile" aggiornati con `<img src="{{logo}}">`
  nell'intestazione; anche l'anteprima dell'editor lo mostra.
- **App (Report.tsx)**: logo in testa al Diario del percorso.

## Note
- **Dopo il deploy**: Grafica PDF → "Ricevuta di pagamento" e "Report mensile" → **Ripristina**
  (il seed non sovrascrive i template salvati). Chi ha personalizzato un template può anche
  solo aggiungere `<img src="{{logo}}" style="height:46px">` dov'è il vecchio brand testuale.
- Se il logo cambia: rigenerare `app/public/brand/logo.png` e `backend/src/pdf/logo.ts` dagli
  asset in `marketing/brand/`.

## Aggiunta — logo "ovunque" (richiesta Simone)
- **Backoffice**: simbolo nel riquadro in alto a sinistra della sidebar (al posto della foglia,
  wordmark "MetaboleAI") e logo completo nella pagina di accesso; favicon col simbolo.
- **App**: logo completo nella Landing (al posto del wordmark testuale) e favicon col simbolo.
- **Asset**: `brand/simbolo.png` (7 KB) e `brand/logo.png` (10 KB) in `public/` di app e
  backoffice, generati dagli originali in `marketing/brand/`.
