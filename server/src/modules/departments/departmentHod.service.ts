import mongoose from 'mongoose';
import { Department } from './department.model.js';
import { User } from '../users/user.model.js';
import { Role } from '../roles/role.model.js';
import { Incident } from '../incidents/incident.model.js';
import { AppError } from '../../common/errors/appError.js';
import { ROLE_CODES } from '../../common/enums/permissions.js';

type Id = mongoose.Types.ObjectId | string;

/**
 * Incidents still being worked: these move to a department's new HOD so the work carries on.
 * Closed and rejected incidents keep the HOD who handled them, so past reports show that name.
 * (Investigations, CAPAs and the assignment history always keep whoever actually did the work.)
 */
export const OPEN_INCIDENT_STATUSES = [
  'ASSIGNED',
  'UNDER_INVESTIGATION',
  'CAPA_IN_PROGRESS',
  'PENDING_QUALITY_REVIEW',
  'RCA_REQUESTED',
] as const;

const roleId = async (code: string): Promise<mongoose.Types.ObjectId> => {
  const role = await Role.findOne({ code }).select('_id');
  if (!role) throw AppError.unprocessable(`The ${code} role is missing — restart the server to recreate system roles`);
  return role._id as mongoose.Types.ObjectId;
};

/**
 * A former HOD who no longer heads any department goes back to Staff: HOD access is granted per
 * department, so keeping the role would let them keep acting on that department's incidents.
 * Their name stays on everything they did.
 */
export const stepDownFormerHod = async (userId: Id): Promise<void> => {
  if (await Department.exists({ hodUserId: userId })) return;
  const user = await User.findById(userId);
  if (!user) return;
  const hodRoleId = await roleId(ROLE_CODES.HOD);
  if (!user.roles.some((r) => r.toString() === hodRoleId.toString())) return;

  const remaining = user.roles.filter((r) => r.toString() !== hodRoleId.toString());
  user.roles = (remaining.length > 0 ? remaining : [await roleId(ROLE_CODES.STAFF)]) as any;
  await user.save();
};

/** Moves the department's open incidents to its new HOD (see OPEN_INCIDENT_STATUSES). */
export const handOverOpenIncidents = async (departmentId: Id, newHodId: Id): Promise<number> => {
  const result = await Incident.updateMany(
    { departmentId, status: { $in: OPEN_INCIDENT_STATUSES } },
    { $set: { assignedHod: newHodId } }
  );
  return result.modifiedCount;
};

/**
 * Makes `newHodId` the department's HOD, or removes the HOD when null. Any active user can be
 * chosen: they get the HOD role (in place of Staff) and move into this department. The previous
 * HOD steps down to Staff, and the department's open incidents move to the new HOD.
 */
export const changeDepartmentHod = async (
  departmentId: Id,
  newHodId: string | null
): Promise<{ previousHodId: string | null; handedOver: number }> => {
  const dept = await Department.findById(departmentId);
  if (!dept) throw AppError.notFound('Department not found');
  const previousHodId = dept.hodUserId ? dept.hodUserId.toString() : null;
  if (previousHodId === newHodId) return { previousHodId, handedOver: 0 };

  let handedOver = 0;
  if (newHodId) {
    const user = await User.findById(newHodId);
    if (!user || user.status !== 'ACTIVE') throw AppError.badRequest('Choose an active user as HOD');

    const otherDept = await Department.findOne({ hodUserId: user._id, _id: { $ne: dept._id } }).select('name');
    if (otherDept) {
      throw AppError.conflict(`${user.name} is already the HOD of ${otherDept.name}. Remove them there first.`);
    }

    const [hodRoleId, staffRoleId] = await Promise.all([roleId(ROLE_CODES.HOD), roleId(ROLE_CODES.STAFF)]);
    const roles = user.roles.filter((r) => r.toString() !== staffRoleId.toString());
    if (!roles.some((r) => r.toString() === hodRoleId.toString())) roles.push(hodRoleId);
    user.roles = roles as any;
    user.departmentId = dept._id as any;
    if (!user.designation?.trim()) user.designation = `HOD - ${dept.name}`;
    await user.save();

    dept.hodUserId = user._id as any;
    await dept.save();
    handedOver = await handOverOpenIncidents(dept._id as mongoose.Types.ObjectId, user._id as mongoose.Types.ObjectId);
  } else {
    dept.hodUserId = null as any;
    await dept.save();
  }

  if (previousHodId) await stepDownFormerHod(previousHodId);
  return { previousHodId, handedOver };
};
