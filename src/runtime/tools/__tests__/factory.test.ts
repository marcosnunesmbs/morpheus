import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolsFactory } from '../factory.js';
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

vi.mock("@langchain/mcp-adapters", () => {
  return {
    MultiServerMCPClient: vi.fn(),
  };
});
vi.mock("../../display.js", () => ({
  DisplayManager: {
    getInstance: () => ({
      log: vi.fn(),
    })
  }
}));

describe('ToolsFactory', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should create tools successfully', async () => {
        const mockGetTools = vi.fn().mockResolvedValue(['tool1', 'tool2']);
        
        // Mock the constructor and getTools method
        (MultiServerMCPClient as unknown as any).mockImplementation(function () {
             return {
                 getTools: mockGetTools
             };
        });

        const tools = await ToolsFactory.create();
        
        expect(MultiServerMCPClient).toHaveBeenCalled();
        expect(mockGetTools).toHaveBeenCalled();
        expect(tools).toEqual(['tool1', 'tool2']);
    });

    it('should return empty array on failure', async () => {
        (MultiServerMCPClient as unknown as any).mockImplementation(function() {
            return {
                getTools: vi.fn().mockRejectedValue(new Error('MCP Failed'))
            };
        });

        const tools = await ToolsFactory.create();
        expect(tools).toEqual([]);
    });
});
