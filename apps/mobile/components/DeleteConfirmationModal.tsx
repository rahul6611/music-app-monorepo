import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '@music-app/store';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName?: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
}) => {
  const theme = useTheme();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {message}
            {itemName && <Text style={{ fontWeight: 'bold' }}> {itemName}</Text>}
          </Text>
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton, { backgroundColor: theme.primarySoft }]} 
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: theme.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.deleteButton, { backgroundColor: '#fee2e2' }]} 
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              <Text style={[styles.buttonText, { color: '#dc2626' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {},
  deleteButton: {},
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default DeleteConfirmationModal;
