## Context

O projeto Morpheus é um agente AI local-first para desenvolvedores, com uma interface web dashboard que atualmente apresenta problemas de responsividade em dispositivos móveis. Três áreas específicas precisam de correções: as tabs na página de configurações, os selects na página SatiMemories e a sobreposição do menu na página de logs. Estes problemas afetam a experiência do usuário em dispositivos móveis.

## Goals / Non-Goals

**Goals:**
- Implementar rolagem lateral nas tabs da página de configurações quando em dispositivos móveis
- Fazer com que os selects de importância e categorias na página SatiMemories fiquem empilhados verticalmente em dispositivos móveis
- Corrigir sobreposição do menu na página de logs em dispositivos móveis
- Garantir consistência no layout responsivo em todas as páginas do dashboard
- Manter a funcionalidade existente em dispositivos desktop

**Non-Goals:**
- Redesenhar completamente as interfaces das páginas afetadas
- Modificar a funcionalidade principal do sistema
- Alterar layouts em dispositivos desktop
- Implementar novas funcionalidades além das correções de responsividade

## Decisions

1. **Abordagem de rolagem lateral para tabs**: Usaremos a propriedade CSS `overflow-x: auto` combinada com `display: flex` e `white-space: nowrap` para permitir rolagem horizontal nas tabs em dispositivos móveis.

2. **Layout de formulário em dispositivos móveis**: Utilizaremos classes do Tailwind CSS para alterar o layout de elementos de formulário de horizontal (em desktop) para vertical (em mobile), usando `flex-col` em vez de `flex-row` em telas pequenas.

3. **Breakpoints para responsividade**: Usaremos os breakpoints padrão do Tailwind CSS (sm: 640px, md: 768px, lg: 1024px) para definir quando aplicar os estilos responsivos.

4. **Abordagem de sobreposição do menu**: Implementaremos um espaçamento adequado na página de logs para evitar sobreposição com o menu superior em dispositivos móveis, possivelmente usando padding-top condicional.

## Risks / Trade-offs

[Risco de performance em dispositivos móveis mais lentos] → Mitigação: Usar estilos CSS simples e eficientes, evitando JavaScript desnecessário para funcionalidades de layout

[Risco de inconsistência entre versões mobile e desktop] → Mitigação: Manter o mesmo conteúdo e fluxo de navegação em ambas as versões, apenas alterando o layout e disposição visual

[Risco de conflito com código existente] → Mitigação: Modularizar as mudanças e testar cuidadosamente para evitar efeitos colaterais