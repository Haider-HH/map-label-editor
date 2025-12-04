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
}) => {
  const canFinish = drawingPointsCount >= 3;
  
  const tools: { mode: EditorMode; icon: string; label: string }[] = [
    { mode: 'view', icon: '👁️', label: 'View' },
    { mode: 'edit', icon: '✏️', label: 'Edit' },
    { mode: 'draw', icon: '✒️', label: 'Draw' },
    { mode: 'delete', icon: '🗑️', label: 'Delete' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.toolsSection}>
        <Text style={styles.sectionLabel}>Tools</Text>
        <View style={styles.toolsRow}>
          {tools.map((tool) => (
            <TouchableOpacity
              key={tool.mode}
              style={[
                styles.toolButton,
                mode === tool.mode && styles.toolButtonActive,
              ]}
              onPress={() => onModeChange(tool.mode)}
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
            </TouchableOpacity>
          ))}
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
            <TouchableOpacity style={styles.cancelButton} onPress={onCancelDrawing}>
              <Text style={styles.cancelButtonText}>✕ Cancel</Text>
            </TouchableOpacity>
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
  toolsSection: {
    marginBottom: 12,
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
  drawingSection: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
  cancelButton: {
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
});

export default EditorToolbar;
