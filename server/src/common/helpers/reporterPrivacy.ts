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

const isObjectId = (v: any): boolean => v?._bsontype === 'ObjectId' || v?._bsontype === 'ObjectID';
const isPlain = (v: any): boolean => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v));

/**
 * Copy of `value` with every reference to `userId` removed: the id itself (as ObjectId or string)
 * and any populated user object with that `_id` become null. The reporter's id turns up beyond
 * `reportedBy` (e.g. infoRequests[].respondedBy when they answer Quality), so the whole incident is
 * scrubbed rather than a list of known fields.
 */
const scrubUser = (value: any, userId: string): any => {
  if (value === null || value === undefined) return value;
  if (isObjectId(value)) return String(value) === userId ? null : value;
  if (typeof value === 'string') return value === userId ? null : value;
  // In a list the reporter's entry is dropped (not left as null, which screens would trip on)
  if (Array.isArray(value)) {
    return value.flatMap((v) => {
      const out = scrubUser(v, userId);
      return v !== null && out === null ? [] : [out];
    });
  }
  if (isPlain(value)) {
    if (value._id !== undefined && String(value._id) === userId) return null;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubUser(v, userId);
    return out;
  }
  return value; // Date, Buffer...
};

/**
 * Returns the incident (plain object) with the reporter removed when this user may not see it:
 * `reportedBy` becomes null, any other reference to the reporter is removed, and `reporterHidden`
 * is set so the app can show "Confidential".
 */
export const redactReporter = <T extends Record<string, any>>(incident: T, user: JwtPayload | undefined): T => {
  if (!incident || canSeeReporterOf(user, incident)) return incident;
  const reporterId = idOf(incident.reportedBy);
  const scrubbed = reporterId ? scrubUser({ ...incident, reportedBy: null }, reporterId) : { ...incident, reportedBy: null };
  return { ...scrubbed, reporterHidden: true };
};

/** Workflow steps done by the reporter, whose "by" is hidden in the timeline for other viewers. */
export const REPORTER_TIMELINE_ACTIONS = ['SUBMITTED', 'RESPOND_INFO'];
