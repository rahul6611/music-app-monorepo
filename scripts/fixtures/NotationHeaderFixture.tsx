import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import NotationViewHeader from '../../apps/mobile/components/notation/NotationViewHeader';
export default function NotationHeaderFixture() {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, minWidth: 0, backgroundColor: '#000' }}>
    <NotationViewHeader onClose={() => {}} subtitle="An intentionally very long composition name that must never hide close"
      backgroundColor="#000" color="#fff" secondaryColor="#9ca3af" borderColor="#222" />
    <ScrollView horizontal style={{ flex: 1, minWidth: 0 }}>
      <View testID="wide-notation-table" style={{ width: 2400, height: 300, backgroundColor: '#e7e9f3' }} />
    </ScrollView>
  </SafeAreaView></SafeAreaProvider>;
}
