export interface PhraseRow {
  type: string;
  content: Array<string | PhraseRow>;
}

export interface ParsedPhraseCell {
  phraseIndex: number;
  beatIndex: number;
  data: Array<string | PhraseRow>;
}

const NOTE_REGEX = /^(\*)?(\.{1,3})[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?$|^(\*)?[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?(\.{1,3})$|^(\*)?[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?$|^-$/;
const OPEN_SLASH = /^\/(\d+|md|kn|k|gh|mu|kh|gm|aa|th_start|th_middle|th_end)$/i;
const NESTED_TOKEN = /\/(\d+|md|kn|kh|k|gh|mu|gm|aa|th_start|th_middle|th_end)\b|\/|\(|\)|\[|\]|\{|\}|\||(?:\*)?(?:\.{1,3})?[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?(?:\.{1,3})?|-/gi;

function expandTihai(input: string): string {
  return input.replace(/\/th\b\s*([^/]*?)\s*\//gi, (_match, content: string) => {
    let parts = content.split(',').map(part => part.trim());
    if (!parts.length || (parts.length === 1 && !parts[0])) parts = ['-'];
    const expanded: string[] = [];
    for (let repeat = 0; repeat < 3; repeat += 1) {
      parts.forEach((part, index) => {
        const first = repeat === 0 && index === 0;
        const last = repeat === 2 && index === parts.length - 1;
        expanded.push(`/${first ? 'th_start' : last ? 'th_end' : 'th_middle'} ${part || '-'} /`);
      });
    }
    return expanded.join(', ');
  });
}

function extractNestedTokens(phrase: string): string[] {
  if (!phrase) return [];
  const matches = Array.from(phrase.matchAll(NESTED_TOKEN));
  const tokens: string[] = [];
  let lastIndex = 0;
  matches.forEach(match => {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...phrase.slice(lastIndex, index).trim().split(/\s+/).filter(Boolean));
    }
    tokens.push(match[0]);
    lastIndex = index + match[0].length;
  });
  if (lastIndex < phrase.length) {
    tokens.push(...phrase.slice(lastIndex).trim().split(/\s+/).filter(Boolean));
  }
  return tokens;
}

function buildHierarchy(tokens: string[]): Array<string | PhraseRow> {
  const root: Array<string | PhraseRow> = [];
  const stack: PhraseRow[] = [{ type: 'root', content: root }];
  tokens.forEach(token => {
    const current = stack[stack.length - 1];
    if (OPEN_SLASH.test(token)) {
      const row: PhraseRow = { type: token, content: [] };
      current.content.push(row);
      stack.push(row);
    } else if (token === '(' || token === '[' || token === '{') {
      const row: PhraseRow = { type: token === '(' ? '(' : '[', content: [] };
      current.content.push(row);
      stack.push(row);
    } else if (token === '/') {
      if (stack.length > 1 && OPEN_SLASH.test(stack[stack.length - 1].type)) {
        stack[stack.length - 1].content.push('/');
        stack.pop();
      } else current.content.push(token);
    } else if (token === ')' || token === ']' || token === '}') {
      const expected = token === ')' ? '(' : '[';
      if (stack.length > 1 && stack[stack.length - 1].type === expected) {
        stack[stack.length - 1].content.push(token === ')' ? ')' : ']');
        stack.pop();
      } else current.content.push(token === ')' ? ')' : ']');
    } else {
      // Keep unmatched text just like the web parser; this is important for percussion-like annotations.
      current.content.push(token);
    }
  });
  return root;
}

function spanFromData(data: Array<string | PhraseRow>): number {
  const first = data[0];
  if (first && typeof first !== 'string') {
    const numeric = first.type.match(/^\/(\d+)$/);
    if (numeric) return Math.max(1, Number(numeric[1]));
  }
  return 1;
}

export function parseNestedMusicInput(input: string): ParsedPhraseCell[] {
  const phrases = expandTihai(input).split(',').map(value => value.trim());
  let beatIndex = 1;
  return phrases.map((phrase, index) => {
    const data = buildHierarchy(extractNestedTokens(phrase));
    const cell = { phraseIndex: index + 1, beatIndex, data };
    beatIndex += spanFromData(data);
    return cell;
  });
}

function parsePlainInput(input: string): ParsedPhraseCell[] {
  const segments = input.split(',').map(value => value.trim());
  let beatIndex = 1;
  return segments.map((segment, index) => {
    const match = segment.match(/^\/\s*(\d+)\s*(.*)$/);
    const span = match && Number(match[1]) > 1 ? Number(match[1]) : 1;
    const content = match ? (match[2] ?? '').replace(/\s*\/\s*$/, '').trim() : segment;
    const data: Array<string | PhraseRow> = span > 1
      ? [{ type: `/${span}`, content: [content] }]
      : [content];
    const cell = { phraseIndex: index + 1, beatIndex, data };
    beatIndex += span;
    return cell;
  });
}

export const parseStrokeMusicInput = parsePlainInput;
export const parseLyricsMusicInput = parsePlainInput;

const PERCUSSION_TOKEN = /\/(\d+|md|kn|gh|mu|kh|gm|aa)|\/|\(|\)|\||(?:\*)?[^\s,/()|]+|-/g;

export function parsePercussionBolInput(input: string): ParsedPhraseCell[] {
  const phrases = input.split(',').map(value => value.trim());
  let beatIndex = 1;
  return phrases.map((phrase, index) => {
    const tokens = Array.from(phrase.matchAll(PERCUSSION_TOKEN), match => match[0]);
    const data = buildHierarchy(tokens);
    const cell = { phraseIndex: index + 1, beatIndex, data };
    beatIndex += spanFromData(data);
    return cell;
  });
}

export function flattenParsedTokens(tokens: Array<string | PhraseRow>): string {
  const parts: string[] = [];
  const walk = (token: string | PhraseRow) => {
    if (typeof token === 'string') {
      const value = token.trim();
      if (value) parts.push(value);
      return;
    }
    if (token.type && token.type !== 'root') parts.push(token.type);
    token.content.forEach(walk);
  };
  tokens.forEach(walk);
  return parts.join(' ').trim();
}

export function isValidSwarToken(value: string): boolean {
  return NOTE_REGEX.test(value);
}
