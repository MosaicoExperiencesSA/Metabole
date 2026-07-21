# Registro modifiche — Allineamento nomi Stile ↔ nomi diete

**Data:** 21 luglio 2026 · Base: origin/main ca98453.

## Summary
Nella scheda cliente il menu "Stile" mostrava etichette ricavate dal **codice** dello stile
(es. `summer_holiday` → "Summer Holiday", in inglese), diverse dai **nomi** delle diete che
si vedono nella pagina Diete. Ora l'etichetta di ogni stile è il **nome della dieta**
(nome cliente se impostato, altrimenti nome interno): le tendine combaciano con il catalogo.

## Description
- **catalog.service.ts → `styles()`**: invece di `STYLE_LABELS[code] ?? titleCase(code)`,
  l'etichetta di ogni stile è ora `clientName || name || STYLE_LABELS[code] || titleCase(code)`
  della prima dieta approvata di quello stile. Ordinamento per etichetta.
- Il fix è unico e si riflette **ovunque** si usa la taxonomy: menu "Stile" della scheda
  cliente (creazione/modifica), colonna "Stile" della pagina Diete, riepilogo scheda.

## Note
- Nessuna migration. Effetto dopo il deploy del backend.
- Perché un piano mostri il nome "giusto", basta che la dieta abbia il **Nome cliente**
  (o il Nome) impostato in Diete — cosa già vera per le diete del catalogo. Se una dieta non
  ha nome cliente, si usa il nome interno.
- Sparisce l'inglese "Summer Holiday/Return": ora compare il nome dato in Diete
  (es. "Vacanza estiva" / "Rientro estivo").
