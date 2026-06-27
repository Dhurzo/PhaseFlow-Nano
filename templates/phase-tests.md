# Phase {{PHASE_NUM}}: Testing — {{TEST_SCOPE}}
**Type:** Backend/Logic

## Objective
Add {{TEST_TYPE}} tests for {{TEST_SCOPE}}. Achieve {{COVERAGE_GOAL}} coverage and verify core functionality works correctly.

## Project Snapshot
{{PROJECT_SNAPSHOT}}

## Required Context
- Test framework: {{TEST_FRAMEWORK}}
- Test runner config: {{TEST_CONFIG}} (watch mode, coverage thresholds, test match pattern)
- Test strategy: {{TEST_STRATEGY}} (unit vs integration vs E2E)
- Mocking approach: {{MOCKING}} (manual mocks, mocking library, test doubles)
- Key scenarios to cover: {{TEST_SCENARIOS}}
- Edge cases: {{EDGE_CASES}}

## Related Files (for context)
{{RELATED_FILES}}

## Inputs
- All source files from phases {{SOURCE_PHASES}}
- {{TEST_FRAMEWORK}} dependency installed

## Tasks
- [ ] Configure {{TEST_FRAMEWORK}} in `{{TEST_CONFIG_PATH}}` with {{TEST_CONFIG}}
- [ ] Create `{{TEST_HELPERS_PATH}}` — test helpers, fixtures, and setup/teardown utilities
- [ ] Write tests for: {{TEST_SCENARIOS}}
- [ ] Write edge case tests: {{EDGE_CASES}}
- [ ] Add coverage configuration with minimum {{COVERAGE_THRESHOLD}}%
- [ ] Verify all tests pass: `{{TEST_COMMAND}}`

## Expected Outputs
- `{{TEST_CONFIG_PATH}}`: test framework configuration
- `{{TEST_HELPERS_PATH}}`: test utilities and helpers
- `{{TEST_FILES}}`: test files covering {{TEST_SCOPE}}

## Dependencies
- Phase {{DEP_PHASE}}: Source code to test

## Completion Criteria
- [ ] `{{TEST_COMMAND}}` passes with 0 failures
- [ ] Coverage meets {{COVERAGE_THRESHOLD}}% threshold
- [ ] Each function/method in {{TEST_SCOPE}} has at least one test
- [ ] Edge cases are covered (empty inputs, errors, boundary values)
