import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { IDisplayManager, LogOptions } from '../types/display.js';

export class DisplayManager implements IDisplayManager {
  private static instance: DisplayManager;
  private spinner: Ora;

  private constructor() {
    this.spinner = ora();
  }

  public static getInstance(): DisplayManager {
    if (!DisplayManager.instance) {
      DisplayManager.instance = new DisplayManager();
    }
    return DisplayManager.instance;
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
      prefix = chalk.blue(`[${options.source}] `);
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
        default:
          formattedMessage = message;
      }
    }

    console.log(`${prefix}${formattedMessage}`);

    if (wasSpinning) {
      this.spinner.start(previousText);
    }
  }
}
