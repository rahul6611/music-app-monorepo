import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Switch, Platform, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '@music-app/firebase';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@music-app/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@music-app/store';
import { useTheme } from '@music-app/store';
import { 
  getInstructorInvitations, 
  StudentInvitation 
} from '@music-app/firebase';
import { 
  fetchUserData, 
  getInstructorStudents, 
  unlinkStudentFromInstructor, 
  updateUserPreferences 
} from '@music-app/firebase';
import { 
  schedulePracticeReminder, 
  cancelAllScheduledNotifications,
  triggerInstantNotification 
} from '@music-app/firebase';

export default function Profile() {
  const { user } = useAuthStore();
  const theme = useTheme();
  const { themeMode, setThemeMode } = useThemeStore();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  const styles = createStyles(theme);

  const [invitations, setInvitations] = useState<StudentInvitation[]>([]);
  const [linkedStudents, setLinkedStudents] = useState<any[]>([]);
  const [removingStudent, setRemovingStudent] = useState<{ id: string; email: string } | null>(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    async function prepareProfile() {
      if (!user) return;
      try {
        const data = await fetchUserData(user.uid);
        if (data) {
          setProfileData(data);
          
          if (data.accountType === 'Instructor') {
             loadInstructorRelations(user.uid);
          }
        }
      } catch (e) {
        console.error('Error fetching profile:', e);
      } finally {
        setLoading(false);
      }
    }
    prepareProfile();
  }, [user]);

  const loadInstructorRelations = async (uId: string) => {
    setLoadingRelations(true);
    try {
      const [invData, stuData] = await Promise.all([
        getInstructorInvitations(uId),
        getInstructorStudents(uId),
      ]);
      setInvitations(invData);
      setLinkedStudents(stuData);
    } catch (e) {
      console.error('Error loading relations:', e);
    } finally {
      setLoadingRelations(false);
    }
  };

  const updateNotationSystem = async (system: string) => {
    if (!user || updating) return;
    setUpdating(true);
    try {
      await updateUserPreferences(user.uid, { notationSystem: system as any });
      setProfileData({ 
        ...profileData, 
        preferences: { ...profileData.preferences, notationSystem: system }
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to update notation system');
    } finally {
      setUpdating(false);
    }
  };
  
  const toggleReminders = async (enabled: boolean) => {
    if (!user || updating) return;
    setUpdating(true);
    try {
      if (enabled) {
        const scheduledId = await schedulePracticeReminder(18, 0);
        
        if (!scheduledId && Platform.OS !== 'web') {
           Alert.alert('Permissions Required', 'Please enable notifications in your device settings to receive practice reminders.');
        }

        await updateUserPreferences(user.uid, { 
          remindersEnabled: true,
          reminderTime: '18:00'
        });
      } else {
        await cancelAllScheduledNotifications();
        await updateUserPreferences(user.uid, { 
          remindersEnabled: false 
        });
      }
      setProfileData({ 
        ...profileData, 
        preferences: { ...profileData.preferences, remindersEnabled: enabled }
      });
    } catch (e: any) {
      console.error('Reminder update error:', e);
      Alert.alert('Error', 'Failed to update reminder settings. ' + (e.message || ''));
    } finally {
      setUpdating(false);
    }
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (event.type === 'set' && selectedDate && user) {
      const h = selectedDate.getHours();
      const m = selectedDate.getMinutes();
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      
      setUpdating(true);
      try {
        const scheduledId = await schedulePracticeReminder(h, m);
        if (!scheduledId && Platform.OS !== 'web') {
           Alert.alert('Permissions Required', 'Please enable notifications in your device settings to receive practice reminders.');
        }

        await updateUserPreferences(user.uid, { 
          reminderTime: timeStr,
          remindersEnabled: true
        });
        setProfileData({ 
          ...profileData, 
          preferences: { ...profileData.preferences, reminderTime: timeStr, remindersEnabled: true }
        });
      } catch (e: any) {
        console.error('Time update error:', e);
        Alert.alert('Error', 'Failed to update reminder time. ' + (e.message || ''));
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleRemoveStudent = async () => {
    if (!user || !removingStudent || isRemovingStudent) return;
    setIsRemovingStudent(true);
    try {
      await unlinkStudentFromInstructor(removingStudent.id, user.uid);
      await loadInstructorRelations(user.uid);
      setRemovingStudent(null);
      Alert.alert('Success', 'Student removed successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to remove student');
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (e) {
            console.error('Error signing out:', e);
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const notationSystems = [
    { id: 'hindustani_bhatkhande', label: 'Hindustani: Bhatkhande' },
    { id: 'carnatic', label: 'Carnatic' },
    { id: 'paluskar', label: 'Paluskar' }
  ];

  const getMergedStudents = () => {
    const rows: any[] = [];
    invitations.forEach(inv => {
      rows.push({
        key: inv.id,
        email: inv.studentEmail,
        invitedAt: inv.createdAt?.toLocaleDateString() || 'Recently',
        status: inv.status,
        name: ''
      });
    });

    linkedStudents.forEach(stu => {
       const alreadyIn = rows.some(r => r.email?.toLowerCase() === stu.emailAddress?.toLowerCase() || r.email?.toLowerCase() === stu.email?.toLowerCase());
       if (!alreadyIn) {
         rows.push({
           key: stu.firebaseUid,
           email: stu.emailAddress || stu.email,
           invitedAt: stu.joiningDate || 'Joined',
           status: 'accepted',
           name: `${stu.firstName || ''} ${stu.lastName || ''}`.trim()
         });
       } else {
         const index = rows.findIndex(r => r.email?.toLowerCase() === (stu.emailAddress || stu.email)?.toLowerCase());
         rows[index].status = 'accepted';
         rows[index].name = `${stu.firstName || ''} ${stu.lastName || ''}`.trim();
       }
    });
    return rows;
  };

  const mergedList = getMergedStudents();

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Branding Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
               <Text style={styles.avatarText}>
                 {profileData?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                 {profileData?.lastName?.[0]?.toUpperCase() || ''}
               </Text>
            </View>
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Feather name="camera" size={16} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>
            {profileData?.firstName} {profileData?.lastName || 'Scholar'}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          
          <View style={styles.badgeContainer}>
             <View style={styles.badge}>
                <Text style={styles.badgeText}>{profileData?.accountType?.toUpperCase() || 'STUDENT'}</Text>
             </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Music Styles</Text>
          <View style={styles.tagContainer}>
             {profileData?.musicSubStyleTypes?.length > 0 ? (
               profileData.musicSubStyleTypes.map((style: string) => (
                 <View key={style} style={styles.tag}>
                   <Text style={styles.tagText}>{style}</Text>
                 </View>
               ))
             ) : (
               <Text style={styles.emptyInfo}>No music styles assigned yet.</Text>
             )}
          </View>
        </View>

        {profileData?.accountType === 'Instructor' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Invited Students</Text>
              <TouchableOpacity style={styles.inviteBtn}>
                <Text style={styles.inviteBtnText}>Invite Student</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.studentList}>
              {loadingRelations ? (
                 <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 10 }} />
              ) : mergedList.length > 0 ? (
                mergedList.map((row, idx) => (
                  <View key={idx} style={styles.studentCard}>
                    <View style={styles.studentInfo}>
                      {row.name ? (
                        <Text style={styles.studentName}>{row.name}</Text>
                      ) : null}
                      <Text style={row.name ? styles.studentEmailSub : styles.studentEmail}>
                        {row.email}
                      </Text>
                      {row.invitedAt && (
                        <Text style={styles.studentDate}>Invited on {row.invitedAt}</Text>
                      )}
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      row.status === 'accepted' ? styles.statusSuccess : styles.statusPending
                    ]}>
                      <Text style={[
                        styles.statusText, 
                        row.status === 'accepted' ? styles.statusTextSuccess : styles.statusTextPending
                      ]}>
                        {row.status === 'accepted' ? 'Account Created' : 'Invited'}
                      </Text>
                    </View>
                    {row.status === 'accepted' && (
                      <TouchableOpacity 
                        onPress={() => setRemovingStudent({ id: row.key, email: row.email })}
                        style={styles.removeBtn}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Feather name="users" size={24} color={theme.textSecondary} />
                  <Text style={styles.emptyCardText}>No invited students yet</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Text style={styles.labelSmall}>Notation System</Text>
          
          <View style={styles.notationGrid}>
            {notationSystems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => updateNotationSystem(item.id)}
                style={[
                  styles.notationOption,
                  (profileData?.preferences?.notationSystem === item.id) && styles.notationOptionActive
                ]}
              >
                <View style={[
                  styles.radio,
                  (profileData?.preferences?.notationSystem === item.id) && styles.radioActive
                ]}>
                  {(profileData?.preferences?.notationSystem === item.id) && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.notationText,
                  (profileData?.preferences?.notationSystem === item.id) && styles.notationTextActive
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          <View style={styles.reminderCard}>
             <View style={styles.reminderInfo}>
                <Text style={styles.reminderLabel}>Practice Reminders</Text>
                <Text style={styles.reminderSub}>Get a daily nudge to keep practicing.</Text>
             </View>
             <Switch
                value={profileData?.preferences?.remindersEnabled || false}
                onValueChange={toggleReminders}
                trackColor={{ false: '#767577', true: theme.primary }}
                thumbColor={Platform.OS === 'ios' ? '#fff' : (profileData?.preferences?.remindersEnabled ? '#fff' : '#f4f3f4')}
             />
          </View>
          {profileData?.preferences?.remindersEnabled && (
            <TouchableOpacity 
              onPress={() => setShowTimePicker(true)}
              style={styles.timeSelector}
            >
              <Feather name="clock" size={14} color={theme.primary} />
              <Text style={styles.reminderTimeText}>
                Daily at {profileData?.preferences?.reminderTime || '18:00'} (Tap to change)
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={triggerInstantNotification}
            style={[styles.timeSelector, { marginTop: 15, backgroundColor: theme.primary }]}
          >
            <Feather name="bell" size={14} color="white" />
            <Text style={[styles.reminderTimeText, { color: 'white' }]}>
              Test Local Notification
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <DateTimePicker
              value={(() => {
                const [h, m] = (profileData?.preferences?.reminderTime || '18:00').split(':');
                const d = new Date();
                d.setHours(parseInt(h), parseInt(m));
                return d;
              })()}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Appearance</Text>
          <View style={styles.themeSwitcher}>
              {(['light', 'dark', 'auto'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={[
                    styles.themeBtn,
                    themeMode === mode && styles.themeBtnActive
                  ]}
                >
                  <Feather 
                    name={mode === 'auto' ? 'monitor' : mode === 'dark' ? 'moon' : 'sun'} 
                    size={16} 
                    color={themeMode === mode ? 'white' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.themeText,
                    themeMode === mode && styles.themeTextActive
                  ]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ) )}
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
             <Feather name="log-out" size={20} color={theme.danger} style={{ marginRight: 10 }} />
             <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={!!removingStudent}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Remove student?</Text>
            <Text style={styles.modalMessage}>
               This will remove {removingStudent?.email} from your students list. They will lose access to any instructor-owned content.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRemovingStudent(null)} style={styles.modalBtnCancel}>
                 <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleRemoveStudent} 
                style={styles.modalBtnConfirm}
                disabled={isRemovingStudent}
              >
                 {isRemovingStudent ? (
                    <ActivityIndicator color="white" size="small" />
                 ) : (
                    <Text style={styles.modalBtnConfirmText}>Remove</Text>
                 )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 35,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  avatarText: {
    color: 'white',
    fontSize: 36,
    fontWeight: '800',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.background === '#000000' ? '#27272a' : '#E5E7EB',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.card,
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.text,
  },
  userEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  badgeContainer: {
    marginTop: 15,
  },
  badge: {
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: theme.primary + '4D', 
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: theme.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  section: {
    paddingHorizontal: 25,
    marginTop: 35,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  inviteBtn: {
    backgroundColor: theme.background === '#000000' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  inviteBtnText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    backgroundColor: theme.card,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tagText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyInfo: {
    color: theme.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  studentList: {
    gap: 15,
  },
  studentCard: {
    backgroundColor: theme.card,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
     color: theme.text,
     fontSize: 15,
     fontWeight: '800',
     marginBottom: 2,
  },
  studentEmail: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  studentEmailSub: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  studentDate: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusTextPending: {
    color: '#f59e0b',
  },
  statusTextSuccess: {
    color: '#10b981',
  },
  removeBtn: {
    borderWidth: 1,
    borderColor: theme.danger + '4D',
    backgroundColor: theme.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeBtnText: {
    color: theme.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: theme.card,
    padding: 30,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  emptyCardText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  labelSmall: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 15,
  },
  notationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  notationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: '45%',
  },
  notationOptionActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primarySoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioActive: {
    borderColor: theme.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.primary,
  },
  notationText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  notationTextActive: {
    color: theme.text,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 15,
  },
  reminderInfo: {
    flex: 1,
    marginRight: 10,
  },
  reminderLabel: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  reminderSub: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  reminderTimeText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: theme.primarySoft,
    borderRadius: 10,
  },
  themeSwitcher: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: theme.card,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  themeBtnActive: {
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  themeText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  themeTextActive: {
    color: 'white',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 40,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: theme.danger + '33',
  },
  logoutBtnText: {
    color: theme.danger,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.card,
    borderRadius: 25,
    padding: 25,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalMessage: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 25,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: theme.border,
  },
  modalBtnCancelText: {
    color: theme.textSecondary,
    fontWeight: '700',
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: theme.danger,
  },
  modalBtnConfirmText: {
    color: 'white',
    fontWeight: '800',
  },
});
