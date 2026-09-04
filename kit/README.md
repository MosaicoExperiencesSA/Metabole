# KIT DI MONTAGGIO — la base comune di un progetto nuovo

Questo è il **manuale + i pezzi** per far partire un progetto nuovo senza ridecidere ogni volta le
stesse dodici cose. La piattaforma di riferimento è **Metabole**: quello che sta qui dentro è già
girato in produzione lì, con i suoi errori già pagati.

## Cosa ci trovi

```
kit/
├── README.md                    ← sei qui: indice e ordine di montaggio
├── manuale/
│   ├── 00-decisioni.md          Le scelte da fare PRIMA di scrivere una riga
│   ├── 01-grafica.md            Un posto solo per i colori, e i temi commutabili
│   ├── 02-gabbia.md             Header, barra dei menu, contenitore delle pagine
│   ├── 03-permessi.md           ⚠️ La regola d'oro: una pagina = una chiave SUA
│   ├── 04-identita.md           Registrazione, verifica mail, login, password
│   ├── 05-email-utente.md       Cambio mail, doppia mail, scelta della principale
│   ├── 06-profilo.md            La scheda Impostazioni / profilo utente
│   ├── 07-amministrazione.md    Utenti · Ruoli · Permessi · Log attività · Lista lavori
│   ├── 08-commerciale.md        Negozio · Acquisti · Bonifici · Buoni sconto ·
│   │                            Compensi staff · Contabilità · % Provvigioni · Prelievi
│   └── 09-checklist.md          La sequenza di montaggio, da spuntare
└── starter/                     I file da copiare, già ripuliti
    ├── frontend/
    ├── backend/
    └── prisma/
```

## Le due categorie di pezzi (importante)

Il kit **non** è tutto allo stesso livello di finitura, e dirlo è più onesto che far finta di sì:

| Pezzo | Nel kit c'è | Cosa devi fare |
|---|---|---|
| Grafica e temi | **Il file vero**, ripulito | Copiare, cambiare la palette |
| Gabbia (header + menu) | **Il file vero**, ripulito | Copiare, riempire `NAV` |
| Permessi / ruoli | **I file veri**, ripuliti | Copiare, scrivere le tue chiavi |
| Identità (registrazione, verifica, cambio mail) | **I file veri**, ripuliti | Copiare, collegare il mailer |
| Modelli dati (Prisma) | **Lo schema vero** | Copiare i modelli che ti servono |
| Pagine amministrazione | Contratto API + schema + istruzioni | Copiare le pagine da Metabole |
| Pagine commerciali | Contratto API + schema + istruzioni | Copiare le pagine da Metabole |

Il motivo della differenza: negozio, contabilità e provvigioni in Metabole sono **intrecciati** con
i suoi abbonamenti, i suoi piani e le sue clienti. Estrarli "puliti" vorrebbe dire riscriverli, e un
pezzo riscritto e mai girato non è una base: è un debito con la faccia di una base. Per quelli il
kit ti dà **la mappa esatta** — modelli, endpoint, file da cui copiare — e il capitolo che spiega
cosa cambiare mentre copi.

## L'ordine di montaggio (non è negoziabile)

L'ordine conta perché ogni passo si appoggia al precedente. Saltarne uno costa un rilascio.

1. **[Decisioni](manuale/00-decisioni.md)** — nome, ruoli, dominio, hosting, valuta.
2. **[Grafica](manuale/01-grafica.md)** — la palette prima di qualunque pagina: le pagine scritte
   con i colori a mano non si recuperano più.
3. **[Permessi](manuale/03-permessi.md)** — *prima* delle pagine, non dopo. Una pagina nata senza
   la sua chiave è una pagina che poi non si può togliere a nessuno senza un rilascio.
4. **[Gabbia](manuale/02-gabbia.md)** — header e menu, con le voci già agganciate alle chiavi.
5. **[Identità](manuale/04-identita.md)** — registrazione, verifica mail, login.
6. **[Email utente](manuale/05-email-utente.md)** — cambio mail e doppia mail.
7. **[Profilo](manuale/06-profilo.md)** — la scheda Impostazioni.
8. **[Amministrazione](manuale/07-amministrazione.md)** — Utenti, Ruoli, Permessi, Log, Lavori.
9. **[Commerciale](manuale/08-commerciale.md)** — solo se il progetto vende qualcosa.
10. **[Checklist](manuale/09-checklist.md)** — la rilettura finale.

## Le tre regole che valgono per tutto il kit

Sono le tre che in Metabole sono costate di più:

1. **Una pagina nuova = una chiave di permesso SUA.** Mai riusare la chiave di un'altra pagina
   perché «è lo stesso perimetro»: lega due cose che poi si concedono e si tolgono insieme.
   → [03-permessi.md](manuale/03-permessi.md)
2. **Una chiave nasce insieme alla guardia che la legge.** Una chiave dichiarata e non letta da
   nessuno è un interruttore che non accende niente — e chi lo accende crede di aver dato qualcosa.
3. **Una modifica si verifica RILEGGENDO il file**, non fidandosi dell'uscita del comando. Uno
   script che non parte non stampa niente, e «niente» somiglia troppo a «tutto bene».

## Come si usa, in pratica

```
cp -R kit/ /percorso/del/progetto/nuovo/base/
```

Poi si apre `manuale/00-decisioni.md`, si compila la tabella in testa, e si scende.
Ogni capitolo finisce con una **checklist di montaggio**: se le spunti tutte, quel pezzo è a posto.
