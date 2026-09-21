import type { UserProfile } from '../store/useAuthStore';

// Mirrors server/src/common/helpers/incidentAccess.ts. The server enforces these rules;
// the client only uses them to hide actions the user cannot perform.

const idOf = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object') return value._id ? String(value._id) : undefined;
  return String(value);
};

export const hasPermission = (user: UserProfile | null | undefined, permission: string): boolean =>
  Boolean(user?.permissions?.includes(permission));

export const hasAnyPermission = (user: UserProfile | null | undefined, permissions: string[]): boolean =>
  permissions.some((p) => hasPermission(user, p));

export const isReceivingDepartment = (user: UserProfile | null | undefined, incident: any): boolean =>
  Boolean(user?.departmentId) && idOf(incident?.departmentId) === idOf(user?.departmentId);

/** Quality/Admin, or the HOD of the department the incident is assigned to, may work on an incident.
 *  Each action additionally needs its own permission (Admin holds none). */
export const canManageIncident = (user: UserProfile | null | undefined, incident: any): boolean =>
  hasPermission(user, 'incident.read_all') ||
  (hasPermission(user, 'incident.read_assigned') && isReceivingDepartment(user, incident));

/** Page a user lands on after login: Staff have no dashboard and start at their reports. */
export const homePath = (user: UserProfile | null | undefined): string => {
  if (hasPermission(user, 'dashboard.view')) return '/dashboard';
  if (hasPermission(user, 'incident.read_own')) return '/my-reports';
  return '/incidents';
};
