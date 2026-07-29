# Registro modifiche — Report: niente congratulazioni se la cliente è ingrassata

**Data:** 29 luglio 2026 · Base: main.

## Problema
Se la cliente **aumenta di peso** (es. +2 kg) il report la accoglieva comunque con un titolo
celebrativo ("…hai già messo in moto il cambiamento" / "…un altro passo verso l'obiettivo"). Non ci
si deve congratulare per un risultato negativo: va **incoraggiata** ("si può inciampare, l'importante
è rialzarsi").

## Fix — `app/src/pages/Report.tsx`
- L'intestazione del report ora dipende dall'esito peso del periodo (`measures.deltaWeightKg`):
  - **aumento significativo** (> 0.3 kg) → messaggio incoraggiante, non celebrativo:
    *"…questo tratto non è andato come speravi — e capita a tutte. Si può inciampare: l'importante è
    rialzarsi, e ripartiamo insieme da adesso."*
  - **calo o peso stabile** → resta il tono positivo di prima.
- Le StatCard erano già neutre su un aumento (verde solo per un calo); l'aderenza resta lodata
  perché è un comportamento reale (seguire il menu), non il risultato-peso.

## Verifica
- `tsc --noEmit` app: OK.

## Impatto / deploy
- **App**: cambia `Report.tsx` → per l'app nativa serve la **build store**; la web app va da sé su
  Vercel. Nessuna migration.
- Nota: i report sono snapshot generati a fine periodo — il nuovo tono vale per quelli generati
  d'ora in poi.
- Da valutare a parte (non in questo fix): il tono del messaggio quotidiano di Gaia
  (`engine_daily_*`) è deciso dal motore; verificare che non usi il tono "celebratory" in caso di
  peso in aumento.
