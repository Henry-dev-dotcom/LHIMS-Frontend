# Administrator guide

You manage your facility's CurataMed: staff, what each person may do, prices, the subscription and
your facility's data.

## First day: Facility Setup

After signing up you land on **Admin → Facility Setup**. Work down the list:

1. **Facility details** — name, phone, address (needed to finish) and logo (PNG/JPEG/WebP, up to
   200 KB). Also choose whether CurataMed support may look in when you ask for help (see below).
2. **Departments and plan** — shows what is switched on. Change it under **Subscription & Billing**.
3. **Staff accounts** — **Add staff** opens **User Management**.
4. **Price list** — import your prices from a CSV file, or **Add a starter list** and then set your
   own prices in **Price Catalog**.
5. **Your first patient** — register a patient at reception and open a visit.

**Finish setup** when the details are saved. You can come back to Facility Setup at any time.

Share the **sign-in link** shown at the top of Facility Setup with your staff.

## Staff and roles

- **User Management**: create an account per person with a standard role (doctor, nurse,
  receptionist, lab, scan, pharmacist, billing, administrator). Give each person their temporary
  password privately.
- **Roles & Permissions**: make a custom role from a standard one and pick exactly what it may do
  (for example a "Ward clerk" who can admit but not prescribe).
- Deactivate accounts of people who leave; never share accounts.
- Your plan may limit the number of active staff accounts.

## Prices

**Price Catalog** holds every billable item: consultations (type SERVICE), lab tests (LAB), scans
(SCAN), procedures (SERVICE with codes starting `PROC-`). Items with an NHIS tariff code are
claimed with that code.

CSV import (Facility Setup → Price list): columns `code,name,type,price` and optionally
`sampleType,modality,tariffCode`. Download the template to start. Items whose code already exists
are updated. If any row is wrong, nothing is imported and every bad row is listed.

## Subscription & Billing

- See your plan, departments, price, next payment date and invoices.
- **Choose a plan and pay** / **Renew**: you are taken to Paystack (card or mobile money). The
  method you pay with is kept for automatic renewals.
- **Change plan or departments**: plans are grouped by the kind of facility you run — diagnostic
  centre, pharmacy, clinic or hospital — so start by picking yours, then the plan within it. You
  can switch kind here too, if what you run has changed.
- Any department can be added to any plan, whatever kind you chose: a diagnostic centre that opens
  a dispensary simply adds Pharmacy.
- Adding departments or moving to a bigger plan takes effect now, charged only for the rest of the
  period. Removing departments, a smaller plan and a change of billing period start at the next
  renewal — you keep what you have paid for until then.
- If a renewal fails, you have a grace period (shown in the banner). After it, the facility becomes
  read-only until paid — nothing is deleted.
- **Cancel subscription** ends it at the end of the paid period; **Keep my subscription** undoes that.

## Audit log and support access

- **Audit Log** records sign-ins, changes, refused actions, exports and support sessions.
- **Support access** (Facility Setup): when on, CurataMed support can open a 30-minute, read-only view
  of your facility to help you. Each visit, with the reason, appears in your audit log. Turn it off
  to refuse all support access.

## Your data

Facility Setup → **Your data** → **Download all data (JSON)** gives a complete copy of everything
your facility holds (passwords and payment details are left out). Use it for your own records, to
move to another system, or to answer a patient's data request. The file contains patient records:
store it securely. Downloads are recorded in the audit log.

Patient requests for copies of their records go through **Medical Records → release requests**.
