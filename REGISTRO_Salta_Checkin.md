# Registro — "Salta per oggi" sul check-in: adesso vale davvero per oggi

**Data:** 5 agosto 2026 · Segnalazione di Simone: «il come ti senti oggi, se dico salta per oggi
continua a chiedermelo fino a quando non rispondo, se ho detto salta perché?».

## Com'era

In Home il popup *Come ti senti oggi?* si mostrava quando il server diceva che il check-in del
giorno non c'era:

```tsx
{today && !today.checkinDone && !dismissed && <CheckinPopup … onSkip={() => setDismissed(true)} />}
```

Il tasto **"Salta per oggi"** faceva una cosa sola: `setDismissed(true)`. E `dismissed` è uno
`useState` **dentro il componente Home**, che in `App.tsx` è una rotta normale
(`<Route path="/" element={<Home />} />`): React smonta Home appena si esce dalla schermata. Bastava
quindi aprire il Menu, il Percorso o il Profilo e tornare indietro per ritrovarsi il popup davanti.
Idem dopo un riavvio dell'app, o passando dal telefono al browser.

L'unico modo di farlo davvero tacere era **rispondere**, perché solo `checkinDone` è uno stato che
il server ricorda. In pratica l'etichetta diceva "per oggi" e il comportamento era "per adesso":
un tasto che chiede il permesso di sparire e poi riappare è peggio che non averlo.

Da notare che il popup che compare **subito dopo** nella stessa schermata,
`MenuReviewPopup`, la cosa giusta la faceva già: si segna la chiusura per data in `localStorage`
(`metabole_menu_review_<data>`). Il check-in era l'unico dei due a non ricordare niente.

## Com'è ora

Lo skip viene **registrato sul server**, quindi vale su tutti i dispositivi e sopravvive a
navigazione, chiusura dell'app e cambio di telefono.

- Nuova tabella `checkin_skip` con vincolo di unicità su **(cliente, data)**.
- Nuovo endpoint `POST /me/checkins/skip` → `SignalsService.skipCheckinToday`, un `upsert`
  idempotente (toccare "Salta" due volte, o riaprire l'app, non crea righe doppie).
- `GET /me/today` restituisce anche `checkinSkipped`, e la Home nasconde il popup se è `true`.

Vale **solo per oggi**, di proposito: domani il popup torna. Il check-in resta il segnale "Testa"
del percorso, e saltarlo una volta non è rinunciarci. Chi non lo vuole più ha l'interruttore
dedicato **"Promemoria del check-in"** nelle preferenze.

### Perché una tabella separata e non un flag su `DailyCheckin`

La strada corta era aggiungere `skipped: true` a una riga di `DailyCheckin`. È la strada che fa
danno. Le righe di `DailyCheckin` sono contate come **misura di aderenza in quindici punti del
backend**: report mensile, report di piano, segnali del motore, avviso al coach dopo N giorni senza
check-in, diet-learning, alert, elenco clienti, notifiche. Un flag avrebbe richiesto di escluderlo
in tutti e quindici, e **la prima query dimenticata avrebbe gonfiato l'aderenza** di una cliente che
in realtà non ha risposto — un errore silenzioso, che si vede solo mesi dopo in un report sbagliato.

Con una tabella a parte il rischio non esiste: quelle quindici query non la vedono proprio. Il
prezzo è una tabella in più; il ragionamento è scritto sia nello schema sia nella migration, così
chi passerà di qui non "semplificherà" tornando al flag.

Per lo stesso motivo `checkinSkipped` è tenuto **distinto** da `checkinDone` nella risposta di
`/me/today`: il popup non si mostra in nessuno dei due casi, ma solo il primo è un check-in. Chi
legge l'aderenza deve guardare `checkinDone`, mai l'altro.

### Perché lo skip non spegne il promemoria

`checkin_reminder` (notifica giornaliera, `notifications.service.ts`) è rimasto com'era. Saltare il
popup di oggi e non voler più sentir parlare di check-in sono due cose diverse, e la seconda ha già
il suo interruttore. Spegnere il promemoria a chi tocca "Salta" sarebbe stato decidere al posto suo.

### Perché il popup si chiude prima della risposta del server

Il tasto chiude subito e la chiamata parte in sottofondo (`.catch(() => {})`). Il popup è una
cortesia, non una transazione: nessuno deve guardare uno spinner per dire "non adesso". Se la rete
manca, lo skip non viene registrato e resta il **vecchio** comportamento — chiuso finché non si
cambia schermata — che è il caso peggiore possibile ed è comunque quello di prima.

## Verifiche

- `npx jest src/signals` → **3 suite, 32 test, tutto verde**.
- `npx tsc -b --force` in `app/` → **uscita 0**.
- `tsc` backend confrontato con la baseline `git stash`: **stessi file, nessun errore nuovo** (i 7
  residui sono preesistenti, in script `prisma/*.ts` e in altre suite).
- Client Prisma rigenerato: `CheckinSkip` presente nei tipi.

### La suite di `signals` era rossa da prima, e non se n'era accorto nessuno

Aprendo `signals.service.spec.ts` è saltato fuori che **non compilava**: importava `toDateOnly` da
`./signals.service`, che lo importa e basta senza riesportarlo (`TS2459`). Con ts-jest un errore di
tipo in uno spec fa fallire la suite intera, quindi **nessuno dei 15 test lì dentro girava**.
Sistemato l'import sono emersi altri due guasti accumulati nel tempo:

- il modulo di test dichiarava **4 dipendenze su 7** (mancavano `ProgressService`,
  `EscalationRoutingService`, `MenuService`) → Nest non riusciva più a costruire il servizio;
- il finto `config` non aveva `water_ml_per_kg`, quindi l'obiettivo d'acqua veniva calcolato a
  0 ml/kg e schiacciato sul minimo. Due assert dicevano ancora **8 bicchieri**, il valore globale
  di quando l'obiettivo non era personalizzato: con 67 kg × 33 ml ÷ 250 il valore giusto è **9**.

### Non-vacuità

I test nuovi sono stati messi alla prova rompendo il codice di proposito:

1. `checkinSkipped` forzato a `false` → rosso **solo** il test "dopo lo skip il popup non si
   mostra" (1 fallito, 14 passati).
2. lo skip fatto scrivere su `dailyCheckin.upsert` → rossi **esattamente** i due test sullo skip
   (2 falliti, 13 passati), compreso quello che difende l'aderenza.

Ripristinato il codice: 15 passati.

## File toccati

| File | Cosa |
|---|---|
| `backend/prisma/schema.prisma` | nuovo `model CheckinSkip` + relazione su `User` |
| `backend/prisma/migrations/20260805100000_checkin_skip/migration.sql` | nuova tabella, indice unico, FK con cascade |
| `backend/src/signals/signals.service.ts` | `skipCheckinToday()` + `checkinSkipped` in `todayStatus` |
| `backend/src/signals/signals.controller.ts` | `POST /me/checkins/skip` |
| `app/src/pages/Home.tsx` | `skipCheckin()` al posto del solo `setDismissed`, condizioni di render |
| `backend/src/signals/signals.service.spec.ts` | suite sbloccata, mock riparati, 4 test nuovi |

## Serve l'OTA

Il fix è metà server e metà bundle. Al push, backend (Render, con la migration) e web app (Vercel)
sono a posto. **L'app già installata continua a saltare "per adesso"** finché non parte una release
OTA: il vecchio bundle non conosce `checkinSkipped` e non chiama l'endpoint nuovo. Nessun danno nel
frattempo — l'endpoint in più non lo disturba — ma la segnalazione resta viva sul telefono fino
alla release. Vedi `NOTA_Agente_App_2026-08-04.md`.
