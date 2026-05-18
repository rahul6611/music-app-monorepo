import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNotationStore } from '@music-app/store';
import { getSwarTokensForLayout, parseSwarToken } from '@music-app/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SwarKeyboardProps {
  currentBeatIndex?: number;
}

const SwarKeyboard: React.FC<SwarKeyboardProps> = ({ currentBeatIndex = 1 }) => {
  const { 
    swarOctaveMode, 
    setSwarOctaveMode, 
    swarText,
    setSwarText,
    cursorPositions,
    setCursorPosition,
    showSwarEffects
  } = useNotationStore();

  const shuddhOnly = false; 

  const [showBeatsDropdown, setShowBeatsDropdown] = useState(false);
  const beatOptions = [
    { left: '/2', right: '/2 /' },
    { left: '/3', right: '/3 /' },
    { left: '/4', right: '/4 /' },
    { left: '/5', right: '/5 /' },
    { left: '/6', right: '/6 /' },
    { left: '/7', right: '/7 /' },
    { left: '/8', right: '/8 /' },
  ];

  const insertToken = (token: string) => {
    const text = swarText;
    const pos = cursorPositions.swar;
    const next = text.slice(0, pos) + token + ' ' + text.slice(pos);
    const nextPos = pos + token.length + 1;
    setSwarText(next);
    setCursorPosition('swar', nextPos);
  };

  const tokens = getSwarTokensForLayout(swarOctaveMode);

  const typeOfOctaveAbove = (type: string) => type === 'higher' || type === 'double-higher';
  const typeOfOctaveBelow = (type: string) => type === 'lower' || type === 'double-lower';

  const renderNoteLabel = (token: string) => {
    const { baseNote, octaveType } = parseSwarToken(token);
    const normalized = baseNote.replace(/[\u2018\u2019\u02BC\u2032]/g, "'");
    const isTeevra = normalized === "M'" || normalized.includes('\u030D');
    const isKomal = /^[rgdn]$/i.test(normalized) && normalized === normalized.toLowerCase();
    const display = isTeevra ? 'M' : normalized.replace(/'/g, '');

    const renderDots = (type: string) => {
      if (type === 'higher') return <View style={s.dotAbove}><View style={s.miniDot} /></View>;
      if (type === 'double-higher') {
        return (
          <View style={s.dotAbove}>
            <View style={s.dotRow}><View style={s.miniDot} /><View style={s.miniDot} /></View>
          </View>
        );
      }
      if (type === 'lower') return <View style={s.dotBelow}><View style={s.miniDot} /></View>;
      if (type === 'double-lower') {
        return (
          <View style={s.dotBelow}>
            <View style={s.dotRow}><View style={s.miniDot} /><View style={s.miniDot} /></View>
          </View>
        );
      }
      return null;
    };

    return (
      <View style={s.noteContent}>
        {typeOfOctaveAbove(octaveType) && renderDots(octaveType)}
        {isTeevra && <View style={s.teevraMark} />}
        <Text style={s.noteLabel}>
          {isKomal ? display.toUpperCase() : display}
        </Text>
        {isKomal && <View style={s.komalLine} />}
        {typeOfOctaveBelow(octaveType) && renderDots(octaveType)}
      </View>
    );
  };

  return (
    <View style={s.keyboardContainer}>
      {showBeatsDropdown && (
        <View style={s.beatsPopup}>
          {beatOptions.map((opt, i) => (
            <View key={i} style={s.popupRow}>
              <TouchableOpacity style={s.popupItem} onPress={() => { insertToken(opt.left); setShowBeatsDropdown(false); }}>
                <Text style={s.popupText}>{opt.left}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.popupItem} onPress={() => { insertToken(opt.right); setShowBeatsDropdown(false); }}>
                <Text style={s.popupText}>{opt.right}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={s.octaveRow}>
        <TouchableOpacity 
          style={s.octavePill}
          onPress={() => {
            const nextMap: Record<string, 'normal' | 'lower' | 'doubleLower' | 'higher'> = {
              normal: 'lower',
              lower: 'doubleLower',
              doubleLower: 'normal',
              higher: 'lower'
            };
            setSwarOctaveMode(nextMap[swarOctaveMode]);
          }}
        >
          <Feather name="chevron-down" size={14} color="#333" />
          <View style={s.octaveIconBox}>
            <Text style={s.octaveIconText}>S</Text>
            {(swarOctaveMode === 'lower' || swarOctaveMode === 'doubleLower') && (
              <View style={s.miniDotRowFixed}>
                <View style={s.miniDotSmall} />
                {swarOctaveMode === 'doubleLower' && <View style={s.miniDotSmall} />}
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={s.beatIndicator}>
          <Text style={s.beatIndicatorText}>Beat {currentBeatIndex}</Text>
        </View>

        <TouchableOpacity 
          style={s.octavePill}
          onPress={() => {
            const nextMap: Record<string, 'normal' | 'higher' | 'lower' | 'doubleLower'> = {
              normal: 'higher',
              higher: 'normal',
              lower: 'higher',
              doubleLower: 'higher'
            };
            setSwarOctaveMode(nextMap[swarOctaveMode]);
          }}
        >
          <Feather name="chevron-up" size={14} color="#333" />
          <View style={s.octaveIconBox}>
            {swarOctaveMode === 'higher' && <View style={[s.miniDotSmall, { marginBottom: 1 }]} />}
            <Text style={s.octaveIconText}>S</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={s.noteGrid}>
        <View style={s.slot}>
          <TouchableOpacity style={s.tallKey} onPress={() => insertToken(tokens.firstS)}>
            {renderNoteLabel(tokens.firstS)}
          </TouchableOpacity>
        </View>

        {!shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.r)}>
              {renderNoteLabel(tokens.r)}
            </TouchableOpacity>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.R)}>
              {renderNoteLabel(tokens.R)}
            </TouchableOpacity>
          </View>
        )}
        {shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.tallKey} onPress={() => insertToken(tokens.R)}>
              {renderNoteLabel(tokens.R)}
            </TouchableOpacity>
          </View>
        )}

        {!shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.g)}>
              {renderNoteLabel(tokens.g)}
            </TouchableOpacity>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.G)}>
              {renderNoteLabel(tokens.G)}
            </TouchableOpacity>
          </View>
        )}
        {shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.tallKey} onPress={() => insertToken(tokens.G)}>
              {renderNoteLabel(tokens.G)}
            </TouchableOpacity>
          </View>
        )}

        <View style={s.slot}>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.M)}>
            {renderNoteLabel(tokens.M)}
          </TouchableOpacity>
          {!shuddhOnly && (
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.Mp)}>
              {renderNoteLabel(tokens.Mp)}
            </TouchableOpacity>
          )}
        </View>

        <View style={s.slot}>
          <TouchableOpacity style={s.tallKey} onPress={() => insertToken(tokens.P)}>
            {renderNoteLabel(tokens.P)}
          </TouchableOpacity>
        </View>

        {!shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.d)}>
              {renderNoteLabel(tokens.d)}
            </TouchableOpacity>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.D)}>
              {renderNoteLabel(tokens.D)}
            </TouchableOpacity>
          </View>
        )}
        {shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.tallKey} onPress={() => insertToken(tokens.D)}>
              {renderNoteLabel(tokens.D)}
            </TouchableOpacity>
          </View>
        )}

        {!shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.n)}>
              {renderNoteLabel(tokens.n)}
            </TouchableOpacity>
            <TouchableOpacity style={s.halfKey} onPress={() => insertToken(tokens.N)}>
              {renderNoteLabel(tokens.N)}
            </TouchableOpacity>
          </View>
        )}
        {shuddhOnly && (
          <View style={s.slot}>
            <TouchableOpacity style={s.tallKey} onPress={() => insertToken(tokens.N)}>
              {renderNoteLabel(tokens.N)}
            </TouchableOpacity>
          </View>
        )}

        <View style={s.slot}>
          <TouchableOpacity style={s.tallKey} onPress={() => insertToken(tokens.lastS)}>
            {renderNoteLabel(tokens.lastS)}
          </TouchableOpacity>
        </View>
      </View>

      {showSwarEffects && (
        <View style={s.effectsBar}>
          <TouchableOpacity style={s.effectItem} onPress={() => setShowBeatsDropdown(!showBeatsDropdown)}>
            <View style={s.effectIconBox}>
              <Text style={s.effectIconText}>Beats</Text>
              <Feather name="chevron-down" size={12} color="#333" />
            </View>
            <Text style={s.effectLabel}>Chhand</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.effectItem}>
            <View style={s.effectIconBox}>
              <View style={s.curveUp} />
            </View>
            <Text style={s.effectLabel}>Meend</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.effectItem}>
            <View style={s.effectIconBox}>
              <View style={s.curveDown} />
            </View>
            <Text style={s.effectLabel}>Phrases</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.effectItem}>
            <View style={s.effectIconBox}>
              <View style={s.kanBox}>
                <Text style={s.kanSmall}>s</Text>
                <Text style={s.kanMain}>R</Text>
              </View>
            </View>
            <Text style={s.effectLabel}>Kan</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  keyboardContainer: {
    width: '100%',
    gap: 4,
  },
  octaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ebeef5',
    borderRadius: 12,
    padding: 6,
    marginHorizontal: 0,
  },
  octavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  octaveIconBox: {
    alignItems: 'center',
    width: 14,
  },
  octaveIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  miniDotSmall: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#333',
  },
  miniDotRowFixed: {
    flexDirection: 'row',
    gap: 1.5,
    marginTop: 1,
  },
  beatIndicator: {
    flex: 1,
    alignItems: 'center',
  },
  beatIndicatorText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2d3436',
  },

  noteGrid: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    gap: 5,
  },
  slot: {
    flex: 1,
    gap: 6,
  },
  tallKey: {
    height: 94,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.1,
    shadowRadius: 2.5,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f3f5',
  },
  halfKey: {
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.1,
    shadowRadius: 2.5,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f3f5',
  },

  noteContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d3436',
  },
  komalLine: {
    width: 14,
    height: 1.5,
    backgroundColor: '#2d3436',
    marginTop: 1,
  },
  teevraMark: {
    position: 'absolute',
    top: -8,
    width: 2,
    height: 10,
    backgroundColor: '#2d3436',
  },
  dotAbove: {
    position: 'absolute',
    top: -10,
  },
  dotBelow: {
    position: 'absolute',
    bottom: -10,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
  },
  miniDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#2d3436',
  },

  effectsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 4,
    gap: 6,
  },
  effectItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  effectIconBox: {
    width: '100%',
    height: 52,
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef1',
  },
  effectIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  effectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#95a5a6',
    textAlign: 'center',
  },
  kanBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  kanSmall: {
    fontSize: 8,
    fontWeight: '800',
    color: '#333',
    marginRight: 1,
    marginTop: -2,
  },
  kanMain: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  curveUp: {
    width: 24,
    height: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#333',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginTop: 6,
  },
  curveDown: {
    width: 24,
    height: 12,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#333',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  beatsPopup: {
    position: 'absolute',
    bottom: 60, 
    left: 4,
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#eee',
    zIndex: 1000,
  },
  popupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  popupItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  popupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});

export default SwarKeyboard;
