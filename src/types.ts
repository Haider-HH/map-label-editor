export interface Point {
  x: number;
  y: number;
}

export type LabelType = 'residential' | 'commercial' | 'park' | 'mosque' | 'school' | 'road' | 'other';

export interface Label {
  id: string;
  type: LabelType | string; // string allows legacy "polygon" type
  points: Point[];
  // Properties specific to plot/site maps
  area?: number; // in square meters
  color?: string; // hex color
  blockNumber?: string; // e.g., "G 01", "H 15"
  houseNumber?: string; // e.g., "123", "A-5"
  createdAt?: string;
  updatedAt?: string;
  // Legacy fields for backward compatibility
  label?: string; // old field name
  originalType?: string;
}

export interface ImageData {
  name: string;
  width: number;
  height: number;
  labels: Label[];
  imageUri?: string; // For uploaded images
}

export interface LabelsData {
  images: {
    [key: string]: ImageData;
  };
}

export type EditorMode = 'view' | 'edit' | 'draw' | 'draw-rect' | 'delete' | 'batch';

export interface EditorState {
  mode: EditorMode;
  selectedLabelId: string | null;
  selectedPointIndex: number | null;
  isDrawing: boolean;
  drawingPoints: Point[];
}

// For batch creation
export interface BatchConfig {
  rows: number;
  cols: number;
  startBlockNumber: string;
  startHouseNumber: number;
  type: LabelType;
  color: string;
}

// For zoom/pan
export interface ViewState {
  scale: number;
  translateX: number;
  translateY: number;
}
