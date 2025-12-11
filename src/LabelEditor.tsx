import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import BatchLabelModal, { BatchConfig } from './components/BatchLabelModal';
import { Label, LabelsData, EditorMode, Point, ImageData, LabelType } from './types';

// Import Tesseract for OCR (web only)
let Tesseract: any = null;
if (Platform.OS === 'web') {
  import('tesseract.js').then(module => {
    Tesseract = module;
  });
}

// Import assets
const constructionImage = require('../assets/Construction-Site-Plan-768x458.png');
const initialLabelsData: LabelsData = require('../assets/merged-labels.json');

// Store for uploaded images (in-memory for web)
const uploadedImages: { [key: string]: any } = {};

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const SCALE_STEP = 0.1;

// Utility to sample dominant color from an image region (web only)
const sampleColorFromRegion = async (
  imageSource: any,
  points: Point[],
  imageWidth: number,
  imageHeight: number
): Promise<string | null> => {
  if (Platform.OS !== 'web') return null;
  
  try {
    // Get bounding box of the polygon
    const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))));
    const maxX = Math.min(imageWidth, Math.ceil(Math.max(...points.map(p => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))));
    const maxY = Math.min(imageHeight, Math.ceil(Math.max(...points.map(p => p.y))));
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width <= 0 || height <= 0) return null;
    
    // Create canvas and load image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    
    // Load the image
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      
      // Handle different image source types
      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource?.uri) {
        img.src = imageSource.uri;
      } else if (typeof imageSource === 'number') {
        // For require() assets, we need to get the resolved URI
        // This is tricky - for now, return null for bundled assets
        resolve();
        return;
      } else {
        resolve();
        return;
      }
    });
    
    if (!img.complete || img.naturalWidth === 0) return null;
    
    // Draw image to canvas
    ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
    
    // Sample pixels from the region
    const imageData = ctx.getImageData(minX, minY, width, height);
    const pixels = imageData.data;
    
    // Calculate average color (skip transparent pixels)
    let r = 0, g = 0, b = 0, count = 0;
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
      const alpha = pixels[i + 3];
      if (alpha > 128) { // Only count non-transparent pixels
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
        count++;
      }
    }
    
    if (count === 0) return null;
    
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    
    // Convert to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch (error) {
    console.warn('Failed to sample color from image:', error);
    return null;
  }
};

// Extract area (numeric value in sq meters) from a cell region using OCR
// Distinguishes area values from house numbers based on context
const extractAreaFromRegion = async (
  imageSource: any,
  points: Point[],
  imageWidth: number,
  imageHeight: number,
  expectedHouseNumber?: number
): Promise<number | null> => {
  if (Platform.OS !== 'web' || !Tesseract) return null;
  
  try {
    // Get bounding box of the polygon
    const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))));
    const maxX = Math.min(imageWidth, Math.ceil(Math.max(...points.map(p => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))));
    const maxY = Math.min(imageHeight, Math.ceil(Math.max(...points.map(p => p.y))));
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width <= 0 || height <= 0) return null;
    
    // Create canvas and load image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Load the image
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      
      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource?.uri) {
        img.src = imageSource.uri;
      } else {
        resolve();
        return;
      }
    });
    
    if (!img.complete || img.naturalWidth === 0) return null;
    
    // Scale up the cell region for better OCR accuracy
    const scaleFactor = 2;
    canvas.width = width * scaleFactor;
    canvas.height = height * scaleFactor;
    
    // Apply some preprocessing for better OCR
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, minX, minY, width, height, 0, 0, width * scaleFactor, height * scaleFactor);
    
    // Convert to data URL for Tesseract
    const dataUrl = canvas.toDataURL('image/png');
    
    // Run OCR with better settings
    const result = await Tesseract.recognize(dataUrl, 'eng', {
      logger: () => {}, // Suppress logs
    });
    
    const text = result.data.text;
    const words = result.data.words || [];
    
    // Collect all numbers found with their properties
    const foundNumbers: { value: number; hasDecimal: boolean; hasUnit: boolean; fontSize: number; text: string }[] = [];
    
    // Look for numbers with units first (most reliable for area)
    const unitPatterns = [
      /(\d+\.?\d*)\s*(?:m²|m2|sqm|sq\.?\s*m|square\s*m)/gi,
      /(\d+\.?\d*)\s*(?:م²|متر)/gi,
    ];
    
    for (const pattern of unitPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[1]);
        if (value >= 50 && value <= 10000) {
          foundNumbers.push({ 
            value, 
            hasDecimal: match[1].includes('.'), 
            hasUnit: true, 
            fontSize: 0,
            text: match[0]
          });
        }
      }
    }
    
    // If we found a number with units, use it
    if (foundNumbers.length > 0 && foundNumbers.some(n => n.hasUnit)) {
      const withUnit = foundNumbers.find(n => n.hasUnit);
      if (withUnit) return withUnit.value;
    }
    
    // Look for decimal numbers (likely area, not house number)
    const decimalPattern = /(\d+\.\d+)/g;
    let match;
    while ((match = decimalPattern.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      // Decimal numbers between 50-10000 are likely area values
      if (value >= 50 && value <= 10000) {
        foundNumbers.push({ 
          value, 
          hasDecimal: true, 
          hasUnit: false, 
          fontSize: 0,
          text: match[0]
        });
      }
    }
    
    // Also look for patterns where OCR might have read decimal point as comma, space, or other char
    // e.g., "160,0" "160 0" "160-0" should all be "160.0"
    const altDecimalPattern = /(\d+)[,\s\-](\d)/g;
    while ((match = altDecimalPattern.exec(text)) !== null) {
      const value = parseFloat(`${match[1]}.${match[2]}`);
      if (value >= 50 && value <= 1000) {
        foundNumbers.push({ 
          value, 
          hasDecimal: true, 
          hasUnit: false, 
          fontSize: 0,
          text: match[0]
        });
      }
    }
    
    // If we found decimal numbers, prefer them (area values often have decimals)
    if (foundNumbers.length > 0 && foundNumbers.some(n => n.hasDecimal)) {
      const withDecimal = foundNumbers.find(n => n.hasDecimal);
      if (withDecimal) return withDecimal.value;
    }
    
    // Look for whole numbers, but filter out likely house numbers
    const wholeNumberPattern = /\b(\d{2,5})\b/g;
    while ((match = wholeNumberPattern.exec(text)) !== null) {
      let value = parseInt(match[1], 10);
      const originalText = match[1];
      
      // Skip if this looks like the house number
      if (expectedHouseNumber !== undefined) {
        // Skip if it matches the expected house number or is very close
        if (Math.abs(value - expectedHouseNumber) <= 2) {
          continue;
        }
      }
      
      // OCR often misses decimal points - common area values are like 160.0, 200.0, 240.0
      // If we see numbers like 1600, 2000, 2400 that end in 0, they might be missing decimal
      // Check if the number ends in 0 and dividing by 10 gives a reasonable area value
      let hasImpliedDecimal = false;
      if (originalText.endsWith('0') && value >= 1000 && value <= 100000) {
        const adjustedValue = value / 10;
        // Common area values are typically 100-500 sq meters for residential plots
        if (adjustedValue >= 100 && adjustedValue <= 1000) {
          value = adjustedValue;
          hasImpliedDecimal = true;
        }
      }
      
      // Area values are typically:
      // - Between 100-10000 sq meters for residential plots
      // - House numbers are typically 1-999
      // So prefer numbers >= 100 as potential areas
      if (value >= 100 && value <= 10000) {
        foundNumbers.push({ 
          value, 
          hasDecimal: hasImpliedDecimal, 
          hasUnit: false, 
          fontSize: 0,
          text: match[0]
        });
      }
    }
    
    // If we have candidates, return the largest one (area is usually bigger than house number)
    if (foundNumbers.length > 0) {
      // Sort by value descending and return the largest
      foundNumbers.sort((a, b) => b.value - a.value);
      return foundNumbers[0].value;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract area from image:', error);
    return null;
  }
};

// Magic Wand - Flood fill to detect cell boundaries
// Uses edge detection to find the polygon boundary when clicking inside a cell
const magicWandSelect = async (
  imageSource: any,
  clickPoint: Point,
  imageWidth: number,
  imageHeight: number,
  tolerance: number = 30,
  edgeThreshold: number = 50
): Promise<Point[] | null> => {
  if (Platform.OS !== 'web') return null;
  
  try {
    // Create canvas and load image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    
    // Load the image
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      
      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource?.uri) {
        img.src = imageSource.uri;
      } else {
        reject(new Error('Invalid image source'));
        return;
      }
    });
    
    if (!img.complete || img.naturalWidth === 0) return null;
    
    // Draw image to canvas
    ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
    
    // Get image data
    const imgData = ctx.getImageData(0, 0, imageWidth, imageHeight);
    const pixels = imgData.data;
    
    const getPixel = (x: number, y: number): [number, number, number] => {
      const i = (y * imageWidth + x) * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2]];
    };
    
    // Calculate gradient magnitude (edge strength) at a point
    const getEdgeStrength = (x: number, y: number): number => {
      if (x <= 0 || x >= imageWidth - 1 || y <= 0 || y >= imageHeight - 1) return 255;
      
      const [r1, g1, b1] = getPixel(x - 1, y);
      const [r2, g2, b2] = getPixel(x + 1, y);
      const [r3, g3, b3] = getPixel(x, y - 1);
      const [r4, g4, b4] = getPixel(x, y + 1);
      
      const gx = Math.abs(r2 - r1) + Math.abs(g2 - g1) + Math.abs(b2 - b1);
      const gy = Math.abs(r4 - r3) + Math.abs(g4 - g3) + Math.abs(b4 - b3);
      
      return Math.sqrt(gx * gx + gy * gy);
    };
    
    const startX = Math.round(clickPoint.x);
    const startY = Math.round(clickPoint.y);
    
    if (startX < 0 || startX >= imageWidth || startY < 0 || startY >= imageHeight) {
      return null;
    }
    
    // Flood fill to find the region
    const visited = new Set<string>();
    const region = new Set<string>();
    const queue: [number, number][] = [[startX, startY]];
    const key = (x: number, y: number) => `${x},${y}`;
    
    // Get starting color for comparison
    const [startR, startG, startB] = getPixel(startX, startY);
    
    const colorMatch = (x: number, y: number): boolean => {
      const [r, g, b] = getPixel(x, y);
      const diff = Math.abs(r - startR) + Math.abs(g - startG) + Math.abs(b - startB);
      return diff <= tolerance;
    };
    
    // Limit flood fill to prevent performance issues
    const maxPixels = 500000;
    let pixelCount = 0;
    
    while (queue.length > 0 && pixelCount < maxPixels) {
      const [x, y] = queue.shift()!;
      const k = key(x, y);
      
      if (visited.has(k)) continue;
      visited.add(k);
      
      if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) continue;
      
      // Check if this is an edge (boundary)
      const edgeStrength = getEdgeStrength(x, y);
      if (edgeStrength > edgeThreshold) continue;
      
      // Check color similarity
      if (!colorMatch(x, y)) continue;
      
      region.add(k);
      pixelCount++;
      
      // Add neighbors
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    if (region.size < 100) {
      console.warn('Region too small, try adjusting tolerance');
      return null;
    }
    
    // Extract boundary points using marching squares-like approach
    const regionArray = Array.from(region).map(k => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
    
    // Find bounding box
    const minX = Math.min(...regionArray.map(p => p.x));
    const maxX = Math.max(...regionArray.map(p => p.x));
    const minY = Math.min(...regionArray.map(p => p.y));
    const maxY = Math.max(...regionArray.map(p => p.y));
    
    // Find boundary pixels
    const boundary: Point[] = [];
    const isInRegion = (x: number, y: number) => region.has(key(x, y));
    
    for (const k of region) {
      const [x, y] = k.split(',').map(Number);
      // Check if this is a boundary pixel (has at least one non-region neighbor)
      if (!isInRegion(x - 1, y) || !isInRegion(x + 1, y) || 
          !isInRegion(x, y - 1) || !isInRegion(x, y + 1)) {
        boundary.push({ x, y });
      }
    }
    
    if (boundary.length < 4) {
      // Fall back to bounding box
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    }
    
    // Simplify boundary to polygon using convex hull or simplified contour
    // Sort boundary points by angle from centroid
    const centroidX = regionArray.reduce((s, p) => s + p.x, 0) / regionArray.length;
    const centroidY = regionArray.reduce((s, p) => s + p.y, 0) / regionArray.length;
    
    boundary.sort((a, b) => {
      const angleA = Math.atan2(a.y - centroidY, a.x - centroidX);
      const angleB = Math.atan2(b.y - centroidY, b.x - centroidX);
      return angleA - angleB;
    });
    
    // Sample points to create a simplified polygon (every Nth point)
    const targetPoints = Math.min(boundary.length, 50);
    const step = Math.max(1, Math.floor(boundary.length / targetPoints));
    const simplified: Point[] = [];
    
    for (let i = 0; i < boundary.length; i += step) {
      simplified.push(boundary[i]);
    }
    
    // Further simplify using Douglas-Peucker algorithm
    const simplifyPolygon = (points: Point[], epsilon: number): Point[] => {
      if (points.length <= 2) return points;
      
      let maxDist = 0;
      let maxIdx = 0;
      const start = points[0];
      const end = points[points.length - 1];
      
      for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(points[i], start, end);
        if (dist > maxDist) {
          maxDist = dist;
          maxIdx = i;
        }
      }
      
      if (maxDist > epsilon) {
        const left = simplifyPolygon(points.slice(0, maxIdx + 1), epsilon);
        const right = simplifyPolygon(points.slice(maxIdx), epsilon);
        return [...left.slice(0, -1), ...right];
      }
      
      return [start, end];
    };
    
    const perpendicularDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
      
      const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
      const closestX = lineStart.x + u * dx;
      const closestY = lineStart.y + u * dy;
      
      return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
    };
    
    // Use epsilon based on region size
    const regionSize = Math.max(maxX - minX, maxY - minY);
    const epsilon = regionSize * 0.02; // 2% of region size
    
    const finalPolygon = simplifyPolygon(simplified, epsilon);
    
    // Ensure we have at least 4 points for a reasonable polygon
    if (finalPolygon.length < 4) {
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    }
    
    return finalPolygon;
  } catch (error) {
    console.error('Magic wand selection failed:', error);
    return null;
  }
};

const LabelEditor: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  // Auto-save constants
  const AUTO_SAVE_INTERVAL = 15000; // 15 seconds
  const LOCAL_STORAGE_KEY = 'label-editor-autosave';
  
  // Load initial data from localStorage if available
  const getInitialLabelsData = (): LabelsData => {
    if (Platform.OS === 'web') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.data && parsed.data.images) {
            console.log('Loaded auto-saved data from', new Date(parsed.timestamp).toLocaleString());
            return parsed.data;
          }
        }
      } catch (e) {
        console.warn('Failed to load auto-saved data:', e);
      }
    }
    return initialLabelsData;
  };
  
  // State
  const [labelsData, setLabelsData] = useState<LabelsData>(getInitialLabelsData);
  const [selectedImageKey, setSelectedImageKey] = useState<string>(() => {
    const data = getInitialLabelsData();
    return Object.keys(data.images)[0];
  });
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('view');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [showNewLabelModal, setShowNewLabelModal] = useState(false);
  const [showAddImageModal, setShowAddImageModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [history, setHistory] = useState<LabelsData[]>([]);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Rectangle drawing state
  const [rectStart, setRectStart] = useState<Point | null>(null);
  const [rectEnd, setRectEnd] = useState<Point | null>(null);
  
  // Batch selection state
  const [batchSelectionRect, setBatchSelectionRect] = useState<{ start: Point; end: Point } | null>(null);
  
  // Magic wand state
  const [magicWandLoading, setMagicWandLoading] = useState(false);
  const [magicWandTolerance, setMagicWandTolerance] = useState(30);
  const [magicWandEdgeThreshold, setMagicWandEdgeThreshold] = useState(50);
  
  // Zoom/pan state
  const [viewScale, setViewScale] = useState(1);
  const [viewTranslateX, setViewTranslateX] = useState(0);
  const [viewTranslateY, setViewTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; translateX: number; translateY: number } | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const containerRef = useRef<View>(null);

  const imageData = labelsData.images[selectedImageKey];
  const selectedLabel = selectedLabelId 
    ? imageData?.labels.find(l => l.id === selectedLabelId) 
    : null;

  // Calculate base scale to fit in viewport
  const padding = 40;
  const toolbarHeight = 200;
  const maxWidth = windowWidth - padding * 2 - (selectedLabel ? 340 : 0);
  const maxHeight = windowHeight - toolbarHeight - 100;

  const baseScaleX = maxWidth / (imageData?.width || 768);
  const baseScaleY = maxHeight / (imageData?.height || 458);
  const baseScale = Math.min(baseScaleX, baseScaleY, 1);

  // Combined scale (base fit * user zoom)
  const scale = baseScale * viewScale;

  const scaledWidth = (imageData?.width || 768) * scale;
  const scaledHeight = (imageData?.height || 458) * scale;

  // Get image source
  const getImageSource = useCallback(() => {
    if (imageData?.imageUri) {
      return { uri: imageData.imageUri };
    }
    if (selectedImageKey === 'Construction-Site-Plan-768x458.png') {
      return constructionImage;
    }
    return uploadedImages[selectedImageKey] || constructionImage;
  }, [imageData?.imageUri, selectedImageKey]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setViewScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewScale(prev => Math.max(prev - SCALE_STEP, MIN_SCALE));
  }, []);

  const handleResetZoom = useCallback(() => {
    setViewScale(1);
    setViewTranslateX(0);
    setViewTranslateY(0);
  }, []);

  // Save to history for undo
  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(labelsData))]);
  }, [labelsData]);

  // Auto-save to localStorage
  const performAutoSave = useCallback(() => {
    if (Platform.OS === 'web') {
      try {
        setAutoSaveStatus('saving');
        const saveData = {
          data: labelsData,
          timestamp: Date.now(),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
        setLastAutoSave(new Date());
        setAutoSaveStatus('saved');
        console.log('Auto-saved at', new Date().toLocaleTimeString());
        
        // Reset status after 2 seconds
        setTimeout(() => {
          setAutoSaveStatus('idle');
        }, 2000);
      } catch (e) {
        console.error('Auto-save failed:', e);
        setAutoSaveStatus('idle');
      }
    }
  }, [labelsData]);

  // Auto-save effect - runs every 15 seconds
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const intervalId = setInterval(() => {
      performAutoSave();
    }, AUTO_SAVE_INTERVAL);
    
    // Also save when component unmounts
    return () => {
      clearInterval(intervalId);
      // Final save on unmount
      try {
        const saveData = {
          data: labelsData,
          timestamp: Date.now(),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
      } catch (e) {
        console.error('Final save failed:', e);
      }
    };
  }, [performAutoSave]);

  // Undo
  const handleUndo = useCallback(() => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setLabelsData(previousState);
      setHistory(prev => prev.slice(0, -1));
    }
  }, [history]);

  // Wheel zoom handler for web - zoom towards cursor
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWheel = (e: WheelEvent) => {
      // Only handle when over the image area
      const target = e.target as HTMLElement;
      const container = target.closest('[data-image-container="true"]') as HTMLElement;
      if (!container) return;

      e.preventDefault();
      
      // Get cursor position relative to the container
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      // Calculate the point on the image under the cursor (in image coordinates)
      const imageX = (cursorX - viewTranslateX) / viewScale;
      const imageY = (cursorY - viewTranslateY) / viewScale;
      
      // Calculate new scale
      const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
      const newScale = Math.min(Math.max(viewScale + delta, MIN_SCALE), MAX_SCALE);
      
      if (newScale === viewScale) return;
      
      // Calculate new translate to keep the cursor point stationary
      const newTranslateX = cursorX - imageX * newScale;
      const newTranslateY = cursorY - imageY * newScale;
      
      setViewScale(newScale);
      setViewTranslateX(newTranslateX);
      setViewTranslateY(newTranslateY);
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [viewScale, viewTranslateX, viewTranslateY]);

  // Panning with middle mouse or space+drag
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-image-container="true"]')) return;
      
      // Middle mouse button or space+left click for panning
      if (e.button === 1 || (spacePressed && e.button === 0)) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ 
          x: e.clientX, 
          y: e.clientY, 
          translateX: viewTranslateX, 
          translateY: viewTranslateY 
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning || !panStart) return;
      
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      
      setViewTranslateX(panStart.translateX + dx);
      setViewTranslateY(panStart.translateY + dy);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || e.button === 0) {
        setIsPanning(false);
        setPanStart(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, panStart, spacePressed, viewTranslateX, viewTranslateY]);

  // Keyboard shortcuts for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      // Space for panning
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setMode('view');
          break;
        case 'e':
          setMode('edit');
          break;
        case 'p':
          setMode('draw'); // Polygon
          break;
        case 'r':
          setMode('draw-rect'); // Rectangle
          break;
        case 'b':
          setMode('batch');
          break;
        case 'w':
          setMode('magic-wand'); // Magic wand
          break;
        case 'd':
          if (!selectedLabelId) {
            setMode('delete');
          }
          break;
        case 'escape':
          setDrawingPoints([]);
          setRectStart(null);
          setRectEnd(null);
          setBatchSelectionRect(null);
          setSelectedLabelId(null);
          setMode('view');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleUndo();
          }
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleResetZoom();
          }
          break;
        case 'enter':
          if (mode === 'draw' && drawingPoints.length >= 3) {
            setShowNewLabelModal(true);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        setSpacePressed(false);
        setIsPanning(false);
        setPanStart(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, selectedLabelId, drawingPoints.length, handleUndo, handleZoomIn, handleZoomOut, handleResetZoom]);

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
      setDrawingPoints(prev => [...prev, point]);
    }
  }, [mode]);

  // Rectangle drawing handlers
  const handleRectDrawStart = useCallback((point: Point) => {
    setRectStart(point);
    setRectEnd(point);
  }, []);

  const handleRectDrawMove = useCallback((point: Point) => {
    if (rectStart) {
      setRectEnd(point);
    }
  }, [rectStart]);

  const handleRectDrawEnd = useCallback((point: Point) => {
    if (rectStart && rectEnd) {
      const minX = Math.min(rectStart.x, point.x);
      const maxX = Math.max(rectStart.x, point.x);
      const minY = Math.min(rectStart.y, point.y);
      const maxY = Math.max(rectStart.y, point.y);
      
      // Only create if it has some size
      if (maxX - minX > 5 && maxY - minY > 5) {
        setDrawingPoints([
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ]);
        setShowNewLabelModal(true);
      }
    }
    setRectStart(null);
    setRectEnd(null);
  }, [rectStart, rectEnd]);

  // Batch selection handlers
  const handleBatchSelectionStart = useCallback((point: Point) => {
    setBatchSelectionRect({ start: point, end: point });
  }, []);

  const handleBatchSelectionMove = useCallback((point: Point) => {
    if (batchSelectionRect) {
      setBatchSelectionRect(prev => prev ? { ...prev, end: point } : null);
    }
  }, [batchSelectionRect]);

  const handleBatchSelectionEnd = useCallback((start: Point, end: Point) => {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    
    // Only show modal if it has some size
    if (maxX - minX > 20 && maxY - minY > 20) {
      setBatchSelectionRect({ start: { x: minX, y: minY }, end: { x: maxX, y: maxY } });
      setShowBatchModal(true);
    } else {
      setBatchSelectionRect(null);
    }
  }, []);

  // Magic wand click handler
  const handleMagicWandClick = useCallback(async (point: Point) => {
    if (mode !== 'magic-wand' || magicWandLoading) return;
    
    setMagicWandLoading(true);
    try {
      const imgSource = getImageSource();
      const polygon = await magicWandSelect(
        imgSource,
        point,
        imageData?.width || 768,
        imageData?.height || 458,
        magicWandTolerance,
        magicWandEdgeThreshold
      );
      
      if (polygon && polygon.length >= 3) {
        setDrawingPoints(polygon);
        setShowNewLabelModal(true);
      } else {
        if (Platform.OS === 'web') {
          alert('Could not detect cell boundary. Try clicking in a different area or adjusting tolerance.');
        } else {
          Alert.alert('Detection Failed', 'Could not detect cell boundary. Try clicking in a different area or adjusting tolerance.');
        }
      }
    } catch (error) {
      console.error('Magic wand failed:', error);
      if (Platform.OS === 'web') {
        alert('Magic wand selection failed. Try adjusting the tolerance or edge threshold.');
      }
    } finally {
      setMagicWandLoading(false);
    }
  }, [mode, magicWandLoading, getImageSource, imageData, magicWandTolerance, magicWandEdgeThreshold]);

  // Finish drawing
  const handleFinishDrawing = useCallback(() => {
    if (drawingPoints.length >= 3) {
      setShowNewLabelModal(true);
    }
  }, [drawingPoints]);

  // Cancel drawing
  const handleCancelDrawing = useCallback(() => {
    setDrawingPoints([]);
    setRectStart(null);
    setRectEnd(null);
    setBatchSelectionRect(null);
    setMode('view');
  }, []);

  // Create new label from drawing
  const handleCreateLabel = useCallback((labelData: {
    type: LabelType;
    blockNumber: string;
    houseNumber: string;
    color: string;
    area?: number;
  }) => {
    if (drawingPoints.length < 3) return;
    
    saveHistory();
    const newId = `${labelData.type}_${labelData.blockNumber || ''}_${Date.now()}`.replace(/\s+/g, '_');
    const closedPoints = [...drawingPoints, drawingPoints[0]]; // Close the polygon
    
    const newLabel: Label = {
      id: newId,
      type: labelData.type,
      points: closedPoints,
      blockNumber: labelData.blockNumber || undefined,
      houseNumber: labelData.houseNumber || undefined,
      color: labelData.color,
      area: labelData.area,
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

  // Create batch labels
  const handleCreateBatchLabels = useCallback(async (config: BatchConfig) => {
    if (!batchSelectionRect) return;
    
    saveHistory();
    
    const { start, end } = batchSelectionRect;
    const totalWidth = end.x - start.x;
    const totalHeight = end.y - start.y;
    
    // Calculate cell positions based on dividers or equal distribution
    const getCellBounds = (row: number, col: number): { x: number; y: number; width: number; height: number } => {
      // Use dividers if provided, otherwise equal divisions
      const colDividers = config.columnDividers || 
        Array.from({ length: config.cols - 1 }, (_, i) => (i + 1) / config.cols);
      const rowDividers = config.rowDividers || 
        Array.from({ length: config.rows - 1 }, (_, i) => (i + 1) / config.rows);
      
      // Get column boundaries as fractions [0, divider1, divider2, ..., 1]
      const colBoundaries = [0, ...colDividers, 1];
      const rowBoundaries = [0, ...rowDividers, 1];
      
      const leftFraction = colBoundaries[col];
      const rightFraction = colBoundaries[col + 1];
      const topFraction = rowBoundaries[row];
      const bottomFraction = rowBoundaries[row + 1];
      
      return {
        x: start.x + leftFraction * totalWidth,
        y: start.y + topFraction * totalHeight,
        width: (rightFraction - leftFraction) * totalWidth,
        height: (bottomFraction - topFraction) * totalHeight,
      };
    };
    
    // Calculate house number for each cell position based on numbering order
    const getHouseNumber = (row: number, col: number): number => {
      const { rows, cols, startHouseNumber, houseNumberIncrement, numberingOrder, useCustomSequence, customSequence } = config;
      const increment = houseNumberIncrement || 1;
      
      // Calculate the sequential index based on numbering order
      let sequenceIndex: number;
      
      switch (numberingOrder) {
        case 'ltr':
          sequenceIndex = row * cols + col;
          break;
        case 'rtl':
          sequenceIndex = row * cols + (cols - 1 - col);
          break;
        case 'boustrophedon':
          sequenceIndex = row % 2 === 0 
            ? row * cols + col 
            : row * cols + (cols - 1 - col);
          break;
        case 'col-ltr':
          sequenceIndex = col * rows + row;
          break;
        case 'col-rtl':
          sequenceIndex = (cols - 1 - col) * rows + row;
          break;
        case 'evens-odds':
        case 'odds-evens':
          // These have special handling below
          sequenceIndex = row * cols + col;
          break;
        default:
          sequenceIndex = row * cols + col;
      }
      
      // If using custom sequence, get the number from the sequence array
      if (useCustomSequence && customSequence && customSequence.length > 0) {
        // Use modulo to cycle through the sequence if there are more cells than numbers
        return customSequence[sequenceIndex % customSequence.length];
      }
      
      // Regular increment-based numbering
      switch (numberingOrder) {
        case 'ltr':
          // Left to right, top to bottom: 1 2 3 4 5 / 6 7 8 9 10
          return startHouseNumber + (row * cols + col) * increment;
          
        case 'rtl':
          // Right to left, top to bottom: 5 4 3 2 1 / 10 9 8 7 6
          return startHouseNumber + (row * cols + (cols - 1 - col)) * increment;
          
        case 'boustrophedon':
          // Alternating snake pattern: 1 2 3 4 5 / 10 9 8 7 6
          if (row % 2 === 0) {
            return startHouseNumber + (row * cols + col) * increment;
          } else {
            return startHouseNumber + (row * cols + (cols - 1 - col)) * increment;
          }
          
        case 'evens-odds':
          // Evens on first row, odds on second: 2 4 6 8 10 / 1 3 5 7 9
          // Even numbers: 2, 4, 6, ... on row 0
          // Odd numbers: 1, 3, 5, ... on row 1
          if (rows === 2) {
            if (row === 0) {
              // Even numbers starting from startHouseNumber (if even) or startHouseNumber+1
              const firstEven = startHouseNumber % 2 === 0 ? startHouseNumber : startHouseNumber + 1;
              return firstEven + col * 2 * increment;
            } else {
              // Odd numbers
              const firstOdd = startHouseNumber % 2 === 1 ? startHouseNumber : startHouseNumber + 1;
              return firstOdd + col * 2 * increment;
            }
          }
          // For more than 2 rows, fall back to regular pattern
          return startHouseNumber + (row * cols + col) * increment;
          
        case 'odds-evens':
          // Odds on first row, evens on second: 1 3 5 7 9 / 2 4 6 8 10
          if (rows === 2) {
            if (row === 0) {
              // Odd numbers
              const firstOdd = startHouseNumber % 2 === 1 ? startHouseNumber : startHouseNumber + 1;
              return firstOdd + col * 2 * increment;
            } else {
              // Even numbers
              const firstEven = startHouseNumber % 2 === 0 ? startHouseNumber : startHouseNumber + 1;
              return firstEven + col * 2 * increment;
            }
          }
          // For more than 2 rows, fall back to regular pattern
          return startHouseNumber + (row * cols + col) * increment;
          
        case 'col-ltr':
          // Column by column, left to right: 1 3 5 / 2 4 6
          return startHouseNumber + (col * rows + row) * increment;
          
        case 'col-rtl':
          // Column by column, right to left
          return startHouseNumber + ((cols - 1 - col) * rows + row) * increment;
          
        default:
          return startHouseNumber + (row * cols + col) * increment;
      }
    };
    
    const newLabels: Label[] = [];
    const imgSource = getImageSource();
    const imgWidth = imageData?.width || 768;
    const imgHeight = imageData?.height || 458;
    
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        const { x: cellX, y: cellY, width: cellWidth, height: cellHeight } = getCellBounds(row, col);
        
        const currentHouseNum = getHouseNumber(row, col);
        
        // Get cell polygon points
        const cellPoints = [
          { x: cellX, y: cellY },
          { x: cellX + cellWidth, y: cellY },
          { x: cellX + cellWidth, y: cellY + cellHeight },
          { x: cellX, y: cellY + cellHeight },
        ];
        
        // Auto-detect color if enabled
        let labelColor = config.color;
        if (config.autoDetectColor && Platform.OS === 'web') {
          const detectedColor = await sampleColorFromRegion(imgSource, cellPoints, imgWidth, imgHeight);
          if (detectedColor) {
            labelColor = detectedColor;
          }
        }
        
        // Auto-detect area using OCR if enabled
        // Pass the expected house number so we can filter it out
        let detectedArea: number | undefined;
        if (config.autoDetectArea && Platform.OS === 'web') {
          const area = await extractAreaFromRegion(imgSource, cellPoints, imgWidth, imgHeight, currentHouseNum);
          if (area !== null) {
            detectedArea = area;
          }
        }
        
        const newLabel: Label = {
          id: `${config.type}_${config.startBlockNumber}_${currentHouseNum}_${Date.now()}_${row}_${col}`.replace(/\s+/g, '_'),
          type: config.type,
          points: [
            ...cellPoints,
            cellPoints[0], // Close polygon
          ],
          blockNumber: config.startBlockNumber,
          houseNumber: String(currentHouseNum),
          color: labelColor,
          area: detectedArea,
          createdAt: new Date().toISOString(),
        };
        
        newLabels.push(newLabel);
      }
    }

    setLabelsData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        [selectedImageKey]: {
          ...prev.images[selectedImageKey],
          labels: [...prev.images[selectedImageKey].labels, ...newLabels],
        },
      },
    }));

    setBatchSelectionRect(null);
    setMode('view');
  }, [batchSelectionRect, selectedImageKey, saveHistory, getImageSource, imageData]);

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
    handleResetZoom();
  }, [saveHistory, handleResetZoom]);

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
                handleResetZoom();
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
  }, [saveHistory, handleResetZoom]);

  // Mode change
  const handleModeChange = useCallback((newMode: EditorMode) => {
    if (newMode !== 'draw' && newMode !== 'magic-wand') {
      setDrawingPoints([]);
    }
    if (newMode !== 'draw-rect') {
      setRectStart(null);
      setRectEnd(null);
    }
    if (newMode !== 'batch') {
      setBatchSelectionRect(null);
    }
    if (newMode === 'draw' || newMode === 'delete' || newMode === 'draw-rect' || newMode === 'batch' || newMode === 'magic-wand') {
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
        scale={viewScale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        autoSaveStatus={autoSaveStatus}
        lastAutoSave={lastAutoSave}
        onManualSave={performAutoSave}
        magicWandTolerance={magicWandTolerance}
        onMagicWandToleranceChange={setMagicWandTolerance}
        magicWandEdgeThreshold={magicWandEdgeThreshold}
        onMagicWandEdgeThresholdChange={setMagicWandEdgeThreshold}
      />

      <ImageSelector
        images={labelsData.images}
        selectedImage={selectedImageKey}
        onSelectImage={(key) => {
          setSelectedImageKey(key);
          setSelectedLabelId(null);
          handleResetZoom();
        }}
        onDeleteImage={handleDeleteImage}
      />

      <View style={styles.mainContent}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          horizontal={false}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={true}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{imageData?.name || 'Image Viewer'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'view' && 'Hover to highlight • Click to view details'}
              {mode === 'edit' && 'Click a label to edit • Drag points to reshape'}
              {mode === 'draw' && 'Click to add points • Min 3 points required'}
              {mode === 'draw-rect' && 'Click and drag to draw a rectangle'}
              {mode === 'batch' && 'Select an area to create multiple labels'}
              {mode === 'delete' && 'Click a label to delete it'}
              {mode === 'magic-wand' && (magicWandLoading ? 'Detecting boundary...' : 'Click inside a cell to auto-detect its boundary')}
            </Text>
            <Text style={styles.info}>
              {imageData?.labels.length || 0} labels • {imageData?.width}×{imageData?.height}px • Zoom: {Math.round(viewScale * 100)}%
            </Text>
          </View>

          <View 
            style={[
              styles.viewportContainer,
              { 
                width: maxWidth,
                height: maxHeight,
                cursor: spacePressed || isPanning ? 'grabbing' : 'default',
              } as any
            ]}
            // @ts-ignore
            dataSet={{ imageContainer: 'true' }}
          >
            <View 
              style={[
                styles.transformContainer,
                {
                  transform: [
                    { translateX: viewTranslateX },
                    { translateY: viewTranslateY },
                    { scale: viewScale },
                  ],
                  width: (imageData?.width || 768) * baseScale,
                  height: (imageData?.height || 458) * baseScale,
                }
              ]}
            >
              <Image
                source={getImageSource()}
                style={[styles.image, { 
                  width: (imageData?.width || 768) * baseScale, 
                  height: (imageData?.height || 458) * baseScale 
                }]}
                resizeMode="contain"
              />
              <LabelOverlay
                labels={imageData?.labels || []}
                imageWidth={imageData?.width || 768}
                imageHeight={imageData?.height || 458}
                scale={baseScale}
                onLabelPress={handleLabelPress}
                mode={isPanning || spacePressed ? 'view' : mode}
                selectedLabelId={selectedLabelId}
                onPointDrag={handlePointDrag}
                onLabelDelete={handleDeleteLabel}
                drawingPoints={drawingPoints}
                onCanvasClick={isPanning || spacePressed ? () => {} : handleCanvasClick}
                rectStart={rectStart}
                rectEnd={rectEnd}
                onRectDrawStart={handleRectDrawStart}
                onRectDrawMove={handleRectDrawMove}
                onRectDrawEnd={handleRectDrawEnd}
                batchSelectionRect={batchSelectionRect}
                onBatchSelectionStart={handleBatchSelectionStart}
                onBatchSelectionMove={handleBatchSelectionMove}
                onBatchSelectionEnd={handleBatchSelectionEnd}
                viewScale={viewScale}
                viewTranslateX={viewTranslateX}
                viewTranslateY={viewTranslateY}
                onMagicWandClick={isPanning || spacePressed ? () => {} : handleMagicWandClick}
              />
            </View>
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
          if (mode === 'draw-rect') {
            // Stay in rect mode for quick successive drawings
          } else {
            setMode('view');
          }
        }}
        onConfirm={handleCreateLabel}
      />

      <AddImageModal
        visible={showAddImageModal}
        onClose={() => setShowAddImageModal(false)}
        onConfirm={handleAddImage}
      />

      <BatchLabelModal
        visible={showBatchModal}
        onClose={() => {
          setShowBatchModal(false);
          setBatchSelectionRect(null);
        }}
        onConfirm={handleCreateBatchLabels}
        selectionRect={batchSelectionRect}
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
  horizontalScroll: {
    alignItems: 'center',
    paddingHorizontal: 20,
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
  viewportContainer: {
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    position: 'relative',
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
  transformContainer: {
    transformOrigin: '0 0',
  } as any,
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
