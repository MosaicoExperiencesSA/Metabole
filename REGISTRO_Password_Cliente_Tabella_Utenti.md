# Registro modifiche — Imposta password cliente + tabella Utenti impaginata

**Data:** 21 luglio 2026 · Base: origin/main 47fa5bf.

## Summary
Tre cose: (1) l'admin — e i ruoli abilitati dai **Permessi** — possono **impostare una
password scelta** per una cliente dalla scheda (da comunicarle); (2) nuovo flag permesso
**"Imposta password cliente"** nella matrice; (3) la tabella **Utenti** ora è scorrevole con
**intestazione bloccata**, come la tabella Permessi.

## Description

### Imposta password cliente (+ permesso)
Backend
- **permissions/pages.ts**: nuovo permesso `set_client_password` (default: solo admin;
  gli altri ruoli li abilita Simone dalla matrice).
- **auth.service.ts** `adminSetClientPassword(userId, newPassword, actorId)`: hash argon2,
  aggiorna la password, `mustChangePassword=false`, **revoca le sessioni attive** (la cliente
  rientra con la nuova password), audit `auth.admin_set_password`. Solo account **cliente**.
- **clients.service.ts** `setClientPassword`: verifica accesso alla scheda, minimo 8 caratteri,
  richiama auth.
- **clients.controller.ts**: `POST /admin/clients/:id/set-password`
  (`@RequirePage('set_client_password','manage')`), DTO `{ password: 8-200 }`.

Backoffice
- **ClientDetail.tsx**: pulsante **"Imposta password"** (visibile con il permesso) → chiede la
  password e la imposta; messaggio "comunicala alla cliente". Il "Reset password" via email
  resta com'era (solo admin).
- **labels.ts**: etichetta "Imposta password cliente" per la riga nei Permessi.

### Tabella Utenti impaginata come Permessi
- **Users.tsx**: il contenitore è ora scorrevole (`overflow:auto`, `maxHeight`) e
  l'**intestazione resta bloccata** in alto durante lo scorrimento (th `sticky top`), come nella
  matrice Permessi. Ordinamento per colonna già presente, invariato.

## Note
- Nessuna migration: al deploy il seed permessi crea la riga `set_client_password` coi default
  (i permessi già personalizzati non vengono toccati).
- Sicurezza: l'operazione è solo per account cliente (mai staff/admin); ogni uso è in audit;
  impostare la password chiude le sessioni attive della cliente.
- Il campo password usa per ora un prompt del backoffice (web): adeguato e admin-only; in un
  secondo momento si può sostituire con un modale dedicato (vedi analisi, punto UX prompt→modali).
