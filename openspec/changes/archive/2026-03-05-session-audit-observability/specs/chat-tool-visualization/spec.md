## ADDED Requirements

### Requirement: Tool call messages rendered as collapsible blocks
In the chat view, consecutive `tool`-type messages that follow an AI message with `tool_calls` SHALL be rendered as a collapsible block, collapsed by default.

#### Scenario: Tool call block collapsed by default
- **WHEN** the chat renders an AI message followed by one or more tool result messages
- **THEN** the tool results are hidden under a collapsed block showing only the tool name(s) and status icons

#### Scenario: Tool call block expands on click
- **WHEN** user clicks the tool call block header
- **THEN** the block expands with animation to show tool name, input args (as formatted JSON), result content, and duration (if available from audit_events)

#### Scenario: Multiple tool calls in one AI turn grouped together
- **WHEN** an AI message contains 3 `tool_calls`
- **THEN** all 3 tool results are shown inside a single collapsible block, each as a sub-item

#### Scenario: Failed tool call shows error indicator
- **WHEN** a tool result contains an error
- **THEN** the block header shows a red ✗ icon and the expanded view shows the error message

---

### Requirement: Subagent delegation rendered as agent work block
When an AI message calls `apoc_delegate`, `neo_delegate`, `trinity_delegate`, or `smith_delegate`, the tool call SHALL render as a specialized `AgentBlock` component with agent identity and task summary.

#### Scenario: Agent block shows agent name and delegated task
- **WHEN** Oracle's AI message calls `apoc_delegate` with a task description
- **THEN** the chat renders an `AgentBlock` with icon, "Apoc" label, and a one-line preview of the delegated task

#### Scenario: Agent block shows completion status
- **WHEN** the task associated with the delegation is completed
- **THEN** the `AgentBlock` shows a green checkmark and elapsed time

#### Scenario: Agent block shows step count and tokens when available
- **WHEN** the `tasks` row for the delegation has `step_count > 0` and `input_tokens > 0`
- **THEN** the expanded `AgentBlock` shows "N steps · X in / Y out tokens · $Z.ZZZZ"

#### Scenario: In-progress agent block shows spinner
- **WHEN** the task is still running (status = 'running')
- **THEN** the `AgentBlock` shows an animated spinner instead of a status icon

---

### Requirement: AI message metadata footer
Every AI message in the chat SHALL show a metadata footer with provider, model, token counts, and response duration.

#### Scenario: Metadata footer collapsed by default
- **WHEN** an AI message is rendered
- **THEN** a subtle info icon or "···" is visible below the message bubble

#### Scenario: Metadata footer expands on click
- **WHEN** user clicks the metadata footer
- **THEN** a small panel expands showing: provider badge, model name, `in: N / out: M tokens`, `duration: Xs`, estimated cost (if pricing data available)

#### Scenario: Messages without token data show no cost
- **WHEN** an AI message has no `input_tokens` / `output_tokens`
- **THEN** the metadata footer shows "—" for tokens and cost, no error

---

### Requirement: Tool block and agent block support both light and dark themes
All new chat components SHALL use the established dual-theme design tokens.

#### Scenario: ToolCallBlock in dark (Matrix) theme
- **WHEN** dark mode is active
- **THEN** `ToolCallBlock` uses `dark:bg-zinc-900` for content areas, `dark:border-matrix-primary` for borders, `dark:text-matrix-secondary` for body text, `dark:text-matrix-highlight` for tool names

#### Scenario: AgentBlock in dark (Matrix) theme
- **WHEN** dark mode is active
- **THEN** `AgentBlock` uses the same token set as `ToolCallBlock`, with agent-specific accent color for the icon

#### Scenario: MessageMeta in light (Azure) theme
- **WHEN** light mode is active
- **THEN** metadata footer uses muted gray tones consistent with the Azure palette

---

### Requirement: Chat service exposes tool call grouping
The chat service (`src/ui/src/services/chat.ts`) SHALL provide a `groupMessages(messages)` utility that returns a `GroupedMessage[]` type, combining `ai` + `tool` message pairs.

#### Scenario: Consecutive tool messages merged under parent AI message
- **WHEN** `groupMessages()` processes a sequence `[ai, tool, tool, ai, tool]`
- **THEN** it returns `[{ai, toolResults: [tool, tool]}, {ai, toolResults: [tool]}]`

#### Scenario: AI message with no tool calls has empty toolResults
- **WHEN** an AI message has no `tool_calls` field
- **THEN** `groupMessages()` returns `{ai, toolResults: []}` for that message
