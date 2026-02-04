# Tasks to Issues Command Documentation

## Command
`speckit.taskstoissues`

## Purpose
Converts task items from tasks.md into GitHub Issues for project management and tracking.

## When to Use
- After task list is finalized
- When using GitHub for project management
- To enable team collaboration on tasks

## Prerequisites
- Task list must exist at `specs/###-feature-name/tasks.md`
- GitHub repository access
- Appropriate permissions to create issues

## Execution Flow

1. **Load Tasks**: Read tasks from tasks.md
2. **Parse Structure**: Extract task metadata (ID, priority, story, description)
3. **Create Issues**: Generate GitHub issues with:
   - Title from task description
   - Labels for story, priority, phase
   - References to specification
   - Linked dependencies
4. **Link Back**: Update tasks.md with issue references

## Issue Mapping

Each task becomes an issue with:
- **Title**: Task description
- **Labels**: Phase, Story (US1, US2), Priority
- **Body**: Link to spec, dependencies, acceptance criteria
- **Milestone**: Feature or release milestone

## Output

- GitHub issues created
- Updated tasks.md with issue links
- Summary of created issues

## Agent-Specific Guidance

This command is agent-agnostic and can be executed by any AI assistant with GitHub API access.
