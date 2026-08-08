import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Lightweight readiness endpoint used by Render and external monitoring. */
@Controller('healthz')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
