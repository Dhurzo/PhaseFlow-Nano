# Phase {{PHASE_NUM}}: Database Setup — {{DB_NAME}}
**Type:** Backend/Logic

## Objective
Set up the database connection and schema for {{DB_NAME}}. Create tables, migrations, and connection utilities.

## Project Snapshot
{{PROJECT_SNAPSHOT}}

## Required Context
- Database engine: {{DB_ENGINE}} ({{DB_DRIVER}})
- Schema tables to create: {{TABLES}}
- Connection config: {{DB_CONFIG}}
- Migration approach: {{MIGRATION_TOOL}} (create tables directly or via migrations)

## Related Files (for context)
{{RELATED_FILES}}

## Inputs
- Project initialized with {{LANG}} and {{FRAMEWORK}} configured
- {{DB_DRIVER}} dependency already installed

## Tasks
- [ ] Create `{{DB_PATH}}` — database connection module with config loading and connection pool
- [ ] Define `{{SCHEMA_PATH}}` — table schemas for: {{TABLES}}
- [ ] Write `{{MIGRATION_PATH}}` — initial migration / table creation script
- [ ] Create `{{SEED_PATH}}` — optional seed data script for development
- [ ] Verify connection: run a test query and confirm it returns the expected result

## Expected Outputs
- `{{DB_PATH}}`: database connection module
- `{{SCHEMA_PATH}}`: schema definitions
- `{{MIGRATION_PATH}}`: migration / table creation

## Dependencies
- Phase {{DEP_PHASE}}: Project initialization and dependencies

## Completion Criteria
- [ ] Database connection initializes without errors
- [ ] All tables are created with correct columns and types
- [ ] A test query against each table returns the expected empty result set
- [ ] Connection closes cleanly on shutdown
