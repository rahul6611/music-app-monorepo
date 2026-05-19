import React from 'react';
import { StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@music-app/store';
import StudentsNew from '../../components/StudentsNew';

export default function Students() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: theme.background },
      isWebDesktop && {
        width: '100%',
        marginTop: 24,
        paddingHorizontal: 24,
      }
    ]}>
      <StudentsNew />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
