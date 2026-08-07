# Mobile information sections horizontal alignment update

## Summary

This update makes page-level mobile information/summary sections display as compact one-line horizontal strips instead of large stacked cards.

## What changed

- Simple `Card` summary blocks now receive a `clinical-stat-card` marker automatically.
- Any mobile grid that contains direct `MetricCard` or `clinical-stat-card` children now renders as a compact horizontal summary strip.
- Metric icons are hidden in these mobile summary strips so the text and numbers have enough room.
- Accepted Samples, Lab Queue, Accepted Scans, Scan Review, Admin Settings, and similar pages now keep summary blocks in one line on mobile.
- Larger content cards, forms, search panels, and workspaces remain full-width.

## QA completed

Frontend:

```bash
npm run qa
```

Backend static QA:

```bash
npm ci --ignore-scripts
npm run qa
```

Both passed successfully. The normal Vite large-chunk warning is not an error.
