# Comando Telegram /mcp e /mcps

## Goal
Adicionar os comandos `/mcp` e `/mcps` ao bot do Telegram para listar os servidores MCP (Model Context Protocol) atualmente configurados e registrados no sistema.

## Prerequisites
Make sure that the user is currently on the `telegram-mcp-commands` branch before beginning implementation.
If not, move them to the correct branch. If the branch does not exist, create it from main.

### Step-by-Step Instructions

#### Step 1: Adicionar casos para os comandos /mcp e /mcps no manipulador de comandos do Telegram
- [ ] Localize o método `handleSystemCommand` em `src/channels/telegram.ts`
- [ ] Adicione novos casos no switch statement para os comandos `/mcp` e `/mcps`
- [ ] Copie e cole o código abaixo em `src/channels/telegram.ts`, dentro do switch statement no método `handleSystemCommand`:

```ts
case '/mcp':
case '/mcps':
  await this.handleMcpListCommand(ctx, user);
  break;
```

- [ ] Certifique-se de que o caso seja adicionado antes do `default` no switch statement

##### Step 1 Verification Checklist
- [ ] Não há erros de build
- [ ] O código compila corretamente

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 2: Implementar métodos de tratamento para exibir a lista de servidores MCP
- [ ] Adicione o método `handleMcpListCommand` à classe `TelegramAdapter` em `src/channels/telegram.ts`
- [ ] Copie e cole o código abaixo em `src/channels/telegram.ts`, após os outros métodos de tratamento de comando:

```ts
private async handleMcpListCommand(ctx: any, user: string) {
  try {
    const mcpManager = new MCPManager();
    const servers = mcpManager.listServers();

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
    this.display.error('Error listing MCP servers:', error);
    await ctx.reply(
      'An error occurred while retrieving the list of MCP servers. Please check the logs for more details.',
      { parse_mode: 'Markdown' }
    );
  }
}
```

##### Step 2 Verification Checklist
- [ ] Não há erros de build
- [ ] O método `handleMcpListCommand` está implementado corretamente e utiliza o `MCPManager` para obter a lista de servidores

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 3: Atualizar a mensagem de ajuda para incluir os novos comandos
- [ ] Localize o método `handleHelpCommand` em `src/channels/telegram.ts`
- [ ] Atualize a mensagem de ajuda para incluir os comandos `/mcp` e `/mcps`
- [ ] Copie e cole o código abaixo em `src/channels/telegram.ts`, substituindo a mensagem de ajuda existente no método `handleHelpCommand`:

```ts
private async handleHelpCommand(ctx: any, user: string) {
  const helpMessage = `
*Available Commands:*

/start - Show welcome message and available commands
/status - Check the status of the Morpheus agent
/doctor - Diagnose environment and configuration issues
/stats - Show token usage statistics
/help - Show this help message
/zaion - Show system configurations
/sati <qnt> - Show specific memories
/restart - Restart the Morpheus agent
/mcp or /mcps - List registered MCP servers

For more information visit: https://github.com/sysbot/morpheus
  `;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}
```

##### Step 3 Verification Checklist
- [ ] Não há erros de build
- [ ] A mensagem de ajuda agora inclui os comandos `/mcp` e `/mcps`

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.