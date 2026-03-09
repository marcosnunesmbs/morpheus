import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AuditEvent, AuditEventInsert, AuditSessionSummary, GlobalAuditSummary } from './types.js';
import { DisplayManager } from '../display.js';
import { PATHS } from '../../config/paths.js';

export class AuditRepository {
  private static instance: AuditRepository | null = null;
  private db: Database.Database;

  private constructor() {
    const dbPath = PATHS.shortMemoryDb;
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

  countBySession(sessionId: string): number {
    const row = this.db.prepare(
      `SELECT COUNT(*) as n FROM audit_events WHERE session_id = ?`
    ).get(sessionId) as { n: number };
    return row?.n ?? 0;
  }

  getBySession(sessionId: string, opts?: { limit?: number; offset?: number }): AuditEvent[] {
    const limit = opts?.limit ?? 500;
    const offset = opts?.offset ?? 0;
    const rows = this.db.prepare(`
      SELECT ae.*,
        CASE
          -- Telephonist: prefer audio_cost_per_second when set
          WHEN ae.event_type = 'telephonist'
            AND mp.audio_cost_per_second IS NOT NULL
            AND mp.audio_cost_per_second > 0
          THEN
            COALESCE(CAST(json_extract(ae.metadata, '$.audio_duration_seconds') AS REAL), 0)
            * mp.audio_cost_per_second
          -- Telephonist with token-based pricing (e.g. Gemini/OpenRouter with real tokens)
          WHEN ae.event_type = 'telephonist'
            AND ae.provider IS NOT NULL AND ae.model IS NOT NULL
            AND ae.input_tokens IS NOT NULL AND ae.input_tokens > 0
          THEN (
            COALESCE(ae.input_tokens, 0) / 1000000.0 * COALESCE(mp.input_price_per_1m, 0) +
            COALESCE(ae.output_tokens, 0) / 1000000.0 * COALESCE(mp.output_price_per_1m, 0)
          )
          -- All other events: token-based
          WHEN ae.event_type != 'telephonist'
            AND ae.provider IS NOT NULL AND ae.model IS NOT NULL AND ae.input_tokens IS NOT NULL
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
    const telephonistEvents = events.filter(e => e.event_type === 'telephonist');

    const totalCostUsd = [...llmEvents, ...telephonistEvents].reduce((sum, e) => sum + (e.estimated_cost_usd ?? 0), 0);
    const totalDurationMs = events.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0);
    const totalAudioSeconds = telephonistEvents.reduce((sum, e) => {
      const meta = e.metadata ? JSON.parse(e.metadata) : null;
      return sum + (meta?.audio_duration_seconds ?? 0);
    }, 0);

    // By agent (llm + telephonist)
    const agentMap = new Map<string, { llmCalls: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number }>();
    for (const e of [...llmEvents, ...telephonistEvents]) {
      const key = e.agent ?? 'unknown';
      const existing = agentMap.get(key) ?? { llmCalls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
      agentMap.set(key, {
        llmCalls: existing.llmCalls + 1,
        inputTokens: existing.inputTokens + (e.input_tokens ?? 0),
        outputTokens: existing.outputTokens + (e.output_tokens ?? 0),
        estimatedCostUsd: existing.estimatedCostUsd + (e.estimated_cost_usd ?? 0),
      });
    }

    // By model (llm + telephonist)
    const modelMap = new Map<string, { calls: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number; provider: string }>();
    for (const e of [...llmEvents, ...telephonistEvents]) {
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
      totalAudioSeconds,
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

  getGlobalSummary(): GlobalAuditSummary {
    // Reusable cost expression (telephonist + token-based)
    const costExpr = `
      CASE
        WHEN ae.event_type = 'telephonist'
          AND mp.audio_cost_per_second IS NOT NULL AND mp.audio_cost_per_second > 0
        THEN COALESCE(CAST(json_extract(ae.metadata, '$.audio_duration_seconds') AS REAL), 0)
             * mp.audio_cost_per_second
        WHEN ae.event_type = 'telephonist'
          AND ae.input_tokens IS NOT NULL AND ae.input_tokens > 0
        THEN COALESCE(ae.input_tokens, 0) / 1000000.0 * COALESCE(mp.input_price_per_1m, 0)
             + COALESCE(ae.output_tokens, 0) / 1000000.0 * COALESCE(mp.output_price_per_1m, 0)
        WHEN ae.event_type != 'telephonist'
          AND ae.provider IS NOT NULL AND ae.input_tokens IS NOT NULL
        THEN COALESCE(ae.input_tokens, 0) / 1000000.0 * COALESCE(mp.input_price_per_1m, 0)
             + COALESCE(ae.output_tokens, 0) / 1000000.0 * COALESCE(mp.output_price_per_1m, 0)
        ELSE 0
      END`;

    // ── Sessions ─────────────────────────────────────────────────────────────
    const sessionsRow = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'paused'   THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN status = 'deleted'  THEN 1 ELSE 0 END) as deleted
      FROM sessions
    `).get() as any;

    const withAuditRow = this.db.prepare(
      `SELECT COUNT(DISTINCT session_id) as n FROM audit_events`
    ).get() as any;

    // ── Global totals (single JOIN pass) ─────────────────────────────────────
    const totalsRow = this.db.prepare(`
      SELECT
        COUNT(*) as totalEventCount,
        SUM(CASE WHEN ae.event_type = 'llm_call'        THEN 1 ELSE 0 END) as llmCallCount,
        SUM(CASE WHEN ae.event_type = 'tool_call'       THEN 1 ELSE 0 END) as toolCallCount,
        SUM(CASE WHEN ae.event_type = 'mcp_tool'        THEN 1 ELSE 0 END) as mcpToolCount,
        SUM(CASE WHEN ae.event_type = 'skill_loaded'  THEN 1 ELSE 0 END) as skillCount,
        SUM(CASE WHEN ae.event_type = 'memory_recovery' THEN 1 ELSE 0 END) as memoryRecoveryCount,
        SUM(CASE WHEN ae.event_type = 'memory_persist'  THEN 1 ELSE 0 END) as memoryPersistCount,
        SUM(CASE WHEN ae.event_type = 'chronos_job'     THEN 1 ELSE 0 END) as chronosJobCount,
        SUM(CASE WHEN ae.event_type = 'task_created'    THEN 1 ELSE 0 END) as taskCreatedCount,
        SUM(CASE WHEN ae.event_type = 'task_completed'  THEN 1 ELSE 0 END) as taskCompletedCount,
        SUM(CASE WHEN ae.event_type = 'telephonist'     THEN 1 ELSE 0 END) as telephonistCount,
        COALESCE(SUM(ae.input_tokens),  0) as totalInputTokens,
        COALESCE(SUM(ae.output_tokens), 0) as totalOutputTokens,
        COALESCE(SUM(ae.duration_ms),   0) as totalDurationMs,
        COALESCE(SUM(
          CASE WHEN ae.event_type = 'telephonist'
            THEN COALESCE(CAST(json_extract(ae.metadata,'$.audio_duration_seconds') AS REAL),0)
            ELSE 0 END
        ), 0) as totalAudioSeconds,
        COALESCE(SUM(${costExpr}), 0) as estimatedCostUsd
      FROM audit_events ae
      LEFT JOIN model_pricing mp ON mp.provider = ae.provider AND mp.model = ae.model
    `).get() as any;

    // ── By agent ─────────────────────────────────────────────────────────────
    const byAgentRows = this.db.prepare(`
      SELECT
        COALESCE(ae.agent, 'unknown') as agent,
        SUM(CASE WHEN ae.event_type = 'llm_call' THEN 1 ELSE 0 END) as llmCalls,
        SUM(CASE WHEN ae.event_type IN ('tool_call','mcp_tool') THEN 1 ELSE 0 END) as toolCalls,
        COALESCE(SUM(ae.input_tokens),  0) as inputTokens,
        COALESCE(SUM(ae.output_tokens), 0) as outputTokens,
        COALESCE(SUM(ae.duration_ms),   0) as totalDurationMs,
        COALESCE(SUM(${costExpr}), 0) as estimatedCostUsd
      FROM audit_events ae
      LEFT JOIN model_pricing mp ON mp.provider = ae.provider AND mp.model = ae.model
      GROUP BY ae.agent
      ORDER BY estimatedCostUsd DESC
    `).all() as any[];

    // ── By model ─────────────────────────────────────────────────────────────
    const byModelRows = this.db.prepare(`
      SELECT
        ae.provider,
        ae.model,
        COUNT(*) as calls,
        COALESCE(SUM(ae.input_tokens),  0) as inputTokens,
        COALESCE(SUM(ae.output_tokens), 0) as outputTokens,
        COALESCE(SUM(${costExpr}), 0) as estimatedCostUsd
      FROM audit_events ae
      LEFT JOIN model_pricing mp ON mp.provider = ae.provider AND mp.model = ae.model
      WHERE ae.model IS NOT NULL
      GROUP BY ae.provider, ae.model
      ORDER BY estimatedCostUsd DESC
    `).all() as any[];

    // ── Top tools ─────────────────────────────────────────────────────────────
    const topToolsRows = this.db.prepare(`
      SELECT
        ae.tool_name,
        ae.agent,
        ae.event_type,
        COUNT(*) as count,
        SUM(CASE WHEN ae.status = 'error' THEN 1 ELSE 0 END) as errorCount
      FROM audit_events ae
      WHERE ae.tool_name IS NOT NULL
        AND ae.event_type IN ('tool_call','mcp_tool')
      GROUP BY ae.tool_name, ae.agent, ae.event_type
      ORDER BY count DESC
      LIMIT 20
    `).all() as any[];

    // ── Recent sessions ──────────────────────────────────────────────────────
    const recentRows = this.db.prepare(`
      SELECT
        ae.session_id,
        s.title,
        s.status,
        s.started_at,
        COUNT(ae.id) as event_count,
        SUM(CASE WHEN ae.event_type = 'llm_call' THEN 1 ELSE 0 END) as llmCallCount,
        COALESCE(SUM(ae.duration_ms), 0) as totalDurationMs,
        COALESCE(SUM(${costExpr}), 0) as estimatedCostUsd
      FROM audit_events ae
      INNER JOIN sessions s ON ae.session_id = s.id
      LEFT JOIN model_pricing mp ON mp.provider = ae.provider AND mp.model = ae.model
      GROUP BY ae.session_id
      ORDER BY MAX(ae.created_at) DESC
      LIMIT 20
    `).all() as any[];

    // ── Daily activity (last 30 days) ─────────────────────────────────────────
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const dailyRows = this.db.prepare(`
      SELECT
        date(ae.created_at / 1000, 'unixepoch') as date,
        COUNT(*) as eventCount,
        SUM(CASE WHEN ae.event_type = 'llm_call' THEN 1 ELSE 0 END) as llmCallCount,
        COALESCE(SUM(${costExpr}), 0) as estimatedCostUsd
      FROM audit_events ae
      LEFT JOIN model_pricing mp ON mp.provider = ae.provider AND mp.model = ae.model
      WHERE ae.created_at >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(since) as any[];

    return {
      sessions: {
        total:     sessionsRow?.total    ?? 0,
        active:    sessionsRow?.active   ?? 0,
        paused:    sessionsRow?.paused   ?? 0,
        archived:  sessionsRow?.archived ?? 0,
        deleted:   sessionsRow?.deleted  ?? 0,
        withAudit: withAuditRow?.n       ?? 0,
      },
      totals: {
        estimatedCostUsd:    totalsRow?.estimatedCostUsd    ?? 0,
        totalDurationMs:     totalsRow?.totalDurationMs     ?? 0,
        totalAudioSeconds:   totalsRow?.totalAudioSeconds   ?? 0,
        totalInputTokens:    totalsRow?.totalInputTokens    ?? 0,
        totalOutputTokens:   totalsRow?.totalOutputTokens   ?? 0,
        totalEventCount:     totalsRow?.totalEventCount     ?? 0,
        llmCallCount:        totalsRow?.llmCallCount        ?? 0,
        toolCallCount:       totalsRow?.toolCallCount       ?? 0,
        mcpToolCount:        totalsRow?.mcpToolCount        ?? 0,
        skillCount:          totalsRow?.skillCount          ?? 0,
        memoryRecoveryCount: totalsRow?.memoryRecoveryCount ?? 0,
        memoryPersistCount:  totalsRow?.memoryPersistCount  ?? 0,
        chronosJobCount:     totalsRow?.chronosJobCount     ?? 0,
        taskCreatedCount:    totalsRow?.taskCreatedCount    ?? 0,
        taskCompletedCount:  totalsRow?.taskCompletedCount  ?? 0,
        telephonistCount:    totalsRow?.telephonistCount    ?? 0,
      },
      byAgent:   byAgentRows,
      byModel:   byModelRows,
      topTools:  topToolsRows,
      recentSessions: recentRows,
      dailyActivity:  dailyRows,
    };
  }
}
