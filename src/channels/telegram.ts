import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { ConfigManager } from '../config/manager.js';
import { DisplayManager } from '../runtime/display.js';
import { Oracle } from '../runtime/oracle.js';
import { createTelephonist, ITelephonist } from '../runtime/telephonist.js';
import { readPid, isProcessRunning, checkStalePid } from '../runtime/lifecycle.js';
import { SQLiteChatMessageHistory } from '../runtime/memory/sqlite.js';
import { SatiRepository } from '../runtime/memory/sati/repository.js';
import { MCPManager } from '../config/mcp-manager.js';
import { Construtor } from '../runtime/tools/factory.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Strips HTML tags and unescapes entities for plain-text Telegram fallback. */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Splits an HTML string into chunks ≤ maxLen that never break inside an HTML tag.
 * Prefers splitting at paragraph (double newline) or line boundaries.
 */
function splitHtmlChunks(html: string, maxLen = 4096): string[] {
  if (html.length <= maxLen) return [html];

  const chunks: string[] = [];
  let remaining = html.trim();

  while (remaining.length > maxLen) {
    let splitAt = -1;

    for (const sep of ['\n\n', '\n', ' ']) {
      const pos = remaining.lastIndexOf(sep, maxLen - 1);
      if (pos < maxLen / 4) continue; // avoid tiny first chunks

      // Confirm position is not inside an HTML tag
      const before = remaining.slice(0, pos);
      const lastOpen = before.lastIndexOf('<');
      const lastClose = before.lastIndexOf('>');
      if (lastOpen > lastClose) continue; // inside a tag — try next separator

      splitAt = pos + sep.length;
      break;
    }

    if (splitAt <= 0) {
      // Fallback: split right after the last closing '>' before maxLen
      const closing = remaining.lastIndexOf('>', maxLen - 1);
      splitAt = closing > 0 ? closing + 1 : maxLen;
    }

    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

async function toTelegramRichText(text: string): Promise<{ chunks: string[]; parse_mode: 'HTML' }> {
  let source = String(text ?? '').replace(/\r\n/g, '\n');
  const uuidRegex = /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\b/g;

  const codeBlocks: string[] = [];
  source = source.replace(/```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    const idx = codeBlocks.push(`<pre><code>${escapeHtml(String(code).trimEnd())}</code></pre>`) - 1;
    return `@@CODEBLOCK_${idx}@@`;
  });

  const inlineCodes: string[] = [];
  source = source.replace(/`([^`\n]+)`/g, (_m, code) => {
    const idx = inlineCodes.push(`<code>${escapeHtml(code)}</code>`) - 1;
    return `@@INLINECODE_${idx}@@`;
  });

  const links: string[] = [];
  source = source.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    const safeUrl = String(url).replace(/"/g, '&quot;');
    const idx = links.push(`<a href="${safeUrl}">${escapeHtml(label)}</a>`) - 1;
    return `@@LINK_${idx}@@`;
  });

  // Markdown bullets become visible bullets in Telegram HTML mode.
  source = source.replace(/^(\s*)[-*]\s+/gm, '$1• ');

  // Escape user/model content before reinserting HTML tags.
  source = escapeHtml(source);

  // Headings -> bold lines
  source = source.replace(/^#{1,6}\s+(.+)$/gm, (_m, title) => `<b>${title.trim()}</b>`);

  // Bold
  source = source.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
  source = source.replace(/__([\s\S]+?)__/g, '<b>$1</b>');

  // Italic (conservative)
  source = source.replace(/(^|[\s(])\*([^*\n]+)\*(?=[$\s).,!?:;])/gm, '$1<i>$2</i>');
  source = source.replace(/(^|[\s(])_([^_\n]+)_(?=[$\s).,!?:;])/gm, '$1<i>$2</i>');

  // Make task/session IDs easier to copy in Telegram.
  source = source.replace(uuidRegex, '<code>$1</code>');

  // Restore placeholders
  source = source.replace(/@@CODEBLOCK_(\d+)@@/g, (_m, idx) => codeBlocks[Number(idx)] || '');
  source = source.replace(/@@INLINECODE_(\d+)@@/g, (_m, idx) => inlineCodes[Number(idx)] || '');
  source = source.replace(/@@LINK_(\d+)@@/g, (_m, idx) => links[Number(idx)] || '');

  return { chunks: splitHtmlChunks(source.trim()), parse_mode: 'HTML' };
}

/**
 * Escapes special characters in a plain string segment so it's safe to embed
 * inside a manually-built MarkdownV2 message. Does NOT touch * _ ` [ ] chars
 * (those are intentional MarkdownV2 formatting from our own code).
 * Use for dynamic values (usernames, numbers, paths) interpolated into fixed templates.
 */
function escMd(value: string | number | boolean): string {
  // Escape all MarkdownV2 special characters that are NOT used as intentional
  // formatters in our static templates (*bold*, _italic_, `code`, [link]).
  // Per Telegram docs: _ * [ ] ( ) ~ ` # + - = | { } . !  must be escaped.
  // We skip * _ ` [ ] here because those are our intentional formatters.
  // The - must be at end of character class to avoid being treated as a range.
  return String(value).replace(/([.!?(){}#+~|=>$@\\-])/g, '\\$1');
}

/**
 * Full MarkdownV2 escape — escapes ALL special characters including * _ ` [ ].
 * Use for untrusted/user-generated content (session titles, prompts, etc.)
 * placed inside bold/italic markers or anywhere in a MarkdownV2 message.
 */
function escMdRaw(value: string | number | boolean): string {
  return String(value).replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
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

  // Pending Chronos create confirmations (userId -> job data + expiry)
  private pendingChronosCreate = new Map<string, {
    prompt: string;
    schedule_expression: string;
    human_readable: string;
    timezone: string;
    expiresAt: number;
    timer: ReturnType<typeof setTimeout>;
  }>();

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const last = this.rateLimiter.get(userId);
    if (last !== undefined && now - last < this.RATE_LIMIT_MS) return true;
    this.rateLimiter.set(userId, now);
    return false;
  }

  private HELP_MESSAGE = `/start \\- Show this welcome message and available commands
/status \\- Check the status of the Morpheus agent
/doctor \\- Diagnose environment and configuration issues
/stats \\- Show token usage statistics
/help \\- Show available commands
/zaion \\- Show system configurations
/sati qnt \\- Show specific memories
/trinity \\- List registered Trinity databases
/newsession \\- Archive current session and start fresh
/sessions \\- List all sessions with titles and switch between them
/restart \\- Restart the Morpheus agent
/mcpreload \\- Reload MCP servers without restarting
/mcp or /mcps \\- List registered MCP servers
/chronos <prompt \\+ time\\> \\- Schedule a prompt for the Oracle
/chronos\\_list \\- List all active Chronos jobs
/chronos\\_view <id\\> \\- View a Chronos job and its last executions
/chronos\\_disable <id\\> \\- Disable a Chronos job
/chronos\\_enable <id\\> \\- Enable a Chronos job
/chronos\\_delete <id\\> \\- Delete a Chronos job`;

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

        // Check for pending Chronos create confirmation
        const pendingChronos = this.pendingChronosCreate.get(userId);
        if (pendingChronos) {
          const lower = text.trim().toLowerCase();
          if (lower === 'yes' || lower === 'confirm' || lower === 'y') {
            clearTimeout(pendingChronos.timer);
            this.pendingChronosCreate.delete(userId);
            await this.confirmChronosCreate(ctx, userId, pendingChronos);
          } else {
            clearTimeout(pendingChronos.timer);
            this.pendingChronosCreate.delete(userId);
            await ctx.reply('Cancelled.');
          }
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

          const sessionId = await this.history.getCurrentSessionOrCreate();
          await this.oracle.setSessionId(sessionId);

          // Process with Agent
          const response = await this.oracle.chat(text, undefined, false, {
            origin_channel: 'telegram',
            session_id: sessionId,
            origin_message_id: String(ctx.message.message_id),
            origin_user_id: userId,
          });

          if (response) {
            const rich = await toTelegramRichText(response);
            for (const chunk of rich.chunks) {
              try {
                await ctx.reply(chunk, { parse_mode: rich.parse_mode });
              } catch {
                const plain = stripHtmlTags(chunk).slice(0, 4096);
                if (plain) await ctx.reply(plain);
              }
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

          const sessionId = await this.history.getCurrentSessionOrCreate();
          await this.oracle.setSessionId(sessionId);

          // Process with Agent
          const response = await this.oracle.chat(text, usage, true, {
            origin_channel: 'telegram',
            session_id: sessionId,
            origin_message_id: String(ctx.message.message_id),
            origin_user_id: userId,
          });

          // if (listeningMsg) {
          //   try {
          //     await ctx.telegram.deleteMessage(ctx.chat.id, listeningMsg.message_id);
          //   } catch (e) {
          //     // Ignore delete error
          //   }
          // }

          if (response) {
            const rich = await toTelegramRichText(response);
            for (const chunk of rich.chunks) {
              try {
                await ctx.reply(chunk, { parse_mode: rich.parse_mode });
              } catch {
                const plain = stripHtmlTags(chunk).slice(0, 4096);
                if (plain) await ctx.reply(plain);
              }
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

        await ctx.reply(`⚠️ *ARCHIVE SESSION?*\n\nAre you sure you want to archive session \`${escMd(sessionId)}\`?\n\nIt will be moved to long\\-term memory \\(SATI\\) and removed from the active list\\. This action cannot be easily undone via Telegram\\.`, {
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
          await ctx.reply(`✅ Session \`${escMd(sessionId)}\` has been archived and moved to long\\-term memory\\.`, { parse_mode: 'MarkdownV2' });
        } catch (error: any) {
          await ctx.answerCbQuery(`Error archiving: ${error.message}`, { show_alert: true });
        }
      });

      // --- Delete Flow ---
      this.bot.action(/^ask_delete_session_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data;
        const sessionId = data.replace('ask_delete_session_', '');

        await ctx.reply(`🚫 *DELETE SESSION?*\n\nAre you sure you want to PERMANENTLY DELETE session \`${escMd(sessionId)}\`?\n\nThis action is *IRREVERSIBLE*\\. All data will be lost\\.`, {
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
          await ctx.reply(`🗑️ Session \`${escMd(sessionId)}\` has been permanently deleted\\.`, { parse_mode: 'MarkdownV2' });
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

      // --- Trinity DB Test Connection ---
      this.bot.action(/^test_trinity_db_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data as string;
        const id = parseInt(data.replace('test_trinity_db_', ''), 10);
        if (isNaN(id)) { await ctx.answerCbQuery('Invalid ID'); return; }
        await ctx.answerCbQuery('Testing connection…');
        try {
          const { DatabaseRegistry } = await import('../runtime/memory/trinity-db.js');
          const { testConnection } = await import('../runtime/trinity-connector.js');
          const db = DatabaseRegistry.getInstance().getDatabase(id);
          if (!db) { await ctx.reply('❌ Database not found.'); return; }
          const ok = await testConnection(db);
          await ctx.reply(
            ok
              ? `✅ <b>${escapeHtml(db.name)}</b>: connection successful.`
              : `❌ <b>${escapeHtml(db.name)}</b>: connection failed.`,
            { parse_mode: 'HTML' }
          );
        } catch (e: any) {
          await ctx.reply(`❌ Error testing connection: ${escapeHtml(e.message)}`, { parse_mode: 'HTML' });
        }
      });

      // --- Trinity DB Refresh Schema ---
      this.bot.action(/^refresh_trinity_db_schema_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data as string;
        const id = parseInt(data.replace('refresh_trinity_db_schema_', ''), 10);
        if (isNaN(id)) { await ctx.answerCbQuery('Invalid ID'); return; }
        await ctx.answerCbQuery('Refreshing schema…');
        try {
          const { DatabaseRegistry } = await import('../runtime/memory/trinity-db.js');
          const { introspectSchema } = await import('../runtime/trinity-connector.js');
          const { Trinity } = await import('../runtime/trinity.js');
          const registry = DatabaseRegistry.getInstance();
          const db = registry.getDatabase(id);
          if (!db) { await ctx.reply('❌ Database not found.'); return; }
          const schema = await introspectSchema(db);
          registry.updateSchema(id, JSON.stringify(schema, null, 2));
          await Trinity.refreshDelegateCatalog().catch(() => {});
          const tableNames = schema.databases
            ? schema.databases.flatMap((d: any) => d.tables.map((t: any) => `${d.name}.${t.name}`))
            : schema.tables.map((t: any) => t.name);
          const count = tableNames.length;
          await ctx.reply(
            `🔄 <b>${escapeHtml(db.name)}</b>: schema refreshed — ${count} ${count === 1 ? 'table' : 'tables'}.`,
            { parse_mode: 'HTML' }
          );
        } catch (e: any) {
          await ctx.reply(`❌ Error refreshing schema: ${escapeHtml(e.message)}`, { parse_mode: 'HTML' });
        }
      });

      // --- Trinity DB Delete Flow ---
      this.bot.action(/^ask_trinity_db_delete_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data as string;
        const id = parseInt(data.replace('ask_trinity_db_delete_', ''), 10);
        if (isNaN(id)) { await ctx.answerCbQuery('Invalid ID'); return; }
        try {
          const { DatabaseRegistry } = await import('../runtime/memory/trinity-db.js');
          const db = DatabaseRegistry.getInstance().getDatabase(id);
          if (!db) { await ctx.answerCbQuery('Database not found'); return; }
          await ctx.answerCbQuery();
          await ctx.reply(
            `⚠️ Delete <b>${escapeHtml(db.name)}</b> (${escapeHtml(db.type)}) from Trinity?\n\nThe actual database won't be affected — only this registration will be removed.`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🗑️ Yes, delete', callback_data: `confirm_trinity_db_delete_${id}` },
                    { text: 'Cancel', callback_data: 'cancel_trinity_db_delete' },
                  ],
                ],
              },
            }
          );
        } catch (e: any) {
          await ctx.answerCbQuery(`Error: ${e.message}`, { show_alert: true });
        }
      });

      this.bot.action(/^confirm_trinity_db_delete_/, async (ctx) => {
        const data = (ctx.callbackQuery as any).data as string;
        const id = parseInt(data.replace('confirm_trinity_db_delete_', ''), 10);
        if (isNaN(id)) { await ctx.answerCbQuery('Invalid ID'); return; }
        try {
          const { DatabaseRegistry } = await import('../runtime/memory/trinity-db.js');
          const registry = DatabaseRegistry.getInstance();
          const db = registry.getDatabase(id);
          const name = db?.name ?? `#${id}`;
          const deleted = registry.deleteDatabase(id);
          await ctx.answerCbQuery(deleted ? '🗑️ Deleted' : 'Not found');
          if (ctx.updateType === 'callback_query') ctx.deleteMessage().catch(() => { });
          const user = ctx.from?.username || ctx.from?.first_name || 'unknown';
          this.display.log(`Trinity DB '${name}' deleted by @${user}`, { source: 'Telegram', level: 'info' });
          await ctx.reply(deleted ? `🗑️ <b>${escapeHtml(name)}</b> removed from Trinity.` : `❌ Database #${id} not found.`, { parse_mode: 'HTML' });
        } catch (e: any) {
          await ctx.answerCbQuery(`Error: ${e.message}`, { show_alert: true });
        }
      });

      this.bot.action('cancel_trinity_db_delete', async (ctx) => {
        await ctx.answerCbQuery('Cancelled');
        if (ctx.updateType === 'callback_query') ctx.deleteMessage().catch(() => { });
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
   * Sends a proactive message to all allowed Telegram users.
   * Used by the webhook notification system to push results.
   * Uses Telegram HTML parse mode for richer formatting, with plain-text fallback.
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

    const rich = await toTelegramRichText(text);

    for (const userId of allowedUsers) {
      for (const chunk of rich.chunks) {
        try {
          await this.bot.telegram.sendMessage(userId, chunk, { parse_mode: rich.parse_mode });
        } catch {
          try {
            const plain = stripHtmlTags(chunk).slice(0, 4096);
            if (plain) await this.bot.telegram.sendMessage(userId, plain);
          } catch (err: any) {
            this.display.log(
              `Failed to send message chunk to Telegram user ${userId}: ${err.message}`,
              { source: 'Telegram', level: 'error' },
            );
          }
        }
      }
    }
  }

  public async sendMessageToUser(userId: string, text: string): Promise<void> {
    if (!this.isConnected || !this.bot) {
      this.display.log(
        'Cannot send direct message: Telegram bot not connected.',
        { source: 'Telegram', level: 'warning' },
      );
      return;
    }

    const rich = await toTelegramRichText(text);
    for (const chunk of rich.chunks) {
      try {
        await this.bot.telegram.sendMessage(userId, chunk, { parse_mode: rich.parse_mode });
      } catch {
        const plain = stripHtmlTags(chunk).slice(0, 4096);
        if (plain) await this.bot.telegram.sendMessage(userId, plain);
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
      case '/trinity':
        await this.handleTrinityCommand(ctx, user);
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
      case '/chronos': {
        const userId = ctx.from?.id?.toString() ?? user;
        const fullText = text.slice('/chronos'.length).trim();
        await this.handleChronosCreate(ctx, userId, fullText);
        break;
      }
      case '/chronos_list':
        await this.handleChronosList(ctx);
        break;
      case '/chronos_view': {
        const id = args[0] ?? '';
        await this.handleChronosView(ctx, id);
        break;
      }
      case '/chronos_disable': {
        const id = args[0] ?? '';
        await this.handleChronosDisable(ctx, id);
        break;
      }
      case '/chronos_enable': {
        const id = args[0] ?? '';
        await this.handleChronosEnable(ctx, id);
        break;
      }
      case '/chronos_delete': {
        const id = args[0] ?? '';
        await this.handleChronosDelete(ctx, id);
        break;
      }
      default:
        await this.handleDefaultCommand(ctx, user, command);
    }
  }

  // ─── Chronos Command Handlers ────────────────────────────────────────────────

  private async handleChronosCreate(ctx: any, userId: string, fullText: string) {
    if (!fullText) {
      await ctx.reply(
        'Usage: /chronos <prompt + time expression>\nExample: /chronos Check disk space tomorrow at 9am'
      );
      return;
    }

    try {
      const { parse: chronoParse } = await import('chrono-node');
      const results = chronoParse(fullText);

      if (!results.length) {
        await ctx.reply(
          'Could not detect a time expression. Try: `/chronos Check disk space tomorrow at 9am`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Extract the first matched datetime fragment and derive the prompt
      const match = results[0];
      const matchedText = fullText.slice(match.index, match.index + match.text.length);
      const prompt = (
        fullText.slice(0, match.index) + fullText.slice(match.index + match.text.length)
      ).replace(/\s+/g, ' ').trim() || fullText;

      const globalTz = this.config.getChronosConfig().timezone;
      const { parseScheduleExpression } = await import('../runtime/chronos/parser.js');
      const schedule = parseScheduleExpression(matchedText, 'once', { timezone: globalTz });

      const formatted = new Date(schedule.next_run_at).toLocaleString('en-US', {
        timeZone: globalTz, year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });

      const timer = setTimeout(() => {
        this.pendingChronosCreate.delete(userId);
      }, 5 * 60 * 1000);

      this.pendingChronosCreate.set(userId, {
        prompt,
        schedule_expression: matchedText,
        human_readable: schedule.human_readable,
        timezone: globalTz,
        expiresAt: Date.now() + 5 * 60 * 1000,
        timer,
      });

      await ctx.reply(
        `📅 *${prompt}*\n${schedule.human_readable} (${formatted})\n\nConfirm? Reply \`yes\` or \`no\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      await ctx.reply(`Error: ${err.message}`);
    }
  }

  private async confirmChronosCreate(
    ctx: any,
    _userId: string,
    pending: { prompt: string; schedule_expression: string; human_readable: string; timezone: string; expiresAt: number; timer: ReturnType<typeof setTimeout> }
  ) {
    if (Date.now() > pending.expiresAt) {
      await ctx.reply('Confirmation expired. Please run /chronos again.');
      return;
    }
    try {
      const { parseScheduleExpression } = await import('../runtime/chronos/parser.js');
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const schedule = parseScheduleExpression(pending.schedule_expression, 'once', {
        timezone: pending.timezone,
      });
      const repo = ChronosRepository.getInstance();
      const job = repo.createJob({
        prompt: pending.prompt,
        schedule_type: 'once',
        schedule_expression: pending.schedule_expression,
        cron_normalized: schedule.cron_normalized,
        timezone: pending.timezone,
        next_run_at: schedule.next_run_at,
        created_by: 'telegram',
      });
      const formatted = new Date(schedule.next_run_at).toLocaleString('en-US', {
        timeZone: pending.timezone, year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });
      await ctx.reply(`✅ Job created (ID: \`${job.id.slice(0, 8)}\`)\n${schedule.human_readable}\n${formatted}`, {
        parse_mode: 'Markdown',
      });
    } catch (err: any) {
      await ctx.reply(`Failed to create job: ${err.message}`);
    }
  }

  private async handleChronosList(ctx: any) {
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const jobs = repo.listJobs();
      if (!jobs.length) {
        await ctx.reply('No Chronos jobs found.');
        return;
      }
      const lines = jobs.map((j, i) => {
        const status = j.enabled ? '🟢' : '🔴';
        const next = j.enabled && j.next_run_at
          ? new Date(j.next_run_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : j.enabled ? 'N/A' : 'disabled';
        const prompt = j.prompt.length > 35 ? j.prompt.slice(0, 35) + '…' : j.prompt;
        return `${status} ${i + 1}. \`${j.id}\` \n${prompt}\n    _${next}_`;
      });
      await ctx.reply(`*Chronos Jobs*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`Error: ${err.message}`);
    }
  }

  private async handleChronosView(ctx: any, id: string) {
    if (!id) { await ctx.reply('Usage: /chronos_view <job_id>'); return; }
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const job = repo.getJob(id);
      if (!job) { await ctx.reply('Job not found.'); return; }
      const executions = repo.listExecutions(id, 3);
      const next = job.next_run_at ? new Date(job.next_run_at).toLocaleString() : 'N/A';
      const last = job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never';
      const execLines = executions.map(e =>
        `  • ${e.status.toUpperCase()} — ${new Date(e.triggered_at).toLocaleString()}`
      ).join('\n') || '  None yet';
      const msg = `*Chronos Job* \`${id.slice(0, 8)}\`\n\n` +
        `*Prompt:* ${job.prompt}\n` +
        `*Schedule:* ${job.schedule_type} — \`${job.schedule_expression}\`\n` +
        `*Timezone:* ${job.timezone}\n` +
        `*Status:* ${job.enabled ? 'Enabled' : 'Disabled'}\n` +
        `*Next Run:* ${next}\n` +
        `*Last Run:* ${last}\n\n` +
        `*Last 3 Executions:*\n${execLines}`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`Error: ${err.message}`);
    }
  }

  private async handleChronosDisable(ctx: any, id: string) {
    if (!id) { await ctx.reply('Usage: /chronos_disable <job_id>'); return; }
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const job = repo.disableJob(id);
      if (!job) { await ctx.reply('Job not found.'); return; }
      await ctx.reply(`Job \`${id.slice(0, 8)}\` disabled.`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`Error: ${err.message}`);
    }
  }

  private async handleChronosEnable(ctx: any, id: string) {
    if (!id) { await ctx.reply('Usage: /chronos_enable <job_id>'); return; }
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const { parseNextRun } = await import('../runtime/chronos/parser.js');
      const repo = ChronosRepository.getInstance();
      const existing = repo.getJob(id);
      if (!existing) { await ctx.reply('Job not found.'); return; }
      let nextRunAt: number | undefined;
      if (existing.cron_normalized) {
        // cron_normalized is always a 5-field cron string — use parseNextRun directly
        nextRunAt = parseNextRun(existing.cron_normalized, existing.timezone);
      }
      repo.updateJob(id, { enabled: true, next_run_at: nextRunAt });
      const job = repo.getJob(id)!;
      const next = job.next_run_at ? new Date(job.next_run_at).toLocaleString() : 'N/A';
      await ctx.reply(`Job \`${id.slice(0, 8)}\` enabled. Next run: ${next}`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`Error: ${err.message}`);
    }
  }

  private async handleChronosDelete(ctx: any, id: string) {
    if (!id) { await ctx.reply('Usage: /chronos_delete <job_id>'); return; }
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const deleted = repo.deleteJob(id);
      if (!deleted) { await ctx.reply('Job not found.'); return; }
      await ctx.reply(`Job \`${id.slice(0, 8)}\` deleted.`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`Error: ${err.message}`);
    }
  }

  // ─── End Chronos ──────────────────────────────────────────────────────────────

  private async handleNewSessionCommand(ctx: any, user: string) {
    try {
      await ctx.reply("Are you ready to start a new session\\? Please confirm\\.", {
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
      const history = new SQLiteChatMessageHistory({ sessionId: "" });
      // Exclude automated Chronos sessions — their IDs exceed Telegram's 64-byte
      // callback_data limit and they are not user-managed sessions.
      const sessions = (await history.listSessions()).filter(
        (s) => !s.id.startsWith('chronos-job-') && !s.id.startsWith('sati-evaluation')
      );

      if (sessions.length === 0) {
        await ctx.reply('No active or paused sessions found\\.', { parse_mode: 'MarkdownV2' });
        return;
      }

      let response = '*Sessions:*\n\n';
      const keyboard = [];

      for (const session of sessions) {
        const title = session.title || 'Untitled Session';
        const statusEmoji = session.status === 'active' ? '🟢' : '🟡';
        response += `${statusEmoji} *${escMdRaw(title)}*\n`;
        response += `\\- ID: \`${escMdRaw(session.id)}\`\n`;
        response += `\\- Status: ${escMdRaw(session.status)}\n`;
        response += `\\- Started: ${escMdRaw(new Date(session.started_at).toLocaleString())}\n\n`;

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
      response += `✅ Node\\.js: ${escMd(nodeVersion)}\n`;
    } else {
      response += `❌ Node\\.js: ${escMd(nodeVersion)} \\(Required: \\>\\=18\\)\n`;
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
          response += `✅ Oracle API key \\(${escMd(llmProvider)}\\)\n`;
        } else {
          response += `❌ Oracle API key missing \\(${escMd(llmProvider)}\\)\n`;
        }
      }

      // Sati
      const sati = (config as any).sati;
      const satiProvider = sati?.provider || llmProvider;
      if (satiProvider && satiProvider !== 'ollama') {
        if (hasApiKey(satiProvider, sati?.api_key ?? config.llm?.api_key)) {
          response += `✅ Sati API key \\(${escMd(satiProvider)}\\)\n`;
        } else {
          response += `❌ Sati API key missing \\(${escMd(satiProvider)}\\)\n`;
        }
      }

      // Apoc
      const apoc = (config as any).apoc;
      const apocProvider = apoc?.provider || llmProvider;
      if (apocProvider && apocProvider !== 'ollama') {
        if (hasApiKey(apocProvider, apoc?.api_key ?? config.llm?.api_key)) {
          response += `✅ Apoc API key \\(${escMd(apocProvider)}\\)\n`;
        } else {
          response += `❌ Apoc API key missing \\(${escMd(apocProvider)}\\)\n`;
        }
      }

      // Neo
      const neo = (config as any).neo;
      const neoProvider = neo?.provider || llmProvider;
      if (neoProvider && neoProvider !== 'ollama') {
        if (hasApiKey(neoProvider, neo?.api_key ?? config.llm?.api_key)) {
          response += `✅ Neo API key \\(${escMd(neoProvider)}\\)\n`;
        } else {
          response += `❌ Neo API key missing \\(${escMd(neoProvider)}\\)\n`;
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
      response += `Input Tokens: ${escMd(stats.totalInputTokens.toLocaleString())}\n`;
      response += `Output Tokens: ${escMd(stats.totalOutputTokens.toLocaleString())}\n`;
      response += `Total Tokens: ${escMd(totalTokens.toLocaleString())}\n`;
      if (totalAudioSeconds > 0) {
        response += `Audio Processed: ${escMd(totalAudioSeconds.toFixed(1))}s\n`;
      }
      if (totalCost != null) {
        response += `Estimated Cost: \\$${escMd(totalCost.toFixed(4))}\n`;
      }
      response += '\n';

      if (groupedStats.length > 0) {
        response += '*By Provider/Model:*\n';
        for (const stat of groupedStats) {
          response += `\n*${escMd(stat.provider)}/${escMd(stat.model)}*\n`;
          response += `  Tokens: ${escMd(stat.totalTokens.toLocaleString())} \\(${escMd(stat.messageCount)} msgs\\)\n`;
          if (stat.totalAudioSeconds > 0) {
            response += `  Audio: ${escMd(stat.totalAudioSeconds.toFixed(1))}s\n`;
          }
          if (stat.estimatedCostUsd != null) {
            response += `  Cost: \\$${escMd(stat.estimatedCostUsd.toFixed(4))}\n`;
          }
        }
      } else {
        response += 'No detailed usage statistics available\\.';
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
      const rich = await toTelegramRichText(response);
      for (const chunk of rich.chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: rich.parse_mode });
        } catch {
          const plain = stripHtmlTags(chunk).slice(0, 4096);
          if (plain) await ctx.reply(plain);
        }
      }
    }
    // await ctx.reply(`Command not recognized. Type /help to see available commands.`);
  }

  private async handleHelpCommand(ctx: any, user: string) {
    const helpMessage = `*Available Commands:*\n\n${this.HELP_MESSAGE}\n\nHow can I assist you today\\?`;

    await ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' });
  }

  private async handleZaionCommand(ctx: any, user: string) {
    const config = this.config.get();

    let response = '*System Configuration*\n\n';
    response += `*Agent:*\n`;
    response += `\\- Name: ${escMd(config.agent.name)}\n`;
    response += `\\- Personality: ${escMd(config.agent.personality)}\n\n`;

    response += `*Oracle \\(LLM\\):*\n`;
    response += `\\- Provider: ${escMd(config.llm.provider)}\n`;
    response += `\\- Model: ${escMd(config.llm.model)}\n`;
    response += `\\- Temperature: ${escMd(config.llm.temperature)}\n`;
    response += `\\- Context Window: ${escMd(config.llm.context_window || 100)}\n\n`;

    // Sati config (falls back to llm if not set)
    const sati = (config as any).sati;
    response += `*Sati \\(Memory\\):*\n`;
    if (sati?.provider) {
      response += `\\- Provider: ${escMd(sati.provider)}\n`;
      response += `\\- Model: ${escMd(sati.model || config.llm.model)}\n`;
      response += `\\- Temperature: ${escMd(sati.temperature ?? config.llm.temperature)}\n`;
      response += `\\- Memory Limit: ${escMd(sati.memory_limit ?? 1000)}\n`;
    } else {
      response += `\\- Inherits Oracle config\n`;
    }
    response += '\n';

    // Apoc config (falls back to llm if not set)
    const apoc = (config as any).apoc;
    response += `*Apoc \\(DevTools\\):*\n`;
    if (apoc?.provider) {
      response += `\\- Provider: ${escMd(apoc.provider)}\n`;
      response += `\\- Model: ${escMd(apoc.model || config.llm.model)}\n`;
      response += `\\- Temperature: ${escMd(apoc.temperature ?? 0.2)}\n`;
      if (apoc.working_dir) response += `\\- Working Dir: ${escMd(apoc.working_dir)}\n`;
      response += `\\- Timeout: ${escMd(apoc.timeout_ms ?? 30000)}ms\n`;
    } else {
      response += `\\- Inherits Oracle config\n`;
    }
    response += '\n';

    // Neo config (falls back to llm if not set)
    const neo = (config as any).neo;
    response += `*Neo \\(MCP \\+ Internal Tools\\):*\n`;
    if (neo?.provider) {
      response += `\\- Provider: ${escMd(neo.provider)}\n`;
      response += `\\- Model: ${escMd(neo.model || config.llm.model)}\n`;
      response += `\\- Temperature: ${escMd(neo.temperature ?? 0.2)}\n`;
      response += `\\- Context Window: ${escMd(neo.context_window ?? config.llm.context_window ?? 100)}\n`;
      if (neo.max_tokens !== undefined) {
        response += `\\- Max Tokens: ${escMd(neo.max_tokens)}\n`;
      }
    } else {
      response += `\\- Inherits Oracle config\n`;
    }
    response += '\n';

    response += `*Channels:*\n`;
    response += `\\- Telegram Enabled: ${escMd(config.channels.telegram.enabled)}\n`;
    response += `\\- Discord Enabled: ${escMd(config.channels.discord.enabled)}\n\n`;

    response += `*UI:*\n`;
    response += `\\- Enabled: ${escMd(config.ui.enabled)}\n`;
    response += `\\- Port: ${escMd(config.ui.port)}\n\n`;

    response += `*Audio:*\n`;
    response += `\\- Enabled: ${escMd(config.audio.enabled)}\n`;
    response += `\\- Max Duration: ${escMd(config.audio.maxDurationSeconds)}s\n`;

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }

  private async handleTrinityCommand(ctx: any, user: string) {
    try {
      const { DatabaseRegistry } = await import('../runtime/memory/trinity-db.js');
      const registry = DatabaseRegistry.getInstance();
      const databases = registry.listDatabases();

      if (databases.length === 0) {
        await ctx.reply('No databases registered in Trinity. Use the web UI to register databases.');
        return;
      }

      let html = `<b>Trinity Databases (${databases.length}):</b>\n\n`;
      const keyboard: any[][] = [];

      for (const db of databases) {
        const schema = db.schema_json ? JSON.parse(db.schema_json) : null;
        const tables: string[] = schema?.tables?.map((t: any) => t.name).filter(Boolean) ?? [];
        const updatedAt = db.schema_updated_at
          ? new Date(db.schema_updated_at).toLocaleDateString()
          : 'never';

        html += `🗄️ <b>${escapeHtml(db.name)}</b> (${escapeHtml(db.type)})\n`;
        if (db.host) html += `  Host: ${escapeHtml(db.host)}:${db.port}\n`;
        if (db.database_name && !db.host) html += `  File: ${escapeHtml(db.database_name)}\n`;
        if (tables.length > 0) {
          const tableList = tables.slice(0, 20).join(', ');
          const extra = tables.length > 20 ? ` (+${tables.length - 20} more)` : '';
          html += `  Tables: ${escapeHtml(tableList)}${escapeHtml(extra)}\n`;
        } else {
          html += `  Tables: (schema not loaded)\n`;
        }
        html += `  Schema updated: ${escapeHtml(updatedAt)}\n\n`;

        keyboard.push([
          { text: `🔌 Test ${db.name}`, callback_data: `test_trinity_db_${db.id}` },
          { text: `🔄 Schema`, callback_data: `refresh_trinity_db_schema_${db.id}` },
          { text: `🗑️ Delete`, callback_data: `ask_trinity_db_delete_${db.id}` },
        ]);
      }

      const chunks = splitHtmlChunks(html.trim());
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        await ctx.reply(chunks[i], {
          parse_mode: 'HTML',
          ...(isLast && keyboard.length > 0 ? { reply_markup: { inline_keyboard: keyboard } } : {}),
        });
      }
    } catch (e: any) {
      await ctx.reply(`Error listing Trinity databases: ${e.message}`);
    }
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
      const repository = SatiRepository.getInstance();
      const memories = repository.getAllMemories();

      if (memories.length === 0) {
        await ctx.reply('No memories found.');
        return;
      }

      const selectedMemories = limit !== null
        ? memories.slice(0, Math.min(limit, memories.length))
        : memories;

      const countLabel = limit !== null
        ? `${selectedMemories.length} SATI Memories (showing first ${selectedMemories.length})`
        : `${selectedMemories.length} SATI Memories`;

      let html = `<b>${escapeHtml(countLabel)}:</b>\n\n`;

      for (const memory of selectedMemories) {
        const summary = memory.summary.length > 200
          ? memory.summary.substring(0, 200) + '...'
          : memory.summary;
        html += `<b>${escapeHtml(memory.category)} (${escapeHtml(memory.importance)}):</b> ${escapeHtml(summary)}\n\n`;
      }

      const chunks = splitHtmlChunks(html.trim());
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'HTML' });
      }
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
          '*No MCP Servers Configured*\n\nThere are currently no MCP servers configured in the system\\.',
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      const probeMap = new Map(probeResults.map(r => [r.name, r]));

      let response = `*MCP Servers \\(${escMd(servers.length)}\\)*\n\n`;
      const keyboard: { text: string; callback_data: string }[][] = [];

      servers.forEach((server, index) => {
        const enabledStatus = server.enabled ? '✅ Enabled' : '❌ Disabled';
        const transport = server.config.transport.toUpperCase();
        const probe = probeMap.get(server.name);
        const connectionStatus = probe
          ? probe.ok
            ? `🟢 Connected \\(${escMd(probe.toolCount)} tools\\)`
            : `🔴 Failed`
          : '⚪ Unknown';

        response += `*${escMd(index + 1)}\\. ${escMd(server.name)}*\n`;
        response += `Status: ${enabledStatus}\n`;
        response += `Connection: ${connectionStatus}\n`;
        response += `Transport: ${escMd(transport)}\n`;

        if (server.config.transport === 'stdio') {
          response += `Command: \`${escMd(server.config.command)}\`\n`;
          if (server.config.args && server.config.args.length > 0) {
            response += `Args: \`${escMd(server.config.args.join(' '))}\`\n`;
          }
        } else if (server.config.transport === 'http') {
          response += `URL: \`${escMd(server.config.url)}\`\n`;
        }

        if (probe && !probe.ok && probe.error) {
          const shortError = probe.error.length > 80 ? probe.error.slice(0, 80) + '…' : probe.error;
          response += `Error: \`${escMd(shortError)}\`\n`;
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
        'An error occurred while retrieving the list of MCP servers\\. Please check the logs for more details\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }
  }
}
