import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@music-app/store';
import { useAuthStore } from '@music-app/store';
import { 
  createRaag, 
  getRaagData, 
  updateRaagInfo, 
  addGatBandishEntry 
} from '@music-app/firebase';
import { createExerciseCollection } from '@music-app/firebase';
import { uploadToCloudinary } from '@music-app/firebase';
import ExerciseCreationModal from '../../components/library/ExerciseCreationModal';

export default function CreateItemScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const params = useLocalSearchParams<{ 
    id?: string; 
    category?: string; 
    mode?: 'edit' | 'create' 
  }>();

  const isEditMode = params.mode === 'edit' || !!params.id;
  const category = params.category || 'raag'; // raag, songs, laya, tihai
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isDark = theme.background === '#000000';

  const categoryLabels: Record<string, string> = {
    raag: 'Raag',
    songs: 'Song',
    laya: 'Laya',
    tihai: 'Tihai',
    exercises: 'Exercise Collection'
  };

  const collectionNames: Record<string, string> = {
    raag: 'raags',
    songs: 'songs',
    laya: 'laya',
    tihai: 'tihai',
    exercises: 'exerciseCollections'
  };

  const currentLabel = categoryLabels[category] || 'Item';
  const collectionName = collectionNames[category] || 'raags';
  
  const { width: windowWidth } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && windowWidth >= 768;

  useEffect(() => {
    if (isEditMode && params.id) {
      loadData();
    }
  }, [isEditMode, params.id]);

  const loadData = async () => {
    try {
      const data = await getRaagData(params.id!, collectionName);
      if (data) {
        setName(data.name);
        setDescription(data.description || '');
        setHeroImage(data.heroImage || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load item data');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const response = await uploadToCloudinary(uri, 'image', (progress) => {
        setUploadProgress(progress);
      });
      setHeroImage(response.secure_url);
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Upload Failed', 'Could not upload image to Cloudinary');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', `Please enter a ${currentLabel} name`);
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && params.id) {
        await updateRaagInfo(
          params.id,
          name.trim(),
          heroImage,
          description.trim(),
          collectionName
        );
      } else {
        const extra: any = {
           createdBy: currentUser?.uid,
           isSystemDefault: false
        };
        
        if (category === 'songs') extra.musicSubStyleTypes = ['Songs'];
        else if (category === 'laya') extra.musicSubStyleTypes = ['Laya'];
        else if (category === 'tihai') extra.musicSubStyleTypes = ['Tihai'];

        const newItemId = await createRaag(
          name.trim(),
          description.trim(),
          heroImage,
          extra,
          collectionName
        );

        if (category === 'songs') {
          await addGatBandishEntry(newItemId, {
            name: name.trim(),
            type: 'छोटा ख्याल',
            taal: 'Teental',
          }, 'songs');
        }
      }
      
      router.back();
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateExerciseCollection = async (exerciseData: any) => {
    setSaving(true);
    try {
      const collectionId = await createExerciseCollection({
        title: exerciseData.collectionName || 'Untitled Collection',
        patternType: exerciseData.patternType,
        creationMode: exerciseData.creationMode,
        beatsPerCycle: exerciseData.beatsPerCycle,
        beatsBreakdown: exerciseData.beatsBreakdown,
        hasStroke: exerciseData.hasStroke,
        patternInput: exerciseData.patternInput,
        images: exerciseData.images,
        heroImage: exerciseData.images?.[0]?.url || '',
        createdBy: currentUser?.uid,
        isSystemDefault: false,
        category: 'exercises'
      });

      router.replace({
        pathname: `/library/exercise-collection/${collectionId}`,
        params: { category: 'exercises' }
      });
    } catch (error) {
      console.error('Failed to create exercise collection:', error);
      Alert.alert('Error', 'Failed to create collection');
    } finally {
      setSaving(false);
    }
  };

  if (category === 'exercises') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ExerciseCreationModal
          isOpen={true}
          onClose={() => router.back()}
          onNext={handleCreateExerciseCollection}
          category="exercises"
        />
        {saving && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={[
          styles.scrollContainer,
          isWebDesktop && {
            maxWidth: 680,
            width: '100%',
            alignSelf: 'center',
            marginTop: 24,
            borderRadius: 24,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: theme.border,
            padding: 24,
            backgroundColor: theme.card,
          }
        ]}>
        
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="chevron-left" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {isEditMode ? `Edit ${currentLabel}` : `Add New ${currentLabel}`}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                {currentLabel} Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: theme.card, 
                    borderColor: theme.border,
                    color: theme.text 
                  }
                ]}
                value={name}
                onChangeText={setName}
                placeholder={`Enter ${currentLabel.toLowerCase()} name`}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Description (Optional)</Text>
              <TextInput
                style={[
                  styles.input, 
                  styles.textArea,
                  { 
                    backgroundColor: theme.card, 
                    borderColor: theme.border,
                    color: theme.text 
                  }
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder={`Enter ${currentLabel.toLowerCase()} description`}
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Hero Image (Optional)</Text>
              
              {heroImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: heroImage }} style={styles.imagePreview} />
                  <TouchableOpacity 
                    style={styles.removeImageBtn}
                    onPress={() => setHeroImage('')}
                  >
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.uploadZone, 
                    { 
                      backgroundColor: theme.card, 
                      borderColor: theme.border,
                    }
                  ]}
                  onPress={handlePickImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <View style={styles.uploadingContainer}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={[styles.uploadText, { color: theme.textSecondary }]}>
                        Uploading {uploadProgress}%
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.uploadInfo}>
                      <View style={[styles.uploadIcon, { backgroundColor: theme.primarySoft }]}>
                        <MaterialCommunityIcons name="cloud-upload" size={24} color={theme.primary} />
                      </View>
                      <Text style={[styles.uploadText, { color: theme.text }]}>
                        Click to upload hero image
                      </Text>
                      <Text style={[styles.uploadHint, { color: theme.textSecondary }]}>
                        JPG, PNG, WebP recommended
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.btn, styles.btnSecondary, { borderColor: theme.border }]}
              onPress={() => router.back()}
              disabled={saving || uploading}
            >
              <Text style={[styles.btnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.btn, 
                styles.btnPrimary, 
                { backgroundColor: theme.primary },
                (!name.trim() || saving || uploading) && { opacity: 0.6 }
              ]}
              onPress={handleSave}
              disabled={!name.trim() || saving || uploading}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={[styles.btnText, { color: '#FFF' }]}>
                  {isEditMode ? 'Save Changes' : `Create ${currentLabel}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  form: {
    padding: 20,
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  uploadZone: {
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadInfo: {
    alignItems: 'center',
    gap: 8,
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '700',
  },
  uploadHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  uploadingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 1.5,
  },
  btnPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
