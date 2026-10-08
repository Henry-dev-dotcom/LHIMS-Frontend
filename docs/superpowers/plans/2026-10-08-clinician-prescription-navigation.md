# Clinician Prescription Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the Clinician section directly below Overview and add a dedicated Prescriptions entry that opens the existing encounter prescription workflow.

**Architecture:** Extend the existing role-driven `NAV_ITEMS` model with a `doctor-prescriptions` destination. Reuse `OpdQueuePage` for patient/visit selection and pass a focus flag into `EncounterWorkspace` so the prescription card is brought into view without duplicating prescribing logic.

**Tech Stack:** React, Vite, Tailwind utility classes, existing route registry and permission helpers.

**Spec:** User request in the current task: move clinician sections below Overview and add the prescription workflow under that section.

## Global Constraints

- Preserve the existing prescribing API, validation, allergy safety check, and pharmacy role separation.
- Keep the hospital workspace and existing clinician order/result pages behavior unchanged.
- The new page must remain restricted to `doctor` and `admin` through the existing navigation access model.

## Review Focus

- Clinician navigation appears immediately after Overview.
- Prescriptions is visible in the Clinician section and opens a patient visit queue.
- Opening a visit from Prescriptions focuses the existing prescription card.
- Non-clinician navigation and existing OPD behavior remain unchanged.

---

### Task 1: Navigation and route registration

**Files:**
- Modify: `src/data/roles.js`
- Modify: `src/routes/AppRouter.jsx`
- Modify: `src/routes/routeRegistry.js`

- [ ] Move the clinician nav entries so they follow Overview and add `doctor-prescriptions` after the clinician dashboard.
- [ ] Register `doctor-prescriptions` as a doctor/admin page using the existing route metadata and resolver patterns.
- [ ] Verify `git diff --check`.

### Task 2: Reuse the encounter workflow with prescription focus

**Files:**
- Modify: `src/pages/opd/OpdQueuePage.jsx`
- Modify: `src/pages/opd/EncounterWorkspace.jsx`

- [ ] Add a `prescriptionMode` prop to the OPD queue, with prescription-specific heading/copy and no change to the normal OPD route.
- [ ] Pass `focusPrescriptions` to the encounter workspace only from prescription mode.
- [ ] Add a stable prescription-card anchor and focus/scroll it after the encounter loads.

### Task 3: Verification

- [ ] Run `npm run lint:ui`.
- [ ] Run `npm run build`.
- [ ] Confirm the new page ID is included in `NAV_ITEMS`, route resolution, and access checks.
