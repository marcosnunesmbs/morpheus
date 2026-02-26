import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  Attachment,
  DMChannel,
} from 'discord.js';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Oracle } from '../runtime/oracle.js';
import { SQLiteChatMessageHistory } from '../runtime/memory/sqlite.js';
import { DisplayManager } from '../runtime/display.js';
import { ConfigManager } from '../config/manager.js';
import { createTelephonist, ITelephonist } from '../runtime/telephonist.js';
import { getUsableApiKey } from '../runtime/trinity-crypto.js';

// ─── Slash Command Definitions ────────────────────────────────────────────────

const SLASH_COMMANDS = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check Morpheus agent status')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show token usage statistics')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('newsession')
    .setDescription('Archive current session and start a new one')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('chronos')
    .setDescription('Schedule a prompt for the Oracle')
    .addStringOption(opt =>
      opt.setName('prompt').setDescription('What should the Oracle do?').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('time').setDescription('When? e.g. "tomorrow at 9am", "in 30 minutes"').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('chronos_list')
    .setDescription('List all Chronos scheduled jobs')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('chronos_view')
    .setDescription('View a Chronos job and its last executions')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Job ID').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('chronos_disable')
    .setDescription('Disable a Chronos job')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Job ID').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('chronos_enable')
    .setDescription('Enable a Chronos job')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Job ID').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('chronos_delete')
    .setDescription('Delete a Chronos job')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Job ID').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('skills')
    .setDescription('List all available skills')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('skill_reload')
    .setDescription('Reload skills from filesystem')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('skill_enable')
    .setDescription('Enable a skill')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Skill name').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('skill_disable')
    .setDescription('Disable a skill')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Skill name').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('mcps')
    .setDescription('List MCP servers and their status')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('mcpreload')
    .setDescription('Reload MCP tools from servers')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('mcp_enable')
    .setDescription('Enable an MCP server')
    .addStringOption(opt =>
      opt.setName('name').setDescription('MCP server name').setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('mcp_disable')
    .setDescription('Disable an MCP server')
    .addStringOption(opt =>
      opt.setName('name').setDescription('MCP server name').setRequired(true)
    )
    .setDMPermission(true),
].map(cmd => cmd.toJSON());

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class DiscordAdapter {
  readonly channel = 'discord' as const;
  private client: Client | null = null;
  private oracle: Oracle;
  private allowedUsers: string[] = [];
  private rateLimitMap = new Map<string, number>();
  private display = DisplayManager.getInstance();
  private config = ConfigManager.getInstance();
  private history = new SQLiteChatMessageHistory({ sessionId: '' });

  private telephonist: ITelephonist | null = null;
  private telephonistProvider: string | null = null;
  private telephonistModel: string | null = null;

  private readonly RATE_LIMIT_MS = 3000;

  constructor(oracle: Oracle) {
    this.oracle = oracle;
  }

  public async connect(token: string, allowedUsers: string[]): Promise<void> {
    this.allowedUsers = allowedUsers;

    this.client = new Client({
      intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.client.once(Events.ClientReady, async (readyClient) => {
      this.display.log(
        chalk.green(`✓ Discord bot online: @${readyClient.user.tag}`),
        { source: 'Discord' }
      );
      this.display.log(
        `Allowed Users: ${allowedUsers.length > 0 ? allowedUsers.join(', ') : '(none)'}`,
        { source: 'Discord', level: 'info' }
      );

      // Register slash commands globally
      try {
        const rest = new REST().setToken(token);
        await rest.put(
          Routes.applicationCommands(readyClient.user.id),
          { body: SLASH_COMMANDS }
        );
        this.display.log('Discord slash commands registered.', { source: 'Discord', level: 'info' });
      } catch (err: any) {
        this.display.log(
          `Failed to register slash commands: ${err.message}`,
          { source: 'Discord', level: 'error' }
        );
      }
    });

    this.client.on(Events.ShardError, (error) => {
      this.display.log(`Discord WebSocket error: ${error.message}`, { source: 'Discord', level: 'error' });
    });

    // ─── Slash Command Interactions ──────────────────────────────────────────

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.inGuild()) return; // DM only

      const userId = interaction.user.id;
      if (!this.isAuthorized(userId)) return;

      await this.handleSlashCommand(interaction);
    });

    // ─── Direct Messages ─────────────────────────────────────────────────────

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      if (message.channel.type !== ChannelType.DM) return;

      const userId = message.author.id;

      if (!this.isAuthorized(userId)) {
        this.display.log(
          `Unauthorized access attempt by ${message.author.tag} (ID: ${userId})`,
          { source: 'Discord', level: 'warning' }
        );
        return;
      }

      if (this.isRateLimited(userId)) {
        try {
          await message.channel.send('Please wait a moment before sending another message.');
        } catch {
          // ignore
        }
        return;
      }

      // ── Audio attachment ──────────────────────────────────────────────────
      const audioAttachment = message.attachments.find(
        att => att.contentType?.startsWith('audio/')
      );
      if (audioAttachment) {
        await this.handleAudioMessage(message, userId, audioAttachment);
        return;
      }

      // ── Text message ──────────────────────────────────────────────────────
      const text = message.content;
      if (!text.trim()) return;

      this.display.log(`${message.author.tag}: ${text}`, { source: 'Discord' });

      try {
        const sessionId = await this.history.getCurrentSessionOrCreate();
        await this.oracle.setSessionId(sessionId);

        const response = await this.oracle.chat(text, undefined, false, {
          origin_channel: 'discord',
          session_id: sessionId,
          origin_message_id: message.id,
          origin_user_id: userId,
        });

        if (response) {
          const chunks = this.chunkText(response);
          for (const chunk of chunks) {
            await message.channel.send(chunk);
          }
          this.display.log(`Responded to ${message.author.tag}`, { source: 'Discord' });
        }
      } catch (error: any) {
        this.display.log(
          `Error processing message from ${message.author.tag}: ${error.message}`,
          { source: 'Discord', level: 'error' }
        );
        try {
          await message.channel.send(`Sorry, I encountered an error: ${error.message}`);
        } catch {
          // ignore
        }
      }
    });

    // login() validates the token and initiates the WS connection.
    // ClientReady fires asynchronously — we don't block on it.
    await this.client.login(token);
  }

  public async disconnect(): Promise<void> {
    if (!this.client) return;
    this.display.log('Disconnecting Discord...', { source: 'Discord', level: 'warning' });
    try {
      this.client.destroy();
    } catch {
      // ignore
    }
    this.client = null;
    this.display.log(chalk.gray('Discord disconnected.'), { source: 'Discord' });
  }

  public async sendMessage(text: string): Promise<void> {
    if (!this.client) {
      this.display.log('Cannot send message: Discord bot not connected.', { source: 'Discord', level: 'warning' });
      return;
    }

    if (this.allowedUsers.length === 0) {
      this.display.log('No allowed Discord users configured — skipping notification.', { source: 'Discord', level: 'warning' });
      return;
    }

    for (const userId of this.allowedUsers) {
      await this.sendMessageToUser(userId, text);
    }
  }

  public async sendMessageToUser(userId: string, text: string): Promise<void> {
    if (!this.client) return;
    try {
      const user = await this.client.users.fetch(userId);
      const chunks = this.chunkText(text);
      for (const chunk of chunks) {
        await user.send(chunk);
      }
    } catch (error: any) {
      this.display.log(
        `Failed to send message to Discord user ${userId}: ${error.message}`,
        { source: 'Discord', level: 'error' }
      );
    }
  }

  // ─── Audio Handler ────────────────────────────────────────────────────────

  private async handleAudioMessage(message: Message, userId: string, attachment: Attachment): Promise<void> {
    const channel = message.channel as DMChannel;
    const config = this.config.get();

    if (!config.audio.enabled) {
      await channel.send('Audio transcription is currently disabled.');
      return;
    }

    const apiKey = getUsableApiKey(config.audio.apiKey) ||
      (config.llm.provider === config.audio.provider ? getUsableApiKey(config.llm.api_key) : undefined);

    if (!apiKey) {
      this.display.log(
        `Audio transcription failed: No API key for provider '${config.audio.provider}'`,
        { source: 'Telephonist', level: 'error' }
      );
      await channel.send(
        `Audio transcription requires an API key for provider '${config.audio.provider}'.`
      );
      return;
    }

    // Reuse telephonist instance unless provider/model changed
    if (
      !this.telephonist ||
      this.telephonistProvider !== config.audio.provider ||
      this.telephonistModel !== config.audio.model
    ) {
      this.telephonist = createTelephonist(config.audio);
      this.telephonistProvider = config.audio.provider;
      this.telephonistModel = config.audio.model;
    }

    // Voice messages expose duration (in seconds); regular attachments don't
    const duration = (attachment as any).duration as number | null | undefined;
    if (duration && duration > config.audio.maxDurationSeconds) {
      await channel.send(`Audio too long. Max duration is ${config.audio.maxDurationSeconds}s.`);
      return;
    }

    const contentType = attachment.contentType ?? 'audio/ogg';
    this.display.log(
      `Receiving audio from ${message.author.tag} (${contentType})...`,
      { source: 'Telephonist' }
    );

    let processingMsg: Message | null = null;
    let filePath: string | null = null;

    try {
      processingMsg = await channel.send('🎧 Listening...');

      // Download audio to temp file
      filePath = await this.downloadAudioToTemp(attachment.url, contentType);

      // Transcribe
      this.display.log(`Transcribing audio for ${message.author.tag}...`, { source: 'Telephonist' });
      const { text, usage } = await this.telephonist.transcribe(filePath, contentType, apiKey);
      this.display.log(
        `Transcription for ${message.author.tag}: "${text}"`,
        { source: 'Telephonist', level: 'success' }
      );

      // Show transcription
      await channel.send(`🎤 "${text}"`);

      // Process with Oracle
      const sessionId = await this.history.getCurrentSessionOrCreate();
      await this.oracle.setSessionId(sessionId);

      const response = await this.oracle.chat(text, usage, true, {
        origin_channel: 'discord',
        session_id: sessionId,
        origin_message_id: message.id,
        origin_user_id: userId,
      });

      if (response) {
        const chunks = this.chunkText(response);
        for (const chunk of chunks) {
          await channel.send(chunk);
        }
        this.display.log(`Responded to ${message.author.tag} (via audio)`, { source: 'Discord' });
      }

      processingMsg?.delete().catch(() => {});
    } catch (error: any) {
      const detail = error?.cause?.message || error?.response?.data?.error?.message || error.message;
      this.display.log(
        `Audio processing error for ${message.author.tag}: ${detail}`,
        { source: 'Telephonist', level: 'error' }
      );
      try {
        await channel.send('Sorry, I failed to process your audio message.');
      } catch {
        // ignore
      }
    } finally {
      if (filePath && await fs.pathExists(filePath)) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  }

  private async downloadAudioToTemp(url: string, contentType: string): Promise<string> {
    const ext =
      contentType === 'audio/ogg'  ? '.ogg'  :
      contentType === 'audio/mpeg' ? '.mp3'  :
      contentType === 'audio/mp4'  ? '.m4a'  :
      contentType === 'audio/wav'  ? '.wav'  :
      contentType === 'audio/webm' ? '.webm' : '.audio';

    const filePath = path.join(os.tmpdir(), `morpheus-discord-${Date.now()}${ext}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  // ─── Slash Command Handlers ───────────────────────────────────────────────

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { commandName } = interaction;
    switch (commandName) {
      case 'help':            await this.cmdHelp(interaction);            break;
      case 'status':          await this.cmdStatus(interaction);          break;
      case 'stats':           await this.cmdStats(interaction);           break;
      case 'newsession':      await this.cmdNewSession(interaction);      break;
      case 'chronos':         await this.cmdChronos(interaction);         break;
      case 'chronos_list':    await this.cmdChronosList(interaction);     break;
      case 'chronos_view':    await this.cmdChronosView(interaction);     break;
      case 'chronos_disable': await this.cmdChronosDisable(interaction);  break;
      case 'chronos_enable':  await this.cmdChronosEnable(interaction);   break;
      case 'chronos_delete':  await this.cmdChronosDelete(interaction);   break;
      case 'skills':          await this.cmdSkills(interaction);           break;
      case 'skill_reload':    await this.cmdSkillReload(interaction);      break;
      case 'skill_enable':    await this.cmdSkillEnable(interaction);      break;
      case 'skill_disable':   await this.cmdSkillDisable(interaction);     break;
      case 'mcps':            await this.cmdMcps(interaction);              break;
      case 'mcpreload':       await this.cmdMcpReload(interaction);         break;
      case 'mcp_enable':      await this.cmdMcpEnable(interaction);         break;
      case 'mcp_disable':     await this.cmdMcpDisable(interaction);        break;
    }
  }

  private async cmdHelp(interaction: ChatInputCommandInteraction): Promise<void> {
    const content = [
      '**Available Commands**',
      '',
      '`/help` — Show this message',
      '`/status` — Check Morpheus status',
      '`/stats` — Token usage statistics',
      '`/newsession` — Start a new session',
      '',
      '**Chronos (Scheduler)**',
      '`/chronos prompt: time:` — Schedule a job for the Oracle',
      '`/chronos_list` — List all scheduled jobs',
      '`/chronos_view id:` — View a job and its executions',
      '`/chronos_disable id:` — Disable a job',
      '`/chronos_enable id:` — Enable a job',
      '`/chronos_delete id:` — Delete a job',
      '',
      '**Skills**',
      '`/skills` — List all available skills',
      '`/skill_reload` — Reload skills from filesystem',
      '`/skill_enable name:` — Enable a skill',
      '`/skill_disable name:` — Disable a skill',
      '',
      '**MCP Servers**',
      '`/mcps` — List MCP servers and status',
      '`/mcpreload` — Reload MCP tools from servers',
      '`/mcp_enable name:` — Enable an MCP server',
      '`/mcp_disable name:` — Disable an MCP server',
      '',
      'You can also send text or voice messages to chat with the Oracle.'
    ].join('\n');
    await interaction.reply({ content });
  }

  private async cmdStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ content: '✅ Morpheus is running.' });
  }

  private async cmdStats(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    try {
      const history = new SQLiteChatMessageHistory({ sessionId: 'default' });
      const [stats, groupedStats] = await Promise.all([
        history.getGlobalUsageStats(),
        history.getUsageStatsByProviderAndModel(),
      ]);
      history.close();

      const totalTokens = stats.totalInputTokens + stats.totalOutputTokens;
      const totalAudioSeconds = groupedStats.reduce((sum, s) => sum + (s.totalAudioSeconds || 0), 0);

      let content = '**Token Usage Statistics**\n\n';
      content += `Input: ${stats.totalInputTokens.toLocaleString()} tokens\n`;
      content += `Output: ${stats.totalOutputTokens.toLocaleString()} tokens\n`;
      content += `Total: ${totalTokens.toLocaleString()} tokens\n`;
      if (totalAudioSeconds > 0) content += `Audio: ${totalAudioSeconds.toFixed(1)}s\n`;
      if (stats.totalEstimatedCostUsd != null) {
        content += `Estimated Cost: $${stats.totalEstimatedCostUsd.toFixed(4)}\n`;
      }

      if (groupedStats.length > 0) {
        content += '\n**By Provider/Model:**\n';
        for (const s of groupedStats.slice(0, 5)) {
          content += `\n**${s.provider}/${s.model}**\n`;
          content += `  ${s.totalTokens.toLocaleString()} tokens (${s.messageCount} msgs)`;
          if (s.estimatedCostUsd != null) content += ` — $${s.estimatedCostUsd.toFixed(4)}`;
          content += '\n';
        }
      }

      await interaction.editReply({ content: content.slice(0, 2000) });
    } catch (err: any) {
      await interaction.editReply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdNewSession(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const history = new SQLiteChatMessageHistory({ sessionId: '' });
      await history.createNewSession();
      history.close();
      await interaction.reply({ content: '✅ New session started.' });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdChronos(interaction: ChatInputCommandInteraction): Promise<void> {
    const prompt = interaction.options.getString('prompt', true);
    const timeExpr = interaction.options.getString('time', true);
    await interaction.deferReply();
    try {
      const { parseScheduleExpression } = await import('../runtime/chronos/parser.js');
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const globalTz = this.config.getChronosConfig().timezone;
      const schedule = parseScheduleExpression(timeExpr, 'once', { timezone: globalTz });

      const formatted = new Date(schedule.next_run_at).toLocaleString('en-US', {
        timeZone: globalTz, year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });

      const repo = ChronosRepository.getInstance();
      const job = repo.createJob({
        prompt,
        schedule_type: 'once',
        schedule_expression: timeExpr,
        cron_normalized: schedule.cron_normalized,
        timezone: globalTz,
        next_run_at: schedule.next_run_at,
        created_by: 'discord',
      });

      await interaction.editReply({
        content: `✅ Job created (\`${job.id.slice(0, 8)}\`)\n**${prompt}**\n${schedule.human_readable} — ${formatted}`,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdChronosList(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const jobs = repo.listJobs();

      if (!jobs.length) {
        await interaction.reply({ content: 'No Chronos jobs found.' });
        return;
      }

      const lines = jobs.map((j, i) => {
        const status = j.enabled ? '🟢' : '🔴';
        const next = j.enabled && j.next_run_at
          ? new Date(j.next_run_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : j.enabled ? 'N/A' : 'disabled';
        const shortPrompt = j.prompt.length > 40 ? j.prompt.slice(0, 40) + '…' : j.prompt;
        return `${status} ${i + 1}. \`${j.id.slice(0, 8)}\` — ${shortPrompt} — *${next}*`;
      });

      await interaction.reply({ content: `**Chronos Jobs**\n\n${lines.join('\n')}`.slice(0, 2000) });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdChronosView(interaction: ChatInputCommandInteraction): Promise<void> {
    const id = interaction.options.getString('id', true);
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const job = repo.getJob(id);
      if (!job) { await interaction.reply({ content: 'Job not found.' }); return; }

      const executions = repo.listExecutions(id, 3);
      const next = job.next_run_at ? new Date(job.next_run_at).toLocaleString() : 'N/A';
      const last = job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never';
      const execLines = executions.map(e =>
        `• ${e.status.toUpperCase()} — ${new Date(e.triggered_at).toLocaleString()}`
      ).join('\n') || 'None yet';

      const content =
        `**Chronos Job** \`${id.slice(0, 8)}\`\n\n` +
        `**Prompt:** ${job.prompt}\n` +
        `**Schedule:** ${job.schedule_type} — \`${job.schedule_expression}\`\n` +
        `**Timezone:** ${job.timezone}\n` +
        `**Status:** ${job.enabled ? 'Enabled' : 'Disabled'}\n` +
        `**Next Run:** ${next}\n` +
        `**Last Run:** ${last}\n\n` +
        `**Last 3 Executions:**\n${execLines}`;

      await interaction.reply({ content: content.slice(0, 2000) });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdChronosDisable(interaction: ChatInputCommandInteraction): Promise<void> {
    const id = interaction.options.getString('id', true);
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const job = repo.disableJob(id);
      if (!job) { await interaction.reply({ content: 'Job not found.' }); return; }
      await interaction.reply({ content: `Job \`${id.slice(0, 8)}\` disabled.` });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdChronosEnable(interaction: ChatInputCommandInteraction): Promise<void> {
    const id = interaction.options.getString('id', true);
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const { parseNextRun } = await import('../runtime/chronos/parser.js');
      const repo = ChronosRepository.getInstance();
      const existing = repo.getJob(id);
      if (!existing) { await interaction.reply({ content: 'Job not found.' }); return; }

      let nextRunAt: number | undefined;
      if (existing.cron_normalized) {
        nextRunAt = parseNextRun(existing.cron_normalized, existing.timezone);
      }
      repo.updateJob(id, { enabled: true, next_run_at: nextRunAt });
      const job = repo.getJob(id)!;
      const next = job.next_run_at ? new Date(job.next_run_at).toLocaleString() : 'N/A';
      await interaction.reply({ content: `Job \`${id.slice(0, 8)}\` enabled. Next run: ${next}` });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdChronosDelete(interaction: ChatInputCommandInteraction): Promise<void> {
    const id = interaction.options.getString('id', true);
    try {
      const { ChronosRepository } = await import('../runtime/chronos/repository.js');
      const repo = ChronosRepository.getInstance();
      const deleted = repo.deleteJob(id);
      if (!deleted) { await interaction.reply({ content: 'Job not found.' }); return; }
      await interaction.reply({ content: `Job \`${id.slice(0, 8)}\` deleted.` });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  // ─── Skills Commands ─────────────────────────────────────────────────────

  private async cmdSkills(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const { SkillRegistry } = await import('../runtime/skills/index.js');
      const registry = SkillRegistry.getInstance();
      const skills = registry.getAll();

      if (!skills.length) {
        await interaction.reply({ content: 'No skills found. Add skills to `~/.morpheus/skills/`' });
        return;
      }

      const lines = skills.map(s => {
        const status = s.enabled ? '🟢' : '🔴';
        const tags = s.tags?.length ? ` [${s.tags.join(', ')}]` : '';
        return `${status} **${s.name}**${tags}\n    _${s.description.slice(0, 50)}${s.description.length > 50 ? '…' : ''}_`;
      });

      const enabled = skills.filter(s => s.enabled).length;
      await interaction.reply({
        content: `**Skills** (${enabled}/${skills.length} enabled)\n\n${lines.join('\n')}`
      });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdSkillReload(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const { SkillRegistry, updateSkillDelegateDescription } = await import('../runtime/skills/index.js');
      const registry = SkillRegistry.getInstance();
      const result = await registry.reload();
      updateSkillDelegateDescription();

      const msg = result.errors.length > 0
        ? `Reloaded ${result.skills.length} skills with ${result.errors.length} error(s).`
        : `Reloaded ${result.skills.length} skill(s).`;

      await interaction.reply({ content: msg });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdSkillEnable(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString('name', true);
    try {
      const { SkillRegistry, updateSkillDelegateDescription } = await import('../runtime/skills/index.js');
      const registry = SkillRegistry.getInstance();
      const success = registry.enable(name);

      if (!success) {
        await interaction.reply({ content: `Skill "${name}" not found.` });
        return;
      }

      updateSkillDelegateDescription();
      await interaction.reply({ content: `Skill \`${name}\` enabled.` });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdSkillDisable(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString('name', true);
    try {
      const { SkillRegistry, updateSkillDelegateDescription } = await import('../runtime/skills/index.js');
      const registry = SkillRegistry.getInstance();
      const success = registry.disable(name);

      if (!success) {
        await interaction.reply({ content: `Skill "${name}" not found.` });
        return;
      }

      updateSkillDelegateDescription();
      await interaction.reply({ content: `Skill \`${name}\` disabled.` });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  // ─── MCP Commands ─────────────────────────────────────────────────────────

  private async cmdMcps(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const { MCPManager } = await import('../config/mcp-manager.js');
      const { Construtor } = await import('../runtime/tools/factory.js');

      const [servers, stats] = await Promise.all([
        MCPManager.listServers(),
        Promise.resolve(Construtor.getStats()),
      ]);

      if (!servers.length) {
        await interaction.reply({ content: 'No MCP servers configured.' });
        return;
      }

      const statsMap = new Map(stats.servers.map(s => [s.name, s]));

      const lines = servers.map(s => {
        const status = s.enabled ? '🟢' : '🔴';
        const serverStats = statsMap.get(s.name);
        const toolCount = serverStats?.ok ? `(${serverStats.toolCount} tools)` : 
                          serverStats?.error ? '(failed)' : '(not loaded)';
        const transport = s.config.transport.toUpperCase();
        return `${status} **${s.name}** ${toolCount}\n    _${transport}_`;
      });

      const enabled = servers.filter(s => s.enabled).length;
      const totalTools = stats.totalTools;
      await interaction.reply({
        content: `**MCP Servers** (${enabled}/${servers.length} enabled, ${totalTools} tools cached)\n\n${lines.join('\n')}`
      });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdMcpReload(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    try {
      await this.oracle.reloadTools();
      const { Construtor } = await import('../runtime/tools/factory.js');
      const stats = Construtor.getStats();
      
      await interaction.editReply({
        content: `✅ MCP tools reloaded: ${stats.totalTools} tools from ${stats.servers.length} servers.`
      });
      this.display.log(`MCP reload triggered by Discord user`, { source: 'Discord', level: 'info' });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to reload MCP tools: ${err.message}` });
      this.display.log(`MCP reload failed: ${err.message}`, { source: 'Discord', level: 'error' });
    }
  }

  private async cmdMcpEnable(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString('name', true);
    try {
      const { MCPManager } = await import('../config/mcp-manager.js');
      await MCPManager.setServerEnabled(name, true);
      await interaction.reply({ 
        content: `MCP server \`${name}\` enabled. Use \`/mcpreload\` to apply changes.` 
      });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  private async cmdMcpDisable(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString('name', true);
    try {
      const { MCPManager } = await import('../config/mcp-manager.js');
      await MCPManager.setServerEnabled(name, false);
      await interaction.reply({ 
        content: `MCP server \`${name}\` disabled. Use \`/mcpreload\` to apply changes.` 
      });
    } catch (err: any) {
      await interaction.reply({ content: `Error: ${err.message}` });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private isAuthorized(userId: string): boolean {
    return this.allowedUsers.includes(userId);
  }

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const last = this.rateLimitMap.get(userId);
    if (last !== undefined && now - last < this.RATE_LIMIT_MS) return true;
    this.rateLimitMap.set(userId, now);
    return false;
  }

  private chunkText(text: string, limit = 2000): string[] {
    if (text.length <= limit) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > limit) {
      let splitAt = remaining.lastIndexOf('\n', limit - 1);
      if (splitAt < limit / 4) splitAt = remaining.lastIndexOf(' ', limit - 1);
      if (splitAt <= 0) splitAt = limit;
      chunks.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }
    if (remaining) chunks.push(remaining);
    return chunks.filter(Boolean);
  }
}
