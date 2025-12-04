import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, findNodeHandle } from 'react-native';
import Svg, { Polygon, Circle, Line, G } from 'react-native-svg';
import { Label, EditorMode, Point } from '../types';

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
}

// Color mapping for different label types
const labelColors: { [key: string]: string } = {
  wood_depot: '#E8967750',
  crane: '#FFD70050',
  trash_recycle: '#8B451350',
  steel_depot: '#B8860B50',
  stone_depot: '#CD853F50',
  plaster_light: '#FFB6C150',
  plaster_heavy: '#FF69B450',
  office: '#1E90FF50',
  carpenter_workshop: '#00CED150',
  break_room: '#32CD3250',
  toilets: '#9370DB50',
  house_foundation: '#A0A0A050',
  water_power: '#00BFFF50',
  prefab_parts: '#DDA0DD50',
  excavated_ground: '#8B451380',
};

const highlightColors: { [key: string]: string } = {
  wood_depot: '#E89677B0',
  crane: '#FFD700B0',
  trash_recycle: '#8B4513B0',
  steel_depot: '#B8860BB0',
  stone_depot: '#CD853FB0',
  plaster_light: '#FFB6C1B0',
  plaster_heavy: '#FF69B4B0',
  office: '#1E90FFB0',
  carpenter_workshop: '#00CED1B0',
  break_room: '#32CD32B0',
  toilets: '#9370DBB0',
  house_foundation: '#A0A0A0B0',
  water_power: '#00BFFFB0',
  prefab_parts: '#DDA0DDB0',
  excavated_ground: '#8B4513D0',
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
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<{ labelId: string; pointIndex: number } | null>(null);
  const containerRef = useRef<View>(null);

  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  const getPointsString = useCallback((points: { x: number; y: number }[], scale: number) => {
    return points.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
  }, []);

  const getFillColor = useCallback((label: Label, isHovered: boolean, isSelected: boolean) => {
    if (label.color) {
      const alpha = isHovered || isSelected ? 'B0' : '50';
      return label.color + alpha;
    }
    
    if (label.status) {
      const statusColors: { [key: string]: string } = {
        pending: '#FFA500',
        in_progress: '#2196F3',
        completed: '#4CAF50',
        blocked: '#F44336',
      };
      const alpha = isHovered || isSelected ? 'B0' : '50';
      return statusColors[label.status] + alpha;
    }
    
    const baseKey = label.label.toLowerCase();
    if (isHovered || isSelected) {
      return highlightColors[baseKey] || '#FF000080';
    }
    return labelColors[baseKey] || '#FF000030';
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

  // Handle label press
  const handleLabelPress = useCallback((label: Label) => {
    if (mode === 'delete' && onLabelDelete) {
      onLabelDelete(label.id);
    } else if (mode !== 'draw') {
      onLabelPress(label);
    }
  }, [mode, onLabelDelete, onLabelPress]);

  // Get coordinates from mouse event relative to container
  const getCoordinatesFromEvent = useCallback((event: MouseEvent): Point | null => {
    if (Platform.OS !== 'web') return null;
    
    const container = containerRef.current as any;
    if (!container) return null;
    
    // Get the DOM node
    const element = container as unknown as HTMLElement;
    if (!element.getBoundingClientRect) return null;
    
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    return { x, y };
  }, [scale]);

  // Web-specific event handlers using useEffect
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const container = containerRef.current;
    if (!container) return;

    // In React Native Web, we need to get the actual DOM node
    // @ts-ignore
    const element = container._nativeTag || container;
    
    // Try to find the DOM element
    let domElement: HTMLElement | null = null;
    
    if (element instanceof HTMLElement) {
      domElement = element;
    } else if (typeof document !== 'undefined') {
      // React Native Web converts dataSet to data-* attributes (lowercase)
      domElement = document.querySelector('[data-labeloverlay="true"]') as HTMLElement;
      
      // Also try by nativeID
      if (!domElement) {
        domElement = document.getElementById('label-overlay-container');
      }
    }

    if (!domElement) {
      console.warn('Could not find DOM element for LabelOverlay');
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (mode === 'draw' && onCanvasClick) {
        const rect = domElement!.getBoundingClientRect();
        const x = (event.clientX - rect.left) / scale;
        const y = (event.clientY - rect.top) / scale;
        
        console.log('Click detected at:', { x, y, mode });
        
        // Make sure click is within bounds
        if (x >= 0 && x <= imageWidth && y >= 0 && y <= imageHeight) {
          onCanvasClick({ x, y });
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (draggingPoint && onPointDrag) {
        const rect = domElement!.getBoundingClientRect();
        const x = (event.clientX - rect.left) / scale;
        const y = (event.clientY - rect.top) / scale;
        
        // Clamp to bounds
        const clampedX = Math.max(0, Math.min(imageWidth, x));
        const clampedY = Math.max(0, Math.min(imageHeight, y));
        
        onPointDrag(draggingPoint.labelId, draggingPoint.pointIndex, { x: clampedX, y: clampedY });
      }
    };

    const handleMouseUp = () => {
      if (draggingPoint) {
        console.log('Point drag end');
        setDraggingPoint(null);
      }
    };

    domElement.addEventListener('click', handleClick);
    
    // Attach move/up to document for better drag tracking outside the element
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      domElement?.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mode, onCanvasClick, scale, imageWidth, imageHeight, draggingPoint, onPointDrag]);

  // Handle point drag start
  const handlePointPressIn = useCallback((labelId: string, pointIndex: number) => {
    if (mode === 'edit') {
      console.log('Point press start:', labelId, pointIndex);
      setDraggingPoint({ labelId, pointIndex });
    }
  }, [mode]);

  // Setup point drag handlers via DOM for web
  useEffect(() => {
    if (Platform.OS !== 'web' || mode !== 'edit' || !selectedLabelId) return;

    const setupPointListeners = () => {
      // Find all edit point circles
      const points = document.querySelectorAll(`[data-edit-point="true"]`);
      
      points.forEach((point) => {
        const element = point as HTMLElement;
        const labelId = element.getAttribute('data-label-id');
        const pointIndex = parseInt(element.getAttribute('data-point-index') || '0', 10);
        
        const handleMouseDown = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Point mousedown:', labelId, pointIndex);
          setDraggingPoint({ labelId: labelId!, pointIndex });
        };
        
        element.addEventListener('mousedown', handleMouseDown);
        
        // Store cleanup function
        (element as any)._cleanup = () => {
          element.removeEventListener('mousedown', handleMouseDown);
        };
      });
    };

    // Small delay to ensure SVG is rendered
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
      case 'delete': return 'pointer';
      case 'edit': return draggingPoint ? 'grabbing' : 'pointer';
      default: return 'pointer';
    }
  };

  return (
    <View 
      ref={containerRef}
      // @ts-ignore - Web specific data attribute (dataSet becomes data-* in DOM)
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
          { pointerEvents: mode === 'draw' ? 'none' : 'auto' } as any
        ]}
      >
        {/* Render existing labels */}
        {labels.map((label) => {
          const isHovered = hoveredLabel === label.id;
          const isSelected = selectedLabelId === label.id;
          const fillColor = getFillColor(label, isHovered, isSelected);
          const strokeColor = isSelected ? '#2196F3' : (isHovered ? '#FFFFFF' : '#00000050');
          const strokeWidth = isSelected ? 3 : (isHovered ? 2 : 1);

          return (
            <G key={label.id}>
              <Polygon
                points={getPointsString(label.points, scale)}
                fill={mode === 'delete' && isHovered ? '#F4433680' : fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                onPress={() => handleLabelPress(label)}
                // @ts-ignore - Web specific props
                onMouseEnter={() => handleMouseEnter(label.id)}
                onMouseLeave={handleMouseLeave}
              />
              
              {/* Render edit points when in edit mode and label is selected */}
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
                  // @ts-ignore - Web specific data attributes
                  data-edit-point="true"
                  data-label-id={label.id}
                  data-point-index={index}
                />
              ))}
            </G>
          );
        })}

        {/* Render drawing preview */}
        {mode === 'draw' && drawingPoints.length > 0 && (
          <G>
            {/* Lines between points */}
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
            
            {/* Points */}
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
            
            {/* Closing line preview */}
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
      </Svg>
    </View>
  );
};

export default LabelOverlay;
