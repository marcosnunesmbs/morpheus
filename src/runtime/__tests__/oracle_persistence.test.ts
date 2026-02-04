import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Oracle } from "../oracle.js";
import { ProviderFactory } from "../providers/factory.js";
import { DEFAULT_CONFIG } from "../../types/config.js";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";
import * as fs from "fs-extra";
import * as path from "path";
import { tmpdir } from "os";
import { homedir } from "os";
import { ReactAgent } from "langchain";
import { Construtor } from "../tools/factory.js";

vi.mock("../providers/factory.js");
vi.mock("../tools/factory.js");

describe("Oracle Persistence Integration", () => {
  let oracle: Oracle;
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
    vi.mocked(Construtor.create).mockResolvedValue([]);
    
    oracle = new Oracle(DEFAULT_CONFIG, { databasePath: testDbPath });
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
      await oracle.initialize();
      expect(fs.existsSync(testDbPath)).toBe(true);
    });
  });

  describe("Message Persistence", () => {
    it("should persist messages to database", async () => {
      await oracle.initialize();
      
      // Send a message
      await oracle.chat("Hello, Oracle!");
      
      // Verify history contains the message
      const history = await oracle.getHistory();
      expect(history).toHaveLength(2); // User message + AI response
      expect(history[0].content).toBe("Hello, Oracle!");
      expect(history[1].content).toBe("Test response");
    });

    it("should restore conversation history on restart", async () => {
      // First session: send a message
      await oracle.initialize();
      await oracle.chat("Remember this message");
      const firstHistory = await oracle.getHistory();
      expect(firstHistory).toHaveLength(2);
      
      // Simulate restart: create new oracle instance with SAME database path
      const oracle2 = new Oracle(DEFAULT_CONFIG, { databasePath: testDbPath });
      await oracle2.initialize();
      
      // Verify history was restored
      const restoredHistory = await oracle2.getHistory();
      expect(restoredHistory.length).toBeGreaterThanOrEqual(2);
      
      // Check that the old messages are present
      const contents = restoredHistory.map(m => m.content);
      expect(contents).toContain("Remember this message");
      expect(contents).toContain("Test response");
    });

    it("should accumulate messages across multiple conversations", async () => {
      await oracle.initialize();
      
      // First conversation
      await oracle.chat("First message");
      
      // Second conversation
    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage("Second response")] 
      };
    });
      await oracle.chat("Second message");
      
      // Verify all messages are persisted
      const history = await oracle.getHistory();
      expect(history).toHaveLength(4);
      expect(history[0].content).toBe("First message");
      expect(history[1].content).toBe("Test response");
      expect(history[2].content).toBe("Second message");
      expect(history[3].content).toBe("Second response");
    });
  });

  describe("Memory Clearing", () => {
    it("should clear all persisted messages", async () => {
      await oracle.initialize();
      
      // Add some messages
      await oracle.chat("Message 1");
      await oracle.chat("Message 2");
      
      // Verify messages exist
      let history = await oracle.getHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Clear memory
      await oracle.clearMemory();
      
      // Verify messages are cleared
      history = await oracle.getHistory();
      expect(history).toEqual([]);
    });

    it("should start fresh after clearing memory", async () => {
      await oracle.initialize();
      
      // Add and clear messages
      await oracle.chat("Old message");
      await oracle.clearMemory();
      
      // Add new message
    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage("New response")] 
      };
    });
      await oracle.chat("New message");
      
      // Verify only new messages exist
      const history = await oracle.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe("New message");
      expect(history[1].content).toBe("New response");
    });
  });

  describe("Context Preservation", () => {
    it("should include history in conversation context", async () => {
      await oracle.initialize();
      
      // First message
      await oracle.chat("My name is Alice");
      
    // Second message (should have context)
    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage("Hello Alice!")] 
      };
    });
    await oracle.chat("What is my name?");
      
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
