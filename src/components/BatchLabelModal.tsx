import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import { LabelType, Point } from '../types';

interface BatchLabelModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (config: BatchConfig) => void;
  selectionRect: { start: Point; end: Point } | null;
}

export type NumberingOrder = 
  | 'ltr'           // Left to right, top to bottom: 1 2 3 4 5 / 6 7 8 9 10
  | 'rtl'           // Right to left, top to bottom: 5 4 3 2 1 / 10 9 8 7 6
  | 'boustrophedon' // Alternating: 1 2 3 4 5 / 10 9 8 7 6
  | 'evens-odds'    // Evens first row, odds second: 2 4 6 8 10 / 1 3 5 7 9
  | 'odds-evens'    // Odds first row, evens second: 1 3 5 7 9 / 2 4 6 8 10
  | 'col-ltr'       // Column by column, left to right
  | 'col-rtl';      // Column by column, right to left

export interface BatchConfig {
  rows: number;
  cols: number;
  startBlockNumber: string;
  startHouseNumber: number;
  houseNumberIncrement: number;
  customSequence?: number[]; // Custom sequence of house numbers
  useCustomSequence: boolean;
  // Custom column/row proportions (e.g., "1,2,1" means middle column is twice as wide)
  useCustomWidths: boolean;
  columnWidths?: number[]; // Relative widths for each column
  rowHeights?: number[]; // Relative heights for each row
  type: LabelType;
  color: string;
  numberingDirection: 'row' | 'col';
  numberingOrder: NumberingOrder;
  autoDetectColor: boolean;
  autoDetectArea: boolean;
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
];

const BatchLabelModal: React.FC<BatchLabelModalProps> = ({ 
  visible, 
  onClose, 
  onConfirm, 
  selectionRect 
}) => {
  const [rows, setRows] = useState('2');
  const [cols, setCols] = useState('5');
  const [startBlockNumber, setStartBlockNumber] = useState('G 01');
  const [startHouseNumber, setStartHouseNumber] = useState('1');
  const [houseNumberIncrement, setHouseNumberIncrement] = useState('1');
  const [useCustomSequence, setUseCustomSequence] = useState(false);
  const [customSequenceText, setCustomSequenceText] = useState('');
  const [useCustomWidths, setUseCustomWidths] = useState(false);
  const [columnWidthsText, setColumnWidthsText] = useState('');
  const [rowHeightsText, setRowHeightsText] = useState('');
  const [type, setType] = useState<LabelType>('residential');
  const [color, setColor] = useState('#4A90D9');
  const [numberingDirection, setNumberingDirection] = useState<'row' | 'col'>('row');
  const [numberingOrder, setNumberingOrder] = useState<NumberingOrder>('ltr');
  const [autoDetectColor, setAutoDetectColor] = useState(false);
  const [autoDetectArea, setAutoDetectArea] = useState(false);

  // Parse custom sequence from text
  const parseCustomSequence = (text: string): number[] => {
    return text
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));
  };

  // Parse proportions from text (e.g., "1,2,1" or "1 2 1")
  const parseProportions = (text: string): number[] => {
    return text
      .split(/[,\s]+/)
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0);
  };

  const customSequence = parseCustomSequence(customSequenceText);
  const columnWidths = parseProportions(columnWidthsText);
  const rowHeights = parseProportions(rowHeightsText);

  const numCols = parseInt(cols) || 1;
  const numRows = parseInt(rows) || 1;

  const handleConfirm = () => {
    onConfirm({
      rows: numRows,
      cols: numCols,
      startBlockNumber,
      startHouseNumber: parseInt(startHouseNumber) || 1,
      houseNumberIncrement: parseInt(houseNumberIncrement) || 1,
      useCustomSequence,
      customSequence: useCustomSequence ? customSequence : undefined,
      useCustomWidths,
      columnWidths: useCustomWidths && columnWidths.length > 0 ? columnWidths : undefined,
      rowHeights: useCustomWidths && rowHeights.length > 0 ? rowHeights : undefined,
      type,
      color,
      numberingDirection,
      numberingOrder,
      autoDetectColor,
      autoDetectArea,
    });
    onClose();
  };

  const totalLabels = (parseInt(rows) || 1) * (parseInt(cols) || 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.modalContent}>
              <Text style={styles.title}>Batch Create Labels</Text>
              <Text style={styles.subtitle}>
                Create a grid of {totalLabels} labels in the selected area
              </Text>
              
              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Grid Size */}
                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Rows</Text>
                    <TextInput
                      style={styles.input}
                      value={rows}
                      onChangeText={setRows}
                      keyboardType="numeric"
                      placeholder="2"
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Columns</Text>
                    <TextInput
                      style={styles.input}
                      value={cols}
                      onChangeText={setCols}
                      keyboardType="numeric"
                      placeholder="5"
                    />
                  </View>
                </View>

                {/* Custom Widths Toggle */}
                <View style={styles.field}>
                  <TouchableOpacity
                    style={[
                      styles.checkboxRow,
                      useCustomWidths && styles.checkboxRowActive,
                    ]}
                    onPress={() => setUseCustomWidths(!useCustomWidths)}
                  >
                    <View style={[styles.checkbox, useCustomWidths && styles.checkboxChecked]}>
                      {useCustomWidths && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>Custom cell sizes (for unequal widths)</Text>
                  </TouchableOpacity>
                </View>

                {useCustomWidths && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Column Proportions</Text>
                      <TextInput
                        style={styles.input}
                        value={columnWidthsText}
                        onChangeText={setColumnWidthsText}
                        placeholder={`e.g., 1, 2, 1 for ${numCols} columns`}
                      />
                      <Text style={styles.hint}>
                        Enter relative widths (e.g., "1, 2, 1" = middle is 2× wider).
                        {columnWidths.length > 0 && columnWidths.length !== numCols && (
                          `\n⚠️ Need ${numCols} values, have ${columnWidths.length}`
                        )}
                      </Text>
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Row Proportions (optional)</Text>
                      <TextInput
                        style={styles.input}
                        value={rowHeightsText}
                        onChangeText={setRowHeightsText}
                        placeholder={`e.g., 1, 1 for ${numRows} rows`}
                      />
                      <Text style={styles.hint}>
                        Leave empty for equal heights.
                        {rowHeights.length > 0 && rowHeights.length !== numRows && (
                          `\n⚠️ Need ${numRows} values, have ${rowHeights.length}`
                        )}
                      </Text>
                    </View>
                  </>
                )}

                {/* Block Number */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Block Number (for all)</Text>
                  <TextInput
                    style={styles.input}
                    value={startBlockNumber}
                    onChangeText={setStartBlockNumber}
                    placeholder="e.g., G 01"
                  />
                </View>

                {/* House Number Configuration */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Numbering Mode</Text>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        !useCustomSequence && styles.modeButtonActive,
                      ]}
                      onPress={() => setUseCustomSequence(false)}
                    >
                      <Text style={[
                        styles.modeButtonText,
                        !useCustomSequence && styles.modeButtonTextActive,
                      ]}>
                        Regular
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        useCustomSequence && styles.modeButtonActive,
                      ]}
                      onPress={() => setUseCustomSequence(true)}
                    >
                      <Text style={[
                        styles.modeButtonText,
                        useCustomSequence && styles.modeButtonTextActive,
                      ]}>
                        Custom Sequence
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {!useCustomSequence ? (
                  <>
                    {/* Regular House Number Start */}
                    <View style={styles.row}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Starting House #</Text>
                        <TextInput
                          style={styles.input}
                          value={startHouseNumber}
                          onChangeText={setStartHouseNumber}
                          keyboardType="numeric"
                          placeholder="1"
                        />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Increment</Text>
                        <TextInput
                          style={styles.input}
                          value={houseNumberIncrement}
                          onChangeText={setHouseNumberIncrement}
                          keyboardType="numeric"
                          placeholder="1"
                        />
                      </View>
                    </View>
                    <Text style={styles.hint}>
                      Will create: {startHouseNumber || '1'}, {parseInt(startHouseNumber || '1') + (parseInt(houseNumberIncrement || '1'))}, {parseInt(startHouseNumber || '1') + (parseInt(houseNumberIncrement || '1') * 2)}, ... ({totalLabels} labels)
                    </Text>
                  </>
                ) : (
                  <>
                    {/* Custom Sequence */}
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Custom House Numbers</Text>
                      <TextInput
                        style={[styles.input, { minHeight: 60 }]}
                        value={customSequenceText}
                        onChangeText={setCustomSequenceText}
                        placeholder="e.g., 3, 5, 6, 8, 9, 11, 12"
                        multiline
                      />
                      <Text style={styles.hint}>
                        Enter house numbers separated by commas or spaces.
                        {customSequence.length > 0 && `\nParsed: ${customSequence.slice(0, 5).join(', ')}${customSequence.length > 5 ? '...' : ''} (${customSequence.length} numbers)`}
                        {customSequence.length > 0 && customSequence.length < totalLabels && (
                          `\n⚠️ Need ${totalLabels} numbers, have ${customSequence.length}`
                        )}
                      </Text>
                    </View>
                  </>
                )}

                {/* Numbering Direction */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Numbering Order</Text>
                  <View style={styles.orderOptionsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.orderOption,
                        numberingOrder === 'ltr' && styles.orderOptionActive,
                      ]}
                      onPress={() => setNumberingOrder('ltr')}
                    >
                      <Text style={[styles.orderPreview, numberingOrder === 'ltr' && styles.orderPreviewActive]}>
                        1 2 3{'\n'}4 5 6
                      </Text>
                      <Text style={[styles.orderLabel, numberingOrder === 'ltr' && styles.orderLabelActive]}>
                        L→R
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.orderOption,
                        numberingOrder === 'rtl' && styles.orderOptionActive,
                      ]}
                      onPress={() => setNumberingOrder('rtl')}
                    >
                      <Text style={[styles.orderPreview, numberingOrder === 'rtl' && styles.orderPreviewActive]}>
                        3 2 1{'\n'}6 5 4
                      </Text>
                      <Text style={[styles.orderLabel, numberingOrder === 'rtl' && styles.orderLabelActive]}>
                        R→L
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.orderOption,
                        numberingOrder === 'boustrophedon' && styles.orderOptionActive,
                      ]}
                      onPress={() => setNumberingOrder('boustrophedon')}
                    >
                      <Text style={[styles.orderPreview, numberingOrder === 'boustrophedon' && styles.orderPreviewActive]}>
                        1 2 3{'\n'}6 5 4
                      </Text>
                      <Text style={[styles.orderLabel, numberingOrder === 'boustrophedon' && styles.orderLabelActive]}>
                        Snake
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.orderOption,
                        numberingOrder === 'evens-odds' && styles.orderOptionActive,
                      ]}
                      onPress={() => setNumberingOrder('evens-odds')}
                    >
                      <Text style={[styles.orderPreview, numberingOrder === 'evens-odds' && styles.orderPreviewActive]}>
                        2 4 6{'\n'}1 3 5
                      </Text>
                      <Text style={[styles.orderLabel, numberingOrder === 'evens-odds' && styles.orderLabelActive]}>
                        Even/Odd
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.orderOption,
                        numberingOrder === 'odds-evens' && styles.orderOptionActive,
                      ]}
                      onPress={() => setNumberingOrder('odds-evens')}
                    >
                      <Text style={[styles.orderPreview, numberingOrder === 'odds-evens' && styles.orderPreviewActive]}>
                        1 3 5{'\n'}2 4 6
                      </Text>
                      <Text style={[styles.orderLabel, numberingOrder === 'odds-evens' && styles.orderLabelActive]}>
                        Odd/Even
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.orderOption,
                        numberingOrder === 'col-ltr' && styles.orderOptionActive,
                      ]}
                      onPress={() => setNumberingOrder('col-ltr')}
                    >
                      <Text style={[styles.orderPreview, numberingOrder === 'col-ltr' && styles.orderPreviewActive]}>
                        1 3 5{'\n'}2 4 6
                      </Text>
                      <Text style={[styles.orderLabel, numberingOrder === 'col-ltr' && styles.orderLabelActive]}>
                        Col↓
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Type */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.optionsRow}>
                    {TYPE_OPTIONS.slice(0, 4).map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.optionButton,
                          type === option.value && { backgroundColor: option.color },
                        ]}
                        onPress={() => {
                          setType(option.value);
                          if (!autoDetectColor) {
                            setColor(option.color);
                          }
                        }}
                      >
                        <Text style={[
                          styles.optionText,
                          type === option.value && styles.optionTextSelected,
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Color */}
                <View style={styles.field}>
                  <View style={styles.colorHeader}>
                    <Text style={styles.fieldLabel}>Color</Text>
                    <TouchableOpacity
                      style={[
                        styles.autoDetectButton,
                        autoDetectColor && styles.autoDetectButtonActive,
                      ]}
                      onPress={() => setAutoDetectColor(!autoDetectColor)}
                    >
                      <Text style={[
                        styles.autoDetectText,
                        autoDetectColor && styles.autoDetectTextActive,
                      ]}>
                        🎨 Auto-detect
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {!autoDetectColor && (
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
                  )}
                  {autoDetectColor && (
                    <Text style={styles.autoDetectHint}>
                      Colors will be sampled from each cell's image region
                    </Text>
                  )}
                </View>

                {/* Area Detection */}
                <View style={styles.field}>
                  <View style={styles.colorHeader}>
                    <Text style={styles.fieldLabel}>Area (sq m)</Text>
                    <TouchableOpacity
                      style={[
                        styles.autoDetectButton,
                        autoDetectArea && styles.autoDetectButtonActive,
                      ]}
                      onPress={() => setAutoDetectArea(!autoDetectArea)}
                    >
                      <Text style={[
                        styles.autoDetectText,
                        autoDetectArea && styles.autoDetectTextActive,
                      ]}>
                        📏 OCR from image
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {autoDetectArea && (
                    <Text style={styles.autoDetectHint}>
                      Area values will be read from text in each cell using OCR (may take longer)
                    </Text>
                  )}
                  {!autoDetectArea && (
                    <Text style={[styles.autoDetectHint, { backgroundColor: '#F5F5F5', color: '#888' }]}>
                      Area will not be set automatically
                    </Text>
                  )}
                </View>
              </ScrollView>
              
              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                  <Text style={styles.confirmButtonText}>Create {totalLabels} Labels</Text>
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
    width: Platform.OS === 'web' ? 500 : '95%',
    maxHeight: '85%',
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
  row: {
    flexDirection: 'row',
    gap: 12,
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
  optionButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
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
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  orderOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderOption: {
    width: 70,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  orderOptionActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  orderPreview: {
    fontSize: 10,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },
  orderPreviewActive: {
    color: '#1976D2',
    fontWeight: '600',
  },
  orderLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  orderLabelActive: {
    color: '#1976D2',
    fontWeight: '600',
  },
  colorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  autoDetectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  autoDetectButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  autoDetectText: {
    fontSize: 12,
    color: '#666',
  },
  autoDetectTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  autoDetectHint: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
    backgroundColor: '#F1F8E9',
    borderRadius: 6,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  modeButtonText: {
    fontSize: 13,
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#1976D2',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  checkboxRowActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#999',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
});

export default BatchLabelModal;
