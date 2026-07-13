# Widget home Android — Metabole (mascotte Gaia, 3 formati)

Copia **versionata** dei file nativi del widget da home screen.
La cartella reale `app/android/` è ignorata da git (è generata da Capacitor),
quindi questi file vivono qui come sorgente di verità e vanno **copiati** dentro
il progetto Android quando serve (nuovo clone, dopo `npx cap add android`, ecc.).

## Cosa fa il widget

Legge il *token widget* salvato dall'app cliente in SharedPreferences
(`CapacitorStorage` → chiave `metabole_widget_token`), chiama
`GET https://metabole-backend.onrender.com/api/v1/widget` e mostra la mascotte
Gaia con saluto, frase del giorno, streak, acqua, passi e prossimo pasto.
Tap sul widget → apre l'app.

Tre formati che si adattano al ridimensionamento sulla home:
- **quadrato** (`widget_square.xml`): streak + mascotte + frase
- **rettangolare** (`widget_rect.xml`): mascotte + saluto/frase + acqua/passi
- **largo** (`widget_large.xml`): intestazione con streak, mascotte + saluto +
  metriche, frase, card "Prossimo pasto", pulsante "Apri Metabole"

Colore di sfondo e mascotte cambiano in base allo `state` restituito dal backend
(buongiorno/acqua = blu, in rotta = teal, passi = arancio, buonanotte = viola
scuro + mascotte addormentata).

## Dove va ogni file (dentro app/android/app/src/main/)

| File in questa cartella | Destinazione nel progetto Android |
|---|---|
| `java/MetaboleWidget.java` | `java/app/metabole/client/MetaboleWidget.java` |
| `res/layout/widget_square.xml` | `res/layout/widget_square.xml` |
| `res/layout/widget_rect.xml` | `res/layout/widget_rect.xml` |
| `res/layout/widget_large.xml` | `res/layout/widget_large.xml` |
| `res/drawable/widget_bg_teal.xml` | `res/drawable/widget_bg_teal.xml` |
| `res/drawable/widget_bg_blue.xml` | `res/drawable/widget_bg_blue.xml` |
| `res/drawable/widget_bg_orange.xml` | `res/drawable/widget_bg_orange.xml` |
| `res/drawable/widget_bg_dark.xml` | `res/drawable/widget_bg_dark.xml` |
| `res/drawable/widget_btn_bg.xml` | `res/drawable/widget_btn_bg.xml` |
| `res/drawable/widget_chip_bg.xml` | `res/drawable/widget_chip_bg.xml` |
| `res/drawable/widget_meal_bg.xml` | `res/drawable/widget_meal_bg.xml` |
| `res/drawable/mascot_happy.png` | `res/drawable/mascot_happy.png` |
| `res/drawable/mascot_sleepy.png` | `res/drawable/mascot_sleepy.png` |
| `res/xml/metabole_widget_info.xml` | `res/xml/metabole_widget_info.xml` |

Inoltre incollare il contenuto di `AndroidManifest-receiver.xml` dentro il tag
`<application>` di `app/android/app/src/main/AndroidManifest.xml`.

## Note

- Il progetto Capacitor è **Java-only** (niente Kotlin): il provider è in Java.
- Le mascotte sono PNG (i widget Android non supportano SVG/animazioni).
- Backend: l'endpoint pubblico `GET /widget` e il token widget dedicato (scope
  `widget`, 90 giorni) sono già nel codice backend (`signals/widget.controller.ts`,
  `auth.service.ts`). Lo `streak` è calcolato in `signals.service.ts`.
