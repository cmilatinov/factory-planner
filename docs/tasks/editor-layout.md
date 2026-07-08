# Editor Layout

Clarify the blueprint editor structure so each region has a clear role.

## Checklist

- [ ] Rework the blueprint editor into clear regions: build palette, tool strip, canvas, status bar, and inspector.
- [ ] Separate build actions from edit/inspect actions.
- [ ] Move bus/lane editing out of the build palette flow.
- [ ] Decide whether the inspector is always visible, contextual, or docked in the side column.
- [ ] Review the build palette grouping and ordering.
- [ ] Make the toolbar compact without hiding core tools.
- [ ] Make the status bar readable without cramming long instructional text.
- [ ] Make the layout responsive without cramped or overlapping states.
- [ ] Review Dockview panel sizing so the editor opens at a useful default size.

## Done Criteria

- Users can quickly distinguish build tools, route tools, selected-object controls, and data inspectors.
- The editor remains usable in narrow Dockview panels.
- The first viewport of the editor shows the actual working canvas, not explanatory UI.
