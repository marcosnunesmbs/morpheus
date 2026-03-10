<proposal>
<context>
# Problem
O sistema Morpheus orquestra múltiplos subagentes (Apoc, Trinity, Neo, Link, Smith) a partir de um Oracle central, delegando tarefas e executando ferramentas (DevKit, MCP) em background. Atualmente, toda essa rica atividade assíncrona é logada apenas em texto (CLI/arquivo) via `DisplayManager`. O dashboard carece de uma visualização premium que demonstre a arquitetura nodal e a inteligência do sistema operando em tempo real, dificultando o entendimento intuitivo do fluxo de trabalho e diminuindo o impacto visual da plataforma.

# Solution
Implementar uma visualização 3D interativa em tempo real no Dashboard (usando WebGL/React Three Fiber ou framer-motion avançado) que atue como uma representação do modelo mental do Morpheus. A visualização consistirá em:
1. Uma esfera central (Oracle) pulsante.
2. Esferas orbitais (Subagentes) coloridas de acordo com suas identidades (`SubagentRegistry`).
3. Satélites menores (ferramentas/MCPs) orbitando os subagentes.
4. "Sinapses" (feixes/partículas de luz) disparadas do Oracle para os subagentes quando ferramentas são invocadas.
5. Um novo endpoint (WebSocket ou SSE) consumindo eventos do `DisplayManager` para alimentar a UI com dados reais (nome da tool, duração, agente).
</context>

<requirements>
# Modified Capabilities
- **Dashboard UI**: Passa a contar com um componente gráfico interativo (3D/2D avançado) ilustrando a topologia dos agentes.
- **DisplayManager**: Precisará emitir seus eventos não apenas para o stdout, mas também para um barramento em tempo real (EventEmmiter/PubSub) que será consumido pela API.

# Impact
- **Backend**: Criação de um novo endpoint `/api/display/stream` (SSE/WS). Modificações menores no `DisplayManager`.
- **Frontend**: Inclusão de pacotes como `three` e `@react-three/fiber` (se optado por WebGL) e criação de componentes visuais complexos. Performance do dashboard deve ser cuidada para não sacrificar o uso de CPU/GPU em excesso.
</requirements>
</proposal>
