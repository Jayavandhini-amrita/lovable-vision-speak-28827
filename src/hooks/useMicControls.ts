/**
 * Microphone Control Hook
 * Handles keyboard (space) and touch (double-tap) activation
 */

import { useEffect, useCallback, useRef } from 'react';

interface MicControlsOptions {
  onActivate: () => void;
  enabled?: boolean;
}

export function useMicControls({ onActivate, enabled = true }: MicControlsOptions) {
  const lastTapRef = useRef<number>(0);
  const doubleTapTimeout = 300; // ms

  /**
   * Handle keyboard events (Space bar)
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      if (event.code === 'Space' && !event.repeat) {
        // Prevent space from scrolling page
        if (event.target === document.body) {
          event.preventDefault();
        }
        
        // Don't trigger if user is typing in an input
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        console.log('[MIC CONTROL] Space bar pressed');
        onActivate();
      }
    },
    [enabled, onActivate]
  );

  /**
   * Handle touch events (double-tap anywhere on mobile)
   */
  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;

      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < doubleTapTimeout && timeSinceLastTap > 0) {
        // Double tap detected
        console.log('[MIC CONTROL] Double-tap detected');
        onActivate();
        lastTapRef.current = 0; // Reset to prevent triple-tap
      } else {
        // First tap
        lastTapRef.current = now;
      }
    },
    [enabled, onActivate]
  );

  useEffect(() => {
    if (!enabled) return;

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchend', handleTouchEnd);

    console.log('✅ Mic controls enabled (Space bar / Double-tap)');

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleKeyDown, handleTouchEnd]);

  return {
    // Could expose methods to programmatically enable/disable
  };
}
