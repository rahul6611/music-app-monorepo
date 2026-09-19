// Visual regression fixture used at 390px and 1440px. No saved data or Firebase writes.
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { buildNotationTableSections } from '@music-app/utils';
import NotationTableEnhanced from '../../apps/mobile/components/notation/NotationTableEnhanced';
const sections = buildNotationTableSections([
  { phraseId: 'a', sectionLabel: 'Sthayi', entries: [
    { beat: 1, swar: 'S' }, { beat: 2, swar: 'r' }, { beat: 3, swar: 'g' },
    { beat: 4, swar: 'R G g' }, { beat: 5, swar: 'd' }, { beat: 6, swar: '/md r g R S. /' },
  ] },
  { phraseId: 'b', sectionLabel: 'Sthayi', entries: [
    { beat: 1, swar: 'S. R. M. g. M S' }, { beat: 2, swar: '/2 S r M d N S. R M S /' },
    { beat: 4, swar: '/md .R .S .R .g /' }, { beat: 5, swar: '[ .R .R .g .G .S ]' },
    { beat: 6, swar: '/gm .M .G .G /' }, { beat: 7, swar: '/gh .M .g .M .P .D /' },
    { absoluteBeat: 11, swar: '/mu S /' }, { absoluteBeat: 12, swar: '/mu S S S S S S S S /' },
  ] },
]);
export default function LayoutCheck() {
  if (!__DEV__) return null;
  return <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ padding: 12 }}>
      <Text>Jhaptal 2+3+2+3 — mobile layout fixture</Text>
      <NotationTableEnhanced sections={sections} beatsPerCycle={10} taalName="Jhaptaal — 10 beats (2+3+2+3)" />
      <Text>Custom composition 2+2+3</Text>
      <NotationTableEnhanced sections={[sections[0]]} beatsPerCycle={7} taalName="Custom — 7 beats (2+2+3)" />
    </View>
  </ScrollView>;
}
