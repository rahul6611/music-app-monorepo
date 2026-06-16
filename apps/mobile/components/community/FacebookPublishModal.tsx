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
  getSavedFacebookPagePreferences,
  saveFacebookPagePreferences,
  clearFacebookPagePreferences,
  isFacebookPermissionError,
  FACEBOOK_PAGE_PERMISSIONS,
  type FacebookPageAccount,
  type FacebookPagePublishResult,
} from '../../utils/oauthShareActions';
import { getPostShareUrls } from '../../utils/communityShareActions';

type ModalStep = 'setup' | 'publishing' | 'results';

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
  const [pages, setPages] = useState<FacebookPageAccount[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [publishType, setPublishType] = useState<'link' | 'media'>('link');
  const [rememberSelection, setRememberSelection] = useState(false);
  const [step, setStep] = useState<ModalStep>('setup');
  const [publishResults, setPublishResults] = useState<FacebookPagePublishResult[]>([]);
  const [publishProgress, setPublishProgress] = useState<Record<string, 'pending' | 'success' | 'error'>>({});

  useEffect(() => {
    if (visible && post) {
      const { message } = getPostShareUrls(post);
      setCaption(message);
      setStep('setup');
      setPublishResults([]);
      setPublishProgress({});
      loadPages();
    } else if (!visible) {
      setPages([]);
      if (!rememberSelection) {
        setSelectedPages([]);
      }
    }
  }, [visible, post]);

  const loadPages = async (forceReconnect = false) => {
    setLoading(true);
    try {
      let token = await getFacebookToken();
      if (!token || forceReconnect) {
        token = await loginWithFacebook({ force: forceReconnect });
      }
      const pageList = await fetchFacebookPages(token);
      setPages(pageList);

      if (rememberSelection) {
        const saved = await getSavedFacebookPagePreferences();
        if (saved?.length) {
          const validIds = saved.filter((id) => pageList.some((p) => p.id === id));
          setSelectedPages(validIds.length > 0 ? validIds : pageList.map((p) => p.id));
        } else {
          setSelectedPages(pageList.map((p) => p.id));
        }
      } else {
        const saved = await getSavedFacebookPagePreferences();
        if (saved?.length) {
          setRememberSelection(true);
          const validIds = saved.filter((id) => pageList.some((p) => p.id === id));
          setSelectedPages(validIds.length > 0 ? validIds : pageList.map((p) => p.id));
        } else {
          setSelectedPages(pageList.map((p) => p.id));
        }
      }
    } catch (error: any) {
      console.error(error);
      const message = error?.message || 'Could not fetch your Facebook Pages.';
      const hint = message.includes('EXPO_PUBLIC_FACEBOOK_APP_ID')
        ? message
        : `${message}\n\nChecklist:\n• FACEBOOK_APP_SECRET set on Vercel\n• Redeploy after env changes\n• EXPO_PUBLIC_FACEBOOK_CONFIG_ID in apps/mobile/.env\n• Meta Configuration includes: ${FACEBOOK_PAGE_PERMISSIONS.join(', ')}`;
      if (Platform.OS === 'web') {
        window.alert(`Facebook Authentication Failed\n\n${hint}`);
      } else {
        Alert.alert('Facebook Authentication Failed', hint);
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePageSelection = (pageId: string) => {
    setSelectedPages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId],
    );
  };

  const selectAllPages = () => setSelectedPages(pages.map((p) => p.id));
  const deselectAllPages = () => setSelectedPages([]);

  const toggleRememberSelection = async () => {
    const next = !rememberSelection;
    setRememberSelection(next);
    if (next && selectedPages.length > 0) {
      await saveFacebookPagePreferences(selectedPages);
    } else if (!next) {
      await clearFacebookPagePreferences();
    }
  };

  const handleReconnect = async () => {
    setStep('setup');
    setPublishResults([]);
    await loadPages(true);
  };

  const handlePublish = async () => {
    if (selectedPages.length === 0) {
      Alert.alert('No Pages Selected', 'Please select at least one page to post to.');
      return;
    }

    if (rememberSelection) {
      await saveFacebookPagePreferences(selectedPages);
    }

    const selectedPageDetails = pages.filter((p) => selectedPages.includes(p.id));
    const initialProgress: Record<string, 'pending' | 'success' | 'error'> = {};
    selectedPageDetails.forEach((p) => {
      initialProgress[p.id] = 'pending';
    });
    setPublishProgress(initialProgress);
    setStep('publishing');

    const results = await publishToFacebookPages({
      pages: selectedPageDetails,
      caption: caption.trim(),
      publishType,
      post,
      onProgress: (result) => {
        setPublishProgress((prev) => ({
          ...prev,
          [result.pageId]: result.success ? 'success' : 'error',
        }));
      },
    });

    setPublishResults(results);
    setStep('results');
  };

  const handleClose = () => {
    if (step === 'publishing') return;
    onClose();
  };

  const isMediaAvailable = post?.type === 'video' || post?.type === 'image';
  const successCount = publishResults.filter((r) => r.success).length;
  const failureCount = publishResults.filter((r) => !r.success).length;
  const hasPermissionErrors = publishResults.some(
    (r) => !r.success && r.error && isFacebookPermissionError(r.error),
  );
  const isPublishing = step === 'publishing';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.background} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {step === 'results' ? 'Publish Results' : 'Post to Facebook Pages'}
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={isPublishing}>
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
          ) : step === 'results' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View
                style={[
                  styles.summaryBanner,
                  {
                    backgroundColor: failureCount === 0 ? '#10B98122' : successCount > 0 ? '#F59E0B22' : '#EF444422',
                    borderColor: failureCount === 0 ? '#10B981' : successCount > 0 ? '#F59E0B' : '#EF4444',
                  },
                ]}
              >
                <Ionicons
                  name={failureCount === 0 ? 'checkmark-circle' : successCount > 0 ? 'alert-circle' : 'close-circle'}
                  size={28}
                  color={failureCount === 0 ? '#10B981' : successCount > 0 ? '#F59E0B' : '#EF4444'}
                />
                <Text style={[styles.summaryText, { color: theme.text }]}>
                  {failureCount === 0
                    ? `Published to all ${successCount} page${successCount !== 1 ? 's' : ''}!`
                    : successCount > 0
                      ? `Published to ${successCount} of ${publishResults.length} pages`
                      : 'Publishing failed for all pages'}
                </Text>
              </View>

              {hasPermissionErrors && (
                <View style={[styles.permissionBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.permissionText, { color: theme.text }]}>
                    Missing Facebook permissions. Add {FACEBOOK_PAGE_PERMISSIONS.join(', ')} to your Meta
                    Configuration, then reconnect.
                  </Text>
                  <TouchableOpacity
                    style={[styles.reconnectButton, { borderColor: theme.primary }]}
                    onPress={handleReconnect}
                  >
                    <Ionicons name="refresh" size={16} color={theme.primary} />
                    <Text style={[styles.reconnectText, { color: theme.primary }]}>Reconnect Facebook</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                Per-Page Status
              </Text>
              <View style={styles.pagesList}>
                {publishResults.map((result) => (
                  <View
                    key={result.pageId}
                    style={[
                      styles.resultRow,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons
                      name={result.success ? 'checkmark-circle' : 'close-circle'}
                      size={22}
                      color={result.success ? '#10B981' : '#EF4444'}
                    />
                    <View style={styles.resultInfo}>
                      <Text style={[styles.pageName, { color: theme.text }]}>{result.pageName}</Text>
                      {!result.success && result.error && (
                        <Text style={[styles.errorText, { color: '#EF4444' }]} numberOfLines={3}>
                          {result.error}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.publishButton, { backgroundColor: theme.primary }]}
                onPress={handleClose}
              >
                <Text style={styles.publishButtonText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {step === 'publishing' && (
                <View style={[styles.progressBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.progressText, { color: theme.text }]}>
                    Publishing to {selectedPages.length} page{selectedPages.length !== 1 ? 's' : ''}...
                  </Text>
                </View>
              )}

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
                editable={!isPublishing}
              />

              {isMediaAvailable && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                    Publishing Mode
                  </Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        publishType === 'link' && { backgroundColor: theme.primary },
                        { borderColor: theme.border },
                      ]}
                      onPress={() => setPublishType('link')}
                      disabled={isPublishing}
                    >
                      <View style={styles.radioRow}>
                        <Ionicons
                          name={publishType === 'link' ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={publishType === 'link' ? '#FFF' : theme.textSecondary}
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            { color: publishType === 'link' ? '#FFF' : theme.text },
                          ]}
                        >
                          Share Musiki Link
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        publishType === 'media' && { backgroundColor: theme.primary },
                        { borderColor: theme.border },
                      ]}
                      onPress={() => setPublishType('media')}
                      disabled={isPublishing}
                    >
                      <View style={styles.radioRow}>
                        <Ionicons
                          name={publishType === 'media' ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={publishType === 'media' ? '#FFF' : theme.textSecondary}
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            { color: publishType === 'media' ? '#FFF' : theme.text },
                          ]}
                        >
                          Upload Native Media
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.pagesHeader}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginBottom: 0 }]}>
                  Select Pages ({selectedPages.length}/{pages.length})
                </Text>
                {!isPublishing && pages.length > 0 && (
                  <View style={styles.selectActions}>
                    <TouchableOpacity onPress={selectAllPages}>
                      <Text style={[styles.selectActionText, { color: theme.primary }]}>All</Text>
                    </TouchableOpacity>
                    <Text style={{ color: theme.textSecondary }}>·</Text>
                    <TouchableOpacity onPress={deselectAllPages}>
                      <Text style={[styles.selectActionText, { color: theme.primary }]}>None</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {pages.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No managed Facebook Pages found. Make sure you logged in with a Facebook account that
                  manages pages.
                </Text>
              ) : (
                <View style={styles.pagesList}>
                  {pages.map((page) => {
                    const isSelected = selectedPages.includes(page.id);
                    const status = publishProgress[page.id];
                    return (
                      <TouchableOpacity
                        key={page.id}
                        style={[
                          styles.pageRow,
                          { backgroundColor: theme.card, borderColor: theme.border },
                          status === 'success' && { borderColor: '#10B981' },
                          status === 'error' && { borderColor: '#EF4444' },
                        ]}
                        onPress={() => togglePageSelection(page.id)}
                        disabled={isPublishing}
                      >
                        {status === 'pending' ? (
                          <ActivityIndicator size="small" color={theme.primary} />
                        ) : status === 'success' ? (
                          <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                        ) : status === 'error' ? (
                          <Ionicons name="close-circle" size={22} color="#EF4444" />
                        ) : (
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isSelected ? theme.primary : theme.textSecondary}
                          />
                        )}
                        <Text style={[styles.pageName, { color: theme.text }]}>{page.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {!isPublishing && pages.length > 0 && (
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={toggleRememberSelection}
                >
                  <Ionicons
                    name={rememberSelection ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={rememberSelection ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.rememberText, { color: theme.textSecondary }]}>
                    Remember page selection for next time
                  </Text>
                </TouchableOpacity>
              )}

              {!isPublishing && (
                <TouchableOpacity
                  style={[styles.reconnectLink, { borderColor: theme.border }]}
                  onPress={() => loadPages(true)}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.reconnectLinkText, { color: theme.textSecondary }]}>
                    Reconnect Facebook
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.publishButton,
                  { backgroundColor: theme.primary },
                  (isPublishing || selectedPages.length === 0) && { opacity: 0.5 },
                ]}
                onPress={handlePublish}
                disabled={isPublishing || selectedPages.length === 0}
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.publishButtonText}>
                    Publish to {selectedPages.length} Page{selectedPages.length !== 1 ? 's' : ''}
                  </Text>
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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  selectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectActionText: {
    fontSize: 13,
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
    marginBottom: 12,
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
    flex: 1,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rememberText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reconnectLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  reconnectLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  publishButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  publishButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  permissionBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  reconnectText: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultInfo: {
    flex: 1,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
