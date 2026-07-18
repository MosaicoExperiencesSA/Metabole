# Registro modifiche — Cambio email del cliente dall'admin

**Data:** 18 luglio 2026 · Base: origin/main 62b7c2e.

## Summary
L'admin non aveva NESSUN punto in interfaccia per cambiare l'email di un **cliente** (la pagina
Utenti mostra solo lo staff; la Modifica scheda non ha il campo email; il flusso self-service
richiede la conferma dal cliente). Ora nella **scheda cliente** c'è il bottone **"Cambia email"**
(solo admin). In più, se la nuova email appartiene a un account **archiviato**, il messaggio lo
dice chiaramente (prima un generico "già in uso" senza spiegazione — probabile causa del blocco
su levbeem2023@gmail.com se esiste come vecchio account di test archiviato).

## Description
- **ClientDetail.tsx**: bottone "Cambia email" accanto a Reset password (solo admin): chiede la
  nuova email e chiama il già esistente `PATCH /admin/users/:id` (che valida, revoca le sessioni
  attive e allinea l'eventuale casella di posta collegata).
- **users.service.update**:
  - conflitto email: se l'email è di un account **archiviato**, l'errore ora spiega cosa fare
    (Utenti → Archiviati → ripristina e cambiagli email, o elimina definitivamente);
  - al cambio email viene allineata anche l'**email della scheda CRM** del cliente (segmenti e
    campagne marketing usano quella: prima restava la vecchia).

## Note
- Nessuna migration. Audit già presente (`admin.user.update`) + revoca sessioni al cambio.
- Se il cambio su levbeem2024→2023 fallisce ancora dopo il deploy, il messaggio dirà il motivo
  esatto (quasi certamente un account archiviato che detiene la 2023).
