## ADDED Requirements

### Requirement: Sistema persiste mapeamento (channel, user_id) → session_id

O sistema DEVE persistir em banco de dados qual sessão cada usuário está usando em cada canal, permitindo restauração após restart do Morpheus.

#### Scenario: Persistir mapeamento na primeira mensagem do usuário
- **WHEN** usuário envia primeira mensagem em um canal
- **THEN** sistema cria entrada na tabela `user_channel_sessions` com channel, user_id e session_id atual

#### Scenario: Persistir troca de sessão via /sessions switch
- **WHEN** usuário usa comando `/sessions` e seleciona switch para outra sessão
- **THEN** sistema atualiza entrada em `user_channel_sessions` com novo session_id

#### Scenario: Persistir criação de nova sessão via /newsession
- **WHEN** usuário usa comando `/newsession`
- **THEN** sistema atualiza entrada em `user_channel_sessions` com session_id da nova sessão

#### Scenario: Remover mapeamento ao arquivar sessão do usuário
- **WHEN** usuário arquiva a sessão que está usando atualmente
- **THEN** sistema remove entrada em `user_channel_sessions` para este usuário

#### Scenario: Remover mapeamento ao deletar sessão do usuário
- **WHEN** usuário deleta permanentemente a sessão que está usando
- **THEN** sistema remove entrada em `user_channel_sessions` para este usuário

### Requirement: Sistema restaura sessões por usuário no startup

O sistema DEVE restaurar automaticamente o mapeamento de sessões de cada usuário ao iniciar, lendo do banco de dados.

#### Scenario: Restaurar mapeamentos do Telegram no startup
- **WHEN** Morpheus inicia e Telegram adapter é conectado
- **THEN** sistema lê todas as entradas de `user_channel_sessions` onde channel='telegram' e popula userSessions Map

#### Scenario: Restaurar mapeamentos do Discord no startup
- **WHEN** Morpheus inicia e Discord adapter é conectado
- **THEN** sistema lê todas as entradas de `user_channel_sessions` onde channel='discord' e popula userSessions Map

#### Scenario: Usuário mantém sessão após restart
- **WHEN** usuário estava usando session-abc antes do restart
- **AND** Morpheus reinicia
- **THEN** próxima mensagem do usuário usa session-abc (restaurada do DB)

### Requirement: Sistema usa sessão persistida para processar mensagens

O sistema DEVE usar a sessão persistida (memória ou DB) para processar mensagens de cada usuário, com fallback para sessão global.

#### Scenario: Usar sessão da memória para usuário conhecido
- **WHEN** usuário envia mensagem
- **AND** userSessions Map já tem entrada para este userId
- **THEN** sistema usa sessionId da memória para processar mensagem

#### Scenario: Usar sessão do DB para usuário sem cache em memória
- **WHEN** usuário envia mensagem
- **AND** userSessions Map não tem entrada para este userId
- **AND** DB tem entrada em user_channel_sessions
- **THEN** sistema lê sessionId do DB, popula memória e usa para processar mensagem

#### Scenario: Criar mapeamento para usuário novo
- **WHEN** usuário envia primeira mensagem
- **AND** não existe entrada em user_channel_sessions
- **THEN** sistema usa getCurrentSessionOrCreate(), cria entrada no DB e popula memória

#### Scenario: Múltiplos usuários podem compartilhar mesma sessão
- **WHEN** usuário A e usuário B estão no mesmo canal
- **AND** ambos usam /sessions switch para session-abc
- **THEN** user_channel_sessions tem duas entradas com mesmo session_id mas user_ids diferentes

### Requirement: Tabela user_channel_sessions existe no banco

O sistema DEVE ter uma tabela `user_channel_sessions` no banco `short-memory.db` para armazenar o mapeamento.

#### Scenario: Criação automática da tabela
- **WHEN** SQLiteChatMessageHistory é inicializada
- **THEN** tabela `user_channel_sessions` é criada se não existir

#### Scenario: Schema da tabela
- **WHEN** tabela é criada
- **THEN** possui colunas: channel (TEXT), user_id (TEXT), session_id (TEXT), updated_at (INTEGER)
- **AND** PRIMARY KEY é (channel, user_id)

#### Scenario: Inserir ou atualizar mapeamento
- **WHEN** setUserChannelSession é chamado
- **THEN** sistema faz INSERT ou UPDATE (upsert) da entrada com channel+user_id como chave

#### Scenario: Consultar mapeamento
- **WHEN** getUserChannelSession é chamado com channel e user_id
- **THEN** sistema retorna session_id ou null se não existir

#### Scenario: Listar mapeamentos de um canal
- **WHEN** listUserChannelSessions é chamado com channel
- **THEN** sistema retorna array de {userId, sessionId} para todas as entradas do canal

#### Scenario: Deletar mapeamento
- **WHEN** deleteUserChannelSession é chamado com channel e user_id
- **THEN** sistema remove entrada da tabela
