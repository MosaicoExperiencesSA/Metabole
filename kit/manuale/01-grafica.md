# 01 · La grafica: un posto solo per i colori

**Il principio.** Nessun colore si scrive dentro una pagina. Mai. Ogni pagina usa *variabili*, e le
variabili stanno in **un file solo**. Cambi quel file, cambiano tutte le pagine insieme — comprese
quelle che scriverai fra sei mesi.

Il costo di non farlo non è estetico: è che il giorno che il cliente dice «il verde è troppo acceso»
si aprono quarantadue file, se ne correggono trentotto, e le quattro dimenticate restano lì a
raccontare la palette vecchia in un angolo che nessuno guarda mai.

## Il file unico

`frontend/src/theme.css` — è tutto qui. Tre blocchi, in quest'ordine:

### Blocco 1 — le variabili di fabbrica (`:root`)

```css
:root {
  /* Identità */
  --accent: #12a386;        /* il colore del prodotto: bottoni, link attivi, selezioni */
  --accent-dark: #0e7c66;   /* la sua versione scura: hover, testo su chiaro */
  --deep: #10403a;          /* fondo della barra dei menu */

  /* Superfici */
  --bg: #faf8f3;            /* fondo della pagina */
  --card: #ffffff;          /* fondo delle card e dei pannelli */
  --line: #ece7de;          /* bordi e separatori */

  /* Testo */
  --ink: #16302c;           /* testo normale */
  --muted: #7c8c88;         /* testo secondario, etichette */

  /* Stati */
  --ok: #dcf0d8;    --ok-ink: #3b6d11;
  --danger: #c0392b; --danger-bg: #fbeee7;
  --chip: #dcebe3;  --chip-ink: #0e7c66;

  /* Forma */
  --radius: 16px;
  --shadow: 0 2px 8px rgba(16, 64, 58, 0.06);
  --shadow-hover: 0 8px 20px rgba(16, 64, 58, 0.12);
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  color-scheme: light;
}
```

⚠️ **Sono queste quindici variabili e basta.** La tentazione, al terzo mese, è aggiungerne una per
ogni sfumatura che serve («--verde-un-po-più-chiaro»). Non farlo: una palette con quaranta variabili
non è più una palette, è di nuovo il caso in cui i colori stanno sparsi — solo con un nome più
rispettabile. Se una sfumatura serve una volta sola, si ottiene con `color-mix()` o un `rgba()`
sull'accento, sul posto.

### Blocco 2 — i temi commutabili (`[data-theme]`)

Ogni tema **ridefinisce le stesse variabili**, non ne aggiunge di nuove:

```css
:root[data-theme="dark"] {
  --accent: #cba14e; --accent-dark: #e3c079; --deep: #0d0a06;
  --bg: #14110b; --card: #1e1810; --ink: #ece3d0; --muted: #a99d85;
  --line: #38301f; --chip: #2a2113; --chip-ink: #e6c98a;
  --ok: #202a12; --ok-ink: #c7d98a; --danger-bg: #3a1f1c;
  --shadow: 0 2px 8px rgba(0,0,0,.45); --shadow-hover: 0 10px 24px rgba(0,0,0,.6);
  color-scheme: dark;
}
```

**La regola dei tre posti.** Un tema esiste in tre punti, e se ne manca uno il difetto è silenzioso:

| Posto | Cosa contiene | Se manca |
|---|---|---|
| `theme.css` | il blocco `:root[data-theme="x"]` | il tema si salva ma la pagina resta senza colori |
| `theme.tsx` → `THEMES` | id, etichetta, i tre campioni | il tema c'è ma non compare nella scelta |
| backend → temi accettati | la lista degli id validi | si applica, e al ricaricamento torna indietro |

⚠️ Nessuno dei tre errori dà un messaggio. Si vede solo provando.

### Blocco 3 — le classi comuni

`.btn`, `.card`, `.nav-item`, `.topbar`, `.chip`, `.table`… scritte **solo** con le variabili sopra.
Il file completo è in `starter/frontend/src/theme.css`.

## Il commutatore (`theme.tsx`)

Tre cose, e sono tutte e tre necessarie:

1. **`THEMES`** — l'elenco dei temi con i tre campioni di colore che si vedono nella scelta:
   ```ts
   export const THEMES: ThemeDef[] = [
     { id: 'light', label: 'Chiaro',   bg: '#faf8f3', surface: '#ffffff', accent: '#12a386', text: '#16302c' },
     { id: 'dark',  label: 'Notturno', bg: '#14110b', surface: '#1e1810', accent: '#cba14e', text: '#ece3d0' },
   ];
   ```
2. **`ThemeProvider`** — applica il tema a `document.documentElement.dataset.theme`, lo tiene in
   `localStorage` per il caricamento immediato, e lo salva sull'account con
   `PATCH /me/account { theme }`.
   ⚠️ **L'account è la fonte di verità, `localStorage` è solo la cache.** Serve perché al primo
   pixel della pagina l'utente non è ancora caricato: senza cache si vede un lampo del tema
   sbagliato a ogni ricaricamento.
3. **`ThemePicker`** — la finestra che si apre **una volta sola**, al primo accesso, e mai più
   (`localStorage: <slug>_theme_picked`). Sceglierlo subito è quello che fa sentire il prodotto
   suo; riproporlo ogni volta è quello che lo fa sentire rotto.

## La personalizzazione a fondo (quando il progetto la vuole davvero)

Il kit arriva con i temi *predefiniti*. Se il progetto deve lasciar scegliere un colore qualunque —
non un tema fra sei — la strada è **una sola** e non è «aggiungere altri blocchi CSS»:

```tsx
// L'accento scelto dall'utente entra come variabile inline sull'elemento radice.
document.documentElement.style.setProperty('--accent', utente.accentColor);
```

e sull'account:

```prisma
theme        String  @default("light")  // il tema di base
accentColor  String?                    // se valorizzato, sovrascrive --accent
```

⚠️ **Un accento scelto a mano va verificato sul contrasto**, non accettato e basta. Il testo bianco
su un giallo scelto da un utente è illeggibile, e il difetto non lo vedrà mai chi l'ha scelto — lo
vedrà chi riceve il link. Regola: contrasto ≥ 4,5:1 sul fondo delle card, o si rifiuta il colore
proponendo la versione più scura più vicina.

## Il logo e il brand

- Un file solo: `public/brand/simbolo.png` (quadrato, fondo trasparente, ≥ 256px).
- Il nome del prodotto **una volta sola** in una costante, non scritto in venti componenti.
- Nella barra dei menu il simbolo va su un riquadro **bianco** con un po' di padding, non sul fondo
  scuro: quasi tutti i loghi sono disegnati per il bianco e sul fondo scuro si perdono i bordi.

## Checklist di montaggio — capitolo 01

- [ ] `theme.css` copiato, e le quindici variabili di `:root` cambiate con la tua palette
- [ ] Almeno due temi (chiaro e scuro) definiti nei **tre** posti: CSS, `THEMES`, backend
- [ ] `ThemeProvider` montato sopra il router, dentro il provider di autenticazione
- [ ] Il campo `theme` esiste sull'utente ed è salvato da `PATCH /me/account`
- [ ] `grep -rn "#[0-9a-fA-F]\{6\}" src/pages/` non trova **nessun** colore scritto a mano
- [ ] Il logo è in `public/brand/` e il nome del prodotto sta in una costante sola
