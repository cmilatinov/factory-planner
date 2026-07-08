# Verification

Track checks needed before considering blueprint editor UX work complete.

## Checklist

- [ ] Add or update e2e coverage for active tool styling.
- [ ] Add or update e2e coverage for selected object states.
- [ ] Add or update e2e coverage for route preview states.
- [ ] Add or update e2e coverage for bus inspector states.
- [ ] Add screenshot-based manual checks for desktop layout.
- [ ] Add screenshot-based manual checks for narrow panel layout.
- [ ] Check that canvas content is visible and framed after editor opens.
- [ ] Check that labels, controls, and badges do not overlap.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm e2e`.

## Done Criteria

- Automated checks pass.
- Manual screenshot checks cover the main editor states.
- Visual polish work does not regress existing blueprint editor flows.
