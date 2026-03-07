## Why

O Link é o subagente de documentação do Morpheus, mas hoje possui apenas ferramentas básicas de busca (listar documentos, busca híbrida global, busca em documento específico). Faltam ferramentas para análise mais profunda como resumos e extração de informações. Além disso, não há instrução padronizada para que o Link cite as fontes consultadas com seus respectivos scores na resposta final.

## What Changes

1. **Nova tool: `link_summarize_document`** - Resumir documento inteiro via LLM
2. **Nova tool: `link_summarize_chunk`** - Resumir chunk específico via LLM
3. **Nova tool: `link_extract_key_points`** - Extrair pontos-chave de documentos
4. **Nova tool: `link_find_differences`** - Comparar seções entre documentos
5. **Atualizar systemMessage do Link** - Incluir instrução para citar fontes com scores no final da resposta

## Capabilities

### New Capabilities
- `link-summarize`: Capacidade de resumir documentos ou chunks específicos via LLM
- `link-analyze`: Capacidade de extrair pontos-chave e comparar documentos

### Modified Capabilities
- (nenhuma modificação em capabilities existentes - apenas adição de novas tools e atualização do systemMessage)

## Impact

- **Código afetado:** `src/runtime/link.ts` (adição de novas tools, atualização do systemMessage)
- **APIs afetadas:** Nenhuma - ferramentas internas do subagente
- **Dependências:** Nenhuma nova dependência - usa LLM existente via ProviderFactory
- **UI:** Nenhuma mudança necessária no frontend