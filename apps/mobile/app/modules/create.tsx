import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@music-app/store';
import { useAuthStore } from '@music-app/store';
import { createModule, updateModule, getModuleData } from '@music-app/firebase';
import ContentPickerModal from '../../components/modules/ContentPickerModal';
import { ModuleDifficultyLevel, ModuleContentItem } from '@music-app/types';

const { width } = Dimensions.get('window');

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
};

export default function CreateModuleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && windowWidth >= 768;
  const { user: currentUser } = useAuthStore();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const isEditMode = !!id;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<ModuleDifficultyLevel>('basic');
  const [items, setItems] = useState<ModuleContentItem[]>([]);
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadModule();
    }
  }, [id]);

  const loadModule = async () => {
    try {
      const data = await getModuleData(id!);
      if (data) {
        setName(data.moduleLabel);
        setDescription(data.moduleDescription || '');
        setDifficulty(data.moduleDifficultyLevel);
        setItems(data.moduleContentItems || []);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load module data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItems = (newSelectedItems: any[]) => {
    const formattedItems: ModuleContentItem[] = newSelectedItems.map((item, idx) => ({
      id: generateUUID(),
      type: item.type,
      contentId: item.contentId,
      contentName: item.contentName,
      order: items.length + idx
    }));

    const filtered = formattedItems.filter(newItem => 
        !items.some(existing => existing.contentId === newItem.contentId && existing.type === newItem.type)
    );

    setItems(prev => [...prev, ...filtered]);
  };

  const removeItem = (order: number) => {
    setItems(prev => prev.filter(i => i.order !== order).map((item, idx) => ({ ...item, order: idx })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a module name');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Empty Module', 'Please add at least one content item');
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        await updateModule(id, { 
          moduleLabel: name.trim(), 
          moduleDescription: description.trim(), 
          moduleContentItems: items, 
          moduleDifficultyLevel: difficulty 
        });
      } else {
        await createModule(
          name.trim(), 
          description.trim(), 
          items, 
          currentUser?.uid || '', 
          difficulty
        );
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save module');
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'raag': return '#F59E0B';
      case 'song': return '#3B82F6';
      case 'exerciseCollection': return '#10B981';
      default: return theme.primary;
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={[
          styles.scroll,
          isWebDesktop && {
            width: '100%',
            marginTop: 24,
            borderRadius: 24,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: theme.border,
            padding: 24,
            backgroundColor: theme.card,
          }
        ]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="chevron-left" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {isEditMode ? 'Edit Module' : 'Create Module'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Module Name</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Raag Yaman Fundamentals"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Description (Optional)</Text>
              <TextInput 
                style={[styles.input, styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Brief description of this module..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Difficulty Level</Text>
              <View style={[styles.segmentedControl, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {(['basic', 'intermediate', 'advanced'] as ModuleDifficultyLevel[]).map(lvl => (
                  <TouchableOpacity 
                    key={lvl}
                    style={[
                      styles.segment, 
                      difficulty === lvl && { backgroundColor: theme.primary }
                    ]}
                    onPress={() => setDifficulty(lvl)}
                  >
                    <Text style={[
                      styles.segmentText, 
                      { color: theme.textSecondary },
                      difficulty === lvl && { color: '#FFF' }
                    ]}>
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.contentSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.label, { color: theme.text }]}>Content Items</Text>
                <Text style={[styles.count, { color: theme.textSecondary }]}>{items.length} items</Text>
              </View>

              {items.length > 0 && (
                <View style={styles.itemsList}>
                   {items.map((item, idx) => (
                     <View key={item.id} style={[styles.itemRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                           <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>{item.type.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.itemInfo}>
                           <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{item.contentName}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeItem(item.order)} style={styles.removeBtn}>
                           <Feather name="trash-2" size={18} color={theme.danger} />
                        </TouchableOpacity>
                     </View>
                   ))}
                </View>
              )}

              <TouchableOpacity 
                style={[styles.addBtn, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}
                onPress={() => setShowPicker(true)}
              >
                <Feather name="plus" size={20} color={theme.primary} />
                <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Content</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actions}>
             <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: theme.primary }, (!name.trim() || items.length === 0) && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving || !name.trim() || items.length === 0}
             >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{isEditMode ? 'Update Module' : 'Create Module'}</Text>
                )}
             </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ContentPickerModal 
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleAddItems}
        userId={currentUser?.uid || ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    ...(Platform.OS === 'web' ? {
      maxWidth: 680,
      width: '100%',
      alignSelf: 'center',
    } : {}),
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  form: {
    padding: 20,
    gap: 24,
    ...(Platform.OS === 'web' ? {
      maxWidth: 680,
      width: '100%',
      alignSelf: 'center',
    } : {}),
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 4,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  contentSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemsList: {
    gap: 10,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  typeBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    padding: 20,
    ...(Platform.OS === 'web' ? {
      maxWidth: 680,
      width: '100%',
      alignSelf: 'center',
    } : {}),
  },
  saveBtn: {
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  }
});
