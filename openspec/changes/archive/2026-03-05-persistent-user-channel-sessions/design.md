## Context

**Estado Atual:**
- `TelegramAdapter` e `DiscordAdapter` possuem uma variável `currentSessionId: string | null` que armazena a sessão ativa
- Esta variável é **compartilhada por todos os usuários** do canal
- Ao reiniciar o Morpheus, `currentSessionId` é resetado para `null`
- Na próxima mensagem, `getCurrentSessionOrCreate()` retorna a última sessão global, não a sessão que o usuário estava usando

**Arquitetura Existente:**
- Tabela `sessions` armazena sessões globais (id, title, status, started_at)
- Tabela `messages` armazena mensagens vinculadas a `session_id`
- `SQLiteChatMessageHistory` gerencia CRUD de sessões e mensagens
- Cada adapter (Telegram, Discord) é instanciado uma vez no `start.ts` e registrado no `ChannelRegistry`

**Stakeholders:**
- Usuários do Telegram e Discord que perdem contexto após restarts
- Desenvolvedores que precisam de sessões previsíveis por usuário

## Goals / Non-Goals

**Goals:**
- Persistir o mapeamento `(channel, user_id) → session_id` para restauração após restart
- Manter o gerenciamento de sessões global (qualquer usuário pode ver/gerenciar todas via `/sessions`)
- Permitir que múltiplos usuários compartilhem a mesma sessão (mesmo `session_id`)
- Restaurar automaticamente as sessões no startup do Morpheus
- Não quebrar o fluxo atual de comandos de sessão

**Non-Goals:**
- Mudar a UI dos comandos `/sessions` para filtrar por usuário (permanece global)
- Criar sessões automáticas por usuário no startup (só restaura as existentes)
- Sincronizar sessão entre canais (Telegram e Discord são independentes)
- Migrar sessões antigas para novos usuários automaticamente

## Decisions

### Decisão 1: Nova tabela `user_channel_sessions` vs coluna em `sessions`

**Opção A:** Nova tabela `user_channel_sessions(channel, user_id, session_id)`
**Opção B:** Colunas `channel` e `user_id` na tabela `sessions`

**Escolha: Opção A**

**Rationale:**
- Separação de responsabilidades: `sessions` é global e compartilhada, `user_channel_sessions` é mapeamento de estado
- Múltiplos usuários podem apontar para a mesma sessão sem duplicação de dados
- Mais fácil de limpar/atualizar mapeamentos sem afetar a sessão em si
- Query mais eficiente para "qual sessão este usuário está usando?"

**Schema:**
```sql
CREATE TABLE user_channel_sessions (
  channel TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (channel, user_id)
);
```

### Decisão 2: Cache em memória com Map vs apenas DB

**Opção A:** `userSessions: Map<userId, sessionId>` em memória + DB para persistência
**Opção B:** Apenas DB, consulta a cada mensagem

**Escolha: Opção A**

**Rationale:**
- Performance: evita query ao DB a cada mensagem do usuário
- O Map é populado no startup via `restoreUserSessions()`
- Atualizações no Map são síncronas, persistência em DB é async (fire-and-forget)
- Baixo custo de memória (tipicamente <100 usuários ativos)

### Decisão 3: Quando atualizar o mapeamento

**Regras:**
| Evento | Ação no mapeamento |
|--------|-------------------|
| Primeira mensagem do usuário | Cria entrada `user_channel_sessions` com sessão global atual |
| `/newsession` | Atualiza entrada com nova `session_id` |
| `/sessions switch` | Atualiza entrada com nova `session_id` |
| `/sessions archive` (da sessão do usuário) | Remove entrada do mapeamento |
| `/sessions delete` (da sessão do usuário) | Remove entrada do mapeamento |

**Rationale:** O mapeamento sempre reflete "qual sessão este usuário está usando agora". Se a sessão foi arquivada/deletada, remove o mapeamento.

### Decisão 4: Restauração no startup

**Fluxo:**
```typescript
// start.ts
const telegram = new TelegramAdapter(oracle);
await telegram.connect(token, allowedUsers);
await telegram.restoreUserSessions(); // ← Lê DB e popula userSessions Map
ChannelRegistry.register(telegram);
```

**Rationale:** Restaurar imediatamente após connect() garante que o Map esteja populado antes da primeira mensagem chegar.

### Decisão 5: Fallback para usuário sem mapeamento

**Fluxo:**
```typescript
async getSessionForUser(userId: string): Promise<string> {
  // 1. Tenta memória
  let sessionId = this.userSessions.get(userId);
  if (sessionId) return sessionId;

  // 2. Tenta DB
  sessionId = await this.history.getUserChannelSession(this.channel, userId);
  if (sessionId) {
    this.userSessions.set(userId, sessionId);
    return sessionId;
  }

  // 3. Cria/usar sessão global
  sessionId = await this.history.getCurrentSessionOrCreate();
  await this.history.setUserChannelSession(this.channel, userId, sessionId);
  this.userSessions.set(userId, sessionId);
  return sessionId;
}
```

**Rationale:** Triple fallback garante que sempre há uma sessão válida, mesmo para usuários novos ou com mapeamento corrompido.

## Risks / Trade-offs

### Risco 1: Mapeamento órfão se sessão for deletada diretamente

**Cenário:** Sessão é deletada via DB manualmente ou bug, mas mapeamento permanece.

**Mitigação:** `getSessionForUser()` valida que a sessão existe antes de retornar. Se não existir, trata como usuário novo.

### Risco 2: Condição de corrida se dois usuários compartilham sessão e um troca

**Cenário:** Usuário A e B compartilham `session-abc`. Usuário A troca para `session-xyz`. Usuário B continua em `session-abc`.

**Mitigação:** Este é o comportamento **desejado**. Cada usuário tem seu próprio mapeamento independente. Compartilhamento é apenas sobre apontar para o mesmo `session_id`, não sobre vincular os mapeamentos.

### Risco 3: DB `user_channel_sessions` cresce indefinidamente

**Cenário:** Muitos usuários inativos acumulam entradas órfãs.

**Mitigação:** (Opcional, futuro) Job de limpeza remove entradas onde `user_id` não está em `allowedUsers` ou sessão foi arquivada/deletada há X dias.

### Trade-off: Complexidade adicional vs benefício de UX

**Custo:** ~200 linhas de código novo + 1 tabela + 4 métodos novos no `SQLiteChatMessageHistory`

**Benefício:** Usuários não perdem contexto após restarts do Morpheus

**Veredito:** Vale a pena — é uma dor real de UX com solução de complexidade moderada.

## Migration Plan

### Passo 1: Criar tabela `user_channel_sessions`

```sql
CREATE TABLE IF NOT EXISTS user_channel_sessions (
  channel TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (channel, user_id)
);
```

**Execução:** No próximo startup, `SQLiteChatMessageHistory.ensureTable()` cria automaticamente.

### Passo 2: Deploy do código atualizado

- Não há migração de dados necessária
- Usuários existentes começam com mapeamento vazio e criam na primeira mensagem
- Restart do Morpheus é necessário para aplicar o código novo

### Rollback

- Reverter código para versão anterior
- Tabela `user_channel_sessions` pode permanecer (inerte) ou ser deletada manualmente
- Sem perda de dados — sessões e mensagens permanecem intactas

## Open Questions

1. **Deveríamos popular o mapeamento para usuários existentes no startup?**
   - Decisão atual: Não — só restaura mapeamentos já persistidos
   - Usuários existentes pegam sessão global na próxima mensagem

2. **Deveríamos expor um comando `/session_status` para usuário ver sua sessão atual?**
   - Decisão atual: Não escopa desta change — pode ser feature futura

3. **Deveríamos validar que `user_id` está em `allowedUsers` antes de persistir?**
   - Decisão atual: Sim — o adapter já valida antes de chamar `getSessionForUser()`
