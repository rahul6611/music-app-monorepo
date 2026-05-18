import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@music-app/store';
import { useAuthStore } from '@music-app/store';
import { getModulesForInstructor, getStudentAssignedModules } from '@music-app/firebase';
import { getInstructorStudents, fetchUserData } from '@music-app/firebase';
import { Module, ModuleDifficultyLevel } from '@music-app/types';
import type { StudentUser } from '@music-app/types';
import { deleteModule } from '@music-app/firebase';
import DeleteConfirmationModal from '../../components/library/DeleteConfirmationModal';
import ShareWithStudentsModal from '../../components/library/ShareWithStudentsModal';

const { width } = Dimensions.get('window');

export default function ModulesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const [userData, setUserData] = useState<any>(null);
  
  const [modules, setModules] = useState<Module[]>([]);
  const [students, setStudents] = useState<Array<StudentUser & { firebaseUid: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ModuleDifficultyLevel | 'all'>('all');
  
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const isDark = theme.background === '#000000';

  const loadData = useCallback(async () => {
    if (!authUser) return;
    try {
      setLoading(true);
      const userDoc = await fetchUserData(authUser.uid);
      setUserData(userDoc);

      if (userDoc?.accountType === 'Instructor') {
        const [fetchedModules, fetchedStudents] = await Promise.all([
          getModulesForInstructor(authUser.uid),
          getInstructorStudents(authUser.uid)
        ]);
        setModules(fetchedModules);
        setStudents(fetchedStudents);
      } else {
        const fetchedModules = await getStudentAssignedModules(authUser.uid);
        setModules(fetchedModules);
      }
    } catch (error) {
      console.error('Error loading module data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredModules = modules.filter(m => 
    activeFilter === 'all' || m.moduleDifficultyLevel === activeFilter
  );

  const getDifficultyColor = (level: ModuleDifficultyLevel) => {
    switch (level) {
      case 'basic': return '#10B981'; // Green
      case 'intermediate': return '#F59E0B'; // Orange
      case 'advanced': return '#EF4444'; // Red
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Modules</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Structured learning paths</Text>
        </View>
      </View>

      <View style={[styles.filtersContainer, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['all', 'basic', 'intermediate', 'advanced'].map((filter) => (
            <TouchableOpacity 
              key={filter}
              style={[
                styles.filterTab, 
                activeFilter === filter && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}
              onPress={() => setActiveFilter(filter as any)}
            >
              <Text style={[
                styles.filterText, 
                { color: theme.textSecondary },
                activeFilter === filter && { color: '#FFF' }
              ]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {filteredModules.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.primarySoft }]}>
              <Feather name="book-open" size={48} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No modules found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {activeFilter === 'all' 
                ? (userData?.accountType === 'Instructor' ? "You haven't created any modules yet." : "No modules have been assigned to you yet.") 
                : `No ${activeFilter} modules found.`}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredModules.map((module) => {
              const isWeb = Platform.OS === 'web';
              return (
                <TouchableOpacity 
                  key={module.moduleId}
                  style={[
                    styles.moduleCard, 
                    { backgroundColor: theme.card, borderColor: theme.border },
                    isWeb && { width: undefined }
                  ]}
                  className={isWeb ? "w-full sm:w-[48%] md:w-[48%] lg:w-[31%] xl:w-[23%]" : ""}
                  onPress={() => router.push(`/modules/${module.moduleId}`)}
                >
                  <View style={[styles.cardHeader, { backgroundColor: theme.primary }]}>
                   <Text style={styles.cardInitial}>{module.moduleLabel.charAt(0).toUpperCase()}</Text>
                   <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(module.moduleDifficultyLevel) }]}>
                      <Text style={styles.difficultyText}>{module.moduleDifficultyLevel.toUpperCase()}</Text>
                   </View>
                   {userData?.accountType === 'Instructor' && (
                     <TouchableOpacity 
                      style={styles.moreBtn}
                      onPress={() => {
                          Alert.alert(
                              "Module Actions",
                              "Choose an action for this module.",
                              [
                                  { text: "Edit", onPress: () => router.push({ pathname: '/modules/create', params: { id: module.moduleId } }) },
                                  { text: "Delete", onPress: () => {
                                      setSelectedModule(module);
                                      setShowDeleteModal(true);
                                  }, style: "destructive" },
                                  { text: "Cancel", style: "cancel" }
                              ]
                          );
                      }}
                     >
                        <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
                     </TouchableOpacity>
                   )}
                </View>
                
                <View style={styles.cardBody}>
                  <Text style={[styles.moduleTitle, { color: theme.text }]} numberOfLines={1}>{module.moduleLabel}</Text>
                  <Text style={[styles.moduleDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                    {module.moduleDescription || 'No description'}
                  </Text>
                  
                  <View style={styles.cardFooter}>
                    <View style={styles.itemCount}>
                      <Feather name="list" size={14} color={theme.textSecondary} />
                      <Text style={[styles.countText, { color: theme.textSecondary }]}>
                        {module.moduleContentItems?.length || 0} items
                      </Text>
                    </View>
                  </View>

                  {userData?.accountType === 'Instructor' && (
                    <TouchableOpacity 
                      style={[styles.assignBtn, { backgroundColor: theme.primarySoft }]}
                      onPress={() => {
                          setSelectedModule(module);
                          setShowAssignModal(true);
                      }}
                    >
                      <Text style={[styles.assignText, { color: theme.primary }]}>Assign to Student</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          </View>
        )}
      </ScrollView>

      <DeleteConfirmationModal 
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        itemName={selectedModule?.moduleLabel}
        onConfirm={async () => {
            if (selectedModule) {
                await deleteModule(selectedModule.moduleId);
                loadData();
            }
        }}
      />

      {selectedModule && (
        <ShareWithStudentsModal 
            visible={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            instructorId={authUser?.uid || ''}
            itemType="module"
            itemId={selectedModule.moduleId}
            itemTitle={selectedModule.moduleLabel}
        />
      )}

      {userData?.accountType === 'Instructor' && (
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/modules/create')}
        >
          <Feather name="plus" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -2,
  },
  filtersContainer: {
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  moduleCard: {
    width: (width - 48) / 2,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 4,
  },
  cardHeader: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
  },
  difficultyBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },
  moreBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 16,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  moduleDesc: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  assignBtn: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  }
});
