import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { pdfSafe, PAGE_W, PAGE_H, MARGIN, CONTENT_W, INK, MUTED, ACCENT, GOLD, BORDER, BAND_COLORS, drawLetterhead, DocWriter } from '../../common/pdf/docWriter.js';
import { Incident, IIncident, PRIORITY_LABELS, SEVERITY_LABELS } from './incident.model.js';
import { populateDetail } from './incident.controller.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { RcaMeeting } from '../rca/rcaMeeting.model.js';
import { Capa } from '../capa/capa.model.js';
import { Attachment, IAttachment } from '../attachments/attachment.model.js';
import { canViewIncident } from '../../common/helpers/incidentAccess.js';
import { canSeeReporterOf, REPORTER_CONFIDENTIAL_LABEL } from '../../common/helpers/reporterPrivacy.js';
import { AppError } from '../../common/errors/appError.js';
import { env } from '../../config/env.js';
import { User } from '../users/user.model.js';
import { logActivity } from '../audit/audit.service.js';

// ---------- Formatting helpers ----------

const fmtDateTime = (d?: Date | string | null): string =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const personName = (u: any): string => (u ? `${u.name || 'Unknown'}${u.designation ? ` (${u.designation})` : ''}` : '—');
const humanize = (code?: string): string => (code ? code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

const uploadDir = (): string => path.resolve(process.cwd(), env.FILE_STORAGE_PATH);

// ---------- Report assembly ----------

interface ReportData {
  incident: any;
  investigations: any[];
  rca: any;
  rcaMeeting: any;
  capas: any[];
  attachmentMap: Map<string, IAttachment>;
  generatedBy: string;
  /** Reporter confidentiality: false prints the reporter as "Confidential". */
  showReporter: boolean;
}

/** Everything attached anywhere on this incident, tagged with where it came from. */
const collectAttachmentRefs = (data: ReportData): Array<{ attachment: IAttachment; source: string }> => {
  const refs: Array<{ attachment: IAttachment; source: string }> = [];
  const push = (ids: any[] | undefined, source: string) => {
    (ids || []).forEach((id) => {
      const a = data.attachmentMap.get(String(id._id || id));
      if (a) refs.push({ attachment: a, source });
    });
  };
  push(data.incident.attachments, 'Incident report');
  data.investigations.forEach((inv) => push(inv.evidence, `Investigation – ${inv.departmentId?.name || 'Department'}`));
  data.capas.forEach((c) => push(c.evidence, `CAPA ${c.capaNumber} – ${humanize(c.type)}`));
  if (data.rcaMeeting) push(data.rcaMeeting.evidence, 'RCA meeting report');
  return refs;
};

const buildIncidentReportPdf = async (data: ReportData): Promise<Uint8Array> => {
  const { incident, investigations, rca, rcaMeeting, capas, showReporter } = data;
  const w = await DocWriter.create();

  // ---- Cover / letterhead ----
  drawLetterhead(w, 'INCIDENT REPORTING', 'PATIENT SAFETY');

  w.titleBand('Incident Final Report', 'Closed incident record, including investigation, CAPA and RCA history.', `Generated ${fmtDateTime(new Date())}`);

  // Incident number + title, with status/risk chips right-aligned on the same line.
  w.ensureSpace(24);
  const headerY = w.y;
  w.text(incident.incidentNumber, MARGIN, 15, w.bold, INK);
  const band = incident.riskAssessment?.band as string | undefined;
  const chips: Array<[string, keyof typeof BAND_COLORS]> = band ? [[`${band} RISK`, band], ['CLOSED', 'CLOSED']] : [['CLOSED', 'CLOSED']];
  const chipWidths = chips.map(([label]) => w.bold.widthOfTextAtSize(pdfSafe(label), 9) + 16);
  const totalChipsW = chipWidths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 8;
  let chipX = MARGIN + CONTENT_W - totalChipsW;
  w.y = headerY;
  chips.forEach(([label, key], i) => {
    const used = w.chipAt(chipX, label, key);
    chipX += used + 8;
  });
  w.y = headerY - 20;
  w.paragraph(incident.title, { size: 12.5 });
  w.spacer(8);

  w.infoGrid(
    [
      ['Severity', `${incident.severity} – ${SEVERITY_LABELS[incident.severity] || ''}`],
      ['Priority', incident.priority ? PRIORITY_LABELS[incident.priority as keyof typeof PRIORITY_LABELS] : '—'],
      ['Category', incident.categoryId?.name || '—'],
      ['Responsible Dept.', incident.departmentId?.name || '—'],
      ['Occurred', fmtDateTime(incident.incidentDateTime)],
      ['Closed', fmtDateTime(incident.closedAt)],
      ['Closed By', incident.closedBy?.name || '—'],
      ['Risk Score', incident.riskAssessment ? `${incident.riskAssessment.score} / 25` : '—'],
    ],
    4
  );
  w.spacer(6);
  w.divider();

  w.h2('Incident Details');
  w.fieldRow(['Reported by', showReporter ? personName(incident.reportedBy) : REPORTER_CONFIDENTIAL_LABEL], ['Reported at', fmtDateTime(incident.reportedAt)]);
  w.fieldRow(['Occurred in', incident.occurredInDepartmentId?.name || '—'], ['Subcategory', incident.subcategoryCode ? humanize(incident.subcategoryCode) : '—']);
  w.fieldRow(['Location', incident.locationId?.name || '—'], ['Floor / Zone', [incident.floor, incident.zone].filter(Boolean).join(' – ') || '—']);
  if (incident.specificLocation) w.field('Specific spot', incident.specificLocation);
  w.field('Affected person', humanize(incident.affectedPersonType));
  if (incident.patient?.name || incident.patient?.uhid) {
    w.field('Patient', [incident.patient?.name, incident.patient?.uhid ? `UHID ${incident.patient.uhid}` : undefined, incident.patient?.ward].filter(Boolean).join(', '));
  }
  if (incident.affectedPersonDetail?.name) {
    w.field('Affected person detail', [incident.affectedPersonDetail.name, incident.affectedPersonDetail.relationship, incident.affectedPersonDetail.contactNumber].filter(Boolean).join(', '));
  }
  w.spacer(6);
  w.h3('Description');
  w.paragraph(incident.description);
  if (incident.witness) { w.spacer(4); w.h3('Witness'); w.paragraph(incident.witness); }
  if (incident.immediateAction) { w.spacer(4); w.h3('Immediate action taken'); w.paragraph(incident.immediateAction); }
  if (incident.remarks) { w.spacer(4); w.h3('Reporter remarks'); w.paragraph(incident.remarks); }

  // ---- Assignment ----
  w.spacer(10);
  w.h2('Assignment');
  w.fieldRow(['Assigned HOD', personName(incident.assignedHod)], ['Assigned by', personName(incident.assignedBy)]);
  w.fieldRow(['Assigned at', fmtDateTime(incident.assignedAt)], ['Also involves', (incident.notifiedDepartmentIds || []).map((d: any) => d.name).join(', ') || 'No other department']);
  if (incident.hodReturns?.length) {
    w.spacer(4);
    w.h3('Returned to Quality (wrong department)');
    incident.hodReturns.forEach((r: any) => w.bullet(`${personName(r.by)}, ${fmtDateTime(r.at)}: ${r.reason}`));
  }

  // ---- Investigation(s) ----
  w.spacer(10);
  w.h2(investigations.length > 1 ? 'Investigations' : 'Investigation');
  if (!investigations.length) {
    w.paragraph('No investigation record on file.', { color: MUTED });
  }
  investigations.forEach((inv) => {
    w.h3(inv.departmentId?.name || 'Department');
    w.fieldRow(['Investigator', personName(inv.investigatorId)], ['Completed', fmtDateTime(inv.completedAt)]);
    if (inv.contributingFactors?.length) w.field('Contributing factors', inv.contributingFactors.map(humanize).join(', '));
    w.field('Facts', inv.facts || '—');
    w.field('Chronology', inv.chronology || '—');
    if (inv.peopleInterviewed?.length) {
      w.spacer(2);
      w.text('People interviewed', MARGIN, 10, w.bold, MUTED);
      w.y -= 14;
      inv.peopleInterviewed.forEach((p: any) => w.bullet(`${p.name} (${p.designation})${p.statement ? `: ${p.statement}` : ''}`));
    }
    if (inv.immediateCorrections) w.field('Immediate corrections', inv.immediateCorrections);
    w.field('Findings', inv.findings || '—');
    if (inv.recommendation) w.field('Recommendation', inv.recommendation);
    w.spacer(6);
  });

  // ---- 5-Why / Fishbone RCA ----
  if (rca) {
    w.spacer(4);
    w.h2('Root Cause Analysis (Investigation Stage)');
    w.fieldRow(['Method', humanize(rca.method)], ['Status', humanize(rca.status)]);
    w.field('Root cause summary', rca.rootCauseSummary);
    if (rca.fiveWhy?.length) {
      w.spacer(2);
      w.table(['#', 'Why', 'Answer'], rca.fiveWhy.map((fw: any) => [String(fw.sequence), fw.question, fw.answer]), [30, 180, CONTENT_W - 210]);
    }
    const fb = rca.fishbone || {};
    const fbEntries = Object.entries(fb).filter(([, v]: any) => Array.isArray(v) && v.length);
    if (fbEntries.length) {
      w.spacer(6);
      w.text('Fishbone factors', MARGIN, 10, w.bold, MUTED);
      w.y -= 14;
      fbEntries.forEach(([k, v]: any) => w.bullet(`${humanize(k)}: ${v.join(', ')}`));
    }
  }

  // ---- CAPA ----
  w.spacer(10);
  w.h2('Corrective & Preventive Actions (CAPA)');
  if (!capas.length) {
    w.paragraph('No CAPA actions on file.', { color: MUTED });
  } else {
    w.table(
      ['CAPA #', 'Type', 'Department', 'Action', 'Status', 'Completion'],
      capas.map((c) => [
        c.capaNumber,
        humanize(c.type),
        c.ownerDepartmentId?.name || '—',
        c.action,
        humanize(c.status),
        c.completedAt ? `${fmtDateTime(c.completedAt)}${c.completionRemarks ? ` – ${c.completionRemarks}` : ''}` : '—',
      ]),
      [90, 74, 76, CONTENT_W - 90 - 74 - 76 - 68 - 84, 68, 84]
    );
  }

  // ---- RCA meeting (review stage) ----
  if (rcaMeeting) {
    w.spacer(10);
    w.h2('RCA Meeting');
    w.fieldRow(['Requested by', personName(incident.rcaRequestedBy)], ['Requested at', fmtDateTime(incident.rcaRequestedAt)]);
    if (incident.rcaRequestRemarks) w.field('Reason for RCA', incident.rcaRequestRemarks);
    w.fieldRow(['Meeting date/time', fmtDateTime(rcaMeeting.meetingAt)], ['Location', rcaMeeting.location]);
    w.field('Attendees', (rcaMeeting.attendeeIds || []).map(personName).join(', ') || '—');
    w.fieldRow(['Report uploaded by', personName(rcaMeeting.reportUploadedBy)], ['Report uploaded at', fmtDateTime(rcaMeeting.reportUploadedAt)]);
    if (rcaMeeting.reportSummary) w.field('Meeting summary', rcaMeeting.reportSummary);
  }

  // ---- Quality review history ----
  w.spacer(10);
  w.h2('Quality Review History');
  if (!incident.qualityReviews?.length) {
    w.paragraph('No review entries on file.', { color: MUTED });
  } else {
    incident.qualityReviews.forEach((r: any) => {
      w.bullet(`${r.decision} – ${personName(r.by)}, ${fmtDateTime(r.at)}: ${r.remarks}`);
    });
  }

  // ---- Risk assessment ----
  if (incident.riskAssessment) {
    w.spacer(10);
    w.h2('Risk Assessment');
    const ra = incident.riskAssessment;
    w.fieldRow(['Likelihood', String(ra.likelihood)], ['Severity', String(ra.severity)]);
    w.fieldRow(['Risk score', `${ra.score} / 25`], ['Risk band', ra.band]);
    if (ra.rationale) w.field('Rationale', ra.rationale);
    w.fieldRow(['Assessed by', personName(ra.assessedBy)], ['Assessed at', fmtDateTime(ra.assessedAt)]);
  }

  // ---- Closure ----
  w.spacer(10);
  w.h2('Closure');
  w.fieldRow(['Closed by', personName(incident.closedBy)], ['Closed at', fmtDateTime(incident.closedAt)]);
  if (incident.closureRemarks) w.field('Closure remarks', incident.closureRemarks);
  if (incident.closureSubmission) {
    w.fieldRow(['Submitted for review by', personName(incident.closureSubmission.by)], ['Submitted at', fmtDateTime(incident.closureSubmission.at)]);
    if (incident.closureSubmission.summary) w.field('Closure summary (HOD)', incident.closureSubmission.summary);
  }

  // ---- Appendix: attachments ----
  const refs = collectAttachmentRefs(data);
  w.spacer(14);
  w.h2('Appendix A – Attached Files');
  if (!refs.length) {
    w.paragraph('No files were attached to this incident.', { color: MUTED });
  } else {
    const mergeable = (m: string) => m === 'application/pdf' || m === 'image/png' || m === 'image/jpeg' || m === 'image/jpg';
    w.table(
      ['#', 'File', 'Source', 'Included'],
      refs.map((r, i) => [
        String(i + 1),
        r.attachment.originalName,
        r.source,
        mergeable(r.attachment.mimeType) ? 'Merged below' : 'Not merged – see original file in the system',
      ]),
      [24, 180, 150, CONTENT_W - 24 - 180 - 150]
    );

    for (let i = 0; i < refs.length; i++) {
      const { attachment, source } = refs[i];
      if (!mergeable(attachment.mimeType)) continue;
      const filePath = path.join(uploadDir(), path.basename(attachment.storedName));
      try {
        const bytes = await fs.readFile(filePath);
        w.addPage();
        w.text(`Attachment ${i + 1}: ${attachment.originalName}`, MARGIN, 11, w.bold, ACCENT);
        w.y -= 16;
        w.text(source, MARGIN, 9.5, w.regular, MUTED);
        w.y -= 18;
        w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: MARGIN + CONTENT_W, y: w.y }, thickness: 0.75, color: BORDER });
        w.y -= 14;

        if (attachment.mimeType === 'application/pdf') {
          // Each loop iteration starts with its own addPage() (above), so nothing more needs
          // drawing here — leaving `w.page`/`w.y` stale after this is fine.
          const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const copied = await w.doc.copyPages(srcDoc, srcDoc.getPageIndices());
          copied.forEach((p) => w.doc.addPage(p));
        } else {
          const image = attachment.mimeType === 'image/png' ? await w.doc.embedPng(bytes) : await w.doc.embedJpg(bytes);
          const maxW = CONTENT_W;
          const maxH = w.y - MARGIN;
          const scale = Math.min(maxW / image.width, maxH / image.height, 1);
          const iw = image.width * scale;
          const ih = image.height * scale;
          w.page.drawImage(image, { x: MARGIN + (maxW - iw) / 2, y: w.y - ih, width: iw, height: ih });
          w.y -= ih + 10;
        }
      } catch {
        w.paragraph(`(This file could not be read from storage and is not included here. Original name: ${attachment.originalName})`, { color: MUTED });
      }
    }
  }

  // ---- Footer: page numbers + generated-by line on every page ----
  const pages = w.doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(pdfSafe(`Generated by ${data.generatedBy} on ${fmtDateTime(new Date())}`), { x: MARGIN, y: 24, size: 7.5, font: w.regular, color: MUTED });
    p.drawText(pdfSafe(`${incident.incidentNumber} · Page ${i + 1} of ${pages.length}`), { x: PAGE_W - MARGIN - 130, y: 24, size: 7.5, font: w.regular, color: MUTED });
  });

  return w.doc.save();
};

// ---------- Express handler ----------

export const downloadIncidentReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const incident: IIncident | null = await populateDetail(Incident.findById(id));
    if (!incident) throw AppError.notFound('Incident record not found');
    if (!canViewIncident(req.user, incident)) throw AppError.forbidden('You do not have access to this incident');
    if (incident.status !== 'CLOSED') {
      throw AppError.conflict('The final report is only available once the incident is closed');
    }

    const [investigations, rca, rcaMeeting, capas, generatedByUser] = await Promise.all([
      Investigation.find({ incidentId: id })
        .populate('departmentId', 'name code')
        .populate('investigatorId', 'name designation')
        .sort({ createdAt: 1 }),
      RootCauseAnalysis.findOne({ incidentId: id }),
      RcaMeeting.findOne({ incidentId: id })
        .populate('scheduledBy', 'name designation')
        .populate('reportUploadedBy', 'name designation')
        .populate('attendeeIds', 'name designation'),
      Capa.find({ incidentId: id })
        .populate('ownerUserId', 'name designation')
        .populate('ownerDepartmentId', 'name code')
        .sort({ createdAt: 1 }),
      User.findById(req.user!.userId).select('name designation'),
    ]);

    const attachmentIds = new Set<string>();
    ((incident as any).attachments || []).forEach((a: any) => attachmentIds.add(String(a._id || a)));
    investigations.forEach((inv) => (inv.evidence || []).forEach((eid) => attachmentIds.add(String(eid))));
    capas.forEach((c) => (c.evidence || []).forEach((eid) => attachmentIds.add(String(eid))));
    if (rcaMeeting) (rcaMeeting.evidence || []).forEach((eid) => attachmentIds.add(String(eid)));

    const attachments = await Attachment.find({ _id: { $in: [...attachmentIds] } });
    const attachmentMap = new Map(attachments.map((a) => [String(a._id), a]));

    const pdfBytes = await buildIncidentReportPdf({
      incident: (incident as any).toObject ? (incident as any).toObject() : incident,
      investigations: investigations.map((i) => (i as any).toObject()),
      rca: rca ? (rca as any).toObject() : null,
      rcaMeeting: rcaMeeting ? (rcaMeeting as any).toObject() : null,
      capas: capas.map((c) => (c as any).toObject()),
      attachmentMap,
      generatedBy: generatedByUser ? personName(generatedByUser) : req.user!.username,
      showReporter: canSeeReporterOf(req.user, incident),
    });

    await logActivity('INCIDENT_REPORT_PDF_DOWNLOADED', `Downloaded the final report PDF of ${(incident as any).incidentNumber}`, {
      req, entityType: 'INCIDENT', entityId: String((incident as any)._id), meta: { incidentNumber: (incident as any).incidentNumber, pdf: true, format: 'PDF' },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${(incident as any).incidentNumber}-final-report.pdf"`);
    res.setHeader('Content-Length', String(pdfBytes.byteLength));
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    next(error);
  }
};
