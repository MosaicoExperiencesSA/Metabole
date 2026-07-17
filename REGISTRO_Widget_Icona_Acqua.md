# Registro modifiche — Widget: icona e valore acqua secondo l'unità scelta

**Data:** 17 luglio 2026 · Base: origin/main 09effa4.

## Summary
Nel widget da home screen l'acqua restava sempre con la goccia 💧 e il valore in bicchieri, anche
se il cliente aveva scelto le bottiglie. Ora **icona e valore cambiano in base all'unità**, come in
dashboard.

## Description
- **backend/signals.service.ts** (`widget()`): il payload `/widget` ora include `waterUnit`
  (dalle preferenze utente, default `glass`).
- **docs/android-widget/java/MetaboleWidget.java**: legge `waterUnit`, imposta l'icona (💧 per i
  bicchieri, 🍶 per le bottiglie) sul nuovo id `widget_water_icon`, e converte il valore
  (bicchieri → unità: glass=1, bottle05=2, bottle1=4, bottle15=6; intero se tondo, altrimenti 1
  decimale con la virgola).
- **layout widget_rect.xml / widget_large.xml**: dato l'`id` `widget_water_icon` all'emoji acqua
  (prima era fissa). Il formato quadrato non mostra l'acqua: nessun impatto (setText tollerante).

## Note
- Nessuna migration. Il widget si aggiorna al prossimo refresh (o riaggiungendolo). Serve rebuild
  APK (`android:sync` ricopia widget aggiornato) + redeploy backend (per `waterUnit` in /widget).
- Emoji bottiglia = 🍶 (l'emoji più simile a una bottiglia; il dashboard usa l'icona vettoriale ti-bottle).
