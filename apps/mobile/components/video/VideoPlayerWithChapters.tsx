import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Alert,
  Modal,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { VideoChapter, updateChapters } from '@music-app/firebase';
import { useAuthStore } from '@music-app/store';

interface VideoPlayerWithChaptersProps {
  url: string;
  postId: string;
  initialChapters?: VideoChapter[];
  canEdit?: boolean;
  updateOptions?: { collectionName?: string; parentId?: string };
  onChaptersUpdate?: (chapters: VideoChapter[]) => void;
}

export default function VideoPlayerWithChapters({ 
  url, 
  postId, 
  initialChapters, 
  canEdit = false,
  updateOptions,
  onChaptersUpdate
}: VideoPlayerWithChaptersProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const player = useVideoPlayer(url);
  const [chapters, setChapters] = useState<VideoChapter[]>(initialChapters || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterTime, setNewChapterTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    if (initialChapters) {
      setChapters(initialChapters);
    }
  }, [initialChapters]);

  const handleJumpToChapter = (timestamp: number) => {
    player.seekBy(timestamp - player.currentTime);
    player.play();
  };

  const handleAddCurrentTime = () => {
    player.pause();
    const currentTime = Math.floor(player.currentTime);
    setNewChapterTime(formatSeconds(currentTime));
    setShowAddModal(true);
  };

  const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const parseTimestamp = (text: string): number | null => {
    const parts = text.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0]);
      const seconds = parseInt(parts[1]);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return minutes * 60 + seconds;
      }
    } else if (parts.length === 1) {
      const seconds = parseInt(parts[0]);
      if (!isNaN(seconds)) return seconds;
    }
    return null;
  };

  const saveChapter = async () => {
    if (!newChapterTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the chapter');
      return;
    }

    const timestamp = parseTimestamp(newChapterTime);
    if (timestamp === null) {
      Alert.alert('Error', 'Invalid timestamp format. Use MM:SS or seconds.');
      return;
    }

    const newChapter: VideoChapter = {
      id: `ch_${Date.now()}`,
      title: newChapterTitle.trim(),
      timestamp: timestamp,
    };

    const updatedChapters = [...chapters, newChapter].sort((a, b) => a.timestamp - b.timestamp);
    
    setIsSaving(true);
    try {
      await updateChapters(postId, updatedChapters, updateOptions);
      setChapters(updatedChapters);
      if (onChaptersUpdate) onChaptersUpdate(updatedChapters);
      setShowAddModal(false);
      setNewChapterTitle('');
      setNewChapterTime('');
    } catch (error) {
      Alert.alert('Error', 'Failed to save chapter');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteChapter = async (chapterId: string) => {
    const updatedChapters = chapters.filter(ch => ch.id !== chapterId);
    try {
      await updateChapters(postId, updatedChapters, updateOptions);
      setChapters(updatedChapters);
      if (onChaptersUpdate) onChaptersUpdate(updatedChapters);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete chapter');
    }
  };

  return (
    <View style={styles.container}>
      <VideoView 
        player={player} 
        style={styles.video} 
        nativeControls 
      />

      <View style={styles.chaptersContainer}>
        <View style={styles.chaptersHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Chapters</Text>
          {canEdit && (
            <TouchableOpacity 
              style={[styles.addBtn, { backgroundColor: theme.primarySoft }]}
              onPress={handleAddCurrentTime}
            >
              <Ionicons name="add" size={20} color={theme.primary} />
              <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Chapter</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chaptersList}
        >
          {chapters.length > 0 ? (
            chapters.map((chapter) => (
              <TouchableOpacity
                key={chapter.id}
                activeOpacity={0.7}
                style={[styles.chapterChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleJumpToChapter(chapter.timestamp)}
              >
                <View style={[styles.chapterIcon, { backgroundColor: theme.primarySoft }]}>
                  <Ionicons name="play" size={12} color={theme.primary} />
                </View>
                <View style={styles.chapterInfo}>
                  <Text style={[styles.chapterTime, { color: theme.primary }]}>
                    {formatSeconds(chapter.timestamp)}
                  </Text>
                  <Text style={[styles.chapterTitle, { color: theme.text }]} numberOfLines={1}>
                    {chapter.title}
                  </Text>
                </View>
                {canEdit && (
                  <TouchableOpacity 
                    onPress={() => deleteChapter(chapter.id)}
                    style={styles.deleteChapter}
                  >
                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
               <Feather name="list" size={24} color={theme.textSecondary} style={{ opacity: 0.3, marginBottom: 4 }} />
               <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                 No chapters added yet
               </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add New Chapter</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>CHAPTER TITLE</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={newChapterTitle}
                onChangeText={setNewChapterTitle}
                placeholder="e.g. Introduction"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>TIMESTAMP (MM:SS)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={newChapterTime}
                onChangeText={setNewChapterTime}
                placeholder="e.g. 1:20"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={saveChapter}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Chapter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  chaptersContainer: {
    padding: 15,
  },
  chaptersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chaptersList: {
    gap: 10,
    paddingRight: 20,
  },
  chapterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 140,
    maxWidth: 220,
    marginRight: 4,
  },
  chapterIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTime: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  chapterTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteChapter: {
    marginLeft: 8,
    padding: 2,
  },
  emptyState: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  }
});
