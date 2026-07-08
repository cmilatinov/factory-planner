# Project Workflow

This file captures process rules for branches, commits, pull requests, staging, and verification.

## Branches, Commits, And PR Titles

- Use Gitflow-style naming for branches, commits, and PR titles.
- Commit messages and PR titles must use one of these colon-style prefixes: `feature:`, `fix:`, `docs:`, `chore:`, or `refactor:`.
- Branch names must use slash-separated prefixes: `feature/`, `fix/`, `docs/`, `chore/`, or `refactor/`.
- Branch names must not use colon-style prefixes; use `docs/task-tracker`, not `docs: task tracker`.
- Never include agent/tool tags or names in branch names, commits, PR titles, issue titles, or docs.
- Never force-push a branch unless the push is specifically part of a rebase workflow.

## PR Scope

- Prefer small, reviewable PRs grouped by feature or risk area.
- Stage only the files that belong to the current PR; the repo may have unrelated local changes.
- Preserve existing behavior unless a task explicitly changes it.
- Do not bundle large pre-existing app changes into unrelated task PRs.

## Documentation Updates

- Keep docs updated with the latest project information as features and architecture evolve.
- When starting work on a new feature, update the relevant task file with the planned checklist if it is missing or stale.
- When completing feature work, update the task list with completed items and reference the GitHub PR that completed them.
- If implementation changes architecture, data flow, workflow, or verification expectations, update the relevant docs in the same PR.

## PR Body Format

Use this exact section format for every PR:

```md
## What changed

## Tasks addressed

## Why

## Impact

## Validation
```

- In `Tasks addressed`, link or name the checklist item(s) the PR implements.
- In `Validation`, list commands run or state why validation was skipped.

## Verification

- Run the smallest meaningful validation for the change.
- For docs-only changes, state that tests were not run because the change is documentation-only.
- New implemented features must include both unit tests and e2e tests.
- For UI changes, run automated checks and verify layout visually with browser screenshots when appropriate.
- For behavior changes, prefer focused tests first, then broader checks before opening or updating a PR.
