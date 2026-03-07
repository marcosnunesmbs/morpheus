## Why

Atualmente, Telegram e Discord adapters mantêm o estado da sessão apenas em memória (`currentSessionId`). Quando o Morpheus reinicia, todos os usuários perdem o contexto da sessão em que estavam conversando — a próxima mensagem de qualquer usuário pega a última sessão global criada, causando confusão e perda de contexto conversacional.

## What Changes

- **Nova tabela `user_channel_sessions`** no banco `short-memory.db` para persistir o mapeamento `(channel, user_id) → session_id`
- **TelegramAdapter e DiscordAdapter** agora usam um Map `userSessions` em memória + persistência no DB para rastrear a sessão de cada usuário individualmente
- **Restauração automática** das sessões por usuário após restart do Morpheus
- **Comandos de sessão** (`/sessions`, `/newsession`, `/archive`, etc.) continuam funcionando como hoje (listagem global), mas agora também atualizam o mapeamento do usuário
- **Múltiplos usuários podem compartilhar** a mesma sessão (mesmo `session_id` na tabela)

## Capabilities

### New Capabilities

- `user-channel-session-persistence`: Persistência de sessão por usuário e canal para restauração após restart

### Modified Capabilities

- (nenhuma — esta é uma capability nova, não modifica requisitos de specs existentes)

## Impact

- **Banco de dados**: Nova tabela `user_channel_sessions` em `short-memory.db`
- **SQLiteChatMessageHistory**: 4 novos métodos para CRUD de user-channel sessions
- **TelegramAdapter / DiscordAdapter**: Mudança de `currentSessionId` (único) para `userSessions` Map (por usuário) + método `restoreUserSessions()`
- **start.ts**: Chamada para `restoreUserSessions()` após connect() de cada adapter
- **Handlers de comando**: Atualizam mapeamento user-channel ao trocar/criar/arquivar sessões
