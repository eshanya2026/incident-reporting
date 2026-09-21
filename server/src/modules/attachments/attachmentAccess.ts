import mongoose from 'mongoose';
import { Attachment, EntityType, IAttachment } from './attachment.model.js';
import { Incident } from '../incidents/incident.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { Capa } from '../capa/capa.model.js';
import { AppError } from '../../common/errors/appError.js';
import { canViewIncident, hasPermission } from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';
import { JwtPayload } from '../auth/auth.utils.js';

// Files are uploaded first (unlinked) and linked to a record when that record is saved.
// Who may read a file: its uploader, or anyone who may see the record it belongs to.
// Investigation, RCA and CAPA files also need the matching read permission (Staff do not see those, D6).

const READ_PERMISSION: Record<EntityType, string | null> = {
  INCIDENT: null,
  INVESTIGATION: PERMISSIONS.INVESTIGATION_READ,
  RCA: PERMISSIONS.RCA_READ,
  CAPA: PERMISSIONS.CAPA_READ,
};

/** Finds the incident a linked record belongs to. */
const incidentIdFor = async (entityType: EntityType, entityId: mongoose.Types.ObjectId): Promise<unknown> => {
  switch (entityType) {
    case 'INCIDENT':
      return entityId;
    case 'INVESTIGATION':
      return (await Investigation.findById(entityId).select('incidentId'))?.incidentId;
    case 'RCA':
      return (await RootCauseAnalysis.findById(entityId).select('incidentId'))?.incidentId;
    case 'CAPA':
      return (await Capa.findById(entityId).select('incidentId'))?.incidentId;
  }
};

export const canReadAttachment = async (user: JwtPayload | undefined, attachment: IAttachment): Promise<boolean> => {
  if (!user) return false;
  if (attachment.uploadedBy.toString() === user.userId) return true;
  if (!attachment.entityId) return false;

  const permission = READ_PERMISSION[attachment.entityType];
  if (permission && !hasPermission(user, permission)) return false;

  const incidentId = await incidentIdFor(attachment.entityType, attachment.entityId);
  const incident = incidentId ? await Incident.findById(incidentId) : null;
  return Boolean(incident && canViewIncident(user, incident));
};

/**
 * Checks that every file was uploaded by the user and is not linked to another record.
 * Call before saving the record so a bad reference changes nothing.
 */
export const assertAttachmentsUsable = async (
  attachmentIds: string[] | undefined,
  userId: string,
  entityType: EntityType,
  entityId?: mongoose.Types.ObjectId | string
): Promise<string[]> => {
  const ids = [...new Set(attachmentIds ?? [])];
  if (!ids.length) return ids;
  if (!ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw AppError.badRequest('Invalid attachment reference');
  }

  const sameRecord = entityId ? [{ entityType, entityId }] : [];
  const usable = await Attachment.countDocuments({
    _id: { $in: ids },
    uploadedBy: userId,
    $or: [{ entityId: null }, { entityId: { $exists: false } }, ...sameRecord],
  });
  if (usable !== ids.length) {
    throw AppError.badRequest('One or more attachments were not uploaded by you or already belong to another record');
  }
  return ids;
};

/** Links uploaded files to the record they belong to (after assertAttachmentsUsable). */
export const linkAttachments = async (
  attachmentIds: string[] | undefined,
  entityType: EntityType,
  entityId: mongoose.Types.ObjectId | string
): Promise<void> => {
  if (!attachmentIds?.length) return;
  await Attachment.updateMany({ _id: { $in: attachmentIds } }, { $set: { entityType, entityId } });
};
