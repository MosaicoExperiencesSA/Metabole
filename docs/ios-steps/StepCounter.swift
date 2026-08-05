import Foundation
import Capacitor
import CoreMotion

/**
 * Contapassi iOS di Metabole (equivalente di docs/android-steps/StepCounter.java).
 *
 * Legge i passi di OGGI da CMPedometer (CoreMotion): dall'inizio della giornata
 * fino ad ora. A differenza di Android — dove il sensore TYPE_STEP_COUNTER è
 * cumulativo dall'ultimo riavvio e i "passi di oggi" li calcola il JS con una
 * baseline — qui CMPedometer restituisce GIÀ i passi di oggi, quindi lato JS
 * (app/src/lib/steps.ts) su iOS NON si applica la baseline.
 *
 * Richiede il permesso "Movimento e fitness": la chiave NSMotionUsageDescription
 * in Info.plist (aggiunta da scripts/install-ios.mjs) fa comparire il prompt di
 * sistema alla prima lettura. Se il conteggio non è disponibile o il permesso è
 * negato, restituisce { steps: 0, stale: true } e il JS ripiega sul backend.
 */
@objc(StepCounter)
public class StepCounter: CAPPlugin {
    private let pedometer = CMPedometer()

    @objc func getStepCount(_ call: CAPPluginCall) {
        guard CMPedometer.isStepCountingAvailable() else {
            call.resolve(["steps": 0, "stale": true])
            return
        }
        let start = Calendar.current.startOfDay(for: Date())
        pedometer.queryPedometerData(from: start, to: Date()) { data, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            let steps = data?.numberOfSteps.intValue ?? 0
            call.resolve(["steps": steps])
        }
    }
}
