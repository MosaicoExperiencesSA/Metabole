# Registro modifiche — Suggerimento widget post-acquisto + scelta unità acqua

**Data:** 17 luglio 2026
**Ambito:** app cliente + backend (preferenze). Base: origin/main 2bc3a68 (albero pulito).

## Summary
1. Dopo l'acquisto, nella schermata "Tutto pronto!" ora c'è il bottone **"Installa il widget"**
   con una guida per aggiungerlo alla home del telefono.
2. Nelle impostazioni il cliente sceglie come **visualizzare l'acqua** (bicchieri o bottiglie da
   0,5 / 1 / 1,5 L): cambia l'icona in dashboard e quanto aggiunge ogni tap. Il dato resta salvato
   in bicchieri, quindi in backoffice l'acqua bevuta è sempre corretta.

## Description

### 1. Widget dopo l'acquisto
- `components/WidgetInstall.tsx` (nuovo): bottone "Installa il widget" + foglio con i passaggi
  (tieni premuto sulla home → Widget → Metabole → trascina). Android non consente di aggiungere il
  widget in automatico dall'app, quindi è una guida.
- `pages/PaymentResult.tsx`: nella fase "Tutto pronto!" aggiunto il bottone widget (primario) sopra
  "Vai alla home".

### 2. Unità di visualizzazione dell'acqua (solo display)
- `lib/water.ts` (nuovo): definizione unità (glass / bottle05 / bottle1 / bottle15), icone e
  conversione. 1 bicchiere = 250 ml; bottiglie = 2/4/6 bicchieri. Obiettivo invariato (2 L).
- `components/WaterUnitPicker.tsx` (nuovo): selettore nelle impostazioni; salva su
  `/me/preferences` (prefs.waterUnit).
- `pages/Profilo.tsx`: nuova sezione **"Acqua"** col selettore.
- `pages/Home.tsx`: legge `waterUnit`, cambia l'icona del tile (goccia/bottiglia), mostra la
  quantità nell'unità scelta e ogni tap aggiunge 1 unità (bicchieri equivalenti).
- Backend `me.controller.ts` + `users.service.ts`: `waterUnit` aggiunto a
  GET/PUT `/me/preferences` (validato: glass|bottle05|bottle1|bottle15; default glass).
  Nessuna migration: vive nel campo `prefs` (JSON).

## Scelte (dichiarate, in assenza di risposta alla domanda)
- Acqua = **solo visualizzazione**: obiettivo e dato salvato restano in bicchieri → backoffice corretto.
- Preferenza salvata **lato app** (prefs utente), backoffice non toccato.

## Nota
Verificato che origin/main (2bc3a68) contiene già tutto il lavoro precedente della sessione
(push, set-password/lead-backoffice, telefono, KPI): queste modifiche si innestano pulite sopra.

## Note aperte
- Backlog: diete a 3/4 pasti mancanti; checkout indirizzo condizionale.
- Test su device: bottone widget + cambio unità acqua in Profilo → icona/valore in dashboard.
