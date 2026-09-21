import { Request } from 'express';
import { AppError } from '../errors/appError.js';
import { PERMISSIONS } from '../enums/permissions.js';
import { Incident, IIncident } from '../../modules/incidents/incident.model.js';
import { JwtPayload } from '../../modules/auth/auth.utils.js';

// Access rules for incidents:
// - Quality and Admin (incident.read_all) see every incident.
// - HODs (incident.read_assigned) see incidents currently or previously assigned to their department,
//   and act only on incidents currently assigned to it.
// - Staff (incident.read_own) see the incidents they reported.
// Which workflow action each role may take is decided by incidentWorkflow.rules.ts.

const idOf = (value: any): string | undefined => {
  if (!value) return undefined;
  if (value._id) return value._id.toString();
  return value.toString();
};

export const hasPermission = (user: JwtPayload | undefined, permission: string): boolean =>
  Boolean(user?.permissions?.includes(permission));

/** The incident is currently assigned to the user's department. */
export const isResponsibleDepartment = (user: JwtPayload | undefined, incident: IIncident): boolean =>
  Boolean(user?.departmentId) && idOf(incident.departmentId) === user?.departmentId;

/** The incident is, or was at some point, assigned to the user's department. */
const wasAssignedToDepartment = (user: JwtPayload | undefined, incident: IIncident): boolean =>
  isResponsibleDepartment(user, incident) ||
  (incident.assignments || []).some((a) => idOf(a.departmentId) === user?.departmentId);

export const canViewIncident = (user: JwtPayload | undefined, incident: IIncident): boolean => {
  if (!user) return false;
  if (hasPermission(user, PERMISSIONS.INCIDENT_READ_ALL)) return true;
  if (hasPermission(user, PERMISSIONS.INCIDENT_READ_ASSIGNED) && wasAssignedToDepartment(user, incident)) return true;
  return hasPermission(user, PERMISSIONS.INCIDENT_READ_OWN) && idOf(incident.reportedBy) === user.userId;
};

/** HOD work on an incident (investigation, RCA, CAPA) is limited to the responsible department's HOD. */
export const canWorkOnIncident = (user: JwtPayload | undefined, incident: IIncident): boolean =>
  hasPermission(user, PERMISSIONS.INCIDENT_READ_ASSIGNED) && isResponsibleDepartment(user, incident);

/** Mongo filter limiting incident lists/aggregations to what the user may see. */
export const incidentScopeFilter = (user: JwtPayload | undefined): Record<string, any> => {
  if (!user) return { _id: null };
  if (hasPermission(user, PERMISSIONS.INCIDENT_READ_ALL)) return {};
  const or: Record<string, any>[] = [];
  if (hasPermission(user, PERMISSIONS.INCIDENT_READ_ASSIGNED) && user.departmentId) {
    or.push({ departmentId: user.departmentId }, { 'assignments.departmentId': user.departmentId });
  }
  if (hasPermission(user, PERMISSIONS.INCIDENT_READ_OWN)) {
    or.push({ reportedBy: user.userId });
  }
  return or.length ? { $or: or } : { _id: null };
};

const loadIncident = async (incidentId: string | undefined): Promise<IIncident> => {
  const incident = incidentId ? await Incident.findById(incidentId) : null;
  if (!incident) {
    throw AppError.notFound('Incident record not found');
  }
  return incident;
};

export const loadIncidentForView = async (req: Request, incidentId: string | undefined): Promise<IIncident> => {
  const incident = await loadIncident(incidentId);
  if (!canViewIncident(req.user, incident)) {
    throw AppError.forbidden('You do not have access to this incident');
  }
  return incident;
};

export const loadIncidentForWork = async (req: Request, incidentId: string | undefined): Promise<IIncident> => {
  const incident = await loadIncident(incidentId);
  if (!canWorkOnIncident(req.user, incident)) {
    throw AppError.forbidden('Only the HOD of the department this incident is assigned to can do this');
  }
  return incident;
};
