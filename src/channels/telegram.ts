import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { convert } from 'telegram-markdown-v2';
import { ConfigManager } from '../config/manager.js';
import { DisplayManager } from '../runtime/display.js';
import { Oracle } from '../runtime/oracle.js';
import { createTelephonist, ITelephonist } from '../runtime/telephonist.js';
import { readPid, isProcessRunning, checkStalePid } from '../runtime/lifecycle.js';
import { SQLiteChatMessageHistory } from '../runtime/memory/sqlite.js';
import { SatiRepository } from '../runtime/memory/sati/repository.js';
import { MCPManager } from '../config/mcp-manager.js';
import { Construtor } from '../runtime/tools/factory.js';

/**
 * Converts standard Markdown (as produced by LLMs) to Telegram MarkdownV2.
 * Unsupported tags (e.g. tables) have their special chars escaped so they
 * render as plain text instead of breaking the parse.
 * Truncates to Telegram's 4096-char hard limit.
 */
function toMd(text: string): { text: string; parse_mode: 'MarkdownV2' } {
  const MAX = 4096;
  const converted = convert(text, 'escape');
  const safe = converted.length > MAX ? converted.slice(0, MAX - 3) + '\\.\\.\\.' : converted;
  return { text: safe, parse_mode: 'MarkdownV2' };
}

export class TelegramAdapter {
  private bot: Telegraf | null = null;
  private isConnected = false;
  private display = DisplayManager.getInstance();
  private config = ConfigManager.getInstance();
  private oracle: Oracle;
  private telephonist: ITelephonist | null = null;
  private telephonistProvider: string | null = null;
  private telephonistModel: string | null = null;
  private history = new SQLiteChatMessageHistory({ sessionId: '' });

  private readonly RATE_LIMIT_MS = 3000; // minimum ms between requests per user
  private rateLimiter = new Map<string, number>(); // userId -> last request timestamp

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const last = this.rateLimiter.get(userId);
    if (last !== undefined && now - last < this.RATE_LIMIT_MS) return true;
    this.rateLimiter.set(userId, now);
    return false;
  }

  private HELP_MESSAGE = `/start - Show this welcome message and available commands
/status - Check the status of the Morpheus agent
/doctor - Diagnose environment and configuration issues
/stats - Show token usage statistics
/help - Show available commands
/zaion - Show system configurations
/sati <qnt> - Show specific memories
/newsession - Archive current session and start fresh
/sessions - List all sessions with titles and switch between them
/restart - Restart the Morpheus agent
/mcpreload - Reload MCP servers without restarting
/mcp or /mcps - List registered MCP servers`;

  constructor(oracle: Oracle) {
    this.oracle = oracle;
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

        // Handle system commands (commands bypass rate limit)
        if (text.startsWith('/')) {
          await this.handleSystemCommand(ctx, text, user);
          return;
        }

        // Rate limit check
        if (this.isRateLimited(userId)) {
          await ctx.reply('Please wait a moment before sending another message.');
          return;
        }

        try {
          // Send "typing" status
          await ctx.sendChatAction('typing');

          // Process with Agent
          const response = await this.oracle.chat(text);

          if (response) {
            try {
              await ctx.reply(toMd(response).text, { parse_mode: 'MarkdownV2' });
            } catch {
              await ctx.reply(response);
            }
            this.display.log(`Responded to @${user}: ${response}`, { source: 'Telegram' });
          }
        } catch (error: any) {
          this.display.log(`Error processing message for @${user}: ${error.message}`, { source: 'Telegram', level: 'error' });
          try {
            await ctx.reply("Sorry, I encountered an error while processing your request. " + error.message);
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

        // Rate limit check
        if (this.isRateLimited(userId)) {
          await ctx.reply('Please wait a moment before sending another message.');
          return;
        }

        if (!config.audio.enabled) {
          await ctx.reply("Audio transcription is currently disabled.");
          return;
        }

        const apiKey = config.audio.apiKey ||
          (config.llm.provider === config.audio.provider ? config.llm.api_key : undefined);
        if (!apiKey) {
          this.display.log(`Audio transcription failed: No API key available for provider '${config.audio.provider}'`, { source: 'Telephonist', level: 'error' });
          await ctx.reply(`Audio transcription requires an API key for provider '${config.audio.provider}'. Please configure \`audio.apiKey\` or use the same provider as your LLM.`);
          return;
        }

        if (!this.telephonist || this.telephonistProvider !== config.audio.provider || this.telephonistModel !== config.audio.model) {
          this.telephonist = createTelephonist(config.audio);
          this.telephonistProvider = config.audio.provider;
          this.telephonistModel = config.audio.model;
        }

        const duration = ctx.message.voice.duration;
        if (duration > config.audio.maxDurationSeconds) {
          await ctx.reply(`Voice message too long. Max duration is ${config.audio.maxDurationSeconds}s.`);
          return;
        }

        this.display.log(`Receiving voice message from @${user} (${duration}s)...`, { source: 'Telephonist' });

        let filePath: string | null = null;
        let listeningMsg: any = null;

        try {

          listeningMsg = await ctx.reply("🎧Escutando...");

          // Download
          this.display.log(`Downloading audio for @${user}...`, { source: 'Telephonist' });
          const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
          filePath = await this.downloadToTemp(fileLink);

          // Transcribe
          this.display.log(`Transcribing audio for @${user}...`, { source: 'Telephonist' });
          const { text, usage } = await this.telephonist.transcribe(filePath, 'audio/ogg', apiKey);

          this.display.log(`Transcription success for @${user}: "${text}"`, { source: 'Telephonist', level: 'success' });

          // Reply with transcription (optional, maybe just process it?)
          // The prompt says "reply with the answer".
          // "Transcribe them... and process the resulting text as a standard user prompt."

          // So I should treat 'text' as if it was a text message.
          await ctx.reply(`🎤 Transcription: "${text}"`);
          await ctx.sendChatAction('typing');

          // Process with Agent
          const response = await this.oracle.chat(text, usage, true);

          // if (listeningMsg) {
          //   try {
          //     await ctx.telegram.deleteMessage(ctx.chat.id, listeningMsg.message_id);
          //   } catch (e) {
          //     // Ignore delete error
          //   }
          // }

          if (response) {
            try {
              await ctx.reply(toMd(response).text, { parse_mode: 'MarkdownV2' });
            } catch {
              await ctx.reply(response);
            }
            this.display.log(`Responded to @${user} (via audio)`, { source: 'Telegram' });
          }

        } catch (error: any) {
          const detail = error?.cause?.message || error?.response?.data?.error?.message || error.message;
          this.display.log(`Audio processing error for @${user}: ${detail}`, { source: 'Telephonist', level: 'error' });
          await ctx.reply("Sorry, I failed to process your audio message.");
        } finally {
          // Cleanup
          if (filePath && await fs.pathExists(filePath)) {
            await fs.unlink(filePath).catch(() => { });
          }
        }
      });

      this.bot.action('confirm_new_session', async (ctx) => {
        await this.handleApproveNewSessionCommand(ctx, ctx.from.username || ctx.from.first_name);
        if (ctx.updateType === 'callback_query') {
          ctx.answerCbQuery();
          ctx.deleteMessage().catch(() => { });
        }
        ctx.reply("New session created.");
      });

      this.bot.action('cancel_new_session', async (ctx) => {
        if (ctx.updateType === 'callback_query') {
          ctx.answerCbQuery();
          ctx.deleteMessage().catch(() => { });
        }
        ctx.reply("New session cancelled.");
      });

      this.bot.action(/^switch_session_/, async (ctx) => {
        const callbackQuery = ctx.callbackQuery;
        const data = callbackQuery && 'data' in callbackQuery ? callbackQuery.data : undefined;
        const sessionId = typeof data === 'string' ? data.replace('switch_session_', '') : '';

        if (!sessionId || sessionId === '') {
          await ctx.answerCbQuery('Invalid session ID');
          return;
        }

        try {
          // Obter a sessão atual antes de alternar
          const history = new SQLiteChatMessageHistory({ sessionId: "" });
          // Alternar para a nova sessão
          await history.switchSession(sessionId);
          await ctx.answerCbQuery();

          // Remover a mensagem anterior e enviar confirmação
          if (ctx.updateType === 'callback_query') {
            ctx.deleteMessage().catch(() => { });
          }

          ctx.reply(`✅ Switched to session ID: ${sessionId}`);
        } catch (error: any) {
          await ctx.answerCbQuery(`Error switching session: ${error.message}`, { show_alert: true });
        }
      });

      // --- Archive Flow ---
      this.bot.action(/^ask_archive_session_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data;
        const sessionId = data.replace('ask_archive_session_', '');
        // Fetch session title for better UX (optional, but nice) - for now just use ID

        await ctx.reply(`⚠️ **ARCHIVE SESSION?**\n\nAre you sure you want to archive session \`${sessionId}\`?\n\nIt will be moved to long-term memory (SATI) and removed from the active list. This action cannot be easily undone via Telegram.`, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Yes, Archive', callback_data: `confirm_archive_session_${sessionId}` },
                { text: '❌ Cancel', callback_data: 'cancel_session_action' }
              ]
            ]
          }
        });
        await ctx.answerCbQuery();
      });

      this.bot.action(/^confirm_archive_session_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data;
        const sessionId = data.replace('confirm_archive_session_', '');

        try {
          const history = new SQLiteChatMessageHistory({ sessionId: "" });
          await history.archiveSession(sessionId);
          await ctx.answerCbQuery('Session archived successfully');

          if (ctx.updateType === 'callback_query') {
            ctx.deleteMessage().catch(() => { });
          }
          await ctx.reply(`✅ Session \`${sessionId}\` has been archived and moved to long-term memory.`, { parse_mode: 'MarkdownV2' });
        } catch (error: any) {
          await ctx.answerCbQuery(`Error archiving: ${error.message}`, { show_alert: true });
        }
      });

      // --- Delete Flow ---
      this.bot.action(/^ask_delete_session_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data;
        const sessionId = data.replace('ask_delete_session_', '');

        await ctx.reply(`🚫 **DELETE SESSION?**\n\nAre you sure you want to PERMANENTLY DELETE session \`${sessionId}\`?\n\nThis action is **IRREVERSIBLE**. All data will be lost.`, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🗑️ Yes, DELETE PERMANENTLY', callback_data: `confirm_delete_session_${sessionId}` },
                { text: '❌ Cancel', callback_data: 'cancel_session_action' }
              ]
            ]
          }
        });
        await ctx.answerCbQuery();
      });

      this.bot.action(/^confirm_delete_session_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data;
        const sessionId = data.replace('confirm_delete_session_', '');

        try {
          const history = new SQLiteChatMessageHistory({ sessionId: "" });
          await history.deleteSession(sessionId);
          await ctx.answerCbQuery('Session deleted successfully');

          if (ctx.updateType === 'callback_query') {
            ctx.deleteMessage().catch(() => { });
          }
          await ctx.reply(`🗑️ Session \`${sessionId}\` has been permanently deleted.`, { parse_mode: 'MarkdownV2' });
        } catch (error: any) {
          await ctx.answerCbQuery(`Error deleting: ${error.message}`, { show_alert: true });
        }
      });

      // --- Cancel Action ---
      this.bot.action('cancel_session_action', async (ctx) => {
        await ctx.answerCbQuery('Action cancelled');
        if (ctx.updateType === 'callback_query') {
          ctx.deleteMessage().catch(() => { });
        }
        await ctx.reply('Action cancelled.');
      });

      this.bot.action(/^toggle_mcp_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data as string;
        // format: toggle_mcp_enable_<name> or toggle_mcp_disable_<name>
        const match = data.match(/^toggle_mcp_(enable|disable)_(.+)$/);
        if (!match) {
          await ctx.answerCbQuery('Invalid action');
          return;
        }
        const [, action, serverName] = match;
        const enable = action === 'enable';
        try {
          await MCPManager.setServerEnabled(serverName, enable);
          await ctx.answerCbQuery(`${enable ? '✅ Enabled' : '❌ Disabled'}: ${serverName}`);
          if (ctx.updateType === 'callback_query') {
            ctx.deleteMessage().catch(() => { });
          }
          const user = ctx.from?.username || ctx.from?.first_name || 'unknown';
          this.display.log(`MCP '${serverName}' ${enable ? 'enabled' : 'disabled'} by @${user}`, { source: 'Telegram', level: 'info' });
          await this.handleMcpListCommand(ctx, user);
          await ctx.reply(`⚠️ Use /mcpreload for the changes to take effect.`);
        } catch (error: any) {
          await ctx.answerCbQuery('Failed to update MCP');
          await ctx.reply(`❌ Failed to ${enable ? 'enable' : 'disable'} MCP '${serverName}': ${error.message}`);
        }
      });

      this.bot.launch().catch((err) => {
        if (this.isConnected) {
          this.display.log(`Telegram bot error: ${err}`, { source: 'Telegram', level: 'error' });
        }
      });

      this.isConnected = true;

      // Check if there's a restart notification to send
      this.checkAndSendRestartNotification().catch((err: any) => {
        this.display.log(`Failed to send restart notification: ${err.message}`, { source: 'Telegram', level: 'error' });
      });

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

  /**
   * Escapes a string for Telegram MarkdownV2 format.
   * All special characters outside code spans must be escaped with a backslash.
   */
  private escapeMarkdownV2(text: string): string {
    // Characters that must be escaped in MarkdownV2 outside of code/pre blocks
    return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
  }

  /**
   * Sends a proactive message to all allowed Telegram users.
   * Used by the webhook notification system to push results.
   * Tries plain text first to avoid Markdown parse errors from LLM output.
   */
  public async sendMessage(text: string): Promise<void> {
    if (!this.isConnected || !this.bot) {
      this.display.log(
        'Cannot send message: Telegram bot not connected.',
        { source: 'Telegram', level: 'warning' },
      );
      return;
    }

    const allowedUsers = this.config.get().channels.telegram.allowedUsers;
    if (allowedUsers.length === 0) {
      this.display.log(
        'No allowed Telegram users configured — skipping notification.',
        { source: 'Telegram', level: 'warning' },
      );
      return;
    }

    // Truncate to Telegram's 4096 char limit
    const MAX_LEN = 4096;
    const safeText = text.length > MAX_LEN ? text.slice(0, MAX_LEN - 3) + '...' : text;

    for (const userId of allowedUsers) {
      try {
        // Send as plain text — LLM output often has unbalanced markdown that
        // causes "Can't find end of entity" errors with parse_mode: 'MarkdownV2'.
        await this.bot.telegram.sendMessage(userId, safeText);
      } catch (err: any) {
        this.display.log(
          `Failed to send message to Telegram user ${userId}: ${err.message}`,
          { source: 'Telegram', level: 'error' },
        );
      }
    }
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

  /**
  ** =========================
  **     Commands Handlers
  ** =========================
  */

  private async handleSystemCommand(ctx: any, text: string, user: string) {
    const command = text.split(' ')[0];
    const args = text.split(' ').slice(1);

    switch (command) {
      case '/start':
        await this.handleStartCommand(ctx, user);
        break;
      case '/status':
        await this.handleStatusCommand(ctx, user);
        break;
      case '/doctor':
        await this.handleDoctorCommand(ctx, user);
        break;
      case '/stats':
        await this.handleStatsCommand(ctx, user);
        break;
      case '/help':
        await this.handleHelpCommand(ctx, user);
        break;
      case '/zaion':
        await this.handleZaionCommand(ctx, user);
        break;
      case '/sati':
        await this.handleSatiCommand(ctx, user, args);
        break;
      case '/restart':
        await this.handleRestartCommand(ctx, user);
        break;
      case '/mcpreload':
        await this.handleMcpReloadCommand(ctx, user);
        break;
      case '/mcp':
      case '/mcps':
        await this.handleMcpListCommand(ctx, user);
        break;
      case '/newsession':
      case '/reset':
        await this.handleNewSessionCommand(ctx, user);
        break;
      case '/sessionstatus':
      case '/session':
      case '/sessions':
        await this.handleSessionStatusCommand(ctx, user);
        break;
      default:
        await this.handleDefaultCommand(ctx, user, command);
    }
  }

  private async handleNewSessionCommand(ctx: any, user: string) {
    try {
      await ctx.reply("Are you ready to start a new session? Please confirm.", {
        parse_mode: 'MarkdownV2', reply_markup: {
          inline_keyboard: [
            [{ text: 'Yes, start new session', callback_data: 'confirm_new_session' }, { text: 'No, cancel', callback_data: 'cancel_new_session' }]]
        }
      });
    } catch (e: any) {
      await ctx.reply(`Error starting new session: ${e.message}`);
    }
  }

  private async handleApproveNewSessionCommand(ctx: any, user: string) {
    try {
      const history = new SQLiteChatMessageHistory({ sessionId: "" });
      await history.createNewSession();
    } catch (e: any) {
      await ctx.reply(`Error creating new session: ${e.message}`);
    }
  }


  private async handleSessionStatusCommand(ctx: any, user: string) {
    try {
      // Obter todas as sessões ativas e pausadas usando a nova função
      const history = new SQLiteChatMessageHistory({ sessionId: "" });
      const sessions = await history.listSessions();

      if (sessions.length === 0) {
        await ctx.reply('No active or paused sessions found.', { parse_mode: 'MarkdownV2' });
        return;
      }

      let response = '*Sessions:*\n\n';
      const keyboard = [];

      for (const session of sessions) {
        const title = session.title || 'Untitled Session';
        const statusEmoji = session.status === 'active' ? '🟢' : '🟡';
        response += `${statusEmoji} *${title}*\n`;
        response += `- ID: ${session.id}\n`;
        response += `- Status: ${session.status}\n`;
        response += `- Started: ${new Date(session.started_at).toLocaleString()}\n\n`;

        // Adicionar botão inline para alternar para esta sessão
        const sessionButtons = [];

        if (session.status !== 'active') {
          sessionButtons.push({
            text: `➡️ Switch`,
            callback_data: `switch_session_${session.id}`
          });
        }

        sessionButtons.push({
          text: `📂 Archive`,
          callback_data: `ask_archive_session_${session.id}`
        });

        sessionButtons.push({
          text: `🗑️ Delete`,
          callback_data: `ask_delete_session_${session.id}`
        });

        keyboard.push(sessionButtons);
      }

      await ctx.reply(response, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      history.close();
    } catch (e: any) {
      await ctx.reply(`Error retrieving session status: ${e.message}`);
    }
  }

  private async handleStartCommand(ctx: any, user: string) {
    const welcomeMessage = `
Hello, @${user}! I am ${this.config.get().agent.name}, ${this.config.get().agent.personality}.

I am your local AI operator/agent. Here are the commands you can use:

  ${this.HELP_MESSAGE}

How can I assist you today?`;

    await ctx.reply(welcomeMessage);
  }

  private async handleStatusCommand(ctx: any, user: string) {
    try {
      await checkStalePid();
      const pid = await readPid();

      if (pid && isProcessRunning(pid)) {
        await ctx.reply(`Morpheus is running (PID: ${pid})`);
      } else {
        await ctx.reply('Morpheus is stopped.');
      }
    } catch (error: any) {
      await ctx.reply(`Failed to check status: ${error.message}`);
    }
  }

  private async handleDoctorCommand(ctx: any, user: string) {
    const config = this.config.get();
    let response = '*Morpheus Doctor*\n\n';

    // Verificar versão do Node.js
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
    if (majorVersion >= 18) {
      response += '✅ Node.js: ' + nodeVersion + '\n';
    } else {
      response += '❌ Node.js: ' + nodeVersion + ' (Required: >=18)\n';
    }

    if (config) {
      response += '✅ Configuration: Valid\n';

      // Helper para verificar API key de um provider
      const hasApiKey = (provider: string, apiKey?: string) => {
        if (apiKey) return true;
        if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
        if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
        if (provider === 'gemini' || provider === 'google') return !!process.env.GOOGLE_API_KEY;
        if (provider === 'openrouter') return !!process.env.OPENROUTER_API_KEY;
        return false; // ollama and others don't need keys
      };

      // Oracle (LLM)
      const llmProvider = config.llm?.provider;
      if (llmProvider && llmProvider !== 'ollama') {
        if (hasApiKey(llmProvider, config.llm?.api_key)) {
          response += `✅ Oracle API key (${llmProvider})\n`;
        } else {
          response += `❌ Oracle API key missing (${llmProvider})\n`;
        }
      }

      // Sati
      const sati = (config as any).sati;
      const satiProvider = sati?.provider || llmProvider;
      if (satiProvider && satiProvider !== 'ollama') {
        if (hasApiKey(satiProvider, sati?.api_key ?? config.llm?.api_key)) {
          response += `✅ Sati API key (${satiProvider})\n`;
        } else {
          response += `❌ Sati API key missing (${satiProvider})\n`;
        }
      }

      // Apoc
      const apoc = (config as any).apoc;
      const apocProvider = apoc?.provider || llmProvider;
      if (apocProvider && apocProvider !== 'ollama') {
        if (hasApiKey(apocProvider, apoc?.api_key ?? config.llm?.api_key)) {
          response += `✅ Apoc API key (${apocProvider})\n`;
        } else {
          response += `❌ Apoc API key missing (${apocProvider})\n`;
        }
      }

      // Telegram token
      if (config.channels?.telegram?.enabled) {
        const hasTelegramToken = config.channels.telegram?.token || process.env.TELEGRAM_BOT_TOKEN;
        if (hasTelegramToken) {
          response += '✅ Telegram token\n';
        } else {
          response += '❌ Telegram token missing\n';
        }
      }

      // Audio API key
      if (config.audio?.enabled) {
        const audioKey = (config.audio as any)?.apiKey || process.env.GOOGLE_API_KEY;
        if (audioKey) {
          response += '✅ Audio API key\n';
        } else {
          response += '❌ Audio API key missing\n';
        }
      }
    } else {
      response += '⚠️ Configuration: Missing\n';
    }

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }

  private async handleStatsCommand(ctx: any, user: string) {
    try {
      const history = new SQLiteChatMessageHistory({
        sessionId: "default",
        databasePath: undefined,
        limit: 100,
      });

      const stats = await history.getGlobalUsageStats();
      const groupedStats = await history.getUsageStatsByProviderAndModel();

      // Totals from global stats
      const totalTokens = stats.totalInputTokens + stats.totalOutputTokens;

      // Aggregate audio seconds and cost from grouped stats
      const totalAudioSeconds = groupedStats.reduce((sum, s) => sum + (s.totalAudioSeconds || 0), 0);
      const totalCost = stats.totalEstimatedCostUsd;

      let response = '*Token Usage Statistics*\n\n';
      response += `Input Tokens: ${stats.totalInputTokens.toLocaleString()}\n`;
      response += `Output Tokens: ${stats.totalOutputTokens.toLocaleString()}\n`;
      response += `Total Tokens: ${totalTokens.toLocaleString()}\n`;
      if (totalAudioSeconds > 0) {
        response += `Audio Processed: ${totalAudioSeconds.toFixed(1)}s\n`;
      }
      if (totalCost != null) {
        response += `Estimated Cost: $${totalCost.toFixed(4)}\n`;
      }
      response += '\n';

      if (groupedStats.length > 0) {
        response += '*By Provider/Model:*\n';
        for (const stat of groupedStats) {
          response += `\n*${stat.provider}/${stat.model}*\n`;
          response += `  Tokens: ${stat.totalTokens.toLocaleString()} (${stat.messageCount} msgs)\n`;
          if (stat.totalAudioSeconds > 0) {
            response += `  Audio: ${stat.totalAudioSeconds.toFixed(1)}s\n`;
          }
          if (stat.estimatedCostUsd != null) {
            response += `  Cost: $${stat.estimatedCostUsd.toFixed(4)}\n`;
          }
        }
      } else {
        response += 'No detailed usage statistics available.';
      }

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
      history.close();
    } catch (error: any) {
      await ctx.reply(`Failed to retrieve statistics: ${error.message}`);
    }
  }

  private async handleDefaultCommand(ctx: any, user: string, command: string) {
    const prompt = `O usuário enviou o comando: ${command},
    Não entendemos o comando
    temos os seguintes comandos disponíveis:
    ${this.HELP_MESSAGE}
    Identifique se ele talvez tenha errado o comando e pergunte se ele não quis executar outro comando.
    Só faça isso agora.`;
    let response = await this.oracle.chat(prompt);

    if (response) {
      try {
        await ctx.reply(response, { parse_mode: 'MarkdownV2' });
      } catch {
        await ctx.reply(response);
      }
    }
    // await ctx.reply(`Command not recognized. Type /help to see available commands.`);
  }

  private async handleHelpCommand(ctx: any, user: string) {
    const helpMessage = `
*Available Commands:*

${this.HELP_MESSAGE}

How can I assist you today?`;

    await ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' });
  }

  private async handleZaionCommand(ctx: any, user: string) {
    const config = this.config.get();

    let response = '*System Configuration*\n\n';
    response += `*Agent:*\n`;
    response += `- Name: ${config.agent.name}\n`;
    response += `- Personality: ${config.agent.personality}\n\n`;

    response += `*Oracle (LLM):*\n`;
    response += `- Provider: ${config.llm.provider}\n`;
    response += `- Model: ${config.llm.model}\n`;
    response += `- Temperature: ${config.llm.temperature}\n`;
    response += `- Context Window: ${config.llm.context_window || 100}\n\n`;

    // Sati config (falls back to llm if not set)
    const sati = (config as any).sati;
    response += `*Sati (Memory):*\n`;
    if (sati?.provider) {
      response += `- Provider: ${sati.provider}\n`;
      response += `- Model: ${sati.model || config.llm.model}\n`;
      response += `- Temperature: ${sati.temperature ?? config.llm.temperature}\n`;
      response += `- Memory Limit: ${sati.memory_limit ?? 1000}\n`;
    } else {
      response += `- Inherits Oracle config\n`;
    }
    response += '\n';

    // Apoc config (falls back to llm if not set)
    const apoc = (config as any).apoc;
    response += `*Apoc (DevTools):*\n`;
    if (apoc?.provider) {
      response += `- Provider: ${apoc.provider}\n`;
      response += `- Model: ${apoc.model || config.llm.model}\n`;
      response += `- Temperature: ${apoc.temperature ?? 0.2}\n`;
      if (apoc.working_dir) response += `- Working Dir: ${apoc.working_dir}\n`;
      response += `- Timeout: ${apoc.timeout_ms ?? 30000}ms\n`;
    } else {
      response += `- Inherits Oracle config\n`;
    }
    response += '\n';

    response += `*Channels:*\n`;
    response += `- Telegram Enabled: ${config.channels.telegram.enabled}\n`;
    response += `- Discord Enabled: ${config.channels.discord.enabled}\n\n`;

    response += `*UI:*\n`;
    response += `- Enabled: ${config.ui.enabled}\n`;
    response += `- Port: ${config.ui.port}\n\n`;

    response += `*Audio:*\n`;
    response += `- Enabled: ${config.audio.enabled}\n`;
    response += `- Max Duration: ${config.audio.maxDurationSeconds}s\n`;

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }

  private async handleSatiCommand(ctx: any, user: string, args: string[]) {
    let limit: number | null = null;

    if (args.length > 0) {
      limit = parseInt(args[0], 10);
      if (isNaN(limit) || limit <= 0) {
        await ctx.reply('Invalid quantity. Please specify a positive number. Usage: /sati <qnt>');
        return;
      }
    }

    try {
      // Usar o repositório SATI para obter memórias de longo prazo
      const repository = SatiRepository.getInstance();
      const memories = repository.getAllMemories();

      if (memories.length === 0) {
        await ctx.reply(`No memories found.`);
        return;
      }

      // Se nenhum limite for especificado, usar todas as memórias
      let selectedMemories = memories;
      if (limit !== null) {
        selectedMemories = memories.slice(0, Math.min(limit, memories.length));
      }

      let response = `*${selectedMemories.length} SATI Memories${limit !== null ? ` (Showing first ${selectedMemories.length})` : ''}:*\n\n`;

      for (const memory of selectedMemories) {
        // Limitar o tamanho do resumo para evitar mensagens muito longas
        const truncatedSummary = memory.summary.length > 200 ? memory.summary.substring(0, 200) + '...' : memory.summary;

        response += `*${memory.category} (${memory.importance}):* ${truncatedSummary}\n\n`;
      }

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
    } catch (error: any) {
      await ctx.reply(`Failed to retrieve memories: ${error.message}`);
    }
  }

  private async handleRestartCommand(ctx: any, user: string) {
    // Store the user ID who requested the restart
    const userId = ctx.from.id;
    const updateId: number = ctx.update.update_id;

    // Save the user ID to a temporary file so the restarted process can notify them
    const restartNotificationFile = path.join(os.tmpdir(), 'morpheus_restart_notification.json');
    try {
      await fs.writeJson(restartNotificationFile, { userId: userId, username: user }, { encoding: 'utf8' });
    } catch (error: any) {
      this.display.log(`Failed to save restart notification info: ${error.message}`, { source: 'Telegram', level: 'error' });
    }

    // Respond to the user first
    await ctx.reply('🔄 Restart initiated. The Morpheus agent will restart shortly.');

    // Acknowledge this update to Telegram by advancing the offset past it.
    // Without this, Telegraf's in-memory offset is lost on process.exit() and the
    // /restart message gets re-delivered on the next startup, causing an infinite loop.
    try {
      await ctx.telegram.callApi('getUpdates', { offset: updateId + 1, limit: 1, timeout: 0 });
    } catch (e: any) {
      // Best-effort — proceed with restart regardless
    }

    // Schedule the restart after a short delay to ensure the response is sent
    setTimeout(() => {
      // Stop the bot to prevent processing more messages
      if (this.bot) {
        try {
          this.bot.stop();
        } catch (e: any) {
          // Ignore stop errors
        }
      }

      // Execute the restart command using the CLI
      const restartProcess = spawn(process.execPath, [process.argv[1], 'restart'], {
        detached: true,
        stdio: 'ignore'
      });

      restartProcess.unref();

      // Exit the current process
      process.exit(0);
    }, 500);
  }

  private async checkAndSendRestartNotification() {
    const restartNotificationFile = path.join(os.tmpdir(), 'morpheus_restart_notification.json');

    try {
      // Check if the notification file exists
      if (await fs.pathExists(restartNotificationFile)) {
        const notificationData = await fs.readJson(restartNotificationFile);

        // Send a message to the user who requested the restart
        if (this.bot && notificationData.userId) {
          try {
            await this.bot.telegram.sendMessage(notificationData.userId, '✅ Morpheus agent has been successfully restarted!');

            // Optionally, also send to the display
            this.display.log(`Restart notification sent to user ${notificationData.username} (ID: ${notificationData.userId})`, { source: 'Telegram', level: 'info' });
          } catch (error: any) {
            this.display.log(`Failed to send restart notification to user ${notificationData.username}: ${error.message}`, { source: 'Telegram', level: 'error' });
          }
        }

        // Remove the notification file after sending the message
        await fs.remove(restartNotificationFile);
      }
    } catch (error: any) {
      this.display.log(`Error checking restart notification: ${error.message}`, { source: 'Telegram', level: 'error' });
    }
  }

  private async handleMcpReloadCommand(ctx: any, user: string) {
    try {
      await ctx.reply('🔄 Reloading MCP servers...');
      await this.oracle.reloadTools();
      await ctx.reply('✅ MCP servers reloaded successfully.');
      this.display.log(`MCP reload triggered by @${user}`, { source: 'Telegram', level: 'info' });
    } catch (error: any) {
      await ctx.reply(`❌ Failed to reload MCP servers: ${error.message}`);
      this.display.log(`MCP reload failed: ${error.message}`, { source: 'Telegram', level: 'error' });
    }
  }

  private async handleMcpListCommand(ctx: any, user: string) {
    try {
      const [servers, probeResults] = await Promise.all([
        MCPManager.listServers(),
        Construtor.probe(),
      ]);

      if (servers.length === 0) {
        await ctx.reply(
          '*No MCP Servers Configured*\n\nThere are currently no MCP servers configured in the system.',
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      const probeMap = new Map(probeResults.map(r => [r.name, r]));

      let response = `*MCP Servers (${servers.length})*\n\n`;
      const keyboard: { text: string; callback_data: string }[][] = [];

      servers.forEach((server, index) => {
        const enabledStatus = server.enabled ? '✅ Enabled' : '❌ Disabled';
        const transport = server.config.transport.toUpperCase();
        const probe = probeMap.get(server.name);
        const connectionStatus = probe
          ? probe.ok
            ? `🟢 Connected (${probe.toolCount} tools)`
            : `🔴 Failed`
          : '⚪ Unknown';

        response += `*${index + 1}. ${server.name}*\n`;
        response += `Status: ${enabledStatus}\n`;
        response += `Connection: ${connectionStatus}\n`;
        response += `Transport: ${transport}\n`;

        if (server.config.transport === 'stdio') {
          response += `Command: \`${server.config.command}\`\n`;
          if (server.config.args && server.config.args.length > 0) {
            response += `Args: \`${server.config.args.join(' ')}\`\n`;
          }
        } else if (server.config.transport === 'http') {
          response += `URL: \`${server.config.url}\`\n`;
        }

        if (probe && !probe.ok && probe.error) {
          const shortError = probe.error.length > 80 ? probe.error.slice(0, 80) + '…' : probe.error;
          response += `Error: \`${shortError}\`\n`;
        }

        response += '\n';

        if (server.enabled) {
          keyboard.push([{ text: `❌ Disable ${server.name}`, callback_data: `toggle_mcp_disable_${server.name}` }]);
        } else {
          keyboard.push([{ text: `✅ Enable ${server.name}`, callback_data: `toggle_mcp_enable_${server.name}` }]);
        }
      });

      await ctx.reply(response, {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      this.display.log('Error listing MCP servers: ' + (error instanceof Error ? error.message : String(error)), { source: 'Telegram', level: 'error' });
      await ctx.reply(
        'An error occurred while retrieving the list of MCP servers. Please check the logs for more details.',
        { parse_mode: 'MarkdownV2' }
      );
    }
  }
}
