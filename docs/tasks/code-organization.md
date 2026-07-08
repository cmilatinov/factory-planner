# Code Organization

Reduce blueprint editor complexity after the UX direction is stable.

## Checklist

- [ ] Extract `BlueprintEditorPanel` from `src/App.tsx`.
- [ ] Extract `BlueprintCanvas` and React Flow setup.
- [ ] Extract blueprint component renderers.
- [ ] Extract route handle components.
- [ ] Extract route preview helpers.
- [ ] Extract logistics visual rendering helpers.
- [ ] Extract `BusInspector`.
- [ ] Move editor-only types/helpers near the editor modules.
- [ ] Keep domain behavior in `domain.ts` or a dedicated domain module.
- [ ] Decide whether the unused `src/eda` architecture is a future migration target or should remain separate for now.
- [ ] Avoid broad refactors until the visual and interaction direction is stable.

## Done Criteria

- `src/App.tsx` no longer owns the entire editor implementation.
- Editor modules have clear boundaries.
- Tests cover behavior before large movement of code.
