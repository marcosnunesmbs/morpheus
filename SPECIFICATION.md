# Morpheus – Especificação Técnica Completa

## 1. Visão Geral

**Morpheus** é um agente de IA local-first para desenvolvedores, distribuído como um pacote npm global. Inspirado no personagem Morpheus da franquia *Matrix*, o projeto representa o papel de um **orquestrador e operador inteligente**, responsável por conectar desenvolvedores a sistemas complexos, LLMs, ferramentas locais e MCPs de forma fluida e consciente.

**Branding & Posicionamento**:

> *Morpheus is a local AI operator that bridges developers and machines.*

O projeto prioriza:

* Extensibilidade sem recompilação
* Configuração declarativa
* Controle local e transparência
* Boa DX para desenvolvedores

---

## 2. Objetivos do Projeto

* Fornecer um agente de IA utilizável no dia a dia do desenvolvedor
* Permitir integração simples com ferramentas locais e MCPs
* Oferecer customização profunda via arquivos e UI
* Ser extensível por comandos em Markdown e MCPs declarativos
* Funcionar totalmente em ambiente local

---

## 3. Stack Tecnológica

### Core

* Node.js >= 18
* TypeScript
* LangChain (JS)

### UI

* Vite + React
* TailwindCSS
* WebSocket para comunicação em tempo real

### Canais

* Telegram: `node-telegram-bot-api`
* Discord: `discord.js`

---

## 4. Arquitetura Geral

```
CLI (npm global)
   │
   ▼
Local Runtime (Node.js)
   ├── Config Manager
   ├── LangChain Orchestrator
   │     ├── LLM Manager
   │     ├── Memory Manager
   │     ├── Tool Registry
   │     ├── MCP Registry
   │     └── Command Engine
   ├── Channel Adapters
   │     ├── Telegram
   │     └── Discord
   └── Web Panel (localhost)
```

---

## 5. CLI – morpheus

### Instalação

```bash
npm install -g morpheus
```

### Comandos

* `morpheus start`
* `morpheus config`
* `morpheus status`
* `morpheus stop`
* `morpheus doctor`

### morpheus start

Inicia:

* Runtime local
* LangChain core
* Bots configurados
* Painel web (opcional)

Flags:

* `--ui`
* `--no-ui`
* `--port <number>`

---

## 6. Diretório Global `.morpheus`

Localização:

```bash
~/.morpheus/
```

### Estrutura

```
.morpheus/
├── config.yaml
├── mcps.json
├── commands/
│   ├── resumir.md
│   ├── revisar-codigo.md
│   └── explicar.md
├── memory/
├── logs/
└── cache/
```

---

## 7. Configuração Geral (`config.yaml`)

```yaml
agent:
  name: morpheus
  personality: helpful_dev

llm:
  provider: openai
  model: gpt-4.1
  temperature: 0.2
  api_key: env:OPENAI_API_KEY

channels:
  telegram:
    enabled: true
    token: env:TELEGRAM_BOT_TOKEN
  discord:
    enabled: false
    token: env:DISCORD_BOT_TOKEN

ui:
  enabled: true
  port: 3333
```

---

## 8. MCPs – `mcps.json`

### Objetivo

Permitir que o usuário registre MCPs adicionais ou sobrescreva MCPs padrão, de forma declarativa.

### Estrutura

```json
{
  "version": "1.0",
  "mcps": [
    {
      "name": "desktop-capture",
      "description": "Captura de tela e janelas locais",
      "transport": "http",
      "endpoint": "http://localhost:9000",
      "timeout": 5000,
      "enabled": true,
      "capabilities": ["list_windows", "focus_window", "screenshot"]
    }
  ]
}
```

### Comportamento

* MCPs padrões + MCPs do usuário
* Validação de schema
* Health check automático
* Registro como Tools no LangChain

---

## 9. Commands – `.morpheus/commands`

### Objetivo

Permitir criação de comandos customizados, reutilizáveis, sem código, utilizando Markdown.

---

## 10. Estrutura de um Command (`.md`)

### Exemplo: `resumir.md`

```md
---
name: Resumir Texto
command: /resumir
description: Resume um texto longo de forma clara e objetiva
model: gpt-4.1
temperature: 0.3
---

Você é um especialista em síntese de informações.

Resuma o texto abaixo mantendo os pontos principais e eliminando redundâncias.

Texto do usuário:
{{input}}
```

### Campos do Header

| Campo       | Obrigatório | Descrição          |
| ----------- | ----------- | ------------------ |
| name        | Sim         | Nome amigável      |
| command     | Sim         | Slash command      |
| description | Sim         | Exibido no help    |
| model       | Não         | Override de modelo |
| temperature | Não         | Override           |
| tools       | Não         | Tools permitidas   |

---

## 11. Command Engine (LangChain)

### Fluxo

1. Mensagem chega via canal
2. Parser identifica slash command
3. Localiza arquivo `.md`
4. Lê frontmatter
5. Cria `PromptTemplate`
6. Injeta `{{input}}`
7. Executa chain
8. Retorna resposta

### Variáveis Disponíveis

* `{{input}}`
* `{{user}}`
* `{{channel}}`
* `{{context}}`

---

## 12. Orquestração com LangChain

Responsabilidades:

* Seleção dinâmica de LLM
* Execução de chains
* Tool calling controlado
* Integração MCP
* Memória de curto e longo prazo

---

## 13. Channel Adapters

### Telegram

* Polling ou Webhook
* Markdown + code blocks
* Slash commands

### Discord

* Slash commands
* Threads
* Mensagens ricas

---

## 14. Painel Web (localhost)

### Funcionalidades

* Dashboard (status geral)
* Configurações (LLM, canais)
* MCPs (listar, habilitar)
* Commands (listar, testar)
* Logs e traces

---

## 15. Segurança

* Tokens via env vars
* Máscara de segredos na UI
* Sandboxing de tools locais
* Whitelist de paths
* Confirmação humana opcional para comandos perigosos

---

## 16. Extensibilidade

### Plugins (futuro)

* Registro de tools
* Registro de MCPs
* UI cards

---

## 17. Roadmap

### v0.1

* CLI
* LangChain core
* Commands MD
* Telegram

### v0.2

* Painel Web
* MCP manager
* Discord

### v0.3

* Plugins
* Memória longa
* Multi-agente

### v1.0

* Estável
* Documentação
* Templates
* Marketplace de plugins

---

## 18. Princípios do Projeto

* Local-first
* Declarativo > código
* Transparência
* Extensível por design
* Feito para devs, por devs
