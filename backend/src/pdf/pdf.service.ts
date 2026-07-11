import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PDF_TEMPLATES, PDF_PREVIEW_SAMPLE, fillTemplate } from './pdf.defaults';

/**
 * Genera i PDF dei clienti (ricevuta, report mensile) partendo da template HTML
 * modificabili da admin, resi in PDF con Chromium headless (puppeteer).
 * Il rendering è isolato: se Chromium non è disponibile lancia un errore e il
 * chiamante può ripiegare sul generatore storico (pdfkit).
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Elenco template (default uniti agli override salvati) per l'editor. */
  async list() {
    const rows = await this.prisma.pdfTemplate.findMany();
    const byKey = new Map((rows as { key: string; name: string; html: string; updatedAt: Date }[]).map((r) => [r.key, r]));
    return DEFAULT_PDF_TEMPLATES.map((def) => {
      const row = byKey.get(def.key);
      return {
        key: def.key,
        name: row?.name ?? def.name,
        html: row?.html ?? def.html,
        placeholders: def.placeholders,
        updatedAt: row?.updatedAt ?? null,
        customized: Boolean(row),
      };
    });
  }

  private def(key: string) {
    const def = DEFAULT_PDF_TEMPLATES.find((t) => t.key === key);
    if (!def) throw new NotFoundException(`Template PDF sconosciuto: ${key}`);
    return def;
  }

  async getFull(key: string) {
    const def = this.def(key);
    const row = await this.prisma.pdfTemplate.findUnique({ where: { key } });
    return { key, name: row?.name ?? def.name, html: row?.html ?? def.html, placeholders: def.placeholders, updatedAt: row?.updatedAt ?? null };
  }

  /** HTML corrente del template (salvato o default). */
  async getHtml(key: string): Promise<string> {
    const row = await this.prisma.pdfTemplate.findUnique({ where: { key } });
    return row?.html ?? this.def(key).html;
  }

  async update(key: string, html: string, name: string | undefined, actorId: string) {
    this.def(key); // valida la chiave
    const row = await this.prisma.pdfTemplate.upsert({
      where: { key },
      create: { key, name: name ?? this.def(key).name, html, updatedById: actorId },
      update: { html, ...(name ? { name } : {}), updatedById: actorId },
    });
    await this.audit.log({ action: 'admin.pdf_template.update', actorId, entityType: 'pdf_template', entityId: key });
    return row;
  }

  /** Ripristina il template ai valori di fabbrica. */
  async reset(key: string, actorId: string) {
    this.def(key);
    await this.prisma.pdfTemplate.deleteMany({ where: { key } });
    await this.audit.log({ action: 'admin.pdf_template.reset', actorId, entityType: 'pdf_template', entityId: key });
    return this.getFull(key);
  }

  sampleVars(key: string): Record<string, string> {
    return PDF_PREVIEW_SAMPLE[key] ?? {};
  }

  /** Rende un template (con i dati reali) in PDF. */
  async renderTemplatePdf(key: string, vars: Record<string, string>): Promise<Buffer> {
    return this.htmlToPdf(fillTemplate(await this.getHtml(key), vars));
  }

  /** Anteprima nell'editor: usa l'HTML fornito (non ancora salvato) e i dati d'esempio. */
  async preview(key: string, html?: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    const useHtml = html ?? (await this.getHtml(key));
    const buffer = await this.htmlToPdf(fillTemplate(useHtml, this.sampleVars(key)));
    return { fileName: `${key}-anteprima.pdf`, mimeType: 'application/pdf', contentBase64: buffer.toString('base64') };
  }

  /** HTML → PDF con Chromium headless. Import dinamico: se manca, lancia (il chiamante ripiega). */
  async htmlToPdf(html: string): Promise<Buffer> {
    const mod = 'puppeteer';
    let puppeteer: { launch: (o: unknown) => Promise<Browser> };
    try {
      const imported = (await import(mod)) as { default?: typeof puppeteer } & typeof puppeteer;
      puppeteer = imported.default ?? imported;
    } catch (err) {
      this.logger.error('puppeteer non disponibile: rendering HTML→PDF non possibile', err instanceof Error ? err.message : String(err));
      throw new Error('PDF_RENDERER_UNAVAILABLE');
    }
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

// Tipi minimi per non dipendere dai type di puppeteer a compile-time.
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}
interface Page {
  setContent(html: string, opts: unknown): Promise<void>;
  pdf(opts: unknown): Promise<Uint8Array>;
}
