# Registro modifiche — Gate misure (tutti i piani) · Alert coach "menu non seguito" · Tasto Ricetta in Home

**Data:** 23 luglio 2026 · Base: main.

## 1) Misure obbligatorie per erogare i menu (primo menu + ogni ciclo)
**Problema:** le misure bloccavano l'erogazione solo per la **prova €0**; per i piani a pagamento
il primo menu partiva senza misure. Richiesta: senza misure **non** si erogano i menu, e l'app si
**blocca** finché non arrivano — e questo vale per **ogni coppia** di giorni, non solo il primo menu.

**Fix** — `backend/src/menu/menu.service.ts`
- `deliverIfEligible`: il gate delle **misure iniziali (punto A)** ora vale per **qualsiasi** piano
  attivo (prima solo `priceCents === 0`). Senza almeno una misura, nessun menu.
- `menuStatus`: lo stato **`awaiting_measures`** (popup misure) ora scatta per qualsiasi piano
  attivo senza misure, e **dopo** il controllo "troppo presto" (così prima dell'inizio piano resta
  `scheduled`).
- `measurementGate`: quando non c'è ancora nessun menu erogato, se il piano è attivo, la finestra è
  iniziata e mancano le misure iniziali → **blocca** col popup (nuovo helper `needsInitialMeasures`,
  che rispetta pausa/vacanza/percorso supervisionato). Il gate **per ogni ciclo** (`cycleNeedsMeasure`)
  era già attivo: al 2° giorno di ogni coppia il popup blocca finché non arriva la misura.

## 2) Alert alla coach quando la cliente segna "menu non seguito"
**Fix** — `backend/src/notifications/notifications.service.ts` + `src/i18n/messages.ts`
- Nuovo alert coach **`menu_not_followed_coach_alert`** nel batch giornaliero: se la cliente ha
  segnato **`non_seguita`** su un menu degli ultimi 2 giorni (tag dal popup "Com'è andata ieri?"),
  la coach riceve la notifica (una volta al giorno finché continua). Riusa `notifyOncePerDay`
  (dedup + push). Messaggio IT/EN aggiunto.

## 3) Tasto "Ricetta" in Home apre la ricetta (non il menu)
**Fix** — `app/src/pages/Home.tsx` + `app/src/pages/Menu.tsx`
- In Home il tasto "Ricetta" ora apre direttamente la **scheda ricetta** (via
  `/menu?ricetta=<id>&giorno=<oggi>`): la pagina Menu, se riceve `?ricetta=`, mostra subito la
  ricetta (riusa il componente `Recipe` esistente). Prima navigava genericamente a `/menu`.

## Verifica
- Backend: transpile `menu.service`, `notifications.service`, `messages.ts` OK; NUL check OK.
- App: `tsc --noEmit` OK.
- I test jest vanno lanciati in CI (client Prisma non generabile nel sandbox).

## Note
- Nessuna migration, nessun env nuovo.
- ⚠ La progressione dei piani suggeriti a fine piano (obiettivo 1/3 mesi → mantenimento →
  monitoraggio) è un lavoro separato in corso: vedi richiesta #3 (in attesa delle soglie).
