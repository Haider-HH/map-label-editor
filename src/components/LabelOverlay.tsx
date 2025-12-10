import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import Svg, { Polygon, Circle, Line, G, Rect } from 'react-native-svg';
import { Label, EditorMode, Point, LabelType } from '../types';

interface LabelOverlayProps {
  labels: Label[];
  imageWidth: number;
  imageHeight: number;
  scale: number;
  onLabelPress: (label: Label) => void;
  mode?: EditorMode;
  selectedLabelId?: string | null;
  onPointDrag?: (labelId: string, pointIndex: number, newPosition: Point) => void;
  onLabelDelete?: (labelId: string) => void;
  drawingPoints?: Point[];
  onCanvasClick?: (point: Point) => void;
  // Rectangle drawing
  rectStart?: Point | null;
  rectEnd?: Point | null;
  onRectDrawStart?: (point: Point) => void;
  onRectDrawMove?: (point: Point) => void;
  onRectDrawEnd?: (point: Point) => void;
  // Batch selection
  batchSelectionRect?: { start: Point; end: Point } | null;
  onBatchSelectionStart?: (point: Point) => void;
  onBatchSelectionMove?: (point: Point) => void;
  onBatchSelectionEnd?: (start: Point, end: Point) => void;
  // View state for zoom/pan
  viewScale?: number;
  viewTranslateX?: number;
  viewTranslateY?: number;
}

// Color mapping for different label types
const typeColors: { [key in LabelType]: string } = {
  residential: '#4A90D9',
  commercial: '#F5A623',
  park: '#7ED321',
  mosque: '#9B59B6',
  school: '#E74C3C',
  road: '#95A5A6',
  other: '#BDC3C7',
};

const LabelOverlay: React.FC<LabelOverlayProps> = ({
  labels,
  imageWidth,
  imageHeight,
  scale,
  onLabelPress,
  mode = 'view',
  selectedLabelId = null,
  onPointDrag,
  onLabelDelete,
  drawingPoints = [],
  onCanvasClick,
  rectStart,
  rectEnd,
  onRectDrawStart,
  onRectDrawMove,
  onRectDrawEnd,
  batchSelectionRect,
  onBatchSelectionStart,
  onBatchSelectionMove,
  onBatchSelectionEnd,
  viewScale = 1,
  viewTranslateX = 0,
  viewTranslateY = 0,
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<{ labelId: string; pointIndex: number } | null>(null);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [isSelectingBatch, setIsSelectingBatch] = useState(false);
  const containerRef = useRef<View>(null);

  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  const getPointsString = useCallback((points: { x: number; y: number }[], scale: number) => {
    return points.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
  }, []);

  // Get label type - handle legacy format
  const getLabelType = (label: Label): LabelType => {
    const validTypes: LabelType[] = ['residential', 'commercial', 'park', 'mosque', 'school', 'road', 'other'];
    if (label.type && validTypes.includes(label.type as LabelType)) {
      return label.type as LabelType;
    }
    return 'other';
  };

  const getFillColor = useCallback((label: Label, isHovered: boolean, isSelected: boolean) => {
    const labelType = getLabelType(label);
    const baseColor = label.color || typeColors[labelType] || '#999999';
    const alpha = isHovered || isSelected ? 'B0' : '60';
    // Ensure color has proper format
    const cleanColor = baseColor.replace('#', '');
    return `#${cleanColor}${alpha}`;
  }, []);

  const handleMouseEnter = useCallback((labelId: string) => {
    if (Platform.OS === 'web') {
      setHoveredLabel(labelId);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (Platform.OS === 'web') {
      setHoveredLabel(null);
    }
  }, []);

  const handleLabelPress = useCallback((label: Label) => {
    if (mode === 'delete' && onLabelDelete) {
      onLabelDelete(label.id);
    } else if (mode !== 'draw' && mode !== 'draw-rect' && mode !== 'batch') {
      onLabelPress(label);
    }
  }, [mode, onLabelDelete, onLabelPress]);

  // Get display text for a label - handle both new and legacy formats
  const getLabelDisplayText = (label: Label): string => {
    if (label.blockNumber && label.houseNumber) {
      return `${label.blockNumber}-${label.houseNumber}`;
    }
    if (label.blockNumber) {
      return label.blockNumber;
    }
    if (label.houseNumber) {
      return label.houseNumber;
    }
    // Legacy: use 'label' field
    if (label.label) {
      return label.label.replace(/_/g, ' ');
    }
    return '';
  };

  // Web-specific event handlers using useEffect
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const container = containerRef.current;
    if (!container) return;

    let domElement: HTMLElement | null = null;
    
    if (typeof document !== 'undefined') {
      domElement = document.querySelector('[data-labeloverlay="true"]') as HTMLElement;
      if (!domElement) {
        domElement = document.getElementById('label-overlay-container');
      }
    }

    if (!domElement) {
      console.warn('Could not find DOM element for LabelOverlay');
      return;
    }

    const getCoordinates = (event: MouseEvent): Point => {
      const rect = domElement!.getBoundingClientRect();
      // Get position relative to the overlay element
      const elementX = event.clientX - rect.left;
      const elementY = event.clientY - rect.top;
      
      // The overlay is inside the transformed container
      // We need to reverse the transform to get image coordinates
      // The transform is: translate(viewTranslateX, viewTranslateY) then scale(viewScale)
      // The overlay's rect already accounts for the scale, so we just need to
      // convert from the scaled coordinate system to image coordinates
      
      // Since the overlay is inside the transformed container, its getBoundingClientRect
      // gives us the actual screen position including all transforms
      // We need to convert from the overlay's local coordinates to image coordinates
      return {
        x: elementX / (scale * viewScale),
        y: elementY / (scale * viewScale),
      };
    };

    const handleMouseDown = (event: MouseEvent) => {
      const point = getCoordinates(event);
      
      if (mode === 'draw-rect' && onRectDrawStart) {
        event.preventDefault();
        setIsDrawingRect(true);
        onRectDrawStart(point);
      } else if (mode === 'batch' && onBatchSelectionStart) {
        event.preventDefault();
        setIsSelectingBatch(true);
        onBatchSelectionStart(point);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (mode === 'draw' && onCanvasClick) {
        const point = getCoordinates(event);
        if (point.x >= 0 && point.x <= imageWidth && point.y >= 0 && point.y <= imageHeight) {
          onCanvasClick(point);
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const point = getCoordinates(event);
      
      if (isDrawingRect && onRectDrawMove) {
        onRectDrawMove(point);
      } else if (isSelectingBatch && onBatchSelectionMove) {
        onBatchSelectionMove(point);
      } else if (draggingPoint && onPointDrag) {
        const clampedX = Math.max(0, Math.min(imageWidth, point.x));
        const clampedY = Math.max(0, Math.min(imageHeight, point.y));
        onPointDrag(draggingPoint.labelId, draggingPoint.pointIndex, { x: clampedX, y: clampedY });
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      const point = getCoordinates(event);
      
      if (isDrawingRect && onRectDrawEnd) {
        setIsDrawingRect(false);
        onRectDrawEnd(point);
      } else if (isSelectingBatch && onBatchSelectionEnd && batchSelectionRect) {
        setIsSelectingBatch(false);
        onBatchSelectionEnd(batchSelectionRect.start, point);
      }
      
      if (draggingPoint) {
        setDraggingPoint(null);
      }
    };

    domElement.addEventListener('mousedown', handleMouseDown);
    domElement.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      domElement?.removeEventListener('mousedown', handleMouseDown);
      domElement?.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mode, onCanvasClick, scale, imageWidth, imageHeight, draggingPoint, onPointDrag, 
      isDrawingRect, onRectDrawStart, onRectDrawMove, onRectDrawEnd,
      isSelectingBatch, onBatchSelectionStart, onBatchSelectionMove, onBatchSelectionEnd, batchSelectionRect]);

  const handlePointPressIn = useCallback((labelId: string, pointIndex: number) => {
    if (mode === 'edit') {
      setDraggingPoint({ labelId, pointIndex });
    }
  }, [mode]);

  // Setup point drag handlers via DOM for web
  useEffect(() => {
    if (Platform.OS !== 'web' || mode !== 'edit' || !selectedLabelId) return;

    const setupPointListeners = () => {
      const points = document.querySelectorAll(`[data-edit-point="true"]`);
      
      points.forEach((point) => {
        const element = point as HTMLElement;
        const labelId = element.getAttribute('data-label-id');
        const pointIndex = parseInt(element.getAttribute('data-point-index') || '0', 10);
        
        const handleMouseDown = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setDraggingPoint({ labelId: labelId!, pointIndex });
        };
        
        element.addEventListener('mousedown', handleMouseDown);
        (element as any)._cleanup = () => {
          element.removeEventListener('mousedown', handleMouseDown);
        };
      });
    };

    const timeout = setTimeout(setupPointListeners, 100);

    return () => {
      clearTimeout(timeout);
      const points = document.querySelectorAll(`[data-edit-point="true"]`);
      points.forEach((point) => {
        if ((point as any)._cleanup) {
          (point as any)._cleanup();
        }
      });
    };
  }, [mode, selectedLabelId, labels]);

  const getCursor = () => {
    switch (mode) {
      case 'draw': return 'crosshair';
      case 'draw-rect': return 'crosshair';
      case 'batch': return 'crosshair';
      case 'delete': return 'pointer';
      case 'edit': return draggingPoint ? 'grabbing' : 'pointer';
      default: return 'pointer';
    }
  };

  // Get rectangle dimensions for preview
  const getRectPreview = () => {
    if (!rectStart || !rectEnd) return null;
    const x = Math.min(rectStart.x, rectEnd.x) * scale;
    const y = Math.min(rectStart.y, rectEnd.y) * scale;
    const width = Math.abs(rectEnd.x - rectStart.x) * scale;
    const height = Math.abs(rectEnd.y - rectStart.y) * scale;
    return { x, y, width, height };
  };

  // Get batch selection rectangle
  const getBatchSelectionPreview = () => {
    if (!batchSelectionRect) return null;
    const x = Math.min(batchSelectionRect.start.x, batchSelectionRect.end.x) * scale;
    const y = Math.min(batchSelectionRect.start.y, batchSelectionRect.end.y) * scale;
    const width = Math.abs(batchSelectionRect.end.x - batchSelectionRect.start.x) * scale;
    const height = Math.abs(batchSelectionRect.end.y - batchSelectionRect.start.y) * scale;
    return { x, y, width, height };
  };

  const rectPreview = getRectPreview();
  const batchPreview = getBatchSelectionPreview();

  return (
    <View 
      ref={containerRef}
      // @ts-ignore
      dataSet={{ labeloverlay: 'true' }}
      nativeID="label-overlay-container"
      style={[
        StyleSheet.absoluteFill, 
        { 
          width: scaledWidth, 
          height: scaledHeight,
          cursor: getCursor(),
        } as any
      ]}
    >
      <Svg
        width={scaledWidth}
        height={scaledHeight}
        style={[
          StyleSheet.absoluteFill, 
          { pointerEvents: (mode === 'draw' || mode === 'draw-rect' || mode === 'batch') ? 'none' : 'auto' } as any
        ]}
      >
        {/* Render existing labels */}
        {labels.map((label) => {
          const isHovered = hoveredLabel === label.id;
          const isSelected = selectedLabelId === label.id;
          const fillColor = getFillColor(label, isHovered, isSelected);
          const strokeColor = isSelected ? '#2196F3' : (isHovered ? '#FFFFFF' : '#00000050');
          const strokeWidth = isSelected ? 3 : (isHovered ? 2 : 1);
          const displayText = getLabelDisplayText(label);

          // Calculate center for text
          const centerX = label.points.reduce((sum, p) => sum + p.x, 0) / label.points.length * scale;
          const centerY = label.points.reduce((sum, p) => sum + p.y, 0) / label.points.length * scale;

          return (
            <G key={label.id}>
              <Polygon
                points={getPointsString(label.points, scale)}
                fill={mode === 'delete' && isHovered ? '#F4433680' : fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                onPress={() => handleLabelPress(label)}
                // @ts-ignore
                onMouseEnter={() => handleMouseEnter(label.id)}
                onMouseLeave={handleMouseLeave}
              />
              
              {/* Edit points when in edit mode and label is selected */}
              {mode === 'edit' && isSelected && label.points.map((point, index) => (
                <Circle
                  key={`${label.id}-point-${index}`}
                  cx={point.x * scale}
                  cy={point.y * scale}
                  r={8}
                  fill={draggingPoint?.pointIndex === index ? '#1565C0' : '#2196F3'}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  onPressIn={() => handlePointPressIn(label.id, index)}
                  // @ts-ignore
                  data-edit-point="true"
                  data-label-id={label.id}
                  data-point-index={index}
                />
              ))}
            </G>
          );
        })}

        {/* Polygon drawing preview */}
        {mode === 'draw' && drawingPoints.length > 0 && (
          <G>
            {drawingPoints.map((point, index) => {
              if (index === 0) return null;
              const prevPoint = drawingPoints[index - 1];
              return (
                <Line
                  key={`draw-line-${index}`}
                  x1={prevPoint.x * scale}
                  y1={prevPoint.y * scale}
                  x2={point.x * scale}
                  y2={point.y * scale}
                  stroke="#2196F3"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                />
              );
            })}
            
            {drawingPoints.map((point, index) => (
              <Circle
                key={`draw-point-${index}`}
                cx={point.x * scale}
                cy={point.y * scale}
                r={6}
                fill={index === 0 ? '#4CAF50' : '#2196F3'}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            ))}
            
            {drawingPoints.length >= 3 && (
              <Line
                x1={drawingPoints[drawingPoints.length - 1].x * scale}
                y1={drawingPoints[drawingPoints.length - 1].y * scale}
                x2={drawingPoints[0].x * scale}
                y2={drawingPoints[0].y * scale}
                stroke="#4CAF50"
                strokeWidth={2}
                strokeDasharray="5,5"
                opacity={0.5}
              />
            )}
          </G>
        )}

        {/* Rectangle drawing preview */}
        {mode === 'draw-rect' && rectPreview && (
          <Rect
            x={rectPreview.x}
            y={rectPreview.y}
            width={rectPreview.width}
            height={rectPreview.height}
            fill="#2196F340"
            stroke="#2196F3"
            strokeWidth={2}
            strokeDasharray="5,5"
          />
        )}

        {/* Batch selection preview */}
        {mode === 'batch' && batchPreview && (
          <Rect
            x={batchPreview.x}
            y={batchPreview.y}
            width={batchPreview.width}
            height={batchPreview.height}
            fill="#4CAF5030"
            stroke="#4CAF50"
            strokeWidth={2}
            strokeDasharray="8,4"
          />
        )}
      </Svg>
    </View>
  );
};

export default LabelOverlay;
