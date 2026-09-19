import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Keyboard, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import {
  COMPOSITION_TYPES, COMPOSITION_TAALS, COMPOSITION_LAYAS,
  initialCompositionForm, compositionPayload, CompositionFormData, CompositionCategory,
} from './compositionForm';

interface AddCompositionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: ReturnType<typeof compositionPayload>) => Promise<void>;
  initialData?: Partial<CompositionFormData>;
}
type Selection = 'type' | 'taal' | 'laya';
const selectionOptions = { type: COMPOSITION_TYPES, taal: COMPOSITION_TAALS, laya: COMPOSITION_LAYAS };
const selectionLabels = { type: 'Type', taal: 'Taal', laya: 'Laya' };

export default function AddCompositionModal({ visible, onClose, onSave, initialData }: AddCompositionModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const wide = (width - insets.left - insets.right) / fontScale >= 600;
  const [form, setForm] = useState(() => initialCompositionForm(initialData));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    setForm(initialCompositionForm(initialData));
    setSelection(null);
    setError('');
  }, [initialData, visible]);
  const valid = !!form.name.trim() && (form.category === 'aalap' || !!form.type);
  const close = () => { if (!saving) onClose(); };
  const setCategory = (category: CompositionCategory) => {
    if (category === form.category) return;
    setForm(current => ({ ...current, category, type: category === 'aalap' ? 'Aalap' : '' }));
    setSelection(null);
  };
  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(compositionPayload(form));
      onClose();
    } catch {
      setError('Could not save the composition. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const fieldColors = { backgroundColor: theme.background, borderColor: theme.border };
  const selectField = (field: Selection) => <View style={[styles.field, wide && styles.wideField]}>
    <Text style={[styles.label, { color: theme.text }]}>{selectionLabels[field]}:</Text>
    <Pressable accessibilityRole="combobox" accessibilityLabel={selectionLabels[field]}
      accessibilityValue={{ text: form[field] || `Select ${selectionLabels[field]}` }}
      accessibilityState={{ expanded: selection === field, disabled: saving }} disabled={saving}
      onPress={() => { Keyboard.dismiss(); setSelection(field); }} style={[styles.input, styles.select, fieldColors]}>
      <Text style={[styles.selectText, { color: form[field] ? theme.text : theme.textSecondary }]}>
        {form[field] || `-- Select ${selectionLabels[field]} --`}
      </Text>
      <Feather name="chevron-down" size={18} color={theme.textSecondary} />
    </Pressable>
  </View>;

  return <Modal visible={visible} transparent animationType="fade"
    onRequestClose={() => selection ? setSelection(null) : close()}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.overlay, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12),
        paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12) }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss composition form" disabled={saving} />
      <View accessibilityElementsHidden={!!selection} importantForAccessibility={selection ? 'no-hide-descendants' : 'auto'}
        style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {initialData ? 'Edit Composition' : 'Add New Composition'}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close composition form" disabled={saving}
            onPress={close} style={styles.closeButton}><Feather name="x" size={22} color={theme.textSecondary} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.form}>
          <Text style={[styles.categoryLabel, { color: theme.textSecondary }]}>CATEGORY:</Text>
          <View style={styles.categories}>
            {([['aalap', 'Aalap (Rhythm free)'], ['gat_bandish', 'Rhythm Based']] as const).map(([category, label]) =>
              <Pressable key={category} accessibilityRole="radio" accessibilityLabel={label}
                accessibilityState={{ checked: form.category === category, disabled: saving }} disabled={saving}
                onPress={() => setCategory(category)} style={[styles.category, { borderColor: theme.border }]}>
                <View style={[styles.radio, { borderColor: form.category === category ? theme.primary : theme.border }]}>
                  {form.category === category && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
                </View>
                <Text style={[styles.categoryText, { color: theme.text }]}>{label}</Text>
              </Pressable>)}
          </View>
          <View style={[styles.fieldRow, wide && styles.wideRow]}>
            {form.category === 'gat_bandish' && selectField('type')}
            <View style={[styles.field, wide && styles.wideField]}>
              <Text style={[styles.label, { color: theme.text }]}>Name:</Text>
              <TextInput accessibilityLabel="Composition name" editable={!saving} value={form.name}
                onChangeText={name => setForm(current => ({ ...current, name }))}
                placeholder="Enter composition name" placeholderTextColor={theme.textSecondary}
                style={[styles.input, fieldColors, { color: theme.text }]} />
            </View>
          </View>
          {form.category === 'gat_bandish' && <View style={[styles.fieldRow, wide && styles.wideRow]}>
            {selectField('taal')}{selectField('laya')}
          </View>}
          {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
        </ScrollView>
        <View style={[styles.footer, { borderColor: theme.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Save composition" disabled={!valid || saving}
            accessibilityState={{ disabled: !valid || saving }} onPress={handleSave}
            style={[styles.action, { backgroundColor: theme.primary }, (!valid || saving) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionText, { color: '#fff' }]}>Save</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={close}
            style={[styles.action, { backgroundColor: theme.inputBackground }]}>
            <Text style={[styles.actionText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
      {selection && <View style={[styles.optionOverlay, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24),
        paddingLeft: Math.max(insets.left, 24), paddingRight: Math.max(insets.right, 24) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelection(null)} accessibilityLabel="Close options" />
        <View style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.header, { borderColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Select {selectionLabels[selection]}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={() => setSelection(null)}
              style={styles.closeButton}><Feather name="x" size={22} color={theme.textSecondary} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {['', ...selectionOptions[selection]].map(value => <Pressable key={value} accessibilityRole="radio"
              accessibilityState={{ checked: form[selection] === value }}
              onPress={() => { setForm(current => ({ ...current, [selection]: value })); setSelection(null); }}
              style={[styles.option, form[selection] === value && { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.selectText, { color: theme.text }]}>{value || `-- Select ${selectionLabels[selection]} --`}</Text>
              {form[selection] === value && <Feather name="check" size={18} color={theme.primary} />}
            </Pressable>)}
          </ScrollView>
        </View>
      </View>}
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  container: { width: '100%', maxWidth: 920, maxHeight: '100%', borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 1 },
  title: { flex: 1, fontSize: 18, fontWeight: '600', flexShrink: 1 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  form: { padding: 16, gap: 20 },
  categoryLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 6, padding: 10, minHeight: 44, maxWidth: '100%' },
  categoryText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  fieldRow: { gap: 12 },
  wideRow: { flexDirection: 'row' },
  field: { minWidth: 0, gap: 10 },
  wideField: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 5, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectText: { flex: 1, flexShrink: 1, fontSize: 14 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, padding: 16, borderTopWidth: 1 },
  action: { minHeight: 44, minWidth: 76, borderRadius: 6, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  optionOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  optionCard: { width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12 },
});
