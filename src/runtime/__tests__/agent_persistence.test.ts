import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Agent } from "../agent.js";
import { ProviderFactory } from "../providers/factory.js";
import { DEFAULT_CONFIG } from "../../types/config.js";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";
import * as fs from "fs-extra";
import * as path from "path";
import { tmpdir } from "os";
import { homedir } from "os";
import { ReactAgent } from "langchain";
import { ToolsFactory } from "../tools/factory.js";

vi.mock("../providers/factory.js");
vi.mock("../tools/factory.js");

describe("Agent Persistence Integration", () => {
  let agent: Agent;
  let testDbPath: string;
  let tempDir: string;
  const mockProvider = {
    invoke: vi.fn(),
  } as unknown as ReactAgent;

  beforeEach(async () => {
    vi.resetAllMocks();
    
    // Create a unique temporary test database path for each test to avoid interference
    tempDir = path.join(tmpdir(), "morpheus-test-agent", Date.now().toString() + Math.random().toString(36).substring(7));
    testDbPath = path.join(tempDir, "short-memory.db");
    
    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage("Test response")] 
      };
    });
    vi.mocked(ProviderFactory.create).mockResolvedValue(mockProvider);
    vi.mocked(ToolsFactory.create).mockResolvedValue([]);
    
    agent = new Agent(DEFAULT_CONFIG, { databasePath: testDbPath });
  });

  afterEach(async () => {
    // Clean up temporary test directory
    if (fs.existsSync(tempDir)) {
      try {
        fs.removeSync(tempDir);
      } catch (err) {
        // Ignore removal errors if file is locked
      }
    }
  });

  describe("Database File Creation", () => {
    it("should create database file on initialization", async () => {
      await agent.initialize();
      expect(fs.existsSync(testDbPath)).toBe(true);
    });
  });

  describe("Message Persistence", () => {
    it("should persist messages to database", async () => {
      await agent.initialize();
      
      // Send a message
      await agent.chat("Hello, Agent!");
      
      // Verify history contains the message
      const history = await agent.getHistory();
      expect(history).toHaveLength(2); // User message + AI response
      expect(history[0].content).toBe("Hello, Agent!");
      expect(history[1].content).toBe("Test response");
    });

    it("should restore conversation history on restart", async () => {
      // First session: send a message
      await agent.initialize();
      await agent.chat("Remember this message");
      const firstHistory = await agent.getHistory();
      expect(firstHistory).toHaveLength(2);
      
      // Simulate restart: create new agent instance with SAME database path
      const agent2 = new Agent(DEFAULT_CONFIG, { databasePath: testDbPath });
      await agent2.initialize();
      
      // Verify history was restored
      const restoredHistory = await agent2.getHistory();
      expect(restoredHistory.length).toBeGreaterThanOrEqual(2);
      
      // Check that the old messages are present
      const contents = restoredHistory.map(m => m.content);
      expect(contents).toContain("Remember this message");
      expect(contents).toContain("Test response");
    });

    it("should accumulate messages across multiple conversations", async () => {
      await agent.initialize();
      
      // First conversation
      await agent.chat("First message");
      
      // Second conversation
    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage("Second response")] 
      };
    });
      await agent.chat("Second message");
      
      // Verify all messages are persisted
      const history = await agent.getHistory();
      expect(history).toHaveLength(4);
      expect(history[0].content).toBe("First message");
      expect(history[1].content).toBe("Test response");
      expect(history[2].content).toBe("Second message");
      expect(history[3].content).toBe("Second response");
    });
  });

  describe("Memory Clearing", () => {
    it("should clear all persisted messages", async () => {
      await agent.initialize();
      
      // Add some messages
      await agent.chat("Message 1");
      await agent.chat("Message 2");
      
      // Verify messages exist
      let history = await agent.getHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Clear memory
      await agent.clearMemory();
      
      // Verify messages are cleared
      history = await agent.getHistory();
      expect(history).toEqual([]);
    });

    it("should start fresh after clearing memory", async () => {
      await agent.initialize();
      
      // Add and clear messages
      await agent.chat("Old message");
      await agent.clearMemory();
      
      // Add new message
    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage("New response")] 
      };
    });
      await agent.chat("New message");
      
      // Verify only new messages exist
      const history = await agent.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe("New message");
      expect(history[1].content).toBe("New response");
    });
  });

  describe("Context Preservation", () => {
    it("should include history in conversation context", async () => {
      await agent.initialize();
      
      // First message
      await agent.chat("My name is Alice");
      
    // Second message (should have context)
    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage("Hello Alice!")] 
      };
    });
    await agent.chat("What is my name?");
      
      // Verify the provider was called with full history
      const lastCall = (mockProvider.invoke as any).mock.calls[1];
      const messagesPassedToLLM = lastCall[0].messages;
      
      // Should include: system message, previous user message, previous AI response, new user message
      expect(messagesPassedToLLM.length).toBeGreaterThanOrEqual(4);
      
      // Check that context includes the original message
      const contents = messagesPassedToLLM.map((m: any) => m.content);
      expect(contents).toContain("My name is Alice");
    });
  });
});
