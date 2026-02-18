export interface ToolContext {
  /** Working directory. Apoc is constrained here; Merovingian uses process.cwd(). */
  working_dir: string;
  /** Allowlist for run_command. Empty array = no restriction (Merovingian). */
  allowed_commands: string[];
  /** project_id or session_id used for permission checks */
  permission_scope_id?: string;
  /** Default timeout in ms for shell operations */
  timeout_ms?: number;
}

export interface ToolResult {
  success: boolean;
  output?: string;   // truncated to MAX_OUTPUT_BYTES
  error?: string;
  metadata?: Record<string, unknown>;
}

export const MAX_OUTPUT_BYTES = 50 * 1024; // 50 KB
