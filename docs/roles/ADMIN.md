# ⚙️ System Administrator & Medical Directorate Role Guide

This guide details the administrative governance and executive oversight responsibilities of the **System Administrator / Medical Directorate** (`ADMIN`) within Adhiparasakthi Hospitals.

---

## 1. Overview & Dual Scope

The `ADMIN` role is designed for IT System Administrators and Senior Hospital Leadership (e.g. Medical Director, Chief Operating Officer):
1. **Executive Safety Oversight:** Comprehensive read-only visibility into all hospital incidents, investigations, root cause analyses, CAPA compliance registers, and safety metrics.
2. **Master Data Administration:** Full control over hospital master data including user accounts, role assignments, department-to-HOD linkages, locations, and incident categorization taxonomies.

---

## 2. Navigation & Available Tools

| Section | Route | Purpose |
|---|---|---|
| **Executive Dashboard** | `/dashboard` | Hospital-wide patient safety intelligence: open load, turnaround medians, triage age, rework rates, severity distribution, and monthly trends. |
| **Master Incident Register** | `/incidents` | Complete, hospital-wide searchable register across all clinical departments and workflow statuses. |
| **CAPA Governance** | `/capas` | Hospital-wide CAPA register with overdue alerts and verification statuses. |
| **Compliance Reports** | `/reports` | Inspection-ready registers with direct CSV, Excel, and Print/PDF export. |
| **Administration Console** | `/admin` | Master data management: Users, Roles, Departments, Locations, and Incident Categories. |

---

## 3. Master Data Management (`/admin`)

Access the administration console at `/admin`. This interface is divided into dedicated management tabs:

### 1. User & Staff Management
- **Add New User:**
  - Enter Employee ID (e.g., `EMP-025`), Full Name, Email, Username, Temporary Password, and Designation.
  - Link to primary department (optional for hospital-wide roles).
  - Assign system roles: `STAFF`, `QUALITY`, `HOD`, or `ADMIN`.
- **Account Maintenance:**
  - Activate or deactivate accounts for departed staff.
  - Unlock accounts that have been locked due to repeated failed login attempts.

---

### 2. Department & HOD Configuration
The incident routing engine relies directly on department configuration:
- **Department Setup:** Define department codes and clinical names (e.g., `EMERGENCY` — *Emergency Medicine*, `ICU` — *Intensive Care Unit*).
- **HOD Designation:** Every department must have a designated Head of Department assigned via `Department.hodUserId`.
- **Critical Operational Gate:** If a department lacks an assigned HOD, the Quality team cannot route incidents to it during triage. The administration console flags any department with a missing HOD.

---

### 3. Locations Configuration
Configure rooms, bays, suites, ICUs, and wards mapped to their parent departments:
- Location Code (e.g., `ER-BAY-1`, `OT-SUITE-2`, `WARD-302`).
- Location Name (e.g., *ER Bay 1 - Resuscitation*, *Main OT Suite 2*).
- Type tag: `ROOM`, `ICU`, `OT`, `WARD`, `LAB`, etc.
- Parent department linkage.

---

### 4. Incident Categories & Taxonomy
Maintain the hospital's 18 standardized healthcare safety categories:
- Standard categories include *Patient Fall*, *Medication Safety*, *Patient Identification*, *Infection Prevention*, *Device Malfunction*, *Communication / Handover*, and *Surgical / Procedure Safety*.
- Add or retire subcategories to align with emerging clinical risks and accreditation standards (NABH 5th Edition / JCI).

---

## 4. Security, Auditing & Access Control

- **Role-Based Access Control (RBAC):** Server-enforced permissions on every API endpoint. Role modifications take effect immediately without requiring user re-login.
- **Audit Logs:** Immutable audit log collection tracking every incident creation, triage decision, assignment, status change, and closure sign-off with user ID and timestamp.
- **Incident Privacy (Just Culture):** Staff reporters are shielded from internal investigation notes to foster psychological safety, while the Medical Director and Quality team retain full transparency for root cause evaluation.
