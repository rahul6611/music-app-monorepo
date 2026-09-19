import React from 'react';
import { useWindowDimensions, View } from 'react-native';

type MeendToken = string | { content?: MeendToken[] };

// Same recursive note count as Beta's NotationTableNew.countMeendNotes.
function countMeendNotes(tokens: MeendToken[]): number {
  let count = 0;
  for (const token of tokens) {
    if (typeof token === 'string') {
      const trimmed = token.trim();
      if (trimmed && trimmed !== '/') count += 1;
    } else if (token.content?.length) {
      count += countMeendNotes(token.content);
    }
  }
  return count;
}

/** Native equivalent of Beta's elliptical Meend border, sized by the note group. */
export function TopArcSlur({ content = [] }: { content?: MeendToken[] }) {
  const compact = useWindowDimensions().width <= 768;
  const count = countMeendNotes(content);
  // Beta's compact / notes-2 / notes-3 border-radius values (desktop and mobile).
  const radiusY = count <= 2 ? (compact ? 6 : 7) : count === 3 ? (compact ? 7 : 9) : (compact ? 9 : 11);
  const height = radiusY + 2;

  return (
    <View
      testID="notation-meend-slur"
      pointerEvents="none"
      style={{ alignSelf: 'stretch', flexShrink: 0, height, marginBottom: 2, overflow: 'hidden' }}
    >
      <View style={{ position: 'absolute', left: 1, right: 1, top: 0, height: radiusY * 2,
        borderWidth: 2, borderColor: '#333', borderRadius: 999 }} />
    </View>
  );
}
