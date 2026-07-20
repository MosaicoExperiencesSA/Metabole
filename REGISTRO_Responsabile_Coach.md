# Registro modifiche — Responsabile Coach (ruolo `sales`): dashboard coach + ref code

**Data:** 20 luglio 2026 · Base: origin/main 08310d7.

## Summary
Nel sistema il ruolo **`sales` è etichettato "Responsabile Coach"**. Finora nel backoffice
vedeva la Dashboard generica e non aveva un ref code. Ora la Responsabile Coach ha la
**stessa home delle coach** (clienti, alert, piani in scadenza, **link d'invito/ref code**)
e un **proprio ref code** che si genera da sé al primo accesso o dall'admin in Utenti.

## Description

Backend
- **coach.service.ts (`scopeIds`)**: per `sales` la portata clienti è **tutte le coach**
  (coach + coordinatrici) — è la responsabile del reparto. Coach e coordinatrice restano
  come prima. Così la home coach del Responsabile è popolata (clienti/scadenze del reparto);
  gli alert li vede già tutti (è nei MANAGER_ROLES).
- **lead-assignment.service.ts**: `myInvite` e `generateRefCode` accettano anche `sales`
  → il Responsabile ha un suo ref code (auto-generato al primo `my-invite`, o impostato
  dall'admin). NON toccata l'assegnazione lead (i lead si assegnano alle coach, non al
  Responsabile): quei controlli restano coach/coordinatrice.
- **lead-assignment.controller.ts**: `GET /crm/my-invite` aperto anche a `sales`.
- Nessun cambio all'accesso dati del Responsabile (che già "vede tutti" i clienti): la
  modifica riguarda solo la vista home e il ref code.

Backoffice
- **Home.tsx**: la famiglia coach (coach, coordinatrice, **Responsabile Coach/sales**) vede
  la **CoachHome**; prima `sales` cadeva sulla Dashboard generica.
- **Users.tsx**: il pulsante "Genera/Rigenera ref code" compare anche per `sales`.

## Note
- Distinzione ruoli: `coach_coordinator` = "Coordinatrice Coach" (già sistemata prima);
  `sales` = "Responsabile Coach" (questa modifica). Sono due ruoli diversi.
- Nessuna migration. Il ref code del Responsabile si crea da sé aprendo la home
  (sezione "Il mio link d'invito") oppure dall'admin in Utenti.
- L'app mobile già dava a `sales` l'esperienza coach (COACH_ROLES lo include): ora anche il
  backoffice è coerente.
