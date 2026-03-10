<specification>
# system-3d-visualization specs

## 1. Backend: SSE Endpoint & Event Bus
**Feature:** O `DisplayManager` atual precisa emitir eventos que possam ser consumidos via rede.

- **Scenario 1.1:** O `DisplayManager` recebe uma chamada de log via método `info`, `warn`, `error` ou `spinner` (ex: `startSpin()`, `stopSpin()`).
  - **GIVEN** que a aplicação está rodando.
  - **WHEN** uma atividade de subagente é iniciada (ex: `DisplayManager.getInstance().startSpin('executing apoc...')`).
  - **THEN** o `DisplayManager` (ou um novo módulo atrelado a ele) emite um evento no event emitter interno contendo `{ type: 'activity_start', agent: 'apoc', message: 'executing apoc...', timestamp: 123456 }`.

- **Scenario 1.2:** Endpoint SSE é acessado por cliente HTTP.
  - **GIVEN** que o server express do Morpheus no `src/http/api.ts` está ativo.
  - **WHEN** um `GET /api/display/stream` é recebido.
  - **THEN** o servidor responde com headers `Content-Type: text/event-stream`, `Cache-Control: no-cache` e mantém a conexão aberta.
  - **AND THEN** sempre que o `DisplayManager` emitir evento, o worker empurra uma string formatada `data: JSON.stringify(evento)\n\n` para a resposta ativa.

## 2. Frontend: Componente Visual WebGL
**Feature:** Exibir de maneira interativa a "Mente" do Morpheus em tela.

- **Scenario 2.1:** Conexão de Eventos na Tela.
  - **GIVEN** o Dashboard da WebUI (`src/ui/src/pages/Dashboard.tsx`).
  - **WHEN** o componente é montado.
  - **THEN** ele instancia um `EventSource("/api/display/stream")` (via novo Hook `useSystemStream()`) e começa a consumir o estado atual (lista de tarefas/pulsos recentes).

- **Scenario 2.2:** Renderização do Oracle e Subagentes.
  - **GIVEN** um `<Canvas>` do react-three-fiber instanciado.
  - **WHEN** os dados de estado provarem que não há atividade.
  - **THEN** exibe-se 1 esfera central grande ("Oracle") e 5 satélites estáticos orbitando de forma inerte ("Apoc", "Neo", "Trinity", "Smith" e "Link"), com texturas e colorações extraídas do `/api/agents/metadata`.

- **Scenario 2.3:** Animação de Chamada de Ferramenta.
  - **GIVEN** que a API enviou um evento `activity_start` para o agente "neo" chamando "mcp_tool".
  - **WHEN** o hook reativo atualizar o estado da scene 3D.
  - **THEN** uma partícula de luz (ou link de conexão glowing) viaja do Oracle central até a esfera do "Neo".
  - **AND THEN** a esfera do Neo pulsa, muda seu tamanho momentaneamente e ativa uma "aura" de atividade até que chegue o evento `activity_end`.

## Technical Constraints
- As dependências `@react-three/fiber`, `three` e `@react-three/drei` devem ser incluídas apenas no frontend (`src/ui/package.json`).
- Respeitar os temas de cor (Dark Mode vs Light Mode) na UI no Canvas (ex: coloração do material do Oracle ser adaptativa).
</specification>
