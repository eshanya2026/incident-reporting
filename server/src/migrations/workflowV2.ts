import mongoose from 'mongoose';

// Converts data from the previous workflow to the Staff → Quality → HOD → Quality workflow.
// Works on raw collections so documents with old enum values can be read and fixed.

const INCIDENT_STATUS_MAP: Record<string, string> = {
  DRAFT: 'SUBMITTED',
  TRIAGED: 'ASSIGNED',
  HOD_REVIEW: 'ASSIGNED',
  RCA_REQUIRED: 'UNDER_INVESTIGATION',
  EFFECTIVENESS_REVIEW: 'PENDING_QUALITY_REVIEW',
  READY_FOR_CLOSURE: 'PENDING_QUALITY_REVIEW',
  RETURNED_FOR_INFORMATION: 'INFO_REQUESTED',
  CANCELLED: 'REJECTED',
  REOPENED: 'CAPA_IN_PROGRESS',
};

const CAPA_STATUS_MAP: Record<string, string> = {
  NOT_STARTED: 'OPEN',
  IN_PROGRESS: 'OPEN',
  OVERDUE: 'OPEN',
  CANCELLED: 'OPEN',
  PENDING_VERIFICATION: 'DONE',
  VERIFIED: 'EFFECTIVE',
};

const RCA_STATUS_MAP: Record<string, string> = {
  SUBMITTED: 'COMPLETED',
  APPROVED: 'COMPLETED',
};

// Before this workflow, an incident's department was set when it was reported;
// in these statuses it has not been assigned by Quality yet.
const UNASSIGNED_STATUSES = ['SUBMITTED', 'INFO_REQUESTED', 'REJECTED'];

const remapStatuses = async (collectionName: string, map: Record<string, string>): Promise<number> => {
  const collection = mongoose.connection.collection(collectionName);
  let modified = 0;
  for (const [from, to] of Object.entries(map)) {
    const result = await collection.updateMany({ status: from }, { $set: { status: to } });
    modified += result.modifiedCount;
  }
  return modified;
};

export const migrateWorkflowV2 = async (): Promise<string> => {
  const db = mongoose.connection;
  const incidents = db.collection('incidents');
  const users = db.collection('users');

  const incidentStatuses = await remapStatuses('incidents', INCIDENT_STATUS_MAP);
  const capaStatuses = await remapStatuses('capas', CAPA_STATUS_MAP);
  const rcaStatuses = await remapStatuses('rootcauseanalyses', RCA_STATUS_MAP);
  await db.collection('rootcauseanalyses').updateMany({}, { $unset: { approvedBy: '', approvedAt: '' } });

  // Incidents created before this workflow have no occurredInDepartmentId
  const legacy = await incidents.find({ occurredInDepartmentId: { $exists: false } }).toArray();
  const reporterIds = [...new Set(legacy.map((i) => i.reportedBy?.toString()).filter(Boolean))];
  const reporters = await users
    .find({ _id: { $in: reporterIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ departmentId: 1 })
    .toArray();
  const reporterDept = new Map(reporters.map((u) => [u._id.toString(), u.departmentId ?? null]));

  const ops = legacy.map((i) => {
    const assigned = !UNASSIGNED_STATUSES.includes(i.status);
    const set: Record<string, any> = {
      occurredInDepartmentId: i.departmentId ?? null,
      reportingDepartmentId: reporterDept.get(i.reportedBy?.toString()) ?? null,
      initialSeverity: i.severity ?? 1,
      assignments:
        assigned && i.departmentId && i.assignedHod
          ? [
              {
                _id: new mongoose.Types.ObjectId(),
                departmentId: i.departmentId,
                hodUserId: i.assignedHod,
                severity: i.severity ?? 1,
                remarks: 'Assigned before the Quality assignment step existed',
                by: i.assignedHod,
                at: i.reportedAt ?? i.createdAt ?? new Date(),
              },
            ]
          : [],
      infoRequests: [],
      hodReturns: [],
      qualityReviews: [],
    };
    const unset: Record<string, ''> = { investigatorId: '' };
    if (!assigned) {
      unset.departmentId = '';
      unset.assignedHod = '';
    }
    return { updateOne: { filter: { _id: i._id }, update: { $set: set, $unset: unset } } };
  });
  if (ops.length) {
    await incidents.bulkWrite(ops);
  }

  return `incidents: ${incidentStatuses} statuses remapped, ${ops.length} converted; capas: ${capaStatuses}; rcas: ${rcaStatuses}`;
};

/** Closed incidents are not reopened (decision D9): reopened incidents go back to CAPA work. */
export const removeReopening = async (): Promise<string> => {
  const incidents = mongoose.connection.collection('incidents');
  const reopened = await incidents.updateMany({ status: 'REOPENED' }, { $set: { status: 'CAPA_IN_PROGRESS' } });
  await incidents.updateMany({ reopenings: { $exists: true } }, { $unset: { reopenings: '' } });
  return `${reopened.modifiedCount} reopened incident(s) moved to CAPA_IN_PROGRESS`;
};
