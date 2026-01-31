import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../config/manager.js';
import { DisplayManager } from '../runtime/display.js';
import { Agent } from '../runtime/agent.js';
import { AudioAgent } from '../runtime/audio-agent.js';

export class TelegramAdapter {
  private bot: Telegraf | null = null;
  private isConnected = false;
  private display = DisplayManager.getInstance();
  private config = ConfigManager.getInstance();
  private agent: Agent;
  private audioAgent = new AudioAgent();

  constructor(agent: Agent) {
    this.agent = agent;
  }

  public async connect(token: string, allowedUsers: string[]): Promise<void> {
    if (this.isConnected) {
      this.display.log('Telegram adapter already connected.', { source: 'Telegram', level: 'warning' });
      return;
    }

    try {
      this.display.log('Connecting to Telegram...', { source: 'Telegram' });
      this.bot = new Telegraf(token);

      // Verify token/connection
      const me = await this.bot.telegram.getMe();
      this.display.log(`✓ Telegram Connected: @${me.username}`, { source: 'Telegram', level: 'success' });
      this.display.log(`Allowed Users: ${allowedUsers.join(', ')}`, { source: 'Telegram', level: 'info' });

      // Listen for messages
      this.bot.on('text', async (ctx) => {
        const user = ctx.from.username || ctx.from.first_name;
        const userId = ctx.from.id.toString();
        const text = ctx.message.text;

        // AUTH GUARD
        if (!this.isAuthorized(userId, allowedUsers)) {
          this.display.log(`Unauthorized access attempt by @${user} (ID: ${userId})`, { source: 'Telegram', level: 'warning' });
          return; // Silent fail for security
        }

        this.display.log(`@${user}: ${text}`, { source: 'Telegram' });

        try {
          // Send "typing" status
          await ctx.sendChatAction('typing');

          // Process with Agent
          const response = await this.agent.chat(text);
          
          if (response) {
            await ctx.reply(response);
            this.display.log(`Responded to @${user}`, { source: 'Telegram' });
          }
        } catch (error: any) {
          this.display.log(`Error processing message for @${user}: ${error.message}`, { source: 'Telegram', level: 'error' });
          try {
             await ctx.reply("Sorry, I encountered an error while processing your request.");
          } catch (e) {
             // Ignore reply error
          }
        }
      });

      // Handle Voice Messages
      this.bot.on(message('voice'), async (ctx) => {
        const user = ctx.from.username || ctx.from.first_name;
        const userId = ctx.from.id.toString();
        const config = this.config.get();

        // AUTH GUARD
        if (!this.isAuthorized(userId, allowedUsers)) {
          this.display.log(`Unauthorized audio attempt by @${user} (ID: ${userId})`, { source: 'Telegram', level: 'warning' });
          return;
        }

        if (!config.audio.enabled) {
          await ctx.reply("Audio transcription is currently disabled.");
          return;
        }

        const apiKey = config.audio.apiKey || (config.llm.provider === 'gemini' ? config.llm.api_key : undefined);
        if (!apiKey) {
           this.display.log(`Audio transcription failed: No Gemini API key available`, { source: 'AgentAudio', level: 'error' });
           await ctx.reply("Audio transcription requires a Gemini API key. Please configure `audio.apiKey` or set LLM provider to Gemini.");
           return;
        }

        const duration = ctx.message.voice.duration;
        if (duration > config.audio.maxDurationSeconds) {
           await ctx.reply(`Voice message too long. Max duration is ${config.audio.maxDurationSeconds}s.`);
           return;
        }

        this.display.log(`Receiving voice message from @${user} (${duration}s)...`, { source: 'AgentAudio' });

        let filePath: string | null = null;
        let listeningMsg: any = null;

        try {

          listeningMsg = await ctx.reply("Escutando...");

          // Download
          this.display.log(`Downloading audio for @${user}...`, { source: 'AgentAudio' });
          const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
          filePath = await this.downloadToTemp(fileLink);

          // Transcribe
          this.display.log(`Transcribing audio for @${user}...`, { source: 'AgentAudio' });
          const text = await this.audioAgent.transcribe(filePath, 'audio/ogg', apiKey);
          
          this.display.log(`Transcription success for @${user}: "${text}"`, { source: 'AgentAudio', level: 'success' });
          
          // Reply with transcription (optional, maybe just process it?)
          // The prompt says "reply with the answer".
          // "Transcribe them... and process the resulting text as a standard user prompt."
          
          // So I should treat 'text' as if it was a text message.
          // await ctx.reply(`🎤 *Transcription*: _"${text}"_`, { parse_mode: 'Markdown' });
          await ctx.sendChatAction('typing');

          // Process with Agent
          const response = await this.agent.chat(text);

          if (listeningMsg) {
            try {
              await ctx.telegram.deleteMessage(ctx.chat.id, listeningMsg.message_id);
            } catch (e) {
              // Ignore delete error
            }
          }

          if (response) {
            await ctx.reply(response);
            this.display.log(`Responded to @${user} (via audio)`, { source: 'Telegram' });
          }

        } catch (error: any) {
           this.display.log(`Audio processing error for @${user}: ${error.message}`, { source: 'AgentAudio', level: 'error' });
           await ctx.reply("Sorry, I failed to process your audio message.");
        } finally {
           // Cleanup
           if (filePath && await fs.pathExists(filePath)) {
               await fs.unlink(filePath).catch(() => {});
           }
        }
      });
      
      this.bot.launch().catch((err) => {
          if (this.isConnected) {
             this.display.log(`Telegram bot error: ${err}`, { source: 'Telegram', level: 'error' });
          }
      });
      
      this.isConnected = true;

      process.once('SIGINT', () => this.disconnect());
      process.once('SIGTERM', () => this.disconnect());

    } catch (error: any) {
      this.display.log(`Failed to connect to Telegram: ${error.message}`, { source: 'Telegram', level: 'error' });
      this.isConnected = false;
      this.bot = null;
      throw error;
    }
  }

  private isAuthorized(userId: string, allowedUsers: string[]): boolean {
    return allowedUsers.includes(userId);
  }

  private async downloadToTemp(url: URL, extension: string = '.ogg'): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);
    
    const tmpDir = os.tmpdir();
    const fileName = `morpheus-audio-${Date.now()}${extension}`;
    const filePath = path.join(tmpDir, fileName);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    
    return filePath;
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected || !this.bot) {
      return;
    }

    this.display.log('Disconnecting Telegram...', { source: 'Telegram', level: 'warning' });
    try {
        this.bot.stop();
    } catch (e) {
        // Ignore stop errors
    }
    this.isConnected = false;
    this.bot = null;
    this.display.log(chalk.gray('Telegram disconnected.'), { source: 'Telegram' });
  }
}
