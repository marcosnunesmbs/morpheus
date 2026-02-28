import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { AuditEvent, AuditEventInsert, AuditSessionSummary } from './types.js';
import { DisplayManager } from '../display.js';

export class AuditRepository {
  private static instance: AuditRepository | null = null;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(homedir(), '.morpheus', 'memory', 'short-memory.db');
    fs.ensureDirSync(path.dirname(dbPath));
    this.db = new Database(dbPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');
    this.ensureTables();
  }

  public static getInstance(): AuditRepository {
    if (!AuditRepository.instance) {
      AuditRepository.instance = new AuditRepository();
    }
    return AuditRepository.instance;
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id            TEXT PRIMARY KEY,
        session_id    TEXT NOT NULL,
        task_id       TEXT,
        event_type    TEXT NOT NULL,
        agent         TEXT,
        tool_name     TEXT,
        provider      TEXT,
        model         TEXT,
        input_tokens  INTEGER,
        output_tokens INTEGER,
        duration_ms   INTEGER,
        status        TEXT,
        metadata      TEXT,
        created_at    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_events_session
        ON audit_events(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_events_task
        ON audit_events(task_id)
        WHERE task_id IS NOT NULL;
    `);
  }

  insert(event: AuditEventInsert): void {
    try {
      this.db.prepare(`
        INSERT INTO audit_events
          (id, session_id, task_id, event_type, agent, tool_name, provider, model,
           input_tokens, output_tokens, duration_ms, status, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        event.session_id,
        event.task_id ?? null,
        event.event_type,
        event.agent ?? null,
        event.tool_name ?? null,
        event.provider ?? null,
        event.model ?? null,
        event.input_tokens ?? null,
        event.output_tokens ?? null,
        event.duration_ms ?? null,
        event.status ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        Date.now(),
      );
    } catch (err: any) {
      // Non-critical — never let audit recording break the main flow
      DisplayManager.getInstance().log(
        `AuditRepository.insert failed: ${err?.message ?? String(err)}`,
        { source: 'Audit', level: 'error' }
      );
    }
  }

  getBySession(sessionId: string, opts?: { limit?: number; offset?: number }): AuditEvent[] {
    const limit = opts?.limit ?? 500;
    const offset = opts?.offset ?? 0;
    const rows = this.db.prepare(`
      SELECT ae.*,
        CASE
          WHEN ae.provider IS NOT NULL AND ae.model IS NOT NULL AND ae.input_tokens IS NOT NULL
          THEN (
            COALESCE(ae.input_tokens, 0) / 1000000.0 * COALESCE(mp.input_price_per_1m, 0) +
            COALESCE(ae.output_tokens, 0) / 1000000.0 * COALESCE(mp.output_price_per_1m, 0)
          )
          ELSE NULL
        END AS estimated_cost_usd
      FROM audit_events ae
      LEFT JOIN model_pricing mp ON mp.provider = ae.provider AND mp.model = ae.model
      WHERE ae.session_id = ?
      ORDER BY ae.created_at ASC
      LIMIT ? OFFSET ?
    `).all(sessionId, limit, offset) as any[];

    return rows.map(r => ({ ...r, metadata: r.metadata ? r.metadata : null }));
  }

  getSessionSummary(sessionId: string): AuditSessionSummary {
    const events = this.getBySession(sessionId, { limit: 10_000 });

    const llmEvents = events.filter(e => e.event_type === 'llm_call');
    const toolEvents = events.filter(e => e.event_type === 'tool_call' || e.event_type === 'mcp_tool');

    const totalCostUsd = llmEvents.reduce((sum, e) => sum + (e.estimated_cost_usd ?? 0), 0);
    const totalDurationMs = events.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0);

    // By agent
    const agentMap = new Map<string, { llmCalls: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number }>();
    for (const e of llmEvents) {
      const key = e.agent ?? 'unknown';
      const existing = agentMap.get(key) ?? { llmCalls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
      agentMap.set(key, {
        llmCalls: existing.llmCalls + 1,
        inputTokens: existing.inputTokens + (e.input_tokens ?? 0),
        outputTokens: existing.outputTokens + (e.output_tokens ?? 0),
        estimatedCostUsd: existing.estimatedCostUsd + (e.estimated_cost_usd ?? 0),
      });
    }

    // By model
    const modelMap = new Map<string, { calls: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number; provider: string }>();
    for (const e of llmEvents) {
      if (!e.model) continue;
      const key = `${e.provider}/${e.model}`;
      const existing = modelMap.get(key) ?? { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, provider: e.provider ?? '' };
      modelMap.set(key, {
        calls: existing.calls + 1,
        inputTokens: existing.inputTokens + (e.input_tokens ?? 0),
        outputTokens: existing.outputTokens + (e.output_tokens ?? 0),
        estimatedCostUsd: existing.estimatedCostUsd + (e.estimated_cost_usd ?? 0),
        provider: e.provider ?? '',
      });
    }

    return {
      totalCostUsd,
      totalDurationMs,
      llmCallCount: llmEvents.length,
      toolCallCount: toolEvents.length,
      byAgent: Array.from(agentMap.entries()).map(([agent, s]) => ({ agent, ...s })),
      byModel: Array.from(modelMap.entries()).map(([key, s]) => ({
        provider: s.provider,
        model: key.split('/').slice(1).join('/'),
        calls: s.calls,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        estimatedCostUsd: s.estimatedCostUsd,
      })),
    };
  }
}
