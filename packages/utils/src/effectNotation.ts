export type SlashEffectToken = {
  tag: string;
  inner: string;
};

const SLASH_EFFECT_TAG = /^\/(?:md|kn|k|gh|mu|kh|gm|aa|sp|\d+|th_start|th_middle|th_end|th)\b/i;

export function splitTopLevelEffectTokens(input: string): string[] {
  const source = input.trim();
  if (!source) return [];

  const tokens: string[] = [];
  const closers: string[] = [];
  let tokenStart = -1;

  const flush = (end: number) => {
    if (tokenStart < 0) return;
    const token = source.slice(tokenStart, end).trim();
    if (token) tokens.push(token);
    tokenStart = -1;
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (/\s/.test(char) && closers.length === 0) {
      flush(i);
      continue;
    }

    if (tokenStart < 0) tokenStart = i;

    if (char === '/') {
      const remaining = source.slice(i);
      const opener = remaining.match(SLASH_EFFECT_TAG);
      if (opener) {
        closers.push('/');
        i += opener[0].length - 1;
      } else if (closers[closers.length - 1] === '/') {
        closers.pop();
      }
      continue;
    }

    if (char === '(') closers.push(')');
    else if (char === '[') closers.push(']');
    else if (char === '{') closers.push('}');
    else if (closers[closers.length - 1] === char) closers.pop();
  }

  flush(source.length);
  return tokens.length > 0 ? tokens : [source];
}

export function unwrapSlashEffectToken(token: string): SlashEffectToken | null {
  const trimmed = token.trim();
  const opener = trimmed.match(SLASH_EFFECT_TAG);
  if (!opener || !trimmed.endsWith('/')) return null;

  const inner = trimmed.slice(opener[0].length, -1).trim();
  return { tag: opener[0], inner };
}

export function unwrapBracketEffectToken(token: string): { inner: string } | null {
  const trimmed = token.trim();
  const isSquare = trimmed.startsWith('[') && trimmed.endsWith(']');
  const isLegacyCurly = trimmed.startsWith('{') && trimmed.endsWith('}');
  if (!isSquare && !isLegacyCurly) return null;
  return { inner: trimmed.slice(1, -1).trim() };
}

export function nestMeendInSupportedItem(token: string): string | null {
  const slash = unwrapSlashEffectToken(token);
  if (slash && /^\/(?:kn|k|kh)$/i.test(slash.tag)) {
    return `${slash.tag} /md ${slash.inner || '-'} / /`;
  }

  const bracket = unwrapBracketEffectToken(token);
  if (bracket) return `[ /md ${bracket.inner || '-'} / ]`;

  return null;
}

export function nestExistingMeendInSlashItem(tag: string, token: string): string | null {
  if (!/^\/(?:kn|k|kh)$/i.test(tag)) return null;
  const meend = unwrapSlashEffectToken(token);
  if (!meend || meend.tag.toLowerCase() !== '/md') return null;
  const inner = /^\/(?:kn|k)$/i.test(tag) && (!meend.inner || meend.inner === '-')
    ? '/md - - /'
    : token.trim();
  return `${tag} ${inner} /`;
}

export function appendKanInsidePopulatedMeend(tag: string, token: string): string | null {
  if (!/^\/(?:kn|k)$/i.test(tag)) return null;
  const meend = unwrapSlashEffectToken(token);
  if (!meend || meend.tag.toLowerCase() !== '/md' || !meend.inner || meend.inner === '-') return null;

  const innerTokens = splitTopLevelEffectTokens(meend.inner);
  if (innerTokens.some((item) => /^\/(?:kn|k)\b/i.test(item.trim()))) return null;
  return `/md ${innerTokens.join(' ')} ${tag} - - / /`;
}

export function appendKanInsideSupportedContainer(tag: string, token: string): string | null {
  if (!/^\/(?:kn|k)$/i.test(tag)) return null;

  const bracket = unwrapBracketEffectToken(token);
  if (bracket) {
    const innerTokens = splitTopLevelEffectTokens(bracket.inner);
    if (innerTokens.some((item) => /^\/(?:kn|k)\b/i.test(item.trim()))) return null;
    const content = bracket.inner && bracket.inner !== '-' ? bracket.inner : '';
    return `[ ${[content, `${tag} - - /`].filter(Boolean).join(' ')} ]`;
  }

  const outer = unwrapSlashEffectToken(token);
  if (!outer || !/^\/(?:md|kh|mu)$/i.test(outer.tag)) return null;
  const innerTokens = splitTopLevelEffectTokens(outer.inner);
  if (innerTokens.some((item) => /^\/(?:kn|k)\b/i.test(item.trim()))) return null;
  const content = outer.inner && outer.inner !== '-' ? outer.inner : '';
  return `${outer.tag} ${[content, `${tag} - - /`].filter(Boolean).join(' ')} /`;
}

export function getNestedKanSubTokens(token: string): string[] {
  const direct = unwrapSlashEffectToken(token);
  if (direct && /^\/(?:kn|k)$/i.test(direct.tag)) {
    const nestedMeendInner = unwrapNestedMeend(direct.inner);
    return (nestedMeendInner ?? direct.inner).split(/\s+/).filter(Boolean);
  }

  const bracket = unwrapBracketEffectToken(token);
  const containerInner = bracket?.inner ?? direct?.inner;
  if (containerInner === undefined) return [];
  const innerTokens = splitTopLevelEffectTokens(containerInner);
  for (let i = innerTokens.length - 1; i >= 0; i--) {
    const nested = unwrapSlashEffectToken(innerTokens[i]);
    if (nested && /^\/(?:kn|k)$/i.test(nested.tag)) {
      return nested.inner.split(/\s+/).filter(Boolean);
    }
  }
  return [];
}

export function updateKanInsideMeend(
  token: string,
  note: string,
  activeIndex: number,
): { token: string; activeIndex: number } | null {
  const bracket = unwrapBracketEffectToken(token);
  const outer = unwrapSlashEffectToken(token);
  if (!bracket && (!outer || !/^\/(?:md|kh|mu)$/i.test(outer.tag))) return null;

  const innerTokens = splitTopLevelEffectTokens(bracket?.inner ?? outer?.inner ?? '');
  let kanIndex = -1;
  for (let i = innerTokens.length - 1; i >= 0; i--) {
    if (/^\/(?:kn|k)\b/i.test(innerTokens[i].trim())) {
      kanIndex = i;
      break;
    }
  }
  if (kanIndex < 0) return null;

  const kan = unwrapSlashEffectToken(innerTokens[kanIndex]);
  if (!kan || !/^\/(?:kn|k)$/i.test(kan.tag)) return null;

  const swars = kan.inner.split(/\s+/).filter(Boolean);
  let graceNotes: string[];
  let mainNote: string;
  if (swars.length <= 1) {
    graceNotes = ['-'];
    mainNote = swars[0] && swars[0] !== '-' ? swars[0] : '-';
  } else {
    graceNotes = swars.slice(0, -1);
    mainNote = swars[swars.length - 1];
  }

  let nextIndex = Math.max(0, activeIndex);
  if (nextIndex >= graceNotes.length) {
    mainNote = note;
    nextIndex = graceNotes.length;
  } else if (graceNotes.length === 1 && graceNotes[0] === '-') {
    graceNotes = [note];
    nextIndex = 0;
  } else if (graceNotes.length < 3) {
    graceNotes.push(note);
    nextIndex = graceNotes.length - 1;
  } else {
    nextIndex = Math.min(nextIndex, 2);
    graceNotes[nextIndex] = note;
  }

  innerTokens[kanIndex] = `${kan.tag} ${[...graceNotes.slice(0, 3), mainNote].join(' ')} /`;
  return {
    token: bracket
      ? `[ ${innerTokens.join(' ')} ]`
      : `${outer!.tag} ${innerTokens.join(' ')} /`,
    activeIndex: nextIndex,
  };
}

export function unwrapNestedMeend(inner: string): string | null {
  const nested = unwrapSlashEffectToken(inner);
  return nested && nested.tag.toLowerCase() === '/md' ? nested.inner : null;
}

export function appendInsideNestedMeend(inner: string, note: string): string {
  const meendInner = unwrapNestedMeend(inner);
  if (meendInner === null) return inner;
  const existing = meendInner && meendInner !== '-' ? meendInner : '';
  return `/md ${[existing, note].filter(Boolean).join(' ')} /`;
}
