# Comando Telegram /mcp e /mcps

**Branch:** `telegram-mcp-commands`
**Description:** Adiciona os comandos /mcp e /mcps ao bot do Telegram para listar os servidores MCP registrados

## Goal
Implementar dois novos comandos no bot do Telegram (/mcp e /mcps) que permitem aos usuários visualizar a lista de servidores MCP (Model Context Protocol) atualmente configurados e registrados no sistema.

## Implementation Steps

### Step 1: Adicionar casos para os comandos /mcp e /mcps no manipulador de comandos do Telegram
**Files:** src/channels/telegram.ts
**What:** Adicionar novos casos no switch statement do método handleSystemCommand para os comandos /mcp e /mcps, e criar métodos de tratamento correspondentes que chamam a funcionalidade de listagem de servidores MCP.
**Testing:** Verificar se os novos comandos aparecem na lista de ajuda e respondem corretamente quando utilizados no Telegram.

### Step 2: Implementar métodos de tratamento para exibir a lista de servidores MCP
**Files:** src/channels/telegram.ts
**What:** Criar os métodos handleMcpCommand e handleMcpsCommand que utilizam o MCPManager para obter a lista de servidores e formatar a resposta para o Telegram com informações sobre cada servidor MCP registrado.
**Testing:** Enviar os comandos /mcp e /mcps no Telegram e verificar se a lista de servidores MCP é exibida corretamente com nome, status e tipo de transporte.

### Step 3: Atualizar a mensagem de ajuda para incluir os novos comandos
**Files:** src/channels/telegram.ts
**What:** Adicionar menção aos comandos /mcp e /mcps na mensagem de ajuda exibida pelo comando /help para que os usuários saibam da existência desses comandos.
**Testing:** Verificar se os novos comandos aparecem na lista de comandos disponíveis quando o usuário executa /help no Telegram.