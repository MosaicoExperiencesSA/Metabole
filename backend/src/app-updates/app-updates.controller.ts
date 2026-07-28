import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, normalize } from 'path';
import { Public } from '../common/decorators/public.decorator';

/**
 * OTA (Over-The-Air) servito INTERAMENTE dal nostro backend — manifest + bundle.
 *
 * Perché qui e non su metabole.eu: il server SiteGround blocca (403) l'intera cartella
 * /app-updates/ e non è aggirabile da File Manager. Il backend è sotto nostro pieno
 * controllo, senza WAF.
 *
 * ── Endpoint ────────────────────────────────────────────────────────────────
 *   GET /api/v1/app-updates/latest.json      → manifest { version, url }
 *   GET /api/v1/app-updates/bundles/:file    → scarica lo zip del bundle
 *
 * ── OTA SPENTO (default) ────────────────────────────────────────────────────
 * Se l'env OTA_VERSION non è impostata, latest.json risponde { version:null, url:null }
 * → l'app non scarica nulla. È lo stato al lancio: NON serve fare niente.
 *
 * ── Accendere / spingere un aggiornamento OTA ───────────────────────────────
 *  1) genera lo zip:  node scripts/ota-release.mjs 3.1   → ota-out/metabole-3.1.zip
 *  2) copia lo zip in  backend/ota-bundles/metabole-3.1.zip  e fai commit + push
 *     (così finisce nel deploy Render);
 *  3) su Render → Environment imposta  OTA_VERSION = 3.1  e salva.
 *     Il manifest punterà da solo a .../app-updates/bundles/metabole-3.1.zip.
 * Per rispegnere: rimuovi (o svuota) OTA_VERSION. Nessun deploy di codice.
 *
 * (Opzionale) Se preferisci ospitare lo zip altrove, imposta anche OTA_BUNDLE_URL con
 * l'URL completo: ha la precedenza e il backend non serve il file locale.
 */
interface OtaManifest {
  version: string | null;
  url: string | null;
}

// Cartella con gli zip dei bundle, dentro il repo backend (inclusa nel deploy).
const BUNDLES_DIR = normalize(join(process.cwd(), 'ota-bundles'));

@Public()
@Controller('app-updates')
export class AppUpdatesController {
  @Get('latest.json')
  @Header('Cache-Control', 'no-store')
  latest(@Req() req: Request): OtaManifest {
    const version = process.env.OTA_VERSION?.trim() || null;
    if (!version) return { version: null, url: null };

    // URL esplicito (override) oppure derivato dallo stesso host che ci ha chiamato.
    let url = process.env.OTA_BUNDLE_URL?.trim() || null;
    if (!url) {
      const fwdProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0];
      const proto = fwdProto || req.protocol || 'https';
      const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
      url = `${proto}://${host}/api/v1/app-updates/bundles/metabole-${version}.zip`;
    }
    return { version, url };
  }

  @Get('bundles/:file')
  bundle(@Param('file') file: string, @Res() res: Response): void {
    // Solo nomi tipo metabole-<versione>.zip: niente path traversal, niente altri file.
    if (!/^metabole-[0-9A-Za-z._-]+\.zip$/.test(file)) {
      throw new BadRequestException('Nome bundle non valido');
    }
    const full = normalize(join(BUNDLES_DIR, file));
    if (!full.startsWith(BUNDLES_DIR + '/') || !existsSync(full)) {
      throw new NotFoundException('Bundle non trovato');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', String(statSync(full).size));
    createReadStream(full).pipe(res);
  }
}
