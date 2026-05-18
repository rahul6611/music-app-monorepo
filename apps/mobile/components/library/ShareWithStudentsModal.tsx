import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { getInstructorStudents } from '@music-app/firebase';
import { syncItemShareWithStudents, ShareItemType } from '@music-app/firebase';
import type { StudentUser } from '@music-app/types';

interface ShareWithStudentsModalProps {
  visible: boolean;
  onClose: () => void;
  instructorId: string;
  itemType: ShareItemType;
  itemId: string;
  itemTitle: string;
}

const ShareWithStudentsModal: React.FC<ShareWithStudentsModalProps> = ({
  visible,
  onClose,
  instructorId,
  itemType,
  itemId,
  itemTitle
}) => {
  const theme = useTheme();
  const [students, setStudents] = useState<Array<StudentUser & { firebaseUid: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && instructorId && itemId) {
      loadData();
    }
  }, [visible, instructorId, itemId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allStudents = await getInstructorStudents(instructorId);
      setStudents(allStudents);

      const shared = allStudents.filter(student => {
        const sharedItems = (student as any).sharedItems || [];
        return sharedItems.some((item: any) => 
          item.itemType === itemType && 
          item.itemId === itemId && 
          item.instructorId === instructorId
        );
      }).map(s => s.firebaseUid);

      setSelectedIds(shared);
    } catch (err) {
      console.error('Error loading students:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map(s => s.firebaseUid));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await syncItemShareWithStudents(
        instructorId, 
        itemType, 
        itemId, 
        selectedIds, 
        students.map(s => s.firebaseUid)
      );
      onClose();
    } catch (err) {
      console.error('Error sharing:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.content, { backgroundColor: theme.card }]}>
              <View style={styles.handleContainer}>
                <View style={[styles.handle, { backgroundColor: theme.border }]} />
              </View>

              <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
                  <Feather name="share-2" size={20} color={theme.primary} />
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: theme.text }]}>Share with students</Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>{itemTitle}</Text>
                </View>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity style={styles.controlItem} onPress={selectAll}>
                  <MaterialCommunityIcons 
                    name={selectedIds.length === students.length && students.length > 0 ? "checkbox-marked" : "checkbox-blank-outline"} 
                    size={22} 
                    color={theme.primary} 
                  />
                  <Text style={[styles.controlText, { color: theme.textSecondary }]}>Select all students</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.listContainer}>
                {loading ? (
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                ) : students.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students found</Text>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {students.map(student => {
                      const isSelected = selectedIds.includes(student.firebaseUid);
                      return (
                        <TouchableOpacity 
                          key={student.firebaseUid}
                          style={[
                            styles.studentCard, 
                            { backgroundColor: theme.background },
                            isSelected && { borderColor: theme.primary, borderWidth: 1 }
                          ]}
                          onPress={() => toggleStudent(student.firebaseUid)}
                        >
                          <View style={styles.studentInfo}>
                            <Text style={[styles.studentName, { color: theme.text }]}>
                              {student.firstName} {student.lastName}
                            </Text>
                            <Text style={[styles.studentEmail, { color: theme.textSecondary }]}>
                              {student.emailAddress}
                            </Text>
                          </View>
                          <View style={[
                            styles.checkbox, 
                            isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
                          ]}>
                            {isSelected && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
                <TouchableOpacity onPress={onClose} disabled={saving} style={styles.cancelLink}>
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleSave} 
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  disabled={saving || loading}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Share Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  controlItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlText: {
    fontSize: 15,
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 24,
    marginBottom: 10,
    minHeight: 200,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
  },
  studentEmail: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderTopWidth: 1,
  },
  cancelLink: {
    padding: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '800',
  },
  saveBtn: {
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  }
});

export default ShareWithStudentsModal;
