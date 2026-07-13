# Metabole — Registro Sviluppo (solo Cowork)

Log delle modifiche di sviluppo fatte da Simone + Claude Cowork. Tenuto **separato** da `REGISTRO.md` (che il socio aggiorna) per evitare conflitti di merge. Si aggiunge in cima.

---

## 2026-07-13

- **Prodotti dinamici — Fase C (schermo 16 dinamico)** — lo schermo 16 "Stile che preferisci" ora legge i piani da `GET /onboarding/diet-products` (zero-redeploy): ogni nome è **toccabile** → apre le caratteristiche principali (descrizione + highlights); voce di Gaia **generica**; **Keto** al posto di Flessibile. Fallback statico se il catalogo è vuoto. Seed: i 4 prodotti (Mediterranea/Proteica/Low-carb/Keto) resi `clientVisible` (creati a menu vuoti se mancanti). Aggiunto `keto` ai validatori dietStyle (submit/profile/client/catalog) e a `styleNames`. App type-check + build ok; verifica visiva schermo 16 ok. NB: type-check backend reale su Render; contiene le migrazioni Fase A.
