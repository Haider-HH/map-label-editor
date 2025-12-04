import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Label } from '../types';

interface LabelOverlayProps {
  labels: Label[];
  imageWidth: number;
  imageHeight: number;
  scale: number;
  onLabelPress: (label: Label) => void;
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
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const getPointsString = useCallback((points: { x: number; y: number }[], scale: number) => {
    return points.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
  }, []);

  const getFillColor = useCallback((label: Label, isHovered: boolean) => {
    const baseKey = label.label.toLowerCase();
    if (isHovered) {
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

  return (
    <Svg
      width={imageWidth * scale}
      height={imageHeight * scale}
      style={StyleSheet.absoluteFill}
    >
      {labels.map((label) => {
        const isHovered = hoveredLabel === label.id;
        const fillColor = getFillColor(label, isHovered);
        const strokeColor = isHovered ? '#FFFFFF' : '#00000050';
        const strokeWidth = isHovered ? 3 : 1;

        return (
          <Polygon
            key={label.id}
            points={getPointsString(label.points, scale)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            onPress={() => onLabelPress(label)}
            // @ts-ignore - Web specific props
            onMouseEnter={() => handleMouseEnter(label.id)}
            onMouseLeave={handleMouseLeave}
            style={Platform.OS === 'web' ? { cursor: 'pointer' } : undefined}
          />
        );
      })}
    </Svg>
  );
};

export default LabelOverlay;
