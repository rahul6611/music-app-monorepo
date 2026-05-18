import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, Image, StyleSheet, FlatList, TouchableOpacity, 
  Dimensions, ActivityIndicator, Share, Modal, TextInput, 
  KeyboardAvoidingView, Platform, Pressable, Keyboard, Linking
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { getMediaFeed, toggleLike, addComment, subscribeToComments } from '@music-app/firebase';
import { useAuthStore } from '@music-app/store';
import { parseSocialVideo, getSocialTypeLabel, SocialVideoType } from '@music-app/utils';
import VideoPlayerWithChapters from '../video/VideoPlayerWithChapters';

const { width } = Dimensions.get('window');
const PAGE_SIZE = 5;

export default function MediaFeed({ refreshTrigger }: { refreshTrigger: number }) {
  const theme = useTheme();
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchFeed = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const { items, lastDoc: newLastDoc } = await getMediaFeed(null, PAGE_SIZE);
      setMediaItems(items);
      setLastDoc(newLastDoc);
      setHasMore(items.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error in fetchFeed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    
    setLoadingMore(true);
    try {
      const { items, lastDoc: newLastDoc } = await getMediaFeed(lastDoc, PAGE_SIZE);
      
      if (items.length > 0) {
        setMediaItems(prev => {
          const prevIds = new Set(prev.map(i => i.id));
          const uniqueNewItems = items.filter(i => !prevIds.has(i.id));
          return [...prev, ...uniqueNewItems];
        });
        setLastDoc(newLastDoc);
        setHasMore(items.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error in loadMore:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [refreshTrigger]);

  const onRefresh = () => {
    fetchFeed(true);
  };

  const renderItem = ({ item }: { item: any }) => {
    return <MediaCard item={item} theme={theme} />;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={mediaItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={styles.feedHeader}>
          <Text style={[styles.feedTitle, { color: theme.text }]}>Featured Posts</Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>Loading more...</Text>
          </View>
        ) : !hasMore && mediaItems.length > 0 ? (
          <View style={styles.footerLoader}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>You've reached the end</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="apps-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No posts yet. Be the first to share!</Text>
        </View>
      }
    />
  );
}

function AudioPlayerContent({ url, theme }: { url: string; theme: any }) {
  const audioPlayer = useAudioPlayer(url);
  const status = useAudioPlayerStatus(audioPlayer);
  const isPlaying = status.playing;

  const playSound = () => {
    if (isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.play();
    }
  };

  useEffect(() => {
    return () => {
      try {
        audioPlayer.pause();
      } catch (e) {
      }
    };
  }, [audioPlayer.id]);

  return (
    <TouchableOpacity
      style={[styles.audioPlayer, { backgroundColor: theme.primarySoft }]}
      onPress={playSound}
    >
      <View style={[styles.playButton, { backgroundColor: theme.primary }]}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#FFF" />
      </View>
      <View style={styles.audioWaveContainer}>
        <Text style={[styles.audioStatus, { color: theme.primary }]}>
          {isPlaying ? 'Playing Audio...' : 'Click to Listen'}
        </Text>
        <View style={[styles.audioBar, { backgroundColor: theme.primary, opacity: isPlaying ? 1 : 0.3 }]} />
      </View>
    </TouchableOpacity>
  );
}

// VideoPlayerContent is replaced by VideoPlayerWithChapters

function SocialMediaContent({ item, theme }: { item: any; theme: any }) {
  const parsed = parseSocialVideo(item.url);
  const type = parsed?.type || (item.type as SocialVideoType);
  const label = getSocialTypeLabel(type as SocialVideoType);
  
  const handlePress = () => {
    Linking.openURL(item.url);
  };

  return (
    <TouchableOpacity 
      style={[styles.socialContainer, { backgroundColor: '#111827' }]}
      onPress={handlePress}
    >
      {parsed?.thumbnailUrl ? (
        <Image source={{ uri: parsed.thumbnailUrl }} style={styles.socialThumbnail} blurRadius={2} />
      ) : (
        <View style={styles.socialThumbnailPlaceholder}>
          <MaterialCommunityIcons 
            name={type === 'facebook' ? 'facebook' : type === 'instagram' ? 'instagram' : type === 'tiktok' ? 'music-note' : 'youtube'} 
            size={60} 
            color="#FFF" 
            style={{ opacity: 0.2 }}
          />
        </View>
      )}
      
      <View style={styles.socialOverlay}>
        <View style={[styles.socialBadge, { backgroundColor: theme.primary }]}>
          <Ionicons 
            name={type === 'youtube' ? 'logo-youtube' : type === 'facebook' ? 'logo-facebook' : type === 'instagram' ? 'logo-instagram' : 'play-circle'} 
            size={16} 
            color="#FFF" 
          />
          <Text style={styles.socialBadgeText}>{label}</Text>
        </View>
        <View style={styles.socialPlayBtn}>
          <Ionicons name="play-circle" size={64} color="#FFF" />
        </View>
        <Text style={styles.socialPrompt}>Tap to watch on {label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MediaCard({ item, theme }: { item: any; theme: any }) {
  const { user } = useAuthStore();
  const [localLikes, setLocalLikes] = useState(item.likesCount || 0);
  const [localLiked, setLocalLiked] = useState(item.likes?.includes(user?.uid) || false);
  const [localComments, setLocalComments] = useState(item.commentsCount || 0);
  const [showComments, setShowComments] = useState(false);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleLike = async () => {
    if (!user) return;
    const isLiked = localLiked;
    setLocalLiked(!isLiked);
    setLocalLikes(prev => isLiked ? prev - 1 : prev + 1);
    
    try {
      await toggleLike(item.id, user.uid, isLiked);
    } catch (err) {
      setLocalLiked(isLiked);
      setLocalLikes(localLikes);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${item.type} on Musiki: ${item.url}`,
        url: item.url,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const isSocial = ['youtube', 'facebook', 'instagram', 'tiktok'].includes(item.type);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>{item.type?.[0]?.toUpperCase() || 'M'}</Text>
        </View>
        <View>
          <Text style={[styles.fileName, { color: theme.text }]}>{item.title || item.fileName || 'Untitled Post'}</Text>
          <Text style={[styles.date, { color: theme.textSecondary }]}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.mediaContainer}>
        {item.type === 'image' && (
          <Image source={{ uri: item.url }} style={[styles.imageMedia, { aspectRatio: 1.3 }]} resizeMode="cover" />
        )}

        {item.type === 'video' && (
          <VideoPlayerWithChapters 
            url={item.url} 
            postId={item.id} 
            initialChapters={item.chapters}
            canEdit={user?.uid === item.createdBy}
            onChaptersUpdate={(newChapters) => {
            }}
          />
        )}

        {item.type === 'audio' && (
          <View style={{ aspectRatio: 1.3 }}>
            <AudioPlayerContent url={item.url} theme={theme} />
          </View>
        )}

        {isSocial && (
          <View style={{ aspectRatio: 1.3 }}>
            <SocialMediaContent item={item} theme={theme} />
          </View>
        )}

        {item.type === 'pdf' && (
          <TouchableOpacity 
            style={[styles.pdfContainer, { backgroundColor: theme.card, aspectRatio: 1.3 }]}
            onPress={() => Linking.openURL(item.url)}
          >
            <Ionicons name="document-text" size={40} color={theme.danger} />
            <Text style={[styles.pdfText, { color: theme.text }]}>View PDF Document</Text>
          </TouchableOpacity>
        )}
      </View>

      {item.notes && (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { color: theme.text }]} numberOfLines={3}>
            {item.notes}
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.footerAction} onPress={handleLike}>
          <Ionicons 
            name={localLiked ? "heart" : "heart-outline"} 
            size={22} 
            color={localLiked ? theme.danger : theme.textSecondary} 
          />
          <Text style={[styles.footerText, { color: localLiked ? theme.danger : theme.textSecondary }]}>
            {localLikes} {localLikes === 1 ? 'Like' : 'Likes'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.footerAction} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            {localComments} {localComments === 1 ? 'Comment' : 'Comments'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.footerAction} onPress={onShare}>
          <Ionicons name="share-social-outline" size={20} color={theme.textSecondary} />
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>Share</Text>
        </TouchableOpacity>
      </View>

      <CommentModal 
        visible={showComments} 
        onClose={() => setShowComments(false)} 
        postId={item.id} 
        theme={theme}
        onCommentSent={() => setLocalComments(prev => prev + 1)}
      />
    </View>
  );
}

function CommentModal({ 
  visible, onClose, postId, theme, onCommentSent 
}: { 
  visible: boolean; 
  onClose: () => void; 
  postId: string; 
  theme: any;
  onCommentSent?: () => void;
}) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && postId) {
      const unsubscribe = subscribeToComments(postId, (newComments) => {
        setComments(newComments);
      });
      return () => unsubscribe();
    }
  }, [visible, postId]);

  const handleSend = async () => {
    if (!commentText.trim() || !user) return;
    
    setSending(true);
    try {
      await addComment(postId, user.uid, user.displayName || 'User', commentText.trim());
      setCommentText('');
      if (onCommentSent) onCommentSent();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: any }) => {
    const commentDate = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    const timeString = isNaN(commentDate.getTime()) ? '' : commentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.commentItem}>
        <View style={[styles.commentAvatar, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.commentAvatarText, { color: theme.primary }]}>{item.userName?.[0] || 'U'}</Text>
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentUser, { color: theme.text }]}>{item.userName}</Text>
            <Text style={[styles.commentTime, { color: theme.textSecondary }]}>{timeString}</Text>
          </View>
          <Text style={[styles.commentText, { color: theme.text }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.modalOverlay}
        keyboardVerticalOffset={0}
      >
        <Pressable 
          style={styles.modalBackground} 
          onPress={onClose} 
        />
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Comments</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            ref={flatListRef}
            data={comments}
            renderItem={renderComment}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.commentsList}
            keyboardShouldPersistTaps="always"
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubbles-outline" size={40} color={theme.textSecondary} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyCommentsText, { color: theme.textSecondary }]}>No comments yet. Be the first!</Text>
              </View>
            }
          />
          
          <View style={[styles.inputContainer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
              placeholder="Add a comment..."
              placeholderTextColor={theme.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              blurOnSubmit={false}
            />
            <View 
              style={styles.sendButton} 
              onTouchEnd={(e) => {
                e.stopPropagation();
                if (commentText.trim() && !sending) {
                  handleSend();
                }
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons 
                  name="send" 
                  size={24} 
                  color={!commentText.trim() || sending ? theme.textSecondary : theme.primary} 
                />
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 18,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.6,
  },
  mediaContainer: {
    width: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  imageMedia: {
    width: '100%',
    height: '100%',
  },
  videoMedia: {
    width: '100%',
    height: '100%',
  },
  audioPlayer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioWaveContainer: {
    flex: 1,
    marginLeft: 15,
  },
  audioStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  audioBar: {
    height: 6,
    width: '100%',
    borderRadius: 3,
  },
  pdfContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  pdfText: {
    fontWeight: '700',
    fontSize: 16,
  },
  socialContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  socialThumbnail: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.5,
  },
  socialThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  socialBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  socialBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  socialPlayBtn: {
    marginBottom: 10,
  },
  socialPrompt: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.9,
  },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 15,
    paddingHorizontal: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 50,
    opacity: 0.7,
  },
  feedHeader: {
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 20,
  },
  feedTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  footerLoader: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
  },
  footerTextSmall: {
    fontSize: 12,
    opacity: 0.6,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '80%',
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  commentsList: {
    padding: 20,
    paddingBottom: 100,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    fontWeight: '800',
    fontSize: 14,
  },
  commentContent: {
    flex: 1,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentTime: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyComments: {
    alignItems: 'center',
    marginTop: 60,
    gap: 10,
  },
  emptyCommentsText: {
    fontSize: 14,
    opacity: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1,
    fontSize: 14,
  },
  sendButton: {
    marginLeft: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionContainer: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  }
});
