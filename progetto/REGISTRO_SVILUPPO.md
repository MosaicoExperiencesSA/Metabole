# Metabole — Registro Sviluppo (solo Cowork)

Log delle modifiche di sviluppo fatte da Simone + Claude Cowork. Tenuto **separato** da `REGISTRO.md` (che il socio aggiorna) per evitare conflitti di merge. Si aggiunge in cima.

---

## 2026-07-13


- **Prodotti dinamici — Fase D (backoffice: scheda cliente sulle diete)** — l'editor Diete del backoffice ora, alla creazione, permette di impostare la **scheda cliente** del prodotto (nome mostrato, descrizione breve, caratteristiche una-per-riga, obiettivo dimagrimento/mantenimento, **visibile nello schermo 16**). Backend: campi aggiunti a `CreateDietDto`/`UpdateDietDto` e persistiti in `createDiet` (update li salva già via spread). `keto` aggiunto alle mappe stile del backoffice. Backoffice type-check + build ok. **Limiti noti (rifiniture successive):** non c'è ancora un form per **modificare** la scheda cliente di una dieta esistente (solo alla creazione); una dieta *approvata* non è modificabile (guard esistente), quindi per cambiarne la visibilità serve una via dedicata. Regole per-prodotto (Fase F) e agente (Fase E) ancora da fare.
- **Prodotti dinamici — Fase C (schermo 16 dinamico)** — lo schermo 16 "Stile che preferisci" ora legge i piani da `GET /onboarding/diet-products` (zero-redeploy): ogni nome è **toccabile** → apre le caratteristiche principali (descrizione + highlights); voce di Gaia **generica**; **Keto** al posto di Flessibile. Fallback statico se il catalogo è vuoto. Seed: i 4 prodotti (Mediterranea/Proteica/Low-carb/Keto) resi `clientVisible` (creati a menu vuoti se mancanti). Aggiunto `keto` ai validatori dietStyle (submit/profile/client/catalog) e a `styleNames`. App type-check + build ok; verifica visiva schermo 16 ok. NB: type-check backend reale su Render; contiene le migrazioni Fase A.
