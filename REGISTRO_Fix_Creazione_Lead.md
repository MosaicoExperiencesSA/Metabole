# Registro modifiche — Creazione lead: assegnazione al creatore + anti-doppione telefono

**Data:** 22 luglio 2026 · Base: origin/main 38d9f39. (Richieste #5 e #6 del file "fix e richieste 1".)

## Summary
Due fix sulla **creazione manuale di una scheda lead** dal CRM, segnalati da Rosaria:
1. **#5** — Una lead creata da una **coach** ora viene **assegnata a lei** (prima restava non
   assegnata e la coach non la ritrovava tra le sue).
2. **#6** — La creazione ora **blocca i numeri di telefono già presenti** (prima il controllo
   anti-duplicato valeva solo per l'auto-iscrizione della cliente; se la lead la creava lo staff,
   un numero già esistente passava lo stesso).

## Description
`crm.service.ts` → `create(byUserId, input)`:
- **Anti-doppione telefono**: se è indicato un telefono (≥ 6 cifre), si confrontano le **sole
  cifre** con quelle dei lead esistenti, con match anche a **suffisso** (così "+39 351…" e
  "351…" contano come lo stesso numero). Se c'è già → errore che invita a cercarlo in Gestione
  lead invece di duplicarlo. Stessa logica di sicurezza dell'auto-registrazione.
- **Assegnazione al creatore**: se chi crea la lead è una **coach**, la scheda nasce
  `assignedCoachId = sua staff.id`, `assignmentStatus = 'accepted'`, `assignedAt = ora`. Un
  manager (sales/coordinatrice/admin) non se la auto-assegna: la lead resta nel pool, oppure può
  passare esplicitamente una coach via `assignedCoachId` (pronto per una futura select in
  creazione). L'assegnazione viene tracciata nell'audit.

## Perché così
- Il telefono duplicato: riusare lo stesso confronto a cifre + suffisso dell'auth allinea il
  comportamento tra "iscrizione della cliente" e "creazione da staff" — un solo criterio di
  unicità del numero.
- L'assegnazione automatica solo per la **coach** evita di attribuire erroneamente lead ai
  manager (che gestiscono il pool): la coach che crea un contatto lo vuole tra i suoi; il manager
  di solito lo smista.

## Note
- Nessuna migration.
- **Performance**: il controllo telefono confronta le cifre in memoria (come fa già la
  registrazione per gli utenti). È un'azione manuale e rara; a scala molto grande un'eventuale
  colonna "telefono normalizzato" indicizzata renderebbe il controllo istantaneo (miglioria
  futura, non necessaria ora).
- La **select "assegna a…"** in fase di creazione (alternativa citata nella richiesta) è già
  supportata a livello di backend (`assignedCoachId`): manca solo l'eventuale campo nell'UI, da
  aggiungere se lo si vuole.
- Verifica: transpile backend OK; NUL check OK. (Il type-check completo gira in CI col client
  Prisma generato.)
