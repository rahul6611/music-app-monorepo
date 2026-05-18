import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import MediaPostCreator from '../community/MediaPostCreator';

interface AddMediaModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export default function AddMediaModal({ visible, onClose, onSave }: AddMediaModalProps) {
  const theme = useTheme();

  const handleSuccess = async (result: any) => {
    await onSave(result);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Add Media Reference</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Feather name="x" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <MediaPostCreator 
                  showSocialLinks={true}
                  onSuccess={handleSuccess}
                  onComplete={onClose}
                />
              </View>
              
              <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  }
});
