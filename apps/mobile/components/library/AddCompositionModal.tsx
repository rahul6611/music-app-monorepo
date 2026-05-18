import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';

interface AddCompositionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

const COMPOSITION_TYPES = [
  'Bada Khayal',
  'Chhota Khayal',
  'Bandish',
  'Composition',
  'Bhajan',
  'Dhrupad',
  'Gat',
  'Sadra',
  'Tarana',
  'Thumri',
  'Aalap',
  'Kirtan',
  'Kaida',
  'Laggi',
  'Paran',
  'Rela',
  'Theka'
];

const TAAL_OPTIONS = [
  'Teentaal — 16 beats',
  'Dadra — 6 beats',
  'Keherwa — 8 beats',
  'Jhaptal — 10 beats',
  'Rupak — 7 beats',
  'Ektal — 12 beats'
];

const LAYA_OPTIONS = ['Vilambit', 'Madhya', 'Drut'];

export default function AddCompositionModal({ visible, onClose, onSave, initialData }: AddCompositionModalProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [taal, setTaal] = useState('');
  const [laya, setLaya] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setType(initialData.type || '');
      setTaal(initialData.taal || '');
      setLaya(initialData.laya || '');
    } else {
      setName('');
      setType('');
      setTaal('');
      setLaya('');
    }
  }, [initialData, visible]);

  const handleSave = async () => {
    if (!name.trim() || !type) return;
    setSaving(true);
    try {
      await onSave({ name, type, taal, laya });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {initialData ? 'Edit Composition' : 'Add Composition'}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Feather name="x" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>COMPOSITION NAME</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Mero Piya..."
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>TYPE</Text>
                  <View style={styles.chipRow}>
                    {COMPOSITION_TYPES.map(t => (
                      <TouchableOpacity 
                        key={t}
                        style={[
                            styles.chip, 
                            { backgroundColor: theme.background, borderColor: theme.border },
                            type === t && { backgroundColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setType(t)}
                      >
                        <Text style={[styles.chipText, { color: theme.textSecondary }, type === t && { color: '#FFF' }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>TAAL (OPTIONAL)</Text>
                  <View style={styles.chipRow}>
                    {TAAL_OPTIONS.map(t => (
                      <TouchableOpacity 
                        key={t}
                        style={[
                            styles.chip, 
                            { backgroundColor: theme.background, borderColor: theme.border },
                            taal === t && { backgroundColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setTaal(t)}
                      >
                        <Text style={[styles.chipText, { color: theme.textSecondary }, taal === t && { color: '#FFF' }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>LAYA (OPTIONAL)</Text>
                  <View style={styles.chipRow}>
                    {LAYA_OPTIONS.map(l => (
                      <TouchableOpacity 
                        key={l}
                        style={[
                            styles.chip, 
                            { backgroundColor: theme.background, borderColor: theme.border },
                            laya === l && { backgroundColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setLaya(l)}
                      >
                        <Text style={[styles.chipText, { color: theme.textSecondary }, laya === l && { color: '#FFF' }]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.saveBtn, { backgroundColor: theme.primary }, (!name.trim() || !type) && { opacity: 0.5 }]}
                    onPress={handleSave}
                    disabled={saving || !name.trim() || !type}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>{initialData ? 'Update' : 'Save'} Composition</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  form: {
    padding: 24,
    gap: 24,
  },
  inputGroup: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  saveBtn: {
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  }
});
