import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TextInput } from '../forms/TextInput';
import { SelectInput } from '../forms/SelectInput';
import { ChronosPreview } from './ChronosPreview';
import {
  chronosService,
  useChronosConfig,
  type ChronosJob,
  type ScheduleType,
  type CreateChronosJobRequest,
  type UpdateChronosJobRequest,
} from '../../services/chronos';
import { mutate } from 'swr';

// Minimal IANA timezone list — most common zones
const TIMEZONES = [
  'UTC', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Mexico_City',
  'America/Buenos_Aires', 'America/Bogota', 'America/Lima', 'America/Santiago',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Europe/Madrid', 'Europe/Lisbon', 'Europe/Moscow', 'Europe/Istanbul',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Seoul', 'Asia/Jakarta',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
];

const SCHEDULE_TYPE_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'cron', label: 'Recurring (Cron)' },
  { value: 'interval', label: 'Recurring (Interval)' },
];

const EXPRESSION_PLACEHOLDERS: Record<ScheduleType, string> = {
  once: 'e.g. "tomorrow at 9am" or "2026-03-01T09:00:00"',
  cron: 'e.g. "0 9 * * 1-5" (weekdays at 9am)',
  interval: 'e.g. "every 30 minutes" or "every day"',
};

interface CreateChronosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  editJob?: ChronosJob | null;
}

export function CreateChronosModal({ isOpen, onClose, onCreated, editJob }: CreateChronosModalProps) {
  const isEdit = !!editJob;
  const { data: config } = useChronosConfig();

  const [prompt, setPrompt] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('once');
  const [expression, setExpression] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editJob) {
      setPrompt(editJob.prompt);
      setScheduleType(editJob.schedule_type);
      setExpression(editJob.schedule_expression);
      setTimezone(editJob.timezone);
    } else {
      setPrompt('');
      setScheduleType('once');
      setExpression('');
      setTimezone(config?.timezone ?? 'UTC');
    }
    setError(null);
  }, [editJob, isOpen, config?.timezone]);

  const handleSave = async () => {
    setError(null);
    if (!prompt.trim()) { setError('Prompt is required'); return; }
    if (!expression.trim()) { setError('Schedule expression is required'); return; }

    setSaving(true);
    try {
      if (isEdit && editJob) {
        const req: UpdateChronosJobRequest = { prompt, schedule_expression: expression, timezone };
        await chronosService.updateJob(editJob.id, req);
      } else {
        const req: CreateChronosJobRequest = { prompt, schedule_type: scheduleType, schedule_expression: expression, timezone };
        await chronosService.createJob(req);
      }
      await mutate((key: string) => typeof key === 'string' && key.startsWith('/chronos'));
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-black shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-azure-border dark:border-matrix-primary">
          <h2 className="text-lg font-bold text-azure-text-primary dark:text-matrix-highlight font-mono">
            {isEdit ? 'Edit Chronos Job' : 'New Chronos Job'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-azure-text-muted dark:text-matrix-tertiary hover:text-azure-text-primary dark:hover:text-matrix-highlight transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <TextInput
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should the Oracle do when this job triggers?"
          />

          {!isEdit && (
            <SelectInput
              label="Schedule Type"
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
              options={SCHEDULE_TYPE_OPTIONS}
            />
          )}

          <div>
            <TextInput
              label="Schedule Expression"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder={EXPRESSION_PLACEHOLDERS[scheduleType]}
            />
            <ChronosPreview
              scheduleExpression={expression}
              scheduleType={scheduleType}
              timezone={timezone}
            />
          </div>

          <SelectInput
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
          />

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-azure-border dark:border-matrix-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary hover:bg-azure-hover dark:hover:bg-matrix-primary/20 transition-colors font-mono"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-sm bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight font-bold hover:opacity-90 disabled:opacity-50 transition-opacity font-mono"
          >
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
