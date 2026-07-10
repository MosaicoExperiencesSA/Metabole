import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  timestamp: string;
  version: string;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Diagnostica temporanea (M10): conta gli hop di proxy per tarare trust proxy. */
  @Get('proxy-check')
  proxyCheck(@Req() req: Request) {
    return {
      ip: req.ip,
      ips: req.ips,
      xForwardedFor: req.headers['x-forwarded-for'] ?? null,
    };
  }

  @Get()
  async check(): Promise<HealthStatus> {
    let database: HealthStatus['database'] = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }
}
