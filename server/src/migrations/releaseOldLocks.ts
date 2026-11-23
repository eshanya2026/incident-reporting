import { User } from '../modules/users/user.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';

/**
 * Wrong-password locks used to be permanent (status LOCKED until an administrator unlocked the
 * account); they now last 15 minutes. Releases accounts whose lock came from wrong passwords, long
 * since expired under the new rule. An account an administrator set to LOCKED is left locked: the
 * audit log says which, and when it does not show the automatic lock as the latest, nothing changes.
 */
export const releaseOldWrongPasswordLocks = async (): Promise<string> => {
  const locked = await User.find({ status: 'LOCKED' }).select('_id').lean();
  let released = 0;
  for (const u of locked) {
    const [autoLock, adminLock] = await Promise.all([
      AuditLog.findOne({ action: 'ACCOUNT_LOCKED', userId: u._id }).sort({ timestamp: -1 }).select('timestamp').lean(),
      AuditLog.findOne({ action: { $in: ['USER_UPDATED', 'USER_DEACTIVATED'] }, entityId: u._id, 'newValue.status': 'LOCKED' })
        .sort({ timestamp: -1 })
        .select('timestamp')
        .lean(),
    ]);
    if (!autoLock) continue;
    if (adminLock && adminLock.timestamp >= autoLock.timestamp) continue;
    await User.updateOne({ _id: u._id, status: 'LOCKED' }, { $set: { status: 'ACTIVE', failedLoginAttempts: 0 }, $unset: { lockUntil: '' } });
    released += 1;
  }
  return `${released} of ${locked.length} locked account(s) released (locked by wrong passwords, not by an administrator)`;
};
