# Clinician portal: fewer tabs, fewer clicks

Status: approved 2026-10-14 (6 main items + More; 3-tab ward chart). Applies to **hospital doctors**
only. Diagnostic-centre doctors keep their ordering portal, and every other role's menu is unchanged.

**Out of scope, on purpose:** the Clinician Queue and the visit workspace it opens (Visit / Tests &
Results / Medicines, Send to Diagnostics & Suspend, Finish visit). They are not touched.

## 1. The problem

A hospital doctor's sidebar has **28 items in 17 sections**, with four separate lists of patients
(Patients Directory, Medical Records, Patient Records, Patients & Results) and nine clinic pages. The
ward patient chart has **6 tabs**. Finding the next thing to do means scanning a long menu, and a
ward round means clicking between tabs that show parts of the same patient.

## 2. The new sidebar (hospital doctor)

Six items, always in view, in this order:

| Menu label | Opens | Notes |
| --- | --- | --- |
| Clinician Queue | `clinician-queue` | Landing page, unchanged |
| Patients | `patients-directory` | Search every patient; the profile already carries visits, results, medicines and the document vault, so it replaces the other three patient lists for a doctor |
| Wards | `ward-board` | Whiteboard and the ward chart |
| Emergency | `emergency-board` | |
| Clinics | `clinics` (new) | One page; pick the clinic (section 4) |
| Messages | `messages` | |

Then one collapsed **More** group holding everything a doctor uses now and then, grouped under small
headings as today: Theatre List, Blood Bank, Mortuary, Request Supplies, DICOM Viewer, My Rota & Leave,
Duty Rota, OPD Visits, Medical Records, Patients & Results, Prescriptions, Order Registry.

- More opens with one click, remembers whether it was open (per browser), and opens by itself when
  the page showing is one of its items, so the current page is never hidden.
- Removed from the doctor's menu but still reachable by address and in-page links: Overview (the
  queue is the landing page), Patient Records (same patients as Patients), and the nine clinic pages
  (inside Clinics).
- Any item a facility has not switched on stays out, exactly as now (module and permission rules are
  reused, not duplicated).

**Mobile bottom bar** for a hospital doctor: Home (queue), Patients, Wards, Messages, Menu. Today it
offers Orders and Rx links a hospital doctor cannot open.

28 items in 17 sections -> 6 items + More.

## 3. Ward chart: 6 tabs -> 3

| Tab | Holds |
| --- | --- |
| Round | Trend graphs, record vitals, fluid balance, and today's round note with Copy yesterday's note, on one screen |
| Medicines | The dose chart (unchanged) |
| Results & orders | Results, order builder, Mark results reviewed (unchanged) |

The header action bar keeps Save updates, Transfer bed and Discharge, and gains **Full record**
(the complete visit record, with a Back to chart button) and **Bed history** (a dialog). An unsaved
note still marks the Round tab and the Save updates button.

## 4. Clinics page

One page lists the clinics this facility runs, as a row of chips grouped Maternity (Antenatal,
Postnatal, Maternity register), Child health (Child welfare, Immunisation due list) and Specialist
(Dental, Eye, Physiotherapy, Dietetics). Choosing one shows that clinic's existing screen below; the
choice is remembered per browser. With a single clinic available it opens straight away; with none,
it says so. Clinic screens themselves are reused unchanged.

## 5. Build order

1. Navigation layout: `src/data/navLayouts.js` (hospital-doctor layout), Sidebar renders primary items
   plus the More group, MobileBottomNav uses the same layout. Nothing changes for other roles.
2. Clinics page: `src/pages/clinics/ClinicsHubPage.jsx`, nav item `clinics`, router and registry.
3. Ward chart: `src/pages/inpatient/InpatientWorkspace.jsx` to 3 tabs, Full record view, Bed history dialog.
4. Tests: e2e for the doctor menu (exactly six items, More, page reachable), the Clinics page, the
   3-tab chart; existing specs updated where a doctor menu label changed. Full run, then PR.

## 6. Done when

- A hospital doctor sees exactly the six items and More; nurses, lab, reception, billing, pharmacy,
  admin and diagnostic-centre doctors see the same menu as before.
- Every page that was in the doctor's menu is still reachable in at most two clicks.
- Ward round (vitals, fluids, note) needs no tab change.
- Clinician Queue and visit workspace behaviour unchanged; their e2e specs pass untouched.
- Full e2e, route/auth/workflow lint and the production build pass.
