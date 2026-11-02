# WhatsApp Template — Incident Reporting Notifications

Delivery goes through **WATI** (https://wati.io), a WhatsApp Business API provider. Like all
WhatsApp Business providers, WATI requires a **pre-approved template** to message someone outside
a 24h session window — which is the normal case for a first-time transactional notification (the
recipient hasn't messaged the business number first). Without an approved template, a notification
silently falls back to a free-form "session message," which WATI only delivers if the recipient
already has an open session — so most people simply never receive it.

**One generic template covers every notification type**, present and future. Instead of a
separate template per event, the app always sends this one template and fills its three
parameters with whatever text that notification needs — the notification's title, message,
incident reference and any extra detail lines are all packed into the single `{{2}}` block
(built by `renderMessage` in `whatsappTemplates.ts`, from wording editable in the app), not split into separate variables.

The body is a plain, direct message, not a generic "automated notification" preamble — Meta still
sees a healthy ratio of static wording (155 characters) to variables (3), so dropping that line
doesn't bring back the "too many variables for its length" rejection.

> **Why just three variables:** Meta rejects templates with too many variables relative to their
> length ("This template has too many variables for its length"). Keeping the approved structure
> to three variables — name, one content block, link — wrapped in enough static text satisfies
> that check, while `{{2}}` still carries as much notification-specific detail as needed.

## Create exactly this in WATI

WATI dashboard → **Team Inbox / Broadcast → Message Templates → New Template**.

**Name:** `incident_notification`
**Category:** `Utility`
**Language:** English

**Header (type: Text, no variable):**
```
Incident Reporting Alert
```

**Body:**
```
Hello {{1}},

{{2}}

Please open the link below to view the full incident details and take any necessary action.

{{3}}

Thank you for helping us maintain patient safety.
```

**Footer:**
```
Adhiparasakthi Hospitals
```

**Buttons:** none

### What each parameter carries

| # | Meaning |
|---|---|
| `{{1}}` | Recipient's name |
| `{{2}}` | Multi-line block: bold title, main message, `Incident: <ref>`, and up to two extra detail lines — built from the wording set on the WhatsApp Messages screen (see below) |
| `{{3}}` | Direct link to the incident |

### Sample values (WATI asks for one example per variable during submission)

WATI's sample-value field caps each variable's example at **200 characters** — if you paste
something longer it just gets cut off mid-word (this is a limit on the sample text you type for
Meta's review, not on the real messages the app sends later). Keep the `{{2}}` sample short and
on one line:

| # | Example |
|---|---|
| `{{1}}` | Dr. Ramesh |
| `{{2}}` | New Incident Assigned: A new incident has been assigned to your department. Incident: INC-2026-000023. Severity: Minor Harm (Level 2). |
| `{{3}}` | https://your-domain.com/incidents/64f1a2b3c4d5e6f7a8b9c0d1 |

The real `{{2}}` the app sends is multi-line (title, message, incident reference, detail lines —
see table below) and can run longer than 200 characters; the app caps it at 400 characters
so it never gets close to WhatsApp's 1024-character body limit. Only the one-line sample above is
needed to get the template approved.

Submit it with the sample values above, exactly as shown — WATI/Meta approves the template
structure, not the literal text; real notifications will carry different content in `{{2}}`. It
must read as transactional/utility, not marketing, or it's rejected. Approval usually takes
minutes to a few hours; status shows in the same Message Templates screen.

## Editing what each notification says (no WATI re-approval)

The wording inside `{{2}}` is edited in the app: **WhatsApp Messages** in the navbar (Super Admin
by default; can be granted to other roles in Access Control). For each notification you can change
the bold title, the message and the detail lines, insert placeholders such as `{incident}`,
`{severity}` or `{remarks}`, switch the WhatsApp message off, see a live preview inside the approved
wrapper, and send a test to your own phone. Every change is in the audit log; "Reset to default"
goes back to the built-in wording.

A detail line whose placeholder has no value (e.g. `Quality's remarks: {remarks}` when Quality
wrote none) is left out. The parts are joined with ` | ` on one line, because WATI rejects line
breaks in parameters, and the whole block is capped at 400 characters.

The fixed wrapper (header, "Hello {{1}}", the closing lines, footer) can only be changed by
editing and re-approving the template in WATI.

| Notification | Default title | Default detail lines |
|---|---|---|
| Incident assigned to HOD | New Incident Assigned | Incident; Severity; Quality's remarks |
| Department marked as involved | Department Involved | Incident; Department; Lead department |
| Intimated (CC) on an incident | Intimated on Safety Report | Incident; Lead department |
| Quality asks the reporter a question | Quality Needs More Information | Incident (the question is the message) |
| RCA meeting scheduled | RCA Meeting Scheduled | Incident; When; Where |

Definitions, placeholders and defaults: `server/src/modules/notifications/whatsappTemplates.ts`.

**Adding a new notification later:** add a definition there and call `sendTemplated(key, ...)` in
`workflowNotifications.ts`. No new template or re-approval is needed, since it's all text inside
the existing `{{2}}` parameter.

## Everything else needed to actually send it

1. **A WATI account with a connected WhatsApp Business number** — https://wati.io. The number
   can't already be active on the regular WhatsApp app or WhatsApp Business app.
2. **Your account's API Endpoint** — account-specific, e.g. `https://live-mt-server.wati.io/123456`,
   shown in WATI dashboard → **API Docs**.
3. **Your Access Token** — from the *same* API Docs page as the endpoint (Bearer token, shown
   right above/below the endpoint URL). Both are needed; the endpoint alone can't authenticate.
4. **The template above, created in WATI and APPROVED** by Meta (step above).
5. **Each recipient's WhatsApp number on their user profile**, with country code (e.g.
   `+91 98765 43210` — the app strips everything but digits before sending). Built into
   Admin → Users as the "WhatsApp Number" field for every role.

## Wire it up

Set in `server/.env` (or `.env`/`.env.development` at the repo root, depending on how you run it):
```
WHATSAPP_NOTIFICATIONS=true
WATI_API_ENDPOINT=https://live-mt-server.wati.io/123456
WATI_ACCESS_TOKEN=<your WATI access token>
WATI_TEMPLATE_NAME=incident_notification
```

`sendWhatsappTemplate` (in `server/src/modules/notifications/whatsapp.ts`) is used automatically
once `WATI_TEMPLATE_NAME` is set — no further code changes needed.

If `WATI_TEMPLATE_NAME` is left blank, the app falls back to free-form text via WATI's
session-message endpoint — only deliverable while the recipient has an open 24h WhatsApp session
with your business number (e.g. they messaged it recently), useful for local testing only.
