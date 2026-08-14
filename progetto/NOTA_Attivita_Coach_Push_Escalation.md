# Attività coach: push alla creazione + escalation alla manager — decisione del 14/8/2026

> Richieste di Simone, 14/8 in chat (dagli screenshot della pagina Attività coach):
> «Queste notifiche arrivano alla coach anche via push?» — no, oggi nessuna push (verificato nel
> codice: solo «piano in scadenza» e «ripresa peso» fanno campanella in-app). — «e se la coach non
> le chiude vanno mandate alla manager delle coach» — «dopo 24 ore» — «sì, da quando andava fatta».

## Le decisioni

1. **Push alla creazione, dentro `ensureTask`** — l'unico punto in cui nasce OGNI attività, quindi
   nessun tipo può sfuggire. Si cerca la coach della cliente (`assignedCoach.userId`) e si manda
   `notificaUtente` (in-app + push, tipo `coach_task_new`, rispetta l'opt-out per tipo dello
   staff). ⚠️ Senza coach assegnata niente avviso — la vede il responsabile in pagina, come già per
   «piano in scadenza». Non lancia mai: un avviso che non parte non deve impedire la creazione.
2. **Escalation alla manager delle coach**: in coda a `generateDaily()` (stesso giro del cron
   giornaliero), le attività ancora `todo` con `dueDate < oggi` — cioè al primo giro del giorno
   DOPO quello in cui andavano fatte («24 ore da quando andava fatta», come confermato) — vanno ai
   destinatari di `destinatariManagerCoach` (ruolo `sales`; admin di riserva: un avviso senza
   destinatario non è un avviso), in-app + push, col nome della coach, della cliente e la scadenza.
3. **Una volta sola per attività.** ⚠️ SENZA migrazione, di proposito: `schema.prisma` oggi è
   conteso con la sessione parallela (tre pezzi persi il 13/8), quindi niente colonna nuova.
   L'idempotenza si fa guardando se esiste già una notifica `coach_task_escalation` con
   `payload.taskId` uguale (filtro Json path di Postgres) — la notifica stessa È la memoria.
4. **Tetto per giro (20)**: al primo lancio le attività scadute accumulate possono essere tante;
   oltre il tetto si logga quante restano e si continua al giro dopo. Un'inondazione di push
   insegna a spegnerle.
5. Nell'app coach non serve nulla: dashboard Attività e pagina Notifiche ci sono già (verificato);
   il tocco sulla push porta lì con `datiPush`.
