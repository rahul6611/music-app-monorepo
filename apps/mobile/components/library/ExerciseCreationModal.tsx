import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@music-app/store';
import { uploadToCloudinary } from '@music-app/firebase';

// Import images from assets
const DifferentExercisesImg = require('../../assets/As different exercises.png');
const AnchoredNotesImg = require('../../assets/With anchored notes.png');

const { width, height } = Dimensions.get('window');

interface ExerciseCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNext: (data: any) => void;
  onPrevious?: () => void;
  isEditMode?: boolean;
  initialData?: {
    collectionName?: string;
    patternType?: 'music' | 'percussion';
    creationMode?: 'different' | 'anchored';
    beatsPerCycle?: string;
    beatsBreakdown?: string;
    hasStroke?: boolean;
    patternInput?: string[];
    images?: Array<{ url: string; fileName: string }>;
  };
  category?: 'exercises' | 'laya' | 'tihai';
}

type PatternType = 'music' | 'percussion';
type CreationMode = 'different' | 'anchored';

const ExerciseCreationModal: React.FC<ExerciseCreationModalProps> = ({
  isOpen,
  onClose,
  onNext,
  onPrevious,
  isEditMode = false,
  initialData,
  category = 'exercises'
}) => {
  const theme = useTheme();
  const [collectionName, setCollectionName] = useState('');
  const [patternType, setPatternType] = useState<PatternType>('music');
  const [creationMode, setCreationMode] = useState<CreationMode>('different');
  const [beatsPerCycle, setBeatsPerCycle] = useState('8 (Adi Talam)');
  const [beatsBreakdown, setBeatsBreakdown] = useState('4/2/2');
  const [hasStroke, setHasStroke] = useState(false);
  const [patternInput, setPatternInput] = useState<string[]>(Array(8).fill(''));
  const [exerciseImages, setExerciseImages] = useState<Array<{ url: string; fileName: string }>>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  const isDark = theme.background === '#000000';

  useEffect(() => {
    if (isOpen && initialData) {
      if (initialData.collectionName !== undefined) setCollectionName(initialData.collectionName);
      if (initialData.patternType !== undefined) setPatternType(initialData.patternType);
      if (initialData.creationMode !== undefined) setCreationMode(initialData.creationMode);
      if (initialData.beatsPerCycle !== undefined) setBeatsPerCycle(initialData.beatsPerCycle);
      if (initialData.beatsBreakdown !== undefined) setBeatsBreakdown(initialData.beatsBreakdown);
      if (initialData.hasStroke !== undefined) setHasStroke(initialData.hasStroke);
      if (initialData.patternInput?.length) setPatternInput(initialData.patternInput);
      if (initialData.images?.length) setExerciseImages(initialData.images);
    }
  }, [isOpen, initialData]);

  const handlePatternInputChange = (index: number, value: string) => {
    const newPattern = [...patternInput];
    newPattern[index] = value;
    setPatternInput(newPattern);
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setImageUploading(true);
        setImageUploadProgress(0);
        try {
          const response = await uploadToCloudinary(result.assets[0].uri, 'image', (progress) => {
            setImageUploadProgress(progress);
          });
          setExerciseImages(prev => [...prev, { url: response.secure_url, fileName: 'exercise_image' }]);
        } catch (error) {
          console.error('Image upload failed:', error);
          Alert.alert('Upload Failed', 'Could not upload image');
        } finally {
          setImageUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleRemoveImage = (index: number) => {
    setExerciseImages(prev => prev.filter((_, i) => i !== index));
  };

  const renderStepBadge = (num: number) => (
    <View style={[styles.stepBadge, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '33' }]}>
      <Text style={[styles.stepBadgeText, { color: theme.primary }]}>{num}</Text>
    </View>
  );

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
         
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.stepIndicator, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '33' }]}>
                <Text style={[styles.stepIndicatorText, { color: theme.primary }]}>2</Text>
              </View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {isEditMode ? 'Edit ' : ''}
                {category === 'laya' ? 'Laya Mode' : category === 'tihai' ? 'Tihai Mode' : 'Exercise Mode'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

         
          <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
         
            <View style={styles.formGroup}>
              <View style={styles.sectionLabelContainer}>
                {renderStepBadge(1)}
                <Text style={[styles.formLabel, { color: theme.text }]}>Collection name (Optional)</Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder="Type name here..."
                placeholderTextColor={theme.textSecondary}
                value={collectionName}
                onChangeText={setCollectionName}
              />
            </View>

         
            <View style={styles.formGroup}>
              <View style={styles.sectionLabelContainer}>
                {renderStepBadge(2)}
                <Text style={[styles.formLabel, { color: theme.text }]}>Images</Text>
              </View>
              <View style={styles.imageUploadGrid}>
                {exerciseImages.map((img, idx) => (
                  <View key={idx} style={[styles.imagePreviewCard, { borderColor: theme.border }]}>
                    <Image source={{ uri: img.url }} style={styles.imagePreviewImg} />
                    <TouchableOpacity
                      style={styles.imageRemoveBtn}
                      onPress={() => handleRemoveImage(idx)}
                    >
                      <Ionicons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {exerciseImages.length < 1 && (
                  <TouchableOpacity
                    style={[styles.imageAddTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                    onPress={handleImageUpload}
                    disabled={imageUploading}
                  >
                    {imageUploading ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
                        <Text style={[styles.imageAddText, { color: theme.textSecondary }]}>Add image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.sectionLabelContainer}>
                {renderStepBadge(3)}
                <Text style={[styles.formLabel, { color: theme.text }]}>Which pattern this will be</Text>
              </View>
              <View style={styles.patternSelectionGroup}>
                <TouchableOpacity
                  style={[
                    styles.patternOption,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    patternType === 'music' && { borderColor: theme.primary, backgroundColor: theme.primarySoft + '11' }
                  ]}
                  onPress={() => setPatternType('music')}
                >
                  <Text style={[styles.patternOptionText, { color: theme.text }, patternType === 'music' && { color: theme.primary }]}>Music notes</Text>
                  {patternType === 'music' && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.patternOption,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    patternType === 'percussion' && { borderColor: theme.primary, backgroundColor: theme.primarySoft + '11' }
                  ]}
                  onPress={() => setPatternType('percussion')}
                >
                  <Text style={[styles.patternOptionText, { color: theme.text }, patternType === 'percussion' && { color: theme.primary }]}>Percussion</Text>
                  {patternType === 'percussion' && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.sectionLabelContainer}>
                {renderStepBadge(4)}
                <Text style={[styles.formLabel, { color: theme.text }]}>How do you want to create your exercises?</Text>
              </View>
              <View style={styles.creationModeGrid}>
                <TouchableOpacity
                  style={[
                    styles.creationCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    creationMode === 'different' && { borderColor: theme.primary }
                  ]}
                  onPress={() => setCreationMode('different')}
                >
                  {creationMode === 'different' && <Ionicons name="checkmark-circle" size={24} color={theme.primary} style={styles.creationCardCheck} />}
                  <View style={styles.creationCardImageContainer}>
                     <Image source={DifferentExercisesImg} style={styles.creationCardImage} resizeMode="contain" />
                  </View>
                  <Text style={[styles.creationCardTitle, { color: theme.text }]}>As different exercises</Text>
                  <Text style={[styles.creationCardDesc, { color: theme.textSecondary }]}>Creating every exercise from scratch. Best for variable patterns.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.creationCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    creationMode === 'anchored' && { borderColor: theme.primary }
                  ]}
                  onPress={() => setCreationMode('anchored')}
                >
                  {creationMode === 'anchored' && <Ionicons name="checkmark-circle" size={24} color={theme.primary} style={styles.creationCardCheck} />}
                  <View style={styles.creationCardImageContainer}>
                     <Image source={AnchoredNotesImg} style={styles.creationCardImage} resizeMode="contain" />
                  </View>
                  <Text style={[styles.creationCardTitle, { color: theme.text }]}>With anchored notes</Text>
                  <Text style={[styles.creationCardDesc, { color: theme.textSecondary }]}>Set the anchor notes to have them pre-filled in every new exercise.</Text>
                </TouchableOpacity>
              </View>
            </View>

            {creationMode === 'anchored' && (
              <View style={styles.extraSection}>
                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Beats/Cycle</Text>
                    <Pressable
                      style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, justifyContent: 'center' }]}
                      onPress={() => {
                        Alert.alert("Select Beats", "Choose beats per cycle", [
                          { text: "8 (Adi Talam)", onPress: () => {
                            setBeatsPerCycle("8 (Adi Talam)");
                            setPatternInput(Array(8).fill(''));
                            setBeatsBreakdown('4/2/2');
                          }},
                          { text: "16 (Teentaal)", onPress: () => {
                            setBeatsPerCycle("16 (Teentaal)");
                            setPatternInput(Array(16).fill(''));
                            setBeatsBreakdown('4/4/4/4');
                          }},
                          { text: "12 (Ektaal)", onPress: () => {
                            setBeatsPerCycle("12 (Ektaal)");
                            setPatternInput(Array(12).fill(''));
                            setBeatsBreakdown('2/2/2/2/2/2');
                          }},
                          { text: "Cancel", style: "cancel" }
                        ]);
                      }}
                    >
                      <Text style={{ color: theme.text }}>{beatsPerCycle}</Text>
                      <Ionicons name="chevron-down" size={20} color={theme.textSecondary} style={{ position: 'absolute', right: 12 }} />
                    </Pressable>
                  </View>
                  <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Beats breakdown</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                      value={beatsBreakdown}
                      onChangeText={setBeatsBreakdown}
                      placeholder="e.g. 4/2/2"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.checkboxContainer}
                  onPress={() => setHasStroke(!hasStroke)}
                >
                  <View style={[styles.checkbox, { borderColor: theme.border }, hasStroke && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                    {hasStroke && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: theme.textSecondary }]}>Stroke</Text>
                </TouchableOpacity>

                <View style={styles.formGroup}>
                  <View style={styles.patternTableHeader}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Enter pattern</Text>
                    <TouchableOpacity>
                      <Text style={[styles.addRowText, { color: theme.primary }]}>+ Add row</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.patternInputGrid}>
                    {(() => {
                      const segments = beatsBreakdown.split(/[/,]/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
                      const separatorIndices = new Set<number>();
                      let current = 0;
                      for (let i = 0; i < segments.length - 1; i++) {
                        current += segments[i];
                        separatorIndices.add(current - 1);
                      }

                      return patternInput.map((val, idx) => (
                        <React.Fragment key={idx}>
                          <TextInput
                            style={[styles.patternCell, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            value={val}
                            onChangeText={(v) => handlePatternInputChange(idx, v)}
                            maxLength={3}
                            textAlign="center"
                          />
                          {separatorIndices.has(idx) && (
                            <View style={[styles.separator, { backgroundColor: theme.border }]} />
                          )}
                        </React.Fragment>
                      ));
                    })()}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            <TouchableOpacity onPress={onPrevious || onClose} style={styles.prevBtn}>
              <Text style={[styles.prevBtnText, { color: theme.textSecondary }]}>
                {onPrevious ? 'Previous' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => onNext({ collectionName, patternType, creationMode, beatsPerCycle, beatsBreakdown, hasStroke, patternInput, images: exerciseImages })}
              style={[styles.nextBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.nextBtnText}>{isEditMode ? 'Save' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorText: {
    fontSize: 14,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  formGroup: {
    gap: 10,
  },
  sectionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  imageUploadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imagePreviewCard: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreviewImg: {
    width: '100%',
    height: '100%',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAddTrigger: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imageAddText: {
    fontSize: 10,
    fontWeight: '700',
  },
  patternSelectionGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  patternOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  patternOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  creationModeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  creationCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  creationCardCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  creationCardIconContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  creationCardImageContainer: {
    width: '100%',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  creationCardImage: {
    width: '100%',
    height: '100%',
  },
  creationCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  creationCardDesc: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  extraSection: {
    gap: 20,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  patternTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '700',
  },
  patternInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  patternCell: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    width: 1.5,
    height: 24,
    marginHorizontal: 2,
  },
  footer: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  prevBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  prevBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nextBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ExerciseCreationModal;
