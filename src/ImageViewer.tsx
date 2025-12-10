import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import LabelOverlay from './components/LabelOverlay';
import LabelDetailsModal from './components/LabelDetailsModal';
import { Label, LabelsData } from './types';

// Import assets
const constructionImage = require('../assets/Construction-Site-Plan-768x458.png');
const labelsData: LabelsData = require('../assets/merged-labels.json');

const ImageViewer: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Get the first image data
  const imageKey = Object.keys(labelsData.images)[0];
  const imageData = labelsData.images[imageKey];

  // Calculate scale to fit the image in the viewport
  const padding = 40;
  const maxWidth = windowWidth - padding * 2;
  const maxHeight = windowHeight - 200; // Leave space for header

  const scaleX = maxWidth / imageData.width;
  const scaleY = maxHeight / imageData.height;
  const scale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x to prevent too large images

  const scaledWidth = imageData.width * scale;
  const scaledHeight = imageData.height * scale;

  const handleLabelPress = (label: Label) => {
    setSelectedLabel(label);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedLabel(null);
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Construction Site Plan</Text>
        <Text style={styles.subtitle}>
          Hover over areas to highlight • Click/Tap to view details
        </Text>
        <Text style={styles.info}>
          {imageData.labels.length} labeled areas • {imageData.width}×{imageData.height}px
        </Text>
      </View>

      <View style={[styles.imageContainer, { width: scaledWidth, height: scaledHeight }]}>
        <Image
          source={constructionImage}
          style={[styles.image, { width: scaledWidth, height: scaledHeight }]}
          resizeMode="contain"
        />
        <LabelOverlay
          labels={imageData.labels}
          imageWidth={imageData.width}
          imageHeight={imageData.height}
          scale={scale}
          onLabelPress={handleLabelPress}
        />
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legend</Text>
        <View style={styles.legendGrid}>
          {imageData.labels.map((label) => (
            <View key={label.id} style={styles.legendItem}>
              <View 
                style={[
                  styles.legendColor, 
                  { backgroundColor: getLabelColor(label.label || label.blockNumber || 'unknown') }
                ]} 
              />
              <Text style={styles.legendText}>
                {formatLabelName(label.label || label.blockNumber || 'unknown')}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <LabelDetailsModal
        label={selectedLabel}
        visible={modalVisible}
        onClose={handleCloseModal}
      />
    </ScrollView>
  );
};

const formatLabelName = (name: string) => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const labelColorMap: { [key: string]: string } = {
  wood_depot: '#E89677',
  crane: '#FFD700',
  trash_recycle: '#8B4513',
  steel_depot: '#B8860B',
  stone_depot: '#CD853F',
  plaster_light: '#FFB6C1',
  plaster_heavy: '#FF69B4',
  office: '#1E90FF',
  carpenter_workshop: '#00CED1',
  break_room: '#32CD32',
  toilets: '#9370DB',
  house_foundation: '#A0A0A0',
  water_power: '#00BFFF',
  prefab_parts: '#DDA0DD',
  excavated_ground: '#8B4513',
};

const getLabelColor = (label: string) => {
  return labelColorMap[label.toLowerCase()] || '#FF0000';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  info: {
    fontSize: 12,
    color: '#999999',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    }),
  },
  image: {
    backgroundColor: '#FFFFFF',
  },
  legend: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: '90%',
    maxWidth: 800,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    }),
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingVertical: 4,
    ...(Platform.OS === 'web' && {
      width: '25%',
    }),
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666666',
  },
});

export default ImageViewer;
