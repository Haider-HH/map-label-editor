import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';

interface AddImageModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (imageData: { name: string; width: number; height: number; imageUri: string }) => void;
}

const AddImageModal: React.FC<AddImageModalProps> = ({ visible, onClose, onConfirm }) => {
  const [imageName, setImageName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoadImage = () => {
    if (imageUrl && Platform.OS === 'web') {
      setLoading(true);
      const img = new Image();
      img.onload = () => {
        setWidth(img.width.toString());
        setHeight(img.height.toString());
        if (!imageName) {
          const urlParts = imageUrl.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0];
          setImageName(fileName || 'new_image');
        }
        setLoading(false);
      };
      img.onerror = () => {
        setLoading(false);
        alert('Failed to load image. Please check the URL.');
      };
      img.src = imageUrl;
    }
  };

  const handleFileSelect = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setImageUrl(dataUrl);
            setImageName(file.name);
            
            // Get dimensions
            const img = new Image();
            img.onload = () => {
              setWidth(img.width.toString());
              setHeight(img.height.toString());
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleConfirm = () => {
    if (imageName && imageUrl && width && height) {
      onConfirm({
        name: imageName,
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        imageUri: imageUrl,
      });
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setImageName('');
    setImageUrl('');
    setWidth('');
    setHeight('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid = imageName && imageUrl && width && height;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.modalContent}>
              <Text style={styles.title}>Add New Image</Text>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Option 1: Upload from Device</Text>
                <TouchableOpacity style={styles.uploadButton} onPress={handleFileSelect}>
                  <Text style={styles.uploadButtonText}>📁 Choose File</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Option 2: From URL</Text>
                <View style={styles.urlRow}>
                  <TextInput
                    style={[styles.input, styles.urlInput]}
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    placeholder="https://example.com/image.png"
                  />
                  <TouchableOpacity 
                    style={styles.loadButton} 
                    onPress={handleLoadImage}
                    disabled={loading || !imageUrl}
                  >
                    <Text style={styles.loadButtonText}>
                      {loading ? '...' : 'Load'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Image Name</Text>
                <TextInput
                  style={styles.input}
                  value={imageName}
                  onChangeText={setImageName}
                  placeholder="my_image.png"
                />
              </View>

              <View style={styles.dimensionsRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Width (px)</Text>
                  <TextInput
                    style={styles.input}
                    value={width}
                    onChangeText={setWidth}
                    placeholder="800"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Height (px)</Text>
                  <TextInput
                    style={styles.input}
                    value={height}
                    onChangeText={setHeight}
                    placeholder="600"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {imageUrl && (
                <View style={styles.previewContainer}>
                  <Text style={styles.fieldLabel}>Preview</Text>
                  <View style={styles.preview}>
                    {Platform.OS === 'web' && (
                      <img 
                        src={imageUrl} 
                        style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain' }} 
                        alt="Preview"
                      />
                    )}
                  </View>
                </View>
              )}

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, !isValid && styles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={!isValid}
                >
                  <Text style={styles.confirmButtonText}>Add Image</Text>
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
    maxHeight: '90%',
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
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  uploadButton: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#888',
    fontSize: 12,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urlInput: {
    flex: 1,
  },
  loadButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  loadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
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
  dimensionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  previewContainer: {
    marginBottom: 16,
  },
  preview: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
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
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default AddImageModal;
