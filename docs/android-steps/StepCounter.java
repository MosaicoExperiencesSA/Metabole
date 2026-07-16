package app.metabole.client;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Contapassi nativo di Metabole. Legge il sensore hardware TYPE_STEP_COUNTER
 * (passi cumulativi dall'ultimo riavvio del telefono). Il calcolo dei "passi di
 * oggi" (delta rispetto a una baseline di mezzanotte) è fatto lato JS.
 *
 * Chiede il permesso ACTIVITY_RECOGNITION (Android 10+) alla prima lettura.
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class StepCounter extends Plugin {

    @PluginMethod
    public void getStepCount(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && getPermissionState("activity") != PermissionState.GRANTED) {
            requestPermissionForAlias("activity", call, "permCallback");
            return;
        }
        readSensor(call);
    }

    @PermissionCallback
    private void permCallback(PluginCall call) {
        if (getPermissionState("activity") == PermissionState.GRANTED) {
            readSensor(call);
        } else {
            call.reject("Permesso attività negato");
        }
    }

    private void readSensor(final PluginCall call) {
        final SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        final Sensor stepSensor = sm != null ? sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) : null;
        if (stepSensor == null) {
            call.reject("Sensore contapassi non disponibile su questo dispositivo");
            return;
        }

        final boolean[] done = { false };
        final Handler handler = new Handler(Looper.getMainLooper());

        final SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (done[0]) return;
                done[0] = true;
                long steps = (long) event.values[0];
                sm.unregisterListener(this);
                JSObject ret = new JSObject();
                ret.put("steps", steps);
                call.resolve(ret);
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };

        sm.registerListener(listener, stepSensor, SensorManager.SENSOR_DELAY_UI);

        // Se il sensore non emette entro 4s (nessun passo di recente), restituiamo
        // comunque un valore: il counter è cumulativo, quindi 0 solo se davvero fermo/nuovo.
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (done[0]) return;
                done[0] = true;
                sm.unregisterListener(listener);
                JSObject ret = new JSObject();
                ret.put("steps", 0L);
                ret.put("stale", true);
                call.resolve(ret);
            }
        }, 4000);
    }
}
