```
  __  __                  _
 |  \/  | ___  _ __ _ __ | |__   ___ _   _ ___
 | |\/| |/ _ \| '__| '_ \| '_ \ / _ \ | | / __|
 | |  | | (_) | |  | |_) | | | |  __/ |_| \__ \
 |_|  |_|\___/|_|  | .__/|_| |_|\___|\__,_|___/
                   |_|
```

# Morpheus

> **Morpheus is a local AI operator that bridges developers and machines.**

Morpheus é um agente de IA **local-first** para desenvolvedores, executado via CLI, que se conecta a **LLMs**, **ferramentas locais** e **MCPs**, permitindo interação por **Terminal, Telegram e Discord**. Inspirado no personagem Morpheus de *Matrix*, o projeto atua como um **orquestrador inteligente**, abrindo a ponte entre o desenvolvedor e sistemas complexos.

---

## 🧠 Why Morpheus?

Na *Matrix*, Morpheus não é o mais forte, nem o mais rápido — ele é quem **entende o sistema**.

Ele conecta pessoas a realidades complexas, faz a ponte entre mundos e oferece contexto antes da ação. Ele não executa tudo por você — ele **te dá consciência e controle**.

O **Morpheus** nasce exatamente desse arquétipo.

No mundo moderno de desenvolvimento:

* LLMs são a Matrix
* Ferramentas, scripts e MCPs são sistemas internos
* O desenvolvedor precisa de **contexto, orquestração e clareza**

Morpheus é o operador local que fica entre você e as máquinas:

> 💊 *You don’t need another chatbot.*
> 💊 *You need someone who understands the system.*

Ele não substitui o desenvolvedor.
Ele **aumenta sua consciência sobre o sistema**.

---

## ✨ Principais Características

* 🧠 Orquestração com **LangChain (JS)**
* 🏠 **Local-first** (seus dados, suas chaves)
* 💬 Integração com **Telegram** e **Discord**
* 🧩 Extensível via **commands em Markdown**
* 🔌 Integração declarativa com **MCPs**
* 🖥️ Painel Web local (localhost)
* ⚙️ Configuração via **CLI + UI**

---

## 📦 Instalação

O Morpheus é distribuído como um pacote npm com escopo oficial.

```bash
npm install -g @morpheus-ai/cli
```

> Requisitos:
>
> * Node.js >= 18

---

## 🚀 Uso Rápido

### Iniciar o Morpheus

```bash
morpheus start
```

### Ver status

```bash
morpheus status
```

### Configurar

```bash
morpheus config
```

---

## 🗂️ Estrutura Local

Ao iniciar, o Morpheus cria o diretório:

```text
~/.morpheus/
├── config.yaml
├── mcps.json
├── commands/
│   ├── resumir.md
│   └── revisar-codigo.md
├── memory/
├── logs/
└── cache/
```

---

## 📄 Commands (Markdown-based)

Commands permitem criar **slash commands customizados** sem escrever código.

### Exemplo: `commands/resumir.md`

```md
---
name: Resumir Texto
command: /resumir
description: Resume um texto longo de forma clara e objetiva
model: gpt-4.1
temperature: 0.3
---

Você é um especialista em síntese de informações.

Resuma o texto abaixo mantendo os pontos principais.

Texto do usuário:
{{input}}
```

Uso no Telegram ou Discord:

```text
/resumir Texto longo aqui...
```

---

## 🔌 MCPs (Model Context Protocol)

O Morpheus suporta MCPs declarativos via `mcps.json`.

### Exemplo

```json
{
  "version": "1.0",
  "mcps": [
    {
      "name": "desktop-capture",
      "transport": "http",
      "endpoint": "http://localhost:9000",
      "enabled": true
    }
  ]
}
```

MCPs são carregados automaticamente e expostos como **tools no LangChain**.

---

## 💬 Canais Suportados

* ✅ Terminal (CLI)
* ✅ Telegram
* 🚧 Discord (em breve)

---

## 🖥️ Painel Web

Ao iniciar, o Morpheus disponibiliza um painel web local:

```
http://localhost:3333
```

Funcionalidades:

* Status do runtime
* Configuração de LLMs
* Gerenciamento de MCPs
* Visualização de commands
* Logs e traces

---

## 🔐 Segurança

* Tokens via variáveis de ambiente
* Segredos mascarados no painel
* Execução local de tools
* Controle explícito de permissões

---

## 🛣️ Roadmap

* [ ] CLI base
* [ ] Commands em Markdown
* [ ] Integração Telegram
* [ ] Painel Web
* [ ] Discord
* [ ] Sistema de plugins

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

* Issues
* Pull Requests
* Ideias de commands
* Novos MCPs

---

## 📜 Licença

MIT
