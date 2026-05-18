import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  ActivityIndicator,
  FlatList,
  Dimensions,
  Platform,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@music-app/store';
import { useAuthStore } from '@music-app/store';
import { 
  getRaagData, 
  getRaagUploads, 
  extractYouTubeId, 
  GatBandishEntry, 
  GatBandishMediaItem, 
  getGatBandishEntries, 
  updateGatBandishEntry, 
  deleteGatBandishEntry, 
  addGatBandishEntry,
  addRaagUpload,
  getNotationByCompositionEntryId,
  addRaagNotation
} from '@music-app/firebase';
import { parseSocialVideo } from '@music-app/utils';
import { fetchUserData } from '@music-app/firebase';
import DeleteConfirmationModal from '../../components/library/DeleteConfirmationModal';
import ShareWithStudentsModal from '../../components/library/ShareWithStudentsModal';
import AddCompositionModal from '../../components/library/AddCompositionModal';
import AddMediaModal from '../../components/library/AddMediaModal';
import SwarDetailValue from '../../components/library/SwarDetailValue';
import NotationTableEnhanced from '../../components/notation/NotationTableEnhanced';
import { parseNestedMusicInput } from '@music-app/utils';
import { useCameraStore } from '@music-app/store';
import { processCapturedMedia, VideoChapter } from '@music-app/firebase';
import VideoPlayerWithChapters from '../../components/video/VideoPlayerWithChapters';

function buildSectionsFromNotationRows(notationRows: any[], fallbackSwarText?: string, beatsPerCycle: number = 16): any[] {
  if (!notationRows?.length) {
    if (fallbackSwarText) {
      const parsedCells = parseNestedMusicInput(fallbackSwarText);
      return [{
        label: 'Sthayi',
        rows: [{
          key: 'row-0',
          cells: parsedCells.map(c => ({ cells: c.data }))
        }]
      }];
    }
    return [];
  }

  const sections: any[] = [];
  let currentSection: { label: string; rows: any[] } | null = null;

  notationRows.forEach((row, idx) => {
    const label = row.sectionLabel || 'Sthayi';
    if (!currentSection || currentSection.label !== label) {
      currentSection = { label, rows: [] };
      sections.push(currentSection);
    }

    let cells: any[] = [];
    
    if (row.entries && Array.isArray(row.entries) && row.entries.length > 0) {
      const beatMap: Record<number, any[]> = {};
      row.entries.forEach((entry: any) => {
        const beat = entry.beat || 1;
        if (!beatMap[beat]) beatMap[beat] = [];
        const content = entry.swar || entry.note || entry.content || "";
        if (content) {
          const parsed = parseNestedMusicInput(content);
          if (parsed.length > 0) {
            beatMap[beat].push(...parsed[0].data);
          } else {
            beatMap[beat].push(content);
          }
        }
      });
      
      for (let i = 1; i <= beatsPerCycle; i++) {
        cells.push({ cells: beatMap[i] || [] });
      }
    } else {
      const content = row.notationContent || row.swarText || row.swar || row.notes || row.content || "";
      const parsedCells = parseNestedMusicInput(content);
      cells = parsedCells.map(c => ({ cells: c.data }));
    }

    currentSection.rows.push({
      key: `row-${idx}`,
      cells: cells
    });
  });

  return sections;
}

const { width } = Dimensions.get('window');

type Tab = 'notation' | 'details';

export default function ItemDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const params = useLocalSearchParams<{ id: string; category?: string }>();
  
  const [activeTab, setActiveTab] = useState<Tab>('notation');
  const [loading, setLoading] = useState(true);
  const [raagData, setRaagData] = useState<RaagData | null>(null);
  const [compositions, setCompositions] = useState<GatBandishEntry[]>([]);
  const [mediaItems, setMediaItems] = useState<RaagUploadItem[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [editingComposition, setEditingComposition] = useState<any>(null);
  
  const [showNotationModal, setShowNotationModal] = useState(false);
  const [selectedNotation, setSelectedNotation] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<GatBandishEntry | null>(null);
  const [loadingNotation, setLoadingNotation] = useState(false);
  const [playingMedia, setPlayingMedia] = useState<any>(null);
  const cameraStore = useCameraStore();

  const isDark = theme.background === '#000000';
  const collectionName = useMemo(() => {
    const cat = params.category || 'raag';
    if (cat === 'songs') return 'songs';
    if (cat === 'taal') return 'taals';
    if (cat === 'laya') return 'laya';
    if (cat === 'tihai') return 'tihai';
    return 'raags';
  }, [params.category]);

  const loadAllData = async () => {
    if (!params.id) return;
    setLoading(true);
    try {
      const [data, entries, uploads, uData] = await Promise.all([
        getRaagData(params.id, collectionName),
        getGatBandishEntries(params.id, collectionName),
        getRaagUploads(params.id, collectionName),
        currentUser ? fetchUserData(currentUser.uid) : null
      ]);

      if (data) setRaagData(data);
      setCompositions(entries);
      setMediaItems(uploads.filter(u => u.url || u.youtubeId));
      if (uData) setUserData(uData);
    } catch (error) {
      console.error('Error loading detail data:', error);
      Alert.alert('Error', 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [params.id]);

  const handleCameraCapture = async (uri: string) => {
    if (!params.id) return;
    try {
      await processCapturedMedia(
        uri,
        cameraStore.mode,
        () => {},
        async (url) => {
          await addRaagUpload(params.id as string, {
            type: cameraStore.mode,
            url: url,
            title: `Capture ${new Date().toLocaleTimeString()}`,
            notes: `Captured on ${new Date().toLocaleDateString()}`,
            fileName: uri.split('/').pop()
          }, collectionName);
          loadAllData();
          Alert.alert('Success', 'Captured media uploaded to library!');
        },
        (err) => Alert.alert('Upload Error', err)
      );
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (cameraStore.capturedUri) {
      const uri = cameraStore.capturedUri;
      cameraStore.setCapturedUri(null);
      handleCameraCapture(uri);
    }
  }, [cameraStore.capturedUri]);

  const [expandedCompId, setExpandedCompId] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!raagData) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Item not found</Text>
      </View>
    );
  }

  const handleShowNotation = async (item: GatBandishEntry) => {
    if (!item.id) return;
    setSelectedItem(item);
    setLoadingNotation(true);
    try {
      const result = await getNotationByCompositionEntryId(item.id, params.id as string, collectionName);
      if (result && result.notationEntry) {
        setSelectedNotation(result.notationEntry);
        setShowNotationModal(true);
      } else {
        Alert.alert("No Notation", "No notation has been added for this composition yet.");
      }
    } catch (error) {
      console.error("Error fetching notation:", error);
      Alert.alert("Error", "Failed to load notation data");
    } finally {
      setLoadingNotation(false);
    }
  };

  const handleDeleteComposition = async (item: GatBandishEntry) => {
    if (!params.id) return;
    Alert.alert(
      "Delete Composition",
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            await deleteGatBandishEntry(params.id as string, item.id!, collectionName);
            loadAllData();
          } 
        }
      ]
    );
  };

  const handleDuplicateSection = async (index: number) => {
    if (!selectedNotation || !selectedNotation.notationData?.notationRows) return;
    const newRows = [...selectedNotation.notationData.notationRows];
    const sectionToDuplicate = JSON.parse(JSON.stringify(newRows[index]));
    newRows.splice(index + 1, 0, { ...sectionToDuplicate, index: index + 1 });
    
    for (let i = index + 2; i < newRows.length; i++) {
      newRows[i].index = i;
    }

    const updatedNotation = {
      ...selectedNotation,
      notationData: {
        ...selectedNotation.notationData,
        notationRows: newRows
      }
    };
    setSelectedNotation(updatedNotation);
    await saveNotation(updatedNotation);
  };

  const handleEditSectionLabel = (index: number) => {
    if (!selectedNotation || !selectedNotation.notationData?.notationRows) return;
    const currentLabel = selectedNotation.notationData.notationRows[index]?.sectionLabel || 'Sthayi';
    
    if (Platform.OS === 'ios') {
      Alert.prompt(
        "Edit Section Label",
        "Enter new label for this section",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Save", 
            onPress: async (newLabel) => {
              if (!newLabel) return;
              updateSectionLabel(index, newLabel);
            }
          }
        ],
        "plain-text",
        currentLabel
      );
    } else {
      Alert.alert(
        "Edit Section Label",
        "Rename to Antara or Sthayi?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Antara", onPress: () => updateSectionLabel(index, "Antara") },
          { text: "Sthayi", onPress: () => updateSectionLabel(index, "Sthayi") },
          { text: "Composition", onPress: () => updateSectionLabel(index, "Composition") },
        ]
      );
    }
  };

  const handleAddSection = async () => {
    if (!selectedNotation || !selectedNotation.notationData?.notationRows) return;
    
    const newRows = [...selectedNotation.notationData.notationRows];
    const newIndex = newRows.length;
    
    const beats = selectedNotation.notationData.beatsPerCycle || selectedItem?.beats || 16;
    const emptyEntries = [];
    for (let i = 1; i <= beats; i++) {
      emptyEntries.push({ beat: i, swar: "" });
    }

    newRows.push({
      index: newIndex,
      sectionLabel: 'Composition',
      entries: emptyEntries
    });

    const updatedNotation = {
      ...selectedNotation,
      notationData: {
        ...selectedNotation.notationData,
        notationRows: newRows
      }
    };
    setSelectedNotation(updatedNotation);
    await saveNotation(updatedNotation);
  };

  const updateSectionLabel = async (index: number, newLabel: string) => {
    const newRows = [...selectedNotation.notationData.notationRows];
    newRows[index].sectionLabel = newLabel;
    
    const updatedNotation = {
      ...selectedNotation,
      notationData: {
        ...selectedNotation.notationData,
        notationRows: newRows
      }
    };
    setSelectedNotation(updatedNotation);
    await saveNotation(updatedNotation);
  };

  const handleDeleteSection = (index: number) => {
    if (!selectedNotation || !selectedNotation.notationData?.notationRows) return;
    Alert.alert(
      "Delete Section",
      "Are you sure you want to delete this section?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const newRows = [...selectedNotation.notationData.notationRows];
            newRows.splice(index, 1);
            
            newRows.forEach((row, i) => row.index = i);

            const updatedNotation = {
              ...selectedNotation,
              notationData: {
                ...selectedNotation.notationData,
                notationRows: newRows
              }
            };
            setSelectedNotation(updatedNotation);
            await saveNotation(updatedNotation);
          }
        }
      ]
    );
  };

  const saveNotation = async (notation: any) => {
    if (!params.id || !selectedItem?.id) return;
    try {
      await addRaagNotation(params.id as string, notation.notationData, {
        notationDocId: notation.id,
        collectionName
      });
    } catch (error) {
      console.error("Error saving notation:", error);
      Alert.alert("Error", "Failed to save changes to database.");
    }
  };

  const renderCompositionItem = ({ item, index }: { item: GatBandishEntry; index: number }) => {
    const isExpanded = expandedCompId === item.id;
    
    return (
      <View style={[styles.compositionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity 
          style={styles.compHeader}
          onPress={() => setExpandedCompId(isExpanded ? null : item.id!)}
        >
          <View style={styles.compLeft}>
            <View style={[styles.compNumber, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.compNumberText, { color: theme.primary }]}>{index + 1}</Text>
            </View>
            <View style={styles.compInfo}>
              <Text style={[styles.compName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.compSub, { color: theme.textSecondary }]}>
                {item.type} • {item.taal || 'No Taal'}
              </Text>
            </View>
          </View>
          <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.compExpanded}>
            <View style={styles.compActions}>
              <TouchableOpacity 
                style={[styles.compActionBtn, { backgroundColor: theme.primarySoft }]}
                onPress={() => handleShowNotation(item)}
              >
                {loadingNotation ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="music-clef-treble" size={18} color={theme.primary} />
                    <Text style={[styles.compActionText, { color: theme.primary }]}>Notation</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.compActionBtn, { backgroundColor: 'rgba(0,0,0,0.05)' }]}
                onPress={() => {
                   setEditingComposition(item);
                   setShowAddCompModal(true);
                }}
              >
                <Feather name="edit-2" size={18} color={theme.text} />
                <Text style={[styles.compActionText, { color: theme.text }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.compActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                onPress={() => handleDeleteComposition(item)}
              >
                <Feather name="trash-2" size={18} color={theme.danger} />
                <Text style={[styles.compActionText, { color: theme.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{raagData.name}</Text>
          {raagData.isSystemDefault && (
            <View style={styles.systemBadge}>
              <Text style={styles.systemBadgeText}>S</Text>
            </View>
          )}
        </View>
        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuBtn}
            onPress={() => setShowMenu(!showMenu)}
          >
            <Feather name="more-horizontal" size={24} color={theme.text} />
          </TouchableOpacity>
          <Modal
            visible={showMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMenu(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
              <View style={styles.modalOverlay}>
                <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border, top: Platform.OS === 'ios' ? 60 : 50, right: 16 }]}>
                   <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setShowMenu(false);
                      router.push({
                        pathname: '/library/create',
                        params: { id: params.id, category: params.category, mode: 'edit' }
                      });
                    }}
                   >
                     <Feather name="edit-2" size={18} color={theme.text} />
                     <Text style={[styles.dropdownText, { color: theme.text }]}>Edit {params.category || 'raag'}</Text>
                   </TouchableOpacity>
                   
                   {userData?.accountType === 'Instructor' && (
                     <TouchableOpacity 
                      style={styles.dropdownItem}
                      onPress={() => {
                        setShowMenu(false);
                        setShowShareModal(true);
                      }}
                     >
                       <Feather name="share-2" size={18} color={theme.text} />
                       <Text style={[styles.dropdownText, { color: theme.text }]}>Share with students</Text>
                     </TouchableOpacity>
                   )}

                   <TouchableOpacity 
                    style={[styles.dropdownItem, { borderBottomWidth: 0 }]}
                    onPress={() => {
                      setShowMenu(false);
                      setShowDeleteModal(true);
                    }}
                   >
                     <Feather name="trash-2" size={18} color={theme.danger} />
                     <Text style={[styles.dropdownText, { color: theme.danger }]}>Delete {params.category || 'raag'}</Text>
                   </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          <AddCompositionModal 
            visible={showAddCompModal}
            initialData={editingComposition}
            onClose={() => {
                setShowAddCompModal(false);
                setEditingComposition(null);
            }}
            onSave={async (data) => {
                if (!params.id) return;
                if (editingComposition) {
                    await updateGatBandishEntry(params.id, editingComposition.id, data, collectionName);
                } else {
                    await addGatBandishEntry(params.id, data, collectionName);
                }
                loadAllData();
            }}
          />

          <AddMediaModal 
            visible={showAddMediaModal}
            onClose={() => setShowAddMediaModal(false)}
            onSave={async (data) => {
                if (!params.id) return;
                const ytId = data.type === 'youtube' ? extractYouTubeId(data.url) : undefined;
                await addRaagUpload(params.id, {
                    ...data,
                    youtubeId: ytId,
                    uploadedBy: currentUser?.uid,
                    uploadedByName: (userData?.firstName ? `${userData.firstName} ${userData.lastName || ''}` : userData?.displayName) || currentUser?.displayName || 'Unknown',
                    uploadedAt: new Date().toISOString()
                }, collectionName);
                loadAllData();
            }}
          />
        </View>
      </View>

      <DeleteConfirmationModal 
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        itemName={raagData.name}
        onConfirm={async () => {
          await deleteRaag(params.id!, collectionName);
          router.back();
        }}
      />

      <ShareWithStudentsModal 
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        instructorId={currentUser?.uid || ''}
        itemType={params.category as any || 'raag'}
        itemId={params.id!}
        itemTitle={raagData.name}
      />

      <View style={styles.tabBar}>
        <TouchableOpacity 
          onPress={() => setActiveTab('notation')}
          style={[styles.tab, activeTab === 'notation' && { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.tabText, activeTab === 'notation' ? { color: '#FFF' } : { color: theme.textSecondary }]}>
            Notation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('details')}
          style={[styles.tab, activeTab === 'details' && { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.tabText, activeTab === 'details' ? { color: '#FFF' } : { color: theme.textSecondary }]}>
            Details
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'notation' ? (
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>COMPOSITION COLLECTION</Text>
              <TouchableOpacity 
                style={[styles.addCompositionBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
                onPress={() => setShowAddCompModal(true)}
              >
                <Ionicons name="add-circle" size={16} color={theme.primary} />
                <Text style={[styles.addCompositionBtnText, { color: theme.primary }]}>Add Composition</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <FlatList 
            data={compositions}
            renderItem={renderCompositionItem}
            keyExtractor={item => item.id!}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={{ color: theme.textSecondary }}>No compositions found</Text>
              </View>
            )}
          />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.detailsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.detailsHeader}>
              <Text style={[styles.detailsTitle, { color: theme.text }]}>Raag Features</Text>
              <TouchableOpacity>
                <Feather name="edit-2" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
            
            {(raagData.detailTable || []).map((row, i) => (
              <View key={i} style={[styles.detailRow, i === 0 && { borderTopWidth: 0 }, { borderTopColor: theme.border }]}>
                <Text style={[styles.detailFeature, { color: theme.textSecondary }]}>{row.feature}</Text>
                <View style={styles.detailValueContainer}>
                  <SwarDetailValue text={row.detail} />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.mediaSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>MEDIA LIBRARY</Text>
                <TouchableOpacity 
                  style={[styles.addCompositionBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
                  onPress={() => setShowAddMediaModal(true)}
                >
                  <Ionicons name="add-circle" size={16} color={theme.primary} />
                  <Text style={[styles.addCompositionBtnText, { color: theme.primary }]}>Add Media</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.mediaGrid}>
              {mediaItems.map((item, i) => {
                const parsed = parseSocialVideo(item.url);
                const isSocial = ['youtube', 'facebook', 'instagram', 'tiktok'].includes(item.type) || !!parsed;
                
                const isWeb = Platform.OS === 'web';
                return (
                  <TouchableOpacity 
                    key={i} 
                    style={[
                      styles.mediaCard, 
                      { backgroundColor: theme.card },
                      isWeb && { width: undefined }
                    ]}
                    className={isWeb ? "w-full sm:w-[48%] md:w-[48%] lg:w-[31%] xl:w-[23%]" : ""}
                    onPress={() => {
                      if (item.type === 'video') {
                        setPlayingMedia(item);
                      } else {
                        Linking.openURL(item.url);
                      }
                    }}
                  >
                    <View style={styles.mediaThumb}>
                      {item.type === 'youtube' || (parsed && parsed.type === 'youtube') ? (
                        <Image 
                          source={{ uri: `https://img.youtube.com/vi/${item.youtubeId || parsed?.id}/mqdefault.jpg` }} 
                          style={styles.thumbImage} 
                        />
                      ) : isSocial && parsed?.thumbnailUrl ? (
                        <Image source={{ uri: parsed.thumbnailUrl }} style={styles.thumbImage} />
                      ) : item.type === 'image' ? (
                        <Image source={{ uri: item.url }} style={styles.thumbImage} />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Feather name={item.type === 'audio' ? 'music' : item.type === 'pdf' ? 'file-text' : 'video'} size={24} color={theme.primary} />
                        </View>
                      )}
                      {(item.type !== 'image' && item.type !== 'pdf') && (
                        <View style={styles.playOverlay}>
                          <Ionicons name="play" size={20} color="#FFF" />
                        </View>
                      )}
                      {isSocial && (
                        <View style={[styles.socialBadgeMini, { backgroundColor: theme.primary }]}>
                          <Ionicons name="link" size={10} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <View style={styles.mediaInfo}>
                      <Text style={[styles.mediaTitle, { color: theme.text }]} numberOfLines={1}>
                        {item.title || item.fileName || 'Untitled'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={!!playingMedia}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPlayingMedia(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={[styles.fullscreenHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setPlayingMedia(null)} style={styles.backBtn}>
              <Feather name="x" size={28} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.fullscreenTitle, { color: theme.text }]}>Video Player</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600' }}>
                {playingMedia?.title || playingMedia?.fileName || "Media"}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={{ flex: 1 }}>
            {playingMedia && (
              <VideoPlayerWithChapters 
                url={playingMedia.url} 
                postId={playingMedia.id} 
                initialChapters={playingMedia.chapters}
                canEdit={currentUser?.uid === playingMedia.uploadedBy || userData?.accountType === 'Instructor'}
                updateOptions={{ collectionName, parentId: params.id as string }}
                onChaptersUpdate={(updatedChapters) => {
                  setMediaItems(prev => prev.map(m => m.id === playingMedia.id ? { ...m, chapters: updatedChapters } : m));
                  setPlayingMedia(prev => ({ ...prev, chapters: updatedChapters }));
                }}
              />
            )}
            
            {playingMedia?.notes && (
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Notes</Text>
                <Text style={{ fontSize: 15, color: theme.text, lineHeight: 22 }}>{playingMedia.notes}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showNotationModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNotationModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={[styles.fullscreenHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowNotationModal(false)} style={styles.backBtn}>
              <Feather name="x" size={28} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.fullscreenTitle, { color: theme.text }]}>Notation View</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600' }}>
                {selectedItem?.name || selectedNotation?.notationData?.compositionName || "Composition"}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={{ flex: 1 }}>
            <View style={{ padding: 16 }}>
              {selectedItem && (
                <View style={{ marginBottom: 16, padding: 12, backgroundColor: isDark ? '#111' : '#f8f9fa', borderRadius: 8 }}>
                   <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 4 }}>{selectedItem.name}</Text>
                   <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                     {selectedItem.type} • {selectedItem.taal} — {selectedItem.beats} beats
                   </Text>
                </View>
              )}
              {selectedNotation && (
                <NotationTableEnhanced 
                  sections={buildSectionsFromNotationRows(
                    selectedNotation.notationData?.notationRows || [],
                    selectedNotation.notationData?.swarText || selectedNotation.notationData?.notation,
                    selectedNotation.notationData?.beatsPerCycle || selectedItem?.beats || 16
                  )}
                  beatsPerCycle={selectedNotation.notationData?.beatsPerCycle || selectedItem?.beats || 16}
                  taalName={selectedItem?.taal || selectedNotation.notationData?.taal || selectedNotation.notationData?.taalName || "Teental"}
                  isAalap={selectedItem?.type === 'Aalap' || selectedNotation.notationData?.isAalap || false}
                  onDuplicateSection={userData?.accountType === 'Instructor' ? handleDuplicateSection : undefined}
                  onEditSection={userData?.accountType === 'Instructor' ? handleEditSectionLabel : undefined}
                  onDeleteSection={userData?.accountType === 'Instructor' ? handleDeleteSection : undefined}
                />
              )}

              {userData?.accountType === 'Instructor' && (
                <TouchableOpacity 
                  style={[styles.addSectionBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
                  onPress={handleAddSection}
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                  <Text style={[styles.addSectionBtnText, { color: theme.primary }]}>Add Composition Section</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  systemBadge: {
    marginLeft: 6,
    backgroundColor: '#3b82f6',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  menuContainer: {
    position: 'relative',
    zIndex: 100,
  },
  menuBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tinyAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addCompositionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  addCompositionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  socialBadgeMini: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  compositionCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  compLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compNumberText: {
    fontSize: 16,
    fontWeight: '800',
  },
  compInfo: {
    flex: 1,
  },
  compName: {
    fontSize: 16,
    fontWeight: '700',
  },
  compSub: {
    fontSize: 13,
    marginTop: 2,
  },
  compExpanded: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  compActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  compActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  compActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailsCard: {
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  detailFeature: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  detailValueContainer: {
    flex: 2,
  },
  mediaSection: {
    paddingBottom: 40,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    gap: 10,
  },
  mediaCard: {
    width: (width - 40) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  mediaThumb: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaInfo: {
    padding: 10,
  },
  mediaTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 16,
    gap: 8,
  },
  addSectionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
