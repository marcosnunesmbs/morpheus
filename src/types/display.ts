export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogOptions {
  source?: string;
  level?: LogLevel;
}

export interface IDisplayManager {
  log(message: string, options?: LogOptions): void;
  startSpinner(text?: string): void;
  updateSpinner(text: string): void;
  stopSpinner(success?: boolean): void;
}
