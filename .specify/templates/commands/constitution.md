# Constitution Command Documentation

## Command
`speckit.constitution`

## Purpose
Updates the project constitution at `.specify/memory/constitution.md`, ensuring all placeholder tokens are replaced with concrete values and propagating changes across dependent artifacts.

## When to Use
- Initial constitution setup for a new project
- Amending existing principles or governance rules
- Adding/removing core principles
- Updating technology standards
- Making any governance or process changes

## Prerequisites
- Project must have a `.specify/memory/constitution.md` file (created from template)
- User should understand the impact of constitutional changes on the project

## Execution Flow

1. **Load Constitution Template**: Read `.specify/memory/constitution.md`
2. **Identify Placeholders**: Find all tokens in `[ALL_CAPS]` format
3. **Collect Values**: 
   - From user input
   - From repository context (README, docs, package.json)
   - Infer from existing project structure
4. **Version Management**: 
   - Increment version according to semantic versioning rules
   - Update dates (ratification, amendment)
5. **Replace Placeholders**: Fill template with concrete values
6. **Consistency Check**: Validate against all template files
7. **Sync Impact Report**: Document all changes
8. **Write Back**: Update constitution file

## Version Increment Rules

- **MAJOR**: Backward incompatible governance/principle removals or redefinitions
- **MINOR**: New principle/section added or materially expanded guidance
- **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements

## Output

- Updated `.specify/memory/constitution.md` with:
  - All placeholders replaced
  - Version incremented
  - Dates updated
  - Sync Impact Report prepended as HTML comment
- Summary message with:
  - New version and bump rationale
  - Files flagged for manual follow-up
  - Suggested commit message

## Agent-Specific Guidance

This command can be executed by any AI assistant (not specific to Claude or any particular agent). The constitution establishes project-wide principles that transcend tool or agent choices.
