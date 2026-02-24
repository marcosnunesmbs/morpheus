// tools/timeVerifier.tool.ts

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as chrono from "chrono-node";

export const timeVerifierTool = tool(
  async ({ text, timezone }: { text: string; timezone?: string }) => {
    const referenceDate = new Date();

    const results = chrono.parse(text, referenceDate);

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
        isRange: !!endDate,
      };
    });

    return {
      detected: true,
      referenceDate: referenceDate.toISOString(),
      parsed,
    };
  },
  {
    name: "time_verifier",
    description: `
Detects and resolves relative time expressions in user input.
Use this tool whenever the user mentions words like:
today, tomorrow, yesterday, this week, next week,
this month, next month, next year, in X days, etc.

Returns resolved ISO dates.
    `,
    schema: z.object({
      text: z.string().describe("User input text"),
      timezone: z.string().optional().describe("Optional timezone"),
    }),
  }
);