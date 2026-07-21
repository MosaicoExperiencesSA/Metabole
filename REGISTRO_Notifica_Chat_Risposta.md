# Registro modifiche — Notifica push quando la coach/nutrizionista risponde in chat

**Data:** 21 luglio 2026 · Base: origin/main dcb7a59.

## Summary
Quando la **coach** o la **nutrizionista** rispondono in chat, la cliente riceve una
notifica (in-app **e push** sul telefono). Il meccanismo esisteva già ma era limitato a
"una volta al giorno": ora scatta a **ogni risposta**, con una finestra **anti-raffica di
3 minuti** (più messaggi ravvicinati = una sola notifica), e con un titolo che distingue
coach e nutrizionista.

## Description
- **notifications.service.ts**: `NotifyInput` ha un nuovo campo opzionale `dedupeWindowMs`.
  `notifyOncePerDay` ora, se `dedupeWindowMs` è impostato, deduplica su una **finestra
  mobile** di N ms invece che "una volta al giorno" (comportamento di default invariato per
  tutte le altre notifiche). Vengono rispettati come prima l'opt-out per tipo della cliente,
  l'email opzionale e l'invio push.
- **chat.service.ts (`postMessage`)**: la risposta staff→cliente ora chiama la notifica con
  `dedupeWindowMs: 3 min`, titolo "La tua coach/nutrizionista ti ha risposto", body generico
  "Apri la chat per leggere il messaggio" e `payload { kind:'chat_reply', threadId, counterpart }`
  per l'apertura diretta della chat. Prima usava il messaggio composto giornaliero.

## Note / dipendenze
- **Il push arriva sul telefono solo se FCM è configurato** (env `FIREBASE_SERVICE_ACCOUNT`
  su Render) e se l'app è la build nativa con le push attive e la cliente ha dato il permesso
  notifiche. Senza FCM, la notifica resta comunque **in-app** (campanella) — nessun errore.
  Questo aggancia il punto backlog "#4 notifiche push" (setup nativo, lato Simone).
- **Privacy**: il testo del messaggio NON compare nell'anteprima push (potrebbe contenere
  dati sanitari, es. chat con la nutrizionista) — si mostra solo "apri la chat".
- L'opt-out notifiche della cliente è rispettato (tipo `chat_reply_coach` /
  `chat_reply_nutritionist`).
- Nessuna migration.
