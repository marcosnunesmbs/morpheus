import { LogConfig } from './config.js';

export type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';

export interface LogOptions {
  source?: string;
  level?: LogLevel;
  meta?: Record<string, any>;
}

export interface IDisplayManager {
  log(message: string, options?: LogOptions): void;
  startSpinner(text?: string): void;
  updateSpinner(text: string): void;
  stopSpinner(success?: boolean): void;
  initialize(config: LogConfig): Promise<void>;
}
