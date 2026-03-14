import type { StructuredTool } from '@langchain/core/tools';
import { AuditRepository } from '../audit/repository.js';
import { DisplayManager } from '../display.js';
import { ConfigManager } from '../../config/manager.js';

const display = DisplayManager.getInstance();

/**
 * Wraps a StructuredTool to record audit events on each invocation.
 * The `getSessionId` getter is called at invocation time so it reflects
 * the current agent's session (not the session at build time).
 */
function instrumentTool(tool: StructuredTool, getSessionId: () => string | undefined, getAgent: () => string): StructuredTool {
  const original = (tool as any)._call.bind(tool);
  (tool as any)._call = async function(input: any, runManager?: any) {
    const startMs = Date.now();
    const sessionId = getSessionId() ?? 'unknown';
    const agent = getAgent();

    // Inject GWS credentials if it's a shell tool and command starts with 'gws'
    if ((tool.name === 'execShell' || tool.name === 'execCommand') && input?.command?.trim().startsWith('gws')) {
      const gwsConfig = ConfigManager.getInstance().getGwsConfig();
      if (gwsConfig.service_account_json) {
        input.env = {
          ...(input.env || {}),
          GOOGLE_APPLICATION_CREDENTIALS: gwsConfig.service_account_json,
          GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: gwsConfig.service_account_json,
        };
        display.log(
          `Injected GWS credentials into environment for tool ${tool.name}`,
          { source: 'DevKitInstrumentation', level: 'debug' }
        );
      }
    }

    display.startActivity(agent, `Executing tool: ${tool.name}`);
    try {
      const result = await original(input, runManager);
      const durationMs = Date.now() - startMs;
      AuditRepository.getInstance().insert({
        session_id: sessionId,
        event_type: 'tool_call',
        agent: agent as any,
        tool_name: tool.name,
        duration_ms: durationMs,
        status: 'success',
      });
      display.endActivity(agent, true);
      return result;
    } catch (err: any) {
      display.endActivity(agent, false);
      const durationMs = Date.now() - startMs;
      AuditRepository.getInstance().insert({
        session_id: sessionId,
        event_type: 'tool_call',
        agent: agent as any,
        tool_name: tool.name,
        duration_ms: durationMs,
        status: 'error',
        metadata: { error: err?.message ?? String(err) },
      });
      throw err;
    }
  };
  return tool;
}

/**
 * Wraps all DevKit tools with audit instrumentation.
 * Call this after buildDevKit() to add Morpheus audit tracking.
 */
export function instrumentDevKitTools(
  tools: StructuredTool[],
  getSessionId: () => string | undefined,
  getAgent: () => string,
): StructuredTool[] {
  return tools.map(tool => instrumentTool(tool, getSessionId, getAgent));
}
