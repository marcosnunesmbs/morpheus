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

/**
 * Formats a Date as ISO string with timezone offset, preserving the local time.
 * 
 * When user says "20:00" in America/Sao_Paulo, we want 20:00 in that timezone,
 * not a converted time. This function extracts the local time components and
 * creates an ISO string with the proper timezone offset.
 * 
 * Example: "2026-02-25T20:00:00-03:00" instead of "2026-02-25T20:00:00.000Z"
 */
function formatDateWithTimezone(date: Date, timezone: string): string {
  // Extract the local time components in the target timezone
  const localTimeStr = date.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Parse the local time string (format: "MM/DD/YYYY, HH:MM:SS")
  const [datePart, timePart] = localTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hours, minutes, seconds] = timePart.split(':');
  
  // Create a date object representing this local time in the target timezone
  // We need to find the offset for this specific date/time
  const testDate = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  ));
  
  // Get the offset for this timezone at this specific date
  const offsetStr = getOffsetString(testDate, timezone);
  
  // Format as ISO with offset
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetStr}`;
}

/**
 * Gets the timezone offset string for a given date and timezone.
 * Example: "-03:00" for America/Sao_Paulo
 */
function getOffsetString(date: Date, timezone: string): string {
  // Get the timezone offset by comparing UTC and local time
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'longOffset' });
  
  // Extract offset from timezone name (e.g., "GMT-03:00" → "-03:00")
  const match = tzStr.match(/GMT([+-]\d{2}):?(\d{2})?/);
  if (match) {
    const sign = match[1].charAt(0);
    const hours = match[1].slice(1);
    const mins = match[2] || '00';
    return `${sign}${hours}:${mins}`;
  }
  
  // Fallback: calculate offset from Date
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const offsetSign = offsetMinutes >= 0 ? '+' : '-';
  return `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
}

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

      // Format the date in the user's timezone for clarity
      const formatted = startDate.toLocaleString('pt-BR', { timeZone: effectiveTimezone, timeZoneName: 'short' });
      
      // Convert to ISO string WITH timezone offset (not UTC)
      // This ensures Chronos schedules at the correct local time
      const isoStart = formatDateWithTimezone(startDate, effectiveTimezone);
      const isoEnd = endDate ? formatDateWithTimezone(endDate, effectiveTimezone) : null;

      return {
        expression: result.text,
        isoStart,
        isoEnd,
        formatted,
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