import { Role } from '../modules/roles/role.model.js';
import { User } from '../modules/users/user.model.js';
import { logger } from '../config/logger.js';
import { PERMISSIONS, ROLE_CODES } from '../common/enums/permissions.js';

// The four system roles:
// - Staff report incidents and track their own reports.
// - Quality triages new reports, assigns them to the responsible department's HOD,
//   and reviews the HOD's investigation, RCA and CAPA before completing the incident.
// - HODs investigate incidents assigned to their department and write the RCA and CAPA.
// - Admin sees all dashboards and reports and manages users and master data.
export const SYSTEM_ROLE_CODES: string[] = Object.values(ROLE_CODES);

export const SYSTEM_ROLES = [
  {
    name: 'Hospital Staff',
    code: ROLE_CODES.STAFF,
    permissions: [PERMISSIONS.INCIDENT_CREATE, PERMISSIONS.INCIDENT_READ_OWN, PERMISSIONS.INCIDENT_RESUBMIT],
    isSystemRole: true,
  },
  {
    name: 'Quality',
    code: ROLE_CODES.QUALITY,
    permissions: [
      PERMISSIONS.INCIDENT_READ_ALL,
      PERMISSIONS.INCIDENT_TRIAGE,
      PERMISSIONS.INCIDENT_REVIEW,
      PERMISSIONS.INVESTIGATION_READ,
      PERMISSIONS.RCA_READ,
      PERMISSIONS.CAPA_READ,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW_ALL,
    ],
    isSystemRole: true,
  },
  {
    name: 'Head of Department (HOD)',
    code: ROLE_CODES.HOD,
    permissions: [
      PERMISSIONS.INCIDENT_READ_ASSIGNED,
      PERMISSIONS.INCIDENT_RETURN_TO_QUALITY,
      PERMISSIONS.INCIDENT_SUBMIT_CLOSURE,
      PERMISSIONS.INVESTIGATION_READ,
      PERMISSIONS.INVESTIGATION_WRITE,
      PERMISSIONS.RCA_READ,
      PERMISSIONS.RCA_WRITE,
      PERMISSIONS.CAPA_READ,
      PERMISSIONS.CAPA_WRITE,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW_DEPARTMENT,
    ],
    isSystemRole: true,
  },
  {
    name: 'Admin',
    code: ROLE_CODES.ADMIN,
    permissions: [
      PERMISSIONS.INCIDENT_READ_ALL,
      PERMISSIONS.INVESTIGATION_READ,
      PERMISSIONS.RCA_READ,
      PERMISSIONS.CAPA_READ,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW_ALL,
      PERMISSIONS.ADMIN_USER_MANAGE,
      PERMISSIONS.ADMIN_ROLE_MANAGE,
      PERMISSIONS.ADMIN_DEPARTMENT_MANAGE,
      PERMISSIONS.ADMIN_LOCATION_MANAGE,
      PERMISSIONS.ADMIN_CATEGORY_MANAGE,
      PERMISSIONS.ADMIN_AUDIT_VIEW,
    ],
    isSystemRole: true,
  },
];

// Roles from the previous design and the role that replaces each of them
const LEGACY_ROLE_RENAMES: Record<string, string> = {
  QUALITY_ADMIN: ROLE_CODES.QUALITY,
  MD: ROLE_CODES.ADMIN,
};

/**
 * Renames legacy roles in place so users keep their access: QUALITY_ADMIN → QUALITY, MD → ADMIN.
 * If both the legacy and the new role exist, users are moved to the new role and the legacy role is deleted.
 */
export const migrateLegacyRoles = async (): Promise<void> => {
  for (const [legacyCode, newCode] of Object.entries(LEGACY_ROLE_RENAMES)) {
    const legacy = await Role.findOne({ code: legacyCode });
    if (!legacy) continue;

    const target = await Role.findOne({ code: newCode });
    if (!target) {
      await Role.updateOne({ _id: legacy._id }, { $set: { code: newCode } });
    } else {
      await User.updateMany({ roles: legacy._id }, { $addToSet: { roles: target._id } });
      await User.updateMany({ roles: legacy._id }, { $pull: { roles: legacy._id } });
      await legacy.deleteOne();
    }
    logger.info(`🔁 Migrated role ${legacyCode} → ${newCode}`);
  }
};

/** Migrates legacy roles, then upserts the system roles so their permissions always match this file. */
export const syncSystemRoles = async (): Promise<void> => {
  await migrateLegacyRoles();
  for (const r of SYSTEM_ROLES) {
    await Role.findOneAndUpdate({ code: r.code }, r, { upsert: true, new: true });
  }
};
