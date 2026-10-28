import Papa from 'papaparse';

export interface ParsedFeedbackCsv {
  headers: string[];
  rows: Record<string, string>[];
  candidates: string[];
}

const HEADER_HINTS = /feedback|comment|response|review|suggestion|message|text|opinion|experience|remark|student voice|what did/iu;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function scoreColumn(header: string, values: string[]): number {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  if (filled.length === 0) return -2;
  const alphaRatio = filled.filter((value) => /[\p{L}]{3,}/u.test(value)).length / filled.length;
  const numericRatio = filled.filter((value) => /^[-+\d.,%\s]+$/u.test(value)).length / filled.length;
  const averageLength = filled.reduce((sum, value) => sum + value.length, 0) / filled.length;
  let score = HEADER_HINTS.test(header) ? 4 : 0;
  if (alphaRatio > 0.65) score += 1;
  if (numericRatio > 0.75) score -= 3;
  if (averageLength > 18) score += 1;
  if (averageLength > 60) score += 1;
  return score;
}

export function detectFeedbackColumns(headers: string[], rows: Record<string, string>[]): string[] {
  const sample = rows.slice(0, 100);
  const scored = headers.map((header) => ({ header, score: scoreColumn(header, sample.map((row) => String(row[header] ?? ''))) }));
  const candidates = scored.filter((column) => column.score >= 2).sort((a, b) => b.score - a.score).map((column) => column.header);
  return candidates.length ? candidates : scored.filter((column) => column.score >= 0).map((column) => column.header);
}

export async function parseFeedbackCsv(file: File): Promise<ParsedFeedbackCsv> {
  if (!file.size) throw new Error('This CSV file is empty. Choose a file with a header row and feedback.');
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is over 5 MB. Try a smaller CSV so analysis stays quick.');
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error('We could not read this file. Try saving it as UTF-8 CSV and uploading again.');
  }
  if (text.includes('\uFFFD')) throw new Error('Some characters could not be decoded. Please save the CSV as UTF-8 and try again.');
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.replace(/^\uFEFF/u, '').trim(),
  });
  if (!parsed.meta.fields?.length) throw new Error('We could not find a header row. Add column names and try again.');
  const headers = parsed.meta.fields.filter(Boolean);
  const rows = parsed.data.filter((row) => headers.some((header) => String(row[header] ?? '').trim()));
  if (!rows.length) throw new Error('No feedback rows were found in this CSV. Add comments below the header row.');
  const fatal = parsed.errors.find((error) => ['TooManyFields', 'TooFewFields', 'MissingQuotes'].includes(error.code));
  if (fatal) throw new Error('This CSV has inconsistent columns. Check the separators and quoting, then try again.');
  return { headers, rows, candidates: detectFeedbackColumns(headers, rows) };
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}
