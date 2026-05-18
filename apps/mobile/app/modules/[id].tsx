import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@music-app/store';
import { getModuleData } from '@music-app/firebase';
import { fetchUserData } from '@music-app/firebase';
import { useAuthStore } from '@music-app/store';
import { Module, ModuleContentItem } from '@music-app/types';

export default function ModuleDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: authUser } = useAuthStore();
  
  const [module, setModule] = useState<Module | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!authUser) return;
    try {
      const [data, userDoc] = await Promise.all([
        getModuleData(id!),
        fetchUserData(authUser.uid)
      ]);
      setModule(data);
      setUserData(userDoc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (item: ModuleContentItem) => {
    if (item.type === 'raag' || item.type === 'song') {
      router.push({
        pathname: '/library/[id]',
        params: { id: item.contentId, category: item.type === 'song' ? 'songs' : 'raag' }
      });
    } else if (item.type === 'exerciseCollection') {
        router.push(`/exercise-collection/${item.contentId}`);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'raag': return <Feather name="book-open" size={20} color={theme.primary} />;
      case 'song': return <Feather name="play" size={20} color="#3B82F6" />;
      case 'exerciseCollection': return <Feather name="music" size={20} color="#10B981" />;
      default: return <Feather name="file-text" size={20} color={theme.textSecondary} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'raag': return 'Raag';
      case 'song': return 'Song';
      case 'exerciseCollection': return 'Exercise';
      case 'laya': return 'Laya';
      case 'tihai': return 'Tihai';
      case 'taal': return 'Taal';
      default: return 'Content';
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!module) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Module not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="chevron-left" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{module.moduleLabel}</Text>
            {userData?.accountType === 'Instructor' && (
              <TouchableOpacity 
                  onPress={() => router.push({ pathname: '/modules/create', params: { id: module.moduleId } })}
                  style={styles.editBtn}
              >
                <Feather name="edit-2" size={22} color={theme.primary} />
              </TouchableOpacity>
            )}
        </View>

        {module.moduleDescription ? (
          <View style={[styles.descriptionBox, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.description, { color: theme.textSecondary }]}>{module.moduleDescription}</Text>
          </View>
        ) : null}

        <View style={styles.contentList}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Module Content</Text>
          
          {module.moduleContentItems.map((item, idx) => (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.itemIconBox}>
                {getTypeIcon(item.type)}
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: theme.text }]}>{item.contentName}</Text>
                <Text style={[styles.itemType, { color: theme.textSecondary }]}>{getTypeLabel(item.type)}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  scroll: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  editBtn: {
    padding: 8,
  },
  descriptionBox: {
    margin: 20,
    padding: 16,
    borderRadius: 16,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  contentList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  itemIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemType: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  }
});
