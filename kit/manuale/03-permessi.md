# 03 · I permessi — il capitolo più importante del kit

**Si monta PRIMA delle pagine, non dopo.** Una pagina nata senza la sua chiave è una pagina che poi
non si può più togliere a nessuno senza un rilascio.

## La regola d'oro

> **Ogni pagina nuova ha una chiave di permesso SUA. Una voce di menu = una chiave.**

Riusare la chiave di un'altra pagina perché «tanto è lo stesso perimetro» lega due cose che da quel
momento **si concedono e si tolgono insieme** — e non si separano più senza un rilascio.

La domanda giusta non è «sono la stessa area?» ma **«c'è qualcuno a cui voglio dare l'una e non
l'altra?»**. Se la risposta è sì anche solo in un caso immaginabile, sono due chiavi.

Esempio vero, da Metabole: aprire la scheda di un cliente e *scrivergli il piano a mano* stavano
sotto la stessa chiave. Sono due poteri diversi — il secondo salta il motore, le sue soglie e i suoi
controlli — e separarli è costato un rilascio.

## La regola gemella (quella che si dimentica)

> **Una chiave nasce insieme alla guardia che la legge.**

Una chiave dichiarata e non letta da nessun endpoint è **un interruttore che non accende niente**.
Il difetto è silenzioso nel verso peggiore: compare nella matrice, un amministratore la accende
convinto di aver dato qualcosa, e non ha dato niente. Oppure la spegne convinto di aver tolto
qualcosa, e la porta è rimasta aperta.

In Metabole è successo due volte, e le due chiavi sono state **tolte** dall'elenco.
Il kit include il test che lo impedisce: `chiavi-senza-guardia.spec.ts`.

## I tre passi, e sono tutti e tre obbligatori

Una pagina nuova si aggiunge così. Se ne salti uno, il difetto non dà errore.

### 1 · La chiave — `backend/src/permissions/pages.ts`

```ts
export const BACKOFFICE_PAGES = [
  …,
  'nuova_pagina',   // ⚠️ con un commento che dice PERCHÉ è una chiave sua
] as const;

export const DEFAULT_PERMISSIONS: Record<Role, Partial<Record<PageKey, Perm>>> = {
  admin:   { …, nuova_pagina: { view: true, manage: true } },
  manager: { …, nuova_pagina: { view: true } },
  // staff e user: niente → di default non la vedono
};
```

⚠️ **Il default prudente è "niente".** Una pagina che nasce accesa per tutti è una pagina che
qualcuno vede prima che tu abbia deciso che deve vederla, e togliergliela dopo è una notifica di
sfiducia. Si nasce spenti e si accende a chi serve.

### 2 · L'etichetta — `frontend/src/lib/labels.ts`

```ts
export const PAGE_LABEL: Record<string, string> = {
  …,
  nuova_pagina: 'Nome che legge un umano',
};
```

Senza, nella tabella dei permessi compare **la chiave grezza** (`nuova_pagina`), e chi deve
concedere non sa cosa sta concedendo.

### 3 · La rotta, la voce di menu **e la guardia**

```tsx
// frontend/src/App.tsx
<Route path="/nuova-pagina" element={<NuovaPagina />} />

// frontend/src/components/Layout.tsx → NAV
{ key: 'nuova_pagina', label: 'Nome che legge un umano', to: '/nuova-pagina', icon: 'ti-…' },
```

```ts
// backend — LA GUARDIA, che è il passo che si dimentica
@RequirePage('nuova_pagina')
@Get('nuova-pagina')
async elenco() { … }
```

## Come funziona la guardia

```ts
export const RequirePage = (pageKey: string, level?: PageLevel) =>
  SetMetadata(PAGE_KEY, { pageKey, level });
```

Il livello, se non lo indichi, **si deduce dal metodo HTTP**: `GET` → `view`, tutto il resto →
`manage`. Nella maggior parte dei casi è quello che vuoi e non devi scrivere niente.

Lo indichi a mano quando la pagina non ha niente da leggere: una schermata che *compone* qualcosa
non ha una vista utile, e allora anche la `GET` va a `manage` — altrimenti chi ha solo `view` passa
la GET e non trova la porta.

## `view` e `manage`

Due livelli, non tre, non uno.

| Livello | Vuol dire |
|---|---|
| `view` | vede la pagina e legge i dati |
| `manage` | scrive: crea, modifica, approva, cancella |

⚠️ `manage` **non è** «un di più che diamo agli admin». È una decisione a sé: ci sono ruoli che
devono vedere la contabilità e non toccarla, e ruoli che devono approvare un bonifico senza vedere
l'anagrafica di chi paga.

## L'ereditarietà: due meccanismi diversi che si confondono

Quando **separi** una schermata in una chiave sua, c'è un problema: chi ce l'aveva dentro la pagina
madre se la vedrebbe sparire. Ci sono due modi di risolverlo, e **non** sono intercambiabili.

### `INHERIT_DEFAULTS` — il legame alla NASCITA

```ts
export const INHERIT_DEFAULTS: Partial<Record<PageKey, PageKey>> = {
  figlia: 'genitore',
};
```

Quando la riga della figlia **non esiste ancora**, vale la riga del genitore. Appena qualcuno
decide qualcosa sulla figlia, la figlia vive per conto suo. **È quasi sempre questo quello che
vuoi**: separare serve proprio a poterle poi distinguere.

⚠️ **Deve leggere la riga VERA del genitore, non il suo default.** In Metabole per settimane leggeva
il default, e la promessa era falsa nei due versi: a chi aveva la pagina accesa *a mano* la figlia
nasceva spenta; e — il verso che non si vede — a chi l'aveva *spenta* a mano la figlia nasceva
**accesa**. Un accesso in più non lo segnala nessuno.

⚠️ **Figlia e genitore devono essere tutti e due tipizzati `PageKey`.** Con la figlia `string`, un
errore di battitura compila, non eredita niente, e non lo dice nessuno.

### `PAGE_GRANTS` — il legame PERMANENTE (pagine "hub")

```ts
export const PAGE_GRANTS: Record<string, PageKey[]> = {
  hub: ['dominio_a', 'dominio_b'],
};
```

Chi ha `hub` può usare **anche** le API di `dominio_a` e `dominio_b`, per sempre. Serve quando una
pagina è un contenitore che lavora su più domini e non vuoi obbligare a dare anche le pagine dei
singoli cataloghi.

⛔ **Non usarlo per separare una schermata.** Il guardiano prova la chiave concessa *allo stesso
livello* della rotta: una riga `figlia: ['genitore']` farebbe passare la `GET` in vista, ma in
gestione farebbe passare anche `POST`, `PATCH` e `DELETE` del genitore. Ricrei **al contrario**
l'accoppiamento che stavi sciogliendo.

⛔ **Una pagina hub NON eredita** (`NON_EREDITANO`): concede più di quello che il suo genitore
concede, e ereditarne la riga le darebbe di aprire una porta che il genitore non apre.

## Il fail-open, e quando NON è ammesso

Se la lettura dei permessi fallisce (database che singhiozza), la guardia ha due comportamenti:

- **La rotta ha ancora un `@Roles` sotto** → si lascia passare. Un errore di lettura non deve
  chiudere fuori tutto lo staff da una pagina già protetta dal ruolo.
- **La rotta ha SOLO la chiave** → si chiude. Questo guardiano è l'unico cancello, e un cancello
  che si apre da solo quando il database tossisce non è un cancello.

⚠️ Questa distinzione in Metabole è nata da un difetto vero: due rotte gravi erano passate da
`@Roles('admin')` alla sola chiave, e con `RolesGuard` senza metadata **qualunque utente
autenticato** passava durante un blip di trenta secondi.

## I ruoli personalizzati

I ruoli di sistema sono quattro (capitolo 00). I mestieri del progetto sono righe in `custom_role`:

```prisma
model CustomRole {
  key       String @id
  label     String
  color     String?
  baseRole  Role   @map("base_role")   // su quale dei quattro poggia
}
```

Nella matrice dei permessi un ruolo personalizzato ha **la sua riga**, indipendente da quella del
ruolo base. Il ruolo base decide solo da cosa parte alla nascita.

## Le due tabelle

```prisma
model RolePagePermission {
  role      String   // ruolo di sistema O chiave di un ruolo personalizzato
  pageKey   String   @map("page_key")
  canView   Boolean  @default(false) @map("can_view")
  canManage Boolean  @default(false) @map("can_manage")
  @@id([role, pageKey])
}
```

⚠️ **`role` è `String` e non l'enum**, di proposito: deve poterci stare anche la chiave di un ruolo
personalizzato. Con l'enum ogni mestiere nuovo sarebbe una migrazione.

## I test che il kit porta con sé (non toglierli)

| Test | Cosa impedisce |
|---|---|
| `chiavi-senza-guardia.spec.ts` | una chiave dichiarata che nessun endpoint legge |
| `matrice-dice-la-verita.spec.ts` | una chiave senza etichetta, o un'etichetta senza chiave |
| `eredita-dal-genitore.spec.ts` | l'eredità che legge il default invece della riga vera |
| `porta-aperta-lo-stesso.spec.ts` | una rotta che resta aperta per un'altra strada |

Sono i quattro modi in cui un sistema di permessi mente. Ognuno di loro in Metabole ha trovato un
difetto vero.

## Checklist di montaggio — capitolo 03

- [ ] `pages.ts`, `permissions.service.ts`, `page.guard.ts`, `require-page.decorator.ts` copiati
- [ ] Le quattro spec copiate e verdi
- [ ] `BACKOFFICE_PAGES` contiene una chiave per **ogni** voce di `NAV`, e nessuna in più
- [ ] Ogni chiave ha la sua etichetta in `PAGE_LABEL`
- [ ] Ogni chiave è letta da almeno un `@RequirePage` (lo verifica il test)
- [ ] I default sono prudenti: si nasce spenti, si accende a chi serve
- [ ] La matrice dei permessi è raggiungibile da una pagina, e la pagina ha la sua chiave
