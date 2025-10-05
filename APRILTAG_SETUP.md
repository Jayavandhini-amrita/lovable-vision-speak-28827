# AprilTag Detection & Navigation Setup

## Overview
This application includes AprilTag detection for indoor navigation assistance. AprilTags are fiducial markers used for precise location tracking and navigation.

## Features
- Real-time AprilTag detection from camera feed
- Distance estimation to detected tags
- Direction guidance (left/right/center)
- Priority-based voice announcements
- Navigation mode with target tag tracking

## Current Implementation Status

### ✅ Implemented
- Navigation framework and UI
- Priority-based TTS integration
- Distance and angle calculation logic
- Navigation instruction generation
- Mobile-friendly navigation controls

### ⚠️ Requires Integration
The actual AprilTag detection algorithm needs to be integrated. The framework is ready, but you need to:

1. **Choose an AprilTag Detection Library:**
   - **apriltag.js** - JavaScript port of AprilTag
   - **OpenCV.js** - Comprehensive computer vision library
   - **AR.js** - Augmented reality framework with marker detection

2. **Update Detection Function:**
   Edit `src/utils/apriltagDetection.ts` and implement the `detectAprilTags()` function:
   
   ```typescript
   export function detectAprilTags(
     imageData: ImageData,
     width: number,
     height: number
   ): AprilTagDetection[] {
     // TODO: Integrate your chosen AprilTag library here
     // Example with apriltag.js:
     // const detector = new AprilTagDetector();
     // const detections = detector.detect(imageData);
     // return detections.map(d => ({
     //   id: d.id,
     //   corners: d.corners,
     //   center: d.center,
     //   distance: estimateDistance(d.corners),
     //   angle: calculateAngle(d.center, width)
     // }));
   }
   ```

## Physical Setup

### Tag Preparation
1. **Print AprilTags:**
   - Use 36h11 family (recommended)
   - Print on white paper/cardstock
   - Recommended size: 15cm x 15cm (adjustable in code)
   - Ensure good contrast and no glare

2. **Tag Placement:**
   - Mount tags at eye level (1.5m - 1.7m)
   - Place in key navigation points (doorways, corners, landmarks)
   - Ensure good lighting
   - Avoid reflective surfaces behind tags

3. **Tag Numbering:**
   - Use sequential IDs (0, 1, 2, 3...)
   - Create a map of tag locations
   - Document tag IDs and positions

### Calibration
1. **Focal Length Calibration:**
   ```typescript
   import { calibrateFocalLength } from '@/utils/apriltagDetection';
   
   // Measure:
   // - Known distance to tag (e.g., 2.0 meters)
   // - Tag size (e.g., 0.15 meters)
   // - Pixel width in image (e.g., 120 pixels)
   
   calibrateFocalLength(2.0, 0.15, 120);
   ```

## Usage

### Enabling Navigation Mode
1. Click the Navigation button (compass icon)
2. The button will pulse when active
3. AprilTag guidance will begin automatically

### Setting Target Tag
```typescript
// In your code or via UI:
aprilTag.setTargetTag(5); // Navigate to tag #5
```

### Voice Instructions
The system provides priority-based voice instructions:
- **Priority 1 (Critical):** "Stop here" - Tag directly ahead, very close
- **Priority 2 (Urgent):** "Turn left/right" - Near tag, needs adjustment
- **Priority 3 (Normal):** "Adjust direction" - Medium distance
- **Priority 4 (Info):** "Tag detected X meters away" - Far detection

## Troubleshooting

### No Tags Detected
1. Ensure good lighting conditions
2. Check tag print quality (sharp edges, good contrast)
3. Verify camera permissions are granted
4. Check if detection algorithm is properly integrated

### Inaccurate Distance/Direction
1. Calibrate focal length with known measurements
2. Verify tag size constant matches physical tags
3. Ensure tags are flat and not warped
4. Check camera angle is relatively level

### Performance Issues
1. Reduce detection frequency (increase processingInterval)
2. Lower camera resolution if needed
3. Ensure device has sufficient processing power

## Integration Example

If you have your AprilTag code ready, integrate it like this:

```typescript
// src/utils/apriltagDetection.ts

import YourAprilTagLibrary from 'your-library';

export function detectAprilTags(
  imageData: ImageData,
  width: number,
  height: number
): AprilTagDetection[] {
  const detector = new YourAprilTagLibrary.Detector({
    families: ['tag36h11'],
    // ... other options
  });
  
  const rawDetections = detector.detect(imageData);
  
  return rawDetections.map(d => ({
    id: d.id,
    corners: d.corners,
    center: [(d.corners[0][0] + d.corners[2][0]) / 2, 
             (d.corners[0][1] + d.corners[2][1]) / 2],
    distance: estimateDistance(d.corners),
    angle: calculateAngle(
      [(d.corners[0][0] + d.corners[2][0]) / 2, 
       (d.corners[0][1] + d.corners[2][1]) / 2],
      width
    )
  }));
}
```

## Azure SQL Storage
Navigation data can be logged to Azure SQL:
- Tag encounters
- Navigation paths
- Time spent at locations
- User preferences per location

This data helps improve navigation over time.

## Future Enhancements
- [ ] Visual tag overlay on camera feed
- [ ] Path planning between multiple tags
- [ ] Indoor mapping and localization
- [ ] Historical navigation data analysis
- [ ] Custom voice instructions per location

