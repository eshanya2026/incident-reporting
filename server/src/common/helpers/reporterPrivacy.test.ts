import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { redactReporter } from './reporterPrivacy.js';
import { PERMISSIONS } from '../enums/permissions.js';

const reporterId = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
const at = new Date('2026-10-10T10:00:00Z');

const incident = () => ({
  _id: new mongoose.Types.ObjectId(),
  title: 'Fall',
  reportedBy: { _id: reporterId, name: 'Zebulon Quillfeather', employeeId: 'ZQ-1' },
  infoRequests: [{ question: 'Which bed?', askedBy: { _id: otherId, name: 'Quality' }, response: 'Bed 4', respondedBy: reporterId, respondedAt: at }],
  intimatedUserIds: [{ _id: otherId, name: 'Other' }, { _id: reporterId, name: 'Zebulon Quillfeather' }],
  assignments: [{ hodUserId: otherId, at }],
});

const hod: any = { userId: String(otherId), roles: ['HOD'], permissions: [PERMISSIONS.INCIDENT_READ_ASSIGNED] };
const quality: any = { userId: String(new mongoose.Types.ObjectId()), roles: ['QUALITY'], permissions: [PERMISSIONS.INCIDENT_REPORTER_VIEW] };

describe('redactReporter', () => {
  it('removes every reference to the reporter for someone who may not see it', () => {
    const out: any = redactReporter(incident(), hod);
    const text = JSON.stringify(out);
    expect(text).not.toContain(String(reporterId));
    expect(text).not.toContain('Zebulon');
    expect(out.reportedBy).toBeNull();
    expect(out.reporterHidden).toBe(true);
    expect(out.infoRequests[0].respondedBy).toBeNull();
    expect(out.infoRequests[0].response).toBe('Bed 4');
    // dropped from lists rather than left as a null entry
    expect(out.intimatedUserIds).toHaveLength(1);
    expect(out.intimatedUserIds[0].name).toBe('Other');
    // everything else is untouched
    expect(out.infoRequests[0].respondedAt).toBe(at);
    expect(String(out.assignments[0].hodUserId)).toBe(String(otherId));
  });

  it('leaves the incident as it is for Quality and for the reporter themselves', () => {
    const forQuality: any = redactReporter(incident(), quality);
    expect(forQuality.reportedBy.name).toBe('Zebulon Quillfeather');
    const self: any = { userId: String(reporterId), roles: ['STAFF'], permissions: [] };
    expect((redactReporter(incident(), self) as any).reportedBy.name).toBe('Zebulon Quillfeather');
  });
});
