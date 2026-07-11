# Widget mascotte da home screen — guida di implementazione

Il **codice React dell'app non basta**: un widget da home screen è un componente **nativo**
(iOS WidgetKit in Swift, Android App Widget in Kotlin). Va aggiunto ai progetti nativi generati
da Capacitor (`ios/App` e `android/`). Questa guida spiega cosa consumare e i passi lato nativo.

Il **backend è già pronto**: espone l'endpoint con tutti i dati che servono al widget.

---

## 1. Endpoint dati (già pronto)

`GET /api/v1/me/widget` — richiede il token cliente (header `Authorization: Bearer <accessToken>`).

Risposta JSON:

```json
{
  "name": "Giulia",
  "state": "inrotta",                 // buongiorno | inrotta | acqua | passi | buonanotte (in base all'ora, fuso Europe/Rome)
  "greeting": "Sei in rotta, Giulia!",
  "phrase": "La costanza batte la perfezione.",
  "nextMeal": { "slot": "lunch", "name": "Farro, pollo e verdure", "kcal": 480 },  // può essere null
  "water": { "glasses": 5, "goal": 8 },
  "steps": { "steps": 4200, "goal": 8000 },
  "weightLostKg": 3.6,                 // può essere null se non ci sono misure
  "progressPercent": 60,               // % verso l'obiettivo peso, può essere null
  "updatedAt": "2026-07-11T16:58:20.926Z"
}
```

Mappatura dei 3 formati del mockup:
- **Quadrato (systemSmall)**: mascotte + `greeting` + una metrica (es. `water` o `progressPercent`).
- **Rettangolare (systemMedium)**: mascotte + `greeting` + `phrase` + `nextMeal`.
- **Largo (systemLarge)**: tutto quanto sopra + acqua/passi/progresso.

Lo `state` decide l'espressione/animazione della mascotte (gli stessi stati del prototipo:
buongiorno, inrotta/in rotta, acqua, passi, buonanotte).

---

## 2. Condivisione del token (il punto chiave)

Il widget gira in un **processo separato** dall'app: non ha accesso al `localStorage` della
webview. Bisogna condividere il **refresh token** (o un token dedicato) tra app e widget:

- **iOS**: App Group condiviso (`group.eu.metabole.app`) → salva il token in
  `UserDefaults(suiteName:)` o nel Keychain con `kSecAttrAccessGroup`.
- **Android**: `SharedPreferences` con `MODE_PRIVATE` letto dal widget provider (stesso package),
  oppure un `ContentProvider`.

Serve un piccolo **plugin Capacitor** (o codice nativo) che, al login/refresh, copi il token
nello storage condiviso. Lato web, dopo `applyAuth`, chiamare il plugin per salvare
`refreshToken` nello storage condiviso. Il widget poi fa: refresh → `GET /me/widget`.

> Consiglio: nel widget usare il **refresh token** per ottenere un access token fresco
> (`POST /api/v1/auth/refresh`), poi chiamare `/me/widget`. Così il widget resta valido
> anche quando l'access token in app è scaduto.

---

## 3. iOS — WidgetKit (Swift)

1. In Xcode: **File → New → Target → Widget Extension** (es. `MetaboleWidget`). NON "Include
   Configuration Intent" se non serve la configurazione.
2. **App Groups**: abilita la capability su App e su Widget con lo stesso gruppo
   (`group.eu.metabole.app`).
3. **TimelineProvider**: in `getTimeline` fai la fetch:
   - leggi il token dallo storage condiviso (App Group);
   - `POST /auth/refresh` → access token;
   - `GET /me/widget` → decodifica il JSON (struct `Codable` che rispecchia lo schema sopra);
   - crea `Timeline` con refresh ogni ~30 minuti (`.after(Date().addingTimeInterval(1800))`).
4. **View SwiftUI** con `@Environment(\.widgetFamily)` per i 3 formati (`.systemSmall`,
   `.systemMedium`, `.systemLarge`). La mascotte può essere un'immagine per stato
   (`mascot_\(state)`) o un piccolo canvas.
5. **Deep link**: `.widgetURL(URL(string: "metabole://home"))` per aprire l'app al tap.

## 4. Android — App Widget (Kotlin)

1. `AppWidgetProvider` + `res/xml/metabole_widget_info.xml` (dimensioni min per i formati) +
   layout `RemoteViews` per small/medium/large.
2. `onUpdate`: usa `WorkManager`/coroutine per la fetch (refresh → `/me/widget`), poi aggiorna
   le `RemoteViews` e chiama `appWidgetManager.updateAppWidget`.
3. Token da `SharedPreferences` condivise (stesso package dell'app).
4. `PendingIntent` sul widget per aprire l'app (deep link `metabole://home`).

## 5. Passi operativi (riassunto)

1. `npx cap add ios` / `npx cap add android` (se non già presenti).
2. Creare il piccolo plugin/codice per salvare il token nello storage condiviso al login.
3. iOS: aggiungere Widget Extension + App Group + TimelineProvider che chiama `/me/widget`.
4. Android: aggiungere AppWidgetProvider + fetch + RemoteViews.
5. Registrare lo schema deep link `metabole://` per il tap sul widget.

Tutto ciò che serve dal backend è già pronto (`GET /me/widget`). Il resto è lavoro nativo in
Xcode/Android Studio, da fare fuori da questo repo web.
