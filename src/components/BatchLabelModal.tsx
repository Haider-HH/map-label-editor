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
  // Custom divider positions (fractions from 0 to 1)
  // e.g., for 3 columns: [0.4, 0.7] means dividers at 40% and 70%
  columnDividers?: number[];
  rowDividers?: number[];
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
  // Draggable dividers - fractions from 0 to 1
  const [columnDividers, setColumnDividers] = useState<number[]>([]);
  const [rowDividers, setRowDividers] = useState<number[]>([]);
  const [draggingDivider, setDraggingDivider] = useState<{ type: 'col' | 'row'; index: number } | null>(null);
  const [dragStartDividers, setDragStartDividers] = useState<number[] | null>(null);
  const [dragStartFraction, setDragStartFraction] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState(0);
  const [selectedRow, setSelectedRow] = useState(0);
  const [type, setType] = useState<LabelType>('residential');
  const [color, setColor] = useState('#4A90D9');
  const [numberingDirection, setNumberingDirection] = useState<'row' | 'col'>('row');
  const [numberingOrder, setNumberingOrder] = useState<NumberingOrder>('ltr');
  const [autoDetectColor, setAutoDetectColor] = useState(false);
  const [autoDetectArea, setAutoDetectArea] = useState(false);

  const numCols = parseInt(cols) || 1;
  const numRows = parseInt(rows) || 1;

  // Generate equal dividers when grid size changes
  React.useEffect(() => {
    if (numCols > 1) {
      const newDividers = Array.from({ length: numCols - 1 }, (_, i) => (i + 1) / numCols);
      setColumnDividers(newDividers);
    } else {
      setColumnDividers([]);
    }
  }, [numCols]);

  React.useEffect(() => {
    if (numRows > 1) {
      const newDividers = Array.from({ length: numRows - 1 }, (_, i) => (i + 1) / numRows);
      setRowDividers(newDividers);
    } else {
      setRowDividers([]);
    }
  }, [numRows]);

  // Parse custom sequence from text
  const parseCustomSequence = (text: string): number[] => {
    return text
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));
  };

  const customSequence = parseCustomSequence(customSequenceText);

  // Preview dimensions
  const previewWidth = 280;
  const previewHeight = selectionRect 
    ? (previewWidth * (selectionRect.end.y - selectionRect.start.y) / (selectionRect.end.x - selectionRect.start.x))
    : 120;

  // Start dragging - save original state
  const handleDividerDragStart = (type: 'col' | 'row', index: number, fraction: number) => {
    const dividers = type === 'col' ? columnDividers : rowDividers;
    setDraggingDivider({ type, index });
    setDragStartDividers([...dividers]);
    setDragStartFraction(fraction);
  };

  // Handle divider drag - PUSH mode: only affects the two adjacent cells
  // This keeps all other cells exactly the same size
  const handleDividerDrag = (type: 'col' | 'row', index: number, fraction: number) => {
    if (!dragStartDividers || dragStartFraction === null) return;
    
    const dividers = type === 'col' ? columnDividers : rowDividers;
    
    // Simple mode: just move this divider, clamp between neighbors
    const minFraction = index > 0 ? dividers[index - 1] + 0.01 : 0.01;
    const maxFraction = index < dividers.length - 1 ? dividers[index + 1] - 0.01 : 0.99;
    const clampedFraction = Math.max(minFraction, Math.min(maxFraction, fraction));
    
    if (type === 'col') {
      const newDividers = [...columnDividers];
      newDividers[index] = clampedFraction;
      setColumnDividers(newDividers);
    } else {
      const newDividers = [...rowDividers];
      newDividers[index] = clampedFraction;
      setRowDividers(newDividers);
    }
  };

  // End dragging
  const handleDividerDragEnd = () => {
    setDraggingDivider(null);
    setDragStartDividers(null);
    setDragStartFraction(null);
  };

  // Quick adjust buttons - set specific cells to be larger/smaller
  const adjustCell = (type: 'col' | 'row', cellIndex: number, delta: number) => {
    const dividers = type === 'col' ? [...columnDividers] : [...rowDividers];
    const numCells = type === 'col' ? numCols : numRows;
    
    if (dividers.length === 0) return;
    
    // Get current cell boundaries
    const boundaries = [0, ...dividers, 1];
    const cellStart = boundaries[cellIndex];
    const cellEnd = boundaries[cellIndex + 1];
    const cellSize = cellEnd - cellStart;
    const newSize = Math.max(0.02, Math.min(0.98, cellSize + delta));
    const sizeDiff = newSize - cellSize;
    
    // Distribute the size change to other cells proportionally
    const otherCellsTotal = 1 - cellSize;
    if (otherCellsTotal <= 0.02) return;
    
    // Adjust all dividers
    for (let i = 0; i < dividers.length; i++) {
      if (i < cellIndex) {
        // Dividers before: scale down proportionally
        const scaleFactor = (otherCellsTotal - sizeDiff) / otherCellsTotal;
        dividers[i] = dividers[i] * scaleFactor;
      } else if (i === cellIndex) {
        // The divider at the end of this cell: move by sizeDiff
        if (cellIndex < dividers.length) {
          const prevBoundary = cellIndex > 0 ? dividers[cellIndex - 1] : 0;
          dividers[i] = prevBoundary + newSize;
        }
      } else {
        // Dividers after: shift and scale
        const prevBoundary = cellIndex > 0 ? boundaries[cellIndex] : 0;
        const scaleFactor = (otherCellsTotal - sizeDiff) / otherCellsTotal;
        const relativePos = (boundaries[i + 1] - cellEnd) / (1 - cellEnd);
        dividers[i] = (prevBoundary + newSize) + relativePos * (1 - prevBoundary - newSize);
      }
    }
    
    // Recalculate more simply: set the target cell size and redistribute others
    const newBoundaries = [0];
    let remaining = 1 - newSize;
    for (let i = 0; i < numCells; i++) {
      if (i === cellIndex) {
        newBoundaries.push(newBoundaries[i] + newSize);
      } else {
        const origSize = boundaries[i + 1] - boundaries[i];
        const proportion = origSize / otherCellsTotal;
        const adjustedSize = Math.max(0.01, proportion * remaining);
        newBoundaries.push(newBoundaries[i] + adjustedSize);
      }
    }
    
    // Extract dividers from boundaries (skip first 0 and last 1)
    const newDividers = newBoundaries.slice(1, -1);
    
    if (type === 'col') {
      setColumnDividers(newDividers);
    } else {
      setRowDividers(newDividers);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      rows: numRows,
      cols: numCols,
      startBlockNumber,
      startHouseNumber: parseInt(startHouseNumber) || 1,
      houseNumberIncrement: parseInt(houseNumberIncrement) || 1,
      useCustomSequence,
      customSequence: useCustomSequence ? customSequence : undefined,
      columnDividers: columnDividers.length > 0 ? columnDividers : undefined,
      rowDividers: rowDividers.length > 0 ? rowDividers : undefined,
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

                {/* Visual Grid Preview with Draggable Dividers */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Grid Preview - Drag lines or use controls below</Text>
                  
                  <View style={{ flexDirection: 'row', alignSelf: 'center' }}>
                    <View 
                      style={[styles.gridPreview, { width: previewWidth, height: Math.min(previewHeight, 160) }]}
                      // @ts-ignore - web specific
                      onMouseMove={(e: any) => {
                        if (draggingDivider && Platform.OS === 'web') {
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (draggingDivider.type === 'col') {
                            const fraction = (e.clientX - rect.left) / rect.width;
                            handleDividerDrag('col', draggingDivider.index, fraction);
                          } else {
                            const fraction = (e.clientY - rect.top) / rect.height;
                            handleDividerDrag('row', draggingDivider.index, fraction);
                          }
                        }
                      }}
                      // @ts-ignore
                      onMouseUp={() => handleDividerDragEnd()}
                      // @ts-ignore
                      onMouseLeave={() => handleDividerDragEnd()}
                    >
                      {/* Grid cells */}
                      {Array.from({ length: numRows }).map((_, rowIdx) => {
                        const topFraction = rowIdx === 0 ? 0 : rowDividers[rowIdx - 1];
                        const bottomFraction = rowIdx === numRows - 1 ? 1 : rowDividers[rowIdx];
                        const cellHeight = (bottomFraction - topFraction) * Math.min(previewHeight, 160);
                        const cellTop = topFraction * Math.min(previewHeight, 160);
                        
                        return Array.from({ length: numCols }).map((_, colIdx) => {
                          const leftFraction = colIdx === 0 ? 0 : columnDividers[colIdx - 1];
                          const rightFraction = colIdx === numCols - 1 ? 1 : columnDividers[colIdx];
                          const cellWidth = (rightFraction - leftFraction) * previewWidth;
                          const cellLeft = leftFraction * previewWidth;
                          const cellNum = rowIdx * numCols + colIdx + 1;
                          const isSelectedCell = colIdx === selectedCol || rowIdx === selectedRow;
                          
                          return (
                            <TouchableOpacity
                              key={`cell-${rowIdx}-${colIdx}`}
                              style={[
                                styles.gridCell,
                                {
                                  position: 'absolute',
                                  left: cellLeft,
                                  top: cellTop,
                                  width: cellWidth,
                                  height: cellHeight,
                                  backgroundColor: isSelectedCell ? color + '70' : color + '40',
                                  borderColor: isSelectedCell ? '#333' : color,
                                  borderWidth: isSelectedCell ? 2 : 1,
                                }
                              ]}
                              onPress={() => {
                                setSelectedCol(colIdx);
                                setSelectedRow(rowIdx);
                              }}
                            >
                              {cellWidth > 20 && cellHeight > 15 && (
                                <Text style={[styles.gridCellText, { color, fontSize: Math.min(12, cellWidth / 2.5) }]}>{cellNum}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        });
                      })}
                      
                      {/* Column dividers (draggable) */}
                      {columnDividers.map((fraction, idx) => (
                        <View
                          key={`col-divider-${idx}`}
                          style={[
                            styles.dividerVertical,
                            { left: fraction * previewWidth - 4 },
                            draggingDivider?.type === 'col' && draggingDivider?.index === idx && styles.dividerActive,
                          ]}
                          // @ts-ignore
                          onMouseDown={(e: any) => {
                            e.preventDefault();
                            handleDividerDragStart('col', idx, fraction);
                          }}
                        >
                          <View style={[styles.dividerHandle, draggingDivider?.type === 'col' && draggingDivider?.index === idx && styles.dividerHandleActive]} />
                        </View>
                      ))}
                      
                      {/* Row dividers (draggable) */}
                      {rowDividers.map((fraction, idx) => (
                        <View
                          key={`row-divider-${idx}`}
                          style={[
                            styles.dividerHorizontal,
                            { top: fraction * Math.min(previewHeight, 160) - 4 },
                            draggingDivider?.type === 'row' && draggingDivider?.index === idx && styles.dividerActive,
                          ]}
                          // @ts-ignore
                          onMouseDown={(e: any) => {
                            e.preventDefault();
                            handleDividerDragStart('row', idx, fraction);
                          }}
                        >
                          <View style={[styles.dividerHandle, { width: 20, height: 8 }, draggingDivider?.type === 'row' && draggingDivider?.index === idx && styles.dividerHandleActive]} />
                        </View>
                      ))}
                    </View>
                  </View>
                  
                  {/* Compact adjustment controls */}
                  <View style={styles.adjustControlsRow}>
                    <View style={styles.adjustControl}>
                      <Text style={styles.adjustControlLabel}>Column:</Text>
                      <View style={styles.adjustSelector}>
                        <TouchableOpacity 
                          style={styles.selectorArrow}
                          onPress={() => setSelectedCol(Math.max(0, selectedCol - 1))}
                        >
                          <Text style={styles.selectorArrowText}>◀</Text>
                        </TouchableOpacity>
                        <Text style={styles.selectorValue}>{selectedCol + 1}/{numCols}</Text>
                        <TouchableOpacity 
                          style={styles.selectorArrow}
                          onPress={() => setSelectedCol(Math.min(numCols - 1, selectedCol + 1))}
                        >
                          <Text style={styles.selectorArrowText}>▶</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.adjustButtons}>
                        <TouchableOpacity 
                          style={styles.adjustBtn}
                          onPress={() => adjustCell('col', selectedCol, -0.02)}
                        >
                          <Text style={styles.adjustBtnText}>− Shrink</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.adjustBtn}
                          onPress={() => adjustCell('col', selectedCol, 0.02)}
                        >
                          <Text style={styles.adjustBtnText}>+ Expand</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={styles.adjustControl}>
                      <Text style={styles.adjustControlLabel}>Row:</Text>
                      <View style={styles.adjustSelector}>
                        <TouchableOpacity 
                          style={styles.selectorArrow}
                          onPress={() => setSelectedRow(Math.max(0, selectedRow - 1))}
                        >
                          <Text style={styles.selectorArrowText}>◀</Text>
                        </TouchableOpacity>
                        <Text style={styles.selectorValue}>{selectedRow + 1}/{numRows}</Text>
                        <TouchableOpacity 
                          style={styles.selectorArrow}
                          onPress={() => setSelectedRow(Math.min(numRows - 1, selectedRow + 1))}
                        >
                          <Text style={styles.selectorArrowText}>▶</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.adjustButtons}>
                        <TouchableOpacity 
                          style={styles.adjustBtn}
                          onPress={() => adjustCell('row', selectedRow, -0.03)}
                        >
                          <Text style={styles.adjustBtnText}>− Shrink</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.adjustBtn}
                          onPress={() => adjustCell('row', selectedRow, 0.03)}
                        >
                          <Text style={styles.adjustBtnText}>+ Expand</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  
                  <Text style={styles.hint}>
                    Click a cell to select it, then use controls above. Or drag the blue lines directly.
                  </Text>
                  <TouchableOpacity 
                    style={styles.resetDividersButton}
                    onPress={() => {
                      // Reset to equal divisions
                      setColumnDividers(Array.from({ length: numCols - 1 }, (_, i) => (i + 1) / numCols));
                      setRowDividers(Array.from({ length: numRows - 1 }, (_, i) => (i + 1) / numRows));
                    }}
                  >
                    <Text style={styles.resetDividersText}>↺ Reset to Equal</Text>
                  </TouchableOpacity>
                </View>

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
  // Grid Preview Styles
  gridPreview: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#DDD',
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: 8,
  },
  gridCell: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCellText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dividerVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web' ? { cursor: 'ew-resize' as any } : {}),
  },
  dividerHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web' ? { cursor: 'ns-resize' as any } : {}),
  },
  dividerHandle: {
    width: 8,
    height: 20,
    backgroundColor: '#2196F3',
    borderRadius: 4,
    ...(Platform.OS === 'web' ? { cursor: 'grab' as any } : {}),
  },
  dividerActive: {
    zIndex: 20,
  },
  dividerHandleActive: {
    backgroundColor: '#1565C0',
    transform: [{ scale: 1.2 }],
  },
  resetDividersButton: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
  },
  resetDividersText: {
    fontSize: 12,
    color: '#666',
  },
  // Adjustment button styles
  adjustButtonsRow: {
    flexDirection: 'row',
    position: 'relative',
    height: 28,
    marginBottom: 4,
  },
  adjustButtonsCol: {
    position: 'relative',
    width: 40,
    marginRight: 4,
  },
  adjustButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  adjustButtonGroupVert: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  adjustButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  adjustButtonSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  adjustButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2196F3',
    lineHeight: 16,
  },
  adjustButtonTextSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2196F3',
    lineHeight: 14,
  },
  adjustLabel: {
    fontSize: 9,
    color: '#666',
    marginHorizontal: 2,
  },
  adjustLabelSmall: {
    fontSize: 8,
    color: '#666',
  },
  // New compact adjustment controls
  adjustControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  adjustControl: {
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 140,
  },
  adjustControlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  adjustSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  selectorArrowText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  selectorValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 40,
    textAlign: 'center',
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  adjustBtnText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
});

export default BatchLabelModal;
