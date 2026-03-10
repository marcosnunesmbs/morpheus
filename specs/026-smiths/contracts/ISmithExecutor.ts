/**
 * Smith-side executor interface.
 * Receives tool payloads from Morpheus and executes them locally.
 */
export interface ISmithExecutor {
  /** Execute a DevKit tool with given arguments */
  execute(tool: string, args: Record<string, unknown>): Promise<SmithExecutionResult>;

  /** List available tools on this Smith */
  getCapabilities(): string[];

  /** Check if a specific tool is available and allowed */
  canExecute(tool: string): boolean;
}

export interface SmithExecutionResult {
  success: boolean;
  data: unknown;
  error?: string;
  duration_ms: number;
}
