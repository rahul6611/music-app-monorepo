import { getNestedKanSubTokens, splitTopLevelEffectTokens, unwrapSlashEffectToken } from './effectNotation';

// Beta's split paths: a Chhand exposes its children, while each ornament
// (including /sp) remains one division. Kān adds grace/main positions inside it.
export function getNotationDivisions(segment: string): string[] {
  const outer = unwrapSlashEffectToken(segment);
  return splitTopLevelEffectTokens(outer && /^\/\d+$/.test(outer.tag) ? outer.inner : segment);
}

export type NotationPosition = { subIndex: number | null; kanIndex: number | null };

export function getNotationPositions(segment: string, explicitSplit: boolean): NotationPosition[] {
  const tokens = getNotationDivisions(segment);
  const hasKan = tokens.some(token => getNestedKanSubTokens(token).length > 0);
  const divided = explicitSplit || hasKan || /^\s*\/\d+\b/.test(segment);
  if (!divided) return [{ subIndex: null, kanIndex: null }];
  return tokens.flatMap<NotationPosition>((token, subIndex) => {
    const kan = getNestedKanSubTokens(token);
    return kan.length
      ? kan.map((_, kanIndex) => ({ subIndex, kanIndex }))
      : [{ subIndex, kanIndex: null }];
  });
}

export function moveNotationPosition(
  text: string, cursor: number, selection: NotationPosition,
  explicitSplits: Record<number, boolean>, direction: 'prev' | 'next',
) {
  const parts = text.split(',');
  let segmentIndex = 0;
  let offset = 0;
  while (segmentIndex < parts.length - 1 && cursor > offset + parts[segmentIndex].length) {
    offset += parts[segmentIndex++].length + 1;
  }
  const positions = getNotationPositions(parts[segmentIndex], !!explicitSplits[segmentIndex]);
  let index = positions.findIndex(position => position.subIndex === selection.subIndex && position.kanIndex === selection.kanIndex);
  if (index < 0) {
    index = positions.findIndex(position => position.subIndex === selection.subIndex);
    if (index < 0) index = Math.max(0, positions.length - 1);
  }
  const delta = direction === 'prev' ? -1 : 1;
  let target = positions[index + delta];
  if (!target) {
    if (segmentIndex === 0 && direction === 'prev') target = positions[0];
    else {
      segmentIndex += delta;
      while (parts.length <= segmentIndex) parts.push('');
      const nextPositions = getNotationPositions(parts[segmentIndex], !!explicitSplits[segmentIndex]);
      target = nextPositions[direction === 'prev' ? nextPositions.length - 1 : 0];
    }
  }
  target ??= { subIndex: null, kanIndex: null };
  offset = parts.slice(0, segmentIndex).reduce((sum, part) => sum + part.length + 1, 0);
  return { text: parts.join(','), cursor: offset + parts[segmentIndex].length, ...target };
}
