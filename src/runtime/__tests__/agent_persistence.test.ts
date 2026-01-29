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

vi.mock("../providers/factory.js");

describe("Agent Persistence Integration", () => {
  let agent: Agent;
  let testDbPath: string;
  const mockProvider = {
    invoke: vi.fn(),
  } as unknown as BaseChatModel;

  beforeEach(async () => {
    vi.resetAllMocks();
    
    // Clean up by clearing all data from the database (safer than deleting the locked file)
    const defaultDbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");
    if (fs.existsSync(defaultDbPath)) {
      try {
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(defaultDbPath);
        db.exec("DELETE FROM messages");
        db.close();
      } catch (err) {
        // Ignore errors if database doesn't exist or is corrupted
      }
    }
    
    // Create a temporary test database path
    const tempDir = path.join(tmpdir(), "morpheus-test-agent", Date.now().toString());
    testDbPath = path.join(tempDir, "short-memory.db");
    
    // Mock the SQLiteChatMessageHistory to use test path
    // We'll use the default ~/.morpheus path for this test
    
    (mockProvider.invoke as any).mockResolvedValue(new AIMessage("Test response"));
    vi.mocked(ProviderFactory.create).mockReturnValue(mockProvider);
    
    agent = new Agent(DEFAULT_CONFIG);
  });

  afterEach(async () => {
    // Clean up test database
    const defaultDbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");
    if (fs.existsSync(defaultDbPath)) {
      // We can't delete it if it's open, so we'll just clear it
      // The agent should have closed the connection
    }
  });

  describe("Database File Creation", () => {
    it("should create database file on initialization", async () => {
      await agent.initialize();
      
      const defaultDbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");
      expect(fs.existsSync(defaultDbPath)).toBe(true);
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
      
      // Simulate restart: create new agent instance
      const agent2 = new Agent(DEFAULT_CONFIG);
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
      (mockProvider.invoke as any).mockResolvedValue(new AIMessage("Second response"));
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
      (mockProvider.invoke as any).mockResolvedValue(new AIMessage("New response"));
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
      (mockProvider.invoke as any).mockResolvedValue(new AIMessage("Hello Alice!"));
      await agent.chat("What is my name?");
      
      // Verify the provider was called with full history
      const lastCall = (mockProvider.invoke as any).mock.calls[1];
      const messagesPassedToLLM = lastCall[0];
      
      // Should include: system message, previous user message, previous AI response, new user message
      expect(messagesPassedToLLM.length).toBeGreaterThanOrEqual(4);
      
      // Check that context includes the original message
      const contents = messagesPassedToLLM.map((m: any) => m.content);
      expect(contents).toContain("My name is Alice");
    });
  });
});
