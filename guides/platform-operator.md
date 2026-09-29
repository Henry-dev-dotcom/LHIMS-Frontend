# Platform operator guide

You run LHIMS for all facilities. Sign in with **no facility code**.

## Overview

**Platform → Overview**: monthly and yearly recurring revenue, payments in the last 30 days,
subscriptions by status, churn, facilities and new sign-ups, revenue by month, trials ending this
week, failed renewal payments, and **demo requests** from the website (mark them contacted or
closed).

## Facilities

**Platform → Facilities**:

- **New facility**: either on a plan (it starts a free trial and pays online), or *managed
  directly* (you choose its departments by hand; nothing is billed online).
- **Departments**: switch departments for directly managed facilities. (For facilities on a plan,
  departments come from the plan and add-ons.)
- **Suspend / Reactivate**: suspension stops everyone in that facility on their next action. Use it for abuse
  or at the facility's request — not for late payment (unpaid facilities become read-only on
  their own).

## Support sessions

**Facilities → Support** opens a read-only, 30-minute view of the facility as its administrator:

- give a clear reason (for example the problem the facility reported);
- the facility sees the visit and your reason in its audit log;
- nothing can be changed and no data can be exported;
- it ends your console session; **End support session**, then sign in again.

Facilities can refuse support access; respect that and ask them for screenshots instead.

## Plans & Billing

- **Plans**: name, monthly price, yearly discount, staff limit, trial length, departments, and
  whether it is shown on the website. Changing departments applies to the plan's subscribers at
  once; price changes apply from each subscriber's next renewal.
- **Add-on prices**: monthly price of each department bought on top of a plan.
- **Subscribers**: every facility on a plan, its status, unpaid amount and saved payment method.
- **Run billing now**: runs the renewal cycle immediately (it also runs every hour).

## Routine

See `docs/LAUNCH_CHECKLIST.md` in the backend repository (§6): daily alerts and overview, weekly
off-site backup, monthly restore check.
