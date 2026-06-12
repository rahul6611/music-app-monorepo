export type PitchCsvRow = {
  elapsedMs: number;
  frequencyHz: number | null;
};

export type PitchCsvExportSample = {
  elapsedMs: number;
  frequencyHz: number | null;
  note?: string | null;
  cents?: number | null;
  clarity?: number;
};

export type PitchPlaybackSegment = {
  startMs: number;
  endMs: number;
  frequencyHz: number;
};

const TIME_MS_HEADERS = ['time (ms)', 'time_ms', 'elapsedms', 'elapsed_ms', 'timestamp_ms', 'ms'];
const FREQ_HEADERS = ['frequency (hz)', 'frequency_hz', 'frequencyhz', 'frequency', 'hz'];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  cells.push(current);
  return cells;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function parseTimeMs(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function parseFrequencyHz(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Parse pitch-practice CSV exports (or compatible files).
 * Uses elapsed time + Hz only — note columns are ignored for playback.
 */
export function parsePitchCsv(text: string): PitchCsvRow[] {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]);
  const timeIndex = findColumnIndex(headerCells, TIME_MS_HEADERS);
  const freqIndex = findColumnIndex(headerCells, FREQ_HEADERS);

  if (timeIndex < 0 || freqIndex < 0) {
    throw new Error(
      'CSV must include "Time (ms)" and "Frequency (Hz)" columns (or compatible names).',
    );
  }

  const rows: PitchCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const elapsedMs = parseTimeMs(cells[timeIndex] ?? '');
    if (elapsedMs == null) continue;

    rows.push({
      elapsedMs,
      frequencyHz: parseFrequencyHz(cells[freqIndex] ?? ''),
    });
  }

  rows.sort((a, b) => a.elapsedMs - b.elapsedMs);
  return rows;
}

/** Build contiguous playback segments from sparse CSV rows (Hz only). */
export function buildPitchPlaybackSchedule(
  rows: PitchCsvRow[],
  options: { defaultSegmentMs?: number } = {},
): PitchPlaybackSegment[] {
  const { defaultSegmentMs = 250 } = options;
  const pitched = rows.filter((r) => r.frequencyHz != null && r.frequencyHz > 0);
  if (pitched.length === 0) return [];

  const segments: PitchPlaybackSegment[] = [];

  for (let i = 0; i < pitched.length; i++) {
    const row = pitched[i];
    const next = pitched[i + 1];
    const endMs = next ? next.elapsedMs : row.elapsedMs + defaultSegmentMs;
    if (endMs <= row.elapsedMs) continue;

    segments.push({
      startMs: row.elapsedMs,
      endMs,
      frequencyHz: row.frequencyHz!,
    });
  }

  return segments;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function formatCsvFrequency(hz: number | null | undefined): string {
  if (hz == null || hz <= 0) return '';
  return hz.toFixed(1);
}

function formatCsvConfidence(clarity: number | undefined): string {
  return String(Math.round((clarity ?? 0) * 100));
}

export function serializePitchSamplesCsv(samples: PitchCsvExportSample[]): string {
  const header = 'Time (ms),Time (s),Frequency (Hz),Note,Cents,Confidence (%)';
  const rows = samples.map((sample) => {
    const timeMs = Math.max(0, Math.round(sample.elapsedMs));
    const timeSec = (timeMs / 1000).toFixed(2);
    return [
      timeMs,
      timeSec,
      formatCsvFrequency(sample.frequencyHz),
      sample.note ?? '',
      sample.cents != null ? Math.round(sample.cents) : '',
      formatCsvConfidence(sample.clarity),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function buildPitchCsvFilename(sessionDurationMs: number, samples: PitchCsvExportSample[] = []): string {
  const durationMs =
    sessionDurationMs > 0 ? sessionDurationMs : samples[samples.length - 1]?.elapsedMs ?? 0;
  const durationSec = Math.max(0, Math.round(durationMs / 1000));
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `pitch-samples-${durationSec}s-${stamp}.csv`;
}

export function summarizePitchCsvRows(rows: PitchCsvRow[]): {
  rowCount: number;
  pitchedCount: number;
  durationMs: number;
} {
  const pitched = rows.filter((r) => r.frequencyHz != null && r.frequencyHz > 0);
  const lastMs = rows.length > 0 ? rows[rows.length - 1].elapsedMs : 0;
  return {
    rowCount: rows.length,
    pitchedCount: pitched.length,
    durationMs: lastMs,
  };
}
