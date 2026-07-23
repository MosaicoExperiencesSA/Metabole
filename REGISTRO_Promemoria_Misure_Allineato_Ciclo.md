# Registro modifiche — Promemoria misure allineato al ciclo del menu

**Data:** 23 luglio 2026 · Base: main.

## Problema segnalato
"Se il primo menu è del 20/07, la seconda misura doveva chiederla il 21, non il 20."

## Verifica del flusso (due meccanismi distinti per le misure)
1. **Gate bloccante** (`MenuService.measurementGate` → `/me/measurement-gate`, popup `MeasuresGate`):
   chiede la misura al **2° giorno di ogni ciclo**. Con primo menu il 20 il ciclo è [20, 21],
   quindi il popup bloccante compare il **21**. → **corretto, nessuna modifica.**
2. **Promemoria (notifica)** `measurement_reminder` (batch giornaliero): usava
   `daysSinceMeasure >= 2` calcolato dall'**ultima misura**, **scollegato dal ciclo del menu**.
   Se la cliente non aveva misure precedenti, `daysSinceMeasure = Infinity` → la condizione era
   sempre vera e il promemoria partiva **già dal 20** (1° giorno del ciclo). → **è questo il bug:
   chiedeva il 20 invece del 21.**

## Fix
`backend/src/notifications/notifications.service.ts`: il promemoria misure ora usa il **gate del
ciclo come unica fonte di verità**. Scatta solo quando `measurementGate(clientId).required` è
`true`, cioè dal **2° giorno del ciclo** — mai il 1° giorno. Così notifica e popup bloccante
sono allineati: primo menu 20 → ciclo [20, 21] → misura chiesta il **21**.

Effetti collaterali (positivi):
- Nessun promemoria misure prima che esista un ciclo di menu (prima poteva arrivare "a vuoto").
- Il gate rispetta già lo stato "in vacanza" (non blocca), quindi anche il promemoria lo eredita.

## Verifica
- Transpile `notifications.service.ts` e `notifications.service.spec.ts`: OK, NUL check OK.
- Test aggiornati (`notifications.service.spec.ts`): il mock `menu` ora espone `measurementGate`
  (default `required:true` → il promemoria scatta; override `required:false` nel test "misure
  fresche" → non scatta). Logica dei test invariata nell'intento.
- Nota: la suite jest completa non gira nel sandbox perché il client Prisma non è generabile qui
  (errori "Property X does not exist on PrismaService" su tutti i file, pre-esistenti); i test
  vanno eseguiti in CI/locale dove `prisma generate` è disponibile.

## Note
- Nessuna migration, nessun cambio di schema/API. Solo la condizione di invio del promemoria.
