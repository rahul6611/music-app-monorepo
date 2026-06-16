import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import {
  CommunityPostShareInput,
  canShareMediaToInstagram,
  canShareMediaToTikTok,
  canShareMediaToYouTube,
  isSocialEmbedPost,
} from '@music-app/utils';
import {
  copyCommunityPostLink,
  copyCommunityShareCaption,
  shareFacebookLink,
  shareMediaToSocialApps,
  shareViaNativeSheet,
  showYouTubeUploadInfo,
} from '../../utils/communityShareActions';
import FacebookPublishModal from './FacebookPublishModal';
import YouTubeUploadModal from './YouTubeUploadModal';

interface CommunityShareSheetProps {
  visible: boolean;
  onClose: () => void;
  post: CommunityPostShareInput | null;
}

type EveryoneAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => Promise<void> | void;
};

type PlatformAction = {
  id: string;
  label: string;
  disabled?: boolean;
  renderIcon: () => React.ReactNode;
  onPress: () => Promise<void> | void;
};

export default function CommunityShareSheet({
  visible,
  onClose,
  post,
}: CommunityShareSheetProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && width >= 768;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showFacebookModal, setShowFacebookModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [activePost, setActivePost] = useState<CommunityPostShareInput | null>(null);

  useEffect(() => {
    if (post) {
      setActivePost(post);
    }
  }, [post]);

  const resolvedPost = activePost;
  const postLabel = resolvedPost?.fileName || resolvedPost?.title || 'Community post';

  const runAction = async (actionId: string, action: () => Promise<void> | void) => {
    if (!resolvedPost || busyAction) return;
    setBusyAction(actionId);
    try {
      await action();
    } catch (error) {
      console.error('Share action failed:', error);
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(`Share failed: ${message}`);
      } else {
        Alert.alert('Share failed', message);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const everyoneActions = useMemo<EveryoneAction[]>(() => {
    if (!resolvedPost) return [];
    return [
      {
        id: 'copy-link',
        label: 'Copy link',
        icon: 'link-outline',
        onPress: async () => {
          await copyCommunityPostLink(resolvedPost);
          if (Platform.OS === 'web') {
            window.alert('Musiki post link copied to clipboard.');
          } else {
            Alert.alert('Copied', 'Musiki post link copied to clipboard.');
          }
          onClose();
        },
      },
      {
        id: 'copy-caption',
        label: 'Copy Caption',
        icon: 'copy-outline',
        onPress: async () => {
          await copyCommunityShareCaption(resolvedPost);
          if (Platform.OS === 'web') {
            window.alert('Caption copied. Paste it when you post.');
          } else {
            Alert.alert('Copied', 'Caption copied. Paste it when you post.');
          }
          onClose();
        },
      },
      {
        id: 'more',
        label: 'More Apps',
        icon: 'share-outline',
        onPress: async () => {
          await shareViaNativeSheet(resolvedPost);
          onClose();
        },
      },
    ];
  }, [resolvedPost, onClose]);

  const platformActions = useMemo<PlatformAction[]>(() => {
    if (!resolvedPost) return [];

    const isEmbed = isSocialEmbedPost(resolvedPost.type);
    const instagramEnabled = canShareMediaToInstagram(resolvedPost.type);
    const tiktokEnabled = canShareMediaToTikTok(resolvedPost.type);
    const youtubeEnabled = canShareMediaToYouTube(resolvedPost.type);

    return [
      {
        id: 'facebook',
        label: 'Facebook',
        renderIcon: () => <Ionicons name="logo-facebook" size={28} color="#FFFFFF" />,
        onPress: async () => {
          await shareFacebookLink(resolvedPost);
          onClose();
        },
      },
      {
        id: 'fb-pages',
        label: 'FB Pages',
        renderIcon: () => (
          <MaterialCommunityIcons name="facebook-messenger" size={28} color="#FFFFFF" />
        ),
        onPress: () => {
          setShowFacebookModal(true);
          onClose();
        },
      },
      {
        id: 'instagram',
        label: 'Instagram',
        disabled: !instagramEnabled,
        renderIcon: () => <Ionicons name="logo-instagram" size={28} color="#FFFFFF" />,
        onPress: async () => {
          if (isEmbed) {
            const msg = 'Embedded social links cannot be re-uploaded. Copy the Musiki link instead.';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Use Copy link', msg);
            return;
          }
          await copyCommunityShareCaption(resolvedPost, 'instagram');
          await shareMediaToSocialApps(resolvedPost, 'instagram');
          onClose();
        },
      },
      {
        id: 'tiktok',
        label: 'TikTok',
        disabled: !tiktokEnabled,
        renderIcon: () => <Ionicons name="logo-tiktok" size={28} color="#FFFFFF" />,
        onPress: async () => {
          if (isEmbed) {
            const msg = 'Embedded links cannot be shared as TikTok videos.';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Use Copy link', msg);
            return;
          }
          await copyCommunityShareCaption(resolvedPost);
          await shareMediaToSocialApps(resolvedPost);
          onClose();
        },
      },
      {
        id: 'youtube',
        label: 'YouTube',
        disabled: !youtubeEnabled,
        renderIcon: () => <Ionicons name="logo-youtube" size={28} color="#FFFFFF" />,
        onPress: () => {
          if (!youtubeEnabled) {
            showYouTubeUploadInfo(resolvedPost);
            return;
          }
          setShowYouTubeModal(true);
          onClose();
        },
      },
    ];
  }, [resolvedPost, onClose]);

  if (!resolvedPost) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.background, borderColor: theme.border },
              isWebDesktop && styles.sheetDesktop,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <View style={styles.header}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.title, { color: theme.text }]}>Share post</Text>
                <Text style={[styles.postLabel, { color: theme.textSecondary }]} numberOfLines={2}>
                  {postLabel}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Everyone</Text>
            <View style={styles.everyoneRow}>
              {everyoneActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.everyoneCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  disabled={busyAction === action.id}
                  onPress={() => runAction(action.id, action.onPress)}
                >
                  {busyAction === action.id ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <>
                      <View style={[styles.everyoneIconWrap, { backgroundColor: theme.primarySoft }]}>
                        <Ionicons name={action.icon} size={24} color={theme.primary} />
                      </View>
                      <Text style={[styles.everyoneLabel, { color: theme.text }]}>{action.label}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 18 }]}>
              Social platforms
            </Text>
            <View style={styles.platformRow}>
              {platformActions.map((action) => (
                <PlatformIconButton
                  key={action.id}
                  action={action}
                  theme={theme}
                  busy={busyAction === action.id}
                  onPress={() => runAction(action.id, action.onPress)}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FacebookPublishModal
        visible={showFacebookModal}
        onClose={() => setShowFacebookModal(false)}
        post={resolvedPost}
        theme={theme}
      />
      <YouTubeUploadModal
        visible={showYouTubeModal}
        onClose={() => setShowYouTubeModal(false)}
        post={resolvedPost}
        theme={theme}
      />
    </>
  );
}

function PlatformIconButton({
  action,
  theme,
  busy,
  onPress,
}: {
  action: PlatformAction;
  theme: any;
  busy: boolean;
  onPress: () => void;
}) {
  const disabled = action.disabled || busy;

  const circleStyle = (() => {
    switch (action.id) {
      case 'facebook':
      case 'fb-pages':
        return { backgroundColor: '#1877F2' };
      case 'instagram':
        return { backgroundColor: '#E4405F' };
      case 'tiktok':
        return { backgroundColor: '#111827' };
      case 'youtube':
        return { backgroundColor: '#FF0000' };
      default:
        return { backgroundColor: theme.primary };
    }
  })();

  return (
    <TouchableOpacity
      style={[styles.platformButton, { opacity: disabled ? 0.35 : 1 }]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={[styles.platformCircle, circleStyle]}>
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          action.renderIcon()
        )}
      </View>
      <Text style={[styles.platformLabel, { color: theme.text }]} numberOfLines={1}>
        {action.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  sheetDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    marginBottom: 24,
    borderRadius: 24,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  postLabel: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  everyoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  everyoneCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 10,
  },
  everyoneIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  everyoneLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  platformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 8,
  },
  platformButton: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  platformCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
