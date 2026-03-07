## Why

A experiência mobile atual não é satisfatória porque o sidebar não se recolhe automaticamente quando acessado em dispositivos móveis. Isso prejudica a usabilidade e a navegação em telas menores, exigindo uma solução que melhore a experiência do usuário em dispositivos móveis.

## What Changes

- Implementar funcionalidade de toggle para o sidebar em dispositivos móveis
- Criar um header com menu que permite abrir/fechar o sidebar em dispositivos móveis
- Adicionar comportamento responsivo para que o sidebar se retraia automaticamente em telas menores
- Manter a funcionalidade existente em dispositivos desktop

## Capabilities

### New Capabilities
- `mobile-responsive-sidebar`: Implementa o comportamento responsivo do sidebar para dispositivos móveis, incluindo toggle e menu de navegação
- `mobile-header-menu`: Cria um header com menu para controle do sidebar em dispositivos móveis

### Modified Capabilities

## Impact

- Componentes de UI relacionados ao sidebar e header serão afetados
- Layout e estilos CSS precisarão ser ajustados para suportar o comportamento responsivo
- Componentes React existentes precisarão ser modificados para incluir a lógica de estado para o toggle do sidebar
- Experiência do usuário em dispositivos móveis será significativamente melhorada