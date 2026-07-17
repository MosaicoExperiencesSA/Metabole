package app.metabole.client;

// Widget da home screen di Metabole (Java: il progetto Capacitor è Java-only).
// Legge il "token widget" salvato dall'app in SharedPreferences ("CapacitorStorage",
// chiave "metabole_widget_token"), chiama GET /widget e mostra la mascotte Gaia con
// stato/saluto/frase/pasto/acqua/passi/streak in TRE formati (quadrato, rettangolare, largo).
// Tap → apre l'app.

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class MetaboleWidget extends AppWidgetProvider {

    private static final String API = "https://metabole-backend.onrender.com/api/v1";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) apply(context, mgr, id, null, "Aggiorno…");
        new Thread(() -> {
            JSONObject data = null;
            try { data = load(context); } catch (Exception ignored) {}
            final JSONObject d = data;
            for (int id : ids) apply(context, mgr, id, d, d == null ? "Apri l'app Metabole" : null);
        }).start();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle newOptions) {
        // Su ridimensionamento ricarichiamo (il mapping per formato viene ricalcolato).
        new Thread(() -> {
            JSONObject data = null;
            try { data = load(context); } catch (Exception ignored) {}
            apply(context, mgr, id, data, data == null ? "Apri l'app Metabole" : null);
        }).start();
    }

    private JSONObject load(Context context) throws Exception {
        String token = context
                .getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                .getString("metabole_widget_token", null);
        if (token == null || token.isEmpty()) return null;
        HttpURLConnection conn = (HttpURLConnection) new URL(API + "/widget").openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            int code = conn.getResponseCode();
            if (code < 200 || code > 299) return null;
            BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return new JSONObject(sb.toString());
        } finally {
            conn.disconnect();
        }
    }

    // Applica la vista giusta in base alle dimensioni disponibili.
    private void apply(Context context, AppWidgetManager mgr, int id, JSONObject d, String placeholder) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Map<SizeF, RemoteViews> views = new HashMap<>();
            views.put(new SizeF(120f, 120f), build(context, R.layout.widget_square, d, placeholder));
            views.put(new SizeF(220f, 120f), build(context, R.layout.widget_rect, d, placeholder));
            views.put(new SizeF(250f, 220f), build(context, R.layout.widget_large, d, placeholder));
            mgr.updateAppWidget(id, new RemoteViews(views));
        } else {
            Bundle opt = mgr.getAppWidgetOptions(id);
            int minW = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0;
            int minH = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) : 0;
            int layout;
            if (minH >= 200 && minW >= 240) layout = R.layout.widget_large;
            else if (minW >= 200) layout = R.layout.widget_rect;
            else layout = R.layout.widget_square;
            mgr.updateAppWidget(id, build(context, layout, d, placeholder));
        }
    }

    private RemoteViews build(Context context, int layout, JSONObject d, String placeholder) {
        RemoteViews v = new RemoteViews(context.getPackageName(), layout);

        // Tap sull'intero widget → apre l'app.
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        String state = d != null ? d.optString("state", "inrotta") : "inrotta";
        v.setInt(R.id.widget_root, "setBackgroundResource", bgFor(state));
        setImage(v, R.id.widget_mascot, "buonanotte".equals(state) ? R.drawable.mascot_sleepy : R.drawable.mascot_happy);

        if (d != null) {
            setText(v, R.id.widget_greeting, d.optString("greeting", "Metabole"));
            setText(v, R.id.widget_phrase, "“" + d.optString("phrase", "") + "”");
            setText(v, R.id.widget_streak, "🔥 " + d.optInt("streak", 0) + " giorni");

            JSONObject water = d.optJSONObject("water");
            JSONObject steps = d.optJSONObject("steps");
            // Unità acqua scelta dal cliente: icona + valore come in dashboard.
            String waterUnit = d.optString("waterUnit", "glass");
            int perGlasses = waterUnitGlasses(waterUnit);
            setText(v, R.id.widget_water, water != null
                    ? waterVal(water.optInt("glasses"), perGlasses) + "/" + waterVal(water.optInt("goal"), perGlasses) : "0/8");
            setText(v, R.id.widget_water_icon, waterEmoji(waterUnit));
            setText(v, R.id.widget_steps, steps != null ? thousands(steps.optInt("steps")) : "0");

            JSONObject meal = d.optJSONObject("nextMeal");
            if (meal != null) {
                setText(v, R.id.widget_meal_label, "Prossimo pasto · " + slotLabel(meal.optString("slot")));
                setText(v, R.id.widget_meal_name, meal.optString("name"));
                setText(v, R.id.widget_meal_kcal, meal.optInt("kcal") + " kcal");
            } else {
                setText(v, R.id.widget_meal_label, "Prossimo pasto");
                setText(v, R.id.widget_meal_name, "Nessun pasto in programma");
                setText(v, R.id.widget_meal_kcal, "");
            }
        } else {
            setText(v, R.id.widget_greeting, "Metabole");
            setText(v, R.id.widget_phrase, placeholder != null ? placeholder : "");
            setText(v, R.id.widget_streak, "🔥 0");
            setText(v, R.id.widget_water, "0/8");
            setText(v, R.id.widget_steps, "0");
            setText(v, R.id.widget_meal_label, "Prossimo pasto");
            setText(v, R.id.widget_meal_name, "Apri l'app Metabole");
            setText(v, R.id.widget_meal_kcal, "");
        }
        return v;
    }

    // setTextViewText ma tollerante ai layout che non hanno quel campo (id assente → no-op sicuro).
    private void setText(RemoteViews v, int id, String text) {
        try { v.setTextViewText(id, text); } catch (Exception ignored) {}
    }

    private void setImage(RemoteViews v, int id, int res) {
        try { v.setImageViewResource(id, res); } catch (Exception ignored) {}
    }

    private int bgFor(String state) {
        switch (state) {
            case "buongiorno":
            case "acqua":
                return R.drawable.widget_bg_blue;
            case "passi":
                return R.drawable.widget_bg_orange;
            case "buonanotte":
                return R.drawable.widget_bg_dark;
            default:
                return R.drawable.widget_bg_teal;
        }
    }

    private String slotLabel(String slot) {
        switch (slot) {
            case "breakfast": return "Colazione";
            case "morning_snack": return "Spuntino";
            case "lunch": return "Pranzo";
            case "afternoon_snack": return "Merenda";
            case "dinner": return "Cena";
            default: return "Pasto";
        }
    }

    private String thousands(int n) {
        String s = Integer.toString(n);
        StringBuilder out = new StringBuilder();
        int c = 0;
        for (int i = s.length() - 1; i >= 0; i--) {
            out.insert(0, s.charAt(i));
            if (++c % 3 == 0 && i > 0) out.insert(0, '.');
        }
        return out.toString();
    }

    // ---- Unità acqua (stessa logica di app/src/lib/water.ts): 1 bicchiere = 250 ml.
    // glass=1, bottle05=2, bottle1=4, bottle15=6 bicchieri per unità.
    private int waterUnitGlasses(String unit) {
        switch (unit) {
            case "bottle05": return 2;
            case "bottle1": return 4;
            case "bottle15": return 6;
            default: return 1; // glass
        }
    }

    private String waterEmoji(String unit) {
        return "glass".equals(unit) ? "💧" : "🍶"; // goccia per i bicchieri, bottiglia per le bottiglie
    }

    // Converte i bicchieri nell'unità scelta: intero se tondo, altrimenti 1 decimale (virgola).
    private String waterVal(int glasses, int per) {
        if (per <= 1) return String.valueOf(glasses);
        double vv = (double) glasses / per;
        if (vv == Math.floor(vv)) return String.valueOf((int) vv);
        return String.format(java.util.Locale.ITALY, "%.1f", vv);
    }
}
