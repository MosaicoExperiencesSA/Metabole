-- ABBONAMENTI RICORRENTI (Stripe subscription) — voce #10 e listino del 6/8.
--
-- Fino a oggi ogni acquisto era una-tantum: `stripe.service` creava sempre una sessione con
-- `mode: 'payment'`, e un rinnovo era un secondo acquisto fatto a mano. Il mantenimento (€49/mese)
-- e il monitoraggio (€19/mese) vivono di addebito automatico, quindi serve la modalità
-- abbonamento — accanto a quella esistente, che NON cambia: i percorsi 1/3/6 mesi restano
-- una-tantum e continuano a funzionare esattamente come prima.
--
-- `plan.billing` — come si vende quel piano:
--   one_time   percorsi: si paga una volta (comportamento di sempre, quindi è il default)
--   recurring  monitoraggio: solo abbonamento
--   both       mantenimento: la cliente sceglie fra abbonamento e mese singolo
-- È una colonna e non due booleani perché i tre casi sono mutuamente esclusivi: con due flag
-- esisterebbe la combinazione "né l'uno né l'altro", che non vuol dire niente e prima o poi
-- qualcuno la salva.
--
-- `subscription.stripe_subscription_id` — l'abbonamento dal lato di Stripe. UNICO: è la chiave con
-- cui i webhook dei rinnovi (`invoice.paid`) ritrovano il nostro abbonamento. Senza il vincolo,
-- un doppio inserimento produrrebbe due righe e i rinnovi ne aggiornerebbero una a caso.
--
-- `subscription.cancel_at_period_end` — disdetta chiesta dalla cliente (decisione 7/8: si disdice
-- dall'app, in autonomia). NON interrompe niente subito: i menu continuano fino alla scadenza già
-- pagata, ed è per questo che serve un flag e non una cancellazione immediata.
--
-- `subscription.last_payment_failed_at` — primo rifiuto della carta nella serie di tentativi di
-- Stripe. Serve a distinguere "carta rifiutata una volta" da "cliente che non paga più", e a non
-- rimandare la stessa email a ogni tentativo.

ALTER TABLE "plan" ADD COLUMN "billing" TEXT NOT NULL DEFAULT 'one_time';

ALTER TABLE "subscription" ADD COLUMN "stripe_subscription_id" TEXT;
ALTER TABLE "subscription" ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription" ADD COLUMN "last_payment_failed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "subscription_stripe_subscription_id_key"
  ON "subscription"("stripe_subscription_id");

-- `payment.billing_reason` — perché è nato questo pagamento:
--   NULL/first  primo addebito o acquisto una-tantum
--   renewal     rinnovo automatico dell'abbonamento
-- Le provvigioni sul rinnovo si pagano SOLO se la coach è ancora quella assegnata (decisione
-- 6/8), quindi il motore deve poter distinguere i due casi: senza questa colonna un rinnovo è
-- indistinguibile da un primo acquisto e la condizione non si potrebbe applicare.
ALTER TABLE "payment" ADD COLUMN "billing_reason" TEXT;

-- `pause_request.rientro_menus_at` — quando sono stati erogati i menu di rientro al termine di
-- una pausa. I menu di rientro NON si vendono più (decisione Simone 7/8: erano un prodotto a €29,
-- ora sono inclusi): chi torna da una sospensione con qualche chilo in più se li trova in app,
-- senza chiedere e senza pagare. La colonna serve solo a non rierogarli a ogni giro del cron.
ALTER TABLE "pause_request" ADD COLUMN "rientro_menus_at" TIMESTAMP(3);
