import React from 'react';
import { Stack } from 'expo-router';
import PitchMonitor from '../../components/practice/PitchMonitor';

export default function PitchPracticeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Pitch Practice' }} />
      <PitchMonitor />
    </>
  );
}
