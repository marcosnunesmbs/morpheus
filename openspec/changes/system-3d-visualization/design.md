<design>
# Design

## Architecture
**Problema:** Sincronizar logs da CLI gerados pelo `DisplayManager` com a interface web (Dashboard) para alimentar a rede nodal WebGL em tempo real.

**Arquitetura Proposta:**
1. **Backend - Event Bus:** O `DisplayManager` será modificado para não apenas escrever no console local (stdout/stderr), mas também atuar (ou embutir) como um `EventEmitter`. Ele emitirá eventos estruturados (ex: `execution_start`, `execution_end`, `agent_status_change`).
2. **Backend - API Transport:** Um novo endpoint dedicado para Server-Sent Events (SSE) será criado, por ex: `GET /api/display/stream`. Quando um cliente conecta, ele se inscreve no `EventEmitter` do `DisplayManager` e passa a receber streams de bytes JSON das atividades do sistema instantaneamente. (SSE é preferível ao WebSocket pois a comunicação é unicamente Server-to-Client e lidará melhor com auto-reconnect nativo do browser).
3. **Frontend - Data Layer:** No layer React do Dashboard (provavelmente na home `src/ui/src/pages/Dashboard.tsx` ou em um componente genérico), um custom hook `useDisplayStream()` vai abrir a conexão `EventSource` e popular um estado global mínimo contendo as atividades recentes ou "em andamento" (active tasks).
4. **Frontend - UI Layer (WebGL):** 
   - A biblioteca `@react-three/fiber` (e utilitários do `@react-three/drei`) será introduzida no front para cuidar do loop de renderização nativo e de forma performática da GPU.
   - O modelo em tela terá `Oracle` estático ao centro, `Subagentes` buscando dados de `/api/agents/metadata` (para aplicar a mesma cor dos badges de chat para cada esfera em órbita do Oracle) e conexões que piscam ou disparam partículas do Oracle para o Subagente sempre que o SSE notificar a execução de uma tool.

## Key Decisions
- **Uso de SSE vs WebSockets vs Polling:** SSE foi selecionado por ter um overhead de implementação minúsculo no `Express.js` padrão do Node. Não exige upgrades de protocolo pesados como o WS para stream unidirecional e impede travetas por long-polling. O browser cuida da reconexão.
- **`@react-three/fiber` vs Framer Motion SVG:** O WebGL puro foi selecionado pois as partículas e a fluência do 3D proporcionam uma melhor estética _premium_. RNFiber converte declarativamente em Canvas, o que diminui a fricção de implementação em projetos que já usam React 19.
- **Responsividade e Performance do 3D:** Animar Canvas no mesmo thread da UI pode deixar o chat lento ou pesado em mobile. Por isso o Canvas precisará de otimizações de frustum culling, baixo poly-count e suspensão (frameloop="demand") caso o usuário não esteja olhando diretamente pro gráfico ou minimize a aba.

## Context
O sistema morpheus utiliza `Express.js` gerenciado em `src/http/server.ts` e `src/http/api.ts`. O módulo de exibição de log e estados mora em `src/runtime/display.ts` e é global/singleton. A UI fica em `src/ui/`, criada em Vite. Todo este stack é em TypeScript ESM moderno. Esta funcionalidade visual foi solicitada com o objetivo de adicionar uma sensação futurista (tipo "Matrix") ao se ver a orquestração do Oracle aos seus agentes Link, Neo, Trinity e Apoc.
</design>
