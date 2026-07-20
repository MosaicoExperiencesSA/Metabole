# Registro modifiche — Feedback collaudo, blocco 3

**Data:** 20 luglio 2026 · Base: origin/main 0565ce1.

## Summary
App COACH resa operativa sulle clienti e sui lead: dalla scheda cliente la coach può
ora **modificare i dati base, aggiungere note e correggere le misure** (col permesso);
i **lead sono cliccabili** e si aprono su una scheda con stato pipeline modificabile e
note. È il sottoinsieme essenziale concordato; il resto (acquisti, permessi, ecc.) resta
sul backoffice.

## Description

### Scheda CLIENTE nell'app coach (prima era in sola lettura)
- **Modifica scheda**: pulsante "Modifica" in cima → pannello con nome, telefono,
  intolleranze e cibi non graditi (virgola-separati) → `PATCH /admin/clients/:id` (lo
  stesso endpoint del backoffice, già aperto ai ruoli coach).
- **Note dello staff**: sezione con elenco note e aggiunta rapida
  (`POST /admin/clients/:id/note`); le stesse note della scheda backoffice.
- **Correzione misure**: pulsante "Correggi" su ogni riga dello storico misure
  (`PATCH /admin/clients/:id/measurements/:id`). È protetto dal permesso "Correggi
  misure": se la coach non ce l'ha, il backend risponde con un messaggio chiaro.
- Restano com'erano: andamento peso, ultimo check-in, bonifici da completare (upload
  contabile per conto della cliente), WhatsApp e "Vai in chat".

### Scheda LEAD nell'app coach (prima i lead non erano cliccabili)
- Nella lista "Le tue clienti", toccando un **lead** si apre la nuova
  **`/lead/:id`** (`CoachLeadDetail`).
- Mostra contatto (WhatsApp/email), **stato pipeline modificabile** (menu a tendina
  dagli stati reali, `POST /crm/leads/:id/stage`) e **note** (elenco + aggiunta,
  `POST /crm/leads/:id/notes`). Tutti endpoint già aperti ai ruoli coach/coordinatrice.

## Note
- Nessuna migration, nessun nuovo endpoint backend: la scheda coach riusa gli endpoint
  già esistenti e già autorizzati per i ruoli coach/coach_coordinator.
- La visibilità resta quella di sempre: la coach vede e modifica SOLO le proprie clienti
  e i propri lead (scope applicato lato server); la coordinatrice quelli del suo team.
- La correzione misure dipende dal permesso "Correggi misure" nella matrice Permessi:
  abilitalo ai ruoli coach che vuoi (di default è già su nutrizionisti/admin).
- Restano per i prossimi giri: prodotti Summer Holiday/Return nei consigliati (con
  ricerca sui bilanciamenti), lavori dell'allegato 3 (da riallegare, non è arrivato).
