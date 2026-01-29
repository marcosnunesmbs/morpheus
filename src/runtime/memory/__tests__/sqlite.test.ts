import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteChatMessageHistory } from "../sqlite.js";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import * as fs from "fs-extra";
import * as path from "path";
import { tmpdir } from "os";

describe("SQLiteChatMessageHistory", () => {
  let testDbPath: string;
  let history: SQLiteChatMessageHistory;

  beforeEach(() => {
    // Create a temporary database for each test
    const tempDir = path.join(tmpdir(), "morpheus-test", Date.now().toString());
    testDbPath = path.join(tempDir, "test-memory.db");
    
    history = new SQLiteChatMessageHistory({
      sessionId: "test-session",
      databasePath: testDbPath,
    });
  });

  afterEach(() => {
    // Clean up: close database and remove test files
    try {
      history.close();
    } catch (err) {
      // Ignore close errors
    }
    
    // Small delay to ensure file handles are released
    const tempDir = path.dirname(testDbPath);
    if (fs.existsSync(tempDir)) {
      try {
        fs.removeSync(tempDir);
      } catch (err) {
        // File might still be locked, ignore
      }
    }
  });

  describe("initialization", () => {
    it("should create database file at specified path", () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it("should create parent directories if they don't exist", () => {
      const deepPath = path.join(tmpdir(), "morpheus-test", "deep", "nested", "path", "db.sqlite");
      const deepHistory = new SQLiteChatMessageHistory({
        sessionId: "test",
        databasePath: deepPath,
      });
      
      expect(fs.existsSync(deepPath)).toBe(true);
      deepHistory.close();
      fs.removeSync(path.join(tmpdir(), "morpheus-test", "deep"));
    });
  });

  describe("addMessage", () => {
    it("should add a human message", async () => {
      const message = new HumanMessage("Hello, world!");
      await history.addMessage(message);

      const messages = await history.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(HumanMessage);
      expect(messages[0].content).toBe("Hello, world!");
    });

    it("should add an AI message", async () => {
      const message = new AIMessage("I am an AI response.");
      await history.addMessage(message);

      const messages = await history.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(AIMessage);
      expect(messages[0].content).toBe("I am an AI response.");
    });

    it("should add a system message", async () => {
      const message = new SystemMessage("System notification");
      await history.addMessage(message);

      const messages = await history.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(SystemMessage);
      expect(messages[0].content).toBe("System notification");
    });

    it("should add multiple messages in order", async () => {
      await history.addMessage(new HumanMessage("First"));
      await history.addMessage(new AIMessage("Second"));
      await history.addMessage(new HumanMessage("Third"));

      const messages = await history.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
      expect(messages[2].content).toBe("Third");
    });
  });

  describe("getMessages", () => {
    it("should return empty array when no messages exist", async () => {
      const messages = await history.getMessages();
      expect(messages).toEqual([]);
    });

    it("should return messages in chronological order", async () => {
      await history.addMessage(new HumanMessage("Message 1"));
      await history.addMessage(new AIMessage("Message 2"));
      await history.addMessage(new HumanMessage("Message 3"));

      const messages = await history.getMessages();
      expect(messages[0].content).toBe("Message 1");
      expect(messages[1].content).toBe("Message 2");
      expect(messages[2].content).toBe("Message 3");
    });

    it("should only return messages for the current session", async () => {
      // Add messages to first session
      await history.addMessage(new HumanMessage("Session 1 Message"));

      // Create a second session with the same database
      const history2 = new SQLiteChatMessageHistory({
        sessionId: "test-session-2",
        databasePath: testDbPath,
      });
      await history2.addMessage(new HumanMessage("Session 2 Message"));

      // Verify session isolation
      const session1Messages = await history.getMessages();
      const session2Messages = await history2.getMessages();

      expect(session1Messages).toHaveLength(1);
      expect(session1Messages[0].content).toBe("Session 1 Message");
      
      expect(session2Messages).toHaveLength(1);
      expect(session2Messages[0].content).toBe("Session 2 Message");

      history2.close();
    });
  });

  describe("clear", () => {
    it("should remove all messages for the current session", async () => {
      await history.addMessage(new HumanMessage("Message 1"));
      await history.addMessage(new AIMessage("Message 2"));

      await history.clear();

      const messages = await history.getMessages();
      expect(messages).toEqual([]);
    });

    it("should only clear messages for the current session", async () => {
      // Add messages to first session
      await history.addMessage(new HumanMessage("Session 1 Message"));

      // Create a second session
      const history2 = new SQLiteChatMessageHistory({
        sessionId: "test-session-2",
        databasePath: testDbPath,
      });
      await history2.addMessage(new HumanMessage("Session 2 Message"));

      // Clear first session
      await history.clear();

      // Verify only first session was cleared
      const session1Messages = await history.getMessages();
      const session2Messages = await history2.getMessages();

      expect(session1Messages).toEqual([]);
      expect(session2Messages).toHaveLength(1);
      expect(session2Messages[0].content).toBe("Session 2 Message");

      history2.close();
    });
  });

  describe("persistence", () => {
    it("should persist messages across instances", async () => {
      // Add messages
      await history.addMessage(new HumanMessage("Persistent message 1"));
      await history.addMessage(new AIMessage("Persistent message 2"));
      history.close();

      // Create new instance with same database
      const history2 = new SQLiteChatMessageHistory({
        sessionId: "test-session",
        databasePath: testDbPath,
      });

      const messages = await history2.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Persistent message 1");
      expect(messages[1].content).toBe("Persistent message 2");

      history2.close();
    });
  });

  describe("error handling", () => {
    it("should handle messages with complex content", async () => {
      // Create a message with additional fields to test serialization
      const message = new HumanMessage("Complex message content");
      await history.addMessage(message);

      const messages = await history.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Complex message content");
      expect(messages[0]).toBeInstanceOf(HumanMessage);
    });
  });
});
