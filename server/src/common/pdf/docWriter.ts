import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from 'pdf-lib';

// Shared PDF building blocks (A4 layout, hospital colours, text safety) for every generated report.

// ---------- Text safety ----------

// pdf-lib's standard fonts only encode WinAnsi (Windows-1252) — anything outside it (an arrow typed
// in a chronology note, an emoji, a non-Latin script) throws and takes the whole report down with
// it. Common punctuation Word/browsers "smart-quote" in is kept as-is (WinAnsi supports it);
// anything else outside that range gets a plain-ASCII stand-in, or is dropped if there is none.
export const PDF_SAFE_REPLACEMENTS: Record<string, string> = {
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
export const WINANSI_EXTRA = new Set(
  ['€', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', 'Ž', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', 'ž', 'Ÿ']
);
export const isWinAnsiSafe = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  if (code === 9 || code === 10 || code === 13) return true; // tab/newline, handled by wrapping
  if (code >= 32 && code <= 126) return true; // ASCII
  if (code >= 160 && code <= 255) return true; // Latin-1 supplement, same bytes in Windows-1252
  return WINANSI_EXTRA.has(ch);
};
export const pdfSafe = (input: unknown): string => {
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

export const PAGE_W = 595.28; // A4
export const PAGE_H = 841.89;
export const MARGIN = 50;
export const CONTENT_W = PAGE_W - MARGIN * 2;
/** Width of the label column in label/value rows (values start here). */
export const LABEL_COL = 110;

export const INK = rgb(0.14, 0.12, 0.11);
export const MUTED = rgb(0.44, 0.4, 0.36);
export const ACCENT = rgb(0.42, 0.12, 0.16); // matches the app's maroon brand accent
export const ACCENT_DARK = rgb(0.26, 0.07, 0.1); // darkest stop of the app's own button/hero gradient
export const GOLD = rgb(0.831, 0.663, 0.329); // the app's gold accent (incident numbers on dark banners)
export const BORDER = rgb(0.86, 0.79, 0.68);
export const SOFT = rgb(0.98, 0.96, 0.93);
export const WHITE = rgb(1, 1, 1);
export const WHITE_MUTED = rgb(0.86, 0.82, 0.78);

// Mirrors client/src/lib/incidentMeta.ts RISK_BAND_META, so a risk band reads the same color in
// the app and in the report.
export const BAND_COLORS: Record<string, { fg: RGB; bg: RGB; border: RGB }> = {
  LOW: { fg: rgb(0.02, 0.47, 0.34), bg: rgb(0.93, 0.99, 0.96), border: rgb(0.65, 0.95, 0.82) },
  MODERATE: { fg: rgb(0.57, 0.25, 0.05), bg: rgb(1, 0.98, 0.92), border: rgb(0.99, 0.83, 0.33) },
  HIGH: { fg: rgb(0.73, 0.11, 0.11), bg: rgb(0.996, 0.95, 0.95), border: rgb(0.99, 0.79, 0.79) },
  EXTREME: { fg: rgb(1, 1, 1), bg: rgb(0.42, 0.08, 0.09), border: rgb(0.29, 0.05, 0.06) },
  CLOSED: { fg: rgb(0.02, 0.47, 0.34), bg: rgb(0.93, 0.99, 0.96), border: rgb(0.65, 0.95, 0.82) },
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpColor = (c1: RGB, c2: RGB, t: number): RGB => rgb(lerp(c1.red, c2.red, t), lerp(c1.green, c2.green, t), lerp(c1.blue, c2.blue, t));

/** A left-to-right gradient, approximated with thin strips (pdf-lib has no gradient fill primitive). */
export const gradientBar = (page: PDFPage, x: number, y: number, w: number, h: number, c1: RGB, c2: RGB): void => {
  const steps = 60;
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    page.drawRectangle({ x: x + i * stepW, y, width: stepW + 0.5, height: h, color: lerpColor(c1, c2, i / (steps - 1)) });
  }
};

/** A simple vector mark (not the hospital's real crest, which this app has no artwork for). */
export const drawMark = (page: PDFPage, cx: number, cy: number, r: number): void => {
  page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, color: ACCENT });
  const barW = r * 0.42;
  const barLen = r * 1.15;
  page.drawRectangle({ x: cx - barW / 2, y: cy - barLen / 2, width: barW, height: barLen, color: WHITE });
  page.drawRectangle({ x: cx - barLen / 2, y: cy - barW / 2, width: barLen, height: barW, color: WHITE });
};

export class DocWriter {
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
    // A word wider than the column (e.g. "CAPA-2026-000021" in a narrow cell) is split across lines
    // instead of spilling into the next column.
    const splitLong = (word: string): string[] => {
      if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
      const parts: string[] = [];
      let part = '';
      for (const ch of word) {
        if (part && font.widthOfTextAtSize(part + ch, size) > maxWidth) {
          parts.push(part);
          part = ch;
        } else {
          part += ch;
        }
      }
      if (part) parts.push(part);
      return parts;
    };
    const words = pdfSafe(text).split(/\s+/).filter(Boolean).flatMap(splitLong);
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
    // Keep the heading with the first few lines of its section rather than alone at a page bottom
    this.ensureSpace(80);
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
    // Same value column as fieldRow, so single and paired rows line up; widened only for a long label
    const labelWidth = opts.labelWidth ?? Math.max(LABEL_COL, this.bold.widthOfTextAtSize(pdfSafe(label), 10) + 10);
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
    const linesA = this.wrap(a[1] || '—', this.regular, 10, half - LABEL_COL - 6);
    const linesB = this.wrap(b[1] || '—', this.regular, 10, half - LABEL_COL - 6);
    const rows = Math.max(linesA.length, linesB.length);
    this.ensureSpace(rows * 13 + 4);
    const startY = this.y;
    // A label too long for its column is drawn smaller rather than running into the value
    const label = (text: string, x: number) => {
      const width = this.bold.widthOfTextAtSize(pdfSafe(text), 10);
      const size = width > LABEL_COL - 8 ? Math.max(7, (10 * (LABEL_COL - 8)) / width) : 10;
      this.text(text, x, size, this.bold, MUTED);
    };
    label(a[0], MARGIN);
    label(b[0], MARGIN + half);
    for (let i = 0; i < rows; i++) {
      if (linesA[i]) this.page.drawText(linesA[i], { x: MARGIN + LABEL_COL, y: startY - i * 13, size: 10, font: this.regular, color: INK });
      if (linesB[i]) this.page.drawText(linesB[i], { x: MARGIN + half + LABEL_COL, y: startY - i * 13, size: 10, font: this.regular, color: INK });
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

/** Hospital letterhead at the top of the first page, with the report's tagline on the right. */
export const drawLetterhead = (w: DocWriter, taglineText: string, subTaglineText: string): void => {
  gradientBar(w.page, 18, PAGE_H - 24, PAGE_W - 36, 5, ACCENT, GOLD);
  w.y = PAGE_H - 50;

  drawMark(w.page, MARGIN + 18, w.y - 13, 17);
  w.text('ADHIPARASAKTHI HOSPITALS', MARGIN + 46, 15, w.bold, ACCENT);
  w.y -= 16;
  w.text('A clinical division of Melmaruvathur Adhiparasakthi Institute of Medical Sciences and Research', MARGIN + 46, 8, w.regular, MUTED);
  w.y -= 11;
  w.text('G.S.T. Road, Melmaruvathur – 603 319   |   Phone: 044-2752 8528   |   Toll Free: 1800 599 0999   |   www.mapims.org', MARGIN + 46, 8, w.regular, MUTED);

  const taglineTopY = PAGE_H - 50;
  const tagline = pdfSafe(taglineText);
  const taglineW = w.bold.widthOfTextAtSize(tagline, 13);
  w.page.drawText(tagline, { x: MARGIN + CONTENT_W - taglineW, y: taglineTopY - 2, size: 13, font: w.bold, color: ACCENT });
  const subTagline = pdfSafe(subTaglineText);
  const subTaglineW = w.regular.widthOfTextAtSize(subTagline, 7.5);
  w.page.drawText(subTagline, { x: MARGIN + CONTENT_W - subTaglineW, y: taglineTopY - 15, size: 7.5, font: w.regular, color: MUTED });

  w.y -= 16;
  w.divider();
};
