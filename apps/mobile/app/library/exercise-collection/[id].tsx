import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@music-app/store';
import { useAuthStore } from '@music-app/store';
import { 
  getExerciseCollection, 
  updateExerciseCollectionInfo, 
  updateExerciseCollectionExercises, 
  deleteExerciseCollection,
  CollectionExerciseItem,
  ExerciseCollectionData
} from '@music-app/firebase';
import { fetchUserData } from '@music-app/firebase';
import DeleteConfirmationModal from '../../../components/library/DeleteConfirmationModal';
import ShareWithStudentsModal from '../../../components/library/ShareWithStudentsModal';
import ExerciseCreationModal from '../../../components/library/ExerciseCreationModal';
import ExerciseNotesDisplay from '../../../components/library/ExerciseNotesDisplay';
import NewExerciseModal from '../../../components/library/NewExerciseModal';

const { width } = Dimensions.get('window');

export default function ExerciseCollectionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const params = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collection, setCollection] = useState<ExerciseCollectionData | null>(null);
  const [exercises, setExercises] = useState<CollectionExerciseItem[]>([]);
  const [userData, setUserData] = useState<any>(null);
  
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewExerciseModal, setShowNewExerciseModal] = useState(false);
  const [isSavingExercise, setIsSavingExercise] = useState(false);

  const isDark = theme.background === '#000000';
  const isOwner = collection?.createdBy === currentUser?.uid;
  const isInstructor = userData?.accountType === 'Instructor' || userData?.accountType === 'SuperAdmin' || isOwner;

  const loadData = async (isRefreshing = false) => {
    if (!params.id) return;
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const [data, uData] = await Promise.all([
        getExerciseCollection(params.id),
        currentUser ? fetchUserData(currentUser.uid) : null
      ]);

      if (data) {
        setCollection(data);
        setExercises(data.exercises || []);
      }
      if (uData) setUserData(uData);
    } catch (error) {
      console.error('Error loading exercise collection:', error);
      Alert.alert('Error', 'Failed to load details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.id, currentUser?.uid]);

  const handleDeleteCollection = async () => {
    if (!params.id) return;
    try {
      await deleteExerciseCollection(params.id);
      router.back();
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert('Error', 'Failed to delete collection');
    }
  };

  const handleAddExercise = async (exerciseData: any) => {
    if (!params.id || !collection) return;
    setIsSavingExercise(true);
    try {
      const newExercise: CollectionExerciseItem = {
        id: Math.random().toString(36).substring(7),
        title: `Exercise ${exercises.length + 1}`,
        description: '',
        notes: exerciseData.notes,
        media: [],
        beatsPerCycle: exerciseData.beatsPerCycle,
        beatsBreakdown: exerciseData.beatsBreakdown,
        autoGenerate: exerciseData.autoGenerate,
      };

      const updatedExercises = [...exercises, newExercise];
      await updateExerciseCollectionExercises(params.id, updatedExercises);
      
      setExercises(updatedExercises);
      setShowNewExerciseModal(false);
    } catch (error) {
      console.error('Failed to add exercise:', error);
      Alert.alert('Error', 'Failed to add exercise');
    } finally {
      setIsSavingExercise(false);
    }
  };

  const handleUpdateCollection = async (data: any) => {
    if (!params.id) return;
    try {
      await updateExerciseCollectionInfo(params.id, {
        title: data.collectionName,
        patternType: data.patternType,
        creationMode: data.creationMode,
        beatsPerCycle: data.beatsPerCycle,
        beatsBreakdown: data.beatsBreakdown,
        hasStroke: data.hasStroke,
        patternInput: data.patternInput,
        images: data.images,
        heroImage: data.images?.[0]?.url || collection?.heroImage || '',
      });
      setShowEditModal(false);
      loadData();
    } catch (error) {
      console.error('Update failed:', error);
      Alert.alert('Error', 'Failed to update collection');
    }
  };

  const renderExerciseItem = ({ item, index }: { item: CollectionExerciseItem; index: number }) => (
    <TouchableOpacity 
      style={[styles.exerciseCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => {
      }}
    >
      <View style={styles.exerciseHeader}>
        <View style={[styles.exerciseIndex, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.exerciseIndexText, { color: theme.primary }]}>#{index + 1}</Text>
        </View>
        <Text style={[styles.exerciseTitle, { color: theme.text }]} numberOfLines={1}>
          {item.title || `Exercise ${index + 1}`}
        </Text>
      </View>
      
      {item.description ? (
        <Text style={[styles.exerciseDesc, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {item.notes && item.notes.length > 0 && (
        <ExerciseNotesDisplay notes={item.notes} />
      )}

      <View style={styles.exerciseFooter}>
        <View style={styles.exerciseMeta}>
          {item.media && item.media.length > 0 && (
            <View style={styles.metaBadge}>
              <Ionicons name="play-circle-outline" size={14} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.primary }]}>{item.media.length}</Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Collection not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{collection.title}</Text>
        </View>
        <TouchableOpacity 
          style={styles.menuBtn}
          onPress={() => setShowMenu(true)}
        >
          <Feather name="more-horizontal" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.primary} />
        }
      >
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{exercises.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Exercises</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
             <View style={[styles.patternTag, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.patternTagText, { color: theme.primary }]}>Pattern</Text>
             </View>
          </View>
        </View>

        {collection.creationMode === 'anchored' && collection.patternInput && (
          <View style={[styles.anchorCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.anchorText, { color: theme.text }]}>
              {collection.patternInput.filter(n => n.trim() !== '').join(' | ')}
            </Text>
            <Text style={[styles.anchorLabel, { color: theme.textSecondary }]}>Anchor Pattern</Text>
          </View>
        )}

        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: theme.text }]}>Exercises</Text>
          {isInstructor && (
            <TouchableOpacity 
              style={[styles.addExerciseBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowNewExerciseModal(true)}
              disabled={isSavingExercise}
            >
              {isSavingExercise ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add" size={20} color="#FFF" />
                  <Text style={styles.addExerciseBtnText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {exercises.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="layers-outline" size={64} color={theme.textSecondary} style={{ opacity: 0.2 }} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>There are no exercises in this collection yet.</Text>
            {isInstructor && (
              <TouchableOpacity 
                style={[styles.emptyAddBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowNewExerciseModal(true)}
              >
                <Text style={styles.emptyAddBtnText}>Add your first exercise</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.exercisesList}>
            {exercises.map((item, index) => (
              <React.Fragment key={item.id || index.toString()}>
                {renderExerciseItem({ item, index })}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border, top: Platform.OS === 'ios' ? 60 : 50, right: 16 }]}>
               {isInstructor && (
                 <>
                   <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setShowMenu(false);
                      setShowEditModal(true);
                    }}
                   >
                     <Feather name="edit-2" size={18} color={theme.text} />
                     <Text style={[styles.dropdownText, { color: theme.text }]}>Edit Collection</Text>
                   </TouchableOpacity>
                   
                   <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setShowMenu(false);
                      setShowShareModal(true);
                    }}
                   >
                     <Feather name="share-2" size={18} color={theme.text} />
                     <Text style={[styles.dropdownText, { color: theme.text }]}>Share with students</Text>
                   </TouchableOpacity>

                   <TouchableOpacity 
                    style={[styles.dropdownItem, { borderBottomWidth: 0 }]}
                    onPress={() => {
                      setShowMenu(false);
                      setShowDeleteModal(true);
                    }}
                   >
                     <Feather name="trash-2" size={18} color={theme.danger} />
                     <Text style={[styles.dropdownText, { color: theme.danger }]}>Delete Collection</Text>
                   </TouchableOpacity>
                 </>
               )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ExerciseCreationModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onNext={handleUpdateCollection}
        isEditMode
        initialData={{
          collectionName: collection.title,
          patternType: collection.patternType,
          creationMode: collection.creationMode,
          beatsPerCycle: collection.beatsPerCycle,
          beatsBreakdown: collection.beatsBreakdown,
          hasStroke: collection.hasStroke,
          patternInput: collection.patternInput,
          images: collection.images,
        }}
      />

      <DeleteConfirmationModal 
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        itemName={collection.title}
        onConfirm={handleDeleteCollection}
      />

      <ShareWithStudentsModal 
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        instructorId={currentUser?.uid || ''}
        itemType="exerciseCollection"
        itemId={params.id!}
        itemTitle={collection.title}
      />

      <NewExerciseModal 
        isOpen={showNewExerciseModal}
        onClose={() => setShowNewExerciseModal(false)}
        onSave={handleAddExercise}
        mode={collection.creationMode || 'different'}
        anchorPattern={collection.patternInput}
        anchorBeatsBreakdown={collection.beatsBreakdown}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  menuBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 10,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  patternTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  patternTagText: {
    fontSize: 12,
    fontWeight: '800',
  },
  anchorCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  anchorText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  anchorLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addExerciseBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyAddBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  emptyAddBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  exercisesList: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 40,
  },
  exerciseCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexText: {
    fontSize: 14,
    fontWeight: '800',
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  exerciseDesc: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  exerciseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    width: 200,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
