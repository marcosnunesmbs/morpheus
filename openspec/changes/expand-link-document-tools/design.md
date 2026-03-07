## Context

O Link é o subagente de documentação do Morpheus. Atualmente possui três tools:
- `link_list_documents` - lista documentos indexados
- `link_search_documents` - busca híbrida (vector + BM25) em todos os docs
- `link_search_in_document` - busca em documento específico

O Link usa um ReactAgent com LLM via ProviderFactory. As tools são DynamicStructuredTool que usam o repositório e search internos.

## Goals / Non-Goals

**Goals:**
1. Adicionar 4 novas tools para manipulação de documentos (resumo, pontos-chave, comparação)
2. Atualizar systemMessage para incluir citação de fontes com scores na resposta

**Non-Goals:**
- Não modificar a API HTTP do Link (apenas tools internas do subagent)
- Não criar novos endpoints ou modificar UI
- Não alterar o formato de armazenamento (chunks, embeddings permanecem iguais)

## Decisões

### Decisão 1: Nova tool `link_summarize_document`
- **Escolha:** Passar todo o conteúdo do documento para o LLM fazer resumo
- **Alternativa considerada:** Resumo por chunks e depois agregar - mais complexo, menos preciso
- **Rationale:** O LLM já tem contexto longo suficiente para resumir documentos típicos

### Decisão 2: Nova tool `link_summarize_chunk`
- **Escolha:** Resumir chunk específico (identificado por document_id + position)
- **Alternativa considerada:** Buscar chunks relevantes primeiro - já coberto por search
- **Rationale:** Útil quando usuário já sabe qual chunk quer resumir

### Decisão 3: Nova tool `link_extract_key_points`
- **Escolha:** Extrair pontos-chave via LLM, retornando lista estruturada
- **Alternativa considerada:** Retornar texto livre - menos útil para consumo programático
- **Rationale:** Formato estruturado facilita uso posterior

### Decisão 4: Nova tool `link_find_differences`
- **Escolha:** Comparar dois documentos (ou seções) via LLM
- **Alternativa considerada:** Comparação via diff textual - não faz sentido para documentos diferentes
- **Rationale:** Útil para comparar contratos, versões de documentos

### Decisão 5: Citação de fontes com scores
- **Escolha:** Instruir o Link a incluir no final da resposta uma lista de fontes com scores
- **Alternativa considerada:** Retornar JSON estruturado -用户 pediu para esquecer isso
- **Rationale:** Mantém resposta em linguagem natural mas adiciona transparência

## Risks / Trade-offs

- **[Risco]** Resumo de documentos muito grandes pode exceder contexto do LLM
  - **Mitigação:** Limitar a primeiro N chunks (ex: primeiro 50 chunks = ~50KB texto)
  
- **[Risco]** Múltiplas chamadas ao LLM para mesma operação
  - **Mitigação:** Cada tool faz uma chamada - comportamento esperado

- **[Trade-off]** Citação de fontes é instrução no systemMessage, não garantida
  - **Mitigação:** O LLM tende a seguir instruções de systemMessage, mas não é 100% confiável

## Open Questions

- Qual o limite máximo de chunks para resumir? (sugestão: 50)
- O resumo deve ter tamanho máximo em tokens? (sugestão: deixar LLM decidir)
- Para `link_find_differences`, como identificar "seções" para comparar? (por enquanto, comparar documentos inteiros)