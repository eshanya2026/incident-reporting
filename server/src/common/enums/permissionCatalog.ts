import { PERMISSIONS, Permission, ROLE_CODES } from './permissions.js';

// What each permission means, in the words the Access Control screen shows the Super Admin, and
// whether it can be changed there.
//
// Screens and administration abilities are configurable per role. Incident workflow steps are
// not: the workflow rules also check *who* is acting (Quality, the reporter, the HOD of that
// department), so granting e.g. "triage" to Admin would not let them triage, and removing it from
// Quality would stall every incident. Those follow the role and are shown read-only.

export type PermissionGroup = 'Screens' | 'Incident details' | 'Administration' | 'Incident workflow';

export interface PermissionInfo {
  key: Permission;
  label: string;
  description: string;
  group: PermissionGroup;
  configurable: boolean;
  /** For workflow steps: the roles that actually perform them. */
  performedBy?: string[];
}

export const PERMISSION_CATALOG: PermissionInfo[] = [
  // Screens (each shows or hides a navbar item and the data behind it)
  { key: PERMISSIONS.DASHBOARD_VIEW, group: 'Screens', configurable: true, label: 'Dashboard', description: 'Dashboard with incident and CAPA analytics. Hospital-wide for roles that can see all incidents, otherwise the user\'s own department.' },
  { key: PERMISSIONS.INCIDENT_CREATE, group: 'Screens', configurable: true, label: 'Report Incident', description: 'Report a new incident.' },
  { key: PERMISSIONS.INCIDENT_READ_OWN, group: 'Screens', configurable: true, label: 'My Reports', description: 'Incidents the user reported themselves, or was intimated on.' },
  { key: PERMISSIONS.REVIEW_QUEUE_VIEW, group: 'Screens', configurable: true, label: 'Review & RCA Queue', description: 'Incidents waiting for Quality review or an RCA meeting.' },
  { key: PERMISSIONS.INCIDENT_READ_ASSIGNED, group: 'Screens', configurable: true, label: "My Department's Incidents", description: "Incidents assigned to, or involving, the user's department." },
  { key: PERMISSIONS.INCIDENT_READ_ALL, group: 'Screens', configurable: true, label: 'All Incidents', description: 'Every incident in the hospital, and opening any of them.' },
  { key: PERMISSIONS.CAPA_READ, group: 'Screens', configurable: true, label: 'CAPA', description: 'CAPA register, and CAPA details on incidents.' },
  { key: PERMISSIONS.REPORT_VIEW_ALL, group: 'Screens', configurable: true, label: 'Reports: whole hospital', description: 'Incident and CAPA registers for every department, with exports.' },
  { key: PERMISSIONS.REPORT_VIEW_DEPARTMENT, group: 'Screens', configurable: true, label: 'Reports: own department', description: "Incident and CAPA registers for the user's own department." },
  { key: PERMISSIONS.INSIGHTS_VIEW_ALL, group: 'Screens', configurable: true, label: 'AI Insights: whole hospital', description: 'AI analysis and Ask AI for every department.' },
  { key: PERMISSIONS.INSIGHTS_VIEW_DEPARTMENT, group: 'Screens', configurable: true, label: 'AI Insights: own department', description: "AI analysis and Ask AI for the user's own department." },
  { key: PERMISSIONS.ADMIN_WHATSAPP_TEMPLATES, group: 'Screens', configurable: true, label: 'WhatsApp Messages', description: 'Edit and preview the wording of WhatsApp notifications, and send a test message.' },
  { key: PERMISSIONS.ADMIN_USER_MANAGE, group: 'Screens', configurable: true, label: 'Administration', description: 'Administration screen: user accounts (create, edit, reset passwords, bulk import).' },

  // Detail sections inside an incident
  { key: PERMISSIONS.INVESTIGATION_READ, group: 'Incident details', configurable: true, label: 'Investigation details', description: 'See the investigation findings on incidents the user can open.' },
  { key: PERMISSIONS.RCA_READ, group: 'Incident details', configurable: true, label: 'RCA details', description: 'See root cause analyses and RCA meetings on incidents the user can open.' },

  // Administration abilities (tabs within Administration)
  { key: PERMISSIONS.ADMIN_DEPARTMENT_MANAGE, group: 'Administration', configurable: true, label: 'Manage departments', description: 'Add and edit departments and their HODs.' },
  { key: PERMISSIONS.ADMIN_LOCATION_MANAGE, group: 'Administration', configurable: true, label: 'Manage wards', description: 'Add wards.' },
  { key: PERMISSIONS.ADMIN_CATEGORY_MANAGE, group: 'Administration', configurable: true, label: 'Manage categories', description: 'Add, enable and disable incident categories and subcategories.' },
  { key: PERMISSIONS.ADMIN_ROLE_MANAGE, group: 'Administration', configurable: true, label: 'View roles', description: 'See the list of roles when creating or editing users.' },
  { key: PERMISSIONS.ADMIN_AUDIT_VIEW, group: 'Administration', configurable: true, label: 'Audit log', description: 'See the audit trail of workflow actions.' },

  // Workflow steps: fixed to the roles that perform them
  { key: PERMISSIONS.INCIDENT_TRIAGE, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.QUALITY], label: 'Triage new reports', description: 'Triage Inbox: assign, ask the reporter a question, or reject.' },
  { key: PERMISSIONS.INCIDENT_REVIEW, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.QUALITY], label: 'Review and close', description: 'Accept or return the HOD\'s work, request an RCA, and close with a risk score.' },
  { key: PERMISSIONS.INCIDENT_RESUBMIT, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.STAFF], label: 'Answer Quality\'s questions', description: 'The reporter answers a question Quality asked about their report.' },
  { key: PERMISSIONS.INCIDENT_RETURN_TO_QUALITY, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.HOD], label: 'Return a wrongly assigned incident', description: 'The HOD sends an incident back to Quality.' },
  { key: PERMISSIONS.INVESTIGATION_WRITE, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.HOD], label: 'Investigate', description: "The HOD records their department's investigation." },
  { key: PERMISSIONS.RCA_WRITE, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.HOD, ROLE_CODES.QUALITY, ROLE_CODES.RCA_HEAD], label: 'Write RCA / RCA meeting report', description: 'The HOD writes the 5-Why RCA; Quality uploads the RCA meeting report.' },
  { key: PERMISSIONS.CAPA_WRITE, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.HOD], label: 'Write CAPA', description: "The HOD writes and completes their department's CAPA." },
  { key: PERMISSIONS.INCIDENT_SUBMIT_CLOSURE, group: 'Incident workflow', configurable: false, performedBy: [ROLE_CODES.HOD], label: 'Submit for closure', description: 'The HOD submits the finished investigation and CAPA to Quality.' },

  // Access control itself is reserved for the Super Admin
  { key: PERMISSIONS.ADMIN_ACCESS_CONTROL, group: 'Administration', configurable: false, performedBy: [ROLE_CODES.SUPER_ADMIN], label: 'Access Control', description: 'Decide which roles can see which screens. Super Admin only.' },
];

const CONFIGURABLE = new Set<string>(PERMISSION_CATALOG.filter((p) => p.configurable).map((p) => p.key));
export const isConfigurablePermission = (key: string): boolean => CONFIGURABLE.has(key);
