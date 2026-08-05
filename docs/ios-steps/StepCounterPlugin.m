#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registra il plugin locale StepCounter (contapassi iOS) ed espone il metodo
// getStepCount. Il nome JS "StepCounter" combacia con registerPlugin('StepCounter')
// in app/src/lib/steps.ts. La macro CAP_PLUGIN auto-registra il plugin all'avvio,
// quindi non serve modificare AppDelegate (a differenza di Android/MainActivity).
CAP_PLUGIN(StepCounter, "StepCounter",
    CAP_PLUGIN_METHOD(getStepCount, CAPPluginReturnPromise);
)
