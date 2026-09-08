export const PERMISSIONS = {
  // Incident permissions
  INCIDENT_CREATE: 'incident.create',
  INCIDENT_READ_OWN: 'incident.read_own',
  INCIDENT_READ_DEPARTMENT: 'incident.read_department',
  INCIDENT_READ_ALL: 'incident.read_all',
  INCIDENT_UPDATE: 'incident.update',
  INCIDENT_TRIAGE: 'incident.triage',
  INCIDENT_ASSIGN: 'incident.assign',
  INCIDENT_CHANGE_SEVERITY: 'incident.change_severity',
  INCIDENT_CLOSE: 'incident.close',
  INCIDENT_REOPEN: 'incident.reopen',

  // Investigation permissions
  INVESTIGATION_CREATE: 'investigation.create',
  INVESTIGATION_READ: 'investigation.read',
  INVESTIGATION_UPDATE: 'investigation.update',
  INVESTIGATION_COMPLETE: 'investigation.complete',

  // RCA permissions
  RCA_CREATE: 'rca.create',
  RCA_READ: 'rca.read',
  RCA_UPDATE: 'rca.update',
  RCA_APPROVE: 'rca.approve',

  // CAPA permissions
  CAPA_CREATE: 'capa.create',
  CAPA_READ: 'capa.read',
  CAPA_UPDATE: 'capa.update',
  CAPA_COMPLETE: 'capa.complete',
  CAPA_VERIFY: 'capa.verify',

  // Report & Dashboard permissions
  REPORT_VIEW_DEPARTMENT: 'report.view_department',
  REPORT_VIEW_ALL: 'report.view_all',
  DASHBOARD_VIEW_MANAGEMENT: 'dashboard.view_management',

  // Master & Admin permissions
  ADMIN_USER_MANAGE: 'admin.user_manage',
  ADMIN_ROLE_MANAGE: 'admin.role_manage',
  ADMIN_DEPARTMENT_MANAGE: 'admin.department_manage',
  ADMIN_LOCATION_MANAGE: 'admin.location_manage',
  ADMIN_CATEGORY_MANAGE: 'admin.category_manage',
  ADMIN_AUDIT_VIEW: 'admin.audit_view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
