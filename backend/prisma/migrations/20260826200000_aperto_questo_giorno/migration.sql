-- «Visto» voleva dire «gliel'abbiamo mostrato», non «l'ha aperto»: due domande sotto un nome solo.
-- `aperto_dalla_cliente_il` risponde alla seconda, e `aperture_tracciate` dice se di quel giorno
-- possiamo saperlo (cioè se la sua app, quando il menu è stato composto, sapeva già dirlo).
-- ⚠️ Le tre colonne sono additive, MA IL COMPORTAMENTO CAMBIA IL GIORNO DEL DEPLOY, e va detto:
-- `aperture_tracciate` nasce `false` su OGNI riga esistente, quindi per un paio di giorni — finché
-- le app non mandano il segnale e le giornate nuove non nascono tracciate — di quasi tutti i giorni
-- già in calendario la risposta è «non lo so». Nessun menu viene tolto di mano a nessuno (si degrada
-- sempre verso «non tocco»), ma i rifacimenti automatici si fermano e Vera lo dice a voce in tutti i
-- percorsi. Una migrazione che si dichiara innocua mentre sospende una funzione è la ragione falsa
-- peggiore: la legge chi decide se rilasciare di venerdì.
ALTER TABLE "menu_day" ADD COLUMN "aperto_dalla_cliente_il" TIMESTAMP(3);
ALTER TABLE "menu_day" ADD COLUMN "aperture_tracciate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "client_profile" ADD COLUMN "aperture_dal" TIMESTAMP(3);

-- ⚠️ NESSUN INDICE NUOVO, ed è una scelta. La prima stesura ne aggiungeva uno su
-- ("client_id","aperture_tracciate") «perché la domanda gira a ogni divieto» — ma le due domande
-- che filtrano davvero su queste colonne partono sempre da una cliente e da una data
-- (RegistroService.menuDaRifare, scriviGiornataDettata), e l'indice ("client_id","date") che c'è
-- già le copre. La ricerca per dieta invece filtra su "diet_id", che con queste colonne non
-- c'entra niente. Un indice in più su una tabella che si scrive a ogni erogazione costa a ogni
-- riga, per sempre: si aggiunge quando una query lenta lo chiede, non quando sembra.
