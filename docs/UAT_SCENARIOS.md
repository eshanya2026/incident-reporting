# 📋 User Acceptance Testing (UAT) Scenarios & Test Scripts

This document details the scripted User Acceptance Testing (UAT) scenarios for **Adhiparasakthi Hospitals' Incident Reporting & Patient Safety Platform**.

These test scripts are designed for staged verification with hospital stakeholders:
- **Frontline Staff** (`nurse.mary` / `nurse.kavitha`)
- **Quality & Patient Safety Team** (`quality.anita`)
- **Emergency HOD** (`hod.emergency`)
- **ICU HOD** (`hod.icu`)
- **Hospital Administration & Medical Director** (`admin` / `md.director`)

---

## 📑 Test Scenario Index

1. [Scenario 1: Standard Clinical Incident Lifecycle (Staff → Quality → HOD → Quality Closure)](#scenario-1-standard-clinical-incident-lifecycle)
2. [Scenario 2: Information Clarification Request Loop (Quality ↔ Staff)](#scenario-2-information-clarification-request-loop)
3. [Scenario 3: Wrong Department Routing & HOD Return Loop (Quality ↔ HOD 1 ↔ HOD 2)](#scenario-3-wrong-department-routing--hod-return-loop)
4. [Scenario 4: Quality Review Rework Send-Back Loop (HOD ↔ Quality)](#scenario-4-quality-review-rework-send-back-loop)
5. [Scenario 5: Structured Rejection of Duplicate / Non-Incident Report](#scenario-5-structured-rejection-of-duplicate--non-incident-report)
6. [Scenario 6: Executive Oversight, Turnaround Benchmarks & Register Exports](#scenario-6-executive-oversight-turnaround-benchmarks--register-exports)

---

## Scenario 1: Standard Clinical Incident Lifecycle

**Objective:** Validate end-to-end reporting, triage, investigation, CAPA implementation, and final closure for a standard Level 3 (*Moderate Harm*) clinical incident.

### Actors & Roles
- **Staff Reporter:** `nurse.mary` (`Staff@123`)
- **Quality Officer:** `quality.anita` (`Quality@123`)
- **Responsible HOD:** `hod.emergency` (`Hod@123`)

### Execution Steps

| Step | Actor | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **1.1** | `nurse.mary` | Log in. Navigate to **Report Incident** (`/incidents/new`). | Rapid reporting form opens. | [ ] |
| **1.2** | `nurse.mary` | Enter: Occurrence Dept: *Emergency Medicine*, Location: *ER Bay 1*, Title: *"Extravasation of peripheral IV line"*, Severity: *2 (Minor)*, Description: *"Dextrose 10% infused with localized swelling"*, Immediate Action: *"IV stopped, cold compress applied"*. Submit. | Success alert. Incident generated with status `SUBMITTED`. | [ ] |
| **1.3** | `nurse.mary` | Navigate to **My Reports** (`/incidents/my-reports`). | Incident appears with status `SUBMITTED` and badge *"Waiting Quality Triage"*. | [ ] |
| **1.4** | `quality.anita` | Log in. Open **Triage Inbox** (`/incidents/triage-queue`). | The new incident is listed at top of the inbox. | [ ] |
| **1.5** | `quality.anita` | Open incident triage modal. Re-evaluate severity from Level 2 to **Level 3 (Moderate Harm)**. Select Responsible Dept: **Emergency Medicine**. Enter assignment remarks. Click **Assign to HOD**. | Incident transitions to `ASSIGNED`. Incident removed from Triage Inbox. Emergency HOD assigned. | [ ] |
| **1.6** | `hod.emergency` | Log in. Open **Department Queue** (`/incidents/department-queue`). | Incident appears with status `ASSIGNED` in the department list. | [ ] |
| **1.7** | `hod.emergency` | Open incident details. Click **Start Investigation**. Record facts, chronology, nurse interview, and contributing factor *Process*. Save. | Status transitions to `UNDER_INVESTIGATION`. Investigation record saved. | [ ] |
| **1.8** | `hod.emergency` | Click **Proceed to CAPA**. Add Corrective Action: *"In-service training on peripheral IV patency monitoring"*, Priority: *High*, Target Date: 14 days out. Save. | Incident transitions to `CAPA_IN_PROGRESS`. CAPA created with status `OPEN`. | [ ] |
| **1.9** | `hod.emergency` | Execute CAPA. Open CAPA item, upload training attendance sheet, enter completion remarks, click **Mark as Completed**. | CAPA status updates to `PENDING_VERIFICATION`. | [ ] |
| **1.10** | `hod.emergency` | Click **Submit for Quality Review**. Enter closure summary: *"Staff re-trained on IV assessment protocol; extravasation policy audited"*. Submit. | Incident status transitions to `PENDING_QUALITY_REVIEW`. | [ ] |
| **1.11** | `quality.anita` | Open **Review Queue** (`/incidents/review-queue`). Open incident. | Incident listed awaiting review. Verification checklist displays completed CAPA. | [ ] |
| **1.12** | `quality.anita` | Mark CAPA verification as **Effective**. Enter formal closure remarks. Click **Accept and Close Incident**. | Incident status transitions to `CLOSED`. Incident timestamped and closed. | [ ] |
| **1.13** | `nurse.mary` | Log in. Open **My Reports** (`/incidents/my-reports`). Open incident. | Status shows **`CLOSED`**. Quality closure remarks are clearly visible. Internal witness statements and CAPA internals remain hidden (Decision D6). | [ ] |

---

## Scenario 2: Information Clarification Request Loop

**Objective:** Validate that Quality can request missing clinical information from frontline staff, and that staff can reply directly to return the report for triage.

### Actors & Roles
- **Staff Reporter:** `nurse.john` (`Staff@123`)
- **Quality Officer:** `quality.anita` (`Quality@123`)

### Execution Steps

| Step | Actor | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **2.1** | `nurse.john` | Submit incident without batch details: *"Patient developed rash after antibiotic dose"*. | Incident created in `SUBMITTED`. | [ ] |
| **2.2** | `quality.anita` | Open Triage Inbox. Click **Request Information**. Question: *"Please specify exact drug name, batch number, and whether antihistamine was given"*. Submit. | Incident transitions to `INFO_REQUESTED`. Removed from active triage list. | [ ] |
| **2.3** | `nurse.john` | Log in. Check notifications. Open **My Reports** (`/incidents/my-reports`). | Notification received. Incident flagged with blue **Information Requested** banner. | [ ] |
| **2.4** | `nurse.john` | Click **Respond to Request**. Enter: *"Ceftriaxone 1g, Batch #CF-8821. 25mg Pheniramine given with full resolution"*. Submit. | Response saved. Incident automatically transitions back to `SUBMITTED`. | [ ] |
| **2.5** | `quality.anita` | Open Triage Inbox (`/incidents/triage-queue`). | Incident re-appears in triage queue with reporter's response displayed. | [ ] |

---

## Scenario 3: Wrong Department Routing & HOD Return Loop

**Objective:** Validate that an HOD can return an incorrectly assigned incident to Quality, and that Quality can re-assign to the correct department without data loss.

### Actors & Roles
- **Quality Officer:** `quality.anita` (`Quality@123`)
- **Pharmacy HOD:** `hod.pharmacy` (`Hod@123`)
- **ICU HOD:** `hod.icu` (`Hod@123`)

### Execution Steps

| Step | Actor | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **3.1** | `quality.anita` | Assign an insulin transcription error to **Hospital Pharmacy** (`hod.pharmacy`) by mistake. | Incident status becomes `ASSIGNED` to Pharmacy. | [ ] |
| **3.2** | `hod.pharmacy` | Open Department Queue (`/incidents/department-queue`). Open incident. | Incident visible in Pharmacy queue. | [ ] |
| **3.3** | `hod.pharmacy` | Click **Return to Quality**. Select reason: *"Wrong department - pharmacy dispensed correctly as prescribed; error was nursing chart transcription"*. Confirm. | Incident status returns to `SUBMITTED`. `hodReturns` record created with timestamp. Incident removed from Pharmacy queue. | [ ] |
| **3.4** | `quality.anita` | Open Triage Inbox. Open incident. | Incident displays previous assignment history and Pharmacy HOD's return rationale. | [ ] |
| **3.5** | `quality.anita` | Re-assign incident to **Intensive Care Unit** (`hod.icu`). | Incident transitions to `ASSIGNED` to ICU. `assignments` array now has 2 entries. | [ ] |
| **3.6** | `hod.icu` | Open Department Queue. | Incident successfully received in ICU queue for investigation. | [ ] |

---

## Scenario 4: Quality Review Rework Send-Back Loop

**Objective:** Validate that Quality can reject an inadequate closure submission, send it back for rework with remarks, and that the HOD can revise and resubmit.

### Actors & Roles
- **Responsible HOD:** `hod.radiology` (`Hod@123`)
- **Quality Officer:** `quality.anita` (`Quality@123`)

### Execution Steps

| Step | Actor | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **4.1** | `hod.radiology` | Complete investigation and create CAPA for a wrong-patient CT call-out. Mark CAPA done and submit for review. | Incident status transitions to `PENDING_QUALITY_REVIEW`. | [ ] |
| **4.2** | `quality.anita` | Open Review Queue (`/incidents/review-queue`). Review submission. Note that CAPA only says "be more careful" with no objective verification. | Incident details loaded. | [ ] |
| **4.3** | `quality.anita` | In review decision, select **Return for Revision**. Enter remarks: *"CAPA lacks an objective verification audit. Please add weekly photographic ID verification check at CT console before resubmitting"*. Submit. | Incident status transitions back to `CAPA_IN_PROGRESS`. `qualityReviews` records `RETURNED` decision. | [ ] |
| **4.4** | System | Check executive dashboard (`/dashboard`). | **Active Rework** counter increments by 1. **Quality Rework Rate** reflects the return. | [ ] |
| **4.5** | `hod.radiology` | Open Department Queue. Open incident. | Rework alert banner shows Quality's revision instructions. | [ ] |
| **4.6** | `hod.radiology` | Revise CAPA to include console photographic verification audit. Attach sample audit log. Resubmit for review. | Incident transitions back to `PENDING_QUALITY_REVIEW`. | [ ] |
| **4.7** | `quality.anita` | Re-open in Review Queue. Verify audit log. Select **Accept and Close Incident**. | Incident transitions to `CLOSED`. | [ ] |

---

## Scenario 5: Structured Rejection of Duplicate / Non-Incident Report

**Objective:** Validate that Quality can reject a duplicate or invalid report with justification, archiving it cleanly from active clinical queues.

### Actors & Roles
- **Staff Reporter:** `nurse.selvi` (`Staff@123`)
- **Quality Officer:** `quality.anita` (`Quality@123`)

### Execution Steps

| Step | Actor | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **5.1** | `nurse.selvi` | Submit report for an air conditioner water leak in Ward 302. | Incident submitted with status `SUBMITTED`. | [ ] |
| **5.2** | `quality.anita` | Open Triage Inbox. Review report. Recognize this is a facility maintenance task, already logged in engineering work order #4401. | Incident loaded in triage modal. | [ ] |
| **5.3** | `quality.anita` | Click **Reject Report**. Select category: *Not a Clinical Safety Incident / Duplicate*. Enter note: *"Routine facility repair already logged on work order #4401; no clinical harm or patient involvement"*. Confirm rejection. | Incident status transitions to `REJECTED`. Removed from Triage Inbox. Unassigned fields cleared. | [ ] |
| **5.4** | `nurse.selvi` | Open **My Reports** (`/incidents/my-reports`). | Incident shows red **`REJECTED`** badge with Quality's explanation clearly visible. | [ ] |

---

## Scenario 6: Executive Oversight, Turnaround Benchmarks & Register Exports

**Objective:** Validate that Hospital Leadership (`ADMIN` / Medical Director) has complete read-only transparency into safety metrics, turnaround benchmarks, and downloadable inspection registers.

### Actors & Roles
- **Medical Director / Administrator:** `md.director` (`Admin@123`)

### Execution Steps

| Step | Actor | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **6.1** | `md.director` | Log in. Navigate to **Executive Dashboard** (`/dashboard`). | Dashboard loads with scope badge `HOSPITAL-WIDE`. | [ ] |
| **6.2** | `md.director` | Inspect Turnaround Benchmarks strip. | Medians displayed for: <br/>1. Submit → Assign (Target: 24h)<br/>2. Assign → Review (Target: 14d)<br/>3. Review → Close (Target: 7d)<br/>4. Total Cycle (Target: 30d). | [ ] |
| **6.3** | `md.director` | Toggle Period selector: **3M**, **6M**, **12M**, and **All Time**. | Charts and KPI cards update dynamically. | [ ] |
| **6.4** | `md.director` | Navigate to **Reports** (`/reports`). | Dual-tab interface displays **Master Incident Register** and **CAPA Compliance Register**. | [ ] |
| **6.5** | `md.director` | Click **Download CSV** on Master Incident Register. | Browser downloads `incident_register.csv` with UTF-8 BOM, including turnaround time columns and department audit trails. | [ ] |
| **6.6** | `md.director` | Click **Print / PDF**. | Print preview renders clean landscape view with hospital letterhead and stripped navigation controls. | [ ] |
| **6.7** | `md.director` | Open any incident from the register. Verify available action buttons. | Incident detail displays full audit record, but action buttons (Triage, Assign, Close) are disabled/hidden (Read-Only). | [ ] |

---

## 🎯 Acceptance Criteria & Sign-Off Checklist

- [ ] All 6 scripted scenarios executed on staging copy with zero unhandled exceptions.
- [ ] Frontline staff reporting requires ≤ 3 minutes.
- [ ] Reporter sees appropriate status and closure summary without exposure to internal investigation fault notes (Decision D6).
- [ ] Triage decisions enforce 24-hour turnaround benchmark tracking.
- [ ] Major and critical incidents (Severity ≥ 4) strictly block closure until RCA (5-Why & Fishbone) is complete.
- [ ] Moderate and higher incidents (Severity ≥ 3) strictly block closure until all CAPAs are verified effective.
- [ ] Exported CSV registers open cleanly in Microsoft Excel with correct character encoding and formatting.
