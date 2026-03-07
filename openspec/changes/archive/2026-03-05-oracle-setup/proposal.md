## Why

Oracle não conhece nada sobre o usuário na primeira execução — sem nome, sem fuso horário, sem contexto pessoal. Essa informação é valiosa para personalizar as respostas, mas hoje nunca é coletada de forma estruturada. Um setup guiado de primeira execução resolve isso sem precisar de formulários na UI.

## What Changes

- Nova tabela `setup_state` no `short-memory.db` para persistir campos coletados e flag de conclusão
- Nova ferramenta `setup_save` disponível para o Oracle durante o setup
- Oracle detecta primeiro uso e injeta bloco de instrução de setup no system prompt
- Após conclusão do setup, campos são salvos no Sati como memórias pessoais
- Setup nunca é exibido novamente após concluído
- Campos configuráveis via `zaion.yaml` (quais informações coletar)

## Capabilities

### New Capabilities

- `oracle-setup`: Fluxo de onboarding de primeira execução — coleta informações do usuário via conversa natural e persiste no Sati

### Modified Capabilities

- `oracle`: Sistema prompt do Oracle passa a incluir bloco condicional de setup quando `setup_completed = false`

## Impact

- **Backend**: `src/runtime/setup/` (novo módulo), `oracle.ts` (verificação no `chat()`), `short-memory.db` (nova tabela)
- **Config**: `src/config/schemas.ts` + `src/types/config.ts` + `src/config/manager.ts`
- **Sati**: campos do setup salvos como memórias via `SatiRepository`
- **Sem breaking changes** — feature aditiva, defaults fazem o setup ser opcional via config
