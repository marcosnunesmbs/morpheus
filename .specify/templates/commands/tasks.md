# Tasks Command Documentation

## Command
`speckit.tasks`

## Purpose
Generates a detailed task list (`tasks.md`) from the implementation plan and specification, organized by user story for independent implementation.

## When to Use
- After completing the implementation plan (`plan.md`)
- Before beginning actual development
- When breaking down work into actionable items

## Prerequisites
- Implementation plan must exist at `specs/###-feature-name/plan.md`
- Feature specification must exist at `specs/###-feature-name/spec.md`
- Constitution must be defined

## Execution Flow

1. **Load Planning Documents**: Read plan.md, spec.md, data-model.md
2. **Extract User Stories**: Identify all user stories with priorities
3. **Generate Tasks**: Create concrete, testable tasks for each story
4. **Organize by Story**: Group tasks to enable independent implementation
5. **Add Checkpoints**: Insert validation points between phases
6. **Mark Parallelization**: Tag tasks that can run in parallel

## Task Organization

Tasks are organized in phases:
1. **Setup**: Project initialization
2. **Foundational**: Core infrastructure (blocking)
3. **User Stories**: One phase per story (can be parallel)
4. **Integration**: Combining stories
5. **Polish**: Final refinements

## Output

Creates `specs/###-feature-name/tasks.md` with:
- Organized task list with IDs
- Parallel execution markers `[P]`
- Story association markers `[US#]`
- Phase checkpoints
- Exact file paths

## Agent-Specific Guidance

This command is agent-agnostic and can be executed by any AI assistant with access to the project context.
