# Registro modifiche — Deliverability email (allegato 3, parte codice)

**Data:** 20 luglio 2026 · Base: origin/main 17f7937.

## Summary
Implementata la **disiscrizione con-un-click** richiesta da Gmail/Yahoo/Microsoft per chi
invia email in volume (allegato 3, punto 1). Le email di massa (campagne) ora partono con
gli header **List-Unsubscribe** + **List-Unsubscribe-Post** e con un **footer di
disiscrizione** sempre presente. Le voci "config" dell'allegato (SPF/DKIM/DMARC su Brevo,
mittente di dominio) NON sono codice: restano da fare sul pannello Brevo + DNS.

## Description

Backend
- **mail.service.ts**: `send()` accetta `listUnsubscribeUrl`; se presente aggiunge al payload
  Brevo gli header `List-Unsubscribe: <url>` e `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
  (RFC 8058). Le transazionali normali (ricevute, verifica) restano invariate.
- **marketing.service.ts**:
  - `unsubscribeOneClickUrl(recordId)` → URL firmato al backend per la POST automatica di Gmail.
  - `oneClickUnsubscribe(token)` → opt-out immediato (riusa la logica completa: crmRecord +
    marketing_opt_out + notificationPrefs).
  - `ensureUnsubFooter(html, prefsUrl)` → aggiunge un piè di pagina con link "Gestisci
    preferenze / annulla iscrizione" se il corpo non ne ha già uno (Gmail vuole un modo
    VISIBILE di disiscriversi).
  - **Invio campagne**: ogni email ora passa `listUnsubscribeUrl` e ha il footer garantito.
- **prefs.controller.ts** — nuovo `UnsubscribeController` (`/public/marketing/unsubscribe`):
  - `POST` → disiscrizione one-click immediata (chiamata da Gmail/Yahoo, senza corpo).
  - `GET` → redirect alla pagina preferenze dell'app (così un link cliccato a mano porta a
    una scelta consapevole e i prefetch antispam non disiscrivono per errore).
- **marketing.module.ts**: registrato `UnsubscribeController`.

## Note
- Nuovo env opzionale **`PUBLIC_API_URL`** (URL pubblico del backend, default
  `https://metabole-backend.onrender.com`): serve a costruire l'URL one-click che Gmail
  chiama in POST. Verificare che sia impostato su Render se il dominio cambia.
- **Config lato Brevo/DNS (NON codice, da fare a mano — allegato 3 punto 1):** autenticare
  il dominio in Brevo (SPF, DKIM, DMARC tutti verdi), inviare da un indirizzo `@` del dominio
  (es. `news@metaboleai.com`), mai da Gmail. Questo è il fattore #1 della deliverability e va
  fatto sul pannello, non nel codice.
- Il footer usa la pagina preferenze già esistente (`/preferenze?t=…`): niente nuove pagine.
- Manca ancora la seconda metà dell'allegato 3 (punto 2 "Lista e consenso" e successivi):
  quando arriva completo, valuto se serve altro codice.

## Aggiunta — one-click anche sulle email del ciclo di vita (lifecycle)
Le email lifecycle (nurture, feedback, riattivazione: anch'esse marketing) ora hanno la
stessa disiscrizione con-un-click delle campagne:
- **lifecycle.service.ts**: `unsubUrlsFor(userId)` costruisce insieme il link preferenze e
  l'URL one-click (dallo stesso token CRM); `sendLifecycle` passa `listUnsubscribeUrl` quando
  la persona ha una scheda CRM. `prefsLinkFor` ora è un sottile wrapper di `unsubUrlsFor`.
Così tutte le email di massa/marketing (campagne + lifecycle) rispettano il requisito
Gmail/Yahoo/Microsoft, non solo le campagne.
