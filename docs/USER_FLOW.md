# Current User Flow

How the app works today, from each role's point of view. For the original design rationale and decisions, see [FLOW_REWORK_PLAN.md](FLOW_REWORK_PLAN.md); this document describes the system as built (source of truth: `server/src/modules/incidents/incidentWorkflow.rules.ts`).

## Roles

There are exactly four roles. Permissions are enforced server-side on every request (never trusted from the client or cached in the login token).

| Role | Who | Can do |
|---|---|---|
| **Staff** | Anyone who reports an incident (nurses, technicians, any hospital employee) | Report incidents, view their own reports (status + final outcome only), answer Quality's questions |
| **Quality** | Patient Safety / Quality department | Triage every new report: request info, reject, or assign to the responsible department's HOD; final review of every closure |
| **HOD** | Head of the department an incident is assigned to | Investigate, write the RCA (when required), create and complete CAPA actions, submit for closure, or return a wrongly-assigned incident to Quality |
| **Admin** | IT / hospital administration | Manage users, departments, locations and incident categories; view all dashboards and reports. Does **not** take part in the incident workflow itself |

A user's role is fixed at the account level (`server/src/seeders/systemRoles.ts`); there is no per-incident role assignment beyond "whoever is HOD of the responsible department right now."

## The incident lifecycle

```
SUBMITTED ──ASSIGN──────────────► ASSIGNED ──START_INVESTIGATION──► UNDER_INVESTIGATION
   │  │                               │                                    │
   │  │                       RETURN_TO_QUALITY                  COMPLETE_INVESTIGATION
   │  │                     (back to SUBMITTED)                            │
   │  │                                                                    ▼
   │  └─REQUEST_INFO──► INFO_REQUESTED ──RESPOND_INFO──► SUBMITTED   CAPA_IN_PROGRESS
   │                                                                        │
   └─REJECT──► REJECTED (final)                                    SUBMIT_CLOSURE
                                                                            │
                                                                            ▼
                                              CLOSED (final) ◄─REVIEW_ACCEPT─ PENDING_QUALITY_REVIEW
                                                                            │
                                                                     REVIEW_RETURN
                                                                    (back to CAPA_IN_PROGRESS)
```

Severity 1–2 incidents skip CAPA entirely: `COMPLETE_INVESTIGATION` is not available at that severity, and `SUBMIT_CLOSURE` moves straight from `UNDER_INVESTIGATION` to `PENDING_QUALITY_REVIEW` once the investigation has findings.

**REJECTED and CLOSED are final.** There is no reopening — if the same problem happens again, Staff report a new incident.

## Step by step

1. **Staff reports an incident** (`INCIDENT_CREATE`)
   Fills in: what happened, when, the department where it occurred, the location (floor/zone/room), category and subcategory, an initial severity (1–5), and optionally patient details and file attachments. This creates the incident in status `SUBMITTED` and puts it in Quality's triage inbox.

2. **Quality triages it** (`INCIDENT_TRIAGE`) — one of three actions:
   - **Request info** — asks the reporter a question. Status → `INFO_REQUESTED`. Staff answers (`INCIDENT_RESUBMIT`), which puts it straight back to `SUBMITTED`.
   - **Reject** — with a mandatory reason (duplicate, not a genuine incident, etc.). Status → `REJECTED`, final.
   - **Assign** — picks the **responsible department** (not necessarily the department Staff entered as "where it occurred") and confirms or changes the severity Staff gave. The chosen department must have an active HOD. Status → `ASSIGNED`. Confirming severity here is what decides whether an RCA and/or CAPA will be required later:
     - Severity ≥ 3 → CAPA required
     - Severity ≥ 4 → RCA required too
     - The HOD cannot change the severity Quality confirmed.

3. **The HOD investigates** (`INVESTIGATION_WRITE`, `RCA_WRITE`)
   - Starts the investigation (`START_INVESTIGATION`): status → `UNDER_INVESTIGATION`.
   - If the responsible department is wrong, the HOD can **return it to Quality** (`RETURN_TO_QUALITY`) with a reason instead of investigating — status → back to `SUBMITTED` for re-triage.
   - Writes up the investigation (timeline, findings, contributing factors) and, if severity ≥ 4, a 5-Why RCA.
   - Once findings are recorded (and the RCA is complete, if required), completes the investigation (`COMPLETE_INVESTIGATION`) — status → `CAPA_IN_PROGRESS` if CAPA is required at this severity, otherwise the HOD submits for closure directly from `UNDER_INVESTIGATION`.

4. **The HOD manages CAPA** (`CAPA_WRITE`) — only when required (severity ≥ 3)
   Creates one or more corrective/preventive actions, each with a type, priority and target date. A CAPA starts `OPEN`, moves to `DONE` when the HOD marks it done, and Quality later marks it `EFFECTIVE` or sends it back. Every `OPEN` CAPA must be `DONE` before the incident can be submitted for closure.

5. **The HOD submits for closure** (`INCIDENT_SUBMIT_CLOSURE`)
   Requires: investigation complete with findings, RCA complete (if required), at least one CAPA with none still `OPEN` (if required), and a closure summary. Status → `PENDING_QUALITY_REVIEW`.

6. **Quality does the final review** (`INCIDENT_REVIEW`)
   Gives a verdict (effective / not effective) on every `DONE` CAPA, plus closure remarks.
   - **Accept** (`REVIEW_ACCEPT`) — only possible once every CAPA is accepted as effective. Status → `CLOSED`, final. The reporter and HOD are notified.
   - **Return** (`REVIEW_RETURN`) — sends it back with remarks. Status → `CAPA_IN_PROGRESS` for more work.

7. **Admin**, throughout, manages the master data everything above depends on (users, department HOD assignments, locations, incident categories/subcategories) and views hospital-wide dashboards and reports. Admin does not appear anywhere in the transitions above.

## What each role sees

- **Staff** see only: status, current responsible department (name only), any info-request Q&A, the rejection reason if rejected, and — once closed — the final closure remarks. They do not see the investigation, RCA, CAPA detail, or Quality's internal review (`toStaffView` in `incident.controller.ts` is the exact allow-list).
- **HOD** see everything for incidents currently or previously assigned to their department.
- **Quality and Admin** see every incident, in full.

## Notifications

Triggered automatically on each transition (`server/src/modules/notifications/workflowNotifications.ts`); the person who performed the action is never notified of their own action.

| Event | Who is notified |
|---|---|
| Staff submits (or resubmits after answering a question) | Quality |
| Quality requests info | Staff (reporter) |
| Quality rejects | Staff (reporter) |
| Quality assigns | HOD of the responsible department — in‑app **and** WhatsApp, if configured |
| HOD returns to Quality | Quality |
| HOD submits for closure | Quality |
| Quality returns for more work | HOD |
| Quality accepts and closes | Staff (reporter) and HOD |

Notification failures never block the workflow action itself.

## Key rule of thumb

Two different "departments" exist on every incident, and mixing them up is the most common source of confusion:

- **Occurred-in department** — set by Staff when reporting; where the incident physically happened.
- **Responsible department** — set by Quality at assignment; whose HOD actually investigates. Usually the same as occurred-in, but not always (e.g. a housekeeping incident that occurred in a ward is routed to Housekeeping, not the ward's HOD).
