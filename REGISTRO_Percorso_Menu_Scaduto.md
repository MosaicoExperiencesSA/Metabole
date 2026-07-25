# Registro modifiche — Pagina "Il tuo percorso": niente menu oggi/futuri a piano scaduto

**Data:** 23 luglio 2026 · Base: main (segue "Nessun piano attivo").

## Problema
Dopo il fix su Home e pagina Menu, restava una terza superficie non coperta: la pagina **"Il tuo
percorso"** (`Percorso.tsx`) mostrava ancora **"IL MENU DI OGGI"** e **"Menu futuri · Domani"**
anche a prova/piano scaduto (giorni erogati a cavallo della scadenza rimasti visibili).

## Fix
`app/src/pages/Percorso.tsx`
- Legge ora anche `status` da `/me/menu` e calcola `expired = status.state === 'expired'`.
- A `expired`: **nasconde "IL MENU DI OGGI" e "Menu futuri"**. Il **"Diario del percorso → Menu
  passati" (storico) resta invariato e leggibile.**
- Se scaduto e **senza contesto Monitoraggio** (né periodo attivo né idoneità), mostra il banner
  "Nessun piano attivo". Se invece è idoneo al Monitoraggio (caso tipico di fine prova), resta la
  card "Monitoraggio · gratis per 1 mese · Attiva" già presente, senza doppioni.

## Verifica
- `tsc --noEmit` app: OK.
- Controllate le altre superfici: `Profilo.tsx` usa `/me/menu` solo per escludere cibi (non mostra
  il menu); Home e pagina Menu già sistemate. Nessun'altra pagina mostra il "menu di oggi".

## Note
- Nessun cambio backend (usa lo stato `expired` già introdotto). Storico sempre consultabile su
  tutte le superfici.
