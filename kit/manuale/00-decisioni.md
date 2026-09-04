# 00 · Le decisioni da prendere PRIMA di scrivere una riga

Undici caselle. Si compilano una volta, e da lì in poi non si ridiscutono più: ogni capitolo
successivo le dà per fatte. Compilare questa tabella è il primo atto del progetto.

## La scheda del progetto

| # | Decisione | Il tuo valore | Dove finisce nel codice |
|---|---|---|---|
| 1 | **Nome del prodotto** | `……………` | `<title>`, brand nella barra, mittente email |
| 2 | **Slug tecnico** (minuscolo, senza spazi) | `……………` | prefissi `localStorage`, nomi DB, cartelle |
| 3 | **Dominio** | `……………` | CORS, link nelle email, cookie |
| 4 | **Colore accento** (il primario) | `#……………` | `theme.css` → `--accent` |
| 5 | **Ruoli del progetto** | vedi sotto | `common/roles.ts` |
| 6 | **Lingua/e** | `……………` | `locale` sull'utente, i18n |
| 7 | **Valuta** | `……………` | importi in **centesimi**, sempre |
| 8 | **Il progetto vende qualcosa?** | sì / no | decide se monti il capitolo 08 |
| 9 | **C'è una rete di vendita a livelli?** | sì / no | decide se monti provvigioni e prelievi |
| 10 | **Hosting** (dove stanno i dati) | `……………` | GDPR: se tratti dati personali di europei, UE |
| 11 | **Dati sensibili** (sanitari, finanziari…) | sì / no | se sì: cifratura a riposo + audit log obbligatorio |

## Decisione 5 — i ruoli, spiegata

Il kit parte con **quattro ruoli neutri**. Non sono un suggerimento: sono la scelta che tiene in
piedi tutto il resto del kit, provvigioni comprese.

```ts
// backend/src/common/roles.ts
export const ROLES = ['user', 'staff', 'manager', 'admin'] as const;
```

| Ruolo | Chi è | Cosa vede di default |
|---|---|---|
| `user` | il cliente finale | solo la sua area |
| `staff` | chi lavora sui clienti | le sue schede, la sua agenda, i suoi compensi |
| `manager` | chi coordina lo staff | tutto lo staff sotto di sé + i suoi compensi |
| `admin` | chi amministra | tutto |

⚠️ **I ruoli di sistema sono quattro e non cambiano.** I mestieri veri del tuo progetto —
«nutrizionista», «agente», «tutor», «segreteria» — **non** diventano ruoli di sistema: diventano
**ruoli personalizzati** (tabella `custom_role`), che hanno un'etichetta, un colore e una loro riga
nella matrice dei permessi, ma poggiano su uno dei quattro.

Il motivo è preciso, ed è la cosa che in Metabole è costata di più: un ruolo di sistema in più è un
`enum` nel database, e ogni mestiere nuovo diventa **una migrazione**. Con i ruoli personalizzati il
mestiere nuovo si crea dalla pagina Ruoli, in trenta secondi, senza rilascio.

## Decisione 9 — la rete a livelli, spiegata

Se il progetto ha una rete di vendita, chi vende prende una percentuale e **chi sta sopra prende la
differenza** col livello sotto. Il kit la modella su **livelli numerici**, non su nomi di mestiere:

```
livello 1 (chi vende)      25%
livello 2 (chi coordina)   35%  →  incassa 35 − 25 = 10%
livello 3 (chi dirige)     45%  →  incassa 45 − 35 = 10%
```

A rete completa il costo totale è **45%**, non 25+35+45. Se il livello 2 manca, il livello 3 incassa
45 − 25 = 20%: la rete non regala e non buca.

⚠️ **Perché a livelli e non a mestieri.** In Metabole le percentuali sono cinque colonne con dentro
i nomi dei mestieri (`commission_coach_pct`, `commission_nutritionist_pct`…). Funziona, ma quel
giorno che nasce un mestiere nuovo servono una colonna, una migrazione e un giro in tutti i punti
che calcolano. Con i livelli, il mestiere nuovo è **una riga di configurazione**: dice a quale
livello sta, e le provvigioni non le tocca nessuno.

Nel kit un prodotto porta quindi:

```prisma
// Percentuali per LIVELLO: { "1": 25, "2": 35, "3": 45 }
commissionByLevel Json @default("{}") @map("commission_by_level")
```

e ogni persona dello staff ha il suo `level Int @default(1)`.

## Decisione 7 — gli importi, una regola sola

**Tutti gli importi si scrivono in centesimi, come interi.** Mai `Float`, mai `Decimal` "tanto è
uguale", mai euro con la virgola. `amountCents Int`. La conversione avviene in un posto solo, quando
si mostra il numero.

Il motivo è banale e universale: `0.1 + 0.2 !== 0.3` in virgola mobile, e uno storno di tre
centesimi in un registro contabile è un pomeriggio che non torna indietro.

## Decisione 11 — se ci sono dati sensibili

Se la risposta è sì, tre cose diventano **obbligatorie** e non facoltative:

1. **Cifratura a riposo** dei campi sensibili. Metabole usa AES-256-GCM con il formato
   `iv(12 byte) + authTag(16 byte) + ciphertext` salvato in una colonna `Bytes`. Le contabili dei
   pagamenti, le fatture dei costi e le ricevute dei prelievi stanno tutte così.
2. **Audit log su ogni lettura**, non solo su ogni scrittura. Chi ha guardato cosa, e quando.
   → [07-amministrazione.md](07-amministrazione.md)
3. **Hosting nel perimetro giusto** e nessuna chiave nel repository. Le connection string si
   inseriscono nei pannelli dei servizi, mai in un file versionato e mai in chat.

## Checklist di montaggio — capitolo 00

- [ ] La tabella in testa è compilata in tutte e undici le righe
- [ ] I ruoli di sistema sono quattro e i mestieri sono ruoli personalizzati
- [ ] La regola dei centesimi è scritta nel `CLAUDE.md` del progetto nuovo
- [ ] Se ci sono dati sensibili: cifratura, audit e hosting sono decisi PRIMA della prima tabella
