import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Modal,
  Linking,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@music-app/store';
import { useTheme } from '@music-app/store';
import { fetchUserData, getInstructorStudents } from '@music-app/firebase';
import PracticeTrackModal from './PracticeTrackModal';
import {
  getClassAssignmentsByStudent,
  createAssignmentSubmission,
  getSubmissionsByStudent,
  deleteClassAssignment,
  duplicatePracticePlan,
  createClassAssignment,
  updateClassAssignment,
} from '@music-app/firebase';
import WeeklyPracticePlanModal, { type PracticePart } from './WeeklyPracticePlanModal';
import type { StudentUser } from '@music-app/types';
import type { ClassAssignment, AssignmentItem, AssignmentSubmission } from '@music-app/types';

const { width } = Dimensions.get('window');

const t = (key: string, options?: any) => {
  const translations: Record<string, string> = {
    'students.tabStudents': 'Students',
    'students.tabClasses': 'Classes',
    'students.tabReview': 'Review',
    'students.tabSchedule': 'Schedule',
    'students.selectStudent': 'Select Student',
    'students.loading': 'Loading...',
    'students.selectName': '-- Select Name --',
    'students.assignClass': 'Assign Class',
    'students.yourStudents': 'Your Students',
    'students.noStudentsYet': 'No students yet.',
    'students.noPlansYetStudent': 'No practice plans assigned yet.',
    'students.today': 'Today',
    'students.yesterday': 'Yesterday',
    'students.reps': 'reps',
    'students.raag': 'Raag',
    'students.song': 'Song',
    'students.exercise': 'Exercise',
    'students.patterns': 'Patterns',
    'students.raags': 'Raags',
    'students.songs': 'Songs',
    'students.tabla': 'Tabla',
    'students.metronome': 'Metronome',
    'students.none': 'None',
    'students.deletePracticePlan': 'Delete Practice Plan',
    'students.editPracticePlan': 'Edit Practice Plan',
    'students.duplicatePracticePlan': 'Duplicate Practice Plan',
    'students.failedToDeletePracticePlan': 'Failed to delete practice plan.',
    'students.failedToDuplicatePracticePlan': 'Failed to duplicate practice plan.',
    'practicePlanModal.min': 'min',
    'practicePlanModal.distributeMinutes': 'Distribute {{minutes}} minutes of practicing:',
  };
  let text = translations[key] || key;
  if (options) {
    Object.keys(options).forEach(k => {
      text = text.replace(`{{${k}}}`, options[k]);
    });
  }
  return text;
};

export const PRACTICE_PLAN_PART_COLORS = [
  { bg: '#97B6FF', cardBg: '#E8EFFF', border: '#97B6FF', text: '#1E3A8A' },
  { bg: '#BF9FF5', cardBg: '#F3EDFC', border: '#BF9FF5', text: '#4C1D95' },
  { bg: '#6ADD90', cardBg: '#E8F9EE', border: '#6ADD90', text: '#14532D' },
  { bg: '#EA9ED5', cardBg: '#FDF2F9', border: '#EA9ED5', text: '#831843' },
  { bg: '#E1D97E', cardBg: '#FBF9E8', border: '#E1D97E', text: '#713F12' },
];

const StudentsNew = () => {
  const theme = useTheme();
  const { user: currentUser } = useAuthStore();
  const [students, setStudents] = useState<Array<StudentUser & { firebaseUid: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classAssignments, setClassAssignments] = useState<ClassAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [practiceTracking, setPracticeTracking] = useState<Record<string, { count: number; minutes: number }>>({});
  const [practiceSubmissions, setPracticeSubmissions] = useState<Record<string, any[]>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [isStudentPickerVisible, setIsStudentPickerVisible] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ClassAssignment | null>(null);
  const [activePlanMenu, setActivePlanMenu] = useState<ClassAssignment | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingAssignment, setTrackingAssignment] = useState<AssignmentItem | null>(null);
  const [trackingClassId, setTrackingClassId] = useState('');
  const [trackingInstructorId, setTrackingInstructorId] = useState('');

  const isInstructorView = userData?.accountType === 'Instructor';
  const effectiveStudentId = isInstructorView ? selectedStudentId : currentUser?.uid || '';

  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchUserData(currentUser.uid);
        setUserData(data);

        let studentList: Array<StudentUser & { firebaseUid: string }> = [];

        if (data?.accountType === 'Instructor') {
          studentList = await getInstructorStudents(currentUser.uid);
        } else if (data?.accountType === 'Student' && data.instructorIds) {
          for (const instructorId of data.instructorIds) {
            const list = await getInstructorStudents(instructorId);
            studentList.push(...list);
          }
          studentList = Array.from(
            new Map(studentList.map((s) => [s.firebaseUid, s])).values()
          );
        }

        studentList.sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );
        setStudents(studentList);
        
        if (data?.accountType === 'Student') {
            setSelectedStudentId(currentUser.uid);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  const loadAssignmentsForStudent = useCallback(
    async (studentId: string) => {
      if (!currentUser || !studentId) {
        setClassAssignments([]);
        return;
      }

      try {
        setLoadingAssignments(true);
        const assignments = await getClassAssignmentsByStudent(studentId);
        setClassAssignments(assignments);

        const submissions = await getSubmissionsByStudent(studentId);
        const trackingMap: Record<string, { count: number; minutes: number }> = {};
        const submissionsMap: Record<string, any[]> = {};
        
        for (const sub of submissions) {
          const classAssignment = assignments.find(a => a.id === sub.classAssignmentId);
          const trackKey = `${sub.classAssignmentId}_${sub.assignmentId}`;
          
          if (!submissionsMap[trackKey]) {
            submissionsMap[trackKey] = [];
          }
          submissionsMap[trackKey].push(sub);

          if (classAssignment) {
            const assignmentItem = classAssignment.assignments.find(a => a.id === sub.assignmentId);
            const assignmentMinutes = (assignmentItem as any)?.minutes || 0;
            const count = sub.practiceCount ?? 1;
            
            if (!trackingMap[trackKey]) {
              trackingMap[trackKey] = { count: 0, minutes: 0 };
            }
            trackingMap[trackKey].count += count;
            trackingMap[trackKey].minutes += count * assignmentMinutes;
          }
        }
        setPracticeTracking(trackingMap);
        setPracticeSubmissions(submissionsMap);
      } catch (error) {
        console.error('Error loading assignments:', error);
      } finally {
        setLoadingAssignments(false);
      }
    },
    [currentUser],
  );

  useEffect(() => {
    if (effectiveStudentId) {
      loadAssignmentsForStudent(effectiveStudentId);
    }
  }, [effectiveStudentId, loadAssignmentsForStudent]);

  const sortedDates = useMemo(() => {
    const classesByDate = new Map<string, ClassAssignment[]>();
    for (const ca of classAssignments) {
      const date = ca.classDate;
      if (!classesByDate.has(date)) classesByDate.set(date, []);
      classesByDate.get(date)!.push(ca);
    }
    const dates = Array.from(classesByDate.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    return dates.map(date => ({
      date,
      assignments: classesByDate.get(date)!.sort((a, b) => {
        const tA = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds || 0;
        const tB = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds || 0;
        return tB - tA;
      })
    }));
  }, [classAssignments]);

  const handleSavePlan = async (parts: PracticePart[], date?: string) => {
      if (!currentUser || !effectiveStudentId) return;
      
      try {
          setIsSavingPlan(true);
          const partMinutes = parts.map(p => p.minutes);
          const assignments: any[] = [];
          parts.forEach(p => {
              p.exercises.forEach(ex => {
                  assignments.push({
                      id: ex.id,
                      type: ex.contentType,
                      itemId: ex.contentId,
                      title: ex.contentName,
                      bpm: ex.bpms,
                      repetitions: ex.repetitions,
                      accompanimentType: ex.accompaniment,
                      minutes: p.minutes,
                      parentItemId: ex.parentContentId
                  });
              });
          });

          if (editingPlan) {
              await updateClassAssignment(editingPlan.id, {
                  classDate: date || editingPlan.classDate,
                  partMinutes,
                  assignments
              });
          } else {
              await createClassAssignment(
                  effectiveStudentId,
                  currentUser.uid,
                  date || new Date().toISOString().slice(0, 10),
                  partMinutes,
                  assignments
              );
          }
          
          setIsPlanModalOpen(false);
          setEditingPlan(null);
          loadAssignmentsForStudent(effectiveStudentId);
      } catch (error) {
          console.error('Error saving plan:', error);
          Alert.alert('Error', 'Failed to save practice plan.');
      } finally {
          setIsSavingPlan(false);
      }
  };

  const handleDeletePlan = (id: string) => {
      if (Platform.OS === 'web') {
          const confirmed = window.confirm('Are you sure you want to delete this practice plan?');
          if (confirmed) {
              (async () => {
                  try {
                      await deleteClassAssignment(id);
                      loadAssignmentsForStudent(effectiveStudentId);
                  } catch (e) {
                      alert('Failed to delete plan.');
                  }
              })();
          }
          return;
      }
      Alert.alert(
          'Delete Plan',
          'Are you sure you want to delete this practice plan?',
          [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                  try {
                      await deleteClassAssignment(id);
                      loadAssignmentsForStudent(effectiveStudentId);
                  } catch (e) {
                      Alert.alert('Error', 'Failed to delete plan.');
                  }
              }}
          ]
      );
  };

  const handleDuplicatePlan = async (ca: ClassAssignment) => {
      if (!currentUser) return;
      try {
          const today = new Date().toISOString().slice(0, 10);
          await duplicatePracticePlan(ca.id, ca.studentId, currentUser.uid, today);
          loadAssignmentsForStudent(ca.studentId);
          Alert.alert('Success', 'Plan duplicated for today.');
      } catch (e) {
          Alert.alert('Error', 'Failed to duplicate plan.');
      }
  };

  const handleTrackSave = async (data: any) => {
      if (!currentUser) return;
      try {
          await createAssignmentSubmission(
              data.assignmentId,
              data.classAssignmentId,
              currentUser.uid,
              trackingInstructorId || 'self',
              data.mediaUrl,
              data.mediaType,
              'practice_session',
              data.duration || 0,
              data.practiceCount
          );
          loadAssignmentsForStudent(effectiveStudentId);
          setIsTrackingModalOpen(false);
      } catch (error) {
          console.error('Error saving practice:', error);
          Alert.alert('Error', 'Failed to save practice session');
      }
  };

  const formatDateLabel = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return t('students.today');
    if (d.toDateString() === yesterday.toDateString()) return t('students.yesterday');

    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderProgressBar = (partMinutes: number[]) => {
    const totalMinutes = partMinutes.reduce((s, m) => s + m, 0);
    if (totalMinutes === 0) return null;

    return (
      <View style={styles.progressBarContainer}>
        {partMinutes.map((minutes, i) => {
          const color = PRACTICE_PLAN_PART_COLORS[i % PRACTICE_PLAN_PART_COLORS.length];
          const flex = minutes / totalMinutes;
          return (
            <View
              key={i}
              style={[
                styles.progressBarSegment,
                { flex, backgroundColor: color.bg, borderColor: color.border }
              ]}
            >
              <Text style={[styles.progressBarText, { color: color.text }]} numberOfLines={1}>
                {minutes}m
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderAssignmentItem = (assignment: AssignmentItem, classAssignment: ClassAssignment, partMinutes: number[]) => {
    const minutes = assignment.minutes || 0;
    const reps = assignment.repetitions;
    const partColorIdx = partMinutes.indexOf(minutes);
    const color = PRACTICE_PLAN_PART_COLORS[partColorIdx >= 0 ? partColorIdx : 0];
    
    const trackKey = `${classAssignment.id}_${assignment.id}`;
    const tracking = practiceTracking[trackKey];
    const isExpanded = expandedHistory[trackKey];

    return (
      <View key={assignment.id} style={[styles.assignmentRow, { borderLeftColor: color.border, backgroundColor: color.cardBg }]}>
        <View style={styles.assignmentHeaderRow}>
          <View style={[styles.typeBadge, { backgroundColor: color.bg }]}>
            <Text style={[styles.typeBadgeText, { color: color.text }]}>
                {assignment.type === 'raag' ? t('students.raag') : assignment.type === 'song' ? t('students.song') : t('students.exercise')}
            </Text>
          </View>
          <Text style={[styles.assignmentTitle, { color: color.text }]} numberOfLines={1}>{assignment.title}</Text>
          <View style={styles.assignmentPills}>
            {minutes > 0 && (
                <View style={[styles.pill, { backgroundColor: color.bg, borderColor: color.border }]}>
                    <Text style={[styles.pillText, { color: color.text }]}>{minutes}m</Text>
                </View>
            )}
             {reps != null && (
                <View style={[styles.pill, { backgroundColor: color.bg, borderColor: color.border }]}>
                    <Text style={[styles.pillText, { color: color.text }]}>{reps}x</Text>
                </View>
            )}
          </View>
        </View>

        <View style={styles.assignmentMetaRow}>
            <Text style={[styles.metaText, { color: '#4b5563' }]}>
                {[
                    assignment.bpm ? `BPM ${Array.isArray(assignment.bpm) ? assignment.bpm.join(', ') : assignment.bpm}` : null,
                    assignment.accompanimentType ? (assignment.accompanimentType === 'tabla' ? t('students.tabla') : assignment.accompanimentType === 'metronome' ? t('students.metronome') : t('students.none')) : null
                ].filter(Boolean).join(' • ')}
            </Text>
        </View>

        {tracking && (
            <View style={styles.trackActionRow}>
                <TouchableOpacity 
                    onPress={() => setExpandedHistory(prev => ({ ...prev, [trackKey]: !isExpanded }))}
                    style={[styles.historyPill, { backgroundColor: theme.primarySoft }]}
                >
                    <Text style={[styles.historyPillText, { color: theme.primary }]}>
                        {isExpanded ? 'Hide History' : 'View History'} ({practiceSubmissions[trackKey]?.length || 0})
                    </Text>
                </TouchableOpacity>
                
                <Text style={[styles.trackingSummaryText, { color: theme.textSecondary, flex: 1, textAlign: 'right' }]}>
                    {tracking.count} sessions · {tracking.minutes}m total
                </Text>
            </View>
        )}

        {isExpanded && (
            <View style={styles.historyList}>
                {practiceSubmissions[trackKey]?.map((sub: any, idx: number) => (
                    <View key={sub.id} style={[styles.historyItem, { backgroundColor: 'rgba(0,0,0,0.02)' }]}>
                        <View style={styles.historyMeta}>
                            <View style={[styles.historyIndex, { backgroundColor: theme.border }]}>
                                <Text style={[styles.historyIndexText, { color: theme.textSecondary }]}>
                                    #{practiceSubmissions[trackKey].length - idx}
                                </Text>
                            </View>
                            <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                                {sub.practiceCount || 1} reps ({((sub.practiceCount || 1) * ((assignment as any)?.minutes || 0))} min) · {
                                    sub.submittedAt?.toMillis 
                                        ? new Date(sub.submittedAt.toMillis()).toLocaleDateString() 
                                        : sub.submittedAt?.seconds
                                            ? new Date(sub.submittedAt.seconds * 1000).toLocaleDateString()
                                            : new Date(sub.submittedAt).toLocaleDateString()
                                }
                            </Text>
                        </View>
                        {sub.mediaUrl && (
                            <TouchableOpacity onPress={() => Linking.openURL(sub.mediaUrl)} style={styles.mediaLink}>
                                <MaterialIcons 
                                    name={sub.mediaType === 'video' ? 'videocam' : 'mic'} 
                                    size={14} 
                                    color={theme.primary} 
                                    style={{ marginRight: 4 }}
                                />
                                <Text style={[styles.mediaLinkText, { color: theme.primary }]}>
                                    {sub.mediaType === 'video' ? 'Watch Video' : 'Listen Audio'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
        )}

        {!isInstructorView && (
            <View style={styles.trackActionRow}>
                <TouchableOpacity 
                    onPress={() => {
                        setTrackingAssignment(assignment);
                        setTrackingClassId(classAssignment.id);
                        setTrackingInstructorId(classAssignment.instructorId);
                        setIsTrackingModalOpen(true);
                    }}
                    style={[styles.trackButtonLarge, { backgroundColor: theme.primary }]}
                >
                    <MaterialIcons name="play-arrow" size={20} color="#FFF" />
                    <Text style={[styles.trackButtonLargeText, { color: '#FFF' }]}>Track Practice</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>
    );
  };

  const renderClassCard = (ca: ClassAssignment) => {
    const partMinutes = ca.partMinutes || [10, 20, 30];
    const assignmentsByType = {
        exercise: (ca.assignments || []).filter((a) => a.type === 'exercise' || a.type === 'taal'),
        raag: (ca.assignments || []).filter((a) => a.type === 'raag'),
        song: (ca.assignments || []).filter((a) => a.type === 'song'),
    };

    return (
      <View key={ca.id} style={[styles.classCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.textSecondary }]}>
                {t('practicePlanModal.distributeMinutes', { minutes: partMinutes.reduce((s,m)=>s+m,0) })}
            </Text>
            {isInstructorView && (
                <TouchableOpacity 
                    style={styles.moreButton}
                    onPress={() => setActivePlanMenu(ca)}
                >
                    <MaterialIcons name="more-vert" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
            )}
        </View>

        {renderProgressBar(partMinutes)}

        {(() => {
            const totalGoal = partMinutes.reduce((s, m) => s + m, 0) || 60;
            
            const trackedSegments: { minutes: number; color: string }[] = [];
            (ca.assignments || []).forEach((a, idx) => {
                const tk = `${ca.id}_${a.id}`;
                const m = practiceTracking[tk]?.minutes || 0;
                if (m > 0) {
                    const colorIdx = partMinutes.findIndex(pm => pm === (a as any).minutes);
                    const color = PRACTICE_PLAN_PART_COLORS[colorIdx >= 0 ? colorIdx : idx % PRACTICE_PLAN_PART_COLORS.length].bg;
                    trackedSegments.push({ minutes: m, color });
                }
            });

            const totalPracticed = trackedSegments.reduce((s, seg) => s + seg.minutes, 0);
            if (totalPracticed === 0) return null;

            const denom = totalPracticed > totalGoal ? totalPracticed : totalGoal;
            const remainderMin = Math.max(0, totalGoal - totalPracticed);

            return (
                <View style={styles.practiceProgressSection}>
                    <View style={styles.practiceProgressBar}>
                        {trackedSegments.map((seg, i) => (
                            <View 
                                key={i}
                                style={[
                                    styles.practiceProgressFillSegment, 
                                    { 
                                        width: `${(seg.minutes / denom) * 100}%`,
                                        backgroundColor: seg.color 
                                    }
                                ]} 
                            >
                                <Text style={[styles.barInsideText, { color: '#000' }]} numberOfLines={1}>
                                    {seg.minutes} min
                                </Text>
                            </View>
                        ))}
                        
                        {remainderMin > 0 && (
                            <View 
                                style={[
                                    styles.practiceProgressRemainingPart,
                                    { width: `${(remainderMin / denom) * 100}%`, backgroundColor: 'rgba(0,0,0,0.05)' }
                                ]}
                            >
                                <Text style={[styles.barInsideText, { color: theme.textSecondary }]} numberOfLines={1}>
                                    {remainderMin} min
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.practiceProgressLabelRow}>
                         <Text style={[styles.practiceProgressFooter, { color: theme.textSecondary, flex: 1, textAlign: 'right' }]}>
                            {totalPracticed}/{totalGoal} min practiced
                         </Text>
                    </View>
                </View>
            );
        })()}

        <View style={styles.assignmentsList}>
            {Object.entries(assignmentsByType).map(([type, items]) => {
                if (items.length === 0) return null;
                return (
                    <View key={type} style={styles.typeSection}>
                        <View style={styles.typeSectionHeader}>
                             <View style={[styles.typeDot, { backgroundColor: theme.primary }]} />
                             <Text style={[styles.typeSectionTitle, { color: theme.text }]}>
                                {type === 'exercise' ? t('students.patterns') : type === 'raag' ? t('students.raags') : t('students.songs')}
                             </Text>
                        </View>
                        {items.map(item => renderAssignmentItem(item, ca, partMinutes))}
                    </View>
                );
            })}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isInstructorView ? 'Students' : 'Class'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {isInstructorView && (
              <TouchableOpacity 
                  style={[styles.headerButton, { backgroundColor: theme.primarySoft }]}
                  onPress={() => setIsStudentPickerVisible(true)}
              >
                  <MaterialIcons name="people" size={20} color={theme.primary} />
                  <Text style={[styles.headerButtonText, { color: theme.primary }]}>Select Student</Text>
              </TouchableOpacity>
          )}
          <TouchableOpacity 
              style={[styles.iconAddBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                  setEditingPlan(null);
                  setIsPlanModalOpen(true);
              }}
          >
              <MaterialIcons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
          {loadingAssignments || loading ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : sortedDates.length === 0 ? (
              <View style={styles.emptyState}>
                  <MaterialIcons name="assignment" size={64} color={theme.border} />
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                      {effectiveStudentId ? t('students.noPlansYetStudent') : 'Select a student to view plans'}
                  </Text>
              </View>
          ) : (
              <FlatList
                data={sortedDates}
                keyExtractor={item => item.date}
                contentContainerStyle={styles.datesList}
                renderItem={({ item }) => (
                    <View style={styles.dateSection}>
                        <View style={styles.dateHeader}>
                            <MaterialIcons name="calendar-today" size={16} color={theme.textSecondary} />
                            <Text style={[styles.dateTitle, { color: theme.text }]}>{formatDateLabel(item.date)}</Text>
                        </View>
                        <View style={Platform.OS === 'web' ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16 } : null}>
                            {item.assignments.map(ca => (
                                <View key={ca.id} style={Platform.OS === 'web' ? { width: '48%', minWidth: 320, marginBottom: 12 } : null}>
                                    {renderClassCard(ca)}
                                </View>
                            ))}
                        </View>
                    </View>
                )}
              />
          )}
      </View>

      {isInstructorView && (
          <Modal
            visible={isStudentPickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setIsStudentPickerVisible(false)}
          >
              <View style={styles.modalOverlay}>
                  <TouchableOpacity 
                    style={styles.modalDismiss} 
                    onPress={() => setIsStudentPickerVisible(false)} 
                  />
                  <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
                      <View style={styles.pickerHeader}>
                          <Text style={[styles.pickerTitle, { color: theme.text }]}>{t('students.selectStudent')}</Text>
                          <TouchableOpacity onPress={() => setIsStudentPickerVisible(false)}>
                              <MaterialIcons name="close" size={24} color={theme.textSecondary} />
                          </TouchableOpacity>
                      </View>
                      <ScrollView style={{ maxHeight: 400 }}>
                          {students.length === 0 ? (
                              <View style={{ padding: 20, alignItems: 'center' }}>
                                  <Text style={{ color: theme.textSecondary }}>No students found</Text>
                              </View>
                          ) : (
                              students.map(student => (
                                  <TouchableOpacity 
                                      key={student.firebaseUid} 
                                      style={[styles.pickerItem, { borderBottomColor: theme.border }]}
                                      onPress={() => {
                                          setSelectedStudentId(student.firebaseUid);
                                          setIsStudentPickerVisible(false);
                                      }}
                                  >
                                      <View style={[styles.avatarSmall, { backgroundColor: theme.primarySoft }]}>
                                          <Text style={[styles.avatarTextSmall, { color: theme.primary }]}>
                                              {(student.firstName?.[0] || '?').toUpperCase()}
                                          </Text>
                                      </View>
                                      <Text style={[styles.pickerItemText, { color: theme.text }]}>
                                          {student.firstName} {student.lastName}
                                      </Text>
                                      {selectedStudentId === student.firebaseUid && (
                                          <MaterialIcons name="check" size={20} color={theme.primary} />
                                      )}
                                  </TouchableOpacity>
                              ))
                          )}
                      </ScrollView>
                  </View>
              </View>
          </Modal>
      )}

      <WeeklyPracticePlanModal 
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSave={handleSavePlan}
        isSaving={isSavingPlan}
        mode={editingPlan ? 'edit' : 'add'}
        initialParts={editingPlan ? (() => {
            const partMinutes = editingPlan.partMinutes || [10, 20, 30];
            return partMinutes.map((mins, idx) => ({
                id: `p_${idx}`,
                minutes: mins,
                exercises: editingPlan.assignments
                    .filter(a => a.minutes === mins)
                    .map(a => ({
                        id: a.id,
                        contentType: a.type,
                        contentId: a.itemId,
                        contentName: a.title,
                        bpms: Array.isArray(a.bpm) ? a.bpm : (a.bpm ? [a.bpm] : [30]),
                        repetitions: a.repetitions || 5,
                        accompaniment: a.accompanimentType || 'none',
                        parentContentId: a.parentItemId
                    }))
            }));
        })() : null}
        initialDate={editingPlan?.classDate}
        canEditDate={isInstructorView}
      />

      <PracticeTrackModal
        isOpen={isTrackingModalOpen}
        assignment={trackingAssignment}
        classAssignmentId={trackingClassId}
        planInstructorId={trackingInstructorId}
        onSave={handleTrackSave}
        onClose={() => {
            setIsTrackingModalOpen(false);
            setTrackingAssignment(null);
            setTrackingClassId('');
            setTrackingInstructorId('');
        }}
      />

      {activePlanMenu && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setActivePlanMenu(null)}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setActivePlanMenu(null)}
          >
            <View 
              style={[
                styles.pickerContent, 
                { backgroundColor: theme.card },
                Platform.OS === 'web' && { maxWidth: 360 }
              ]}
            >
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: theme.text }]}>Plan Options</Text>
                <TouchableOpacity onPress={() => setActivePlanMenu(null)}>
                  <MaterialIcons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.pickerItem, { borderBottomColor: theme.border }]} 
                onPress={() => {
                  const ca = activePlanMenu;
                  setActivePlanMenu(null);
                  setEditingPlan(ca);
                  setIsPlanModalOpen(true);
                }}
              >
                <MaterialIcons name="edit" size={20} color={theme.text} />
                <Text style={[styles.pickerItemText, { color: theme.text }]}>Edit Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.pickerItem, { borderBottomColor: theme.border }]} 
                onPress={() => {
                  const ca = activePlanMenu;
                  setActivePlanMenu(null);
                  handleDuplicatePlan(ca);
                }}
              >
                <MaterialIcons name="content-copy" size={20} color={theme.text} />
                <Text style={[styles.pickerItemText, { color: theme.text }]}>Duplicate Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.pickerItem} 
                onPress={() => {
                  const ca = activePlanMenu;
                  setActivePlanMenu(null);
                  handleDeletePlan(ca.id);
                }}
              >
                <MaterialIcons name="delete" size={20} color="#dc2626" />
                <Text style={[styles.pickerItemText, { color: '#dc2626' }]}>Delete Plan</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  modalDismiss: {
    flex: 1,
  },
  header: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  classesHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentSelectorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  selectorSmallText: {
    fontSize: 14,
    fontWeight: '700',
  },
  iconAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    padding: 4,
    borderRadius: 8,
  },
  datesList: {
    padding: 16,
    paddingBottom: 40,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  classCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 12,
    ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
        android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 28,
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarSegment: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  progressBarText: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  assignmentsList: {
    gap: 20,
  },
  typeSection: {
    gap: 12,
  },
  typeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typeSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  assignmentRow: {
    padding: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    gap: 4,
  },
  assignmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  assignmentTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  assignmentPills: {
    flexDirection: 'row',
    gap: 4,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  assignmentMetaRow: {
    paddingLeft: 0,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  trackingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
  },
  historyToggle: {
    padding: 4,
  },
  historyToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  historyDate: {
    fontSize: 11,
    width: 80,
  },
  historyDetail: {
    fontSize: 11,
    flex: 1,
  },

  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  trackButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  trackActionRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
  },
  trackButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  trackButtonLargeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  trackingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 8,
    borderRadius: 8,
  },
  trackingSummaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  practiceProgressSection: {
    marginTop: 0,
    marginBottom: 4,
  },
  practiceProgressBar: {
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  practiceProgressFillSegment: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  practiceProgressRemainingPart: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barInsideText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  practiceProgressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  practiceProgressValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  practiceProgressLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  practiceProgressFooter: {
    fontSize: 10,
    fontWeight: '600',
  },
  historyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  historyPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  historyList: {
    marginTop: 10,
    gap: 6,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyIndex: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIndexText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyDetailText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  mediaLinkText: {
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...(Platform.OS === 'web' ? {
      maxWidth: 500,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      width: '100%',
    } : {}),
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  pickerItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default StudentsNew;
