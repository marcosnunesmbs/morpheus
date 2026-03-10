import ora, { Ora } from 'ora';
import chalk from 'chalk';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { EventEmitter } from 'events';
import { IDisplayManager, LogOptions, LogLevel } from '../types/display.js';
import { LogConfig } from '../types/config.js';
import { LOGS_DIR } from '../config/paths.js';

export class DisplayManager extends EventEmitter implements IDisplayManager {
  private static instance: DisplayManager;
  private spinner: Ora;
  private logger: winston.Logger | undefined;

  private constructor() {
    super();
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

  public startSpinner(text?: string, source?: string): void {
    const defaultAgentKey = source ? source.toLowerCase() : 'oracle';
    this.emit('activity_start', { agent: defaultAgentKey, message: text || 'processing...', timestamp: Date.now() });

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
    this.emit('activity_end', { timestamp: Date.now(), success });

    if (!this.spinner.isSpinning) return;

    if (success === true) {
      this.spinner.succeed();
    } else if (success === false) {
      this.spinner.fail();
    } else {
      this.spinner.stop();
    }
  }

  /**
   * Start an activity for an agent - emits activity_start event for visualization.
   * Use this when an agent begins a task (e.g., before calling an API).
   */
  public startActivity(agent: string, message: string): void {
    this.emit('activity_start', {
      agent: agent.toLowerCase(),
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * End an activity for an agent - emits activity_end event for visualization.
   * Use this when an agent finishes a task (e.g., after receiving API response).
   */
  public endActivity(agent: string, success?: boolean): void {
    this.emit('activity_end', {
      agent: agent.toLowerCase(),
      timestamp: Date.now(),
      success,
    });
  }

  /**
   * Emit a message sent event - for visualizing outgoing messages (e.g., rocket launching).
   * This is a transient event that appears briefly in the visualizer.
   */
  public emitMessageSent(agent: string = 'oracle'): void {
    this.emit('message_sent', {
      agent: agent.toLowerCase(),
      timestamp: Date.now(),
    });
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
      } 
      else if (options.source === 'Oracle') {
        color = chalk.hex('#FFA500');
      } 
      else if (options.source === 'Sati') {
        color = chalk.hex('#00ff22');
      }
      else if (options.source === 'Telephonist') {
        color = chalk.hex('#b902b9');
      }
      else if (options.source === 'Construtor') {
        color = chalk.hex('#806d00');
      }
      else if (options.source === 'MCPServer') {
        color = chalk.hex('#be4b1d');
      }
      else if (options.source === 'ConstructLoad') {
        color = chalk.hex('#e5ff00');
      }
      else if (options.source === 'Zaion') {
        color = chalk.hex('#00c3ff');
      }
      else if (options.source === 'Chronos') {
        color = chalk.hex('#a855f7');
      }
      else if (options.source === 'SmithDelegateTool' || options.source === 'SmithRegistry' || options.source === 'Smiths' || options.source === 'SmithConnection' || options.source === 'SmithDelegator') {
        color = chalk.hex('#ff007f');
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
    
    // Emit purely for visualization (ignoring debug if needed to keep stream light)
    if (options?.level !== 'debug') {
        this.emit('message', { 
            message, 
            source: options?.source || 'system', 
            level: options?.level || 'info', 
            timestamp: Date.now(),
            meta: options?.meta
        });
    }

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
