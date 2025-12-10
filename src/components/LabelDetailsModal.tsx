import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Label } from '../types';

interface LabelDetailsModalProps {
  label: Label | null;
  visible: boolean;
  onClose: () => void;
}

const LabelDetailsModal: React.FC<LabelDetailsModalProps> = ({ label, visible, onClose }) => {
  if (!label) return null;

  const formatLabelName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Calculate bounding box
  const minX = Math.min(...label.points.map(p => p.x));
  const maxX = Math.max(...label.points.map(p => p.x));
  const minY = Math.min(...label.points.map(p => p.y));
  const maxY = Math.max(...label.points.map(p => p.y));
  const width = maxX - minX;
  const height = maxY - minY;
  const area = width * height;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.title}>{formatLabelName(label.label || label.blockNumber || 'unknown')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.scrollContent}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>General Information</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ID:</Text>
                    <Text style={styles.infoValue}>{label.id}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Type:</Text>
                    <Text style={styles.infoValue}>{label.type}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Original Type:</Text>
                    <Text style={styles.infoValue}>{label.originalType}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Dimensions</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Position:</Text>
                    <Text style={styles.infoValue}>({minX.toFixed(1)}, {minY.toFixed(1)})</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Size:</Text>
                    <Text style={styles.infoValue}>{width.toFixed(1)} × {height.toFixed(1)} px</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Area:</Text>
                    <Text style={styles.infoValue}>{area.toFixed(1)} px²</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Points:</Text>
                    <Text style={styles.infoValue}>{label.points.length} vertices</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Coordinates</Text>
                  {label.points.map((point, index) => (
                    <View key={index} style={styles.pointRow}>
                      <Text style={styles.pointIndex}>P{index + 1}:</Text>
                      <Text style={styles.pointValue}>
                        ({point.x.toFixed(2)}, {point.y.toFixed(2)})
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
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
    width: Platform.OS === 'web' ? 400 : '90%',
    maxHeight: '80%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    maxHeight: 400,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#666666',
  },
  pointRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  pointIndex: {
    fontSize: 12,
    color: '#999999',
    width: 30,
  },
  pointValue: {
    fontSize: 12,
    color: '#666666',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
});

export default LabelDetailsModal;
