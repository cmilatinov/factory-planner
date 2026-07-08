# Project Workflow

This file captures process rules for branches, commits, pull requests, staging, and verification.

## Branches, Commits, And PR Titles

- Use Gitflow-style naming for branches, commits, and PR titles.
- Allowed prefixes are `feature:`, `fix:`, `docs:`, `chore:`, and `refactor:`.
- Branch names must use the same allowed prefixes as path-style prefixes, such as `docs/task-tracker`.
- Never include agent/tool tags or names in branch names, commits, PR titles, issue titles, or docs.
- Never force-push a branch unless the push is specifically part of a rebase workflow.

## PR Scope

- Prefer small, reviewable PRs grouped by feature or risk area.
- Stage only the files that belong to the current PR; the repo may have unrelated local changes.
- Preserve existing behavior unless a task explicitly changes it.
- Do not bundle large pre-existing app changes into unrelated task PRs.

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
- For UI changes, run automated checks and verify layout visually with browser screenshots when appropriate.
- For behavior changes, prefer focused tests first, then broader checks before opening or updating a PR.
