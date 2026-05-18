import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  ScrollView, ActivityIndicator, Platform, Dimensions,
  Alert
} from 'react-native';
import Constants from 'expo-constants';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { useAuthStore } from '@music-app/store';
import { 
  getRaagNotations, 
  getGatBandishEntries, 
  getNotationByCompositionEntryId, 
  getRaagNotationById 
} from '@music-app/firebase';
import { 
  startAudioRecording, 
  stopAudioRecording, 
  processCapturedMedia, 
  MediaType, 
  UploadProgress 
} from '@music-app/firebase';
import { db } from '@music-app/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { parseNestedMusicInput } from '@music-app/utils';
import NotationTableEnhanced from './notation/NotationTableEnhanced';
import type { AssignmentItem } from '@music-app/types';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { useCameraStore } from '@music-app/store';

const { width, height } = Dimensions.get('window');

export interface PracticeCompositionBlock {
  id: string;
  name: string;
  taal: string;
  compositionType: string;
  sections: Array<{
    label: string;
    rows: Array<{ key: string; cells: any[] }>;
  }>;
  beatsPerCycle: number;
  isAalap: boolean;
}

interface PracticeTrackModalProps {
  isOpen: boolean;
  assignment: AssignmentItem | null;
  classAssignmentId: string;
  planInstructorId?: string;
  onSave: (data: {
    assignmentId: string;
    classAssignmentId: string;
    mediaUrl: string;
    mediaType: 'video' | 'audio';
    practiceCount: number;
    duration: number;
  }) => void;
  onClose: () => void;
}


function buildSectionsFromNotationRows(notationRows: any[], beatsPerCycle: number = 16, fallbackSwarText?: string): any[] {
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
        const beat = entry.absoluteBeat !== undefined ? entry.absoluteBeat : (entry.beat || 1);
        if (!beatMap[beat]) beatMap[beat] = [];
        const content = entry.swar || entry.note || entry.content || entry.notation || "";
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
      const content = row.notationContent || row.swarText || row.swar || row.notes || row.content || row.notation || "";
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

const PracticeTrackModal: React.FC<PracticeTrackModalProps> = ({
  isOpen,
  assignment,
  classAssignmentId,
  planInstructorId,
  onSave,
  onClose,
}) => {
  const theme = useTheme();
  const isDark = theme.background === '#000000';
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const cameraStore = useCameraStore();
  const timerRef = useRef<any>(null);

  const showNotation = assignment?.type === 'raag' || assignment?.type === 'song';

  const [practiceCount, setPracticeCount] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [compositionBlocks, setCompositionBlocks] = useState<PracticeCompositionBlock[]>([]);
  const [loadingNotation, setLoadingNotation] = useState(false);

  useEffect(() => {
    if (isOpen && mediaType === 'video' && cameraStore.capturedUri) {
      handleRecordingComplete(cameraStore.capturedUri);
      cameraStore.setCapturedUri(null); 
    }
  }, [cameraStore.capturedUri, isOpen, mediaType]);

  useEffect(() => {
    if (!isOpen || !assignment || !showNotation) {
      setCompositionBlocks([]);
      return;
    }

    const loadNotation = async () => {
      setLoadingNotation(true);
      try {
        const collectionName = assignment.type === 'song' ? 'songs' : 'raags';
        const itemId = assignment.itemId;
        const blocks: PracticeCompositionBlock[] = [];

        const parentItemId = assignment.parentItemId;
        if (parentItemId?.trim()) {
           const nEntry = await getRaagNotationById(parentItemId, `gatBandish_${itemId}`, collectionName);
            if (nEntry?.notationData?.notationRows?.length || nEntry?.notationData?.swarText || nEntry?.notationData?.notation) {
               const sections = buildSectionsFromNotationRows(
                 nEntry.notationData.notationRows || [], 
                 nEntry.notationData.beatsPerCycle || 16,
                 nEntry.notationData.swarText || nEntry.notationData.notation
               );
              blocks.push({
                id: nEntry.id,
                name: assignment.title || 'Composition',
                taal: nEntry.notationData.taal || '',
                compositionType: '',
                sections,
                beatsPerCycle: nEntry.notationData.beatsPerCycle || 16,
                isAalap: false
              });
              setCompositionBlocks(blocks);
              return;
           }
        }

        const [notations, gatEntries] = await Promise.all([
          getRaagNotations(itemId, collectionName),
          getGatBandishEntries(itemId, collectionName)
        ]);

        const notationById = new Map(notations.map(n => [n.id, n]));

        gatEntries.forEach((entry, index) => {
           const docId = `gatBandish_${entry.id}`;
           const nEntry = notationById.get(docId);
            if (nEntry?.notationData?.notationRows?.length || nEntry?.notationData?.swarText || nEntry?.notationData?.notation) {
               blocks.push({
                 id: docId,
                 name: entry.name || `Composition ${index + 1}`,
                 taal: entry.taal || '',
                 compositionType: entry.type || '',
                 sections: buildSectionsFromNotationRows(
                    nEntry.notationData.notationRows || [], 
                    nEntry.notationData.beatsPerCycle || 16,
                    nEntry.notationData.swarText || nEntry.notationData.notation
                  ),
                beatsPerCycle: nEntry.notationData.beatsPerCycle || 16,
                isAalap: entry.type === 'Aalap'
              });
           }
        });

        if (blocks.length === 0 && notations.length > 0) {
           notations.forEach(n => {
              if (n.notationData?.notationRows?.length) {
                blocks.push({
                  id: n.id,
                  name: n.notationData.compositionName || 'Notation',
                  taal: n.notationData.taal || '',
                  compositionType: '',
                  sections: buildSectionsFromNotationRows(n.notationData.notationRows),
                  beatsPerCycle: n.notationData.beatsPerCycle || 16,
                  isAalap: false
                });
              }
           });
        }

        setCompositionBlocks(blocks);
      } catch (err) {
        console.error('Error loading notation:', err);
      } finally {
        setLoadingNotation(false);
      }
    };

    loadNotation();
  }, [isOpen, assignment]);

  const handleStartRecording = async () => {
    try {
      if (mediaType === 'audio') {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Permission needed', 'Microphone permission is required for audio recording.');
          return;
        }

        await AudioModule.setAudioModeAsync({ 
          allowsRecording: true, 
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
          shouldPlayInBackground: false
        });

        await audioRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
        await audioRecorder.record();
        
        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } else {
        cameraStore.openCamera('video');
        setTimeout(() => cameraStore.setMinimized(true), 500);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Could not start recording: ' + err.message);
    }
  };

  const handleStopRecording = async () => {
    try {
      if (mediaType === 'audio') {
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        await audioRecorder.stop();
        if (audioRecorder.uri) await handleRecordingComplete(audioRecorder.uri);
      } else {
      }
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  const handleRecordingComplete = async (uri: string) => {
    setIsUploading(true);
    try {
      await processCapturedMedia(
        uri,
        mediaType,
        (progress) => setUploadProgress(progress),
        (url) => {
          setRecordedUrl(url);
          setIsUploading(false);
        },
        (error) => {
          Alert.alert('Upload failed', error);
          setIsUploading(false);
        }
      );
    } catch (err) {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!assignment) return;
    setIsSaving(true);
    try {
      await onSave({
        assignmentId: assignment.id,
        classAssignmentId,
        mediaUrl: recordedUrl || '',
        mediaType,
        practiceCount,
        duration: Math.ceil(recordingTime / 60) || 5
      });
      Alert.alert('Success', 'Practice session saved!');
      onClose();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!assignment) return null;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerTitleContainer}>
            <View style={[styles.typeBadge, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.typeBadgeText, { color: theme.primary }]}>
                {assignment.type.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {assignment.title}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {showNotation && (
            <View style={styles.notationSection}>
              {loadingNotation ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : compositionBlocks.length > 0 ? (
                compositionBlocks.map((comp, idx) => (
                  <View key={comp.id} style={styles.notationBlock}>
                    <Text style={[styles.notationTitle, { color: theme.text }]}>
                      {comp.name} {comp.taal ? `(${comp.taal})` : ''}
                    </Text>
                    <NotationTableEnhanced 
                      sections={comp.sections} 
                      beatsPerCycle={comp.beatsPerCycle} 
                      taalName={comp.taal}
                      isAalap={comp.isAalap}
                    />
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No notation available</Text>
              )}
            </View>
          )}

          <View style={[styles.controls, { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc' }]}>
            <View style={styles.settingsRow}>
              <View style={styles.mediaTypeSelector}>
                <TouchableOpacity 
                  onPress={() => setMediaType('audio')}
                  style={[styles.mediaBtn, mediaType === 'audio' && { backgroundColor: theme.primary }]}
                >
                  <MaterialIcons name="audiotrack" size={18} color={mediaType === 'audio' ? '#FFF' : theme.textSecondary} />
                  <Text style={[styles.mediaBtnText, { color: mediaType === 'audio' ? '#FFF' : theme.textSecondary }]}>Audio</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setMediaType('video')}
                  style={[styles.mediaBtn, mediaType === 'video' && { backgroundColor: theme.primary }]}
                >
                  <MaterialIcons name="videocam" size={18} color={mediaType === 'video' ? '#FFF' : theme.textSecondary} />
                  <Text style={[styles.mediaBtnText, { color: mediaType === 'video' ? '#FFF' : theme.textSecondary }]}>Video</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.repCounter}>
                <Text style={[styles.repLabel, { color: theme.textSecondary }]}>Count:</Text>
                <TouchableOpacity onPress={() => setPracticeCount(Math.max(1, practiceCount - 1))} style={styles.countBtn}>
                  <MaterialIcons name="remove" size={16} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.countText, { color: theme.text }]}>{practiceCount}</Text>
                <TouchableOpacity onPress={() => setPracticeCount(practiceCount + 1)} style={styles.countBtn}>
                  <MaterialIcons name="add" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {isRecording && mediaType === 'audio' ? (
              <View style={styles.recordingLive}>
                  <View style={styles.audioViz}>
                    <MaterialIcons name="graphic-eq" size={48} color={theme.primary} />
                  </View>
                <View style={styles.timerRow}>
                  <View style={styles.recDot} />
                  <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
                </View>
              </View>
            ) : recordedUrl ? (
              <View style={styles.successArea}>
                <MaterialIcons name="check-circle" size={32} color="#22c55e" />
                <Text style={styles.successText}>Recording ready!</Text>
              </View>
            ) : null}

            {isUploading && (
              <View style={styles.uploadProgress}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${uploadProgress?.progress || 0}%`, backgroundColor: theme.primary }]} />
                </View>
                <Text style={styles.progressText}>{uploadProgress?.chunkInfo || 'Uploading...'}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          {mediaType === 'audio' && isRecording ? (
            <TouchableOpacity onPress={handleStopRecording} style={styles.stopBtn}>
               <MaterialIcons name="stop" size={24} color="#FFF" />
               <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          ) : (
             <>
               <TouchableOpacity 
                onPress={handleStartRecording} 
                style={[styles.recordBtn, { backgroundColor: mediaType === 'video' && cameraStore.isRecording ? '#000' : '#ef4444' }]}
                disabled={isUploading || isSaving}
               >
                 <MaterialIcons 
                   name={mediaType === 'video' && cameraStore.isRecording ? "stop" : "fiber-manual-record"} 
                   size={20} 
                   color="#FFF" 
                 />
                 <Text style={styles.recordBtnText}>
                   {mediaType === 'video' && cameraStore.isRecording ? 'Stop Video' : 'Record'}
                 </Text>
               </TouchableOpacity>
               <TouchableOpacity 
                onPress={handleSave} 
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                disabled={isUploading || isSaving || isRecording || (mediaType === 'video' && cameraStore.isRecording)}
               >
                 <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save'}</Text>
               </TouchableOpacity>
             </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Constants.statusBarHeight + 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
  },
  notationSection: {
    minHeight: 100,
  },
  notationBlock: {
    marginBottom: 20,
  },
  notationTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
  },
  controls: {
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaTypeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 3,
    gap: 4,
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 6,
  },
  mediaBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  repCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  countBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  recordingLive: {
    height: 200,
    borderRadius: 12,
    backgroundColor: '#000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPreview: {
    width: '100%',
    height: '100%',
  },
  audioViz: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  timerText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadProgress: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  successArea: {
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  successText: {
    color: '#166534',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, 
  },
  recordBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stopBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stopBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  }
});

export default PracticeTrackModal;
