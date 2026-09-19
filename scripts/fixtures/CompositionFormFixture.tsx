// Local-only UI validation. Saving stays in component state, never Firebase.
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AddCompositionModal from '../../apps/mobile/components/library/AddCompositionModal';
export default function CompositionFormFixture() {
  const [visible, setVisible] = useState(true);
  const [saved, setSaved] = useState('');
  return <View style={{ flex: 1, padding: 20 }}>
    <Pressable accessibilityRole="button" onPress={() => setVisible(true)}><Text>Open composition form</Text></Pressable>
    <Text>{saved}</Text>
    <AddCompositionModal visible={visible} onClose={() => setVisible(false)} onSave={async data => setSaved(JSON.stringify(data))} />
  </View>;
}
