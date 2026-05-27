import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@music-app/store';
import { useAuthStore } from '@music-app/store';
import { fetchUserData } from '@music-app/firebase';
import { getAllRaags } from '@music-app/firebase';
import { getAllExercises } from '@music-app/firebase';
import { getAllExerciseCollections } from '@music-app/firebase';
import { categoriesConfig, getVisibleLibraryCategories } from '@music-app/utils';
import CategoryPills from '../../components/library/CategoryPills';
import LibraryCard from '../../components/library/LibraryCard';
import AssignmentsList from '../../components/library/AssignmentsList';
import { getSharedItemIdsForStudent } from '@music-app/firebase';

const getClassAssignmentsByStudent = async (uid: string) => []; 

const { width } = Dimensions.get('window');

export default function Library() {
  const theme = useTheme();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  
  const [userData, setUserData] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState('raag');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const isDark = theme.background === '#000000';

  const visibleCategories = useMemo(
    () => getVisibleLibraryCategories(userData, categoriesConfig),
    [userData]
  );

  const loadData = async (isRefreshing = false) => {
    if (!currentUser) return;
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      let currentUData = userData;
      if (!currentUData) {
        currentUData = await fetchUserData(currentUser.uid);
        setUserData(currentUData);
      }

      const uid = currentUser.uid;
      const accountType = currentUData?.accountType;

      let allItems: any[] = [];
      if (activeCategory === 'raag') {
        allItems = await getAllRaags('raags');
      } else if (activeCategory === 'songs') {
        allItems = await getAllRaags('songs');
      } else if (activeCategory === 'taal') {
        allItems = await getAllRaags('taals');
      } else if (activeCategory === 'laya') {
        allItems = await getAllRaags('laya');
      } else if (activeCategory === 'tihai') {
        allItems = await getAllRaags('tihai');
      } else if (activeCategory === 'exercises') {
        const [exercises, collections] = await Promise.all([
          getAllExercises(),
          getAllExerciseCollections()
        ]);
        allItems = [...collections, ...exercises];
      } else if (activeCategory === 'assignments') {
        const assignments = await getClassAssignmentsByStudent(uid);
        setItems(assignments);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      let sharedIds: string[] = [];
      if (accountType === 'Student') {
        const shareTypeMap: any = {
          raag: 'raag',
          songs: 'song',
          taal: 'taal',
          exercises: 'exerciseCollection',
          laya: 'raag',
          tihai: 'raag'
        };
        sharedIds = await getSharedItemIdsForStudent(uid, shareTypeMap[activeCategory]);
      }

      let filteredItems = allItems;

      if (accountType === 'Student') {
        filteredItems = allItems.filter(item => 
          item.createdBy === uid || 
          sharedIds.includes(item.id)
        );
      } else if (accountType === 'Instructor' || accountType === 'SuperAdmin') {
        const hiddenIds = new Set([
          ...(currentUData?.hiddenSystemDefaults?.raag || []),
          ...(currentUData?.hiddenSystemDefaults?.song || []),
          ...(currentUData?.hiddenSystemDefaults?.taal || []),
          ...(currentUData?.hiddenSystemDefaults?.exerciseCollection || []),
        ]);
        
        filteredItems = allItems.filter(item => {
          const isOwn = item.createdBy === uid;
          const isVisibleSystem = item.isSystemDefault && !hiddenIds.has(item.id);
          return isOwn || isVisibleSystem || accountType === 'SuperAdmin';
        });
      }

      setItems(filteredItems);
    } catch (err) {
      console.error('Error loading library data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, activeCategory]);

  const handleItemPress = (item: any) => {
    const path = activeCategory === 'exercises' 
      ? `/library/exercise-collection/${item.id}` 
      : `/library/${item.id}`;
      
    router.push({
      pathname: path,
      params: { 
        category: activeCategory,
        name: item.name || item.title 
      }
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <LibraryCard
      title={item.name || item.title || 'Untitled'}
      description={item.description || ''}
      image={item.heroImage || item.image}
      isSystem={item.isSystemDefault}
      count={item.exerciseCount}
      onPress={() => handleItemPress(item)}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Library</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your musical collection</Text>
        </View>
        <TouchableOpacity 
          accessibilityLabel="Add to library"
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push({
            pathname: '/library/create',
            params: { category: activeCategory }
          })}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <CategoryPills 
        categories={visibleCategories} 
        activeId={activeCategory}
        onSelect={setActiveCategory}
      />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : activeCategory === 'assignments' ? (
        <AssignmentsList assignments={items} />
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="musical-notes-outline" size={64} color={theme.textSecondary} style={{ opacity: 0.3 }} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No items found here</Text>
        </View>
      ) : (
        Platform.OS === 'web' ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadData(true)}
                tintColor={theme.primary}
              />
            }
          >
            <View className="flex-row flex-wrap justify-start gap-4">
              {items.map((item) => (
                <LibraryCard
                  key={item.id}
                  title={item.name || item.title || 'Untitled'}
                  description={item.description || ''}
                  image={item.heroImage || item.image}
                  isSystem={item.isSystemDefault}
                  count={item.exerciseCount}
                  onPress={() => handleItemPress(item)}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadData(true)}
                tintColor={theme.primary}
              />
            }
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
});
