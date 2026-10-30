import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { RcaMeeting } from './rcaMeeting.model.js';
import { Department } from '../departments/department.model.js';
import { User } from '../users/user.model.js';
import { IncidentWorkflowService } from '../incidents/incidentWorkflow.service.js';
import { IIncident } from '../incidents/incident.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { loadIncidentForView, loadIncidentForWork } from '../../common/helpers/incidentAccess.js';
import { assertAttachmentsUsable, linkAttachments } from '../attachments/attachmentAccess.js';

/**
 * Lead + involved departments' HODs, the Quality user who requested the RCA, the scheduler, and
 * any extra HODs/Intimation Members Quality asked to invite when requesting the RCA.
 */
export const computeDefaultAttendees = async (incident: IIncident): Promise<mongoose.Types.ObjectId[]> => {
  const deptIds = [incident.departmentId, ...(incident.notifiedDepartmentIds || [])].filter(Boolean);
  const depts = deptIds.length ? await Department.find({ _id: { $in: deptIds } }).select('hodUserId') : [];
  const ids = [
    ...depts.map((d) => d.hodUserId),
    incident.rcaRequestedBy,
    incident.rcaHeadId,
    ...(incident.rcaAdditionalAttendeeIds || []),
  ].filter(Boolean) as mongoose.Types.ObjectId[];
  return [...new Map(ids.map((id) => [id.toString(), id])).values()];
};

/** Preview of who will be auto-invited, shown before scheduling. */
export const getRcaMeetingAttendeesPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const incident = await loadIncidentForView(req, incidentId as string);
    const attendeeIds = await computeDefaultAttendees(incident);
    const attendees = await User.find({ _id: { $in: attendeeIds } }).select('name designation');
    sendSuccess(res, attendees, 'Default attendees computed');
  } catch (error) {
    next(error);
  }
};

export const getRcaMeetingByIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    await loadIncidentForView(req, incidentId as string);
    const meeting = await RcaMeeting.findOne({ incidentId })
      .populate('scheduledBy', 'name designation')
      .populate('attendeeIds', 'name designation')
      .populate('reportUploadedBy', 'name designation')
      .populate('evidence');
    if (!meeting) {
      throw AppError.notFound('No RCA meeting scheduled for this incident yet');
    }
    sendSuccess(res, meeting, 'RCA meeting retrieved');
  } catch (error) {
    next(error);
  }
};

const uploadReportSchema = z.object({
  summary: z.string().trim().max(5000).optional(),
  evidence: z.array(z.string()).min(1, 'Attach the RCA meeting report'),
});

/**
 * Quality uploads the meeting's report (handed to them by the RCA Head outside the system) and
 * moves the incident back to its own review queue (RCA_REQUESTED → PENDING_QUALITY_REVIEW), where
 * the normal Satisfied/Return decision closes it.
 */
export const uploadRcaReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const data = uploadReportSchema.parse(req.body);
    const incident = await loadIncidentForWork(req, incidentId as string);

    const meeting = await RcaMeeting.findOne({ incidentId: incident._id });
    if (!meeting) {
      throw AppError.conflict('Schedule the RCA meeting before uploading its report');
    }

    const evidenceIds = await assertAttachmentsUsable(data.evidence, req.user!.userId, 'RCA', meeting._id);

    meeting.status = 'COMPLETED';
    meeting.reportSummary = data.summary;
    meeting.reportUploadedAt = new Date();
    meeting.reportUploadedBy = new mongoose.Types.ObjectId(req.user!.userId);
    meeting.evidence = evidenceIds.map((id) => new mongoose.Types.ObjectId(id));
    await meeting.save();
    await linkAttachments(evidenceIds, 'RCA', meeting._id);

    await IncidentWorkflowService.perform({
      incidentId: incident._id.toString(),
      action: 'SUBMIT_RCA',
      user: req.user!,
      input: { text: data.summary },
      req,
    });

    const populated = await RcaMeeting.findById(meeting._id)
      .populate('scheduledBy', 'name designation')
      .populate('attendeeIds', 'name designation')
      .populate('reportUploadedBy', 'name designation')
      .populate('evidence');
    sendSuccess(res, populated, 'RCA meeting report uploaded and sent to Quality');
  } catch (error) {
    next(error);
  }
};
