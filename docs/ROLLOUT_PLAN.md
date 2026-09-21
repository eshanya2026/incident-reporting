# Hospital Rollout, Migration & Hypercare Plan

**Adhiparasakthi Hospitals — Incident Management & Patient Safety System**  
**Version:** 2.0 (Clinical Incident Workflow Rework)  
**Target Go-Live:** September 2026  
**Document Owner:** Hospital Quality Team & IT Operations  

---

## Executive Summary

This document establishes the official cutover, data migration, staff onboarding, training schedule, and 14-day hypercare monitoring protocols for the Adhiparasakthi Hospitals Incident Management System.

The 4-role clinical workflow (`STAFF` → `QUALITY` → `HOD` → `QUALITY Sign-Off` → `CLOSED`, overseen by `ADMIN`) ensures that all clinical, medication, equipment, and occupational incidents are routed to the designated clinical specialists, systematically investigated with 5-Why and Fishbone RCAs, and verified under NABH/JCI standards before closure.

---

## 1. Pre-Deployment Infrastructure Checklist

Ensure all production infrastructure components meet the baseline requirements prior to scheduled maintenance window:

| Component | Minimum Specification | Production Requirement | Verification Command |
|---|---|---|---|
| **Node.js** | v20.x or v22.x LTS | Server Runtime with ESM support | `node --version` |
| **MongoDB** | 6.0+ Enterprise / Atlas | Replica Set with wiredTiger engine | `mongosh --eval "db.version()"` |
| **Redis** | 7.0+ | In-memory store for BullMQ background workers | `redis-cli ping` |
| **Nginx / Gateway** | 1.24+ | TLS 1.3, reverse proxy to backend (5000) & static client | `nginx -t` |
| **SMTP Service** | TLS Port 587 / 465 | High-deliverability transactional email service | `nc -zv smtp.hospital.org 587` |
| **Database Tools** | 100.9+ | `mongodump` & `mongorestore` binaries in PATH | `./scripts/backup_restore.sh check` |

### Production Environment Variables (`server/.env`)
```bash
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://dbuser:StrongPassword@mongodb.internal:27017/incident_db?authSource=admin&replicaSet=rs0
JWT_SECRET=super-secure-production-jwt-secret-min-64-characters-random-string
REDIS_URL=redis://:RedisPassword@redis.internal:6379
SMTP_HOST=smtp.hospital.org
SMTP_PORT=587
SMTP_USER=incident-alerts@hospital.org
SMTP_PASS=EncryptedSmtpPassword
CORS_ORIGIN=https://safety.adhiparasakthi.org
COOKIE_DOMAIN=.adhiparasakthi.org
```

---

## 2. Coordinated Cutover Sequence (Step-by-Step)

The maintenance window is scheduled for a **2-hour duration** during off-peak clinical hours (e.g., Saturday 22:00 – 24:00).

```mermaid
flowchart TD
    A[Start Maintenance Window] --> B[1. Full Database Snapshot Backup]
    B --> C[2. Audit Master Data & HOD Mapping]
    C --> D[3. Execute Operational Data Reset - D10]
    D --> E[4. Bulk Import HR Staff Roster]
    E --> F[5. Atomic Backend & Frontend Deploy]
    F --> G[6. Post-Deployment Smoke Test]
    G --> H{All Checks Pass?}
    H -- Yes --> I[Cutover Complete & Live Sign-Off]
    H -- No --> J[Execute Rollback Protocol]
```

### Step 1: Full Point-in-Time Database Backup
Execute the automated backup utility to generate a compressed archive:
- **Linux / Git Bash:**
  ```bash
  ./scripts/backup_restore.sh backup /var/backups/incident_db
  ```
- **Windows PowerShell:**
  ```powershell
  .\scripts\backup_restore.ps1 -Action backup -Path C:\backups\incident_db
  ```
*Verify that the generated `.gz` archive is non-empty and securely replicated.*

---

### Step 2: Audit Master Data
Verify the 8 clinical and supportive departments, locations, and designated HOD assignments:
```bash
# Verify master collections
npm --prefix server run test:master-data  # or inspect via Admin UI / mongosh
```
Ensure every department has an active Head of Department assigned:
- `EMERGENCY` → `hod.emergency`
- `ICU` → `hod.icu`
- `OT` → `hod.ot`
- `WARD` → `hod.ward`
- `PHARMACY` → `hod.pharmacy`
- `RADIOLOGY` → `hod.radiology`
- `LAB` → `hod.lab`
- `QUALITY` → `quality.anita`

---

### Step 3: Production Operational Data Purge (Decision D10)
Per Decision D10, purge all demonstration incidents, investigations, RCAs, CAPAs, notifications, audit logs, and annual counters:
```bash
cd server
npm run reset:operational -- --force
```
**Output Confirmation:**
- Incidents: `0`
- Investigations: `0`
- RCAs: `0`
- CAPAs: `0`
- Sequence Counters: `0` (Reset so live production incidents begin at `INC-2026-0001`)
- **Users, Roles, Departments, Locations, and Categories: 100% PRESERVED**

---

### Step 4: Bulk Import Staff Accounts
Onboard hospital clinical and administrative personnel from the verified HR spreadsheet:
- **Option A — Command Line Interface:**
  ```bash
  cd server
  npm run import:staff -- /path/to/hospital_hr_staff.csv --update
  ```
- **Option B — Web Admin Interface:**
  1. Sign in as `admin`.
  2. Navigate to **Master Configurations → User Directory**.
  3. Click **Bulk Import (CSV)**.
  4. Select or paste the HR roster file.
  5. Review parsed rows and column validations.
  6. Click **Import Accounts** and confirm execution.

---

### Step 5: Atomic Backend & Frontend Deployment
> [!IMPORTANT]
> The backend and frontend **MUST be deployed together**. The 8-status lifecycle (`SUBMITTED`, `INFO_REQUESTED`, `REJECTED`, `ASSIGNED`, `UNDER_INVESTIGATION`, `CAPA_IN_PROGRESS`, `PENDING_QUALITY_REVIEW`, `CLOSED`) requires coordinated client-server schema synchronization.

1. **Build Production Assets:**
   ```bash
   cd client && npm run build
   cd ../server && npm run build
   ```
2. **Deploy Server:**
   ```bash
   pm2 restart incident-api || systemctl restart incident-api
   ```
3. **Deploy Web Assets:**
   Sync `client/dist/` to the Nginx web root `/var/www/incident-reporting/client/dist/`.
4. **Reload Reverse Proxy:**
   ```bash
   nginx -s reload
   ```

---

### Step 6: Post-Deployment Smoke Testing
Run verification checks across each user persona:
1. **Staff Login (`dr.ananya`):** Report a test near-fall incident with photo attachment → verify status is `SUBMITTED`.
2. **Quality Login (`quality.anita`):** Check Triage Inbox → request info from reporter → verify status changes to `INFO_REQUESTED`.
3. **Staff Login (`dr.ananya`):** View "My Reports" → answer Quality question → verify status returns to `SUBMITTED`.
4. **Quality Login (`quality.anita`):** Assign incident to `EMERGENCY` HOD → verify status is `ASSIGNED`.
5. **HOD Login (`hod.emergency`):** Open Department Incidents → start investigation → save findings → record 5-Why RCA → add CAPA → mark implemented → submit closure.
6. **Quality Login (`quality.anita`):** Open Review Queue → audit CAPA evidence → approve closure → verify status is `CLOSED`.
7. **Admin Oversight (`admin`):** Open Executive Dashboard & Quality Registers → verify turnaround times and audit logs reflect the completed test.

---

## 3. Role-by-Role Training Plan & Schedule

To achieve seamless hospital-wide adoption and uphold the "Just Culture" reporting environment, training is conducted in three prioritized phases:

```mermaid
gantt
    title Training & Rollout Timetable
    dateFormat  YYYY-MM-DD
    section Phase 1: Quality Team
    Triage & Review Queue Mastery    :2026-09-21, 2d
    section Phase 2: Heads of Department
    Investigation, RCA & CAPA Labs   :2026-09-23, 3d
    section Phase 3: Hospital Staff
    Frontline Reporting & Just Culture :2026-09-26, 4d
    section Hypercare
    14-Day Active Monitoring        :2026-09-30, 14d
```

### Module 1: Quality & Patient Safety Team (Priority 1 — Day 1 to 2)
*Audience: Patient Safety Officers, Quality Managers, NABH Coordinators*
- **Role Reference Guide:** [docs/roles/QUALITY.md](file:///c:/SOLAIRAM/incident-reporting/docs/roles/QUALITY.md)
- **Core Competencies:**
  1. **Triage Inbox Management:** Assessing incident submissions within 4 hours; validating severity ratings (1 to 5); routing to correct clinical HOD.
  2. **Clarification Loops:** Formatting specific questions back to frontline reporters (`INFO_REQUESTED`).
  3. **Structured Rejection:** Documenting clinical justifications when rejecting duplicate or non-incident submissions.
  4. **Review Queue Sign-Off:** Auditing HOD investigation findings, verifying RCA completeness, and reviewing CAPA evidence.
  5. **Rework Send-Back Loop:** Rejecting inadequate CAPAs with structured feedback (`qualityReviews` return reason).
  6. **Compliance Reporting:** Exporting NABH/JCI Incident Registers and monitoring institutional turnaround metrics.

---

### Module 2: Heads of Department (Priority 2 — Day 3 to 5)
*Audience: Clinical HODs, Nursing Superintendents, Pharmacy Head, Lab Director*
- **Role Reference Guide:** [docs/roles/HOD.md](file:///c:/SOLAIRAM/incident-reporting/docs/roles/HOD.md)
- **Core Competencies:**
  1. **Department Inbox Management:** Tracking newly assigned incidents within the designated department.
  2. **Wrong Department Return Loop:** Returning misrouted incidents to Quality with clear clinical rationale.
  3. **Root Cause Analysis (RCA):**
     - Mandatory 5-Why analysis for severity ≥ 4 incidents.
     - Ishikawa / Fishbone analysis across 6 categories (Man, Machine, Method, Material, Measurement, Milieu).
  4. **CAPA Execution:** Formulating immediate corrections and long-term preventive actions, setting target dates, and marking completion with verification remarks.
  5. **Closure Submission:** Summarizing preventive actions taken and submitting to Quality for final institutional sign-off.
  6. **Handling Quality Rework:** Addressing Quality return remarks promptly.

---

### Module 3: Hospital Clinical & General Staff (Priority 3 — Day 6 to 9)
*Audience: Staff Nurses, Residents, Consultants, Pharmacists, Technicians, Ward Clerks*
- **Role Reference Guide:** [docs/roles/STAFF.md](file:///c:/SOLAIRAM/incident-reporting/docs/roles/STAFF.md)
- **Core Competencies:**
  1. **Just Culture & Psychological Safety:** Emphasizing non-punitive incident reporting focused on systems improvements rather than individual blame.
  2. **Frontline Incident Reporting:**
     - Selecting where the incident occurred (`occurredInDepartment` & `locationId`).
     - Recording patient identifiers (UHID, Name, Age, Gender) securely.
     - Attaching photos, prescription scans, or diagnostic evidence.
  3. **Data Protection Boundary (Decision D6):** Understanding that frontline staff only see their own submitted reports, protecting patient and staff confidentiality.
  4. **Responding to Quality Questions:** Answering clarifications requested by the Quality team directly within the report timeline.

---

## 4. 14-Day Post-Launch Hypercare Monitoring

During the initial two weeks following cutover, the joint Quality & IT Operations Taskforce conducts daily morning standups (09:00 AM) to evaluate system health and workflow velocity:

### Operational Key Performance Indicators (KPIs)

| KPI Metric | Target Benchmark | Warning Threshold | Critical Escalation | Action if Breached |
|---|---|---|---|---|
| **Triage Queue Age** | < 4 hours | > 12 hours | > 24 hours | Quality Lead auto-notified; re-allocate triage officers |
| **HOD Investigation Turnaround** | < 7 days | > 10 days | > 14 days | Automated reminder to HOD; Medical Director notified |
| **Quality Closure Review SLA** | < 48 hours | > 72 hours | > 5 days | Escalate to Head of Quality |
| **Quality Send-Back Rate** | < 15% | > 25% | > 40% | Schedule 1-on-1 RCA coaching session with offending department HOD |
| **Server Error Rate (5xx)** | < 0.01% | > 0.1% | > 1% | IT on-call intervention; inspect server logs |
| **Pending Info Requests** | Resolved < 48h | Unanswered > 3d | Unanswered > 7d | Unit supervisor contacts reporting nurse/doctor |

### Daily Standup Checklist
- [ ] Review total incidents submitted in preceding 24 hours.
- [ ] Inspect Triage Queue: count of incidents in `SUBMITTED` > 12 hours old.
- [ ] Inspect Review Queue: count of incidents in `PENDING_QUALITY_REVIEW` > 48 hours old.
- [ ] Check unassigned departments (alerts if a department has no designated HOD).
- [ ] Review system exception logs (`server/logs/` and PM2 error logs).
- [ ] Review Redis queue health and failed background notifications.

---

## 5. Rollback Contingency Protocol

In the unlikely event of an irrecoverable issue (e.g., severe database corruption, network partition, or critical workflow blocker) during the cutover window:

1. **Abort Cutover Decision:** Made jointly by Chief Medical Officer and Head of IT.
2. **Restore Database Snapshot:**
   ```bash
   ./scripts/backup_restore.sh restore /var/backups/incident_db/incident_db_backup_<timestamp>.gz --force
   ```
3. **Revert Frontend & Backend Code:**
   ```bash
   git checkout <pre-cutover-commit-tag>
   npm --prefix server run build && pm2 restart incident-api
   npm --prefix client run build && nginx -s reload
   ```
4. **Communicate Status:** Notify clinical nursing stations and HODs of rollback and schedule post-mortem.

---

## 6. Document Sign-Off

| Role | Name | Signature | Date |
|---|---|---|---|
| **Head of Quality & Patient Safety** | Dr. Anita Ramesh | ____________________ | 2026-09-19 |
| **Chief Medical Officer** | Dr. K. Soundararajan | ____________________ | 2026-09-19 |
| **Head of Information Technology** | Mr. S. Vaitheeswaran | ____________________ | 2026-09-19 |
