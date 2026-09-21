# 🛡️ Quality & Patient Safety Role Guide

This guide details the operational responsibilities of the **Quality & Patient Safety Team** (`QUALITY`) within Adhiparasakthi Hospitals.

---

## 1. Overview & Core Responsibilities

The Quality team serves as the hospital's central clinical governance authority:
1. **Gatekeeper of Incident Triage:** Evaluates every safety report submitted by staff, validates severity ratings against NABH standards, and routes incidents to the accountable department HOD.
2. **Investigation & RCA Overseer:** Ensures investigations are rigorous, objective, and timely. Verifies Root Cause Analyses (5-Why & Fishbone) for critical events (Severity ≥ 4).
3. **CAPA Effectiveness Verifier:** Validates that Corrective and Preventive Actions produce real, measurable improvements and audits compliance.
4. **Final Closure Authority:** Grants formal closure approval. No incident can be closed without Quality sign-off.
5. **Hospital-Wide Intelligence:** Monitors safety trends, turnaround benchmarks, recurring risks, and compliance registers.

---

## 2. Daily Workflow & Navigation

| Queue / Page | Route | Purpose |
|---|---|---|
| **Executive Dashboard** | `/dashboard` | Hospital-wide safety KPIs, turnaround benchmarks, triage age, rework rate, and monthly trends. |
| **Triage Inbox** | `/incidents/triage-queue` | All newly submitted reports awaiting severity confirmation and departmental assignment. |
| **Review Queue** | `/incidents/review-queue` | Incidents submitted by HODs awaiting CAPA verification and closure sign-off. |
| **Incident Register** | `/incidents` | Comprehensive searchable register of all hospital incidents across all statuses. |
| **CAPA Manager** | `/capas` | Hospital-wide CAPA list, overdue tracking, and verification interface. |
| **Quality Reports** | `/reports` | Master Incident Register and CAPA Compliance Register with CSV, Excel, and Print/PDF export. |

---

## 3. Triage & Assignment Protocol (`/incidents/triage-queue`)

Every incident submitted by staff lands in `SUBMITTED` status in the Triage Inbox. The hospital target is **triage within 24 hours** (measured on the executive dashboard).

### Actions Available in Triage:

### 1. Assign to Responsible Department (`ASSIGNED`)
- **Review Severity:** Review the reporter's initial severity (Levels 1–5). Confirm or adjust based on clinical facts:
  - **Level 1 (Near Miss):** No harm reached patient.
  - **Level 2 (Minor Harm):** Minimal harm; first aid / observation.
  - **Level 3 (Moderate Harm):** Medical intervention / extended stay. Mandatory CAPA.
  - **Level 4 (Major Harm):** Significant impairment / intensive care. Mandatory RCA + CAPA.
  - **Level 5 (Sentinel Event):** Critical harm, death, wrong-site surgery. Mandatory RCA + CAPA.
- **Select Department:** Choose the department accountable for investigating the incident and writing the CAPA. The system automatically links the assigned HOD (`Department.hodUserId`).
- **Assignment Remarks:** Add clinical notes guiding the HOD's investigation.
- Click **"Assign to HOD"**. Incident transitions to **`ASSIGNED`**.

### 2. Request More Information (`INFO_REQUESTED`)
- If the report lacks essential clinical details (e.g. medication batch number, exact timeline, staff involved):
- Enter the question in the **Request Information** modal.
- Click **"Send Request"**. Incident transitions to **`INFO_REQUESTED`**.
- The reporter receives an in-app notification and prompt in their **My Reports** screen. Once answered, the report returns to your Triage Inbox.

### 3. Reject Incident (`REJECTED`)
- If the submission is a duplicate, test entry, or non-incident issue (e.g., standard facility work order):
- Select the rejection category (e.g., *Duplicate Report*, *Not an Incident*).
- Enter mandatory rejection justification remarks.
- Click **"Reject Report"**. Incident transitions to **`REJECTED`** (archived and excluded from active load).

---

## 4. Closure Review & Rework Protocol (`/incidents/review-queue`)

When an HOD completes the investigation, RCA, and corrective actions, they submit the incident for review (**`PENDING_QUALITY_REVIEW`**).

### Quality Verification Checklist:
1. **Investigation Completeness:** Verify facts, timeline, contributing factors, and recommendations.
2. **RCA Verification (Severity ≥ 4):**
   - Confirm 5-Why analysis interrogates system causes rather than individual human blame.
   - Confirm Fishbone diagram addresses multi-factorial risks (People, Process, Equipment, Environment, Policy).
3. **CAPA Verification:**
   - Audit the evidence attached by the HOD.
   - Verify that actions address root causes rather than superficial symptoms.
   - Perform spot audits or observational checks to verify post-implementation effectiveness.
   - Set CAPA verification status to **`EFFECTIVE`**.

### Review Decisions:

#### Option A: Accept and Close (`CLOSED`)
- If all closure gates pass:
- Enter formal **Closure Remarks** summarizing key safety improvements.
- Click **"Accept and Close Incident"**.
- Incident transitions to **`CLOSED`**. The closure summary becomes visible to the original reporter.

#### Option B: Return to HOD for Rework (`CAPA_IN_PROGRESS`)
- If the CAPA is inadequate, lacks verification criteria, or fails to address the root cause:
- Enter detailed **Rework Remarks** explaining what needs improvement.
- Click **"Return for Revision"**.
- Incident transitions back to **`CAPA_IN_PROGRESS`**. The HOD is notified and must revise the actions before re-submitting. This activity is tracked on the dashboard as **Quality Rework Rate**.

---

## 5. Audit & Compliance Reporting (`/reports`)

- **Master Incident Register:** Full NABH/JCI compliant tabular register including turnarounds (`daysToAssign`, `daysAssignToSubmit`, `daysReviewToClose`, `daysToClose`).
- **CAPA Compliance Register:** Department-wise CAPA status, priority breakdown, overdue flags, and verification notes.
- **Export Options:**
  - **CSV:** RFC-4180 compliant direct streaming with UTF-8 BOM.
  - **Excel:** Formatted `.xlsx` spreadsheet with styled headers and column widths.
  - **Print / PDF:** Optimized landscape print view with hospital branding.
