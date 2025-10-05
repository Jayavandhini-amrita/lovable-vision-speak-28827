/**
 * AprilTag Detection Hook
 * Integrates AprilTag detection with the camera feed
 */

import { useRef, useCallback, useState } from 'react';
import {
  AprilTagDetection,
  NavigationInstruction,
  NavigationGuide,
  detectAprilTags,
} from '@/utils/apriltagDetection';

interface UseAprilTagDetectionOptions {
  enabled: boolean;
  onNavigationInstruction?: (instruction: NavigationInstruction) => void;
  announcementInterval?: number; // seconds
}

export function useAprilTagDetection({
  enabled,
  onNavigationInstruction,
  announcementInterval = 5,
}: UseAprilTagDetectionOptions) {
  const [navigationMode, setNavigationMode] = useState(false);
  const [targetTag, setTargetTag] = useState<number | null>(null);
  const [detectedTags, setDetectedTags] = useState<AprilTagDetection[]>([]);
  
  const navGuideRef = useRef(new NavigationGuide());
  const lastProcessTime = useRef(0);
  const processingInterval = 500; // Process every 500ms

  /**
   * Enable navigation mode
   */
  const enableNavigation = useCallback((tagId?: number) => {
    navGuideRef.current.enable();
    setNavigationMode(true);
    
    if (tagId !== undefined) {
      navGuideRef.current.setTargetTag(tagId);
      setTargetTag(tagId);
    }
    
    console.log('[APRILTAG] Navigation mode enabled', tagId ? `targeting tag ${tagId}` : '');
  }, []);

  /**
   * Disable navigation mode
   */
  const disableNavigation = useCallback(() => {
    navGuideRef.current.disable();
    navGuideRef.current.reset();
    setNavigationMode(false);
    setTargetTag(null);
    console.log('[APRILTAG] Navigation mode disabled');
  }, []);

  /**
   * Process frame for AprilTag detection
   */
  const processFrame = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!enabled || !navigationMode) return;

      const now = Date.now();
      if (now - lastProcessTime.current < processingInterval) {
        return;
      }
      lastProcessTime.current = now;

      try {
        // Create canvas to extract image data
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(videoElement, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Detect AprilTags
        const tags = detectAprilTags(imageData, canvas.width, canvas.height);
        setDetectedTags(tags);

        if (tags.length === 0) return;

        // Get navigation instructions
        const instructions = navGuideRef.current.getInstructions(
          tags,
          canvas.width,
          now,
          announcementInterval * 1000
        );

        // Announce instructions
        instructions.forEach((instruction) => {
          onNavigationInstruction?.(instruction);
        });
      } catch (error) {
        console.error('[APRILTAG] Processing error:', error);
      }
    },
    [enabled, navigationMode, announcementInterval, onNavigationInstruction]
  );

  /**
   * Toggle navigation mode
   */
  const toggleNavigation = useCallback(() => {
    if (navigationMode) {
      disableNavigation();
    } else {
      enableNavigation();
    }
  }, [navigationMode, disableNavigation, enableNavigation]);

  return {
    navigationMode,
    targetTag,
    detectedTags,
    enableNavigation,
    disableNavigation,
    toggleNavigation,
    processFrame,
    setTargetTag: (id: number) => {
      navGuideRef.current.setTargetTag(id);
      setTargetTag(id);
    },
  };
}
