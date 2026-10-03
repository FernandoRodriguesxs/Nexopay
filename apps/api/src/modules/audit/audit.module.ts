import { Module } from '@nestjs/common';
import { AuditTrail } from './audit-trail.js';

@Module({
  providers: [AuditTrail],
  exports: [AuditTrail],
})
export class AuditModule {}
