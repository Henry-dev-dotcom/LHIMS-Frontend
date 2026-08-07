# Phase 3 Mobile UX — Sheets, Menus, Dashboards

Implemented after Phase 2 mobile flow fixes.

## Scope

This phase improves the mobile interaction layer across the whole frontend without changing backend contracts or business logic.

## Completed changes

### 1. Modal bottom-sheet refinement

Updated `src/components/ui/Modal.jsx` so shared popups behave better on phones:

- Portal rendering to `document.body` for safer layering.
- Mobile-first bottom-sheet layout.
- `100dvh` height handling for mobile browser chrome.
- Scrollable body area with sticky-style header/footer structure.
- Safe-area footer padding for iPhone/Android navigation bars.
- Full-width mobile footer buttons.
- Escape key and backdrop close behavior retained.

This affects workflows such as result entry, catalog views, scan uploads, review dialogs and other shared modal-based interactions.

### 2. Notification drawer mobile upgrade

Updated `src/components/ui/NotificationDrawer.jsx`:

- Mobile notifications now open as a bottom sheet instead of a cramped floating popover.
- Desktop notification popover positioning is preserved.
- Added mobile backdrop and safe-area spacing.
- Improved long notification text wrapping.
- Made notification actions easier to tap on phones.
- Outside-click and Escape close behavior retained.

### 3. User menu mobile bottom-sheet behavior

Updated `src/layouts/Header.jsx`:

- User menu now becomes a phone-friendly bottom sheet on mobile.
- Desktop positioning still uses viewport-aware portal placement.
- Mobile session actions remain easy to tap.
- Existing outside-click behavior retained.

### 4. Dashboard card polish

Updated:

- `src/components/ui/MetricCard.jsx`
- `src/components/ui/InsightStrip.jsx`
- `src/components/ui/WorkflowTimeline.jsx`

Mobile improvements:

- Better metric-card tap/read size.
- Less cramped dashboard card spacing.
- Better insight card wrapping.
- Workflow timeline now reads more clearly as stacked mobile steps.
- Desktop layout behavior remains intact.

## Validation

Completed successfully:

```bash
npm run build
npm run qa
```

The only build message is the existing Vite large chunk warning. It is not a build failure.
