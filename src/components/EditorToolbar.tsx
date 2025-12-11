import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { EditorMode } from '../types';

interface EditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onExport: () => void;
  onImport: () => void;
  onAddImage: () => void;
  onUndo: () => void;
  canUndo: boolean;
  isDrawing: boolean;
  drawingPointsCount: number;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
  // Zoom controls
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  // Auto-save status
  autoSaveStatus?: 'idle' | 'saving' | 'saved';
  lastAutoSave?: Date | null;
  onManualSave?: () => void;
  // Magic wand settings
  magicWandTolerance?: number;
  onMagicWandToleranceChange?: (value: number) => void;
  magicWandEdgeThreshold?: number;
  onMagicWandEdgeThresholdChange?: (value: number) => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  mode,
  onModeChange,
  onExport,
  onImport,
  onAddImage,
  onUndo,
  canUndo,
  isDrawing,
  drawingPointsCount,
  onFinishDrawing,
  onCancelDrawing,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  autoSaveStatus = 'idle',
  lastAutoSave,
  onManualSave,
  magicWandTolerance = 30,
  onMagicWandToleranceChange,
  magicWandEdgeThreshold = 50,
  onMagicWandEdgeThresholdChange,
}) => {
  const canFinish = drawingPointsCount >= 3;
  
  const tools: { mode: EditorMode; icon: string; label: string; shortcut: string; tip?: string }[] = [
    { mode: 'view', icon: '👁️', label: 'View', shortcut: 'V', tip: 'View and select labels' },
    { mode: 'edit', icon: '✏️', label: 'Edit', shortcut: 'E', tip: 'Edit label points' },
    { mode: 'draw', icon: '✒️', label: 'Polygon', shortcut: 'P', tip: 'Draw polygon labels' },
    { mode: 'draw-rect', icon: '⬜', label: 'Rect', shortcut: 'R', tip: 'Quick rectangle drawing' },
    { mode: 'batch', icon: '⊞', label: 'Batch', shortcut: 'B', tip: 'Create multiple labels at once' },
    { mode: 'magic-wand', icon: '🪄', label: 'Magic', shortcut: 'W', tip: 'Auto-detect cell boundaries' },
    { mode: 'delete', icon: '🗑️', label: 'Delete', shortcut: 'D', tip: 'Delete labels' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.toolsSection}>
          <Text style={styles.sectionLabel}>Tools (press key to switch)</Text>
          <View style={styles.toolsRow}>
            {tools.map((tool) => (
              <TouchableOpacity
                key={tool.mode}
                style={[
                  styles.toolButton,
                  mode === tool.mode && styles.toolButtonActive,
                ]}
                onPress={() => onModeChange(tool.mode)}
                // @ts-ignore web specific
                title={`${tool.tip} (${tool.shortcut})`}
              >
                <Text style={styles.toolIcon}>{tool.icon}</Text>
                <Text
                  style={[
                    styles.toolLabel,
                    mode === tool.mode && styles.toolLabelActive,
                  ]}
                >
                  {tool.label}
                </Text>
                <Text style={[styles.shortcutKey, mode === tool.mode && styles.shortcutKeyActive]}>
                  {tool.shortcut}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Zoom Controls */}
        <View style={styles.zoomSection}>
          <Text style={styles.sectionLabel}>Zoom ({Math.round(scale * 100)}%) · Scroll or Ctrl+/-</Text>
          <View style={styles.zoomRow}>
            <TouchableOpacity style={styles.zoomButton} onPress={onZoomOut}>
              <Text style={styles.zoomButtonText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={onResetZoom}>
              <Text style={styles.zoomButtonTextSmall}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={onZoomIn}>
              <Text style={styles.zoomButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.zoomHint}>Scroll to zoom • Drag to pan</Text>
        </View>
      </View>

      {(mode === 'draw' || isDrawing) && (
        <View style={styles.drawingSection}>
          <Text style={styles.drawingHint}>
            Click on the image to add points. {drawingPointsCount} point{drawingPointsCount !== 1 ? 's' : ''} added. 
            {drawingPointsCount < 3 ? ` Need ${3 - drawingPointsCount} more.` : ' Ready to finish!'}
          </Text>
          <View style={styles.drawingActions}>
            <TouchableOpacity 
              style={[styles.finishButton, !canFinish && styles.finishButtonDisabled]} 
              onPress={onFinishDrawing}
              disabled={!canFinish}
            >
              <Text style={styles.finishButtonText}>✓ Finish ({drawingPointsCount}/3+)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelDrawButton} onPress={onCancelDrawing}>
              <Text style={styles.cancelButtonText}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {mode === 'draw-rect' && (
        <View style={styles.drawingSection}>
          <Text style={styles.drawingHint}>
            Click and drag on the image to draw a rectangle. Release to create the label.
          </Text>
        </View>
      )}

      {mode === 'batch' && (
        <View style={styles.batchSection}>
          <Text style={styles.drawingHint}>
            Click and drag to select an area, then configure the grid to create multiple labels at once.
          </Text>
        </View>
      )}

      {mode === 'magic-wand' && (
        <View style={styles.magicWandSection}>
          <Text style={styles.drawingHint}>
            Click inside a cell to auto-detect its boundary. Adjust settings if detection is inaccurate.
          </Text>
          <View style={styles.magicWandControls}>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Color Tolerance: {magicWandTolerance}</Text>
              {Platform.OS === 'web' && (
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={magicWandTolerance}
                  onChange={(e) => onMagicWandToleranceChange?.(parseInt(e.target.value))}
                  style={{ width: 120, marginLeft: 8 }}
                />
              )}
            </View>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Edge Threshold: {magicWandEdgeThreshold}</Text>
              {Platform.OS === 'web' && (
                <input
                  type="range"
                  min="10"
                  max="150"
                  value={magicWandEdgeThreshold}
                  onChange={(e) => onMagicWandEdgeThresholdChange?.(parseInt(e.target.value))}
                  style={{ width: 120, marginLeft: 8 }}
                />
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.actionsSection}>
        <Text style={styles.sectionLabel}>Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, !canUndo && styles.actionButtonDisabled]}
            onPress={onUndo}
            disabled={!canUndo}
          >
            <Text style={styles.actionIcon}>↩️</Text>
            <Text style={styles.actionLabel}>Undo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={onAddImage}>
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text style={styles.actionLabel}>Add Image</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onImport}>
            <Text style={styles.actionIcon}>📥</Text>
            <Text style={styles.actionLabel}>Import</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onExport}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionLabel}>Export</Text>
          </TouchableOpacity>

          {onManualSave && (
            <TouchableOpacity style={styles.actionButton} onPress={onManualSave}>
              <Text style={styles.actionIcon}>💾</Text>
              <Text style={styles.actionLabel}>Save Now</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Auto-save status */}
        <View style={styles.autoSaveContainer}>
          <View style={[
            styles.autoSaveIndicator,
            autoSaveStatus === 'saving' && styles.autoSaveIndicatorSaving,
            autoSaveStatus === 'saved' && styles.autoSaveIndicatorSaved,
          ]} />
          <Text style={styles.autoSaveText}>
            {autoSaveStatus === 'saving' && 'Saving...'}
            {autoSaveStatus === 'saved' && 'Saved ✓'}
            {autoSaveStatus === 'idle' && lastAutoSave && `Auto-saved ${lastAutoSave.toLocaleTimeString()}`}
            {autoSaveStatus === 'idle' && !lastAutoSave && 'Auto-save enabled (every 15s)'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  toolsSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  toolButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  toolIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  toolLabel: {
    fontSize: 13,
    color: '#666',
  },
  toolLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  shortcutKey: {
    fontSize: 10,
    color: '#999',
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    fontWeight: '600',
  },
  shortcutKeyActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    color: '#FFFFFF',
  },
  zoomSection: {
    alignItems: 'flex-end',
  },
  zoomRow: {
    flexDirection: 'row',
    gap: 4,
  },
  zoomButton: {
    width: 40,
    height: 32,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  zoomButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  zoomButtonTextSmall: {
    fontSize: 11,
    color: '#666',
  },
  zoomHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  drawingSection: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  batchSection: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  magicWandSection: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  magicWandControls: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
  },
  drawingHint: {
    fontSize: 13,
    color: '#1976D2',
    marginBottom: 8,
  },
  drawingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  finishButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  finishButtonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.7,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cancelDrawButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionsSection: {},
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  actionLabel: {
    fontSize: 13,
    color: '#666',
  },
  autoSaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  autoSaveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
    marginRight: 8,
  },
  autoSaveIndicatorSaving: {
    backgroundColor: '#FF9800',
  },
  autoSaveIndicatorSaved: {
    backgroundColor: '#4CAF50',
  },
  autoSaveText: {
    fontSize: 12,
    color: '#666',
  },
});

export default EditorToolbar;
