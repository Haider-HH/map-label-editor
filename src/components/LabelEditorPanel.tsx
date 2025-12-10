import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Label, LabelType } from '../types';

interface LabelEditorPanelProps {
  label: Label;
  onUpdate: (updates: Partial<Label>) => void;
  onDelete: () => void;
  onClose: () => void;
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

// Get label type - handle legacy format where type might be "polygon"
const getLabelType = (label: Label): LabelType => {
  if (label.type && TYPE_OPTIONS.some(o => o.value === label.type)) {
    return label.type as LabelType;
  }
  return 'other';
};

const LabelEditorPanel: React.FC<LabelEditorPanelProps> = ({
  label,
  onUpdate,
  onDelete,
  onClose,
}) => {
  // Local state for area input to allow typing decimal points
  const [areaText, setAreaText] = useState(label.area?.toString() || '');
  
  // Sync area text when label changes (e.g., selecting different label)
  useEffect(() => {
    setAreaText(label.area?.toString() || '');
  }, [label.id, label.area]);

  // Calculate area from points (shoelace formula)
  const calculateArea = (points: { x: number; y: number }[]): number => {
    if (points.length < 3) return 0;
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  const pixelArea = calculateArea(label.points);
  const currentType = getLabelType(label);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Label</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Legacy label name - show if present */}
        {label.label && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name (Legacy)</Text>
            <Text style={styles.legacyName}>{label.label.replace(/_/g, ' ')}</Text>
          </View>
        )}

        {/* Type */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.optionsRow}>
            {TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  currentType === option.value && { backgroundColor: option.color },
                ]}
                onPress={() => onUpdate({ type: option.value })}
              >
                <Text
                  style={[
                    styles.optionText,
                    currentType === option.value && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Custom Type Input - shown when 'other' is selected */}
          {currentType === 'other' && (
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={label.customType || ''}
              onChangeText={(text) => onUpdate({ customType: text })}
              placeholder="Enter custom type name"
            />
          )}
        </View>

        {/* Block Number */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Block Number</Text>
          <TextInput
            style={styles.input}
            value={label.blockNumber || ''}
            onChangeText={(text) => onUpdate({ blockNumber: text })}
            placeholder="e.g., G 01, H 15"
          />
        </View>

        {/* House Number */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>House Number</Text>
          <TextInput
            style={styles.input}
            value={label.houseNumber || ''}
            onChangeText={(text) => onUpdate({ houseNumber: text })}
            placeholder="e.g., 123, A-5"
          />
        </View>

        {/* Area */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Area (m²)</Text>
          <TextInput
            style={styles.input}
            value={areaText}
            onChangeText={(text) => {
              // Allow empty string, numbers, and partial decimal input (e.g., "160.")
              if (text === '' || /^\d*\.?\d*$/.test(text)) {
                setAreaText(text);
                // Only update the label if it's a valid complete number
                if (text === '') {
                  onUpdate({ area: undefined });
                } else if (!text.endsWith('.')) {
                  const num = parseFloat(text);
                  if (!isNaN(num)) {
                    onUpdate({ area: num });
                  }
                }
              }
            }}
            onBlur={() => {
              // On blur, ensure the value is synced
              if (areaText && !areaText.endsWith('.')) {
                const num = parseFloat(areaText);
                if (!isNaN(num)) {
                  onUpdate({ area: num });
                }
              }
            }}
            placeholder="Enter area in square meters (e.g., 160.5)"
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>Pixel area: {pixelArea.toFixed(0)} px²</Text>
        </View>

        {/* Color */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorGrid}>
            {COLOR_PRESETS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  label.color === color && styles.colorSwatchSelected,
                ]}
                onPress={() => onUpdate({ color })}
              />
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={label.color || ''}
            onChangeText={(text) => onUpdate({ color: text })}
            placeholder="Custom hex color: #FF5733"
          />
          {label.color && (
            <View style={[styles.colorPreview, { backgroundColor: label.color }]} />
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Info</Text>
          <Text style={styles.infoText}>ID: {label.id}</Text>
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
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  legacyName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 6,
    textTransform: 'capitalize',
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
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#333',
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
