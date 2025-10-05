/**
 * AprilTag Detection and Navigation Guide System
 * Detects AprilTags in camera feed and provides navigation instructions
 */

export interface AprilTagDetection {
  id: number;
  corners: [number, number][];
  center: [number, number];
  distance: number; // Estimated distance in meters
  angle: number; // Angle relative to camera center (-90 to 90 degrees)
}

export interface NavigationInstruction {
  direction: 'left' | 'right' | 'center' | 'straight';
  distance: 'near' | 'medium' | 'far';
  instruction: string;
  priority: number;
}

// AprilTag marker size in meters (adjust based on your physical tags)
const MARKER_SIZE = 0.15; // 15cm

// Camera parameters (will be calibrated automatically)
let focalLength = 500; // pixels

/**
 * Detect AprilTags in image data
 * This is a simplified detection - in production, use a proper AprilTag library
 */
export function detectAprilTags(
  imageData: ImageData,
  width: number,
  height: number
): AprilTagDetection[] {
  const detections: AprilTagDetection[] = [];
  
  // Note: This is a placeholder for actual AprilTag detection
  // In a real implementation, you would use a library like apriltag.js
  // or process the image through a detection algorithm
  
  console.log('[APRILTAG] Detection called on image:', width, 'x', height);
  
  // TODO: Implement actual AprilTag detection algorithm
  // For now, returning empty array - this needs to be integrated with
  // a proper AprilTag detection library
  
  return detections;
}

/**
 * Estimate distance to tag based on size in image
 */
export function estimateDistance(corners: [number, number][]): number {
  // Calculate width of tag in pixels
  const width = Math.sqrt(
    Math.pow(corners[1][0] - corners[0][0], 2) +
    Math.pow(corners[1][1] - corners[0][1], 2)
  );
  
  // Distance = (Real Size × Focal Length) / Pixel Size
  const distance = (MARKER_SIZE * focalLength) / width;
  
  return distance;
}

/**
 * Calculate angle of tag relative to camera center
 */
export function calculateAngle(
  center: [number, number],
  imageWidth: number
): number {
  const imageCenter = imageWidth / 2;
  const offset = center[0] - imageCenter;
  const maxOffset = imageWidth / 2;
  
  // Convert to angle (-90 to 90 degrees)
  const angle = (offset / maxOffset) * 90;
  
  return angle;
}

/**
 * Generate navigation instruction based on AprilTag detection
 */
export function generateNavigation(
  tag: AprilTagDetection,
  videoWidth: number
): NavigationInstruction {
  const angle = calculateAngle(tag.center, videoWidth);
  const distance = tag.distance;
  
  // Determine direction
  let direction: NavigationInstruction['direction'];
  if (Math.abs(angle) < 15) {
    direction = 'center';
  } else if (angle < 0) {
    direction = 'left';
  } else {
    direction = 'right';
  }
  
  // Determine distance category
  let distanceCategory: NavigationInstruction['distance'];
  if (distance < 0.5) {
    distanceCategory = 'near';
  } else if (distance < 2.0) {
    distanceCategory = 'medium';
  } else {
    distanceCategory = 'far';
  }
  
  // Generate instruction
  let instruction = '';
  let priority = 3;
  
  if (distanceCategory === 'near') {
    if (direction === 'center') {
      instruction = `AprilTag ${tag.id} directly ahead. Stop here.`;
      priority = 1;
    } else {
      instruction = `AprilTag ${tag.id} very close on your ${direction}. Turn ${direction}.`;
      priority = 2;
    }
  } else if (distanceCategory === 'medium') {
    if (direction === 'center') {
      instruction = `AprilTag ${tag.id} ahead. Continue straight.`;
      priority = 2;
    } else {
      instruction = `AprilTag ${tag.id} on your ${direction}. Adjust ${direction}.`;
      priority = 3;
    }
  } else {
    instruction = `AprilTag ${tag.id} detected ${Math.round(distance)}m away on ${direction}.`;
    priority = 4;
  }
  
  return {
    direction,
    distance: distanceCategory,
    instruction,
    priority,
  };
}

/**
 * Process multiple AprilTag detections and prioritize instructions
 */
export function processAprilTags(
  tags: AprilTagDetection[],
  videoWidth: number
): NavigationInstruction[] {
  const instructions = tags.map((tag) => generateNavigation(tag, videoWidth));
  
  // Sort by priority (lower number = higher priority)
  instructions.sort((a, b) => a.priority - b.priority);
  
  return instructions;
}

/**
 * Calibrate focal length based on known tag size and distance
 */
export function calibrateFocalLength(
  knownDistance: number,
  knownSize: number,
  pixelSize: number
): void {
  focalLength = (pixelSize * knownDistance) / knownSize;
  console.log('[APRILTAG] Focal length calibrated:', focalLength);
}

/**
 * Navigation mode state
 */
export class NavigationGuide {
  private enabled: boolean = false;
  private targetTagId: number | null = null;
  private lastInstruction: string = '';
  private instructionHistory: Map<number, number> = new Map();
  
  enable(): void {
    this.enabled = true;
    console.log('[NAV GUIDE] Enabled');
  }
  
  disable(): void {
    this.enabled = false;
    console.log('[NAV GUIDE] Disabled');
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  setTargetTag(tagId: number): void {
    this.targetTagId = tagId;
    console.log('[NAV GUIDE] Target tag set:', tagId);
  }
  
  getTargetTag(): number | null {
    return this.targetTagId;
  }
  
  /**
   * Check if instruction should be announced based on history
   */
  shouldAnnounce(tagId: number, currentTime: number, interval: number): boolean {
    const lastTime = this.instructionHistory.get(tagId);
    if (!lastTime || (currentTime - lastTime) > interval) {
      this.instructionHistory.set(tagId, currentTime);
      return true;
    }
    return false;
  }
  
  /**
   * Get navigation instructions for detected tags
   */
  getInstructions(
    tags: AprilTagDetection[],
    videoWidth: number,
    currentTime: number,
    interval: number = 5000
  ): NavigationInstruction[] {
    if (!this.enabled) return [];
    
    // Filter to target tag if set
    let relevantTags = tags;
    if (this.targetTagId !== null) {
      relevantTags = tags.filter((tag) => tag.id === this.targetTagId);
    }
    
    // Generate instructions
    const instructions = processAprilTags(relevantTags, videoWidth);
    
    // Filter based on announcement interval
    return instructions.filter((inst, idx) => {
      const tag = relevantTags[idx];
      return this.shouldAnnounce(tag.id, currentTime, interval);
    });
  }
  
  reset(): void {
    this.instructionHistory.clear();
    this.lastInstruction = '';
  }
}
