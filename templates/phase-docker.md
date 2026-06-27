# Phase {{PHASE_NUM}}: Containerization — Docker
**Type:** Backend/Logic

## Objective
Containerize the application with Docker. Create a production-ready Dockerfile and docker-compose configuration for local development.

## Project Snapshot
{{PROJECT_SNAPSHOT}}

## Required Context
- Base image: {{BASE_IMAGE}} (e.g., node:20-alpine, python:3.12-slim, golang:1.22-alpine)
- Build steps: {{BUILD_STEPS}} (install deps, compile, copy artifacts)
- Runtime command: {{RUNTIME_CMD}}
- Exposed ports: {{EXPOSED_PORTS}}
- Docker Compose services: {{COMPOSE_SERVICES}} (app, db, cache, etc.)
- Volume mounts: {{VOLUME_MOUNTS}}
- Environment variables: {{ENV_VARS}}
- Multi-stage build: {{MULTI_STAGE}} (yes/no)

## Related Files (for context)
{{RELATED_FILES}}

## Inputs
- Complete application code from phases {{SOURCE_PHASES}}
- {{BUILD_TOOL}} installed

## Tasks
- [ ] Create `Dockerfile` — multi-stage build for production: {{BUILD_STEPS}}
- [ ] Create `.dockerignore` — exclude node_modules, .git, outputs/, logs/
- [ ] Create `docker-compose.yml` — services: {{COMPOSE_SERVICES}}
- [ ] Configure {{COMPOSE_DB_SERVICE}} service (if applicable)
- [ ] Add health checks and restart policies
- [ ] Verify: `docker compose up` starts successfully and {{TEST_COMMAND}} works

## Expected Outputs
- `Dockerfile`: production container build instructions
- `.dockerignore`: files excluded from Docker build context
- `docker-compose.yml`: multi-service orchestration

## Dependencies
- Phase {{DEP_PHASE}}: Complete application

## Completion Criteria
- [ ] `docker build` completes without errors
- [ ] Image size is reasonable ({{EXPECTED_SIZE}} or less)
- [ ] `docker compose up` starts all services
- [ ] Application responds to requests inside the container
- [ ] Container stops cleanly with SIGTERM
