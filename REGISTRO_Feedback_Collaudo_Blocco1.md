# Registro modifiche — Feedback collaudo, blocco 1

**Data:** 20 luglio 2026 · Base: origin/main c38286a.

## Summary
Primo blocco dei lavori dal collaudo: cambio cibo con correzione immediata di 3 menu +
popup "elimina per sempre", lista Cibi esclusi nel profilo app, menu rigenerati al cambio
tipo dieta (solo la differenza) e ricreati da zero al cambio data inizio, chat vera con
coach e nutrizionista (con aggiornamento automatico), card "Il mio piano" con la data del
primo menu erogato, stili alimentari solo da diete approvate, icona profilo come le altre,
dashboard e alert di squadra per la coordinatrice, ref code anche per la manager coach.

## Description

### Cambio cibo (app cliente)
- **"Sostituisci un ingrediente"** ora corregge SUBITO i menu già erogati di oggi, domani
  e dopodomani (sostituzioni sicure annotate sui pasti). Poi un **popup chiede**: "Vuoi
  eliminare per sempre questo cibo?" → Sì = va nei cibi esclusi (guida i menu futuri);
  No = resta solo la correzione dei 3 giorni.
- Backend: `POST /me/menu/substitute` accetta `forever` (bool); `substituteDisliked`
  applica le sostituzioni anche per ingredienti NON in lista (parametro extra a
  `evaluateMeals`) e tocca fino a 3 giorni ≥ oggi.

### Cibi esclusi nel profilo
- **App → Profilo → "Cibi esclusi"**: lista dei cibi esclusi con rimozione (X) e aggiunta;
  salva su `PATCH /me/client-profile` (dislikedFoods). Le intolleranze sono mostrate a
  parte, si cambiano con lo staff (dato di sicurezza).
- Nel backoffice la scheda cliente aveva già i campi "Intolleranze" e "Cibi non graditi"
  in Modifica scheda: lo staff li corregge da lì, per ogni cliente.

### Menu: cambio tipo dieta e cambio data inizio
- **Cambio tipo di dieta** (scheda cliente, permesso "Cambia tipo di dieta"): i giorni già
  consumati restano, i giorni FUTURI già erogati vengono cancellati e rierogati con la
  nuova dieta → si eroga solo la differenza (`redeliverFutureDays`). Audit
  `client.diet_type.menus_redelivered`.
- **Cambio data di inizio** (matita in Acquisti): si cancellano TUTTI i menu erogati e si
  riparte dalla nuova data (`restartFromPlanStart`). Audit `client.plan_start.menus_restarted`.
- Prima NESSUNO dei due cambi toccava i menu già erogati (restavano quelli vecchi).

### Chat coach / nutrizionista (era "non funziona")
- Il backend era pronto; l'app mostrava "la messaggistica sta arrivando". Ora da
  **Contatti** si apre la chat DIRETTA con coach e nutrizionista (stesso sistema di
  thread di Gaia, `?who=coach|nutritionist`); "Conversazioni passate" mostra i riassunti
  giornalieri reali.
- **Aggiornamento automatico ogni 12 secondi** sia lato cliente sia lato staff (prima i
  messaggi comparivano solo ricaricando la pagina).

### Card "Il mio piano" (foto: Inizio 20 ma primo menu 22)
- `/me/subscription` ora restituisce anche `firstMenuDate` (primo menu erogato
  dell'abbonamento); la card usa QUELLA data per "Inizio" e per "Giorno N".

### Stili alimentari
- `GET /catalog/taxonomy` ora elenca solo gli stili di diete **APPROVATE** (prima
  comparivano anche stili di bozze/archiviate → voci "fantasma" nei menu a tendina).

### Iconcina profilo (header app)
- `.hicon-user` aveva i colori invertiti (sfondo bianco/icona verde): ora è come le altre
  iconcine dell'header (sfondo traslucido, icona bianca, si adatta alla personalizzazione).

### Coordinatrice coach (= "manager coach", ruolo coach_coordinator)
- **Dashboard**: è la stessa delle coach; ora anche il contatore **alert** copre tutto il
  suo team (prima vedeva solo i propri → sembrava vuota). La pagina Alert elenca e lascia
  gestire gli alert delle coach del team. Sottotitolo dashboard: "Coordinatrice coach".
- **Ref code**: il pulsante "Genera" in Utenti ora compare anche per coach_coordinator
  (prima solo coach); se la coordinatrice era stata creata senza scheda Staff (bug
  storico: mancava nel STAFF_ROLES, ora aggiunto) la scheda viene creata al volo.

## Note
- Nessuna migration: solo logica.
- La rigenerazione menu rispetta finestre di visibilità e gate misure del motore; se il
  cambio avviene a menu non ancora erogabili, la differenza arriva alla prossima
  erogazione automatica.
- Restano per il PROSSIMO blocco: app coach con scheda cliente/lead operativa
  (sottoinsieme concordato), collegamento utenza cliente↔staff con switch senza logout e
  banner "ATTENZIONE PROFILO TECNICO", prodotti Summer Holiday/Return nei consigliati
  (con ricerca sui bilanciamenti), lavori dell'allegato 3 (da riallegare: non è arrivato).
