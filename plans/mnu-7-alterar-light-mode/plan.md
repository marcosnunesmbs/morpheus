# Alterar Light Mode para Tons de Azul

**Branch:** `marcosnunesmbs/mnu-7-alterar-light-mode`
**Description:** Substituir cores verdes do light mode por uma paleta profissional de tons de azul

## Goal
Melhorar a experiência visual do Morpheus em light mode, substituindo as cores verdes (herdadas do tema Matrix) por uma paleta moderna de tons de azul. Isso criará uma distinção clara entre os modos light (azul profissional) e dark (verde Matrix), mantendo a identidade visual e acessibilidade WCAG AA.

## Implementation Steps

### Step 1: Definir Paleta Azure e Atualizar Tailwind Config
**Files:** `src/ui/tailwind.config.js`, `src/ui/src/index.css`
**What:** Adicionar nova paleta de cores `azure` ao Tailwind com tons de azul profissionais (primary: #0066CC, secondary: #4A90E2, accent: #2196F3, backgrounds, borders, etc.). Atualizar estilos base do `index.css` para scrollbar e background em light mode usando as novas cores.
**Testing:** 
- Executar `npm run dev --prefix src/ui` e verificar se o build compila sem erros
- Inspecionar elementos no DevTools e confirmar que classes `azure-*` estão disponíveis
- Usar WebAIM Contrast Checker para validar ratios de contraste (mínimo 4.5:1 para texto)

### Step 2: Atualizar Layout Principal e Navegação
**Files:** `src/ui/src/components/Layout.tsx`
**What:** Substituir todas as referências a cores verdes em light mode (`text-green-700`, `bg-green-100`, `text-green-800`) por equivalentes azuis (`text-azure-primary`, `bg-azure-active`, etc.). Atualizar header, sidebar, navegação ativa/inativa e estados hover para usar a paleta azure.
**Testing:**
- Alternar para light mode no navegador
- Verificar que o título "MORPHEUS" está azul
- Clicar em diferentes páginas da navegação e confirmar estados ativos (fundo azul claro)
- Testar hover nos links da sidebar

### Step 3: Atualizar Páginas Principais
**Files:** `src/ui/src/pages/Dashboard.tsx`, `src/ui/src/pages/UsageStats.tsx`, `src/ui/src/pages/Config.tsx`, `src/ui/src/pages/Logs.tsx`
**What:** Aplicar substituição sistemática de classes de cor em light mode: `bg-gray-50` → `bg-azure-bg`, `bg-white` → `bg-azure-surface`, `border-gray-200` → `border-azure-border`, `text-gray-900` → `text-azure-text-primary`, `text-gray-600` → `text-azure-text-secondary`, `hover:bg-gray-100` → `hover:bg-azure-hover`. Preservar todas as classes `dark:` intactas.
**Testing:**
- Navegar para cada página em light mode
- Verificar fundos, bordas, textos e cards estão com tons de azul
- Alternar para dark mode e confirmar que o tema Matrix verde permanece inalterado
- Testar animações do Framer Motion (devem continuar suaves)

### Step 4: Atualizar Componentes de Dashboard e Formulários
**Files:** `src/ui/src/components/StatCard.tsx`, `src/ui/src/components/UsageStatsWidget.tsx`, `src/ui/src/components/FormSection.tsx`, `src/ui/src/components/TextInput.tsx`, `src/ui/src/components/SelectInput.tsx`, `src/ui/src/components/NumberInput.tsx`, `src/ui/src/components/ToggleSwitch.tsx`
**What:** Atualizar componentes reutilizáveis para usar paleta azure em light mode. Como esses componentes são usados em todo o app, uma atualização aqui propagará para todas as instâncias automaticamente.
**Testing:**
- Verificar StatCards no Dashboard mostram fundos/bordas azuis em light mode
- Testar formulários na página Config (inputs, dropdowns, toggles)
- Confirmar que placeholders, labels e bordas usam tons de azul consistentes

### Step 5: Redesenhar Login Page e Tratar Casos Especiais
**Files:** `src/ui/src/pages/Login.tsx`, `src/ui/src/components/AuthLayout.tsx`
**What:** Substituir todas as referências verdes (`text-green-500`, `border-green-500`, `bg-green-900`) por azuis (`text-azure-accent`, `border-azure-primary`, `bg-azure-primary`). Atualizar estados de loading (`text-green-500 animate-pulse`) em UsageStats para `text-azure-accent`. Revisar notificações de sucesso no Config para usar tons de azul.
**Testing:**
- Fazer logout e testar a página de login em light mode (deve parecer corporativa/profissional)
- Verificar animação de loading em UsageStats ao recarregar dados
- Testar notificações de sucesso após salvar configurações no Config

### Step 6: Testes Finais e Acessibilidade
**Files:** Todos os arquivos modificados
**What:** Realizar auditoria completa de acessibilidade e consistência visual. Testar todas as páginas em ambos os modos (light/dark), verificar responsividade em mobile, validar contraste de cores com Chrome DevTools Lighthouse, e confirmar que animações funcionam sem problemas.
**Testing:**
- Executar Lighthouse audit (alvo: 95+ em acessibilidade)
- Testar em Chrome e Firefox
- Alternar entre light/dark mode em todas as páginas (Dashboard, UsageStats, Config, Logs, Login)
- Testar em viewport mobile (375px, 768px, 1024px)
- Verificar que não há regressões visuais em dark mode
- Confirmar que `localStorage.setItem('theme', 'light')` persiste corretamente
