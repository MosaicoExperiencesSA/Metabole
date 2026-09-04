# starter/ — i file da copiare

Trentacinque file estratti da Metabole e ripuliti. Ognuno ha in testa un blocco che dice a quale
capitolo del manuale appartiene e cosa devi cambiare mentre lo copi.

⚠️ **I commenti lunghi dentro i file sono tenuti apposta.** Raccontano decisioni prese e difetti
già pagati: sono il motivo per cui quel file è fatto così. Toglierli mentre adatti è il modo più
rapido per rifare gli stessi errori fra sei mesi.

## Cosa è stato cambiato rispetto a Metabole

| Cosa | Prima | Adesso |
|---|---|---|
| Variabili colore | `--teal`, `--teal-dark` | `--accent`, `--accent-dark` |
| Prefissi `localStorage` | `metabole_bo_*` | `app_bo_*` |
| Nome nel brand | `MetaboleAI` | `NOME_APP` |
| Ruoli | nove, coi mestieri dentro | quattro neutri (`roles.ts` riscritto) |
| Chiavi permesso | quaranta, del dominio | quelle comuni (`pages.ts` riscritto) |
| `NAV` | le voci di Metabole | uno scheletro con i gruppi comuni |
| `Layout.tsx` | con `OverdueGate` | tolto (era specifico) |
| Provvigioni | cinque colonne coi mestieri | una colonna `commissionByLevel` |

## Cosa c'è, file per file

### `frontend/`

| File | Capitolo | Da fare |
|---|---|---|
| `src/theme.css` | 01 | sostituire la palette di `:root` |
| `src/theme.tsx` | 01 | ridurre `THEMES` ai temi che vuoi davvero |
| `src/components/Layout.tsx` | 02 | riempire `NAV`, cambiare il brand |
| `src/components/ui.tsx` | 02 | niente |
| `src/components/UserMenu.tsx` | 06 | controllare le voci |
| `src/lib/labels.ts` | 03 | un'etichetta per ogni chiave |
| `src/lib/menuOrder.ts` | 02 | solo se lasci riordinare il menu |
| `src/auth/AuthContext.tsx` | 04 | niente |
| `src/api/client.ts` | 04 | la base URL |

### `backend/`

| File | Capitolo | Da fare |
|---|---|---|
| `prisma/schema-kit.prisma` | 04·07·08 | tenere i modelli che servono, aggiungere il dominio |
| `src/common/roles.ts` | 00 | **niente**: i ruoli restano quattro |
| `src/common/decorators/*` | 03·04 | niente |
| `src/common/guards/page.guard.ts` | 03 | niente — è il cuore dei permessi |
| `src/common/guards/{roles,jwt-auth}.guard.ts` | 03·04 | niente |
| `src/permissions/pages.ts` | 03 | **le chiavi del tuo dominio** |
| `src/permissions/*.ts` | 03 | niente |
| `src/permissions/*.spec.ts` | 03 | adattare alle tue chiavi, **non togliere** |
| `src/auth/auth.{service,controller}.ts` | 04·05 | togliere ciò che tocca modelli che non hai |
| `src/audit/*` | 07 | niente |

## Cosa NON c'è (e dove trovarlo)

Il blocco commerciale — negozio, acquisti, bonifici, buoni sconto, compensi, contabilità,
provvigioni, prelievi — **non** è qui in forma ripulita. In Metabole è intrecciato con abbonamenti e
piani, ed estrarlo "pulito" vorrebbe dire riscriverlo: cioè consegnarti codice mai girato, che è un
debito con la faccia di una base.

Quello che il kit ti dà per quel blocco:

- **lo schema completo** in `prisma/schema-kit.prisma` (con le provvigioni già a livelli);
- **la mappa file per file** in fondo a `kit/manuale/08-commerciale.md`;
- **le quattro sostituzioni** da fare mentre copi, elencate lì.

## Stato delle verifiche

- ✅ Nessun riferimento residuo a `metabole_bo_`, `MetaboleAI`, `--teal` nei file dello starter
- ✅ `schema-kit.prisma`: 19 modelli, relazioni tutte bidirezionali, `@relation(fields:)` coerenti
  (controllo strutturale)
- ⚠️ `prisma validate` **non** è stato eseguito: la rete verso `binaries.prisma.sh` è bloccata da
  qui. Lancialo tu al primo montaggio:
  ```
  npx prisma validate --schema prisma/schema-kit.prisma
  ```
- ⚠️ I file `.ts`/`.tsx` non sono compilati in isolamento: importano da percorsi del progetto
  (`../common/roles`, `../api/client`) che esistono solo una volta montati. È previsto: lo starter
  è materiale da copiare dentro un progetto, non un pacchetto che gira da solo.
