# Morpheus - Local-First AI Operator for Developers

Morpheus is a sophisticated, local-first AI operator/agent designed for developers who demand control, privacy, and extensibility. It acts as an intelligent orchestrator, connecting Large Language Models (LLMs) with your local environment, external communication channels, and developer tools.

## 🚀 What is Morpheus?

Morpheus bridges the gap between developers and complex AI systems by providing:
- **Local-First Architecture**: All data, configuration, and conversation history reside on your machine
- **Multi-Channel Support**: Interact via CLI, Web Dashboard, Telegram, and Discord
- **LLM Provider Agnostic**: Supports OpenAI, Anthropic, Ollama, Google Gemini, and OpenRouter
- **Persistent Memory**: SQLite-backed conversation history across sessions
- **MCP Integration**: Full support for Model Context Protocol for external tools
- **Audio Transcription**: Voice message support via Google Gemini
- **Web Dashboard**: Matrix-themed React UI for management and monitoring

## 🐳 Quick Start with Docker

### Basic Usage
```bash
docker run -d \
  --name morpheus-agent \
  -p 3333:3333 \
  -v morpheus-data:/root/.morpheus \
  -e MORPHEUS_LLM_PROVIDER=openai \
  -e OPENAI_API_KEY=your-api-key-here \
  -e THE_ARCHITECT_PASS=your-password \
  morpheus/morpheus-agent:latest
```

### With Docker Compose
Create a `docker-compose.yml` file:
```yaml
version: '3.8'

services:
  morpheus:
    image: morpheus/morpheus-agent:latest
    container_name: morpheus-agent
    ports:
      - "3333:3333"
    volumes:
      - morpheus_data:/root/.morpheus
    environment:
      # LLM Configuration
      - MORPHEUS_LLM_PROVIDER=openai
      - MORPHEUS_LLM_MODEL=gpt-4o
      - MORPHEUS_LLM_TEMPERATURE=0.7
      
      # API Keys
      - OPENAI_API_KEY=your-openai-api-key
      - ANTHROPIC_API_KEY=your-anthropic-api-key
      - GOOGLE_API_KEY=your-google-api-key
      - OPENROUTER_API_KEY=your-openrouter-api-key
      
      # Security
      - THE_ARCHITECT_PASS=your-secure-password
      
      # Agent Configuration
      - MORPHEUS_AGENT_NAME=morpheus
      - MORPHEUS_AGENT_PERSONALITY=helpful_dev
      
      # UI Configuration
      - MORPHEUS_UI_ENABLED=true
      - MORPHEUS_UI_PORT=3333
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## 🔐 Environment Variables

### LLM Configuration
- `MORPHEUS_LLM_PROVIDER`: LLM provider (openai, anthropic, openrouter, ollama, gemini)
- `MORPHEUS_LLM_MODEL`: Model name (e.g., gpt-4o, claude-3-5-sonnet-20240620)
- `MORPHEUS_LLM_TEMPERATURE`: Temperature setting (0.0 - 1.0)
- `MORPHEUS_LLM_MAX_TOKENS`: Maximum tokens for responses

### Provider-Specific API Keys (High Priority)
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key
- `GOOGLE_API_KEY`: Google AI key (for Gemini and Audio)
- `OPENROUTER_API_KEY`: OpenRouter API key

### Generic API Keys (Lower Priority)
- `MORPHEUS_LLM_API_KEY`: Generic API key (fallback)

### Security
- `THE_ARCHITECT_PASS`: Web Dashboard access password (default: iamthearchitect)

### Telegram Configuration
- `MORPHEUS_TELEGRAM_ENABLED`: Enable/disable Telegram (true/false)
- `MORPHEUS_TELEGRAM_TOKEN`: Telegram bot token
- `MORPHEUS_TELEGRAM_ALLOWED_USERS`: Comma-separated list of allowed user IDs

### Sati Memory Configuration
- `MORPHEUS_SANTI_PROVIDER`: Sati provider (same as LLM by default)
- `MORPHEUS_SANTI_MODEL`: Sati model name
- `MORPHEUS_SANTI_MEMORY_LIMIT`: Memory retrieval limit

### Audio Configuration
- `MORPHEUS_AUDIO_ENABLED`: Enable/disable audio transcription
- `MORPHEUS_AUDIO_MODEL`: Audio model (usually gemini-2.5-flash-lite)
- `MORPHEUS_AUDIO_MAX_DURATION`: Max audio duration in seconds

### General Configuration
- `MORPHEUS_AGENT_NAME`: Name of the agent
- `MORPHEUS_AGENT_PERSONALITY`: Personality of the agent
- `MORPHEUS_UI_ENABLED`: Enable/disable Web UI
- `MORPHEUS_UI_PORT`: Port for Web UI (default: 3333)

## 🔗 Access the Dashboard

After starting the container, access the Web UI at:
```
http://localhost:3333
```

Use the password set in `THE_ARCHITECT_PASS` to log in.

## 🛡️ Privacy Protection

The Web UI includes privacy protection headers to prevent indexing by search engines:
- HTML meta tags: `<meta name="robots" content="noindex, nofollow">`
- HTTP header: `X-Robots-Tag: noindex, nofollow`

## 📁 Persistent Data

The container stores configuration and data in `/root/.morpheus`. The volume mount ensures data persists between container restarts.

## 🏥 Health Check

The container includes a health check endpoint at `/health` that doesn't require authentication:
```bash
curl http://localhost:3333/health
```

## 🤝 Contributing

Morpheus is an open-source project. Contributions are welcome! Check out our GitHub repository for more information and to contribute.

## 📄 License

This project is open-source under the ISC license.

---

**Note**: Remember to replace placeholder API keys with your actual keys and set a strong password for `THE_ARCHITECT_PASS`. For production use, ensure your API keys are properly secured.