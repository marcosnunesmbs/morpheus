# UI Specification

## Purpose
The Morpheus dashboard is a React 19 + Vite + TailwindCSS single-page application that provides a web interface for interacting with the daemon: chat, configuration, monitoring, and management of all subsystems.

## Scope
Included:
- Theme system: 4 themes with dual-mode (light/dark) Tailwind integration
- Color token system: Azure (light) and Matrix (dark) token families
- Layout: responsive sidebar, mobile header, full-screen page exceptions
- Routing: all pages and navigation structure
- Shared design components: Section, form inputs, modal pattern
- Chat UI: message rendering, agent blocks, @mention, markdown
- Dashboard: module cards, stat cards, animations
- Settings: tabbed configuration editor
- Data fetching: SWR-based polling

Out of scope:
- Backend API contracts (covered per domain specs)
- Per-page business logic already covered in other specs (chronos, audit, webhooks, etc.)

---

## Requirements

### Requirement: Theme system
The system SHALL support four themes, cycled sequentially by a button in the sidebar header, persisted to `localStorage`:

| Theme | Mode | `data-theme` | Description |
|-------|------|--------------|-------------|
| Matrix | dark | `matrix` | Classic dark green-on-black (default) |
| Dark Soft | dark | `dark-soft` | Muted green on dark purple |
| Azure | light | `azure` | Blue on white |
| Azure Dark | dark | `azure-dark` | Blue on dark navy |

Dark themes (Matrix, Dark Soft, Azure Dark) apply the `.dark` class to `<html>`. Tailwind `darkMode: 'class'` drives all `dark:` utility classes.

#### Scenario: Theme persisted across page loads
- GIVEN a user selects "Dark Soft" theme
- WHEN they close and reopen the browser
- THEN the "Dark Soft" theme is restored from `localStorage`

#### Scenario: Theme icon updates in sidebar
- GIVEN the current theme is "Matrix" (Monitor icon)
- WHEN the user clicks the cycle button
- THEN the theme changes to "Dark Soft" and the icon changes to CloudMoon

#### Scenario: Non-Matrix dark themes override bg-black and bg-zinc-900
- GIVEN the active theme is "Dark Soft" or "Azure Dark"
- WHEN a component uses `dark:bg-black` or `dark:bg-zinc-900`
- THEN CSS overrides apply `rgb(var(--matrix-bg))` and `rgb(var(--matrix-base))` respectively, making themes visually distinct

### Requirement: Matrix scanline effect
The system SHALL render a scanline overlay (CSS gradient pattern) in the main content area exclusively when the Matrix theme is active.

#### Scenario: Scanline only in Matrix
- GIVEN the active theme is "Azure" or "Dark Soft"
- WHEN the main content area renders
- THEN no scanline overlay is present

### Requirement: Color token system
The system SHALL use two token families for all UI coloring, applied via Tailwind utility classes:

**Azure (light mode) tokens:**
- `azure-bg` (#F0F4F8) — page background
- `azure-surface` (#FFFFFF) — card/panel backgrounds
- `azure-primary` (#0066CC) — primary actions, active nav, headings
- `azure-secondary` (#4A90E2) — secondary elements
- `azure-border` (#B3D4FC) — borders
- `azure-hover` (#E3F2FD) — hover backgrounds
- `azure-active` (#BBDEFB) — active/selected state backgrounds
- `azure-text.primary` (#1A1A1A) / `azure-text.secondary` (#5C6B7D) / `azure-text.muted` (#8899A8)

**Matrix (dark mode) tokens (CSS custom properties, theme-swappable):**
- `matrix-bg` — page background (pure black in Matrix)
- `matrix-base` — secondary surface (panels, read-only boxes)
- `matrix-primary` — borders, selected nav backgrounds
- `matrix-secondary` — body text, labels, inputs
- `matrix-highlight` — titles, headings, emphasis, active nav text
- `matrix-text` — alias (same as secondary)

**Anti-patterns that MUST NOT be used:**
- `dark:bg-zinc-800` / `dark:bg-zinc-950` / `dark:bg-matrix-base` for interactive inputs
- `dark:text-matrix-highlight` for input text (titles only)
- `dark:border-matrix-primary/30` on modal/input borders (full opacity only in these contexts)
- `shadow-lg` on modals (use `shadow-xl`)

#### Scenario: New input follows token pattern
- GIVEN a developer adds a new form input
- WHEN implemented following conventions
- THEN it uses `dark:bg-black dark:border-matrix-primary dark:text-matrix-secondary` — not any deprecated token

### Requirement: Typography
The system SHALL use a monospace font stack (`Helvetica`, `Courier New`, `Courier`, `monospace`) as `font-mono` applied globally via the `body` element.

### Requirement: Layout — desktop
The system SHALL render a persistent left sidebar (w-64) alongside a main content area on `lg` screens and above.

- **Sidebar:** fixed width, `border-r`, scrollable nav list, theme toggle button in header, Restart and Logout actions in the footer
- **Main content:** `flex-1 overflow-auto p-4 md:p-8 max-w-6xl mx-auto` for standard pages
- **Full-screen exceptions:** `/chat` and `/sessions/:id/audit` use `overflow-hidden p-0 h-full` with no max-width constraint

#### Scenario: Full-screen page has no padding or max-width
- GIVEN the user navigates to `/chat`
- WHEN the layout renders
- THEN the main content area has no padding and expands to fill the full height and width

### Requirement: Layout — mobile
The system SHALL render a fixed top header (`h-16`, `z-50`) on screens below `lg`, replacing the sidebar with a hamburger menu that opens a slide-in overlay.

- **Mobile header:** positioned fixed, `top-0`, full width, contains hamburger + logo + theme toggle
- **Mobile sidebar overlay:** `fixed top-16 bottom-0 left-0 z-40 w-64`, slides in from left with Framer Motion spring animation, closes on backdrop click or route change
- **Overlay backdrop:** `bg-black/50 backdrop-blur-sm`

#### Scenario: Sidebar closes on navigation
- GIVEN the mobile sidebar is open
- WHEN the user taps a nav link
- THEN the sidebar closes automatically

### Requirement: Navigation structure
The system SHALL render the following nav items in the sidebar, each with a lucide icon:

Dashboard · Chat · Zaion (Settings) · Smiths · Documents · MCP Servers · Skills · Sati Memories · Webhooks · Notifications · Tasks · Trinity DBs · Chronos · Audit · Model Pricing · Logs

Active route: `bg-azure-active dark:bg-matrix-primary text-azure-primary dark:text-matrix-highlight`
Inactive hover: `hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-secondary dark:text-matrix-secondary`

### Requirement: Live activity badges
The system SHALL display live badges in the navigation for:
- **Notifications:** red badge with unread count (polled every 10s)
- **Tasks:** yellow badge with count of pending + running tasks (polled every 5s)

Both badges cap display at `99+` for values above 99.

#### Scenario: Notification badge appears
- GIVEN 3 unread webhook notifications exist
- WHEN the sidebar renders
- THEN the Notifications nav item shows a red badge with "3"

### Requirement: Authentication guard
The system SHALL redirect unauthenticated users to `/login`. All routes except `/login` are wrapped in `AuthGuard`.

#### Scenario: Unauthenticated access redirected
- GIVEN no valid auth token exists in the browser
- WHEN the user navigates to `/chat`
- THEN they are redirected to `/login`

### Requirement: Code splitting
The system SHALL lazy-load all page components via `React.lazy` + `Suspense` to minimize initial bundle size. The fallback during loading is `null` (no spinner).

### Requirement: Data fetching pattern
The system SHALL use SWR for all API data fetching with appropriate polling intervals per data type:
- Task stats: 5s
- Notifications unread count: 10s
- Real-time logs: 2s (on Logs page)
- Other data: on-demand via `mutate()` after mutations

### Requirement: Modal / Dialog pattern
All modals SHALL follow this structure:

```
backdrop:   fixed inset-0 bg-black/50 backdrop-blur-sm (z-50)
container:  dark:bg-black dark:border-matrix-primary shadow-xl rounded-lg
title:      dark:text-matrix-highlight
body text:  dark:text-matrix-secondary
close btn:  dark:text-matrix-tertiary dark:hover:text-matrix-highlight
read-only content boxes: dark:bg-zinc-900 dark:text-matrix-secondary
```

### Requirement: Form components
The system SHALL use shared components from `src/ui/src/components/forms/` for all form fields:

- `TextInput` — label + input + optional helper text + error state
- `NumberInput` — label + number input + error state
- `SelectInput` — label + select + options array + error state
- `TextAreaInput` — label + textarea + error state
- `Switch` — boolean toggle
- `Section` — card container with `border border-azure-border dark:border-matrix-primary rounded-lg p-6 bg-azure-surface/50 dark:bg-matrix-base/50`, title, description

Input dark mode pattern (applied inside all shared inputs):
```
dark:bg-black dark:border-matrix-primary dark:text-matrix-secondary
dark:focus:border-matrix-highlight dark:placeholder-matrix-secondary/50
```

#### Scenario: Input error state
- GIVEN a form field has a validation error
- WHEN the field is rendered
- THEN the border becomes `border-red-500` and an error message appears below in `text-red-500`

### Requirement: Settings page — tabbed configuration
The system SHALL organize the Settings page (`/zaion`) into top-level tabs:
- General, Agents, DevKit, Audio, Channels, Chronos, Danger Zone

The **Agents** tab SHALL have sub-tabs: Oracle, Sati, Neo, Apoc, Trinity, Link.

New subagents require a manual entry in `AGENT_TABS` — sub-tab generation is NOT dynamic from SubagentRegistry.

#### Scenario: Danger Zone tab
- GIVEN the user opens the Danger Zone tab
- WHEN they click a destructive action (e.g., reset memories)
- THEN a confirmation modal appears before the action executes

### Requirement: Chat page
The system SHALL render a full-screen (`/chat`) chat interface with:
- **Session list sidebar** (left, collapsible on mobile) — `fixed top-16 bottom-0` on mobile
- **Message area** — auto-scrolls to newest message; renders Human and AI bubbles with metadata (tokens, cost, model)
- **Input area** — auto-growing textarea, send on Enter (Shift+Enter for newline)
- **Agent blocks** — delegation calls rendered as collapsible colored blocks per agent
- **Tool call blocks** — tool invocations shown as expandable `<details>` elements
- **Markdown rendering** — `react-markdown` + `remark-gfm` for GFM (tables, code, etc.)

#### Scenario: Markdown table rendered
- GIVEN an AI message contains a GFM table
- WHEN it renders in the chat
- THEN the table is wrapped in an `overflow-x-auto` container with custom styled `th`/`td` matching both Azure and Matrix themes

#### Scenario: @mention agent suggestion
- GIVEN the user types `@ap` in the chat input
- WHEN the mention state activates
- THEN a dropdown appears showing agents whose names start with "ap" (e.g., Apoc)
- AND selecting an agent adds it to the `mentionedAgents` list forwarded with the message

### Requirement: Dashboard page
The system SHALL render a grid of `ModuleCard` components, each linking to a subsystem page, showing live stats and a status indicator.

- Status border colors: `emerald` (ok), `amber` (warn), `red` (error), `default` (neutral)
- Cards use Framer Motion stagger animation (`staggerChildren: 0.07`) on initial mount
- `StatCard` components display key metrics (uptime, active tasks, MCP tools count, etc.)

#### Scenario: Module card status reflects live data
- GIVEN 2 tasks are currently running
- WHEN the Dashboard renders
- THEN the Tasks module card shows `status = 'warn'` (amber border) and displays the count
