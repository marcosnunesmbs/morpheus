## ADDED Requirements

### Requirement: link_summarize_document
O sistema DEVE permitir resumir um documento indexado inteiro via LLM.

#### Scenario: Resumir documento por ID
- **WHEN** usuário chama link_summarize_document com document_id válido
- **THEN** o sistema retorna resumo do documento gerado pelo LLM

#### Scenario: Resumir documento inexistente
- **WHEN** usuário chama link_summarize_document com document_id inexistente
- **THEN** o sistema retorna erro "Document not found: {document_id}"

### Requirement: link_summarize_chunk
O sistema DEVE permitir resumir um chunk específico de um documento.

#### Scenario: Resumir chunk por posição
- **WHEN** usuário chama link_summarize_chunk com document_id e position válidos
- **THEN** o sistema retorna resumo do chunk específico

#### Scenario: Resumir chunk inexistente
- **WHEN** usuário chama link_summarize_chunk com position maior que chunk_count
- **THEN** o sistema retorna erro "Chunk not found: position {position}"

### Requirement: link_extract_key_points
O sistema DEVE permitir extrair pontos-chave de um documento via LLM.

#### Scenario: Extrair pontos-chave de documento
- **WHEN** usuário chama link_extract_key_points com document_id válido
- **THEN** o sistema retorna lista de pontos-chave do documento

#### Scenario: Extrair pontos-chave sem documento
- **WHEN** usuário chama link_extract_key_points sem document_id
- **THEN** o sistema retorna erro "document_id é obrigatório"

### Requirement: link_find_differences
O sistema DEVE permitir comparar dois documentos e identificar diferenças.

#### Scenario: Comparar dois documentos
- **WHEN** usuário chama link_find_differences com dois document_id válidos
- **THEN** o sistema retorna análise de diferenças entre os documentos

#### Scenario: Comparar documento consigo mesmo
- **WHEN** usuário chama link_find_differences com o mesmo document_id
- **THEN** o sistema retorna "Os documentos são idênticos"

### Requirement: Citação de fontes na resposta
O sistema DEVE instruir o Link a incluir no final da resposta a lista de fontes consultadas com seus scores.

#### Scenario: Resposta inclui fontes
- **WHEN** Link responde uma pergunta usando documentos
- **THEN** a resposta inclui no final uma seção "Fontes consultadas:" com lista de documentos e scores

#### Scenario: Resposta sem fontes
- **WHEN** Link responde uma pergunta sem usar documentos
- **THEN** a resposta não inclui seção de fontes (comportamento normal)