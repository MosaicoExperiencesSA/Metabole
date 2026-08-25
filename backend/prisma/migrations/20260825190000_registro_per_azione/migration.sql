-- «Di quando è questo elenco» si chiede a ogni apertura della pagina «Alimenti da correggere», e si
-- chiede per `action`. Senza indice quella domanda costa una scansione di TUTTO il registro proprio
-- quando la riga non c'è — cioè nello stato che la domanda esiste per raccontare.
-- ⚠️ CONCURRENTLY no: `prisma migrate` gira dentro una transazione, e lì non si può.
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");
