# MNU-8: Mudar Nomeclaturas (Change Nomenclature)

## Goal
Rename core components and configuration file names (Agent→Oracle, AudioAgent→Telephonist, ToolsFactory→Construtor, config.yaml→zaion.yaml) with automatic migration and updated logs/docs/tests.

## Prerequisites
Make sure that the use is currently on the `marcosnunesmbs/mnu-8-mudar-nomeclaturas` branch before beginning implementation.  
If not, move them to the correct branch. If the branch does not exist, create it from main.

### Step-by-Step Instructions

#### Step 1: Implement config migration and new config path
- [ ] Create a new file at src/runtime/migration.ts with the content below:

```typescript
import fs from 'fs-extra';
import path from 'path';
import { PATHS } from '../config/paths.js';
import { DisplayManager } from './display.js';

export async function migrateConfigFile(): Promise<void> {
  const display = DisplayManager.getInstance();
  const legacyPath = (PATHS as any).legacyConfig ?? path.join(PATHS.root, 'config.yaml');
  const newPath = PATHS.config;

  const legacyExists = await fs.pathExists(legacyPath);
  const newExists = await fs.pathExists(newPath);

  if (legacyExists && !newExists) {
    try {
      await fs.ensureDir(PATHS.root);
      await fs.move(legacyPath, newPath, { overwrite: false });
      display.log('Migrated config.yaml to zaion.yaml', { source: 'Zaion', level: 'info' });
    } catch (err: any) {
      display.log(`Failed to migrate config.yaml to zaion.yaml: ${err.message}`, { source: 'Zaion', level: 'warning' });
    }
    return;
  }

  if (legacyExists && newExists) {
    display.log('Both config.yaml and zaion.yaml exist. Using zaion.yaml and leaving config.yaml in place.', {
      source: 'Zaion',
      level: 'warning'
    });
  }
}
```

- [ ] Replace the entire content of src/config/paths.ts with the updated version below:

```typescript
import os from 'os';
import path from 'path';

export const USER_HOME = os.homedir();
export const MORPHEUS_ROOT = path.join(USER_HOME, '.morpheus');
export const LOGS_DIR = path.join(MORPHEUS_ROOT, 'logs');

export const PATHS = {
  root: MORPHEUS_ROOT,
  config: path.join(MORPHEUS_ROOT, 'zaion.yaml'),
  legacyConfig: path.join(MORPHEUS_ROOT, 'config.yaml'),
  pid: path.join(MORPHEUS_ROOT, 'morpheus.pid'),
  logs: LOGS_DIR,
  memory: path.join(MORPHEUS_ROOT, 'memory'),
  cache: path.join(MORPHEUS_ROOT, 'cache'),
  commands: path.join(MORPHEUS_ROOT, 'commands'),
  mcps: path.join(MORPHEUS_ROOT, 'mcps.json'),
};
```

- [ ] Replace the entire content of src/config/manager.ts with the updated version below:

```typescript
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { z } from 'zod';
import { MorpheusConfig, DEFAULT_CONFIG } from '../types/config.js';
import { PATHS } from './paths.js';
import { setByPath } from './utils.js';
import { ConfigSchema } from './schemas.js';
import { migrateConfigFile } from '../runtime/migration.js';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: MorpheusConfig = DEFAULT_CONFIG;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public async load(): Promise<MorpheusConfig> {
    try {
      await migrateConfigFile();

      if (await fs.pathExists(PATHS.config)) {
        const raw = await fs.readFile(PATHS.config, 'utf8');
        const parsed = yaml.load(raw);
        // Validate and merge with defaults via Zod
        this.config = ConfigSchema.parse(parsed) as MorpheusConfig;
      } else {
        // File doesn't exist, use defaults
        this.config = DEFAULT_CONFIG;
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Fallback to default if load fails
      this.config = DEFAULT_CONFIG;
    }
    return this.config;
  }

  public get(): MorpheusConfig {
    return this.config;
  }

  public async set(path: string, value: any): Promise<void> {
    // Clone current config to apply changes
    const configClone = JSON.parse(JSON.stringify(this.config));
    setByPath(configClone, path, value);
    await this.save(configClone);
  }

  public async save(newConfig: Partial<MorpheusConfig>): Promise<void> {
    // Deep merge or overwrite? simpler to overwrite for now or merge top level
    const updated = { ...this.config, ...newConfig };
    // Validate before saving
    const valid = ConfigSchema.parse(updated);
    
    await fs.ensureDir(PATHS.root);
    await fs.writeFile(PATHS.config, yaml.dump(valid), 'utf8');
    this.config = valid as MorpheusConfig;
  }
}
```

- [ ] Replace the entire content of src/runtime/scaffold.ts with the updated version below:

```typescript
import fs from 'fs-extra';
import { PATHS } from '../config/paths.js';
import { ConfigManager } from '../config/manager.js';
import { DEFAULT_MCP_TEMPLATE } from '../types/mcp.js';
import chalk from 'chalk';
import ora from 'ora';
import { migrateConfigFile } from './migration.js';

export async function scaffold(): Promise<void> {
  const spinner = ora('Ensuring Morpheus environment...').start();

  try {
    // Create all directories
    await Promise.all([
      fs.ensureDir(PATHS.root),
      fs.ensureDir(PATHS.logs),
      fs.ensureDir(PATHS.memory),
      fs.ensureDir(PATHS.cache),
      fs.ensureDir(PATHS.commands),
    ]);

    // Migrate config.yaml -> zaion.yaml if needed
    await migrateConfigFile();

    // Create config if not exists
    const configManager = ConfigManager.getInstance();
    if (!(await fs.pathExists(PATHS.config))) {
        await configManager.save({}); // Saves default config
    } else {
        await configManager.load(); // Load if exists (although load handles existence check too)
    }

    // Create mcps.json if not exists
    if (!(await fs.pathExists(PATHS.mcps))) {
      await fs.writeJson(PATHS.mcps, DEFAULT_MCP_TEMPLATE, { spaces: 2 });
    }

    spinner.succeed('Morpheus environment ready at ' + chalk.cyan(PATHS.root));
  } catch (error) {
    spinner.fail('Failed to scaffold environment');
    throw error;
  }
}
```

##### Step 1 Verification Checklist
- [ ] Fresh init creates zaion.yaml (not config.yaml)
- [ ] Legacy config.yaml is migrated on load
- [ ] No build errors from TypeScript

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 2: Rename core runtime classes and files
- [ ] Create src/runtime/oracle.ts with the full content below:

```typescript
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { IOracle } from "./types.js";
import { ProviderFactory } from "./providers/factory.js";
import { Construtor } from "./tools/factory.js";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { ReactAgent } from "langchain";
import { UsageMetadata } from "../types/usage.js";

export class Oracle implements IOracle {
  private provider?: ReactAgent;
  private config: MorpheusConfig;
  private history?: BaseListChatMessageHistory;
  private display = DisplayManager.getInstance();
  private databasePath?: string;

  constructor(config?: MorpheusConfig, overrides?: { databasePath?: string }) {
    this.config = config || ConfigManager.getInstance().get();
    this.databasePath = overrides?.databasePath;
  }

  async initialize(): Promise<void> {
    if (!this.config.llm) {
      throw new Error("LLM configuration missing in config object.");
    }

    // Basic validation before provider creation
    if (!this.config.llm.provider) {
      throw new Error("LLM provider not specified in configuration.");
    }

    // Note: API Key validation is delegated to ProviderFactory or the Provider itself 
    // to allow for Environment Variable fallback supported by LangChain.

    try {
      const tools = await Construtor.create();
      this.provider = await ProviderFactory.create(this.config.llm, tools);
      if (!this.provider) {
        throw new Error("Provider factory returned undefined");
      }

      // Initialize persistent memory with SQLite
      this.history = new SQLiteChatMessageHistory({
        sessionId: "default",
        databasePath: this.databasePath,
        limit: this.config.memory?.limit || 100, // Fallback purely defensive if config type allows optional
      });
    } catch (err) {
      if (err instanceof ProviderError) throw err; // Re-throw known errors

      // Wrap unknown errors
      throw new ProviderError(
        this.config.llm.provider || 'unknown',
        err,
        "Oracle initialization failed"
      );
    }
  }

  async chat(message: string, extraUsage?: UsageMetadata): Promise<string> {
    if (!this.provider) {
      throw new Error("Oracle not initialized. Call initialize() first.");
    }

    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }

    try {
      this.display.log('Processing message...', { source: 'Oracle' });

      const userMessage = new HumanMessage(message);
      
      // Inject provider/model metadata for persistence
      (userMessage as any).provider_metadata = {
        provider: this.config.llm.provider,
        model: this.config.llm.model
      };

      // Attach extra usage (e.g. from Audio) to the user message to be persisted
      if (extraUsage) {
        (userMessage as any).usage_metadata = extraUsage;
      }

      const systemMessage = new SystemMessage(
          `You are ${this.config.agent.name}, ${this.config.agent.personality},a local AI operator responsible for orchestrating tools, MCPs, and language models to solve the user’s request accurately and reliably.

          Your primary responsibility is NOT to answer from memory when external tools are available.

          You must follow these rules strictly:

          1. Tool Evaluation First
          Before generating a final answer, always evaluate whether any available tool or MCP is capable of providing a more accurate, up-to-date, or authoritative response.

          If a tool can provide the answer, you MUST call the tool.

          2. No Historical Assumptions for Dynamic Data
          If the user asks something that:
          - may change over time
          - depends on system state
          - depends on filesystem
          - depends on external APIs
          - was previously asked in the conversation

          You MUST NOT reuse previous outputs as final truth.

          Instead:
          - Re-evaluate available tools
          - Re-execute the relevant tool
          - Provide a fresh result

          Even if the user already asked the same question before, you must treat the request as requiring a new verification.

          3. History Is Context, Not Source of Truth
          Conversation history may help with context, but it must not replace real-time verification via tools when tools are available.

          Never assume:
          - System state
          - File contents
          - Database values
          - API responses
          based only on previous messages.

          4. Tool Priority Over Language Guessing
          If a tool can compute, fetch, inspect, or verify something, prefer tool usage over generating a speculative answer.

          Never hallucinate values that could be retrieved through a tool.

          5. Freshness Principle
          Repeated user queries require fresh validation.
          Do not respond with:
          "As I said before..."
          Instead, perform a new tool check if applicable.

          6. Final Answer Policy
          Only provide a direct natural language answer if:
          - No tool is relevant
          - Tools are unavailable
          - The question is conceptual or explanatory

          Otherwise, use tools first.

          You are an operator, not a guesser.
          Accuracy is more important than speed.
      `);

      // Load existing history from database
      const previousMessages = await this.history.getMessages();

      const messages = [
        systemMessage,
        ...previousMessages,
        userMessage
      ];

      const response = await this.provider.invoke({ messages });

      // Identify new messages generated during the interaction
      // The `messages` array passed to invoke had length `messages.length`
      // The `response.messages` contains the full state.
      // New messages start after the inputs.
      const startNewMessagesIndex = messages.length;
      const newGeneratedMessages = response.messages.slice(startNewMessagesIndex);

      // Persist User Message first
      await this.history.addMessage(userMessage);

      // Persist all new intermediate tool calls and responses
      for (const msg of newGeneratedMessages) {
        // Inject provider/model metadata search interactors
        (msg as any).provider_metadata = {
          provider: this.config.llm.provider,
          model: this.config.llm.model
        };
        await this.history.addMessage(msg);
      }

      this.display.log('Response generated.', { source: 'Oracle' });
      
      const lastMessage = response.messages[response.messages.length - 1];
      return (typeof lastMessage.content === 'string') ? lastMessage.content : JSON.stringify(lastMessage.content);
    } catch (err) {
      throw new ProviderError(this.config.llm.provider, err, "Chat request failed");
    }
  }

  async getHistory(): Promise<BaseMessage[]> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }
    return await this.history.getMessages();
  }

  async clearMemory(): Promise<void> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }
    await this.history.clear();
  }
}
```

- [ ] Create src/runtime/telephonist.ts with the full content below:

```typescript
import { GoogleGenAI } from '@google/genai';
import { UsageMetadata } from '../types/usage.js';

export interface AudioTranscriptionResult {
  text: string;
  usage: UsageMetadata;
}

export interface ITelephonist {
  /**
   * Transcribes an audio file on disk to text.
   * 
   * @param filePath - The absolute path of the audio file to transcribe.
   * @param mimeType - The MIME type of the audio file (e.g. 'audio/ogg').
   * @param apiKey - The Gemini API key to use for the transaction.
   * @returns A Promise resolving to result with text and usage.
   * @throws Error if upload or transcription fails.
   */
  transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult>;
}

export class Telephonist implements ITelephonist {
  async transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      // Upload the file
      const uploadResult = await ai.files.upload({
        file: filePath,
        config: { mimeType }
      });

      // Generate content (transcription)
      // using gemini-1.5-flash as it is fast and supports audio
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              { 
                fileData: { 
                  fileUri: uploadResult.uri, 
                  mimeType: uploadResult.mimeType 
                } 
              },
              { text: "Transcribe this audio message accurately. Return only the transcribed text without any additional commentary." }
            ]
          }
        ]
      });

      // The new SDK returns text directly on the response object
      const text = response.text;
      if (!text) {
        throw new Error('No transcription generated');
      }

      // Extract usage metadata
      const usage = response.usageMetadata;
      
      const usageMetadata: UsageMetadata = {
        input_tokens: usage?.promptTokenCount ?? 0,
        output_tokens: usage?.candidatesTokenCount ?? 0,
        total_tokens: usage?.totalTokenCount ?? 0,
        input_token_details: {
            cache_read: usage?.cachedContentTokenCount ?? 0
        }
      };

      return { text, usage: usageMetadata };
    } catch (error) {
      // Wrap error for clarity
      if (error instanceof Error) {
        throw new Error(`Audio transcription failed: ${error.message}`);
      }
      throw error;
    }
  }
}
```

- [ ] Replace the entire content of src/runtime/tools/factory.ts with the updated version below:

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { DisplayManager } from "../display.js";
import { StructuredTool } from "@langchain/core/tools";
import { loadMCPConfig } from "../../config/mcp-loader.js";

const display = DisplayManager.getInstance();

// Fields not supported by Google Gemini API
const UNSUPPORTED_SCHEMA_FIELDS = ['examples', 'additionalInfo', 'default', '$schema'];

/**
 * Recursively removes unsupported fields from JSON schema objects.
 * This is needed because some MCP servers (like Coolify) return schemas
 * with fields that Gemini doesn't accept.
 */
function sanitizeSchema(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeSchema);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (!UNSUPPORTED_SCHEMA_FIELDS.includes(key)) {
      sanitized[key] = sanitizeSchema(value);
    }
  }
  return sanitized;
}

/**
 * Wraps a tool to sanitize its schema for Gemini compatibility.
 * Creates a proxy that intercepts schema access and sanitizes the output.
 */
function wrapToolWithSanitizedSchema(tool: StructuredTool): StructuredTool {

  display.log('Tool loaded: - '+ tool.name, { source: 'Construtor' });
  // The MCP tools have a schema property that returns JSON Schema
  // We need to intercept and sanitize it
  const originalSchema = (tool as any).schema;
  
  if (originalSchema && typeof originalSchema === 'object') {
    // Sanitize the schema object directly
    const sanitized = sanitizeSchema(originalSchema);
    (tool as any).schema = sanitized;
  }
  
  return tool;
}

export class Construtor {
  static async create(): Promise<StructuredTool[]> { // LangChain Tools type
    const display = DisplayManager.getInstance();

    const mcpServers = await loadMCPConfig();
    const serverCount = Object.keys(mcpServers).length;

    if (serverCount === 0) {
        // display.log('No MCP servers configured in mcps.json', { level: 'info', source: 'Construtor' });
        return [];
    }

    const client = new MultiServerMCPClient({
      mcpServers: mcpServers as any,
      onConnectionError: "ignore",
      // log the MCP client's internal events
      // beforeToolCall: ({ serverName, name, args }) => {
      //   display.log(`MCP Tool Call - Server: ${serverName}, Tool: ${name}, Args: ${JSON.stringify(args)}`, { source: 'MCPServer' });
      //   return;
      // },
      // // log the results of tool calls
      // afterToolCall: (res) => {
      //   display.log(`MCP Tool Result - ${JSON.stringify(res)}`, { source: 'MCPServer' });
      //   return;
      // }
    });

    try {
      const tools = await client.getTools();
      tools.map(tool => {
        display.log(`Loaded MCP tool: ${tool.name} from server ${tool.serverName}`, { level: 'info', source: 'Construtor' });
      });
      
      // Sanitize tool schemas to remove fields not supported by Gemini
      const sanitizedTools = tools.map(tool => wrapToolWithSanitizedSchema(tool));
      
      display.log(`Loaded ${sanitizedTools.length} MCP tools (schemas sanitized for Gemini compatibility)`, { level: 'info', source: 'Construtor' });
      
      return sanitizedTools;
    } catch (error) {
      display.log(`Failed to initialize MCP tools: ${error}`, { level: 'warning', source: 'Construtor' });
      return []; // Return empty tools on failure to allow agent to start
    }
  }
}
```

- [ ] Replace the entire content of src/runtime/types.ts with the updated version below (IAgent → IOracle):

```typescript
import { BaseMessage } from "@langchain/core/messages";
import { UsageMetadata } from "../types/usage.js";

export interface IOracle {
  /**
   * Initialize the oracle with configuration.
   * Throws error if validation fails.
   */
  initialize(): Promise<void>;

  /**
   * Process a user message and return the AI response.
   * Maintains internal session state.
   * @param message - The user's input text
   * @param extraUsage - Optional usage metadata to attribute to this message (e.g. from Audio transcription)
   */
  chat(message: string, extraUsage?: UsageMetadata): Promise<string>;

  /**
   * Get the current conversation history.
   */
  getHistory(): Promise<BaseMessage[]>;

  /**
   * Reset the current session.
   */
  clearMemory(): Promise<void>;
}

export interface Session {
  id: string;
  history: BaseMessage[];
  lastActivity: Date;
}
```

- [ ] Remove the old files:
  - src/runtime/agent.ts
  - src/runtime/audio-agent.ts

##### Step 2 Verification Checklist
- [ ] TypeScript builds with new class names
- [ ] No missing imports in runtime

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 3: Update imports and usage references
- [ ] Update src/channels/telegram.ts with the updated snippet below (replace the existing block with this block):

```typescript
import { Oracle } from '../runtime/oracle.js';
import { Telephonist } from '../runtime/telephonist.js';
...
  private agent: Oracle;
  private audioAgent = new Telephonist();
...
  constructor(agent: Oracle) {
```

- [ ] Update src/cli/commands/start.ts with the updated snippet below:

```typescript
import { Oracle } from '../../runtime/oracle.js';
...
  .description('Start the Morpheus oracle')
...
        display.log(chalk.cyan("Please run 'morpheus init' first to set up your oracle."));
...
      display.log(chalk.green(`Morpheus Oracle (${config.agent.name}) starting...`));
...
      const agent = new Oracle(config);
...
        display.log(chalk.green('✓ Oracle initialized'), { source: 'Oracle' });
...
          display.log(chalk.red('\nOracle initialization failed:'));
...
      display.startSpinner('Oracle active and listening... (Press ctrl+c to stop)');
```

- [ ] Update src/runtime/__tests__/agent.test.ts with the updated snippet below:

```typescript
import { Oracle } from '../oracle.js';
import { Construtor } from '../tools/factory.js';
...
  let agent: Oracle;
...
    vi.mocked(Construtor.create).mockResolvedValue([]);
...
    agent = new Oracle(DEFAULT_CONFIG);
...
    expect(Construtor.create).toHaveBeenCalled();
```

- [ ] Update src/runtime/__tests__/persistence.test.ts with the updated snippet below:

```typescript
import { Oracle } from "../oracle.js";
import { Construtor } from "../tools/factory.js";
...
  let agent: Oracle;
...
    vi.mocked(Construtor.create).mockResolvedValue([]);
    agent = new Oracle(DEFAULT_CONFIG, { databasePath: testDbPath });
...
      const agent2 = new Oracle(DEFAULT_CONFIG, { databasePath: testDbPath });
```

- [ ] Update src/runtime/__tests__/agent-memory-limit.test.ts with the updated snippet below:

```typescript
import { Oracle } from '../oracle.js';
...
  let agent: Oracle;
...
    agent = new Oracle(limitedConfig);
```

- [ ] Update src/runtime/__tests__/manual_start_verify.ts with the updated snippet below:

```typescript
import { Oracle } from '../oracle.js';
...
  const agent = new Oracle(manualConfig);
```

- [ ] Update src/runtime/__tests__/tools-factory.test.ts with the updated snippet below:

```typescript
import { Construtor } from '../factory.js';
...
describe('Construtor', () => {
...
        const tools = await Construtor.create();
```

- [ ] Update src/http/api.ts with the updated snippet below:

```typescript
import { Oracle } from '../runtime/oracle.js';
...
  let mockAgent: Oracle;
...
    } as unknown as Oracle;
```

##### Step 3 Verification Checklist
- [ ] No remaining imports from runtime/agent.js or runtime/audio-agent.js
- [ ] No remaining references to ToolsFactory in code

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 4: Update DisplayManager log source tags
- [ ] Update src/runtime/display.ts with the updated source map below:

```typescript
      if (options.source === 'Telegram') {
        color = chalk.green;
      } else if (options.source === 'Oracle') {
        color = chalk.hex('#FFA500');
      }
      else if (options.source === 'Telephonist') {
        color = chalk.hex('#b902b9');
      }
      else if (options.source === 'Construtor') {
        color = chalk.hex('#806d00');
      }
      else if (options.source === 'MCPServer') {
        color = chalk.hex('#be4b1d');
      }
      else if (options.source === 'ConstructLoad') {
        color = chalk.hex('#e5ff00');
      }
      else if (options.source === 'Zaion') {
        color = chalk.hex('#00c3ff');
      }
```

- [ ] Update src/config/mcp-loader.ts with the updated log sources:

```typescript
display.log(`Failed to parse mcps.json: ${err.message}`, { level: 'error', source: 'Zaion' });
...
display.log(`Loaded MCP server: ${name}`, { level: 'debug', source: 'Zaion' });
...
display.log(`Invalid MCP server '${name}': ${issues}`, { level: 'warning', source: 'Zaion' });
...
display.log(`Invalid MCP server '${name}': ${err.message}`, { level: 'warning', source: 'Zaion' });
```

- [ ] Update src/runtime/llm/agent-executor.ts with the updated log sources:

```typescript
display.log(`Executing tool: ${request.toolCall.name}`, { level: "warning", source: 'ConstructLoad' });
display.log(`Arguments: ${JSON.stringify(request.toolCall.args)}`, { level: "info", source: 'ConstructLoad' });
...
display.log("Tool completed successfully", { level: "info", source: 'ConstructLoad' });
...
display.log(`Tool failed: ${e}`, { level: "error", source: 'ConstructLoad' });
```

- [ ] Update src/http/api.ts with the updated log source:

```typescript
display.log(`Configuration updated via UI:\n  - ${changes.join('\n  - ')}`, { 
  source: 'Zaion', 
  level: 'info' 
});
```

##### Step 4 Verification Checklist
- [ ] Logs show Oracle/Telephonist/Construtor/ConstructLoad/Zaion sources
- [ ] Log color mapping remains intact

#### Step 4 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 5: Update tests for renamed classes
- [ ] Update remaining test files referencing Agent/ToolsFactory per Step 3 patterns:
  - src/runtime/__tests__/agent.test.ts
  - src/runtime/__tests__/persistence.test.ts
  - src/runtime/__tests__/agent-memory-limit.test.ts
  - src/runtime/__tests__/manual_start_verify.ts
  - src/runtime/__tests__/tools-factory.test.ts

##### Step 5 Verification Checklist
- [ ] npm test passes
- [ ] No failing mocks for renamed classes

#### Step 5 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 6: Update CLI and user-facing text
- [ ] Update src/cli/commands/start.ts (already updated in Step 3)
- [ ] Update src/cli/commands/init.ts to rename agent wording to oracle (string replacements):
  - Replace “agent” with “oracle” in user-facing prompts
- [ ] Update README.md occurrences of config.yaml → zaion.yaml
- [ ] Update DOCUMENTATION.md occurrences of config.yaml → zaion.yaml
- [ ] Update ARCHITECTURE.md references:
  - config.yaml → zaion.yaml
  - agent.ts → oracle.ts
  - IAgent → IOracle
  - Agent → Oracle
- [ ] Update QWEN.md references:
  - config.yaml → zaion.yaml
  - Agent → Oracle
  - IAgent → IOracle

##### Step 6 Verification Checklist
- [ ] CLI output mentions oracle and zaion.yaml
- [ ] Docs show zaion.yaml and Oracle naming

#### Step 6 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 7: Update specs and documentation
- [ ] Replace in specs/001-* through specs/021-*:
  - config.yaml → zaion.yaml
  - Agent → Oracle
  - AudioAgent → Telephonist
  - ToolsFactory → Construtor

##### Step 7 Verification Checklist
- [ ] No remaining config.yaml references in specs
- [ ] Specs reference Oracle and Telephonist consistently

#### Step 7 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 8: Final validation and migration testing
- [ ] Run npm run build
- [ ] Run npm test
- [ ] Fresh install test:
  - Delete ~/.morpheus
  - Run npm start -- init
  - Verify zaion.yaml is created
- [ ] Migration test:
  - Create ~/.morpheus/config.yaml
  - Run npm start -- start
  - Verify file migrated to zaion.yaml and logs show Zaion
- [ ] Verify log sources:
  - Oracle, Telephonist, Construtor, ConstructLoad, Zaion appear

##### Step 8 Verification Checklist
- [ ] Build succeeds
- [ ] Tests pass
- [ ] Migration works without manual steps

#### Step 8 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
