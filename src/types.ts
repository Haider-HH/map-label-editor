export interface Point {
  x: number;
  y: number;
}

export type LabelStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type LabelPriority = 'low' | 'medium' | 'high';

export interface Label {
  id: string;
  label: string;
  type: string;
  points: Point[];
  originalType: string;
  // Editable fields
  status?: LabelStatus;
  description?: string;
  color?: string;
  priority?: LabelPriority;
  assignee?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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

export type EditorMode = 'view' | 'edit' | 'draw' | 'delete';

export interface EditorState {
  mode: EditorMode;
  selectedLabelId: string | null;
  selectedPointIndex: number | null;
  isDrawing: boolean;
  drawingPoints: Point[];
}
