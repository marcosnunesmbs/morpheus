## 1. Config

- [x] 1.1 Adicionar `SetupConfigSchema` em `src/config/schemas.ts` (antes de `ConfigSchema`) com campos `enabled: boolean` e `fields: string[]`
- [x] 1.2 Adicionar `setup?: SetupConfig` em `MorpheusConfig` em `src/types/config.ts`
- [x] 1.3 Adicionar `getSetupConfig()` e override via env var `MORPHEUS_SETUP_ENABLED` em `src/config/manager.ts`

## 2. SetupRepository

- [x] 2.1 Criar `src/runtime/setup/repository.ts` com singleton `SetupRepository`
- [x] 2.2 Implementar `initialize()`: cria tabela `setup_state (id, field, value, created_at)` no `short-memory.db`
- [x] 2.3 Implementar `isCompleted()`: retorna `true` se `setup.enabled = false` OU se registro `__completed__` existe
- [x] 2.4 Implementar `saveField(field: string, value: string)`: insere/atualiza registro na tabela
- [x] 2.5 Implementar `getMissingFields()`: retorna campos configurados que ainda não têm registro
- [x] 2.6 Implementar `markCompleted()`: insere registro `field = '__completed__'`
- [x] 2.7 Implementar `reset()`: apaga todos os registros da tabela (para uso no Danger Zone)

## 3. Ferramenta setup_save

- [x] 3.1 Criar `src/runtime/tools/setup-tool.ts` com `buildSetupTool()` retornando `StructuredTool`
- [x] 3.2 Schema Zod: `{ fields: Record<string, string> }` (mapa campo→valor)
- [x] 3.3 Implementar execução: para cada campo do mapa, chamar `SetupRepository.saveField()` + `SatiRepository.save("[SETUP] <field>: <value>")`
- [x] 3.4 Após salvar todos os campos, verificar se `getMissingFields()` está vazio e chamar `markCompleted()` se sim
- [x] 3.5 Retornar mensagem de confirmação listando campos salvos

## 4. Integração no Oracle

- [x] 4.1 Importar `SetupRepository` e `buildSetupTool` em `src/runtime/oracle.ts`
- [x] 4.2 Chamar `SetupRepository.getInstance().initialize()` no `initialize()` do Oracle
- [x] 4.3 No início de `chat()`, verificar `isCompleted()` e montar bloco `## [FIRST-TIME SETUP]` com lista de campos faltantes (`getMissingFields()`)
- [x] 4.4 Injetar bloco de setup no system prompt quando setup pendente
- [x] 4.5 Registrar `buildSetupTool()` na lista de ferramentas do Oracle (disponível apenas quando setup ativo, ou sempre com guard interno)

## 5. Danger Zone

- [x] 5.1 Adicionar limpeza de `setup_state` no endpoint de factory reset em `src/http/routers/danger.ts`
- [x] 5.2 Chamar `SetupRepository.reset()` no fluxo de reset que inclui `sessions`

## 6. Testes

- [x] 6.1 Criar `src/runtime/setup/__tests__/repository.test.ts` com testes de `isCompleted`, `getMissingFields`, `markCompleted`, `reset`
- [x] 6.2 Testar `buildSetupTool`: campos salvos no DB, memórias criadas no Sati, `__completed__` marcado quando todos coletados
- [x] 6.3 Testar bloco de setup injetado no system prompt quando pending, ausente quando completo
