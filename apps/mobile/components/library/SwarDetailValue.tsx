import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@music-app/store';

interface SwarDetailValueProps {
  text: string;
}

export default function SwarDetailValue({ text }: SwarDetailValueProps) {
  const theme = useTheme();

  if (!text) return <Text style={{ color: theme.text }}>—</Text>;

  const isNotation = /[SRGMPDNrgmn]/.test(text);
  if (!isNotation) {
    return <Text style={[styles.plainText, { color: theme.text }]}>{text}</Text>;
  }

  const renderSwar = (piece: string, key: string) => {
    let octave: 'lower' | 'higher' | 'middle' = 'middle';
    let cleanPiece = piece;

    if (piece.startsWith('.')) {
      octave = 'lower';
      cleanPiece = piece.slice(1);
    } else if (piece.endsWith('.')) {
      octave = 'higher';
      cleanPiece = piece.slice(0, -1);
    }

    const isKomal = /^[rgdn]/.test(cleanPiece);
    const isTeevraMa = cleanPiece === 'M\'' || cleanPiece === 'm\'';
    const displayChar = cleanPiece.replace('\'', '').toUpperCase();

    return (
      <View key={key} style={styles.swarContainer}>
        {octave === 'higher' && (
          <View style={[styles.dot, { backgroundColor: theme.primary, top: -2 }]} />
        )}
        <View style={styles.charWrapper}>
          <Text style={[styles.swarText, { color: theme.text }]}>{displayChar}</Text>
          {isKomal && (
            <View style={[styles.komalLine, { backgroundColor: theme.text }]} />
          )}
          {isTeevraMa && (
            <View style={[styles.teevraLine, { backgroundColor: theme.text }]} />
          )}
        </View>
        {octave === 'lower' && (
          <View style={[styles.dot, { backgroundColor: theme.primary, bottom: -2 }]} />
        )}
      </View>
    );
  };

  const pieces = text.split(/(\s+)/);

  return (
    <View style={styles.container}>
      {pieces.map((piece, i) => {
        if (piece.trim() === '') {
          return <Text key={i}> </Text>;
        }
        return renderSwar(piece, `piece-${i}`);
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  plainText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  swarContainer: {
    alignItems: 'center',
    marginHorizontal: 1,
    minWidth: 14,
  },
  charWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  swarText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    position: 'absolute',
  },
  komalLine: {
    position: 'absolute',
    bottom: -1,
    width: '100%',
    height: 1.5,
  },
  teevraLine: {
    position: 'absolute',
    top: -2,
    left: '50%',
    width: 2,
    height: 6,
    marginLeft: -1,
    borderRadius: 1,
  }
});
