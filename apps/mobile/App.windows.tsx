import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };

type State = { error: Error | null };

export class WindowsErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.errorContainer} contentContainerStyle={styles.errorContent}>
          <Text style={styles.errorTitle}>Windows runtime error</Text>
          <Text style={styles.errorMessage}>{this.state.error.message}</Text>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

/**
 * Minimal Windows shell — plain React Native only (no Expo / no native add-ons).
 */
export default function App() {
  return (
    <WindowsErrorBoundary>
      <View style={styles.container}>
        <Text style={styles.title}>Musiki — Windows</Text>
        <Text style={styles.subtitle}>
          React Native Windows is running without Expo native modules.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Audio and video on mobile use expo-audio and expo-video. On Windows,
            those would be replaced with react-native-audio-api, react-native-video,
            or platform-specific APIs.
          </Text>
        </View>
      </View>
    </WindowsErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 32,
    justifyContent: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 18,
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
  },
  cardText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#450a0a',
  },
  errorContent: {
    padding: 24,
  },
  errorTitle: {
    color: '#fecaca',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#fee2e2',
    fontSize: 14,
    lineHeight: 20,
  },
});
