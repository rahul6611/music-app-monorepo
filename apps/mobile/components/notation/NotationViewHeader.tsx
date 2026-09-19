import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface Props {
  onClose: () => void;
  subtitle?: string;
  backgroundColor: string;
  color: string;
  secondaryColor: string;
  borderColor: string;
}

export default function NotationViewHeader({ onClose, subtitle, backgroundColor, color, secondaryColor, borderColor }: Props) {
  return <View style={[styles.header, { backgroundColor, borderColor }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close notation view"
      onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
      <Feather name="x" size={26} color={color} />
    </Pressable>
    <View style={styles.labels}>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color }]}>Notation View</Text>
      {!!subtitle && <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.subtitle, { color: secondaryColor }]}>{subtitle}</Text>}
    </View>
    <View style={styles.balance} pointerEvents="none" />
  </View>;
}

const styles = StyleSheet.create({
  // The table must never shrink the header or move its close control off screen.
  header: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, minHeight: 60,
    width: '100%', minWidth: 0, paddingHorizontal: 8, paddingVertical: 8, gap: 8, borderBottomWidth: 1, zIndex: 1 },
  close: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { opacity: 0.55 },
  labels: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  balance: { width: 44, flexShrink: 0 },
});
