/**
 * Adapter: AuditRepositoryAdapter
 *
 * Implements IAuditEmitter using AuditRepository.
 * Allows tools and subagents to emit audit events without
 * importing AuditRepository directly.
 */
import type { IAuditEmitter } from '../ports/IAuditEmitter.js';
import type { AuditEventInsert } from '../audit/types.js';
import { AuditRepository } from '../audit/repository.js';

export class AuditRepositoryAdapter implements IAuditEmitter {
  emit(event: AuditEventInsert): void {
    AuditRepository.getInstance().insert(event);
  }
}
