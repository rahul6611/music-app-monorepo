import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getFacebookToken,
  loginWithFacebook,
  fetchFacebookPages,
  publishToFacebookPages,
} from '../../utils/oauthShareActions';
import { getPostShareUrls } from '../../utils/communityShareActions';

interface FacebookPublishModalProps {
  visible: boolean;
  onClose: () => void;
  post: any;
  theme: any;
}

export default function FacebookPublishModal({
  visible,
  onClose,
  post,
  theme,
}: FacebookPublishModalProps) {
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [publishType, setPublishType] = useState<'link' | 'media'>('link');
  const [busyPublishing, setBusyPublishing] = useState(false);

  useEffect(() => {
    if (visible && post) {
      const { message } = getPostShareUrls(post);
      setCaption(message);
      loadPages();
    } else {
      setPages([]);
      setSelectedPages([]);
    }
  }, [visible, post]);

  const loadPages = async () => {
    setLoading(true);
    try {
      let token = await getFacebookToken();
      if (!token) {
        token = await loginWithFacebook();
      }
      const pageList = await fetchFacebookPages(token);
      setPages(pageList);
      // Select all pages by default
      setSelectedPages(pageList.map((p) => p.id));
    } catch (error: any) {
      console.error(error);
      const message = error?.message || 'Could not fetch your Facebook Pages.';
      const hint = message.includes('EXPO_PUBLIC_FACEBOOK_APP_ID')
        ? message
        : `${message}\n\nChecklist:\n• Add EXPO_PUBLIC_FACEBOOK_APP_ID to apps/mobile/.env\n• Add FACEBOOK_APP_SECRET to Vercel (not mobile)\n• Add Facebook Login use case in Meta Developer\n• Add redirect URI: https://musiki.vercel.app/api/facebook-callback\n• Add yourself as App Admin/Tester in Meta`;
      Alert.alert('Facebook Authentication Failed', hint);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const togglePageSelection = (pageId: string) => {
    setSelectedPages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const handlePublish = async () => {
    if (selectedPages.length === 0) {
      Alert.alert('No Pages Selected', 'Please select at least one page to post to.');
      return;
    }

    setBusyPublishing(true);
    try {
      const selectedPageDetails = pages.filter((p) => selectedPages.includes(p.id));
      await publishToFacebookPages({
        pages: selectedPageDetails,
        caption: caption.trim(),
        publishType,
        post,
      });
      Alert.alert('Success', 'Successfully posted to your selected Facebook Pages!');
      onClose();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Posting Failed', error.message || 'Something went wrong while publishing.');
    } finally {
      setBusyPublishing(false);
    }
  };

  const isMediaAvailable = post?.type === 'video' || post?.type === 'image';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.background} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Post to Facebook Pages</Text>
            <TouchableOpacity onPress={onClose} disabled={busyPublishing}>
              <Ionicons name="close-circle" size={26} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Connecting Facebook...
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Caption</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Write something about this post..."
                placeholderTextColor={theme.textSecondary}
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={3}
                editable={!busyPublishing}
              />

              {isMediaAvailable && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                    Publish Type
                  </Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        publishType === 'link' && { backgroundColor: theme.primary },
                        { borderColor: theme.border },
                      ]}
                      onPress={() => setPublishType('link')}
                      disabled={busyPublishing}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          { color: publishType === 'link' ? '#FFF' : theme.text },
                        ]}
                      >
                        Share Musiki Link
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        publishType === 'media' && { backgroundColor: theme.primary },
                        { borderColor: theme.border },
                      ]}
                      onPress={() => setPublishType('media')}
                      disabled={busyPublishing}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          { color: publishType === 'media' ? '#FFF' : theme.text },
                        ]}
                      >
                        Upload Native Media
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 16 }]}>
                Select Pages ({selectedPages.length}/{pages.length})
              </Text>

              {pages.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No managed Facebook Pages found. Make sure you logged in with a Facebook account that manages pages.
                </Text>
              ) : (
                <View style={styles.pagesList}>
                  {pages.map((page) => {
                    const isSelected = selectedPages.includes(page.id);
                    return (
                      <TouchableOpacity
                        key={page.id}
                        style={[
                          styles.pageRow,
                          { backgroundColor: theme.card, borderColor: theme.border },
                        ]}
                        onPress={() => togglePageSelection(page.id)}
                        disabled={busyPublishing}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? theme.primary : theme.textSecondary}
                        />
                        <Text style={[styles.pageName, { color: theme.text }]}>{page.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.publishButton,
                  { backgroundColor: theme.primary },
                  (busyPublishing || selectedPages.length === 0) && { opacity: 0.5 },
                ]}
                onPress={handlePublish}
                disabled={busyPublishing || selectedPages.length === 0}
              >
                {busyPublishing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.publishButtonText}>Publish Now</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '90%',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 12,
  },
  pagesList: {
    gap: 8,
    marginBottom: 16,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pageName: {
    fontSize: 14,
    fontWeight: '700',
  },
  publishButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  publishButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
