-- Le clienti hanno segnalato che la campanella diventa illeggibile: le notifiche si accumulano
-- all'infinito e non c'era modo di ripulirle. Si archivia, non si cancella: il messaggio sparisce
-- dalla campanella ma resta nel database, perché è anche la traccia di cosa il sistema ha
-- comunicato — se una cliente contesta un messaggio, lo staff deve poterlo ancora leggere.
ALTER TABLE "notification" ADD COLUMN "archived_at" TIMESTAMP(3);

-- La lettura della campanella filtra sempre per archiviate: senza indice diventa un seq scan
-- su tutta la tabella, che è fra le più grandi del sistema.
CREATE INDEX "notification_user_id_archived_at_idx" ON "notification"("user_id", "archived_at");
