# Adhiparasakthi Hospitals – Incident Reporting Application
## Detailed MERN Stack Development Plan, Architecture & Workflow

**Project Type:** Hospital Incident Reporting, Investigation, RCA, CAPA and Safety Analytics Platform  
**Target Environment:** 1000-bed hospital  
**Recommended Stack:** MongoDB + Express.js + React.js + Node.js  
**Primary Deployment Model:** On-Premise first, cloud-ready  
**Primary Objective:** Report → Triage → Investigate → RCA → CAPA → Verify → Close → Learn

---

# 1. Executive Summary

This application will be a hospital-wide incident reporting and patient safety platform for Adhiparasakthi Hospitals. It should allow clinical and non-clinical staff to report incidents, near misses, safety hazards and operational events through a simple web/mobile responsive interface.

The system should then route the incident through a controlled workflow involving department HODs, investigators, quality/safety teams and management. Major incidents should support structured root cause analysis, CAPA creation, due-date tracking, escalation, evidence upload, effectiveness verification and formal closure.

The initial version should be designed as a standalone hospital application. HIS integration can be added in a later phase to automatically fetch patient/admission information using UHID or IP number. LIS, RIS/PACS and other hospital systems should be treated as optional future integrations.

---

# 2. Core Business Goals

The platform should achieve the following:

- Make incident reporting easy and fast.
- Allow reporting within 2–3 minutes.
- Reduce under-reporting.
- Provide structured investigation workflows.
- Support RCA using 5-Why and Fishbone methods.
- Track corrective and preventive actions.
- Escalate overdue and high-severity incidents.
- Maintain a full audit trail.
- Provide role-based visibility and confidentiality.
- Provide department-wise and hospital-wide analytics.
- Support NABH / ISO / JCI-style quality workflows.
- Allow later integration with HIS and other clinical systems.

---

# 3. Recommended MERN Technology Stack

## Frontend

- React 19+
- Vite or Next.js if SSR is required later
- React Router
- TanStack Query / React Query
- Zustand or Redux Toolkit for global state
- React Hook Form
- Zod or Yup for validation
- Tailwind CSS
- shadcn/ui or Material UI
- Recharts or Chart.js for dashboards
- Axios or Fetch API
- Day.js for date handling

## Backend

- Node.js 22 LTS
- Express.js
- TypeScript strongly recommended
- Mongoose ODM
- Zod / Joi backend validation
- JWT authentication
- Refresh token mechanism
- bcrypt / argon2 password hashing
- Multer for file uploads
- Nodemailer for email
- BullMQ + Redis for background queues and reminders
- Winston or Pino for application logging
- Helmet for security headers
- Express Rate Limit
- CORS configuration

## Database

- MongoDB 7+
- Replica set recommended for production
- MongoDB transactions where consistency is important
- Daily backup + point-in-time backup strategy

## Supporting Services

- Redis for:
  - queues
  - scheduled escalation jobs
  - optional caching
  - notification delivery state

- File storage:
  - Phase 1: secure local file storage or NAS
  - Production: MinIO / NAS / S3-compatible storage

## Reverse Proxy

- Nginx
- HTTPS using hospital SSL certificate

## Deployment

Recommended:

- Docker
- Docker Compose initially
- Separate containers for:
  - frontend
  - backend
  - MongoDB
  - Redis
  - MinIO if used
  - Nginx

---

# 4. High-Level System Architecture

```text
                           HOSPITAL USERS
                                |
                +---------------+----------------+
                |                                |
           Desktop Browser                 Mobile Browser
                |                                |
                +---------------+----------------+
                                |
                              HTTPS
                                |
                         +-------------+
                         |    NGINX    |
                         | Reverse Proxy|
                         +------+------+ 
                                |
             +------------------+------------------+
             |                                     |
     +-------v--------+                    +-------v--------+
     | React Frontend |                    | Express API    |
     | Vite / React   |<------------------>| Node.js        |
     +----------------+       REST API     +-------+--------+
                                                    |
                 +----------------------------------+----------------------------------+
                 |                                  |                                  |
         +-------v--------+                +--------v-------+                 +--------v-------+
         | MongoDB        |                | Redis          |                 | File Storage   |
         | Main Database  |                | Queue/Cache    |                 | NAS / MinIO    |
         +----------------+                +----------------+                 +----------------+
                                                    |
                                           +--------v---------+
                                           | Notification     |
                                           | Email / SMS / UI |
                                           +------------------+

Optional Future Integration Layer

     HIS ---------+
     LIS ---------+----> Integration Service ----> Incident Application
     RIS / PACS --+
     AD / LDAP ---+
```

---

# 5. Application Layers

## 5.1 Presentation Layer

React frontend must provide:

- Login
- Dashboard
- Quick incident reporting
- My incidents
- Department incidents
- Incident detail page
- Investigation module
- RCA module
- CAPA module
- Approvals
- Reports
- Administration
- Notification center
- Mobile responsive layout

## 5.2 API Layer

Express API should be responsible for:

- Authentication
- Authorization
- Business rules
- Incident workflow
- Severity handling
- Department routing
- Investigation workflow
- RCA workflow
- CAPA lifecycle
- Approval workflow
- Notifications
- Reporting
- Audit logs
- Integration adapters

## 5.3 Data Layer

MongoDB stores:

- users
- roles
- permissions
- departments
- locations
- incidents
- investigations
- RCA data
- CAPA actions
- attachments metadata
- notifications
- comments
- audit logs
- system settings
- escalation rules

---

# 6. User Roles

Recommended initial roles:

| Role | Purpose |
|---|---|
| SUPER_ADMIN | Full technical administration |
| QUALITY_ADMIN | Full quality and patient safety access |
| MANAGEMENT | Read access to hospital-wide dashboards and critical cases |
| HOD | Department incident review and action |
| INVESTIGATOR | Assigned incident investigation |
| CAPA_OWNER | Assigned CAPA implementation |
| STAFF | Report incidents and view own submissions |
| AUDITOR | Read-only quality/compliance access |

---

# 7. Role-Based Access Control

Use permission-based RBAC instead of hard-coding role names throughout the backend.

Example permissions:

```text
incident.create
incident.read_own
incident.read_department
incident.read_all
incident.update
incident.assign
incident.change_severity
incident.close
investigation.create
investigation.update
rca.create
rca.approve
capa.create
capa.update
capa.verify
report.view_department
report.view_all
admin.user_manage
admin.department_manage
admin.settings_manage
```

Example:

```text
STAFF
- incident.create
- incident.read_own

HOD
- incident.read_department
- incident.assign
- investigation.read
- investigation.comment

QUALITY_ADMIN
- incident.read_all
- incident.change_severity
- investigation.create
- investigation.update
- rca.create
- rca.approve
- capa.create
- capa.verify
- incident.close
```

---

# 8. Incident Lifecycle

Recommended status model:

```text
DRAFT
  |
  v
SUBMITTED
  |
  v
TRIAGED
  |
  v
HOD_REVIEW
  |
  v
UNDER_INVESTIGATION
  |
  v
RCA_REQUIRED
  |
  v
CAPA_IN_PROGRESS
  |
  v
EFFECTIVENESS_REVIEW
  |
  v
READY_FOR_CLOSURE
  |
  v
CLOSED
```

Optional states:

```text
RETURNED_FOR_INFORMATION
CANCELLED
REOPENED
ESCALATED
```

Do not allow free-text status values. Use enums.

---

# 9. End-to-End Workflow

## Step 1 – Incident Occurs

Examples:

- patient fall
- medication error
- delayed treatment
- equipment failure
- staff injury
- security event
- sample error
- IT downtime
- facility issue
- near miss

## Step 2 – Staff Reports Incident

Required fields should be minimal.

Recommended quick form:

- Date/time of incident
- Department
- Location
- Incident category
- Subcategory
- Patient involved? yes/no
- UHID / IP number if applicable
- Brief description
- Immediate action taken
- Reporter identity
- Attachment optional

System automatically generates:

```text
INC-YYYY-000001
```

Example:

```text
INC-2026-00432
```

## Step 3 – Initial Triage

Performed by HOD or Quality team depending on configuration.

Triage includes:

- confirm category
- confirm department
- confirm severity
- determine immediate escalation
- assign investigator

## Step 4 – Severity Classification

Recommended model:

| Level | Classification | Description |
|---|---|---|
| 1 | Near Miss | Did not reach patient / no harm |
| 2 | Minor | Reached patient with no/minimal harm |
| 3 | Moderate | Temporary harm / intervention required |
| 4 | Major | Serious harm / prolonged stay |
| 5 | Critical / Sentinel | Death, permanent harm or sentinel event |

## Step 5 – Automatic Escalation

Example rules:

```text
Severity 1 -> Department HOD
Severity 2 -> Department HOD
Severity 3 -> HOD + Quality
Severity 4 -> HOD + Quality + Medical/Nursing Administration
Severity 5 -> Immediate Quality + Hospital Management escalation
```

Escalation should be configurable.

## Step 6 – HOD Review

HOD can:

- acknowledge
- request more information
- add comments
- nominate investigator
- escalate to quality

## Step 7 – Investigation

Investigation fields:

- investigation owner
- investigation start date
- investigation due date
- facts
- chronology
- people interviewed
- contributing factors
- equipment involved
- policy/SOP references
- immediate correction
- supporting evidence

## Step 8 – Root Cause Analysis

RCA methods:

- 5 Why
- Fishbone
- contributing factor analysis

Suggested Fishbone categories:

```text
People
Process
Equipment
Environment
Communication
Policy
Training
Technology
Management
```

## Step 9 – CAPA Creation

Each RCA can create one or more CAPA actions.

Each CAPA contains:

- CAPA ID
- action description
- corrective/preventive type
- owner
- owner department
- target date
- priority
- status
- evidence required
- completion date
- verifier
- verification remarks

CAPA status:

```text
NOT_STARTED
OPEN
IN_PROGRESS
PENDING_VERIFICATION
VERIFIED
OVERDUE
CANCELLED
```

## Step 10 – Effectiveness Review

Quality team verifies:

- action completed
- supporting evidence uploaded
- effectiveness achieved
- recurrence risk reduced

If ineffective:

```text
Return CAPA -> reopen action -> new target date
```

## Step 11 – Closure

Closure conditions:

- investigation complete
- RCA completed where required
- mandatory CAPA completed
- verification complete
- quality approval complete

System records:

- closed by
- closure date/time
- closure remarks

## Step 12 – Learning & Analytics

Closed incidents should contribute to:

- department trends
- monthly trends
- incident category trends
- severity trends
- recurring causes
- CAPA compliance
- closure performance

---

# 10. Incident Categories

Recommended categories:

```text
Patient Safety
Medication
Clinical
Laboratory
Radiology
Blood Bank
Infection Control
Medical Equipment
Facility
IT / HIS
Security
Occupational Safety
Near Miss
Complaint Related Incident
Other
```

Subcategories should be configurable from admin settings.

Example:

```text
Patient Safety
  - Fall
  - Identification Error
  - Pressure Injury
  - Wrong Patient
  - Delay in Care
```

---

# 11. MongoDB Data Model

## 11.1 users

```js
{
  _id,
  employeeId,
  name,
  email,
  phone,
  username,
  passwordHash,
  departmentId,
  designation,
  roles: [roleId],
  status: "ACTIVE",
  lastLoginAt,
  createdAt,
  updatedAt
}
```

## 11.2 roles

```js
{
  _id,
  name,
  permissions: ["incident.create", "incident.read_own"],
  isSystemRole,
  createdAt,
  updatedAt
}
```

## 11.3 departments

```js
{
  _id,
  code,
  name,
  hodUserId,
  active,
  createdAt,
  updatedAt
}
```

## 11.4 locations

```js
{
  _id,
  name,
  code,
  type: "WARD | ROOM | OT | ICU | LAB | OPD | OTHER",
  departmentId,
  parentLocationId,
  active
}
```

## 11.5 incidentCategories

```js
{
  _id,
  name,
  code,
  active,
  subcategories: [
    {
      code,
      name,
      active
    }
  ]
}
```

## 11.6 incidents

```js
{
  _id,
  incidentNumber,

  reportedBy,
  reportedAt,

  incidentDateTime,

  departmentId,
  locationId,

  categoryId,
  subcategoryCode,

  patientInvolved,

  patient: {
    uhid,
    ipNumber,
    name,
    age,
    gender,
    ward,
    bed,
    consultant,
    admissionDate,
    source: "MANUAL | HIS"
  },

  title,
  description,
  immediateAction,

  severity: 1,
  severityLabel,

  status,

  assignedHod,
  investigatorId,

  requiresRca,
  requiresCapa,

  escalationLevel,
  escalatedAt,

  attachments: [attachmentId],

  createdAt,
  updatedAt,
  closedAt,
  closedBy
}
```

## 11.7 investigations

```js
{
  _id,
  incidentId,
  investigatorId,
  startedAt,
  dueDate,
  completedAt,

  facts,
  chronology,

  peopleInterviewed: [],

  contributingFactors: [
    "HUMAN_FACTOR",
    "PROCESS",
    "EQUIPMENT",
    "ENVIRONMENT",
    "COMMUNICATION"
  ],

  immediateCorrections,
  evidence: [attachmentId],

  findings,
  recommendation,

  status,
  createdAt,
  updatedAt
}
```

## 11.8 rootCauseAnalyses

```js
{
  _id,
  incidentId,
  investigationId,

  method: "FIVE_WHY | FISHBONE | OTHER",

  fiveWhy: [
    {
      sequence: 1,
      question: "Why did this happen?",
      answer: ""
    }
  ],

  fishbone: {
    people: [],
    process: [],
    equipment: [],
    environment: [],
    communication: [],
    policy: [],
    training: [],
    technology: []
  },

  rootCauseSummary,
  approvedBy,
  approvedAt,
  createdAt,
  updatedAt
}
```

## 11.9 capas

```js
{
  _id,
  capaNumber,
  incidentId,
  rcaId,

  type: "CORRECTIVE | PREVENTIVE",
  action,

  ownerUserId,
  ownerDepartmentId,

  priority: "LOW | MEDIUM | HIGH | CRITICAL",

  assignedDate,
  targetDate,

  status,

  completionRemarks,
  completedAt,

  evidence: [attachmentId],

  verification: {
    verifiedBy,
    verifiedAt,
    effective,
    remarks
  },

  createdAt,
  updatedAt
}
```

## 11.10 attachments

```js
{
  _id,
  entityType: "INCIDENT | INVESTIGATION | RCA | CAPA",
  entityId,
  originalName,
  storedName,
  mimeType,
  size,
  storagePath,
  uploadedBy,
  uploadedAt,
  checksum
}
```

## 11.11 notifications

```js
{
  _id,
  userId,
  type,
  title,
  message,
  entityType,
  entityId,
  read,
  readAt,
  deliveryChannels: ["IN_APP", "EMAIL"],
  createdAt
}
```

## 11.12 auditLogs

```js
{
  _id,
  userId,
  action,
  entityType,
  entityId,
  previousValue,
  newValue,
  ipAddress,
  userAgent,
  timestamp
}
```

---

# 12. Important Database Indexes

Create indexes for performance.

```js
incidents: {
  incidentNumber: unique,
  reportedAt,
  departmentId,
  status,
  severity,
  categoryId,
  investigatorId,
  "patient.uhid",
  "patient.ipNumber"
}

capas: {
  capaNumber: unique,
  ownerUserId,
  ownerDepartmentId,
  status,
  targetDate
}

auditLogs: {
  entityType,
  entityId,
  timestamp
}
```

Consider compound indexes:

```text
departmentId + status
status + severity
ownerUserId + status
targetDate + status
```

---

# 13. REST API Structure

Base URL:

```text
/api/v1
```

## Authentication

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
POST   /auth/change-password
```

## Users

```text
GET    /users
POST   /users
GET    /users/:id
PATCH  /users/:id
PATCH  /users/:id/status
```

## Departments

```text
GET    /departments
POST   /departments
PATCH  /departments/:id
```

## Locations

```text
GET    /locations
POST   /locations
PATCH  /locations/:id
```

## Categories

```text
GET    /incident-categories
POST   /incident-categories
PATCH  /incident-categories/:id
```

## Incidents

```text
POST   /incidents
GET    /incidents
GET    /incidents/:id
PATCH  /incidents/:id
POST   /incidents/:id/submit
POST   /incidents/:id/triage
POST   /incidents/:id/assign-investigator
POST   /incidents/:id/escalate
POST   /incidents/:id/request-info
POST   /incidents/:id/close
POST   /incidents/:id/reopen
```

## Investigation

```text
POST   /incidents/:id/investigation
GET    /incidents/:id/investigation
PATCH  /investigations/:id
POST   /investigations/:id/complete
```

## RCA

```text
POST   /incidents/:id/rca
GET    /incidents/:id/rca
PATCH  /rca/:id
POST   /rca/:id/approve
```

## CAPA

```text
POST   /incidents/:id/capas
GET    /incidents/:id/capas
GET    /capas
PATCH  /capas/:id
POST   /capas/:id/complete
POST   /capas/:id/verify
POST   /capas/:id/reopen
```

## Attachments

```text
POST   /attachments
GET    /attachments/:id
DELETE /attachments/:id
```

## Dashboard

```text
GET /dashboard/summary
GET /dashboard/severity
GET /dashboard/categories
GET /dashboard/department-trend
GET /dashboard/monthly-trend
GET /dashboard/capa-status
GET /dashboard/overdue
```

## Reports

```text
GET /reports/incidents
GET /reports/department
GET /reports/severity
GET /reports/capa
GET /reports/closure-time
GET /reports/root-causes
```

---

# 14. API Response Standard

Use a consistent API structure.

Success:

```json
{
  "success": true,
  "data": {},
  "message": "Incident created successfully"
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid incident data",
    "details": []
  }
}
```

---

# 15. Frontend Screen Plan

## Public

```text
/login
/forgot-password
```

## Authenticated

```text
/dashboard
/incidents/new
/incidents
/incidents/:id
/incidents/:id/investigation
/incidents/:id/rca
/incidents/:id/capa
/capas
/approvals
/reports
/notifications
/profile
```

## Admin

```text
/admin/users
/admin/roles
/admin/departments
/admin/locations
/admin/categories
/admin/escalation-rules
/admin/settings
/admin/audit-logs
```

---

# 16. Main Incident Detail UI

Recommended tabs:

```text
Summary
Timeline
Investigation
RCA
CAPA
Attachments
Comments
Audit Trail
```

Header should show:

```text
INC-2026-00432
Severity: Moderate
Status: Under Investigation
Department: Emergency
Reported: 08-Sep-2026 10:30
```

---

# 17. Dashboard Design

## Management Dashboard

Cards:

```text
Total Incidents
Open Incidents
Critical Incidents
Near Miss
Under Investigation
Overdue CAPA
Average Closure Time
Closed This Month
```

Charts:

- incidents by department
- monthly incident trend
- severity distribution
- incident category distribution
- top recurring causes
- CAPA status
- top departments
- closure time trend

Filters:

```text
Date Range
Department
Category
Severity
Status
Location
```

## HOD Dashboard

Focus:

- department incidents
- incidents awaiting acknowledgement
- investigations pending
- CAPA pending
- overdue tasks

## Staff Dashboard

Focus:

- quick report
- own submitted incidents
- requested information
- notifications

---

# 18. Notification Architecture

Use event-driven notification logic.

Example events:

```text
INCIDENT_SUBMITTED
INCIDENT_HIGH_SEVERITY
INCIDENT_ASSIGNED
INVESTIGATION_DUE
INVESTIGATION_OVERDUE
CAPA_ASSIGNED
CAPA_DUE_SOON
CAPA_OVERDUE
CAPA_COMPLETED
CAPA_VERIFICATION_REQUIRED
INCIDENT_READY_FOR_CLOSURE
INCIDENT_CLOSED
```

Architecture:

```text
API Action
   |
   v
Domain Event
   |
   v
Queue (BullMQ / Redis)
   |
   +--> In-App Notification
   +--> Email
   +--> SMS later
```

Do not block the primary API request while sending email.

---

# 19. Escalation Rules

Create a configurable escalationRules collection.

Example:

```js
{
  name: "Critical Incident Escalation",
  event: "INCIDENT_SUBMITTED",
  conditions: {
    minSeverity: 5
  },
  notifyRoles: ["QUALITY_ADMIN", "MANAGEMENT"],
  notifyHod: true,
  email: true,
  inApp: true,
  active: true
}
```

Overdue CAPA example:

```text
Target Date - 2 days -> reminder
Target Date           -> due alert
Target Date + 1 day   -> overdue alert
Target Date + 3 days  -> HOD escalation
Target Date + 7 days  -> Quality escalation
```

---

# 20. Audit Trail Requirements

Every critical action must be captured.

Examples:

```text
Incident created
Incident edited
Severity changed
Status changed
Investigator assigned
Attachment uploaded
RCA approved
CAPA created
CAPA owner changed
CAPA target date changed
CAPA verified
Incident closed
Incident reopened
```

Example timeline:

```text
10:31 Incident submitted by Nurse A
10:33 HOD notified
10:48 HOD acknowledged
11:05 Investigator assigned
14:10 Severity changed Moderate -> Major
15:20 Investigation started
09-Sep RCA completed
10-Sep CAPA created
15-Sep CAPA evidence uploaded
16-Sep Quality verified
16-Sep Incident closed
```

Never delete audit logs through normal application functions.

---

# 21. Security Architecture

Hospital data is sensitive. Apply security from the first version.

## Authentication

Recommended:

```text
Access JWT: 10–15 minutes
Refresh Token: 8–12 hours
```

Refresh tokens should be stored securely.

Prefer HTTP-only secure cookies where practical.

## Password

- minimum 10 characters
- hashed with Argon2 or bcrypt
- never log passwords
- lock account after configurable failed attempts

## Authorization

Every protected API must call authorization middleware.

Example:

```ts
requirePermission("incident.read_all")
```

## Data Protection

- HTTPS only
- encryption at rest where available
- MongoDB access restricted to application subnet
- Redis not exposed publicly
- storage server private
- validate uploaded files
- restrict MIME type
- antivirus scan if infrastructure permits

## File Restrictions

Allowed:

```text
PDF
JPG
JPEG
PNG
DOCX
XLSX if required
```

Block executable content.

## Security Headers

Use Helmet.

## Rate Limiting

Apply stricter limits to:

```text
/login
/forgot-password
/upload
```

---

# 22. Confidentiality Rules

Important for incident reporting.

Reporter visibility options can be configured:

```text
NORMAL
CONFIDENTIAL
ANONYMOUS internally if management approves
```

Recommended initial implementation:

- identity always stored internally
- identity hidden from non-authorized roles where necessary
- Quality Admin can see reporter identity

Do not allow ordinary users to browse other departments' incidents.

---

# 23. HIS Integration – Recommended Phase 2

HIS integration is useful but not mandatory for initial launch.

Goal:

When staff enters:

```text
UHID: 6150151
or
IP: IP07024796
```

system fetches:

```text
Patient Name
Age
Gender
UHID
IP Number
Admission Date
Ward
Bed
Department
Consultant
Current Admission Status
```

Architecture:

```text
React Incident Form
       |
       v
Incident API
       |
       v
Integration Service
       |
       v
HIS Read-Only API / Database View
```

Important:

The incident application must never write directly to the HIS production database.

Use one of:

1. HIS vendor API
2. internal middleware API
3. read-only SQL account and stored procedure/view

Recommended:

```text
Incident App -> Internal HIS Gateway -> HIS
```

This protects production HIS.

---

# 24. LIS Integration – Optional

Only required if laboratory incident workflow needs deeper automation.

Potential data:

```text
Sample Number
Test Name
Collection Time
Received Time
Result Time
Critical Result
Analyzer
Rejected Sample Reason
```

Do not include LIS integration in MVP unless laboratory workflow specifically requires it.

---

# 25. Suggested Backend Folder Structure

```text
server/
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   ├── database.ts
│   │   ├── env.ts
│   │   ├── redis.ts
│   │   └── logger.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── departments/
│   │   ├── locations/
│   │   ├── categories/
│   │   ├── incidents/
│   │   ├── investigations/
│   │   ├── rca/
│   │   ├── capa/
│   │   ├── attachments/
│   │   ├── notifications/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── audit/
│   │   └── integrations/
│   │
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── authorize.ts
│   │   ├── errorHandler.ts
│   │   ├── validate.ts
│   │   └── audit.ts
│   │
│   ├── queues/
│   │   ├── notification.queue.ts
│   │   ├── escalation.queue.ts
│   │   └── workers/
│   │
│   ├── common/
│   │   ├── constants/
│   │   ├── enums/
│   │   ├── errors/
│   │   ├── helpers/
│   │   └── types/
│   │
│   └── tests/
│
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

# 26. Suggested React Folder Structure

```text
client/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── charts/
│   │   └── layout/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── incidents/
│   │   ├── investigation/
│   │   ├── rca/
│   │   ├── capa/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── administration/
│   │
│   ├── hooks/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── permissions.ts
│   │
│   ├── store/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
│
├── public/
├── package.json
└── Dockerfile
```

---

# 27. State Management

Use:

```text
React Query -> server data
Zustand     -> local/global UI state
React Hook Form -> form state
```

Avoid storing all server data in Redux unless needed.

---

# 28. Workflow Engine Design

Do not scatter status changes across controllers.

Create a centralized workflow service.

Example:

```ts
IncidentWorkflowService.transition({
  incidentId,
  from: "HOD_REVIEW",
  to: "UNDER_INVESTIGATION",
  actor: user
});
```

Workflow service validates:

```text
Is transition allowed?
Does user have permission?
Are required fields complete?
Should notification be generated?
Should audit log be created?
Should escalation rule execute?
```

Allowed transition map example:

```js
{
  SUBMITTED: ["TRIAGED", "RETURNED_FOR_INFORMATION"],
  TRIAGED: ["HOD_REVIEW", "UNDER_INVESTIGATION"],
  HOD_REVIEW: ["UNDER_INVESTIGATION", "RETURNED_FOR_INFORMATION"],
  UNDER_INVESTIGATION: ["RCA_REQUIRED", "READY_FOR_CLOSURE"],
  RCA_REQUIRED: ["CAPA_IN_PROGRESS"],
  CAPA_IN_PROGRESS: ["EFFECTIVENESS_REVIEW"],
  EFFECTIVENESS_REVIEW: ["READY_FOR_CLOSURE", "CAPA_IN_PROGRESS"],
  READY_FOR_CLOSURE: ["CLOSED"],
  CLOSED: ["REOPENED"]
}
```

---

# 29. Domain Events

Recommended internal domain events:

```text
incident.created
incident.submitted
incident.triaged
incident.severity_changed
incident.assigned
incident.escalated
investigation.started
investigation.completed
rca.created
rca.approved
capa.created
capa.assigned
capa.completed
capa.overdue
capa.verified
incident.closed
incident.reopened
```

This makes notifications and audit logic cleaner.

---

# 30. File Upload Flow

```text
Browser
   |
   v
POST /attachments
   |
   v
Validate User
Validate File Type
Validate File Size
Generate Stored Filename
Calculate Checksum
Store File
Create DB Metadata
Return Attachment ID
```

Incident should store attachment IDs, not large file binary objects.

Maximum file size initially:

```text
10 MB per file
```

Make configurable.

---

# 31. Search and Filtering

Incident list should support:

```text
Incident No
UHID
IP No
Date range
Department
Location
Category
Severity
Status
Reporter
Investigator
CAPA status
```

Backend must paginate.

Example:

```text
GET /api/v1/incidents?page=1&limit=25&department=...&status=UNDER_INVESTIGATION
```

Never return thousands of incidents in one response.

---

# 32. Reports

Recommended reports:

1. Incident Register
2. Department Incident Report
3. Severity Report
4. Category Report
5. Near Miss Report
6. Critical / Sentinel Incident Report
7. Incident Closure Report
8. Overdue Investigation Report
9. CAPA Register
10. CAPA Overdue Report
11. RCA Summary
12. Monthly Trend
13. Department Comparison
14. Recurring Root Cause Report

Export:

```text
Excel
PDF
CSV
```

---

# 33. Performance Targets

Recommended initial targets:

```text
Login response: < 1 second
Incident creation: < 2 seconds
Incident list load: < 2 seconds
Dashboard load: < 3 seconds
Search: < 2 seconds
```

Use indexes and aggregation pipelines carefully.

---

# 34. MongoDB Aggregation Examples

Dashboard metrics should use aggregation pipelines.

Example severity grouping:

```js
[
  {
    $match: {
      incidentDateTime: { $gte: fromDate, $lte: toDate }
    }
  },
  {
    $group: {
      _id: "$severity",
      count: { $sum: 1 }
    }
  }
]
```

Consider materialized summary collections later only if data volume grows significantly.

---

# 35. Error Handling

Create centralized error classes.

Examples:

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
ACCESS_DENIED
RESOURCE_NOT_FOUND
INVALID_WORKFLOW_TRANSITION
INCIDENT_ALREADY_CLOSED
CAPA_NOT_COMPLETE
FILE_TYPE_NOT_ALLOWED
```

Never expose raw MongoDB errors to the browser.

---

# 36. Logging

Use structured logs.

Example:

```json
{
  "level": "info",
  "event": "incident.submitted",
  "incidentId": "...",
  "userId": "...",
  "timestamp": "..."
}
```

Separate:

```text
Application Logs
Security Logs
Audit Logs
```

Audit logs belong in MongoDB.

Application logs can be shipped to files / Loki / ELK later.

---

# 37. Testing Strategy

## Unit Tests

Test:

- severity logic
- permission checks
- workflow transitions
- CAPA validation
- escalation calculation

## Integration Tests

Test:

- login
- incident creation
- HOD review
- investigation flow
- RCA creation
- CAPA creation
- closure

## Frontend Tests

Use:

- Vitest
- React Testing Library

## API Tests

Use:

- Jest or Vitest
- Supertest

## End-to-End

Use Playwright.

Core test scenario:

```text
Staff login
-> create incident
-> HOD acknowledges
-> investigator starts investigation
-> RCA created
-> CAPA assigned
-> CAPA completed
-> Quality verifies
-> incident closed
```

---

# 38. Development Environments

Use separate environments.

```text
DEV
UAT
PRODUCTION
```

Recommended hostnames:

```text
incident-dev.hospital.local
incident-uat.hospital.local
incident.hospital.local
```

Use separate MongoDB databases.

```text
incident_dev
incident_uat
incident_prod
```

Never use production patient data in development.

---

# 39. Docker Architecture

```yaml
services:
  frontend:
    build: ./client

  backend:
    build: ./server

  mongo:
    image: mongo:7

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio

  nginx:
    image: nginx:alpine
```

Network:

```text
public_proxy_network
internal_application_network
```

MongoDB and Redis should not expose ports externally in production unless required for administration from restricted hosts.

---

# 40. Recommended Production Architecture

For an on-prem hospital deployment:

```text
                         Hospital LAN
                              |
                              v
                        Firewall / ACL
                              |
                              v
                        Nginx Reverse Proxy
                              |
                 +------------+------------+
                 |                         |
             Frontend                  Backend API
                                           |
                   +-----------------------+-----------------------+
                   |                       |                       |
                MongoDB                  Redis                 File Store
                   |
                   v
            Backup / DR Storage
```

If server resources permit, keep DB and application workloads separated in production.

---

# 41. Backup and Disaster Recovery

Minimum recommendation:

## MongoDB

```text
Daily full backup
Hourly incremental / oplog strategy where possible
Retention: 30–90 days based on policy
```

## Attachments

```text
Daily incremental
Weekly full
```

## Configuration

Back up:

```text
.env securely
Nginx config
Docker compose
Application releases
MongoDB backup scripts
```

Regularly perform restoration tests.

---

# 42. Monitoring

Monitor:

```text
CPU
Memory
Disk
MongoDB storage
MongoDB connections
API latency
HTTP error rate
Queue backlog
Redis availability
File storage capacity
Backup success
```

Tools:

- Uptime Kuma initially
- Prometheus + Grafana later
- Loki or ELK for logs later

---

# 43. Development Phases

## Phase 0 – Requirement Freeze

Duration goal: short discovery sprint.

Confirm:

- departments
- incident categories
- severity matrix
- user roles
- escalation contacts
- approval hierarchy
- mandatory fields
- CAPA rules
- management dashboard expectations

Deliverables:

```text
Final workflow
Role matrix
Data field list
Screen wireframes
```

---

## Phase 1 – Foundation

Build:

- project repository
- Docker development environment
- Express TypeScript backend
- React frontend
- MongoDB connection
- authentication
- role/permission framework
- departments
- locations
- categories
- common layout

Acceptance:

```text
User can login
Role restrictions work
Admin can configure departments and locations
```

---

## Phase 2 – Incident Reporting

Build:

- new incident form
- incident number generation
- file upload
- My Incidents
- incident detail page
- status timeline
- HOD notification

Acceptance:

```text
Staff can report a complete incident in less than 3 minutes
```

---

## Phase 3 – Triage and Investigation

Build:

- severity classification
- HOD review
- investigator assignment
- investigation form
- due date
- evidence upload
- escalation

---

## Phase 4 – RCA

Build:

- 5 Why tool
- Fishbone data structure
- root cause summary
- quality approval

Optional UI enhancement:

Build visual Fishbone diagram later.

---

## Phase 5 – CAPA

Build:

- CAPA creation
- action ownership
- due dates
- evidence
- reminders
- overdue escalation
- effectiveness verification

---

## Phase 6 – Closure

Build:

- closure checklist
- Quality approval
- closure remarks
- reopen function
- final audit trail

---

## Phase 7 – Dashboard and Reports

Build:

- management dashboard
- HOD dashboard
- staff dashboard
- filters
- Excel exports
- PDF reports

---

## Phase 8 – Production Hardening

Build / configure:

- SSL
- backup
- monitoring
- application logs
- rate limiting
- security headers
- production DB indexes
- file storage protection
- penetration/security review
- UAT corrections

---

## Phase 9 – HIS Integration

Only after core platform is stable.

Build:

```text
Patient lookup by UHID/IP
Patient auto-fill
Read-only data sync
Timeout/failure handling
Fallback to manual entry
```

Do not make HIS availability a hard dependency for creating an incident.

If HIS lookup fails, allow manual entry.

---

# 44. Suggested Git Repository

```text
incident-reporting-system/
├── client/
├── server/
├── infrastructure/
│   ├── nginx/
│   ├── docker/
│   ├── scripts/
│   └── monitoring/
├── docs/
│   ├── architecture.md
│   ├── workflow.md
│   ├── api.md
│   ├── database.md
│   ├── permissions.md
│   └── deployment.md
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
```

---

# 45. Environment Variables

Example:

```env
NODE_ENV=development
PORT=5000

MONGO_URI=mongodb://mongo:27017/incident_dev

JWT_ACCESS_SECRET=CHANGE_ME
JWT_REFRESH_SECRET=CHANGE_ME

ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=12h

REDIS_URL=redis://redis:6379

FILE_STORAGE_DRIVER=local
FILE_STORAGE_PATH=/app/uploads
MAX_FILE_SIZE_MB=10

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

APP_URL=http://localhost:5173
API_URL=http://localhost:5000
```

Never commit the real `.env` file.

---

# 46. Suggested Development Order for Cursor / Claude

When developing with Cursor or Claude, do not ask it to generate the entire application in one prompt.

Use controlled phases.

## Prompt 1 – Scaffold

```text
Create a production-quality MERN monorepo for a hospital incident reporting system.
Use React + TypeScript + Vite for frontend and Node.js + Express + TypeScript + MongoDB/Mongoose for backend.
Create client and server folders, Dockerfiles, docker-compose, environment validation and common error handling.
Do not implement business modules yet.
```

## Prompt 2 – Authentication

```text
Implement JWT access/refresh authentication using secure HTTP-only cookies.
Create users, roles and permissions models.
Implement authenticate and requirePermission middleware.
Add login, logout, refresh and /me APIs.
Include input validation and audit logging.
```

## Prompt 3 – Master Configuration

```text
Implement departments, locations, incident categories and subcategories.
Add admin CRUD APIs and React administration pages.
Use soft-delete/active flags instead of destructive delete where records may be referenced.
```

## Prompt 4 – Incident Module

```text
Implement incident creation, listing, filtering and details.
Generate incident numbers in INC-YYYY-###### format safely without duplicate values under concurrent requests.
Implement status timeline and attachment metadata.
```

## Prompt 5 – Workflow Engine

```text
Create an IncidentWorkflowService that controls all status transitions.
No controller should directly update incident.status.
Validate transition permissions, required fields, audit events and notification events.
```

## Prompt 6 – Investigation

```text
Implement HOD review, investigator assignment and investigation module.
Add facts, chronology, contributing factors, evidence and completion workflow.
```

## Prompt 7 – RCA

```text
Implement RCA with 5 Why and Fishbone models.
Add quality approval and audit history.
```

## Prompt 8 – CAPA

```text
Implement CAPA creation, ownership, due dates, completion, evidence, verification and overdue status.
Use BullMQ jobs for reminders and escalations.
```

## Prompt 9 – Dashboard

```text
Create dashboard aggregation APIs and React charts for severity, department, category, monthly trend, CAPA status and closure time.
Add date and department filters.
```

## Prompt 10 – Hardening

```text
Review the entire codebase for hospital production readiness.
Check authorization gaps, validation, NoSQL injection risks, upload security, audit coverage, MongoDB indexes, error handling, logging and environment secrets.
Create a findings report and patch critical issues.
```

---

# 47. Important Development Rules for AI Coding Assistants

Add the following rules to your repository instructions such as `CLAUDE.md` or Cursor rules.

```text
1. Use TypeScript everywhere.
2. Never bypass RBAC middleware.
3. Never directly mutate incident.status outside IncidentWorkflowService.
4. Every state-changing API must create an audit log.
5. Do not permanently delete incidents, RCA, CAPA or audit logs.
6. Validate every request on the backend.
7. Do not trust frontend validation.
8. Use MongoDB indexes for list and dashboard queries.
9. Do not store file binaries inside MongoDB.
10. Never log passwords, JWT tokens or patient-sensitive payloads.
11. Do not expose stack traces to production clients.
12. Integration with HIS must be read-only unless a separate approved requirement exists.
13. The incident system must continue functioning if HIS integration is unavailable.
14. Use service-layer business logic instead of fat controllers.
15. Add tests for all critical workflow transitions.
```

---

# 48. Suggested First MVP Scope

For the first working version, implement only:

```text
Login
RBAC
Departments
Locations
Incident Categories
Incident Reporting
My Incidents
HOD Review
Severity
Investigation
5 Why RCA
CAPA
Quality Verification
Closure
Audit Trail
Basic Dashboard
Email / In-App Notifications
```

Do not initially implement:

```text
HIS
LIS
RIS/PACS
SMS
AI analysis
Advanced predictive dashboards
Mobile native app
```

This keeps the MVP achievable while preserving an architecture that can support future integrations.

---

# 49. MVP Workflow Diagram

```text
+------------------+
| INCIDENT OCCURS  |
+--------+---------+
         |
         v
+------------------+
| STAFF REPORTS    |
| INCIDENT         |
+--------+---------+
         |
         v
+------------------+
| SEVERITY /       |
| INITIAL TRIAGE   |
+--------+---------+
         |
         v
+------------------+
| HOD REVIEW       |
+--------+---------+
         |
         v
+------------------+
| INVESTIGATION    |
+--------+---------+
         |
         v
+------------------+
| RCA REQUIRED?    |
+---+----------+---+
    | YES      | NO
    v          |
+----------+   |
| RCA      |   |
+----+-----+   |
     |         |
     v         |
+----------+   |
| CAPA     |   |
+----+-----+   |
     |         |
     v         v
+------------------+
| QUALITY REVIEW   |
+--------+---------+
         |
         v
+------------------+
| CLOSURE          |
+--------+---------+
         |
         v
+------------------+
| DASHBOARD /      |
| LEARNING         |
+------------------+
```

---

# 50. Recommended Final Architecture Decision

For Adhiparasakthi Hospitals, the recommended first production design is:

```text
React + TypeScript
        |
        v
Nginx Reverse Proxy
        |
        v
Node.js + Express + TypeScript
        |
        +---- MongoDB
        |
        +---- Redis / BullMQ
        |
        +---- NAS / MinIO File Storage
        |
        +---- Email Notification
        |
        +---- Audit Logging

Phase 2:
        |
        +---- HIS Read-Only Integration Gateway

Future:
        |
        +---- LIS
        +---- RIS/PACS
        +---- AD/LDAP SSO
        +---- SMS Gateway
```

The application should be designed so that the core incident workflow has no dependency on HIS, LIS or any other hospital system. Integrations should enrich incident data, not determine whether the application can operate.

---

# 51. Definition of Done for Production MVP

Production MVP should not be considered complete until:

- [ ] Staff can submit an incident.
- [ ] Incident ID is generated correctly.
- [ ] HOD receives notification.
- [ ] Severity and category can be reviewed.
- [ ] Investigator can be assigned.
- [ ] Investigation can be completed.
- [ ] RCA can be created.
- [ ] CAPA can be assigned and completed.
- [ ] Quality can verify CAPA effectiveness.
- [ ] Incident can be formally closed.
- [ ] Every major action is visible in audit trail.
- [ ] Role restrictions are tested.
- [ ] Department restrictions are tested.
- [ ] Dashboard values match database records.
- [ ] File uploads are protected.
- [ ] HTTPS is enabled.
- [ ] MongoDB backup is working.
- [ ] Restore procedure is tested.
- [ ] Server monitoring is active.
- [ ] UAT is completed with Quality, Nursing, Medical Administration and representative HODs.

---

# 52. Recommended Next Development Milestone

Start with this sequence:

```text
1. Create Git repository
2. Create MERN TypeScript Docker scaffold
3. Implement MongoDB models for Users / Roles / Departments
4. Implement login and RBAC
5. Build application shell
6. Implement incident categories and locations
7. Build Report Incident form
8. Build Incident List and Details
9. Add WorkflowService
10. Add HOD Review
11. Add Investigation
12. Add RCA
13. Add CAPA
14. Add Closure
15. Add dashboard
16. Add notifications
17. Add audit logs
18. Security hardening
19. UAT
20. Production deployment
```

This order avoids building dashboards and integrations before the core workflow is stable.

---

**Document Version:** 1.0  
**Project:** Adhiparasakthi Hospitals – Incident Reporting Application  
**Architecture:** MERN Stack / On-Premise / Integration-Ready
