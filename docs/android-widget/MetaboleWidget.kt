package app.metabole.client

// ⚠️ Il package sopra DEVE combaciare con quello della MainActivity del progetto
// (guarda android/app/src/main/java/.../MainActivity.java). Se è diverso, correggilo.

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Widget da home screen di Metabole.
 * Legge il "token widget" salvato dall'app in SharedPreferences ("CapacitorStorage",
 * chiave "metabole_widget_token"), chiama GET /widget e mostra stato mascotte,
 * saluto, frase, prossimo pasto e acqua/passi. Tap → apre l'app.
 */
class MetaboleWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        // Stato immediato (evita widget vuoto mentre carica)
        for (id in ids) render(context, mgr, id, null, "Aggiorno…")
        Thread {
            val data = try { load(context) } catch (e: Exception) { null }
            for (id in ids) {
                if (data != null) render(context, mgr, id, data, null)
                else render(context, mgr, id, null, "Apri l'app Metabole")
            }
        }.start()
    }

    private fun load(context: Context): JSONObject? {
        val token = context
            .getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            .getString("metabole_widget_token", null) ?: return null
        val conn = URL("$API/widget").openConnection() as HttpURLConnection
        return try {
            conn.requestMethod = "GET"
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.setRequestProperty("Authorization", "Bearer $token")
            if (conn.responseCode in 200..299)
                JSONObject(conn.inputStream.bufferedReader().readText())
            else null
        } finally {
            conn.disconnect()
        }
    }

    private fun render(
        context: Context,
        mgr: AppWidgetManager,
        id: Int,
        d: JSONObject?,
        placeholder: String?,
    ) {
        val v = RemoteViews(context.packageName, R.layout.metabole_widget)

        // Tap sul widget → apre l'app
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
            val pi = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            v.setOnClickPendingIntent(R.id.widget_root, pi)
        }

        if (d != null) {
            val emoji = when (d.optString("state")) {
                "buongiorno" -> "🌅"
                "acqua" -> "💧"
                "passi" -> "🚶"
                "buonanotte" -> "🌙"
                else -> "🌱"
            }
            v.setTextViewText(R.id.widget_emoji, emoji)
            v.setTextViewText(R.id.widget_greeting, d.optString("greeting", "Metabole"))
            v.setTextViewText(R.id.widget_phrase, d.optString("phrase", ""))

            val meal = d.optJSONObject("nextMeal")
            v.setTextViewText(
                R.id.widget_meal,
                if (meal != null) "🍽 ${meal.optString("name")} · ${meal.optInt("kcal")} kcal"
                else "Nessun pasto in programma",
            )

            val water = d.optJSONObject("water")
            val steps = d.optJSONObject("steps")
            val wt = if (water != null) "💧 ${water.optInt("glasses")}/${water.optInt("goal")}" else ""
            val st = if (steps != null) "🚶 ${steps.optInt("steps")}" else ""
            v.setTextViewText(R.id.widget_metrics, "$wt   $st")
        } else {
            v.setTextViewText(R.id.widget_emoji, "🌱")
            v.setTextViewText(R.id.widget_greeting, "Metabole")
            v.setTextViewText(R.id.widget_phrase, placeholder ?: "")
            v.setTextViewText(R.id.widget_meal, "")
            v.setTextViewText(R.id.widget_metrics, "")
        }

        mgr.updateAppWidget(id, v)
    }

    companion object {
        // Se un giorno cambi backend, aggiorna qui.
        private const val API = "https://metabole-backend.onrender.com/api/v1"
    }
}
