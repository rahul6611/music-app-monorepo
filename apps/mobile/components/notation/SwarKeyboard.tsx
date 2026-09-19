import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotationStore } from '@music-app/store';
import {
  appendKanInsidePopulatedMeend,
  appendKanInsideSupportedContainer,
  getSwarTokensForLayout,
  getNotationDivisions,
  nestExistingMeendInSlashItem,
  nestMeendInSupportedItem,
  parseSwarToken,
  splitTopLevelEffectTokens,
  unwrapBracketEffectToken,
  unwrapNestedMeend,
  unwrapSlashEffectToken,
  updateKanInsideMeend,
} from '@music-app/utils';

type SegmentLocation = {
  parts: string[];
  index: number;
  start: number;
  segment: string;
  posInSegment: number;
};

const locateSegment = (text: string, cursor: number): SegmentLocation => {
  const parts = text.split(',');
  let start = 0;
  for (let index = 0; index < parts.length; index += 1) {
    if (cursor <= start + parts[index].length) {
      return { parts, index, start, segment: parts[index], posInSegment: cursor - start };
    }
    start += parts[index].length + 1;
  }
  const index = Math.max(0, parts.length - 1);
  return {
    parts,
    index,
    start: parts.slice(0, index).reduce((sum, part) => sum + part.length + 1, 0),
    segment: parts[index] || '',
    posInSegment: (parts[index] || '').length,
  };
};

const matchChhand = (value: string) => {
  const match = value.trim().match(/^\/\s*(\d+)(?:\s+([\s\S]*?))?\s*\/$/);
  return match ? { span: Number(match[1]), inner: (match[2] || '').trim() } : null;
};

const splitSegment = getNotationDivisions;

const reconstructSegment = (tokens: string[], original: string) => {
  const trimmed = original.trim();
  const joined = tokens.join(' ');
  const chhand = matchChhand(trimmed);
  if (chhand) return ` /${chhand.span} ${joined} / `;
  return ` ${joined} `;
};

const tokenIndexAtCursor = (segment: string, tokens: string[], position: number) => {
  if (tokens.length <= 1) return 0;
  let searchFrom = 0;
  let active = 0;
  tokens.forEach((token, index) => {
    const start = segment.indexOf(token, searchFrom);
    if (start >= 0) {
      if (position >= start) active = index;
      searchFrom = start + token.length;
    }
  });
  return active;
};

const insertInsideToken = (token: string, note: string, activeKanIndex: number = 0, persistSplitGroup = false): string => {
  const cleanInsert = note.trim();
  if (!cleanInsert) return token;

  const nestedKanUpdate = updateKanInsideMeend(token, cleanInsert, activeKanIndex);
  if (nestedKanUpdate) return nestedKanUpdate.token;

  const slashMatch = token.trim().match(/^(\/(?:md|kn|k|gh|mu|kh|gm|aa|sp|\d+|th_start|th_middle|th_end))\b\s*([\s\S]*?)\s*\/$/i);
  const parenMatch = token.trim().match(/^\(([\s\S]*?)\)$/);
  const bracketMatch = unwrapBracketEffectToken(token);

  if (slashMatch) {
    const tag = slashMatch[1];
    const innerContent = slashMatch[2].trim();
    if (tag.toLowerCase() === '/kn' || tag.toLowerCase() === '/k') {
      const nestedMeendInner = unwrapNestedMeend(innerContent);
      const swarParts = (nestedMeendInner ?? innerContent).split(/\s+/).filter(Boolean);
      let kanNotes: string[];
      let mainNote: string;
      if (swarParts.length === 0 || innerContent === '-') {
        kanNotes = ['-'];
        mainNote = '-';
      } else if (swarParts.length === 1) {
        if (swarParts[0] === '-') {
          kanNotes = ['-'];
          mainNote = '-';
        } else {
          kanNotes = ['-'];
          mainNote = swarParts[0];
        }
      } else {
        kanNotes = swarParts.slice(0, -1);
        mainNote = swarParts[swarParts.length - 1];
      }

      if (activeKanIndex >= kanNotes.length) {
        mainNote = cleanInsert;
      } else if (kanNotes.length === 1 && (kanNotes[0] === '-' || kanNotes[0] === '')) {
        kanNotes = [cleanInsert];
      } else if (kanNotes.length < 3) {
        kanNotes.push(cleanInsert);
      } else {
        mainNote = cleanInsert;
      }

      const cleanedKan = kanNotes.slice(0, 3).filter(Boolean);
      if (cleanedKan.length === 0) cleanedKan.push('-');
      const nextKanInner = [...cleanedKan, mainNote].join(' ');
      return nestedMeendInner !== null
        ? `${tag} /md ${nextKanInner} / /`
        : `${tag} ${nextKanInner} /`;
    } else {
      const cleanedInner = innerContent.replace(/^-\s*|\s*-$/g, '').trim();
      if (!cleanedInner || cleanedInner === '-') {
        return `${tag} ${cleanInsert} /`;
      } else {
        return `${tag} ${cleanedInner} ${cleanInsert} /`;
      }
    }
  }

  if (parenMatch) {
    const innerContent = parenMatch[1].trim().replace(/^-\s*|\s*-$/g, '').trim();
    if (!innerContent || innerContent === '-') {
      return `( ${cleanInsert} )`;
    } else {
      return `( ${innerContent} ${cleanInsert} )`;
    }
  }

  if (bracketMatch) {
    const innerContent = bracketMatch.inner.trim().replace(/^-\s*|\s*-$/g, '').trim();
    if (!innerContent || innerContent === '-') {
      return `[ ${cleanInsert} ]`;
    } else {
      return `[ ${innerContent} ${cleanInsert} ]`;
    }
  }

  const trimmed = token.trim();
  if (!trimmed || (trimmed === '-' && cleanInsert !== '-')) {
    return cleanInsert;
  }
  if (persistSplitGroup) return `/sp ${trimmed} ${cleanInsert} /`;
  return `${trimmed} ${cleanInsert}`;
};

const octaveShift = (mode: string) =>
  mode === 'doubleLower' ? -2 : mode === 'lower' ? -1 : mode === 'higher' ? 1 : mode === 'doubleHigher' ? 2 : 0;

const octaveMode = (shift: number) =>
  shift <= -2 ? 'doubleLower' : shift === -1 ? 'lower' : shift === 1 ? 'higher' : shift >= 2 ? 'doubleHigher' : 'normal';

interface SwarKeyboardProps {
  currentBeatIndex?: number;
  phraseSelectionMode?: boolean;
  phraseDraft?: { startBeat: number | null; endBeat: number | null } | null;
  onBeginPhrase?: () => void;
  onFinishPhrase?: () => void;
  onCancelPhrase?: () => void;
  showStringInstrumentEffects?: boolean;
}

const SwarKeyboard: React.FC<SwarKeyboardProps> = ({
  phraseSelectionMode = false,
  phraseDraft = null,
  onBeginPhrase,
  onFinishPhrase,
  onCancelPhrase,
  showStringInstrumentEffects = false,
}) => {
  const {
    swarOctaveMode,
    setSwarOctaveMode,
    swarText,
    setSwarText,
    cursorPositions,
    setCursorPosition,
    showSwarEffects,
    swarSubIndex,
    setSwarSubIndex,
    swarKanSubIndex,
    setSwarKanSubIndex,
    explicitSwarSplits,
    setExplicitSwarSplit,
  } = useNotationStore();

  const [showBeatsDropdown, setShowBeatsDropdown] = useState(false);

  const location = useMemo(() => locateSegment(swarText, cursorPositions.swar), [swarText, cursorPositions.swar]);
  const activeTokens = useMemo(() => splitSegment(location.segment), [location.segment]);
  const cursorTokenIndex = tokenIndexAtCursor(location.segment, activeTokens, location.posInSegment);
  const activeTokenIndex = swarSubIndex !== null && swarSubIndex >= 0 && swarSubIndex < activeTokens.length
    ? swarSubIndex
    : cursorTokenIndex;
  const activeToken = activeTokens[activeTokenIndex] || '-';
  const isSplit = !!explicitSwarSplits[location.index] && activeTokens.length > 1;

  const commitSegment = (nextSegment: string, index = location.index) => {
    const parts = [...location.parts];
    parts[index] = nextSegment;
    const next = parts.join(',');
    const start = parts.slice(0, index).reduce((sum, part) => sum + part.length + 1, 0);
    setSwarText(next);
    setCursorPosition('swar', start + nextSegment.length);
  };

  const insertToken = (note: string) => {
    if (activeTokens.length === 1 && /^\s*\/(?:kn|k)\b/i.test(location.segment)) {
      commitSegment(` ${insertInsideToken(location.segment, note, swarKanSubIndex ?? 0)} `);
      return;
    }
    const segmentIsContainer =
      !!matchChhand(location.segment) ||
      /^\s*\/(?:md|kn|k|gh|mu|kh|gm|aa)\b/i.test(location.segment) ||
      /^\s*[\[{(]/.test(location.segment);

    if (
      isSplit ||
      segmentIsContainer ||
      activeTokens.length > 1 ||
      unwrapSlashEffectToken(activeToken) ||
      unwrapBracketEffectToken(activeToken)
    ) {
      const tokens = activeTokens.length ? [...activeTokens] : ['-'];
      tokens[Math.min(activeTokenIndex, tokens.length - 1)] = insertInsideToken(
        tokens[Math.min(activeTokenIndex, tokens.length - 1)],
        note,
        swarKanSubIndex ?? 0,
        isSplit,
      );
      commitSegment(reconstructSegment(tokens, location.segment));
      return;
    }

    const pos = cursorPositions.swar;
    const next = `${swarText.slice(0, pos)}${note} ${swarText.slice(pos)}`;
    setSwarText(next);
    setCursorPosition('swar', pos + note.length + 1);
  };

  const effectDisabled = (effect: string) => {
    if (phraseSelectionMode) return true;
    const token = activeToken.trim();
    const activeContainer = /^\/(?:kn|k)\b/i.test(token) || token.includes('/kn') || token.includes('/k ')
      ? 'kan'
      : /^\/kh\b/i.test(token) || token.includes('/kh')
      ? 'khatka'
      : unwrapBracketEffectToken(token)
      ? 'bracket'
      : null;
    const restricted = activeContainer !== null;
    const hasMeend = /\/md\b/i.test(token) || token.includes('/md');
    const hasGhasit = /\/gh\b/i.test(token) || token.includes('/gh');
    const hasGamak = /\/gm\b/i.test(token) || token.includes('/gm');

    if (/^\/\d+$/.test(effect)) return restricted;
    if (effect === '/md') return hasMeend || hasGhasit || hasGamak;
    if (effect === '/gh') return hasMeend || restricted;
    if (effect === '/kn') return hasGhasit;
    if (effect === '/kh') return hasGhasit || (restricted && activeContainer !== 'khatka');
    if (effect === '[') return hasGhasit || (restricted && activeContainer !== 'bracket');
    if (effect === '/gm') return hasMeend || restricted;
    if (effect === '/mu') return restricted;
    return false;
  };

  const applyEffect = (tag: string) => {
    if (effectDisabled(tag)) return;
    const tokens = activeTokens.length ? [...activeTokens] : ['-'];
    const isKanTag = /^\/(?:kn|k)$/i.test(tag);
    const isWholeSegmentKan = /^\/(?:kn|k)\b[\s\S]*\/$/i.test(location.segment.trim());
    const hasSiblingKan = tokens.some((value) => /^\/(?:kn|k)\b/i.test(value.trim()));
    if (isKanTag && !isWholeSegmentKan && (tokens.length > 1 || hasSiblingKan)) {
      tokens.push(`${tag} - - /`);
      setSwarSubIndex(tokens.length - 1);
      setSwarKanSubIndex(0);
      commitSegment(reconstructSegment(tokens, location.segment));
      return;
    }
    const target = Math.min(activeTokenIndex, tokens.length - 1);
    const token = tokens[target] || '-';
    const slash = unwrapSlashEffectToken(token);
    const bracket = unwrapBracketEffectToken(token);
    const parenMatch = token.trim().match(/^\(([\s\S]*?)\)$/);
    let nextToken: string;

    if (tag === '[' && bracket) {
      nextToken = bracket.inner || '-';
    } else if (tag === '/kh' && parenMatch) {
      nextToken = parenMatch[1].trim() || '-';
    } else if (slash && slash.tag.toLowerCase() === tag.toLowerCase()) {
      nextToken = slash.inner || '-';
    } else {
      const nested = tag === '/md' ? nestMeendInSupportedItem(token) : null;
      const combined =
        nested ??
        appendKanInsidePopulatedMeend(tag, token) ??
        appendKanInsideSupportedContainer(tag, token) ??
        nestExistingMeendInSlashItem(tag, token);
      if (combined) {
        nextToken = combined;
      } else if (tag === '[') {
        nextToken = `[ ${token.trim() || '-'} ]`;
      } else {
        let cleanToken = token.trim();
        const previousEffect = cleanToken.match(/^\/(?:md|kn|k|gh|mu|kh|gm|aa|\d+)\b\s*(.*?)\s*\/$/i);
        if (previousEffect) cleanToken = previousEffect[1].trim();
        if (!cleanToken || cleanToken === '-') cleanToken = '-';
        if (isKanTag) {
          const swars = cleanToken.split(/\s+/).filter(Boolean);
          nextToken = swars.length === 1 && swars[0] !== '-'
            ? `${tag} - ${swars[0]} /`
            : `${tag} ${cleanToken === '-' ? '- -' : cleanToken} /`;
        } else {
          nextToken = `${tag} ${cleanToken} /`;
        }
      }
    }

    tokens[target] = nextToken;
    setSwarSubIndex(target);
    setSwarKanSubIndex(isKanTag || /\/(?:kn|k)\b/i.test(nextToken) ? 0 : null);
    commitSegment(reconstructSegment(tokens, location.segment));
  };

  const applyChhand = (span: number) => {
    const existing = matchChhand(location.segment);
    const content = existing ? existing.inner : location.segment.trim() || '-';
    commitSegment(existing?.span === span ? ` ${content} ` : ` /${span} ${content} / `);
    setShowBeatsDropdown(false);
  };

  const addSplit = () => {
    const tokens = activeTokens.length ? [...activeTokens] : ['-'];
    const isBlank = !location.segment.trim() || location.segment.trim() === '-';
    tokens.push('-');
    setExplicitSwarSplit(location.index, true);
    setSwarSubIndex(isBlank ? 0 : tokens.length - 1);
    setSwarKanSubIndex(null);
    commitSegment(reconstructSegment(tokens, location.segment));
  };

  const removeSplit = () => {
    if (activeTokens.length <= 1) return;
    const tokens = [...activeTokens];
    tokens.pop();
    setExplicitSwarSplit(location.index, tokens.length > 1);
    setSwarSubIndex(tokens.length > 1 ? tokens.length - 1 : null);
    setSwarKanSubIndex(null);
    commitSegment(reconstructSegment(tokens, location.segment));
  };

  const layoutTokens = getSwarTokensForLayout(swarOctaveMode);
  const shift = octaveShift(swarOctaveMode);

  const renderNoteLabel = (token: string) => {
    const { baseNote, octaveType } = parseSwarToken(token);
    const normalized = baseNote.replace(/[‘’ʼ′]/g, "'");
    const isTeevra = normalized === "M'";
    const isKomal = /^[rgdn]$/.test(normalized);
    const dots = octaveType.includes('double') ? 2 : octaveType === 'normal' ? 0 : 1;
    const above = octaveType.includes('higher');

    return (
      <View style={s.noteContent}>
        {!!dots && above && (
          <View style={s.dotAbove}>
            {Array.from({ length: dots }).map((_, i) => (
              <View key={i} style={s.miniDot} />
            ))}
          </View>
        )}
        {isTeevra && <View style={s.teevraMark} />}
        <Text style={s.noteLabel}>{isKomal ? normalized.toUpperCase() : normalized.replace(/'/g, '')}</Text>
        {isKomal && <View style={s.komalLine} />}
        {!!dots && !above && (
          <View style={s.dotBelow}>
            {Array.from({ length: dots }).map((_, i) => (
              <View key={i} style={s.miniDot} />
            ))}
          </View>
        )}
      </View>
    );
  };

  const effectButton = (tag: string, label: string, icon: React.ReactNode) => {
    const disabled = effectDisabled(tag);
    return (
      <TouchableOpacity
        key={tag}
        disabled={disabled}
        style={[s.effectItem, disabled && s.disabled]}
        onPress={() => applyEffect(tag)}
      >
        <View style={s.effectIconBox}>{icon}</View>
        <Text style={s.effectLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.keyboardContainer}>
      <Modal
        transparent
        visible={showBeatsDropdown}
        animationType="fade"
        onRequestClose={() => setShowBeatsDropdown(false)}
      >
        <Pressable style={s.dropdownBackdrop} onPress={() => setShowBeatsDropdown(false)}>
          <View style={s.verticalDropdownCard}>
            <ScrollView style={{ maxHeight: 210 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
              {[2, 3, 4, 5, 6, 7, 8, 12, 16].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={s.verticalDropdownItem}
                  onPress={() => applyChhand(value)}
                >
                  <Text style={s.verticalDropdownText}>{value} beats</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {showSwarEffects && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.effectsBar}>
          <TouchableOpacity
            disabled={effectDisabled('/2')}
            style={[s.effectItem, effectDisabled('/2') && s.disabled]}
            onPress={() => setShowBeatsDropdown(true)}
          >
            <View style={s.effectIconBox}>
              <Text style={s.effectIconText}>Beats</Text>
              <Feather name="chevron-down" size={12} color="#333" />
            </View>
            <Text style={s.effectLabel}>Chhand</Text>
          </TouchableOpacity>

          {effectButton('/md', 'Meend', <View style={s.meendIcon}><View style={s.meendIconArc} /></View>)}
          <TouchableOpacity
            style={[s.effectItem, s.phraseEffectItem]}
            onPress={phraseSelectionMode ? undefined : onBeginPhrase}
            accessibilityState={{ selected: phraseSelectionMode }}
          >
            <View style={[s.effectIconBox, phraseSelectionMode && s.phraseEffectActive]}>
              <Text style={[s.phraseEffectText, phraseSelectionMode && s.phraseEffectTextActive]}>{phraseSelectionMode ? 'Start Phrase' : 'Phrase'}</Text>
              <View style={[s.phraseEffectLine, phraseSelectionMode && s.phraseEffectLineActive]} />
            </View>
            <Text style={s.effectLabel}>Phrase</Text>
          </TouchableOpacity>
          {phraseSelectionMode && (
            <TouchableOpacity
              disabled={phraseDraft?.startBeat == null || phraseDraft.endBeat == null}
              style={[s.effectItem, s.phraseEffectItem, (phraseDraft?.startBeat == null || phraseDraft.endBeat == null) && s.disabled]}
              onPress={onFinishPhrase}
            >
              <View style={s.effectIconBox}><Text style={s.phraseEffectText}>End Phrase</Text></View>
              <Text style={s.effectLabel}>Finish</Text>
            </TouchableOpacity>
          )}
          {phraseSelectionMode && (
            <TouchableOpacity style={[s.effectItem, s.phraseEffectItem]} onPress={onCancelPhrase}>
              <View style={s.effectIconBox}><Text style={s.phraseEffectText}>Cancel</Text></View>
              <Text style={s.effectLabel}>Cancel</Text>
            </TouchableOpacity>
          )}
          {effectButton('[', 'Bracket', <Text style={s.effectIconText}>[  ]</Text>)}
          {effectButton('/gm', 'Gamak', <Text style={[s.effectIconText, s.gamakText]}>SSS</Text>)}
          {showStringInstrumentEffects && effectButton('/gh', 'Ghasit', <View style={s.ghasitIcon} />)}
          {effectButton(
            '/kn',
            'Kan',
            <View style={s.kanBox}>
              <Text style={s.kanSmall}>S</Text>
              <Text style={s.kanMain}>R</Text>
            </View>
          )}
          {effectButton('/kh', 'Khatka', <Text style={[s.effectIconText, s.khatkaText]}>( )</Text>)}
          {showStringInstrumentEffects && effectButton('/mu', 'Murki', <Text style={[s.effectIconText, s.murkiText]}>~~~</Text>)}
        </ScrollView>
      )}

      <View style={s.octaveRow}>
        <View style={s.octaveLeft}>
          <TouchableOpacity
            disabled={shift <= -2}
            style={[s.octavePill, shift < 0 && s.octaveActive, shift <= -2 && s.disabled]}
            onPress={() => setSwarOctaveMode(octaveMode(Math.max(-2, shift - 1)) as any)}
          >
            <Feather name="chevron-down" size={18} color="#333" />
            <Text style={s.controlText}>Octave</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={shift >= 2}
            style={[s.octavePill, shift > 0 && s.octaveActive, shift >= 2 && s.disabled]}
            onPress={() => setSwarOctaveMode(octaveMode(Math.min(2, shift + 1)) as any)}
          >
            <Feather name="chevron-up" size={18} color="#333" />
            <Text style={s.controlText}>Octave</Text>
          </TouchableOpacity>
        </View>

        {!isSplit ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Split beat" style={s.splitPill} onPress={addSplit}>
            <MaterialCommunityIcons name="call-split" size={19} color="#333" />
            <Text style={s.controlText}>Split</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.splitControls}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove split" style={s.splitIconPill} onPress={removeSplit}>
              <Feather name="minus" size={18} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={s.splitActivePill} onPress={addSplit}>
              <MaterialCommunityIcons name="call-split" size={17} color="#fff" />
              <Text style={s.splitActiveText}>{activeTokens.length} Splits</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add split" style={s.splitIconPill} onPress={addSplit}>
              <Feather name="plus" size={18} color="#333" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.noteGrid}>
        <View style={s.slot}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Insert Sa" style={s.tallKey} onPress={() => insertToken(layoutTokens.firstS)}>
            {renderNoteLabel(layoutTokens.firstS)}
          </TouchableOpacity>
        </View>
        <View style={s.slot}>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.r)}>
            {renderNoteLabel(layoutTokens.r)}
          </TouchableOpacity>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.R)}>
            {renderNoteLabel(layoutTokens.R)}
          </TouchableOpacity>
        </View>
        <View style={s.slot}>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.g)}>
            {renderNoteLabel(layoutTokens.g)}
          </TouchableOpacity>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.G)}>
            {renderNoteLabel(layoutTokens.G)}
          </TouchableOpacity>
        </View>
        <View style={s.slot}>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.M)}>
            {renderNoteLabel(layoutTokens.M)}
          </TouchableOpacity>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.Mp)}>
            {renderNoteLabel(layoutTokens.Mp)}
          </TouchableOpacity>
        </View>
        <View style={s.slot}>
          <TouchableOpacity style={s.tallKey} onPress={() => insertToken(layoutTokens.P)}>
            {renderNoteLabel(layoutTokens.P)}
          </TouchableOpacity>
        </View>
        <View style={s.slot}>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.d)}>
            {renderNoteLabel(layoutTokens.d)}
          </TouchableOpacity>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.D)}>
            {renderNoteLabel(layoutTokens.D)}
          </TouchableOpacity>
        </View>
        <View style={s.slot}>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.n)}>
            {renderNoteLabel(layoutTokens.n)}
          </TouchableOpacity>
          <TouchableOpacity style={s.halfKey} onPress={() => insertToken(layoutTokens.N)}>
            {renderNoteLabel(layoutTokens.N)}
          </TouchableOpacity>
        </View>
        <View style={s.slot}>
          <TouchableOpacity style={s.tallKey} onPress={() => insertToken(layoutTokens.lastS)}>
            {renderNoteLabel(layoutTokens.lastS)}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const keyShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.09,
  shadowRadius: 2,
  elevation: 2,
} as const;

const s = StyleSheet.create({
  keyboardContainer: { width: '100%', gap: 8 },
  effectsBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 0, paddingBottom: 2 },
  effectItem: { width: 62, alignItems: 'center', gap: 3 },
  disabled: { opacity: 0.38 },
  effectIconBox: {
    ...keyShadow,
    width: '100%',
    height: 46,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
    borderWidth: 1,
    borderColor: '#eceef1',
  },
  effectIconText: { fontSize: 13, fontWeight: '700', color: '#30343b' },
  effectLabel: { fontSize: 10, fontWeight: '600', color: '#7e898c', textAlign: 'center' },
  phraseEffectItem: { width: 78 },
  phraseEffectActive: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
  phraseEffectText: { color: '#30343b', fontSize: 10, fontWeight: '700' },
  phraseEffectTextActive: { color: '#fff' },
  phraseEffectLine: { position: 'absolute', left: 10, right: 10, bottom: 8, height: 2, borderRadius: 2, backgroundColor: '#8b5cf6' },
  phraseEffectLineActive: { backgroundColor: '#fff' },
  ghasitIcon: { width: 23, height: 13, borderLeftWidth: 2, borderRightWidth: 2, borderTopWidth: 2, borderColor: '#30343b' },
  meendIcon: { width: 22, height: 12, overflow: 'hidden' },
  meendIconArc: { position: 'absolute', left: 1, right: 1, top: 1, height: 18, borderWidth: 2, borderColor: '#30343b', borderRadius: 999 },
  gamakText: { fontWeight: '900' },
  khatkaText: { fontSize: 18 },
  murkiText: { fontSize: 18, letterSpacing: -3 },
  kanBox: { flexDirection: 'row', alignItems: 'flex-start' },
  kanSmall: { fontSize: 9, fontWeight: '800', marginTop: -3 },
  kanMain: { fontSize: 16, fontWeight: '700' },
  octaveRow: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e5e9f1',
    borderRadius: 13,
    padding: 5,
    gap: 4,
  },
  octaveLeft: { flexDirection: 'row', gap: 4 },
  octavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 33,
    gap: 2,
  },
  octaveActive: { backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd' },
  splitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 33,
    gap: 5,
  },
  splitControls: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  splitIconPill: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  splitActivePill: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    gap: 4,
  },
  splitActiveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  controlText: { color: '#30343b', fontSize: 12, fontWeight: '600' },
  noteGrid: { flexDirection: 'row', gap: 4 },
  slot: { flex: 1, gap: 5 },
  tallKey: {
    ...keyShadow,
    height: 102,
    backgroundColor: '#fff',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f0f1f3',
  },
  halfKey: {
    ...keyShadow,
    height: 48.5,
    backgroundColor: '#fff',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f0f1f3',
  },
  noteContent: { alignItems: 'center', justifyContent: 'center' },
  noteLabel: { fontSize: 18, fontWeight: '700', color: '#2d3436' },
  komalLine: { width: 14, height: 1.5, backgroundColor: '#2d3436', marginTop: 1 },
  teevraMark: { position: 'absolute', top: -8, width: 2, height: 10, backgroundColor: '#2d3436' },
  dotAbove: { position: 'absolute', top: -9, flexDirection: 'row', gap: 2 },
  dotBelow: { position: 'absolute', bottom: -8, flexDirection: 'row', gap: 2 },
  miniDot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#2d3436' },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 150,
    paddingLeft: 12,
  },
  verticalDropdownCard: {
    width: 125,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  verticalDropdownItem: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  verticalDropdownText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
  },
});

export default SwarKeyboard;
