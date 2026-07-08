# Unified Design Language

Create one coherent visual system for the blueprint editor instead of layered overrides.

## Checklist

- [ ] Define editor design tokens for surfaces, borders, canvas, grid, text, focus, selected, warning, and error states.
- [ ] Expand or replace `visualTheme.ts` so editor styling has one source of truth.
- [ ] Remove competing dark/light editor override blocks from `src/App.css`.
- [ ] Standardize button styling across the editor.
- [ ] Standardize input and select styling across the editor.
- [ ] Standardize toolbar, badge, hint, and inspector styling.
- [ ] Make active, hover, focus, disabled, warning, and danger states consistent.
- [ ] Keep the editor visually aligned with the rest of the app.
- [ ] Give the canvas a distinct production-tool feel without creating a separate visual language.

## Done Criteria

- Editor styling has a single intentional theme path.
- CSS no longer relies on late broad overrides to cancel earlier editor themes.
- Controls feel consistent across palette, toolbar, canvas overlays, status bar, and inspector.
