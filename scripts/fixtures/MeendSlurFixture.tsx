// Development-only visual fixture. Mount temporarily from an Expo route to check
// short/long, octave, Kan and Bracket curves at 390px and 1440px. No saved data writes.
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { buildNotationTableSections } from '@music-app/utils';
import NotationTableEnhanced from '../../apps/mobile/components/notation/NotationTableEnhanced';
import NotationGrid from '../../apps/mobile/components/notation/NotationGrid';

const swar = '/md S R / /md S R G M P D N S / /md S. R. /';
const sections = buildNotationTableSections([{ phraseId: 'meend', sectionLabel: 'Sthayi', entries: [
  { beat: 1, swar: '/md S R /' },
  { beat: 2, swar: '/md S R G M P D N S /' },
  { beat: 3, swar: '/md S. R. /' },
]}]);
export default function MeendCheck() {
  const [short, setShort] = useState(false);
  if (!__DEV__) return null;
  return <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ padding: 12 }}>
      <Text>Meend: View Notation</Text>
      <NotationTableEnhanced sections={sections} beatsPerCycle={3} taalName="Custom (2+1)" />
      <Text>Meend: Add Notation</Text>
      <NotationGrid inputs={{ swar, stroke: '', lyrics: '', tabla: '', pakhawaj: '', mridangam: '', finger: '', layakari: '' }} beatsPerCycle={3} />
      <Text>Meend inside Kan and Bracket; resize after editing</Text>
      <Pressable accessibilityRole="button" onPress={() => setShort(value => !value)}><Text>Toggle short/long Meend</Text></Pressable>
      <NotationGrid inputs={{ swar: short ? '/kn /md S R / / [ /md S / ]' : '/kn /md S R G M P / / [ /md S R G M P D N S / ]', stroke: '', lyrics: '', tabla: '', pakhawaj: '', mridangam: '', finger: '', layakari: '' }} beatsPerCycle={3} />
    </View>
  </ScrollView>;
}
