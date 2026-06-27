# Phase {{PHASE_NUM}}: Project Setup — {{PROJECT_TYPE}}
**Type:** Backend/Logic

## Objective
Initialize the {{LANG}} {{PROJECT_TYPE}} project with dependencies, build tooling, and basic project structure.

## Project Snapshot
{{PROJECT_SNAPSHOT}}

## Required Context
- Language: {{LANG}} {{LANG_VERSION}}
- Framework: {{FRAMEWORK}}
- Package manager: {{PACKAGE_MANAGER}}
- Build tool: {{BUILD_TOOL}}
- Dependencies to install: {{DEPENDENCIES}}
- Dev dependencies: {{DEV_DEPENDENCIES}}
- Project structure: {{PROJECT_STRUCTURE}}
- Code conventions: {{CONVENTIONS}} (module system, formatting, linting)
- Linting/formatting: {{LINT_TOOLS}}

## Related Files (for context)
{{RELATED_FILES}}

## Inputs
- Empty project directory (or existing project from git clone)

## Tasks
- [ ] Initialize project: `{{INIT_COMMAND}}` in the current directory (NO subdirectory)
- [ ] Create directory structure: {{DIR_STRUCTURE}}
- [ ] Install all dependencies (runtime + dev): {{DEPENDENCIES}} {{DEV_DEPENDENCIES}}
- [ ] Configure {{BUILD_TOOL}} in `{{BUILD_CONFIG_PATH}}`
- [ ] Configure {{LINT_TOOLS}} for code quality
- [ ] Create `{{ENTRY_POINT}}` — minimal entry point that verifies the setup
- [ ] Verify: `{{VERIFY_COMMAND}}` runs without errors

## Expected Outputs
- `{{BUILD_CONFIG_PATH}}`: build tool configuration
- `{{ENTRY_POINT}}`: minimal entry point
- `{{LINT_CONFIG_PATH}}`: linter/formatter configuration (if applicable)
- {{LANG}} project config (e.g., package.json, Cargo.toml, pyproject.toml)

## Dependencies
- None (first phase)

## Completion Criteria
- [ ] Project initializes in the current directory (no nested subdirectory)
- [ ] All dependencies install without errors
- [ ] Build command (`{{BUILD_CMD}}`) compiles without errors
- [ ] Entry point runs successfully (`{{VERIFY_COMMAND}}`)
- [ ] Project structure matches {{PROJECT_STRUCTURE}}
