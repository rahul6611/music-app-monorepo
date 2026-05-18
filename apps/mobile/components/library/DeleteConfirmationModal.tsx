import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ActivityIndicator,
  TouchableWithoutFeedback 
} from 'react-native';
import { useTheme } from '@music-app/store';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  message?: string;
  itemName?: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title = "Delete Item",
  message = "Are you sure you want to delete this? This action cannot be undone.",
  itemName,
}) => {
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.content, { backgroundColor: theme.card }]}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              </View>
              
              <View style={styles.body}>
                <Text style={[styles.message, { color: theme.textSecondary }]}>
                  {message}
                  {itemName && (
                    <Text style={[styles.itemName, { color: theme.text }]}>
                      {"\n\n"}“{itemName}”
                    </Text>
                  )}
                </Text>
              </View>

              <View style={[styles.footer, { borderTopColor: theme.border }]}>
                <TouchableOpacity 
                  onPress={onClose} 
                  style={[styles.btn, styles.cancelBtn, { backgroundColor: theme.border }]}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.btnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleConfirm} 
                  style={[styles.btn, styles.deleteBtn, { backgroundColor: theme.danger }]}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={[styles.btnText, { color: '#FFF' }]}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    marginBottom: 24,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  itemName: {
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
  }
});

export default DeleteConfirmationModal;
