# Phase 2 Mobile Flow Fixes

This phase moves mobile page actions out of the crowded global header and makes shared content components behave like mobile app UI.

## Changed files

- `src/components/ui/PageHeader.jsx`
- `src/components/ui/MobileActionBar.jsx`
- `src/components/ui/FilterPanel.jsx`
- `src/components/ui/Card.jsx`
- `src/components/ui/DataTable.jsx`
- `src/styles/index.css`

## What changed

### PageHeader
- Still sends full title/description/actions to the desktop header.
- On mobile, it now renders page descriptions and page actions inside the page body below the compact header.
- This restores important mobile actions such as New Order, Add Patient, Export, Prepare Delivery, and API mode buttons.

### MobileActionBar
- New shared mobile-only component for page actions.
- Forces buttons, inputs, and select controls to become full-width and tap-friendly on phones.

### Card
- Card headers are now mobile-first.
- Card actions stack cleanly on small screens and remain inline/flexible on desktop.
- Card padding and radius are reduced on mobile for better screen economy.

### DataTable
- Mobile table cards now use the first/marked column as the card title.
- Secondary fields are grouped into readable mobile detail blocks.
- Action columns are separated into a dedicated touch-friendly action area.

### CSS
- Added mobile guard styles for action spacing and overflow wrapping.

## Expected result

- Page-level actions no longer disappear on mobile.
- Filters and buttons inside cards no longer squeeze the layout.
- Tables are more readable as mobile cards.
- Mobile pages follow a cleaner flow: compact app header, page description/action area, then content.
