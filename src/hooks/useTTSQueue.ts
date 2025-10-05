/**
 * Priority-based TTS Queue Hook
 * Manages speech synthesis with priority levels and deduplication
 * Priority levels: 1 (critical/stop), 2 (urgent warning), 3 (warning), 4 (info), 5 (Q&A), 6 (scene)
 */

import { useCallback, useRef, useEffect } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

interface TTSQueueItem {
  priority: number;
  timestamp: number;
  text: string;
  speed: number;
}

interface TTSQueueOptions {
  token: string | null;
  region: string | null;
  speed?: number;
  minGap?: number;
  dedupCooldown?: number;
}

export function useTTSQueue() {
  const queueRef = useRef<TTSQueueItem[]>([]);
  const isProcessingRef = useRef(false);
  const lastSpokenRef = useRef<{ text: string; time: number } | null>(null);
  const lastTTSTimeRef = useRef(0);
  const currentSynthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);
  const optionsRef = useRef<TTSQueueOptions>({
    token: null,
    region: null,
    speed: 1.0,
    minGap: 0.0,
    dedupCooldown: 10,
  });

  /**
   * Update TTS configuration
   */
  const configure = useCallback((options: Partial<TTSQueueOptions>) => {
    optionsRef.current = { ...optionsRef.current, ...options };
  }, []);

  /**
   * Process the queue - speaks the highest priority message
   */
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return;
    }

    const { token, region, speed = 1.0, minGap = 0.0 } = optionsRef.current;
    if (!token || !region) {
      console.warn('[TTS QUEUE] Token or region not configured');
      return;
    }

    isProcessingRef.current = true;

    // Sort by priority (lower number = higher priority)
    queueRef.current.sort((a, b) => a.priority - b.priority);

    const item = queueRef.current.shift()!;
    const now = Date.now();

    // Enforce minimum gap between TTS
    const gap = minGap * 1000 - (now - lastTTSTimeRef.current);
    if (gap > 0) {
      await new Promise((resolve) => setTimeout(resolve, gap));
    }

    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechSynthesisVoiceName = 'en-US-AriaNeural';

      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
      currentSynthesizerRef.current = synthesizer;

      const ratePercent = Math.round(speed * 100);
      const ssml = `<speak><prosody rate="${ratePercent}%">${item.text}</prosody></speak>`;

      console.log(`[TTS SPEAKING] Priority=${item.priority}: ${item.text} (Speed: ${speed})`);

      await new Promise<void>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            synthesizer.close();
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              lastTTSTimeRef.current = Date.now();
              resolve();
            } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
              console.log('[TTS] Speech canceled (likely interrupted by higher priority)');
              resolve();
            } else {
              reject(new Error(`TTS failed: ${result.reason}`));
            }
          },
          (err) => {
            synthesizer.close();
            reject(err);
          }
        );
      });
    } catch (error) {
      console.error('[TTS ERROR]', error);
    } finally {
      currentSynthesizerRef.current = null;
      isProcessingRef.current = false;
      
      // Process next item in queue
      if (queueRef.current.length > 0) {
        setTimeout(() => processQueue(), 100);
      }
    }
  }, []);

  /**
   * Enqueue a TTS message with priority
   */
  const enqueue = useCallback(
    (text: string, priority: number = 4) => {
      const { dedupCooldown = 10 } = optionsRef.current;
      const now = Date.now();

      // Deduplication check
      if (lastSpokenRef.current) {
        const timeSinceLastSpoken = (now - lastSpokenRef.current.time) / 1000;
        if (lastSpokenRef.current.text === text && timeSinceLastSpoken < dedupCooldown) {
          console.log(`[TTS SKIPPED DUPLICATE] ${text}`);
          return;
        }
      }

      lastSpokenRef.current = { text, time: now };

      // If this is a critical message (priority 1-2), cancel current speech
      if (priority <= 2 && currentSynthesizerRef.current) {
        console.log('[TTS] Canceling current speech for high priority message');
        currentSynthesizerRef.current.close();
        currentSynthesizerRef.current = null;
        isProcessingRef.current = false;
      }

      queueRef.current.push({
        priority,
        timestamp: now,
        text,
        speed: optionsRef.current.speed || 1.0,
      });

      console.log(`[TTS QUEUED] Priority=${priority}: ${text}`);

      // Start processing if not already processing
      if (!isProcessingRef.current) {
        processQueue();
      }
    },
    [processQueue]
  );

  /**
   * Clear the queue
   */
  const clear = useCallback(() => {
    queueRef.current = [];
    if (currentSynthesizerRef.current) {
      currentSynthesizerRef.current.close();
      currentSynthesizerRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return {
    enqueue,
    clear,
    configure,
    queueLength: queueRef.current.length,
  };
}
