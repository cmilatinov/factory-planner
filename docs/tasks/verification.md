# Verification Workflow

Verification is an ongoing workflow for every feature, fix, refactor, and UX change. It is not a
standalone checklist to complete once.

## Per-PR Workflow

1. Identify the task file and checklist item(s) addressed by the PR.
2. Decide the risk category: docs-only, styling-only, UI behavior, domain behavior, persistence, export, or refactor.
3. Add or update tests alongside the implementation.
4. Run the smallest meaningful validation first.
5. Run broader validation before opening or updating the PR when the change affects shared behavior or user flows.
6. Record exact validation commands and results in the PR `## Validation` section.
7. Update the relevant task checklist only after the implementation and verification are complete.

## Test Expectations

- New implemented features must include both unit tests and e2e tests.
- Fixes should include a regression test at the lowest useful level.
- Refactors should preserve existing coverage and add tests if behavior is made explicit.
- Styling-only changes should use screenshots or browser checks when layout, visibility, or interaction states are affected.
- Docs-only changes do not require automated tests; state that tests were not run because the change is documentation-only.

## Standard Commands

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm e2e`

## Evidence To Capture

- Commands run and whether they passed.
- Any commands intentionally skipped and why.
- Screenshots or visual notes for UI layout changes.
- New or updated test files for feature work.

## Done Criteria

- The PR includes the required tests for its change type.
- The PR body lists the task(s) addressed.
- The PR body records validation clearly enough for review.
- Existing planner and blueprint editor flows are not regressed.
