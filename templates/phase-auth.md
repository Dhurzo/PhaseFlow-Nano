# Phase {{PHASE_NUM}}: Authentication — {{AUTH_TYPE}}
**Type:** Backend/Logic

## Objective
Implement {{AUTH_TYPE}} authentication: {{AUTH_GOAL}}. Protect API routes with middleware, handle login/signup, and manage sessions/tokens.

## Project Snapshot
{{PROJECT_SNAPSHOT}}

## Required Context
- Auth strategy: {{AUTH_STRATEGY}} (JWT / sessions / OAuth2 / {{OTHER}})
- Token/session config: {{TOKEN_CONFIG}} (expiry, storage, cookie vs header)
- User model fields: {{USER_FIELDS}} (email, password_hash, role, etc.)
- Password hashing: {{HASHING}} (bcrypt / argon2 / {{OTHER}})
- Auth middleware pattern: {{MIDDLEWARE_PATTERN}}
- Protected routes: {{PROTECTED_ROUTES}}
- Role/permission model (if any): {{ROLE_MODEL}}

## Related Files (for context)
{{RELATED_FILES}}

## Inputs
- Database schema with users table (from Phase {{DB_PHASE}})
- Framework ({{FRAMEWORK}}) server configured

## Tasks
- [ ] Create `{{AUTH_SERVICE_PATH}}` — auth service with signup, login, token generation/verification
- [ ] Create `{{MIDDLEWARE_PATH}}` — auth middleware that validates tokens/sessions
- [ ] Create `{{AUTH_ROUTES_PATH}}` — routes for signup (POST /auth/signup) and login (POST /auth/login)
- [ ] Create `{{USER_CONTROLLER_PATH}}` — user profile endpoint (GET /auth/me) protected by middleware
- [ ] Add password hashing: {{HASHING}} with {{HASHING_CONFIG}}
- [ ] Mount auth routes in `{{SERVER_FILE}}`
- [ ] Verify: signup → login → access protected route → invalid token rejected

## Expected Outputs
- `{{AUTH_SERVICE_PATH}}`: auth service (signup, login, token/session management)
- `{{MIDDLEWARE_PATH}}`: auth middleware for route protection
- `{{AUTH_ROUTES_PATH}}`: auth route definitions (signup, login, me)
- `{{SERVER_FILE}}`: modified to mount auth routes

## Dependencies
- Phase {{DEP_PHASE}}: Database schema with users table

## Completion Criteria
- [ ] POST /auth/signup creates user and returns {{SIGNUP_RESPONSE}}
- [ ] POST /auth/login returns {{LOGIN_RESPONSE}} on valid credentials
- [ ] POST /auth/login returns 401 on invalid credentials
- [ ] Protected route returns 401 without valid token
- [ ] GET /auth/me returns current user data with valid token
