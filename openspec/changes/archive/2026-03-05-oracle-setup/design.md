## Context

Atualmente o Oracle não tem nenhuma informação prévia sobre o usuário. O Sati (memória vetorial) existe para armazenar memórias de longo prazo, mas nunca é alimentada com dados básicos de identidade — o que reduz a qualidade de personalização desde a primeira mensagem.

A abordagem precisa ser **conversacional** (não um formulário), **não-bloqueante em config** (setup opcional via `zaion.yaml`), e **idempotente** (nunca re-executar após conclusão).

## Goals / Non-Goals

**Goals:**
- Detectar primeira execução e conduzir setup via conversa natural
- Persistir campos coletados no Sati como memórias pessoais
- Marcar setup como concluído para nunca mais ser exibido
- Campos configuráveis (quais perguntar, se setup é obrigatório)
- Funcionar em todos os canais (Telegram, Discord, UI, API)

**Non-Goals:**
- UI de onboarding separada (é feito via chat)
- Edição posterior via setup (usuário pode atualizar Sati manualmente)
- Autenticação ou multi-user (um setup por instância)

## Decisions

### 1. Persistência do estado: nova tabela `setup_state` no `short-memory.db`

**Alternativas consideradas:**
- Flag em `zaion.yaml` → problema: arquivo é editável pelo usuário, poderia ser apagado acidentalmente
- Entrada em `audit_events` → semanticamente errado, tabela existe para observabilidade
- Tabela dedicada → limpa, fácil de checar, fácil de limpar no Danger Zone

**Decisão:** Tabela `setup_state` com colunas: `id`, `field`, `value`, `created_at`. Flag de conclusão via registro `field = '__completed__'`.

### 2. Mecanismo de coleta: ferramenta `setup_save` + bloco no system prompt

**Alternativas consideradas:**
- Parsear a resposta do Oracle para identificar quando infos foram coletadas → frágil, dependente de formato
- Estado via sessão em memória → perdido se daemon reiniciar no meio do setup
- Ferramenta `setup_save` chamada pelo Oracle → explícito, auditável, atômico

**Decisão:** Oracle recebe instrução no system prompt listando os campos a coletar. Quando tiver todos, chama `setup_save(fields)`. Essa ferramenta persiste no DB e no Sati, e marca `__completed__`.

### 3. Injeção no Oracle: verificação no início de `chat()`

O Oracle verifica via `SetupRepository.isCompleted()` no início de cada `chat()`. Se `false`, adiciona bloco `## [FIRST-TIME SETUP]` no system prompt **antes** do prompt principal. O bloco instrui o Oracle a fazer as perguntas antes de qualquer outra tarefa.

### 4. Sati: campos salvos como memórias com prefixo `[SETUP]`

Cada campo coletado é salvo via `SatiRepository` como uma memória de texto: `"[SETUP] name: João"`. Isso permite que o Oracle recupere via busca semântica em conversas futuras normalmente.

### 5. Config via `zaion.yaml`

```yaml
setup:
  enabled: true           # false = desabilita todo o setup
  fields:
    - name                # campos a coletar
    - city
    - timezone
```

`enabled: false` faz `SetupRepository.isCompleted()` retornar `true` sempre — sem impacto no Oracle.

## Risks / Trade-offs

- **[Risco] Usuário abandona o setup no meio** → Mitigation: setup re-pergunta apenas os campos faltantes (não recomeça do zero); `__completed__` só é marcado quando todos os campos configurados foram coletados
- **[Risco] Canal API/UI recebe setup indesejado** → Mitigation: setup pode ser restrito via config `channels: [telegram, discord]` — padrão inclui todos
- **[Risco] Daemon reinicia durante setup** → Mitigation: campos são salvos parcialmente conforme coletados; ao reiniciar, Oracle identifica quais ainda faltam

## Migration Plan

1. Migração de DB: nova tabela `setup_state` criada automaticamente no `initialize()` do `SetupRepository`
2. Instâncias existentes: como `setup_state` não existe, primeira checagem cria tabela e detecta setup pendente — comportamento correto
3. Rollback: remover bloco de setup do system prompt e dropar tabela — sem efeito colateral

## Open Questions

- Deve existir um comando CLI `morpheus setup --reset` para forçar re-execução? (sugerido para v2)
- Danger Zone deve limpar `setup_state`? Provavelmente sim, junto com `sessions`
