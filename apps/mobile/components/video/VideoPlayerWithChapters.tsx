import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { VideoChapter, updateChapters } from '@music-app/firebase';
import { useAuthStore } from '@music-app/store';

const SKIP_SECONDS = 3;
const DOUBLE_TAP_DELAY_MS = 350;
const CONTROL_BAR_EXCLUDE_RATIO = 0.82;

interface VideoPlayerWithChaptersProps {
  url: string;
  postId: string;
  initialChapters?: VideoChapter[];
  canEdit?: boolean;
  updateOptions?: { collectionName?: string; parentId?: string };
  onChaptersUpdate?: (chapters: VideoChapter[]) => void;
  showSkipControls?: boolean;
}

export default function VideoPlayerWithChapters({ 
  url, 
  postId, 
  initialChapters, 
  canEdit = false,
  updateOptions,
  onChaptersUpdate,
  showSkipControls = false,
}: VideoPlayerWithChaptersProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const player = useVideoPlayer(url);
  const videoViewRef = useRef<any>(null);
  const lastTapRef = useRef<{ side: 'left' | 'right'; time: number } | null>(null);
  const skipFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chapters, setChapters] = useState<VideoChapter[]>(initialChapters || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterTime, setNewChapterTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (initialChapters) {
      setChapters(initialChapters);
    }
  }, [initialChapters]);

  useEffect(() => {
    return () => {
      if (skipFeedbackTimeoutRef.current) {
        clearTimeout(skipFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    const nativeRef = videoViewRef.current?.nativeRef;
    return nativeRef?.current ?? null;
  }, []);

  const seekTo = useCallback((targetSeconds: number, resumeIfPlaying = true) => {
    const videoEl = getVideoElement();
    const duration = videoEl?.duration ?? player.duration;
    const clampedTime = Math.max(
      0,
      Number.isFinite(duration) && duration > 0
        ? Math.min(duration, targetSeconds)
        : targetSeconds
    );

    if (videoEl) {
      const wasPlaying = !videoEl.paused;
      videoEl.currentTime = clampedTime;
      if (resumeIfPlaying && wasPlaying) {
        void videoEl.play().catch(() => {});
      }
      return;
    }

    const wasPlaying = player.playing;
    player.currentTime = clampedTime;
    if (resumeIfPlaying && wasPlaying) {
      player.play();
    }
  }, [getVideoElement, player]);

  const showSkipIndicator = useCallback((side: 'left' | 'right') => {
    if (skipFeedbackTimeoutRef.current) {
      clearTimeout(skipFeedbackTimeoutRef.current);
    }
    setSkipFeedback(side);
    skipFeedbackTimeoutRef.current = setTimeout(() => setSkipFeedback(null), 700);
  }, []);

  const handleSkip = useCallback((seconds: number) => {
    const videoEl = getVideoElement();
    const currentTime = videoEl?.currentTime ?? player.currentTime;
    seekTo(currentTime + seconds);
  }, [getVideoElement, player, seekTo]);

  const handleDoubleTapSkip = useCallback((side: 'left' | 'right') => {
    handleSkip(side === 'left' ? -SKIP_SECONDS : SKIP_SECONDS);
    showSkipIndicator(side);
  }, [handleSkip, showSkipIndicator]);

  const handleSkipZonePress = useCallback((side: 'left' | 'right') => {
    const now = Date.now();
    const lastTap = lastTapRef.current;

    if (lastTap?.side === side && now - lastTap.time < DOUBLE_TAP_DELAY_MS) {
      handleDoubleTapSkip(side);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { side, time: now };
    }
  }, [handleDoubleTapSkip]);

  useEffect(() => {
    if (!showSkipControls || Platform.OS !== 'web') return;

    let cleanup: (() => void) | undefined;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const attachDoubleClick = () => {
      const videoEl = getVideoElement();
      if (!videoEl) {
        if (attempts < 10) {
          attempts += 1;
          retryTimeout = setTimeout(attachDoubleClick, 100);
        }
        return;
      }

      const handleDblClick = (e: MouseEvent) => {
        const rect = videoEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        if (y > CONTROL_BAR_EXCLUDE_RATIO) return;

        if (x < 0.4) {
          e.preventDefault();
          e.stopPropagation();
          handleDoubleTapSkip('left');
        } else if (x > 0.6) {
          e.preventDefault();
          e.stopPropagation();
          handleDoubleTapSkip('right');
        }
      };

      videoEl.addEventListener('dblclick', handleDblClick);
      cleanup = () => videoEl.removeEventListener('dblclick', handleDblClick);
    };

    attachDoubleClick();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      cleanup?.();
    };
  }, [showSkipControls, url, getVideoElement, handleDoubleTapSkip]);

  const handleJumpToChapter = (timestamp: number) => {
    seekTo(timestamp);
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
      <View style={styles.videoWrapper}>
        <VideoView 
          ref={videoViewRef}
          player={player} 
          style={styles.video} 
          nativeControls 
        />

        {showSkipControls && Platform.OS !== 'web' && (
          <>
            <Pressable
              style={styles.skipZoneLeft}
              onPress={() => handleSkipZonePress('left')}
            />
            <Pressable
              style={styles.skipZoneRight}
              onPress={() => handleSkipZonePress('right')}
            />
          </>
        )}

        {skipFeedback && (
          <View
            style={[
              styles.skipIndicator,
              skipFeedback === 'left' ? styles.skipIndicatorLeft : styles.skipIndicatorRight,
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name={skipFeedback === 'left' ? 'play-back' : 'play-forward'}
              size={32}
              color="#FFF"
            />
            <Text style={styles.skipIndicatorText}>{SKIP_SECONDS}</Text>
          </View>
        )}
      </View>

      {showSkipControls && (
        <View style={styles.skipButtonRow}>
          <Pressable
            style={[styles.skipButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              handleSkip(-SKIP_SECONDS);
            }}
          >
            <Ionicons name="play-back" size={18} color={theme.primary} />
            <Text style={[styles.skipButtonText, { color: theme.text }]}>{SKIP_SECONDS}s</Text>
          </Pressable>
          <Pressable
            style={[styles.skipButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              handleSkip(SKIP_SECONDS);
            }}
          >
            <Text style={[styles.skipButtonText, { color: theme.text }]}>{SKIP_SECONDS}s</Text>
            <Ionicons name="play-forward" size={18} color={theme.primary} />
          </Pressable>
        </View>
      )}

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
  videoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  skipZoneLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 48,
    width: '40%',
    zIndex: 10,
  },
  skipZoneRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 48,
    width: '40%',
    zIndex: 10,
  },
  skipIndicator: {
    position: 'absolute',
    top: '42%',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
  },
  skipIndicatorLeft: {
    left: '12%',
  },
  skipIndicatorRight: {
    right: '12%',
  },
  skipIndicatorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -4,
  },
  skipButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 16,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '800',
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
