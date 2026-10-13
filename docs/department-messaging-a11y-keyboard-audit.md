# Department messaging accessibility and keyboard audit

- **Date:** 2026-10-13
- **Result:** Pass after remediation
**Scope:** New department-recipient picker, private thread header and transcript, message composer, and send actions on the Messages portal.

## Summary

The final automated scan recorded **zero axe-core violations across nine UI states**. Keyboard-only navigation reached and activated all six recipient departments available to a Laboratory staff member; the transcript and composer were keyboard reachable; both newline insertion and keyboard send actions worked. The test used Chromium at a 390 × 844 CSS-pixel mobile viewport and mocked all API traffic.

The audit found and corrected one issue before the final pass: the outgoing-message bubble's white/body and teal-tinted metadata text did not meet color-contrast thresholds on the original medium teal background. The bubble now uses the darker `clinical-700` background and white sender/body/expiry text. The transcript is an explicitly labeled, focusable `role="log"` with polite live announcements, and the channel/recipient groups are named sections.

## Automated axe scan

| Item | Result |
|---|---|
| Engine | axe-core 4.14.0 |
| Browser | Headless Chromium |
| Viewport | 390 × 844 CSS px |
| Scan scope | `#main-content` (Messages page content) |
| Rule tags | WCAG 2 A/AA, WCAG 2.1 A/AA, WCAG 2.2 AA, axe best-practice |
| States scanned | 9: default picker; each of six department threads; populated thread after two keyboard sends |
| Final violations | **0** |

The initial contrast finding targeted the outgoing sender label, message text, and expiry text. After darkening the bubble and changing those foregrounds to white, all nine scans passed.

## Keyboard-only checks

| Interaction | Result |
|---|---|
| Reach recipient picker from the page's initial focus position using `Tab` | Pass |
| Traverse all six recipient choices in rendered order | Pass |
| Select recipients with alternating `Enter` and `Space` | Pass for `CLINICAL`, `IMAGING`, `PHARMACY`, `FRONT_OFFICE`, `FINANCE`, and `ADMINISTRATION` |
| Confirm each choice exposes a single `aria-pressed="true"` state | Pass |
| Confirm visible focus treatment on every activated recipient | Pass |
| Tab from recipient list through labeled conversation log to compose textarea | Pass |
| `Shift+Enter` inserts a newline without sending | Pass; textarea retained `Keyboard audit\nsecond line` |
| `Enter` in the textarea sends to the selected department | Pass; submitted `recipientDepartment: "ADMINISTRATION"` |
| `Tab` to the Send button and activate it with `Enter` | Pass; second message reached the same selected department |
| Browser page exceptions | 0 |

The transcript is a purposeful focus stop between the recipient list and composer, so keyboard users can scroll/read the conversation before composing. It is labeled with the selected channel/department and uses polite live-region behavior for new messages.

## Test fixture and limitations

- A Laboratory staff profile was used so the picker exposed all six other departments while excluding Laboratory itself.
- Channel, thread, and send endpoints were intercepted with synthetic responses. No live patient/staff messages were accessed or changed.
- This is an automated DOM/accessibility-rule and keyboard-event audit, not a manual screen-reader review. It did not test assistive-technology/browser combinations, authenticated backend integration, desktop/tablet viewports, zoom/reflow, or localization.
- Follow-up before a formal accessibility conformance claim: manual NVDA/Firefox and VoiceOver/Safari checks, plus tablet/desktop and 200% zoom passes.

## Related API reference

See [Inter-departmental messaging API](./interdepartmental-messaging-api.md) and the [sequence diagram](./interdepartmental-messaging-sequence.png) (editable [Mermaid source](./interdepartmental-messaging-sequence.mmd)).
