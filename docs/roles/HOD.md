# 👨‍⚕️ Head of Department (HOD) Role Guide

This guide details the operational responsibilities of a **Head of Department** (`HOD`) within Adhiparasakthi Hospitals.

---

## 1. Overview & Departmental Accountability

Every clinical and operational department has a designated Head of Department linked via `Department.hodUserId`. When the Quality & Patient Safety team assigns an incident to your department, you are accountable for:
1. **Verifying Assignment Accuracy:** Confirming the incident belongs to your department or returning it promptly to Quality.
2. **Conducting the Clinical Investigation:** Interviewing witnesses, reconstructing the timeline, identifying contributing factors, and documenting findings.
3. **Leading Root Cause Analysis (RCA):** For Severity ≥ 4 events, performing systematic 5-Why and Ishikawa (Fishbone) investigations.
4. **Writing & Implementing CAPA:** Developing actionable Corrective and Preventive Actions, assigning departmental owners, setting deadlines, and ensuring execution.
5. **Submitting for Quality Review:** Providing a comprehensive closure summary for safety committee sign-off.
6. **Resolving Quality Send-Backs (Rework):** Addressing any deficiencies or verification requirements raised by Quality.

---

## 2. Daily Workflow & Navigation

| Queue / Page | Route | Purpose |
|---|---|---|
| **Department Dashboard** | `/dashboard` | Department-scoped safety KPIs, active load by status, overdue CAPAs, turnaround benchmarks, and rework alerts. |
| **Department Queue** | `/incidents/department-queue` | All active incidents assigned to your department across workflow stages. |
| **CAPA Manager** | `/capas` | Action plans owned by your department, target dates, and completion status. |
| **Department Register** | `/reports` | Department-filtered audit registers with CSV and Excel exports. |

---

## 3. Step-by-Step Incident Resolution Flow

### Step 1: Receiving & Reviewing Assigned Incidents (`ASSIGNED`)
All newly assigned incidents appear in your **Department Queue** (`/incidents/department-queue`) with status **`ASSIGNED`**.

#### If Wrongly Assigned: Return to Quality
If an incident occurred due to another department's workflow (e.g., pharmacy dispensing error vs. nursing transcription):
1. Click **"Return to Quality"**.
2. Enter the specific operational reason and suggest the correct department.
3. Click **"Confirm Return"**.
4. The incident returns to Quality's triage inbox with a permanent audit record in `hodReturns`.

---

### Step 2: Investigation (`UNDER_INVESTIGATION`)
Click **"Start Investigation"** to transition the incident to **`UNDER_INVESTIGATION`**.
Fill out the structured investigation record:
- **Facts & Summary:** Objective summary of what transpired.
- **Chronology & Timeline:** Exact time stamps of events (e.g. *21:10 arrival → 21:18 code active → 21:38 CT complete*).
- **People Interviewed:** Staff and witnesses interviewed, designations, and statements.
- **Contributing Factors:** Select key factor tags (*People*, *Process*, *Equipment*, *Environment*, *Communication*, *Policy*).
- **Immediate Corrections:** Containment actions implemented on the spot.
- **Findings & Recommendations:** Systemic changes required to prevent recurrence.

---

### Step 3: Root Cause Analysis (RCA) — Required for Severity ≥ 4
If the incident is Severity 4 (*Major Harm*) or Severity 5 (*Sentinel Event*), the system mandates a completed RCA before closure submission:
- **5-Why Analysis:** Drill down sequentially by asking "Why?" at least 3 to 5 times until the underlying organizational, policy, or process failure is identified.
- **Ishikawa (Fishbone) Diagram:** Categorize multi-factorial causes across **People**, **Process**, **Equipment**, **Environment**, **Policy**, **Training**, and **Communication**.
- **Root Cause Summary:** High-level executive synthesis of the primary root cause.

---

### Step 4: Writing & Implementing CAPA (`CAPA_IN_PROGRESS`)
Click **"Proceed to CAPA"** to move the incident to **`CAPA_IN_PROGRESS`**.
Add one or more action items:
- **Action Type:**
  - **Corrective Action:** Fixes the immediate failure condition.
  - **Preventive Action:** Prevents recurrence across similar processes hospital-wide.
- **Priority:** `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
- **Target Completion Date:** Realistic deadline based on priority.
- **Implementation & Completion:**
  - Execute the changes (e.g., update department SOP, install safety guard, re-train staff).
  - Upload objective completion evidence (e.g., attendance sheet, revised protocol, work order).
  - Click **"Mark as Completed"**. The CAPA status updates to **`PENDING_VERIFICATION`**.

---

### Step 5: Submitting for Quality Review (`PENDING_QUALITY_REVIEW`)
Once the investigation is completed, RCA is filled (if required), and CAPAs are implemented:
1. Click **"Submit for Quality Review"**.
2. Enter a **Closure Submission Summary** outlining the outcome of the investigation and the effectiveness of the corrective actions.
3. Click **"Submit"**. The incident transitions to **`PENDING_QUALITY_REVIEW`**.

---

### Step 6: Handling Quality Returns (Rework Loop)
If the Quality team reviews the submission and finds that the CAPA lacks verification criteria, fails to address the root cause, or requires an independent audit:
1. You will receive an in-app alert: *"Quality returned incident for revised CAPA"*.
2. The incident returns to your queue in **`CAPA_IN_PROGRESS`**.
3. Open the incident and review the **Quality Return Remarks** banner.
4. Revise the action plans or provide the requested verification evidence.
5. Re-submit the incident for Quality review.
