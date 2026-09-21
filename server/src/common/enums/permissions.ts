// Permission set for the four roles: Staff, Quality, HOD, Admin.
// Role → permission mapping lives in server/src/seeders/systemRoles.ts.
export const PERMISSIONS = {
  // Incident permissions
  INCIDENT_CREATE: 'incident.create', // Staff reports an incident
  INCIDENT_READ_OWN: 'incident.read_own', // Staff sees incidents they reported
  INCIDENT_RESUBMIT: 'incident.resubmit', // Staff answers Quality's request for information
  INCIDENT_READ_ASSIGNED: 'incident.read_assigned', // HOD sees incidents assigned to their department
  INCIDENT_READ_ALL: 'incident.read_all', // Quality and Admin see every incident
  INCIDENT_TRIAGE: 'incident.triage', // Quality confirms severity, assigns HOD, requests info, rejects
  INCIDENT_RETURN_TO_QUALITY: 'incident.return_to_quality', // HOD returns a wrongly assigned incident
  INCIDENT_SUBMIT_CLOSURE: 'incident.submit_closure', // HOD submits for Quality review
  INCIDENT_REVIEW: 'incident.review', // Quality reviews CAPA and completes or sends back

  // Investigation, RCA and CAPA
  INVESTIGATION_READ: 'investigation.read',
  INVESTIGATION_WRITE: 'investigation.write',
  RCA_READ: 'rca.read',
  RCA_WRITE: 'rca.write',
  CAPA_READ: 'capa.read',
  CAPA_WRITE: 'capa.write', // create, update and mark done

  // Dashboards and reports
  DASHBOARD_VIEW: 'dashboard.view',
  REPORT_VIEW_DEPARTMENT: 'report.view_department',
  REPORT_VIEW_ALL: 'report.view_all',

  // Administration (Admin only)
  ADMIN_USER_MANAGE: 'admin.user_manage',
  ADMIN_ROLE_MANAGE: 'admin.role_manage',
  ADMIN_DEPARTMENT_MANAGE: 'admin.department_manage',
  ADMIN_LOCATION_MANAGE: 'admin.location_manage',
  ADMIN_CATEGORY_MANAGE: 'admin.category_manage',
  ADMIN_AUDIT_VIEW: 'admin.audit_view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  STAFF: 'STAFF',
  QUALITY: 'QUALITY',
  HOD: 'HOD',
  ADMIN: 'ADMIN',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];
