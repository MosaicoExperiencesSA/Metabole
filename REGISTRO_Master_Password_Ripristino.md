# Registro modifiche — Ripristino MASTER_PASSWORD (versione protetta)

**Data:** 21 luglio 2026 · Base: origin/main 0935f23.

## Summary
Su richiesta di Simone, la **master password di servizio** (env `MASTER_PASSWORD`) è stata
**ripristinata**: serve a entrare in un account senza conoscerne la password (assistenza e test,
es. accedere come coach/cliente). Rispetto a com'era prima (rimossa nel Blocco 6), ora ha **una
protezione in più**: **non funziona sugli account admin**. Così, anche se la password trapelasse,
i profili più potenti restano al sicuro, e l'uso per i test (coach/clienti/staff non-admin) resta
identico.

## Description
`auth.service.ts` (`validateAndLogin`)
- Reintrodotti l'helper `constantTimeEquals` (confronto a tempo costante via sha256),
  la costante `MASTER_PASSWORD_MIN_LENGTH = 8` e l'import `timingSafeEqual`.
- Il login accetta la `MASTER_PASSWORD` come alternativa alla verifica argon2 **solo se**:
  `user.role !== 'admin'` **e** la variabile è impostata (≥ 8 caratteri) **e** il confronto a
  tempo costante è positivo. → `isMasterLogin`.
- L'audit del login usa `auth.master_login` quando l'accesso avviene con la master password
  (altrimenti `auth.login`).

`.env.example`
- Documentata la variabile `MASTER_PASSWORD` (prima era usata ma non documentata): scopo, minimo
  8 caratteri, non apre gli admin, uso tracciato, tenerla solo nel pannello Render.

## Perché così
La master password è comoda per assistenza e test, ma la sua unica vera pericolosità era che
apriva **anche gli admin**. Escludere il ruolo `admin` elimina quel rischio senza togliere nulla
all'uso pratico (per testare come coach/cliente non serve entrare in un admin). Restano attive le
protezioni già presenti: confronto a tempo costante, minimo di lunghezza, login rate-limited,
tracciamento `auth.master_login`.

## Note operative
- **Su Render** deve esistere la variabile `MASTER_PASSWORD` con un valore (≥ 8 caratteri). Se era
  stata rimossa dopo il Blocco 6, va **re-inserita**. Dopo il deploy funziona per tutti gli account
  **tranne** gli admin.
- Per gli admin si entra con la propria password; per vedere il backoffice come un altro utente
  resta anche l'**impersonazione** (scoped, con banner e audit).
- Nessuna migration. Verifica: transpile backend OK; NUL check OK; i test di login esistenti non
  sono impattati (senza `MASTER_PASSWORD` impostata il percorso è quello normale).
