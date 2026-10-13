# Inter-departmental messaging API

- **Applies to:** LHIMS backend messaging routes and the department-recipient UI
- **Reference date:** 2026-10-13
- **Default API prefix:** `/api` (`API_PREFIX` is configurable)
- **Backend implementation:** `Henry-dev-dotcom/diagnosis-center-backend`, commit `0f3745f`
- **Frontend implementation:** `Henry-dev-dotcom/LHIMS-Frontend`, commit `23986ed` (messaging feature baseline)

This guide describes the current API contract for shared staff channels and private, two-department conversations. The rendered flow diagram is [available as PNG](./interdepartmental-messaging-sequence.png), with editable Mermaid source in [interdepartmental-messaging-sequence.mmd](./interdepartmental-messaging-sequence.mmd). UI accessibility and keyboard findings are in the [department-messaging audit report](./department-messaging-a11y-keyboard-audit.md).

## 1. Base path, authentication, and response envelopes

Unless the deployment overrides `API_PREFIX`, prepend `/api` to the routes below. All messaging routes require an authenticated staff session. Read endpoints require `MESSAGES_READ`; posting requires `MESSAGES_SEND`. The frontend uses the authenticated API client and does not send a sender ID or sender-department value.

Successful responses use the standard envelope:

```json
{
  "success": true,
  "message": "Department conversation loaded successfully",
  "data": {}
}
```

Errors use the standard error envelope (`success: false`, `message`, `code`, `requestId`, `method`, `path`, and `timestamp`; `errors` may be present for validation failures). Production responses omit internal `details`.

## 2. Department identity and sender mapping

The server derives a sender's department from the authenticated staff role. Clients may select a **recipient** department, but cannot claim their own department.

| Department key | Display label | Roles mapped to this department |
|---|---|---|
| `CLINICAL` | Clinical team | `DOCTOR`, `NURSE` |
| `LABORATORY` | Laboratory | `LAB_STAFF` |
| `IMAGING` | Scan / Imaging | `SCAN_STAFF` |
| `PHARMACY` | Pharmacy | `PHARMACIST` |
| `FRONT_OFFICE` | Front office | `RECEPTIONIST` |
| `FINANCE` | Finance | `BILLING_STAFF` |
| `ADMINISTRATION` | Administration | `ADMIN` |

The direct-recipient picker returns every known department except the caller's own. A platform-operator role is not mapped to a staff department and cannot use direct-department threads. An administrator maps to `ADMINISTRATION`; that does not grant a cross-department browse of all private conversations.

Existing shared channel keys remain `ALL`, `CLINICAL`, `LABORATORY`, `IMAGING`, `PHARMACY`, `FRONT_OFFICE`, and `FINANCE`. Channel membership is role-aware; administrators retain the existing shared-channel access.

## 3. Endpoints

### 3.1 List shared channels and direct recipients

```http
GET /api/messages/channels
```

Requires `MESSAGES_READ`. No query parameters.

`data` contains role-visible shared channels, the caller's department identity, and selectable *other* departments:

```json
{
  "ttlHours": 24,
  "channels": [
    {
      "key": "ALL",
      "name": "All departments",
      "description": "Anything the whole building needs to know.",
      "messageCount": 4
    },
    {
      "key": "LABORATORY",
      "name": "Laboratory",
      "description": "The bench: samples, analyzers, reagents.",
      "messageCount": 2
    }
  ],
  "ownDepartment": {
    "key": "LABORATORY",
    "name": "Laboratory",
    "description": "The laboratory team."
  },
  "directDepartments": [
    {
      "key": "FINANCE",
      "name": "Finance",
      "description": "The cashier window and finance team."
    },
    {
      "key": "ADMINISTRATION",
      "name": "Administration",
      "description": "Facility administrators."
    }
  ]
}
```

The example is abbreviated: `channels` and `directDepartments` vary with the authenticated role. `messageCount` counts only unexpired shared-channel messages; it does not expose private-thread counts.

### 3.2 Read a shared channel

```http
GET /api/messages/{channel}?limit=100
```

Requires `MESSAGES_READ` and access to that channel. `channel` must be one of the shared channel enum keys. `limit` is an optional integer from 1 through 200; default 100.

```json
{
  "success": true,
  "message": "Messages loaded successfully",
  "data": {
    "channel": "ALL",
    "ttlHours": 24,
    "messages": []
  }
}
```

Only records with `recipientDepartment: null` are included. Direct-department messages are not part of group-channel history, even though the legacy `channel` column stores `ALL` for those rows.

### 3.3 Read a two-department conversation

```http
GET /api/messages/departments/{department}?limit=100
```

Requires `MESSAGES_READ`. `department` must be a known department key and must not be the caller's own department. The result is scoped to the caller's department and the requested department, in either direction:

```json
{
  "success": true,
  "message": "Department conversation loaded successfully",
  "data": {
    "department": {
      "key": "FINANCE",
      "name": "Finance",
      "description": "The cashier window and finance team."
    },
    "ownDepartment": "LABORATORY",
    "ttlHours": 24,
    "messages": []
  }
}
```

For example, the `LABORATORY` ↔ `FINANCE` conversation includes messages sent by either department to the other. It does not include `CLINICAL` ↔ `FINANCE` or any other pair. A staff member from an unrelated department querying that pair receives an empty thread rather than its messages.

`limit` follows the same 1–200 range and default of 100 as shared-channel reads. Results are ordered oldest first. There is currently no cursor/offset pagination; callers should not treat the limit as a complete-history guarantee for threads exceeding the returned window.

### 3.4 Send a shared-channel or direct-department message

```http
POST /api/messages
Content-Type: application/json
```

Requires `MESSAGES_SEND`. Supply **exactly one** destination: `channel` for a shared channel, or `recipientDepartment` for a private department thread. The backend sets the sender department from the authenticated role.

Shared-channel request:

```json
{
  "channel": "ALL",
  "body": "The laboratory will close for maintenance at 17:00."
}
```

Direct-department request:

```json
{
  "recipientDepartment": "FINANCE",
  "body": "The pending lab order is ready for reconciliation."
}
```

Validation rules:

- Exactly one of `channel` and `recipientDepartment` must be supplied.
- The destination must be a known enum key; a staff member cannot direct a message to their own department.
- `body` is trimmed, must contain at least one character after trimming, and may contain at most 2,000 characters after trimming.
- The sender department and sender ID are derived server-side; do not include them in the request.

Success returns HTTP `201` and the created message in the standard envelope. The returned row includes its generated ID, channel, nullable department fields, sender ID, body, creation/expiry timestamps, facility scope, and sender summary (`id`, `name`, `role`). Direct messages currently persist `channel: "ALL"` as a legacy storage value; `recipientDepartment` distinguishes them, and group reads explicitly exclude rows where that field is non-null.

## 4. Message lifecycle, ordering, and tenant isolation

- Every new message expires 24 hours after creation. Read queries filter out expired messages; expired rows are also deleted opportunistically during messaging operations.
- Message lists are ordered by `createdAt` ascending.
- Direct-thread queries match only the two directional department pairs and require an authenticated staff department.
- The `StaffMessage` rows carry a facility ID. The application uses the current facility/tenant database scope; the schema adds indexes for facility + sender/recipient department + expiry.
- Messages are intentionally ephemeral and are not written to permanent audit history. Information that must be retained belongs in the appropriate patient record.
- The frontend refreshes the active thread every 15 seconds and refreshes the channel summary after sending.

## 5. Errors and common status codes

| HTTP | Code / condition | Meaning |
|---|---|---|
| `400` | `VALIDATION_FAILED` | Unknown channel/department enum, invalid `limit`, missing/oversized/blank body, or both/neither destination fields supplied. `errors` describes field-level validation. |
| `400` | `MESSAGE_DEPARTMENT_SELF` | The requested recipient is the caller's own department. |
| `401` | Authentication required/invalid | The request has no valid authenticated staff session. |
| `403` | Permission or department/channel access denied | Missing `MESSAGES_READ` / `MESSAGES_SEND`, unmapped sender role, or a role-inaccessible shared channel. |
| `404` | Route/resource not found | Unknown API route or other not-found application error. Zod enum failures for a supplied route parameter are reported as `400 VALIDATION_FAILED`. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server error; production details are hidden. |

Example validation error:

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_FAILED",
  "requestId": "<request-id>",
  "method": "POST",
  "path": "/api/messages",
  "timestamp": "2026-10-13T12:00:00.000Z",
  "errors": [
    { "field": "body", "message": "A message cannot exceed 2000 characters", "code": "too_big" }
  ]
}
```

## 6. cURL examples

Replace `API_ORIGIN` and use the authenticated session mechanism used by the deployment. Do not put real bearer tokens in source control or documentation.

```bash
# Fetch shared channels and selectable other departments
curl -sS "$API_ORIGIN/api/messages/channels" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Read the Laboratory ↔ Finance thread as a Laboratory staff member
curl -sS "$API_ORIGIN/api/messages/departments/FINANCE?limit=100" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Send a private message to Finance
curl -sS -X POST "$API_ORIGIN/api/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"recipientDepartment":"FINANCE","body":"Please review the pending lab order."}'

# Continue the same private thread as Finance, targeting Laboratory
curl -sS -X POST "$API_ORIGIN/api/messages" \
  -H "Authorization: Bearer $FINANCE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"recipientDepartment":"LABORATORY","body":"Review is complete."}'
```

## 7. Deployment and implementation notes

The backend migration `20261013145300_department_direct_messages` adds nullable `senderDepartment` and `recipientDepartment` columns and two supporting indexes. Apply the normal database migration before deploying code that writes direct messages. The default Swagger UI, when enabled by the backend environment, is served below `${API_PREFIX}/docs`; it defaults to enabled outside production and disabled in production unless explicitly configured.

Current source-of-truth files include backend `src/routes/message.routes.ts`, `src/validators/message.validators.ts`, `src/config/messageChannels.ts`, `src/services/message.service.ts`, `prisma/schema.prisma`, and frontend `src/services/messageService.js` / `src/pages/core/MessagesPage.jsx`.
