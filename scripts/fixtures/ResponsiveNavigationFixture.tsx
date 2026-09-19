import React, { useState } from 'react';
import { Text, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Link, Tabs } from 'expo-router';
import { ResponsiveTabShell } from '../../apps/mobile/components/layout/ResponsiveTabShell';
import NotationTableEnhanced from '../../apps/mobile/components/notation/NotationTableEnhanced';
import { buildNotationTableSections } from '@music-app/utils';

export function NavigationLayoutFixture() {
  const desktop = useWindowDimensions().width >= 768;
  return <ResponsiveTabShell desktop={desktop}
    sidebar={<View style={{ width: 140, padding: 10 }}><Text>Test sidebar</Text><Link href="/responsive-check/second">Second tab</Link><Link href="/responsive-check">Notation tab</Link></View>}
    header={<Text>Desktop navigation fixture</Text>}>
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: desktop ? { display: 'none' } : undefined }}>
      <Tabs.Screen name="index" options={{ title: 'Notation tab' }} />
      <Tabs.Screen name="second" options={{ title: 'Second tab' }} />
    </Tabs>
  </ResponsiveTabShell>;
}

const sections = buildNotationTableSections([
  { phraseId: 'ghasit', sectionLabel: 'Ghasit', entries: [
    { beat: 1, swar: '/gh .M .g .M .P .D /' },
    { beat: 2, swar: '/md S R G M P D N S /' },
  ] },
  { phraseId: 'combined', sectionLabel: 'Combined', entries: [
    { beat: 1, swar: '[ .S .r .G .M .P .D .N ]' },
    { beat: 2, swar: '/mu S R G M P D N S /' },
    { beat: 3, swar: '/2 S R G M P D N S /' },
  ] },
]);

export function NativeTableFixture() {
  const [count, setCount] = useState(0);
  return <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 12 }}>
    <Pressable accessibilityRole="button" onPress={() => setCount(value => value + 1)}><Text>Retained count: {count}</Text></Pressable>
    <Text>Native sizing: complete Ghasit and Meend groups must fit their cells.</Text>
    <NotationTableEnhanced sections={sections} beatsPerCycle={7} taalName="Custom (2+2+3)" />
  </ScrollView>;
}

export function SecondTabFixture() {
  return <View><Text>Second tab content</Text></View>;
}
