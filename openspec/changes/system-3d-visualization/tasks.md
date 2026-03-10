<tasks>
# Implementation Tasks

## 1. Backend: SSE Endpoint & Event Bus
- [x] 1.1 Modificar `DisplayManager` (`src/runtime/display.ts`) para herdar ou compor um `EventEmitter`.
- [x] 1.2 Emitir eventos (ex: `execution_start`, `execution_end`, `message`) sempre que métodos como `startSpin()`, `stopSpin()`, `info()` forem chamados.
- [x] 1.3 Criar o endpoint `GET /api/display/stream` no backend (provavelmente adicionando um router `src/http/routers/display.ts` e exportando no `src/http/api.ts`).
- [x] 1.4 Implementar a lógica de Server-Sent Events (SSE) nesse endpoint: enviar headers adequados, mapear e enviar payloads de eventos JSON para o stream do cliente conectado, cuidando para limpar os listeners de eventos quando a request do cliente encerrar (close/disconnect).

## 2. Frontend: Data Layer & SSE Consumption
- [x] 2.1 Adicionar dependências 3D no `src/ui/package.json`: `npm install three @react-three/fiber @react-three/drei` (lembrar do `--legacy-peer-deps` ou equivalente se houver conflito de versão).
- [x] 2.2 Adicionar tipos no `src/ui/package.json`: `npm install -D @types/three`.
- [x] 2.3 Criar um hook React (`src/ui/src/hooks/useSystemStream.ts` ou equivalente) que instancie o `EventSource("/api/display/stream")` e armazene o último evento/estado ativo.

## 3. Frontend: Componentes WebGL
- [x] 3.1 Criar o componente `MorpheusVisualizer.tsx` (ou similar) contendo o `<Canvas />`.
- [x] 3.2 Criar componentes 3D internos: `<OracleNode />`, `<AgentNode />`, `<SynapseLink />` (modelos básicos esféricos usando hooks de frame do `drei` e do `useFrame` para pulsações matemáticas triviais).
- [x] 3.3 Buscar as cores baseadas no `/api/agents/metadata` (usando o recém criado hook ou SWR atual) para texturizar as esferas dos subagentes no 3D com a coloração oficial.
- [x] 3.4 Injetar o estado global de "atividade" da API no Canvas param que ele ative efeitos Glowing ou movimentação nas partículas do Subagente apropriado (pelo `agentKey` ou `auditAgent` enviado no evento).
- [x] 3.5 Inserir o novo Componente no `Layout.tsx` (ex: Header reduzido?), no `Dashboard.tsx`, ou em um modal global dedicado ativado por atalho/botão.
</tasks>
