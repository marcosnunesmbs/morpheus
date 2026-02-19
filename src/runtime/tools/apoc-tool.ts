import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Apoc } from "../apoc.js";

/**
 * Tool that Oracle uses to delegate devtools tasks to Apoc.
 * Oracle should call this whenever the user requests operations like:
 * - Reading/writing/listing files
 * - Running shell commands or scripts
 * - Git operations (status, log, commit, push, etc.)
 * - Package management (npm install, etc.)
 * - Process inspection or management
 * - Network diagnostics (ping, curl, DNS)
 * - System information queries
 */
export const ApocDelegateTool = tool(
  async ({ task, context }: { task: string; context?: string }) => {
    try {
      const apoc = Apoc.getInstance();
      const result = await apoc.execute(task, context);
      return result;
    } catch (err: any) {
      return `Apoc execution failed: ${err.message}`;
    }
  },
  {
    name: "apoc_delegate",
    description: `Delegate a devtools task to Apoc, the specialized development subagent.

Use this tool when the user asks for ANY of the following:
- File operations: read, write, create, delete files or directories
- Shell commands: run scripts, execute commands, check output
- Git: status, log, diff, commit, push, pull, clone, branch
- Package management: npm install/update/audit, yarn, package.json inspection
- Process management: list processes, kill processes, check ports
- Network: ping hosts, curl URLs, DNS lookups
- System info: environment variables, OS info, disk space, memory
- Internet search: search DuckDuckGo and verify facts by reading at least 3 sources via browser_navigate before reporting results.
- Browser automation: navigate websites (JS/SPA), inspect DOM, click elements, fill forms. Apoc will ask for missing user input (e.g. credentials, form fields) before proceeding.

Provide a clear natural language task description. Optionally provide context
from the current conversation to help Apoc understand the broader goal.`,
    schema: z.object({
      task: z.string().describe("Clear description of the devtools task to execute"),
      context: z.string().optional().describe("Optional context from the conversation to help Apoc understand the goal"),
    }),
  }
);
