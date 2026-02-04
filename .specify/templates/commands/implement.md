# Implement Command Documentation

## Command
`speckit.implement`

## Purpose
Executes the implementation of tasks from the task list, updating code and marking tasks as complete.

## When to Use
- After task list is created
- During active development
- When implementing specific user stories

## Prerequisites
- Task list must exist at `specs/###-feature-name/tasks.md`
- Implementation plan and specification should be complete
- Development environment should be set up

## Execution Flow

1. **Load Tasks**: Read the task list
2. **Select Next Task**: Choose from uncompleted tasks
3. **Implement**: Write code according to task description
4. **Test**: Verify implementation
5. **Mark Complete**: Update task status in tasks.md
6. **Checkpoint Check**: Validate phase completion

## Implementation Strategy

- Follow exact file paths from tasks
- Implement one user story at a time
- Run tests after each task
- Validate checkpoints before proceeding

## Output

- Updated source files
- Updated `tasks.md` with completed checkboxes
- Test results
- Implementation notes

## Agent-Specific Guidance

This command is agent-agnostic and can be executed by any AI assistant with code editing capabilities.
