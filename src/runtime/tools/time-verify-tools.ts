// tools/timeVerifier.tool.ts

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as chrono from "chrono-node";
import { ConfigManager } from "../../config/manager.js";

// Create a custom instance that supports English, Portuguese, and Spanish
const casualChrono = new chrono.Chrono({
  parsers: [
    ...chrono.en.casual.parsers,
    ...chrono.pt.casual.parsers,
    ...chrono.es.casual.parsers,
  ],
  refiners: [
    ...chrono.en.casual.refiners,
    ...chrono.pt.casual.refiners,
    ...chrono.es.casual.refiners,
  ],
});

export const timeVerifierTool = tool(
  async ({ text, timezone }: { text: string; timezone?: string }) => {
    // If a timezone is provided, use it for parsing context. 
    // Otherwise, use the configured system timezone from Chronos.
    const configTimezone = ConfigManager.getInstance().getChronosConfig()?.timezone || 'UTC';
    const effectiveTimezone = timezone || configTimezone;

    const referenceDate = { instant: new Date(), timezone: effectiveTimezone };
    
    // Parse using our multi-lingual casual parser
    // We pass forwardDate: true to prefer future dates for ambiguous expressions (e.g. "Friday" -> next Friday)
    // If timezone is provided, we could use it, but chrono-node's timezone support is complex.
    // For now, we rely on relative parsing from the system's current time.
    const results = casualChrono.parse(text, referenceDate, { forwardDate: true });

    if (!results.length) {
      return {
        detected: false,
        message: "No temporal expression detected.",
      };
    }

    const parsed = results.map((result) => {
      const startDate = result.start.date();
      const endDate = result.end?.date();

      return {
        expression: result.text,
        isoStart: startDate.toISOString(),
        isoEnd: endDate ? endDate.toISOString() : null,
        // Format the date in the user's timezone for clarity
        formatted: startDate.toLocaleString('pt-BR', { timeZone: effectiveTimezone, timeZoneName: 'short' }),
        isRange: !!endDate,
      };
    });

    return {
      detected: true,
      timezone: effectiveTimezone,
      referenceDate: referenceDate instanceof Date ? referenceDate.toISOString() : referenceDate.instant.toISOString(),
      parsed,
    };
  },
  {
    name: "time_verifier",
    description: `
Detects and resolves relative time expressions in user input.
Supports multiple languages (English, Portuguese, Spanish).
Use this tool whenever the user mentions words like:
today, tomorrow, yesterday, this week, next week,
hoje, amanhã, ontem, próxima semana,
hoy, mañana, ayer, la próxima semana, etc.

Returns resolved ISO dates based on the current time and timezone configuration.
    `,
    schema: z.object({
      text: z.string().describe("User input text containing time expressions"),
      timezone: z.string().optional().describe("Optional timezone override. Defaults to system configuration."),
    }),
  }
);