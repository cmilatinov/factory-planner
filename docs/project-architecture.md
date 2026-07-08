# Project Architecture Notes

This file is working context for future implementation passes. Keep it current when major
architecture or product direction changes. Workflow rules live in `docs/workflow.md`.

## Product Purpose

Factory Planner is a React app for planning Satisfactory-style factories. It currently combines:

- A production planner graph for recipes, rates, upstream inputs, and generated blueprints.
- A blueprint list and editor for generated or manual blueprints.
- A floor plan view that packs blueprint placements onto floors.
- Statistics views for planner, blueprint, and floor-plan summaries.
- Settings for generation, flow direction, rounding, clipping, and export size.

The main current product focus is improving the blueprint editor UX.

## Current Tech Stack

- Vite, React, and TypeScript.
- Dockview for docked application panels.
- React Flow for the production graph and active blueprint canvas.
- Zustand, Dexie, tldraw types, zod, and rbush are present in the newer `src/eda` tree.
- Vitest and Testing Library for unit/app tests.
- Playwright for e2e editor and planner workflows.
- Oxlint for linting.

## Active Application Architecture

### Entry Points

- `src/main.tsx` mounts the React app.
- `src/App.tsx` currently owns most active UI implementation.
- `src/App.css` owns global app styling and editor styling.
- `src/index.css` contains global base styles.

### Active State Model

The active app uses a single `ProjectState` shape from `src/types.ts`. It includes:

- `plannerNodes` and `plannerEdges` for the production graph.
- `blueprints` for generated/manual blueprint data.
- `floorPlan` for packed floor placements.
- `settings` for generation and layout behavior.
- `selectedPlannerNodeId` and `selectedBlueprintId`.
- `validation` issues.

State is held in React state in `App.tsx` and persisted to local storage through helpers in
`src/domain.ts`.

### Active Domain Layer

`src/domain.ts` is the main active domain module. It currently handles:

- Default settings and initial project state.
- Local storage load/save/clear for project and layout state.
- Planner node creation, input expansion, edge removal, and output-rate updates.
- Blueprint generation from planner nodes.
- Manual blueprint creation, rename, relink, deletion, and component mutation.
- Blueprint component movement, rotation, logistics routes, belt buses, and bus lanes.
- Validation for planner, blueprints, floor plans, collisions, throughput, and export bounds.
- Floor packing and statistics.
- Prototype blueprint export pair and zip generation.

This module is broad and should eventually be split by responsibility after behavior is covered.

### Active UI Surface

`src/App.tsx` contains:

- App shell, toolbar, Dockview layout, layout persistence, and panel menu.
- Planner panel with React Flow nodes/edges.
- Blueprint list, recipe library, settings, statistics, and floor plan panels.
- Blueprint editor panel, palette, toolbar, bus inspector, React Flow canvas, route handles,
  route previews, component rendering, and many editor helpers.

The blueprint editor is the main UX target. It uses React Flow nodes for blueprint components and
custom pointer handling for routing, dragging, selection, deletion, and rotation.

### Styling

`src/App.css` is currently the main style file. It includes app shell styles, planner styles,
panel styles, and blueprint editor styles. The blueprint editor has competing style sections,
including a dark editor pass that is later overridden back to a light theme. This is a major source
of inconsistent design language.

`src/visualTheme.ts` exists and feeds CSS custom properties into the app shell, but it is currently
limited to canvas, port, belt, and machine colors. It is not yet a complete design-token source.

## Newer EDA Architecture

`src/eda` appears to be a newer or future architecture. It is not currently wired into `App.tsx`.

It contains:

- `domain/types.ts`: normalized project model with floors, machines, ports, connections, belt
  buses, and validation issues.
- `domain/items.ts`, `machines.ts`, `recipes.ts`, `belts.ts`: static definitions.
- `domain/geometry.ts`: footprint, rotation, and port-world-position helpers.
- `store/projectStore.ts`: Zustand project store for normalized projects.
- `store/editorStore.ts`: Zustand editor-tool and selection state.
- `graph/rateSolver.ts` and `graph/validation.ts`: rate inference and validation.
- `routing/orthogonalRouter.ts` and `routing/obstacleIndex.ts`: route/path helpers and spatial index.
- `schemas/projectSchema.ts`: zod schemas for normalized project persistence/import.
- `persistence/db.ts`, `projectRepository.ts`, `importExport.ts`: Dexie-backed project storage and JSON import/export.
- `editor/tldrawTypes.ts`: tldraw shape type sketches.

Before adopting it, decide whether the product is migrating from the current `ProjectState` model
or keeping `src/eda` as a separate experimental path.

## Data Flow Summary

1. Recipe data comes from `src/gameData.ts`.
2. Users drag recipes into the planner graph.
3. `domain.ts` creates planner nodes and recalculates machine counts, rates, validation, and packing.
4. Blueprint generation creates blueprint component arrays from planner nodes.
5. The blueprint list opens editor panels through Dockview.
6. The blueprint editor mutates component arrays through `domain.ts` helpers.
7. `validateAndPack` updates validation and floor-plan placement after most domain mutations.
8. Project and Dockview layout state persist separately in local storage.

## Testing Map

- `tests/domain.test.ts` covers domain behavior, generation, route mutation, validation, and blueprint deletion.
- `tests/app.test.tsx` covers default rendering, statistics panel behavior, and storage reset boundaries.
- `tests/e2e/planner.spec.ts` covers planner-to-blueprint workflows and manual blueprint editor flows.

The existing tests are a good safety net for behavior, but visual/editor UX changes need additional
e2e assertions and screenshot checks.

## Known Improvement Areas

- Split `src/App.tsx` into focused app shell, panels, planner, blueprint editor, and renderer modules.
- Split `src/domain.ts` into planner, blueprint, routing, validation, packing, stats, and export modules.
- Consolidate editor CSS into a single design language and remove late broad overrides.
- Expand `visualTheme.ts` into a complete token layer or replace it with a more systematic styling approach.
- Improve blueprint editor layout: palette, toolbar, canvas, status, and inspector should have clear roles.
- Move bus/lane editing out of the build palette flow into a proper inspector.
- Improve canvas grid, foundations, ports, routing feedback, selection states, and object affordances.
- Decide whether `src/eda` is the target architecture and plan migration deliberately if so.
- Replace the default Vite README with product-specific documentation.
- Watch bundle size; production build currently emits a large main JS chunk.

## Current PR Strategy

- First PR: task tracking docs.
- Next docs PR or update: project architecture/context notes.
- First code PR should be narrow, likely resolving lint warnings or a styling token cleanup.
- Do not bundle large pre-existing app changes into unrelated task PRs.
