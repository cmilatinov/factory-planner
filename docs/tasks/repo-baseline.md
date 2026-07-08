# Repo Baseline

Track the current repo state and baseline verification before UX work changes behavior.

## Checklist

- [x] Assess current repo structure and identify active blueprint editor implementation.
- [x] Confirm the active editor is implemented in `src/App.tsx` with React Flow.
- [x] Confirm `src/eda` is present but not wired into the app.
- [x] Verify baseline tests: `pnpm test`.
- [x] Verify production build: `pnpm build`.
- [x] Verify editor e2e flows: `pnpm e2e`.
- [x] Identify existing lint warnings in blueprint canvas hooks.
- [ ] Resolve React hook dependency warnings in `src/App.tsx`.
- [ ] Re-run baseline checks after the hook warning fix.

## Notes

- The worktree already has a large uncommitted delta.
- UX work should be scoped so changes remain reviewable.
