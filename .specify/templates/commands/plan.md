# Plan Command Documentation

## Command
`speckit.plan`

## Purpose
Generates a comprehensive implementation plan (`plan.md`) for a feature specification, including research, data models, and technical design.

## When to Use
- After creating a feature specification (`spec.md`)
- Before beginning implementation
- When detailed technical planning is required

## Prerequisites
- Feature specification must exist at `specs/###-feature-name/spec.md`
- Constitution must be defined

## Execution Flow

1. **Load Specification**: Read the feature spec
2. **Constitution Check**: Validate against project principles
3. **Research Phase**: Investigate technical approaches
4. **Data Modeling**: Define entities and schemas
5. **Contract Definition**: Specify APIs/interfaces
6. **Generate Plan**: Create structured implementation plan

## Output

Creates multiple files in `specs/###-feature-name/`:
- `plan.md`: Main implementation plan
- `research.md`: Technical research and alternatives
- `data-model.md`: Entity definitions and schemas
- `quickstart.md`: Quick reference guide
- `contracts/`: API/interface contracts

## Agent-Specific Guidance

This command is agent-agnostic and can be executed by any AI assistant with access to the project context.
