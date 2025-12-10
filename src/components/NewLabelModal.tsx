import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import { LabelType } from '../types';

interface NewLabelModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (labelData: {
    type: LabelType;
    customType?: string;
    blockNumber: string;
    houseNumber: string;
    color: string;
    area?: number;
  }) => void;
}

const TYPE_OPTIONS: { value: LabelType; label: string; color: string }[] = [
  { value: 'residential', label: 'Residential', color: '#4A90D9' },
  { value: 'commercial', label: 'Commercial', color: '#F5A623' },
  { value: 'park', label: 'Park', color: '#7ED321' },
  { value: 'mosque', label: 'Mosque', color: '#9B59B6' },
  { value: 'school', label: 'School', color: '#E74C3C' },
  { value: 'road', label: 'Road', color: '#95A5A6' },
  { value: 'other', label: 'Other', color: '#BDC3C7' },
];

const COLOR_PRESETS = [
  '#4A90D9', '#F5A623', '#7ED321', '#9B59B6', 
  '#E74C3C', '#1ABC9C', '#3498DB', '#E91E63',
  '#FF9800', '#795548', '#607D8B', '#00BCD4',
];

const NewLabelModal: React.FC<NewLabelModalProps> = ({ visible, onClose, onConfirm }) => {
  const [type, setType] = useState<LabelType>('residential');
  const [customType, setCustomType] = useState('');
  const [blockNumber, setBlockNumber] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [color, setColor] = useState('#4A90D9');

  const handleConfirm = () => {
    onConfirm({
      type,
      customType: type === 'other' ? customType.trim() : undefined,
      blockNumber: blockNumber.trim(),
      houseNumber: houseNumber.trim(),
      color,
    });
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setType('residential');
    setCustomType('');
    setBlockNumber('');
    setHouseNumber('');
    setColor('#4A90D9');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.modalContent}>
              <Text style={styles.title}>New Label</Text>
              <Text style={styles.subtitle}>Configure the new plot/area</Text>
              
              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Type Selection */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.optionsRow}>
                    {TYPE_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.optionButton,
                          type === option.value && { backgroundColor: option.color },
                        ]}
                        onPress={() => {
                          setType(option.value);
                          setColor(option.color);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            type === option.value && styles.optionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Custom Type Input - shown when 'other' is selected */}
                  {type === 'other' && (
                    <TextInput
                      style={[styles.input, { marginTop: 12 }]}
                      value={customType}
                      onChangeText={setCustomType}
                      placeholder="Enter custom type name"
                    />
                  )}
                </View>

                {/* Block Number */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Block Number</Text>
                  <TextInput
                    style={styles.input}
                    value={blockNumber}
                    onChangeText={setBlockNumber}
                    placeholder="e.g., G 01, H 15"
                  />
                </View>

                {/* House Number */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>House Number (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={houseNumber}
                    onChangeText={setHouseNumber}
                    placeholder="e.g., 123, A-5"
                  />
                </View>

                {/* Color */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Color</Text>
                  <View style={styles.colorGrid}>
                    {COLOR_PRESETS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c },
                          color === c && styles.colorSwatchSelected,
                        ]}
                        onPress={() => setColor(c)}
                      />
                    ))}
                  </View>
                </View>
              </ScrollView>
              
              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: Platform.OS === 'web' ? 450 : '90%',
    maxHeight: '80%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  scrollContent: {
    maxHeight: 400,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  optionText: {
    fontSize: 12,
    color: '#666',
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#333',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
  confirmButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default NewLabelModal;
