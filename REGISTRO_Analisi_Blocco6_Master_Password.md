# Registro modifiche — Analisi, Blocco 6 (rimozione MASTER_PASSWORD)

**Data:** 21 luglio 2026 · Base: origin/main 8a5ea21.

## Summary
Esisteva una **master password di servizio** (env `MASTER_PASSWORD`): se impostata, una
**singola password** permetteva il login in **qualsiasi** account — **admin compreso** — con
un minimo di soli 8 caratteri, e non era documentata. Il confronto era a tempo costante,
loggato (`auth.master_login`) e il login è rate-limited, quindi il brute-force da rete era
impraticabile; il rischio vero era la **potenza** (entra ovunque, anche negli admin) unita alla
**segretezza** ("in testa a una persona"). È stata **rimossa completamente**.

## Description
`auth.service.ts`
- Eliminato il blocco che, in `validateAndLogin`, accettava la `MASTER_PASSWORD` come
  alternativa alla verifica argon2. Ora il login riesce **solo** con la password del singolo
  utente: `const ok = await argon2.verify(user.passwordHash, password)...`.
- Rimossi l'helper `constantTimeEquals`, la costante `MASTER_PASSWORD_MIN_LENGTH` e l'import
  `timingSafeEqual` (non più usati).
- L'audit del login usa sempre `auth.login` (non c'è più il ramo `auth.master_login`).

## Perché è la soluzione giusta
Per accedere a un altro profilo a scopo di assistenza esiste già l'**impersonazione**
(`impersonate`), che è la soluzione corretta perché è **scoped** (limitata nel tempo, TTL),
**non tocca gli account admin** e ha un **audit dedicato**. La master password era un
duplicato molto più pericoloso della stessa esigenza: rimuoverla elimina la superficie di
rischio senza togliere alcuna funzionalità operativa.

## Note
- Nessuna migration. Nessun impatto sui login legittimi (ognuno usa la propria password).
- Se su Render era impostata la variabile `MASTER_PASSWORD`, ora è **inerte**: può essere
  rimossa dall'ambiente (non è più letta dal codice). Nessuna azione obbligatoria.
- L'impersonazione resta il canale ufficiale per l'accesso di assistenza a un profilo cliente.
