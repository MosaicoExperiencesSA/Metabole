# Registro modifiche — Analisi, Blocco 4 (pagamenti idempotenti)

**Data:** 21 luglio 2026 · Base: origin/main a837d55.

## Summary
L'approvazione di un pagamento (bonifico da operatore o webhook Stripe) non era **idempotente
in concorrenza**: due webhook Stripe ravvicinati (Stripe li **riconsegna** di default) o due
operatori che cliccano "approva" insieme potevano superare entrambi il controllo di stato e
generare **due volte** attivazione, entrate e **provvigioni** allo staff. Ora la transizione a
"approved" è un **claim atomico**: solo UNA chiamata la esegue, le altre si fermano.

## Description
`commerce.service.ts`
- **approvePayment (bonifico)** e **handleStripeEvent (carta)**: al posto di
  "leggi stato → se in attesa aggiorna", ora fanno un **`updateMany` condizionale**:
  `where { id, status IN ['pending','receipt_uploaded'] } → status='approved'`.
  - Se **`count === 1`**: questa chiamata ha "vinto" → prosegue con `finalizeApproval`
    (attivazione, income, provvigioni, ricevuta…).
  - Se **`count === 0`**: il pagamento è già stato approvato (webhook ripetuto / doppio clic)
    → **nessun doppio accredito**; il bonifico restituisce il pagamento già approvato
    (idempotente), il webhook risponde `{ idempotent: true }`.
- La catena `finalizeApproval` non dipende dallo stato precedente del pagamento: viene
  eseguita **una sola volta** grazie al claim, quindi provvigioni ed entrate non si duplicano.

## Perché è la soluzione giusta
Il vecchio schema "check-then-act" (`if status===approved return; else update`) ha una
**finestra di corsa** tra il check e l'update: due processi possono entrambi leggere
"non approvato" e procedere. L'`updateMany` con la condizione sullo stato è **atomico** a
livello di database (una sola riga può passare da pending→approved), quindi elimina la corsa.

## Note
- Nessuna migration. I pagamenti a carta nascono `pending` prima della sessione Stripe →
  il claim del webhook li intercetta correttamente.
- Questo mette in sicurezza il flusso **anche in vista di Stripe ricorrente** (i rinnovi
  genereranno nuovi pagamenti: la stessa logica evita doppioni).
- Miglioria futura possibile (difesa in profondità): chiave di idempotenza sul ledger
  provvigioni (`ref = payment.id`) — non necessaria ora che il claim impedisce il doppio run.
