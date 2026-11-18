import { JwtPayload } from '../../modules/auth/auth.utils.js';
import { PERMISSIONS } from '../enums/permissions.js';
import { hasPermission } from './incidentAccess.js';

/**
 * Reporter confidentiality: only Quality, Admin and Super Admin (INCIDENT_REPORTER_VIEW) may know
 * who reported an incident. Everyone else — HODs, RCA Heads, Intimation members, other staff —
 * sees the reporter as confidential, so staff can report without fear of the department they
 * report on. The reporter always sees their own reports.
 */
export const REPORTER_CONFIDENTIAL_LABEL = 'Confidential';

export const canSeeReporter = (user: JwtPayload | undefined): boolean =>
  hasPermission(user, PERMISSIONS.INCIDENT_REPORTER_VIEW);

const idOf = (v: any): string | undefined => (v ? String(v._id ?? v) : undefined);

/** True when this user may see who reported this incident (privileged, or it's their own report). */
export const canSeeReporterOf = (user: JwtPayload | undefined, incident: { reportedBy?: any }): boolean =>
  canSeeReporter(user) || (!!user && idOf(incident?.reportedBy) === user.userId);

/**
 * Returns the incident (plain object) with the reporter removed when this user may not see it:
 * `reportedBy` becomes null and `reporterHidden` is set so the app can show "Confidential".
 */
export const redactReporter = <T extends Record<string, any>>(incident: T, user: JwtPayload | undefined): T => {
  if (!incident || canSeeReporterOf(user, incident)) return incident;
  return { ...incident, reportedBy: null, reporterHidden: true };
};

/** Workflow steps done by the reporter, whose "by" is hidden in the timeline for other viewers. */
export const REPORTER_TIMELINE_ACTIONS = ['SUBMITTED', 'RESPOND_INFO'];
