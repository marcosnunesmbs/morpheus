import { AgentRunner } from './runner.js';
import { buildDevKit } from '../devkit/index.js';
import type { SubAgentConfig } from './types.js';

export class TheMerovingian {
  private runner: AgentRunner;

  constructor(config?: SubAgentConfig) {
    this.runner = new AgentRunner('merovingian', config);
  }

  /**
   * Execute any request with full system access (no working_dir restriction, no command allowlist).
   */
  async execute(request: string, sessionId?: string): Promise<string> {
    const ctx = {
      working_dir: process.cwd(),
      allowed_commands: [], // empty = no restriction for Merovingian
    };

    const tools = buildDevKit(ctx);

    const result = await this.runner.run(request, tools, sessionId);
    return result.content;
  }
}
