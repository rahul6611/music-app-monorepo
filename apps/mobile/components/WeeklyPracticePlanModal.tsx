import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  PanResponder,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@music-app/store';
import { useTheme } from '@music-app/store';
import { getAllRaags, getGatBandishEntries, type RaagData, type GatBandishEntry } from '@music-app/firebase';
import { getAllExercises, type ExerciseData } from '@music-app/firebase';
import { getAllExerciseCollections, type ExerciseCollectionData } from '@music-app/firebase';
import { getSharedItemIdsForStudent, getSharedItemIdsForInstructor } from '@music-app/firebase';
import { fetchUserData } from '@music-app/firebase';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import DateTimePicker from '@react-native-community/datetimepicker';


export type PracticeContentType = 'raag' | 'song' | 'exercise';
export type PracticeAccompaniment = 'tabla' | 'metronome' | 'none';

export interface PracticeExercise {
  id: string;
  contentType: PracticeContentType;
  contentId: string;
  contentName: string;
  bpms: number[];
  repetitions: number;
  accompaniment: PracticeAccompaniment;
  parentContentId?: string;
}

export interface PracticePart {
  id: string;
  minutes: number;
  exercises: PracticeExercise[];
}

export interface WeeklyPracticePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (parts: PracticePart[], selectedDate?: string) => void | Promise<void>;
  totalMinutes?: number;
  weekLabel?: string;
  weekDescription?: string;
  initialParts?: PracticePart[] | null;
  initialDate?: string;
  mode?: 'add' | 'edit';
  isSaving?: boolean;
  canEditDate?: boolean;
}


const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const PRACTICE_PLAN_PART_COLORS = [
  { bg: '#97B6FF', cardBg: '#E8EFFF', border: '#97B6FF', text: '#1E3A8A' },
  { bg: '#BF9FF5', cardBg: '#F3EDFC', border: '#BF9FF5', text: '#4C1D95' },
  { bg: '#6ADD90', cardBg: '#E8F9EE', border: '#6ADD90', text: '#14532D' },
  { bg: '#EA9ED5', cardBg: '#FDF2F9', border: '#EA9ED5', text: '#831843' },
  { bg: '#E1D97E', cardBg: '#FBF9E8', border: '#E1D97E', text: '#713F12' },
];

const { width, height } = Dimensions.get('window');

const WeeklyPracticePlanModal: React.FC<WeeklyPracticePlanModalProps> = ({
  isOpen,
  onClose,
  onSave,
  totalMinutes: initialTotal = 60,
  weekLabel,
  weekDescription,
  initialParts = null,
  initialDate,
  mode = 'add',
  isSaving = false,
  canEditDate = true,
}) => {
  const theme = useTheme();
  const { user: currentUser } = useAuthStore();

  const [totalMinutes, setTotalMinutes] = useState(initialTotal);
  const [parts, setParts] = useState<PracticePart[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [raagItems, setRaagItems] = useState<RaagData[]>([]);
  const [songItems, setSongItems] = useState<RaagData[]>([]);
  const [exerciseItems, setExerciseItems] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedParentName, setSelectedParentName] = useState<string>('');
  const [compositionItems, setCompositionItems] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [isSelectingComposition, setIsSelectingComposition] = useState(false);
  const [selectedCompositionIds, setSelectedCompositionIds] = useState<string[]>([]);
  const [selectedCompositionNames, setSelectedCompositionNames] = useState<Record<string, string>>({});
  const [loadingList, setLoadingList] = useState(false);

  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [showAssignmentSelector, setShowAssignmentSelector] = useState(false);
  const [selectorStep, setSelectorStep] = useState<'type' | 'list' | 'settings'>('type');
  const [selectedContentType, setSelectedContentType] = useState<PracticeContentType | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [selectedContentName, setSelectedContentName] = useState<string>('');
  const [selectedBpms, setSelectedBpms] = useState<number[]>([30]);
  const [selectedRepetitions, setSelectedRepetitions] = useState<number>(5);
  const [selectedAccompaniment, setSelectedAccompaniment] = useState<PracticeAccompaniment>('tabla');
  
  const [editingAssignment, setEditingAssignment] = useState<{ partId: string; exId: string } | null>(null);
  const [isRepDropdownOpen, setIsRepDropdownOpen] = useState(false);
  const [removeAssignmentConfirmation, setRemoveAssignmentConfirmation] = useState<{
    partId: string;
    exId: string;
    exName: string;
  } | null>(null);
  const [removePartConfirmation, setRemovePartConfirmation] = useState<{
    partId: string;
    partMinutes: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTotalMinutes(initialTotal);
      if (initialDate) {
        setSelectedDate(new Date(initialDate));
      } else {
        setSelectedDate(new Date());
      }
      
      if (initialParts && initialParts.length > 0) {
        setParts(initialParts.map((p) => ({ ...p, exercises: p.exercises.map((ex) => ({ ...ex })) })));
      } else {
        setParts([
          { id: uid(), minutes: 10, exercises: [] },
          { id: uid(), minutes: 20, exercises: [] },
          { id: uid(), minutes: 30, exercises: [] },
        ]);
      }

      loadLibrary();
    }
  }, [isOpen, initialTotal, initialDate, initialParts]);

  const loadLibrary = async () => {
    try {
      setLoadingLibrary(true);
      const ownerId = currentUser?.uid;

      const [raags, songs, exercises, exerciseCollections, userData] = await Promise.all([
        getAllRaags('raags'),
        getAllRaags('songs'),
        getAllExercises(),
        getAllExerciseCollections(),
        ownerId ? fetchUserData(ownerId) : Promise.resolve(null),
      ]);

      let sharedRaagIds: string[] = [];
      let sharedSongIds: string[] = [];
      let sharedExerciseCollectionIds: string[] = [];

      if (ownerId && userData) {
        if (userData.accountType === 'Student') {
          [sharedRaagIds, sharedSongIds, sharedExerciseCollectionIds] = await Promise.all([
            getSharedItemIdsForStudent(ownerId, 'raag'),
            getSharedItemIdsForStudent(ownerId, 'song'),
            getSharedItemIdsForStudent(ownerId, 'exerciseCollection'),
          ]);
        } else if (userData.accountType === 'Instructor') {
          [sharedRaagIds, sharedSongIds, sharedExerciseCollectionIds] = await Promise.all([
            getSharedItemIdsForInstructor(ownerId, 'raag'),
            getSharedItemIdsForInstructor(ownerId, 'song'),
            getSharedItemIdsForInstructor(ownerId, 'exerciseCollection'),
          ]);
        }
      }

      const filterByItems = <T extends { id: string; createdBy?: string; isSystemDefault?: boolean }>(
        items: T[],
        sharedIds: string[] = []
      ): T[] => {
        if (!ownerId) return items;
        return items.filter((item) => {
          const isOwn = item.createdBy === ownerId;
          const isShared = sharedIds.includes(item.id);
          const isSystem = item.isSystemDefault === true || !item.createdBy;
          if (isOwn || isShared) return true;
          if (userData?.accountType === 'Student') return false;
          return isSystem;
        });
      };

      const combinedRaags = raags.filter(raag => !raag.musicSubStyleTypes?.some(t => t.toLowerCase() === 'songs'));
      const combinedSongs = songs.concat(raags.filter(raag => raag.musicSubStyleTypes?.some(t => t.toLowerCase() === 'songs')));

      setRaagItems(filterByItems(combinedRaags, sharedRaagIds));
      setSongItems(filterByItems(combinedSongs, sharedSongIds));

      const filteredExercises = filterByItems(exercises);
      const filteredCollections = filterByItems(exerciseCollections, sharedExerciseCollectionIds);

      const exerciseOptions = [
        ...filteredExercises.map((ex) => ({
          id: ex.id,
          name: ex.title,
          description: ex.description || '',
        })),
        ...filteredCollections.map((col) => ({
          id: col.id,
          name: col.title,
          description: col.description || '',
        })),
      ];

      setExerciseItems(exerciseOptions);
    } catch (e) {
      console.error('Error loading library:', e);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const resetSelector = () => {
    setShowAssignmentSelector(false);
    setSelectorStep('type');
    setSelectedContentType(null);
    setSelectedContentId(null);
    setSelectedContentName('');
    setSelectedBpms([30]);
    setSelectedRepetitions(5);
    setSelectedAccompaniment('tabla');
    setActivePartId(null);
    setEditingAssignment(null);
    setSelectedParentId(null);
    setSelectedParentName('');
    setCompositionItems([]);
    setIsSelectingComposition(false);
    setSelectedCompositionIds([]);
    setSelectedCompositionNames({});
    setLoadingList(false);
  };

  const handleStartAddAssignment = (partId: string) => {
    setActivePartId(partId);
    setShowAssignmentSelector(true);
    setSelectorStep('type');
  };

  const handleConfirmAssignment = () => {
    if (!activePartId || !selectedContentType) return;

    const bpmsToUse = selectedBpms.length > 0 ? selectedBpms : [30];

    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== activePartId) return p;

        if (editingAssignment && editingAssignment.partId === activePartId) {
          const updatedExercises = p.exercises.map((ex) =>
            ex.id === editingAssignment.exId
              ? {
                  ...ex,
                  bpms: bpmsToUse,
                  repetitions: selectedRepetitions,
                  accompaniment: selectedAccompaniment,
                }
              : ex
          );
          return { ...p, exercises: updatedExercises };
        }

        const toAdd: PracticeExercise[] = [];
        if (isSelectingComposition && (selectedContentType === 'raag' || selectedContentType === 'song')) {
          if (!selectedParentId || selectedCompositionIds.length === 0) return p;
          selectedCompositionIds.forEach((compId) => {
            const compName = selectedCompositionNames[compId] || compositionItems.find((c) => c.id === compId)?.name || 'Composition';
            toAdd.push({
              id: uid(),
              contentType: selectedContentType,
              contentId: compId,
              contentName: selectedParentName ? `${selectedParentName} — ${compName}` : compName,
              bpms: bpmsToUse,
              repetitions: selectedRepetitions,
              accompaniment: selectedAccompaniment,
              parentContentId: selectedParentId || undefined,
            });
          });
        } else {
          if (!selectedContentId || !selectedContentName) return p;
          toAdd.push({
            id: uid(),
            contentType: selectedContentType,
            contentId: selectedContentId,
            contentName: selectedContentName,
            bpms: bpmsToUse,
            repetitions: selectedRepetitions,
            accompaniment: selectedAccompaniment,
          });
        }

        return { ...p, exercises: [...p.exercises, ...toAdd] };
      })
    );

    resetSelector();
  };

  const addPart = () => {
    setParts((prev) => {
      if (prev.length === 0) return [{ id: uid(), minutes: totalMinutes, exercises: [] }];
      const next = [...prev];
      const lastIdx = next.length - 1;
      const lastPart = next[lastIdx];
      const amountToTake = Math.min(10, lastPart.minutes - 5);
      if (amountToTake <= 0) return prev;
      next[lastIdx] = { ...lastPart, minutes: lastPart.minutes - amountToTake };
      next.push({ id: uid(), minutes: amountToTake, exercises: [] });
      return next;
    });
  };

  const removePart = (partId: string) => {
    setParts((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((p) => p.id === partId);
      const removed = prev[idx];
      const next = prev.filter((p) => p.id !== partId);
      const neighbourIdx = Math.min(idx, next.length - 1);
      next[neighbourIdx] = { ...next[neighbourIdx], minutes: next[neighbourIdx].minutes + removed.minutes };
      return next;
    });
  };

  const removeExercise = (partId: string, exId: string) => {
    setParts((prev) => prev.map((p) => (p.id === partId ? { ...p, exercises: p.exercises.filter((e) => e.id !== exId) } : p)));
  };

  const getBarWidth = () => {
    return Platform.OS === 'web'
      ? Math.min(800, width * 0.9) - 56
      : width - 56;
  };

  const barWidth = getBarWidth();
  const dividerWidth = 24;

  const TimeDistributionBar = React.memo(({ 
    totalMinutes, 
    parts, 
    onPartsChange 
  }: { 
    totalMinutes: number; 
    parts: PracticePart[]; 
    onPartsChange: (newParts: PracticePart[]) => void 
  }) => {
    const [localParts, setLocalParts] = useState(parts);
    const barWidth = getBarWidth();
    const minutesPerPixel = totalMinutes / barWidth;

    useEffect(() => {
      setLocalParts(parts);
    }, [parts]);

    const handleMove = useCallback((idx: number, dx: number, isFinal: boolean = false) => {
      let finalNext: PracticePart[] | null = null;

      setLocalParts(prev => {
        const next = [...prev];
        const leftPart = { ...next[idx] };
        const rightPart = { ...next[idx + 1] };
        
        const delta = Math.round(dx * minutesPerPixel);
        if (delta === 0 && !isFinal) return prev;

        let newLeftMin = leftPart.minutes + delta;
        let newRightMin = rightPart.minutes - delta;

        if (newLeftMin < 5) {
          newRightMin -= (5 - newLeftMin);
          newLeftMin = 5;
        }
        if (newRightMin < 5) {
          newLeftMin -= (5 - newRightMin);
          newRightMin = 5;
        }

        next[idx] = { ...leftPart, minutes: newLeftMin };
        next[idx+1] = { ...rightPart, minutes: newRightMin };
        
        if (isFinal) {
          finalNext = next;
        }
        return next;
      });

      if (isFinal && finalNext) {
          onPartsChange(finalNext);
      }
    }, [minutesPerPixel, onPartsChange]);

    const Divider = React.useMemo(() => {
      return localParts.slice(0, -1).map((_, i) => {
        let lastDx = 0;
        const panResponder = PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderGrant: () => { lastDx = 0; },
          onPanResponderMove: (_, gestureState) => {
            const delta = gestureState.dx - lastDx;
            if (Math.abs(delta) > 0.5) {
                handleMove(i, delta, false);
                lastDx = gestureState.dx;
            }
          },
          onPanResponderRelease: (_, gestureState) => {
            const delta = gestureState.dx - lastDx;
            handleMove(i, delta, true);
            lastDx = 0;
          },
        });
        return panResponder;
      });
    }, [localParts.length, handleMove]);

    const startDrag = (i: number, e: any) => {
      if (Platform.OS !== 'web') return;
      e.preventDefault();
      const startX = e.clientX;
      const initialPartsState = [...localParts];

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = moveEvent.clientX;
        const totalDx = currentX - startX;
        const totalDeltaMinutes = Math.round(totalDx * minutesPerPixel);
        if (totalDeltaMinutes === 0) return;

        setLocalParts(prev => {
          const next = [...initialPartsState];
          const leftPart = { ...next[i] };
          const rightPart = { ...next[i + 1] };

          let newLeftMin = leftPart.minutes + totalDeltaMinutes;
          let newRightMin = rightPart.minutes - totalDeltaMinutes;

          if (newLeftMin < 5) {
            newRightMin -= (5 - newLeftMin);
            newLeftMin = 5;
          }
          if (newRightMin < 5) {
            newLeftMin -= (5 - newRightMin);
            newRightMin = 5;
          }

          next[i] = { ...leftPart, minutes: newLeftMin };
          next[i+1] = { ...rightPart, minutes: newRightMin };
          return next;
        });
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        setLocalParts(finalParts => {
          onPartsChange(finalParts);
          return finalParts;
        });
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    const startTouchDrag = (i: number, e: any) => {
      if (Platform.OS !== 'web') return;
      const startX = e.touches[0].clientX;
      const initialPartsState = [...localParts];

      const handleTouchMove = (moveEvent: TouchEvent) => {
        const currentX = moveEvent.touches[0].clientX;
        const totalDx = currentX - startX;
        const totalDeltaMinutes = Math.round(totalDx * minutesPerPixel);
        if (totalDeltaMinutes === 0) return;

        setLocalParts(prev => {
          const next = [...initialPartsState];
          const leftPart = { ...next[i] };
          const rightPart = { ...next[i + 1] };

          let newLeftMin = leftPart.minutes + totalDeltaMinutes;
          let newRightMin = rightPart.minutes - totalDeltaMinutes;

          if (newLeftMin < 5) {
            newRightMin -= (5 - newLeftMin);
            newLeftMin = 5;
          }
          if (newRightMin < 5) {
            newLeftMin -= (5 - newRightMin);
            newRightMin = 5;
          }

          next[i] = { ...leftPart, minutes: newLeftMin };
          next[i+1] = { ...rightPart, minutes: newRightMin };
          return next;
        });
      };

      const handleTouchEnd = () => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        setLocalParts(finalParts => {
          onPartsChange(finalParts);
          return finalParts;
        });
      };

      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
    };

    return (
      <View style={styles.timeBar}>
        {localParts.map((part, i) => {
          const color = PRACTICE_PLAN_PART_COLORS[i % PRACTICE_PLAN_PART_COLORS.length];
          const widthPct = (part.minutes / totalMinutes);
          return (
            <React.Fragment key={part.id}>
              <View
                style={[
                  styles.timeBarSegment,
                  {
                    flex: widthPct,
                    backgroundColor: color.bg,
                    borderColor: color.border,
                  },
                ]}
              >
                <Text style={[styles.segmentText, { color: color.text }]}>{part.minutes}m</Text>
              </View>
              {i < localParts.length - 1 && (
                <View 
                  {...(Platform.OS !== 'web' ? Divider[i].panHandlers : {})}
                  // @ts-ignore
                  onMouseDown={Platform.OS === 'web' ? (e) => startDrag(i, e) : undefined}
                  onTouchStart={Platform.OS === 'web' ? (e) => startTouchDrag(i, e) : undefined}
                  style={styles.divider}
                >
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerLine} />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  });

  const PartCard = React.memo(({ 
    part, 
    partIdx, 
    theme, 
    t, 
    onAddExercise, 
    onRemovePart, 
    onRemoveExercise 
  }: { 
    part: PracticePart; 
    partIdx: number; 
    theme: any; 
    t: any; 
    onAddExercise: (id: string) => void;
    onRemovePart: (part: any) => void;
    onRemoveExercise: (pId: string, eId: string) => void;
  }) => {
    const color = PRACTICE_PLAN_PART_COLORS[partIdx % PRACTICE_PLAN_PART_COLORS.length];
    return (
      <View style={[styles.partCard, { backgroundColor: color.cardBg, borderColor: color.border }]}>
        <View style={styles.partHeader}>
          <Text style={[styles.partMinutes, { color: color.text }]}>{part.minutes} {t('practicePlanModal.min')}</Text>
          <TouchableOpacity onPress={() => onRemovePart({ partId: part.id, partMinutes: part.minutes })}>
            <MaterialIcons name="delete-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>

        {part.exercises.map((ex) => (
          <ExerciseItem 
            key={ex.id} 
            ex={ex} 
            color={color} 
            theme={theme} 
            t={t} 
            onRemove={() => onRemoveExercise(part.id, ex.id)} 
          />
        ))}

        <TouchableOpacity style={styles.addExerciseBtn} onPress={() => onAddExercise(part.id)}>
          <Text style={[styles.addExerciseText, { color: theme.primary }]}>{t('practicePlanModal.addAssignmentBtn')}</Text>
        </TouchableOpacity>
      </View>
    );
  });

  const ExerciseItem = React.memo(({ ex, color, theme, t, onRemove }: any) => (
    <View style={styles.exerciseItem}>
      <View style={styles.exerciseInfo}>
        <View style={[styles.typeBadge, { backgroundColor: color.bg }]}>
          <Text style={[styles.typeBadgeText, { color: color.text }]}>
            {ex.contentType === 'raag' ? t('students.raag') : ex.contentType === 'song' ? t('students.song') : t('students.exercise')}
          </Text>
        </View>
        <Text style={[styles.exerciseTitle, { color: theme.text }]} numberOfLines={1}>{ex.contentName}</Text>
      </View>
      <View style={styles.exerciseMeta}>
        <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            BPM {ex.bpms.join(', ')} • {ex.repetitions}x • {ex.accompaniment}
        </Text>
        <TouchableOpacity onPress={onRemove} style={styles.exerciseRemoveBtn}>
            <MaterialIcons name="close" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  ));

  const t = (key: string, options?: any) => {
      const translations: Record<string, string> = {
          'practicePlanModal.addAssignment': 'Add Practice Plan',
          'practicePlanModal.editAssignment': 'Edit Practice Plan',
          'practicePlanModal.date': 'Date',
          'practicePlanModal.setWhatStudentShouldPractice': 'Set what the student should practice this session.',
          'practicePlanModal.distributeMinutes': 'Distribute {{minutes}} minutes:',
          'practicePlanModal.addPart': '+ Add Part',
          'practicePlanModal.save': 'Save Plan',
          'practicePlanModal.cancel': 'Cancel',
          'practicePlanModal.min': 'min',
          'practicePlanModal.repetitions': 'reps',
          'practicePlanModal.addAssignmentBtn': '+ Add Exercise/Raag',
          'practicePlanModal.practiceWithAccompaniment': 'Accompaniment',
          'practicePlanModal.numberOfRepetitions': 'Repetitions',
          'practicePlanModal.saveAssignment': 'Add to Plan',
          'practicePlanModal.chooseAssignmentType': 'Choose Type',
          'practicePlanModal.selectRaag': 'Select Raag',
          'practicePlanModal.selectSong': 'Select Song',
          'practicePlanModal.selectExercise': 'Select Exercise',
          'practicePlanModal.selectComposition': 'Select Compositions',
          'practicePlanModal.practiceSettings': 'Practice Settings',
          'practicePlanModal.editAssignmentSettings': 'Edit Settings',
          'students.raag': 'Raag',
          'students.song': 'Song',
          'students.exercise': 'Exercise',
          'students.tabla': 'Tabla',
          'students.metronome': 'Metronome',
          'students.none': 'None',
      };
      let text = translations[key] || key;
      if (options) {
          Object.keys(options).forEach(k => text = text.replace(`{{${k}}}`, options[k]));
      }
      return text;
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                {mode === 'edit' ? t('practicePlanModal.editAssignment') : t('practicePlanModal.addAssignment')}
              </Text>
              <TouchableOpacity 
                onPress={() => canEditDate && setShowDatePicker(true)} 
                style={styles.dateSelector}
                disabled={!canEditDate}
              >
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                  {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                {canEditDate && <MaterialIcons name="event" size={16} color={theme.primary} />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.timeBarSection}>
              <View style={styles.timeBarHeader}>
                <Text style={[styles.timeBarLabel, { color: theme.textSecondary }]}>
                  {t('practicePlanModal.distributeMinutes', { minutes: totalMinutes })}
                </Text>
                <TouchableOpacity onPress={addPart}>
                  <Text style={[styles.addPartLink, { color: theme.primary }]}>{t('practicePlanModal.addPart')}</Text>
                </TouchableOpacity>
              </View>

              <TimeDistributionBar 
                totalMinutes={totalMinutes} 
                parts={parts} 
                onPartsChange={setParts} 
              />
            </View>

            {parts.map((part, partIdx) => (
              <PartCard 
                key={part.id}
                part={part}
                partIdx={partIdx}
                theme={theme}
                t={t}
                onAddExercise={handleStartAddAssignment}
                onRemovePart={setRemovePartConfirmation}
                onRemoveExercise={removeExercise}
              />
            ))}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>{t('practicePlanModal.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: theme.primary }]} 
                onPress={() => onSave(parts, selectedDate.toISOString())}
                disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>{t('practicePlanModal.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Assignment Selector Modal */}
        <Modal visible={showAssignmentSelector} transparent animationType="fade">
            <View style={styles.selectorOverlay}>
                <View style={[styles.selectorModal, { backgroundColor: theme.card }]}>
                    <View style={styles.selectorHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {selectorStep !== 'type' && (
                                <TouchableOpacity onPress={() => {
                                    if (selectorStep === 'settings') setSelectorStep('list');
                                    else if (selectorStep === 'list') {
                                        if (isSelectingComposition) setIsSelectingComposition(false);
                                        else setSelectorStep('type');
                                    }
                                }}>
                                    <MaterialIcons name="chevron-left" size={24} color={theme.text} />
                                </TouchableOpacity>
                            )}
                            <Text style={[styles.selectorTitle, { color: theme.text }]}>
                                {selectorStep === 'type' ? t('practicePlanModal.chooseAssignmentType') : 
                                 selectorStep === 'list' ? (isSelectingComposition ? t('practicePlanModal.selectComposition') : 'Select Item') : 
                                 t('practicePlanModal.practiceSettings')}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={resetSelector}>
                            <MaterialIcons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.selectorContent}>
                        {selectorStep === 'type' && (
                            <View style={styles.typeOptions}>
                                {(['raag', 'song', 'exercise'] as PracticeContentType[]).map(type => (
                                    <TouchableOpacity 
                                        key={type} 
                                        style={[styles.typeOption, { borderColor: theme.border }]}
                                        onPress={() => {
                                            setSelectedContentType(type);
                                            setSelectorStep('list');
                                        }}
                                    >
                                        <Text style={[styles.typeOptionText, { color: theme.text }]}>{t(`students.${type}`)}</Text>
                                        <MaterialIcons name="chevron-right" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {selectorStep === 'list' && (
                            <View>
                                {loadingLibrary || loadingList ? (
                                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                                ) : (
                                    (isSelectingComposition ? compositionItems : 
                                     selectedContentType === 'raag' ? raagItems.map(r=>({id:r.id, name:r.name, description:r.description})) :
                                     selectedContentType === 'song' ? songItems.map(s=>({id:s.id, name:s.name, description:s.description})) :
                                     exerciseItems).map(item => (
                                        <TouchableOpacity 
                                            key={item.id} 
                                            style={[styles.listItem, { borderBottomColor: theme.border }]}
                                            onPress={async () => {
                                                if (selectedContentType === 'exercise' || isSelectingComposition) {
                                                    if (isSelectingComposition) {
                                                        setSelectedCompositionIds(prev => 
                                                            prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                                        );
                                                        setSelectedCompositionNames(prev => ({ ...prev, [item.id]: item.name }));
                                                    } else {
                                                        setSelectedContentId(item.id);
                                                        setSelectedContentName(item.name);
                                                        setSelectorStep('settings');
                                                    }
                                                } else {
                                                    setSelectedParentId(item.id);
                                                    setSelectedParentName(item.name);
                                                    setLoadingList(true);
                                                    try {
                                                        const entries = await getGatBandishEntries(item.id, selectedContentType === 'song' ? 'songs' : 'raags');
                                                        setCompositionItems(entries.map(e => ({ id: e.id || '', name: e.name || 'Comp', description: e.type })));
                                                        setIsSelectingComposition(true);
                                                    } finally {
                                                        setLoadingList(false);
                                                    }
                                                }
                                            }}
                                        >
                                            {isSelectingComposition && (
                                                <MaterialIcons 
                                                    name={selectedCompositionIds.includes(item.id) ? 'check-box' : 'check-box-outline-blank'} 
                                                    size={20} color={theme.primary} 
                                                />
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.listItemText, { color: theme.text }]}>{item.name}</Text>
                                                {item.description && <Text style={[styles.listItemDesc, { color: theme.textSecondary }]}>{item.description}</Text>}
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        )}

                        {selectorStep === 'settings' && (
                            <View style={styles.settingsForm}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>{t('practicePlanModal.practiceWithAccompaniment')}</Text>
                                <View style={styles.radioRow}>
                                    {(['tabla', 'metronome', 'none'] as PracticeAccompaniment[]).map(acc => (
                                        <TouchableOpacity 
                                            key={acc} 
                                            style={[styles.radioPill, selectedAccompaniment === acc && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                            onPress={() => setSelectedAccompaniment(acc)}
                                        >
                                            <Text style={[styles.radioPillText, { color: selectedAccompaniment === acc ? '#FFF' : theme.textSecondary }]}>{t(`students.${acc}`)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.label, { color: theme.textSecondary }]}>BPM</Text>
                                <View style={styles.bpmRow}>
                                    {[30, 60, 80, 100, 120, 160].map(bpm => (
                                        <TouchableOpacity 
                                            key={bpm} 
                                            style={[styles.bpmPill, selectedBpms.includes(bpm) && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                            onPress={() => setSelectedBpms(prev => prev.includes(bpm) ? prev.filter(b => b !== bpm) : [...prev, bpm])}
                                        >
                                            <Text style={[styles.bpmPillText, { color: selectedBpms.includes(bpm) ? '#FFF' : theme.textSecondary }]}>{bpm}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.label, { color: theme.textSecondary }]}>{t('practicePlanModal.numberOfRepetitions')}</Text>
                                <View style={styles.dropdownContainer}>
                                    <TouchableOpacity 
                                        style={[styles.dropdownTrigger, { borderColor: theme.border }]} 
                                        onPress={() => setIsRepDropdownOpen(!isRepDropdownOpen)}
                                    >
                                        <Text style={[styles.dropdownTriggerText, { color: theme.text }]}>{selectedRepetitions}</Text>
                                        <MaterialIcons name={isRepDropdownOpen ? "arrow-drop-up" : "arrow-drop-down"} size={24} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                    
                                    {isRepDropdownOpen && (
                                        <View style={[styles.inlineDropdownList, { borderColor: theme.border }]}>
                                            <View style={styles.dropdownGrid}>
                                                {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                                    <TouchableOpacity 
                                                        key={num} 
                                                        style={[
                                                            styles.dropdownGridItem, 
                                                            { borderColor: theme.border },
                                                            selectedRepetitions === num && { backgroundColor: theme.primary, borderColor: theme.primary }
                                                        ]}
                                                        onPress={() => {
                                                            setSelectedRepetitions(num);
                                                            setIsRepDropdownOpen(false);
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.dropdownGridText, 
                                                            { color: selectedRepetitions === num ? '#FFF' : theme.text }
                                                        ]}>{num}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.selectorFooter}>
                        {isSelectingComposition && selectorStep === 'list' ? (
                            <TouchableOpacity 
                                style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
                                disabled={selectedCompositionIds.length === 0}
                                onPress={() => setSelectorStep('settings')}
                            >
                                <Text style={styles.confirmBtnText}>Next ({selectedCompositionIds.length})</Text>
                            </TouchableOpacity>
                        ) : selectorStep === 'settings' ? (
                            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={handleConfirmAssignment}>
                                <Text style={styles.confirmBtnText}>{t('practicePlanModal.saveAssignment')}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </View>
        </Modal>

        <DeleteConfirmationModal
          isOpen={!!removePartConfirmation}
          onClose={() => setRemovePartConfirmation(null)}
          onConfirm={() => removePart(removePartConfirmation!.partId)}
          title="Remove Part"
          message="Are you sure you want to remove this practice part?"
        />
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
  modal: {
    height: Platform.OS === 'web' ? '85%' : '92%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    ...(Platform.OS === 'web' ? {
      maxWidth: 800,
      width: '90%',
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    } : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  timeBarSection: {
    marginBottom: 24,
  },
  timeBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeBarLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  addPartLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  timeBar: {
    height: 40,
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
  },
  timeBarSegment: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  divider: {
    width: 24,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 6,
    zIndex: 10,
    marginHorizontal: -12,
    alignSelf: 'center',
    elevation: 3,
    ...(Platform.OS === 'web' ? { cursor: 'col-resize' as any } : {}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  dividerLine: {
    width: 2,
    height: 14,
    backgroundColor: '#666',
    borderRadius: 1,
  },
  partCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  partHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partMinutes: {
    fontSize: 18,
    fontWeight: '800',
  },
  exerciseItem: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  exerciseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  exerciseTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  exerciseMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  exerciseRemoveBtn: {
    padding: 4,
  },
  addExerciseBtn: {
    marginTop: 8,
  },
  addExerciseText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    padding: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  cancelBtn: {
    padding: 12,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 140,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectorModal: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    padding: 20,
    elevation: 5,
    ...(Platform.OS === 'web' ? {
      maxWidth: 600,
    } : {}),
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  selectorContent: {
    maxHeight: 400,
  },
  typeOptions: {
    gap: 12,
  },
  typeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  typeOptionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  listItemText: {
    fontSize: 15,
    fontWeight: '700',
  },
  listItemDesc: {
    fontSize: 12,
  },
  settingsForm: {
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: -8,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  radioPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bpmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bpmPill: {
    width: 50,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpmPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  repSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  repBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repCount: {
    fontSize: 18,
    fontWeight: '800',
    minWidth: 30,
    textAlign: 'center',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    minWidth: 100,
    alignSelf: 'flex-start',
  },
  dropdownTriggerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownContainer: {
    width: '100%',
  },
  inlineDropdownList: {
    marginTop: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  dropdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dropdownGridItem: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownGridText: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectorFooter: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default WeeklyPracticePlanModal;
