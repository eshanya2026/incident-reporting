import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from 'pdf-lib';
import { Incident, IIncident, PRIORITY_LABELS, SEVERITY_LABELS } from './incident.model.js';
import { populateDetail } from './incident.controller.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { RcaMeeting } from '../rca/rcaMeeting.model.js';
import { Capa } from '../capa/capa.model.js';
import { Attachment, IAttachment } from '../attachments/attachment.model.js';
import { canViewIncident } from '../../common/helpers/incidentAccess.js';
import { AppError } from '../../common/errors/appError.js';
import { env } from '../../config/env.js';
import { User } from '../users/user.model.js';

// ---------- Text safety ----------

// pdf-lib's standard fonts only encode WinAnsi (Windows-1252) — anything outside it (an arrow typed
// in a chronology note, an emoji, a non-Latin script) throws and takes the whole report down with
// it. Common punctuation Word/browsers "smart-quote" in is kept as-is (WinAnsi supports it);
// anything else outside that range gets a plain-ASCII stand-in, or is dropped if there is none.
const PDF_SAFE_REPLACEMENTS: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '–': '–',
  '—': '—',
  '‘': '‘',
  '’': '’',
  '“': '“',
  '”': '”',
  '…': '…',
  '•': '•',
  '−': '-',
  '×': 'x',
  '✔': 'v',
  '✓': 'v',
  '✘': 'x',
  '✗': 'x',
  '﻿': '',
};
// The WinAnsi-only punctuation block (bytes 0x80-0x9F of Windows-1252) that isn't already ASCII.
const WINANSI_EXTRA = new Set(
  ['€', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', 'Ž', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', 'ž', 'Ÿ']
);
const isWinAnsiSafe = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  if (code === 9 || code === 10 || code === 13) return true; // tab/newline, handled by wrapping
  if (code >= 32 && code <= 126) return true; // ASCII
  if (code >= 160 && code <= 255) return true; // Latin-1 supplement, same bytes in Windows-1252
  return WINANSI_EXTRA.has(ch);
};
const pdfSafe = (input: unknown): string => {
  const str = String(input ?? '');
  let out = '';
  for (const ch of str) {
    if (ch === '\n' || ch === '\r' || ch === '\t') { out += ' '; continue; }
    if (PDF_SAFE_REPLACEMENTS[ch] !== undefined) { out += PDF_SAFE_REPLACEMENTS[ch]; continue; }
    out += isWinAnsiSafe(ch) ? ch : '';
  }
  return out.replace(/ {2,}/g, ' ').trim();
};

// ---------- Small, hand-rolled PDF layout helper (pdf-lib has no layout engine of its own) ----------

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.14, 0.12, 0.11);
const MUTED = rgb(0.44, 0.4, 0.36);
const ACCENT = rgb(0.42, 0.12, 0.16); // matches the app's maroon brand accent
const ACCENT_DARK = rgb(0.26, 0.07, 0.1); // darkest stop of the app's own button/hero gradient
const GOLD = rgb(0.831, 0.663, 0.329); // the app's gold accent (incident numbers on dark banners)
const BORDER = rgb(0.86, 0.79, 0.68);
const SOFT = rgb(0.98, 0.96, 0.93);
const WHITE = rgb(1, 1, 1);
const WHITE_MUTED = rgb(0.86, 0.82, 0.78);

// Mirrors client/src/lib/incidentMeta.ts RISK_BAND_META, so a risk band reads the same color in
// the app and in the report.
const BAND_COLORS: Record<string, { fg: RGB; bg: RGB; border: RGB }> = {
  LOW: { fg: rgb(0.02, 0.47, 0.34), bg: rgb(0.93, 0.99, 0.96), border: rgb(0.65, 0.95, 0.82) },
  MODERATE: { fg: rgb(0.57, 0.25, 0.05), bg: rgb(1, 0.98, 0.92), border: rgb(0.99, 0.83, 0.33) },
  HIGH: { fg: rgb(0.73, 0.11, 0.11), bg: rgb(0.996, 0.95, 0.95), border: rgb(0.99, 0.79, 0.79) },
  EXTREME: { fg: rgb(1, 1, 1), bg: rgb(0.42, 0.08, 0.09), border: rgb(0.29, 0.05, 0.06) },
  CLOSED: { fg: rgb(0.02, 0.47, 0.34), bg: rgb(0.93, 0.99, 0.96), border: rgb(0.65, 0.95, 0.82) },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpColor = (c1: RGB, c2: RGB, t: number): RGB => rgb(lerp(c1.red, c2.red, t), lerp(c1.green, c2.green, t), lerp(c1.blue, c2.blue, t));

/** A left-to-right gradient, approximated with thin strips (pdf-lib has no gradient fill primitive). */
const gradientBar = (page: PDFPage, x: number, y: number, w: number, h: number, c1: RGB, c2: RGB): void => {
  const steps = 60;
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    page.drawRectangle({ x: x + i * stepW, y, width: stepW + 0.5, height: h, color: lerpColor(c1, c2, i / (steps - 1)) });
  }
};

/** A simple vector mark (not the hospital's real crest, which this app has no artwork for). */
const drawMark = (page: PDFPage, cx: number, cy: number, r: number): void => {
  page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, color: ACCENT });
  const barW = r * 0.42;
  const barLen = r * 1.15;
  page.drawRectangle({ x: cx - barW / 2, y: cy - barLen / 2, width: barW, height: barLen, color: WHITE });
  page.drawRectangle({ x: cx - barLen / 2, y: cy - barW / 2, width: barLen, height: barW, color: WHITE });
};

class DocWriter {
  doc!: PDFDocument;
  regular!: PDFFont;
  bold!: PDFFont;
  mono!: PDFFont;
  page!: PDFPage;
  y = PAGE_H - MARGIN;

  static async create(): Promise<DocWriter> {
    const w = new DocWriter();
    w.doc = await PDFDocument.create();
    w.regular = await w.doc.embedFont(StandardFonts.Helvetica);
    w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    w.mono = await w.doc.embedFont(StandardFonts.Courier);
    w.addPage();
    return w;
  }

  addPage(): void {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.page.drawRectangle({
      x: 18, y: 18, width: PAGE_W - 36, height: PAGE_H - 36,
      borderColor: BORDER, borderWidth: 1, color: undefined,
    });
    this.y = PAGE_H - MARGIN;
  }

  ensureSpace(h: number): void {
    if (this.y - h < MARGIN) this.addPage();
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = pdfSafe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  text(str: string, x: number, size: number, font: PDFFont, color: RGB = INK): void {
    this.page.drawText(pdfSafe(str), { x, y: this.y, size, font, color });
  }

  spacer(h: number): void {
    this.ensureSpace(h);
    this.y -= h;
  }

  divider(): void {
    this.ensureSpace(14);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + CONTENT_W, y: this.y }, thickness: 0.75, color: BORDER });
    this.y -= 14;
  }

  h1(title: string): void {
    this.ensureSpace(34);
    this.text(title, MARGIN, 20, this.bold, ACCENT);
    this.y -= 26;
  }

  h2(title: string): void {
    this.ensureSpace(30);
    this.y -= 6;
    this.text(title.toUpperCase(), MARGIN, 12.5, this.bold, ACCENT);
    this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + CONTENT_W, y: this.y }, thickness: 1.2, color: ACCENT });
    this.y -= 16;
  }

  h3(title: string): void {
    this.ensureSpace(22);
    this.text(title, MARGIN, 11.5, this.bold, INK);
    this.y -= 18;
  }

  /** Label/value pair. Value wraps; label stays in a fixed-width left column. */
  field(label: string, value: string, opts: { labelWidth?: number } = {}): void {
    const labelWidth = opts.labelWidth ?? 150;
    const valueX = MARGIN + labelWidth;
    const valueWidth = CONTENT_W - labelWidth;
    const lines = this.wrap(value || '—', this.regular, 10, valueWidth);
    this.ensureSpace(lines.length * 13 + 4);
    const startY = this.y;
    this.text(label, MARGIN, 10, this.bold, MUTED);
    let ly = startY;
    for (const line of lines) {
      this.page.drawText(line, { x: valueX, y: ly, size: 10, font: this.regular, color: INK });
      ly -= 13;
    }
    this.y = ly - 3;
  }

  /** Two fields side by side, each taking half the content width. */
  fieldRow(a: [string, string], b: [string, string]): void {
    const half = CONTENT_W / 2;
    const linesA = this.wrap(a[1] || '—', this.regular, 10, half - 110);
    const linesB = this.wrap(b[1] || '—', this.regular, 10, half - 110);
    const rows = Math.max(linesA.length, linesB.length);
    this.ensureSpace(rows * 13 + 4);
    const startY = this.y;
    this.text(a[0], MARGIN, 10, this.bold, MUTED);
    this.text(b[0], MARGIN + half, 10, this.bold, MUTED);
    for (let i = 0; i < rows; i++) {
      if (linesA[i]) this.page.drawText(linesA[i], { x: MARGIN + 110, y: startY - i * 13, size: 10, font: this.regular, color: INK });
      if (linesB[i]) this.page.drawText(linesB[i], { x: MARGIN + half + 110, y: startY - i * 13, size: 10, font: this.regular, color: INK });
    }
    this.y = startY - rows * 13 - 3;
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; indent?: number } = {}): void {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    const lines = this.wrap(text || '—', this.regular, size, CONTENT_W - indent);
    for (const line of lines) {
      this.ensureSpace(size + 3);
      this.text(line, MARGIN + indent, size, this.regular, opts.color ?? INK);
      this.y -= size + 3;
    }
  }

  bullet(text: string): void {
    const bulletIndent = 14;
    const lines = this.wrap(text, this.regular, 10, CONTENT_W - bulletIndent);
    this.ensureSpace(lines.length * 13);
    this.text('•', MARGIN, 10, this.regular, MUTED);
    let ly = this.y;
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN + bulletIndent, y: ly, size: 10, font: this.regular, color: INK });
      ly -= 13;
    }
    this.y = ly - 2;
  }

  pill(label: string, color: RGB, soft: RGB): void {
    const safeLabel = pdfSafe(label);
    const w = this.bold.widthOfTextAtSize(safeLabel, 9.5) + 16;
    this.ensureSpace(20);
    this.page.drawRectangle({ x: MARGIN, y: this.y - 14, width: w, height: 18, color: soft, borderColor: color, borderWidth: 1, opacity: 1 });
    this.page.drawText(safeLabel, { x: MARGIN + 8, y: this.y - 10, size: 9.5, font: this.bold, color });
    this.y -= 26;
  }

  /** A simple multi-column table with word-wrapped cells; repeats the header after a page break. */
  table(headers: string[], rows: string[][], colWidths: number[]): void {
    const rowHeight = (cells: string[]): number => {
      let max = 1;
      cells.forEach((c, i) => { max = Math.max(max, this.wrap(c, this.regular, 9, colWidths[i] - 10).length); });
      return max * 12 + 8;
    };
    const drawHeader = (): void => {
      this.ensureSpace(22);
      this.page.drawRectangle({ x: MARGIN, y: this.y - 18, width: CONTENT_W, height: 20, color: SOFT });
      let cx = MARGIN;
      headers.forEach((h, i) => {
        this.page.drawText(pdfSafe(h), { x: cx + 6, y: this.y - 12, size: 9, font: this.bold, color: MUTED });
        cx += colWidths[i];
      });
      this.y -= 20;
    };
    drawHeader();
    for (const row of rows) {
      const h = rowHeight(row);
      if (this.y - h < MARGIN) {
        this.addPage();
        drawHeader();
      }
      const topY = this.y;
      let cx = MARGIN;
      row.forEach((cell, i) => {
        const lines = this.wrap(cell, this.regular, 9, colWidths[i] - 10);
        let ly = topY - 11;
        for (const line of lines) {
          this.page.drawText(line, { x: cx + 6, y: ly, size: 9, font: this.regular, color: INK });
          ly -= 12;
        }
        cx += colWidths[i];
      });
      this.y = topY - h;
      this.page.drawLine({ start: { x: MARGIN, y: this.y + 4 }, end: { x: MARGIN + CONTENT_W, y: this.y + 4 }, thickness: 0.5, color: BORDER });
      this.y -= 2;
    }
  }

  /** The dark band that announces what the document is, under the hospital letterhead. */
  titleBand(title: string, subtitle: string, rightLine: string): void {
    this.ensureSpace(56);
    const h = 52;
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: ACCENT_DARK });
    this.page.drawText(pdfSafe(title.toUpperCase()), { x: MARGIN + 16, y: top - 22, size: 15, font: this.bold, color: WHITE });
    const safeRight = pdfSafe(rightLine);
    const rightW = this.bold.widthOfTextAtSize(safeRight, 9.5);
    this.page.drawText(safeRight, { x: MARGIN + CONTENT_W - 16 - rightW, y: top - 20, size: 9.5, font: this.bold, color: GOLD });
    this.page.drawText(pdfSafe(subtitle), { x: MARGIN + 16, y: top - 38, size: 9.5, font: this.regular, color: WHITE_MUTED });
    this.y = top - h - 18;
  }

  /** One labelled box in a summary grid (matches the app's own light "field card" styling). */
  infoBox(x: number, y: number, w: number, h: number, label: string, value: string): void {
    this.page.drawRectangle({ x, y: y - h, width: w, height: h, color: SOFT, borderColor: BORDER, borderWidth: 1 });
    this.page.drawText(pdfSafe(label).toUpperCase(), { x: x + 10, y: y - 16, size: 7.5, font: this.bold, color: MUTED });
    const lines = this.wrap(value, this.bold, 11, w - 20).slice(0, 2);
    let ly = y - 32;
    for (const line of lines) {
      this.page.drawText(line, { x: x + 10, y: ly, size: 11, font: this.bold, color: INK });
      ly -= 14;
    }
  }

  /** A row of infoBoxes, evenly spaced across the content width; advances the cursor past the tallest row. */
  infoGrid(items: Array<[string, string]>, cols: number, boxH = 48): void {
    const gap = 10;
    const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
    const rows = Math.ceil(items.length / cols);
    this.ensureSpace(rows * (boxH + gap));
    const top = this.y;
    items.forEach(([label, value], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.infoBox(MARGIN + col * (boxW + gap), top - row * (boxH + gap), boxW, boxH, label, value);
    });
    this.y = top - rows * (boxH + gap) + gap;
  }

  /** A small rounded status chip, inline at the given x (unlike `pill`, which always starts a new line at the margin). */
  chipAt(x: number, label: string, band: keyof typeof BAND_COLORS): number {
    const colors = BAND_COLORS[band] || BAND_COLORS.LOW;
    const safe = pdfSafe(label);
    const w = this.bold.widthOfTextAtSize(safe, 9) + 16;
    this.page.drawRectangle({ x, y: this.y - 14, width: w, height: 18, color: colors.bg, borderColor: colors.border, borderWidth: 1 });
    this.page.drawText(safe, { x: x + 8, y: this.y - 10, size: 9, font: this.bold, color: colors.fg });
    return w;
  }
}

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
  const { incident, investigations, rca, rcaMeeting, capas } = data;
  const w = await DocWriter.create();

  // ---- Cover / letterhead ----
  gradientBar(w.page, 18, PAGE_H - 24, PAGE_W - 36, 5, ACCENT, GOLD);
  w.y = PAGE_H - 50;

  drawMark(w.page, MARGIN + 18, w.y - 13, 17);
  w.text('ADHIPARASAKTHI HOSPITALS', MARGIN + 46, 15, w.bold, ACCENT);
  w.y -= 16;
  w.text('A clinical division of Melmaruvathur Adhiparasakthi Institute of Medical Sciences and Research', MARGIN + 46, 8, w.regular, MUTED);
  w.y -= 11;
  w.text('G.S.T. Road, Melmaruvathur – 603 319   |   Phone: 044-2752 8528   |   Toll Free: 1800 599 0999   |   www.mapims.org', MARGIN + 46, 8, w.regular, MUTED);

  const taglineTopY = PAGE_H - 50;
  const tagline = pdfSafe('STATLOG');
  const taglineW = w.bold.widthOfTextAtSize(tagline, 13);
  w.page.drawText(tagline, { x: MARGIN + CONTENT_W - taglineW, y: taglineTopY - 2, size: 13, font: w.bold, color: ACCENT });
  const subTagline = pdfSafe('INCIDENT REPORTING  ·  PATIENT SAFETY');
  const subTaglineW = w.regular.widthOfTextAtSize(subTagline, 7.5);
  w.page.drawText(subTagline, { x: MARGIN + CONTENT_W - subTaglineW, y: taglineTopY - 15, size: 7.5, font: w.regular, color: MUTED });

  w.y -= 16;
  w.divider();

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
  w.fieldRow(['Reported by', personName(incident.reportedBy)], ['Reported at', fmtDateTime(incident.reportedAt)]);
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
      [55, 62, 80, CONTENT_W - 55 - 62 - 80 - 55 - 90, 55, 90]
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
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${(incident as any).incidentNumber}-final-report.pdf"`);
    res.setHeader('Content-Length', String(pdfBytes.byteLength));
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    next(error);
  }
};
