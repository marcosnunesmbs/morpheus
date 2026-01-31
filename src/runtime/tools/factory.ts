import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { DisplayManager } from "../display.js";
import { StructuredTool } from "@langchain/core/tools";

export class ToolsFactory {
  static async create(): Promise<StructuredTool[]> { // LangChain Tools type
    const display = DisplayManager.getInstance();

    const client = new MultiServerMCPClient({
      mcpServers: {
        coingecko: {
          transport: "stdio",
          command: "npx",
          args: ["-y", "mcp_coingecko_price_ts"],
        },
      },
      // log the MCP client's internal events
      beforeToolCall: ({ serverName, name, args }) => {
        display.log(`MCP Tool Call - Server: ${serverName}, Tool: ${name}, Args: ${JSON.stringify(args)}`);
        return;
      },
      // log the results of tool calls
      afterToolCall: (res) => {
        display.log(`MCP Tool Result - ${JSON.stringify(res)}`);
        return;
      }
    });

    try {
      const tools = await client.getTools();
      return tools;
    } catch (error) {
      display.log(`Failed to initialize MCP tools: ${error}`, { level: 'warning' });
      return []; // Return empty tools on failure to allow agent to start
    }
  }
}
