# WhatsApp Template — Incident Assigned to HOD

Used by `server/src/modules/notifications/workflowNotifications.ts` (`notifyHodByWhatsapp`)
whenever Quality assigns an incident to a department (`ASSIGN` workflow event). Delivery goes
through **WATI** (https://wati.io), a WhatsApp Business API provider. Like all WhatsApp Business
providers, WATI requires a **pre-approved template** to message someone outside a 24h session
window (i.e. the normal case for a first-time transactional notification) — so this template
must be created in WATI (which submits it to Meta for approval) before
`WHATSAPP_NOTIFICATIONS=true` will reliably reach the HOD.

## Register this template in WATI

WATI dashboard → **Team Inbox / Broadcast → Message Templates → New Template**.

**Name:** `incident_assigned_hod`
**Category:** `Utility`
**Language:** English

**Body:**
```
Hello {{1}},
A new incident has been assigned to your department by Quality.
Incident: {{2}}
Severity: {{3}}
Remarks: {{4}}

Open: {{5}} Please log in and start the investigation.
```

**Footer:**
```
Adhiparasakthi Hospitals
```

**Buttons:** none

### Sample values (WATI asks for one example per variable during submission)
| Placeholder | Example |
|---|---|
| `{{1}}` | Dr. Ramesh |
| `{{2}}` | INC-2026-000023 - Laparoscopy camera stack unavailable |
| `{{3}}` | Minor Harm (Level 2) |
| `{{4}}` | Please review promptly - case delayed 70 minutes. |
| `{{5}}` | https://your-domain.com/incidents/64f1a2b3c4d5e6f7a8b9c0d1 |

WATI submits it to Meta for review; approval usually takes minutes to a few hours. Status shows
in the same Message Templates screen.

## Everything needed to actually send it

1. **A WATI account with a connected WhatsApp Business number** — https://wati.io. The number
   can't already be active on the regular WhatsApp app or WhatsApp Business app.
2. **Your account's API Endpoint** — you already have this. It's account-specific, e.g.
   `https://live-mt-server.wati.io/123456`, shown in WATI dashboard → **API Docs**.
3. **Your Access Token** — from the *same* API Docs page as the endpoint (Bearer token, shown
   right above/below the endpoint URL). Both are needed; the endpoint alone can't authenticate.
4. **The template above, created in WATI and APPROVED** by Meta (step above). Must read as
   transactional/utility, not marketing, or it's rejected.
5. **Each HOD's WhatsApp number on their user profile**, with country code
   (e.g. `+91 98765 43210` — the app strips everything but digits before sending). Already
   built into Admin → Users as the "WhatsApp Number" field when creating/editing an HOD.

## Wire it up

Set in `server/.env`:
```
WHATSAPP_NOTIFICATIONS=true
WATI_API_ENDPOINT=https://live-mt-server.wati.io/123456
WATI_ACCESS_TOKEN=<your WATI access token>
WATI_TEMPLATE_NAME=incident_assigned_hod
```

`sendWhatsappTemplate` (in `server/src/modules/notifications/whatsapp.ts`) is used automatically
once `WATI_TEMPLATE_NAME` is set — no further code changes needed. It calls WATI's
`POST {endpoint}/api/v1/sendTemplateMessage?whatsappNumber=<number>` with the template name and
the five `{{1}}..{{5}}` values filled from the incident (HOD name, incident ref, severity,
Quality's remarks, and a direct link to that incident: `{APP_URL}/incidents/{incidentId}`).

If `WATI_TEMPLATE_NAME` is left blank, the app falls back to a free-form text message via WATI's
session-message endpoint — only deliverable while the HOD has an open 24h WhatsApp session with
your business number (e.g. they messaged it recently), useful for local testing only.
