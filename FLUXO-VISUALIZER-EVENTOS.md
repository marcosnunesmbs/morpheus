# Fluxo de Eventos do Visualizer - Morpheus

Este documento explica como o componente `MorpheusVisualizer` no frontend captura e exibe as ações da telefonista (Telephonist), especialmente quando faz TTS (Text-to-Speech).

---

## Visão Geral do Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND                                           │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │   Telegram   │    │   DisplayManager  │    │      API Express                 │  │
│  │   Adapter    │───▶│   (EventEmitter)  │───▶│   /api/display/stream (SSE)     │  │
│  └──────────────┘    └──────────────────┘    └──────────────────────────────────┘  │
│         │                     │                              │                       │
│         │  display.log()     │  emit('message')             │  res.write()          │
│         │  source:            │  source: 'Telephonist'       │  text/event-stream   │
│         │  'Telephonist'      │                              │                       │
└─────────│─────────────────────│──────────────────────────────│───────────────────────┘
          │                     │                              │
          │                     │                              │
          ▼                     ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                         useSystemStream Hook                                  │   │
│  │  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐    │   │
│  │  │ EventSource    │───▶│  parse JSON    │───▶│  setActiveEvents()     │    │   │
│  │  │ (/api/display/ │    │  resolveAgent()│    │  setFeed()             │    │   │
│  │  │  stream)        │    │                │    │                        │    │   │
│  │  └────────────────┘    └────────────────┘    └────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                             │
│                                        ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                      MorpheusVisualizer Component                            │   │
│  │  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐    │   │
│  │  │  OracleNode    │    │   AgentNode    │    │    ActivityFeed        │    │   │
│  │  │  (centro)      │◀──▶│  (agentes em   │    │    (timeline)         │    │   │
│  │  │                │    │   órbita)      │    │                        │    │   │
│  │  └────────────────┘    └────────────────┘    └────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Emissão do Evento (Backend)

### 1.1 Telefonista fazendo TTS

Quando a telefonista sintetiza áudio para responder a uma mensagem de voz:

```typescript
// src/channels/telegram.ts (linha ~479)
const ttsResult = await this.ttsTelephonist.synthesize(
  response, 
  ttsApiKey || '', 
  ttsConfig.voice, 
  ttsConfig.style_prompt
);

// Sucesso - log da resposta
this.display.log(`Responded to @${user} (TTS audio)`, { source: 'Telegram' });
```

### 1.2 DisplayManager - Emissor de Eventos

O `DisplayManager` é um `EventEmitter` singleton que recebe logs e os transforma em eventos:

```typescript
// src/runtime/display.ts
public log(message: string, options?: LogOptions): void {
  // ... formatação e console.log ...

  // Emite para visualization (ignorando debug)
  if (options?.level !== 'debug') {
    this.emit('message', {
      message,
      source: options?.source || 'system',  // ← "Telephonist"
      level: options?.level || 'info',
      timestamp: Date.now(),
      meta: options?.meta
    });
  }
}
```

### 1.3 API SSE - Stream de Eventos

O endpoint `/api/display/stream` mantém uma conexão persistente com o frontend:

```typescript
// src/http/routers/display.ts
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onMessage = (payload: any) => {
    res.write(`data: ${JSON.stringify({ type: 'message', ...payload })}\n\n`);
  };

  display.on('message', onMessage);

  req.on('close', () => {
    display.off('message', onMessage);
  });
});
```

---

## 2. Captura no Frontend

### 2.1 Hook useSystemStream

O hook conecta ao endpoint SSE e processa os eventos:

```typescript
// src/ui/src/hooks/useSystemStream.ts
const eventSource = new EventSource('/api/display/stream');

eventSource.onmessage = (event) => {
  const parsed = JSON.parse(event.data);
  parsed.agent = resolveAgent(parsed);  // Mapeia 'telephonist'

  switch (parsed.type) {
    case 'message':
      addTimedEvent(parsed, 3500);   // Evento ativo por 3.5s
      addFeedEntry(parsed);           // Adiciona ao feed
      break;
  }
};
```

### 2.2 Mapeamento de Source para AgentKey

```typescript
// src/ui/src/hooks/useSystemStream.ts
const SOURCE_TO_AGENT: Record<string, string> = {
  // ...
  telephonist: 'telephonist',
  // ...
};
```

---

## 3. Visualização no Componente

### 3.1 MorpheusVisualizer

O componente 3D recebe os eventos ativos e exibe:

```typescript
// src/ui/src/components/dashboard/visualizer/MorpheusVisualizer.tsx
const { activeEvents, feed, isConnected } = useSystemStream();

// Para cada agente, verifica se tem evento ativo
const activeEvent = activeEvents.find((e: any) => e.agent === agent.agentKey);
const isActive = !!activeEvent;

return (
  <group>
    <AgentNode
      name={agent.label}
      agentKey={agent.agentKey}
      isActive={isActive}
      message={activeEvent?.message}
      // ... propriedades de órbita
    />
  </group>
);
```

### 3.2 Cores por Agente

```typescript
const AGENT_COLORS: Record<string, string> = {
  // ...
  telephonist: '#c084fc',  // violeta
  // ...
};
```

---

## Fluxo Detalhado: TTS da Telefonista

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO TTS DA TELEFONISTA                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

1. USUÁRIO ENVIA MENSAGEM DE VOZ
   │
   ▼
2. Telegram Adapter recebe áudio
   │
   ▼
3. display.log("Receiving voice message...", { source: 'Telephonist' })
   │
   ▼
4. DisplayManager.emit('message', { source: 'Telephonist', ... })
   │
   ▼
5. API SSE envia: { type: 'message', source: 'Telephonist', ... }
   │
   ▼
6. Frontend recebe via EventSource
   │
   ▼
7. useSystemStream.processEvent() → activeEvents.push()
   │
   ▼
8. MorpheusVisualizer renderiza:
   - AgentNode "Telephonist" fica ACTIVE (iluminado)
   - ActivityFeed mostra: "telephonist: Receiving voice message..."
   │
   ▼
9. Oracle processa mensagem → gera resposta
   │
   ▼
10. TTS: ttsTelephonist.synthesize(response, ...)
    │
    ▼
11. display.log("Responded to @user (TTS audio)", { source: 'Telegram' })
    │
    ▼
12. DisplayManager.emit('message', { source: 'Telegram', ... })
    │
    ▼
13. API SSE envia evento
    │
    ▼
14. Frontend atualiza visualização
    │
    ▼
15. Evento expira após 3.5s → AgentNode volta ao estado normal
```

---

## Estrutura de Dados

### Evento SSE (Backend → Frontend)

```json
{
  "type": "message",
  "message": "Transcription success for @user: \"hello\"",
  "source": "Telephonist",
  "level": "success",
  "timestamp": 1699999999999
}
```

### SystemActivityEvent (Frontend)

```typescript
interface SystemActivityEvent {
  type: 'activity_start' | 'activity_end' | 'message' | 'connected';
  agent?: string;      // mapeado de source
  source?: string;      // original: 'Telephonist'
  message?: string;
  level?: string;
  timestamp: number;
}
```

### FeedEntry (Activity Feed)

```typescript
interface FeedEntry {
  id: number;
  agent?: string;       // 'telephonist'
  source?: string;
  message: string;
  level?: string;
  timestamp: number;
}
```

---

## Estados de Visualização

| Estado | Descrição | Duração |
|--------|-----------|---------|
| `activity_start` | Agente começou atividade | Até `activity_end` |
| `activity_end` | Agente terminou atividade | Imediato |
| `message` | Log/info do agente | 3.5s (ativo) + 5s (feed) |

---

## Resumo

1. **Emissor**: `DisplayManager.log()` com `source: 'Telephonist'`
2. **Transporte**: Server-Sent Events (SSE) em `/api/display/stream`
3. **Consumidor**: Hook `useSystemStream` no frontend
4. **Visualização**: `MorpheusVisualizer` - nós 3D dos agentes + feed de atividade
5. **Cor**: Telephonist usa `#c084fc` (violeta)

O fluxo é **unidirecional** (backend → frontend) via SSE, com o frontend mantendo uma conexão persistente que recebe eventos em tempo real.

---

## Integração com Auditoria (AuditRepository)

A partir desta implementação, **todos os eventos de auditoria** também emitem eventos para o visualizer, permitindo que o frontend mostre quando um agente está ativo.

### Fluxo de Auditoria

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE EVENTOS DE AUDITORIA                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

1. QUALQUER PARTE DO CÓDIGO CHAMA AuditRepository.insert(event)
   │
   ▼
2. AuditRepository.insert() → salva no banco SQLite
   │
   ▼
3. AuditRepository.emitActivityEvent() → analiza o tipo de evento
   │
   ▼
4. Se for evento de agente (llm_call, tool_call, mcp_tool, telephonist, etc)
   │
   ▼
5. DisplayManager.emit('activity_start', { agent, message, duration_ms })
   │
   ▼
6. API SSE transmite para o frontend
   │
   ▼
7. useSystemStream processa:
   - Usa duration_ms para definir tempo ativo (com buffer de 500ms, máximo 30s)
   - Adiciona ao feed de atividade
   │
   ▼
8. MorpheusVisualizer:
   - AgentNode fica iluminado
   - Mostra mensagem descritiva (ex: "Executing tool: read_file")
   - Permanece ativo pelo tempo especificado em duration_ms
```

### Tipos de Eventos de Auditoria Rastreados

| Event Type | Mensagem no Visualizer |
|------------|------------------------|
| `llm_call` | LLM call (model/provider) |
| `tool_call` | Executing tool: {tool_name} |
| `mcp_tool` | MCP tool: {tool_name} |
| `telephonist` | Synthesizing TTS... / Transcribing audio... |
| `skill_loaded` | Loading skill: {tool_name} |
| `chronos_job` | Running scheduled job: {tool_name} |
| `memory_recovery` | Recovering memories... |
| `memory_persist` | Persisting memories... |

### Benefícios

1. **Feedback visual imediato**: O usuário vê quando qualquer agente está trabalhando
2. **Duração precisa**: O agente permanece ativo pelo tempo real de execução (duration_ms)
3. **Mensagens descritivas**: Cada tipo de operação tem uma mensagem específica
4. **Sem mudanças nos chamadores**: A lógica de emissão acontece automaticamente no insert

---

## Emissão Direta de Atividades (startActivity/endActivity)

Além da integração com AuditRepository, o sistema agora suporta **emissão direta** de eventos de atividade através dos métodos `startActivity` e `endActivity` do DisplayManager. Isso permite que o frontend mostre o agente trabalhando **antes** da operação terminar.

### API do DisplayManager

```typescript
// Iniciar atividade - mostra agente como "trabalhando" imediatamente
display.startActivity('telephonist', 'Transcribing audio...');

// Encerrar atividade - remove o estado "trabalhando"
display.endActivity('telephonist', true); // true = sucesso, false = erro
```

### Fluxo com Emissão Direta

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO COM EMISSÃO DIRETA (PREFERIDO)                             │
└─────────────────────────────────────────────────────────────────────────────────────┘

1. ANTES da operação: display.startActivity(agent, message)
   │
   ▼
2. DisplayManager.emit('activity_start', { agent, message, timestamp })
   │
   ▼
3. API SSE transmite → Frontend mostra agente ILUMINADO
   │
   ▼
4. OPERAÇÃO EXECUTA (ex: chamada API, TTS, transcrição)
   │
   ▼
5. APÓS a operação: display.endActivity(agent, success)
   │
   ▼
6. DisplayManager.emit('activity_end', { agent, timestamp, success })
   │
   ▼
7. API SSE transmite → Frontend remove estado "trabalhando"
   │
   ▼
8. AuditRepository.insert() → salva no banco (opcional, pode ser depois)
```

### Onde está implementado

| Componente | Operação | Mensagem |
|------------|----------|----------|
| **Oracle** | Chamada LLM | `LLM call (model)` |
| **TelegramAdapter** | Transcrição | `Transcribing audio...` |
| **TelegramAdapter** | Síntese TTS | `Synthesizing TTS...` |
| **DiscordAdapter** | Transcrição | `Transcribing audio...` |
| **DiscordAdapter** | Síntese TTS | `Synthesizing TTS...` |
| **Construtor (MCP)** | Ferramenta MCP | `MCP tool: {name}` |
| **devkit-instrument** | Ferramenta DevKit | `Executing tool: {name}` |
| **ProviderFactory** | Qualquer ferramenta (middleware) | `Executing tool: {name}` |
| **Trinity** | list_databases | `Listing databases...` |
| **Trinity** | get_schema | `Getting database schema...` |
| **Trinity** | refresh_schema | `Refreshing database schema...` |
| **Trinity** | test_connection | `Testing database connection...` |
| **Trinity** | execute_query | `Executing database query...` |
| **Link** | search_documents | `Searching documents...` |
| **Link** | list_documents | `Listing documents...` |
| **Link** | search_in_document | `Searching in document...` |
| **Link** | summarize_document | `Summarizing document...` |
| **Link** | summarize_chunk | `Summarizing chunk...` |
| **Link** | extract_key_points | `Extracting key points...` |
| **Link** | find_differences | `Comparing documents...` |
| **Sati** | recover | `Recovering memories...` |
| **Sati** | evaluateAndPersist | `Evaluating and persisting memories...` |
| **Chronos** | executeJob | `Running scheduled job...` |
| **Smith** | delegate | `Delegating to Smith '{name}'...` |

### Exemplo de Uso

```typescript
// No TelegramAdapter para TTS
this.display.startActivity('telephonist', 'Synthesizing TTS...');
try {
  const ttsResult = await this.ttsTelephonist.synthesize(response, apiKey, voice);
  // ... enviar áudio
  this.display.endActivity('telephonist', true);
} catch (error) {
  this.display.endActivity('telephonist', false);
  // ... fallback para texto
}
```

### Diferença entre os métodos

| Método | Quando usar | Comportamento |
|--------|-------------|---------------|
| `startActivity()` | Antes de iniciar operação longa | Emite `activity_start` imediatamente |
| `endActivity()` | Após operação terminar | Emite `activity_end` para finalizar |
| `emitActivityEvent()` (AuditRepository) | Após operação terminar (fallback) | Emite baseado em `duration_ms` |

**Recomendação**: Use `startActivity`/`endActivity` diretamente quando possível, pois fornece feedback visual imediato. O `emitActivityEvent` no AuditRepository serve como fallback para operações que não têm controle direto sobre o início/fim.

---

## Evento de Mensagem Enviada (Rocket Animation)

Quando o Oracle envia uma resposta (mensagem de IA), um evento especial é emitido que mostra uma animação de foguete decolando no visualizer 3D.

### Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    EVENTO DE MENSAGEM ENVIADA                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

1. Oracle processa mensagem e gera resposta
   │
   ▼
2. Mensagens persistidas no histórico (SQLite)
   │
   ▼
3. display.emitMessageSent('oracle')
   │
   ▼
4. API SSE transmite: { type: 'message_sent', agent: 'oracle', timestamp: ... }
   │
   ▼
5. Frontend recebe evento:
   - addTimedEvent() → adiciona ao feed por 2s
   - dispatchEvent('morpheus:message_sent') → dispara animação
   │
   ▼
6. MorpheusVisualizer:
   - Renderiza foguete subindo com chama
   - Animação dura ~1.5 segundos
   - Foguete some no "espaço"
```

### Implementação

**Backend:**
- `DisplayManager.emitMessageSent(agent)` - novo método
- `Oracle` - chama após persistir mensagens geradas
- `/api/display/stream` - transmite evento `message_sent`

**Frontend:**
- `useSystemStream` - processa evento e dispara custom event
- `MorpheusVisualizer` - renderiza `RocketAnimation` quando ativo

### Componente RocketAnimation

O foguete é renderizado com Three.js:
- Corpo cônico laranja
- Asas laterais
- Chama amarela/laranja animadac
- Movimento ascendente com oscilação lateral
- Duração: 1.5 segundos

### Quando é disparado

O evento é emitido sempre que:
1. O Oracle gera uma resposta via `chat()`
2. As mensagens são persistidas no histórico SQLite
3. Uma resposta é injetada via `injectAIMessage()`

Isso fornece feedback visual imediato de que uma resposta foi enviada, aparecendo como um foguete decolando do Oracle no centro do visualizer.