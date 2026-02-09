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
import { Telephonist } from '../runtime/telephonist.js';
import { readPid, isProcessRunning, checkStalePid } from '../runtime/lifecycle.js';
import { SQLiteChatMessageHistory } from '../runtime/memory/sqlite.js';
import { SatiRepository } from '../runtime/memory/sati/repository.js';
import { MCPManager } from '../config/mcp-manager.js';

export class TelegramAdapter {
  private bot: Telegraf | null = null;
  private isConnected = false;
  private display = DisplayManager.getInstance();
  private config = ConfigManager.getInstance();
  private oracle: Oracle;
  private telephonist = new Telephonist();
  private history = new SQLiteChatMessageHistory({ sessionId: '' });

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

        // Handle system commands
        if (text.startsWith('/')) {
          await this.handleSystemCommand(ctx, text, user);
          return;
        }

        try {
          // Send "typing" status
          await ctx.sendChatAction('typing');

          // Process with Agent
          const response = await this.oracle.chat(text);

          if (response) {
            await ctx.reply(response, { parse_mode: 'Markdown' });
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
          this.display.log(`Audio transcription failed: No Gemini API key available`, { source: 'Telephonist', level: 'error' });
          await ctx.reply("Audio transcription requires a Gemini API key. Please configure `audio.apiKey` or set LLM provider to Gemini.");
          return;
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
          await ctx.reply(`🎤 *Transcription*: _"${text}"_`, { parse_mode: 'Markdown' });
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
            await ctx.reply(response);
            this.display.log(`Responded to @${user} (via audio)`, { source: 'Telegram' });
          }

        } catch (error: any) {
          this.display.log(`Audio processing error for @${user}: ${error.message}`, { source: 'Telephonist', level: 'error' });
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
          const history = new SQLiteChatMessageHistory({sessionId: ""});
          // Alternar para a nova sessão
          await history.switchSession(sessionId);
          await ctx.answerCbQuery();

          // Remover a mensagem anterior e enviar confirmação
          if (ctx.updateType === 'callback_query') {
            ctx.deleteMessage().catch(() => { });
          }

          ctx.reply(`✅ Switched to session ID: ${sessionId}`);
        } catch (error: any) {
          await ctx.answerCbQuery(`Error switching session: ${error.message}`);
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
        parse_mode: 'Markdown', reply_markup: {
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
      const history = new SQLiteChatMessageHistory({sessionId: ""});
      await history.createNewSession();
    } catch (e: any) {
      await ctx.reply(`Error creating new session: ${e.message}`);
    }
  }


  private async handleSessionStatusCommand(ctx: any, user: string) {
    try {
      // Obter todas as sessões ativas e pausadas usando a nova função
      const history = new SQLiteChatMessageHistory({sessionId: ""});
      const sessions = await history.listSessions();

      if (sessions.length === 0) {
        await ctx.reply('No active or paused sessions found.', { parse_mode: 'Markdown' });
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
        if (session.status !== 'active') {
          keyboard.push([{
            text: `Switch to: ${title}`,
            callback_data: `switch_session_${session.id}`
          }]);
        }
      }

      await ctx.reply(response, {
        parse_mode: 'Markdown',
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
    // Implementação simplificada do diagnóstico
    const config = this.config.get();
    let response = '*Morpheus Doctor*\n\n';

    // Verificar versão do Node.js
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
    if (majorVersion >= 18) {
      response += '✅ Node.js Version: ' + nodeVersion + ' (Satisfied)\n';
    } else {
      response += '❌ Node.js Version: ' + nodeVersion + ' (Required: >=18)\n';
    }

    // Verificar configuração
    if (config) {
      response += '✅ Configuration: Valid\n';

      // Verificar se há chave de API disponível para o provedor ativo
      const llmProvider = config.llm?.provider;
      if (llmProvider && llmProvider !== 'ollama') {
        const hasLlmApiKey = config.llm?.api_key ||
          (llmProvider === 'openai' && process.env.OPENAI_API_KEY) ||
          (llmProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
          (llmProvider === 'gemini' && process.env.GOOGLE_API_KEY) ||
          (llmProvider === 'openrouter' && process.env.OPENROUTER_API_KEY);

        if (hasLlmApiKey) {
          response += `✅ LLM API key available for ${llmProvider}\n`;
        } else {
          response += `❌ LLM API key missing for ${llmProvider}. Either set in config or define environment variable.\n`;
        }
      }

      // Verificar token do Telegram se ativado
      if (config.channels?.telegram?.enabled) {
        const hasTelegramToken = config.channels.telegram?.token || process.env.TELEGRAM_BOT_TOKEN;
        if (hasTelegramToken) {
          response += '✅ Telegram bot token available\n';
        } else {
          response += '❌ Telegram bot token missing. Either set in config or define TELEGRAM_BOT_TOKEN environment variable.\n';
        }
      }
    } else {
      response += '⚠️ Configuration: Missing\n';
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });
  }

  private async handleStatsCommand(ctx: any, user: string) {
    try {
      // Criar instância temporária do histórico para obter estatísticas
      const history = new SQLiteChatMessageHistory({
        sessionId: "default",
        databasePath: undefined, // Usará o caminho padrão
        limit: 100, // Limite arbitrário para esta operação
      });

      const stats = await history.getGlobalUsageStats();
      const groupedStats = await history.getUsageStatsByProviderAndModel();

      let response = '*Token Usage Statistics*\n\n';
      response += `Total Input Tokens: ${stats.totalInputTokens}\n`;
      response += `Total Output Tokens: ${stats.totalOutputTokens}\n`;
      response += `Total Tokens: ${stats.totalInputTokens + stats.totalOutputTokens}\n\n`;

      if (groupedStats.length > 0) {
        response += '*Breakdown by Provider and Model:*\n';
        for (const stat of groupedStats) {
          response += `- ${stat.provider}/${stat.model}:\n ${stat.totalTokens} tokens\n(${stat.messageCount} messages)\n\n`;
        }
      } else {
        response += 'No detailed usage statistics available.';
      }

      await ctx.reply(response, { parse_mode: 'Markdown' });

      // Fechar conexão com o banco de dados
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
      await ctx.reply(response, { parse_mode: 'Markdown' });
    }
    // await ctx.reply(`Command not recognized. Type /help to see available commands.`);
  }

  private async handleHelpCommand(ctx: any, user: string) {
    const helpMessage = `
*Available Commands:*

${this.HELP_MESSAGE}

How can I assist you today?`;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  private async handleZaionCommand(ctx: any, user: string) {
    const config = this.config.get();

    let response = '*System Configuration*\n\n';
    response += `*Agent:*\n`;
    response += `- Name: ${config.agent.name}\n`;
    response += `- Personality: ${config.agent.personality}\n\n`;

    response += `*LLM:*\n`;
    response += `- Provider: ${config.llm.provider}\n`;
    response += `- Model: ${config.llm.model}\n`;
    response += `- Temperature: ${config.llm.temperature}\n`;
    response += `- Context Window: ${config.llm.context_window || 100}\n\n`;

    response += `*Channels:*\n`;
    response += `- Telegram Enabled: ${config.channels.telegram.enabled}\n`;
    response += `- Discord Enabled: ${config.channels.discord.enabled}\n\n`;

    response += `*UI:*\n`;
    response += `- Enabled: ${config.ui.enabled}\n`;
    response += `- Port: ${config.ui.port}\n\n`;

    response += `*Audio:*\n`;
    response += `- Enabled: ${config.audio.enabled}\n`;
    response += `- Max Duration: ${config.audio.maxDurationSeconds}s\n`;

    await ctx.reply(response, { parse_mode: 'Markdown' });
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

      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await ctx.reply(`Failed to retrieve memories: ${error.message}`);
    }
  }

  private async handleRestartCommand(ctx: any, user: string) {
    // Store the user ID who requested the restart
    const userId = ctx.from.id;

    // Save the user ID to a temporary file so the restarted process can notify them
    const restartNotificationFile = path.join(os.tmpdir(), 'morpheus_restart_notification.json');
    try {
      await fs.writeJson(restartNotificationFile, { userId: userId, username: user }, { encoding: 'utf8' });
    } catch (error: any) {
      this.display.log(`Failed to save restart notification info: ${error.message}`, { source: 'Telegram', level: 'error' });
    }

    // Respond to the user first
    await ctx.reply('🔄 Restart initiated. The Morpheus agent will restart shortly.');

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
    }, 500); // Shorter delay to minimize chance of processing more messages
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

  private async handleMcpListCommand(ctx: any, user: string) {
    try {
      const servers = await MCPManager.listServers();

      if (servers.length === 0) {
        await ctx.reply(
          '*No MCP Servers Configured*\n\nThere are currently no MCP servers configured in the system.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      let response = `*MCP Servers (${servers.length})*\n\n`;

      servers.forEach((server, index) => {
        const status = server.enabled ? '✅ Enabled' : '❌ Disabled';
        const transport = server.config.transport.toUpperCase();

        response += `*${index + 1}. ${server.name}*\n`;
        response += `Status: ${status}\n`;
        response += `Transport: ${transport}\n`;

        if (server.config.transport === 'stdio') {
          response += `Command: \`${server.config.command}\`\n`;
          if (server.config.args && server.config.args.length > 0) {
            response += `Args: \`${server.config.args.join(' ')}\`\n`;
          }
        } else if (server.config.transport === 'http') {
          response += `URL: \`${server.config.url}\`\n`;
        }

        response += '\n';
      });

      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error) {
      this.display.log('Error listing MCP servers: ' + (error instanceof Error ? error.message : String(error)), { source: 'Telegram', level: 'error' });
      await ctx.reply(
        'An error occurred while retrieving the list of MCP servers. Please check the logs for more details.',
        { parse_mode: 'Markdown' }
      );
    }
  }
}
