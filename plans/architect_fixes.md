# Plano de Correção Arquitetural — Morpheus
**Branch:** `fix/architect_issues`

---

## Contexto

Durante análise arquitetural foram identificados bugs funcionais, problemas de performance e vazamentos de recursos em camadas críticas: banco de dados, memória semântica (Sati), canal Telegram e API HTTP. Este documento organiza as correções em fases incrementais, do mais crítico ao menos urgente.

---

## Fase 1 — Bugs Funcionais

### 1.1 — Bug no filtro de similaridade Sati
**Arquivo:** `src/runtime/memory/sati/repository.ts`
**Problema:** `searchByVector()` calcula `similarity = 1 - distance` mas filtra/ordena por `distance` (invertido). Memórias irrelevantes podem ser retornadas antes das relevantes.

**Correção:**
```typescript
// ANTES (errado)
.filter(r => r.distance >= SIMILARITY_THRESHOLD)
.sort((a, b) => b.distance - a.distance)

// DEPOIS (correto)
.filter(r => r.similarity >= SIMILARITY_THRESHOLD)
.sort((a, b) => b.similarity - a.similarity)
```

---

### 1.2 — Bug no Singleton do ConfigManager
**Arquivo:** `src/config/manager.ts`
**Problema:** `getInstance()` não atribui a instância a `ConfigManager.instance`, criando um novo objeto a cada chamada.

**Correção:**
```typescript
public static getInstance(): ConfigManager {
  if (!ConfigManager.instance) {
    ConfigManager.instance = new ConfigManager(); // era: return new ConfigManager()
  }
  return ConfigManager.instance;
}
```

---

## Fase 2 — Performance de Banco de Dados

### 2.1 — Índice composto em messages
**Arquivo:** `src/runtime/memory/sqlite.ts`
**Problema:** Query `WHERE session_id = ? ORDER BY id DESC` faz full scan com sort sem índice cobrindo a ordenação.

**Correção:**
```sql
CREATE INDEX IF NOT EXISTS idx_messages_session_id_id
ON messages(session_id, id DESC);
```

---

### 2.2 — Cache de titleSet em addMessage
**Arquivo:** `src/runtime/memory/sqlite.ts`
**Problema:** `setSessionTitleIfNeeded()` executa 2 SELECTs + 1 UPDATE em cada `addMessage()`, mesmo quando o título já foi definido.

**Correção:** Adicionar flag `private titleSet = false` na classe. Após definir o título, setar a flag. Checar a flag antes de executar as queries.

---

### 2.3 — Batch insert de mensagens no Oracle
**Arquivo:** `src/runtime/oracle.ts` + `src/runtime/memory/sqlite.ts`
**Problema:** Loop de `addMessage()` individual gera uma transação SQLite por mensagem. Com tool calls, podem ser 10+ transações por interação.

**Correção:** Novo método `addMessages(msgs: BaseMessage[])` em `SQLiteChatMessageHistory` usando `db.transaction(...)`. No Oracle, substituir o loop por `await this.history.addMessages(newGeneratedMessages)`.

---

### 2.4 — Índice em memory_embedding_map
**Arquivo:** `src/runtime/memory/sati/repository.ts`
**Problema:** JOIN entre `memory_embedding_map(vec_rowid)` e `memory_vec(rowid)` sem índice, causando full scan.

**Correção:**
```sql
CREATE INDEX IF NOT EXISTS idx_embedding_map_vec_rowid
ON memory_embedding_map(vec_rowid);
```

---

## Fase 3 — Vazamentos de Conexão

### 3.1 — Connection leak no api.ts
**Arquivo:** `src/http/api.ts`
**Problema:** Instâncias de `SQLiteChatMessageHistory` criadas nas rotas `/stats/usage` (linhas 249, 260) nunca são fechadas. A rota `/sessions/:id/messages` também cria uma instância sem garantia de fechamento.

**Correção:** Reutilizar a instância `history` do closure para as rotas de stats. Usar try/finally na rota de mensagens por sessão.

---

### 3.2 — Conexão não fechada ao trocar sessão no Oracle
**Arquivo:** `src/runtime/oracle.ts`
**Problema:** `setSessionId()` cria nova instância de `SQLiteChatMessageHistory` sem fechar a anterior, acumulando file handles.

**Correção:**
```typescript
async setSessionId(sessionId: string): Promise<void> {
  if (this.history) this.history.close();
  this.history = new SQLiteChatMessageHistory({ ... });
}
```

---

## Fase 4 — Rate Limiting e Validação

### 4.1 — Rate limiting no Telegram
**Arquivo:** `src/channels/telegram.ts`
**Problema:** Sem throttle por usuário. Um usuário pode enfileirar requests indefinidamente.

**Correção:** Map em memória `userId -> timestamp`. Se o tempo desde o último request for menor que `RATE_LIMIT_MS` (3000ms), rejeitar com mensagem amigável.

---

### 4.2 — Validação de input na rota /chat
**Arquivo:** `src/http/api.ts`
**Problema:** `message` é passado diretamente ao Oracle sem limite de tamanho.

**Correção:** Schema Zod:
```typescript
const ChatSchema = z.object({
  message: z.string().min(1).max(32_000),
  sessionId: z.string().uuid()
});
```

---

## Fase 5 — Cache de Embeddings

### 5.1 — Cache LRU no EmbeddingService
**Arquivo:** `src/runtime/memory/embedding.service.ts`
**Problema:** Mesmo texto embedado múltiplas vezes sem cache. Model inference rodando desnecessariamente.

**Correção:** Map com limite de 256 entradas. Chave = primeiros 200 chars do texto. Eviction FIFO ao atingir limite.

---

## Ordem de Execução

| Fase | Problema | Risco | Impacto |
|------|----------|-------|---------|
| 1.1 | Bug similaridade Sati | Baixo | Crítico |
| 1.2 | Bug singleton ConfigManager | Baixo | Alto |
| 2.1 | Índice composto messages | Baixo | Alto |
| 2.2 | Cache titleSet | Baixo | Médio |
| 2.3 | Batch insert Oracle | Médio | Alto |
| 2.4 | Índice embedding_map | Baixo | Médio |
| 3.1 | Connection leak api.ts | Médio | Alto |
| 3.2 | Fechar conexão setSessionId | Baixo | Médio |
| 4.1 | Rate limiting Telegram | Médio | Alto |
| 4.2 | Validação /chat | Baixo | Médio |
| 5.1 | Cache embeddings | Médio | Médio |

---

## Arquivos Modificados

- `src/runtime/memory/sqlite.ts` — Fases 2.1, 2.2, 2.3
- `src/runtime/memory/sati/repository.ts` — Fases 1.1, 2.4
- `src/runtime/memory/embedding.service.ts` — Fase 5.1
- `src/runtime/oracle.ts` — Fases 2.3, 3.2
- `src/channels/telegram.ts` — Fase 4.1
- `src/http/api.ts` — Fases 3.1, 4.2
- `src/config/manager.ts` — Fase 1.2
