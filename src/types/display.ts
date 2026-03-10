import { LogConfig } from './config.js';
import { EventEmitter } from 'events';

export type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';

export interface LogOptions {
  source?: string;
  level?: LogLevel;
  meta?: Record<string, any>;
}

export interface IDisplayManager extends EventEmitter {
  log(message: string, options?: LogOptions): void;
  startSpinner(text?: string, source?: string): void;
  updateSpinner(text: string): void;
  stopSpinner(success?: boolean): void;
  initialize(config: LogConfig): Promise<void>;
}
