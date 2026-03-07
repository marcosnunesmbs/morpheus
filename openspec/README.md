# OpenSpec — Morpheus

Especificacoes comportamentais do sistema, organizadas por dominio.

## Estrutura

### specs/
Source of truth — como o sistema atualmente se comporta.

| Dominio | Descricao |
|---------|-----------|
| [oracle](specs/oracle/spec.md) | Orquestrador raiz: ReactAgent, historico de sessao, roteamento de subagentes |
| [subagents](specs/subagents/spec.md) | Padrao de delegacao: SubagentRegistry, Apoc, Trinity, Neo, Link |
| [chronos](specs/chronos/spec.md) | Motor de agendamento temporal: cron, once, interval |
| [channels](specs/channels/spec.md) | Adaptadores de canal: Telegram, Discord, ChannelRegistry |
| [tasks](specs/tasks/spec.md) | Fila de tarefas asincronas: worker, retry, entrega de resultados |
| [webhooks](specs/webhooks/spec.md) | Recepcao de eventos externos e despacho para Oracle |
| [skills](specs/skills/spec.md) | Instrucoes customizadas por dominio carregadas via SKILL.md |
| [smiths](specs/smiths/spec.md) | Execucao remota de DevKit via WebSocket |
| [audit](specs/audit/spec.md) | Trilha de eventos: LLM calls, tool calls, ciclo de vida de tarefas |
| [memory](specs/memory/spec.md) | Persistencia de conversas, sessoes e memoria de longo prazo (Sati) |
| [devkit](specs/devkit/spec.md) | Ferramentas de execucao local com sandbox de seguranca |
| [config](specs/config/spec.md) | Gerenciamento de configuracao: YAML, env vars, defaults |
| [ui](specs/ui/spec.md) | Dashboard React: sistema de temas, tokens de cor, layout, componentes, paginas |

### changes/
Modificacoes propostas. Cada change vive em sua propria pasta ate ser mergeada.

## Como usar

- Para entender o sistema atual, leia `specs/{dominio}/spec.md`
- Para propor uma mudanca, crie `changes/{nome-da-mudanca}/`
- Para mergear uma mudanca, aplique os deltas e arquive o change

## Convencoes

- Requisitos usam keywords RFC 2119 (SHALL, MUST, SHOULD, MAY)
- Cenarios seguem formato Given/When/Then
- Specs descrevem **comportamento**, nao implementacao
