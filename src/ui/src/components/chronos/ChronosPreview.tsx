import { useEffect, useState, useRef } from 'react';
import { Clock } from 'lucide-react';
import { chronosService, type ScheduleType } from '../../services/chronos';

interface ChronosPreviewProps {
  scheduleExpression: string;
  scheduleType: ScheduleType;
  timezone?: string;
}

export function ChronosPreview({ scheduleExpression, scheduleType, timezone }: ChronosPreviewProps) {
  const [preview, setPreview] = useState<{ next_run_at: number; human_readable: string; next_occurrences: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!scheduleExpression.trim()) {
      setPreview(null);
      setError(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await chronosService.preview(scheduleExpression, scheduleType, timezone);
        setPreview(result);
        setError(null);
      } catch (err: any) {
        setError(err.message ?? 'Invalid expression');
        setPreview(null);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scheduleExpression, scheduleType, timezone]);

  if (!scheduleExpression.trim()) return null;

  // Format date in the selected timezone
  const formatInTimezone = (timestamp: number, tz: string): string => {
    try {
      return new Date(timestamp).toLocaleString('pt-BR', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      // Fallback to local timezone if specified timezone is invalid
      return new Date(timestamp).toLocaleString();
    }
  };

  return (
    <div className="mt-2 rounded border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-zinc-900 p-3 text-sm">
      {error ? (
        <p className="text-red-500 dark:text-red-400 flex items-center gap-1.5">
          <span>⚠</span> {error}
        </p>
      ) : preview ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-azure-text-secondary dark:text-matrix-secondary">
            <Clock className="w-3.5 h-3.5 text-azure-primary dark:text-matrix-highlight shrink-0" />
            <span className="font-medium dark:text-matrix-highlight">Next run:</span>
            <span>{formatInTimezone(preview.next_run_at, timezone || 'UTC')}</span>
          </div>
          {preview.human_readable && (
            <p className="text-azure-text-muted dark:text-matrix-secondary/70 pl-5">
              {preview.human_readable}
            </p>
          )}
          {preview.next_occurrences.length > 0 && (
            <div className="pl-5 space-y-0.5">
              {preview.next_occurrences.map((occ, i) => (
                <p key={i} className="text-azure-text-muted dark:text-matrix-tertiary text-xs">
                  #{i + 2}: {occ}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-azure-text-muted dark:text-matrix-tertiary italic">Parsing…</p>
      )}
    </div>
  );
}
