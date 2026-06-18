import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommunityPostShareInput, getCloudinaryOgImageUrl } from '@music-app/utils';
import {
  copyTextForShareWeb,
  downloadMediaOnWeb,
  getPostShareUrls,
  openPlatformInNewTab,
} from '../../utils/communityShareActions';

export type SocialGuidePlatform = 'instagram' | 'tiktok' | 'youtube';

interface SocialShareGuideModalProps {
  visible: boolean;
  onClose: () => void;
  post: CommunityPostShareInput | null;
  platform: SocialGuidePlatform;
  theme: any;
}

const PLATFORM_CONFIG: Record<
  SocialGuidePlatform,
  {
    title: string;
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
    openLabel: string;
    openUrl: string;
    steps: string[];
  }
> = {
  instagram: {
    title: 'Share on Instagram',
    color: '#E4405F',
    icon: 'logo-instagram',
    openLabel: 'Open Instagram',
    openUrl: 'https://www.instagram.com/',
    steps: [
      'Caption with your Musiki link is copied automatically.',
      'Download your media file using the button below.',
      'Open Instagram → click Create (+) → upload the file.',
      'Paste the caption (Ctrl+V) — your Musiki link is included.',
    ],
  },
  tiktok: {
    title: 'Share on TikTok',
    color: '#111827',
    icon: 'logo-tiktok',
    openLabel: 'Open TikTok Upload',
    openUrl: 'https://www.tiktok.com/upload',
    steps: [
      'Caption with your Musiki link is copied automatically.',
      'Download your video using the button below.',
      'Open TikTok upload page in the new tab.',
      'Select the downloaded file and paste the caption.',
    ],
  },
  youtube: {
    title: 'Share on YouTube',
    color: '#FF0000',
    icon: 'logo-youtube',
    openLabel: 'Open YouTube Studio',
    openUrl: 'https://studio.youtube.com/',
    steps: [
      'Title and description are copied automatically.',
      'Download your video using the button below.',
      'Open YouTube Studio → Create → Upload.',
      'Select the downloaded file and paste the copied details.',
    ],
  },
};

export default function SocialShareGuideModal({
  visible,
  onClose,
  post,
  platform,
  theme,
}: SocialShareGuideModalProps) {
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && width >= 768;
  const config = PLATFORM_CONFIG[platform];

  const [captionCopied, setCaptionCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [openedPlatform, setOpenedPlatform] = useState(false);

  const shareContent = useMemo(() => {
    if (!post) return { caption: '', webUrl: '', title: '' };
    const { webUrl, message, instagramCaption } = getPostShareUrls(post);
    if (platform === 'instagram') {
      return { caption: instagramCaption, webUrl, title: post.title || post.fileName || 'Musiki post' };
    }
    if (platform === 'youtube') {
      const title = post.title || post.fileName?.replace(/\.[^.]+$/, '') || 'Musiki Performance';
      const description = `${post.notes?.trim() ? `${post.notes.trim()}\n\n` : ''}Watch on Musiki:\n${webUrl}`;
      return { caption: `Title: ${title}\n\nDescription:\n${description}`, webUrl, title };
    }
    return { caption: message, webUrl, title: post.title || post.fileName || 'Musiki post' };
  }, [post, platform]);

  useEffect(() => {
    if (!visible || !post) {
      setCaptionCopied(false);
      setDownloading(false);
      setDownloaded(false);
      setOpenedPlatform(false);
      return;
    }

    copyTextForShareWeb(shareContent.caption)
      .then(() => setCaptionCopied(true))
      .catch(() => setCaptionCopied(false));
  }, [visible, post, shareContent.caption]);

  const handleDownload = async () => {
    if (!post || downloading) return;
    setDownloading(true);
    try {
      await downloadMediaOnWeb(post);
      setDownloaded(true);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenPlatform = async () => {
    if (!downloaded && !downloading) {
      await handleDownload();
    }
    openPlatformInNewTab(config.openUrl);
    setOpenedPlatform(true);
  };

  if (!post) return null;

  const isVideo = post.type === 'video';
  const thumbnailUri = isVideo ? getCloudinaryOgImageUrl(post.url, true) : post.url;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border },
            isWebDesktop && styles.sheetDesktop,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={[styles.platformBadge, { backgroundColor: config.color }]}>
              <Ionicons name={config.icon} size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{config.title}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Musiki stays open — {config.openLabel} opens in a new tab
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {(post.type === 'video' || post.type === 'image') && (
              <Image
                source={{ uri: thumbnailUri }}
                style={[styles.preview, { backgroundColor: theme.card }]}
                resizeMode="cover"
              />
            )}

            <View style={[styles.captionBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.captionHeader}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Caption (with Musiki link)</Text>
                {captionCopied && (
                  <View style={styles.copiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.copiedText}>Copied</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.captionText, { color: theme.text }]} selectable>
                {shareContent.caption}
              </Text>
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>Steps</Text>
            {config.steps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: config.color }]}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.text }]}>{step}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() =>
                copyTextForShareWeb(shareContent.caption).then(() => setCaptionCopied(true))
              }
            >
              <Ionicons name="copy-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionText, { color: theme.text }]}>Copy caption again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="download-outline" size={20} color={theme.primary} />
              )}
              <Text style={[styles.actionText, { color: theme.text }]}>
                {downloaded ? 'Downloaded ✓ — click again if needed' : 'Download media file'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: config.color }]}
              onPress={handleOpenPlatform}
            >
              <Ionicons name="open-outline" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>{config.openLabel}</Text>
            </TouchableOpacity>

            {openedPlatform && (
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                {config.openLabel} opened in a new tab. Finish your post there — this Musiki page stays here.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  sheetDesktop: {
    maxWidth: 520,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  platformBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
  },
  captionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  captionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 8,
  },
});
