# Widget Android — file da aggiungere al progetto nativo

Questi file aggiungono il **widget da home screen** all'APK. Vanno copiati nel progetto
`android/` (che si genera con `npx cap add android`, vedi `docs/APK_Build_Guida.md`).

Backend e app sono già pronti:
- `POST /auth/widget-token` → l'app ottiene un token widget (90 giorni) e lo salva in
  SharedPreferences `CapacitorStorage` chiave `metabole_widget_token` (fatto in AuthContext).
- `GET /widget` (pubblico, auth col token widget) → dati del widget.

## 1. Copia i file (rinominandoli al percorso indicato in testa a ciascuno)

| File in questa cartella | Destinazione nel progetto |
|---|---|
| `MetaboleWidget.kt` | `android/app/src/main/java/app/metabole/client/MetaboleWidget.kt` |
| `res-layout-metabole_widget.xml` | `android/app/src/main/res/layout/metabole_widget.xml` |
| `res-drawable-widget_bg.xml` | `android/app/src/main/res/drawable/widget_bg.xml` |
| `res-xml-metabole_widget_info.xml` | `android/app/src/main/res/xml/metabole_widget_info.xml` |

⚠️ **Package**: in `MetaboleWidget.kt` la prima riga è `package app.metabole.client`.
Deve combaciare con il package della `MainActivity` (guarda in
`android/app/src/main/java/.../MainActivity.java`). Se il tuo è diverso, adatta il package
e sposta il file nella cartella corrispondente. La cartella `res/xml/` potrebbe non esistere:
creala.

## 2. Registra il widget nel Manifest

In `android/app/src/main/AndroidManifest.xml`, **dentro** `<application> … </application>`
(dopo l'`<activity>` della MainActivity) incolla:

```xml
<receiver
    android:name=".MetaboleWidget"
    android:exported="false">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/metabole_widget_info" />
</receiver>
```

La permission Internet è già presente nei progetti Capacitor; se mancasse, aggiungi
`<uses-permission android:name="android.permission.INTERNET" />` fuori da `<application>`.

## 3. Ricompila e prova

```bash
npx cap sync android
npx cap open android
```
In Android Studio fai **Build → Build APK(s)**, installa l'APK, poi tieni premuto sulla home
del telefono → **Widget** → cerca **Metabole** e trascinalo sulla home.

Requisito: aver fatto **login nell'app almeno una volta** (così il token widget viene salvato).
Il widget si aggiorna da solo ~ogni 30 minuti e al tap apre l'app.

## Note
- È la **versione base** (un formato, mascotte come emoji per stato, saluto, frase, prossimo
  pasto, acqua/passi). Quando funziona, possiamo aggiungere immagini mascotte vere, più formati
  (piccolo/grande) e animazioni.
- Se il widget resta su "Apri l'app Metabole": fai login nell'app, poi rimuovi e riaggiungi il
  widget (o aspetta il refresh). Vuol dire che il token non era ancora salvato.
- Endpoint dati e schema JSON: vedi `docs/Widget_Nativo_Guida.md`.
