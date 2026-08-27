# Istruzioni: pagine «Modelli email» e «Log email» + configurazione invio

> Da consegnare a un altro agente che lavora su un **progetto nuovo con lo stesso stack di
> Metabole**: NestJS + TypeScript + Prisma (PostgreSQL) sul backend, React + Vite + TypeScript sul
> backoffice, auth JWT con ruoli e permessi per pagina.
>
> Il testo descrive **come è fatto in Metabole** e **perché**: dove c'è scritto ⚠️ è una cosa che in
> Metabole è costata un bug o un giro di correzioni, non un'opinione di stile.

---

## 0. Cosa si costruisce (tre pezzi, in quest'ordine)

| # | Pezzo | Serve a |
|---|-------|---------|
| 1 | **Servizio di invio** (`MailService`) + tabella `email_log` | mandare le email e **registrare ogni tentativo**, riuscito o no |
| 2 | **Pagina «Modelli email»** (`email_template` + CRUD admin) | far riscrivere i testi delle email **senza deploy**, con anteprima |
| 3 | **Pagina «Log email»** | far vedere a chi assiste i clienti *cosa è partito davvero*, con l'anteprima del corpo |

In più, la **configurazione dell'invio**, che in Metabole è doppia e va tenuta distinta:

- **A. Transazionali di sistema** → API HTTP di **Brevo** (`https://api.brevo.com/v3/smtp/email`),
  chiave in variabile d'ambiente. È il canale delle email che scrive *il software*.
- **B. Casella di posta dell'operatore** → **IMAP + SMTP** con le credenziali *della persona*,
  salvate cifrate. È il canale delle email che scrive *un umano dal backoffice*.

⚠️ Non unificarli. Sono due cose diverse: la A non ha una persona dietro (il mittente è
`no-reply@`), la B sì (il mittente è `mario@azienda.it` e la cliente risponde a lui). In Metabole
condividono **solo** la tabella `email_log`, così il «Log email» è l'unico posto dove guardare.

---

## 1. Modello dati (Prisma)

```prisma
/// Testi delle email, modificabili dall'admin. {{var}} = segnaposto.
model EmailTemplate {
  key         String   @id            // es. payment_receipt, password_reset
  name        String                  // come si legge in elenco
  subject     String
  bodyHtml    String   @map("body_html")
  active      Boolean  @default(true) // false = si usa il testo predefinito nel codice
  updatedById String?  @map("updated_by_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt      @map("updated_at")

  @@map("email_template")
}

/// Ogni email TENTATA: anche quelle fallite e quelle non partite.
model EmailLog {
  id          String   @id @default(uuid())
  to          String
  templateKey String?  @map("template_key")
  subject     String
  bodyHtml    String?  @map("body_html")   // il corpo reso, per l'anteprima
  status      String                        // sent | failed | skipped
  error       String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("email_log")
}

/// Casella di posta personale dell'operatore (pezzo B).
model MailAccount {
  id          String   @id @default(uuid())
  userId      String   @unique @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  email       String                          // indirizzo completo della casella
  encPassword String   @map("enc_password")   // password cifrata (base64), MAI in chiaro
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt      @map("updated_at")

  @@map("mail_account")
}
```

Note che valgono più del codice:

- **`key` è la chiave primaria del modello, non un id autogenerato.** È la stessa stringa che il
  codice passa quando manda quell'email. Un modello con la chiave sbagliata è un testo che non
  legge nessuno: esiste in elenco, si può modificare, e non cambia niente. ⚠️ In Metabole è
  successo, e nessuno se n'è accorto per giorni.
- **`bodyHtml` sul log**: senza il corpo, la pagina Log risponde solo «è partita». Con il corpo,
  risponde a «cosa le è arrivato», che è la domanda che fa davvero chi assiste una cliente. Le
  righe registrate prima di aggiungere la colonna avranno `null`: la pagina deve dirlo, non
  mostrare un riquadro vuoto.
- **`status = 'skipped'`** è uno stato vero, non un errore: l'email non è partita perché il
  servizio **non è configurato**. In un ambiente di test è lo stato normale, e distinguerlo da
  `failed` evita mezz'ora di panico.
- **Tre migrazioni versionate**, non una: la tabella dei modelli, la tabella del log, la colonna
  `body_html` del log. In Metabole sono `..._email_templates`, `..._email_log_body`,
  `..._mail_account`.

---

## 2. Il servizio di invio (`MailService`)

File: `backend/src/mail/mail.service.ts`. Modulo `@Global()` in `mail.module.ts`, con
`exports: [MailService, EmailTemplatesService]` — così ogni dominio può mandare email senza
importarlo ogni volta.

### 2.1 La firma di `send`

```ts
interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  templateKey?: string;          // finisce nel log: è la colonna «Modello»
  attachments?: { name: string; content: string }[]; // base64
  tags?: string[];               // per le statistiche del provider
  listUnsubscribeUrl?: string;   // solo email di massa: header List-Unsubscribe
}
```

### 2.2 I segnaposto e la risoluzione del modello

```ts
/** Sostituisce i segnaposto {{var}} nel testo. */
function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (k in vars ? vars[k] : ''));
}

private async resolve(
  templateKey: string,
  defaults: { subject: string; html: string },
  vars: Record<string, string>,
): Promise<{ subject: string; html: string }> {
  try {
    const tpl = await this.prisma.emailTemplate.findUnique({ where: { key: templateKey } });
    if (tpl && tpl.active) {
      return { subject: render(tpl.subject, vars), html: render(tpl.bodyHtml, vars) };
    }
  } catch {
    /* se la tabella non è ancora migrata, si usa il default: l'email deve partire lo stesso */
  }
  return defaults;
}
```

⚠️ Tre regole dentro venti righe, e servono tutte e tre:

1. **Un segnaposto sconosciuto diventa stringa vuota**, non resta `{{pippo}}` a video. Chi
   riscrive il testo dal backoffice sbaglia un nome prima o poi: meglio uno spazio che una graffa
   dentro un'email a una cliente.
2. **`active: false` non cancella il modello**: fa tornare al testo predefinito scritto nel codice.
   È il modo di dire «ho pasticciato, rimetti come prima» senza chiamare un tecnico.
3. **Il `catch` vuoto è voluto.** Al primo deploy la tabella può non esistere ancora. Un'email di
   reset password che non parte perché manca una tabella di *personalizzazione* è un
   autogol.

### 2.3 Il log non deve MAI bloccare l'invio

```ts
private async log(to, subject, status, templateKey?, error?, html?) {
  try {
    await this.prisma.emailLog.create({ data: { to, subject, status,
      templateKey: templateKey ?? null, error: error ?? null, bodyHtml: html ?? null } });
  } catch {
    /* il log non deve mai bloccare l'invio */
  }
}
```

### 2.4 Il corpo di `send`

Ordine esatto, e ogni ramo scrive nel log:

```ts
async send(input: SendMailInput): Promise<boolean> {
  const key = this.apiKey;
  if (!key) {                                    // 1) non configurato → skipped
    this.logger.warn(`API key non configurata: email NON inviata. to=${input.to}`);
    await this.log(input.to, input.subject, 'skipped', input.templateKey,
                   'API key non configurata', input.html);
    return false;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: this.sender,
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: this.withLogo(input.html),
        ...(input.attachments?.length ? { attachment: input.attachments } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {}),
        ...(input.listUnsubscribeUrl ? { headers: {
          'List-Unsubscribe': `<${input.listUnsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } } : {}),
      }),
    });
    if (!res.ok) {                                // 2) il provider ha risposto male → failed
      const body = await res.text();
      this.logger.error(`Provider ha risposto ${res.status}: ${body.slice(0, 300)}`);
      await this.log(input.to, input.subject, 'failed', input.templateKey,
                     `Provider ${res.status}`, input.html);
      return false;
    }
    await this.log(input.to, input.subject, 'sent', input.templateKey, undefined, input.html);
    return true;
  } catch (err) {                                 // 3) rete giù → failed
    await this.log(input.to, input.subject, 'failed', input.templateKey,
                   err instanceof Error ? err.message : 'errore', input.html);
    return false;
  }
}
```

⚠️ **`send` ritorna `false`, non lancia.** Un'email che non parte non deve far fallire l'operazione
che l'ha generata: la cliente ha pagato, l'acquisto è registrato, la ricevuta si rimanda. Chi
chiama decide se la mancata email è un problema — e nel dubbio guarda il Log email.

### 2.5 Un metodo per ogni email, non un metodo generico

Ogni email di sistema ha il suo metodo, con la sua chiave e i suoi default:

```ts
async sendPasswordReset(to: string, token: string, locale?: string | null): Promise<boolean> {
  const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.esempio.it';
  const link = `${appUrl}/reset-password?token=${token}`;
  const vars = { link, token };
  const { subject, html } = await this.resolve('password_reset', {
    subject: this.i18n.text(locale, 'mail.reset.subject'),
    html: this.i18n.text(locale, 'mail.reset.body', vars),
  }, vars);
  return this.send({ to, subject, html, templateKey: 'password_reset' });
}
```

Così la lista dei metodi **è** la lista dei modelli, e si controlla a occhio che ogni chiave usata
nel codice abbia la sua riga nel seed.

### 2.6 Dettagli che sembrano cosmetici e non lo sono

- **Il logo in cima a ogni email** si aggiunge nel servizio, non nei modelli, e con un URL pubblico
  — mai un `data:` URI, che quasi tutti i client di posta scartano. Se l'HTML contiene già il logo,
  non duplicarlo.
- **I pulsanti «scarica l'app»** sono `<a>` con stile inline dentro un paragrafo, **non i badge
  ufficiali a immagine**: i client bloccano le immagini remote finché non le sblocchi, e un badge
  invisibile non lo clicca nessuno. Gli URL degli store stanno in tabella di configurazione, non
  nel codice: cambiano, e non deve servire un deploy.
- **Stili sempre inline**: Gmail e Outlook ignorano il CSS in `<head>`.

---

## 3. Backend: servizio e controller dell'area admin

### 3.1 `EmailTemplatesService`

`backend/src/mail/email-templates.service.ts` — quattro metodi, e ognuno ha una precauzione.

```ts
list() {
  return this.prisma.emailTemplate.findMany({ orderBy: { name: 'asc' } });
}

async create(input: { key: string; name: string; subject: string; bodyHtml: string }, actorId: string) {
  const key = (input.key ?? '').trim();
  if (!/^[a-z][a-z0-9_]{2,59}$/.test(key)) {
    throw new BadRequestException(
      'Chiave non valida: minuscole, numeri e underscore, da 3 a 60 caratteri (es. lead_credentials).');
  }
  if (!input.name?.trim() || !input.subject?.trim() || !input.bodyHtml?.trim()) {
    throw new BadRequestException('Nome, oggetto e corpo sono obbligatori.');
  }
  const exists = await this.prisma.emailTemplate.findUnique({ where: { key }, select: { key: true } });
  if (exists) throw new ConflictException(`Il modello "${key}" esiste già: aprilo dall'elenco.`);
  const created = await this.prisma.emailTemplate.create({
    data: { key, name: input.name.trim(), subject: input.subject.trim(),
            bodyHtml: input.bodyHtml, updatedById: actorId },
  });
  await this.audit.log({ action: 'email.template.create', actorId,
                         entityType: 'email_template', entityId: key });
  return created;
}

async update(key: string, input: { subject?: string; bodyHtml?: string; active?: boolean }, actorId: string) {
  const t = await this.prisma.emailTemplate.findUnique({ where: { key } });
  if (!t) throw new NotFoundException('Modello email non trovato.');
  const updated = await this.prisma.emailTemplate.update({
    where: { key },
    data: {
      ...(input.subject  !== undefined ? { subject: input.subject } : {}),
      ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
      ...(input.active   !== undefined ? { active: input.active } : {}),
      updatedById: actorId,
    },
  });
  await this.audit.log({ action: 'email.template.update', actorId,
                         entityType: 'email_template', entityId: key });
  return updated;
}

logs(limit = 300) {
  // Lista LEGGERA: NON include bodyHtml (può essere grande).
  return this.prisma.emailLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, to: true, templateKey: true, subject: true,
              status: true, error: true, createdAt: true },
  });
}

/** Dettaglio di una singola email, CON il corpo: si chiede solo quando serve. */
async logDetail(id: string) {
  const row = await this.prisma.emailLog.findUnique({ where: { id } });
  if (!row) throw new NotFoundException('Email non trovata nel log.');
  return row;
}
```

⚠️ **Perché `create` esiste.** All'inizio in Metabole c'era solo `update`: l'elenco dei modelli era
quello del *seed*, e un'email dimenticata lì non era modificabile **da nessuna parte** — partiva
col testo scritto nel codice e chi voleva cambiarlo non trovava la riga. Metti `create` dal primo
giorno.

⚠️ **`update` non tocca `key` e `name`.** La chiave è il collegamento col codice: cambiarla stacca
il modello dall'email. Il nome lo governa il seed. Dal backoffice si modificano **oggetto, corpo,
attivo**, e basta.

⚠️ **Lista senza corpo, dettaglio con corpo.** Trecento email con l'HTML dentro sono megabyte di
JSON per una tabella che mostra cinque colonne. Sono due endpoint separati proprio per questo.

### 3.2 `EmailAdminController`

```ts
@Controller('admin/email')
export class EmailAdminController {
  constructor(private readonly emails: EmailTemplatesService) {}

  @Get('templates')            @RequirePage('email_templates')          templates() {...}
  @Post('templates')           @RequirePage('email_templates', 'manage') create(@Body() dto: CreateTemplateDto, @CurrentUser() u) {...}
  @Patch('templates/:key')     @RequirePage('email_templates', 'manage') update(@Param('key') key, @Body() dto: UpdateTemplateDto, @CurrentUser() u) {...}
  @Get('log')                  @RequirePage('email_log')                log() {...}
  @Get('log/:id')              @RequirePage('email_log')                logDetail(@Param('id') id) {...}
}
```

(Il decoratore è `RequirePage(pageKey, level?)`: se il livello non si indica, si deduce dal metodo
HTTP — `GET` → `view`, tutto il resto → `manage`. Sopra è esplicito solo per leggibilità.)

DTO con `class-validator`, limiti generosi ma presenti:

```ts
class CreateTemplateDto {
  @IsString() @MinLength(3)  @MaxLength(60)    key!: string;
  @IsString() @MinLength(2)  @MaxLength(120)   name!: string;
  @IsString() @MinLength(2)  @MaxLength(300)   subject!: string;
  @IsString() @MinLength(2)  @MaxLength(20000) bodyHtml!: string;
}
class UpdateTemplateDto {
  @IsOptional() @IsString()  @MaxLength(300)   subject?: string;
  @IsOptional() @IsString()  @MaxLength(20000) bodyHtml?: string;
  @IsOptional() @IsBoolean()                   active?: boolean;
}
```

⚠️ **Nota sull'originale.** In Metabole questo controller è protetto con `@Roles('admin')` e non
con la guardia di pagina: è un residuo, e infatti le due chiavi di permesso `email_templates` /
`email_log` esistono ma nessun endpoint le legge — **una chiave dichiarata e non letta è un
interruttore che non accende niente**. Nel progetto nuovo fallo giusto dall'inizio: la chiave nasce
insieme alla guardia che la legge.

---

## 4. Permessi, rotta, menu: DUE chiavi, non una

Le pagine sono due e i permessi sono due. Sembrano lo stesso perimetro («roba di email») ma non lo
sono: **chi scrive i testi** e **chi controlla cosa è partito** sono due mestieri diversi. Il
marketing riscrive i modelli; l'assistenza guarda il log per rispondere a «non mi è arrivata
niente». Una chiave sola lega due cose che si concedono e si tolgono insieme, e separarle dopo
costa un rilascio.

Quattro passi, tutti obbligatori, per **ognuna** delle due pagine:

1. **`backend/src/permissions/pages.ts`** → aggiungi la chiave a `BACKOFFICE_PAGES` e i default per
   ruolo:

```ts
export const BACKOFFICE_PAGES = [ /* … */ 'email_templates', 'email_log', 'posta' ] as const;

const DEFAULT_PERMISSIONS = {
  admin:          { email_templates: { view: true, manage: true }, email_log: { view: true, manage: true } },
  head_marketing: { email_templates: { view: true, manage: true }, email_log: { view: true } },
  // gli altri ruoli: niente. Il log contiene indirizzi e corpi di email.
};
```

2. **`backoffice/src/lib/labels.ts`** → l'etichetta, o nella tabella dei permessi comparirebbe la
   chiave grezza:

```ts
export const PAGE_LABEL = {
  email_templates: 'Modelli email',
  email_log: 'Log email',
  posta: 'Posta',
};
```

3. **La rotta** in `App.tsx`, protetta con la chiave:

```tsx
<Route path="/email-modelli" element={<Protected title="Modelli email" pageKey="email_templates"><ModelliEmail /></Protected>} />
<Route path="/email-log"     element={<Protected title="Log email"     pageKey="email_log"><LogEmail /></Protected>} />
```

4. **La voce di menu** in `Layout.tsx` (con la stessa `key`, così sparisce da sola a chi non ha il
   permesso) **e la guardia sull'endpoint** (`@RequirePage`, punto 3.2).

```tsx
{ key: 'email_templates', label: 'Modelli email', to: '/email-modelli', icon: 'ti-mail-cog' },
{ key: 'email_log',       label: 'Log email',     to: '/email-log',     icon: 'ti-mail-check' },
```

---

## 5. Seed dei modelli: idempotente, e non sovrascrive il lavoro dell'admin

```ts
const EMAIL_TEMPLATES = [
  { key: 'email_verification', name: 'Conferma email (registrazione)',
    subject: 'Conferma la tua email',
    bodyHtml: '<p>Benvenuta/o!</p><p>Per confermare il tuo indirizzo clicca qui: <a href="{{link}}">conferma email</a></p><p>Oppure usa questo codice: <code>{{token}}</code></p>' },
  { key: 'password_reset', name: 'Reset password', subject: 'Reimposta la password',
    bodyHtml: '<p>Hai chiesto di reimpostare la password.</p><p><a href="{{link}}">reimposta password</a></p><p>Se non sei stata/o tu, ignora questa email.</p>' },
  // … una riga per OGNI chiave usata dal codice
];

async function seedEmailTemplates() {
  for (const t of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: t,
      update: { name: t.name },   // ⚠️ SOLO il nome
    });
  }
}
```

⚠️ **`update: { name: t.name }` e nient'altro.** Il seed gira a ogni deploy. Se aggiornasse anche
`subject` e `bodyHtml`, ogni rilascio cancellerebbe i testi riscritti dal backoffice — e nessuno
capirebbe perché «le modifiche non si salvano». Il seed **crea** i modelli mancanti e tiene
allineata l'etichetta; il contenuto è dell'admin.

⚠️ Corollario: **una chiave nuova nell'elenco arriva in tabella da sé** al deploy successivo. Non
creare modelli a mano in produzione né con script una-tantum: si aggiunge la riga qui.

Utile: uno script di diagnostica (`npm run diag:modelli-email`) che confronta le chiavi passate a
`resolve(...)` nel codice con le righe in tabella e stampa le orfane nei due sensi. In Metabole
l'equivalente sui parametri di configurazione ha trovato chiavi lette col default e mai dichiarate.

---

## 6. Backoffice — pagina «Modelli email»

File: `backoffice/src/pages/ModelliEmail.tsx`. Struttura: **tabella + due modali** (nuovo,
modifica). Niente pagina di dettaglio separata: un modello sono tre campi.

### 6.1 La tabella

Colonne: **Modello** (nome, filtro testo) · **Oggetto** (filtro testo) · **Stato** (chip
Attivo/Disattivo, filtro a tendina) · **Azioni** (bottone «Modifica», allineato a destra).
In cima: un `hint` che spiega i segnaposto, il bottone **«Nuovo modello»**, il contatore righe, il
bottone Excel e la ricerca su tutte le colonne.

⚠️ Le etichette dello stato si scrivono **una volta sola** e si riusano nel chip e nella tendina
del filtro, mentre il **confronto resta sul valore grezzo**:

```tsx
const STATO_LABEL: Record<string, string> = { active: 'Attivo', inactive: 'Disattivo' };
const stato = (t: Template) => (t.active ? 'active' : 'inactive');
// colonna:
{ chiave: 'stato', titolo: 'Stato', valore: stato, filtro: 'scelta',
  etichettaTutti: 'Tutti', etichetta: (v) => STATO_LABEL[v] ?? v }
```

Se filtri sull'etichetta invece che sul valore, il giorno che qualcuno traduce «Attivo» il filtro
smette di funzionare in silenzio.

### 6.2 Modale «Nuovo modello»

Campi: **Chiave** (monospace) · **Nome** · **Oggetto** · **Corpo (HTML)** in `textarea`.

Sotto il campo Chiave, questo testo esatto — è l'unico punto in cui l'utente può fare un danno
invisibile:

> Minuscole, numeri e underscore. Deve corrispondere esattamente alla chiave usata dal codice per
> quell'email: se non corrisponde, il modello non verrà mai usato. Non è modificabile dopo.

Il corpo parte già scritto (`<p>Ciao {{name}},</p>\n<p>…</p>`), così chi apre la modale vede subito
che forma ha la cosa. Il bottone «Crea» è disabilitato finché chiave, nome e oggetto non sono
pieni. Alla creazione: inserisci la riga nella lista **ordinata per nome** (`localeCompare` con
locale, non `<`) e mostra un banner «Modello "X" creato. Ora puoi scriverne il testo.»

### 6.3 Modale «Modifica»

Campi: **Oggetto** · **Corpo**, con due bottoni che commutano fra **Anteprima** e **Codice HTML**
· un **Toggle «Attivo»** con l'etichetta che spiega cosa comporta:

```tsx
<Toggle on={active} onChange={setActive} />
<span>Attivo {active ? '(si usa questo testo)' : '(si usa il testo predefinito)'}</span>
```

**L'anteprima è la parte che rende la pagina usabile.** Due pezzi:

1. **Elenco dei segnaposto disponibili**, che è l'unione di due insiemi: quelli *noti* per quella
   chiave (una mappa scritta a mano nel file, allineata a ciò che passa il backend) e quelli
   *trovati nel testo che stai scrivendo*:

```tsx
const PLACEHOLDERS: Record<string, string[]> = {
  email_verification: ['link', 'token'],
  password_reset: ['link', 'token'],
  payment_receipt: ['description', 'amount', 'date', 'paymentId'],
  // …
};
const detected = Array.from(new Set(
  [...`${subject} ${bodyHtml}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));
const vars = Array.from(new Set([...(PLACEHOLDERS[template.key] ?? []), ...detected]));
```

2. **Anteprima con valori d'esempio**, sia dell'oggetto sia del corpo, in un `<iframe srcDoc>`:

```tsx
const SAMPLE: Record<string, string> = {
  name: 'Anna', link: '#', token: 'A1B2C3', amount: '€ 49,00',
  description: 'Abbonamento', date: '14/07/2026', paymentId: 'pay_12345', /* … */
};
const fillSample = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE[k] ?? `{{${k}}}`);

const previewDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;padding:0;background:#f4f1ea}
body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2b2b}
img{max-width:100%}</style></head><body>${fillSample(bodyHtml)}</body></html>`;

<iframe title="Anteprima email" srcDoc={previewDoc}
  sandbox="allow-popups allow-popups-to-escape-sandbox"
  style={{ width:'100%', height:'48vh', border:'1px solid var(--line,#eee)', borderRadius:8, background:'#fff' }} />
```

⚠️ **L'iframe, non un `dangerouslySetInnerHTML`.** L'HTML dell'email va isolato dal CSS del
backoffice: dentro la pagina, i tuoi stili globali lo truccano e vedresti un'anteprima che non
somiglia all'email vera. E `sandbox` senza `allow-scripts`: quel testo è modificabile da un utente.

⚠️ Un segnaposto **senza** valore d'esempio resta visibile come `{{pippo}}` nell'anteprima: è il
modo in cui chi scrive si accorge di aver inventato un nome.

---

## 7. Backoffice — pagina «Log email»

File: `backoffice/src/pages/LogEmail.tsx`. **Tabella + una modale di dettaglio.** Il caricamento è
in due tempi: la lista a `useEffect` sul mount, il dettaglio a `useEffect` su `openId`.

### 7.1 La tabella

Colonne: **Data e ora** (ordinamento iniziale `desc`) · **Destinatario** (filtro testo) ·
**Modello** (filtro a tendina) · **Oggetto** (filtro testo) · **Stato** (chip + l'errore troncato
sotto, con l'errore intero nel `title`).

```tsx
const STATUS: Record<string, { label: string; chip: string }> = {
  sent:    { label: 'Inviata',      chip: '' },
  failed:  { label: 'Fallita',      chip: 'red' },
  skipped: { label: 'Non inviata',  chip: 'amber' },
};
```

`skipped` si legge **«Non inviata»**, non «Saltata»: chi guarda vuole sapere che alla cliente non è
arrivato niente, non come si chiama lo stato nel database.

La riga intera è cliccabile (`cursor: pointer`, `title="Apri anteprima"`) e in cima c'è scritto
«Clicca una riga per l'anteprima» — un'interazione che non si vede non esiste.

### 7.2 ⚠️ Il tetto va DETTO, non nascosto

Il server ritorna al massimo 300 righe. Se la pagina non lo dice, chi filtra crede di cercare in
tutto lo storico e conclude che un'email non è mai partita:

```tsx
const TETTO = 300; // deve combaciare con logs(limit = 300) nel service

{rows.length >= TETTO && (
  <Banner kind="info">
    Stai guardando le <b>{TETTO}</b> email più recenti: i filtri cercano solo fra queste, quindi
    un invio più vecchio non compare nemmeno filtrando.
  </Banner>
)}
```

Stessa cosa sull'export Excel: se sei al tetto, il bottone chiede conferma spiegando che il file
conterrà solo le righe visibili scelte fra le 300 più recenti.

### 7.3 La modale di dettaglio

In alto i metadati (destinatario, oggetto, data, modello, chip di stato, e l'errore in un banner
rosso se c'è). Sotto, il corpo in un iframe:

```tsx
const previewDoc = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;padding:0;background:#fff}
body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2b2b;padding:12px}
img{max-width:100%}</style></head><body>${html}</body></html>`;

<iframe title="Contenuto email" srcDoc={previewDoc(detail.bodyHtml)} sandbox=""
  style={{ width:'100%', height:'58vh', border:'1px solid var(--line,#eee)', borderRadius:8, background:'#fff' }} />
```

⚠️ **`sandbox=""` qui, e non `allow-popups` come nei Modelli.** Nel Log stai visualizzando HTML già
partito, che può contenere qualunque cosa: sandbox completamente chiusa. Nei Modelli l'HTML lo sta
scrivendo l'admin in quel momento e vuole poter provare i link, quindi si concedono i popup. È una
differenza voluta: non uniformarle.

E il caso `bodyHtml === null` (righe registrate prima della colonna) ha un suo messaggio:
«Corpo non disponibile per questa email (registrata prima dell'aggiornamento).»

### 7.4 Errori di permesso, in italiano

```tsx
catch (err) {
  if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
  else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
}
```

Un 403 grezzo in pagina fa aprire un ticket. Una frase fa capire che è normale.

---

## 8. Configurazione dell'invio — parte A: transazionali (Brevo)

### 8.1 Variabili d'ambiente

| Variabile | Esempio | A cosa serve |
|---|---|---|
| `BREVO_API_KEY` | `xkeysib-…` | chiave API del provider. **Mai nel repo**: si inserisce nel pannello del servizio di hosting |
| `MAIL_FROM` | `Metabole <no-reply@metabole.eu>` | mittente, **verificato sul provider** o le email finiscono in spam |
| `APP_URL` | `https://app.metabole.eu` | base dei link nelle email e dell'immagine del logo |

Nel blueprint di deploy (`render.yaml`) vanno dichiarate con `sync: false` (valore inserito a mano
nel pannello), e in `backend/.env.example` con il valore vuoto e un commento che dice dove si
prende. ⚠️ Chiavi e connection string **mai nel repo né in chat**.

### 8.2 Le due letture difensive

```ts
private get apiKey(): string | null {
  const key = this.config.get<string>('BREVO_API_KEY');
  if (!key || key === 'todo' || key.length < 10) return null;   // ⚠️ anche il segnaposto
  return key;
}

private get sender(): { name: string; email: string } {
  const raw = this.config.get<string>('MAIL_FROM') ?? 'Metabole <no-reply@metabole.eu>';
  const m = raw.match(/^(.*)<(.+)>$/);
  if (m) return { name: m[1].trim() || 'Metabole', email: m[2].trim() };
  return { name: 'Metabole', email: raw.trim() };               // accetta anche il solo indirizzo
}
```

⚠️ `key === 'todo'`: il `.env.example` copiato e non compilato è il caso normale in sviluppo. Senza
questo controllo, il codice manda una chiamata al provider con la chiave `todo`, prende un 401 e
registra `failed` — che è **il messaggio sbagliato**: non è fallito niente, non è configurato.
Con il controllo lo stato è `skipped` e il log dice «API key non configurata».

### 8.3 Se vuoi SMTP invece dell'API HTTP

Stessa struttura, cambia solo il corpo di `send`: `nodemailer.createTransport({ host, port, secure,
auth: { user, pass } })` con `MAIL_SMTP_HOST` / `MAIL_SMTP_PORT` / `MAIL_SMTP_USER` /
`MAIL_SMTP_PASS`, e `apiKey` diventa «ho host e credenziali?». Il resto — `resolve`, `log`, i tre
stati, il valore di ritorno booleano — non cambia di una riga. ⚠️ Metti timeout brevi
(`connectionTimeout: 20_000`, `greetingTimeout: 15_000`): il default di nodemailer ti lascia
appeso, e il caso frequente non è «password sbagliata» ma «il firewall dell'hosting blocca l'IP del
backend».

---

## 9. Configurazione dell'invio — parte B: casella IMAP/SMTP dell'operatore

Serve se nel backoffice ci sarà una pagina «Posta» da cui una persona scrive alle clienti dalla
propria casella aziendale. File: `backend/src/mailbox/`.

### 9.1 Impostazioni: server dall'ambiente, credenziali dal database

```ts
private settings() {
  return {
    imapHost: process.env.MAIL_IMAP_HOST || 'mail.esempio.it',
    imapPort: Number(process.env.MAIL_IMAP_PORT || 993),
    smtpHost: process.env.MAIL_SMTP_HOST || 'mail.esempio.it',
    smtpPort: Number(process.env.MAIL_SMTP_PORT || 465),
    secure: true,
  };
}
```

Il server è **uguale per tutti** (stesso dominio aziendale) → variabile d'ambiente con default.
L'indirizzo e la password sono **della persona** → riga `mail_account`. Non chiedere host e porta
all'utente: sono quattro campi che sbaglierà, e la risposta è sempre la stessa.

### 9.2 La password si cifra, e non torna mai indietro

```ts
private key() {
  const secret = process.env.FILE_ENCRYPTION_KEY;
  if (!secret) throw new BadRequestException('Cifratura non configurata sul server.');
  return deriveKey(secret);                       // AES-256-GCM
}
private encrypt(pw: string) { return encryptBuffer(Buffer.from(pw,'utf8'), this.key()).toString('base64'); }
private decrypt(enc: string) { return decryptBuffer(Buffer.from(enc,'base64'), this.key()).toString('utf8'); }
```

Regole non negoziabili: la password **non compare mai** in una risposta API, in un log applicativo
o in un messaggio d'errore. `GET /me/mailbox` ritorna solo `{ configured, email }`.

### 9.3 Salvare = provare la connessione

```ts
async setAccount(userId: string, email: string, password: string) {
  const client = this.imapClient(email, password);
  try { await client.connect(); await client.logout(); }
  catch (err) {
    throw new BadRequestException(
      `Connessione alla casella non riuscita: ${this.describeMailError(err, `Collegamento ${email}`)}.`);
  }
  await this.prisma.mailAccount.upsert({
    where: { userId },
    create: { userId, email, encPassword: this.encrypt(password) },
    update: { email, encPassword: this.encrypt(password) },
  });
  return { configured: true, email };
}
```

⚠️ Salvare senza provare significa scoprire l'errore tre giorni dopo, quando qualcuno prova a
scrivere a una cliente.

### 9.4 ⚠️ Errori parlanti: la parte che fa risparmiare giornate

Un errore IMAP/SMTP grezzo (`ETIMEDOUT`) non dice a nessuno cosa fare. Una funzione sola, usata da
**tutte** le operazioni di posta, che traduce il codice in un intervento:

```ts
private describeMailError(err: unknown, context: string): string {
  const e = err as { authenticationFailed?: boolean; code?: string; message?: string; responseText?: string };
  this.logger.warn(`${context}: code=${e?.code ?? '-'} auth=${e?.authenticationFailed ?? '-'} msg=${e?.message ?? '-'}`);
  const msg = e?.message ?? '';
  return e?.authenticationFailed || /auth|login|credentials/i.test(e?.responseText ?? '')
    ? 'il server ha RIFIUTATO indirizzo o password (verifica le credenziali, es. dal webmail)'
    : e?.code === 'ENOTFOUND'
      ? 'server di posta non trovato (DNS): verifica il nome host'
    : e?.code === 'ETIMEDOUT' || /timeout|establish connection/i.test(msg)
      ? 'il server di posta NON RISPONDE (timeout): NON è un problema di password — quasi sempre è il firewall dell\'hosting che blocca l\'IP del backend. Soluzione: whitelistare gli IP in uscita del backend presso l\'hosting'
    : e?.code === 'ECONNREFUSED'
      ? 'connessione RIFIUTATA (porta chiusa, servizio fermo o IP bloccato dal firewall)'
    : e?.code === 'ECONNRESET' || /socket|closed|reset/i.test(msg)
      ? 'connessione INTERROTTA dal server (instabilità o protezione anti-abuso lato hosting)'
    : /certificate|tls|ssl/i.test(msg)
      ? 'problema di certificato SSL del server di posta'
      : `errore: ${e?.responseText || msg || 'sconosciuto'}`;
}
```

Distinguere «password sbagliata» da «IP bloccato» cambia **completamente** l'intervento: nel primo
caso lo risolve l'utente in trenta secondi, nel secondo serve una richiesta all'hosting.

### 9.5 Cartelle e timeout

- **Non assumere il nome della cartella «Inviata».** Cerca prima per attributo speciale IMAP
  (`\Sent`, `\Trash`), poi per nome comune (`Sent`, `INBOX.Sent`, `Sent Items`, anche in italiano).
  I server usano nomi diversi.
- **Timeout brevi e configurabili**: `connectionTimeout: 20_000`, `greetingTimeout: 15_000`. Il
  default di imapflow è ~90 s e l'utente aspettava un minuto e mezzo prima di vedere l'errore. Se
  il server non si fa vivo in 20 s non si farà vivo.
- **«Elimina» sposta nel cestino**, non cancella: su una casella condivisa non si distrugge la
  posta di qualcun altro.

### 9.6 Anche la casella scrive nel log

```ts
await this.prisma.emailLog.create({ data: {
  to: dto.to, subject: dto.subject, bodyHtml: dto.html ?? dto.text,
  templateKey: 'mailbox', status: 'sent' } }).catch(() => undefined);
```

`templateKey: 'mailbox'` distingue le email scritte a mano da quelle di sistema, e la pagina Log
diventa **l'unico posto** dove guardare. Anche qui `.catch(() => undefined)`: il log non blocca.

### 9.7 UI di configurazione (in «Impostazioni», non in una pagina a parte)

Due stati soli:

- **Non collegata** → due campi (indirizzo, password) e un bottone «Collega». Il messaggio d'errore
  è quello di `describeMailError`, mostrato per intero.
- **Collegata** → «Casella **mario@esempio.it** collegata» + bottone «Scollega» con conferma
  («Scollegare la casella? La password salvata verrà rimossa»).

E nella pagina «Posta», se la casella non è collegata, **non** un errore ma un invito con il link
diretto: «Per usare la posta devi prima collegare la tua casella. → Vai in Impostazioni».

---

## 10. Ordine di lavoro consigliato

1. Migrazione + modelli Prisma (`EmailTemplate`, `EmailLog`), `MailModule` `@Global()`.
2. `MailService` con `send`, `log`, `resolve`, e **un** metodo reale (es. `sendPasswordReset`).
3. Seed dei modelli. Verifica: la riga compare in tabella dopo il seed.
4. `EmailTemplatesService` + `EmailAdminController` + le **due chiavi di permesso** con guardia.
5. Pagina «Log email» (si collauda per prima: basta far partire un'email).
6. Pagina «Modelli email» con creazione, modifica, anteprima, toggle attivo.
7. Solo dopo, se serve: `MailAccount`, `MailboxService`, pagina «Posta» e sezione in Impostazioni.

Un dominio alla volta, con i test, e migrazioni versionate.

---

## 11. Collaudo — la lista che conta

**Modelli**

- [ ] Creo un modello con chiave `Test-1` → errore chiaro sul formato della chiave.
- [ ] Creo `test_email` due volte → la seconda dà «esiste già: aprilo dall'elenco».
- [ ] Modifico l'oggetto, **rilancio il seed** → la mia modifica è ancora lì (regola §5).
- [ ] Metto `active: false` → l'email parte col testo predefinito del codice.
- [ ] Scrivo `{{pippo}}` nel corpo → compare fra i segnaposto rilevati e resta visibile
      nell'anteprima; **all'invio diventa vuoto**, non `{{pippo}}`.
- [ ] L'anteprima non eredita il CSS del backoffice (è dentro un iframe).

**Log**

- [ ] Senza chiave API configurata: l'email risulta **Non inviata**, non Fallita, e l'errore dice
      «API key non configurata».
- [ ] Con chiave sbagliata: **Fallita**, con il codice di risposta del provider nell'errore.
- [ ] Clic su una riga → il corpo si vede come lo ha visto la cliente, logo compreso.
- [ ] Con più di 300 righe: compare il banner del tetto, e l'export avvisa.
- [ ] Un utente **senza** il permesso `email_log` non vede la voce di menu **e** prende 403
      sull'endpoint (prova con la chiamata diretta, non solo dalla UI).

**Permessi**

- [ ] Tolgo `email_templates` a un ruolo e lascio `email_log`: vede il log, non i modelli. Se non
      si separano, le due chiavi non servivano a niente.

---

## 12. Le sette trappole, in breve

1. La **chiave** del modello deve combaciare esattamente con quella del codice, o il modello non lo
   usa nessuno — e non se ne accorge nessuno.
2. Il **seed aggiorna solo il nome**: se tocca oggetto e corpo, ogni deploy cancella il lavoro
   dell'admin.
3. La **lista del log non porta il corpo**; il corpo si chiede solo nel dettaglio.
4. Il **tetto delle righe va dichiarato in pagina**, o chi filtra trae la conclusione sbagliata.
5. `skipped` **non è** `failed`: «non configurato» e «rotto» richiedono interventi opposti.
6. Il **log non blocca mai l'invio** e l'**invio non blocca mai l'operazione** che l'ha generato.
7. **Due pagine, due chiavi di permesso**, e ogni chiave nasce insieme alla guardia che la legge.

---

*Estratto dall'implementazione Metabole (backend/src/mail, backend/src/mailbox,
backoffice/src/pages/ModelliEmail.tsx, backoffice/src/pages/LogEmail.tsx) — 27 agosto 2026.*
