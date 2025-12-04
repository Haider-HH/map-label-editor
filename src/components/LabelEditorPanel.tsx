import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Label, LabelStatus, LabelPriority } from '../types';

interface LabelEditorPanelProps {
  label: Label;
  onUpdate: (updates: Partial<Label>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: LabelStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: '#FFA500' },
  { value: 'in_progress', label: 'In Progress', color: '#2196F3' },
  { value: 'completed', label: 'Completed', color: '#4CAF50' },
  { value: 'blocked', label: 'Blocked', color: '#F44336' },
];

const PRIORITY_OPTIONS: { value: LabelPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#8BC34A' },
  { value: 'medium', label: 'Medium', color: '#FF9800' },
  { value: 'high', label: 'High', color: '#F44336' },
];

const LabelEditorPanel: React.FC<LabelEditorPanelProps> = ({
  label,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const formatLabelName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Label</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Label Name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={label.label}
            onChangeText={(text) => onUpdate({ label: text.toLowerCase().replace(/\s+/g, '_') })}
            placeholder="Enter label name"
          />
          <Text style={styles.hint}>Display: {formatLabelName(label.label)}</Text>
        </View>

        {/* Status */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.optionsRow}>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  label.status === option.value && { backgroundColor: option.color },
                ]}
                onPress={() => onUpdate({ status: option.value })}
              >
                <Text
                  style={[
                    styles.optionText,
                    label.status === option.value && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Priority */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.optionsRow}>
            {PRIORITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  label.priority === option.value && { backgroundColor: option.color },
                ]}
                onPress={() => onUpdate({ priority: option.value })}
              >
                <Text
                  style={[
                    styles.optionText,
                    label.priority === option.value && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={label.description || ''}
            onChangeText={(text) => onUpdate({ description: text })}
            placeholder="Enter description"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Assignee */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Assignee</Text>
          <TextInput
            style={styles.input}
            value={label.assignee || ''}
            onChangeText={(text) => onUpdate({ assignee: text })}
            placeholder="Enter assignee name"
          />
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={label.notes || ''}
            onChangeText={(text) => onUpdate({ notes: text })}
            placeholder="Enter notes"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Custom Color */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Custom Color (hex)</Text>
          <TextInput
            style={styles.input}
            value={label.color || ''}
            onChangeText={(text) => onUpdate({ color: text })}
            placeholder="#FF5733"
          />
          {label.color && (
            <View style={[styles.colorPreview, { backgroundColor: label.color }]} />
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Info</Text>
          <Text style={styles.infoText}>ID: {label.id}</Text>
          <Text style={styles.infoText}>Type: {label.originalType}</Text>
          <Text style={styles.infoText}>Points: {label.points.length}</Text>
          {label.createdAt && (
            <Text style={styles.infoText}>Created: {new Date(label.createdAt).toLocaleString()}</Text>
          )}
          {label.updatedAt && (
            <Text style={styles.infoText}>Updated: {new Date(label.updatedAt).toLocaleString()}</Text>
          )}
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>Delete Label</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 320,
    maxHeight: '90%',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 10,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
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
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  infoSection: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LabelEditorPanel;
