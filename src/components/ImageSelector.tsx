import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { ImageData } from '../types';

interface ImageSelectorProps {
  images: { [key: string]: ImageData };
  selectedImage: string;
  onSelectImage: (imageName: string) => void;
  onDeleteImage: (imageName: string) => void;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  images,
  selectedImage,
  onSelectImage,
  onDeleteImage,
}) => {
  const imageKeys = Object.keys(images);

  if (imageKeys.length <= 1) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Images ({imageKeys.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.imageList}>
          {imageKeys.map((key) => {
            const image = images[key];
            const isSelected = key === selectedImage;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.imageItem, isSelected && styles.imageItemSelected]}
                onPress={() => onSelectImage(key)}
              >
                <View style={styles.imagePreview}>
                  <Text style={styles.imageIcon}>🖼️</Text>
                </View>
                <View style={styles.imageInfo}>
                  <Text
                    style={[styles.imageName, isSelected && styles.imageNameSelected]}
                    numberOfLines={1}
                  >
                    {image.name}
                  </Text>
                  <Text style={styles.imageStats}>
                    {image.labels.length} labels • {image.width}×{image.height}
                  </Text>
                </View>
                {imageKeys.length > 1 && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      onDeleteImage(key);
                    }}
                  >
                    <Text style={styles.deleteIcon}>×</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  imageList: {
    flexDirection: 'row',
    gap: 12,
  },
  imageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 200,
  },
  imageItemSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  imagePreview: {
    width: 40,
    height: 40,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  imageIcon: {
    fontSize: 20,
  },
  imageInfo: {
    flex: 1,
  },
  imageName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  imageNameSelected: {
    color: '#1976D2',
  },
  imageStats: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18,
  },
});

export default ImageSelector;
