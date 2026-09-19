export type InsertTokenSpec = {
  insertText: string;
  cursorOffset: number;
};

// Chhand
const CHHAND_FULL_TOKEN_RE = /^\/\s*(?:cn\s*)?\d+(?:\s+[^/]*)?\s*\/\s*$/i;
const CHHAND_HEADER_RE = /\/\s*(?:cn\s*)?(\d+)/i;

const CHHAND_SPAN_IN_SEGMENT_RE = /\/\s*(?:cn\s*)?(\d+)(?:\s+[^/]*)?\/|\/\s*(?:cn\s*)?(\d+)\s*$/i;
const CHHAND_CONTENT_RE = /^\/\s*(?:cn\s*)?\d+\s*(.*?)\s*\/\s*$/i;
const CHHAND_INCOMPLETE_RE = /^\/\s*(?:cn\s*)?\d+\s*$/i;

export function isChhandToken(text: string): boolean {
  return CHHAND_FULL_TOKEN_RE.test(text.trim());
}

export function matchChhandHeader(text: string): RegExpMatchArray | null {
  return text.match(/\/\s*(?:cn\s*)?\d+/i);
}

export function extractChhandSpanFromSegment(segmentText: string): number | null {
  const match = segmentText.match(CHHAND_SPAN_IN_SEGMENT_RE);
  if (!match) return null;
  const raw = match[1] || match[2];
  const span = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(span) ? span : null;
}

export function extractChhandInnerContent(segmentText: string): string | null {
  const match = segmentText.match(CHHAND_CONTENT_RE);
  if (!match) return null;
  return (match[1] ?? '').trim();
}

export function isChhandIncompleteHeader(segmentText: string): boolean {
  return CHHAND_INCOMPLETE_RE.test(segmentText.trim());
}

export function extractChhandSpanFromHeader(text: string): number | null {
  const match = text.match(CHHAND_HEADER_RE);
  if (!match) return null;
  const span = parseInt(match[1], 10);
  return Number.isFinite(span) ? span : null;
}

// Murki 
const MURKI_TOKEN_RE = /^\/\s*mu\b.*$/i;

export function isMurkiToken(text: string): boolean {
  return MURKI_TOKEN_RE.test(text.trim());
}

// Chikari
const CHIKARI_TOKEN_RE = /^\/\s*ck\s*\/\s*$/i;

export function isChikariToken(text: string): boolean {
  return CHIKARI_TOKEN_RE.test(text.trim());
}

export function normalizeChikariToken(text: string): string | null {
  return isChikariToken(text) ? '/ck/' : null;
}

export function buildDelimitedTokenInsert(marker: string, spaces: number = 2): InsertTokenSpec {
  const normalized = marker.startsWith('/') ? marker : `/${marker}`;
  const safeSpaces = Math.max(1, Math.floor(spaces));
  const insertText = `${normalized}${' '.repeat(safeSpaces)}/`;
  const cursorOffset = normalized.length + 1; 
  return { insertText, cursorOffset };
}

export function buildChandInsert(span: number, spaces: number = 2): InsertTokenSpec {
  return buildDelimitedTokenInsert(`/${span}`, spaces);
}
