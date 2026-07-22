# Registro modifiche — Frecce nel Percorso (#3) + Calendario più leggibile (#2)

**Data:** 22 luglio 2026 · Base: origin/main 5d2ee42. (Richieste #2 e #3 del file "fix e richieste 1".)

## Summary
Due migliorie rapide segnalate da Rosaria:
- **#3 WebApp › Percorso**: la card "Il menu di oggi" era un carosello a swipe senza indicazioni,
  quindi non si capiva che si potevano scorrere i pasti (si era costretti ad aprire tutto il menu).
  Aggiunte **frecce ‹ › e i pallini** di posizione sotto la card.
- **#2 Calendario (backoffice, vista Mese)**: le celle erano quadrati enormi con numeri minuscoli.
  Ora sono **più basse/compatte** e i **numeri più grandi**.

## Description
**#3 — `app/src/pages/Percorso.tsx` + `app/src/theme.css`**
- Il carosello dei pasti (`.meal-carousel`, scroll-snap orizzontale) ora ha un **ref** e traccia
  l'indice corrente sullo `scroll`. Sotto la card, se c'è più di un pasto, compaiono due **frecce**
  (‹ ›) che scorrono al pasto precedente/successivo (`scrollBy` di una larghezza, smooth) e una fila
  di **pallini** che indica la posizione. Le frecce si disabilitano al primo/ultimo pasto.
- CSS: nuova classe `.meal-nav-btn` (pulsante tondo).

**#2 — `backoffice/src/components/ReminderCalendar.tsx` (vista Mese)**
- Celle giorno: tolto `aspectRatio: '1'` (che su una colonna larga le rendeva quadrati alti) →
  ora usano solo un `minHeight` contenuto (34/46px), quindi rettangoli bassi e ariosi.
- Numero del giorno: da **12px** a **14/16px** (bold su oggi e giorni con promemoria).
- Intestazioni dei giorni della settimana leggermente più grandi (10 → 11.5px).

## Perché così
- Percorso: il carosello funzionava ma era "muto". Frecce + pallini rendono evidente che si scorre,
  senza dover aprire il menu completo — richiesta esatta di Rosaria.
- Calendario: `aspect-ratio:1` forza celle alte quanto larghe; su desktop diventano quadratoni. Un
  `minHeight` moderato le compatta mantenendo il click e i badge, e il numero più grande si legge.

## Note
- Nessuna migration. Verifica: `tsc --noEmit` app **OK** e backoffice **OK**.
- #2: individuato il calendario a griglia mensile del backoffice (ReminderCalendar); se Rosaria
  intendeva un altro calendario, mandami lo screenshot e lo allineo.
