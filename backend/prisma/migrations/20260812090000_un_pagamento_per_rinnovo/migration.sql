-- UN PAGAMENTO PER FATTURA DI RINNOVO. Garantito dal database, non dal codice.
--
-- Il difetto: `handleInvoicePaid` controllava l'idempotenza con `findFirst` sul `psp_ref` e poi
-- creava la riga. Fra il controllo e la creazione non c'è niente che tenga: due `invoice.paid`
-- della stessa fattura che arrivano insieme — Stripe ritenta, e i webhook non arrivano in fila —
-- passano entrambi il controllo e scrivono **due pagamenti**. Con due pagamenti nascono due
-- provvigioni, e una provvigione pagata due volte si scopre solo quando qualcuno confronta i
-- compensi con gli incassi.
--
-- Non c'era nessun vincolo a impedirlo: `stripe_subscription_id` è unico, `psp_ref` no.
--
-- ## Perché un indice PARZIALE e non `UNIQUE` su tutta la colonna
--
-- `psp_ref` non contiene solo id di fattura: nel percorso di checkout ci finisce l'id della sessione
-- Stripe (alla creazione del pagamento) e poi il `payment_intent` (al completamento). Sono
-- riferimenti di natura diversa, scritti in momenti diversi, e non è detto che siano irripetibili fra
-- righe come lo è una fattura di rinnovo. Un vincolo su tutta la colonna metterebbe una regola che
-- non appartiene a quei casi, e il primo effetto sarebbe un checkout che smette di funzionare per
-- proteggere i rinnovi.
--
-- L'invariante vera è ristretta: **una fattura di rinnovo = un pagamento**. Ed è esattamente quello
-- che questo indice dice.
--
-- Nota per chi tocca lo schema Prisma: questo indice non è dichiarabile in `schema.prisma` (Prisma
-- non ha gli indici parziali), quindi vive solo qui. A runtime il database lo applica comunque e
-- Prisma traduce la violazione in `P2002`, che è ciò su cui si appoggia il codice.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_psp_ref_renewal_key"
  ON "payment" ("psp_ref")
  WHERE "billing_reason" = 'renewal' AND "psp_ref" IS NOT NULL;
