package app.metabole;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity di Metabole. Rispetto al default Capacitor registra il plugin
 * locale StepCounter (contapassi). Questo file sovrascrive quello generato da
 * Capacitor a ogni build tramite scripts/install-steps.mjs.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StepCounter.class);
        super.onCreate(savedInstanceState);
    }
}
