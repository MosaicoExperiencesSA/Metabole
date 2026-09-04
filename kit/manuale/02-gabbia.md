# 02 · La gabbia: header, barra dei menu, contenitore

**Il principio.** Una pagina nuova non disegna niente intorno a sé. Scrive il suo contenuto e lo
consegna alla gabbia:

```tsx
export default function PaginaNuova() {
  return (
    <Layout title="Titolo della pagina">
      …il contenuto, e nient'altro…
    </Layout>
  );
}
```

Tutto il resto — barra laterale, titolo in alto, campanella delle notifiche, menu utente, avviso di
impersonificazione — lo mette la gabbia. Una pagina che si ridisegna l'header è una pagina che
domani resterà indietro quando l'header cambia.

## I quattro pezzi

```
┌────────────┬──────────────────────────────────────────────┐
│            │  topbar:  ☰  Titolo        🔔  👤 menu utente │
│  sidebar   ├──────────────────────────────────────────────┤
│            │                                              │
│  brand     │  content:  {children}                        │
│  gruppi    │                                              │
│  voci      │                                              │
│            │                                              │
│  Esci      │                                              │
└────────────┴──────────────────────────────────────────────┘
```

| Pezzo | File | Cosa fa |
|---|---|---|
| `Layout` | `components/Layout.tsx` | il contenitore, e la mappa `NAV` |
| `UserMenu` | `components/UserMenu.tsx` | avatar, nome, ruolo, Impostazioni, Esci |
| `NotificationBell` | `components/NotificationBell.tsx` | pallino con il numero, elenco a tendina |
| `ui` | `components/ui.tsx` | `Card`, `Btn`, `Chip`, `Table`, `Modal`… i mattoni |

## `NAV`: l'unico posto dove si dichiara una voce di menu

```ts
export const NAV: NavSection[] = [
  {
    group: 'Amministrazione',
    items: [
      { key: 'users',      label: 'Utenti',       to: '/utenti',   icon: 'ti-id-badge-2' },
      { key: 'roles',      label: 'Ruoli',        to: '/ruoli',    icon: 'ti-shield-half' },
      { key: 'audit_logs', label: 'Log attività', to: '/log',      icon: 'ti-history' },
    ],
  },
];
```

Quattro campi, e il primo è quello che conta:

- **`key`** — è la **chiave di permesso** della pagina (capitolo 03). La barra mostra la voce solo
  se `can(key)`. Non c'è nessun altro modo di nascondere una voce, e non deve essercene.
- **`label`** — quello che legge l'utente. ⚠️ Che non sia il nome di un ruolo: una voce che si
  chiama «Attività coach» si legge come «non è roba mia» anche da chi la deve aprire.
- **`to`** — la rotta. La stessa stringa che sta in `App.tsx`.
- **`icon`** — Tabler Icons (`ti ti-*`). Una voce senza icona in mezzo a voci con l'icona si legge
  come un errore di caricamento.

### I gruppi

Un gruppo è o **un titolo** (sempre aperto) o **una fisarmonica** (`collapsible: true`).

⚠️ Il rovescio della fisarmonica, da sapere prima di usarla: una pagina dentro un gruppo chiuso è
**invisibile** finché non ci si ricorda che quel gruppo esiste. Quando arriva un «non trovo più X»,
è il primo posto dove guardare. Fisarmonica solo per i gruppi lunghi e usati di rado.

### Se lasci riordinare il menu all'utente

Metabole lo fa (`GET/PATCH /me/preferences` → `menuOrder`), e ci sono due trappole già pagate:

1. **La barra deve ridisegnarsi quando cambia la preferenza**, non solo al montaggio. Serve un
   evento (`window.dispatchEvent`) più un listener su `storage` per le altre schede aperte.
   Senza, si sposta una voce, la card si aggiorna, la barra no — e sembra che l'interruttore sia
   rotto.
2. **L'icona del gruppo segue le VOCI, non il titolo.** Se la cerchi per titolo, chi rinomina
   «CRM» in «Vendite» si vede sparire l'icona senza capire perché: ha rinominato un gruppo, mica
   toccato le icone.

## La topbar

Tre elementi e nient'altro: il pulsante che apre e chiude la barra, il **titolo della pagina**
(quello passato a `Layout`), e a destra la campanella più il menu utente.

⚠️ **Le Impostazioni stanno nel menu utente, non nella barra laterale.** La barra è per il lavoro;
le impostazioni sono per sé stessi. Metterle in mezzo alle pagine di lavoro le fa cercare a tutti
nel posto sbagliato per il primo mese.

## La striscia di impersonificazione

Se il progetto ha «entra come» (capitolo 07), la gabbia mostra **sempre** una striscia colorata in
cima che dice con gli occhi di chi stai guardando, se è in sola lettura, e quando scade. Non è
decorazione: senza, un amministratore dimentica di essere dentro l'account di un altro e scrive.

## `ui.tsx`: i mattoni

Un file solo con `Card`, `Btn`, `Chip`, `Field`, `Table`, `Modal`, `Empty`, `Spinner`.
La regola è la stessa dei colori: se un pattern serve in due pagine, va qui. Se sta in due pagine
copiato, fra un mese sono due pattern diversi.

## Checklist di montaggio — capitolo 02

- [ ] `Layout.tsx`, `UserMenu.tsx`, `ui.tsx` copiati dallo starter
- [ ] `NAV` riempito, e **ogni** voce ha una `key` che esiste nelle chiavi di permesso
- [ ] Ogni rotta in `App.tsx` ha la sua voce in `NAV` (o è deliberatamente una pagina figlia)
- [ ] Il brand nella barra usa il logo e la costante del nome, non testo scritto a mano
- [ ] Le Impostazioni sono nel menu utente, non nella barra laterale
- [ ] Nessuna pagina disegna un proprio header: `grep -rn "topbar\|<header" src/pages/` è vuoto
