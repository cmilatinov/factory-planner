# Factory Planner Task Summary

This is the high-level task index for the factory planner. Detailed checklists live in
feature-specific files under `docs/tasks/`.

## Current Direction

The main product focus is improving the blueprint editor UX. The editor works and the
baseline checks are green, but the experience needs a unified design language, clearer
layout, better canvas affordances, and more maintainable code organization.

## Feature Areas

- [Repo Baseline](tasks/repo-baseline.md): current repo state, verification status, and known warnings.
- [Unified Design Language](tasks/unified-design-language.md): editor tokens, styling cleanup, and shared UI rules.
- [Editor Layout](tasks/editor-layout.md): palette, toolbar, canvas, status, and inspector structure.
- [Canvas Visual Polish](tasks/canvas-visual-polish.md): grid, foundations, machines, logistics, ports, and selection states.
- [Editor Interactions](tasks/editor-interactions.md): tools, routing feedback, selection behavior, shortcuts, and object actions.
- [Bus Inspector](tasks/bus-inspector.md): bus/lane editing, capacity presentation, and narrow-panel usability.
- [Code Organization](tasks/code-organization.md): extracting the editor out of `src/App.tsx` into focused modules.
- [Verification](tasks/verification.md): tests, e2e coverage, screenshot checks, and release-readiness commands.

## Status Snapshot

- Repo assessment: done.
- Baseline unit/domain tests: passing.
- Production build: passing.
- Editor e2e flows: passing.
- Blueprint editor UX redesign: not started.
- Blueprint editor refactor: not started.

## Notes

- The active blueprint editor is currently implemented in `src/App.tsx` using React Flow.
- `src/eda` contains a newer domain/store/editor direction, but it is not wired into the app yet.
- Existing behavior should stay stable unless a checklist item explicitly changes it.
