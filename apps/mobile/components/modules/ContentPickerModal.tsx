import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
import { useTheme } from '@music-app/store';
import { getAllRaags, getGatBandishEntries } from '@music-app/firebase';
import { getAllExerciseCollections } from '@music-app/firebase';
import { ModuleContentItem, ModuleContentItemType } from '@music-app/types';

interface LibraryItem {
  id: string;
  name: string;
  description?: string;
}

interface ContentPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (items: any[]) => void;
  userId: string;
}

const ContentPickerModal: React.FC<ContentPickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  userId
}) => {
  const theme = useTheme();
  const [step, setStep] = useState<'type' | 'list' | 'compositions'>('type');
  const [selectedType, setSelectedType] = useState<ModuleContentItemType | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedParent, setSelectedParent] = useState<LibraryItem | null>(null);
  const [compositions, setCompositions] = useState<LibraryItem[]>([]);

  const types: { type: ModuleContentItemType; label: string; icon: string; color: string }[] = [
    { type: 'raag', label: 'Raag', icon: 'book', color: '#F59E0B' },
    { type: 'song', label: 'Song', icon: 'play', color: '#3B82F6' },
    { type: 'exerciseCollection', label: 'Exercise', icon: 'music', color: '#10B981' },
    { type: 'laya', label: 'Laya', icon: 'activity', color: '#8B5CF6' },
    { type: 'tihai', label: 'Tihai', icon: 'clock', color: '#EC4899' },
    { type: 'taal', label: 'Taal', icon: 'repeat', color: '#F97316' },
  ];

  useEffect(() => {
    if (!visible) {
      setStep('type');
      setSelectedType(null);
      setSelectedIds([]);
      setItems([]);
    }
  }, [visible]);

  const handleTypeSelect = async (type: ModuleContentItemType) => {
    setSelectedType(type);
    setLoading(true);
    setStep('list');
    try {
      let fetched: any[] = [];
      if (type === 'exerciseCollection') {
        fetched = await getAllExerciseCollections(userId);
        setItems(fetched.map(i => ({ id: i.id, name: i.title, description: i.description })));
      } else {
        const coll = type === 'song' ? 'songs' : type === 'laya' ? 'laya' : type === 'tihai' ? 'tihai' : type === 'taal' ? 'taals' : 'raags';
        fetched = await getAllRaags(coll, userId);
        setItems(fetched.map(i => ({ id: i.id, name: i.name, description: i.description })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = async (item: LibraryItem) => {
    if ((selectedType === 'raag' || selectedType === 'song')) {
      setSelectedParent(item);
      setLoading(true);
      setStep('compositions');
      try {
        const coll = selectedType === 'song' ? 'songs' : 'raags';
        const fetched = await getGatBandishEntries(item.id, coll);
        if (fetched.length === 0) {
            onSelect([{
                contentId: item.id,
                contentName: item.name,
                type: selectedType
            }]);
            onClose();
            return;
        }
        setCompositions(fetched.map(i => ({ 
            id: i.id!, 
            name: i.name, 
            description: [i.type, i.taal].filter(Boolean).join(' • ') 
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    } else {
        toggleSelection(item.id);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    const finalItems = selectedIds.map(id => {
        const item = step === 'compositions' ? compositions.find(c => c.id === id) : items.find(i => i.id === id);
        return {
            contentId: id,
            contentName: step === 'compositions' && selectedParent ? `${selectedParent.name} — ${item?.name}` : item?.name,
            type: selectedType
        };
    });
    onSelect(finalItems);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              {step !== 'type' && (
                <TouchableOpacity onPress={() => setStep(step === 'compositions' ? 'list' : 'type')} style={styles.backBtn}>
                  <Feather name="chevron-left" size={24} color={theme.text} />
                </TouchableOpacity>
              )}
              <Text style={[styles.title, { color: theme.text }]}>
                {step === 'type' ? 'Choose Content Type' : step === 'list' ? `Select ${selectedType}` : 'Select Composition'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.body}>
            {step === 'type' ? (
              <ScrollView contentContainerStyle={styles.typeGrid}>
                {types.map(t => (
                  <TouchableOpacity 
                    key={t.type} 
                    style={[styles.typeCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => handleTypeSelect(t.type)}
                  >
                    <View style={[styles.iconBox, { backgroundColor: t.color + '20' }]}>
                      <Feather name={t.icon as any} size={24} color={t.color} />
                    </View>
                    <Text style={[styles.typeLabel, { color: theme.text }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }}>
                {loading ? (
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                ) : (
                  <ScrollView contentContainerStyle={styles.list}>
                    {(step === 'list' ? items : compositions).map(item => {
                      const isSelected = selectedIds.includes(item.id);
                      const isPickable = (step === 'compositions' || selectedType === 'exerciseCollection' || selectedType === 'laya' || selectedType === 'tihai' || selectedType === 'taal');
                      
                      return (
                        <TouchableOpacity 
                          key={item.id} 
                          style={[
                            styles.listItem, 
                            { backgroundColor: theme.background, borderColor: theme.border },
                            isSelected && { borderColor: theme.primary, borderWidth: 1 }
                          ]}
                          onPress={() => isPickable ? toggleSelection(item.id) : handleItemPress(item)}
                        >
                          <View style={styles.itemInfo}>
                            <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                            {item.description && (
                              <Text style={[styles.itemDesc, { color: theme.textSecondary }]} numberOfLines={1}>{item.description}</Text>
                            )}
                          </View>
                          {isPickable && (
                            <View style={[
                              styles.checkbox, 
                              isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
                            ]}>
                              {isSelected && <Feather name="check" size={14} color="#FFF" />}
                            </View>
                          )}
                          {!isPickable && <Feather name="chevron-right" size={20} color={theme.textSecondary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {selectedIds.length > 0 && (
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={handleConfirm}>
                <Text style={styles.confirmText}>Add Selected ({selectedIds.length})</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  content: {
    height: Platform.OS === 'web' ? '70%' : '80%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      maxWidth: 550,
      width: '90%',
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    } : {}),
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  typeGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'space-between',
  },
  typeCard: {
    width: Platform.OS === 'web' ? 150 : (width - 56) / 2,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    padding: 20,
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  confirmBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  }
});

export default ContentPickerModal;
