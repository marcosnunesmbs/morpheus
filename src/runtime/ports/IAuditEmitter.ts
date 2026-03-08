/**
 * Port: IAuditEmitter
 *
 * Abstraction for emitting audit events.
 * Decouples tools and subagents from AuditRepository.
 */
import type { AuditEventInsert } from '../audit/types.js';

export interface IAuditEmitter {
  /** Persist a single audit event. */
  emit(event: AuditEventInsert): void;
}
