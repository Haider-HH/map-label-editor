export interface Point {
  x: number;
  y: number;
}

export interface Label {
  id: string;
  label: string;
  type: string;
  points: Point[];
  originalType: string;
}

export interface ImageData {
  name: string;
  width: number;
  height: number;
  labels: Label[];
}

export interface LabelsData {
  images: {
    [key: string]: ImageData;
  };
}
