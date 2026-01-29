import ora, { Ora } from 'ora';
import chalk from 'chalk';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { IDisplayManager, LogOptions, LogLevel } from '../types/display.js';
import { LogConfig } from '../types/config.js';
import { LOGS_DIR } from '../config/paths.js';

export class DisplayManager implements IDisplayManager {
  private static instance: DisplayManager;
  private spinner: Ora;
  private logger: winston.Logger | undefined;

  private constructor() {
    this.spinner = ora();
  }

  public static getInstance(): DisplayManager {
    if (!DisplayManager.instance) {
      DisplayManager.instance = new DisplayManager();
    }
    return DisplayManager.instance;
  }

  public async initialize(config: LogConfig): Promise<void> {
    if (!config.enabled) {
      return;
    }

    const { combine, timestamp, printf } = winston.format;

    const logFormat = printf(({ level, message, timestamp, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level}] ${message} ${metaStr}`.trim();
    });

    this.logger = winston.createLogger({
      level: config.level,
      format: combine(
        timestamp(),
        logFormat
      ),
      transports: [
        new DailyRotateFile({
          dirname: LOGS_DIR,
          filename: 'morpheus-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: config.retention,
        }),
      ],
    });
  }

  public startSpinner(text?: string): void {
    if (this.spinner.isSpinning) {
      if (text) {
        this.spinner.text = text;
      }
      return;
    }
    this.spinner.start(text);
  }

  public updateSpinner(text: string): void {
    if (this.spinner.isSpinning) {
      this.spinner.text = text;
    }
  }

  public stopSpinner(success?: boolean): void {
    if (!this.spinner.isSpinning) return;

    if (success === true) {
      this.spinner.succeed();
    } else if (success === false) {
      this.spinner.fail();
    } else {
      this.spinner.stop();
    }
  }

  public log(message: string, options?: LogOptions): void {
    const wasSpinning = this.spinner.isSpinning;
    const previousText = this.spinner.text;

    if (wasSpinning) {
      this.spinner.stop();
    }

    let prefix = '';
    if (options?.source) {
      let color = chalk.blue;
      if (options.source === 'Telegram') {
        color = chalk.green;
      } else if (options.source === 'Agent') {
        color = chalk.hex('#FFA500');
      }
      prefix = color(`[${options.source}] `);
    }

    let formattedMessage = message;
    if (options?.level) {
      switch (options.level) {
        case 'error':
          formattedMessage = chalk.red(message);
          break;
        case 'warning':
          formattedMessage = chalk.yellow(message);
          break;
        case 'success':
          formattedMessage = chalk.green(message);
          break;
        case 'info':
        case 'debug':
        default:
          formattedMessage = message;
      }
    }

    // Only print debug messages if we were verbose? Or always print?
    // Console output should probably filter debug unless debug mode is on. 
    // But currently DisplayManager doesn't seem to hold global 'debug' state for console, 
    // it just prints what it's told. 
    // For now I'll assume console log logic remains matching inputs roughly.
    // Spec doesn't strictly say suppress debug on console, but implies user value focus.
    // 'debug' level usually shouldn't clutter console unless requested.
    // But existing log() Implementation didn't handle 'debug' specifically before I added it to type.
    // I'll leave console behavior as is (prints everything).

    console.log(`${prefix}${formattedMessage}`);

    if (this.logger) {
      try {
        const level = this.mapLevel(options?.level);
        const meta = options?.meta || {};
        if (options?.source) {
          meta.source = options.source;
        }
        
        this.logger.log({
          level,
          message,
          ...meta
        });
      } catch (err) {
        // Safe logging fail-safe as per T015
        // Do not crash if file logging fails, maybe print to stderr?
        // But if logging itself fails, maybe just ignore to keep CLI running.
      }
    }

    if (wasSpinning) {
      this.spinner.start(previousText);
    }
  }

  private mapLevel(level?: LogLevel): string {
    switch (level) {
      case 'warning': return 'warn';
      case 'success': return 'info';
      case 'error': return 'error';
      case 'debug': return 'debug';
      case 'info':
      default: return 'info';
    }
  }
}
