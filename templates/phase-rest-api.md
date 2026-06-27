# Phase {{PHASE_NUM}}: {{METHOD}} {{ENDPOINT}} Endpoint
**Type:** Backend/Logic

## Objective
Create the {{METHOD}} `{{ENDPOINT}}` endpoint that {{PURPOSE}}. Implement request validation, business logic, and response formatting.

## Project Snapshot
{{PROJECT_SNAPSHOT}}

## Required Context
- Resource: {{RESOURCE_NAME}}
- Fields in request body: {{REQUEST_FIELDS}}
- Fields in response: {{RESPONSE_FIELDS}}
- Validation rules: {{VALIDATION_RULES}}
- Business logic: {{BUSINESS_LOGIC}}
- Error scenarios: {{ERROR_SCENARIOS}} (e.g., 404 if not found, 400 if invalid input)
- Route conventions: {{ROUTE_CONVENTIONS}} (e.g., controllers in src/controllers/, routes in src/routes/)

## Related Files (for context)
{{RELATED_FILES}}

## Inputs
- Database schema and connection (from Phase {{DB_PHASE}})
- Express/Fastify/{{FRAMEWORK}} server configured and listening

## Tasks
- [ ] Create `{{CONTROLLER_PATH}}` — controller/handler with {{METHOD}} logic for `{{ENDPOINT}}`
- [ ] Implement input validation: {{VALIDATION}} (required fields, types, constraints)
- [ ] Add business logic: {{BUSINESS_LOGIC}}
- [ ] Create `{{ROUTE_PATH}}` — route definition for `{{METHOD}} {{ENDPOINT}}`
- [ ] Mount route in `{{SERVER_FILE}}` (or equivalent router aggregation)
- [ ] Handle error cases: {{ERROR_HANDLING}}
- [ ] Test with `curl` / httpie that `{{TEST_COMMAND}}` returns expected response

## Expected Outputs
- `{{CONTROLLER_PATH}}`: controller with the endpoint logic
- `{{ROUTE_PATH}}`: route definition
- `{{SERVER_FILE}}`: modified to mount the new route

## Dependencies
- Phase {{DEP_PHASE}}: {{DEP_NAME}}

## Completion Criteria
- [ ] `{{METHOD}} {{ENDPOINT}}` returns status {{SUCCESS_STATUS}} with correct response body
- [ ] Invalid input returns status 400 with descriptive error
- [ ] Non-existent resource returns status 404 (if applicable)
- [ ] Server errors return status 500
