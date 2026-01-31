import { StructuredTool } from "@langchain/core/tools";

export interface IToolsFactory {
  create(): Promise<StructuredTool[]>;
}
