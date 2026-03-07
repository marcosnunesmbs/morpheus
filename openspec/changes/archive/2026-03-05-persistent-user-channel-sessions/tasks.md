## 1. Banco de Dados

- [x] 1.1 Criar tabela `user_channel_sessions` em `SQLiteChatMessageHistory.ensureTable()`
- [x] 1.2 Implementar método `getUserChannelSession(channel, userId): Promise<string | null>`
- [x] 1.3 Implementar método `setUserChannelSession(channel, userId, sessionId): Promise<void>`
- [x] 1.4 Implementar método `listUserChannelSessions(channel): Promise<Array<{userId, sessionId}>>`
- [x] 1.5 Implementar método `deleteUserChannelSession(channel, userId): Promise<void>`

## 2. TelegramAdapter

- [x] 2.1 Adicionar propriedade `userSessions: Map<string, string>` na classe
- [x] 2.2 Substituir `currentSessionId` por chamadas a `getSessionForUser(userId)`
- [x] 2.3 Implementar método `getSessionForUser(userId): Promise<string>` com fallback memória → DB → global
- [x] 2.4 Implementar método `restoreUserSessions(): Promise<void>` para startup
- [x] 2.5 Atualizar handler de `/sessions switch` para chamar `setUserChannelSession()`
- [x] 2.6 Atualizar handler de `/newsession` para chamar `setUserChannelSession()`
- [x] 2.7 Atualizar handler de `/sessions archive` para chamar `deleteUserChannelSession()` se for sessão atual do usuário
- [x] 2.8 Atualizar handler de `/sessions delete` para chamar `deleteUserChannelSession()` se for sessão atual do usuário

## 3. DiscordAdapter

- [x] 3.1 Adicionar propriedade `userSessions: Map<string, string>` na classe
- [x] 3.2 Substituir `currentSessionId` por chamadas a `getSessionForUser(userId)`
- [x] 3.3 Implementar método `getSessionForUser(userId): Promise<string>` com fallback memória → DB → global
- [x] 3.4 Implementar método `restoreUserSessions(): Promise<void>` para startup
- [x] 3.5 Atualizar handler de `/sessions switch` para chamar `setUserChannelSession()`
- [x] 3.6 Atualizar handler de `/newsession` para chamar `setUserChannelSession()`
- [x] 3.7 Atualizar handler de `/sessions archive` para chamar `deleteUserChannelSession()` se for sessão atual do usuário
- [x] 3.8 Atualizar handler de `/sessions delete` para chamar `deleteUserChannelSession()` se for sessão atual do usuário

## 4. Startup (start.ts)

- [x] 4.1 Chamar `telegram.restoreUserSessions()` após `telegram.connect()`
- [x] 4.2 Chamar `discord.restoreUserSessions()` após `discord.connect()`

## 5. Testes

- [ ] 5.1 Testar criação de tabela `user_channel_sessions`
- [ ] 5.2 Testar CRUD de user-channel sessions no `SQLiteChatMessageHistory`
- [ ] 5.3 Testar `getSessionForUser()` com memória, DB e fallback
- [ ] 5.4 Testar `restoreUserSessions()` no startup
- [ ] 5.5 Testar fluxo completo: mensagem → persistência → restart → restauração

## 6. Validação

- [ ] 6.1 Testar manualmente com Telegram: enviar mensagens, restartar, verificar sessão mantida
- [ ] 6.2 Testar manualmente com Discord: enviar mensagens, restartar, verificar sessão mantida
- [ ] 6.3 Testar múltiplos usuários no mesmo canal com sessões diferentes
- [ ] 6.4 Testar múltiplos usuários compartilhando mesma sessão
- [ ] 6.5 Testar comandos `/sessions`, `/newsession`, `/archive`, `/delete` atualizam mapeamento
