# Feature Specification: Gerenciamento Persistente de Sessões do Telegram e Discord

**Feature Branch**: `027-persist-channel-sessions`
**Created**: 2026-03-05
**Status**: Draft
**Input**: User description: "precisamos criar um gerenciamento de sessão que o canal discord e telegram estão usando, de maneira persistente. sempre que o morpheus reinicia o telegram ou o discord não estão em uma sessão específica."

## Clarifications

### Session 2026-03-05

- Q: Qual abordagem de armazenamento deve ser usada para as sessões persistidas? → A: Banco de dados SQLite existente (memory/short-memory.db) com tabela channel_sessions

## User Scenarios & Testing

### User Story 1 - Persistência de Sessão do Telegram (Priority: P1)

Como administrador do Morpheus, quero que a sessão do Telegram seja salva persistentemente para que, ao reiniciar o daemon, o bot continue operacional na mesma sessão sem necessidade de reautenticação.

**Why this priority**: Esta é a funcionalidade central mais crítica. Sem persistência da sessão do Telegram, cada reinício do Morpheus exige reautenticação manual, interrompendo o serviço e a comunicação com usuários.

**Independent Test**: Configurar o canal Telegram, autenticar, reiniciar o Morpheus e verificar que o bot está imediatamente operacional sem solicitar reautenticação.

**Acceptance Scenarios**:

1. **Given** que o canal Telegram está configurado e autenticado, **When** o Morpheus é reiniciado, **Then** o bot do Telegram deve estar imediatamente operacional na mesma sessão
2. **Given** que existe uma sessão salva do Telegram, **When** o Morpheus inicia, **Then** deve carregar automaticamente a sessão persistida
3. **Given** que a sessão do Telegram expirou ou foi revogada, **When** o Morpheus tenta carregar, **Then** deve solicitar reautenticação de forma clara

---

### User Story 2 - Persistência de Sessão do Discord (Priority: P1)

Como administrador do Morpheus, quero que a sessão do Discord seja salva persistentemente para que, ao reiniciar o daemon, o bot continue operacional na mesma sessão sem necessidade de reautenticação.

**Why this priority**: Assim como o Telegram, o Discord é um canal primário de comunicação. A falta de persistência interrompe o serviço e exige intervenção manual a cada reinício.

**Independent Test**: Configurar o canal Discord, autenticar, reiniciar o Morpheus e verificar que o bot está imediatamente operacional sem solicitar reautenticação.

**Acceptance Scenarios**:

1. **Given** que o canal Discord está configurado e autenticado, **When** o Morpheus é reiniciado, **Then** o bot do Discord deve estar imediatamente operacional na mesma sessão
2. **Given** que existe uma sessão salva do Discord, **When** o Morpheus inicia, **Then** deve carregar automaticamente a sessão persistida
3. **Given** que o token do Discord expirou ou foi revogado, **When** o Morpheus tenta carregar, **Then** deve notificar o administrador sobre a necessidade de renovar as credenciais

---

### User Story 3 - Gerenciamento de Estado de Sessão (Priority: P2)

Como administrador, quero visualizar o estado das sessões dos canais (Telegram e Discord) para saber se estão ativas, expiradas ou necessitam reautenticação.

**Why this priority**: Permite diagnóstico rápido de problemas de conexão sem necessidade de analisar logs ou tentar enviar mensagens.

**Independent Test**: Acessar a interface de configurações e verificar o status de cada canal (conectado/desconectado/erro).

**Acceptance Scenarios**:

1. **Given** que ambos os canais estão operacionais, **When** o administrador acessa as configurações, **Then** deve ver o status "Conectado" para cada canal ativo
2. **Given** que uma sessão expirou, **When** o administrador acessa as configurações, **Then** deve ver o status "Erro" ou "Expirado" com instrução de reautenticação
3. **Given** que o canal nunca foi configurado, **When** o administrador acessa as configurações, **Then** deve ver o status "Não configurado"

---

### User Story 4 - Invalidação Segura de Sessão (Priority: P3)

Como administrador, quero poder invalidar/remover sessões salvas do Telegram e Discord para revogar acesso quando necessário.

**Why this priority**: Funcionalidade de segurança importante para casos em que as credenciais possam ter sido comprometidas ou quando se deseja desconectar permanentemente um canal.

**Independent Test**: Acessar configurações, executar ação de "Desconectar" ou "Remover Sessão" e verificar que o canal requer nova autenticação.

**Acceptance Scenarios**:

1. **Given** que existe uma sessão salva do Telegram, **When** o administrador executa "Desconectar", **Then** a sessão deve ser removida e o canal deve solicitar reautenticação
2. **Given** que existe uma sessão salva do Discord, **When** o administrador executa "Desconectar", **Then** a sessão deve ser removida e o canal deve solicitar renovação do token
3. **Given** que uma sessão foi removida, **When** o Morpheus é reiniciado, **Then** não deve haver tentativa de carregar sessão inexistente

---

### Edge Cases

- **O que acontece quando o registro de sessão no banco de dados está corrompido?**: O sistema deve detectar a corrupção, notificar o erro, remover o registro inválido e solicitar nova autenticação
- **Como o sistema lida com múltiplas instâncias do Morpheus acessando o mesmo banco de dados?**: O banco de dados SQLite deve usar locking transacional para evitar corrupção por concorrência
- **O que acontece quando as permissões de leitura/escrita do banco de dados são revogadas?**: O sistema deve logar erro claro e operar sem persistência (fallback para comportamento volátil)
- **Como o sistema lida com tokens do Discord que expiram durante a execução?**: Deve tentar refresh automático do token quando possível, ou notificar para reautenticação
- **O que acontece ao migrar o Morpheus para outra máquina?**: As sessões persistidas no banco de dados devem ser portáveis (com ressalva de que tokens podem estar vinculados a IP/ambiente)

## Requirements

### Functional Requirements

- **FR-001**: Sistema DEVE persistir a sessão do Telegram em tabela `channel_sessions` no banco de dados SQLite existente (`memory/short-memory.db`)
- **FR-002**: Sistema DEVE persistir o token do Discord em tabela `channel_sessions` no banco de dados SQLite existente (`memory/short-memory.db`)
- **FR-003**: Sistema DEVE carregar automaticamente as sessões persistidas ao iniciar o daemon
- **FR-004**: Sistema DEVE validar a integridade das sessões carregadas (estrutura esperada e validade)
- **FR-005**: Sistema DEVE notificar o administrador quando uma sessão falhar ao carregar (expirada, corrompida, inválida)
- **FR-006**: Sistema DEVE prover mecanismo para invalidar/remover sessões persistidas via interface de configuração
- **FR-007**: Sistema DEVE atualizar o registro de sessão do Telegram sempre que houver refresh automático do token
- **FR-008**: Sistema DEVE criptografar dados sensíveis das sessões persistidas (tokens, session strings) antes de armazenar no banco de dados
- **FR-009**: Sistema DEVE expor o status da sessão (ativa/expirada/não configurada) via API para a interface UI
- **FR-010**: Sistema DEVE lidar gracefulmente com ausência de sessão persistida (iniciar fluxo de autenticação do zero)

### Key Entities

- **SessionStore**: Repositório responsável por ler, escrever e gerenciar sessões persistidas dos canais no banco de dados SQLite. Armazena session string (Telegram) e tokens (Discord) com metadados (timestamp, validade, channel)
- **TelegramSession**: Representa uma sessão ativa do Telegram, contendo session string, informações de auth (user_id, phone), e metadata de validade
- **DiscordSession**: Representa uma sessão ativa do Discord, contendo bot token, informações do bot (id, username), e metadata de validade
- **ChannelRegistry**: Singleton que gerencia todos os canais adaptadores, responsável por inicializar adapters com sessões persistidas

## Success Criteria

### Measurable Outcomes

- **SC-001**: Após reinício do Morpheus, canais Telegram e Discord devem estar operacionais em até 10 segundos sem intervenção manual
- **SC-002**: Sessões persistidas devem sobreviver a pelo menos 100 ciclos de reinício do daemon sem corrupção ou perda de dados
- **SC-003**: 100% dos dados sensíveis das sessões (tokens, session strings) devem estar criptografados em repouso
- **SC-004**: Interface UI deve exibir status de sessão (Conectado/Desconectado/Erro) para cada canal em tempo real
- **SC-005**: Tempo de carregamento de sessão persistida ao iniciar não deve exceder 5 segundos por canal
- **SC-006**: Sistema deve detectar e recuperar de sessão corrompida em até 30 segundos, solicitando reautenticação de forma clara
