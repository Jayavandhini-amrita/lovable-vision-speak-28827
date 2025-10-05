/**
 * Dynamic Priority Logic for Object Detection
 * Determines priority and instruction based on object properties
 */

import { Detection } from '@/components/CameraCanvas';

export const OBSTACLE_CLASSES = new Set([
  'table', 'chair', 'occupied chair', 'unoccupied chair', 'screen',
  'laptop', 'person', 'shelf', 'plate', 'refrigerator',
  'closed door', 'opened door', 'stairs', 'window', 'trashbin',
  'box', 'boy', 'wall', 'pole', 'bench', 'barrier'
]);

export const SMALL_OBJECTS = new Set([
  'bottle', 'phone', 'cup', 'book', 'pen', 'remote'
]);

interface PreviousDetection {
  area: number;
  lastSeen: number;
  position: string;
}

const previousDetections = new Map<string, PreviousDetection>();

export function getPosition(bbox: [number, number, number, number], videoWidth: number): string {
  const [x, , width] = bbox;
  const cx = x + width / 2;

  if (cx < videoWidth / 3) return 'left';
  if (cx > (2 * videoWidth) / 3) return 'right';
  return 'center';
}

export function getDynamicPriority(
  detection: Detection,
  videoWidth: number,
  videoHeight: number
): { priority: number; instruction: string } {
  const { bbox, class: label } = detection;
  const [x, y, width, height] = bbox;
  const area = width * height;
  const screenArea = videoWidth * videoHeight;
  const relativeSize = area / screenArea;

  const position = getPosition(bbox, videoWidth);
  const key = `${label}-${position}`;

  // Check if object is approaching (growing in size)
  let isApproaching = false;
  let sizeIncrease = 0;

  const prev = previousDetections.get(key);
  if (prev) {
    sizeIncrease = (area - prev.area) / prev.area;
    if (sizeIncrease > 0.3) {
      isApproaching = true;
    }
  }

  // Update tracking
  previousDetections.set(key, {
    area,
    lastSeen: Date.now(),
    position,
  });

  // Clean up old detections (not seen in 30 seconds)
  const now = Date.now();
  for (const [k, v] of previousDetections.entries()) {
    if (now - v.lastSeen > 30000) {
      previousDetections.delete(k);
    }
  }

  // Priority logic

  // Small objects - always low priority
  if (Array.from(SMALL_OBJECTS).some(small => label.toLowerCase().includes(small))) {
    return {
      priority: 4,
      instruction: `${label} on your ${position}`
    };
  }

  const isObstacle = OBSTACLE_CLASSES.has(label) || 
    Array.from(OBSTACLE_CLASSES).some(obs => label.toLowerCase().includes(obs));

  // Non-obstacles - low priority
  if (!isObstacle) {
    return {
      priority: 4,
      instruction: `${label} on your ${position}`
    };
  }

  // CRITICAL: Very large object in front (>40% of screen)
  if (relativeSize > 0.4) {
    return {
      priority: 1,
      instruction: `STOP! ${label} very close in front!`
    };
  }

  // URGENT: Approaching obstacle
  if (isApproaching) {
    return {
      priority: 2,
      instruction: `Warning! ${label} getting closer on your ${position}`
    };
  }

  // NORMAL: Obstacle detected
  return {
    priority: 3,
    instruction: `${label} on your ${position}`
  };
}

export function clearDetectionHistory() {
  previousDetections.clear();
}
