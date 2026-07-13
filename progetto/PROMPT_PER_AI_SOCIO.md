# Prompt da dare all'AI del socio (Team Prodotto)

Copia tutto il testo qui sotto (il blocco tra le righe) e incollalo come primo messaggio nella chat
con la tua AI ogni volta che iniziate a lavorare al progetto Metabole.

---

```
Lavori al progetto Metabole. Nel repository c'è una cartella "progetto/" che è la fonte di verità
condivisa tra il mio team (Prodotto: prototipi, design, voci di Gaia, specifiche motore/agente AI,
analisi, CRM) e il team di sviluppo. Da adesso segui queste regole.

1) A INIZIO SESSIONE, prima di fare qualsiasi cosa, leggi in quest'ordine:
   - progetto/ISTRUZIONI_PER_AI.md (le regole operative complete)
   - progetto/README.md (indice di tutte le specifiche)
   - progetto/STATO.md (stato attuale del progetto e piano a 10 fasi)
   - progetto/REGISTRO.md (cosa è stato fatto di recente; le voci in alto sono le più nuove)
   Così parti allineato con quello che ha già fatto l'altro team e non rifai cose fatte.

2) DOPO OGNI MODIFICA che fai (prototipo, specifica, voce, analisi…), aggiorna il diario
   NELLO STESSO commit:
   - aggiungi una riga IN CIMA a progetto/REGISTRO.md nel formato:
     AAAA-MM-GG · [Prodotto] · area — cosa hai cambiato (1-2 righe)
   - se la modifica cambia lo stato di un'area, aggiorna la voce in progetto/STATO.md.
   Marca sempre il tuo lavoro come [Prodotto].

3) Se una tua modifica ha impatto sullo sviluppo (es. una nuova schermata che richiede un endpoint,
   o un campo dati nuovo), scrivilo nel REGISTRO così lo sviluppo lo vede.

4) Regole tecniche da rispettare sempre:
   - chiavi e segreti: mai nel repository né in chat (solo nei pannelli dei servizi).
   - la cartella docs/ è PUBBLICA (GitHub Pages): lì solo i prototipi HTML + asset. I documenti
     interni/di business/analisi restano nella root o in progetto/, mai in docs/.
   - per aggiornare la demo pubblica, copia il prototipo aggiornato in docs/ e fai commit+push.

In sintesi: leggi STATO.md + REGISTRO.md per capire dove siamo, fai il tuo lavoro, e prima di
chiudere aggiorna quei due file con quello che hai fatto, marcato [Prodotto].
```

---

Nota: le stesse regole, in versione estesa, sono in `progetto/ISTRUZIONI_PER_AI.md` (valido per
entrambe le AI). Questo file serve solo ad avere il prompt pronto da copiare.
