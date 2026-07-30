# Registro — Fabbisogno calorico + menu "a necessità"

**Data:** 30 luglio 2026 · Base: main.

## Obiettivo
Due nuovi "agenti": (1) calcolo del **fabbisogno calorico** giornaliero dal profilo; (2) menu
generati **puntando a quel fabbisogno**. Scelte concordate: i menu sono guidati **in automatico**
dal fabbisogno (con soglie di sicurezza); attività fisica presa da **campo lavoro + nuova domanda
dedicata**; deficit **dal ritmo dell'obiettivo con soglia minima**. Formula **Mifflin-St Jeor**.

## 1) Servizio fabbisogno — `backend/src/menu/kcal-need.service.ts` (nuovo)
`KcalNeedService.estimate(clientId)` / `computeTargetKcal(clientId)`:
- **BMR** (Mifflin-St Jeor) da sesso, età, altezza, **peso attuale** (ultima misura, altrimenti
  peso iniziale).
- **× fattore di attività**: prima l'**attività dichiarata** (`activityLevel`), poi il **lavoro**
  (`lifestyle.work`), infine un default. Fattori standard (1.2 → 1.9).
- **TDEE** = BMR × attività (fabbisogno di mantenimento).
- **Deficit** (solo obiettivo *dimagrimento*): dal **ritmo** dell'obiettivo (kg da perdere /
  settimane rimaste × 7700 kcal/kg ÷ 7). Se non c'è un obiettivo valido → deficit di default
  (15% del TDEE). **Tetti**: max 30% del TDEE e max 1000 kcal/giorno.
- **Soglia minima di sicurezza**: il target non scende mai sotto ~1200 kcal (F) / ~1500 (M).
- In *mantenimento* → target = TDEE.
- Ritorna `null` se mancano sesso/età/altezza/peso (→ i menu usano i livelli della dieta).
- Tutte le soglie/tetti sono **configurabili** (`config_param`): `kcal_need_floor_female/male`,
  `kcal_need_deficit_max_pct`, `kcal_need_deficit_max_kcal`, `kcal_need_kcal_per_kg`,
  `kcal_need_default_deficit_pct`.

## 2) Menu a necessità — `backend/src/menu/menu.service.ts`
- Nuovo flag `menu_kcal_need_enabled` (**default true**, override per dieta possibile). Quando
  attivo e il fabbisogno è calcolabile, il **target kcal della giornata = fabbisogno** (invece
  delle kcal del livello della dieta).
- Con il target dal fabbisogno, si attiva **DayCombo** (il compositore che monta la giornata dal
  pool della dieta puntando al target entro la banda kcal, con banda proteica e varietà). Se non
  trova una giornata nella banda → **fallback** al selettore per-slot storico. Nessuna modifica
  all'algoritmo DayCombo.
- Compatibile con tutto il resto (esclusioni, ricette semplici, sicurezza intolleranze a valle).

## 3) Attività fisica (dato)
- `ClientProfile.activityLevel` (`sedentary|light|moderate|active|very_active`) +
  migration `20260730130000_client_activity_level`.
- `update-profile.dto.ts`: campo `activityLevel` (PATCH `/me/client-profile`).
- **App** (`Profilo.tsx`): nuova sezione **Attività fisica** con la scelta del livello.
- (Follow-up non incluso: aggiungere la stessa domanda nell'onboarding iniziale — richiede il
  mapper risposte→profilo. Per ora il dato si imposta dal profilo; finché è vuoto si usa il lavoro.)

## 4) Trasparenza per il nutrizionista
- Endpoint staff `GET /admin/clients/:id/kcal-need` → stima completa (BMR, TDEE, target, deficit,
  fonte attività, soglia applicata).
- **Backoffice** (`ClientDetail.tsx`): card **"Fabbisogno calorico"** con Target / Mantenimento /
  Basale / Deficit e la nota su come è stato calcolato.

## Verifica
- Backend: transpile OK dei file toccati + nuovo servizio; NUL OK. Formula verificata a mano su
  più casi (deficit dal ritmo, tetti, soglia minima). (`prisma validate` non eseguibile in
  sandbox: engine non scaricabile; la migration è un `ADD COLUMN` standard.)
- Backoffice/App: `tsc --noEmit` OK, `npm run build` OK.

## Come si mette in produzione
1. **Push** da GitHub Desktop → Render applica la migration in automatico; Vercel aggiorna
   web app e backoffice.
2. Nessun comando obbligatorio: il calcolo è attivo di default (`menu_kcal_need_enabled=true`).
   Le clienti con sesso/età/altezza/peso avranno i menu puntati al fabbisogno; le altre restano
   sui livelli della dieta finché il dato non c'è.
3. (Consigliato) invita le clienti a impostare l'**attività fisica** dal profilo per una stima
   più precisa. Il nutrizionista vede il target stimato nella scheda cliente.

### Interruttori utili (config_param)
- `menu_kcal_need_enabled` = false → torna al comportamento storico (kcal dai livelli dieta).
- Soglie di sicurezza e tetti deficit: vedi §1 (tutti configurabili).

## App installata (iOS/Android)
La sezione "Attività fisica" è frontend dell'app: su iOS/Android installati compare con
l'aggiornamento del bundle (OTA Capgo), come per gli altri fix. Web app e backoffice sono subito
aggiornati al deploy. Il calcolo e i menu a necessità sono lato backend → attivi appena deployati.
