/**
 * Azure Speech SDK hook for STT (Speech-to-Text) and TTS (Text-to-Speech)
 * Uses token-based authentication - NEVER uses subscription keys in frontend
 */

import { useCallback, useRef, useState } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { fetchSpeechToken } from '@/lib/api-utils';

export interface SpeechAPI {
  recognizeFromMic: () => Promise<string>;
  speakText: (text: string, onStart?: () => void, onEnd?: () => void) => Promise<void>;
  isInitialized: boolean;
  isListening: boolean;
  isSpeaking: boolean;
}

export function useSpeech() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const regionRef = useRef<string | null>(null);
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);

  /**
   * Initialize or refresh the Speech SDK with a new token
   */
  const initializeSpeech = useCallback(async () => {
    try {
      console.log('🔄 Initializing Speech SDK...');
      const { token, region } = await fetchSpeechToken();
      
      tokenRef.current = token;
      regionRef.current = region;
      
      // Clean up existing instances
      if (recognizerRef.current) {
        recognizerRef.current.close();
      }
      if (synthesizerRef.current) {
        synthesizerRef.current.close();
      }

      setIsInitialized(true);
      setError(null);
      console.log('✅ Speech SDK initialized');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize speech';
      setError(errorMsg);
      setIsInitialized(false);
      throw err;
    }
  }, []);

  /**
   * Recognize speech from microphone (single utterance)
   */
  const recognizeFromMic = useCallback(async (): Promise<string> => {
    if (!tokenRef.current || !regionRef.current) {
      await initializeSpeech();
    }

    return new Promise((resolve, reject) => {
      try {
        setIsListening(true);
        setError(null);

        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
          tokenRef.current!,
          regionRef.current!
        );
        speechConfig.speechRecognitionLanguage = 'en-US';

        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        recognizerRef.current = recognizer;

        console.log('🎤 Listening...');

        recognizer.recognizeOnceAsync(
          (result) => {
            recognizer.close();
            setIsListening(false);

            if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
              console.log('✅ Speech recognized:', result.text);
              resolve(result.text);
            } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
              console.log('⚠️ No speech recognized');
              reject(new Error('No speech detected. Please try again.'));
            } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
              const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
              
              // Check for token expiry
              if (cancellation.reason === SpeechSDK.CancellationReason.Error &&
                  cancellation.ErrorCode === SpeechSDK.CancellationErrorCode.ConnectionFailure) {
                console.log('🔄 Token may be expired, re-initializing...');
                initializeSpeech().then(() => {
                  reject(new Error('Token refreshed. Please try again.'));
                });
              } else {
                console.error('❌ Recognition canceled:', cancellation.errorDetails);
                reject(new Error(`Recognition canceled: ${cancellation.errorDetails}`));
              }
            } else {
              reject(new Error('Speech recognition failed: ' + result.reason));
            }
          },
          (err) => {
            recognizer.close();
            setIsListening(false);
            console.error('❌ Recognition error:', err);
            reject(new Error('Microphone error. Please check permissions.'));
          }
        );
      } catch (err) {
        setIsListening(false);
        console.error('❌ Recognition setup error:', err);
        reject(err);
      }
    });
  }, [initializeSpeech]);

  /**
   * Speak text using TTS
   */
  const speakText = useCallback(
    async (text: string, onStart?: () => void, onEnd?: () => void): Promise<void> => {
      if (!tokenRef.current || !regionRef.current) {
        await initializeSpeech();
      }

      return new Promise((resolve, reject) => {
        try {
          setIsSpeaking(true);
          onStart?.();

          const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
            tokenRef.current!,
            regionRef.current!
          );

          // Use a pleasant voice
          speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';

          const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
          synthesizerRef.current = synthesizer;

          console.log('🔊 Speaking:', text.substring(0, 50) + '...');

          synthesizer.speakTextAsync(
            text,
            (result) => {
              synthesizer.close();
              setIsSpeaking(false);
              onEnd?.();

              if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                console.log('✅ TTS completed');
                resolve();
              } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
                const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
                console.error('❌ TTS canceled:', cancellation.errorDetails);
                
                // Check for token expiry
                if (cancellation.reason === SpeechSDK.CancellationReason.Error) {
                  initializeSpeech().then(() => {
                    reject(new Error('Token refreshed. Please try again.'));
                  });
                } else {
                  reject(new Error(`TTS failed: ${cancellation.errorDetails}`));
                }
              } else {
                reject(new Error('TTS failed: ' + result.reason));
              }
            },
            (err) => {
              synthesizer.close();
              setIsSpeaking(false);
              onEnd?.();
              console.error('❌ TTS error:', err);
              reject(new Error('Speech synthesis failed.'));
            }
          );
        } catch (err) {
          setIsSpeaking(false);
          onEnd?.();
          console.error('❌ TTS setup error:', err);
          reject(err);
        }
      });
    },
    [initializeSpeech]
  );

  /**
   * Cleanup Speech SDK resources
   */
  const dispose = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.close();
      recognizerRef.current = null;
    }
    if (synthesizerRef.current) {
      synthesizerRef.current.close();
      synthesizerRef.current = null;
    }
    setIsInitialized(false);
  }, []);

  return {
    isInitialized,
    isListening,
    isSpeaking,
    error,
    initializeSpeech,
    recognizeFromMic,
    speakText,
    dispose,
  };
}
