import type { StructuredTool } from '@langchain/core/tools';
import type { ToolContext } from './types.js';

export type DevKitToolFactory = (ctx: ToolContext) => StructuredTool[];

const factories: DevKitToolFactory[] = [];

export function registerToolFactory(factory: DevKitToolFactory): void {
  factories.push(factory);
}

/**
 * Builds the full DevKit tool set for a given context.
 * Each factory receives the context (working_dir, allowed_commands, etc.)
 * and returns tools with the context captured in closure.
 */
export function buildDevKit(ctx: ToolContext): StructuredTool[] {
  return factories.flatMap(factory => factory(ctx));
}
