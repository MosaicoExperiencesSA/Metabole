# Handoff [Sviluppo] — Endpoint pubblico "crea lead"

Obiettivo: endpoint **pubblico** per i form del sito (`leadForm` del sito, `jobForm` di Lavora), oggi mancante (i lead venivano persi). Il sito è **già collegato** e invia in POST a `/api/v1/public/leads`.

Stack esistente riusato: `CrmRecord` (modello Prisma), `CrmService` (`src/commerce/crm.service.ts`), `@Public()` (già usato in `commerce.controller.ts`), **ThrottlerModule** già registrato globalmente (`app.module.ts`) con `@Throttle` (vedi `auth.controller.ts`). **Nessuna migrazione necessaria** (i metadati vanno in `stageDates`).

---

## 1. Cosa invia il sito (già implementato lato Prodotto)

`POST https://<backend>/api/v1/public/leads` — JSON:
```json
{ "nome": "Anna", "email": "anna@example.com", "website": "",
  "fonte": "sito_presentazione", "lingua": "it",
  "ruolo": "Coach", "messaggio": "..." }   // ruolo/messaggio solo dal form Lavora
```
- `website` = **honeypot** (campo nascosto): se valorizzato → è un bot, rispondere 200 **senza salvare**.
- Il form mostra "Grazie" **solo** su risposta `2xx`; altrimenti mostra fallback `info@metabole.eu`.
- `fonte`: `sito_presentazione` (lead) oppure `lavora_con_noi` (candidatura).

## 2. DTO — `src/commerce/dto/public-lead.dto.ts`
```ts
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublicLeadDto {
  @IsEmail()
  email!: string;

  @IsOptional() @IsString() @MaxLength(120)
  nome?: string;

  @IsOptional() @IsString() @MaxLength(40)
  fonte?: string; // 'sito_presentazione' | 'lavora_con_noi'

  @IsOptional() @IsString() @MaxLength(8)
  lingua?: string;

  @IsOptional() @IsString() @MaxLength(60)
  ruolo?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  messaggio?: string;

  // Honeypot: deve restare vuoto (i bot lo compilano).
  @IsOptional() @IsString() @MaxLength(0)
  website?: string;
}
```

## 3. Service — aggiungere a `CrmService` (`src/commerce/crm.service.ts`)
Nessuna migrazione: nome/email nei campi nativi, il resto in `stageDates.lead_in.meta`. Dedup opzionale per email.
```ts
async createPublic(input: {
  email: string; nome?: string; fonte?: string; lingua?: string; ruolo?: string; messaggio?: string;
}) {
  const meta = {
    source: input.fonte ?? 'sito',
    lang: input.lingua,
    role: input.ruolo,
    message: input.messaggio,
    channel: 'public_form',
  };
  // Dedup soft: se esiste già un lead con quella email non ancora cliente, aggiorna il meta.
  const existing = input.email
    ? await this.prisma.crmRecord.findFirst({ where: { email: input.email, clientId: null } })
    : null;

  const stamp = { at: new Date().toISOString(), byUserId: 'public', meta };

  const record = existing
    ? await this.prisma.crmRecord.update({
        where: { id: existing.id },
        data: {
          name: input.nome ?? existing.name,
          stageDates: { ...(existing.stageDates as object), lead_in: stamp } as never,
        },
      })
    : await this.prisma.crmRecord.create({
        data: {
          email: input.email,
          name: input.nome,
          stage: 'lead_in',
          stageDates: { lead_in: stamp } as never,
        },
      });

  await this.audit.log({
    action: 'crm.lead.public_create',
    actorId: 'public',
    entityType: 'crm_record',
    entityId: record.id,
  });
  return { ok: true, id: record.id };
}
```

## 4. Controller — `src/commerce/public-lead.controller.ts`
```ts
import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator'; // stesso decoratore usato in commerce.controller.ts
import { CrmService } from './crm.service';
import { PublicLeadDto } from './dto/public-lead.dto';

@Controller('public/leads')
export class PublicLeadController {
  constructor(private readonly crm: CrmService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // max 5 invii/min per IP
  @Post()
  async create(@Body() dto: PublicLeadDto) {
    if (dto.website && dto.website.length > 0) return { ok: true }; // honeypot: bot → drop
    return this.crm.createPublic({
      email: dto.email, nome: dto.nome, fonte: dto.fonte,
      lingua: dto.lingua, ruolo: dto.ruolo, messaggio: dto.messaggio,
    });
  }
}
```

## 5. Registrazione — `src/commerce/commerce.module.ts`
Aggiungere `PublicLeadController` all'array `controllers` (import in cima). `CrmService` è già provider del modulo.

## 6. CORS
Aggiungere l'origine del sito di presentazione a **`CORS_ORIGINS`** (env, letto in `main.ts`), es. `https://www.metabole.eu`, `https://metabole.eu`. L'app e il backoffice restano invariati.

## 7. (Opzionale, consigliato) captcha
Per ridurre lo spam oltre al throttler + honeypot, integrare **Cloudflare Turnstile** (gratis, privacy-friendly):
- Frontend: aggiungere il widget e inviare il token come `captchaToken`.
- Backend: verificare via `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` con `TURNSTILE_SECRET` prima di `createPublic`. Se fallisce → 400.
(Non bloccante per il go-live: throttler + honeypot coprono il caso base.)

## 8. Note
- **URL nel sito**: i form puntano a `https://metabole-backend.onrender.com/api/v1/public/leads`. Se il backend prod ha un dominio diverso, aggiornare `data-endpoint` nei due HTML (o servirlo dietro lo stesso dominio del sito via reverse-proxy).
- Le **candidature** (`fonte=lavora_con_noi`) entrano nella stessa pipeline CRM con `meta.source`; se in futuro serve un flusso separato (colloqui/HR), si può filtrare per `stageDates.lead_in.meta.source` o creare un'entità dedicata.
- Il contatore "persone raggiunte" del sito si incrementa lato client all'invio riuscito; il valore reale arriverà dallo `stats-endpoint` quando esposto.
