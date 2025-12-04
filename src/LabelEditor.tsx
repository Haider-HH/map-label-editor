import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import LabelOverlay from './components/LabelOverlay';
import LabelEditorPanel from './components/LabelEditorPanel';
import EditorToolbar from './components/EditorToolbar';
import ImageSelector from './components/ImageSelector';
import NewLabelModal from './components/NewLabelModal';
import AddImageModal from './components/AddImageModal';
import { Label, LabelsData, EditorMode, Point, ImageData } from './types';

// Import assets
const constructionImage = require('../assets/Construction-Site-Plan-768x458.png');
const initialLabelsData: LabelsData = require('../assets/merged-labels.json');

// Store for uploaded images (in-memory for web)
const uploadedImages: { [key: string]: any } = {};

const LabelEditor: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  // State
  const [labelsData, setLabelsData] = useState<LabelsData>(initialLabelsData);
  const [selectedImageKey, setSelectedImageKey] = useState<string>(Object.keys(initialLabelsData.images)[0]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('view');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [showNewLabelModal, setShowNewLabelModal] = useState(false);
  const [showAddImageModal, setShowAddImageModal] = useState(false);
  const [history, setHistory] = useState<LabelsData[]>([]);

  const imageData = labelsData.images[selectedImageKey];
  const selectedLabel = selectedLabelId 
    ? imageData?.labels.find(l => l.id === selectedLabelId) 
    : null;

  // Calculate scale
  const padding = 40;
  const toolbarHeight = 180;
  const maxWidth = windowWidth - padding * 2 - (selectedLabel ? 340 : 0);
  const maxHeight = windowHeight - toolbarHeight - 100;

  const scaleX = maxWidth / (imageData?.width || 768);
  const scaleY = maxHeight / (imageData?.height || 458);
  const scale = Math.min(scaleX, scaleY, 1.5);

  const scaledWidth = (imageData?.width || 768) * scale;
  const scaledHeight = (imageData?.height || 458) * scale;

  // Get image source
  const getImageSource = () => {
    if (imageData?.imageUri) {
      return { uri: imageData.imageUri };
    }
    // For the default bundled image
    if (selectedImageKey === 'Construction-Site-Plan-768x458.png') {
      return constructionImage;
    }
    return uploadedImages[selectedImageKey] || constructionImage;
  };

  // Save to history for undo
  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(labelsData))]);
  }, [labelsData]);

  // Undo
  const handleUndo = useCallback(() => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setLabelsData(previousState);
      setHistory(prev => prev.slice(0, -1));
    }
  }, [history]);

  // Update label
  const handleUpdateLabel = useCallback((updates: Partial<Label>) => {
    if (!selectedLabelId) return;
    saveHistory();
    
    setLabelsData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        [selectedImageKey]: {
          ...prev.images[selectedImageKey],
          labels: prev.images[selectedImageKey].labels.map(label =>
            label.id === selectedLabelId
              ? { ...label, ...updates, updatedAt: new Date().toISOString() }
              : label
          ),
        },
      },
    }));
  }, [selectedLabelId, selectedImageKey, saveHistory]);

  // Delete label
  const handleDeleteLabel = useCallback((labelId?: string) => {
    const idToDelete = labelId || selectedLabelId;
    if (!idToDelete) return;
    
    const confirmDelete = () => {
      saveHistory();
      setLabelsData(prev => ({
        ...prev,
        images: {
          ...prev.images,
          [selectedImageKey]: {
            ...prev.images[selectedImageKey],
            labels: prev.images[selectedImageKey].labels.filter(l => l.id !== idToDelete),
          },
        },
      }));
      if (selectedLabelId === idToDelete) {
        setSelectedLabelId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this label?')) {
        confirmDelete();
      }
    } else {
      Alert.alert('Delete Label', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  }, [selectedLabelId, selectedImageKey, saveHistory]);

  // Handle point drag
  const handlePointDrag = useCallback((labelId: string, pointIndex: number, newPosition: Point) => {
    setLabelsData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        [selectedImageKey]: {
          ...prev.images[selectedImageKey],
          labels: prev.images[selectedImageKey].labels.map(label => {
            if (label.id !== labelId) return label;
            const newPoints = [...label.points];
            newPoints[pointIndex] = newPosition;
            // If it's the first point and matches the last (closed polygon), update last too
            if (pointIndex === 0 && newPoints.length > 1) {
              const lastPoint = newPoints[newPoints.length - 1];
              if (Math.abs(lastPoint.x - label.points[0].x) < 1 && 
                  Math.abs(lastPoint.y - label.points[0].y) < 1) {
                newPoints[newPoints.length - 1] = newPosition;
              }
            }
            return { ...label, points: newPoints, updatedAt: new Date().toISOString() };
          }),
        },
      },
    }));
  }, [selectedImageKey]);

  // Handle canvas click for drawing
  const handleCanvasClick = useCallback((point: Point) => {
    if (mode === 'draw') {
      console.log('Canvas clicked at:', point);
      setDrawingPoints(prev => [...prev, point]);
    }
  }, [mode]);

  // Finish drawing
  const handleFinishDrawing = useCallback(() => {
    if (drawingPoints.length >= 3) {
      setShowNewLabelModal(true);
    }
  }, [drawingPoints]);

  // Cancel drawing
  const handleCancelDrawing = useCallback(() => {
    setDrawingPoints([]);
    setMode('view');
  }, []);

  // Create new label from drawing
  const handleCreateLabel = useCallback((labelName: string) => {
    if (drawingPoints.length < 3) return;
    
    saveHistory();
    const newId = `${labelName}_${Date.now()}`;
    const closedPoints = [...drawingPoints, drawingPoints[0]]; // Close the polygon
    
    const newLabel: Label = {
      id: newId,
      label: labelName,
      type: 'polygon',
      points: closedPoints,
      originalType: 'polygon',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setLabelsData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        [selectedImageKey]: {
          ...prev.images[selectedImageKey],
          labels: [...prev.images[selectedImageKey].labels, newLabel],
        },
      },
    }));

    setDrawingPoints([]);
    setMode('view');
    setSelectedLabelId(newId);
  }, [drawingPoints, selectedImageKey, saveHistory]);

  // Handle label press
  const handleLabelPress = useCallback((label: Label) => {
    if (mode === 'delete') {
      handleDeleteLabel(label.id);
    } else {
      setSelectedLabelId(label.id);
    }
  }, [mode, handleDeleteLabel]);

  // Add new image
  const handleAddImage = useCallback((imageInfo: { name: string; width: number; height: number; imageUri: string }) => {
    saveHistory();
    const key = imageInfo.name;
    
    const newImageData: ImageData = {
      name: imageInfo.name,
      width: imageInfo.width,
      height: imageInfo.height,
      labels: [],
      imageUri: imageInfo.imageUri,
    };

    setLabelsData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        [key]: newImageData,
      },
    }));

    setSelectedImageKey(key);
    setSelectedLabelId(null);
  }, [saveHistory]);

  // Delete image
  const handleDeleteImage = useCallback((imageKey: string) => {
    const imageKeys = Object.keys(labelsData.images);
    if (imageKeys.length <= 1) {
      if (Platform.OS === 'web') {
        window.alert('Cannot delete the last image');
      }
      return;
    }

    const confirmDelete = () => {
      saveHistory();
      const newImages = { ...labelsData.images };
      delete newImages[imageKey];
      setLabelsData(prev => ({ ...prev, images: newImages }));
      
      if (selectedImageKey === imageKey) {
        setSelectedImageKey(Object.keys(newImages)[0]);
        setSelectedLabelId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete image "${imageKey}" and all its labels?`)) {
        confirmDelete();
      }
    }
  }, [labelsData.images, selectedImageKey, saveHistory]);

  // Export JSON
  const handleExport = useCallback(() => {
    const jsonString = JSON.stringify(labelsData, null, 2);
    
    if (Platform.OS === 'web') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'labels.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [labelsData]);

  // Import JSON
  const handleImport = useCallback(() => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target?.result as string) as LabelsData;
              if (data.images) {
                saveHistory();
                setLabelsData(data);
                setSelectedImageKey(Object.keys(data.images)[0]);
                setSelectedLabelId(null);
              }
            } catch (error) {
              window.alert('Invalid JSON file');
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }
  }, [saveHistory]);

  // Mode change
  const handleModeChange = useCallback((newMode: EditorMode) => {
    if (newMode !== 'draw') {
      setDrawingPoints([]);
    }
    if (newMode === 'draw' || newMode === 'delete') {
      setSelectedLabelId(null);
    }
    setMode(newMode);
  }, []);

  return (
    <View style={styles.container}>
      <EditorToolbar
        mode={mode}
        onModeChange={handleModeChange}
        onExport={handleExport}
        onImport={handleImport}
        onAddImage={() => setShowAddImageModal(true)}
        onUndo={handleUndo}
        canUndo={history.length > 0}
        isDrawing={drawingPoints.length > 0}
        drawingPointsCount={drawingPoints.length}
        onFinishDrawing={handleFinishDrawing}
        onCancelDrawing={handleCancelDrawing}
      />

      <ImageSelector
        images={labelsData.images}
        selectedImage={selectedImageKey}
        onSelectImage={(key) => {
          setSelectedImageKey(key);
          setSelectedLabelId(null);
        }}
        onDeleteImage={handleDeleteImage}
      />

      <View style={styles.mainContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{imageData?.name || 'Image Viewer'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'view' && 'Hover to highlight • Click to view details'}
              {mode === 'edit' && 'Click a label to edit • Drag points to reshape'}
              {mode === 'draw' && 'Click to add points • Min 3 points required'}
              {mode === 'delete' && 'Click a label to delete it'}
            </Text>
            <Text style={styles.info}>
              {imageData?.labels.length || 0} labels • {imageData?.width}×{imageData?.height}px
            </Text>
          </View>

          <View style={[styles.imageContainer, { width: scaledWidth, height: scaledHeight }]}>
            <Image
              source={getImageSource()}
              style={[styles.image, { width: scaledWidth, height: scaledHeight }]}
              resizeMode="contain"
            />
            <LabelOverlay
              labels={imageData?.labels || []}
              imageWidth={imageData?.width || 768}
              imageHeight={imageData?.height || 458}
              scale={scale}
              onLabelPress={handleLabelPress}
              mode={mode}
              selectedLabelId={selectedLabelId}
              onPointDrag={handlePointDrag}
              onLabelDelete={handleDeleteLabel}
              drawingPoints={drawingPoints}
              onCanvasClick={handleCanvasClick}
            />
          </View>
        </ScrollView>

        {selectedLabel && (mode === 'view' || mode === 'edit') && (
          <View style={styles.editorPanel}>
            <LabelEditorPanel
              label={selectedLabel}
              onUpdate={handleUpdateLabel}
              onDelete={() => handleDeleteLabel()}
              onClose={() => setSelectedLabelId(null)}
            />
          </View>
        )}
      </View>

      <NewLabelModal
        visible={showNewLabelModal}
        onClose={() => {
          setShowNewLabelModal(false);
          setDrawingPoints([]);
          setMode('view');
        }}
        onConfirm={handleCreateLabel}
      />

      <AddImageModal
        visible={showAddImageModal}
        onClose={() => setShowAddImageModal(false)}
        onConfirm={handleAddImage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
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
  editorPanel: {
    padding: 16,
  },
});

export default LabelEditor;
