# 🩺 Staff Role Guide — Incident Reporting Platform

This guide outlines the day-to-day workflow for hospital staff (nurses, technicians, pharmacists, residents, and administrative personnel) in the incident reporting and patient safety system.

---

## 1. Role Purpose & "Just Culture"

Adhiparasakthi Hospitals operates under a **blame-free "Just Culture"** philosophy. The goal of reporting is not punitive action against individuals, but identifying system weaknesses, faulty workflows, equipment defects, and training needs to protect patients and staff.

As a staff member, your login allows you to:
1. **Report safety events rapidly** (within 2–3 minutes) from any workstation or mobile device.
2. **Track the progress of your submitted reports** in **My Reports**.
3. **Clarify questions** if the Quality & Patient Safety team requests additional information.
4. **See the final resolution** and learning points once the incident is investigated and closed.

---

## 2. Reporting an Incident

Click **"Report Incident"** in the top navigation bar or go to `/incidents/new`.

### Required Information
- **Department Where Occurred:** Select the clinical or administrative area where the event took place (e.g. *Emergency Medicine*, *Intensive Care Unit*, *Operation Theatre*).
- **Location:** Specific room, bed, or station within that department (e.g. *ER Bay 1 - Resuscitation*, *ICU Bed 01*).
- **Incident Date & Time:** The actual time the incident or near-miss occurred.
- **Incident Category & Subcategory:** Choose from standard categories (e.g., *Patient Fall*, *Medication Safety*, *Infection Prevention*, *Device Malfunction*).
- **Title:** A short, descriptive summary (e.g., *"Insulin dose transcribed incorrectly on ICU chart"*).
- **Description:** What happened, chronologically and factually.
- **Immediate Action Taken:** First aid, physician notification, dosage withheld, equipment disconnected, etc.
- **Initial Severity (Your Estimate):**
  - **Level 1 (Near Miss):** Caught before reaching patient / zero harm.
  - **Level 2 (Minor Harm):** First-aid or extra monitoring required.
  - **Level 3 (Moderate Harm):** Required medical intervention or extended hospital stay.
  - **Level 4 (Major Harm):** Significant or long-term impairment.
  - **Level 5 (Sentinel Event):** Critical event, wrong-site procedure, severe injury, or death.

### Optional Patient Details
If a patient was involved, toggle **"Patient Involved"** and record:
- Patient Name, UHID, and IP Number
- Age, Gender, Ward, and Bed
- Attending Consultant

### Evidence Attachments
Attach photos, prescription copies, monitor strips, or logs (PDF, PNG, JPG; up to 10 MB per file).

---

## 3. Tracking Your Reports ("My Reports")

Go to `/incidents/my-reports`. Here you will see all incidents reported by your account.

### What Staff Can See (Decision D6: Blame-Free Visibility)
To protect patient safety investigations and encourage candid reporting:
- **Visible to Reporter:**
  - Incident number, submission date, and your entered details.
  - Current workflow status (e.g., *Waiting Quality Triage*, *Assigned to ICU*, *Under Investigation*, *Closed*).
  - Assigned responsible department and assigned HOD.
  - Any information requests addressed to you.
  - When closed: the official **Closure Summary** and learning points from Quality.
- **Hidden from Reporter:**
  - Internal staff witness statements and interviews.
  - Detailed root-cause fault analyses.
  - Departmental CAPA ownership and internal task completion notes.

---

## 4. Responding to Information Requests

If the Quality team needs additional facts before routing the incident:
1. You will receive an in-app notification: *"More information requested by Quality"*.
2. The incident status will show as **`INFO_REQUESTED`** in your **My Reports** queue.
3. Open the incident detail view, read the question in the **Information Request** banner.
4. Type your response in the provided text field and click **"Submit Response"**.
5. The incident automatically returns to Quality's triage inbox for department assignment.

---

## 5. Summary of Workflow Milestones

```
[Staff Reports] ──► (SUBMITTED) ──► [Quality Triage & Assignment] ──► (ASSIGNED)
       ▲                                                                   │
       │ (Clarification)                                                   ▼
       └────────────── (INFO_REQUESTED)                              [HOD Resolves]
                                                                           │
[Staff Sees Closure Summary] ◄─── (CLOSED) ◄─── [Quality Review] ◄─────────┘
```
