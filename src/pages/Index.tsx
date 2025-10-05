/**
 * Main Index page - VQA application
 * Integrates camera, detection, voice, and VQA functionality
 */

import { useState, useRef, useEffect } from 'react';
import { CameraCanvas, Detection } from '@/components/CameraCanvas';
import { VQAControls, ConversationItem } from '@/components/VQAControls';
import { StatusBar } from '@/components/StatusBar';
import { useSpeech } from '@/hooks/useSpeech';
import { useTTSQueue } from '@/hooks/useTTSQueue';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useMicControls } from '@/hooks/useMicControls';
import { useAprilTagDetection } from '@/hooks/useAprilTagDetection';
import { getDynamicPriority } from '@/utils/detectionPriority';
import { NavigationInstruction } from '@/utils/apriltagDetection';
import { sendVQARequest } from '@/lib/api-utils';
import { toast } from 'sonner';
import { Mic, Settings, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/SettingsModal';

const Index = () => {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [muteTTS, setMuteTTS] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastAnnouncedRef = useRef<Map<string, number>>(new Map());
  const tokenRef = useRef<string | null>(null);
  const regionRef = useRef<string | null>(null);

  // User preferences
  const { preferences, updatePreference, savePreferences } = useUserPreferences();

  const {
    isInitialized: speechInitialized,
    isListening,
    isSpeaking,
    initializeSpeech,
    recognizeFromMic,
    speakText,
  } = useSpeech();

  // Priority TTS Queue
  const ttsQueue = useTTSQueue();

  // AprilTag Navigation
  const aprilTag = useAprilTagDetection({
    enabled: true,
    onNavigationInstruction: (instruction: NavigationInstruction) => {
      if (!muteTTS) {
        console.log('[NAV] AprilTag instruction:', instruction.instruction);
        ttsQueue.enqueue(instruction.instruction, instruction.priority);
      }
    },
    announcementInterval: preferences.announcement_interval,
  });

  // Initialize speech on mount and configure TTS queue
  useEffect(() => {
    initializeSpeech()
      .then(async () => {
        // Get token for TTS queue
        const { fetchSpeechToken } = await import('@/lib/api-utils');
        const { token, region } = await fetchSpeechToken();
        tokenRef.current = token;
        regionRef.current = region;
        
        ttsQueue.configure({
          token,
          region,
          speed: preferences.tts_speed,
          minGap: 0.0,
          dedupCooldown: 10,
        });
      })
      .catch((error) => {
        console.error('Speech initialization error:', error);
        toast.error('Voice features unavailable. Check your connection.');
      });
  }, [initializeSpeech, preferences.tts_speed]);

  // Update TTS queue when preferences change
  useEffect(() => {
    if (tokenRef.current && regionRef.current) {
      ttsQueue.configure({
        token: tokenRef.current,
        region: regionRef.current,
        speed: preferences.tts_speed,
      });
    }
  }, [preferences.tts_speed, ttsQueue]);

  // Process AprilTag detection
  useEffect(() => {
    if (!aprilTag.navigationMode) return;

    const processInterval = setInterval(() => {
      const video = document.querySelector('video');
      if (video) {
        aprilTag.processFrame(video);
      }
    }, 500);

    return () => clearInterval(processInterval);
  }, [aprilTag.navigationMode]);

  const handleModelLoaded = () => {
    setModelLoaded(true);
    setCameraActive(true);
    toast.success('AI model loaded successfully!');
  };

  const handleError = (error: string) => {
    toast.error(error);
  };

  /**
   * Handle detections from YOLO model - announce via priority TTS queue
   */
  const handleDetections = (detections: Detection[]) => {
    if (muteTTS || !speechInitialized || !tokenRef.current) {
      return;
    }

    const now = Date.now();
    const video = document.querySelector('video');
    if (!video) {
      console.warn('[DETECTIONS] Video element not found');
      return;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) {
      console.warn('[DETECTIONS] Video dimensions not ready');
      return;
    }

    console.log(`[DETECTIONS] Processing ${detections.length} objects`);

    detections.forEach((detection) => {
      const { priority, instruction } = getDynamicPriority(detection, videoWidth, videoHeight);
      const position = instruction.includes('left') ? 'left' : instruction.includes('right') ? 'right' : 'center';
      const key = `${detection.class}-${position}`;

      // Check if we've announced this object in this position recently
      const lastTime = lastAnnouncedRef.current.get(key);
      const interval = preferences.announcement_interval * 1000;
      
      if (lastTime && (now - lastTime) < interval) {
        return; // Skip - already announced recently
      }

      // Update last announced time
      lastAnnouncedRef.current.set(key, now);

      // Enqueue with dynamic priority
      console.log(`[TTS ENQUEUE] ${instruction} (Priority: ${priority})`);
      ttsQueue.enqueue(instruction, priority);
    });
  };

  const captureFrame = (): string | null => {
    const video = document.querySelector('video');
    if (!video) return null;
    
    return (video as any).captureFrame?.() || null;
  };

  const handleAskQuestion = async (question: string) => {
    setIsProcessing(true);

    try {
      // Capture current frame
      const imageBase64 = captureFrame();
      
      if (!imageBase64) {
        throw new Error('Failed to capture frame. Please ensure camera is active.');
      }

      // Send VQA request
      const { answer } = await sendVQARequest({
        imageBase64,
        question,
      });

      // Add to conversation
      const newItem: ConversationItem = {
        id: Date.now().toString(),
        question,
        answer,
        timestamp: new Date(),
      };

      setConversation((prev) => [...prev, newItem]);

      // Speak answer if TTS is enabled (priority 5 for Q&A)
      if (!muteTTS) {
        ttsQueue.enqueue(`The answer is: ${answer}`, 5);
      }

      toast.success('Answer received!');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to process question';
      console.error('VQA error:', error);
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartListening = async (): Promise<string> => {
    if (isListening) return '';
    return await recognizeFromMic();
  };

  const handleToggleMute = () => {
    setMuteTTS((prev) => !prev);
    toast.info(muteTTS ? 'TTS enabled' : 'TTS muted');
  };

  const handleToggleNavigation = () => {
    aprilTag.toggleNavigation();
    toast.info(
      aprilTag.navigationMode 
        ? 'Navigation mode disabled' 
        : 'Navigation mode enabled - AprilTag guidance active'
    );
  };

  // Mic controls (Space bar / Double-tap)
  useMicControls({
    onActivate: handleStartListening,
    enabled: !isListening && !isProcessing,
  });

  return (
    <div className="min-h-screen w-full flex flex-col p-2 sm:p-4 gap-2 sm:gap-4 relative pb-24 sm:pb-4">
      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        preferences={preferences}
        onSave={savePreferences}
      />

      {/* Status Bar */}
      <StatusBar
        modelLoaded={modelLoaded}
        speechInitialized={speechInitialized}
        cameraActive={cameraActive}
      />

      {/* Settings Button (Desktop) */}
      <Button
        className="fixed top-20 right-4 hidden sm:flex ai-button secondary z-50"
        onClick={() => setShowSettings(true)}
        size="icon"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5" />
      </Button>

      {/* Navigation Mode Button (Desktop) */}
      <Button
        className={`fixed top-36 right-4 hidden sm:flex z-50 ${
          aprilTag.navigationMode ? 'ai-button primary' : 'ai-button secondary'
        }`}
        onClick={handleToggleNavigation}
        size="icon"
        aria-label="Toggle navigation mode"
      >
        <Navigation className={`w-5 h-5 ${aprilTag.navigationMode ? 'animate-pulse' : ''}`} />
      </Button>

      {/* Floating Mic Button (Mobile) */}
      <Button
        className="fixed bottom-6 right-6 sm:hidden w-16 h-16 rounded-full shadow-2xl z-50 ai-button primary flex items-center justify-center"
        onClick={handleStartListening}
        disabled={isListening || isProcessing}
        aria-label="Start voice input"
      >
        <Mic className={`w-7 h-7 ${isListening ? 'animate-pulse' : ''}`} />
      </Button>

      {/* Navigation Button (Mobile) */}
      <Button
        className={`fixed bottom-24 right-6 sm:hidden w-14 h-14 rounded-full shadow-2xl z-50 flex items-center justify-center ${
          aprilTag.navigationMode ? 'ai-button primary' : 'ai-button secondary'
        }`}
        onClick={handleToggleNavigation}
        aria-label="Toggle navigation"
      >
        <Navigation className={`w-6 h-6 ${aprilTag.navigationMode ? 'animate-pulse' : ''}`} />
      </Button>

      {/* Settings Button (Mobile) */}
      <Button
        className="fixed bottom-6 left-6 sm:hidden w-16 h-16 rounded-full shadow-2xl z-50 ai-button secondary flex items-center justify-center"
        onClick={() => setShowSettings(true)}
        aria-label="Open settings"
      >
        <Settings className="w-7 h-7" />
      </Button>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
        {/* Camera Feed - Takes 2/3 on desktop */}
        <div className="lg:col-span-2 glass-panel p-2 sm:p-4 h-[40vh] sm:h-auto">
          <div className="relative w-full h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[600px]">
            <CameraCanvas
              modelPath="/models/yolo11n/model.json"
              onModelLoaded={handleModelLoaded}
              onDetections={handleDetections}
              onError={handleError}
            />
          </div>
        </div>

        {/* VQA Controls - Takes 1/3 on desktop */}
        <div className="glass-panel overflow-hidden flex flex-col h-[45vh] sm:min-h-[500px] lg:min-h-[600px]">
          <VQAControls
            onAskQuestion={handleAskQuestion}
            onStartListening={handleStartListening}
            isListening={isListening}
            isProcessing={isProcessing}
            isSpeaking={isSpeaking}
            conversation={conversation}
            muteTTS={muteTTS}
            onToggleMute={handleToggleMute}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs sm:text-sm text-muted-foreground px-2 pb-2">
        <p className="mb-1">
          Real-time object detection • AprilTag navigation • Priority TTS • Voice I/O • VQA with BLIP
        </p>
        <p className="text-[10px] sm:text-xs opacity-70">
          🎤 Space bar or double-tap to speak • 🧭 Navigation mode: {aprilTag.navigationMode ? 'ON' : 'OFF'}
          {aprilTag.detectedTags.length > 0 && ` • ${aprilTag.detectedTags.length} tag(s) detected`}
        </p>
      </div>
    </div>
  );
};

export default Index;
